/**
 * CenterCanvasLayout Component
 *
 * Renders the center canvas area containing the MapBoard.
 * This component manages the fixed-position wrapper that fills the space
 * between the top and bottom panels, containing the main game board canvas.
 *
 * Part of Phase 15 SOLID Refactor Initiative - MainLayout Decomposition
 * Extracted from: apps/client/src/layouts/MainLayout.tsx (lines 566-605)
 *
 * @remarks
 * This is a pure presentation component that receives all MapBoard state
 * and handlers as props. It handles:
 * - Fixed positioning between dynamic top/bottom panels
 * - MapBoard rendering with complete prop forwarding
 * - No internal state management
 *
 * The wrapper div uses fixed positioning with dynamic top/bottom values
 * to ensure the canvas fills the available space between the header and
 * footer panels.
 */

import React from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import type { CameraCommand } from "../ui/MapBoard";
import type { UseDrawingStateManagerReturn } from "../hooks/useDrawingStateManager";
import MapBoard from "../ui/MapBoard";

// Type alias for drawing board props
type DrawingBoardProps = UseDrawingStateManagerReturn["drawingProps"];

/**
 * Props for CenterCanvasLayout component
 *
 * Organized into 9 semantic groups:
 * 1. Layout Positioning - Dynamic spacing from top/bottom panels
 * 2. Core MapBoard Data - Essential room and grid state
 * 3. Tool Modes - Six mutually-exclusive interaction modes
 * 4. Selection State - Object selection and handlers
 * 5. Camera Control - View positioning and zoom
 * 6. Alignment Mode - Alignment tool state and handlers
 * 7. Scene Object Actions - Token and object manipulation
 * 8. Drawing Props - Complete drawing tool state (spread)
 * 9. WebSocket Communication - Server message sending
 */
export interface CenterCanvasLayoutProps {
  // Layout Positioning (2 props)
  /** Height of the top panel in pixels */
  topHeight: number;
  /** Height of the bottom panel in pixels */
  bottomHeight: number;

  // Core MapBoard Data (5 props)
  /** Current room snapshot containing all scene state */
  snapshot: RoomSnapshot | null;
  /** Current user's unique identifier */
  uid: string;
  /** Grid size in pixels (e.g., 50 for 50x50 grid squares) */
  gridSize: number;
  /** Whether objects should snap to grid when dragged */
  snapToGrid: boolean;
  /** Whether the current user is the dungeon master */
  isDM: boolean;

  // Tool Modes (6 props)
  /** Whether pointer mode is active (default interaction) */
  pointerMode: boolean;
  /** Whether measure mode is active (distance measurement) */
  measureMode: boolean;
  /** Whether draw mode is active (freehand drawing) */
  drawMode: boolean;
  /** Whether transform mode is active (object manipulation) */
  transformMode: boolean;
  /** Whether select mode is active (multi-object selection) */
  selectMode: boolean;
  /** Whether alignment mode is active (alignment assistance) */
  alignmentMode: boolean;

  // Selection State (4 props)
  /** Currently selected single object ID (or null if none) */
  selectedObjectId: string | null;
  /** Array of selected object IDs for multi-selection */
  selectedObjectIds: string[];
  /** Handler for single object selection */
  onSelectObject: (id: string | null) => void;
  /** Handler for batch object selection */
  onSelectObjects: (ids: string[]) => void;

  // Camera Control (3 props)
  /** Current camera command to execute (pan, zoom, focus, etc.) */
  cameraCommand: CameraCommand | null;
  /** Handler called when camera command is completed */
  onCameraCommandHandled: () => void;
  /** Handler for camera state changes (position and zoom) */
  onCameraChange: (state: { x: number; y: number; scale: number }) => void;

  // Alignment Mode (3 props)
  /** Array of captured alignment points */
  alignmentPoints: AlignmentPoint[];
  /** Current alignment suggestion (or null if none) */
  alignmentSuggestion: AlignmentSuggestion | null;
  /** Handler for capturing new alignment points */
  onAlignmentPointCapture: (point: AlignmentPoint) => void;

