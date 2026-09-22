/**
 * PlayerSettingsMenu — the delete button follows the handler, not the owner
 *
 * The button used to live inside the owner-only "Add Character" section, so
 * a DM viewing another player's card never saw it even though the server
 * always allowed the delete. It now renders whenever a handler and a
 * character id are supplied, and never otherwise — the two card sites and
 * the mobile row decide who gets the handler.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayerSettingsMenu } from "../PlayerSettingsMenu";

function renderMenu(overrides: Partial<React.ComponentProps<typeof PlayerSettingsMenu>> = {}) {
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
      isDM={false}
      viewerIsDM
      canToggleDM={false}
      onToggleDMMode={vi.fn()}
      characterId="char-alice"
      {...overrides}
    />,
  );
}

const deleteButton = () => screen.queryByRole("button", { name: /Delete this character/ });

describe("PlayerSettingsMenu — delete", () => {
  it("renders Delete without the owner-only Add Character section, and calls back with the id", () => {
    const onDeleteCharacter = vi.fn();
    renderMenu({ onDeleteCharacter });

    expect(screen.queryByRole("button", { name: /Add Character/ })).not.toBeInTheDocument();
    fireEvent.click(deleteButton()!);

    expect(onDeleteCharacter).toHaveBeenCalledWith("char-alice");
  });

  it("renders no Delete when no handler was supplied — the caller's gate is the only gate", () => {
    renderMenu();

    expect(deleteButton()).not.toBeInTheDocument();
  });

  it("renders no Delete without a character id, even with a handler", () => {
    renderMenu({ characterId: undefined, onDeleteCharacter: vi.fn() });

    expect(deleteButton()).not.toBeInTheDocument();
  });
});
