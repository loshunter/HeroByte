/**
 * The stashed session token is scoped PER TABLE and PER UID, in localStorage.
 *
 * Per table for the reason the room secret is: a same-tab table switch must
 * not present table A's proof to table B. Per uid because two tabs in one
 * browser can carry different `?sessionUid=` identities (the e2e and the
 * two-client review setups do exactly that), and a flat per-table key would
 * let one tab's login overwrite the other's proof — then the overwritten tab's
 * next reconnect would fail the token check and come back as a non-DM.
 *
 * localStorage, not sessionStorage: sessionStorage is per tab, so a second tab
 * or a browser reopened after a crash would never hold the token and could
 * never reclaim its own session.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SESSION_TOKEN_STORAGE_KEY, stashSessionToken, readSessionToken } from "../roomDirectory";

describe("session token scoping", () => {
  // The client test environment provides sessionStorage but only a partial
  // localStorage, so install a real-enough one (the pattern roomDirectory.test.ts uses).
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
      },
      writable: true,
      configurable: true,
    });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not hand one table's token to another", () => {
    stashSessionToken("tok-dragons", "uid-1", "dragons-den");
    stashSessionToken("tok-keep", "uid-1", "the-keep");

    expect(readSessionToken("uid-1", "dragons-den")).toBe("tok-dragons");
    expect(readSessionToken("uid-1", "the-keep")).toBe("tok-keep");
  });

  it("does not hand one uid's token to another at the same table", () => {
    stashSessionToken("tok-dm", "dm-uid", "the-keep");
    stashSessionToken("tok-player", "player-uid", "the-keep");

    expect(readSessionToken("dm-uid", "the-keep")).toBe("tok-dm");
    expect(readSessionToken("player-uid", "the-keep")).toBe("tok-player");
  });

  it("returns undefined for a table or uid that has no stashed token", () => {
    stashSessionToken("tok-dragons", "uid-1", "dragons-den");

    expect(readSessionToken("uid-1", "never-visited")).toBeUndefined();
    expect(readSessionToken("uid-2", "dragons-den")).toBeUndefined();
  });

  it("keeps the default table on a key without a room segment", () => {
    stashSessionToken("tok-hall", "uid-1", undefined);

    expect(localStorage.getItem(`${SESSION_TOKEN_STORAGE_KEY}:uid-1`)).toBe("tok-hall");
    expect(readSessionToken("uid-1", undefined)).toBe("tok-hall");
  });

  it("lives in localStorage so every tab of this browser can present it", () => {
    stashSessionToken("tok-shared", "uid-1", "the-keep");

    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem(`${SESSION_TOKEN_STORAGE_KEY}:the-keep:uid-1`)).toBe("tok-shared");
  });

  it("a later stash for the same table+uid replaces the earlier token (rotation)", () => {
    stashSessionToken("tok-old", "uid-1", "the-keep");
    stashSessionToken("tok-new", "uid-1", "the-keep");

    expect(readSessionToken("uid-1", "the-keep")).toBe("tok-new");
  });
});
