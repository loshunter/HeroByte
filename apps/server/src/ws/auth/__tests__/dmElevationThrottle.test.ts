import { describe, expect, it } from "vitest";
import { DMElevationThrottle, MAX_DM_FAILURES, DM_LOCKOUT_MS } from "../dmElevationThrottle.js";

describe("DMElevationThrottle", () => {
  it("is unlocked before any failures", () => {
    const throttle = new DMElevationThrottle();
    expect(throttle.isLocked("uid", 1000)).toBe(false);
  });

  it("locks the uid out after a burst of failures, then releases after the cooldown", () => {
    const throttle = new DMElevationThrottle();
    const now = 1000;

    // The first MAX_DM_FAILURES-1 failures don't lock yet.
    for (let i = 0; i < MAX_DM_FAILURES - 1; i += 1) {
      expect(throttle.recordFailure("uid", now)).toBe(false);
      expect(throttle.isLocked("uid", now)).toBe(false);
    }
    // The MAX_DM_FAILURES-th failure trips the cooldown.
    expect(throttle.recordFailure("uid", now)).toBe(true);
    expect(throttle.isLocked("uid", now)).toBe(true);
    expect(throttle.isLocked("uid", now + DM_LOCKOUT_MS - 1)).toBe(true);
    // Once the cooldown elapses, the uid may try again.
    expect(throttle.isLocked("uid", now + DM_LOCKOUT_MS)).toBe(false);
  });

  it("tracks each uid independently", () => {
    const throttle = new DMElevationThrottle();
    for (let i = 0; i < MAX_DM_FAILURES; i += 1) throttle.recordFailure("attacker", 1000);
    expect(throttle.isLocked("attacker", 1000)).toBe(true);
    expect(throttle.isLocked("bystander", 1000)).toBe(false);
  });

  it("clears a uid's failures on a successful elevation", () => {
    const throttle = new DMElevationThrottle();
    for (let i = 0; i < MAX_DM_FAILURES; i += 1) throttle.recordFailure("uid", 1000);
    expect(throttle.isLocked("uid", 1000)).toBe(true);

    throttle.clear("uid");
    expect(throttle.isLocked("uid", 1000)).toBe(false);
    // And the counter reset, so it takes a fresh full burst to lock again.
    for (let i = 0; i < MAX_DM_FAILURES - 1; i += 1) {
      expect(throttle.recordFailure("uid", 1000)).toBe(false);
    }
  });
});
