import { randomUUID } from "node:crypto";
import {
  GameStartSchema,
  GameStateSyncSchema,
  RoomCodeSchema,
  type GameState,
  type GameStateSync,
  type GameStart,
  type RoomErrorCode,
  type RoomPlayerJoined,
  type RoomPlayerLeft,
  type RoomState,
  CommandIntentSchema,
  type CommandIntent,
  type CommandValidation,
  type CommandErrorCode,
} from "@typelore/shared";
import { generateRoomCode } from "./roomCode.js";
import { GameEngine } from "../game/GameEngine.js";

interface Mutation {
  roomId: string;
  room?: RoomState;
  joined?: RoomPlayerJoined;
  left?: RoomPlayerLeft;
  start?: GameStart;
  sync?: GameStateSync;
  changed: boolean;
}
export type RoomResult = { ok: true; data: Mutation } | { ok: false; code: RoomErrorCode };

export interface RoomManagerOptions {
  code?: (() => string) | undefined;
  uuid?: (() => string) | undefined;
  now?: (() => number) | undefined;
  games?: GameEngine | undefined;
  onSync?: ((sync: GameStateSync) => void) | undefined;
  tickIntervalMs?: number | undefined;
}

export class RoomManager {
  private readonly roomsByCode = new Map<string, RoomState>();
  private readonly roomByConnection = new Map<string, string>();
  private readonly combatTimers = new Map<string, NodeJS.Timeout>();
  private readonly code: () => string;
  private readonly uuid: () => string;
  private readonly now: () => number;
  private readonly games: GameEngine;
  private readonly onSync: ((sync: GameStateSync) => void) | undefined;
  private readonly tickIntervalMs: number;

  constructor(options: RoomManagerOptions = {}) {
    this.code = options.code ?? generateRoomCode;
    this.uuid = options.uuid ?? randomUUID;
    this.now = options.now ?? Date.now;
    this.games = options.games ?? new GameEngine();
    this.onSync = options.onSync;
    this.tickIntervalMs = options.tickIntervalMs ?? 1000;
  }

  get roomCount(): number { return this.roomsByCode.size; }
  get memberCount(): number { return this.roomByConnection.size; }
  get timerCount(): number { return this.combatTimers.size; }

  validateCommand(connectionId: string, candidate: CommandIntent):
    { ok: true; data: CommandValidation } | { ok: false; code: CommandErrorCode } {
    const parsed = CommandIntentSchema.safeParse(candidate);
    if (!parsed.success) return { ok: false, code: "INVALID_PAYLOAD" };
    const intent = parsed.data;
    const room = this.memberRoom(connectionId);
    if (!room) return { ok: false, code: "NOT_IN_ROOM" };
    if (room.roomId !== intent.roomId) return { ok: false, code: "ROOM_MISMATCH" };
    const game = this.games.getSnapshot(room.roomId);
    if (room.status !== "IN_GAME" || !game || game.status !== "IN_GAME") return { ok: false, code: "GAME_NOT_ACTIVE" };
    if (game.startId !== intent.startId) return { ok: false, code: "GAME_MISMATCH" };
    const member = room.players.find((player) => player.connectionId === connectionId);
    if (!game.players.some((player) => player.connectionId === connectionId && player.slot === member?.slot)) {
      return { ok: false, code: "NOT_IN_ROOM" };
    }
    return { ok: true, data: { ...intent, status: "VALIDATED" } };
  }

  executeCommand(connectionId: string, candidate: CommandIntent):
    { ok: true; data: CommandValidation; state: GameState; room: RoomState; changed: boolean } | { ok: false; code: CommandErrorCode } {
    const parsed = CommandIntentSchema.safeParse(candidate);
    if (!parsed.success) return { ok: false, code: "INVALID_PAYLOAD" };
    const intent = parsed.data;
    const room = this.memberRoom(connectionId);
    if (!room) return { ok: false, code: "NOT_IN_ROOM" };
    if (room.roomId !== intent.roomId) return { ok: false, code: "ROOM_MISMATCH" };
    if (room.status !== "IN_GAME") return { ok: false, code: "GAME_NOT_ACTIVE" };

    const result = this.games.executeCommand(room.roomId, connectionId, intent);
    if (!result.ok) return { ok: false, code: result.code };

    const updatedRoom = this.snapshot(room);
    if (result.changed) {
      const sync: GameStateSync = { room: updatedRoom, state: result.state, serverTime: this.now() };
      this.onSync?.(sync);
    }

    return {
      ok: true,
      data: { ...intent, status: "VALIDATED" },
      state: result.state,
      room: updatedRoom,
      changed: result.changed,
    };
  }

  startCombatTimer(code: string, roomId: string): void {
    this.stopCombatTimer(code);
    const timer = setInterval(() => this.processCombatTick(code, roomId), this.tickIntervalMs);
    this.combatTimers.set(code, timer);
  }

  stopCombatTimer(code: string): void {
    const timer = this.combatTimers.get(code);
    if (timer) {
      clearInterval(timer);
      this.combatTimers.delete(code);
    }
  }

  processCombatTick(code: string, roomId: string): void {
    const room = this.roomsByCode.get(code);
    if (!room || room.status !== "IN_GAME") {
      this.stopCombatTimer(code);
      return;
    }
    const result = this.games.tick(roomId);
    if (result.ok && result.changed) {
      if (result.state.status === "GAME_OVER") {
        this.stopCombatTimer(code);
        room.status = "GAME_OVER";
        room.revision += 1;
      }
      const sync: GameStateSync = { room: this.snapshot(room), state: result.state, serverTime: this.now() };
      this.onSync?.(sync);
    }
  }

  getRoom(code: string): RoomState | undefined {
    const room = this.roomsByCode.get(code);
    return room && this.snapshot(room);
  }

  clear(): void {
    for (const timer of this.combatTimers.values()) {
      clearInterval(timer);
    }
    this.combatTimers.clear();
    this.games.clear();
    this.roomsByCode.clear();
    this.roomByConnection.clear();
  }

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
    const candidate = this.snapshot(room);
    candidate.players.find((member) => member.connectionId === connectionId)!.ready = ready;
    candidate.revision += 1;
    if (candidate.players.length === 2 && candidate.players.every((member) => member.ready)) {
      candidate.status = "STARTING";
      const start = GameStartSchema.parse({ room: candidate, startId: this.uuid(), serverTime: this.now() });
      const state = this.games.prepare(start);
      const finalRoom: RoomState = { ...candidate, status: "IN_GAME", revision: candidate.revision + 1 };
      const sync = GameStateSyncSchema.parse({ room: finalRoom, state, serverTime: start.serverTime });
      // Prepare and validate everything before either state owner commits.
      this.games.commit(state);
      this.roomsByCode.set(room.code, finalRoom);
      this.startCombatTimer(finalRoom.code, finalRoom.roomId);
      return { ok: true, data: { roomId, room: this.snapshot(finalRoom), start, sync, changed: true } };
    }
    this.roomsByCode.set(room.code, candidate);
    return this.success(candidate);
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
    this.stopCombatTimer(room.code);
    this.games.remove(room.roomId);
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
