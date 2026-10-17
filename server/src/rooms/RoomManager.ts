import { randomUUID } from "node:crypto";
import { RoomCodeSchema, type GameStart, type RoomErrorCode, type RoomPlayerJoined,
  type RoomPlayerLeft, type RoomState } from "@typelore/shared";
import { generateRoomCode } from "./roomCode.js";

interface Mutation {
  roomId: string;
  room?: RoomState;
  joined?: RoomPlayerJoined;
  left?: RoomPlayerLeft;
  start?: GameStart;
  changed: boolean;
}
export type RoomResult = { ok: true; data: Mutation } | { ok: false; code: RoomErrorCode };
interface Options { code?: () => string; uuid?: () => string; now?: () => number }

export class RoomManager {
  private readonly roomsByCode = new Map<string, RoomState>();
  private readonly roomByConnection = new Map<string, string>();
  private readonly code: () => string;
  private readonly uuid: () => string;
  private readonly now: () => number;

  constructor(options: Options = {}) {
    this.code = options.code ?? generateRoomCode;
    this.uuid = options.uuid ?? randomUUID;
    this.now = options.now ?? Date.now;
  }

  get roomCount(): number { return this.roomsByCode.size; }
  get memberCount(): number { return this.roomByConnection.size; }
  getRoom(code: string): RoomState | undefined {
    const room = this.roomsByCode.get(code);
    return room && this.snapshot(room);
  }
  clear(): void { this.roomsByCode.clear(); this.roomByConnection.clear(); }
  private snapshot(room: RoomState): RoomState {
    return { ...room, players: room.players.map((player) => ({ ...player })) };
  }
  private success(room: RoomState, changed = true): RoomResult {
    return { ok: true, data: { roomId: room.roomId, room: this.snapshot(room), changed } };
  }

  create(connectionId: string): RoomResult {
    if (this.roomByConnection.has(connectionId)) return { ok: false, code: "ALREADY_IN_ROOM" };
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const code = this.code();
      if (!RoomCodeSchema.safeParse(code).success || this.roomsByCode.has(code)) continue;
      const room: RoomState = { roomId: this.uuid(), code, revision: 1,
        status: "WAITING_FOR_PLAYERS", players: [{ connectionId, slot: "PLAYER_1", ready: false }] };
      this.roomsByCode.set(code, room);
      this.roomByConnection.set(connectionId, code);
      return this.success(room);
    }
    return { ok: false, code: "ROOM_CODE_EXHAUSTED" };
  }

  join(connectionId: string, code: string): RoomResult {
    if (this.roomByConnection.has(connectionId)) return { ok: false, code: "ALREADY_IN_ROOM" };
    const room = this.roomsByCode.get(code);
    if (!room) return { ok: false, code: "ROOM_NOT_FOUND" };
    if (room.players.length >= 2) return { ok: false, code: "ROOM_FULL" };
    if (room.status === "STARTING" || room.status === "IN_GAME") return { ok: false, code: "ROOM_NOT_JOINABLE" };
    room.players.forEach((player) => { player.ready = false; });
    const player = { connectionId, slot: "PLAYER_2" as const, ready: false };
    room.players.push(player);
    room.status = "READY_TO_START";
    room.revision += 1;
    this.roomByConnection.set(connectionId, code);
    return { ok: true, data: { roomId: room.roomId, room: this.snapshot(room), changed: true,
      joined: { roomId: room.roomId, revision: room.revision, player: { ...player } } } };
  }

  setReady(connectionId: string, roomId: string, ready: boolean): RoomResult {
    const room = this.memberRoom(connectionId);
    if (!room) return { ok: false, code: "NOT_IN_ROOM" };
    if (room.roomId !== roomId) return { ok: false, code: "ROOM_MISMATCH" };
    if (room.status !== "READY_TO_START") return { ok: false, code: "ROOM_NOT_WAITING" };
    const player = room.players.find((member) => member.connectionId === connectionId)!;
    if (player.ready === ready) return this.success(room, false);
    player.ready = ready;
    room.revision += 1;
    if (room.players.length === 2 && room.players.every((member) => member.ready)) {
      room.status = "STARTING";
      const snapshot = this.snapshot(room);
      return { ok: true, data: { roomId, room: snapshot, changed: true,
        start: { room: this.snapshot(room), startId: this.uuid(), serverTime: this.now() } } };
    }
    return this.success(room);
  }

  leave(connectionId: string, roomId: string): RoomResult {
    const room = this.memberRoom(connectionId);
    if (!room) return { ok: false, code: "NOT_IN_ROOM" };
    if (room.roomId !== roomId) return { ok: false, code: "ROOM_MISMATCH" };
    return this.remove(connectionId, room, "LEFT");
  }
  disconnect(connectionId: string): RoomResult | undefined {
    const room = this.memberRoom(connectionId);
    return room && this.remove(connectionId, room, "DISCONNECTED");
  }
  private memberRoom(connectionId: string): RoomState | undefined {
    const code = this.roomByConnection.get(connectionId);
    return code ? this.roomsByCode.get(code) : undefined;
  }
  private remove(connectionId: string, room: RoomState, reason: "LEFT" | "DISCONNECTED"): RoomResult {
    this.roomByConnection.delete(connectionId);
    room.players = room.players.filter((player) => player.connectionId !== connectionId);
    if (room.players.length === 0) {
      this.roomsByCode.delete(room.code);
      return { ok: true, data: { roomId: room.roomId, changed: true } };
    }
    room.players[0]!.slot = "PLAYER_1";
    room.players[0]!.ready = false;
    room.status = "WAITING_FOR_PLAYERS";
    room.revision += 1;
    return { ok: true, data: { roomId: room.roomId, room: this.snapshot(room), changed: true,
      left: { roomId: room.roomId, revision: room.revision, connectionId, reason } } };
  }
}
