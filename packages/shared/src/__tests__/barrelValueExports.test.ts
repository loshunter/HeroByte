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

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(SRC, "..");
const BARREL = path.join(SRC, "index.ts");
const DIST = path.join(PKG, "dist");
const BUILT_BARREL = path.join(DIST, "index.d.ts");

describe("shared barrel", () => {
  it("declares no top-level runtime value — sub-module + re-export instead", () => {
    const source = readFileSync(BARREL, "utf8");

    // Top-level only: an `export const` nested inside a block is not a barrel
    // declaration. Column 0 is the whole signal.
    //
    // The optional prefixes matter. `export async function`, `export enum` and
    // `export abstract class` are all runtime values and all emit the same
    // `export declare` erasure, but a bare (const|let|var|function|class)
    // pattern misses every one of them. None of those forms appears in this
    // package today, which is why widening this is hardening rather than a
    // bug fix — but the cost is one alternation.
    const offenders = source
      .split("\n")
      .map((line, i) => ({ line, number: i + 1 }))
      .filter(({ line }) =>
        /^export (declare |default |async |abstract )*(const|let|var|function\*?|class|enum) /.test(
          line,
        ),
      )
      .map(({ line, number }) => `${number}: ${line.trim().slice(0, 60)}`);

    expect(
      offenders,
      "Move these into their own module and re-export the VALUE from index.ts " +
        '(`export { X } from "./x.js"`). A direct `export const` here is erased ' +
        "from dist/index.d.ts and the server cannot import it at runtime — see " +
        "npcLimits.ts and wsCloseCodes.ts.",
    ).toEqual([]);
  });

  // The rule above is a PROXY: it checks one file's syntax. These check the
  // artifact the server's tsconfig actually names — `dist/index.d.ts` — so they
  // also catch causes the source rule cannot see, such as a sub-module dropped
  // from the build or a re-export whose specifier no longer resolves.
  //
  // Worth recording what does NOT work, since both were proposed:
  //   - Asserting against dist/index.JS is green-bad by construction. Under the
  //     S8 bug the barrel really did contain `export const NPC_CREATE_LIMITS`,
  //     so the value was present in the emitted .js. The erasure is in the .d.ts.
  //   - scripts/smoke-server-start.mjs runs the COMPILED server under plain
  //     node, which resolves @herobyte/shared through node_modules to
  //     package.json "main" (dist/index.js). It never consults the tsconfig
  //     path mapping, so it cannot see this bug class either. (It is still worth
  //     wiring up one day, for boot failures generally — just not for this.)
  describe("the built declaration file", () => {
    it("exists — run `pnpm build` before this suite", () => {
      // Deliberately NOT it.skip: a skipped test here is precisely the vacuous
      // pass this whole file exists to prevent. The repo gate builds first.
      expect(
        existsSync(BUILT_BARREL),
        `${BUILT_BARREL} is missing. Run \`pnpm build\` first — the server resolves ` +
          "@herobyte/shared to this file at runtime, so it is the artifact under test.",
      ).toBe(true);
    });

    it("erases no top-level export", () => {
      const built = readFileSync(BUILT_BARREL, "utf8");

      // One pattern for every erased form. In a .d.ts a runtime value that was
      // declared IN the barrel becomes `export declare …`; a re-export from a
      // real sub-module keeps its `from` specifier and survives.
      const erased = built
        .split("\n")
        .map((line, i) => ({ line, number: i + 1 }))
        .filter(({ line }) => /^export (declare|default)\b/.test(line))
        .map(({ line, number }) => `${number}: ${line.trim().slice(0, 70)}`);

      expect(
        erased,
        "These are ambient declarations with no runtime value behind them. The " +
          "server imports this package through dist/index.d.ts under tsx, so it " +
          "would fail to boot with `does not provide an export named …` while " +
          "every suite here stayed green.",
      ).toEqual([]);
    });

    it("re-exports only from sub-modules that were actually built", () => {
      const built = readFileSync(BUILT_BARREL, "utf8");

      // This is the failure the source rule structurally cannot reach: the
      // barrel line is correct, but ./x.js is not in dist.
      const missing = [...built.matchAll(/from "\.\/([^"]+)\.js"/g)]
        .map((match) => match[1])
        .filter((module, i, all) => all.indexOf(module) === i)
        .filter((module) => !existsSync(path.join(DIST, `${module}.js`)));

      expect(
        missing,
        "dist/index.d.ts re-exports from these, but the compiled .js is not in " +
          "dist. The server would resolve the specifier and find nothing.",
      ).toEqual([]);
    });
  });
});
