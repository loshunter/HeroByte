import "@testing-library/jest-dom";
import { vi } from "vitest";

if (typeof globalThis.alert !== "function") {
  // eslint-disable-next-line no-alert
  globalThis.alert = vi.fn();
}

if (typeof globalThis.confirm !== "function") {
  globalThis.confirm = vi.fn(() => false);
}

// Mock ResizeObserver for components that use element size tracking
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/**
 * Flushes all pending timers and microtasks.
 *
 * Use this instead of `await new Promise(setTimeout, ms)` in tests.
 * Requires vi.useFakeTimers() to be called in the test.
 *
 * @example
 * ```ts
 * vi.useFakeTimers();
 * // ... perform action that schedules timers
 * await flushTimers();
 * // ... assert on results
 * vi.useRealTimers();
 * ```
 */
export async function flushTimers(): Promise<void> {
  await vi.runAllTimersAsync();
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Advances fake timers by a specific amount and flushes microtasks.
 *
 * Use this when you need to test time-dependent behavior with fake timers.
 *
 * @param ms - Milliseconds to advance
 * @example
 * ```ts
 * vi.useFakeTimers();
 * // ... perform action
 * await advanceTimers(100);
 * // ... assert on state after 100ms
 * vi.useRealTimers();
 * ```
 */
export async function advanceTimers(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await new Promise((resolve) => setImmediate(resolve));
}
