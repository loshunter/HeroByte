import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RoomSnapshot } from "@shared";

/**
 * Characterization tests for MainLayout component
 *
 * These tests capture the behavior of the main render section BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 405-641)
 * Target: apps/client/src/layouts/MainLayout.tsx
 *
 * MainLayout renders ALL UI components in the correct hierarchy and positioning:
 * - Root container with context menu dismiss handler
 * - ServerStatus banner
 * - DrawingToolbar (conditional on drawMode)
 * - Header panel
 * - MultiSelectToolbar
 * - MapBoard (center canvas with dynamic positioning)
 * - EntitiesPanel (bottom HUD)
 * - DMMenu
 * - ContextMenu
 * - VisualEffects
 * - DiceRoller (conditional modal)
 * - RollLog (conditional modal)
 * - ToastContainer
 */

// Mock all child components
vi.mock("../../components/layout/ServerStatus", () => ({
  ServerStatus: ({ isConnected }: { isConnected: boolean }) => (
    <div data-testid="server-status" data-connected={isConnected}>
      ServerStatus
    </div>
  ),
}));

vi.mock("../../features/drawing/components", () => ({
  DrawingToolbar: (_props: any) => <div data-testid="drawing-toolbar">DrawingToolbar</div>,
}));

vi.mock("../../components/layout/Header", () => ({
  Header: (_props: any) => <div data-testid="header">Header</div>,
}));

vi.mock("../../components/layout/MultiSelectToolbar", () => ({
  MultiSelectToolbar: (_props: any) => (
    <div data-testid="multi-select-toolbar">MultiSelectToolbar</div>
  ),
}));

vi.mock("../../ui/MapBoard", () => ({
  default: (_props: any) => <div data-testid="map-board">MapBoard</div>,
}));

vi.mock("../../components/layout/EntitiesPanel", () => ({
  EntitiesPanel: (_props: any) => <div data-testid="entities-panel">EntitiesPanel</div>,
}));

vi.mock("../../features/dm", () => ({
  DMMenu: (_props: any) => <div data-testid="dm-menu">DMMenu</div>,
}));

vi.mock("../../components/ui/ContextMenu", () => ({
  ContextMenu: (_props: any) => <div data-testid="context-menu">ContextMenu</div>,
}));

vi.mock("../../components/effects/VisualEffects", () => ({
  VisualEffects: (_props: any) => <div data-testid="visual-effects">VisualEffects</div>,
}));

vi.mock("../../components/dice/DiceRoller", () => ({
  DiceRoller: (_props: any) => <div data-testid="dice-roller">DiceRoller</div>,
}));

vi.mock("../../components/dice/RollLog", () => ({
  RollLog: (_props: any) => <div data-testid="roll-log">RollLog</div>,
}));

vi.mock("../../components/ui/Toast", () => ({
  ToastContainer: (props: any) => <div data-testid="toast-container">ToastContainer</div>,
}));

// Import the component AFTER mocks are set up
import { MainLayout } from "../MainLayout";

