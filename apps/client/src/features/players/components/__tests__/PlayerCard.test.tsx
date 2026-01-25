// ============================================================================
// PLAYERCARD COMPONENT TESTS
// ============================================================================
// Comprehensive tests for PlayerCard component following Phase 1 patterns
// Tests all features: rendering, role badges, DM styling, settings menu,
// token image management, state persistence, status effects, and memo optimization

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Player, Token, SceneObject, Drawing, PlayerState, TokenSize } from "@shared";

// ============================================================================
// MOCKS
// ============================================================================

// Mock playerPersistence utils FIRST (vi.mock is hoisted automatically)
vi.mock("../../../../utils/playerPersistence", () => ({
  savePlayerState: vi.fn(),
  loadPlayerState: vi.fn(),
}));

// Import component
import { PlayerCard } from "../PlayerCard";
// Import mocked functions
import { savePlayerState, loadPlayerState } from "../../../../utils/playerPersistence";

// Mock child components
vi.mock("../NameEditor", () => ({
  NameEditor: ({
    isEditing,
    isMe,
    playerName,
    playerUid,
    nameInput,
    tokenColor,
    onNameInputChange,
    onNameEdit,
    onNameSubmit,
  }: {
    isEditing: boolean;
    isMe: boolean;
    playerName: string;
    playerUid: string;
    nameInput: string;
    tokenColor?: string;
    onNameInputChange: (value: string) => void;
    onNameEdit: (uid: string, name: string) => void;
    onNameSubmit: (value: string) => void;
  }) => (
    <div data-testid="name-editor">
      <span data-testid="name-editor-name">{playerName}</span>
      <span data-testid="name-editor-is-editing">{String(isEditing)}</span>
      <span data-testid="name-editor-is-me">{String(isMe)}</span>
      <span data-testid="name-editor-uid">{playerUid}</span>
      <span data-testid="name-editor-input">{nameInput}</span>
      <span data-testid="name-editor-color">{tokenColor}</span>
      <button data-testid="name-editor-change" onClick={() => onNameInputChange("new-name")}>
        Change Name Input
      </button>
      <button data-testid="name-editor-edit" onClick={onNameEdit}>
        Edit
      </button>
      <button data-testid="name-editor-submit" onClick={onNameSubmit}>
        Submit
      </button>
    </div>
  ),
}));

vi.mock("../PortraitSection", () => ({
  PortraitSection: ({
    portrait,
    micLevel,
    isEditable,
    onRequestChange,
    statusEffects,
    tokenColor,
    onFocusToken,
    initiative,
    onInitiativeClick,
  }: {
    portrait?: string;
    micLevel?: number;
    isEditable?: boolean;
    onRequestChange?: () => void;
    statusEffects: string[];
    tokenColor?: string;
    onFocusToken?: () => void;
    initiative?: number;
    onInitiativeClick?: () => void;
  }) => (
    <div data-testid="portrait-section">
      <span data-testid="portrait-section-portrait">{portrait}</span>
      <span data-testid="portrait-section-mic-level">{micLevel}</span>
      <span data-testid="portrait-section-is-editable">{String(isEditable)}</span>
      <span data-testid="portrait-section-status-effects">{statusEffects.join(",")}</span>
      <span data-testid="portrait-section-token-color">{tokenColor}</span>
      <span data-testid="portrait-section-initiative">{initiative}</span>
      <button data-testid="portrait-section-change" onClick={onRequestChange}>
        Change Portrait
      </button>
      <button data-testid="portrait-section-focus" onClick={onFocusToken}>
        Focus Token
      </button>
      <button data-testid="portrait-section-initiative-click" onClick={onInitiativeClick}>
        Initiative Click
      </button>
    </div>
  ),
}));

vi.mock("../HPBar", () => ({
  HPBar: ({
    hp,
    maxHp,
    isMe,
    isEditingHp,
    hpInput,
    isEditingMaxHp,
    maxHpInput,
    playerUid,
    onHpChange,
    onHpInputChange,
    onHpEdit,
    onHpSubmit,
    onMaxHpInputChange,
    onMaxHpEdit,
    onMaxHpSubmit,
  }: {
    hp: number;
    maxHp: number;
    isMe: boolean;
    isEditingHp: boolean;
    hpInput: string;
    isEditingMaxHp: boolean;
    maxHpInput: string;
    playerUid: string;
    onHpChange: (hp: number) => void;
    onHpInputChange: (value: string) => void;
    onHpEdit: (uid: string, hp: number) => void;
    onHpSubmit: (value: string) => void;
    onMaxHpInputChange: (value: string) => void;
    onMaxHpEdit: (uid: string, maxHp: number) => void;
    onMaxHpSubmit: (value: string) => void;
  }) => (
    <div data-testid="hp-bar">
      <span data-testid="hp-bar-hp">{hp}</span>
      <span data-testid="hp-bar-max-hp">{maxHp}</span>
      <span data-testid="hp-bar-is-me">{String(isMe)}</span>
      <span data-testid="hp-bar-is-editing-hp">{String(isEditingHp)}</span>
      <span data-testid="hp-bar-hp-input">{hpInput}</span>
      <span data-testid="hp-bar-is-editing-max-hp">{String(isEditingMaxHp)}</span>
      <span data-testid="hp-bar-max-hp-input">{maxHpInput}</span>
      <span data-testid="hp-bar-player-uid">{playerUid}</span>
      <button data-testid="hp-bar-change-hp" onClick={() => onHpChange(50)}>
        Change HP
      </button>
      <button data-testid="hp-bar-change-hp-input" onClick={() => onHpInputChange("75")}>
        Change HP Input
      </button>
      <button data-testid="hp-bar-edit-hp" onClick={() => onHpEdit(playerUid, 80)}>
        Edit HP
      </button>
      <button data-testid="hp-bar-submit-hp" onClick={() => onHpSubmit("90")}>
        Submit HP
      </button>
      <button data-testid="hp-bar-change-max-hp-input" onClick={() => onMaxHpInputChange("150")}>
        Change Max HP Input
      </button>
      <button data-testid="hp-bar-edit-max-hp" onClick={() => onMaxHpEdit(playerUid, 120)}>
        Edit Max HP
      </button>
      <button data-testid="hp-bar-submit-max-hp" onClick={() => onMaxHpSubmit("200")}>
        Submit Max HP
      </button>
    </div>
  ),
}));

vi.mock("../CardControls", () => ({
  CardControls: ({
    canControlMic,
    canOpenSettings,
    micEnabled,
    onToggleMic,
    onOpenSettings,
  }: {
    canControlMic: boolean;
    canOpenSettings: boolean;
    micEnabled: boolean;
    onToggleMic: () => void;
    onOpenSettings: () => void;
  }) => (
    <div data-testid="card-controls">
      <span data-testid="card-controls-can-control-mic">{String(canControlMic)}</span>
      <span data-testid="card-controls-can-open-settings">{String(canOpenSettings)}</span>
      <span data-testid="card-controls-mic-enabled">{String(micEnabled)}</span>
      <button data-testid="card-controls-toggle-mic" onClick={onToggleMic}>
        Toggle Mic
      </button>
      <button data-testid="card-controls-open-settings" onClick={onOpenSettings}>
        Open Settings
      </button>
    </div>
  ),
}));

