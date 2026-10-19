import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BIRD_HP,
  BIRD_FLIGHT_TIME_MS,
  GameResultSchema,
  GameStateSchema,
  GameStateSyncSchema,
  type GameStart,
  type GameState,
  type GameStateSync,
} from "@typelore/shared";
import { GameEngine } from "../src/game/GameEngine.js";
import { RoomManager } from "../src/rooms/RoomManager.js";

function setupEngineGame(engine: GameEngine): {
  roomId: string;
  startId: string;
  p1: string;
  p2: string;
  game: GameState;
} {
  const roomId = randomUUID();
  const startId = randomUUID();
  const p1 = randomUUID();
  const p2 = randomUUID();
  const start: GameStart = {
    room: {
      roomId,
      code: "ABC234",
      revision: 1,
      status: "STARTING",
      players: [
        { connectionId: p1, slot: "PLAYER_1", ready: true },
        { connectionId: p2, slot: "PLAYER_2", ready: true },
      ],
    },
    startId,
    serverTime: 1000,
  };
  const game = engine.prepare(start);
  engine.commit(game);
  return { roomId, startId, p1, p2, game };
}

function mutateGame(engine: GameEngine, roomId: string, fn: (state: GameState) => void): void {
  const snapshot = engine.getSnapshot(roomId)!;
  fn(snapshot);
  engine.clear();
  engine.commit(snapshot);
}

