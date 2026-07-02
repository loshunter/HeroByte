import { describe, it, expect, beforeEach } from "vitest";
import { sfxEngine } from "../sfxEngine";
import { __resetJuiceSettingsForTests } from "../juiceSettings";

// jsdom has no Web Audio API, so the engine must degrade to a safe no-op
// instead of throwing when components fire sound effects during tests.
describe("sfxEngine (no Web Audio env)", () => {
  beforeEach(() => {
    __resetJuiceSettingsForTests({ motion: "full", muted: false, volume: 0.6 });
  });

  it("reports Web Audio as unavailable under jsdom", () => {
    expect(sfxEngine.available).toBe(false);
  });

  it("does not throw when play/resume/preload are called", async () => {
    expect(() => sfxEngine.play("diceLand")).not.toThrow();
    expect(() => sfxEngine.resume()).not.toThrow();
    expect(() => sfxEngine.installAutoUnlock()).not.toThrow();
    await expect(sfxEngine.preload(["diceLand"])).resolves.toBeUndefined();
  });
});