vi.mock("../PlayerSettingsMenu", () => ({
  PlayerSettingsMenu: ({
    isOpen,
    onClose,
    tokenImageInput,
    tokenImageUrl,
    onTokenImageInputChange,
    onTokenImageApply,
    onTokenImageClear,
    onDeleteToken,
    onSavePlayerState,
    onLoadPlayerState,
    selectedEffects,
    onStatusEffectsChange,
    isDM,
    onToggleDMMode,
    tokenLocked,
    onToggleTokenLock,
    tokenSize,
    onTokenSizeChange,
    onAddCharacter,
    isCreatingCharacter,
    characterId,
    onDeleteCharacter,
  }: {
    isOpen: boolean;
    onClose: () => void;
    tokenImageInput: string;
    tokenImageUrl?: string;
    onTokenImageInputChange: (value: string) => void;
    onTokenImageClear: () => void;
    onTokenImageApply: (value: string) => void;
    onSavePlayerState: () => void;
    onLoadPlayerState: (file: File) => Promise<void>;
    selectedEffects: string[];
    onStatusEffectsChange: (effects: string[]) => void;
    isDM: boolean;
    onToggleDMMode: (next: boolean) => void;
    onDeleteToken?: () => void;
    tokenLocked?: boolean;
    onToggleTokenLock?: (locked: boolean) => void;
    tokenSize?: string;
    onTokenSizeChange?: (size: string) => void;
    onAddCharacter?: (name: string) => boolean;
    isCreatingCharacter?: boolean;
    characterId?: string;
    onDeleteCharacter?: (characterId: string) => void;
  }) => (
    <div data-testid="player-settings-menu">
      <span data-testid="settings-is-open">{String(isOpen)}</span>
      <span data-testid="settings-token-image-input">{tokenImageInput}</span>
      <span data-testid="settings-token-image-url">{tokenImageUrl}</span>
      <span data-testid="settings-selected-effects">{selectedEffects.join(",")}</span>
      <span data-testid="settings-is-dm">{String(isDM)}</span>
      <span data-testid="settings-token-locked">{String(tokenLocked)}</span>
      <span data-testid="settings-token-size">{tokenSize}</span>
      <span data-testid="settings-is-creating-character">{String(isCreatingCharacter)}</span>
      <span data-testid="settings-character-id">{characterId}</span>
      <button data-testid="settings-close" onClick={onClose}>
        Close
      </button>
      <button
        data-testid="settings-change-token-input"
        onClick={() => onTokenImageInputChange("new-image.png")}
      >
        Change Token Input
      </button>
      <button data-testid="settings-apply-token" onClick={() => onTokenImageApply(tokenImageInput)}>
        Apply Token
      </button>
      <button data-testid="settings-clear-token" onClick={onTokenImageClear}>
        Clear Token
      </button>
      {onDeleteToken && (
        <button data-testid="settings-delete-token" onClick={onDeleteToken}>
          Delete Token
        </button>
      )}
      <button data-testid="settings-save-state" onClick={onSavePlayerState}>
        Save State
      </button>
      <button
        data-testid="settings-load-state"
        onClick={() => {
          const file = new File(['{"name":"Test"}'], "test.json", { type: "application/json" });
          onLoadPlayerState(file);
        }}
      >
        Load State
      </button>
      <button
        data-testid="settings-change-effects"
        onClick={() => onStatusEffectsChange(["poisoned", "burning"])}
      >
        Change Effects
      </button>
      <button data-testid="settings-toggle-dm" onClick={() => onToggleDMMode(!isDM)}>
        Toggle DM
      </button>
      {onToggleTokenLock && (
        <button data-testid="settings-toggle-lock" onClick={() => onToggleTokenLock(!tokenLocked)}>
          Toggle Lock
        </button>
      )}
      {onTokenSizeChange && (
        <button data-testid="settings-change-size" onClick={() => onTokenSizeChange("large")}>
          Change Size
        </button>
      )}
      {onAddCharacter && (
        <button
          data-testid="settings-add-character"
          onClick={() => onAddCharacter("New Character")}
        >
          Add Character
        </button>
      )}
      {onDeleteCharacter && (
        <button
          data-testid="settings-delete-character"
          onClick={() => onDeleteCharacter(characterId)}
        >
          Delete Character
        </button>
      )}
    </div>
  ),
}));

// Mock browser APIs that are not available in test environment
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();
const mockCreateElement = document.createElement.bind(document);
document.createElement = vi.fn((tagName: string) => {
  const element = mockCreateElement(tagName);
  if (tagName === "a") {
    element.click = vi.fn();
  }
  return element;
});

// ============================================================================
// TEST DATA
// ============================================================================

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
  imageUrl: "token.png",
  color: "#ff0000",
  x: 100,
  y: 150,
  size: "medium" as TokenSize,
  ...overrides,
});

