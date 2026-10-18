import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  CASTLE_HP,
  PISTOL_HP,
  PISTOL_MAX_AMMO,
  PROTECTOR_HP,
  type GameStart,
  type GameState,
} from "@typelore/shared";
import { GameEngine, getCellLane } from "../src/game/GameEngine.js";
import { RoomManager } from "../src/rooms/RoomManager.js";

function setupGame(engine: GameEngine): { roomId: string; startId: string; p1: string; p2: string; game: GameState } {
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
    serverTime: Date.now(),
  };
  const game = engine.prepare(start);
  engine.commit(game);
  return { roomId, startId, p1, p2, game };
}

describe("Ground Combat - GameEngine Unit Tests", () => {
  it("TC-GC-01: creates Pistol with 15 HP and 0/10 ammo on empty cell", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    const result = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player1 = result.state.players[0];
    const cell1 = player1.grid.find((c) => c.id === 1);
    expect(cell1?.object).toEqual({
      type: "PISTOL",
      hp: PISTOL_HP,
      maxHp: PISTOL_HP,
      ammo: 0,
      maxAmmo: PISTOL_MAX_AMMO,
    });
  });

  it("TC-GC-02: rejects placing Pistol on an occupied cell with CELL_OCCUPIED", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 5,
    });

    const second = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 5,
    });

    expect(second).toEqual({ ok: false, code: "CELL_OCCUPIED" });
  });

  it("TC-GC-03: creates Protector with 30 HP on empty cell and rejects if cell occupied", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    const result = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "protector",
      target: 7,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cell7 = result.state.players[0].grid.find((c) => c.id === 7);
    expect(cell7?.object).toEqual({
      type: "PROTECTOR",
      hp: PROTECTOR_HP,
      maxHp: PROTECTOR_HP,
    });

    const reject = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "protector",
      target: 7,
    });
    expect(reject).toEqual({ ok: false, code: "CELL_OCCUPIED" });
  });

  it("TC-GC-04: rejects load ammo on empty cell or non-Pistol with NOT_A_PISTOL", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    const empty = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 3,
    });
    expect(empty).toEqual({ ok: false, code: "NOT_A_PISTOL" });

    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "protector",
      target: 3,
    });

    const onProtector = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 3,
    });
    expect(onProtector).toEqual({ ok: false, code: "NOT_A_PISTOL" });
  });

  it("TC-GC-05: load ammo adds +5 ammo and caps at 10 (0 -> 5 -> 10 -> 10)", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "pistol",
      target: 2,
    });

    const load1 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 2,
    });
    expect(load1.ok).toBe(true);
    if (load1.ok) {
      const p = load1.state.players[0].grid.find((c) => c.id === 2)?.object;
      expect(p?.type === "PISTOL" && p.ammo).toBe(5);
    }

    const load2 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 2,
    });
    expect(load2.ok).toBe(true);
    if (load2.ok) {
      const p = load2.state.players[0].grid.find((c) => c.id === 2)?.object;
      expect(p?.type === "PISTOL" && p.ammo).toBe(10);
    }

    // Attempting to load past 10 stays capped at 10
    const load3 = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "load ammo",
      target: 2,
    });
    expect(load3.ok).toBe(true);
    if (load3.ok) {
      const p = load3.state.players[0].grid.find((c) => c.id === 2)?.object;
      expect(p?.type === "PISTOL" && p.ammo).toBe(10);
    }
  });

  it("TC-GC-06: tick consumes 1 ammo per firing Pistol and stops when ammo reaches 0", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

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

    // Pistol starts with 5 ammo
    for (let i = 4; i >= 0; i -= 1) {
      const tickResult = engine.tick(roomId);
      expect(tickResult.ok).toBe(true);
      if (tickResult.ok) {
        expect(tickResult.changed).toBe(true);
        const p = tickResult.state.players[0].grid.find((c) => c.id === 1)?.object;
        expect(p?.type === "PISTOL" && p.ammo).toBe(i);
      }
    }

    // Next tick: ammo is 0, so no shots fire and changed is false
    const idleTick = engine.tick(roomId);
    expect(idleTick).toMatchObject({ ok: true, changed: false });
  });

  it("TC-GC-07: bullet damages the front-most opponent object in the opposing lane", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Player 1 places Pistol at cell 1 (Lane 1: Col 1).
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 1 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 1 });

    // Player 2 places Protector at cell 9 (Lane 1 Front row) and Pistol at cell 6 (Lane 1 Middle row).
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "protector", target: 9 });
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 6 });

    // Tick 1: P1 fires along Lane 1. Bullet should hit P2 cell 9 (Protector), reducing HP from 30 to 25.
    const tick1 = engine.tick(roomId);
    expect(tick1.ok).toBe(true);
    if (tick1.ok) {
      const p2Cell9 = tick1.state.players[1].grid.find((c) => c.id === 9)?.object;
      const p2Cell6 = tick1.state.players[1].grid.find((c) => c.id === 6)?.object;
      expect(p2Cell9?.hp).toBe(25);
      expect(p2Cell6?.hp).toBe(15); // Cell 6 was not hit
      expect(tick1.state.players[1].castle.hp).toBe(CASTLE_HP); // Castle was not hit
    }
  });

  it("TC-GC-08 & TC-GC-09: Protector withstands exactly 6 hits (30 HP) before destruction", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // P1 places Pistol at cell 1 and loads 10 ammo (2 reloads)
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 1 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 1 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 1 });

    // P2 places Protector at cell 9 (Front row of Lane 1)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "protector", target: 9 });

    // Shots 1 to 5: HP decreases by 5 each time
    const expectedHps = [25, 20, 15, 10, 5];
    for (const expectedHp of expectedHps) {
      const tick = engine.tick(roomId);
      if (tick.ok) {
        const obj = tick.state.players[1].grid.find((c) => c.id === 9)?.object;
        expect(obj?.hp).toBe(expectedHp);
      }
    }

    // Shot 6: 5 HP - 5 = 0 HP -> destroyed, object becomes null!
    const tick6 = engine.tick(roomId);
    expect(tick6.ok).toBe(true);
    if (tick6.ok) {
      const cell9 = tick6.state.players[1].grid.find((c) => c.id === 9);
      expect(cell9?.object).toBeNull();
      expect(tick6.state.players[1].castle.hp).toBe(CASTLE_HP); // Castle still undamaged
    }

    // Shot 7: Cell 9 is gone; lane is empty, so bullet hits Castle!
    const tick7 = engine.tick(roomId);
    expect(tick7.ok).toBe(true);
    if (tick7.ok) {
      expect(tick7.state.players[1].castle.hp).toBe(CASTLE_HP - 5);
    }
  });

  it("TC-GC-10: deals 5 damage directly to enemy Castle when lane is empty", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // P1 places Pistol in Lane 2 (cell 5) with 5 ammo. P2 has empty grid.
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 5 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 5 });

    const tick1 = engine.tick(roomId);
    expect(tick1.ok).toBe(true);
    if (tick1.ok) {
      expect(tick1.state.players[1].castle.hp).toBe(195);
    }

    const tick2 = engine.tick(roomId);
    expect(tick2.ok).toBe(true);
    if (tick2.ok) {
      expect(tick2.state.players[1].castle.hp).toBe(190);
    }
  });

  it("TC-GC-11: bullets do not damage friendly objects in front on the same lane (no friendly fire)", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // P1 places Pistol at back cell 1 and Protector at front cell 7 (same Lane 1).
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 1 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 1 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "protector", target: 7 });

    const tick = engine.tick(roomId);
    expect(tick.ok).toBe(true);
    if (tick.ok) {
      // P1's own protector at cell 7 must still have full 30 HP
      const friendlyProtector = tick.state.players[0].grid.find((c) => c.id === 7)?.object;
      expect(friendlyProtector?.hp).toBe(30);
      // Opponent Castle took the 5 damage
      expect(tick.state.players[1].castle.hp).toBe(195);
    }
  });

  it("TC-GC-12: verifies lane mapping helper getCellLane", () => {
    // Lane 1: 1, 4, 7
    expect(getCellLane(1)).toBe(1);
    expect(getCellLane(4)).toBe(1);
    expect(getCellLane(7)).toBe(1);
    // Lane 2: 2, 5, 8
    expect(getCellLane(2)).toBe(2);
    expect(getCellLane(5)).toBe(2);
    expect(getCellLane(8)).toBe(2);
    // Lane 3: 3, 6, 9
    expect(getCellLane(3)).toBe(3);
    expect(getCellLane(6)).toBe(3);
    expect(getCellLane(9)).toBe(3);
  });
});

