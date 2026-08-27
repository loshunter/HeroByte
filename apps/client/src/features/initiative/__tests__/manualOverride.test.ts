import { describe, it, expect } from "vitest";
import { manualInitiativeEnabled, manualInitiativeAllowedFor } from "../manualOverride";

describe("manualInitiativeEnabled", () => {
  it("is ON for a table that has never touched the setting", () => {
    // THE case. The snapshot carries this key only when the setting is off, so
    // an absent key is the overwhelmingly common shape. Both plausible wrong
    // spellings — `?? false` and a bare truthiness check — return false here,
    // which is why this assertion exists before the explicit ones.
    expect(manualInitiativeEnabled({})).toBe(true);
  });

  it("is ON when explicitly enabled", () => {
    expect(manualInitiativeEnabled({ initiativeManualOverride: true })).toBe(true);
  });

  it("is OFF only when explicitly disabled", () => {
    expect(manualInitiativeEnabled({ initiativeManualOverride: false })).toBe(false);
  });

  it("is ON before any snapshot has arrived", () => {
    // Permissive rather than restrictive: matching the default avoids a flash
    // in which the control vanishes and then reappears on the first snapshot.
    expect(manualInitiativeEnabled(null)).toBe(true);
    expect(manualInitiativeEnabled(undefined)).toBe(true);
  });

  it("distinguishes absent from false, which is the entire point", () => {
    // Stated as one assertion so a future edit cannot satisfy half of it.
    expect([
      manualInitiativeEnabled({}),
      manualInitiativeEnabled({ initiativeManualOverride: false }),
    ]).toEqual([true, false]);
  });
});

describe("manualInitiativeAllowedFor", () => {
  it("keeps hand-entry for the DM even with the table setting off", () => {
    // Turning the setting off is a rule for the players, not a vow the DM
    // takes. The server agrees — handleSetInitiative gates a non-DM only.
    expect(manualInitiativeAllowedFor({ initiativeManualOverride: false }, true)).toBe(true);
  });

  it("denies a player when the table setting is off", () => {
    expect(manualInitiativeAllowedFor({ initiativeManualOverride: false }, false)).toBe(false);
  });

  it("allows a player at a table that never touched the setting", () => {
    expect(manualInitiativeAllowedFor({}, false)).toBe(true);
  });

  it("allows a player when it is explicitly on", () => {
    expect(manualInitiativeAllowedFor({ initiativeManualOverride: true }, false)).toBe(true);
  });
});
