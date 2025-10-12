import "@testing-library/jest-dom";
import { vi } from "vitest";

if (typeof globalThis.alert !== "function") {
  // eslint-disable-next-line no-alert
  globalThis.alert = vi.fn();
}

if (typeof globalThis.confirm !== "function") {
  globalThis.confirm = vi.fn(() => false);
}
