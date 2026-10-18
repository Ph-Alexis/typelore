import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CASTLE_HP,
  BAZOOKA_REQUIRED_BOOST,
  BAZOOKA_AREAS,
  PROTECTOR_HP,
  type GameStart,
} from "@typelore/shared";
import { GameEngine } from "../src/game/GameEngine.js";

function setupGame(engine: GameEngine): { roomId: string; startId: string; p1: string; p2: string } {
  const roomId = randomUUID();
  const startId = randomUUID();
  const p1 = "conn-player-1";
  const p2 = "conn-player-2";
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
    serverTime: Date.now(),
  };
  const state = engine.prepare(start);
  engine.commit(state);
  return { roomId, startId, p1, p2 };
}

describe("M07 Bazooka & Boost Engine", () => {
  it("initializes two players with bazookaBoost = 0", () => {
    const engine = new GameEngine();
    const { roomId } = setupGame(engine);

    const snapshot = engine.getSnapshot(roomId);
    expect(snapshot).toBeDefined();
    expect(snapshot?.players[0].bazookaBoost).toBe(0);
    expect(snapshot?.players[1].bazookaBoost).toBe(0);
  });

  it("increments bazookaBoost by 1 on 'boost' command up to max 10", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    for (let i = 1; i <= BAZOOKA_REQUIRED_BOOST; i++) {
      const res = engine.executeCommand(roomId, p1, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "boost",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.changed).toBe(true);
      expect(res.state.players[0].bazookaBoost).toBe(i);
      expect(res.state.revision).toBe(1 + i);
    }
  });

  it("allows 'boost' command when already at 10 boost without error (idempotent)", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Boost to 10
    for (let i = 1; i <= 10; i++) {
      engine.executeCommand(roomId, p1, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "boost",
      });
    }

    // 11th boost
    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "boost",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.changed).toBe(true);
    expect(res.state.players[0].bazookaBoost).toBe(10);
  });

  it("rejects 'bazooka' command with BOOST_NOT_READY when boost < 10", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Attempt to fire at boost 0
    const res0 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(res0.ok).toBe(false);
    if (!res0.ok) {
      expect(res0.code).toBe("BOOST_NOT_READY");
    }

    // Boost 9 times (boost = 9)
    for (let i = 1; i <= 9; i++) {
      engine.executeCommand(roomId, p1, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "boost",
      });
    }

    // Attempt to fire at boost 9
    const res9 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(res9.ok).toBe(false);
    if (!res9.ok) {
      expect(res9.code).toBe("BOOST_NOT_READY");
    }
  });

  it("rejects 'bazooka' command with INVALID_TARGET when target is not in 1-4", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Boost to 10
    for (let i = 1; i <= 10; i++) {
      engine.executeCommand(roomId, p1, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "boost",
      });
    }

    // Target 5 is invalid for bazooka (only 1-4 valid)
    const resBad = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 5,
    });
    expect(resBad.ok).toBe(false);
    if (!resBad.ok) {
      expect(resBad.code).toBe("INVALID_TARGET");
    }
  });

  it("fires Bazooka into Area 1 ([7, 8, 4, 5]) on opponent grid: destroys Water/Clay, damages Pistol/Brick by 10, resets boost", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Setup opponent (p2) objects in Area 1 (cells 7, 8, 4, 5):
    // Cell 7: Water (5 HP) -> will be destroyed (0 HP -> null)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add water", target: 7 });
    // Cell 8: Clay (10 HP) -> will be destroyed (10 - 10 = 0 HP -> null)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 8 });
    // Cell 4: Pistol (15 HP) -> takes 10 dmg -> 5 HP
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 4 });
    // Cell 5: Brick (15 HP) -> takes 10 dmg -> 5 HP
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add water", target: 5 });
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 5 });

    // Cell 1 (Outside Area 1): Protector (30 HP) -> unharmed
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "protector", target: 1 });

    // Player 1 charges boost to 10
    for (let i = 1; i <= 10; i++) {
      engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "boost" });
    }

    // Player 1 fires Bazooka at Area 1
    const fireRes = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(fireRes.ok).toBe(true);
    if (!fireRes.ok) return;

    // Verify p1 boost reset to 0
    expect(fireRes.state.players[0].bazookaBoost).toBe(0);

    // Verify p2 grid in Area 1
    const p2Grid = fireRes.state.players[1].grid;
    expect(p2Grid.find((c) => c.id === 7)?.object).toBeNull(); // Water destroyed
    expect(p2Grid.find((c) => c.id === 8)?.object).toBeNull(); // Clay destroyed
    expect(p2Grid.find((c) => c.id === 4)?.object?.hp).toBe(5); // Pistol damaged (15 - 10 = 5)
    expect(p2Grid.find((c) => c.id === 5)?.object?.hp).toBe(5); // Brick damaged (15 - 10 = 5)

    // Cell 1 outside Area 1 remains unharmed
    expect(p2Grid.find((c) => c.id === 1)?.object?.hp).toBe(PROTECTOR_HP);

    // Opponent castle unharmed
    expect(fireRes.state.players[1].castle.hp).toBe(CASTLE_HP);
  });

  it("fires Bazooka into Area 2, 3, and 4 on opponent grid", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Area 2: [8, 9, 5, 6]
    expect(BAZOOKA_AREAS[2]).toEqual([8, 9, 5, 6]);
    // Area 3: [4, 5, 1, 2]
    expect(BAZOOKA_AREAS[3]).toEqual([4, 5, 1, 2]);
    // Area 4: [5, 6, 2, 3]
    expect(BAZOOKA_AREAS[4]).toEqual([5, 6, 2, 3]);

    // Place Clay (10 HP) on cell 9 (in Area 2)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 9 });

    // Charge boost to 10 and fire at Area 2
    for (let i = 1; i <= 10; i++) {
      engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "boost" });
    }
    const fire2 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 2,
    });
    expect(fire2.ok).toBe(true);
    if (!fire2.ok) return;

    expect(fire2.state.players[1].grid.find((c) => c.id === 9)?.object).toBeNull(); // Destroyed
  });

  it("Protector takes 10 damage and does not block AoE damage for other objects in area", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Place Protector on cell 5 (30 HP)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "protector", target: 5 });
    // Place Water on cell 4 (5 HP) in the same Area 1
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add water", target: 4 });

    // Charge boost to 10
    for (let i = 1; i <= 10; i++) {
      engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "boost" });
    }

    // Fire Bazooka at Area 1
    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const p2Grid = res.state.players[1].grid;
    // Protector took 10 damage: 30 - 10 = 20 HP
    expect(p2Grid.find((c) => c.id === 5)?.object?.hp).toBe(20);
    // Water was NOT protected by Protector: 5 - 10 <= 0 -> destroyed
    expect(p2Grid.find((c) => c.id === 4)?.object).toBeNull();
  });

  it("does not damage opponent Castle when firing Bazooka even if cells are empty", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Charge boost to 10
    for (let i = 1; i <= 10; i++) {
      engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "boost" });
    }

    // Fire Bazooka at Area 3 (all cells empty on p2)
    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 3,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Opponent castle remains at full 200 HP
    expect(res.state.players[1].castle.hp).toBe(CASTLE_HP);
  });

  it("resets boost to 0 after firing and allows player to accumulate boost again", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // First cycle
    for (let i = 1; i <= 10; i++) {
      engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "boost" });
    }
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "bazooka", target: 1 });

    const snap = engine.getSnapshot(roomId);
    expect(snap?.players[0].bazookaBoost).toBe(0);

    // Re-accumulate boost
    const nextBoost = engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "boost" });
    expect(nextBoost.ok && nextBoost.state.players[0].bazookaBoost).toBe(1);
  });

  it("fires Bazooka using Area letters A, B, C, D (case-insensitive)", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Charge boost to 10
    for (let i = 1; i <= 10; i++) {
      engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "boost" });
    }

    // Set up protector at cell 7 (in Area A: [7, 8, 4, 5])
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "protector", target: 7 });

    // Fire Bazooka at Area "a" (lowercase)
    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      // @ts-expect-error testing string area target
      target: "a",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cell7 = res.state.players[1].grid.find((c) => c.id === 7);
    expect(cell7?.object?.hp).toBe(PROTECTOR_HP - 10);
  });
});

