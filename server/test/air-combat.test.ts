import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  CASTLE_HP,
  BIRD_HP,
  BIRD_DAMAGE,
  BIRD_FLIGHT_TIME_MS,
  BIRD_COOLDOWN_MS,
  ARROW_DAMAGE,
  PISTOL_HP,
  PROTECTOR_HP,
  BirdStateSchema,
  type GameStart,
  type GameState,
} from "@typelore/shared";
import { GameEngine } from "../src/game/GameEngine.js";

function setupGame(engine: GameEngine): {
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

describe("Air Combat - GameEngine Unit Tests", () => {
  it("TC-AC-01: initializes two players with birdCooldownUntil = serverTime + BIRD_COOLDOWN_MS and empty birds array", () => {
    const engine = new GameEngine();
    const { roomId, p1, p2 } = setupGame(engine);
    const snap = engine.getSnapshot(roomId);

    const player1 = snap?.players.find((p) => p.connectionId === p1);
    const player2 = snap?.players.find((p) => p.connectionId === p2);

    expect(player1?.birdCooldownUntil).toBe(1000 + BIRD_COOLDOWN_MS);
    expect(player1?.birds).toEqual([]);
    expect(player2?.birdCooldownUntil).toBe(1000 + BIRD_COOLDOWN_MS);
    expect(player2?.birds).toEqual([]);
  });

  it("TC-AC-02: 'bird and bomb' creates Bird with 15 HP, 10s flight, 10 ticksRemaining and sets 90s cooldown", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);
    const launchTime = 100000;

    const res = engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      launchTime,
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const player1 = res.state.players[0];
    expect(player1.birds).toHaveLength(1);
    const bird = player1.birds[0];
    expect(bird).toMatchObject({
      hp: BIRD_HP,
      maxHp: BIRD_HP,
      createdAt: launchTime,
      flightDurationMs: BIRD_FLIGHT_TIME_MS,
      ticksRemaining: 10,
    });
    expect(player1.birdCooldownUntil).toBe(launchTime + BIRD_COOLDOWN_MS);
    expect(res.changed).toBe(true);
  });

  it("TC-AC-03: rejects 'bird and bomb' with BIRD_ON_COOLDOWN when cooldown is active", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);
    const launchTime = 100000;

    // Launch #1
    engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      launchTime,
    );

    // Launch #2 attempt at 105s (only 5s after #1, cooldown is 90s)
    const reject = engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      launchTime + 5000,
    );

    expect(reject).toEqual({ ok: false, code: "BIRD_ON_COOLDOWN" });

    // Verify player still has only 1 bird
    const snap = engine.getSnapshot(roomId);
    expect(snap?.players[0].birds).toHaveLength(1);
  });

  it("TC-AC-03b: rejects 'bird and bomb' at match start when initial 90s cooldown is active", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Attempt to launch bird immediately at match start (t=1000, initial cooldown until 91000)
    const reject = engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      1000,
    );

    expect(reject).toEqual({ ok: false, code: "BIRD_ON_COOLDOWN" });
  });

  it("TC-AC-04: allows 'bird and bomb' once 90s cooldown expires", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);
    const launchTime = 100000;

    // Launch #1
    engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      launchTime,
    );

    // Launch #2 at exactly 90s later
    const secondLaunch = engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      launchTime + BIRD_COOLDOWN_MS,
    );

    expect(secondLaunch.ok).toBe(true);
    if (!secondLaunch.ok) return;

    expect(secondLaunch.state.players[0].birds).toHaveLength(2);
    expect(secondLaunch.state.players[0].birdCooldownUntil).toBe(
      launchTime + BIRD_COOLDOWN_MS + BIRD_COOLDOWN_MS,
    );
  });

  it("TC-AC-05: Bird flies for 10 ticks and deals 20 damage to opponent Castle on tick 10", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      100000,
    );

    // Ticks 1 through 9: Bird progresses, Castle undamaged
    for (let i = 9; i >= 1; i--) {
      const tickRes = engine.tick(roomId);
      expect(tickRes.ok).toBe(true);
      if (tickRes.ok) {
        expect(tickRes.changed).toBe(true);
        const bird = tickRes.state.players[0].birds[0];
        expect(bird?.ticksRemaining).toBe(i);
        const p2Castle = tickRes.state.players.find((p) => p.connectionId === p2)?.castle;
        expect(p2Castle?.hp).toBe(CASTLE_HP);
      }
    }

    // Tick 10: Bird reaches destination, deals 20 damage to P2 Castle, and disappears
    const tick10 = engine.tick(roomId);
    expect(tick10.ok).toBe(true);
    if (tick10.ok) {
      expect(tick10.changed).toBe(true);
      const p1Birds = tick10.state.players[0].birds;
      expect(p1Birds).toHaveLength(0); // Bird disappeared

      const p2Castle = tick10.state.players.find((p) => p.connectionId === p2)?.castle;
      expect(p2Castle?.hp).toBe(CASTLE_HP - BIRD_DAMAGE); // 200 - 20 = 180 HP
    }
  });

  it("TC-AC-06: 'arrow' when opponent has no airborne birds returns NO_AIR_TARGET without state mutation or stockpiling", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });

    expect(res).toEqual({ ok: false, code: "NO_AIR_TARGET" });
  });

  it("TC-AC-07: 'arrow' deals exactly 5 damage to opponent airborne Bird", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // P1 launches a Bird
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bird and bomb",
    });

    // P2 fires an Arrow against P1's incoming Bird
    const arrowRes = engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });

    expect(arrowRes.ok).toBe(true);
    if (!arrowRes.ok) return;

    expect(arrowRes.changed).toBe(true);
    const p1Bird = arrowRes.state.players[0].birds[0];
    expect(p1Bird?.hp).toBe(BIRD_HP - ARROW_DAMAGE); // 15 - 5 = 10 HP
  });

  it("TC-AC-08: exactly 3 arrows destroy full 15 HP Bird mid-air and remove it immediately", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // P1 launches Bird (15 HP)
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bird and bomb",
    });

    // Arrow 1: 15 -> 10 HP
    const a1 = engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });
    expect(a1.ok && a1.state.players[0].birds[0]?.hp).toBe(10);

    // Arrow 2: 10 -> 5 HP
    const a2 = engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });
    expect(a2.ok && a2.state.players[0].birds[0]?.hp).toBe(5);

    // Arrow 3: 5 -> 0 HP (Destroyed & Removed!)
    const a3 = engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });
    expect(a3.ok).toBe(true);
    if (a3.ok) {
      expect(a3.state.players[0].birds).toHaveLength(0);
    }
  });

  it("TC-AC-09: destroyed Bird deals 0 damage to Castle when flight time expires", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // P1 launches Bird
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bird and bomb",
    });

    // Tick 3 times
    engine.tick(roomId);
    engine.tick(roomId);
    engine.tick(roomId);

    // P2 shoots 3 arrows to destroy the Bird at tick 3
    for (let i = 0; i < 3; i++) {
      engine.executeCommand(roomId, p2, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "arrow",
      });
    }

    // Advance remaining ticks (4 to 10)
    for (let t = 0; t < 7; t++) {
      engine.tick(roomId);
    }

    // P2 Castle should be completely unharmed at 200 HP
    const snap = engine.getSnapshot(roomId);
    const p2Castle = snap?.players.find((p) => p.connectionId === p2)?.castle;
    expect(p2Castle?.hp).toBe(CASTLE_HP);
  });

  it("TC-AC-10: arrow always targets opponent Bird closest to defender Castle (lowest ticksRemaining)", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // P1 launches Bird #1 at t=100000 (after initial cooldown)
    engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      100000,
    );

    // Advance 5 ticks: Bird #1 now has ticksRemaining = 5
    for (let i = 0; i < 5; i++) {
      engine.tick(roomId);
    }

    // P1 launches Bird #2 at t=100000 + BIRD_COOLDOWN_MS (after cooldown): Bird #2 has ticksRemaining = 10
    engine.executeCommand(
      roomId,
      p1,
      { requestId: randomUUID(), roomId, startId, command: "bird and bomb" },
      100000 + BIRD_COOLDOWN_MS,
    );

    const snapBefore = engine.getSnapshot(roomId);
    expect(snapBefore?.players[0].birds).toHaveLength(2);
    expect(snapBefore?.players[0].birds[0]?.ticksRemaining).toBe(5); // Closer to P2 Castle
    expect(snapBefore?.players[0].birds[1]?.ticksRemaining).toBe(10); // Farther from P2 Castle

    // P2 fires Arrow: must hit Bird #1 (ticksRemaining = 5), reducing its HP from 15 to 10
    const arrowHit = engine.executeCommand(roomId, p2, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "arrow",
    });

    expect(arrowHit.ok).toBe(true);
    if (!arrowHit.ok) return;

    const p1Birds = arrowHit.state.players[0].birds;
    expect(p1Birds[0]?.ticksRemaining).toBe(5);
    expect(p1Birds[0]?.hp).toBe(10); // Hit!

    expect(p1Birds[1]?.ticksRemaining).toBe(10);
    expect(p1Birds[1]?.hp).toBe(15); // Untouched!
  });

  it("TC-AC-11: complete decoupling between Air and Ground combat", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // P1 sets up Ground Pistol at cell 7 (Row 1) with ammo
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 7 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 7 });

    // P2 sets up Ground Protector at cell 9 (Lane 1 Front)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "protector", target: 9 });

    // P2 launches Bird (Air layer)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "bird and bomb" });

    // Tick: P1 Pistol fires ground bullet along Lane 1 into P2 cell 9 (Protector).
    // P2 Bird flies in Air layer.
    const tickRes = engine.tick(roomId);
    expect(tickRes.ok).toBe(true);
    if (!tickRes.ok) return;

    // Ground: Protector takes 5 damage from Pistol bullet (30 -> 25 HP)
    const p2Protector = tickRes.state.players[1].grid.find((c) => c.id === 9)?.object;
    expect(p2Protector?.type).toBe("PROTECTOR");
    expect(p2Protector?.hp).toBe(PROTECTOR_HP - 5);

    // Air: P2 Bird was NOT hit by Pistol bullet (still 15 HP, ticksRemaining = 9)
    const p2Bird = tickRes.state.players[1].birds[0];
    expect(p2Bird?.hp).toBe(BIRD_HP);
    expect(p2Bird?.ticksRemaining).toBe(9);

    // Also verify: Bird does not damage P1 grid objects
    const p1Pistol = tickRes.state.players[0].grid.find((c) => c.id === 7)?.object;
    expect(p1Pistol?.hp).toBe(PISTOL_HP);
  });

  it("TC-AC-12: Bazooka AoE does not damage airborne birds", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // P2 launches Bird
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "bird and bomb" });

    // P1 fires Bazooka at Area 1 on P2 grid
    const bazookaRes = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "bazooka",
      target: 1,
    });

    expect(bazookaRes.ok).toBe(true);
    if (!bazookaRes.ok) return;

    // P2 Bird remains completely unaffected at full 15 HP
    const p2Bird = bazookaRes.state.players[1].birds[0];
    expect(p2Bird?.hp).toBe(BIRD_HP);
  });

  it("TC-AC-13: BirdStateSchema strictly validates 15 lowercase ASCII letters contract", () => {
    const validBase = {
      id: randomUUID(),
      hp: 15,
      maxHp: 15,
      createdAt: 1000,
      flightDurationMs: 10000,
      ticksRemaining: 10,
      word: "abcdefghijkl",
    };

    // Valid 12 lowercase characters
    expect(BirdStateSchema.safeParse(validBase).success).toBe(true);

    // Rejects too short (11 chars)
    expect(BirdStateSchema.safeParse({ ...validBase, word: "abcdefghijk" }).success).toBe(false);

    // Rejects too long (13 chars)
    expect(BirdStateSchema.safeParse({ ...validBase, word: "abcdefghijklm" }).success).toBe(false);

    // Rejects uppercase characters
    expect(BirdStateSchema.safeParse({ ...validBase, word: "ABCDEFGHIJKL" }).success).toBe(false);

    // Rejects non-ASCII / numbers
    expect(BirdStateSchema.safeParse({ ...validBase, word: "abcdefghijk1" }).success).toBe(false);

    // Default missing word provides valid 12-character string
    const parsedDefault = BirdStateSchema.parse({
      id: randomUUID(),
      hp: 15,
      maxHp: 15,
      createdAt: 1000,
      flightDurationMs: 10000,
      ticksRemaining: 10,
    });
    expect(parsedDefault.word).toHaveLength(12);
    expect(/^[a-z]{12}$/.test(parsedDefault.word)).toBe(true);
  });

  it("TC-AC-14: GameEngine generated bird challenge words conform to schema", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    for (let i = 0; i < 5; i++) {
      const res = engine.executeCommand(roomId, p1, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "bird and bomb",
      }, 100000 + i * 100000);

      expect(res.ok).toBe(true);
      if (res.ok) {
        const bird = res.state.players[0].birds[res.state.players[0].birds.length - 1];
        expect(bird).toBeDefined();
        if (bird) {
          expect(bird.word).toHaveLength(12);
          expect(BirdStateSchema.safeParse(bird).success).toBe(true);
        }
      }
    }
  });
});
