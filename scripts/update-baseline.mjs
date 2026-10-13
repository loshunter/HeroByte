#!/usr/bin/env node
/**
 * update-baseline.mjs
 * ---------------------------------------------------------------------------
 * Lowers the structure baseline's ceilings after a split. The baseline lists
 * the files allowed at or over the 350-line threshold, each with a CEILING:
 * the guard (structure-report.mjs --fail-on-new) fails a listed file that
 * grows past it, and any unlisted file over the threshold.
 *
 * This is a ratchet. For every listed file it records the smaller of its
 * ceiling and its size now, and it drops files that were deleted or fell
 * under the threshold. It never raises a ceiling and never adds a file: a
 * file that must stay over the threshold is a decision to write into the
 * JSON by hand, in its own commit, with the reason in the message.
 *
 * Usage:
 *   pnpm baseline:update
 *
 * Sizes come from structure-report.mjs itself, so the two never disagree on
 * which files count or how lines are counted.
 */

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const threshold = 350;
const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, "scripts", "structure-baseline.json");

async function main() {
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts", "structure-report.mjs"),
        "--threshold",
        String(threshold),
        "--limit",
        "1000000",
        "--json",
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    ),
  );
  const sizes = new Map(report.files.map((file) => [file.path, file.loc]));
  const previous = JSON.parse(await readFile(baselinePath, "utf8"));

  const files = [];
  const lowered = [];
  const dropped = [];
  for (const entry of previous.files ?? []) {
    if (entry.loc < threshold) continue;
    const loc = sizes.get(entry.path);
    if (loc === undefined || loc < threshold) {
      dropped.push(`${entry.path} (${loc === undefined ? "gone" : `${loc} LOC`})`);
      continue;
    }
    const ceiling = Math.min(loc, entry.loc);
    if (ceiling < entry.loc) lowered.push(`${entry.path}: ${entry.loc} -> ${ceiling}`);
    files.push({ path: entry.path, loc: ceiling });
  }
  files.sort((a, b) => b.loc - a.loc || a.path.localeCompare(b.path));

  const baseline = { generatedAt: new Date().toISOString(), threshold, files };
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + "\n", "utf8");

  console.log(`Baseline: ${files.length} file(s) over ${threshold} LOC, each held to its ceiling.`);
  for (const line of lowered) console.log(`  lowered  ${line}`);
  for (const line of dropped) console.log(`  dropped  ${line}`);
  if (lowered.length === 0 && dropped.length === 0) console.log("  nothing changed");
}

main().catch((error) => {
  console.error("Error updating baseline:", error);
  process.exit(1);
});
