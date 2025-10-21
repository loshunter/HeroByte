/**
 * useMapAlignment Hook
 *
 * Manages map alignment mode with grid calculations and coordinate transformations.
 * Provides a two-point alignment system that computes optimal map positioning,
 * scaling, and rotation to align with the game grid.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 180-182, 337-389, 429-466)
 * Extraction date: 2025-10-20
 *
 * This hook handles:
 * - Alignment point capture and management (max 2 points)
 * - Automatic grid alignment transform computation
 * - Map transformation application with position, scale, and rotation
 * - Error detection and tolerance checking
 * - Tool mode lifecycle management
 *
 * @module features/map/useMapAlignment
 */

import { useState, useCallback, useEffect } from "react";
import type { SceneObject } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../../types/alignment";
import { computeMapAlignmentTransform } from "../../utils/mapAlignment";
import type { ToolMode } from "../../components/layout/Header";
import type { TransformSceneObjectParams } from "../../hooks/useSceneObjectActions";

/**
 * Dependencies required by the useMapAlignment hook.
 */
export interface UseMapAlignmentOptions {
  /**
   * The currently active tool mode, or null if no tool is active.
   * Used to determine when alignment mode is active.
   */
  activeTool: ToolMode | null;

  /**
   * Function to set the active tool mode.
   * Called to enter/exit alignment mode.
   */
  setActiveTool: (tool: ToolMode | null) => void;

  /**
   * Grid size in pixels for alignment calculations.
   * Used to compute snap points and error tolerance.
   */
  gridSize: number;

  /**
   * The map scene object to be aligned.
   * If undefined, alignment cannot be applied.
   */
  mapSceneObject: SceneObject | undefined;

  /**
   * Function to apply transformations to scene objects.
   * Used to apply the computed alignment transform to the map.
   */
  transformSceneObject: (params: TransformSceneObjectParams) => void;
}

/**
 * Map alignment state and action functions returned by the hook.
 */
export interface UseMapAlignmentReturn {
  /**
   * Array of captured alignment points (max 2).
   * Each point contains world coordinates and local (grid) coordinates.
   */
  alignmentPoints: AlignmentPoint[];

  /**
   * The computed alignment suggestion containing transform parameters.
   * Null if fewer than 2 points are captured or computation failed.
   */
  alignmentSuggestion: AlignmentSuggestion | null;

  /**
   * Error message if alignment computation failed or residual is too high.
   * Null if no error occurred.
   */
  alignmentError: string | null;

  /**
   * Start the alignment process.
   * Resets all state and activates the alignment tool.
   */
  handleAlignmentStart: () => void;

  /**
   * Cancel the alignment process.
   * Clears all state and deactivates the alignment tool.
   */
  handleAlignmentCancel: () => void;

  /**
   * Capture a new alignment point.
   * If 2 points already exist, replaces them with the new point.
   *
   * @param point - The alignment point to capture
   */
  handleAlignmentPointCapture: (point: AlignmentPoint) => void;

  /**
   * Reset all captured points and suggestions.
   * Keeps the alignment tool active.
   */
  handleAlignmentReset: () => void;

  /**
   * Apply the computed alignment transform to the map.
   * Deactivates the alignment tool on success.
   * Does nothing if no suggestion exists or map is not available.
   */
  handleAlignmentApply: () => void;
}

/**
 * Hook for managing map alignment with grid calculations and coordinate transformations.
 *
 * The alignment process works as follows:
 * 1. User activates alignment mode via handleAlignmentStart
 * 2. User captures 2 points by clicking on the map (each point has world and local coords)
 * 3. Hook automatically computes optimal transform (position, scale, rotation)
 * 4. User reviews the suggestion and applies it via handleAlignmentApply
 *
 * The transform computation uses least-squares fitting to find the best alignment
 * that minimizes the error between the captured points and their target grid positions.
 *
 * @param options - Hook dependencies including tool state, grid config, and actions
 * @returns Alignment state and handler functions
 *
 * @example
 * ```tsx
 * const alignment = useMapAlignment({
 *   activeTool,
 *   setActiveTool,
 *   gridSize: 70,
 *   mapSceneObject: snapshot?.sceneObjects?.find(obj => obj.type === "map"),
 *   transformSceneObject
 * });
 *
 * // Start alignment
 * alignment.handleAlignmentStart();
 *
 * // Capture points (called by MapBoard on click)
 * alignment.handleAlignmentPointCapture({
 *   world: { x: 100, y: 100 },
 *   local: { x: 0, y: 0 }
 * });
 *
 * // Apply transformation
 * if (alignment.alignmentSuggestion) {
 *   alignment.handleAlignmentApply();
 * }
 * ```
 */
