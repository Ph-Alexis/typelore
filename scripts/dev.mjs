import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";

const DEFAULT_SERVER_PORT = 3001;
const DEFAULT_CLIENT_PORT = 5173;
const MAX_PORT = 65_535;

function canListen(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();

    probe.unref();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
        return;
      }

      reject(error);
    });
    // Match Node/Vite's default dual-stack bind, including IPv6 listeners.
    probe.listen({ port, exclusive: true }, () => {
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(true);
      });
    });
  });
}

async function findAvailablePort(startPort, excludedPorts = new Set()) {
  for (let port = startPort; port <= MAX_PORT; port += 1) {
    if (!excludedPorts.has(port) && (await canListen(port))) {
      return port;
    }
  }

  throw new Error(`No available TCP port found from ${startPort}.`);
}

function npmProcess(args, environment = process.env) {
  const npmCliPath = process.env.npm_execpath;

  if (!npmCliPath) {
    throw new Error("npm_execpath is unavailable. Start development through npm.cmd run dev.");
  }

  return spawn(process.execPath, [npmCliPath, ...args], {
    env: environment,
    stdio: "inherit",
  });
}

function waitForProcess(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

const buildExitCode = await waitForProcess(
  npmProcess(["run", "build", "-w", "@typelore/shared"]),
);

if (buildExitCode !== 0) {
  process.exitCode = buildExitCode;
} else {
  const serverPort = await findAvailablePort(DEFAULT_SERVER_PORT);
  const clientPort = await findAvailablePort(
    DEFAULT_CLIENT_PORT,
    new Set([serverPort]),
  );
  const environment = {
    ...process.env,
    PORT: String(serverPort),
    DEV_CLIENT_PORT: String(clientPort),
  };

  console.log("\nTypelore development ports");
  console.log(`  Server: http://localhost:${serverPort}`);
  console.log(`  Client: http://localhost:${clientPort}`);
  for (const address of lanAddresses()) {
    console.log(`  Network: http://${address}:${clientPort}`);
  }
  console.log("");

  const services = npmProcess(["run", "dev:services"], environment);
  process.exitCode = await waitForProcess(services);
}
