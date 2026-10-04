import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryStorage } from "../../../test-utils/memoryStorage";
import {
  clearNewTable,
  markNewTable,
  markSeatClaimed,
  readNewTable,
  seatClaimed,
} from "../newTableMarker";

beforeEach(() => installMemoryStorage());
afterEach(() => sessionStorage.clear());

describe("newTableMarker — this tab just made this table", () => {
  it("is set for the table it names and for no other", () => {
    markNewTable("table-abc123");
    expect(readNewTable("table-abc123")).toBe(true);
    expect(readNewTable("table-other")).toBe(false);
  });

  it("goes when the host dismisses the steps", () => {
    markNewTable("table-abc123");
    clearNewTable("table-abc123");
    expect(readNewTable("table-abc123")).toBe(false);
  });

  it("remembers that the host has held the DM seat — and the steps stay up until dismissed", () => {
    markNewTable("table-abc123");
    expect(seatClaimed("table-abc123")).toBe(false);
    markSeatClaimed("table-abc123");
    expect(seatClaimed("table-abc123")).toBe(true);
    expect(readNewTable("table-abc123")).toBe(true);
    clearNewTable("table-abc123");
    expect(seatClaimed("table-abc123")).toBe(false);
    expect(readNewTable("table-abc123")).toBe(false);
  });

  it("claims nothing in a tab that did not make the table, or for no table", () => {
    markSeatClaimed("table-abc123");
    expect(seatClaimed("table-abc123")).toBe(false);
    expect(readNewTable("table-abc123")).toBe(false);
    markSeatClaimed(undefined);
    expect(seatClaimed(undefined)).toBe(false);
  });

  it("never applies to the default table, which has no code to have been created", () => {
    markNewTable("table-abc123");
    expect(readNewTable(undefined)).toBe(false);
    clearNewTable(undefined);
    expect(readNewTable("table-abc123")).toBe(true);
  });

  it("is per tab: it lives in sessionStorage, not localStorage", () => {
    markNewTable("table-abc123");
    const keysOf = (storage: Storage) =>
      Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? "");
    expect(keysOf(localStorage).some((key) => key.includes("next-steps"))).toBe(false);
    expect(keysOf(sessionStorage).some((key) => key.includes("next-steps"))).toBe(true);
  });

  it("degrades to 'not prompted' when storage throws", () => {
    const blocked = vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    try {
      expect(readNewTable("table-abc123")).toBe(false);
    } finally {
      blocked.mockRestore();
    }
  });
});
