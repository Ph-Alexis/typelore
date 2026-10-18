import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { COMMAND_RULES, CommandAckSchema, CommandIntentSchema, parseCommandTarget, parseGameCommand } from "@typelore/shared";
import { RoomManager } from "../src/rooms/RoomManager.js";
import { GameEngine } from "../src/game/GameEngine.js";

const ids = () => ({ requestId: randomUUID(), roomId: randomUUID(), startId: randomUUID() });
describe("exact shared command parser", () => {
  it("leaves game and room snapshots unchanged after valid, repeated and invalid validation", () => {
    const games = new GameEngine(); const rooms = new RoomManager({ games });
    const created = rooms.create("a");
    if (!created.ok || !created.data.room) throw new Error("Expected room");
    const room = created.data.room;
    rooms.join("b", room.code); rooms.setReady("a", room.roomId, true);
    rooms.setReady("b", room.roomId, true);
    const before = games.getSnapshot(room.roomId)!; const beforeRoom = rooms.getRoom(room.code);
    for (const [command, max] of Object.entries(COMMAND_RULES)) {
      const intent = CommandIntentSchema.parse({ ...ids(), roomId: room.roomId, startId: before.startId,
        command, ...(max ? { target: max } : {}) });
      expect(rooms.validateCommand("a", intent).ok).toBe(true);
      expect(rooms.validateCommand("b", intent).ok).toBe(true);
      expect(rooms.validateCommand("outsider", intent)).toEqual({ ok: false, code: "NOT_IN_ROOM" });
    }
    expect(games.getSnapshot(room.roomId)).toEqual(before);
    expect(rooms.getRoom(room.code)).toEqual(beforeRoom);
  });
  for (const [command, max] of Object.entries(COMMAND_RULES)) {
    it(`normalizes only case for ${command} and enforces target rule ${max}`, () => {
      expect(parseGameCommand(command.toUpperCase())).toMatchObject({ success: true, data: command });
      const payload = { ...ids(), command: command.toUpperCase(), ...(max ? { target: max } : {}) };
      const result = CommandIntentSchema.parse(payload);
      expect(result.command).toBe(command);
      for (const invalid of ["target", "playerId", "hp"]) {
        if (invalid === "target" && max > 0) continue;
        expect(CommandIntentSchema.safeParse({ ...payload, [invalid]: 1 }).success).toBe(false);
      }
      if (max) {
        expect(parseCommandTarget(result.command, "1")).toBe(1);
        expect(parseCommandTarget(result.command, String(max))).toBe(max);
        for (const target of ["0", String(max + 1), "01", "1 ", "+1", "1.0", "1e0", ""]) {
          expect(parseCommandTarget(result.command, target)).toBeNull();
        }
        for (const target of [undefined, null, "1", 0, max + 1, 1.5, NaN, Infinity]) {
          expect(CommandIntentSchema.safeParse({ ...payload, target }).success).toBe(false);
        }
      } else {
        expect(CommandIntentSchema.safeParse({ ...payload, target: undefined }).success).toBe(false);
        expect(parseCommandTarget(result.command, "1")).toBeNull();
      }
    });
  }
  it("rejects whitespace repairs, fuzzy matches, appended targets and non-ASCII", () => {
    for (const value of ["", " pistol", "pistol ", "load  ammo", "load\tammo", "load\nammo", "add\u00a0clay",
      "birdandbomb", "pistlo", "pistol 1", "ｐistol", "a".repeat(65), 123, null]) {
      expect(parseGameCommand(value).success).toBe(false);
    }
  });
  it("validates strict correlated ACK shape without coercion", () => {
    const payload = { ...ids(), command: "boost" };
    const ack = { ok: true, data: { ...payload, status: "VALIDATED" }, serverTime: 0 };
    expect(CommandAckSchema.safeParse(ack).success).toBe(true);
    expect(CommandAckSchema.safeParse({ ...ack, serverTime: Infinity }).success).toBe(false);
    expect(CommandAckSchema.safeParse({ ...ack, data: { ...ack.data, hp: 200 } }).success).toBe(false);
    expect(CommandIntentSchema.safeParse({ ...payload, startId: "bad" }).success).toBe(false);
    expect(CommandAckSchema.safeParse({ ok: false, error: { code: "GAME_MISMATCH", message: "stale" }, serverTime: 0 }).success).toBe(true);
    expect(CommandAckSchema.safeParse({ ok: false, error: { code: "MADE_UP", message: "bad" }, serverTime: 0 }).success).toBe(false);
  });
});