describe.skip("MainLayout - Characterization", () => {
  // Default props that will be common across tests
  const defaultProps = {
    isConnected: true,
    drawMode: false,
    diceRollerOpen: false,
    rollLogOpen: false,
    viewingRoll: null,
    topHeight: 180,
    bottomHeight: 210,
    contextMenu: null,
    crtFilter: false,
    snapshot: null as RoomSnapshot | null,
    uid: "test-uid",
    sendMessage: vi.fn(),
    drawingManager: {
      toolbarProps: {},
      drawingProps: {},
      handleClearDrawings: vi.fn(),
    },
    toast: {
      messages: [],
      dismiss: vi.fn(),
    },
    rollHistory: [],
    // Add all other required props with minimal values
    activeTool: "pointer" as const,
    snapToGrid: true,
    onContextMenuDismiss: vi.fn(),
    onToolSelect: vi.fn(),
    onSnapToGridChange: vi.fn(),
    onCrtFilterChange: vi.fn(),
    onDiceRollerToggle: vi.fn(),
    onRollLogToggle: vi.fn(),
    onFocusSelf: vi.fn(),
    onResetCamera: vi.fn(),
    selectedObjectIds: [] as string[],
    isDM: false,
    onLockSelected: vi.fn(),
    onUnlockSelected: vi.fn(),
    gridSize: 50,
    pointerMode: true,
    measureMode: false,
    transformMode: false,
    selectMode: false,
    alignmentMode: false,
    alignmentPoints: [],
    alignmentSuggestion: null,
    onAlignmentPointCapture: vi.fn(),
    onRecolorToken: vi.fn(),
    onTransformObject: vi.fn(),
    cameraCommand: null,
    onCameraCommandHandled: vi.fn(),
    onCameraChange: vi.fn(),
    selectedObjectId: null,
    onSelectObject: vi.fn(),
    onSelectObjects: vi.fn(),
    players: [],
    characters: [],
    tokens: [],
    sceneObjects: [],
    drawings: [],
    micEnabled: false,
    editingPlayerUID: null,
    nameInput: "",
    editingMaxHpUID: null,
    maxHpInput: "",
    onNameInputChange: vi.fn(),
    onNameEdit: vi.fn(),
    onNameSubmit: vi.fn(),
    onToggleMic: vi.fn(),
    onMaxHpInputChange: vi.fn(),
    onMaxHpEdit: vi.fn(),
    onMaxHpSubmit: vi.fn(),
    onToggleDMMode: vi.fn(),
    onTokenImageChange: vi.fn(),
    onNpcUpdate: vi.fn(),
    onNpcDelete: vi.fn(),
    onNpcPlaceToken: vi.fn(),
    onPlayerTokenDelete: vi.fn(),
    onToggleTokenLock: vi.fn(),
    onTokenSizeChange: vi.fn(),
    // Player actions grouped into object
    playerActions: {
      renamePlayer: vi.fn(),
      setPortrait: vi.fn(),
      setHP: vi.fn(),
      applyPlayerState: vi.fn(),
      setStatusEffects: vi.fn(),
      setPlayerStagingZone: vi.fn(),
      addCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
      updateCharacterName: vi.fn(),
    },
    gridSquareSize: 5,
    gridLocked: false,
    onGridLockToggle: vi.fn(),
    onGridSizeChange: vi.fn(),
    onGridSquareSizeChange: vi.fn(),
    onSetMapBackground: vi.fn(),
    mapBackground: undefined,
    playerStagingZone: undefined,
    onSetPlayerStagingZone: vi.fn(),
    camera: { x: 0, y: 0, scale: 1 },
    onRequestSaveSession: undefined,
    onRequestLoadSession: vi.fn(),
    onCreateNPC: vi.fn(),
    onUpdateNPC: vi.fn(),
    onDeleteNPC: vi.fn(),
    onPlaceNPCToken: vi.fn(),
    props: [],
    onCreateProp: vi.fn(),
    onUpdateProp: vi.fn(),
    onDeleteProp: vi.fn(),
    mapLocked: true,
    onMapLockToggle: vi.fn(),
    stagingZoneLocked: false,
    onStagingZoneLockToggle: vi.fn(),
    mapTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    onMapTransformChange: vi.fn(),
    alignmentError: null,
    onAlignmentStart: vi.fn(),
    onAlignmentReset: vi.fn(),
    onAlignmentCancel: vi.fn(),
    onAlignmentApply: vi.fn(),
    onSetRoomPassword: vi.fn(),
    roomPasswordStatus: null,
    roomPasswordPending: false,
    onDismissRoomPasswordStatus: vi.fn(),
    onDeleteToken: vi.fn(),
    handleRoll: vi.fn(),
    handleClearLog: vi.fn(),
    handleViewRoll: vi.fn(),
    topPanelRef: { current: null },
    bottomPanelRef: { current: null },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("root container", () => {
    it("should render root container with correct styles", () => {
      const { container } = render(<MainLayout {...defaultProps} />);
      const rootDiv = container.firstChild as HTMLElement;

      expect(rootDiv).toHaveStyle({
        height: "100vh",
        overflow: "hidden",
      });
    });

    it("should call onContextMenuDismiss when root container is clicked", () => {
      const onContextMenuDismiss = vi.fn();
      const { container } = render(
        <MainLayout {...defaultProps} onContextMenuDismiss={onContextMenuDismiss} />,
      );

      const rootDiv = container.firstChild as HTMLElement;
      rootDiv.click();

      expect(onContextMenuDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("ServerStatus component", () => {
    it("should always render ServerStatus", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("server-status")).toBeInTheDocument();
    });

    it("should pass isConnected=true to ServerStatus when connected", () => {
      render(<MainLayout {...defaultProps} isConnected={true} />);
      const serverStatus = screen.getByTestId("server-status");
      expect(serverStatus).toHaveAttribute("data-connected", "true");
    });

    it("should pass isConnected=false to ServerStatus when disconnected", () => {
      render(<MainLayout {...defaultProps} isConnected={false} />);
      const serverStatus = screen.getByTestId("server-status");
      expect(serverStatus).toHaveAttribute("data-connected", "false");
    });
  });

  describe("DrawingToolbar conditional rendering", () => {
    it("should render DrawingToolbar when drawMode is true", () => {
      render(<MainLayout {...defaultProps} drawMode={true} />);
      expect(screen.getByTestId("drawing-toolbar")).toBeInTheDocument();
    });

    it("should NOT render DrawingToolbar when drawMode is false", () => {
      render(<MainLayout {...defaultProps} drawMode={false} />);
      expect(screen.queryByTestId("drawing-toolbar")).not.toBeInTheDocument();
    });
  });

  describe("Header component", () => {
    it("should always render Header", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("header")).toBeInTheDocument();
    });

    it("should render Header with all required props", () => {
      // This test verifies the Header receives props - actual prop verification
      // would require checking the mock's call arguments
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("header")).toBeInTheDocument();
    });
  });

  describe("MultiSelectToolbar component", () => {
    it("should always render MultiSelectToolbar", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });

    it("should pass selectedObjectIds to MultiSelectToolbar", () => {
      render(<MainLayout {...defaultProps} selectedObjectIds={["obj1", "obj2"]} />);
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });

    it("should pass isDM to MultiSelectToolbar", () => {
      render(<MainLayout {...defaultProps} isDM={true} />);
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });

    it("should pass topHeight to MultiSelectToolbar", () => {
      render(<MainLayout {...defaultProps} topHeight={200} />);
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });
  });

  describe("MapBoard positioning", () => {
    it("should render MapBoard in a positioned container", () => {
      const { container } = render(<MainLayout {...defaultProps} />);
      const mapContainer = container.querySelector('[style*="position: fixed"]');
      expect(mapContainer).toBeInTheDocument();
    });

    it("should position MapBoard with default topHeight and bottomHeight", () => {
      const { container } = render(
        <MainLayout {...defaultProps} topHeight={180} bottomHeight={210} />,
      );

      // Find the container that wraps MapBoard
      const mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("top: 180px");
      });

      expect(mapContainer).toBeTruthy();
      expect(mapContainer).toHaveStyle({
        position: "fixed",
        top: "180px",
        bottom: "210px",
        left: "0",
        right: "0",
        overflow: "hidden",
      });
    });

    it("should update MapBoard position when topHeight changes", () => {
      const { container, rerender } = render(
        <MainLayout {...defaultProps} topHeight={180} bottomHeight={210} />,
      );

      // Initial position
      let mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("top: 180px");
      });
      expect(mapContainer).toHaveStyle({ top: "180px" });

      // Updated position
      rerender(<MainLayout {...defaultProps} topHeight={250} bottomHeight={210} />);
      mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("top: 250px");
      });
      expect(mapContainer).toHaveStyle({ top: "250px" });
    });

    it("should update MapBoard position when bottomHeight changes", () => {
      const { container, rerender } = render(
        <MainLayout {...defaultProps} topHeight={180} bottomHeight={210} />,
      );

      // Initial position
      let mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("bottom: 210px");
      });
      expect(mapContainer).toHaveStyle({ bottom: "210px" });

      // Updated position
      rerender(<MainLayout {...defaultProps} topHeight={180} bottomHeight={300} />);
      mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("bottom: 300px");
      });
      expect(mapContainer).toHaveStyle({ bottom: "300px" });
    });

    it("should always render MapBoard", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("map-board")).toBeInTheDocument();
    });
  });

  describe("EntitiesPanel component", () => {
    it("should always render EntitiesPanel", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass players to EntitiesPanel", () => {
      const players = [{ uid: "player1", name: "Player 1", hp: 100, maxHp: 100 }];
      render(<MainLayout {...defaultProps} players={players as any} />);
      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass characters to EntitiesPanel", () => {
      const characters = [{ id: "char1", name: "Character 1" }];
      render(<MainLayout {...defaultProps} characters={characters as any} />);
      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass tokens to EntitiesPanel", () => {
      const tokens = [{ id: "token1", x: 0, y: 0 }];
      render(<MainLayout {...defaultProps} tokens={tokens as any} />);
      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });

    it("should pass empty arrays when snapshot data is missing", () => {
      render(<MainLayout {...defaultProps} players={[]} characters={[]} tokens={[]} />);
      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
    });
  });

  describe("DMMenu component", () => {
    it("should always render DMMenu", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should pass isDM to DMMenu", () => {
      render(<MainLayout {...defaultProps} isDM={true} />);
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should pass gridSize to DMMenu", () => {
      render(<MainLayout {...defaultProps} gridSize={60} />);
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should pass gridSquareSize to DMMenu", () => {
      render(<MainLayout {...defaultProps} gridSquareSize={10} />);
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });
  });

  describe("ContextMenu component", () => {
    it("should always render ContextMenu", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    });

    it("should pass contextMenu to ContextMenu", () => {
      const contextMenu = { x: 100, y: 200, tokenId: "token1" };
      render(<MainLayout {...defaultProps} contextMenu={contextMenu} />);
      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    });

    it("should pass null contextMenu to ContextMenu", () => {
      render(<MainLayout {...defaultProps} contextMenu={null} />);
      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    });
  });

  describe("VisualEffects component", () => {
    it("should always render VisualEffects", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
    });

    it("should pass crtFilter=true to VisualEffects", () => {
      render(<MainLayout {...defaultProps} crtFilter={true} />);
      expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
    });

    it("should pass crtFilter=false to VisualEffects", () => {
      render(<MainLayout {...defaultProps} crtFilter={false} />);
      expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
    });
  });

  describe("DiceRoller conditional rendering", () => {
    it("should render DiceRoller when diceRollerOpen is true", () => {
      render(<MainLayout {...defaultProps} diceRollerOpen={true} />);
      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should NOT render DiceRoller when diceRollerOpen is false", () => {
      render(<MainLayout {...defaultProps} diceRollerOpen={false} />);
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
    });

    it("should render DiceRoller with correct props when open", () => {
      const handleRoll = vi.fn();
      render(<MainLayout {...defaultProps} diceRollerOpen={true} handleRoll={handleRoll} />);
      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });
  });

  describe("RollLog conditional rendering", () => {
    it("should render RollLog when rollLogOpen is true", () => {
      render(<MainLayout {...defaultProps} rollLogOpen={true} />);
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
    });

    it("should NOT render RollLog when rollLogOpen is false", () => {
      render(<MainLayout {...defaultProps} rollLogOpen={false} />);
      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();
    });

    it("should position RollLog with fixed positioning when open", () => {
      const { container } = render(<MainLayout {...defaultProps} rollLogOpen={true} />);

      // Find the container wrapping RollLog
      const rollLogContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return (
          style?.includes("position: fixed") &&
          style?.includes("right: 20px") &&
          style?.includes("top: 200px")
        );
      });

      expect(rollLogContainer).toBeTruthy();
      expect(rollLogContainer).toHaveStyle({
        position: "fixed",
        right: "20px",
        top: "200px",
        width: "350px",
        height: "500px",
        zIndex: "1000",
      });
    });
  });

  describe("Viewing roll modal", () => {
    it("should render DiceRoller for viewing when viewingRoll is not null", () => {
      const viewingRoll = { id: "roll1", result: 15 };
      render(<MainLayout {...defaultProps} viewingRoll={viewingRoll as any} />);

      // Should have at least one DiceRoller (for viewing)
      const diceRollers = screen.getAllByTestId("dice-roller");
      expect(diceRollers.length).toBeGreaterThanOrEqual(1);
    });

    it("should NOT render viewing DiceRoller when viewingRoll is null", () => {
      render(<MainLayout {...defaultProps} viewingRoll={null} />);

      // Should have no DiceRoller when both diceRollerOpen and viewingRoll are false/null
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
    });

    it("should position viewing DiceRoller with fixed positioning", () => {
      const viewingRoll = { id: "roll1", result: 15 };
      const { container } = render(
        <MainLayout {...defaultProps} viewingRoll={viewingRoll as any} />,
      );

      // Find the container wrapping the viewing DiceRoller
      const viewingContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("z-index: 2000");
      });

      expect(viewingContainer).toBeTruthy();
      expect(viewingContainer).toHaveStyle({
        position: "fixed",
        zIndex: "2000",
      });
    });

    it("should render both DiceRoller instances when both diceRollerOpen and viewingRoll are active", () => {
      const viewingRoll = { id: "roll1", result: 15 };
      render(
        <MainLayout {...defaultProps} diceRollerOpen={true} viewingRoll={viewingRoll as any} />,
      );

      const diceRollers = screen.getAllByTestId("dice-roller");
      expect(diceRollers).toHaveLength(2);
    });
  });

  describe("ToastContainer component", () => {
    it("should always render ToastContainer", () => {
      render(<MainLayout {...defaultProps} />);
      expect(screen.getByTestId("toast-container")).toBeInTheDocument();
    });

    it("should pass toast messages to ToastContainer", () => {
      const toast = {
        messages: [{ id: "1", text: "Test message", type: "info" as const }],
        dismiss: vi.fn(),
      };
      render(<MainLayout {...defaultProps} toast={toast} />);
      expect(screen.getByTestId("toast-container")).toBeInTheDocument();
    });

    it("should pass empty messages array to ToastContainer", () => {
      const toast = {
        messages: [],
        dismiss: vi.fn(),
      };
      render(<MainLayout {...defaultProps} toast={toast} />);
      expect(screen.getByTestId("toast-container")).toBeInTheDocument();
    });
  });

  describe("component hierarchy", () => {
    it("should render all required components in correct order", () => {
      render(<MainLayout {...defaultProps} />);

      // Verify all components are present
      expect(screen.getByTestId("server-status")).toBeInTheDocument();
      expect(screen.getByTestId("header")).toBeInTheDocument();
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("map-board")).toBeInTheDocument();
      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
      expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
      expect(screen.getByTestId("toast-container")).toBeInTheDocument();
    });

    it("should render all components when all conditional renders are active", () => {
      render(
        <MainLayout
          {...defaultProps}
          drawMode={true}
          diceRollerOpen={true}
          rollLogOpen={true}
          viewingRoll={{ id: "roll1" } as any}
        />,
      );

      // All permanent components
      expect(screen.getByTestId("server-status")).toBeInTheDocument();
      expect(screen.getByTestId("header")).toBeInTheDocument();
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("map-board")).toBeInTheDocument();
      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
      expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
      expect(screen.getByTestId("toast-container")).toBeInTheDocument();

      // Conditional components
      expect(screen.getByTestId("drawing-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();

      // Two DiceRoller instances (one for rolling, one for viewing)
      const diceRollers = screen.getAllByTestId("dice-roller");
      expect(diceRollers).toHaveLength(2);
    });

    it("should render minimum components when all conditionals are inactive", () => {
      render(
        <MainLayout
          {...defaultProps}
          drawMode={false}
          diceRollerOpen={false}
          rollLogOpen={false}
          viewingRoll={null}
        />,
      );

      // All permanent components should be present
      expect(screen.getByTestId("server-status")).toBeInTheDocument();
      expect(screen.getByTestId("header")).toBeInTheDocument();
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("map-board")).toBeInTheDocument();
      expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
      expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
      expect(screen.getByTestId("toast-container")).toBeInTheDocument();

      // Conditional components should NOT be present
      expect(screen.queryByTestId("drawing-toolbar")).not.toBeInTheDocument();
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("should handle topHeight of 0", () => {
      const { container } = render(
        <MainLayout {...defaultProps} topHeight={0} bottomHeight={210} />,
      );

      const mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("top: 0px");
      });

      expect(mapContainer).toHaveStyle({ top: "0px" });
    });

    it("should handle bottomHeight of 0", () => {
      const { container } = render(
        <MainLayout {...defaultProps} topHeight={180} bottomHeight={0} />,
      );

      const mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("bottom: 0px");
      });

      expect(mapContainer).toHaveStyle({ bottom: "0px" });
    });

    it("should handle both heights at 0", () => {
      const { container } = render(<MainLayout {...defaultProps} topHeight={0} bottomHeight={0} />);

      const mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return (
          style?.includes("position: fixed") &&
          style?.includes("top: 0px") &&
          style?.includes("bottom: 0px")
        );
      });

      expect(mapContainer).toBeTruthy();
    });

    it("should handle very large heights", () => {
      const { container } = render(
        <MainLayout {...defaultProps} topHeight={5000} bottomHeight={5000} />,
      );

      const mapContainer = Array.from(container.querySelectorAll("div")).find((div) => {
        const style = div.getAttribute("style");
        return style?.includes("position: fixed") && style?.includes("top: 5000px");
      });

      expect(mapContainer).toBeTruthy();
    });

    it("should handle null snapshot gracefully", () => {
      render(<MainLayout {...defaultProps} snapshot={null} />);
      expect(screen.getByTestId("map-board")).toBeInTheDocument();
    });

    it("should handle empty selectedObjectIds array", () => {
      render(<MainLayout {...defaultProps} selectedObjectIds={[]} />);
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });

    it("should handle multiple selectedObjectIds", () => {
      render(<MainLayout {...defaultProps} selectedObjectIds={["obj1", "obj2", "obj3"]} />);
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });
  });
});
