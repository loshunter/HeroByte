// Tracks the device pixel ratio so the Konva stage can render its backing store
// at native resolution (crisp tokens/text/terrain on retina + mobile) instead of
// a 1× store the browser upscales. Clamped to 3: a full-screen 3× stage is 9× the
// pixels, so higher ratios are all memory and no visible gain on a phone. Updates
// when the ratio changes (moving a window between monitors, browser zoom).

import { useEffect, useState } from "react";

/** Memory cap — 3× covers every modern phone/laptop; beyond it is waste. */
export const MAX_DEVICE_PIXEL_RATIO = 3;

function readDevicePixelRatio(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

export function clampDevicePixelRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, value));
}

export function useDevicePixelRatio(): number {
  const [ratio, setRatio] = useState(() => clampDevicePixelRatio(readDevicePixelRatio()));

  useEffect(() => {
    const update = () => setRatio(clampDevicePixelRatio(readDevicePixelRatio()));
    // A (resolution: Ndppx) query flips the moment the ratio leaves N; re-arming
    // the effect on `ratio` re-binds it to the new value. window.resize is a
    // belt-and-suspenders fallback (some engines fire it on DPR change).
    const media =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(`(resolution: ${readDevicePixelRatio()}dppx)`)
        : null;
    media?.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    return () => {
      media?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
    };
  }, [ratio]);

  return ratio;
}
