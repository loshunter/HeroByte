// ============================================================================
// SERVER PATHS TESTS
// ============================================================================
// Regression: default store paths were CWD-relative, so launching the server
// from the repo root vs apps/server forked herobyte-state.json and
// herobyte-assets/ into divergent copies. The resolver must anchor to the
// package root regardless of process.cwd().

import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveServerPath } from "../serverPaths.js";

describe("resolveServerPath", () => {
  it("anchors relative store paths to the vtt-server package root", () => {
    const resolved = resolveServerPath("herobyte-assets");
    expect(path.isAbsolute(resolved)).toBe(true);
    // The package root is the directory that holds src/ — not the repo root,
    // not the launch directory.
    expect(path.basename(path.dirname(resolved))).toBe("server");
    expect(path.basename(resolved)).toBe("herobyte-assets");
  });

  it("is independent of the current working directory", () => {
    const fromHere = resolveServerPath("herobyte-state.json");
    const cwd = process.cwd();
    try {
      process.chdir(path.parse(cwd).root);
      expect(resolveServerPath("herobyte-state.json")).toBe(fromHere);
    } finally {
      process.chdir(cwd);
    }
  });

  it("passes absolute paths through untouched", () => {
    const absolute = path.resolve("/somewhere/else/store");
    expect(resolveServerPath(absolute)).toBe(absolute);
  });
});
