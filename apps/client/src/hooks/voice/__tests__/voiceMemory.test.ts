// voiceMemory: whether this tab was in the call, honoured only when this page load IS a
// reload and within a minute of when it was last true, per table (?room=), and never from
// an old, future or malformed value. jsdom's page load is no reload: each test stubs one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELOAD_WINDOW_MS, forgetVoice, recallVoice, rememberVoice } from "../voiceMemory";

const KEY = "herobyte.voice:default";

function openTable(search: string) {
  window.history.replaceState(null, "", `/${search}`);
}

// What the browser says this page load was ("navigate", "reload", "back_forward").
function loadedBy(...types: string[]) {
  return vi
    .spyOn(window.performance, "getEntriesByType")
    .mockReturnValue(types.map((type) => ({ type })) as never);
}

beforeEach(() => {
  vi.useFakeTimers(); // fakes window.performance too: stub the load type after it
  vi.setSystemTime(1_000_000);
  loadedBy("reload");
  window.sessionStorage.clear();
  openTable("");
});

afterEach(() => {
  vi.restoreAllMocks();
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

describe("only a reload is honoured", () => {
  it("the stub is what recalls: a fresh memory on a reload is recalled", () => {
    rememberVoice("live");
    expect(window.performance.getEntriesByType("navigation")).toEqual([{ type: "reload" }]);
    expect(recallVoice()).toBe("live");
  });

  it.each([
    ["a new page load (a reopened or restored tab)", ["navigate"]],
    ["Back or Forward into the tab", ["back_forward"]],
    ["a browser that reports no navigation entry", []],
  ])("%s: a fresh, valid memory is not recalled", (_label, types) => {
    rememberVoice("live");
    loadedBy(...types);
    expect(recallVoice()).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).not.toBeNull(); // still there, just not honoured
  });

  it("a memory dated in the future (a clock set back) is not recalled", () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: "live", at: 1_000_001 }));
    expect(recallVoice()).toBeNull();
    window.sessionStorage.setItem(KEY, JSON.stringify({ state: "live", at: 1_000_000 }));
    expect(recallVoice()).toBe("live");
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
