import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";

const EPSILON = 1e-6;

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function computeMapAlignmentTransform(
  points: AlignmentPoint[],
  gridSize: number,
): AlignmentSuggestion {
  if (points.length !== 2) {
    throw new Error("Alignment requires exactly two reference points.");
  }

  if (gridSize <= 0) {
    throw new Error("Grid size must be greater than zero.");
  }

  const [a, b] = points;
  const diffLocal = {
    x: b.local.x - a.local.x,
    y: b.local.y - a.local.y,
  };
  const diffLocalLength = Math.hypot(diffLocal.x, diffLocal.y);
  if (diffLocalLength < EPSILON) {
    throw new Error("Alignment points must not be identical.");
  }

  const baseSignX = diffLocal.x >= 0 ? 1 : -1;
  const baseSignY = diffLocal.y >= 0 ? 1 : -1;

  const desiredDelta = {
    x: gridSize * baseSignX,
    y: gridSize * baseSignY,
  };

  const targetA = {
    x: Math.round(a.world.x / gridSize) * gridSize,
    y: Math.round(a.world.y / gridSize) * gridSize,
  };

  const targetB = {
    x: targetA.x + desiredDelta.x,
    y: targetA.y + desiredDelta.y,
  };

  const diffTarget = {
    x: targetB.x - targetA.x,
    y: targetB.y - targetA.y,
  };
  const diffTargetLength = Math.hypot(diffTarget.x, diffTarget.y);

  const scale = diffTargetLength / diffLocalLength;

  const angleLocal = Math.atan2(diffLocal.y, diffLocal.x);
  const angleTarget = Math.atan2(diffTarget.y, diffTarget.x);
  const rotationRad = angleTarget - angleLocal;
  const rotationDeg = toDegrees(rotationRad);

  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  const mapLocalToWorld = (point: AlignmentPoint["local"]) => ({
    x: scale * (point.x * cos - point.y * sin),
    y: scale * (point.x * sin + point.y * cos),
  });

  const transformedLocalA = mapLocalToWorld(a.local);
  const translation = {
    x: targetA.x - transformedLocalA.x,
    y: targetA.y - transformedLocalA.y,
  };

  const transformedLocalB = mapLocalToWorld(b.local);
  const predictedB = {
    x: translation.x + transformedLocalB.x,
    y: translation.y + transformedLocalB.y,
  };

  const error = Math.hypot(predictedB.x - targetB.x, predictedB.y - targetB.y);

  return {
    transform: {
      x: translation.x,
      y: translation.y,
      scaleX: scale,
      scaleY: scale,
      rotation: rotationDeg,
    },
    targetA,
    targetB,
    scale,
    rotation: rotationDeg,
    error,
  };
}
