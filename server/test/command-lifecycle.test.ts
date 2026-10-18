import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { COMMAND_RULES, CommandAckSchema, PROTOCOL_VERSION, type Ack,
  type ClientToServerEvents, type ServerToClientEvents, type RoomState, type GameStateSync } from "@typelore/shared";
import { createTypeloreServer, type TypeloreServer } from "../src/app.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: Client[] = []; const servers: TypeloreServer[] = [];
function request<T>(client: Client, name: string, payload: unknown): Promise<Ack<T, string>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout: ${name}`)), 2000);
    (client.emit as (name: string, payload: unknown, ack: (response: Ack<T, string>) => void) => void)(name, payload,
      (response) => { clearTimeout(timer); resolve(response); });
  });
}
function success<T>(response: Ack<T, string>): T {
  expect(response.ok).toBe(true);
  if (!response.ok) throw new Error(response.error.code);
  return response.data;
}
async function server() {
  const instance = createTypeloreServer({ clientOrigin: "http://localhost:5173" }); servers.push(instance);
  return `http://127.0.0.1:${await instance.start(0)}`;
}
async function connect(url: string, hello = true) {
  const client: Client = io(url, { forceNew: true, autoConnect: false, reconnection: false, transports: ["websocket"] });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Connect timeout")), 2000);
    client.once("connect", () => { clearTimeout(timer); resolve(); });
    client.once("connect_error", (error) => { clearTimeout(timer); reject(error); }); client.connect();
  });
  if (hello) success(await request(client, "protocol:hello", { protocolVersion: PROTOCOL_VERSION }));
  return client;
}
async function match(host: Client, guest: Client): Promise<GameStateSync> {
  const room = success(await request<{ room: RoomState }>(host, "room:create", {})).room;
  success(await request(guest, "room:join", { code: room.code }));
  success(await request(host, "room:ready", { roomId: room.roomId, ready: true }));
  const sync = new Promise<GameStateSync>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Sync timeout")), 2000);
    host.once("game:state-sync", (value) => { clearTimeout(timer); resolve(value); });
  });
  success(await request(guest, "room:ready", { roomId: room.roomId, ready: true }));
  return sync;
}
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const instance of servers.splice(0)) await instance.stop();
});

describe("game command socket boundary", () => {
  it("validates and executes commands with sync broadcasts to room members", async () => {
    const url = await server(); const host = await connect(url); const guest = await connect(url); const outsider = await connect(url);
    const sync = await match(host, guest);
    success(await request(guest, "connection:ping", { nonce: "ready", clientTime: 0 }));
    let broadcasts = 0;
    let outsiderBroadcasts = 0;
    for (const client of [host, guest]) {
      client.on("game:state-sync", () => { broadcasts += 1; });
    }
    outsider.on("game:state-sync", () => { outsiderBroadcasts += 1; });
    const cellTargets: Record<string, number> = {
      pistol: 1, "load ammo": 1, protector: 2, "add water": 3, "add clay": 3, bazooka: 1,
    };
    for (let b = 0; b < 10; b++) {
      await request(host, "game:command", {
        requestId: randomUUID(), roomId: sync.room.roomId, startId: sync.state.startId, command: "BOOST",
      });
    }
    await request(guest, "game:command", {
      requestId: randomUUID(), roomId: sync.room.roomId, startId: sync.state.startId, command: "BIRD AND BOMB",
    });
    for (const [command, max] of Object.entries(COMMAND_RULES)) {
      const target = cellTargets[command] ?? (max ? max : undefined);
      const payload = { requestId: randomUUID(), roomId: sync.room.roomId, startId: sync.state.startId,
        command: command.toUpperCase(), ...(target ? { target } : {}) };
      const ack = CommandAckSchema.parse(await request(host, "game:command", payload));
      expect(ack).toMatchObject({ ok: true, data: { ...payload, command, status: "VALIDATED" } });
    }
    for (const client of [host, guest, outsider]) success(await request(client, "connection:ping", { nonce: "barrier", clientTime: 0 }));
    expect(broadcasts).toBeGreaterThan(0);
    expect(outsiderBroadcasts).toBe(0);
    const duplicate = { requestId: randomUUID(), roomId: sync.room.roomId, startId: sync.state.startId, command: "boost" };
    expect(await request(host, "game:command", duplicate)).toMatchObject({ ok: true });
    expect(await request(host, "game:command", duplicate)).toMatchObject({ ok: true });
    expect(await request(outsider, "game:command", duplicate)).toMatchObject({ ok: false, error: { code: "NOT_IN_ROOM" } });
  });

  it("rejects no protocol, malformed payloads, lobby, wrong room/start and requests after leave", async () => {
    const url = await server(); const host = await connect(url); const guest = await connect(url); const unready = await connect(url, false);
    const payload = { requestId: randomUUID(), roomId: randomUUID(), startId: randomUUID(), command: "boost" };
    expect(await request(unready, "game:command", payload)).toMatchObject({ error: { code: "PROTOCOL_NOT_READY" } });
    success(await request(unready, "protocol:hello", { protocolVersion: PROTOCOL_VERSION }));
    const room = success(await request<{ room: RoomState }>(unready, "room:create", {})).room;
    expect(await request(unready, "game:command", { ...payload, roomId: room.roomId })).toMatchObject({ error: { code: "GAME_NOT_ACTIVE" } });
    const sync = await match(host, guest);
    const valid = { ...payload, roomId: sync.room.roomId, startId: sync.state.startId };
    for (const bad of [{ ...valid, command: "boost " }, { ...valid, target: 1 }, { ...valid, playerId: guest.id },
      { ...valid, hp: 200 }, { ...valid, command: "pistol" }, { ...valid, command: "bazooka", target: 5 },
      { ...valid, command: "pistol", target: "1" }, { ...valid, command: "pistol", target: 1.5 }]) {
      expect(await request(host, "game:command", bad)).toMatchObject({ error: { code: "INVALID_PAYLOAD" } });
    }
    expect(await request(host, "game:command", { ...valid, roomId: randomUUID() })).toMatchObject({ error: { code: "ROOM_MISMATCH" } });
    expect(await request(host, "game:command", { ...valid, startId: randomUUID() })).toMatchObject({ error: { code: "GAME_MISMATCH" } });
    (host.emit as (event: string, value: unknown) => void)("game:command", valid); // Missing ACK is ignored.
    success(await request(host, "connection:ping", { nonce: "missing-ack", clientTime: 0 }));
    success(await request(guest, "room:leave", { roomId: sync.room.roomId }));
    expect(await request(guest, "game:command", valid)).toMatchObject({ error: { code: "NOT_IN_ROOM" } });
    expect(await request(host, "game:command", valid)).toMatchObject({ error: { code: "GAME_NOT_ACTIVE" } });
    success(await request(guest, "room:join", { code: sync.room.code }));
    success(await request(host, "room:ready", { roomId: sync.room.roomId, ready: true }));
    success(await request(guest, "room:ready", { roomId: sync.room.roomId, ready: true }));
    expect(await request(host, "game:command", valid)).toMatchObject({ error: { code: "GAME_MISMATCH" } });
    const isolated = await connect(await server());
    expect(await request(isolated, "game:command", valid)).toMatchObject({ error: { code: "NOT_IN_ROOM" } });
  });
});
