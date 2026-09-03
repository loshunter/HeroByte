// The retry is for Windows' transient EPERM/EBUSY on a rename whose target is
// momentarily held; everything else must still fail on the first attempt.

import { describe, expect, it, vi } from "vitest";
import { RENAME_RETRY_DELAYS_MS, renameWithRetry } from "../atomicRename.js";

function errno(code: string): NodeJS.ErrnoException {
  const err = new Error(`${code}: simulated`) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

describe("renameWithRetry", () => {
  it("returns on the first success without sleeping", async () => {
    const rename = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await renameWithRetry("a.tmp", "a", { rename, sleep });
    expect(rename).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("rides out transient EPERM/EBUSY with the backoff ladder, then succeeds", async () => {
    const rename = vi
      .fn()
      .mockRejectedValueOnce(errno("EPERM"))
      .mockRejectedValueOnce(errno("EBUSY"))
      .mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await renameWithRetry("a.tmp", "a", { rename, sleep });
    expect(rename).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual(RENAME_RETRY_DELAYS_MS.slice(0, 2));
  });

  it("gives up after the ladder is exhausted, throwing the LAST error", async () => {
    const rename = vi.fn().mockRejectedValue(errno("EPERM"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(renameWithRetry("a.tmp", "a", { rename, sleep })).rejects.toMatchObject({
      code: "EPERM",
    });
    expect(rename).toHaveBeenCalledTimes(RENAME_RETRY_DELAYS_MS.length + 1);
  });

  it("never retries a non-transient failure — a missing directory is real", async () => {
    const rename = vi.fn().mockRejectedValue(errno("ENOENT"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(renameWithRetry("a.tmp", "a", { rename, sleep })).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(rename).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("never retries an error without a code either", async () => {
    const rename = vi.fn().mockRejectedValue(new Error("no code"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(renameWithRetry("a.tmp", "a", { rename, sleep })).rejects.toThrow("no code");
    expect(rename).toHaveBeenCalledTimes(1);
  });
});
