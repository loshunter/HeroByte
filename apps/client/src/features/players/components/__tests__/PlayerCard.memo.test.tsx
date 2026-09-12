/**
 * PlayerCard's memo comparator, rendered WITHOUT the sibling file's
 * subcomponent mocks: the movement fields (slice 3 / F2) must repaint when a
 * spend or a speed changes ALONE — same token object, same drawings array,
 * same HP — which is exactly the case the comparator decides.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayerCard } from "../PlayerCard";
import React from "react";
import type { Player, TokenSize } from "@herobyte/shared";

const createMockPlayer = (overrides?: Partial<Player>): Player => ({
  uid: "player-1",
  name: "Gandalf",
  portrait: "gandalf.jpg",
  micLevel: 0.5,
  hp: 80,
  maxHp: 100,
  isDM: false,
  ...overrides,
});

const createDefaultProps = (overrides?: Partial<React.ComponentProps<typeof PlayerCard>>) => ({
  player: createMockPlayer(),
  isMe: false,
  tokenColor: "#336699",
  token: null,
  tokenSceneObject: null,
  playerDrawings: [],
  statusEffects: [],
  micEnabled: true,
  editingPlayerUID: null,
  nameInput: "",
  onNameInputChange: vi.fn(),
  onNameEdit: vi.fn(),
  onNameSubmit: vi.fn(),
  onToggleMic: vi.fn(),
  onHpChange: vi.fn(),
  editingHpUID: null,
  hpInput: "",
  onHpInputChange: vi.fn(),
  onHpEdit: vi.fn(),
  onHpSubmit: vi.fn(),
  editingMaxHpUID: null,
  maxHpInput: "",
  onMaxHpInputChange: vi.fn(),
  onMaxHpEdit: vi.fn(),
  onMaxHpSubmit: vi.fn(),
  tokenImageUrl: undefined,
  onTokenImageSubmit: vi.fn(),
  tokenId: undefined,
  onApplyPlayerState: vi.fn(),
  onDeleteToken: vi.fn(),
  onStatusEffectsChange: vi.fn(),
  isDM: false,
  viewerIsDM: false,
  onToggleDMMode: vi.fn(),
  tokenLocked: false,
  onToggleTokenLock: vi.fn(),
  tokenSize: "medium" as TokenSize,
  onTokenSizeChange: vi.fn(),
  onAddCharacter: vi.fn(),
  isCreatingCharacter: false,
  characterId: undefined,
  onDeleteCharacter: vi.fn(),
  onFocusToken: vi.fn(),
  initiative: undefined,
  onInitiativeClick: vi.fn(),
  initiativeModifier: undefined,
  ...overrides,
});

describe("PlayerCard — the token-image field only where it can act", () => {
  it("no token (no onTokenImageSubmit): no Token Image panel; with one: the panel", () => {
    const { unmount } = render(
      <PlayerCard {...createDefaultProps({ isMe: true, onTokenImageSubmit: undefined })} />,
    );
    fireEvent.click(screen.getByLabelText("Change portrait"));
    expect(screen.queryByText(/Token Image/i)).toBeNull();
    unmount();
    render(<PlayerCard {...createDefaultProps({ isMe: true, onTokenImageSubmit: vi.fn() })} />);
    fireEvent.click(screen.getByLabelText("Change portrait"));
    expect(screen.getByText(/Token Image/i)).toBeInTheDocument();
  });
});

describe("PlayerCard memo — the movement fields", () => {
  it("re-renders when the spend alone changes (same token, same drawings, same HP)", () => {
    const token = { id: "t1", owner: "player-1", x: 0, y: 0, color: "red" };
    const playerDrawings: never[] = [];
    const onReset = vi.fn();
    const onCharacterSpeedChange = vi.fn();
    const stable = { token: token as never, playerDrawings, isMe: true, onCharacterSpeedChange };
    const props = createDefaultProps({ ...stable, characterBudget: { used: 5, onReset } });
    const { rerender } = render(<PlayerCard {...props} />);
    fireEvent.click(screen.getByLabelText("Change portrait"));
    expect(screen.getByText("Used 5 ft")).toBeInTheDocument();
    // Every other compared prop identical; only the spend moves.
    rerender(<PlayerCard {...props} characterBudget={{ used: 0, onReset }} />);
    expect(screen.getByText("Used 0 ft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset movement budget" })).toBeDisabled();
    // And the speed alone.
    rerender(<PlayerCard {...props} characterBudget={{ used: 0, onReset }} characterSpeed={45} />);
    expect(screen.getByLabelText("Movement speed in feet per turn")).toHaveValue(45);
    // The budget appearing or vanishing (its shape) re-renders; a fresh onReset
    // closure with the same shape does not have to — the panel mints one per
    // render, and the one it minted closes over a stable handler.
    rerender(<PlayerCard {...props} characterBudget={undefined} characterSpeed={45} />);
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
    rerender(<PlayerCard {...props} characterBudget={{ used: 15, onReset }} characterSpeed={45} />);
    expect(screen.getByText("Used 15 ft")).toBeInTheDocument();
  });
});
