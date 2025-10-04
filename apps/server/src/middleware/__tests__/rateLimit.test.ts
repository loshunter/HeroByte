import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../rateLimit.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("allows messages under the configured limit", () => {
    const limiter = new RateLimiter({ maxMessages: 3, windowMs: 1000 });
    expect(limiter.check("client-1")).toBe(true);
    expect(limiter.check("client-1")).toBe(true);
    expect(limiter.check("client-1")).toBe(true);
  });

  it("blocks clients that exceed the limit within the window", () => {
    const limiter = new RateLimiter({ maxMessages: 2, windowMs: 1000 });
    expect(limiter.check("spam")).toBe(true);
    expect(limiter.check("spam")).toBe(true);
    expect(limiter.check("spam")).toBe(false);
  });

  it("refills tokens after the window elapses", () => {
    const limiter = new RateLimiter({ maxMessages: 2, windowMs: 1000 });
    expect(limiter.check("client")).toBe(true);
    expect(limiter.check("client")).toBe(true);
    expect(limiter.check("client")).toBe(false);

    vi.advanceTimersByTime(1000);
    vi.setSystemTime(1500);

    expect(limiter.check("client")).toBe(true);
  });

  it("reports status and supports manual reset", () => {
    const limiter = new RateLimiter({ maxMessages: 3, windowMs: 1000 });

    limiter.check("status");
    const status = limiter.getStatus("status");
    expect(status).toBeTruthy();
    expect(status?.count).toBe(1);
    expect(status?.remaining).toBe(2);

    limiter.reset("status");
    expect(limiter.getStatus("status")).toBeNull();
  });
});
