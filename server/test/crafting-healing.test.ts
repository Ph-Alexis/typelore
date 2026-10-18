import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CASTLE_HP,
  WATER_HP,
  CLAY_HP,
  BRICK_HP,
  BRICK_HEAL,
  type CommandIntent,
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

describe("M06 Crafting & Healing Engine", () => {
  it("creates Water (5 HP) on empty cell and rejects if cell is occupied", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    const intent: CommandIntent = {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add water",
      target: 5,
    };
    const res = engine.executeCommand(roomId, p1, intent);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.changed).toBe(true);
    expect(res.state.revision).toBe(2);
    const cell = res.state.players[0].grid.find((c) => c.id === 5);
    expect(cell?.object).toEqual({
      type: "WATER",
      hp: WATER_HP,
      maxHp: WATER_HP,
    });

    // Attempting to add water again on the same cell rejects with CELL_OCCUPIED
    const dupIntent: CommandIntent = {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add water",
      target: 5,
    };
    const dupRes = engine.executeCommand(roomId, p1, dupIntent);
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) {
      expect(dupRes.code).toBe("CELL_OCCUPIED");
    }
  });

  it("creates Clay (10 HP) on empty cell and rejects if cell is occupied", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    const intent: CommandIntent = {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add clay",
      target: 6,
    };
    const res = engine.executeCommand(roomId, p1, intent);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.changed).toBe(true);
    const cell = res.state.players[0].grid.find((c) => c.id === 6);
    expect(cell?.object).toEqual({
      type: "CLAY",
      hp: CLAY_HP,
      maxHp: CLAY_HP,
    });

    // Attempting to add clay again on the same cell rejects with CELL_OCCUPIED
    const dupIntent: CommandIntent = {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add clay",
      target: 6,
    };
    const dupRes = engine.executeCommand(roomId, p1, dupIntent);
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) {
      expect(dupRes.code).toBe("CELL_OCCUPIED");
    }
  });

  it("crafts Brick (15 HP) with Water then Clay (Water -> Clay)", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Step 1: add water
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add water",
      target: 2,
    });

    // Step 2: add clay on the same cell
    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add clay",
      target: 2,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cell = res.state.players[0].grid.find((c) => c.id === 2);
    expect(cell?.object).toEqual({
      type: "BRICK",
      hp: BRICK_HP,
      maxHp: BRICK_HP,
    });

    // Cell with Brick cannot receive more water or clay
    const extraWater = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add water",
      target: 2,
    });
    expect(extraWater.ok).toBe(false);
    if (!extraWater.ok) expect(extraWater.code).toBe("CELL_OCCUPIED");
  });

  it("crafts Brick (15 HP) with Clay then Water (Clay -> Water)", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Step 1: add clay
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add clay",
      target: 3,
    });

    // Step 2: add water on the same cell
    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add water",
      target: 3,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cell = res.state.players[0].grid.find((c) => c.id === 3);
    expect(cell?.object).toEqual({
      type: "BRICK",
      hp: BRICK_HP,
      maxHp: BRICK_HP,
    });
  });

  it("rejects crafting on cells with Pistol or Protector", () => {
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
      command: "protector",
      target: 4,
    });

    const waterOnPistol = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add water",
      target: 1,
    });
    expect(waterOnPistol.ok).toBe(false);
    if (!waterOnPistol.ok) expect(waterOnPistol.code).toBe("CELL_OCCUPIED");

    const clayOnProtector = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add clay",
      target: 4,
    });
    expect(clayOnProtector.ok).toBe(false);
    if (!clayOnProtector.ok) expect(clayOnProtector.code).toBe("CELL_OCCUPIED");
  });

  it("rejects add brick when no Brick is on the battlefield", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add brick",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("NO_BRICK_AVAILABLE");
    }
  });

  it("consumes 1 Brick and heals Castle by +15 HP", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Damage player 1 castle to 170 HP
    const snapshot = engine.getSnapshot(roomId)!;
    snapshot.players[0].castle.hp = 170;
    // @ts-expect-error accessing private games map for test fixture setup
    engine.games.set(roomId, snapshot);

    // Craft a brick on cell 5
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add water",
      target: 5,
    });
    engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add clay",
      target: 5,
    });

    // Execute add brick
    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add brick",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.state.players[0].castle.hp).toBe(170 + BRICK_HEAL); // 185
    const cell = res.state.players[0].grid.find((c) => c.id === 5);
    expect(cell?.object).toBeNull();
  });

  it("consumes the first Brick in grid cell order (1-9) when multiple Bricks exist", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Craft Brick on cell 7 and cell 3
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "add water", target: 7 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 7 });

    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "add water", target: 3 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 3 });

    // Consume 1 Brick: cell 3 should be consumed first because 3 < 7
    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add brick",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cell3 = res.state.players[0].grid.find((c) => c.id === 3);
    const cell7 = res.state.players[0].grid.find((c) => c.id === 7);
    expect(cell3?.object).toBeNull();
    expect(cell7?.object?.type).toBe("BRICK");
  });

  it("caps Castle HP at 200 and still consumes Brick when near or at max HP", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1 } = setupGame(engine);

    // Damage castle to 195 HP
    const snapshot = engine.getSnapshot(roomId)!;
    snapshot.players[0].castle.hp = 195;
    // @ts-expect-error accessing private games map for test fixture setup
    engine.games.set(roomId, snapshot);

    // Craft Brick on cell 1
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "add water", target: 1 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 1 });

    const res = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add brick",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // 195 + 15 = 210 -> capped at 200
    expect(res.state.players[0].castle.hp).toBe(CASTLE_HP);
    expect(res.state.players[0].grid.find((c) => c.id === 1)?.object).toBeNull();

    // Craft another brick while at 200 HP
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "add water", target: 2 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 2 });

    const fullRes = engine.executeCommand(roomId, p1, {
      requestId: randomUUID(),
      roomId,
      startId,
      command: "add brick",
    });
    expect(fullRes.ok).toBe(true);
    if (!fullRes.ok) return;

    expect(fullRes.state.players[0].castle.hp).toBe(CASTLE_HP);
    expect(fullRes.state.players[0].grid.find((c) => c.id === 2)?.object).toBeNull();
  });

  it("destroys Water (5 HP) in 1 bullet hit during combat tick", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Player 1 places Pistol on cell 7 (Col 1 front: 7) and loads 5 ammo
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 7 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 7 });

    // Player 2 places Water on cell 9 (Col 1 front: 9)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add water", target: 9 });

    // Tick 1: Pistol fires 1 shot into Lane 1. Water has 5 HP -> absorbs 5 dmg -> destroyed (0 HP)
    const tick1 = engine.tick(roomId);
    expect(tick1.ok).toBe(true);
    if (!tick1.ok) return;

    expect(tick1.changed).toBe(true);
    const p2Cell9 = tick1.state.players[1].grid.find((c) => c.id === 9);
    expect(p2Cell9?.object).toBeNull(); // Water destroyed
    expect(tick1.state.players[1].castle.hp).toBe(CASTLE_HP); // Castle unharmed
  });

  it("destroys Clay (10 HP) in 2 bullet hits during combat tick", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Player 1 places Pistol on cell 7 and loads 5 ammo
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 7 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 7 });

    // Player 2 places Clay on cell 9 (10 HP)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 9 });

    // Tick 1: Clay takes 5 dmg -> 5 HP remaining
    const tick1 = engine.tick(roomId);
    expect(tick1.ok).toBe(true);
    if (!tick1.ok) return;

    const p2Cell9Tick1 = tick1.state.players[1].grid.find((c) => c.id === 9);
    expect(p2Cell9Tick1?.object).toEqual({
      type: "CLAY",
      hp: 5,
      maxHp: CLAY_HP,
    });
    expect(tick1.state.players[1].castle.hp).toBe(CASTLE_HP);

    // Tick 2: Clay takes 5 dmg -> 0 HP -> destroyed
    const tick2 = engine.tick(roomId);
    expect(tick2.ok).toBe(true);
    if (!tick2.ok) return;

    const p2Cell9Tick2 = tick2.state.players[1].grid.find((c) => c.id === 9);
    expect(p2Cell9Tick2?.object).toBeNull();
    expect(tick2.state.players[1].castle.hp).toBe(CASTLE_HP);
  });

  it("destroys Brick (15 HP) in 3 bullet hits and protects Castle until destroyed", () => {
    const engine = new GameEngine();
    const { roomId, startId, p1, p2 } = setupGame(engine);

    // Player 1 places Pistol on cell 7 and loads 5 ammo
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "pistol", target: 7 });
    engine.executeCommand(roomId, p1, { requestId: randomUUID(), roomId, startId, command: "load ammo", target: 7 });

    // Player 2 crafts Brick on cell 9 (15 HP)
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add water", target: 9 });
    engine.executeCommand(roomId, p2, { requestId: randomUUID(), roomId, startId, command: "add clay", target: 9 });

    // Tick 1: Brick takes 5 dmg -> 10 HP
    const tick1 = engine.tick(roomId);
    expect(tick1.ok && tick1.state.players[1].grid.find((c) => c.id === 9)?.object?.hp).toBe(10);
    expect(tick1.ok && tick1.state.players[1].castle.hp).toBe(CASTLE_HP);

    // Tick 2: Brick takes 5 dmg -> 5 HP
    const tick2 = engine.tick(roomId);
    expect(tick2.ok && tick2.state.players[1].grid.find((c) => c.id === 9)?.object?.hp).toBe(5);
    expect(tick2.ok && tick2.state.players[1].castle.hp).toBe(CASTLE_HP);

    // Tick 3: Brick takes 5 dmg -> 0 HP -> destroyed
    const tick3 = engine.tick(roomId);
    expect(tick3.ok && tick3.state.players[1].grid.find((c) => c.id === 9)?.object).toBeNull();
    expect(tick3.ok && tick3.state.players[1].castle.hp).toBe(CASTLE_HP);

    // Tick 4: Lane 1 is now empty -> Castle takes 5 dmg (195 HP)
    const tick4 = engine.tick(roomId);
    expect(tick4.ok && tick4.state.players[1].castle.hp).toBe(195);
  });
});

