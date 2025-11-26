import { describe, it, expect, vi, afterEach } from "vitest";
import { BroadcastMetricsLogger } from "../BroadcastMetricsLogger.js";

describe("BroadcastMetricsLogger", () => {
  const originalLog = console.log;

  afterEach(() => {
    console.log = originalLog;
  });

  it("emits structured JSON payloads with telemetry fields", () => {
    const logger = new BroadcastMetricsLogger();
    const logSpy = vi.fn();
    console.log = logSpy;

    logger.log({
      clientCount: 3,
      snapshotBytes: 4096,
      durationMs: 12.3456,
      reason: "token-move",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const raw = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({
      event: "room-broadcast",
      clientCount: 3,
      snapshotBytes: 4096,
      reason: "token-move",
    });
    expect(parsed.durationMs).toBeCloseTo(12.35, 2);
    expect(typeof parsed.timestamp).toBe("string");
    expect(parsed.timestamp).toContain("T");
  });
});
