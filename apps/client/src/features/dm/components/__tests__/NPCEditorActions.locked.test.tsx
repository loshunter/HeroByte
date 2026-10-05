// Deleting an NPC, or placing its token again, would remove its token: while that token
// is locked, both buttons are off and say why (a refused one waited out a 5 s "timed out").

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NPCEditorActions } from "../NPCEditorActions";
import { onLockNotice } from "../../../locking/lockNotice";
/** What a press told the viewer through lockNotice (App toasts it). */
function listenForLockNotices(): { heard: (string | undefined)[]; off: () => void } {
  const heard: (string | undefined)[] = [];
  return { heard, off: onLockNotice((message) => heard.push(message)) };
}

describe("NPCEditorActions and a locked token", () => {
  it("turns Place on Map and Delete off, and names where to unlock", () => {
    const onPlace = vi.fn();
    const onDelete = vi.fn();
    const notices = listenForLockNotices();
    render(
      <NPCEditorActions
        npcName="Goblin"
        onPlace={onPlace}
        onDuplicate={vi.fn()}
        onDelete={onDelete}
        tokenLocked
      />,
    );
    const why = "Locked: unlock its token first (🔒 Locked in its ⚙️ settings).";
    for (const name of ["Place on Map", "Delete"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("title", why);
      fireEvent.click(button);
    }
    notices.off();
    expect(onPlace).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    // Each press says why (a `disabled` button said nothing, and a phone shows no tooltip).
    expect(notices.heard).toEqual([why, why]);
    // Duplicate copies stats and art and touches no token: it stays on.
    expect(screen.getByRole("button", { name: /Duplicate/ })).toBeEnabled();
  });
});
