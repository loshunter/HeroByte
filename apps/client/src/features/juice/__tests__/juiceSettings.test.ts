import { describe, it, expect, beforeEach } from "vitest";
import {
  getJuiceSettings,
  setMotionLevel,
  setMuted,
  toggleMuted,
  setVolume,
  motionDisabled,
  subscribeJuiceSettings,
  applyMotionAttribute,
  __resetJuiceSettingsForTests,
} from "../juiceSettings";

beforeEach(() => {
  // jsdom's localStorage in this config is not a full Storage; install a
  // working mock so persistence assertions are meaningful.
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
    writable: true,
    configurable: true,
  });
  __resetJuiceSettingsForTests({ motion: "full", muted: false, volume: 0.6 });
});

describe("juiceSettings", () => {
  it("exposes the current settings snapshot", () => {
    expect(getJuiceSettings()).toEqual({ motion: "full", muted: false, volume: 0.6 });
  });

  it("updates and persists the motion level", () => {
    setMotionLevel("off");
    expect(getJuiceSettings().motion).toBe("off");
    expect(motionDisabled()).toBe(true);
    expect(JSON.parse(localStorage.getItem("herobyte:juice")!).motion).toBe("off");
  });

  it("ignores invalid motion levels", () => {
    setMotionLevel("sideways" as never);
    expect(getJuiceSettings().motion).toBe("full");
  });

  it("toggles and sets mute", () => {
    toggleMuted();
    expect(getJuiceSettings().muted).toBe(true);
    setMuted(false);
    expect(getJuiceSettings().muted).toBe(false);
  });

  it("clamps volume into [0,1]", () => {
    setVolume(5);
    expect(getJuiceSettings().volume).toBe(1);
    setVolume(-3);
    expect(getJuiceSettings().volume).toBe(0);
  });

  it("notifies subscribers on change", () => {
    let hits = 0;
    const unsub = subscribeJuiceSettings(() => {
      hits += 1;
    });
    setMotionLevel("subtle");
    setVolume(0.2);
    unsub();
    setVolume(0.9);
    expect(hits).toBe(2);
  });

  it("mirrors the motion level onto the document root", () => {
    setMotionLevel("subtle");
    applyMotionAttribute();
    expect(document.documentElement.dataset.motion).toBe("subtle");
  });
});
