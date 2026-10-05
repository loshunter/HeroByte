// 🗑️ Delete Token (DM) sits under Token Lock on the same card. A locked token is
// deleted by no one until it is unlocked, so the button is off and says why.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TokenSettingsSection } from "../TokenSettingsSection";
import { onLockNotice } from "../../../locking/lockNotice";
/** What a press told the viewer through lockNotice (App toasts it). */
function listenForLockNotices(): { heard: (string | undefined)[]; off: () => void } {
  const heard: (string | undefined)[] = [];
  return { heard, off: onLockNotice((message) => heard.push(message)) };
}

describe("TokenSettingsSection — Delete Token (DM) and the lock", () => {
  it("is stopped while the token is locked, and a press says to unlock it first", () => {
    const onDeleteToken = vi.fn();
    const notices = listenForLockNotices();
    render(
      <TokenSettingsSection
        tokenLocked
        onToggleTokenLock={vi.fn()}
        onDeleteToken={onDeleteToken}
      />,
    );
    const button = screen.getByRole("button", { name: "🗑️ Delete Token (DM)" });
    const why = "Locked: unlock it first (Token Lock), then delete it.";
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", why);
    fireEvent.click(button);
    notices.off();
    expect(onDeleteToken).not.toHaveBeenCalled();
    expect(notices.heard).toEqual([why]);
  });

  it("control: unlocked, it deletes after the confirm", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDeleteToken = vi.fn();
    render(
      <TokenSettingsSection
        tokenLocked={false}
        onToggleTokenLock={vi.fn()}
        onDeleteToken={onDeleteToken}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "🗑️ Delete Token (DM)" }));
    expect(onDeleteToken).toHaveBeenCalledOnce();
  });

  it("turns the Token Size buttons off while locked: a locked token is resized by no one", () => {
    const onTokenSizeChange = vi.fn();
    render(
      <TokenSettingsSection
        tokenLocked
        onToggleTokenLock={vi.fn()}
        onTokenSizeChange={onTokenSizeChange}
      />,
    );
    const sizes = screen.getAllByTitle("Locked: unlock it first (Token Lock).");
    expect(sizes).toHaveLength(6);
    for (const size of sizes) expect(size).toBeDisabled();
    fireEvent.click(sizes[4]!);
    expect(onTokenSizeChange).not.toHaveBeenCalled();
  });

  // A player's own card has the size buttons but not Token Lock (the DM's alone).
  it("tells a player only the DM can unlock it, not to use a control they lack", () => {
    render(<TokenSettingsSection tokenLocked onTokenSizeChange={vi.fn()} />);
    const sizes = screen.getAllByTitle("Locked: only the DM can unlock it.");
    expect(sizes).toHaveLength(6);
    expect(screen.queryAllByTitle("Locked: unlock it first (Token Lock).")).toHaveLength(0);
  });
});
