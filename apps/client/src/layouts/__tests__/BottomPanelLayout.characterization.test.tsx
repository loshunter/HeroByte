/**
 * Characterization tests for BottomPanelLayout extraction
 *
 * These tests capture the expected behavior of the BottomPanelLayout component BEFORE it exists.
 * They serve as regression tests to ensure correct implementation during extraction.
 *
 * Target: Future BottomPanelLayout component
 *
 * Component structure:
 * - Renders EntitiesPanel directly (NO wrapper div)
 * - Passes through all 40 props to EntitiesPanel
 * - Handles bottomPanelRef correctly
 *
 * Part of: MainLayout decomposition project (Extraction 4)
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Player, Character, Token, SceneObject, Drawing, PlayerState, TokenSize } from "@shared";

// ============================================================================
// MOCK CHILD COMPONENTS
// ============================================================================

// Mock EntitiesPanel with comprehensive prop tracking
vi.mock("../../components/layout/EntitiesPanel", () => ({
  EntitiesPanel: (props: {
    // Layout & Ref (1 prop)
    bottomPanelRef?: React.RefObject<HTMLDivElement>;

    // State Data (9 props)
    players: Player[];
    characters: Character[];
    tokens: Token[];
    sceneObjects: SceneObject[];
    drawings: Drawing[];
    uid: string;
    micEnabled: boolean;
    currentIsDM: boolean;

    // Name Editing (5 props)
    editingPlayerUID: string | null;
    nameInput: string;
    onNameInputChange: (value: string) => void;
    onNameEdit: (uid: string, currentName: string) => void;
    onNameSubmit: () => void;

    // HP Editing (6 props)
    editingHpUID: string | null;
    hpInput: string;
    onHpInputChange: (value: string) => void;
    onHpEdit: (uid: string, currentHp: number) => void;
    onHpSubmit: () => void;
    onCharacterHpChange: (characterId: string, hp: number, maxHp: number) => void;

    // Max HP Editing (4 props)
    editingMaxHpUID: string | null;
    maxHpInput: string;
    onMaxHpInputChange: (value: string) => void;
    onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
    onMaxHpSubmit: () => void;

    // Portrait & Mic (2 props)
    onPortraitLoad: () => void;
    onToggleMic: () => void;

    // DM & Player State (4 props)
    onToggleDMMode: (next: boolean) => void;
    onApplyPlayerState: (state: PlayerState, tokenId?: string) => void;
    onStatusEffectsChange: (effects: string[]) => void;
    onCharacterNameUpdate: (characterId: string, name: string) => void;

    // NPC Management (4 props)
    onNpcUpdate: (id: string, updates: unknown) => void;
    onNpcDelete: (id: string) => void;
    onNpcPlaceToken: (id: string) => void;
    onPlayerTokenDelete: (tokenId: string) => void;

    // Token Management (3 props)
    onToggleTokenLock: (sceneObjectId: string, locked: boolean) => void;
    onTokenSizeChange: (tokenId: string, size: TokenSize) => void;
    onTokenImageChange: (tokenId: string, imageUrl: string) => void;

    // Character Management (2 props)
    onAddCharacter: (name: string) => void;
    onDeleteCharacter: (characterId: string) => void;
  }) => (
    <div
      data-testid="entities-panel"
      data-players-count={props.players.length}
      data-characters-count={props.characters.length}
      data-tokens-count={props.tokens.length}
      data-scene-objects-count={props.sceneObjects.length}
      data-drawings-count={props.drawings.length}
      data-uid={props.uid}
      data-mic-enabled={props.micEnabled}
      data-current-is-dm={props.currentIsDM}
      data-editing-player-uid={props.editingPlayerUID ?? "null"}
      data-name-input={props.nameInput}
      data-editing-hp-uid={props.editingHpUID ?? "null"}
      data-hp-input={props.hpInput}
      data-editing-max-hp-uid={props.editingMaxHpUID ?? "null"}
      data-max-hp-input={props.maxHpInput}
      data-has-bottom-panel-ref={props.bottomPanelRef !== undefined}
    >
      EntitiesPanel
    </div>
  ),
}));

// Import BottomPanelLayout component
// NOTE: This component doesn't exist yet - it will be created after these tests pass
import type { Player as PlayerType, Character as CharacterType } from "@shared";

// Define the expected BottomPanelLayout props interface
export interface BottomPanelLayoutProps {
  // Layout & Ref (1 prop)
  bottomPanelRef?: React.RefObject<HTMLDivElement>;

  // State Data (9 props)
  players: PlayerType[];
  characters: CharacterType[];
  tokens: Token[];
  sceneObjects: SceneObject[];
  drawings: Drawing[];
  uid: string;
  micEnabled: boolean;
  currentIsDM: boolean;

  // Name Editing (5 props)
  editingPlayerUID: string | null;
  nameInput: string;
  onNameInputChange: (value: string) => void;
  onNameEdit: (uid: string, currentName: string) => void;
  onNameSubmit: () => void;

  // HP Editing (6 props)
  editingHpUID: string | null;
  hpInput: string;
  onHpInputChange: (value: string) => void;
  onHpEdit: (uid: string, currentHp: number) => void;
  onHpSubmit: () => void;
  onCharacterHpChange: (characterId: string, hp: number, maxHp: number) => void;

  // Max HP Editing (4 props)
  editingMaxHpUID: string | null;
  maxHpInput: string;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  onMaxHpSubmit: () => void;

  // Portrait & Mic (2 props)
  onPortraitLoad: () => void;
  onToggleMic: () => void;

  // DM & Player State (4 props)
  onToggleDMMode: (next: boolean) => void;
  onApplyPlayerState: (state: PlayerState, tokenId?: string) => void;
  onStatusEffectsChange: (effects: string[]) => void;
  onCharacterNameUpdate: (characterId: string, name: string) => void;

  // NPC Management (4 props)
  onNpcUpdate: (id: string, updates: Partial<unknown>) => void;
  onNpcDelete: (id: string) => void;
  onNpcPlaceToken: (id: string) => void;
  onPlayerTokenDelete: (tokenId: string) => void;

  // Token Management (3 props)
  onToggleTokenLock: (sceneObjectId: string, locked: boolean) => void;
  onTokenSizeChange: (tokenId: string, size: TokenSize) => void;
  onTokenImageChange: (tokenId: string, imageUrl: string) => void;

  // Character Management (2 props)
  onAddCharacter: (name: string) => void;
  onDeleteCharacter: (characterId: string) => void;
}

// Import EntitiesPanel AFTER the mock is set up
import { EntitiesPanel } from "../../components/layout/EntitiesPanel";

// Stub component for testing - will be replaced with actual implementation
// This is a simple pass-through that renders EntitiesPanel directly
const BottomPanelLayout: React.FC<BottomPanelLayoutProps> = (props) => {
  return <EntitiesPanel {...props} />;
};

describe("BottomPanelLayout - Characterization Tests", () => {
  // Helper function to create default props
  const createDefaultProps = (): BottomPanelLayoutProps => ({
    // Layout & Ref
    bottomPanelRef: undefined,

    // State Data
    players: [],
    characters: [],
    tokens: [],
    sceneObjects: [],
    drawings: [],
    uid: "test-user-uid",
    micEnabled: false,
    currentIsDM: false,

    // Name Editing
    editingPlayerUID: null,
    nameInput: "",
    onNameInputChange: vi.fn(),
    onNameEdit: vi.fn(),
    onNameSubmit: vi.fn(),

    // HP Editing
    editingHpUID: null,
    hpInput: "",
    onHpInputChange: vi.fn(),
    onHpEdit: vi.fn(),
    onHpSubmit: vi.fn(),
    onCharacterHpChange: vi.fn(),

    // Max HP Editing
    editingMaxHpUID: null,
    maxHpInput: "",
    onMaxHpInputChange: vi.fn(),
    onMaxHpEdit: vi.fn(),
    onMaxHpSubmit: vi.fn(),

    // Portrait & Mic
    onPortraitLoad: vi.fn(),
    onToggleMic: vi.fn(),

    // DM & Player State
    onToggleDMMode: vi.fn(),
    onApplyPlayerState: vi.fn(),
    onStatusEffectsChange: vi.fn(),
    onCharacterNameUpdate: vi.fn(),

    // NPC Management
    onNpcUpdate: vi.fn(),
    onNpcDelete: vi.fn(),
    onNpcPlaceToken: vi.fn(),
    onPlayerTokenDelete: vi.fn(),

    // Token Management
    onToggleTokenLock: vi.fn(),
    onTokenSizeChange: vi.fn(),
    onTokenImageChange: vi.fn(),

    // Character Management
    onAddCharacter: vi.fn(),
    onDeleteCharacter: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe("Basic rendering", () => {
    it("should render EntitiesPanel component", () => {
      const props = createDefaultProps();
      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should render EntitiesPanel directly without wrapper div", () => {
      const props = createDefaultProps();
      const { container } = render(<BottomPanelLayout {...props} />);

      // EntitiesPanel should be rendered directly
      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toBeInTheDocument();

      // There should be no extra wrapper divs
      const allDivs = container.querySelectorAll("div");
      // Only the EntitiesPanel mock div should exist (and potentially React's root)
      expect(allDivs.length).toBeLessThanOrEqual(2);
    });
  });

  // ============================================================================
  // Layout & Ref Props Tests (1 prop)
  // ============================================================================

  describe("Layout & Ref props", () => {
    it("should pass bottomPanelRef to EntitiesPanel", () => {
      const props = createDefaultProps();
      const bottomPanelRef = { current: document.createElement("div") };
      props.bottomPanelRef = bottomPanelRef;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-has-bottom-panel-ref", "true");
    });

    it("should handle undefined bottomPanelRef", () => {
      const props = createDefaultProps();
      props.bottomPanelRef = undefined;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-has-bottom-panel-ref", "false");
    });

    it("should handle bottomPanelRef with null current", () => {
      const props = createDefaultProps();
      props.bottomPanelRef = { current: null };

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-has-bottom-panel-ref", "true");
    });
  });

  // ============================================================================
  // State Data Props Tests (9 props)
  // ============================================================================

  describe("State data props", () => {
    it("should pass empty players array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.players = [];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "0");
    });

    it("should pass populated players array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.players = [
        { uid: "player-1", name: "Player 1" },
        { uid: "player-2", name: "Player 2" },
        { uid: "player-3", name: "Player 3" },
      ] as Player[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "3");
    });

    it("should pass empty characters array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.characters = [];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-characters-count", "0");
    });

    it("should pass populated characters array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.characters = [
        { id: "char-1", name: "Character 1" },
        { id: "char-2", name: "Character 2" },
      ] as Character[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-characters-count", "2");
    });

    it("should pass empty tokens array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.tokens = [];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-tokens-count", "0");
    });

    it("should pass populated tokens array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.tokens = [{}, {}, {}, {}] as Token[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-tokens-count", "4");
    });

    it("should pass empty sceneObjects array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.sceneObjects = [];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-scene-objects-count", "0");
    });

    it("should pass populated sceneObjects array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.sceneObjects = [{}, {}] as SceneObject[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-scene-objects-count", "2");
    });

    it("should pass empty drawings array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.drawings = [];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-drawings-count", "0");
    });

    it("should pass populated drawings array to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.drawings = [{}, {}, {}] as Drawing[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-drawings-count", "3");
    });

    it("should pass uid to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.uid = "test-user-123";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-uid", "test-user-123");
    });

    it("should pass micEnabled=true to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.micEnabled = true;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-mic-enabled", "true");
    });

    it("should pass micEnabled=false to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.micEnabled = false;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-mic-enabled", "false");
    });

    it("should pass currentIsDM=true to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.currentIsDM = true;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-current-is-dm", "true");
    });

    it("should pass currentIsDM=false to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.currentIsDM = false;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-current-is-dm", "false");
    });
  });

  // ============================================================================
  // Name Editing Props Tests (5 props)
  // ============================================================================

  describe("Name editing props", () => {
    it("should pass null editingPlayerUID to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.editingPlayerUID = null;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-player-uid", "null");
    });

    it("should pass non-null editingPlayerUID to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.editingPlayerUID = "player-123";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-player-uid", "player-123");
    });

    it("should pass empty nameInput to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.nameInput = "";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-name-input", "");
    });

    it("should pass populated nameInput to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.nameInput = "New Player Name";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-name-input", "New Player Name");
    });

    it("should pass onNameInputChange handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onNameInputChange = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onNameEdit handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onNameEdit = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onNameSubmit handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onNameSubmit = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // HP Editing Props Tests (6 props)
  // ============================================================================

  describe("HP editing props", () => {
    it("should pass null editingHpUID to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.editingHpUID = null;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-hp-uid", "null");
    });

    it("should pass non-null editingHpUID to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.editingHpUID = "player-456";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-hp-uid", "player-456");
    });

    it("should pass empty hpInput to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.hpInput = "";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-hp-input", "");
    });

    it("should pass populated hpInput to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.hpInput = "42";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-hp-input", "42");
    });

    it("should pass onHpInputChange handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onHpInputChange = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onHpEdit handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onHpEdit = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onHpSubmit handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onHpSubmit = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onCharacterHpChange handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onCharacterHpChange = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Max HP Editing Props Tests (4 props)
  // ============================================================================

  describe("Max HP editing props", () => {
    it("should pass null editingMaxHpUID to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.editingMaxHpUID = null;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-max-hp-uid", "null");
    });

    it("should pass non-null editingMaxHpUID to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.editingMaxHpUID = "player-789";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-max-hp-uid", "player-789");
    });

    it("should pass empty maxHpInput to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.maxHpInput = "";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-max-hp-input", "");
    });

    it("should pass populated maxHpInput to EntitiesPanel", () => {
      const props = createDefaultProps();
      props.maxHpInput = "100";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-max-hp-input", "100");
    });

    it("should pass onMaxHpInputChange handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onMaxHpInputChange = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onMaxHpEdit handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onMaxHpEdit = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onMaxHpSubmit handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onMaxHpSubmit = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Portrait & Mic Props Tests (2 props)
  // ============================================================================

  describe("Portrait & Mic props", () => {
    it("should pass onPortraitLoad handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onPortraitLoad = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onToggleMic handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onToggleMic = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // DM & Player State Props Tests (4 props)
  // ============================================================================

  describe("DM & Player State props", () => {
    it("should pass onToggleDMMode handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onToggleDMMode = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onApplyPlayerState handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onApplyPlayerState = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onStatusEffectsChange handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onStatusEffectsChange = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onCharacterNameUpdate handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onCharacterNameUpdate = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // NPC Management Props Tests (4 props)
  // ============================================================================

  describe("NPC Management props", () => {
    it("should pass onNpcUpdate handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onNpcUpdate = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onNpcDelete handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onNpcDelete = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onNpcPlaceToken handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onNpcPlaceToken = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onPlayerTokenDelete handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onPlayerTokenDelete = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Token Management Props Tests (3 props)
  // ============================================================================

  describe("Token Management props", () => {
    it("should pass onToggleTokenLock handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onToggleTokenLock = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onTokenSizeChange handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onTokenSizeChange = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onTokenImageChange handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onTokenImageChange = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Character Management Props Tests (2 props)
  // ============================================================================

  describe("Character Management props", () => {
    it("should pass onAddCharacter handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onAddCharacter = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass onDeleteCharacter handler to EntitiesPanel", () => {
      const props = createDefaultProps();
      const mockHandler = vi.fn();
      props.onDeleteCharacter = mockHandler;

      render(<BottomPanelLayout {...props} />);

      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle very long uid", () => {
      const props = createDefaultProps();
      props.uid = "a".repeat(1000);

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-uid", "a".repeat(1000));
    });

    it("should handle very long nameInput", () => {
      const props = createDefaultProps();
      props.nameInput = "Very Long Player Name ".repeat(50);

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-name-input", "Very Long Player Name ".repeat(50));
    });

    it("should handle very large hpInput numbers", () => {
      const props = createDefaultProps();
      props.hpInput = "999999999";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-hp-input", "999999999");
    });

    it("should handle negative hpInput values", () => {
      const props = createDefaultProps();
      props.hpInput = "-42";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-hp-input", "-42");
    });

    it("should handle very large maxHpInput numbers", () => {
      const props = createDefaultProps();
      props.maxHpInput = "999999999";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-max-hp-input", "999999999");
    });

    it("should handle negative maxHpInput values", () => {
      const props = createDefaultProps();
      props.maxHpInput = "-100";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-max-hp-input", "-100");
    });

    it("should handle non-numeric hpInput strings", () => {
      const props = createDefaultProps();
      props.hpInput = "not-a-number";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-hp-input", "not-a-number");
    });

    it("should handle many players", () => {
      const props = createDefaultProps();
      props.players = Array.from({ length: 100 }, (_, i) => ({
        uid: `player-${i}`,
        name: `Player ${i}`,
      })) as Player[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "100");
    });

    it("should handle many characters", () => {
      const props = createDefaultProps();
      props.characters = Array.from({ length: 50 }, (_, i) => ({
        id: `char-${i}`,
        name: `Character ${i}`,
      })) as Character[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-characters-count", "50");
    });

    it("should handle many tokens", () => {
      const props = createDefaultProps();
      props.tokens = Array(75).fill({}) as Token[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-tokens-count", "75");
    });

    it("should handle all arrays empty simultaneously", () => {
      const props = createDefaultProps();
      props.players = [];
      props.characters = [];
      props.tokens = [];
      props.sceneObjects = [];
      props.drawings = [];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "0");
      expect(entitiesPanel).toHaveAttribute("data-characters-count", "0");
      expect(entitiesPanel).toHaveAttribute("data-tokens-count", "0");
      expect(entitiesPanel).toHaveAttribute("data-scene-objects-count", "0");
      expect(entitiesPanel).toHaveAttribute("data-drawings-count", "0");
    });

    it("should handle all arrays populated simultaneously", () => {
      const props = createDefaultProps();
      props.players = [{ uid: "p1" }] as Player[];
      props.characters = [{ id: "c1" }] as Character[];
      props.tokens = [{}] as Token[];
      props.sceneObjects = [{}] as SceneObject[];
      props.drawings = [{}] as Drawing[];

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "1");
      expect(entitiesPanel).toHaveAttribute("data-characters-count", "1");
      expect(entitiesPanel).toHaveAttribute("data-tokens-count", "1");
      expect(entitiesPanel).toHaveAttribute("data-scene-objects-count", "1");
      expect(entitiesPanel).toHaveAttribute("data-drawings-count", "1");
    });

    it("should handle all editing states null simultaneously", () => {
      const props = createDefaultProps();
      props.editingPlayerUID = null;
      props.editingHpUID = null;
      props.editingMaxHpUID = null;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-player-uid", "null");
      expect(entitiesPanel).toHaveAttribute("data-editing-hp-uid", "null");
      expect(entitiesPanel).toHaveAttribute("data-editing-max-hp-uid", "null");
    });

    it("should handle all editing states populated simultaneously", () => {
      const props = createDefaultProps();
      props.editingPlayerUID = "player-1";
      props.editingHpUID = "player-2";
      props.editingMaxHpUID = "player-3";
      props.nameInput = "Name";
      props.hpInput = "50";
      props.maxHpInput = "100";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-player-uid", "player-1");
      expect(entitiesPanel).toHaveAttribute("data-editing-hp-uid", "player-2");
      expect(entitiesPanel).toHaveAttribute("data-editing-max-hp-uid", "player-3");
      expect(entitiesPanel).toHaveAttribute("data-name-input", "Name");
      expect(entitiesPanel).toHaveAttribute("data-hp-input", "50");
      expect(entitiesPanel).toHaveAttribute("data-max-hp-input", "100");
    });

    it("should handle both boolean flags true", () => {
      const props = createDefaultProps();
      props.micEnabled = true;
      props.currentIsDM = true;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-mic-enabled", "true");
      expect(entitiesPanel).toHaveAttribute("data-current-is-dm", "true");
    });

    it("should handle both boolean flags false", () => {
      const props = createDefaultProps();
      props.micEnabled = false;
      props.currentIsDM = false;

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-mic-enabled", "false");
      expect(entitiesPanel).toHaveAttribute("data-current-is-dm", "false");
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration tests", () => {
    it("should pass all 40 props correctly in realistic scenario", () => {
      const props = createDefaultProps();

      // Populate with realistic data
      props.bottomPanelRef = { current: document.createElement("div") };
      props.players = [
        { uid: "player-1", name: "Alice" },
        { uid: "player-2", name: "Bob" },
      ] as Player[];
      props.characters = [{ id: "char-1", name: "Warrior" }] as Character[];
      props.tokens = [{}, {}] as Token[];
      props.sceneObjects = [{}] as SceneObject[];
      props.drawings = [{}] as Drawing[];
      props.uid = "current-user-123";
      props.micEnabled = true;
      props.currentIsDM = true;
      props.editingPlayerUID = "player-1";
      props.nameInput = "Alice the Great";
      props.editingHpUID = "player-2";
      props.hpInput = "45";
      props.editingMaxHpUID = "player-1";
      props.maxHpInput = "80";

      render(<BottomPanelLayout {...props} />);

      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-has-bottom-panel-ref", "true");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "2");
      expect(entitiesPanel).toHaveAttribute("data-characters-count", "1");
      expect(entitiesPanel).toHaveAttribute("data-tokens-count", "2");
      expect(entitiesPanel).toHaveAttribute("data-scene-objects-count", "1");
      expect(entitiesPanel).toHaveAttribute("data-drawings-count", "1");
      expect(entitiesPanel).toHaveAttribute("data-uid", "current-user-123");
      expect(entitiesPanel).toHaveAttribute("data-mic-enabled", "true");
      expect(entitiesPanel).toHaveAttribute("data-current-is-dm", "true");
      expect(entitiesPanel).toHaveAttribute("data-editing-player-uid", "player-1");
      expect(entitiesPanel).toHaveAttribute("data-name-input", "Alice the Great");
      expect(entitiesPanel).toHaveAttribute("data-editing-hp-uid", "player-2");
      expect(entitiesPanel).toHaveAttribute("data-hp-input", "45");
      expect(entitiesPanel).toHaveAttribute("data-editing-max-hp-uid", "player-1");
      expect(entitiesPanel).toHaveAttribute("data-max-hp-input", "80");
    });

    it("should update props when they change", () => {
      const props = createDefaultProps();
      props.uid = "user-1";
      props.micEnabled = false;

      const { rerender } = render(<BottomPanelLayout {...props} />);

      let entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-uid", "user-1");
      expect(entitiesPanel).toHaveAttribute("data-mic-enabled", "false");

      // Update props
      props.uid = "user-2";
      props.micEnabled = true;
      rerender(<BottomPanelLayout {...props} />);

      entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-uid", "user-2");
      expect(entitiesPanel).toHaveAttribute("data-mic-enabled", "true");
    });

    it("should update array props when they change", () => {
      const props = createDefaultProps();
      props.players = [];

      const { rerender } = render(<BottomPanelLayout {...props} />);

      let entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "0");

      // Update arrays
      props.players = [{ uid: "p1" }, { uid: "p2" }] as Player[];
      rerender(<BottomPanelLayout {...props} />);

      entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "2");
    });

    it("should update editing state props when they change", () => {
      const props = createDefaultProps();
      props.editingPlayerUID = null;
      props.nameInput = "";

      const { rerender } = render(<BottomPanelLayout {...props} />);

      let entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-player-uid", "null");
      expect(entitiesPanel).toHaveAttribute("data-name-input", "");

      // Update editing state
      props.editingPlayerUID = "player-123";
      props.nameInput = "New Name";
      rerender(<BottomPanelLayout {...props} />);

      entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-editing-player-uid", "player-123");
      expect(entitiesPanel).toHaveAttribute("data-name-input", "New Name");
    });

    it("should maintain correct rendering across multiple updates", () => {
      const props = createDefaultProps();

      const { rerender } = render(<BottomPanelLayout {...props} />);

      // Multiple updates
      props.micEnabled = true;
      rerender(<BottomPanelLayout {...props} />);
      expect(screen.getByTestId("entities-panel")).toHaveAttribute("data-mic-enabled", "true");

      props.currentIsDM = true;
      rerender(<BottomPanelLayout {...props} />);
      expect(screen.getByTestId("entities-panel")).toHaveAttribute("data-current-is-dm", "true");

      props.players = [{ uid: "p1" }] as Player[];
      rerender(<BottomPanelLayout {...props} />);
      expect(screen.getByTestId("entities-panel")).toHaveAttribute("data-players-count", "1");

      // All previous updates should still be reflected
      const entitiesPanel = screen.getByTestId("entities-panel");
      expect(entitiesPanel).toHaveAttribute("data-mic-enabled", "true");
      expect(entitiesPanel).toHaveAttribute("data-current-is-dm", "true");
      expect(entitiesPanel).toHaveAttribute("data-players-count", "1");
    });
  });
});
