/**
 * useStageEventRouter
 *
 * Coordinates event delegation across all MapBoard tools and modes.
 *
 * This hook implements the unified event handling system for the map canvas,
 * routing mouse/pointer events to the appropriate handlers based on active
 * tool modes (alignment, selection, pointer, measure, draw, transform).
 *
 * Event Routing Strategy:
 * - onStageClick: Routes to alignment → select → pointer/measure/draw → default
 * - onMouseDown: Enables/disables camera panning, delegates to all handlers
 * - onMouseMove: Always delegates to all movement handlers
 * - onMouseUp: Delegates to camera/draw, conditionally to marquee
 *
 * Extracted from: MapBoard.tsx lines 268-391
 *
 * @module hooks/useStageEventRouter
 */

import { useCallback, type RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

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

  // Click handlers
  handleAlignmentClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;
  handlePointerClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;

  // Mouse down handlers
  handleCameraMouseDown: (
    event: KonvaEventObject<PointerEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => void;
  handleDrawMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleMarqueePointerDown: (event: KonvaEventObject<PointerEvent>) => void;

  // Mouse move handlers
  handleCameraMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handlePointerMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleDrawMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleMarqueePointerMove: () => void;

  // Mouse up handlers
  handleCameraMouseUp: () => void;
  handleDrawMouseUp: () => void;
  handleMarqueePointerUp: () => void;

  // Marquee state
  isMarqueeActive: boolean;

  // Selection handlers
  onSelectObject?: ((id: string | null) => void) | undefined;
  deselectIfEmpty: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;

  // Stage reference
  stageRef: RefObject<Konva.Stage | null>;
}

/**
 * Return type for useStageEventRouter hook
 */
export interface UseStageEventRouterReturn {
  onStageClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;
  onMouseDown: (event: KonvaEventObject<PointerEvent>) => void;
  onMouseMove: () => void;
  onMouseUp: () => void;
}

/**
 * Hook that provides unified event routing for the map canvas
 *
 * Coordinates event delegation across all MapBoard tools and modes:
 * - Alignment mode (grid alignment)
 * - Select mode (marquee selection)
 * - Pointer mode (pointer indicators)
 * - Measure mode (distance measurement)
 * - Draw mode (freehand drawing)
 *
 * Event handlers are routed based on priority:
 * 1. Alignment mode (highest priority)
 * 2. Select mode (marquee takes over)
 * 3. Pointer/measure/draw modes
 * 4. Default (selection clearing)
 *
 * @param props - Tool modes and handler functions
 * @returns Unified event handlers (onStageClick, onMouseDown, onMouseMove, onMouseUp)
 *
 * @example
 * ```tsx
 * const { onStageClick, onMouseDown, onMouseMove, onMouseUp } = useStageEventRouter({
 *   alignmentMode: false,
 *   selectMode: true,
 *   pointerMode: false,
 *   measureMode: false,
 *   drawMode: false,
 *   handleAlignmentClick,
 *   handlePointerClick,
 *   // ... other handlers
 * });
 *
 * <Stage
 *   onClick={onStageClick}
 *   onMouseDown={onMouseDown}
 *   onMouseMove={onMouseMove}
 *   onMouseUp={onMouseUp}
 * />
 * ```
 */
export function useStageEventRouter({
  alignmentMode,
  selectMode,
  pointerMode,
  measureMode,
  drawMode,
  handleAlignmentClick,
  handlePointerClick,
  handleCameraMouseDown,
  handleDrawMouseDown,
  handleMarqueePointerDown,
  handleCameraMouseMove,
  handlePointerMouseMove,
  handleDrawMouseMove,
  handleMarqueePointerMove,
  handleCameraMouseUp,
  handleDrawMouseUp,
  handleMarqueePointerUp,
  isMarqueeActive,
  onSelectObject,
  deselectIfEmpty,
  stageRef,
}: UseStageEventRouterProps): UseStageEventRouterReturn {
  /**
   * Unified stage click handler
   *
   * Routes clicks based on active tool mode priority:
   * 1. Alignment mode → handleAlignmentClick
   * 2. Select mode → early return (marquee handles it)
   * 3. Pointer/measure/draw mode → handlePointerClick
   * 4. Default → clear selection
   */
  const onStageClick = useCallback(
    (event: KonvaEventObject<MouseEvent | PointerEvent>) => {
      // Priority 1: Alignment mode
      if (alignmentMode) {
        handleAlignmentClick(event);
        return;
      }

      // Priority 2: Select mode (marquee handles everything)
      if (selectMode) {
        return;
      }

      // Priority 3: No tools active - clear selection
      if (!pointerMode && !measureMode && !drawMode) {
        if (onSelectObject) {
          const stage = event.target.getStage();
          if (stage && event.target === stage) {
            onSelectObject(null);
          }
        }
        deselectIfEmpty(event);
        return;
      }

      // Priority 4: Pointer/measure/draw mode
      handlePointerClick(event);
    },
    [
      alignmentMode,
      selectMode,
      pointerMode,
      measureMode,
      drawMode,
      handleAlignmentClick,
      handlePointerClick,
      onSelectObject,
      deselectIfEmpty,
    ],
  );

  /**
   * Unified mouse down handler
   *
   * Determines if camera panning should be enabled based on active modes,
   * then delegates to camera, drawing, and marquee handlers.
   *
   * Camera panning is disabled when any tool mode is active.
   */
  const onMouseDown = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      // Calculate shouldPan: only pan when no tools are active
      const shouldPan = !alignmentMode && !pointerMode && !measureMode && !drawMode && !selectMode;

      // Delegate to all handlers
      handleCameraMouseDown(event, stageRef, shouldPan);
      handleDrawMouseDown(stageRef);
      handleMarqueePointerDown(event);
    },
    [
      alignmentMode,
      pointerMode,
      measureMode,
      drawMode,
      selectMode,
      handleCameraMouseDown,
      handleDrawMouseDown,
      handleMarqueePointerDown,
      stageRef,
    ],
  );

  /**
   * Unified mouse move handler
   *
   * Delegates to all movement handlers unconditionally:
   * - Camera (for panning)
   * - Pointer (for pointer preview and measure tool)
   * - Drawing (for freehand drawing)
   * - Marquee (for selection box)
   */
  const onMouseMove = useCallback(() => {
    handleCameraMouseMove(stageRef);
    handlePointerMouseMove(stageRef);
    handleDrawMouseMove(stageRef);
    handleMarqueePointerMove();
  }, [
    handleCameraMouseMove,
    handlePointerMouseMove,
    handleDrawMouseMove,
    handleMarqueePointerMove,
    stageRef,
  ]);

  /**
   * Unified mouse up handler
   *
   * Finalizes camera panning and drawing operations.
   * Conditionally finalizes marquee selection if active.
   */
  const onMouseUp = useCallback(() => {
    handleCameraMouseUp();
    handleDrawMouseUp();

    if (isMarqueeActive) {
      handleMarqueePointerUp();
    }
  }, [handleCameraMouseUp, handleDrawMouseUp, handleMarqueePointerUp, isMarqueeActive]);

  return {
    onStageClick,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}
