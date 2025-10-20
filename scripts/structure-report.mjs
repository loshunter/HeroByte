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
 *   --fail-on-new         Exit with code 1 if new files exceed threshold (allows existing violations)
 *   --baseline <path>     Path to baseline JSON file for --fail-on-new comparison
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
let failOnNew = false;
let baselinePath = null;

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
  } else if (arg === "--fail-on-new") {
    failOnNew = true;
  } else if (arg === "--baseline") {
    baselinePath = args[i + 1];
    if (!baselinePath) {
      console.error("Missing value for --baseline. Expected a file path.");
      process.exit(1);
    }
    i += 1;
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
  let roadmapRef = "";

  if (flagged) {
    // Specific hints for known god files
    if (relPath === "apps/client/src/ui/App.tsx") {
      hint = "See docs/refactoring/REFACTOR_ROADMAP.md - 27 clusters identified, start with Phase 1 (quick wins: useLayoutMeasurement, useToolMode, etc.)";
      roadmapRef = "App.tsx Phases 1-7";
    } else if (relPath === "apps/client/src/features/dm/components/DMMenu.tsx") {
      hint = "See docs/refactoring/REFACTOR_ROADMAP.md - 20 clusters identified, start with Phase 1 (CollapsibleSection, NPCEditor, PropEditor)";
      roadmapRef = "DMMenu.tsx Phases 1-6";
    } else if (relPath === "apps/client/src/ui/MapBoard.tsx") {
      hint = "See docs/refactoring/REFACTOR_ROADMAP.md - 32 clusters identified, start with Phase 1 (pure utilities: MapBoardTypes, coordinateTransforms)";
      roadmapRef = "MapBoard.tsx Phases 1-7";
    } else {
      // Category-based generic hints
      switch (category) {
        case "client:ui":
          hint = "Consider extracting providers/layout + feature shells. See REFACTOR_PLAYBOOK.md for guidance.";
          break;
        case "client:dm":
          hint = "Split DM menu into feature panels & shared hooks. See REFACTOR_PLAYBOOK.md Pattern 2.";
          break;
        case "client:map":
          hint = "Separate camera, selection, and tool orchestration. Extract hooks first, then components.";
          break;
        case "client:hooks":
          hint = "Divide hook responsibilities per tool/state segment. Each hook should have ONE purpose (SRP).";
          break;
        case "client:features":
          hint = "Extract UI components from business logic. Separate state management into custom hooks.";
          break;
        case "client:components":
          hint = "Break into smaller, focused components. Extract reusable primitives to /components/ui/.";
          break;
        case "client:drawing":
          hint = "Separate tool state from rendering logic. Extract tool-specific hooks and components.";
          break;
        case "server:websocket":
          hint = "Modularize handlers per message type & connection lifecycle. Extract auth, heartbeat, and message routing.";
          break;
        case "server:domains":
          hint = "Split domain orchestration vs persistence vs validation. Follow DDD boundaries.";
          break;
        case "server:middleware":
          hint = "Break validators into schema-specific modules (transformValidation.ts, drawingValidation.ts, etc.).";
          break;
        case "shared":
          hint = "Partition shared models into domain-specific slices (scene.ts, player.ts, token.ts, drawing.ts).";
          break;
        default:
          hint = "Evaluate SRP boundaries and extract focused modules. See REFACTOR_PLAYBOOK.md.";
      }
    }
  }

  const stats = await stat(filePath);

  return {
    path: relPath,
    loc,
    category,
    flagged,
    hint,
    roadmapRef,
    sizeBytes: stats.size,
  };
}

async function main() {
  const allFiles = (
    await Promise.all(
      scanRoots.map(async (root) => {
        const paths = await walk(root);
        return Promise.all(paths.map(measureFile));
      }),
    )
  ).flat();

  const files = allFiles.sort((a, b) => b.loc - a.loc).slice(0, limit);

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

  // Check for new violations if --fail-on-new is specified
  if (failOnNew) {
    const baseline = await loadBaseline(baselinePath);
    const newViolations = findNewViolations(allFiles, baseline, threshold);

    if (newViolations.length > 0) {
      console.error("\n❌ STRUCTURAL GUARDRAIL VIOLATION");
      console.error(
        `Found ${newViolations.length} new file(s) exceeding ${threshold} LOC threshold:\n`,
      );

      for (const violation of newViolations) {
        console.error(
          `  ⚠️  ${violation.path} (${violation.loc} LOC, +${violation.loc - threshold} over threshold)`,
        );
        if (violation.hint) {
          console.error(`      Hint: ${violation.hint}`);
        }
      }

      console.error(
        "\nTo fix this, either refactor the file(s) to be under the threshold,",
      );
      console.error(
        "or update the baseline if this is intentional: pnpm lint:structure --json > scripts/structure-baseline.json\n",
      );
      process.exit(1);
    } else {
      console.log("✅ No new structural violations detected.");
    }
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

  // Summary statistics
  const flaggedCount = allFiles.filter((f) => f.flagged).length;
  const totalFiles = allFiles.length;
  console.log("\n" + "-".repeat(header.length));
  console.log(
    `Total files scanned: ${totalFiles} | Flagged: ${flaggedCount} (${((flaggedCount / totalFiles) * 100).toFixed(1)}%)`,
  );
}

async function loadBaseline(baselinePath) {
  if (!baselinePath) {
    const defaultPath = path.join(repoRoot, "scripts", "structure-baseline.json");
    try {
      const content = await readFile(defaultPath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.warn(
        `⚠️  No baseline file found at ${defaultPath}. Treating all violations as new.`,
      );
      return { files: [] };
    }
  }

  try {
    const content = await readFile(baselinePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load baseline file: ${baselinePath}`);
    console.error(error.message);
    process.exit(1);
  }
}

function findNewViolations(currentFiles, baseline, threshold) {
  const baselineMap = new Map();

  // Build map of baseline violations (files exceeding threshold)
  for (const file of baseline.files || []) {
    if (file.loc >= threshold) {
      baselineMap.set(file.path, file.loc);
    }
  }

  const newViolations = [];

  for (const file of currentFiles) {
    if (file.loc >= threshold) {
      const baselineLoc = baselineMap.get(file.path);

      // This is a new violation if:
      // 1. The file didn't exist in baseline, OR
      // 2. The file existed but was under threshold in baseline
      if (baselineLoc === undefined) {
        newViolations.push(file);
      }
    }
  }

  return newViolations;
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
