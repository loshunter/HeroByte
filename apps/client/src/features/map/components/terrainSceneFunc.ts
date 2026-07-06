// Pure canvas draw for the live table's terrain layer, extracted from the
// Konva Shape so it can be unit-tested against a recording context (Konva
// sceneFuncs don't run under the react-konva div mock). It is the table's half
// of "one renderer, both surfaces": the same shared tile-render core the editor
// underlay draws through, so published terrain looks identical at the table —
// atlas textures where a family has them, flat fills (and animated water)
// otherwise. The caller owns the camera/map transform (applied by the enclosing
// Konva Groups) and the layer opacity (the Shape's opacity).
import {
  drawTerrain,
  type StructuredTerrainLayer,
  type TerrainAtlasSource,
  type TileRenderContext2D,
} from "../../render/tileRenderCore";
import { terrainStyleForFrame } from "../../map-studio/starterTiles";

/**
 * Draw published terrain layers at the live table. `frame` cycles ambient
 * animation (water shimmer) on the shared 300ms clock; frame 0 matches the
 * static export. No view cull — the enclosing stage transform makes the world
 * rect derivation error-prone, and terrain only redraws while water animates.
 */
export function drawTableTerrain(
  ctx: TileRenderContext2D,
  layers: readonly StructuredTerrainLayer[],
  atlas: TerrainAtlasSource | null,
  frame: number,
  boundaryWidth?: number,
): void {
  drawTerrain(ctx, layers, terrainStyleForFrame, frame, undefined, {
    atlas: atlas ?? undefined,
    boundaryWidth,
  });
}
