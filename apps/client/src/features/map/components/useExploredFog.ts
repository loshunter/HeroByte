// ============================================================================
// EXPLORED FOG ACCUMULATION (S7)
// ============================================================================
// Keeps one low-resolution offscreen canvas per map holding the union of every
// vision polygon this player has ever been shown. The canvas IS the union: each
// new polygon is filled into it without clearing, so the browser rasterises the
// merge in native code instead of us maintaining polygon geometry.
//
// Resolution is a design constant (see exploredFogStore), never multiplied by
// the device pixel ratio — Konva applies DPR once at the Stage, and this is
// drawn as one upscaled image whose blur is a feature.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScenePoint } from "@herobyte/shared";
import {
  byteLengthFor,
  clearExploredMask,
  loadExploredMask,
  maskGeometryFor,
  saveExploredMask,
  type ExploredMaskMeta,
} from "../exploredFogStore";

/** Writing to localStorage reads the whole canvas back, so it is not per-frame. */
const SAVE_DEBOUNCE_MS = 4000;
/** A mask cell counts as explored once it is at least this opaque. */
const EXPLORED_ALPHA_THRESHOLD = 32;

export interface ExploredFogResult {
  /** The accumulated mask, or null before it exists. Alpha is the memory. */
  canvas: HTMLCanvasElement | null;
  /** Bumped whenever the pixels changed — canvas identity never does. */
  revision: number;
}

interface UseExploredFogInput {
  /** Null disables accumulation entirely (fog off, or nothing published). */
  storageKey: string | null;
  sceneWidth: number;
  sceneHeight: number;
  /** The viewers' current sight polygons, in DOCUMENT space. */
  polygons: ScenePoint[][];
}

function createCanvas(meta: ExploredMaskMeta): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = meta.cols;
  canvas.height = meta.rows;
  return canvas;
}

/** Paint a stored bitset back onto a fresh canvas. */
function restore(canvas: HTMLCanvasElement, meta: ExploredMaskMeta, bits: Uint8Array): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = context.createImageData(meta.cols, meta.rows);
  for (let index = 0; index < meta.cols * meta.rows; index += 1) {
    if ((bits[index >> 3]! >> (index & 7)) & 1) {
      image.data[index * 4 + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

/** Read the canvas back out as a bitset, for persistence. */
function snapshotBits(canvas: HTMLCanvasElement, meta: ExploredMaskMeta): Uint8Array | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const image = context.getImageData(0, 0, meta.cols, meta.rows);
  const bits = new Uint8Array(byteLengthFor(meta));
  for (let index = 0; index < meta.cols * meta.rows; index += 1) {
    if (image.data[index * 4 + 3]! >= EXPLORED_ALPHA_THRESHOLD) {
      bits[index >> 3]! |= 1 << (index & 7);
    }
  }
  return bits;
}

interface MaskEntry {
  key: string | null;
  meta: ExploredMaskMeta;
  canvas: HTMLCanvasElement | null;
}

/** A fresh canvas for one map, pre-loaded with whatever this player remembers. */
function buildEntry(
  storageKey: string | null,
  meta: ExploredMaskMeta,
  sceneWidth: number,
  sceneHeight: number,
): MaskEntry {
  if (!storageKey) return { key: null, meta, canvas: null };
  const canvas = createCanvas(meta);
  if (canvas) {
    const stored = loadExploredMask(storageKey, { ...meta, sceneWidth, sceneHeight });
    if (stored) {
      restore(canvas, meta, stored);
    } else {
      // Either nothing was stored or it described a different map. Drop it so a
      // stale entry does not sit in the quota until the LRU reaches it.
      clearExploredMask(storageKey);
    }
  }
  return { key: storageKey, meta, canvas };
}

export function useExploredFog({
  storageKey,
  sceneWidth,
  sceneHeight,
  polygons,
}: UseExploredFogInput): ExploredFogResult {
  const meta = useMemo(() => maskGeometryFor(sceneWidth, sceneHeight), [sceneWidth, sceneHeight]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // The canvas is built during the FIRST render rather than in an effect, so
  // mounting the fog layer costs one render and not two. A new map (or a new
  // table, or a different player) is a different memory, and the effect below
  // swaps it — but only when the identity inputs really changed, so a re-render
  // for any other reason does not churn the mask.
  const [entry, setEntry] = useState(() => buildEntry(storageKey, meta, sceneWidth, sceneHeight));
  const [revision, setRevision] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(entry.canvas);
  canvasRef.current = entry.canvas;

  useEffect(() => {
    setEntry((previous) =>
      previous.key === storageKey && previous.meta === meta
        ? previous
        : buildEntry(storageKey, meta, sceneWidth, sceneHeight),
    );
  }, [storageKey, meta, sceneWidth, sceneHeight]);

  // Accumulate. `polygons` is already memoized by the caller on a value key, so
  // this runs when vision actually changed — not on every camera frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !storageKey || polygons.length === 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let painted = false;
    context.save();
    context.setTransform(1 / meta.cell, 0, 0, 1 / meta.cell, 0, 0);
    context.fillStyle = "#ffffff";
    for (const polygon of polygons) {
      if (polygon.length < 3) continue;
      context.beginPath();
      context.moveTo(polygon[0]!.x, polygon[0]!.y);
      for (let i = 1; i < polygon.length; i += 1) {
        context.lineTo(polygon[i]!.x, polygon[i]!.y);
      }
      context.closePath();
      context.fill();
      painted = true;
    }
    context.restore();

    if (!painted) return;
    dirty.current = true;
    setRevision((value) => value + 1);

    if (saveTimer.current === null) {
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        const current = canvasRef.current;
        if (!current || !dirty.current) return;
        dirty.current = false;
        const bits = snapshotBits(current, meta);
        if (bits) saveExploredMask(storageKey, { ...meta, sceneWidth, sceneHeight }, bits);
      }, SAVE_DEBOUNCE_MS);
    }
  }, [polygons, storageKey, meta, sceneWidth, sceneHeight]);

  // Flush on unmount, so closing the tab after exploring a corridor remembers it.
  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const canvas = canvasRef.current;
      if (!canvas || !storageKey || !dirty.current) return;
      dirty.current = false;
      const bits = snapshotBits(canvas, meta);
      if (bits) saveExploredMask(storageKey, { ...meta, sceneWidth, sceneHeight }, bits);
    };
  }, [storageKey, meta, sceneWidth, sceneHeight]);

  return { canvas: entry.canvas, revision };
}
