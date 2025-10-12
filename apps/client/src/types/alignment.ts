import type { SceneObjectTransform } from "@shared";

export interface AlignmentPoint {
  world: { x: number; y: number };
  local: { x: number; y: number };
}

export interface AlignmentSuggestion {
  transform: SceneObjectTransform;
  targetA: { x: number; y: number };
  targetB: { x: number; y: number };
  scale: number;
  rotation: number;
  error: number;
}
