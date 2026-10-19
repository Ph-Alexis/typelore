import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CastleStateSchema, GameStateSchema, GameStateSyncSchema, GridCellStateSchema,
  NUMPAD_CELL_ORDER, OPPONENT_CELL_ORDER, type GameStart } from "@typelore/shared";
import { createInitialGameState, GameEngine } from "../src/game/GameEngine.js";
import { RoomManager } from "../src/rooms/RoomManager.js";

function start(): GameStart {
  return { startId: randomUUID(), serverTime: 0, room: {
    roomId: randomUUID(), code: "ABC234", revision: 4, status: "STARTING",
    players: [{ connectionId: "a", slot: "PLAYER_1", ready: true },
      { connectionId: "b", slot: "PLAYER_2", ready: true }],
  } };
}

describe("battlefield schemas and engine", () => {
  it("initializes two canonical empty grids and independent 200 HP castles", () => {
    const input = start();
    const state = createInitialGameState(input);
    expect(state).toMatchObject({ roomId: input.room.roomId, startId: input.startId, revision: 1, status: "IN_GAME" });
    expect(GameStateSchema.safeParse(state).success).toBe(true);
    expect(state.players.map((player) => player.connectionId)).toEqual(["a", "b"]);
    for (const player of state.players) {
      expect(player.castle).toEqual({ hp: 200, maxHp: 200 });
      expect(player.grid).toEqual(Array.from({ length: 9 }, (_, index) => ({ id: index + 1, object: null })));
    }
    state.players[0].castle.hp = 1;
    expect(state.players[1].castle.hp).toBe(200);
    expect(NUMPAD_CELL_ORDER).toEqual([7, 8, 9, 4, 5, 6, 1, 2, 3]);
    expect(OPPONENT_CELL_ORDER).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it("rejects invalid HP, cells, grid sizes/order, identities and envelope fields", () => {
    for (const hp of [-1, 201, 1.5]) expect(CastleStateSchema.safeParse({ hp, maxHp: 200 }).success).toBe(false);
    expect(CastleStateSchema.safeParse({ hp: 200, maxHp: 201 }).success).toBe(false);
    expect(CastleStateSchema.safeParse({ hp: 0, maxHp: 200 }).success).toBe(true);
    for (const id of [0, 10, 1.5]) expect(GridCellStateSchema.safeParse({ id, object: null }).success).toBe(false);
    expect(GridCellStateSchema.safeParse({ id: 1, object: {} }).success).toBe(false);
    const valid = createInitialGameState(start());
    const reject = (mutate: (value: typeof valid) => void) => {
      const candidate = structuredClone(valid); mutate(candidate);
      expect(GameStateSchema.safeParse(candidate).success).toBe(false);
    };
    reject((value) => { value.players[0].grid.pop(); });
    reject((value) => { value.players[0].grid.push({ id: 9, object: null }); });
    reject((value) => { value.players[0].grid[0]!.id = 2; });
    reject((value) => { value.players[0].grid.reverse(); });
    reject((value) => { value.players[1].slot = "PLAYER_1"; });
    reject((value) => { value.players[1].connectionId = "a"; });
    reject((value) => { value.revision = 0; });
    reject((value) => { value.startId = "invalid"; });
    expect(GameStateSchema.safeParse({ ...valid, players: [valid.players[0]] }).success).toBe(false);
    expect(GameStateSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
    const initial = start();
    const sync = { room: { ...initial.room, status: "IN_GAME" }, state: createInitialGameState(initial), serverTime: 0 };
    expect(GameStateSyncSchema.safeParse(sync).success).toBe(true);
    expect(GameStateSyncSchema.safeParse({ ...sync, serverTime: Infinity }).success).toBe(false);
    expect(GameStateSyncSchema.safeParse({ ...sync, room: initial.room }).success).toBe(false);
    expect(GameStateSyncSchema.safeParse({ ...sync, room: { ...sync.room, roomId: randomUUID() } }).success).toBe(false);
    expect(GameStateSyncSchema.safeParse({ ...sync, room: { ...sync.room, players: [initial.room.players[0]] } }).success).toBe(false);
    sync.state.players[0].connectionId = "outsider";
    expect(GameStateSyncSchema.safeParse(sync).success).toBe(false);
  });

  it("isolates committed state, rejects repeat initialization and clears storage", () => {
    const engine = new GameEngine();
    const initial = start();
    const candidate = engine.prepare(initial);
    engine.commit(candidate);
    candidate.players[0].grid[0]!.id = 9;
    const copy = engine.getSnapshot(candidate.roomId)!;
    copy.players[0].castle.hp = 0;
    copy.players[0].grid[0]!.id = 8;
    expect(engine.getSnapshot(candidate.roomId)?.players[0].castle.hp).toBe(200);
    expect(engine.getSnapshot(candidate.roomId)?.players[0].grid[0]?.id).toBe(1);
    expect(() => engine.prepare(initial)).toThrow("already initialized");
    expect(() => engine.commit(createInitialGameState(initial))).toThrow("already initialized");
    expect(new GameEngine().getSnapshot(candidate.roomId)).toBeUndefined();
    const second = engine.prepare(start()); engine.commit(second);
    engine.remove(candidate.roomId);
    expect(engine.gameCount).toBe(1);
    expect(engine.getSnapshot(candidate.roomId)).toBeUndefined();
    engine.clear(); expect(engine.gameCount).toBe(0);
  });

  it("does not partially commit room readiness when initialization fails", () => {
    class FailingEngine extends GameEngine {
      override prepare(): never { throw new Error("Initialization failed"); }
    }
    const games = new FailingEngine();
    const manager = new RoomManager({ games });
    const created = manager.create("a");
    if (!created.ok || !created.data.room) throw new Error("Expected room");
    const room = created.data.room;
    manager.join("b", room.code); manager.setReady("a", room.roomId, true);
    const before = manager.getRoom(room.code);
    expect(() => manager.setReady("b", room.roomId, true)).toThrow("Initialization failed");
    expect(manager.getRoom(room.code)).toEqual(before);
    expect(games.gameCount).toBe(0);
  });

  it("cleans a game on either slot leaving and starts a fresh replacement match", () => {
    for (const departing of ["a", "b"]) {
      const games = new GameEngine(); const manager = new RoomManager({ games });
      const created = manager.create("a");
      if (!created.ok || !created.data.room) throw new Error("Expected room");
      const room = created.data.room;
      manager.join("b", room.code); manager.setReady("a", room.roomId, true);
      const first = manager.setReady("b", room.roomId, true);
      if (!first.ok) throw new Error("Expected game");
      expect(first.data.room?.status).toBe("IN_GAME"); expect(games.gameCount).toBe(1);
      expect(manager.setReady("b", room.roomId, true)).toEqual({ ok: false, code: "ROOM_NOT_WAITING" });
      if (departing === "a") manager.disconnect(departing); else manager.leave(departing, room.roomId);
      expect(games.gameCount).toBe(0);
      const survivor = departing === "a" ? "b" : "a";
      expect(manager.getRoom(room.code)?.players).toEqual([{ connectionId: survivor, slot: "PLAYER_1", ready: false }]);
      manager.join("c", room.code); manager.setReady(survivor, room.roomId, true);
      const next = manager.setReady("c", room.roomId, true);
      if (!next.ok) throw new Error("Expected replacement");
      expect(next.data.sync?.state.startId).not.toBe(first.data.start?.startId);
      expect(next.data.sync?.state.revision).toBe(1);
      manager.clear(); expect(games.gameCount).toBe(0);
      expect(manager.memberCount).toBe(0); expect(manager.roomCount).toBe(0);
    }
  });
});
