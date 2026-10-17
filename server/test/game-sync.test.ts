import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { GameStart, GameStateSync } from "@typelore/shared";
import { acceptGameSync } from "../../client/src/hooks/gameSync.js";
import { createInitialGameState } from "../src/game/GameEngine.js";

function fixture(): GameStateSync {
  const start: GameStart = { room: { roomId: randomUUID(), code: "ABC234", revision: 3, status: "STARTING",
    players: [{ connectionId: "a", slot: "PLAYER_1", ready: true },
      { connectionId: "b", slot: "PLAYER_2", ready: true }] }, startId: randomUUID(), serverTime: 0 };
  return { room: { ...start.room, revision: 4, status: "IN_GAME" }, state: createInitialGameState(start), serverTime: 0 };
}

describe("client snapshot acceptance", () => {
  it("accepts same room revision after room update, including the guest perspective", () => {
    const sync = fixture();
    for (const id of ["a", "b"]) {
      expect(acceptGameSync(sync, sync.room, sync.state.startId, null, id)).toEqual(sync);
    }
    const newer = structuredClone(sync); newer.state.revision += 1;
    expect(acceptGameSync(newer, sync.room, sync.state.startId, sync.state, "a")).toEqual(newer);
  });

  it("rejects duplicate/stale game state, wrong room/start/member and reset sessions", () => {
    const sync = fixture(); const { room, state } = sync;
    expect(acceptGameSync(sync, room, state.startId, state, "a")).toBeNull();
    expect(acceptGameSync(sync, room, state.startId, { ...state, revision: 2 }, "a")).toBeNull();
    expect(acceptGameSync(sync, { ...room, revision: room.revision + 1 }, state.startId, null, "a")).toBeNull();
    expect(acceptGameSync(sync, { ...room, roomId: randomUUID() }, state.startId, null, "a")).toBeNull();
    expect(acceptGameSync(sync, room, randomUUID(), null, "a")).toBeNull();
    expect(acceptGameSync(sync, room, null, null, "a")).toBeNull();
    expect(acceptGameSync(sync, null, state.startId, null, "a")).toBeNull();
    expect(acceptGameSync(sync, room, state.startId, null, undefined)).toBeNull();
    expect(acceptGameSync(sync, room, state.startId, null, "outsider")).toBeNull();
    const replaced = structuredClone(room); replaced.players[1]!.connectionId = "replacement";
    expect(acceptGameSync(sync, replaced, state.startId, null, "a")).toBeNull();
    expect(acceptGameSync({ ...sync, extra: true }, room, state.startId, null, "a")).toBeNull();
  });
});
