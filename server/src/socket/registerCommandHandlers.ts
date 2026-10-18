import { CommandIntentSchema, type ClientToServerEvents, type ServerToClientEvents,
  type SocketData, type CommandErrorCode } from "@typelore/shared";
import type { Socket } from "socket.io";
import type { RoomManager } from "../rooms/RoomManager.js";

export function registerCommandHandlers(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>, rooms: RoomManager,
): void {
  socket.on("game:command", (payload, ack) => {
    if (typeof ack !== "function") return;
    const fail = (code: CommandErrorCode) => ack({ ok: false,
      error: { code, message: "The command could not be executed." }, serverTime: Date.now() });
    try {
      if (!socket.data.protocolReady) { fail("PROTOCOL_NOT_READY"); return; }
      const parsed = CommandIntentSchema.safeParse(payload);
      if (!parsed.success) { fail("INVALID_PAYLOAD"); return; }
      const result = rooms.executeCommand(socket.id, parsed.data);
      if (!result.ok) { fail(result.code); return; }
      ack({ ok: true, data: result.data, serverTime: Date.now() });
    } catch { fail("INTERNAL_ERROR"); }
  });
}
