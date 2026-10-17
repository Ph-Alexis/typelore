import { z } from "zod";
import { RoomCreateSchema, RoomJoinSchema, RoomLeaveSchema, RoomReadySchema,
  type ClientToServerEvents, type ServerToClientEvents, type SocketData,
  type RoomAck, type ProtocolErrorCode, type RoomErrorCode } from "@typelore/shared";
import type { Server, Socket } from "socket.io";
import { RoomManager, type RoomResult } from "../rooms/RoomManager.js";

type RoomSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type RoomServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerRoomHandlers(io: RoomServer, socket: RoomSocket, rooms: RoomManager): void {
  function publish(result: RoomResult): void {
    if (!result.ok || !result.data.changed || !result.data.room) return;
    const { room, joined, left, start, sync } = result.data;
    const audience = io.to(room.players.map((player) => player.connectionId));
    if (start) {
      audience.emit("room:updated", start.room);
      audience.emit("game:start", start);
    }
    audience.emit("room:updated", room);
    if (joined) audience.emit("room:player-joined", joined);
    if (left) audience.emit("room:player-left", left);
    if (sync) audience.emit("game:state-sync", sync);
  }
  function action<T>(schema: z.ZodType<T>, payload: unknown, acknowledge: unknown,
    mutate: (value: T) => RoomResult, leave = false, join = false): void {
    if (typeof acknowledge !== "function") return;
    const ack = acknowledge as (response: RoomAck<unknown>) => void;
    const fail = (code: ProtocolErrorCode | RoomErrorCode): void => {
      ack({ ok: false, error: { code, message: "The room request could not be completed." }, serverTime: Date.now() });
    };
    try {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        const shape = z.object({ code: z.string() }).strict().safeParse(payload);
        fail(join && shape.success ? "INVALID_ROOM_CODE" : "INVALID_PAYLOAD");
        return;
      }
      if (!socket.data.protocolReady) { fail("PROTOCOL_NOT_READY"); return; }
      const result = mutate(parsed.data);
      if (!result.ok) { fail(result.code); return; }
      publish(result);
      ack({ ok: true, data: leave ? { roomId: result.data.roomId } : { room: result.data.room }, serverTime: Date.now() });
    } catch {
      fail("INTERNAL_ERROR");
    }
  }
  socket.on("room:create", (payload, ack) => action(RoomCreateSchema, payload, ack, () => rooms.create(socket.id)));
  socket.on("room:join", (payload, ack) => action(RoomJoinSchema, payload, ack,
    ({ code }) => rooms.join(socket.id, code), false, true));
  socket.on("room:ready", (payload, ack) => action(RoomReadySchema, payload, ack,
    ({ roomId, ready }) => rooms.setReady(socket.id, roomId, ready)));
  socket.on("room:leave", (payload, ack) => action(RoomLeaveSchema, payload, ack,
    ({ roomId }) => rooms.leave(socket.id, roomId), true));
  socket.on("disconnect", () => {
    const result = rooms.disconnect(socket.id);
    if (result) publish(result);
  });
}
