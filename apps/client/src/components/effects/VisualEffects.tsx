/**
 * VisualEffects Component
 *
 * Provides visual effects including CRT filter and ambient pixel sparkles.
 * Extracted from App.tsx for better code organization.
 *
 * @module components/effects/VisualEffects
 */

import React from "react";

interface VisualEffectsProps {
  /**
   * Whether to show the CRT filter effect
   */
  crtFilter: boolean;
}

/**
 * VisualEffects Component
 *
 * Renders visual enhancements for the application including:
 * - CRT scanline filter with vignette and bezel
 * - Ambient pixel sparkles for retro atmosphere
 *
 * @example
 * ```tsx
 * <VisualEffects crtFilter={crtEnabled} />
 * ```
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
