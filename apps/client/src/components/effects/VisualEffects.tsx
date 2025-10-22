import React from "react";

/**
 * VisualEffects
 *
 * Renders visual effects overlays including optional CRT filter effects
 * and ambient pixel sparkles. Pure presentational component with no state.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 1714-1738)
 * Extraction date: 2025-10-20
 *
 * @module components/effects/VisualEffects
 */

/**
 * Props for VisualEffects component
 */
export interface VisualEffectsProps {
  /**
   * Whether to render the CRT scanline filter with arcade bezel overlay
   * @default false
   */
  crtFilter: boolean;
}

/**
 * Renders visual effects overlays for the application
 *
 * This component provides two types of visual effects:
 * 1. CRT Filter: Optional retro-style scanline overlay with vignette and bezel (conditional)
 * 2. Ambient Sparkles: Always-present subtle pixel sparkles for visual interest
 *
 * @example
 * ```tsx
 * <VisualEffects crtFilter={true} />
 * ```
 *
 * @param props - Component props
 * @returns JSX element containing visual effects overlays
 */
export function VisualEffects({ crtFilter }: VisualEffectsProps): JSX.Element {
  return (
    <>
      {/* CRT Scanline Filter with Arcade Bezel */}
      {crtFilter && (
        <>
          <div className="crt-vignette" />
          <div className="crt-filter" />
          <div className="crt-bezel" />
        </>
      )}

      {/* Ambient Pixel Sparkles */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        {[...Array(5)].map((_, i) => (
          <div key={i} className="pixel-sparkle" />
        ))}
      </div>
    </>
  );
}
