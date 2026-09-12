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
import type { Player, Token, SceneObject, Drawing, PlayerState, TokenSize } from "@herobyte/shared";
import { savePlayerState, loadPlayerState } from "../../../../utils/playerPersistence";

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

const createMockToken = (overrides?: Partial<Token>): Token => ({
  id: "token-1",
  owner: "player-1",
  imageUrl: "token.png",
  color: "#ff0000",
  x: 100,
  y: 150,
  size: "medium" as TokenSize,
  ...overrides,
});

type TokenSceneObject = Extract<SceneObject, { type: "token" }>;

const createMockSceneObject = (
  overrides?: Partial<Omit<TokenSceneObject, "type">>,
): TokenSceneObject => ({
  id: "scene-1",
  type: "token" as const,
  owner: "player-1",
  zIndex: 0,
  transform: {
    x: 100,
    y: 150,
    rotation: 45,
    scaleX: 1.5,
    scaleY: 1.5,
  },
  data: { color: "#ff0000", size: "medium" },
  ...overrides,
});

const createMockDrawing = (overrides?: Partial<Drawing>): Drawing => ({
  id: "drawing-1",
  type: "freehand",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  color: "#000000",
  width: 2,
  opacity: 1,
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
  });
});
