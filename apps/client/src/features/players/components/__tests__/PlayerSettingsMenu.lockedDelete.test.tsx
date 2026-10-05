// 🗑️ Delete this character, while its token is locked: stopped, and a press says
// what to do — the DM unlocks it first; a player is told only the DM can.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { onLockNotice } from "../../../locking/lockNotice";
import { PlayerSettingsMenu } from "../PlayerSettingsMenu";

function renderLockedCharacterSettings(props: {
  viewerIsDM: boolean;
  onDeleteCharacter: (id: string) => void;
}) {
  return render(
    <PlayerSettingsMenu
      isOpen
      onClose={vi.fn()}
      nameInput="Alice"
      onNameInputChange={vi.fn()}
      onNameSubmit={vi.fn()}
      portraitImageInput=""
      onPortraitInputChange={vi.fn()}
      onPortraitApply={vi.fn()}
      selectedEffects={[]}
      onStatusEffectsChange={vi.fn()}
      characterId="char-alice"
      tokenLocked
      {...props}
    />,
  );
}

describe("PlayerSettingsMenu — Delete this character and the lock", () => {
  it.each([
    [true, "Locked: unlock its token first (Token Lock, below), then delete it."],
    [false, "Locked: only the DM can unlock its token."],
  ])("viewerIsDM=%s: stopped, and a press says %s", (viewerIsDM, why) => {
    const onDeleteCharacter = vi.fn();
    const heard: (string | undefined)[] = [];
    const off = onLockNotice((message) => heard.push(message));
    renderLockedCharacterSettings({ viewerIsDM, onDeleteCharacter });
    const button = screen.getByRole("button", { name: "🗑️ Delete this character" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", why);
    fireEvent.click(button);
    off();
    expect(onDeleteCharacter).not.toHaveBeenCalled();
    expect(heard).toEqual([why]);
  });
});
