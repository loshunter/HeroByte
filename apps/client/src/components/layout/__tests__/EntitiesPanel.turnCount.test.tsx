// The Party bar's "Turn N of M" is the order the SERVER walks. A PC with no
// seat — unclaimed (ownedByPlayerUID null: the DM's create-character, or a
// loaded session), or whose player's seat is gone — is in that order and gets
// turns, but the Party builds its cards from seats: the bar counted one fewer,
// and read "Turn —" while that PC held the turn.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";
import { DM_UID, entitiesPanelProps, npc, seat } from "./entitiesPanel.fixtures";

afterEach(cleanup);

const seatless = {
  id: "pc-lost",
  name: "Wanderer",
  type: "pc",
  ownedByPlayerUID: null,
  hp: 20,
  maxHp: 20,
  initiative: 18,
} as unknown as SnapshotCharacter;

describe("EntitiesPanel — Turn N of M counts the server's order", () => {
  it("counts a PC with no seat, and names its turn", () => {
    const props = entitiesPanelProps({
      players: [seat(DM_UID, "The DM", { isDM: true })],
      characters: [seatless, { ...npc("npc-rat", "Rat"), initiative: 5 }],
      uid: DM_UID,
      currentIsDM: true,
      combatActive: true,
      currentTurnCharacterId: "pc-lost",
    });
    render(<EntitiesPanel {...props} />);

    expect(document.querySelector(".party-bar__turn")?.textContent).toBe("Turn 1 of 2");
  });

  it("outside a fight the bar shows no turn at all", () => {
    const props = entitiesPanelProps({
      players: [seat(DM_UID, "The DM", { isDM: true })],
      characters: [{ ...npc("npc-rat", "Rat"), initiative: 5 }],
      uid: DM_UID,
      currentIsDM: true,
      combatActive: false,
      currentTurnCharacterId: "npc-rat",
    });
    render(<EntitiesPanel {...props} />);
    // The bar is given no combat at all outside a fight, whatever the stale
    // pointer says; so nothing here can name a turn.
    expect(document.querySelector(".party-bar__turn")).toBeNull();
  });
});
