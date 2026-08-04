// ============================================================================
// SERVER PATHS TESTS
// ============================================================================
// Regression: default store paths were CWD-relative, so launching the server
// from the repo root vs apps/server forked herobyte-state.json and
// herobyte-assets/ into divergent copies. The resolver must anchor to the
// package root regardless of process.cwd().

import { afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { assertDataDirUsable, resolveServerPath } from "../serverPaths.js";

describe("resolveServerPath", () => {
  afterEach(() => {
    delete process.env.HEROBYTE_DATA_DIR;
  });
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

  // HEROBYTE_DATA_DIR is the persistent-disk lever: one env var re-anchors
  // every store default (state files, assets, maps, room secret) onto the
  // mount, instead of each store needing its own override.
  it("anchors relative store paths to HEROBYTE_DATA_DIR when set", () => {
    const dataDir = path.resolve("/mnt/herobyte-data");
    process.env.HEROBYTE_DATA_DIR = dataDir;
    expect(resolveServerPath("herobyte-state.json")).toBe(
      path.join(dataDir, "herobyte-state.json"),
    );
    expect(resolveServerPath("herobyte-assets")).toBe(path.join(dataDir, "herobyte-assets"));
  });

  it("still passes absolute paths through when HEROBYTE_DATA_DIR is set", () => {
    process.env.HEROBYTE_DATA_DIR = path.resolve("/mnt/herobyte-data");
    const absolute = path.resolve("/somewhere/else/store");
    expect(resolveServerPath(absolute)).toBe(absolute);
  });

  it("anchors a RELATIVE HEROBYTE_DATA_DIR to the package root, not the CWD", () => {
    process.env.HEROBYTE_DATA_DIR = "data";
    const resolved = resolveServerPath("herobyte-maps.json");
    const cwd = process.cwd();
    try {
      process.chdir(path.parse(cwd).root);
      expect(resolveServerPath("herobyte-maps.json")).toBe(resolved);
    } finally {
      process.chdir(cwd);
    }
    expect(path.basename(path.dirname(resolved))).toBe("data");
  });

  it("ignores a blank HEROBYTE_DATA_DIR", () => {
    process.env.HEROBYTE_DATA_DIR = "   ";
    expect(path.basename(path.dirname(resolveServerPath("herobyte-state.json")))).toBe("server");
  });
});

// D3: HEROBYTE_DATA_DIR used to fail silently — a typo'd path or an unmounted
// disk meant every store quietly landed on ephemeral storage while the
// operator believed state was durable.
describe("assertDataDirUsable", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses to start when HEROBYTE_DATA_DIR points at a missing directory", () => {
    vi.stubEnv("HEROBYTE_DATA_DIR", path.resolve("/herobyte-definitely-not-mounted"));
    expect(() => assertDataDirUsable()).toThrow(/does not exist/);
  });

  it("refuses to start in production when HEROBYTE_DATA_DIR is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HEROBYTE_DATA_DIR", "");
    expect(() => assertDataDirUsable()).toThrow(/HEROBYTE_DATA_DIR is not set in production/);
  });

  it("treats the platform-set RENDER variable as production even if the NODE_ENV checkbox was missed", () => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("HEROBYTE_DATA_DIR", "");
    expect(() => assertDataDirUsable()).toThrow(/HEROBYTE_DATA_DIR is not set in production/);
  });

  it("allows a diskless production deploy only with the explicit opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HEROBYTE_DATA_DIR", "");
    vi.stubEnv("HEROBYTE_ALLOW_EPHEMERAL_DATA", "true");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() => assertDataDirUsable()).not.toThrow();
    logSpy.mockRestore();
  });

  it("logs the resolved data dir and passes outside production", () => {
    vi.stubEnv("NODE_ENV", "");
    vi.stubEnv("RENDER", "");
    vi.stubEnv("HEROBYTE_DATA_DIR", "");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() => assertDataDirUsable()).not.toThrow();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[Storage] Data dir:"));
    logSpy.mockRestore();
  });

  it("accepts a configured data dir that exists, and logs it", () => {
    // The package root itself always exists — a valid stand-in for a mounted disk.
    const existing = path.dirname(resolveServerPath("herobyte-state.json"));
    vi.stubEnv("HEROBYTE_DATA_DIR", existing);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() => assertDataDirUsable()).not.toThrow();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(existing));
    logSpy.mockRestore();
  });
});
