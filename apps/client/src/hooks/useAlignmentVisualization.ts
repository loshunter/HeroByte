import { useCallback, useMemo } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { SceneObject } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import { worldToMapLocal } from "../utils/coordinateTransforms";

export interface UseAlignmentVisualizationParams {
  alignmentMode: boolean;
  alignmentPoints: AlignmentPoint[];
  alignmentSuggestion: AlignmentSuggestion | null;
  mapObject: SceneObject | undefined;
  toWorld: (x: number, y: number) => { x: number; y: number };
  onAlignmentPointCapture?: (point: AlignmentPoint) => void;
}

export interface AlignmentVisualizationState {
  instruction: string | null;
  previewPoints: AlignmentPoint[];
  previewLine: number[] | null;
  suggestionLine: number[] | null;
  handleAlignmentClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;
}

const INSTRUCTION_ZERO = "Click the first corner of a map square.";
const INSTRUCTION_ONE = "Click the opposite corner of the same square.";
const INSTRUCTION_TWO = "Review the preview and apply when ready.";

function isMapObject(object: SceneObject | undefined): object is SceneObject & { type: "map" } {
  return !!object && object.type === "map";
}

export function useAlignmentVisualization({
  alignmentMode,
  alignmentPoints,
  alignmentSuggestion,
  mapObject,
  toWorld,
  onAlignmentPointCapture,
}: UseAlignmentVisualizationParams): AlignmentVisualizationState {
  const instruction = useMemo(() => {
    if (!alignmentMode) {
      return null;
    }

    if (alignmentPoints.length === 0) {
      return INSTRUCTION_ZERO;
    }

    if (alignmentPoints.length === 1) {
      return INSTRUCTION_ONE;
    }

    return INSTRUCTION_TWO;
  }, [alignmentMode, alignmentPoints.length]);

  const previewPoints = useMemo<AlignmentPoint[]>(() => {
    if (!alignmentMode) {
      return [];
    }
    return alignmentPoints.slice(0, 2);
  }, [alignmentMode, alignmentPoints]);

  const previewLine = useMemo<number[] | null>(() => {
    if (!alignmentMode || alignmentPoints.length < 2) {
      return null;
    }

    const [first, second] = alignmentPoints;
    return [first.world.x, first.world.y, second.world.x, second.world.y];
  }, [alignmentMode, alignmentPoints]);

  const suggestionLine = useMemo<number[] | null>(() => {
    if (!alignmentMode || !alignmentSuggestion) {
      return null;
    }

    return [
      alignmentSuggestion.targetA.x,
      alignmentSuggestion.targetA.y,
      alignmentSuggestion.targetB.x,
      alignmentSuggestion.targetB.y,
    ];
  }, [alignmentMode, alignmentSuggestion]);

  const handleAlignmentClick = useCallback(
    (event: KonvaEventObject<MouseEvent | PointerEvent>) => {
      if (!alignmentMode || !onAlignmentPointCapture || !isMapObject(mapObject)) {
        return;
      }

      const stage = event.target?.getStage?.();
      if (!stage) {
        return;
      }

      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }

      const world = toWorld(pointer.x, pointer.y);
      const local = worldToMapLocal(world, mapObject.transform);
      onAlignmentPointCapture({ world, local });
    },
    [alignmentMode, mapObject, onAlignmentPointCapture, toWorld],
  );

  return {
    instruction,
    previewPoints,
    previewLine,
    suggestionLine,
    handleAlignmentClick,
  };
}
