// ============================================================================
// MAP TRANSITION OVERLAY — the SNES iris on travel
// ============================================================================
// COVER-THEN-REVEAL, deliberately: nothing in the client captures a stage
// frame, and by the time React sees the new `sourceDocumentId` the new scene
// is already committed — an "old frame" overlay is a rAF timing trick this
// component refuses (plan A5, review C2; the Boss Wipe's own "no pixel
// readback" philosophy). Instead: snap to an opaque cover, then a growing
// transparent circle reveals the NEW map, chunked with steps() for the
// SNES feel.
//
// TRIGGER MATRIX (each row pinned by tests): undefined→A never fires (first
// bind, reload); A→A never (live edits, undo, publish of the live doc);
// A→B fires — travel, rebind, publish of ANOTHER document, session load
// (the map changed; the wipe is honest either way). Keyed on the
// PLAYER-VISIBLE compiledScene.sourceDocumentId — liveMapDocumentId is
// DM-only and would leave players wipeless forever.

import { useLayoutEffect, useRef, useState } from "react";

/** The juiceSettings precedent, local because that helper is module-private. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export interface MapTransitionOverlayProps {
  sourceDocumentId: string | undefined;
}

export function MapTransitionOverlay({ sourceDocumentId }: MapTransitionOverlayProps) {
  const previous = useRef<string | undefined>(sourceDocumentId);
  const [wipeKey, setWipeKey] = useState(0);

  // A LAYOUT effect: the cover must land in the same commit as the new scene,
  // or the browser can present one uncovered frame of the destination before
  // the iris begins — the exact flash the wipe exists to mask.
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = sourceDocumentId;
    // Only a defined→different-defined transition is a scene CHANGE.
    if (!before || !sourceDocumentId || before === sourceDocumentId) return;
    if (prefersReducedMotion()) return; // instant swap — the information IS the new map
    setWipeKey((key) => key + 1);
  }, [sourceDocumentId]);

  if (wipeKey === 0) return null;

  return (
    <div
      key={wipeKey}
      data-testid="map-transition-overlay"
      aria-hidden="true"
      onAnimationEnd={() => setWipeKey(0)}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <style>{`
        @keyframes herobyte-iris-reveal {
          from { width: 0; height: 0; }
          to { width: 320%; height: 320%; }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 0,
          height: 0,
          borderRadius: "50%",
          // The iris: the circle itself is transparent; the gigantic solid
          // shadow is the cover. As the circle grows, the new map appears
          // through it — no pixels of the old frame required.
          boxShadow: "0 0 0 9999px #05060f",
          animation: "herobyte-iris-reveal 600ms steps(12, end) forwards",
        }}
      />
    </div>
  );
}
