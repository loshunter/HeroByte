import { useCallback } from "react";
import type { SceneObject } from "@shared";

/**
 * Hook parameters for object transform handlers
 */
export interface UseObjectTransformHandlersParams {
  /**
   * Callback to notify parent of object transformations
   */
  onTransformObject: (transform: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
  /**
   * All scene objects (tokens, props, drawings, staging zone, map)
   */
  sceneObjects: SceneObject[];
  /**
   * Grid size in pixels (for coordinate conversions)
   */
  gridSize: number;
}

/**
 * Hook return value containing all transform handlers
 */
export interface UseObjectTransformHandlersReturn {
  /**
   * Handle token position transformation
   * @param sceneId - Token ID
   * @param position - New position in grid units
   */
  handleTransformToken: (sceneId: string, position: { x: number; y: number }) => void;
  /**
   * Handle prop position transformation
   * @param sceneId - Prop ID
   * @param position - New position in grid units
   */
  handleTransformProp: (sceneId: string, position: { x: number; y: number }) => void;
  /**
   * Handle drawing transformation
   * @param sceneId - Drawing ID
   * @param transform - Transform data (position, scale, rotation)
   */
  handleTransformDrawing: (
    sceneId: string,
    transform: { position?: { x: number; y: number } },
  ) => void;
  /**
   * Handle transform gizmo transformations with type-specific coordinate conversions
   * @param transform - Transform data with object ID
   */
  handleGizmoTransform: (transform: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
}

/**
 * useObjectTransformHandlers
 *
 * Manages object transformation handlers for different scene object types.
 * Provides type-specific coordinate conversion and transform delegation.
 *
 * Features:
 * - Token transforms: Scale and rotation only (position handled separately via drag)
 * - Staging zone/prop transforms: Position conversion from pixels to grid units
 * - Map/drawing transforms: Full transform pass-through
 * - Transform gizmo integration with type detection
 *
 * @param params - Hook parameters
 * @returns Transform handler callbacks
 */
export function useObjectTransformHandlers({
  onTransformObject,
  sceneObjects,
  gridSize,
}: UseObjectTransformHandlersParams): UseObjectTransformHandlersReturn {
  const handleTransformToken = useCallback(
    (sceneId: string, position: { x: number; y: number }) => {
      onTransformObject({ id: sceneId, position });
    },
    [onTransformObject],
  );

  const handleTransformProp = useCallback(
    (sceneId: string, position: { x: number; y: number }) => {
      onTransformObject({ id: sceneId, position });
    },
    [onTransformObject],
  );

  const handleTransformDrawing = useCallback(
    (sceneId: string, transform: { position?: { x: number; y: number } }) => {
      onTransformObject({ id: sceneId, ...transform });
    },
    [onTransformObject],
  );

  const handleGizmoTransform = useCallback(
    (transform: {
      id: string;
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
    }) => {
      // Find the object to determine its type
      const obj = sceneObjects.find((o) => o.id === transform.id);

      if (!obj) {
        console.warn(`Object ${transform.id} not found`);
        return;
      }

      // For tokens, don't send position (it's in grid coords, not pixels)
      // Only send scale and rotation
      if (obj.type === "token") {
        onTransformObject({
          id: transform.id,
          scale: transform.scale,
          rotation: transform.rotation,
          // Position should only be updated via dragging (which handles grid snapping)
        });
      } else if (obj.type === "staging-zone") {
        // For staging zone, convert position from pixels to grid units
        onTransformObject({
          id: transform.id,
          position: transform.position
            ? { x: transform.position.x / gridSize, y: transform.position.y / gridSize }
            : undefined,
          scale: transform.scale,
          rotation: transform.rotation,
        });
      } else if (obj.type === "prop") {
        // For props, convert position from pixels to grid units (same as staging-zone)
        // Props are rendered with transform.x * gridSize, so position must be in grid units
        onTransformObject({
          id: transform.id,
          position: transform.position
            ? { x: transform.position.x / gridSize, y: transform.position.y / gridSize }
            : undefined,
          scale: transform.scale,
          rotation: transform.rotation,
        });
      } else {
        // For map and drawings, send full transform
        onTransformObject(transform);
      }
    },
    [onTransformObject, sceneObjects, gridSize],
  );

  return {
    handleTransformToken,
    handleTransformProp,
    handleTransformDrawing,
    handleGizmoTransform,
  };
}
