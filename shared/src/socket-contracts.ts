import type {
  ConnectionPing,
  ConnectionPong,
  ProtocolHello,
  ProtocolWelcome,
} from "./protocol.js";
import type {
  GameStart, RoomCreate, RoomJoin, RoomReady, RoomLeave, RoomState,
  RoomPlayerJoined, RoomPlayerLeft, RoomErrorCode,
} from "./room.js";

export type ProtocolErrorCode =
  | "INVALID_PAYLOAD"
  | "PROTOCOL_MISMATCH"
  | "INTERNAL_ERROR";

export interface ProtocolError<Code extends string = ProtocolErrorCode> {
  code: Code;
  message: string;
}

export type Ack<T, Code extends string = ProtocolErrorCode> =
  | { ok: true; data: T; serverTime: number }
  | { ok: false; error: ProtocolError<Code>; serverTime: number };

export type RoomAck<T> = Ack<T, ProtocolErrorCode | RoomErrorCode>;
export interface SocketData { protocolReady: boolean }

export interface ServerToClientEvents {
  "room:updated": (payload: RoomState) => void;
  "room:player-joined": (payload: RoomPlayerJoined) => void;
  "room:player-left": (payload: RoomPlayerLeft) => void;
  "game:start": (payload: GameStart) => void;
  "protocol:welcome": (payload: ProtocolWelcome) => void;
  "server:error": (payload: ProtocolError & { recoverable: boolean }) => void;
}

export interface ClientToServerEvents {
  "room:create": (payload: RoomCreate, acknowledge: (response: RoomAck<{ room: RoomState }>) => void) => void;
  "room:join": (payload: RoomJoin, acknowledge: (response: RoomAck<{ room: RoomState }>) => void) => void;
  "room:ready": (payload: RoomReady, acknowledge: (response: RoomAck<{ room: RoomState }>) => void) => void;
  "room:leave": (payload: RoomLeave, acknowledge: (response: RoomAck<{ roomId: string }>) => void) => void;
  "protocol:hello": (
    payload: ProtocolHello,
    acknowledge: (response: Ack<ProtocolWelcome>) => void,
  ) => void;
  "connection:ping": (
    payload: ConnectionPing,
    acknowledge: (response: Ack<ConnectionPong>) => void,
  ) => void;
}