export function useMapAlignment({
  activeTool,
  setActiveTool,
  gridSize,
  mapSceneObject,
  transformSceneObject,
}: UseMapAlignmentOptions): UseMapAlignmentReturn {
  /**
   * Array of captured alignment points (max 2).
   * Each point contains world coordinates and local (grid) coordinates.
   */
  const [alignmentPoints, setAlignmentPoints] = useState<AlignmentPoint[]>([]);

  /**
   * Computed alignment suggestion with transform parameters.
   */
  const [alignmentSuggestion, setAlignmentSuggestion] = useState<AlignmentSuggestion | null>(null);

  /**
   * Error message from alignment computation or validation.
   */
  const [alignmentError, setAlignmentError] = useState<string | null>(null);

  /**
   * Start the alignment process.
   * Resets all state and activates the alignment tool.
   */
  const handleAlignmentStart = useCallback(() => {
    setAlignmentPoints([]);
    setAlignmentSuggestion(null);
    setAlignmentError(null);
    setActiveTool("align");
  }, [setActiveTool]);

  /**
   * Cancel the alignment process.
   * Clears all state and deactivates the alignment tool.
   */
  const handleAlignmentCancel = useCallback(() => {
    setActiveTool(null);
    setAlignmentPoints([]);
    setAlignmentSuggestion(null);
    setAlignmentError(null);
  }, [setActiveTool]);

  /**
   * Capture a new alignment point.
   * If 2 points already exist, replaces them with the new point to start over.
   * Clears any previous error state.
   */
  const handleAlignmentPointCapture = useCallback((point: AlignmentPoint) => {
    setAlignmentError(null);
    setAlignmentPoints((prev) => {
      if (prev.length >= 2) {
        return [point];
      }
      return [...prev, point];
    });
  }, []);

  /**
   * Reset all captured points and suggestions.
   * Keeps the alignment tool active.
   */
  const handleAlignmentReset = useCallback(() => {
    setAlignmentPoints([]);
    setAlignmentSuggestion(null);
    setAlignmentError(null);
  }, []);

  /**
   * Apply the computed alignment transform to the map.
   * Updates the map's position, scale, and rotation based on the suggestion.
   * Clears all state and deactivates the alignment tool on success.
   */
  const handleAlignmentApply = useCallback(() => {
    if (!alignmentSuggestion || !mapSceneObject) {
      return;
    }

    transformSceneObject({
      id: mapSceneObject.id,
      position: {
        x: alignmentSuggestion.transform.x,
        y: alignmentSuggestion.transform.y,
      },
      scale: {
        x: alignmentSuggestion.transform.scaleX,
        y: alignmentSuggestion.transform.scaleY,
      },
      rotation: alignmentSuggestion.transform.rotation,
    });

    setAlignmentPoints([]);
    setAlignmentSuggestion(null);
    setAlignmentError(null);
    setActiveTool(null);
  }, [alignmentSuggestion, mapSceneObject, transformSceneObject, setActiveTool]);

  /**
   * Effect: Clear alignment state when switching away from alignment tool.
   * Ensures clean state when user switches to a different tool.
   */
  useEffect(() => {
    if (activeTool !== "align") {
      setAlignmentPoints([]);
      setAlignmentSuggestion(null);
      setAlignmentError(null);
      return;
    }
  }, [activeTool]);

  /**
   * Effect: Compute alignment transform when 2 points are captured.
   * Only runs when alignment tool is active.
   *
   * Computes the optimal transformation using least-squares fitting
   * and checks if the residual error is within tolerance.
   * Tolerance is calculated as max(0.5px, 2% of grid size).
   */
  useEffect(() => {
    if (activeTool !== "align") {
      return;
    }

    if (alignmentPoints.length !== 2) {
      setAlignmentSuggestion(null);
      if (alignmentPoints.length === 0) {
        setAlignmentError(null);
      }
      return;
    }

    try {
      const result = computeMapAlignmentTransform(alignmentPoints, gridSize);
      setAlignmentSuggestion(result);
      const tolerance = Math.max(0.5, gridSize * 0.02);
      if (result.error > tolerance) {
        setAlignmentError(
          `Alignment residual ${result.error.toFixed(2)}px — consider recapturing points.`,
        );
      } else {
        setAlignmentError(null);
      }
    } catch (error) {
      setAlignmentSuggestion(null);
      setAlignmentError(error instanceof Error ? error.message : "Failed to compute alignment.");
    }
  }, [activeTool, alignmentPoints, gridSize]);

  return {
    alignmentPoints,
    alignmentSuggestion,
    alignmentError,
    handleAlignmentStart,
    handleAlignmentCancel,
    handleAlignmentPointCapture,
    handleAlignmentReset,
    handleAlignmentApply,
  };
}
