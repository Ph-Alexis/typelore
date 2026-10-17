import { createTypeloreServer } from "./app.js";
import { loadEnvironment } from "./config/env.js";

const environment = loadEnvironment();
const server = createTypeloreServer({ clientOrigin: environment.clientOrigin });
const port = await server.start(environment.port);

console.log(`Typelore server listening on http://localhost:${port}`);

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}; shutting down.`);
  await server.stop();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
