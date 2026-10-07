// voiceMemory: whether this tab was in the call, honoured only when this page load IS a
// reload that began as the old page went away (performance.timeOrigin at most 2 s after the
// memory was written) and within a minute of when it was last true, per table (?room=), and
// never from an old, future or malformed value. Every read spends the memory, whatever it
// decides. jsdom's page load is no reload: each test stubs one, and when this page began.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELOAD_START_SLACK_MS,
  RELOAD_WINDOW_MS,
  forgetVoice,
  recallVoice,
  rememberVoice,
} from "../voiceMemory";

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

// When this page load began (performance.timeOrigin, epoch ms).
function startedAt(ms: number) {
  return vi.spyOn(window.performance, "timeOrigin", "get").mockReturnValue(ms);
}

// Write a memory as the old page did, with an explicit time.
function store(state: string, at: number) {
  window.sessionStorage.setItem(KEY, JSON.stringify({ state, at }));
}

beforeEach(() => {
  vi.useFakeTimers(); // fakes window.performance too: stub the load type and start after it
  vi.setSystemTime(1_000_000);
  loadedBy("reload");
  // A reload: this page began as the old one wrote its memory (at 1 000 000).
  startedAt(1_000_000);
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

  it("the window is a minute; a reload may begin up to 2 s after the memory", () => {
    expect(RELOAD_WINDOW_MS).toBe(60_000);
    expect(RELOAD_START_SLACK_MS).toBe(2_000);
  });

  it.each(["live", "muted"] as const)("%s within the window is recalled", (state) => {
    rememberVoice(state);
    vi.setSystemTime(1_000_000 + 59_999);
    expect(recallVoice()).toBe(state);
  });

  it("exactly 60 000 ms later is still recalled; at 60 001 ms it is not", () => {
    store("live", 1_000_000);
    vi.setSystemTime(1_000_000 + 60_000);
    expect(recallVoice()).toBe("live");
    store("live", 1_000_000);
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
    openTable("?room=beta");
    rememberVoice("muted");
    openTable("");
    expect(recallVoice()).toBeNull();
    openTable("?room=beta");
    expect(recallVoice()).toBe("muted");
    // Reading beta spent beta only.
    expect(window.sessionStorage.getItem("herobyte.voice:alpha")).not.toBeNull();
    openTable("?room=alpha");
    expect(recallVoice()).toBe("live");
  });
});

describe("only a reload that began as the old page went away is honoured", () => {
  it("the stubs are what recall: a fresh memory on a reload is recalled", () => {
    rememberVoice("live");
    expect(window.performance.getEntriesByType("navigation")).toEqual([{ type: "reload" }]);
    expect(window.performance.timeOrigin).toBe(1_000_000);
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
  });

  it("a memory dated in the future (a clock set back) is not recalled", () => {
    store("live", 1_000_001);
    expect(recallVoice()).toBeNull();
    store("live", 1_000_000);
    expect(recallVoice()).toBe("live");
  });

  it("a reload that began before the memory was written (the usual order) is recalled", () => {
    // The new page starts loading, then the old page's pagehide writes the memory.
    startedAt(1_000_000 - 1_500);
    store("muted", 1_000_000);
    vi.setSystemTime(1_000_000 + 3_000);
    expect(recallVoice()).toBe("muted");
  });

  it("a page that began 2 000 ms after the memory is recalled; 2 001 ms after is not", () => {
    store("live", 1_000_000);
    startedAt(1_000_000 + 2_000);
    vi.setSystemTime(1_000_000 + 5_000);
    expect(recallVoice()).toBe("live");
    store("live", 1_000_000);
    startedAt(1_000_000 + 2_001);
    expect(recallVoice()).toBeNull();
  });

  it("a 'reload' of a tab that began long after the memory (a duplicated tab) is not recalled", () => {
    store("live", 1_000_000);
    startedAt(1_000_000 + 30_000);
    vi.setSystemTime(1_000_000 + 31_000);
    expect(recallVoice()).toBeNull();
  });
});

describe("a memory is read once", () => {
  const stored = () => window.sessionStorage.getItem(KEY);

  it("a recall that rejoins spends it", () => {
    rememberVoice("live");
    expect(recallVoice()).toBe("live");
    expect(stored()).toBeNull();
    expect(recallVoice()).toBeNull();
  });

  it.each([["navigate"], ["back_forward"]])(
    "a %s load (no reload) spends it: a reload a moment later does not rejoin",
    (type) => {
      rememberVoice("live");
      loadedBy(type);
      expect(recallVoice()).toBeNull();
      expect(stored()).toBeNull();
      loadedBy("reload");
      expect(recallVoice()).toBeNull();
    },
  );

  it("a memory refused as too old is spent", () => {
    store("live", 1_000_000);
    vi.setSystemTime(1_000_000 + RELOAD_WINDOW_MS + 1);
    expect(recallVoice()).toBeNull();
    expect(stored()).toBeNull();
  });

  it("a memory refused because the page began too late is spent", () => {
    store("live", 1_000_000);
    startedAt(1_000_000 + RELOAD_START_SLACK_MS + 1);
    expect(recallVoice()).toBeNull();
    expect(stored()).toBeNull();
  });

  it("a malformed memory is spent", () => {
    window.sessionStorage.setItem(KEY, "{not json");
    expect(recallVoice()).toBeNull();
    expect(stored()).toBeNull();
  });
});

describe("forgetVoice", () => {
  it("clears what was remembered for this table only", () => {
    openTable("?room=alpha");
    rememberVoice("live");
    openTable("?room=beta");
    rememberVoice("muted");
    forgetVoice();
    expect(window.sessionStorage.getItem("herobyte.voice:beta")).toBeNull();
    expect(recallVoice()).toBeNull();
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
