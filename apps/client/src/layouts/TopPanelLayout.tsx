/**
 * TopPanelLayout Component
 *
 * Renders the top panel section of the main application layout, including:
 * - Server connection status indicator
 * - Drawing toolbar (when draw mode is active)
 * - Main application header with controls
 * - Multi-select toolbar (when multiple objects are selected)
 *
 * Part of MainLayout decomposition (795 LOC → <200 LOC)
 * Extracted from: MainLayout.tsx lines 544-574
 *
 * @remarks
 * This is a pure presentation component that receives all state and handlers
 * as props. It composes the top section UI elements without managing any
 * internal state, following separation of concerns principles.
 */

import React from "react";
import type { ToolMode } from "../components/layout/Header";
import type { UseDrawingStateManagerReturn } from "../hooks/useDrawingStateManager";
import { ServerStatus } from "../components/layout/ServerStatus";
import { DrawingToolbar } from "../features/drawing/components";
import { Header } from "../components/layout/Header";
import { MultiSelectToolbar } from "../components/layout/MultiSelectToolbar";

// Type alias for drawing toolbar props
type DrawingToolbarProps = UseDrawingStateManagerReturn["toolbarProps"];

/**
 * Props for the TopPanelLayout component
 *
 * Organized into 8 semantic groups for clarity:
 * 1. Connection & Status
 * 2. Tool State
 * 3. Header & Controls
 * 4. UI State & Toggles
 * 5. UI Handlers
 * 6. Layout
 * 7. Selection & Multi-Select
 */
export interface TopPanelLayoutProps {
  // ===== Connection & Status (1 prop) =====
  /** Whether the client is connected to the server */
  isConnected: boolean;

  // ===== Tool State (2 props) =====
  /** Whether drawing mode is currently active */
  drawMode: boolean;
  /** Props to pass to the DrawingToolbar component */
  drawingToolbarProps: DrawingToolbarProps;

  // ===== Header & Controls (3 props) =====
  /** Unique identifier for the current user */
  uid: string;
  /** Currently active tool mode in the header */
  activeTool: ToolMode;
  /** Handler to change the active tool */
  setActiveTool: (mode: ToolMode) => void;

  // ===== UI State & Toggles (6 props) =====
  /** Whether snap-to-grid is enabled */
  snapToGrid: boolean;
  /** Handler to toggle snap-to-grid */
  setSnapToGrid: (value: boolean) => void;
  /** Whether CRT filter effect is enabled */
  crtFilter: boolean;
  /** Handler to toggle CRT filter */
  setCrtFilter: (value: boolean) => void;
  /** Whether the dice roller panel is open */
  diceRollerOpen: boolean;
  /** Whether the roll log panel is open */
  rollLogOpen: boolean;

  // ===== UI Handlers (4 props) =====
  /** Handler to toggle the dice roller panel */
  toggleDiceRoller: (value: boolean) => void;
  /** Handler to toggle the roll log panel */
  toggleRollLog: (value: boolean) => void;
  /** Handler to focus the camera on the current user's token */
  handleFocusSelf: () => void;
  /** Handler to reset the camera to default position */
  handleResetCamera: () => void;

  // ===== Layout (2 props) =====
  /** Reference to the top panel DOM element for height measurement */
  topPanelRef: React.RefObject<HTMLDivElement>;
  /** Measured height of the top panel in pixels */
  topHeight: number;

  // ===== Selection & Multi-Select (4 props) =====
  /** Array of IDs for currently selected objects */
  selectedObjectIds: string[];
  /** Whether the current user is the Dungeon Master */
  isDM: boolean;
  /** Handler to lock the selected objects */
  lockSelected: () => void;
  /** Handler to unlock the selected objects */
  unlockSelected: () => void;
}

/**
 * TopPanelLayout Component
 *
 * Renders the top panel section including server status, drawing toolbar,
 * main header, and multi-select toolbar.
 */
export const TopPanelLayout = React.memo<TopPanelLayoutProps>(
  ({
    isConnected,
    drawMode,
    drawingToolbarProps,
    uid,
    activeTool,
    setActiveTool,
    snapToGrid,
    setSnapToGrid,
    crtFilter,
    setCrtFilter,
    diceRollerOpen,
    rollLogOpen,
    toggleDiceRoller,
    toggleRollLog,
    handleFocusSelf,
    handleResetCamera,
    topPanelRef,
    topHeight,
    selectedObjectIds,
    isDM,
    lockSelected,
    unlockSelected,
  }) => {
    return (
      <>
        <ServerStatus isConnected={isConnected} />

        {/* Drawing Toolbar - Fixed on left side when draw mode is active */}
        {drawMode && <DrawingToolbar {...drawingToolbarProps} />}

        {/* Header - Fixed at top */}
        <Header
          uid={uid}
          snapToGrid={snapToGrid}
          activeTool={activeTool}
          crtFilter={crtFilter}
          diceRollerOpen={diceRollerOpen}
          rollLogOpen={rollLogOpen}
          onSnapToGridChange={setSnapToGrid}
          onToolSelect={setActiveTool}
          onCrtFilterChange={setCrtFilter}
          onDiceRollerToggle={toggleDiceRoller}
          onRollLogToggle={toggleRollLog}
          topPanelRef={topPanelRef}
          onFocusSelf={handleFocusSelf}
          onResetCamera={handleResetCamera}
        />

        {/* Multi-select toolbar - shows when multiple objects are selected and user is DM */}
        <MultiSelectToolbar
          selectedObjectIds={selectedObjectIds}
          isDM={isDM}
          topHeight={topHeight}
          onLock={lockSelected}
          onUnlock={unlockSelected}
        />
      </>
    );
  },
);

TopPanelLayout.displayName = "TopPanelLayout";
