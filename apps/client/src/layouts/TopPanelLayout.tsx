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

import React, { Suspense } from "react";
import type { ToolMode } from "../components/layout/Header";
import type { UseDrawingStateManagerReturn } from "../hooks/useDrawingStateManager";
import type { MapEditToolbarProps } from "../features/map-edit/mapEditTypes";
import { ServerStatus } from "../components/layout/ServerStatus";
import { PublicTableNotice } from "../features/rooms/PublicTableNotice";
import { currentRoomId } from "../features/rooms/roomDirectory";
import { DrawingToolbar } from "../features/drawing/components";
import { Header } from "../components/layout/Header";
import { MultiSelectToolbar } from "../components/layout/MultiSelectToolbar";
import { Spinner } from "../components/ui/Spinner";

// Type alias for drawing toolbar props
type DrawingToolbarProps = UseDrawingStateManagerReturn["toolbarProps"];

// Lazy-load the map-edit palette so it stays out of the entry chunk (Golden
// Rule #7 — only the DM who opens map-edit mode loads it).
const MapEditToolbar = React.lazy(() =>
  import("../features/map-edit/MapEditToolbar").then((m) => ({ default: m.MapEditToolbar })),
);

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
  /** Whether live map-edit mode is active */
  mapEditMode: boolean;
  /** Props to pass to the (lazy) MapEditToolbar palette */
  mapEditToolbarProps: MapEditToolbarProps;

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
  /** Player lens (P4): the DM's view rendered as players receive it
   * (optional so the layout fixtures stay untouched). */
  playerLens?: boolean;
  /** Handler to toggle the player lens. */
  onTogglePlayerLens?: (enabled: boolean) => void;

  // ===== UI Handlers (3 props) =====
  /** Handler to toggle the dice roller panel */
  toggleDiceRoller: (value: boolean) => void;
  /** Handler to toggle the roll log panel */
  toggleRollLog: (value: boolean) => void;
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
    mapEditMode,
    mapEditToolbarProps,
    uid,
    activeTool,
    setActiveTool,
    snapToGrid,
    setSnapToGrid,
    crtFilter,
    setCrtFilter,
    diceRollerOpen,
    rollLogOpen,
    playerLens,
    onTogglePlayerLens,
    toggleDiceRoller,
    toggleRollLog,
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
        {/* Anyone who bookmarked the table URL never sees the join screen's
            notice, so the public/self-clearing fact is marked at the table too. */}
        {currentRoomId() === undefined ? <PublicTableNotice variant="chip" /> : null}

        {/* Drawing Toolbar - Fixed on left side when draw mode is active */}
        {drawMode && <DrawingToolbar {...drawingToolbarProps} />}

        {/* Map-edit palette - DM-only, lazy-loaded when map-edit mode is active */}
        {mapEditMode && isDM && (
          // Same reasoning as the DM menu: entering map-edit mode with a blank
          // toolbar strip reads as the mode not having engaged.
          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  color: "var(--jrpg-gold)",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                }}
              >
                <Spinner size={12} />
                Loading map tools…
              </div>
            }
          >
            <MapEditToolbar {...mapEditToolbarProps} />
          </Suspense>
        )}

        {/* Header - Fixed at top */}
        <Header
          uid={uid}
          snapToGrid={snapToGrid}
          activeTool={activeTool}
          crtFilter={crtFilter}
          diceRollerOpen={diceRollerOpen}
          rollLogOpen={rollLogOpen}
          isDM={isDM}
          playerLens={playerLens}
          onPlayerLensChange={onTogglePlayerLens}
          onSnapToGridChange={setSnapToGrid}
          onToolSelect={setActiveTool}
          onCrtFilterChange={setCrtFilter}
          onDiceRollerToggle={toggleDiceRoller}
          onRollLogToggle={toggleRollLog}
          topPanelRef={topPanelRef}
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
