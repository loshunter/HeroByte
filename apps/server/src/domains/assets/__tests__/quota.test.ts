import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveTotalFromDisk,
  FALLBACK_TOTAL_BYTES,
  parseQuotaEnvMb,
  resolveQuotaLimits,
  roomBytesFromTotal,
} from "../quota.js";
import { AssetService } from "../service.js";

const MB = 1024 * 1024;
const TMP_DIR = path.join(process.cwd(), ".tmp", "asset-quota-test");

function pngBytes(payload: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(payload),
  ]);
}

afterEach(() => {
  vi.restoreAllMocks();
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("deriveTotalFromDisk", () => {
  it("is what the store holds plus what the disk can still take, minus the reserve", () => {
    // A fresh 1GB Render disk: nothing stored, ~1GB available.
    expect(
      deriveTotalFromDisk({ availBytes: 1024 * MB, capacityBytes: 1024 * MB, storeBytes: 0 }),
    ).toBe(768 * MB);
    // The store already holds 300MB of that disk.
    expect(
      deriveTotalFromDisk({ availBytes: 700 * MB, capacityBytes: 1024 * MB, storeBytes: 300 * MB }),
    ).toBe(744 * MB);
  });

  it("caps the reserve at a quarter of a tiny filesystem", () => {
    // 512MB disk: a fixed 256MB reserve would eat half; a quarter (128MB) is taken instead.
    expect(
      deriveTotalFromDisk({ availBytes: 512 * MB, capacityBytes: 512 * MB, storeBytes: 0 }),
    ).toBe(384 * MB);
  });

  it("never goes negative on a full disk", () => {
    expect(deriveTotalFromDisk({ availBytes: 0, capacityBytes: 1024 * MB, storeBytes: 0 })).toBe(0);
  });
});

describe("roomBytesFromTotal", () => {
  it("is a quarter of the total, floored at the old 50MB default", () => {
    expect(roomBytesFromTotal(768 * MB)).toBe(192 * MB);
    expect(roomBytesFromTotal(200 * MB)).toBe(50 * MB); // the fallback reproduces old defaults
    expect(roomBytesFromTotal(100 * MB)).toBe(50 * MB); // floor holds below 200MB
  });

  it("never exceeds the total itself", () => {
    expect(roomBytesFromTotal(20 * MB)).toBe(20 * MB);
  });
});

describe("parseQuotaEnvMb", () => {
  it("accepts positive MB values and floors to bytes", () => {
    expect(parseQuotaEnvMb("X", "500")).toBe(500 * MB);
    expect(parseQuotaEnvMb("X", "0.5")).toBe(Math.floor(0.5 * MB));
  });

  it("rejects garbage with a warning instead of poisoning the quota", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseQuotaEnvMb("X", "banana")).toBeUndefined();
    expect(parseQuotaEnvMb("X", "-5")).toBeUndefined();
    expect(parseQuotaEnvMb("X", "0")).toBeUndefined();
    expect(parseQuotaEnvMb("X", "")).toBeUndefined();
    expect(parseQuotaEnvMb("X", undefined)).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(3); // only the three non-empty garbage values
  });
});

describe("resolveQuotaLimits", () => {
  it("options win over env and disk, silently", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const limits = await resolveQuotaLimits({
      directory: TMP_DIR,
      storeBytes: 0,
      options: { maxTotalBytes: 48, maxRoomBytes: 32 },
      env: { HEROBYTE_ASSET_MAX_TOTAL_MB: "999", HEROBYTE_ASSET_MAX_ROOM_MB: "999" },
    });
    expect(limits).toEqual({ maxTotalBytes: 48, maxRoomBytes: 32 });
    expect(log).not.toHaveBeenCalled();
  });

  it("env wins over the disk, and the room ceiling follows the env total", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const limits = await resolveQuotaLimits({
      directory: TMP_DIR,
      storeBytes: 0,
      options: {},
      env: { HEROBYTE_ASSET_MAX_TOTAL_MB: "400" },
    });
    expect(limits.maxTotalBytes).toBe(400 * MB);
    expect(limits.maxRoomBytes).toBe(100 * MB); // a quarter of the env total
  });

  it("derives from the real disk when nothing is configured", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const limits = await resolveQuotaLimits({
      directory: TMP_DIR,
      storeBytes: 0,
      options: {},
      env: {},
    });
    // This runs on a real machine with an unknown disk; assert shape, not value.
    expect(limits.maxTotalBytes).toBeGreaterThan(0);
    expect(limits.maxRoomBytes).toBeGreaterThan(0);
    expect(limits.maxRoomBytes).toBeLessThanOrEqual(limits.maxTotalBytes);
    // It measured THIS disk, not the fallback: any real dev/CI disk clears 200MB.
    expect(limits.maxTotalBytes).not.toBe(FALLBACK_TOTAL_BYTES);
  });

  it("falls back to the old 200MB/50MB when the disk cannot be measured", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A path that cannot be created: a file component in the middle.
    const limits = await resolveQuotaLimits({
      directory: "\0invalid",
      storeBytes: 0,
      options: {},
      env: {},
    });
    expect(limits.maxTotalBytes).toBe(FALLBACK_TOTAL_BYTES);
    expect(limits.maxRoomBytes).toBe(50 * MB);
    expect(warn).toHaveBeenCalled();
  });
});

describe("AssetService quota integration", () => {
  it("enforces an env-derived ceiling through the real store() path", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Smallest expressible env quota: a fraction of a MB. Two ~30-byte uploads
    // fit; the ceiling is enforced by the SERVICE reading the env, not by an
    // option handed to it.
    vi.stubEnv("HEROBYTE_ASSET_MAX_TOTAL_MB", String(64 / MB));
    vi.stubEnv("HEROBYTE_ASSET_MAX_ROOM_MB", String(48 / MB));
    try {
      const service = new AssetService({ directory: TMP_DIR });
      await service.store(pngBytes("fits-under-the-cap!"), "room-a", 1); // 27 bytes
      await expect(service.store(pngBytes("this-one-tips-it-over"), "room-a", 2)).rejects.toThrow(
        /storage is full|quota/i,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
