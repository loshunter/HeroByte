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

import { useCallback, useState } from "react";
import type { MapGridSettings } from "@herobyte/shared";
import type { MapStudioController } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import type { GenerateParams } from "./mapEditTypes";

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

export interface UseGenerateReturn {
  params: GenerateParams;
  setParams: (params: GenerateParams) => void;
  rerollSeed: () => void;
  /** Record the region the generate drag just swept. */
  onRegionDragged: (bounds: RoomBounds) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  region: { cols: number; rows: number } | null;
}

export function useGenerate(
  controller: MapStudioController,
  isLive: boolean,
  notifyError?: (message: string) => void,
): UseGenerateReturn {
  const [params, setParams] = useState<GenerateParams>({
    theme: "stone",
    density: "medium",
    secretDoorChance: 0.15,
    seed: freshSeed(),
  });
  const [bounds, setBounds] = useState<CellBounds | null>(null);

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

  const onGenerate = useCallback(() => {
    if (!bounds || !isLive || controller.saving) return;
    // Refuse locally with the same rules the server enforces, so a bad drag
    // reads as a hint on the button rather than a round-trip and a red toast.
    const problem = regionProblem(bounds);
    if (problem) {
      notifyError?.(problem);
      return;
    }
    controller.generate({
      recipe: "dungeon",
      seed: params.seed,
      bounds,
      params: {
        theme: params.theme,
        density: params.density,
        secretDoorChance: params.secretDoorChance,
      },
    });
  }, [bounds, isLive, controller, params, notifyError]);

  return {
    params,
    setParams,
    rerollSeed,
    onRegionDragged,
    onGenerate,
    canGenerate: Boolean(bounds) && isLive && !controller.saving && !regionProblem(bounds),
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
