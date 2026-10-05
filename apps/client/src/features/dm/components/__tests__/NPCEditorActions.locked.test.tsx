// Deleting an NPC, or placing its token again, would remove its token: while that token
// is locked, both buttons are off and say why (a refused one waited out a 5 s "timed out").

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NPCEditorActions } from "../NPCEditorActions";

describe("NPCEditorActions and a locked token", () => {
  it("turns Place on Map and Delete off, and names where to unlock", () => {
    const onPlace = vi.fn();
    const onDelete = vi.fn();
    render(
      <NPCEditorActions
        npcName="Goblin"
        onPlace={onPlace}
        onDuplicate={vi.fn()}
        onDelete={onDelete}
        tokenLocked
      />,
    );
    for (const name of ["Place on Map", "Delete"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute(
        "title",
        "Locked: unlock its token first (🔒 Locked in its ⚙️ settings).",
      );
      fireEvent.click(button);
    }
    expect(onPlace).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    // Duplicate copies stats and art and touches no token: it stays on.
    expect(screen.getByRole("button", { name: /Duplicate/ })).toBeEnabled();
  });
});
