/**
 * The NPCs tab's Monster Library: a pick is an Add with the art filled in —
 * name, token image and portrait from the pack, and the ×N count applying
 * exactly as it does to the plain button. Drives the REAL NPCsTab, like the
 * bulk-add suite beside it.
 */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import NPCsTab from "../NPCsTab";

afterEach(() => cleanup());

function renderTab(overrides: Partial<React.ComponentProps<typeof NPCsTab>> = {}) {
  const props = {
    npcs: [] as SnapshotCharacter[],
    onCreateNPC: vi.fn(),
    onDuplicateNPC: vi.fn(),
    onUpdateNPC: vi.fn(),
    onSetNPCSpeed: vi.fn(),
    onResetNPCBudget: vi.fn(),
    onPlaceNPCToken: vi.fn(),
    onDeleteNPC: vi.fn(),
    ...overrides,
  };
  render(<NPCsTab {...props} />);
  return props;
}

const libraryButton = () => screen.getByRole("button", { name: "📖 Library" });
const CLUB = "/tokens/monsters/Goblins/goblinClub.png";

describe("NPCsTab — the Monster Library", () => {
  it("is closed until asked, and the button toggles it", () => {
    renderTab();
    expect(screen.queryByTestId("monster-library")).toBeNull();
    fireEvent.click(libraryButton());
    expect(screen.getByTestId("monster-library")).toBeInTheDocument();
    expect(screen.getByText(/Pick a monster to add it as an NPC/)).toBeInTheDocument();
    fireEvent.click(libraryButton());
    expect(screen.queryByTestId("monster-library")).toBeNull();
  });

  it("a pick creates the NPC with the pack's name, token image and portrait", () => {
    const props = renderTab();
    fireEvent.click(libraryButton());
    fireEvent.click(screen.getByRole("button", { name: "Goblin club brute" }));
    expect(props.onCreateNPC).toHaveBeenCalledTimes(1);
    expect(props.onCreateNPC).toHaveBeenCalledWith({
      name: "Goblin club brute",
      tokenImage: CLUB,
      portrait: CLUB,
      count: 1,
    });
  });

  it("the ×N count applies to a pick, and the hint says so", () => {
    const props = renderTab();
    fireEvent.change(screen.getByLabelText(/how many npcs to add/i), { target: { value: "5" } });
    fireEvent.click(libraryButton());
    expect(screen.getByText(/Pick a monster to add 5 of it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Goblin club brute" }));
    expect(props.onCreateNPC).toHaveBeenCalledWith(expect.objectContaining({ count: 5 }));
  });

  it("a create in flight disables the picks, not the panel", () => {
    const props = renderTab({ isCreatingNpc: true });
    fireEvent.click(libraryButton());
    const club = screen.getByRole("button", { name: "Goblin club brute" });
    expect(club).toBeDisabled();
    fireEvent.click(club);
    expect(props.onCreateNPC).not.toHaveBeenCalled();
  });

  it("the plain Add button still sends a bare count — the library did not leak into it", () => {
    const props = renderTab();
    fireEvent.click(libraryButton());
    fireEvent.click(screen.getByRole("button", { name: "+ Add NPC" }));
    expect(props.onCreateNPC).toHaveBeenCalledWith({ count: 1 });
  });
});
