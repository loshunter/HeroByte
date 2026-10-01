/**
 * TopPanelLayout Component
 *
 * Renders the top panel section of the main application layout, including:
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
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MapEditToolbarLoadFailure } from "../features/map-edit/MapEditToolbarLoadFailure";
import type { TableMenuProps } from "../features/table/tableMenuProps";
import { HostNextSteps } from "../features/table/HostNextSteps";
import { ReconnectNoticeDock } from "../features/table/ReconnectNotice";
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
 * 1. Table (name, role, connection, preferences)
 * 2. Tool State
 * 3. Header & Controls
 * 4. UI State & Toggles
 * 5. UI Handlers
 * 6. Layout
 * 7. Selection & Multi-Select
 */
export interface TopPanelLayoutProps {
  // ===== Table (1 prop) =====
  /**
   * The Table button's object: table name, your role, the connection and the
   * preferences behind it. The connection used to be a fixed badge drawn over
   * the top centre; it is the header's now.
   */
  tableMenu: TableMenuProps;

  // ===== Tool State (2 props) =====
  /** Whether drawing mode is currently active */
  drawMode: boolean;
  /** Props to pass to the DrawingToolbar component */
  drawingToolbarProps: DrawingToolbarProps;
  /** Whether live map-edit mode is active */
  mapEditMode: boolean;
  /** Props to pass to the (lazy) MapEditToolbar palette */
  mapEditToolbarProps: MapEditToolbarProps;

  // ===== Header & Controls (2 props) =====
  /** Currently active tool mode in the header */
  activeTool: ToolMode;
  /** Handler to change the active tool */
  setActiveTool: (mode: ToolMode) => void;

  // ===== UI State & Toggles (4 props) =====
  /** Whether snap-to-grid is enabled */
  snapToGrid: boolean;
  /** Handler to toggle snap-to-grid */
  setSnapToGrid: (value: boolean) => void;
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
    tableMenu,
    drawMode,
    drawingToolbarProps,
    mapEditMode,
    mapEditToolbarProps,
    activeTool,
    setActiveTool,
    snapToGrid,
    setSnapToGrid,
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
        {/* Drawing Toolbar - Fixed on left side when draw mode is active */}
        {drawMode && <DrawingToolbar {...drawingToolbarProps} />}

        {/* Map-edit palette - DM-only, lazy-loaded when map-edit mode is active */}
        {mapEditMode && isDM && (
          // Same reasoning as the DM menu: entering map-edit mode with a blank
          // toolbar strip reads as the mode not having engaged.
          //
          // The boundary is the DM menu's, arriving late. This Suspense has been
          // bare since it was written, so a 404'd chunk after a deploy threw
          // past it to the app root and replaced a live shared table with a
          // full-page error. M4c fixed exactly this for the DM chunk on both
          // layouts and did not reach the desktop palette.
          <ErrorBoundary
            fallback={<MapEditToolbarLoadFailure onClose={mapEditToolbarProps.onClose} />}
          >
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
          </ErrorBoundary>
        )}

        {/* Header - Fixed at top */}
        <Header
          table={tableMenu}
          snapToGrid={snapToGrid}
          activeTool={activeTool}
          diceRollerOpen={diceRollerOpen}
          rollLogOpen={rollLogOpen}
          playerLens={playerLens}
          onPlayerLensChange={onTogglePlayerLens}
          onSnapToGridChange={setSnapToGrid}
          onToolSelect={setActiveTool}
          onDiceRollerToggle={toggleDiceRoller}
          onRollLogToggle={toggleRollLog}
          topPanelRef={topPanelRef}
          onResetCamera={handleResetCamera}
        />

        {/* After a host creates a table: the next two steps, below the header, until dismissed. */}
        <HostNextSteps menu={tableMenu} placement={{ top: topHeight + 8 }} />

        {/* The gate's "Reconnecting…": below the header's measured bottom edge, above the floating
            windows (it used to be a fixed banner at the top right, over the header's controls). */}
        <ReconnectNoticeDock top={topHeight + 8} />

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
