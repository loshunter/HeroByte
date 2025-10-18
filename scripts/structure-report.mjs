#!/usr/bin/env node
/**
 * structure-report.mjs
 * ---------------------------------------------------------------------------
 * Generates a summary of the largest source files in the repo to highlight
 * "god files" that may violate SOLID principles. The output is sorted by
 * descending line count and can optionally emit JSON for downstream tooling.
 *
 * Usage examples:
 *   node scripts/structure-report.mjs
 *   node scripts/structure-report.mjs --limit 30 --threshold 300
 *   node scripts/structure-report.mjs --json > structure-report.json
 *
 * Flags:
 *   --limit <number>      Number of files to display (default: 20)
 *   --threshold <number>  LOC threshold to flag as oversized (default: 350)
 *   --json                Emit JSON instead of human readable table
 *   --include-tests       Include *.test.* files in the scan (default: false)
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const includeExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ignoreDirectories = new Set([
  "node_modules",
  "coverage",
  "dist",
  ".next",
  ".turbo",
]);

const args = process.argv.slice(2);
let limit = 20;
let threshold = 350;
let outputJson = false;
let includeTests = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--limit") {
    limit = Number.parseInt(args[i + 1] ?? "", 10);
    if (Number.isNaN(limit) || limit <= 0) {
      console.error("Invalid value for --limit. Expected a positive integer.");
      process.exit(1);
    }
    i += 1;
  } else if (arg === "--threshold") {
    threshold = Number.parseInt(args[i + 1] ?? "", 10);
    if (Number.isNaN(threshold) || threshold <= 0) {
      console.error(
        "Invalid value for --threshold. Expected a positive integer.",
      );
      process.exit(1);
    }
    i += 1;
  } else if (arg === "--json") {
    outputJson = true;
  } else if (arg === "--include-tests") {
    includeTests = true;
  } else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }
}

const repoRoot = process.cwd();
const scanRoots = [path.join(repoRoot, "apps"), path.join(repoRoot, "packages")];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    // Silent skip for directories that do not exist (e.g., optional packages)
    return [];
  }

  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirectories.has(entry.name)) continue;
      results.push(...(await walk(entryPath)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!includeExtensions.has(ext)) continue;
      if (!includeTests && /\.test\./.test(entry.name)) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      results.push(entryPath);
    }
  }

  return results;
}

function classify(filePath) {
  const relPath = path.relative(repoRoot, filePath);

  if (relPath.startsWith("apps/client/src")) {
    if (relPath.includes("/features/dm")) return "client:dm";
    if (relPath.includes("/features/map")) return "client:map";
    if (relPath.includes("/features/players")) return "client:players";
    if (relPath.includes("/components/dice")) return "client:dice";
    if (relPath.includes("/hooks/")) return "client:hooks";
    if (relPath.includes("/services/")) return "client:services";
    if (relPath.includes("/ui/")) return "client:ui";
    return "client:misc";
  }

  if (relPath.startsWith("apps/server/src")) {
    if (relPath.includes("/ws/")) return "server:websocket";
    if (relPath.includes("/domains/")) return "server:domains";
    if (relPath.includes("/middleware/")) return "server:middleware";
    return "server:core";
  }

  if (relPath.startsWith("packages/shared")) {
    return "shared";
  }

  return "other";
}

async function measureFile(filePath) {
  const fileContent = await readFile(filePath, "utf8");
  const loc = fileContent.split("\n").length;
  const relPath = path.relative(repoRoot, filePath);

  const category = classify(filePath);
  const flagged = loc >= threshold;

  let hint = "";
  if (flagged) {
    switch (category) {
      case "client:ui":
        hint = "Consider extracting providers/layout + feature shells.";
        break;
      case "client:dm":
        hint = "Split DM menu into feature panels & shared hooks.";
        break;
      case "client:map":
        hint = "Separate camera, selection, and tool orchestration.";
        break;
      case "client:hooks":
        hint = "Divide hook responsibilities per tool/state segment.";
        break;
      case "server:websocket":
        hint = "Modularize handlers per message type & connection lifecycle.";
        break;
      case "server:domains":
        hint = "Split domain orchestration vs persistence vs validation.";
        break;
      case "server:middleware":
        hint = "Break validators into schema-specific modules.";
        break;
      case "shared":
        hint = "Partition shared models into domain-specific slices.";
        break;
      default:
        hint = "Evaluate SRP boundaries and extract focused modules.";
    }
  }

  const stats = await stat(filePath);

  return {
    path: relPath,
    loc,
    category,
    flagged,
    hint,
    sizeBytes: stats.size,
  };
}

async function main() {
  const files = (
    await Promise.all(
      scanRoots.map(async (root) => {
        const paths = await walk(root);
        return Promise.all(paths.map(measureFile));
      }),
    )
  )
    .flat()
    .sort((a, b) => b.loc - a.loc)
    .slice(0, limit);

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          threshold,
          includeTests,
          files,
        },
        null,
        2,
      ),
    );
    return;
  }

  const header = [
    pad("LOC", 6),
    pad("Size", 8),
    pad("Category", 18),
    "Path",
    "Flag",
    "Hint",
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const file of files) {
    const line = [
      pad(String(file.loc), 6),
      pad(formatSize(file.sizeBytes), 8),
      pad(file.category, 18),
      file.path,
      file.flagged ? "⚠️" : "  ",
      file.flagged ? file.hint : "",
    ].join("  ");
    console.log(line);
  }
}

function pad(value, width) {
  const str = value.length > width ? value.slice(0, width) : value;
  return str.padEnd(width, " ");
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

main().catch((error) => {
  console.error("Failed to generate structure report:", error);
  process.exit(1);
});
