#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import coverage from "istanbul-lib-coverage";
import * as libReport from "istanbul-lib-report";
import reports from "istanbul-reports";

const { createCoverageMap } = coverage;

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const coverageDir = path.join(projectRoot, "coverage");

const cpuCount = os.cpus()?.length ?? 4;
const ciDefaultChunkSize = Math.max(2, Math.floor(cpuCount / 2));
const localDefaultChunkSize = Math.max(2, cpuCount - 2);
const defaultChunkSize = process.env.CI ? ciDefaultChunkSize : localDefaultChunkSize;
const chunkSizeInput = Number(process.env.CLIENT_COVERAGE_CHUNK_SIZE ?? defaultChunkSize);
const chunkSize = Number.isFinite(chunkSizeInput) && chunkSizeInput > 0 ? Math.floor(chunkSizeInput) : defaultChunkSize;

const ciDefaultConcurrency = Math.max(2, Math.floor(cpuCount / 2));
const localDefaultConcurrency = Math.max(2, cpuCount - 2);
const defaultConcurrency = process.env.CI ? ciDefaultConcurrency : localDefaultConcurrency;
const concurrencyInput = Number(process.env.CLIENT_COVERAGE_CONCURRENCY ?? defaultConcurrency);
const requestedConcurrency = Number.isFinite(concurrencyInput) && concurrencyInput > 0 ? Math.floor(concurrencyInput) : defaultConcurrency;

const globPatterns = ["src/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.?(c|m)[jt]s?(x)"];
const ignorePatterns = ["**/node_modules/**", "**/dist/**"];

const globResults = await fg(globPatterns, {
  cwd: projectRoot,
  ignore: ignorePatterns,
  onlyFiles: true,
});

const allTests = Array.from(new Set(globResults)).sort();

if (allTests.length === 0) {
  console.error("[coverage] No test files found. Aborting.");
  process.exit(1);
}

console.log(
  `[coverage] Discovered ${allTests.length} test files. Using batch size ${chunkSize} (override with CLIENT_COVERAGE_CHUNK_SIZE).`,
);

const includePatternInput = process.env.CLIENT_COVERAGE_INCLUDE?.trim();
let filteredTests = allTests;

if (includePatternInput) {
  let matcher;
  try {
    matcher = new RegExp(includePatternInput);
  } catch (error) {
    console.error(`[coverage] Invalid CLIENT_COVERAGE_INCLUDE regex: ${error.message}`);
    process.exit(1);
  }

  filteredTests = allTests.filter((file) => matcher.test(file.replace(/\\/g, "/")));

  if (filteredTests.length === 0) {
    console.error(
      `[coverage] CLIENT_COVERAGE_INCLUDE=${includePatternInput} did not match any files out of ${allTests.length} tests. Aborting.`,
    );
    process.exit(1);
  }

  console.log(
    `[coverage] CLIENT_COVERAGE_INCLUDE matched ${filteredTests.length}/${allTests.length} test files. Running filtered set only.`,
  );
}

const toPosix = (p) => p.replace(/\\/g, "/");
const heavyFiles = filteredTests.filter((file) => toPosix(file).includes("/characterization/"));
const heavySet = new Set(heavyFiles);
const normalFiles = filteredTests.filter((file) => !heavySet.has(file));

const chunk = (items, size) => {
  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const batches = [
  ...heavyFiles.map((file) => [file]),
  ...chunk(normalFiles, chunkSize),
].filter((files) => files.length > 0);

if (batches.length === 0) {
  console.error("[coverage] No test batches were created. Aborting.");
  process.exit(1);
}

const coverageMap = createCoverageMap({});

const concurrency = Math.min(batches.length, requestedConcurrency);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "client-coverage-"));

console.log(`[coverage] Running ${concurrency} batch${concurrency === 1 ? "" : "es"} in parallel (override with CLIENT_COVERAGE_CONCURRENCY).`);

const baseCoverageArgs = [
  "vitest",
  "run",
  "--coverage.enabled",
  "true",
  "--coverage.reporter",
  "json",
  "--no-file-parallelism",
  "--reporter",
  "dot",
];

const runBatch = async (index, files) => {
  const relativeFiles = files.map((file) => path.relative(projectRoot, file));
  console.log(`\n[coverage] Batch ${index + 1}/${batches.length} (${files.length} files) ➜ ${relativeFiles.join(", ")}`);

  const outputDir = path.join(tempRoot, `batch-${String(index + 1).padStart(4, "0")}`);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const args = [...baseCoverageArgs, "--coverage.reportsDirectory", outputDir, ...files];

  await new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const reason = typeof code === "number" ? `exit code ${code}` : `signal ${signal}`;
      reject(new Error(`[coverage] Vitest failed for batch ${index + 1} (${reason}).`));
    });
  });

  const partialPath = path.join(outputDir, "coverage-final.json");
  if (!fs.existsSync(partialPath)) {
    throw new Error(`[coverage] Missing coverage output after batch ${index + 1}.`);
  }

  const partial = JSON.parse(fs.readFileSync(partialPath, "utf8"));
  coverageMap.merge(partial);

  fs.rmSync(outputDir, { recursive: true, force: true });
};

let nextBatchIndex = 0;

const scheduleNext = async () => {
  const index = nextBatchIndex;
  const files = batches[index];
  nextBatchIndex += 1;
  if (!files) {
    return;
  }
  await runBatch(index, files);
  await scheduleNext();
};

const workers = Array.from({ length: concurrency }, () => scheduleNext());

try {
  await Promise.all(workers);
} catch (error) {
  console.error(error.message ?? error);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  process.exit(1);
}

fs.rmSync(tempRoot, { recursive: true, force: true });
fs.rmSync(coverageDir, { recursive: true, force: true });
fs.mkdirSync(coverageDir, { recursive: true });

const reportContext = libReport.createContext({
  dir: coverageDir,
  coverageMap,
});

for (const reporter of ["json", "lcov", "text", "html"]) {
  reports.create(reporter).execute(reportContext);
}

console.log(`\n[coverage] Combined coverage from ${batches.length} batches written to ${coverageDir}`);
