#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

const chunkSizeInput = Number(process.env.CLIENT_COVERAGE_CHUNK_SIZE ?? 1);
const chunkSize = Number.isFinite(chunkSizeInput) && chunkSizeInput > 0 ? chunkSizeInput : 1;

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

const toPosix = (p) => p.replace(/\\/g, "/");
const heavyFiles = allTests.filter((file) => toPosix(file).includes("/characterization/"));
const heavySet = new Set(heavyFiles);
const normalFiles = allTests.filter((file) => !heavySet.has(file));

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

for (const [index, files] of batches.entries()) {
  const relativeFiles = files.map((file) => path.relative(projectRoot, file));
  console.log(`\n[coverage] Batch ${index + 1}/${batches.length} (${files.length} files) ➜ ${relativeFiles.join(", ")}`);
  fs.rmSync(coverageDir, { recursive: true, force: true });

  const result = spawnSync("pnpm", ["vitest", "run", "--coverage", "--no-file-parallelism", "--reporter=dot", ...files], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`[coverage] Vitest failed for batch ${index + 1}.`);
    process.exit(result.status ?? 1);
  }

  const partialPath = path.join(coverageDir, "coverage-final.json");
  if (!fs.existsSync(partialPath)) {
    console.error(`[coverage] Missing coverage output after batch ${index + 1}.`);
    process.exit(1);
  }

  const partial = JSON.parse(fs.readFileSync(partialPath, "utf8"));
  coverageMap.merge(partial);
}

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
