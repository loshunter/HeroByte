// ============================================================================
// THE PLACEMENT DIALS
// ============================================================================
// What Place, Scatter and Row drop, and how: the armed asset, the desktop
// picker's open/closed flag, whether a drop lands as a grid TILE or a free
// STAMP, and how far that stamp is turned.
//
// These lived in three different places until M7 and could not all be reached
// by the same surface. `selectedAssetId` was App-level state; stamp-vs-tile was
// the Alt KEY, read inside useMapEditPlacement; rotation was local state in the
// same hook, driven by R and Shift+R. A phone has no Alt and no R, so a mobile
// control needed all four in one place the toolbar bag can see — and lifting
// them one at a time would have pushed useMapEditState past its 350-line guard
// with nothing extracted.
//
// Lifting rotation and stamp-mode out of useMapEditPlacement is what makes them
// SHARED rather than mobile-only. The desktop keeps Alt and R — they are faster
// than any button — but both now write the same state the on-screen controls
// read, so a DM who toggles stamp on a tablet and rotates the window to the
// desktop layout can still see what is armed. An invisible armed mode is the
// failure this arc has paid for more than once.
//
// @module features/map-edit/usePlacementDials

import { useCallback, useState } from "react";
import { floorFamilyFromAssetId } from "./mapEditFamilies";
import type { MapEditFloorFamily, MapEditSubTool } from "./mapEditTypes";

/** Free stamps turn in fifteens — the Map Studio Shelf spec's own step. */
export const STAMP_ROTATION_STEP = 15;

const DEFAULT_ASSET_ID = "objects:crate";

interface UsePlacementDialsOptions {
  /** Sampling a terrain family re-arms the floor picker too. */
  setFloorFamily: (family: MapEditFloorFamily) => void;
  /** The eyedropper hands the place tool over, so the next drop uses it. */
  setActiveSubTool: (tool: MapEditSubTool) => void;
}

/**
 * The two modifiers a DROP reads, travelling as one object.
 *
 * Named apart from the rest of the dials because MapBoard needs exactly these
 * and nothing else — but it takes all four together rather than three separate
 * props, for the reason the mobile dock takes the whole toolbar bag: a subset
 * is how a forwarding prop goes missing with a green typecheck.
 *
 * `MapEditToolbarProps` carries the same four names, so a layout can hand its
 * toolbar bag straight down without a second source of truth for what is armed.
 */
export interface PlacementModifiers {
  /** True = drop a free stamp centred on the point; false = snap a grid tile. */
  stampMode: boolean;
  onToggleStampMode: () => void;
  /** Degrees, 0..359. Applies to STAMPS only — the tile lattice is axis-aligned. */
  stampRotation: number;
  /** Turn by one step; negative reverses. Wraps rather than clamping. */
  onRotateStamp: (steps: number) => void;
}

export interface PlacementDials extends PlacementModifiers {
  selectedAssetId: string;
  onSelectAsset: (assetId: string) => void;
  assetPickerOpen: boolean;
  onToggleAssetPicker: () => void;
  /** Eyedropper re-arm: sample an asset and hand over to the place tool. */
  onSampleAsset: (assetId: string) => void;
}

export function usePlacementDials({
  setFloorFamily,
  setActiveSubTool,
}: UsePlacementDialsOptions): PlacementDials {
  const [selectedAssetId, setSelectedAssetId] = useState<string>(DEFAULT_ASSET_ID);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [stampMode, setStampMode] = useState(false);
  const [stampRotation, setStampRotation] = useState(0);

  const onToggleAssetPicker = useCallback(() => setAssetPickerOpen((open) => !open), []);
  const onToggleStampMode = useCallback(() => setStampMode((on) => !on), []);

  const onRotateStamp = useCallback((steps: number) => {
    setStampRotation(
      (current) => (current + steps * STAMP_ROTATION_STEP + 360 * Math.abs(steps || 1)) % 360,
    );
  }, []);

  // Eyedropper re-arm: sampling a terrain family also updates the floor picker;
  // the place tool takes over so the next click drops the sampled asset.
  const onSampleAsset = useCallback(
    (assetId: string) => {
      setSelectedAssetId(assetId);
      const family = floorFamilyFromAssetId(assetId);
      if (family) setFloorFamily(family);
      setActiveSubTool("place");
    },
    [setFloorFamily, setActiveSubTool],
  );

  return {
    selectedAssetId,
    onSelectAsset: setSelectedAssetId,
    assetPickerOpen,
    onToggleAssetPicker,
    stampMode,
    onToggleStampMode,
    stampRotation,
    onRotateStamp,
    onSampleAsset,
  };
}
