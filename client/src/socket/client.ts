import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@typelore/shared";
import {
  io,
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from "socket.io-client";

const serverUrl = import.meta.env.VITE_SERVER_URL;
const connectionOptions: Partial<ManagerOptions & SocketOptions> = {
  autoConnect: false,
  transports: ["websocket"],
};

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  serverUrl === undefined
    ? io(connectionOptions)
    : io(serverUrl, connectionOptions);
