#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");

const DEFAULT_CLIENT_PORT = "5175";
const DEFAULT_SERVER_PORT = "8788";
const DEFAULT_HOST = "127.0.0.1";

const args = process.argv.slice(2);
const clientPort = process.env.E2E_PORT ?? DEFAULT_CLIENT_PORT;
const serverPort = process.env.E2E_WS_PORT ?? DEFAULT_SERVER_PORT;
const clientHost = process.env.E2E_HOST ?? DEFAULT_HOST;
const serverHost = process.env.E2E_WS_HOST ?? DEFAULT_HOST;
const reuseExistingServers = process.env.E2E_REUSE_EXISTING_SERVER === "true";
const baseEnv = sanitizeColorEnv(process.env);

const env = {
  ...baseEnv,
  E2E_PORT: clientPort,
  E2E_WS_PORT: serverPort,
  E2E_HOST: clientHost,
  E2E_WS_HOST: serverHost,
};

try {
  console.log(
    `HeroByte E2E using client http://${clientHost}:${clientPort} and server ws://${serverHost}:${serverPort}.`,
  );

  if (reuseExistingServers) {
    console.log("E2E_REUSE_EXISTING_SERVER=true, so startup preflight is skipped.");
  } else {
    await run(
      process.execPath,
      [
        "scripts/dev-port-preflight.mjs",
        "ensure-free",
        "--client-port",
        clientPort,
        "--server-port",
        serverPort,
      ],
      { env: baseEnv },
    );
  }

  const playwrightCommand = getPnpmExecCommand(["exec", "playwright", "test", ...args]);
  await run(playwrightCommand.command, playwrightCommand.args, { env });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(process.exitCode || 1);
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: projectRoot,
      env: options.env ?? process.env,
      shell: options.shell ?? false,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      if (signal) {
        process.exitCode = 1;
        reject(new Error(`${formatCommand(command, commandArgs)} stopped with signal ${signal}.`));
        return;
      }

      process.exitCode = code ?? 1;
      reject(
        new Error(`${formatCommand(command, commandArgs)} exited with code ${process.exitCode}.`),
      );
    });
  });
}

function formatCommand(command, commandArgs) {
  return [command, ...commandArgs].join(" ");
}

function getPnpmExecCommand(commandArgs) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...commandArgs],
    };
  }

  return {
    command: "pnpm",
    args: commandArgs,
  };
}

function sanitizeColorEnv(source) {
  const env = { ...source };
  delete env.NO_COLOR;
  return env;
}
