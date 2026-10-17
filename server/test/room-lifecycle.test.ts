import { randomUUID } from "node:crypto";
import { GameStateSyncSchema, PROTOCOL_VERSION, type GameStateSync, type ClientToServerEvents, type ServerToClientEvents,
  type RoomAck, type RoomState, type GameStart, type RoomPlayerLeft } from "@typelore/shared";
import { io, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createTypeloreServer, type TypeloreServer } from "../src/app.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: Client[] = [];
const servers: TypeloreServer[] = [];
const TIMEOUT = 2000;
function event<T>(client: Client, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { client.off(name as "room:updated", listener); reject(new Error(`Timed out: ${name}`)); }, TIMEOUT);
    const listener = (payload: unknown) => { clearTimeout(timer); resolve(payload as T); };
    client.once(name as "room:updated", listener);
  });
}
function request<T>(client: Client, name: string, payload: unknown): Promise<RoomAck<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout: ${name}`)), TIMEOUT);
    // Deliberately raw emit also exercises malformed network input in boundary tests.
    (client.emit as (name: string, payload: unknown, ack: (response: RoomAck<T>) => void) => void)(name, payload,
      (response) => { clearTimeout(timer); resolve(response); });
  });
}
function success<T>(response: RoomAck<T>): T {
  expect(response.ok).toBe(true);
  if (!response.ok) throw new Error(response.error.code);
  return response.data;
}
async function start() {
  const server = createTypeloreServer({ clientOrigin: "http://localhost:5173" });
  servers.push(server);
  return { server, url: `http://127.0.0.1:${await server.start(0)}` };
}
async function connect(url: string, hello = true) {
  const client: Client = io(url, { autoConnect: false, forceNew: true, reconnection: false, transports: ["websocket"] });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Connect timeout")), TIMEOUT);
    client.once("connect", () => { clearTimeout(timer); resolve(); });
    client.once("connect_error", (error) => { clearTimeout(timer); reject(error); });
    client.connect();
  });
  if (hello) success(await request(client, "protocol:hello", { protocolVersion: PROTOCOL_VERSION }));
  return client;
}
async function create(client: Client) {
  return success(await request<{ room: RoomState }>(client, "room:create", {})).room;
}
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const server of servers.splice(0)) await server.stop();
});

