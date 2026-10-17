// ============================================================================
// useFrameBitmap — one token's frame, at the tier its size on screen needs (C5a)
// ============================================================================
// Resolves "personal" to the token's own colour (through C1's normalizeColor,
// so an older table's hsl() colour still works), picks the tier with
// hysteresis, and returns the cached bitmap. While a new tier or a changed
// frame bakes, the previous bitmap stays up, so a zoom or a weight change
// never flashes the token frameless.

import { useEffect, useReducer, useRef, useState } from "react";
import {
  frameBakeKey,
  frameSeed,
  layoutFrame,
  normalizeColor,
  type FrameBakeInput,
  type FrameLayout,
  type TokenFrame,
  type TokenSize,
} from "@herobyte/shared";
import {
  frameCacheCap,
  heldFrameBytes,
  peekFrameBitmap,
  requestFrameBitmap,
  retainFrameBitmap,
  type FrameBitmap,
} from "./frameBitmapCache";
import { fitTierToBudget, isCoarsePointer, pickFrameTier } from "./frameTier";

/** A colour nobody's token has, for an unreadable one: the frame still draws. */
const FALLBACK_ACCENT = "#808080";

export interface FrameDrawing {
  bitmap: FrameBitmap | null;
  /** Half the bitmap's edge in token units: the bitmap's own, which may be the previous frame's. */
  extent: number;
  layout: FrameLayout;
  tier: number;
}

export interface FrameBitmapRequest {
  frame: TokenFrame;
  tokenId: string;
  /** The token's colour, as stored (#rrggbb, or an older table's hsl()). */
  color: string;
  size?: TokenSize;
  /** The token's edge on the map, in map pixels, before any zoom. */
  tokenPx: number;
  /** The map's zoom times the token's own scale (the gizmo's). */
  zoom: number;
}

export function frameAccent(frame: TokenFrame, color: string): string {
  const accent = frame.accent && frame.accent !== "personal" ? frame.accent : color;
  return normalizeColor(accent) ?? FALLBACK_ACCENT;
}

export function useFrameBitmap(request: FrameBitmapRequest | null): FrameDrawing | null {
  const tierRef = useRef<number | null>(null);
  const lastRef = useRef<{ bitmap: FrameBitmap; extent: number } | null>(null);
  const [, bump] = useReducer((count: number) => count + 1, 0);
  // A bake that failed (a decode refused under memory pressure) is asked for again, twice at most.
  const [retry, setRetry] = useState<{ key: string | null; count: number }>({
    key: null,
    count: 0,
  });
  const keyRef = useRef<string | null>(null);

  let input: FrameBakeInput | null = null;
  let layout: FrameLayout | null = null;
  if (request) {
    layout = layoutFrame(request.frame, request.size);
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const needed = request.tokenPx * 2 * layout.extent * Math.abs(request.zoom) * dpr;
    // The cache never passes its cap for bitmaps tokens hold: past it, a smaller tier.
    tierRef.current = fitTierToBudget(
      pickFrameTier(needed, tierRef.current, isCoarsePointer()),
      heldFrameBytes(keyRef.current ?? undefined),
      frameCacheCap(),
    );
    input = {
      frame: request.frame,
      size: request.size,
      accent: frameAccent(request.frame, request.color),
      // A "personal" glow is the character's own colour, even under a picked frame colour.
      personal: normalizeColor(request.color) ?? FALLBACK_ACCENT,
      seed: frameSeed(request.tokenId),
      tier: tierRef.current,
    };
  }
  const key = input ? frameBakeKey(input) : null;
  const inputRef = useRef(input);
  inputRef.current = input;

  const bitmap = key ? peekFrameBitmap(key) : null;
  keyRef.current = key;
  const attempt = retry.key === key ? retry.count : 0; // a new key starts its own count
  useEffect(() => {
    if (!key || !inputRef.current) return;
    // Held while this token draws it, so eviction never drops a bitmap in use.
    const release = retainFrameBitmap(key);
    const onSettled = () => {
      if (!peekFrameBitmap(key) && attempt < 2) setRetry({ key, count: attempt + 1 });
      else bump();
    };
    const withdraw = peekFrameBitmap(key)
      ? null
      : requestFrameBitmap(key, inputRef.current, onSettled);
    return () => {
      release();
      withdraw?.();
    };
  }, [key, attempt]);

  if (!request || !layout) {
    lastRef.current = null;
    return null;
  }
  if (bitmap) lastRef.current = { bitmap, extent: layout.extent };
  return {
    bitmap: lastRef.current?.bitmap ?? null,
    extent: lastRef.current?.extent ?? layout.extent,
    layout,
    tier: tierRef.current!,
  };
}
