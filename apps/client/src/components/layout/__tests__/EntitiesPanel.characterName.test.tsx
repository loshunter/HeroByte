// A rename has TWO entry points on one card, and they do not share a buffer:
// the inline editor drives the panel's `characterNameInput`, while the
// settings window keeps a private one (PlayerCard's settingsNameInput). The
// settings path used to seed the panel buffer and call the submit handler in
// the same tick, so the handler read the PREVIOUS buffer — "" whenever the
// inline editor was idle — and the guard dropped the rename with no error
// (UX-01). The card now hands the submitted value over directly.
//
// These drive the real gesture through the real PlayerCard and
// PlayerSettingsMenu: type in the field a user sees, then Enter or blur.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";

const DM = "dm-uid";
const ALICE = "alice-uid";

const players = [
  { uid: DM, name: "The DM", isDM: true, hp: 10, maxHp: 10 },
  { uid: ALICE, name: "Alice", isDM: false, hp: 10, maxHp: 10 },
] as unknown as Player[];

const alice = {
  id: "char-alice",
  name: "Alice",
  type: "pc",
  ownedByPlayerUID: ALICE,
  hp: 10,
  maxHp: 10,
} as unknown as SnapshotCharacter;

function panelProps(overrides: Partial<React.ComponentProps<typeof EntitiesPanel>> = {}) {
  return {
    players,
    characters: [alice],
    tokens: [],
    sceneObjects: [],
    drawings: [],
    uid: ALICE,
    micEnabled: false,
    editingPlayerUID: null,
    nameInput: "",
    editingMaxHpUID: null,
    maxHpInput: "",
    editingTempHpUID: null,
    tempHpInput: "",
    onNameInputChange: vi.fn(),
    onNameEdit: vi.fn(),
    onNameSubmit: vi.fn(),
    onCharacterNameUpdate: vi.fn(),
    onCharacterPortraitUpdate: vi.fn(),
    onToggleMic: vi.fn(),
    onCharacterHpChange: vi.fn(),
    editingHpUID: null,
    hpInput: "",
    onHpInputChange: vi.fn(),
    onHpEdit: vi.fn(),
    onHpSubmit: vi.fn(),
    onMaxHpInputChange: vi.fn(),
    onMaxHpEdit: vi.fn(),
    onMaxHpSubmit: vi.fn(),
    onTempHpInputChange: vi.fn(),
    onTempHpEdit: vi.fn(),
    onTempHpSubmit: vi.fn(),
    currentIsDM: false,
    onToggleDMMode: vi.fn(),
    onTokenImageChange: vi.fn(),
    onApplyPlayerState: vi.fn(),
    _onStatusEffectsChange: vi.fn(),
    onCharacterStatusEffectsChange: vi.fn(),
    onToggleTokenLock: vi.fn(),
    onTokenSizeChange: vi.fn(),
    onCharacterSpeedChange: vi.fn(),
    onCharacterBudgetReset: vi.fn(),
    onAddCharacter: vi.fn(),
    onDeleteCharacter: vi.fn(),
    onFocusToken: vi.fn(),
    combatActive: false,
    onSetInitiative: vi.fn(),
    onRollInitiative: vi.fn(),
    ...overrides,
  };
}

function openSettingsOf(name: string) {
  const card = screen.getByText(name).closest(".player-card-shell")!;
  fireEvent.click(card.querySelector('button[aria-label="Change portrait"]')!);
}

/** The settings window's own field, which has no label association (UX-16). */
const nameField = () => screen.getByPlaceholderText("Enter Name");

describe("EntitiesPanel — committing a rename from the settings window", () => {
  it("commits the typed name on Enter", () => {
    const props = panelProps();
    render(<EntitiesPanel {...props} />);
    openSettingsOf("Alice");

    fireEvent.change(nameField(), { target: { value: "Alice the Brave" } });
    fireEvent.keyDown(nameField(), { key: "Enter" });

    expect(props.onCharacterNameUpdate).toHaveBeenCalledExactlyOnceWith(
      "char-alice",
      "Alice the Brave",
    );
  });

  it("commits the typed name on blur", () => {
    const props = panelProps();
    render(<EntitiesPanel {...props} />);
    openSettingsOf("Alice");

    fireEvent.change(nameField(), { target: { value: "Alice the Bold" } });
    fireEvent.blur(nameField());

    expect(props.onCharacterNameUpdate).toHaveBeenCalledExactlyOnceWith(
      "char-alice",
      "Alice the Bold",
    );
  });

  it("trims the submitted value rather than storing the padding", () => {
    const props = panelProps();
    render(<EntitiesPanel {...props} />);
    openSettingsOf("Alice");

    fireEvent.change(nameField(), { target: { value: "  Padded  " } });
    fireEvent.keyDown(nameField(), { key: "Enter" });

    expect(props.onCharacterNameUpdate).toHaveBeenCalledExactlyOnceWith("char-alice", "Padded");
  });

  it("sends nothing for a blank name or an unchanged one", () => {
    const props = panelProps();
    render(<EntitiesPanel {...props} />);
    openSettingsOf("Alice");

    fireEvent.change(nameField(), { target: { value: "   " } });
    fireEvent.keyDown(nameField(), { key: "Enter" });
    fireEvent.change(nameField(), { target: { value: "Alice" } });
    fireEvent.keyDown(nameField(), { key: "Enter" });

    expect(props.onCharacterNameUpdate).not.toHaveBeenCalled();
  });

  it("still commits the inline editor's own buffer, which the panel owns", () => {
    const props = panelProps();
    render(<EntitiesPanel {...props} />);

    // Clicking the name starts the inline editor (a span, not a button — see
    // UX-16); the panel then owns the buffer through onNameInputChange.
    fireEvent.click(screen.getByText("Alice"));
    fireEvent.change(screen.getByDisplayValue("Alice"), { target: { value: "Alice Inline" } });
    fireEvent.keyDown(screen.getByDisplayValue("Alice Inline"), { key: "Enter" });

    expect(props.onCharacterNameUpdate).toHaveBeenCalledExactlyOnceWith(
      "char-alice",
      "Alice Inline",
    );
  });
});
