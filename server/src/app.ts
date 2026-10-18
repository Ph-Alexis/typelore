import {
  PROTOCOL_VERSION,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@typelore/shared";
import cors from "cors";
import express, { type Express } from "express";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";

import { registerProtocolHandlers } from "./socket/registerProtocolHandlers.js";
import { registerRoomHandlers } from "./socket/registerRoomHandlers.js";
import { RoomManager } from "./rooms/RoomManager.js";
import { registerCommandHandlers } from "./socket/registerCommandHandlers.js";

export interface TypeloreServerOptions {
  clientOrigin: string;
}

export interface TypeloreServer {
  app: Express;
  httpServer: HttpServer;
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  start: (port: number) => Promise<number>;
  stop: () => Promise<void>;
}

export function createApplication(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "typelore-server",
      protocolVersion: PROTOCOL_VERSION,
    });
  });

  return app;
}

export function createTypeloreServer(
  options: TypeloreServerOptions,
): TypeloreServer {
  const app = createApplication();
  app.use(
    cors({
      origin: options.clientOrigin,
      methods: ["GET"],
    }),
  );

  const httpServer = createHttpServer(app);
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      cors: {
        origin: options.clientOrigin,
        methods: ["GET", "POST"],
      },
    },
  );
  const rooms = new RoomManager({
    onSync(sync) {
      io.to(sync.room.players.map((player) => player.connectionId)).emit("game:state-sync", sync);
    },
  });

  io.on("connection", (socket) => {
    registerProtocolHandlers(socket);
    registerRoomHandlers(io, socket, rooms);
    registerCommandHandlers(socket, rooms);
  });

  return {
    app,
    httpServer,
    io,
    start(port) {
      return new Promise((resolve, reject) => {
        const onError = (error: Error): void => {
          httpServer.off("listening", onListening);
          reject(error);
        };
        const onListening = (): void => {
          httpServer.off("error", onError);
          const address = httpServer.address();

          if (address === null || typeof address === "string") {
            reject(new Error("The server did not bind to a TCP port."));
            return;
          }

          resolve(address.port);
        };

        httpServer.once("error", onError);
        httpServer.once("listening", onListening);
        httpServer.listen(port);
      });
    },
    stop() {
      return new Promise((resolve) => {
        io.close(() => { rooms.clear(); resolve(); });
      });
    },
  };
}
