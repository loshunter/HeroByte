/**
 * An NPC's conditions and Focus from the DM menu's NPC editor — the phone's
 * only route to either (♛ DM → NPCs; the phone Party lists no NPCs). The
 * Party's NPC window gained the same picker in U7. Drives the REAL NPCsTab.
 */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import NPCsTab from "../NPCsTab";

afterEach(() => cleanup());

const goblin = {
  id: "npc-goblin",
  name: "Goblin",
  type: "npc",
  hp: 7,
  maxHp: 7,
  tokenId: "t-goblin",
} as SnapshotCharacter;

function renderTab(overrides: Partial<React.ComponentProps<typeof NPCsTab>> = {}) {
  const props = {
    npcs: [goblin],
    onCreateNPC: vi.fn(),
    onDuplicateNPC: vi.fn(),
    onUpdateNPC: vi.fn(),
    onSetNPCSpeed: vi.fn(),
    onResetNPCBudget: vi.fn(),
    onPlaceNPCToken: vi.fn(),
    onSetNPCStatusEffects: vi.fn(),
    onFocusNPCToken: vi.fn(),
    mapTokenIds: new Set(["t-goblin"]),
    onDeleteNPC: vi.fn(),
    onOpenEncounter: vi.fn(),
    ...overrides,
  };
  render(<NPCsTab {...props} />);
  return props;
}

describe("NPCsTab — an NPC's conditions and Focus", () => {
  // ~0.8s idle for the first case: the band that fails the 5000ms default under
  // a whole-suite run (NPCsTab.test.tsx's twenty editors did, at 6.8s).
  vi.setConfig({ testTimeout: 30_000 });
  it("sets the NPC's conditions from its editor", () => {
    const props = renderTab();

    fireEvent.click(screen.getByRole("button", { name: "No Effects" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Poisoned/ }));

    expect(props.onSetNPCStatusEffects).toHaveBeenCalledWith("npc-goblin", ["poisoned"]);
  });

  it("shows the conditions it already has", () => {
    renderTab({ npcs: [{ ...goblin, statusEffects: ["prone"] } as SnapshotCharacter] });

    fireEvent.click(screen.getByRole("button", { name: "1 Active Effect" }));
    expect(screen.getByRole("checkbox", { name: /Prone/ })).toBeChecked();
  });

  it("focuses its token while it is on the map", () => {
    const props = renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Focus Goblin" }));

    expect(props.onFocusNPCToken).toHaveBeenCalledWith("t-goblin");
  });

  it("offers no Focus for a token on another scene, or for none", () => {
    renderTab({
      npcs: [goblin, { ...goblin, id: "npc-2", name: "Ogre", tokenId: undefined }],
      mapTokenIds: new Set<string>(),
    });

    const editors = screen.getAllByRole("button", { name: /Place on Map/ });
    expect(editors).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^Focus / })).toBeNull();
    expect(within(document.body).queryByText("🎯 Focus")).toBeNull();
  });
});
