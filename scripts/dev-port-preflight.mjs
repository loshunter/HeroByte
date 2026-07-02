#!/usr/bin/env node
import { execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");

const args = process.argv.slice(2);

const DEFAULT_PORTS = [
  {
    service: "client",
    port: 5174,
    expected: "HeroByte client/Vite dev server",
    safeHints: ["herobyte-client", "/apps/client/", "vite"],
  },
  {
    service: "server",
    port: 8787,
    expected: "HeroByte backend dev server",
    safeHints: ["vtt-server", "/apps/server/", "tsx", "dist/index.js", "start-e2e-server.mjs"],
    safeMarkers: ["--herobyte-e2e-server"],
  },
];

const GRACEFUL_WAIT_MS = 2500;
const FORCE_WAIT_MS = 2500;
const POLL_MS = 250;

const command = getCommand();
const PORTS = DEFAULT_PORTS.map((entry) => ({
  ...entry,
  port: getConfiguredPort(entry),
}));
const selectedService = getOptionValue("--service");
const dryRun = args.includes("--dry-run");

if (!["doctor", "ensure-free", "free"].includes(command)) {
  fail(`Unknown command "${command}". Use doctor, ensure-free, or free.`, 1);
}

if (selectedService && !PORTS.some((entry) => entry.service === selectedService)) {
  fail(`Unknown service "${selectedService}". Use client or server.`, 1);
}

const selectedPorts = PORTS.filter(
  (entry) => !selectedService || entry.service === selectedService,
);

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message, 1);
});

async function main() {
  if (command === "doctor") {
    const listeners = await getListeners();
    printDoctor(listeners);
    return;
  }

  await ensurePortsFree();
}

async function ensurePortsFree() {
  const listeners = await getListeners();
  const blockers = listeners.filter((listener) => !isSafeHeroByteOwner(listener));

  if (blockers.length > 0) {
    printBlocked(blockers);
    throw new Error("Refusing to stop unknown port owner(s).");
  }

  if (listeners.length === 0) {
    console.log("HeroByte ports are free.");
    return;
  }

  for (const listener of listeners) {
    const action = dryRun ? "Would stop" : "Stopping";
    console.log(
      `${action} previous ${listener.portInfo.expected} on port ${listener.port} (PID ${listener.pid}).`,
    );
    console.log(`  ${formatCommand(listener)}`);
    if (!dryRun) {
      await stopProcess(listener.pid, false);
    }
  }

  if (dryRun) {
    return;
  }

  const afterGraceful = await waitForPortsToClear(GRACEFUL_WAIT_MS);
  if (afterGraceful.length === 0) {
    console.log("HeroByte ports are free.");
    return;
  }

  const unsafeAfterGraceful = afterGraceful.filter((listener) => !isSafeHeroByteOwner(listener));
  if (unsafeAfterGraceful.length > 0) {
    printBlocked(unsafeAfterGraceful);
    throw new Error("A port was taken by an unknown process during cleanup.");
  }

  for (const listener of afterGraceful) {
    console.log(
      `Force-stopping previous ${listener.portInfo.expected} on port ${listener.port} (PID ${listener.pid}).`,
    );
    await stopProcess(listener.pid, true);
  }

  const afterForce = await waitForPortsToClear(FORCE_WAIT_MS);
  if (afterForce.length > 0) {
    printBlocked(afterForce);
    throw new Error("HeroByte dev ports are still busy after cleanup.");
  }

  console.log("HeroByte ports are free.");
}

function printDoctor(listeners) {
  console.log("HeroByte port status:");

  for (const portInfo of selectedPorts) {
    const owners = listeners.filter((listener) => listener.port === portInfo.port);
    if (owners.length === 0) {
      console.log(`  ${portInfo.port} (${portInfo.service}): free`);
      continue;
    }

    for (const owner of owners) {
      const safety = isSafeHeroByteOwner(owner) ? "releasable HeroByte process" : "unknown owner";
      console.log(`  ${portInfo.port} (${portInfo.service}): ${safety}`);
      console.log(`    PID ${owner.pid}: ${formatCommand(owner)}`);
    }
  }
}

function printBlocked(blockers) {
  console.error("HeroByte cannot safely release these port owner(s):");
  for (const blocker of blockers) {
    console.error(`  Port ${blocker.port} (${blocker.portInfo.service}), PID ${blocker.pid}`);
    console.error(`    ${formatCommand(blocker)}`);
  }
  console.error("");
  console.error("Stop the process manually, then retry. HeroByte will not switch to another port.");
}

