import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CASTLE_HP,
  BAZOOKA_COOLDOWN_MS,
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

describe("M07 Bazooka & 1-Minute Cooldown Engine", () => {
  it("initializes two players with bazookaCooldownUntil = 0", () => {
    const engine = new GameEngine();
    const { roomId } = setupGame(engine);

    const snapshot = engine.getSnapshot(roomId);
    expect(snapshot).toBeDefined();
    expect(snapshot?.players[0].bazookaCooldownUntil).toBe(0);
    expect(snapshot?.players[1].bazookaCooldownUntil).toBe(0);
  });

  it("fires Bazooka immediately at match start and sets 1-minute cooldown", () => {
    const now = 100000;
    const engine = new GameEngine({ now: () => now });
    const { roomId, startId, p1 } = setupGame(engine);

    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.changed).toBe(true);
    expect(res.state.players[0].bazookaCooldownUntil).toBe(now + BAZOOKA_COOLDOWN_MS);
  });

  it("rejects 'bazooka' command with BAZOOKA_ON_COOLDOWN while on 1-minute cooldown", () => {
    let now = 100000;
    const engine = new GameEngine({ now: () => now });
    const { roomId, startId, p1 } = setupGame(engine);

    // Fire 1st time
    const res1 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(res1.ok).toBe(true);

    // Fire 30s later (still on cooldown)
    now += 30000;
    const res2 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.code).toBe("BAZOOKA_ON_COOLDOWN");
    }

    // Fire after 60s (now >= cooldownUntil)
    now += 30000;
    const res3 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });
    expect(res3.ok).toBe(true);
    if (!res3.ok) return;
    expect(res3.state.players[0].bazookaCooldownUntil).toBe(now + BAZOOKA_COOLDOWN_MS);
  });

  it("rejects 'bazooka' command with INVALID_TARGET when target is not in 1-4 or A-D", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Target 5 is invalid for bazooka (only 1-4 and A-D valid)
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

  it("fires Bazooka into Area 1 ([7, 8, 4, 5]) on opponent grid: destroys Water/Clay, damages Pistol/Brick by 10", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Setup opponent (p2) objects in Area 1 (cells 7, 8, 4, 5):
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add water", target: 7 });
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 8 });
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 4 });
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add water", target: 5 });
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 5 });

    // Cell 1 (Outside Area 1): Protector (30 HP) -> unharmed
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "protector", target: 1 });

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
    const now = 100000;
    const engine = new GameEngine({ now: () => now });
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Area 2: [8, 9, 5, 6]
    expect(BAZOOKA_AREAS[2]).toEqual([8, 9, 5, 6]);
    // Area 3: [4, 5, 1, 2]
    expect(BAZOOKA_AREAS[3]).toEqual([4, 5, 1, 2]);
    // Area 4: [5, 6, 2, 3]
    expect(BAZOOKA_AREAS[4]).toEqual([5, 6, 2, 3]);

    // Place Clay (10 HP) on cell 9 (in Area 2)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 9 });

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

  it("fires Bazooka using Area letters A, B, C, D (case-insensitive)", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

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