  // Scene Object Actions (2 props)
  /** Handler for recoloring tokens */
  onRecolorToken: (sceneId: string, owner?: string | null) => void;
  /** Handler for transforming scene objects (move, scale, rotate) */
  onTransformObject: (input: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;

  // Drawing Props (spread)
  /** Complete drawing tool state and handlers */
  drawingProps: DrawingBoardProps;

  // WebSocket Communication (1 prop)
  /** Handler for sending WebSocket messages to server */
  sendMessage: (message: ClientMessage) => void;
}

/**
 * CenterCanvasLayout Component
 *
 * Renders the main canvas area with MapBoard, positioned between
 * fixed top and bottom panels.
 *
 * @param props - CenterCanvasLayoutProps with all MapBoard state and handlers
 * @returns Fixed-position wrapper containing MapBoard
 *
 * @example
 * ```tsx
 * <CenterCanvasLayout
 *   topHeight={180}
 *   bottomHeight={210}
 *   snapshot={roomSnapshot}
 *   uid="player-123"
 *   gridSize={50}
 *   snapToGrid={true}
 *   isDM={false}
 *   pointerMode={true}
 *   measureMode={false}
 *   drawMode={false}
 *   transformMode={false}
 *   selectMode={false}
 *   alignmentMode={false}
 *   selectedObjectId={null}
 *   selectedObjectIds={[]}
 *   onSelectObject={handleSelectObject}
 *   onSelectObjects={handleSelectObjects}
 *   cameraCommand={null}
 *   onCameraCommandHandled={handleCameraCommandHandled}
 *   onCameraChange={handleCameraChange}
 *   alignmentPoints={[]}
 *   alignmentSuggestion={null}
 *   onAlignmentPointCapture={handleAlignmentPointCapture}
 *   onRecolorToken={handleRecolorToken}
 *   onTransformObject={handleTransformObject}
 *   drawingProps={drawingProps}
 *   sendMessage={sendMessage}
 * />
 * ```
 */
export const CenterCanvasLayout: React.FC<CenterCanvasLayoutProps> = React.memo(
  ({
    topHeight,
    bottomHeight,
    snapshot,
    uid,
    gridSize,
    snapToGrid,
    isDM,
    pointerMode,
    measureMode,
    drawMode,
    transformMode,
    selectMode,
    alignmentMode,
    selectedObjectId,
    selectedObjectIds,
    onSelectObject,
    onSelectObjects,
    cameraCommand,
    onCameraCommandHandled,
    onCameraChange,
    alignmentPoints,
    alignmentSuggestion,
    onAlignmentPointCapture,
    onRecolorToken,
    onTransformObject,
    drawingProps,
    sendMessage,
  }) => {
    return (
      <div
        style={{
          position: "fixed",
          top: `${topHeight}px`,
          bottom: `${bottomHeight}px`,
          left: 0,
          right: 0,
          overflow: "hidden",
        }}
      >
        <MapBoard
          snapshot={snapshot}
          sendMessage={sendMessage}
          uid={uid}
          gridSize={gridSize}
          snapToGrid={snapToGrid}
          pointerMode={pointerMode}
          measureMode={measureMode}
          drawMode={drawMode}
          transformMode={transformMode}
          selectMode={selectMode}
          isDM={isDM}
          alignmentMode={alignmentMode}
          alignmentPoints={alignmentPoints}
          alignmentSuggestion={alignmentSuggestion}
          onAlignmentPointCapture={onAlignmentPointCapture}
          {...drawingProps}
          onRecolorToken={onRecolorToken}
          onTransformObject={onTransformObject}
          cameraCommand={cameraCommand}
          onCameraCommandHandled={onCameraCommandHandled}
          onCameraChange={onCameraChange}
          selectedObjectId={selectedObjectId}
          selectedObjectIds={selectedObjectIds}
          onSelectObject={onSelectObject}
          onSelectObjects={onSelectObjects}
        />
      </div>
    );
  }
);

CenterCanvasLayout.displayName = "CenterCanvasLayout";