describe("room socket lifecycle", () => {
  it("M03 publishes ordered identical private snapshots once and final ready ack is IN_GAME", async () => {
    const { url } = await start();
    const [host, guest, outsider] = await Promise.all([connect(url), connect(url), connect(url)]);
    const room = await create(host);
    await request(guest, "room:join", { code: room.code });
    await request(host, "room:ready", { roomId: room.roomId, ready: true });
    success(await request(guest, "connection:ping", { nonce: "ready-delivered", clientTime: 0 }));
    const orders: string[][] = [[], []];
    const snapshots: GameStateSync[][] = [[], []];
    const starts: GameStart[][] = [[], []];
    for (const [index, client] of [host, guest].entries()) {
      client.on("room:updated", (value) => { orders[index]!.push(value.status); });
      client.on("game:start", (value) => { orders[index]!.push("start"); starts[index]!.push(value); });
      client.on("game:state-sync", (value) => { orders[index]!.push("sync"); snapshots[index]!.push(value); });
    }
    let leaked = 0;
    outsider.on("game:state-sync", () => { leaked += 1; });
    outsider.on("game:start", () => { leaked += 1; });
    const synced = event<GameStateSync>(guest, "game:state-sync");
    const response = success(await request<{ room: RoomState }>(guest, "room:ready", { roomId: room.roomId, ready: true }));
    const snapshot = await synced;
    success(await request(host, "connection:ping", { nonce: "barrier", clientTime: 0 }));
    expect(response.room.status).toBe("IN_GAME");
    expect(GameStateSyncSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.room).toEqual(response.room);
    for (const index of [0, 1]) {
      expect(orders[index]).toEqual(["STARTING", "start", "IN_GAME", "sync"]);
      expect(snapshots[index]).toEqual([snapshot]);
      expect(starts[index]?.[0]?.startId).toBe(snapshot.state.startId);
    }
    for (const player of snapshot.state.players) {
      expect(player.castle).toEqual({ hp: 200, maxHp: 200 });
      expect(player.grid).toHaveLength(9);
      expect(player.grid.every((cell, index) => cell.id === index + 1 && cell.object === null)).toBe(true);
    }
    await request(guest, "room:ready", { roomId: room.roomId, ready: true });
    success(await request(outsider, "connection:ping", { nonce: "private", clientTime: 0 }));
    expect(leaked).toBe(0); expect(snapshots[0]).toHaveLength(1); expect(snapshots[1]).toHaveLength(1);
    const waiting = event<RoomState>(host, "room:updated");
    success(await request(guest, "room:leave", { roomId: room.roomId }));
    expect((await waiting).status).toBe("WAITING_FOR_PLAYERS");
    await request(outsider, "room:join", { code: room.code });
    await request(host, "room:ready", { roomId: room.roomId, ready: true });
    const fresh = event<GameStateSync>(host, "game:state-sync");
    await request(outsider, "room:ready", { roomId: room.roomId, ready: true });
    expect((await fresh).state.startId).not.toBe(snapshot.state.startId);
    expect(snapshots[1]).toHaveLength(1); // Departed client receives no replacement state.
  });

  it("M03 handles concurrent ready requests with one initialization", async () => {
    const { url } = await start();
    const [host, guest] = await Promise.all([connect(url), connect(url)]);
    const room = await create(host); await request(guest, "room:join", { code: room.code });
    let count = 0; host.on("game:state-sync", () => { count += 1; });
    const synced = event<GameStateSync>(host, "game:state-sync");
    const replies = await Promise.all([request(host, "room:ready", { roomId: room.roomId, ready: true }),
      request(guest, "room:ready", { roomId: room.roomId, ready: true })]);
    expect(replies.every((reply) => reply.ok)).toBe(true);
    expect((await synced).state.revision).toBe(1);
    success(await request(host, "connection:ping", { nonce: "concurrent", clientTime: 0 }));
    expect(count).toBe(1);
  });
  it("T03/T04/T05/T06 creates, joins, broadcasts privately and reports capacity/errors", async () => {
    const { url } = await start();
    const [host, guest, outsider] = await Promise.all([connect(url), connect(url), connect(url)]);
    let outsiderEvents = 0;
    outsider.on("room:updated", () => { outsiderEvents += 1; });
    const createdEvent = event<RoomState>(host, "room:updated");
    const room = await create(host);
    expect(await createdEvent).toEqual(room);
    expect(room.players[0]?.connectionId).toBe(host.id);
    const hostUpdate = event<RoomState>(host, "room:updated");
    const guestUpdate = event<RoomState>(guest, "room:updated");
    const joined = event(guest, "room:player-joined");
    const response = success(await request<{ room: RoomState }>(guest, "room:join", { code: ` ${room.code.toLowerCase()} ` }));
    expect(await hostUpdate).toEqual(response.room);
    expect(await guestUpdate).toEqual(response.room);
    expect(await joined).toMatchObject({ roomId: room.roomId, player: { slot: "PLAYER_2", connectionId: guest.id } });
    expect(await request(outsider, "room:join", { code: room.code })).toMatchObject({ ok: false, error: { code: "ROOM_FULL" } });
    expect(await request(outsider, "room:join", { code: "OOOOOO" })).toMatchObject({ ok: false, error: { code: "INVALID_ROOM_CODE" } });
    let missing = "ABC234";
    if (missing === room.code) missing = "DEF567";
    expect(await request(outsider, "room:join", { code: missing })).toMatchObject({ ok: false, error: { code: "ROOM_NOT_FOUND" } });
    // A server ping ack is a delivery barrier; no arbitrary sleeps for negative assertions.
    success(await request(outsider, "connection:ping", { nonce: "barrier", clientTime: 0 }));
    expect(outsiderEvents).toBe(0);
  });

  it("T07 allows only one concurrent contender into the last slot", async () => {
    const { url } = await start();
    const [host, a, b] = await Promise.all([connect(url), connect(url), connect(url)]);
    const room = await create(host);
    const results = await Promise.all([request<{ room: RoomState }>(a, "room:join", { code: room.code }), request<{ room: RoomState }>(b, "room:join", { code: room.code })]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ error: { code: "ROOM_FULL" } });
    expect(results.find((result) => result.ok && result.data.room.players.length === 2)).toBeDefined();
  });

  it("T09/T10 syncs ready/unready, starts once and rejects extra ready/full join", async () => {
    const { url } = await start();
    const [host, guest, outsider] = await Promise.all([connect(url), connect(url), connect(url)]);
    const room = await create(host);
    await request(guest, "room:join", { code: room.code });
    const update = event<RoomState>(guest, "room:updated");
    const ready = success(await request<{ room: RoomState }>(host, "room:ready", { roomId: room.roomId, ready: true })).room;
    expect(await update).toEqual(ready);
    const repeat = success(await request<{ room: RoomState }>(host, "room:ready", { roomId: room.roomId, ready: true })).room;
    expect(repeat.revision).toBe(ready.revision);
    expect(success(await request<{ room: RoomState }>(host, "room:ready", { roomId: room.roomId, ready: false })).room.players[0]?.ready).toBe(false);
    await request(host, "room:ready", { roomId: room.roomId, ready: true });
    const starts: GameStart[] = [];
    host.on("game:start", (payload) => { starts.push(payload); });
    const hStart = event<GameStart>(host, "game:start");
    const gStart = event<GameStart>(guest, "game:start");
    await request(guest, "room:ready", { roomId: room.roomId, ready: true });
    expect(await hStart).toEqual(await gStart);
    expect(await request(guest, "room:ready", { roomId: room.roomId, ready: true })).toMatchObject({ error: { code: "ROOM_NOT_WAITING" } });
    expect(await request(outsider, "room:join", { code: room.code })).toMatchObject({ error: { code: "ROOM_FULL" } });
    expect(starts).toHaveLength(1);
  });

  it("T11/T12/T13 leaves, cancels start on disconnect, promotes and deletes empty rooms", async () => {
    const { url } = await start();
    const [host, guest, replacement] = await Promise.all([connect(url), connect(url), connect(url)]);
    const room = await create(host);
    await request(guest, "room:join", { code: room.code });
    const voluntary = event<RoomPlayerLeft>(host, "room:player-left");
    success(await request(guest, "room:leave", { roomId: room.roomId }));
    expect((await voluntary).reason).toBe("LEFT");
    await request(guest, "room:join", { code: room.code });
    await request(host, "room:ready", { roomId: room.roomId, ready: true });
    await request(guest, "room:ready", { roomId: room.roomId, ready: true });
    const left = event<RoomPlayerLeft>(guest, "room:player-left");
    const waiting = event<RoomState>(guest, "room:updated");
    host.disconnect();
    expect((await left).reason).toBe("DISCONNECTED");
    expect(await waiting).toMatchObject({ status: "WAITING_FOR_PLAYERS", players: [{ connectionId: guest.id, slot: "PLAYER_1", ready: false }] });
    success(await request(replacement, "room:join", { code: room.code }));
    success(await request(guest, "room:leave", { roomId: room.roomId }));
    success(await request(replacement, "room:leave", { roomId: room.roomId }));
    expect(await request(guest, "room:join", { code: room.code })).toMatchObject({ error: { code: "ROOM_NOT_FOUND" } });
  });

  it("T08/T14 guards identity, handshake, stale room and malformed/missing callbacks", async () => {
    const { url } = await start();
    const client = await connect(url, false);
    expect(await request(client, "room:create", {})).toMatchObject({ error: { code: "PROTOCOL_NOT_READY" } });
    await request(client, "protocol:hello", { protocolVersion: "wrong" });
    expect(await request(client, "room:create", {})).toMatchObject({ error: { code: "PROTOCOL_NOT_READY" } });
    await request(client, "protocol:hello", { protocolVersion: PROTOCOL_VERSION });
    expect(await request(client, "room:ready", { roomId: randomUUID(), ready: true })).toMatchObject({ error: { code: "NOT_IN_ROOM" } });
    expect(await request(client, "room:leave", { roomId: randomUUID() })).toMatchObject({ error: { code: "NOT_IN_ROOM" } });
    expect(await request(client, "room:create", { playerId: "forged" })).toMatchObject({ error: { code: "INVALID_PAYLOAD" } });
    (client.emit as (name: string, payload: unknown) => void)("room:create", {});
    const room = await create(client); // Missing ack must not silently create a room.
    expect(await request(client, "room:create", {})).toMatchObject({ error: { code: "ALREADY_IN_ROOM" } });
    expect(await request(client, "room:join", { code: room.code })).toMatchObject({ error: { code: "ALREADY_IN_ROOM" } });
    expect(await request(client, "room:ready", { roomId: room.roomId, ready: "true" })).toMatchObject({ error: { code: "INVALID_PAYLOAD" } });
    expect(await request(client, "room:leave", { roomId: randomUUID() })).toMatchObject({ error: { code: "ROOM_MISMATCH" } });
    (client.emit as (name: string, payload: unknown) => void)("connection:ping", {});
    expect(success(await request(client, "connection:ping", { nonce: "barrier", clientTime: 0 }))).toMatchObject({ nonce: "barrier" });
  });

  it("T15 reconnects with no automatic room reclaim and isolates server factories", async () => {
    const { url } = await start();
    const client = await connect(url);
    const room = await create(client);
    const other = await start();
    const isolated = await connect(other.url);
    expect(await request(isolated, "room:join", { code: room.code })).toMatchObject({ error: { code: "ROOM_NOT_FOUND" } });
    const oldId = client.id;
    client.disconnect();
    const reconnected = await connect(url);
    expect(reconnected.id).not.toBe(oldId);
    expect(await request(reconnected, "room:leave", { roomId: room.roomId })).toMatchObject({ error: { code: "NOT_IN_ROOM" } });
    expect((await create(reconnected)).roomId).not.toBe(room.roomId);
  });

  it("T11/T12 stops delivering after leave and deletes a room after its last disconnect", async () => {
    const { url, server } = await start();
    const [host, guest] = await Promise.all([connect(url), connect(url)]);
    const room = await create(host);
    await request(guest, "room:join", { code: room.code });
    success(await request(guest, "room:leave", { roomId: room.roomId }));
    const leaked: RoomState[] = [];
    guest.on("room:updated", (payload) => { leaked.push(payload); });
    const replacement = await connect(url);
    success(await request(replacement, "room:join", { code: room.code }));
    success(await request(guest, "connection:ping", { nonce: "barrier", clientTime: 0 }));
    expect(leaked).toHaveLength(0);
    success(await request(replacement, "room:leave", { roomId: room.roomId }));
    // Wait for actual server disconnect processing before querying the deleted code.
    const removed = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Disconnect timeout")), TIMEOUT);
      server.io.sockets.sockets.get(host.id!)!.once("disconnect", () => { clearTimeout(timer); resolve(); });
    });
    host.disconnect();
    await removed;
    expect(await request(guest, "room:join", { code: room.code })).toMatchObject({ error: { code: "ROOM_NOT_FOUND" } });
  });
});
