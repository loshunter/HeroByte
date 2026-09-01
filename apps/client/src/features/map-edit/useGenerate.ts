// ============================================================================
// GENERATE (the dungeon recipe, from the palette)
// ============================================================================
// Owns the GENERATE dial state and the dragged target region, and fires the
// recipe at it. The heavy lifting is server-side: the client sends a ~200-byte
// message and the server builds the whole dungeon as ONE place-room command, so
// a maxed dungeon never crosses the wire and costs the DM one undo.
//
// It goes through `controller.generate`, NOT a raw sendMessage: the controller's
// one-in-flight queue is the only thing that mints a commandId the server echoes
// back, and the only channel that surfaces a rejection (the controller drops any
// map-studio-error whose commandId it did not mint). `controller.saving` is the
// pending state; `controller.error` is the toast, exactly like every other tool.

import { useCallback, useEffect, useState } from "react";
import type { MapGridSettings } from "@herobyte/shared";
import type { MapStudioController } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import type { GenerateParams, MapEditSubTool } from "./mapEditTypes";

/** The recipe's region, in document-grid CELLS (what the wire expects). */
interface CellBounds {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

/**
 * Mirrors the server resolver's MIN_RECIPE_COLS/ROWS. Below this you get one
 * sealed room rather than a dungeon — see the measurement in the server's
 * generation/types.ts. Keep the two in step.
 */
const MIN_REGION_SIDE = 20;
/** Mirrors MAX_TERRAIN_PAINT_CELLS — the server refuses more in one command. */
const MAX_REGION_CELLS = 16384;

const ALREADY_BUILT = "Built here already — reroll the seed or change a dial to build again.";

export interface UseGenerateReturn {
  params: GenerateParams;
  setParams: (params: GenerateParams) => void;
  rerollSeed: () => void;
  /** Record the region the generate drag just swept. */
  onRegionDragged: (bounds: RoomBounds) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  /** Why GENERATE is refused, or null when the region is fine (or absent). */
  hint: string | null;
  region: { cols: number; rows: number } | null;
}

export function useGenerate(
  controller: MapStudioController,
  isLive: boolean,
  subTool: MapEditSubTool,
  mapEditMode: boolean,
  notifyError?: (message: string) => void,
): UseGenerateReturn {
  // Armed is BOTH halves. Taking the caller's pre-computed boolean meant it
  // only ever knew about the sub-tool, and the mode half had nowhere to live
  // at the call site — see the note on the clearing effect below.
  const armed = mapEditMode && subTool === "generate";
  const [params, setParams] = useState<GenerateParams>({
    theme: "stone",
    density: "medium",
    seed: freshSeed(),
  });
  const [bounds, setBounds] = useState<CellBounds | null>(null);

  // The aimed region is spatial, but the only thing that ever showed it was the
  // rubber band, and that is dropped on release (useMapEditDragPreview.clear).
  // Nothing else cleared it — setBounds had exactly one caller — so a DM who
  // aimed, switched to Wall, built for a while and came back found the panel
  // still reading "Region: 24 × 30 cells", armed for a rectangle that had not
  // been visible for minutes and might be off-screen entirely. Disarming the
  // tool is the honest moment to forget it.
  //
  // Deliberately NOT cleared on a successful generate: rerolling the seed and
  // firing again at the same rectangle is a real workflow, and that needs the
  // bounds to survive. See the note on canGenerate below for the other half.
  //
  // LEAVING MAP-EDIT counts as disarming too. useMapEditState is mounted at
  // the App level and its activeSubTool outlives the mode, so a DM who aimed
  // a region and then hit Exit came back — minutes or a session later — with
  // GENERATE still armed at a rectangle from before.
  useEffect(() => {
    if (!armed) setBounds(null);
  }, [armed]);

  // A DOCUMENT SWAP disarms the aim too (A5): the bounds are cell coordinates
  // computed against the ACTIVE document's grid, and travel can repoint the
  // palette at another map — the same rectangle there is a different place,
  // silently. The blind spot the disarm-on-exit note above predicts.
  const activeDocumentId = controller.activeDocument?.id;
  useEffect(() => {
    setBounds(null);
  }, [activeDocumentId]);

  const onRegionDragged = useCallback(
    (dragged: RoomBounds) => {
      const grid = controller.activeDocument?.grid;
      if (!grid) return;
      setBounds(toCellBounds(dragged, grid));
    },
    [controller.activeDocument],
  );

  const rerollSeed = useCallback(() => {
    // UI-side randomness is fine — only the RECIPE must be pure. The seed the
    // DM lands on is what makes the dungeon reproducible from here on.
    setParams((current) => ({ ...current, seed: freshSeed() }));
  }, []);

  // Computed once and surfaced, not recomputed and discarded. `canGenerate`
  // already folds this in, which DISABLES the button — so the notifyError below
  // could never fire for a bad region, and the DM got a mute dead button.
  const problem = regionProblem(bounds);

  /**
   * The recipe is PURE: same seed, same bounds, same dials builds the same
   * dungeon. So a second press with nothing changed does not rebuild — it
   * places an identical copy on top, doubling every element, and one undo
   * removes only the copy. `usePopulate` guards exactly this ("a second click
   * can't silently stack a byte-identical scatter") and Generate did not.
   *
   * Keyed on the whole recipe rather than a fired-once flag, so rerolling the
   * seed, changing a dial or aiming somewhere new all re-arm it — which is the
   * reroll-and-try-again workflow the effect above deliberately preserves.
   */
  const [lastBuilt, setLastBuilt] = useState<string | null>(null);
  const recipeKey = bounds ? JSON.stringify([bounds, params]) : null;
  const alreadyBuilt = recipeKey !== null && recipeKey === lastBuilt;

  const onGenerate = useCallback(() => {
    if (!bounds || !isLive || controller.saving) return;
    // Refuse locally with the same rules the server enforces, so a bad drag
    // reads as a hint on the button rather than a round-trip and a red toast.
    if (problem) {
      notifyError?.(problem);
      return;
    }
    // Guarded HERE as well as in canGenerate, matching how `problem` works. The
    // disabled button is the only thing stopping this today, and onGenerate is
    // a bare callback in a props bag — the next surface to wire it (a hotkey,
    // the quick wheel) would not inherit the UI guard.
    if (alreadyBuilt) {
      notifyError?.(ALREADY_BUILT);
      return;
    }
    controller.generate({
      recipe: "dungeon",
      seed: params.seed,
      bounds,
      params: { theme: params.theme, density: params.density },
    });
    setLastBuilt(recipeKey);
  }, [bounds, isLive, controller, params, notifyError, problem, recipeKey, alreadyBuilt]);

  return {
    params,
    setParams,
    rerollSeed,
    onRegionDragged,
    onGenerate,
    canGenerate: Boolean(bounds) && isLive && !controller.saving && !problem && !alreadyBuilt,
    hint: problem ?? (alreadyBuilt ? ALREADY_BUILT : null),
    region: bounds ? { cols: bounds.cols, rows: bounds.rows } : null,
  };
}

/** Document pixels → grid cells, the same lattice the recipe lays out on. */
function toCellBounds(bounds: RoomBounds, grid: MapGridSettings): CellBounds {
  return {
    x: Math.round((bounds.x - grid.offsetX) / grid.size),
    y: Math.round((bounds.y - grid.offsetY) / grid.size),
    cols: Math.max(1, Math.round(bounds.width / grid.size)),
    rows: Math.max(1, Math.round(bounds.height / grid.size)),
  };
}

function regionProblem(bounds: CellBounds | null): string | null {
  if (!bounds) return null;
  if (bounds.cols < MIN_REGION_SIDE || bounds.rows < MIN_REGION_SIDE) {
    return `Drag at least ${MIN_REGION_SIDE}×${MIN_REGION_SIDE} cells — a dungeon needs room for rooms AND the halls between them.`;
  }
  if (bounds.cols * bounds.rows > MAX_REGION_CELLS) {
    return `That area is too big (max ${MAX_REGION_CELLS} cells) — drag a smaller region.`;
  }
  return null;
}

function freshSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  // Signed 32-bit: the recipe's stream salts XOR against it.
  return values[0]! | 0;
}
