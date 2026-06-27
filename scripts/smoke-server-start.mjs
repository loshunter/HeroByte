import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const serverEntry =
  process.argv[2] ?? process.env.HEROBYTE_SERVER_ENTRY ?? "apps/server/dist/index.js";
const port = await reservePort();
const output = [];
const server = spawn(process.execPath, [serverEntry], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HEROBYTE_ROOM_SECRET: "ci-room-secret",
    HEROBYTE_DM_PASSWORD: "ci-dm-password",
    HEROBYTE_ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
    ROOM_STATE_FILE: ".tmp/server-smoke-state.json",
    HEROBYTE_MAP_STORE_FILE: ".tmp/server-smoke-maps.json",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => remember(chunk));
server.stderr.on("data", (chunk) => remember(chunk));

try {
  await waitForHealth(port, server);
  console.log(`Production server smoke check passed on port ${port}`);
} catch (error) {
  console.error(output.join(""));
  throw error;
} finally {
  await stop(server);
}

function remember(chunk) {
  output.push(chunk.toString());
  if (output.length > 100) output.shift();
}

async function reservePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string")
    throw new Error("Unable to reserve a smoke-test port");
  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function waitForHealth(port, process) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (process.exitCode !== null) {
      throw new Error(`Production server exited before becoming healthy (${process.exitCode})`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok && (await response.text()) === "ok") return;
    } catch {
      // The server may still be binding its socket.
    }
    await delay(100);
  }
  throw new Error("Production server did not become healthy within 5 seconds");
}

async function stop(process) {
  if (process.exitCode !== null) return;
  process.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => process.once("exit", resolve)),
    delay(2000).then(() => process.kill("SIGKILL")),
  ]);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
