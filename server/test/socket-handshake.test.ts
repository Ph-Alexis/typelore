import {
  PROTOCOL_VERSION,
  type Ack,
  type ClientToServerEvents,
  type ConnectionPong,
  type ProtocolHello,
  type ProtocolWelcome,
  type ServerToClientEvents,
} from "@typelore/shared";
import { io as createSocketClient, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { createTypeloreServer, type TypeloreServer } from "../src/app.js";

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const clients: TestClient[] = [];
const servers: TypeloreServer[] = [];

async function startTestServer(): Promise<{ server: TypeloreServer; url: string }> {
  const server = createTypeloreServer({ clientOrigin: "http://localhost:5173" });
  const port = await server.start(0);
  servers.push(server);

  return { server, url: `http://127.0.0.1:${port}` };
}

function createClient(url: string): TestClient {
  const client: TestClient = createSocketClient(url, {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });
  clients.push(client);

  return client;
}

async function connectClient(url: string): Promise<TestClient> {
  const client = createClient(url);

  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
    client.connect();
  });

  return client;
}

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }
  for (const server of servers.splice(0)) {
    await server.stop();
  }
});

describe("Socket.IO protocol foundation", () => {
  it("emits a welcome event and acknowledges compatible clients", async () => {
    const { url } = await startTestServer();
    const client = createClient(url);
    const welcomePromise = new Promise<ProtocolWelcome>((resolve) => {
      client.once("protocol:welcome", resolve);
    });
    const connectPromise = new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });

    client.connect();
    await connectPromise;
    const welcome = await welcomePromise;

    expect(welcome.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(welcome.connectionId).toBe(client.id);

    const response = await new Promise<Ack<ProtocolWelcome>>((resolve) => {
      client.emit("protocol:hello", { protocolVersion: PROTOCOL_VERSION }, resolve);
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.protocolVersion).toBe(PROTOCOL_VERSION);
      expect(response.data.connectionId).toBe(client.id);
    }
  });

  it("round-trips a validated ping", async () => {
    const { url } = await startTestServer();
    const client = await connectClient(url);

    const response = await new Promise<Ack<ConnectionPong>>((resolve) => {
      client.emit(
        "connection:ping",
        { nonce: "foundation-check", clientTime: 123 },
        resolve,
      );
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.nonce).toBe("foundation-check");
      expect(response.data.clientTime).toBe(123);
      expect(response.data.serverTime).toBeGreaterThan(0);
    }
  });

  it("rejects an incompatible protocol version", async () => {
    const { url } = await startTestServer();
    const client = await connectClient(url);

    const response = await new Promise<Ack<ProtocolWelcome>>((resolve) => {
      client.emit("protocol:hello", { protocolVersion: "0.0.0" }, resolve);
    });

    expect(response).toMatchObject({
      ok: false,
      error: { code: "PROTOCOL_MISMATCH" },
    });
  });

  it("rejects a malformed hello payload", async () => {
    const { url } = await startTestServer();
    const client = await connectClient(url);
    const malformedPayload = { protocolVersion: 1 } as unknown as ProtocolHello;

    const response = await new Promise<Ack<ProtocolWelcome>>((resolve) => {
      client.emit("protocol:hello", malformedPayload, resolve);
    });

    expect(response).toMatchObject({
      ok: false,
      error: { code: "INVALID_PAYLOAD" },
    });
  });
});
