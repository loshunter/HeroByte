/**
 * Prop and return types for useStageEventRouter — split out at the 350-LOC
 * structure guard (the MapBoard.types.ts idiom).
 */

import type { RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { PointerInput } from "../features/map-edit/useMapEditTool";

/**
 * Props for useStageEventRouter hook
 */
export interface UseStageEventRouterProps {
  // Tool mode flags
  alignmentMode: boolean;
  selectMode: boolean;
  pointerMode: boolean;
  measureMode: boolean;
  drawMode: boolean;
  mapEditMode: boolean;
  /** Map-edit with a drag or brush sub-tool — the subset the touch path arms. */
  mapEditTouchMode: boolean;
  /** One-shot atlas-link placement aim (A6) — same priority slot as alignment. */
  linkAimMode: boolean;

  // Click handlers
  handleAlignmentClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;
  handleLinkAimClick: () => void;
  handlePointerClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;

  // Mouse down handlers
  handleCameraMouseDown: (
    event: KonvaEventObject<PointerEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => void;
  handleDrawMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleMapEditMouseDown: (stageRef: RefObject<Konva.Stage | null>, input?: PointerInput) => void;
  handleMarqueePointerDown: (event: KonvaEventObject<PointerEvent>) => void;

  // Mouse move handlers
  handleCameraMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handlePointerMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleDrawMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleMapEditMouseMove: (stageRef: RefObject<Konva.Stage | null>, input?: PointerInput) => void;
  handleMarqueePointerMove: () => void;

  // Mouse up handlers
  handleCameraMouseUp: () => void;
  handleDrawMouseUp: () => void;
  handleMapEditMouseUp: (input?: PointerInput) => void;
  handleMarqueePointerUp: () => void;

  /** Discard an in-progress stroke (a second finger, or an OS interrupt). */
  handleDrawCancel: () => void;
  /** Discard an in-progress marquee, same triggers. */
  handleMarqueeCancel: () => void;
  /** Discard an in-progress map-edit drag, same triggers. */
  handleMapEditCancel: () => void;

  // Touch handlers
  handleTouchStart: (
    e: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => void;
  handleTouchMove: (
    e: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
  ) => void;
  handleTouchEnd: () => void;

  // Marquee state
  isMarqueeActive: boolean;

  // Selection handlers
  onSelectObject?: ((id: string | null) => void) | undefined;
  deselectIfEmpty: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;

  // Double tap handler
  handleDoubleTap?: (event: KonvaEventObject<MouseEvent | PointerEvent | TouchEvent>) => void;

  // Stage reference
  stageRef: RefObject<Konva.Stage | null>;
}

/**
 * Return type for useStageEventRouter hook
 */
export interface UseStageEventRouterReturn {
  onStageClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;
  onTap: (event: KonvaEventObject<TouchEvent>) => void;
  onMouseDown: (event: KonvaEventObject<PointerEvent>) => void;
  onMouseMove: () => void;
  onMouseUp: () => void;
  onTouchStart: (event: KonvaEventObject<TouchEvent>) => void;
  onTouchMove: (event: KonvaEventObject<TouchEvent>) => void;
  onTouchEnd: () => void;
}
