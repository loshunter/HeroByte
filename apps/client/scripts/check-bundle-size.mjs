#!/usr/bin/env node
/**
 * Bundle Size Guardian
 *
 * Enforces maximum bundle size for the initial entry point to prevent
 * performance regressions. Fails CI if the gzipped entry bundle exceeds
 * the configured threshold.
 *
 * Rationale:
 * - Initial load budget: 175 KB gzipped (allows ~65% growth from current 106 KB)
 * - Protects lazy-loading wins (MapBoard, voice chat deferred)
 * - Catches accidental eager imports of heavy dependencies
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 *
 * Exit codes:
 *   0 - Bundle size within threshold
 *   1 - Bundle size exceeds threshold (fails CI)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzip } from "zlib";
import { promisify } from "util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gzipAsync = promisify(gzip);

// Configuration
const MAX_ENTRY_GZIP_KB = 175; // Threshold in KB (gzipped)
const DIST_DIR = path.resolve(__dirname, "../dist/assets");

/**
 * Get gzipped size of a file in KB
 */
async function getGzipSizeKB(filePath) {
  const content = await fs.promises.readFile(filePath);
  const compressed = await gzipAsync(content);
  return compressed.length / 1024;
}

/**
 * Find the main entry point JS file (not vendor chunks)
 * Pattern: index-{hash}.js (not vendor-* or MapBoard-*)
 */
function findEntryFile(distDir) {
  const files = fs.readdirSync(distDir);
  const entryFile = files.find(
    (file) => file.startsWith("index-") && file.endsWith(".js") && !file.includes("vendor")
  );

  if (!entryFile) {
    throw new Error(`Entry file not found in ${distDir}`);
  }

  return path.join(distDir, entryFile);
}

/**
 * Main execution
 */
async function main() {
  console.log("🔍 Checking bundle size...\n");

  try {
    // Find entry file
    const entryFilePath = findEntryFile(DIST_DIR);
    const entryFileName = path.basename(entryFilePath);

    // Calculate gzipped size
    const gzipSizeKB = await getGzipSizeKB(entryFilePath);
    const gzipSizeMB = (gzipSizeKB / 1024).toFixed(2);

    // Display results
    console.log(`📦 Entry bundle: ${entryFileName}`);
    console.log(`📊 Gzipped size: ${gzipSizeKB.toFixed(2)} KB (${gzipSizeMB} MB)`);
    console.log(`🎯 Threshold: ${MAX_ENTRY_GZIP_KB} KB\n`);

    // Check threshold
    if (gzipSizeKB > MAX_ENTRY_GZIP_KB) {
      const overage = (gzipSizeKB - MAX_ENTRY_GZIP_KB).toFixed(2);
      const percentage = ((gzipSizeKB / MAX_ENTRY_GZIP_KB - 1) * 100).toFixed(1);

      console.error(`❌ BUNDLE SIZE EXCEEDED!`);
      console.error(`   Entry bundle is ${overage} KB over budget (+${percentage}%)`);
      console.error(`\n💡 To fix this:`);
      console.error(`   1. Check for accidental eager imports (use dynamic import())`);
      console.error(`   2. Review large dependencies added to entry chunk`);
      console.error(`   3. Consider lazy-loading heavy features`);
      console.error(`   4. Run 'pnpm --filter herobyte-client build:analyze' to inspect\n`);

      process.exit(1);
    }

    // Success
    const remaining = (MAX_ENTRY_GZIP_KB - gzipSizeKB).toFixed(2);
    const utilizationPct = ((gzipSizeKB / MAX_ENTRY_GZIP_KB) * 100).toFixed(1);

    console.log(`✅ Bundle size OK!`);
    console.log(`   ${remaining} KB remaining (${utilizationPct}% of budget used)\n`);

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
