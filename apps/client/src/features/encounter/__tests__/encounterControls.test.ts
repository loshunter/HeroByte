// buildEncounterControls: the one place Encounter's reads come off the
// snapshot and its sends are taken from useDMContext — defaults included.

import { describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { buildEncounterControls, type CombatSenders } from "../encounterControls";
import { initiativeSpies } from "./encounterFixtures";

const senders = (): CombatSenders => ({
  handleStartCombat: vi.fn(),
  handleEndCombat: vi.fn(),
  handleClearAllInitiative: vi.fn(),
  handleNextTurn: vi.fn(),
  handlePreviousTurn: vi.fn(),
  handleSetMonsterHpDisplay: vi.fn(),
});
const wiring = () => ({
  uid: "dm",
  initiative: initiativeSpies(),
  mapTokenIds: new Set<string>(),
  onFocusToken: vi.fn(),
});

describe("buildEncounterControls", () => {
  it("reads the fight off the snapshot", () => {
    const snapshot = {
      characters: [{ id: "a" }],
      players: [{ uid: "dm" }],
      combatActive: true,
      currentTurnCharacterId: "a",
      monsterHpDisplay: "hidden",
    } as unknown as RoomSnapshot;

    const built = buildEncounterControls(snapshot, senders(), wiring());

    expect(built.characters).toBe(snapshot.characters);
    expect(built.players).toBe(snapshot.players);
    expect(built.combatActive).toBe(true);
    expect(built.currentTurnCharacterId).toBe("a");
    expect(built.monsterHpDisplay).toBe("hidden");
  });

  it("defaults with no snapshot: no fight, Exact HP, and hand entry ON (the flag's own default)", () => {
    const built = buildEncounterControls(null, senders(), wiring());
    expect(built.characters).toEqual([]);
    expect(built.combatActive).toBe(false);
    expect(built.monsterHpDisplay).toBe("exact");
    expect(built.playersMayEnterByHand).toBe(true);
  });

  it("hand entry reads OFF only when the table turned it off", () => {
    const off = { initiativeManualOverride: false } as unknown as RoomSnapshot;
    expect(buildEncounterControls(off, senders(), wiring()).playersMayEnterByHand).toBe(false);
  });

  it("every send is the DM context's own sender, and the wiring rides whole", () => {
    const combat = senders();
    const through = wiring();
    const built = buildEncounterControls(null, combat, through);
    expect(built.onStartCombat).toBe(combat.handleStartCombat);
    expect(built.onEndCombat).toBe(combat.handleEndCombat);
    expect(built.onClearAllInitiative).toBe(combat.handleClearAllInitiative);
    expect(built.onNextTurn).toBe(combat.handleNextTurn);
    expect(built.onPreviousTurn).toBe(combat.handlePreviousTurn);
    expect(built.onMonsterHpDisplayChange).toBe(combat.handleSetMonsterHpDisplay);
    expect(built.initiative).toBe(through.initiative);
    expect(built.onFocusToken).toBe(through.onFocusToken);
    expect(built.uid).toBe("dm");
  });
});
