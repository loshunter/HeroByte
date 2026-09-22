// ============================================================================
// FRESH SESSION — forgets the identity, keeps the table, reloads
// ============================================================================
// The one path out of "Held in another window" for a browser that lost its
// session key. It must forget the uid and the ABANDONED identities' session
// tokens (a fresh identity carrying the old one's keys would prove the old
// session and take the seat back — the takeover war in a new coat) while
// leaving other uids' tokens alone (a second tab pinned to another
// `?sessionUid=` in this browser keeps its proof), leave the per-tab table
// password untouched (it lives in sessionStorage, which this never touches),
// strip a `?sessionUid=` override (the reload would otherwise keep the same
// uid), and leave via a full load — a reload when the URL is unchanged, since
// `location.replace` to the same URL with a fragment would only scroll.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { startFreshSession, FRESH_SESSION_CONFIRM } from "../freshSession";
import {
  SESSION_TOKEN_STORAGE_KEY,
  clearSessionTokens,
  readRoomSecret,
  stashRoomSecret,
} from "../../rooms/roomDirectory";
import { getSessionUID } from "../../../utils/session";

/** A Storage-shaped fake (length/key/getItem/setItem/removeItem), like the room tests use. */
function fakeStorage(name: "localStorage" | "sessionStorage", seed: Record<string, string>) {
  const store: Record<string, string> = { ...seed };
  const storage = {
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
  Object.defineProperty(globalThis, name, { value: storage, writable: true, configurable: true });
  return { keys: () => Object.keys(store).sort(), get: (key: string) => store[key] ?? null };
}

describe("startFreshSession", () => {
  let local: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    local = fakeStorage("localStorage", {
      "herobyte-session-uid": "old-uid",
      [`${SESSION_TOKEN_STORAGE_KEY}:old-uid`]: "tok-old",
      [`${SESSION_TOKEN_STORAGE_KEY}:old-uid:*`]: "tok-old",
      [`${SESSION_TOKEN_STORAGE_KEY}:castle-3f9:old-uid`]: "tok-castle",
      [`${SESSION_TOKEN_STORAGE_KEY}:other-uid`]: "tok-other",
      [`${SESSION_TOKEN_STORAGE_KEY}:castle-3f9:other-uid`]: "tok-other-castle",
      "herobyte-rooms": "[]",
    });
    fakeStorage("sessionStorage", {});
    stashRoomSecret("Fun1", "castle-3f9");
  });

  it("forgets the uid and its tokens, keeps other uids' tokens and the table password, reloads without the override", () => {
    const navigate = vi.fn();

    startFreshSession({
      href: "https://herobyte.pages.dev/table?sessionUid=old-uid&room=castle-3f9#map",
      navigate,
    });

    expect(local.keys()).toEqual([
      "herobyte-rooms",
      `${SESSION_TOKEN_STORAGE_KEY}:castle-3f9:other-uid`,
      `${SESSION_TOKEN_STORAGE_KEY}:other-uid`,
    ]);
    expect(readRoomSecret("castle-3f9")).toBe("Fun1");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("https://herobyte.pages.dev/table?room=castle-3f9#map");
  });

  it("forgets the override's identity too when the URL pins a different uid than the store holds", () => {
    // A dev/eval tab pinned to `?sessionUid=pinned` while localStorage still
    // holds the browser's own uid: both are being abandoned.
    Object.defineProperty(window, "location", {
      value: new URL("https://herobyte.pages.dev/?sessionUid=pinned"),
      writable: true,
      configurable: true,
    });
    fakeStorage("localStorage", {
      "herobyte-session-uid": "old-uid",
      [`${SESSION_TOKEN_STORAGE_KEY}:pinned`]: "tok-pinned",
      [`${SESSION_TOKEN_STORAGE_KEY}:old-uid`]: "tok-old",
      [`${SESSION_TOKEN_STORAGE_KEY}:bystander`]: "tok-bystander",
    });
    const navigate = vi.fn();

    startFreshSession({ href: "https://herobyte.pages.dev/?sessionUid=pinned", navigate });

    expect(localStorage.getItem("herobyte-session-uid")).toBeNull();
    expect(localStorage.getItem(`${SESSION_TOKEN_STORAGE_KEY}:pinned`)).toBeNull();
    expect(localStorage.getItem(`${SESSION_TOKEN_STORAGE_KEY}:old-uid`)).toBeNull();
    expect(localStorage.getItem(`${SESSION_TOKEN_STORAGE_KEY}:bystander`)).toBe("tok-bystander");
    expect(navigate).toHaveBeenCalledWith("https://herobyte.pages.dev/");
  });

  it("boots as a different player afterwards — the next uid is freshly generated", () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://herobyte.pages.dev/"),
      writable: true,
      configurable: true,
    });
    startFreshSession({ href: "https://herobyte.pages.dev/", navigate: vi.fn() });

    const next = getSessionUID();
    expect(next).not.toBe("old-uid");
    expect(next.length).toBeGreaterThan(0);
    expect(local.get("herobyte-session-uid")).toBe(next);
  });

  it("reloads rather than replaces when the URL would not change — a fragment must not turn it into a scroll", () => {
    const reload = vi.fn();
    const replace = vi.fn();
    Object.defineProperty(window, "location", {
      value: { href: "https://herobyte.pages.dev/?room=castle-3f9#map", reload, replace },
      writable: true,
      configurable: true,
    });

    startFreshSession();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("still leaves when storage throws mid-wipe — a button that does nothing is the worse outcome", () => {
    const navigate = vi.fn();
    localStorage.removeItem = () => {
      throw new Error("SecurityError: storage is not available");
    };

    expect(() => startFreshSession({ href: "https://herobyte.pages.dev/", navigate })).toThrow();

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("names the cost the user is agreeing to", () => {
    expect(FRESH_SESSION_CONFIRM).toMatch(/cannot be undone/);
    expect(FRESH_SESSION_CONFIRM).toMatch(/current character/);
    expect(FRESH_SESSION_CONFIRM).toMatch(/until the DM deletes them/);
    expect(FRESH_SESSION_CONFIRM).toMatch(/Main Hall also clears itself/);
    expect(FRESH_SESSION_CONFIRM).toMatch(/DM powers on this browser are gone/);
    expect(FRESH_SESSION_CONFIRM).toMatch(/table password again/);
  });
});

describe("clearSessionTokens", () => {
  it("removes the given uids' keys in all three shapes and nothing else", () => {
    const local = fakeStorage("localStorage", {
      [`${SESSION_TOKEN_STORAGE_KEY}:a`]: "1",
      [`${SESSION_TOKEN_STORAGE_KEY}:a:*`]: "2",
      [`${SESSION_TOKEN_STORAGE_KEY}:castle-3f9:a`]: "3",
      [`${SESSION_TOKEN_STORAGE_KEY}:xa`]: "not a — a different uid that merely ends in a",
      [`${SESSION_TOKEN_STORAGE_KEY}:b`]: "4",
      "herobyte-session-uid": "a",
      "herobyte-room-secret:x": "s",
    });

    clearSessionTokens(["a"]);

    expect(local.keys()).toEqual([
      "herobyte-room-secret:x",
      `${SESSION_TOKEN_STORAGE_KEY}:b`,
      `${SESSION_TOKEN_STORAGE_KEY}:xa`,
      "herobyte-session-uid",
    ]);
  });
});
