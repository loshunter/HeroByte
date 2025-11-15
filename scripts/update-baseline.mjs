#!/usr/bin/env node
/**
 * update-baseline.mjs
 * ---------------------------------------------------------------------------
 * Updates the structure baseline after successful refactoring.
 * This allows the --fail-on-new check to track new violations while
 * allowing existing (documented) violations to remain temporarily.
 *
 * Usage:
 *   node scripts/update-baseline.mjs
 *   pnpm baseline:update
 *
 * WARNING: Only update baseline after completing a refactoring!
 * Do not update baseline to bypass structural checks!
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
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

const threshold = 350;
const includeTests = true; // Include ALL files in baseline to properly track new violations

const repoRoot = process.cwd();
const scanRoots = [path.join(repoRoot, "apps"), path.join(repoRoot, "packages")];
const baselinePath = path.join(repoRoot, "scripts", "structure-baseline.json");

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
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

      // Optionally exclude test files
      if (!includeTests && /\.test\.|\.spec\./.test(entry.name)) {
        continue;
      }

      results.push(entryPath);
    }
  }

  return results;
}

function categorizeFile(filePath) {
  if (filePath.includes("/server/")) {
    if (filePath.includes("/domains/")) return "server:domains";
    if (filePath.includes("/ws/")) return "server:websocket";
    if (filePath.includes("/middleware/")) return "server:middleware";
    return "server:other";
  }
  if (filePath.includes("/client/")) {
    if (filePath.includes("/ui/")) return "client:ui";
    if (filePath.includes("/features/map/")) return "client:map";
    if (filePath.includes("/features/dm/")) return "client:dm";
    if (filePath.includes("/features/players/")) return "client:players";
    if (filePath.includes("/features/dice/")) return "client:dice";
    if (filePath.includes("/hooks/")) return "client:hooks";
    if (filePath.includes("/services/")) return "client:services";
    return "client:misc";
  }
  if (filePath.includes("/shared/")) return "shared";
  if (filePath.includes("/e2e/")) return "e2e";
  return "other";
}

function generateHint(category, loc) {
  if (category.startsWith("server:domains")) {
    return "Split domain orchestration vs persistence vs validation. Follow DDD boundaries.";
  }
  if (category === "server:websocket") {
    return "Modularize handlers per message type & connection lifecycle. Extract auth, heartbeat, and message routing.";
  }
  if (category === "server:middleware") {
    return "Break validators into schema-specific modules (transformValidation.ts, drawingValidation.ts, etc.).";
  }
  if (category === "client:ui") {
    if (loc > 700) {
      return "See docs/refactoring/REFACTOR_ROADMAP.md - start with Phase 1 (quick wins)";
    }
    return "Extract hooks first, then split into smaller components.";
  }
  if (category === "client:map") {
    return "Separate camera, selection, and tool orchestration. Extract hooks first, then components.";
  }
  if (category === "client:hooks") {
    return "Divide hook responsibilities per tool/state segment. Each hook should have ONE purpose (SRP).";
  }
  if (category === "shared") {
    return "Partition shared models into domain-specific slices (scene.ts, player.ts, token.ts, drawing.ts).";
  }
  return "Evaluate SRP boundaries and extract focused modules. See REFACTOR_PLAYBOOK.md.";
}

async function main() {
  console.log("📊 Scanning codebase...\n");

  const allFiles = [];
  for (const root of scanRoots) {
    allFiles.push(...(await walk(root)));
  }

  const fileInfos = [];
  for (const filePath of allFiles) {
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    const loc = lines.length;
    const stats = await stat(filePath);
    const sizeBytes = stats.size;

    const relativePath = path.relative(repoRoot, filePath);
    const category = categorizeFile(relativePath);
    const flagged = loc > threshold;
    const hint = flagged ? generateHint(category, loc) : "";
    const roadmapRef = "";

    fileInfos.push({
      path: relativePath,
      loc,
      category,
      flagged,
      hint,
      roadmapRef,
      sizeBytes,
    });
  }

  // Sort by LOC descending
  fileInfos.sort((a, b) => b.loc - a.loc);

  const baseline = {
    generatedAt: new Date().toISOString(),
    threshold,
    includeTests,
    files: fileInfos,
  };

  await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + "\n", "utf8");

  console.log(`✅ Baseline updated: ${baselinePath}`);
  console.log(`\n📈 Statistics:`);
  console.log(`   Total files scanned: ${fileInfos.length}`);
  console.log(`   Files flagged (>${threshold} LOC): ${fileInfos.filter(f => f.flagged).length}`);
  console.log(`   Largest file: ${fileInfos[0].path} (${fileInfos[0].loc} LOC)`);
  console.log(`\n⚠️  Remember: Only update baseline after successful refactoring!`);
  console.log(`   Do not update to bypass structural checks.\n`);
}

main().catch((error) => {
  console.error("Error updating baseline:", error);
  process.exit(1);
});
