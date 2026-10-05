// 🗑️ Delete Token (DM) sits under Token Lock on the same card. A locked token is
// deleted by no one until it is unlocked, so the button is off and says why.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TokenSettingsSection } from "../TokenSettingsSection";

describe("TokenSettingsSection — Delete Token (DM) and the lock", () => {
  it("is disabled while the token is locked, and points at Token Lock", () => {
    const onDeleteToken = vi.fn();
    render(
      <TokenSettingsSection
        tokenLocked
        onToggleTokenLock={vi.fn()}
        onDeleteToken={onDeleteToken}
      />,
    );
    const button = screen.getByRole("button", { name: "🗑️ Delete Token (DM)" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Locked: unlock it first (Token Lock).");
    fireEvent.click(button);
    expect(onDeleteToken).not.toHaveBeenCalled();
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
});
