/**
 * The barrel must not declare runtime constants directly.
 *
 * Why this exists, in full, because the failure is invisible to every other
 * gate in this repo:
 *
 * The server's tsconfig maps `@herobyte/shared` to `dist/index.d.ts`, and tsx
 * honors that mapping at runtime. A direct `export const` in index.ts compiles
 * to `export declare const` in the barrel's .d.ts, which is erased as an
 * ambient type — so the value is not there to import. A value RE-EXPORT from a
 * real sub-module (`export { X } from "./x.js"`) is followed through to the
 * compiled .js instead, and works.
 *
 * S8 hit this with NPC_CREATE_LIMITS. The symptom was total: `pnpm dev` could
 * not boot, dying with `does not provide an export named NPC_CREATE_LIMITS` —
 * while the shared suite, the server suite, the client suite AND the whole e2e
 * suite stayed green, because each of those resolves the package by a route
 * that does not go through that mapping. Nothing in the verification gate can
 * see it. Hence a source-text rule.
 *
 * wsCloseCodes.ts documented the same hazard in prose after hitting it first.
 * Prose did not stop it happening again; this test is meant to.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

const BARREL = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.ts");

describe("shared barrel", () => {
  it("declares no top-level runtime const — sub-module + re-export instead", () => {
    const source = readFileSync(BARREL, "utf8");

    // Top-level only: an `export const` nested inside a block is not a barrel
    // declaration. Column 0 is the whole signal.
    const offenders = source
      .split("\n")
      .map((line, i) => ({ line, number: i + 1 }))
      .filter(({ line }) => /^export (const|let|var|function|class) /.test(line))
      .map(({ line, number }) => `${number}: ${line.trim().slice(0, 60)}`);

    expect(
      offenders,
      "Move these into their own module and re-export the VALUE from index.ts " +
        '(`export { X } from "./x.js"`). A direct `export const` here is erased ' +
        "from dist/index.d.ts and the server cannot import it at runtime — see " +
        "npcLimits.ts and wsCloseCodes.ts.",
    ).toEqual([]);
  });
});
