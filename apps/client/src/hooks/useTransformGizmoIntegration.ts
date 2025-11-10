import { useCallback, useMemo } from "react";
import type { SceneObject } from "@shared";
import type Konva from "konva";

/**
 * Hook parameters for transform gizmo integration
 */
export interface UseTransformGizmoIntegrationParams {
  /**
   * All scene objects (tokens, props, drawings, staging zone, map)
   */
  sceneObjects: SceneObject[];
  /**
   * Currently selected object ID
   */
  selectedObjectId: string | null;
  /**
   * Function to get the selected Konva node
   */
  getSelectedNode: () => Konva.Node | null;
}

/**
 * Hook return value containing transform gizmo integration state
 */
export interface UseTransformGizmoIntegrationReturn {
  /**
   * Currently selected scene object (or null if none selected)
   */
  selectedObject: SceneObject | null;
  /**
   * Callback to get the selected node reference (for TransformGizmo)
   */
  getSelectedNodeRef: () => Konva.Node | null;
}

/**
 * useTransformGizmoIntegration
 *
 * Integrates the transform gizmo with the selection system.
 * Provides selected object state and node reference callback for TransformGizmo component.
 *
 * Features:
 * - Memoized selected object lookup
 * - Node reference callback for transform gizmo
 * - Automatic updates when selection changes
 *
 * @param params - Hook parameters
 * @returns Transform gizmo integration state and callbacks
 */
export function useTransformGizmoIntegration({
  sceneObjects,
  selectedObjectId,
  getSelectedNode,
}: UseTransformGizmoIntegrationParams): UseTransformGizmoIntegrationReturn {
  // Find the currently selected object
  const selectedObject = useMemo(
    () => sceneObjects.find((obj) => obj.id === selectedObjectId) || null,
    [sceneObjects, selectedObjectId],
  );

  // Callback to get the selected node reference
  const getSelectedNodeRef = useCallback(() => {
    return getSelectedNode();
  }, [getSelectedNode]);

  return {
    selectedObject,
    getSelectedNodeRef,
  };
}