async function getListeners() {
  const rawListeners =
    process.platform === "win32" ? await getWindowsListeners() : await getPosixListeners();

  const selectedPortNumbers = new Set(selectedPorts.map((entry) => entry.port));
  const seen = new Set();
  const listeners = [];

  for (const listener of rawListeners) {
    if (!selectedPortNumbers.has(listener.port) || listener.pid <= 0) {
      continue;
    }

    const key = `${listener.port}:${listener.pid}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const portInfo = selectedPorts.find((entry) => entry.port === listener.port);
    if (!portInfo) {
      continue;
    }

    listeners.push({ ...listener, portInfo });
  }

  return listeners;
}

async function getWindowsListeners() {
  const portList = selectedPorts.map((entry) => entry.port).join(",");
  const script = `
$ports = @(${portList})
$connections = foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
}
$rows = @()
foreach ($conn in $connections) {
  $processInfo = $null
  if ($conn.OwningProcess -and $conn.OwningProcess -ne 0) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($conn.OwningProcess)" -ErrorAction SilentlyContinue
  }
  $rows += [pscustomobject]@{
    port = [int]$conn.LocalPort
    pid = [int]$conn.OwningProcess
    processName = if ($processInfo) { $processInfo.Name } else { "" }
    commandLine = if ($processInfo) { $processInfo.CommandLine } else { "" }
    executablePath = if ($processInfo) { $processInfo.ExecutablePath } else { "" }
  }
}
$rows | ConvertTo-Json -Depth 4
`;

  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ]);

  return parseJsonRows(stdout);
}

async function getPosixListeners() {
  const listeners = [];

  for (const portInfo of selectedPorts) {
    const pids = await getPosixPidsForPort(portInfo.port);
    for (const pid of pids) {
      const processInfo = await getPosixProcessInfo(pid);
      listeners.push({
        port: portInfo.port,
        pid,
        processName: processInfo.processName,
        commandLine: processInfo.commandLine,
        executablePath: "",
      });
    }
  }

  return listeners;
}

async function getPosixPidsForPort(port) {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"]);

    return Array.from(
      new Set(
        stdout
          .split(/\r?\n/)
          .filter((line) => line.startsWith("p"))
          .map((line) => Number(line.slice(1)))
          .filter(Number.isInteger),
      ),
    );
  } catch {
    return getPosixPidsForPortWithSs(port);
  }
}

async function getPosixPidsForPortWithSs(port) {
  try {
    const { stdout } = await execFileAsync("ss", ["-ltnp"]);
    const pids = [];

    for (const line of stdout.split(/\r?\n/)) {
      if (!line.includes(`:${port} `)) {
        continue;
      }
      const match = line.match(/pid=(\d+)/);
      if (match) {
        pids.push(Number(match[1]));
      }
    }

    return Array.from(new Set(pids));
  } catch {
    return [];
  }
}

async function getPosixProcessInfo(pid) {
  const [nameResult, argsResult] = await Promise.allSettled([
    execFileAsync("ps", ["-p", String(pid), "-o", "comm="]),
    execFileAsync("ps", ["-p", String(pid), "-o", "args="]),
  ]);

  return {
    processName: nameResult.status === "fulfilled" ? nameResult.value.stdout.trim() : "",
    commandLine: argsResult.status === "fulfilled" ? argsResult.value.stdout.trim() : "",
  };
}

function parseJsonRows(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
    port: Number(row.port),
    pid: Number(row.pid),
    processName: String(row.processName ?? ""),
    commandLine: String(row.commandLine ?? ""),
    executablePath: String(row.executablePath ?? ""),
  }));
}

function isSafeHeroByteOwner(listener) {
  if (listener.pid === process.pid || listener.pid === process.ppid) {
    return false;
  }

  const normalizedRoot = normalize(projectRoot);
  const haystack = normalize(
    [listener.processName, listener.commandLine, listener.executablePath].filter(Boolean).join(" "),
  );

  if (listener.portInfo.safeMarkers?.some((marker) => haystack.includes(normalize(marker)))) {
    return true;
  }

  if (!haystack.includes(normalizedRoot)) {
    return false;
  }

  return listener.portInfo.safeHints.some((hint) => haystack.includes(normalize(hint)));
}

function normalize(value) {
  return value.replace(/\\/g, "/").toLowerCase();
}

function formatCommand(listener) {
  return (
    listener.commandLine ||
    listener.executablePath ||
    listener.processName ||
    "process details unavailable"
  );
}

async function stopProcess(pid, force) {
  if (pid <= 0 || pid === process.pid || pid === process.ppid) {
    throw new Error(`Refusing to stop protected PID ${pid}.`);
  }

  try {
    process.kill(pid, force ? "SIGKILL" : "SIGTERM");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to stop PID ${pid}: ${message}`);
  }
}

async function waitForPortsToClear(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let listeners = await getListeners();

  while (listeners.length > 0 && Date.now() < deadline) {
    await delay(POLL_MS);
    listeners = await getListeners();
  }

  return listeners;
}

function getOptionValue(name) {
  const prefixed = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefixed));
  if (inline) {
    return inline.slice(prefixed.length);
  }

  const index = args.indexOf(name);
  if (index >= 0) {
    return args[index + 1];
  }

  return null;
}

function getConfiguredPort(entry) {
  const optionName = `--${entry.service}-port`;
  const envName = entry.service === "client" ? "HEROBYTE_CLIENT_PORT" : "HEROBYTE_SERVER_PORT";
  const rawValue = getOptionValue(optionName) ?? process.env[envName];

  if (!rawValue) {
    return entry.port;
  }

  const port = Number(rawValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`Invalid ${entry.service} port "${rawValue}". Use a number from 1 to 65535.`, 1);
  }

  return port;
}

function getCommand() {
  const valueOptions = new Set(["--service", "--client-port", "--server-port"]);

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (valueOptions.has(arg)) {
      index++;
      continue;
    }

    if (arg.startsWith("--")) {
      continue;
    }

    return arg;
  }

  return "ensure-free";
}

function fail(message, code) {
  console.error(message);
  process.exit(code);
}
