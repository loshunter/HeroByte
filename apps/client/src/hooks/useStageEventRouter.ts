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

import { useCallback, useRef, type RefObject } from "react";
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
 * @returns Unified event handlers (onStageClick, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd)
 *
 * @example
 * ```tsx
 * const { onStageClick, onMouseDown, onMouseMove, onMouseUp, onTouchStart, ... } = useStageEventRouter({
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
 *   onTouchStart={onTouchStart}
 *   onTouchMove={onTouchMove}
 *   onTouchEnd={onTouchEnd}
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
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleDoubleTap,
  isMarqueeActive,
  onSelectObject,
  deselectIfEmpty,
  stageRef,
}: UseStageEventRouterProps): UseStageEventRouterReturn {
  // State for manual double tap/click detection
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);

  /**
   * Manual double tap detection logic
   * Returns true if a double tap was detected and handled
   */
  const detectDoubleTap = useCallback(
    (event: KonvaEventObject<MouseEvent | PointerEvent | TouchEvent>) => {
      // Defensive checks for tests and edge cases
      if (!event.target || typeof event.target.getStage !== "function") return false;
      const stage = event.target.getStage();
      if (!stage || typeof stage.getPointerPosition !== "function") return false;

      const pointer = stage.getPointerPosition();
      if (!pointer) return false;

      // Ignore multi-touch events for double tap detection
      if ("evt" in event && "touches" in event.evt && event.evt.touches.length > 1) {
        lastTapRef.current = null;
        return false;
      }

      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (lastTap) {
        const timeDiff = now - lastTap.time;
        const dist = Math.sqrt(
          Math.pow(pointer.x - lastTap.x, 2) + Math.pow(pointer.y - lastTap.y, 2),
        );

        // Strict thresholds for intentional double tap:
        // - Time: 50ms - 350ms
        // - Distance: < 20 pixels
        if (timeDiff > 50 && timeDiff < 350 && dist < 20) {
          if (handleDoubleTap) {
            handleDoubleTap(event);
            lastTapRef.current = null; // Clear to prevent triple-tap
            return true;
          }
        }
      }

      lastTapRef.current = { x: pointer.x, y: pointer.y, time: now };
      return false;
    },
    [handleDoubleTap],
  );

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
      // Priority 0: Custom double-click detection
      detectDoubleTap(event);

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
      detectDoubleTap,
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
   * Unified stage tap handler (for touch devices)
   */
  const onTap = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      // Use the same logic as click for double tap detection
      detectDoubleTap(event);

      // On mobile, a single tap also acts like a click for most tools
      // but we cast it to MouseEvent | PointerEvent for the handlers
      onStageClick(event as unknown as KonvaEventObject<MouseEvent | PointerEvent>);
    },
    [detectDoubleTap, onStageClick],
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

  /**
   * Unified touch start handler
   */
  const onTouchStart = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      const shouldPan = !alignmentMode && !pointerMode && !measureMode && !drawMode && !selectMode;
      handleTouchStart(event, stageRef, shouldPan);
    },
    [alignmentMode, pointerMode, measureMode, drawMode, selectMode, handleTouchStart, stageRef],
  );

  /**
   * Unified touch move handler
   */
  const onTouchMove = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      handleTouchMove(event, stageRef);
    },
    [handleTouchMove, stageRef],
  );

  /**
   * Unified touch end handler
   */
  const onTouchEnd = useCallback(() => {
    handleTouchEnd();
  }, [handleTouchEnd]);

  return {
    onStageClick,
    onTap,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