describe("Milestone M09: Game Over & Reliability Test Suite", () => {
  it("TC01: Pistol lethal shot reduces opponent Castle HP to 0 and triggers GAME_OVER with winner/loser", () => {
    const engine = new GameEngine();
    const { roomId } = setupEngineGame(engine);

    // Set opponent (P2) castle HP to 5 and give P1 a pistol with 1 ammo
    mutateGame(engine, roomId, (game) => {
      game.players[1].castle.hp = 5;
      const cell1 = game.players[0].grid.find((c) => c.id === 1)!;
      cell1.object = { type: "PISTOL", hp: 15, maxHp: 15, ammo: 1, maxAmmo: 10 };
    });

    const tickResult = engine.tick(roomId);
    expect(tickResult.ok).toBe(true);
    if (!tickResult.ok) return;

    expect(tickResult.state.players[1].castle.hp).toBe(0);
    expect(tickResult.state.status).toBe("GAME_OVER");
    expect(tickResult.state.result).toMatchObject({
      winner: "PLAYER_1",
      loser: "PLAYER_2",
      reason: "CASTLE_DESTROYED",
    });
  });

  it("TC02: Bird & Bomb lethal arrival reduces Castle HP to 0 and triggers GAME_OVER with winner/loser", () => {
    const engine = new GameEngine();
    const { roomId } = setupEngineGame(engine);

    // Set P1 castle HP to 20 and give P2 an arriving bird
    mutateGame(engine, roomId, (game) => {
      game.players[0].castle.hp = 20;
      game.players[1].birds.push({
        id: randomUUID(),
        hp: BIRD_HP,
        maxHp: BIRD_HP,
        createdAt: 1000,
        flightDurationMs: BIRD_FLIGHT_TIME_MS,
        ticksRemaining: 1,
        word: "abcdefghijkl",
      });
    });

    const tickResult = engine.tick(roomId);
    expect(tickResult.ok).toBe(true);
    if (!tickResult.ok) return;

    expect(tickResult.state.players[0].castle.hp).toBe(0);
    expect(tickResult.state.status).toBe("GAME_OVER");
    expect(tickResult.state.result).toMatchObject({
      winner: "PLAYER_2",
      loser: "PLAYER_1",
      reason: "CASTLE_DESTROYED",
    });
  });

  it("TC03: Simultaneous damage drops both Castles to 0 HP on the same tick, resulting in DRAW", () => {
    const engine = new GameEngine();
    const { roomId } = setupEngineGame(engine);

    // Both players have 5 HP and active firing pistols
    mutateGame(engine, roomId, (game) => {
      game.players[0].castle.hp = 5;
      game.players[1].castle.hp = 5;
      const p1Cell = game.players[0].grid.find((c) => c.id === 1)!;
      p1Cell.object = { type: "PISTOL", hp: 15, maxHp: 15, ammo: 1, maxAmmo: 10 };
      const p2Cell = game.players[1].grid.find((c) => c.id === 7)!;
      p2Cell.object = { type: "PISTOL", hp: 15, maxHp: 15, ammo: 1, maxAmmo: 10 };
    });

    const tickResult = engine.tick(roomId);
    expect(tickResult.ok).toBe(true);
    if (!tickResult.ok) return;

    expect(tickResult.state.players[0].castle.hp).toBe(0);
    expect(tickResult.state.players[1].castle.hp).toBe(0);
    expect(tickResult.state.status).toBe("GAME_OVER");
    expect(tickResult.state.result).toMatchObject({
      winner: null,
      loser: null,
      reason: "DRAW",
    });
  });

  it("TC04: Subsequent tick() calls after GAME_OVER return GAME_NOT_ACTIVE and do not mutate state", () => {
    const engine = new GameEngine();
    const { roomId } = setupEngineGame(engine);

    mutateGame(engine, roomId, (game) => {
      game.players[1].castle.hp = 5;
      const cell1 = game.players[0].grid.find((c) => c.id === 1)!;
      cell1.object = { type: "PISTOL", hp: 15, maxHp: 15, ammo: 2, maxAmmo: 10 };
    });

    const firstTick = engine.tick(roomId);
    expect(firstTick.ok).toBe(true);
    if (!firstTick.ok) return;
    expect(firstTick.state.status).toBe("GAME_OVER");
    const revision = firstTick.state.revision;

    // Attempt second tick
    const secondTick = engine.tick(roomId);
    expect(secondTick).toEqual({ ok: false, code: "GAME_NOT_ACTIVE" });

    const snapshot = engine.getSnapshot(roomId);
    expect(snapshot?.status).toBe("GAME_OVER");
    expect(snapshot?.revision).toBe(revision);
  });

  it("TC05: Subsequent executeCommand() calls after GAME_OVER in GameEngine return GAME_NOT_ACTIVE", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupEngineGame(engine);

    mutateGame(engine, roomId, (game) => {
      game.players[1].castle.hp = 5;
      const cell1 = game.players[0].grid.find((c) => c.id === 1)!;
      cell1.object = { type: "PISTOL", hp: 15, maxHp: 15, ammo: 1, maxAmmo: 10 };
    });
    engine.tick(roomId);

    // Attempt to execute command after GAME_OVER
    const cmdResult = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "boost",
    });
    expect(cmdResult).toEqual({ ok: false, code: "GAME_NOT_ACTIVE" });
  });

  it("TC06: RoomManager stops combat timer immediately upon GAME_OVER and updates room.status to GAME_OVER", () => {
    const syncs: GameStateSync[] = [];
    const games = new GameEngine();
    const manager = new RoomManager({
      games,
      onSync: (sync) => syncs.push(sync),
    });

    const createResult = manager.create("p1");
    if (!createResult.ok || !createResult.data.room) throw new Error("create failed");
    const code = createResult.data.room.code;
    const roomId = createResult.data.roomId;

    manager.join("p2", code);
    manager.setReady("p1", roomId, true);
    manager.setReady("p2", roomId, true);

    expect(manager.timerCount).toBe(1);
    const roomBefore = manager.getRoom(code);
    expect(roomBefore?.status).toBe("IN_GAME");

    // Manually set opponent HP to 5 and add pistol to trigger lethal hit on next combat tick
    mutateGame(games, roomId, (gameSnapshot) => {
      gameSnapshot.players[1].castle.hp = 5;
      gameSnapshot.players[0].grid.find((c) => c.id === 1)!.object = {
        type: "PISTOL",
        hp: 15,
        maxHp: 15,
        ammo: 1,
        maxAmmo: 10,
      };
    });

    // Process tick
    manager.processCombatTick(code, roomId);

    // Timer must be stopped immediately
    expect(manager.timerCount).toBe(0);

    const roomAfter = manager.getRoom(code);
    expect(roomAfter?.status).toBe("GAME_OVER");

    // Sync must have been emitted with GAME_OVER
    expect(syncs.length).toBeGreaterThan(0);
    const lastSync = syncs[syncs.length - 1];
    expect(lastSync?.room.status).toBe("GAME_OVER");
    expect(lastSync?.state.status).toBe("GAME_OVER");
    expect(lastSync?.state.result?.winner).toBe("PLAYER_1");
  });

  it("TC07: RoomManager rejects subsequent player commands after GAME_OVER with GAME_NOT_ACTIVE", () => {
    const games = new GameEngine();
    const manager = new RoomManager({ games });

    const createResult = manager.create("p1");
    if (!createResult.ok || !createResult.data.room) throw new Error("create failed");
    const code = createResult.data.room.code;
    const roomId = createResult.data.roomId;

    manager.join("p2", code);
    manager.setReady("p1", roomId, true);
    const readyResult = manager.setReady("p2", roomId, true);
    if (!readyResult.ok || !readyResult.data.start) throw new Error("start failed");
    const startId = readyResult.data.start.startId;

    // Trigger game over via tick
    mutateGame(games, roomId, (gameSnapshot) => {
      gameSnapshot.players[1].castle.hp = 5;
      gameSnapshot.players[0].grid.find((c) => c.id === 1)!.object = {
        type: "PISTOL",
        hp: 15,
        maxHp: 15,
        ammo: 1,
        maxAmmo: 10,
      };
    });

    manager.processCombatTick(code, roomId);

    // Attempt validateCommand
    const validateRes = manager.validateCommand("p1", {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "boost",
    });
    expect(validateRes).toEqual({ ok: false, code: "GAME_NOT_ACTIVE" });

    // Attempt executeCommand
    const execRes = manager.executeCommand("p1", {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "boost",
    });
    expect(execRes).toEqual({ ok: false, code: "GAME_NOT_ACTIVE" });
  });

  it("TC08: GameStateSyncSchema validates synchronized state payload containing GAME_OVER", () => {
    const roomId = randomUUID();
    const startId = randomUUID();
    const p1 = randomUUID();
    const p2 = randomUUID();

    const validGameOverSync = {
      room: {
        roomId,
        code: "DEF456",
        revision: 5,
        status: "GAME_OVER",
        players: [
          { connectionId: p1, slot: "PLAYER_1", ready: true },
          { connectionId: p2, slot: "PLAYER_2", ready: true },
        ],
      },
      state: {
        roomId,
        startId,
        revision: 4,
        status: "GAME_OVER",
        result: {
          winner: "PLAYER_2",
          loser: "PLAYER_1",
          reason: "CASTLE_DESTROYED",
        },
        players: [
          {
            slot: "PLAYER_1",
            connectionId: p1,
            castle: { hp: 0, maxHp: 200 },
            bazookaBoost: 0,
            birdCooldownUntil: 0,
            birds: [],
            grid: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, object: null })),
          },
          {
            slot: "PLAYER_2",
            connectionId: p2,
            castle: { hp: 120, maxHp: 200 },
            bazookaBoost: 5,
            birdCooldownUntil: 0,
            birds: [],
            grid: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, object: null })),
          },
        ],
      },
      serverTime: 2000,
    };

    const parseResult = GameStateSyncSchema.safeParse(validGameOverSync);
    expect(parseResult.success).toBe(true);
  });

  it("TC09: Disconnecting during active game immediately stops combat timer and removes game from engine", () => {
    const games = new GameEngine();
    const manager = new RoomManager({ games });

    const createResult = manager.create("p1");
    if (!createResult.ok || !createResult.data.room) throw new Error("create failed");
    const code = createResult.data.room.code;
    const roomId = createResult.data.roomId;

    manager.join("p2", code);
    manager.setReady("p1", roomId, true);
    manager.setReady("p2", roomId, true);

    expect(manager.timerCount).toBe(1);
    expect(games.gameCount).toBe(1);

    // p1 disconnects during match
    const discResult = manager.disconnect("p1");
    expect(discResult?.ok).toBe(true);

    // Combat timer must be stopped, game removed
    expect(manager.timerCount).toBe(0);
    expect(games.gameCount).toBe(0);

    // Room resets to WAITING_FOR_PLAYERS with remaining player promoted to PLAYER_1
    const room = manager.getRoom(code);
    expect(room?.status).toBe("WAITING_FOR_PLAYERS");
    expect(room?.players[0]?.slot).toBe("PLAYER_1");
    expect(room?.players[0]?.connectionId).toBe("p2");
  });

  it("TC10: Player leaving room after GAME_OVER cleans up room properly without errors or orphan timers", () => {
    const games = new GameEngine();
    const manager = new RoomManager({ games });

    const createResult = manager.create("p1");
    if (!createResult.ok || !createResult.data.room) throw new Error("create failed");
    const code = createResult.data.room.code;
    const roomId = createResult.data.roomId;

    manager.join("p2", code);
    manager.setReady("p1", roomId, true);
    manager.setReady("p2", roomId, true);

    // Trigger game over via tick
    mutateGame(games, roomId, (gameSnapshot) => {
      gameSnapshot.players[1].castle.hp = 5;
      gameSnapshot.players[0].grid.find((c) => c.id === 1)!.object = {
        type: "PISTOL",
        hp: 15,
        maxHp: 15,
        ammo: 1,
        maxAmmo: 10,
      };
    });

    manager.processCombatTick(code, roomId);
    expect(manager.getRoom(code)?.status).toBe("GAME_OVER");

    // Player 1 leaves after game over
    const leaveResult = manager.leave("p1", roomId);
    expect(leaveResult.ok).toBe(true);
    expect(manager.timerCount).toBe(0);

    // Player 2 leaves as well
    const leaveResult2 = manager.leave("p2", roomId);
    expect(leaveResult2.ok).toBe(true);

    // Room should be deleted when empty
    expect(manager.roomCount).toBe(0);
    expect(manager.memberCount).toBe(0);
    expect(manager.timerCount).toBe(0);
  });

  it("TC11: GameStateSchema and GameResultSchema enforce cross-field status/result invariants (CP-001)", () => {
    const roomId = randomUUID();
    const startId = randomUUID();
    const p1 = randomUUID();
    const p2 = randomUUID();

    const baseState = {
      roomId,
      startId,
      revision: 1,
      players: [
        {
          slot: "PLAYER_1" as const,
          connectionId: p1,
          castle: { hp: 200, maxHp: 200 as const },
          bazookaBoost: 0,
          birdCooldownUntil: 0,
          birds: [],
          grid: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, object: null })),
        },
        {
          slot: "PLAYER_2" as const,
          connectionId: p2,
          castle: { hp: 200, maxHp: 200 as const },
          bazookaBoost: 0,
          birdCooldownUntil: 0,
          birds: [],
          grid: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, object: null })),
        },
      ] as const,
    };

    // IN_GAME with null result is valid
    const validInGame = GameStateSchema.safeParse({
      ...baseState,
      status: "IN_GAME",
      result: null,
    });
    expect(validInGame.success).toBe(true);

    // IN_GAME with non-null result is rejected
    const invalidInGame = GameStateSchema.safeParse({
      ...baseState,
      status: "IN_GAME",
      result: { winner: "PLAYER_1", loser: "PLAYER_2", reason: "CASTLE_DESTROYED" },
    });
    expect(invalidInGame.success).toBe(false);

    // GAME_OVER with null result is rejected
    const invalidGameOver = GameStateSchema.safeParse({
      ...baseState,
      status: "GAME_OVER",
      result: null,
    });
    expect(invalidGameOver.success).toBe(false);

    // GAME_OVER with valid result is accepted
    const validGameOver = GameStateSchema.safeParse({
      ...baseState,
      status: "GAME_OVER",
      result: { winner: "PLAYER_1", loser: "PLAYER_2", reason: "CASTLE_DESTROYED" },
    });
    expect(validGameOver.success).toBe(true);

    // GameResultSchema: DRAW with non-null winner/loser is rejected
    expect(GameResultSchema.safeParse({ winner: "PLAYER_1", loser: null, reason: "DRAW" }).success).toBe(false);
    expect(GameResultSchema.safeParse({ winner: null, loser: "PLAYER_2", reason: "DRAW" }).success).toBe(false);
    expect(GameResultSchema.safeParse({ winner: null, loser: null, reason: "DRAW" }).success).toBe(true);

    // GameResultSchema: Decisive outcome with null or identical winner/loser is rejected
    expect(GameResultSchema.safeParse({ winner: null, loser: "PLAYER_2", reason: "CASTLE_DESTROYED" }).success).toBe(false);
    expect(GameResultSchema.safeParse({ winner: "PLAYER_1", loser: null, reason: "CASTLE_DESTROYED" }).success).toBe(false);
    expect(GameResultSchema.safeParse({ winner: "PLAYER_1", loser: "PLAYER_1", reason: "CASTLE_DESTROYED" }).success).toBe(false);
    expect(GameResultSchema.safeParse({ winner: "PLAYER_1", loser: "PLAYER_2", reason: "CASTLE_DESTROYED" }).success).toBe(true);
  });
});