const createMockSceneObject = (
  overrides?: Partial<SceneObject & { type: "token" }>,
): SceneObject & { type: "token" } => ({
  id: "scene-1",
  type: "token" as const,
  transform: {
    x: 100,
    y: 150,
    rotation: 45,
    scaleX: 1.5,
    scaleY: 1.5,
  },
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
  onPortraitLoad: vi.fn(),
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

// ============================================================================
// TESTS - INITIAL RENDERING
// ============================================================================

describe("PlayerCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Rendering", () => {
    it("renders player-card div", () => {
      const props = createDefaultProps();
      const { container } = render(<PlayerCard {...props} />);

      const playerCard = container.querySelector(".player-card");
      expect(playerCard).toBeInTheDocument();
    });

    it("displays NameEditor component", () => {
      const props = createDefaultProps();
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor")).toBeInTheDocument();
    });

    it("displays PortraitSection component", () => {
      const props = createDefaultProps();
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("portrait-section")).toBeInTheDocument();
    });

    it("displays HPBar component", () => {
      const props = createDefaultProps();
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar")).toBeInTheDocument();
    });

    it("displays CardControls component", () => {
      const props = createDefaultProps();
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("card-controls")).toBeInTheDocument();
    });

    it("displays PlayerSettingsMenu component", () => {
      const props = createDefaultProps();
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("player-settings-menu")).toBeInTheDocument();
    });

    it("shows player name via NameEditor", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ name: "Aragorn" }),
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor-name")).toHaveTextContent("Aragorn");
    });

    it("shows HP via HPBar", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ hp: 75, maxHp: 120 }),
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-hp")).toHaveTextContent("75");
      expect(screen.getByTestId("hp-bar-max-hp")).toHaveTextContent("120");
    });
  });

  // ============================================================================
  // TESTS - ROLE BADGE DISPLAY
  // ============================================================================

  describe("Role Badge Display", () => {
    it("shows 'You' when isMe is true", () => {
      const props = createDefaultProps({
        isMe: true,
        player: createMockPlayer({ isDM: false }),
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByText("You")).toBeInTheDocument();
    });

    it("shows 'Dungeon Master' when isMe is false and player.isDM is true", () => {
      const props = createDefaultProps({
        isMe: false,
        player: createMockPlayer({ isDM: true }),
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByText("Dungeon Master")).toBeInTheDocument();
    });

    it("shows 'Adventurer' when isMe is false and player.isDM is false", () => {
      const props = createDefaultProps({
        isMe: false,
        player: createMockPlayer({ isDM: false }),
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByText("Adventurer")).toBeInTheDocument();
    });

    it("uses gold color for DM badge", () => {
      const props = createDefaultProps({
        isMe: false,
        player: createMockPlayer({ isDM: true }),
      });
      render(<PlayerCard {...props} />);

      const badge = screen.getByText("Dungeon Master");
      expect(badge).toHaveStyle({ color: "var(--jrpg-gold)" });
    });

    it("uses white color for non-DM badge when isMe is true", () => {
      const props = createDefaultProps({
        isMe: true,
        player: createMockPlayer({ isDM: false }),
      });
      render(<PlayerCard {...props} />);

      const badge = screen.getByText("You");
      expect(badge).toHaveStyle({ color: "var(--jrpg-white)" });
    });

    it("uses white color for Adventurer badge", () => {
      const props = createDefaultProps({
        isMe: false,
        player: createMockPlayer({ isDM: false }),
      });
      render(<PlayerCard {...props} />);

      const badge = screen.getByText("Adventurer");
      expect(badge).toHaveStyle({ color: "var(--jrpg-white)" });
    });
  });

  // ============================================================================
  // TESTS - DM STYLING
  // ============================================================================

  describe("DM Styling", () => {
    it("applies gold border when player.isDM is true", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ isDM: true }),
      });
      const { container } = render(<PlayerCard {...props} />);

      const playerCard = container.querySelector(".player-card");
      expect(playerCard).toHaveStyle({
        border: "2px solid var(--jrpg-gold)",
      });
    });

    it("applies shadow when player.isDM is true", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ isDM: true }),
      });
      const { container } = render(<PlayerCard {...props} />);

      const playerCard = container.querySelector(".player-card");
      expect(playerCard).toHaveStyle({
        boxShadow: "0 0 16px rgba(255, 215, 0, 0.6)",
      });
    });

    it("applies dark gold background when player.isDM is true", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ isDM: true }),
      });
      const { container } = render(<PlayerCard {...props} />);

      const playerCard = container.querySelector(".player-card");
      expect(playerCard).toHaveStyle({
        background: "rgba(60, 48, 10, 0.9)",
      });
    });

    it("does not apply special styling when player.isDM is false", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ isDM: false }),
      });
      const { container } = render(<PlayerCard {...props} />);

      const playerCard = container.querySelector(".player-card");
      expect(playerCard).not.toHaveStyle({
        border: "2px solid var(--jrpg-gold)",
      });
      expect(playerCard).not.toHaveStyle({
        boxShadow: "0 0 16px rgba(255, 215, 0, 0.6)",
      });
      expect(playerCard).not.toHaveStyle({
        background: "rgba(60, 48, 10, 0.9)",
      });
    });

    it("defaults player.isDM to false when undefined", () => {
      const player = createMockPlayer();
      delete (player as Partial<typeof player>).isDM;
      const props = createDefaultProps({ player });
      const { container } = render(<PlayerCard {...props} />);

      const playerCard = container.querySelector(".player-card");
      expect(playerCard).not.toHaveStyle({
        border: "2px solid var(--jrpg-gold)",
      });
      expect(screen.getByText("Adventurer")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TESTS - SETTINGS MENU TOGGLE
  // ============================================================================

  describe("Settings Menu Toggle", () => {
    it("settingsOpen defaults to false", () => {
      const props = createDefaultProps({ isMe: true });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("false");
    });

    it("toggles settingsOpen when CardControls onOpenSettings is called", () => {
      const props = createDefaultProps({ isMe: true });
      render(<PlayerCard {...props} />);

      const settingsButton = screen.getByTestId("card-controls-open-settings");

      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("false");

      fireEvent.click(settingsButton);
      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("true");

      fireEvent.click(settingsButton);
      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("false");
    });

    it("PlayerSettingsMenu isOpen is true when isMe and settingsOpen are both true", () => {
      const props = createDefaultProps({ isMe: true });
      render(<PlayerCard {...props} />);

      const settingsButton = screen.getByTestId("card-controls-open-settings");
      fireEvent.click(settingsButton);

      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("true");
    });

    it("PlayerSettingsMenu isOpen is false when isMe and viewerIsDM are false", () => {
      const props = createDefaultProps({ isMe: false, viewerIsDM: false });
      render(<PlayerCard {...props} />);

      const settingsButton = screen.getByTestId("card-controls-open-settings");
      fireEvent.click(settingsButton);

      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("false");
    });

    it("sets settingsOpen to false when PlayerSettingsMenu onClose is called", () => {
      const props = createDefaultProps({ isMe: true });
      render(<PlayerCard {...props} />);

      // Open settings
      const settingsButton = screen.getByTestId("card-controls-open-settings");
      fireEvent.click(settingsButton);
      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("true");

      // Close settings
      const closeButton = screen.getByTestId("settings-close");
      fireEvent.click(closeButton);
      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("false");
    });

    it("settings visible when isMe or viewerIsDM is true", () => {
      // Test when neither - settings should stay closed
      const propsNone = createDefaultProps({ isMe: false, viewerIsDM: false });
      render(<PlayerCard {...propsNone} />);

      const settingsButton1 = screen.getByTestId("card-controls-open-settings");
      fireEvent.click(settingsButton1);
      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("false");

      cleanup();

      // Test when isMe is true
      const propsIsMe = createDefaultProps({ isMe: true, viewerIsDM: false });
      render(<PlayerCard {...propsIsMe} />);

      const settingsButton2 = screen.getByTestId("card-controls-open-settings");
      fireEvent.click(settingsButton2);
      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("true");

      cleanup();

      // Test when viewerIsDM is true
      const propsDM = createDefaultProps({ isMe: false, viewerIsDM: true });
      render(<PlayerCard {...propsDM} />);

      const settingsButton3 = screen.getByTestId("card-controls-open-settings");
      fireEvent.click(settingsButton3);
      expect(screen.getByTestId("settings-is-open")).toHaveTextContent("true");
    });
  });

  // ============================================================================
  // TESTS - TOKEN IMAGE STATE SYNC
  // ============================================================================

  describe("Token Image State Sync", () => {
    it("initializes tokenImageInput from tokenImageUrl", () => {
      const props = createDefaultProps({
        tokenImageUrl: "initial-token.png",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent(
        "initial-token.png",
      );
    });

    it("updates tokenImageInput when tokenImageUrl prop changes", () => {
      const props = createDefaultProps({
        tokenImageUrl: "initial-token.png",
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent(
        "initial-token.png",
      );

      const updatedProps = createDefaultProps({
        tokenImageUrl: "updated-token.png",
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent(
        "updated-token.png",
      );
    });

    it("defaults tokenImageInput to empty string when tokenImageUrl is undefined", () => {
      const props = createDefaultProps({
        tokenImageUrl: undefined,
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent("");
    });

    it("updates tokenImageInput to empty string when tokenImageUrl changes to undefined", () => {
      const props = createDefaultProps({
        tokenImageUrl: "initial-token.png",
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent(
        "initial-token.png",
      );

      const updatedProps = createDefaultProps({
        tokenImageUrl: undefined,
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent("");
    });
  });

  // ============================================================================
  // TESTS - TOKEN IMAGE APPLY
  // ============================================================================

  describe("Token Image Apply", () => {
    it("calls onTokenImageSubmit when isMe is true", () => {
      const onTokenImageSubmit = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenImageUrl: "current.png",
        onTokenImageSubmit,
      });
      render(<PlayerCard {...props} />);

      const applyButton = screen.getByTestId("settings-apply-token");
      fireEvent.click(applyButton);

      expect(onTokenImageSubmit).toHaveBeenCalledTimes(1);
      expect(onTokenImageSubmit).toHaveBeenCalledWith("current.png");
    });

    it("does not call onTokenImageSubmit when isMe is false", () => {
      const onTokenImageSubmit = vi.fn();
      const props = createDefaultProps({
        isMe: false,
        tokenImageUrl: "current.png",
        onTokenImageSubmit,
      });
      render(<PlayerCard {...props} />);

      const applyButton = screen.getByTestId("settings-apply-token");
      fireEvent.click(applyButton);

      expect(onTokenImageSubmit).not.toHaveBeenCalled();
    });

    it("does not call onTokenImageSubmit when callback is undefined", () => {
      const props = createDefaultProps({
        isMe: true,
        tokenImageUrl: "current.png",
        onTokenImageSubmit: undefined,
      });

      // Should not throw
      expect(() => render(<PlayerCard {...props} />)).not.toThrow();

      const applyButton = screen.getByTestId("settings-apply-token");
      expect(() => fireEvent.click(applyButton)).not.toThrow();
    });

    it("passes trimmed value when tokenImageInput has whitespace", () => {
      const onTokenImageSubmit = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenImageUrl: "  trimmed.png  ",
        onTokenImageSubmit,
      });
      render(<PlayerCard {...props} />);

      const applyButton = screen.getByTestId("settings-apply-token");
      fireEvent.click(applyButton);

      expect(onTokenImageSubmit).toHaveBeenCalledWith("  trimmed.png  ");
    });

    it("passes original tokenImageUrl when tokenImageInput is empty after trim", () => {
      const onTokenImageSubmit = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenImageUrl: "fallback.png",
        onTokenImageSubmit,
      });
      render(<PlayerCard {...props} />);

      // Change input to whitespace-only
      const changeButton = screen.getByTestId("settings-change-token-input");
      fireEvent.click(changeButton);

      // Now clear it
      const clearButton = screen.getByTestId("settings-clear-token");
      fireEvent.click(clearButton);

      expect(onTokenImageSubmit).toHaveBeenCalledWith("");
    });
  });

  // ============================================================================
  // TESTS - TOKEN IMAGE CLEAR
  // ============================================================================

  describe("Token Image Clear", () => {
    it("clears tokenImageInput to empty string", () => {
      const props = createDefaultProps({
        isMe: true,
        tokenImageUrl: "current.png",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent("current.png");

      const clearButton = screen.getByTestId("settings-clear-token");
      fireEvent.click(clearButton);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent("");
    });

    it("calls handleTokenImageApply with empty string", () => {
      const onTokenImageSubmit = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenImageUrl: "current.png",
        onTokenImageSubmit,
      });
      render(<PlayerCard {...props} />);

      const clearButton = screen.getByTestId("settings-clear-token");
      fireEvent.click(clearButton);

      expect(onTokenImageSubmit).toHaveBeenCalledWith("");
    });

    it("does not call onTokenImageSubmit when isMe is false", () => {
      const onTokenImageSubmit = vi.fn();
      const props = createDefaultProps({
        isMe: false,
        tokenImageUrl: "current.png",
        onTokenImageSubmit,
      });
      render(<PlayerCard {...props} />);

      const clearButton = screen.getByTestId("settings-clear-token");
      fireEvent.click(clearButton);

      expect(onTokenImageSubmit).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TESTS - SAVE PLAYER STATE
  // ============================================================================

  describe("Save Player State", () => {
    it("only works when isMe is true", () => {
      const props = createDefaultProps({
        isMe: false,
        player: createMockPlayer(),
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      expect(savePlayerState).not.toHaveBeenCalled();
    });

    it("calls savePlayerState with player, token, tokenScene, drawings, initiativeModifier", () => {
      const player = createMockPlayer();
      const token = createMockToken();
      const tokenScene = createMockSceneObject();
      const drawings = [createMockDrawing()];
      const initiativeModifier = 3;

      const props = createDefaultProps({
        isMe: true,
        player,
        token,
        tokenSceneObject: tokenScene,
        playerDrawings: drawings,
        initiativeModifier,
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      expect(savePlayerState).toHaveBeenCalledTimes(1);
      expect(savePlayerState).toHaveBeenCalledWith({
        player,
        token: expect.objectContaining({
          id: token.id,
          color: token.color,
          imageUrl: token.imageUrl,
        }),
        tokenScene,
        drawings,
        initiativeModifier,
      });
    });

    it("uses tokenImageInput if available, falls back to tokenImageUrl", () => {
      const player = createMockPlayer();
      const token = createMockToken({ imageUrl: "original.png" });

      const props = createDefaultProps({
        isMe: true,
        player,
        token,
        tokenImageUrl: "fallback.png",
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      // tokenImageInput is initialized from tokenImageUrl, so it should use "fallback.png"
      expect(savePlayerState).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.objectContaining({
            imageUrl: "fallback.png",
          }),
        }),
      );
    });

    it("creates token object with imageUrl when token exists", () => {
      const player = createMockPlayer();
      const token = createMockToken({ imageUrl: "token-image.png" });

      const props = createDefaultProps({
        isMe: true,
        player,
        token,
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      expect(savePlayerState).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.objectContaining({
            imageUrl: "token-image.png",
          }),
        }),
      );
    });

    it("handles undefined token", () => {
      const player = createMockPlayer();

      const props = createDefaultProps({
        isMe: true,
        player,
        token: undefined,
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      expect(savePlayerState).toHaveBeenCalledWith(
        expect.objectContaining({
          token: undefined,
        }),
      );
    });

    it("handles null token", () => {
      const player = createMockPlayer();

      const props = createDefaultProps({
        isMe: true,
        player,
        token: null,
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      expect(savePlayerState).toHaveBeenCalledWith(
        expect.objectContaining({
          token: undefined,
        }),
      );
    });

    it("defaults drawings to empty array when undefined", () => {
      const player = createMockPlayer();

      const props = createDefaultProps({
        isMe: true,
        player,
        playerDrawings: undefined,
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      expect(savePlayerState).toHaveBeenCalledWith(
        expect.objectContaining({
          drawings: [],
        }),
      );
    });

    it("passes initiativeModifier when provided", () => {
      const player = createMockPlayer();

      const props = createDefaultProps({
        isMe: true,
        player,
        initiativeModifier: 5,
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      expect(savePlayerState).toHaveBeenCalledWith(
        expect.objectContaining({
          initiativeModifier: 5,
        }),
      );
    });

    it("passes undefined initiativeModifier when not provided", () => {
      const player = createMockPlayer();

      const props = createDefaultProps({
        isMe: true,
        player,
        initiativeModifier: undefined,
      });
      render(<PlayerCard {...props} />);

      const saveButton = screen.getByTestId("settings-save-state");
      fireEvent.click(saveButton);

      expect(savePlayerState).toHaveBeenCalledWith(
        expect.objectContaining({
          initiativeModifier: undefined,
        }),
      );
    });
  });

  // ============================================================================
  // TESTS - LOAD PLAYER STATE
  // ============================================================================

  describe("Load Player State", () => {
    beforeEach(() => {
      // Reset the mock before each test
      loadPlayerState.mockReset();
    });

    it("only works when isMe is true", async () => {
      const onApplyPlayerState = vi.fn();
      const props = createDefaultProps({
        isMe: false,
        onApplyPlayerState,
      });
      render(<PlayerCard {...props} />);

      const loadButton = screen.getByTestId("settings-load-state");
      fireEvent.click(loadButton);

      // Wait a bit to ensure no async calls happen
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadPlayerState).not.toHaveBeenCalled();
      expect(onApplyPlayerState).not.toHaveBeenCalled();
    });

    it("requires onApplyPlayerState callback", async () => {
      const props = createDefaultProps({
        isMe: true,
        onApplyPlayerState: undefined,
      });
      render(<PlayerCard {...props} />);

      const loadButton = screen.getByTestId("settings-load-state");
      fireEvent.click(loadButton);

      // Wait a bit to ensure no async calls happen
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadPlayerState).not.toHaveBeenCalled();
    });

    it("reads file and calls loadPlayerState", async () => {
      const mockState: PlayerState = {
        name: "Loaded Player",
        hp: 90,
        maxHp: 120,
        portrait: "loaded.jpg",
        tokenImage: "loaded-token.png",
      };
      loadPlayerState.mockResolvedValue(mockState);

      const onApplyPlayerState = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        onApplyPlayerState,
      });
      render(<PlayerCard {...props} />);

      const loadButton = screen.getByTestId("settings-load-state");
      fireEvent.click(loadButton);

      await vi.waitFor(() => {
        expect(loadPlayerState).toHaveBeenCalledTimes(1);
      });
    });

    it("calls onApplyPlayerState with state, tokenId, characterId", async () => {
      const mockState: PlayerState = {
        name: "Loaded Player",
        hp: 90,
        maxHp: 120,
        portrait: "loaded.jpg",
        tokenImage: "loaded-token.png",
      };
      loadPlayerState.mockResolvedValue(mockState);

      const onApplyPlayerState = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenId: "token-123",
        characterId: "char-456",
        onApplyPlayerState,
      });
      render(<PlayerCard {...props} />);

      const loadButton = screen.getByTestId("settings-load-state");
      fireEvent.click(loadButton);

      await vi.waitFor(() => {
        expect(onApplyPlayerState).toHaveBeenCalledTimes(1);
        expect(onApplyPlayerState).toHaveBeenCalledWith(mockState, "token-123", "char-456");
      });
    });

    it("updates tokenImageInput from loaded state.token.imageUrl", async () => {
      const mockState: PlayerState = {
        name: "Loaded Player",
        hp: 90,
        maxHp: 120,
        portrait: "loaded.jpg",
        token: {
          imageUrl: "token-from-state.png",
        },
      };
      loadPlayerState.mockResolvedValue(mockState);

      const onApplyPlayerState = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        onApplyPlayerState,
      });
      render(<PlayerCard {...props} />);

      const loadButton = screen.getByTestId("settings-load-state");
      fireEvent.click(loadButton);

      await vi.waitFor(() => {
        expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent(
          "token-from-state.png",
        );
      });
    });

    it("updates tokenImageInput from loaded state.tokenImage when token.imageUrl is undefined", async () => {
      const mockState: PlayerState = {
        name: "Loaded Player",
        hp: 90,
        maxHp: 120,
        portrait: "loaded.jpg",
        tokenImage: "fallback-token.png",
      };
      loadPlayerState.mockResolvedValue(mockState);

      const onApplyPlayerState = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        onApplyPlayerState,
      });
      render(<PlayerCard {...props} />);

      const loadButton = screen.getByTestId("settings-load-state");
      fireEvent.click(loadButton);

      await vi.waitFor(() => {
        expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent(
          "fallback-token.png",
        );
      });
    });

    it("sets tokenImageInput to empty string when state has no token image", async () => {
      const mockState: PlayerState = {
        name: "Loaded Player",
        hp: 90,
        maxHp: 120,
        portrait: "loaded.jpg",
      };
      loadPlayerState.mockResolvedValue(mockState);

      const onApplyPlayerState = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        onApplyPlayerState,
        tokenImageUrl: "existing.png",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent("existing.png");

      const loadButton = screen.getByTestId("settings-load-state");
      fireEvent.click(loadButton);

      await vi.waitFor(() => {
        expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent("");
      });
    });
  });

  // ============================================================================
  // TESTS - STATUS EFFECTS
  // ============================================================================

  describe("Status Effects", () => {
    it("handleStatusEffectsChange only works when isMe is true", () => {
      const onStatusEffectsChange = vi.fn();
      const props = createDefaultProps({
        isMe: false,
        onStatusEffectsChange,
      });
      render(<PlayerCard {...props} />);

      const changeEffectsButton = screen.getByTestId("settings-change-effects");
      fireEvent.click(changeEffectsButton);

      expect(onStatusEffectsChange).not.toHaveBeenCalled();
    });

    it("requires onStatusEffectsChange callback", () => {
      const props = createDefaultProps({
        isMe: true,
        onStatusEffectsChange: undefined,
      });
      render(<PlayerCard {...props} />);

      const changeEffectsButton = screen.getByTestId("settings-change-effects");
      expect(() => fireEvent.click(changeEffectsButton)).not.toThrow();
    });

    it("passes effects array to callback when isMe is true", () => {
      const onStatusEffectsChange = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        onStatusEffectsChange,
      });
      render(<PlayerCard {...props} />);

      const changeEffectsButton = screen.getByTestId("settings-change-effects");
      fireEvent.click(changeEffectsButton);

      expect(onStatusEffectsChange).toHaveBeenCalledTimes(1);
      expect(onStatusEffectsChange).toHaveBeenCalledWith(["poisoned", "burning"]);
    });

    it("displays current status effects in PlayerSettingsMenu", () => {
      const props = createDefaultProps({
        isMe: true,
        statusEffects: ["stunned", "frozen"],
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-selected-effects")).toHaveTextContent("stunned,frozen");
    });
  });

  // ============================================================================
  // TESTS - DELETE TOKEN
  // ============================================================================

  describe("Delete Token", () => {
    it("PlayerSettingsMenu onDeleteToken only set when tokenId AND onDeleteToken exist", () => {
      const onDeleteToken = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenId: "token-123",
        onDeleteToken,
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-delete-token")).toBeInTheDocument();
    });

    it("PlayerSettingsMenu onDeleteToken not set when tokenId is undefined", () => {
      const onDeleteToken = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenId: undefined,
        onDeleteToken,
      });
      render(<PlayerCard {...props} />);

      expect(screen.queryByTestId("settings-delete-token")).not.toBeInTheDocument();
    });

    it("PlayerSettingsMenu onDeleteToken not set when onDeleteToken is undefined", () => {
      const props = createDefaultProps({
        isMe: true,
        tokenId: "token-123",
        onDeleteToken: undefined,
      });
      render(<PlayerCard {...props} />);

      expect(screen.queryByTestId("settings-delete-token")).not.toBeInTheDocument();
    });

    it("calls onDeleteToken with tokenId", () => {
      const onDeleteToken = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenId: "token-456",
        onDeleteToken,
      });
      render(<PlayerCard {...props} />);

      const deleteButton = screen.getByTestId("settings-delete-token");
      fireEvent.click(deleteButton);

      expect(onDeleteToken).toHaveBeenCalledTimes(1);
      expect(onDeleteToken).toHaveBeenCalledWith("token-456");
    });
  });

  // ============================================================================
  // TESTS - CHILD COMPONENT PROPS
  // ============================================================================

  describe("Child Component Props", () => {
    describe("NameEditor props", () => {
      it("receives isEditing from editingPlayerUID", () => {
        const player = createMockPlayer({ uid: "player-1" });
        const props = createDefaultProps({
          player,
          editingPlayerUID: "player-1",
        });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("name-editor-is-editing")).toHaveTextContent("true");
      });

      it("receives isMe", () => {
        const props = createDefaultProps({ isMe: true });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("name-editor-is-me")).toHaveTextContent("true");
      });

      it("receives playerName from player.name", () => {
        const player = createMockPlayer({ name: "Frodo" });
        const props = createDefaultProps({ player });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("name-editor-name")).toHaveTextContent("Frodo");
      });

      it("receives playerUid from player.uid", () => {
        const player = createMockPlayer({ uid: "player-999" });
        const props = createDefaultProps({ player });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("name-editor-uid")).toHaveTextContent("player-999");
      });

      it("receives nameInput", () => {
        const props = createDefaultProps({ nameInput: "New Name" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("name-editor-input")).toHaveTextContent("New Name");
      });

      it("receives tokenColor", () => {
        const props = createDefaultProps({ tokenColor: "#ff00ff" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("name-editor-color")).toHaveTextContent("#ff00ff");
      });

      it("receives callbacks", () => {
        const onNameInputChange = vi.fn();
        const onNameEdit = vi.fn();
        const onNameSubmit = vi.fn();
        const props = createDefaultProps({
          onNameInputChange,
          onNameEdit,
          onNameSubmit,
        });
        render(<PlayerCard {...props} />);

        fireEvent.click(screen.getByTestId("name-editor-change"));
        expect(onNameInputChange).toHaveBeenCalledWith("new-name");

        fireEvent.click(screen.getByTestId("name-editor-edit"));
        expect(onNameEdit).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("name-editor-submit"));
        expect(onNameSubmit).toHaveBeenCalledTimes(1);
      });
    });

    describe("PortraitSection props", () => {
      it("receives portrait from player.portrait", () => {
        const player = createMockPlayer({ portrait: "portrait.jpg" });
        const props = createDefaultProps({ player });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("portrait-section-portrait")).toHaveTextContent("portrait.jpg");
      });

      it("receives micLevel from player.micLevel", () => {
        const player = createMockPlayer({ micLevel: 0.75 });
        const props = createDefaultProps({ player });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("portrait-section-mic-level")).toHaveTextContent("0.75");
      });

      it("receives isEditable as isMe", () => {
        const props = createDefaultProps({ isMe: true });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("portrait-section-is-editable")).toHaveTextContent("true");
      });

      it("receives statusEffects with fallback to empty array", () => {
        const props = createDefaultProps({ statusEffects: ["poisoned"] });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("portrait-section-status-effects")).toHaveTextContent("poisoned");
      });

      it("receives empty statusEffects when undefined", () => {
        const props = createDefaultProps({ statusEffects: undefined });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("portrait-section-status-effects")).toHaveTextContent("");
      });

      it("receives tokenColor", () => {
        const props = createDefaultProps({ tokenColor: "#00ff00" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("portrait-section-token-color")).toHaveTextContent("#00ff00");
      });

      it("receives initiative", () => {
        const props = createDefaultProps({ initiative: 18 });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("portrait-section-initiative")).toHaveTextContent("18");
      });

      it("receives callbacks", () => {
        const onPortraitLoad = vi.fn();
        const onFocusToken = vi.fn();
        const onInitiativeClick = vi.fn();
        const props = createDefaultProps({
          onPortraitLoad,
          onFocusToken,
          onInitiativeClick,
        });
        render(<PlayerCard {...props} />);

        fireEvent.click(screen.getByTestId("portrait-section-change"));
        expect(onPortraitLoad).toHaveBeenCalledTimes(1);
        expect(onPortraitLoad).toHaveBeenCalledWith(undefined);

        fireEvent.click(screen.getByTestId("portrait-section-focus"));
        expect(onFocusToken).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("portrait-section-initiative-click"));
        expect(onInitiativeClick).toHaveBeenCalledTimes(1);
      });

      it("passes characterId to onPortraitLoad when provided", () => {
        const onPortraitLoad = vi.fn();
        const props = createDefaultProps({
          onPortraitLoad,
          characterId: "char-123",
        });
        render(<PlayerCard {...props} />);

        fireEvent.click(screen.getByTestId("portrait-section-change"));
        expect(onPortraitLoad).toHaveBeenCalledWith("char-123");
      });
    });

    describe("HPBar props", () => {
      it("receives hp from player.hp with default 100", () => {
        const player = createMockPlayer({ hp: 85 });
        const props = createDefaultProps({ player });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-hp")).toHaveTextContent("85");
      });

      it("defaults hp to 100 when player.hp is undefined", () => {
        const player = createMockPlayer();
        delete (player as Partial<typeof player>).hp;
        const props = createDefaultProps({ player });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-hp")).toHaveTextContent("100");
      });

      it("receives maxHp from player.maxHp with default 100", () => {
        const player = createMockPlayer({ maxHp: 150 });
        const props = createDefaultProps({ player });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-max-hp")).toHaveTextContent("150");
      });

      it("defaults maxHp to 100 when player.maxHp is undefined", () => {
        const player = createMockPlayer();
        delete (player as Partial<typeof player>).maxHp;
        const props = createDefaultProps({ player });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-max-hp")).toHaveTextContent("100");
      });

      it("receives isMe", () => {
        const props = createDefaultProps({ isMe: true });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-is-me")).toHaveTextContent("true");
      });

      it("receives isEditingHp from editingHpUID", () => {
        const player = createMockPlayer({ uid: "player-1" });
        const props = createDefaultProps({
          player,
          editingHpUID: "player-1",
        });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-is-editing-hp")).toHaveTextContent("true");
      });

      it("receives hpInput", () => {
        const props = createDefaultProps({ hpInput: "95" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-hp-input")).toHaveTextContent("95");
      });

      it("receives isEditingMaxHp from editingMaxHpUID", () => {
        const player = createMockPlayer({ uid: "player-1" });
        const props = createDefaultProps({
          player,
          editingMaxHpUID: "player-1",
        });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-is-editing-max-hp")).toHaveTextContent("true");
      });

      it("receives maxHpInput", () => {
        const props = createDefaultProps({ maxHpInput: "180" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-max-hp-input")).toHaveTextContent("180");
      });

      it("receives playerUid from characterId when available", () => {
        const player = createMockPlayer({ uid: "player-1" });
        const props = createDefaultProps({
          player,
          characterId: "char-123",
        });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-player-uid")).toHaveTextContent("char-123");
      });

      it("receives playerUid from player.uid when characterId is undefined", () => {
        const player = createMockPlayer({ uid: "player-1" });
        const props = createDefaultProps({
          player,
          characterId: undefined,
        });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("hp-bar-player-uid")).toHaveTextContent("player-1");
      });

      it("receives callbacks", () => {
        const onHpChange = vi.fn();
        const onHpInputChange = vi.fn();
        const onHpEdit = vi.fn();
        const onHpSubmit = vi.fn();
        const onMaxHpInputChange = vi.fn();
        const onMaxHpEdit = vi.fn();
        const onMaxHpSubmit = vi.fn();
        const player = createMockPlayer({ uid: "player-1" });
        const props = createDefaultProps({
          player,
          onHpChange,
          onHpInputChange,
          onHpEdit,
          onHpSubmit,
          onMaxHpInputChange,
          onMaxHpEdit,
          onMaxHpSubmit,
        });
        render(<PlayerCard {...props} />);

        fireEvent.click(screen.getByTestId("hp-bar-change-hp"));
        expect(onHpChange).toHaveBeenCalledWith(50);

        fireEvent.click(screen.getByTestId("hp-bar-change-hp-input"));
        expect(onHpInputChange).toHaveBeenCalledWith("75");

        fireEvent.click(screen.getByTestId("hp-bar-edit-hp"));
        expect(onHpEdit).toHaveBeenCalledWith("player-1", 80);

        fireEvent.click(screen.getByTestId("hp-bar-submit-hp"));
        expect(onHpSubmit).toHaveBeenCalledWith("90");

        fireEvent.click(screen.getByTestId("hp-bar-change-max-hp-input"));
        expect(onMaxHpInputChange).toHaveBeenCalledWith("150");

        fireEvent.click(screen.getByTestId("hp-bar-edit-max-hp"));
        expect(onMaxHpEdit).toHaveBeenCalledWith("player-1", 120);

        fireEvent.click(screen.getByTestId("hp-bar-submit-max-hp"));
        expect(onMaxHpSubmit).toHaveBeenCalledWith("200");
      });
    });

    describe("CardControls props", () => {
      it("receives canControlMic as isMe", () => {
        const props = createDefaultProps({ isMe: true });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("card-controls-can-control-mic")).toHaveTextContent("true");
      });

      it("receives canOpenSettings as isMe || viewerIsDM", () => {
        const props = createDefaultProps({ isMe: true, viewerIsDM: false });
        render(<PlayerCard {...props} />);
        expect(screen.getByTestId("card-controls-can-open-settings")).toHaveTextContent("true");

        cleanup();
        const propsDM = createDefaultProps({ isMe: false, viewerIsDM: true });
        render(<PlayerCard {...propsDM} />);
        expect(screen.getByTestId("card-controls-can-open-settings")).toHaveTextContent("true");
      });

      it("receives micEnabled", () => {
        const props = createDefaultProps({ micEnabled: false });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("card-controls-mic-enabled")).toHaveTextContent("false");
      });

      it("receives callbacks", () => {
        const onToggleMic = vi.fn();
        const props = createDefaultProps({ onToggleMic });
        render(<PlayerCard {...props} />);

        fireEvent.click(screen.getByTestId("card-controls-toggle-mic"));
        expect(onToggleMic).toHaveBeenCalledTimes(1);
      });
    });

    describe("PlayerSettingsMenu props", () => {
      it("receives isOpen as isMe && settingsOpen", () => {
        const props = createDefaultProps({ isMe: true });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-is-open")).toHaveTextContent("false");

        fireEvent.click(screen.getByTestId("card-controls-open-settings"));
        expect(screen.getByTestId("settings-is-open")).toHaveTextContent("true");
      });

      it("receives tokenImageInput", () => {
        const props = createDefaultProps({ tokenImageUrl: "test.png" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-token-image-input")).toHaveTextContent("test.png");
      });

      it("receives tokenImageUrl", () => {
        const props = createDefaultProps({ tokenImageUrl: "url.png" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-token-image-url")).toHaveTextContent("url.png");
      });

      it("receives selectedEffects with fallback to empty array", () => {
        const props = createDefaultProps({ statusEffects: ["stunned"] });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-selected-effects")).toHaveTextContent("stunned");
      });

      it("receives isDM", () => {
        const props = createDefaultProps({ isDM: true });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-is-dm")).toHaveTextContent("true");
      });

      it("receives tokenLocked", () => {
        const props = createDefaultProps({ tokenLocked: true });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-token-locked")).toHaveTextContent("true");
      });

      it("receives tokenSize", () => {
        const props = createDefaultProps({ tokenSize: "large" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-token-size")).toHaveTextContent("large");
      });

      it("receives isCreatingCharacter", () => {
        const props = createDefaultProps({ isCreatingCharacter: true });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-is-creating-character")).toHaveTextContent("true");
      });

      it("receives characterId", () => {
        const props = createDefaultProps({ characterId: "char-789" });
        render(<PlayerCard {...props} />);

        expect(screen.getByTestId("settings-character-id")).toHaveTextContent("char-789");
      });

      it("receives all callbacks", () => {
        const onToggleDMMode = vi.fn();
        const onToggleTokenLock = vi.fn();
        const onTokenSizeChange = vi.fn();
        const onAddCharacter = vi.fn().mockReturnValue(true);
        const onDeleteCharacter = vi.fn();
        const props = createDefaultProps({
          isMe: true,
          tokenId: "token-1",
          characterId: "char-1",
          onToggleDMMode,
          onToggleTokenLock,
          onTokenSizeChange,
          onAddCharacter,
          onDeleteCharacter,
        });
        render(<PlayerCard {...props} />);

        fireEvent.click(screen.getByTestId("settings-toggle-dm"));
        expect(onToggleDMMode).toHaveBeenCalledWith(true);

        fireEvent.click(screen.getByTestId("settings-toggle-lock"));
        expect(onToggleTokenLock).toHaveBeenCalledWith(true);

        fireEvent.click(screen.getByTestId("settings-change-size"));
        expect(onTokenSizeChange).toHaveBeenCalledWith("large");

        fireEvent.click(screen.getByTestId("settings-add-character"));
        expect(onAddCharacter).toHaveBeenCalledWith("New Character");

        fireEvent.click(screen.getByTestId("settings-delete-character"));
        expect(onDeleteCharacter).toHaveBeenCalledWith("char-1");
      });
    });
  });

  // ============================================================================
  // TESTS - EDITING STATE DERIVATION
  // ============================================================================

  describe("Editing State Derivation", () => {
    it("editing is true when editingPlayerUID matches player.uid", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        editingPlayerUID: "player-1",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor-is-editing")).toHaveTextContent("true");
    });

    it("editing is false when editingPlayerUID does not match player.uid", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        editingPlayerUID: "player-2",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor-is-editing")).toHaveTextContent("false");
    });

    it("editing is false when editingPlayerUID is null", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        editingPlayerUID: null,
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor-is-editing")).toHaveTextContent("false");
    });

    it("editingHp is true when editingHpUID matches characterId", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        characterId: "char-123",
        editingHpUID: "char-123",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-is-editing-hp")).toHaveTextContent("true");
    });

    it("editingHp is true when editingHpUID matches player.uid and no characterId", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        characterId: undefined,
        editingHpUID: "player-1",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-is-editing-hp")).toHaveTextContent("true");
    });

    it("editingHp is false when editingHpUID does not match", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        editingHpUID: "player-2",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-is-editing-hp")).toHaveTextContent("false");
    });

    it("editingMaxHp is true when editingMaxHpUID matches characterId", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        characterId: "char-123",
        editingMaxHpUID: "char-123",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-is-editing-max-hp")).toHaveTextContent("true");
    });

    it("editingMaxHp is true when editingMaxHpUID matches player.uid and no characterId", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        characterId: undefined,
        editingMaxHpUID: "player-1",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-is-editing-max-hp")).toHaveTextContent("true");
    });

    it("editingMaxHp is false when editingMaxHpUID does not match", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        editingMaxHpUID: "player-2",
      });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-is-editing-max-hp")).toHaveTextContent("false");
    });
  });

  // ============================================================================
  // TESTS - HP DEFAULTS
  // ============================================================================

  describe("HP Defaults", () => {
    it("player.hp defaults to 100 if undefined", () => {
      const player = createMockPlayer();
      delete (player as Partial<typeof player>).hp;
      const props = createDefaultProps({ player });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-hp")).toHaveTextContent("100");
    });

    it("player.maxHp defaults to 100 if undefined", () => {
      const player = createMockPlayer();
      delete (player as Partial<typeof player>).maxHp;
      const props = createDefaultProps({ player });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-max-hp")).toHaveTextContent("100");
    });

    it("uses player.hp when defined", () => {
      const player = createMockPlayer({ hp: 55 });
      const props = createDefaultProps({ player });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-hp")).toHaveTextContent("55");
    });

    it("uses player.maxHp when defined", () => {
      const player = createMockPlayer({ maxHp: 200 });
      const props = createDefaultProps({ player });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-max-hp")).toHaveTextContent("200");
    });

    it("handles player.hp of 0", () => {
      const player = createMockPlayer({ hp: 0 });
      const props = createDefaultProps({ player });
      render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-hp")).toHaveTextContent("0");
    });
  });

  // ============================================================================
  // TESTS - REACT.MEMO OPTIMIZATION
  // ============================================================================

  describe("React.memo Optimization", () => {
    it("does not re-render when all props are the same", () => {
      const props = createDefaultProps();
      const { rerender } = render(<PlayerCard {...props} />);

      const initialElement = screen.getByTestId("name-editor");

      rerender(<PlayerCard {...props} />);

      const afterRerender = screen.getByTestId("name-editor");
      expect(initialElement).toBe(afterRerender);
    });

    it("re-renders when player.name changes", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ name: "Initial" }),
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor-name")).toHaveTextContent("Initial");

      const updatedProps = createDefaultProps({
        player: createMockPlayer({ name: "Updated" }),
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("name-editor-name")).toHaveTextContent("Updated");
    });

    it("re-renders when player.portrait changes", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ portrait: "initial.jpg" }),
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("portrait-section-portrait")).toHaveTextContent("initial.jpg");

      const updatedProps = createDefaultProps({
        player: createMockPlayer({ portrait: "updated.jpg" }),
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("portrait-section-portrait")).toHaveTextContent("updated.jpg");
    });

    it("re-renders when player.micLevel changes", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ micLevel: 0.5 }),
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("portrait-section-mic-level")).toHaveTextContent("0.5");

      const updatedProps = createDefaultProps({
        player: createMockPlayer({ micLevel: 0.8 }),
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("portrait-section-mic-level")).toHaveTextContent("0.8");
    });

    it("re-renders when player.hp changes", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ hp: 80 }),
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-hp")).toHaveTextContent("80");

      const updatedProps = createDefaultProps({
        player: createMockPlayer({ hp: 60 }),
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("hp-bar-hp")).toHaveTextContent("60");
    });

    it("re-renders when player.maxHp changes", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ maxHp: 100 }),
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-max-hp")).toHaveTextContent("100");

      const updatedProps = createDefaultProps({
        player: createMockPlayer({ maxHp: 120 }),
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("hp-bar-max-hp")).toHaveTextContent("120");
    });

    it("re-renders when player.isDM changes", () => {
      const props = createDefaultProps({
        player: createMockPlayer({ isDM: false }),
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByText("Adventurer")).toBeInTheDocument();

      const updatedProps = createDefaultProps({
        player: createMockPlayer({ isDM: true }),
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByText("Dungeon Master")).toBeInTheDocument();
    });

    it("re-renders when tokenImageUrl changes", () => {
      const props = createDefaultProps({
        tokenImageUrl: "initial.png",
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-token-image-url")).toHaveTextContent("initial.png");

      const updatedProps = createDefaultProps({
        tokenImageUrl: "updated.png",
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("settings-token-image-url")).toHaveTextContent("updated.png");
    });

    it("re-renders when tokenId changes", () => {
      const onDeleteToken = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        tokenId: "token-1",
        onDeleteToken,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-delete-token")).toBeInTheDocument();

      const updatedProps = createDefaultProps({
        isMe: true,
        tokenId: undefined,
        onDeleteToken,
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.queryByTestId("settings-delete-token")).not.toBeInTheDocument();
    });

    it("re-renders when onApplyPlayerState changes", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const props = createDefaultProps({
        onApplyPlayerState: callback1,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      const updatedProps = createDefaultProps({
        onApplyPlayerState: callback2,
      });
      rerender(<PlayerCard {...updatedProps} />);

      // Component should have re-rendered
      expect(screen.getByTestId("player-settings-menu")).toBeInTheDocument();
    });

    it("re-renders when token changes", () => {
      const token1 = createMockToken({ id: "token-1" });
      const token2 = createMockToken({ id: "token-2" });
      const props = createDefaultProps({
        token: token1,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      const updatedProps = createDefaultProps({
        token: token2,
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("player-settings-menu")).toBeInTheDocument();
    });

    it("re-renders when tokenSceneObject changes", () => {
      const scene1 = createMockSceneObject({ id: "scene-1" });
      const scene2 = createMockSceneObject({ id: "scene-2" });
      const props = createDefaultProps({
        tokenSceneObject: scene1,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      const updatedProps = createDefaultProps({
        tokenSceneObject: scene2,
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("player-settings-menu")).toBeInTheDocument();
    });

    it("re-renders when playerDrawings changes", () => {
      const drawings1 = [createMockDrawing({ id: "drawing-1" })];
      const drawings2 = [createMockDrawing({ id: "drawing-2" })];
      const props = createDefaultProps({
        playerDrawings: drawings1,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      const updatedProps = createDefaultProps({
        playerDrawings: drawings2,
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("player-settings-menu")).toBeInTheDocument();
    });

    it("re-renders when statusEffects changes", () => {
      const props = createDefaultProps({
        statusEffects: ["poisoned"],
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("portrait-section-status-effects")).toHaveTextContent("poisoned");

      const updatedProps = createDefaultProps({
        statusEffects: ["burning"],
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("portrait-section-status-effects")).toHaveTextContent("burning");
    });

    it("re-renders when onStatusEffectsChange changes", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const props = createDefaultProps({
        onStatusEffectsChange: callback1,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      const updatedProps = createDefaultProps({
        onStatusEffectsChange: callback2,
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("player-settings-menu")).toBeInTheDocument();
    });

    it("re-renders when tokenColor changes", () => {
      const props = createDefaultProps({
        tokenColor: "#ff0000",
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor-color")).toHaveTextContent("#ff0000");

      const updatedProps = createDefaultProps({
        tokenColor: "#00ff00",
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("name-editor-color")).toHaveTextContent("#00ff00");
    });

    it("re-renders when micEnabled changes", () => {
      const props = createDefaultProps({
        micEnabled: true,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("card-controls-mic-enabled")).toHaveTextContent("true");

      const updatedProps = createDefaultProps({
        micEnabled: false,
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("card-controls-mic-enabled")).toHaveTextContent("false");
    });

    it("re-renders when editingPlayerUID changes", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        editingPlayerUID: null,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor-is-editing")).toHaveTextContent("false");

      const updatedProps = createDefaultProps({
        player,
        editingPlayerUID: "player-1",
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("name-editor-is-editing")).toHaveTextContent("true");
    });

    it("re-renders when nameInput changes", () => {
      const props = createDefaultProps({
        nameInput: "initial",
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("name-editor-input")).toHaveTextContent("initial");

      const updatedProps = createDefaultProps({
        nameInput: "updated",
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("name-editor-input")).toHaveTextContent("updated");
    });

    it("re-renders when editingMaxHpUID changes", () => {
      const player = createMockPlayer({ uid: "player-1" });
      const props = createDefaultProps({
        player,
        editingMaxHpUID: null,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-is-editing-max-hp")).toHaveTextContent("false");

      const updatedProps = createDefaultProps({
        player,
        editingMaxHpUID: "player-1",
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("hp-bar-is-editing-max-hp")).toHaveTextContent("true");
    });

    it("re-renders when maxHpInput changes", () => {
      const props = createDefaultProps({
        maxHpInput: "100",
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("hp-bar-max-hp-input")).toHaveTextContent("100");

      const updatedProps = createDefaultProps({
        maxHpInput: "150",
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("hp-bar-max-hp-input")).toHaveTextContent("150");
    });

    it("re-renders when isDM prop changes", () => {
      const props = createDefaultProps({
        isDM: false,
      });
      const { rerender } = render(<PlayerCard {...props} />);

      expect(screen.getByTestId("settings-is-dm")).toHaveTextContent("false");

      const updatedProps = createDefaultProps({
        isDM: true,
      });
      rerender(<PlayerCard {...updatedProps} />);

      expect(screen.getByTestId("settings-is-dm")).toHaveTextContent("true");
    });
  });

  // ============================================================================
  // TESTS - COMPONENT METADATA
  // ============================================================================

  describe("Component Metadata", () => {
    it("has displayName 'PlayerCard'", () => {
      expect(PlayerCard.displayName).toBe("PlayerCard");
    });
  });
});
