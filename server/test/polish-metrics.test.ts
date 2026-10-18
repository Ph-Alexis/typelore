import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MatchMetricsSchema,
  PlayerMetricsSchema,
  type GameStart,
  type GameState,
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

describe("Milestone M10: Polish & Playtest Metrics Test Suite", () => {
  it("TC01: Metrics are properly initialized when a game is committed", () => {
    const nowTime = 1000;
    const engine = new GameEngine({ now: () => nowTime });
    const { roomId } = setupEngineGame(engine);

    const metrics = engine.getMetrics(roomId);
    expect(metrics).toBeDefined();
    expect(metrics?.startedAt).toBe(1000);
    expect(metrics?.durationSeconds).toBe(0);
    expect(metrics?.players.PLAYER_1.validCommands).toBe(0);
    expect(metrics?.players.PLAYER_2.validCommands).toBe(0);
  });

  it("TC02: Command execution tracks validCommands, charactersTyped, and action counters", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupEngineGame(engine);

    // Place pistol
    const resPistol = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 1,
    });
    expect(resPistol.ok).toBe(true);

    // Load ammo
    const resAmmo = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 1,
    });
    expect(resAmmo.ok).toBe(true);

    // Add protector
    const resProt = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "protector",
      target: 2,
    });
    expect(resProt.ok).toBe(true);

    // Add water then clay (craft brick)
    const resWater = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add water",
      target: 3,
    });
    expect(resWater.ok).toBe(true);

    const resClay = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add clay",
      target: 3,
    });
    expect(resClay.ok).toBe(true);

    const metrics = engine.getMetrics(roomId);
    expect(metrics?.players.PLAYER_1.validCommands).toBe(5);
    expect(metrics?.players.PLAYER_1.pistolsPlaced).toBe(1);
    expect(metrics?.players.PLAYER_1.ammoLoaded).toBe(5);
    expect(metrics?.players.PLAYER_1.protectorsPlaced).toBe(1);
    expect(metrics?.players.PLAYER_1.waterAdded).toBe(1);
    expect(metrics?.players.PLAYER_1.clayAdded).toBe(1);
    expect(metrics?.players.PLAYER_1.bricksCrafted).toBe(1);
    expect(metrics?.players.PLAYER_1.charactersTyped).toBe(
      "pistol 1".length + "load ammo 1".length + "protector 2".length + "add water 3".length + "add clay 3".length,
    );
  });

  it("TC03: Boost and Bazooka track bazookaFired and damageDealtBazooka", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupEngineGame(engine);

    // Place protector on P2 grid at cell 7
    engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "protector",
      target: 7,
    });

    // P1 boosts 10 times
    for (let i = 0; i < 10; i++) {
      engine.executeCommand(roomId, p1, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "boost",
      });
    }

    // P1 fires bazooka at area 1 (cells 7, 8, 4, 5)
    const bazookaRes = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(bazookaRes.ok).toBe(true);

    const metrics = engine.getMetrics(roomId);
    expect(metrics?.players.PLAYER_1.bazookaFired).toBe(1);
    expect(metrics?.players.PLAYER_1.damageDealtBazooka).toBe(10);
  });

  it("TC04: Bird and Arrow execution tracks birdsLaunched and birdsShotDown", () => {
    const nowTime = 1000;
    const engine = new GameEngine({ now: () => nowTime });
    const { roomId, startId, p1, p2 } = setupEngineGame(engine);

    // P1 launches bird
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bird and bomb",
    });

    // P2 shoots arrow 3 times to kill the bird (15 HP - 3*5 = 0)
    engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });
    engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });
    engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });

    const metrics = engine.getMetrics(roomId);
    expect(metrics?.players.PLAYER_1.birdsLaunched).toBe(1);
    expect(metrics?.players.PLAYER_2.birdsShotDown).toBe(1);
  });

  it("TC05: Combat ticks track pistol damage, bird damage, and castle damage taken", () => {
    const nowTime = 1000;
    const engine = new GameEngine({ now: () => nowTime });
    const { roomId, startId, p1 } = setupEngineGame(engine);

    // Setup pistol with ammo for P1
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 1,
    });
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 1,
    });

    // Tick combat
    engine.tick(roomId);

    const metrics = engine.getMetrics(roomId);
    expect(metrics?.players.PLAYER_1.damageDealtPistol).toBe(5);
    expect(metrics?.players.PLAYER_2.castleDamageTaken).toBe(5);
  });

  it("TC06: Game Over attaches completed MatchMetrics to result with duration and valid schema", () => {
    let nowTime = 1000;
    const engine = new GameEngine({ now: () => nowTime });
    const { roomId, startId, p1 } = setupEngineGame(engine);

    // P1 places pistol
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 1,
    });
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 1,
    });

    // Manually set P2 castle HP to 5 so next tick is lethal
    const snapshot = engine.getSnapshot(roomId)!;
    snapshot.players[1].castle.hp = 5;
    engine.clear();
    engine.commit(snapshot);

    // Advance time by 45 seconds
    nowTime = 46000;

    const tickRes = engine.tick(roomId);
    expect(tickRes.ok).toBe(true);
    if (!tickRes.ok) return;

    expect(tickRes.state.status).toBe("GAME_OVER");
    expect(tickRes.state.result?.winner).toBe("PLAYER_1");
    expect(tickRes.state.result?.metrics).toBeDefined();

    const resultMetrics = tickRes.state.result?.metrics;
    expect(resultMetrics?.durationSeconds).toBe(45);
    expect(resultMetrics?.endedAt).toBe(46000);
    expect(MatchMetricsSchema.safeParse(resultMetrics).success).toBe(true);
  });

  it("TC07: Schema validation validates PlayerMetricsSchema and MatchMetricsSchema invariants", () => {
    const validPlayerMetrics = {
      damageDealtPistol: 25,
      damageDealtBird: 20,
      damageDealtBazooka: 10,
      castleDamageTaken: 15,
      pistolsPlaced: 2,
      ammoLoaded: 10,
      protectorsPlaced: 1,
      protectorsDestroyed: 1,
      waterAdded: 2,
      clayAdded: 2,
      bricksCrafted: 2,
      hpHealed: 15,
      bazookaFired: 1,
      birdsLaunched: 1,
      birdsHitCastle: 1,
      birdsShotDown: 0,
      validCommands: 14,
      invalidCommands: 2,
      charactersTyped: 95,
    };
    expect(PlayerMetricsSchema.safeParse(validPlayerMetrics).success).toBe(true);

    const validMatch = {
      durationSeconds: 120,
      startedAt: 1000,
      endedAt: 121000,
      players: {
        PLAYER_1: validPlayerMetrics,
        PLAYER_2: validPlayerMetrics,
      },
    };
    expect(MatchMetricsSchema.safeParse(validMatch).success).toBe(true);
  });

  it("TC08: RoomManager and GameEngine cleanup removes metrics properly", () => {
    const games = new GameEngine();
    const manager = new RoomManager({ games });

    const createRes = manager.create("p1");
    if (!createRes.ok || !createRes.data.room) throw new Error("create failed");
    const code = createRes.data.room.code;
    const roomId = createRes.data.roomId;

    manager.join("p2", code);
    manager.setReady("p1", roomId, true);
    manager.setReady("p2", roomId, true);

    expect(games.getMetrics(roomId)).toBeDefined();

    // Player 1 disconnects
    manager.disconnect("p1");

    // Metrics and game must be cleaned up
    expect(games.getMetrics(roomId)).toBeUndefined();
    expect(games.gameCount).toBe(0);
  });

  it("TC09: Invalid command execution increments invalidCommands and adds charactersTyped", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupEngineGame(engine);

    // First valid command
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "protector",
      target: 2,
    });

    // Attempt to place another object in occupied cell 2
    const failRes = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 2,
    });
    expect(failRes.ok).toBe(false);

    const metrics = engine.getMetrics(roomId);
    expect(metrics?.players.PLAYER_1.validCommands).toBe(1);
    expect(metrics?.players.PLAYER_1.invalidCommands).toBe(1);
    expect(metrics?.players.PLAYER_1.charactersTyped).toBe("protector 2".length + "pistol 2".length);
  });

  it("TC10: Pistol hitting grid structure tracks actual damageDealtPistol", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupEngineGame(engine);

    // P1 places pistol at cell 1 (lane 1) and loads ammo
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 1,
    });
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 1,
    });

    // P2 places protector at cell 9 (opponent lane 1 front cell)
    engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "protector",
      target: 9,
    });

    // Tick combat: P1 shot hits P2's protector
    engine.tick(roomId);

    const metrics = engine.getMetrics(roomId);
    expect(metrics?.players.PLAYER_1.damageDealtPistol).toBe(5);
    expect(metrics?.players.PLAYER_2.castleDamageTaken).toBe(0); // castle didn't take damage, protector did
  });

  it("TC11: Overkill damage is capped at target's remaining HP", () => {
    const nowTime = 1000;
    const engine = new GameEngine({ now: () => nowTime });
    const { roomId, startId, p1, p2 } = setupEngineGame(engine);

    // Place protector on P2 grid at cell 7
    engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "protector",
      target: 7,
    });

    // Manually set protector HP to 4 (< BAZOOKA_DAMAGE 10)
    const snapshot = engine.getSnapshot(roomId)!;
    snapshot.players[1]!.grid.find((c) => c.id === 7)!.object!.hp = 4;
    engine.clear();
    engine.commit(snapshot);

    // P1 boosts 10 times and fires bazooka
    for (let i = 0; i < 10; i++) {
      engine.executeCommand(roomId, p1, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "boost",
      });
    }
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });

    const metricsAfterBazooka = engine.getMetrics(roomId);
    expect(metricsAfterBazooka?.players.PLAYER_1.damageDealtBazooka).toBe(4); // capped at 4, not 10

    // P1 launches bird; set P2 castle HP to 8 (< BIRD_DAMAGE 20)
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bird and bomb",
    });

    const snap2 = engine.getSnapshot(roomId)!;
    snap2.players[1]!.castle.hp = 8;
    // Fast-forward ticksRemaining to 1
    snap2.players[0]!.birds[0]!.ticksRemaining = 1;
    engine.clear();
    engine.commit(snap2);

    engine.tick(roomId);

    const metricsAfterBird = engine.getMetrics(roomId);
    expect(metricsAfterBird?.players.PLAYER_1.damageDealtBird).toBe(8); // capped at 8, not 20
    expect(metricsAfterBird?.players.PLAYER_2.castleDamageTaken).toBe(8);
  });

  it("TC12: MatchMetricsSchema validation rejects endedAt < startedAt when endedAt > 0", () => {
    const validPlayerMetrics = {
      damageDealtPistol: 0,
      damageDealtBird: 0,
      damageDealtBazooka: 0,
      castleDamageTaken: 0,
      pistolsPlaced: 0,
      ammoLoaded: 0,
      protectorsPlaced: 0,
      protectorsDestroyed: 0,
      waterAdded: 0,
      clayAdded: 0,
      bricksCrafted: 0,
      hpHealed: 0,
      bazookaFired: 0,
      birdsLaunched: 0,
      birdsHitCastle: 0,
      birdsShotDown: 0,
      validCommands: 0,
      invalidCommands: 0,
      charactersTyped: 0,
    };
    const invalidMatch = {
      durationSeconds: 10,
      startedAt: 5000,
      endedAt: 2000,
      players: {
        PLAYER_1: validPlayerMetrics,
        PLAYER_2: validPlayerMetrics,
      },
    };
    const parseRes = MatchMetricsSchema.safeParse(invalidMatch);
    expect(parseRes.success).toBe(false);
  });
});
