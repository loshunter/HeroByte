// ============================================================================
// PROP SIZING
// ============================================================================
// The one place the prop sprite's pixel size is derived from its size
// category. PropsLayer renders with it, and the gizmo's inverse mapping must
// agree with it exactly — a second copy of these numbers is how the gizmo
// drift bug happened (it assumed props render at bare transform.x * gridSize
// and drifted every drag by the half-cell-minus-half-sprite it ignored).

import type { TokenSize } from "@herobyte/shared";

/** Size multiplier per size category (same ladder as tokens). */
export const PROP_SIZE_MULTIPLIERS: Record<string, number> = {
  tiny: 0.5,
  small: 0.75,
  medium: 1.0,
  large: 1.5,
  huge: 2.0,
  gargantuan: 3.0,
};

/** The sprite's rendered edge length in pixels, before gizmo scale. */
export function propRenderSize(gridSize: number, size: TokenSize | undefined): number {
  const multiplier = PROP_SIZE_MULTIPLIERS[size ?? "medium"] ?? 1.0;
  return gridSize * 0.75 * multiplier;
}
