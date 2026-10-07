// voiceMemory: whether this tab was in the call, honoured only for a minute after it was
// last true (a reload), per table (?room=), and never from an old or malformed value.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELOAD_WINDOW_MS, forgetVoice, recallVoice, rememberVoice } from "../voiceMemory";

const KEY = "herobyte.voice:default";

function openTable(search: string) {
  window.history.replaceState(null, "", `/${search}`);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  window.sessionStorage.clear();
  openTable("");
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
  openTable("");
});

describe("recallVoice", () => {
  it("nothing remembered: null", () => {
    expect(recallVoice()).toBeNull();
  });

  it("stores the state with the time it was true", () => {
    rememberVoice("muted");
    expect(JSON.parse(window.sessionStorage.getItem(KEY) ?? "null")).toEqual({
      state: "muted",
      at: 1_000_000,
    });
  });

  it("the window is a minute", () => {
    expect(RELOAD_WINDOW_MS).toBe(60_000);
  });

  it.each(["live", "muted"] as const)("%s within the window is recalled", (state) => {
    rememberVoice(state);
    vi.setSystemTime(1_000_000 + 59_999);
    expect(recallVoice()).toBe(state);
  });

  it("exactly 60 000 ms later is still recalled; at 60 001 ms it is not", () => {
    rememberVoice("live");
    vi.setSystemTime(1_000_000 + 60_000);
    expect(recallVoice()).toBe("live");
    vi.setSystemTime(1_000_000 + 60_001);
    expect(recallVoice()).toBeNull();
  });

  it("an old plain-string value (before the time was stored) is not recalled", () => {
    window.sessionStorage.setItem(KEY, "live");
    expect(recallVoice()).toBeNull();
    window.sessionStorage.setItem(KEY, "muted");
    expect(recallVoice()).toBeNull();
  });

  it("garbage JSON is not recalled and does not throw", () => {
    window.sessionStorage.setItem(KEY, "{not json");
    expect(recallVoice()).toBeNull();
  });

  it.each([
    ["an unknown state", { state: "deafened", at: 1_000_000 }],
    ["no time", { state: "live" }],
    ["a time that is not a number", { state: "live", at: "1000000" }],
    ["no state", { at: 1_000_000 }],
    ["a bare number", 5],
    ["null", null],
  ])("a value with %s is not recalled", (_label, value) => {
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
    expect(recallVoice()).toBeNull();
  });

  it("keeps each table (?room=) apart", () => {
    openTable("?room=alpha");
    rememberVoice("live");
    expect(window.sessionStorage.getItem("herobyte.voice:alpha")).not.toBeNull();
    expect(recallVoice()).toBe("live");
    openTable("?room=beta");
    expect(recallVoice()).toBeNull();
    rememberVoice("muted");
    expect(recallVoice()).toBe("muted");
    openTable("?room=alpha");
    expect(recallVoice()).toBe("live");
    openTable("");
    expect(recallVoice()).toBeNull();
  });
});

describe("forgetVoice", () => {
  it("clears what was remembered for this table only", () => {
    openTable("?room=alpha");
    rememberVoice("live");
    openTable("?room=beta");
    rememberVoice("muted");
    forgetVoice();
    expect(recallVoice()).toBeNull();
    expect(window.sessionStorage.getItem("herobyte.voice:beta")).toBeNull();
    openTable("?room=alpha");
    expect(recallVoice()).toBe("live");
  });

  it("with nothing remembered does nothing", () => {
    expect(() => forgetVoice()).not.toThrow();
    expect(recallVoice()).toBeNull();
  });
});

describe("storage that refuses", () => {
  it("remember, recall and forget never throw", () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => {
        throw new Error("denied");
      },
    });
    try {
      expect(() => rememberVoice("live")).not.toThrow();
      expect(recallVoice()).toBeNull();
      expect(() => forgetVoice()).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, "sessionStorage", original);
      else delete (window as { sessionStorage?: unknown }).sessionStorage;
    }
  });
});
