#!/usr/bin/env node
// Frozen-test contract gate. Files listed in scripts/frozen-tests.lock.json
// pin compatibility contracts (e.g. the export byte-parity goldens) and must
// never be edited to make a failing suite pass — if a frozen test is red, the
// bug is in the product code. This script fails `pnpm lint` on any hash
// mismatch or deletion, turning that rule from an instruction into a gate.
//
// Deliberately changing a pinned contract is a PROJECT-OWNER decision: edit
// the frozen file, then run `node scripts/check-frozen-tests.mjs --update`.
// Line endings are normalized before hashing so CRLF checkouts don't flap.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = resolve(root, "scripts", "frozen-tests.lock.json");
const update = process.argv.includes("--update");

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const failures = [];

for (const file of Object.keys(lock.files)) {
  const absolute = resolve(root, file);
  if (!existsSync(absolute)) {
    failures.push(`${file}: MISSING — frozen test files may not be deleted or renamed.`);
    continue;
  }
  const content = readFileSync(absolute, "utf8").replace(/\r\n/g, "\n");
  const hash = createHash("sha256").update(content).digest("hex");
  if (update) {
    lock.files[file] = hash;
  } else if (hash !== lock.files[file]) {
    failures.push(`${file}: MODIFIED (hash mismatch).`);
  }
}

if (update) {
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log("🔒 frozen-tests.lock.json updated (owner action).");
  process.exit(0);
}

if (failures.length > 0) {
  console.error("\n❌ FROZEN TEST CONTRACT VIOLATION\n");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`
These files pin compatibility contracts (export byte-parity). Editing them to
make a failing suite pass hides a real bug in the product code.

  → Revert with:  git checkout -- <file>
  → Then find and fix the code change that broke the pinned behavior.

Only the project owner may change a pinned contract, by editing the frozen
file and running:  node scripts/check-frozen-tests.mjs --update
`);
  process.exit(1);
}

console.log(`✅ Frozen test contracts intact (${Object.keys(lock.files).length} file(s)).`);