describe("Ground Combat - RoomManager Lifecycle & Timer Tests", () => {
  it("starts combat timer on IN_GAME transition and broadcasts onSync on command & tick", async () => {
    vi.useFakeTimers();
    try {
      const syncs: unknown[] = [];
      const rooms = new RoomManager({
        onSync(sync) { syncs.push(sync); },
        tickIntervalMs: 1000,
      });

      const p1 = "conn-p1";
      const p2 = "conn-p2";
      const createRes = rooms.create(p1);
      expect(createRes.ok).toBe(true);
      if (!createRes.ok || !createRes.data.room) return;
      const code = createRes.data.room.code;
      const roomId = createRes.data.roomId;

      rooms.join(p2, code);
      rooms.setReady(p1, roomId, true);

      expect(rooms.timerCount).toBe(0);
      // P2 readies up -> game transitions to IN_GAME -> combat timer starts!
      const startRes = rooms.setReady(p2, roomId, true);
      expect(startRes.ok).toBe(true);
      expect(rooms.timerCount).toBe(1);

      const startId = startRes.ok ? startRes.data.start?.startId : undefined;
      expect(startId).toBeDefined();
      if (!startId) return;

      // P1 places Pistol -> onSync called
      const cmd1 = rooms.executeCommand(p1, {
        requestId: randomUUID(),
        roomId,
        startId,
        command: "pistol",
        target: 4,
      });
      expect(cmd1.ok).toBe(true);
      expect(syncs.length).toBe(1);

      // P1 loads ammo -> onSync called
      const cmd2 = rooms.executeCommand(p1, {
        requestId: randomUUID(),
        roomId,
        startId: startId!,
        command: "load ammo",
        target: 4,
      });
      expect(cmd2.ok).toBe(true);
      expect(syncs.length).toBe(2);

      // Advance timer by 1000ms -> combat tick fires -> pistol shoots -> onSync called!
      vi.advanceTimersByTime(1000);
      expect(syncs.length).toBe(3);

      // Advance timer another 1000ms
      vi.advanceTimersByTime(1000);
      expect(syncs.length).toBe(4);

      // Player leaves -> combat timer is cleaned up
      rooms.leave(p1, roomId);
      expect(rooms.timerCount).toBe(0);

      // Advancing timer further generates NO new syncs
      vi.advanceTimersByTime(5000);
      expect(syncs.length).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears all combat timers on clear()", () => {
    vi.useFakeTimers();
    try {
      const rooms = new RoomManager();
      const p1 = "conn-p1";
      const p2 = "conn-p2";
      const res = rooms.create(p1);
      if (!res.ok) return;
      rooms.join(p2, res.data.room!.code);
      rooms.setReady(p1, res.data.roomId, true);
      rooms.setReady(p2, res.data.roomId, true);

      expect(rooms.timerCount).toBe(1);
      rooms.clear();
      expect(rooms.timerCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
