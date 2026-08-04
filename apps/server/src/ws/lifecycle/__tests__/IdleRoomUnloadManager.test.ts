// The manager's interval tick IS the production call site for the idle-unload
// sweep, the default-table clear, and the asset reclaim sweep. These tests
// drive the real tick with fake timers — asserting on the container methods a
// tick must invoke — because a test that calls those methods directly would
// pass with the wiring missing.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdleRoomUnloadManager } from "../IdleRoomUnloadManager.js";
import type { Container } from "../../../container.js";

interface ContainerStub {
  unloadIdleRooms: ReturnType<typeof vi.fn>;
  clearIdleDefaultRoom: ReturnType<typeof vi.fn>;
  reclaimUnreferencedAssets: ReturnType<typeof vi.fn>;
}

const TICK = 5 * 60 * 1000;

describe("IdleRoomUnloadManager", () => {
  let container: ContainerStub;
  let manager: IdleRoomUnloadManager;

  beforeEach(() => {
    vi.useFakeTimers();
    container = {
      unloadIdleRooms: vi.fn().mockResolvedValue([]),
      clearIdleDefaultRoom: vi.fn().mockResolvedValue(false),
      reclaimUnreferencedAssets: vi.fn().mockResolvedValue(undefined),
    };
    manager = new IdleRoomUnloadManager(container as unknown as Container, {
      defaultRoomClearMs: 60 * 60 * 1000,
    });
  });

  afterEach(() => {
    manager.stop();
    vi.useRealTimers();
  });

  it("every tick runs the reclaim sweep, the unload sweep, and the default clear", () => {
    manager.start();
    vi.advanceTimersByTime(TICK);

    expect(container.reclaimUnreferencedAssets).toHaveBeenCalledTimes(1);
    expect(container.unloadIdleRooms).toHaveBeenCalledTimes(1);
    expect(container.clearIdleDefaultRoom).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(TICK);
    expect(container.reclaimUnreferencedAssets).toHaveBeenCalledTimes(2);
  });

  it("a rejected reclaim cannot take down the tick or the other sweeps", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    container.reclaimUnreferencedAssets.mockRejectedValue(new Error("boom"));

    manager.start();
    vi.advanceTimersByTime(TICK);
    // Let the rejection propagate to its catch.
    await vi.runOnlyPendingTimersAsync().catch(() => {});
    await Promise.resolve();

    expect(container.unloadIdleRooms).toHaveBeenCalled();
    expect(container.clearIdleDefaultRoom).toHaveBeenCalled();
    errors.mockRestore();
  });

  it("skips the default clear when the window is 0 (operator opt-out), but still reclaims", () => {
    const optOut = new IdleRoomUnloadManager(container as unknown as Container, {
      defaultRoomClearMs: 0,
    });
    optOut.start();
    vi.advanceTimersByTime(TICK);

    expect(container.clearIdleDefaultRoom).not.toHaveBeenCalled();
    expect(container.reclaimUnreferencedAssets).toHaveBeenCalled();
    optOut.stop();
  });

  it("stop() ends the ticking", () => {
    manager.start();
    manager.stop();
    vi.advanceTimersByTime(TICK * 3);

    expect(container.reclaimUnreferencedAssets).not.toHaveBeenCalled();
  });
});
