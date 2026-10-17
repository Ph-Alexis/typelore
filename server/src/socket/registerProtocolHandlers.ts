import {
  ConnectionPingSchema,
  PROTOCOL_VERSION,
  ProtocolHelloSchema,
  type Ack,
  type ClientToServerEvents,
  type ConnectionPong,
  type ProtocolWelcome,
  type ServerToClientEvents,
  type SocketData,
} from "@typelore/shared";
import type { Socket } from "socket.io";

type ProtocolSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

function welcomePayload(socket: ProtocolSocket): ProtocolWelcome {
  return {
    protocolVersion: PROTOCOL_VERSION,
    serverTime: Date.now(),
    connectionId: socket.id,
  };
}

export function registerProtocolHandlers(socket: ProtocolSocket): void {
  socket.data.protocolReady = false;
  socket.emit("protocol:welcome", welcomePayload(socket));

  socket.on("protocol:hello", (payload, acknowledge) => {
    socket.data.protocolReady = false;
    if (typeof acknowledge !== "function") return;
    const parsed = ProtocolHelloSchema.safeParse(payload);

    if (!parsed.success) {
      acknowledge({
        ok: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "The protocol hello payload is invalid.",
        },
        serverTime: Date.now(),
      });
      return;
    }

    if (parsed.data.protocolVersion !== PROTOCOL_VERSION) {
      acknowledge({
        ok: false,
        error: {
          code: "PROTOCOL_MISMATCH",
          message: "The client and server protocol versions do not match.",
        },
        serverTime: Date.now(),
      });
      return;
    }

    socket.data.protocolReady = true;
    acknowledge({
      ok: true,
      data: welcomePayload(socket),
      serverTime: Date.now(),
    });
  });

  socket.on("connection:ping", (payload, acknowledge) => {
    if (typeof acknowledge !== "function") return;
    const parsed = ConnectionPingSchema.safeParse(payload);

    if (!parsed.success) {
      acknowledge({
        ok: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "The ping payload is invalid.",
        },
        serverTime: Date.now(),
      });
      return;
    }

    const response: Ack<ConnectionPong> = {
      ok: true,
      data: {
        ...parsed.data,
        serverTime: Date.now(),
      },
      serverTime: Date.now(),
    };

    acknowledge(response);
  });
}
