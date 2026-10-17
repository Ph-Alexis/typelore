import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GameStartSchema, RoomCodeSchema, RoomCreateSchema, RoomJoinSchema,
  RoomLeaveSchema, RoomReadySchema, RoomStateSchema } from "@typelore/shared";
import { RoomManager, type RoomResult } from "../src/rooms/RoomManager.js";
import { generateRoomCode } from "../src/rooms/roomCode.js";

function roomOf(result: RoomResult) {
  if (!result.ok || !result.data.room) throw new Error("Expected room success");
  expect(RoomStateSchema.safeParse(result.data.room).success).toBe(true);
  return result.data.room;
}

describe("room schemas and manager", () => {
  it("T01 validates strict bounded normalized inputs", () => {
    expect(RoomJoinSchema.parse({ code: " abcd23 " })).toEqual({ code: "ABCD23" });
    for (const code of ["ABC", "ABCD2O", "ABCD21", "AB CD2", "X".repeat(65)]) {
      expect(RoomJoinSchema.safeParse({ code }).success).toBe(false);
    }
    expect(RoomJoinSchema.safeParse({ code: 123456 }).success).toBe(false);
    expect(RoomJoinSchema.safeParse({ code: "ABCD23", slot: "PLAYER_1" }).success).toBe(false);
    expect(RoomCreateSchema.safeParse({ playerId: "spoof" }).success).toBe(false);
    expect(RoomReadySchema.safeParse({ roomId: randomUUID(), ready: "true" }).success).toBe(false);
    expect(RoomLeaveSchema.safeParse({ roomId: "not-a-uuid" }).success).toBe(false);
  });

  it("T02 generates readable codes and retries bounded collisions without leaking members", () => {
    for (let i = 0; i < 100; i += 1) expect(RoomCodeSchema.safeParse(generateRoomCode()).success).toBe(true);
    const candidates = ["ABC234", "ABC234", "DEF567"];
    const manager = new RoomManager({ code: () => candidates.shift() ?? "ABC234" });
    expect(roomOf(manager.create("a")).code).toBe("ABC234");
    expect(roomOf(manager.create("b")).code).toBe("DEF567");
    expect(manager.create("c")).toEqual({ ok: false, code: "ROOM_CODE_EXHAUSTED" });
    expect(manager.roomCount).toBe(2);
    expect(manager.memberCount).toBe(2);
  });

  it("T08/T09/T16 enforces membership, ready idempotence and copied snapshots", () => {
    const manager = new RoomManager();
    const first = roomOf(manager.create("a"));
    expect(manager.create("a")).toEqual({ ok: false, code: "ALREADY_IN_ROOM" });
    expect(manager.join("a", first.code)).toEqual({ ok: false, code: "ALREADY_IN_ROOM" });
    expect(manager.setReady("a", first.roomId, true)).toEqual({ ok: false, code: "ROOM_NOT_WAITING" });
    const joined = roomOf(manager.join("b", first.code));
    const ready = roomOf(manager.setReady("a", first.roomId, true));
    expect(ready.revision).toBe(joined.revision + 1);
    const repeated = manager.setReady("a", first.roomId, true);
    expect(repeated.ok && repeated.data.changed).toBe(false);
    expect(roomOf(repeated).revision).toBe(ready.revision);
    const unready = roomOf(manager.setReady("a", first.roomId, false));
    expect(unready.players[0]?.ready).toBe(false);
    unready.players[0]!.ready = true;
    expect(manager.getRoom(first.code)?.players[0]?.ready).toBe(false);
    expect(manager.leave("a", randomUUID())).toEqual({ ok: false, code: "ROOM_MISMATCH" });
    expect(manager.setReady("outsider", first.roomId, true)).toEqual({ ok: false, code: "NOT_IN_ROOM" });
  });

  it("T10/T13 cancels starting, promotes survivor and emits a fresh start identifier", () => {
    const manager = new RoomManager();
    const room = roomOf(manager.create("host"));
    manager.join("guest", room.code);
    manager.setReady("host", room.roomId, true);
    const first = manager.setReady("guest", room.roomId, true);
    if (!first.ok) throw new Error("Expected start");
    expect(GameStartSchema.safeParse(first.data.start).success).toBe(true);
    expect(manager.setReady("guest", room.roomId, true)).toEqual({ ok: false, code: "ROOM_NOT_WAITING" });
    const waiting = roomOf(manager.disconnect("host")!);
    expect(waiting.status).toBe("WAITING_FOR_PLAYERS");
    expect(waiting.players).toEqual([{ connectionId: "guest", slot: "PLAYER_1", ready: false }]);
    manager.join("replacement", room.code);
    manager.setReady("guest", room.roomId, true);
    const next = manager.setReady("replacement", room.roomId, true);
    expect(next.ok && next.data.start?.startId).not.toBe(first.data.start?.startId);
    manager.disconnect("guest");
    manager.disconnect("replacement");
    expect(manager.disconnect("replacement")).toBeUndefined();
    expect(manager.roomCount).toBe(0);
    expect(manager.memberCount).toBe(0);
  });

  it("T15 isolates managers and clears all state", () => {
    const manager = new RoomManager();
    const room = roomOf(manager.create("a"));
    expect(new RoomManager().join("b", room.code)).toEqual({ ok: false, code: "ROOM_NOT_FOUND" });
    manager.clear();
    expect(manager.roomCount).toBe(0);
    expect(manager.memberCount).toBe(0);
  });
});
