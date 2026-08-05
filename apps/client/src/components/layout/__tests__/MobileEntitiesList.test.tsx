// The phone's party drawer. What this pins is the DM gate on the sight-radius
// handler, because the obvious test for it is vacuous: MobileLayout hands this
// list `props.updateTokenVisionRadius` UNCONDITIONALLY, so "no handler supplied"
// never happens in production and a test that omits the handler proves nothing.
// These supply it exactly as the app does and vary only `isDM`.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Player, SnapshotCharacter, Token } from "@herobyte/shared";
import { MobileEntitiesList } from "../MobileEntitiesList";

const ME = "me-uid";

const tokens: Token[] = [{ id: "my-token", owner: ME, x: 1, y: 1, color: "red", visionRadius: 30 }];

const players = [
  { uid: ME, name: "Me", hp: 10, maxHp: 10, micLevel: 0, isDM: false, statusEffects: [] },
] as unknown as Player[];

const characters = [
  { id: "char-1", name: "Me", type: "pc", ownedByPlayerUID: ME, hp: 10, maxHp: 10 },
] as unknown as SnapshotCharacter[];

function renderList(isDM: boolean, onTokenVisionRadiusChange = vi.fn()) {
  render(
    <MobileEntitiesList
      players={players}
      characters={characters}
      uid={ME}
      isDM={isDM}
      onToggleDMMode={vi.fn()}
      onClose={vi.fn()}
      editingHpUID={null}
      hpInput=""
      onHpInputChange={vi.fn()}
      onHpEdit={vi.fn()}
      onHpSubmit={vi.fn()}
      editingMaxHpUID={null}
      maxHpInput=""
      onMaxHpInputChange={vi.fn()}
      onMaxHpEdit={vi.fn()}
      onMaxHpSubmit={vi.fn()}
      onCharacterHpChange={vi.fn()}
      onCharacterStatusEffectsChange={vi.fn()}
      onCharacterNameUpdate={vi.fn()}
      onCharacterPortraitUpdate={vi.fn()}
      tokens={tokens}
      onTokenVisionRadiusChange={onTokenVisionRadiusChange}
    />,
  );
  return onTokenVisionRadiusChange;
}

describe("MobileEntitiesList sight-radius gate", () => {
  it("offers no sight controls to a plain player on their OWN row", () => {
    renderList(false);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.queryByLabelText("Sight radius in feet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Blind" })).not.toBeInTheDocument();
  });

  it("offers them to a DM, bound to that row's token", () => {
    const onChange = renderList(true);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.getByLabelText("Sight radius in feet")).toHaveValue(30);
    fireEvent.click(screen.getByRole("button", { name: "60 ft" }));
    expect(onChange).toHaveBeenCalledWith("my-token", 60);
  });

  // A player owns one token from joining and another per "+ Add Character", so
  // "the token this row is about" is NOT "the first token this player owns".
  // Binding by owner shows one character's row while writing to another
  // character's token — and the desktop list has never done that.
  it("binds to the row's CHARACTER token, not the first token the player owns", () => {
    const onChange = vi.fn();
    const twoTokens: Token[] = [
      { id: "joined-token", owner: ME, x: 0, y: 0, color: "red", visionRadius: 5 },
      { id: "character-token", owner: ME, x: 1, y: 1, color: "red", visionRadius: 90 },
    ];
    const linked = [
      {
        id: "char-1",
        name: "Me",
        type: "pc",
        ownedByPlayerUID: ME,
        hp: 10,
        maxHp: 10,
        tokenId: "character-token",
      },
    ] as unknown as SnapshotCharacter[];

    render(
      <MobileEntitiesList
        players={players}
        characters={linked}
        uid={ME}
        isDM
        onToggleDMMode={vi.fn()}
        onClose={vi.fn()}
        editingHpUID={null}
        hpInput=""
        onHpInputChange={vi.fn()}
        onHpEdit={vi.fn()}
        onHpSubmit={vi.fn()}
        editingMaxHpUID={null}
        maxHpInput=""
        onMaxHpInputChange={vi.fn()}
        onMaxHpEdit={vi.fn()}
        onMaxHpSubmit={vi.fn()}
        onCharacterHpChange={vi.fn()}
        onCharacterStatusEffectsChange={vi.fn()}
        onCharacterNameUpdate={vi.fn()}
        onCharacterPortraitUpdate={vi.fn()}
        tokens={twoTokens}
        onTokenVisionRadiusChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    // 90, the linked character's token — not 5, the one that happens to be first.
    expect(screen.getByLabelText("Sight radius in feet")).toHaveValue(90);
    fireEvent.click(screen.getByRole("button", { name: "30 ft" }));
    expect(onChange).toHaveBeenCalledWith("character-token", 30);
  });

  it("offers nothing when the row's player has no token to point at", () => {
    render(
      <MobileEntitiesList
        players={players}
        characters={characters}
        uid={ME}
        isDM
        onToggleDMMode={vi.fn()}
        onClose={vi.fn()}
        editingHpUID={null}
        hpInput=""
        onHpInputChange={vi.fn()}
        onHpEdit={vi.fn()}
        onHpSubmit={vi.fn()}
        editingMaxHpUID={null}
        maxHpInput=""
        onMaxHpInputChange={vi.fn()}
        onMaxHpEdit={vi.fn()}
        onMaxHpSubmit={vi.fn()}
        onCharacterHpChange={vi.fn()}
        onCharacterStatusEffectsChange={vi.fn()}
        onCharacterNameUpdate={vi.fn()}
        onCharacterPortraitUpdate={vi.fn()}
        tokens={[]}
        onTokenVisionRadiusChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.queryByLabelText("Sight radius in feet")).not.toBeInTheDocument();
  });
});
