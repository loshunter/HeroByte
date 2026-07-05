import { memo } from "react";
import { useAnimationFrameIndex } from "../../render/useAnimationClock";
import { getMapStudioTileAsset, terrainFillForFrame } from "../starterTiles";
import type { TerrainRenderLayer } from "../terrainRender";

/** Longest animated terrain cycle; the clock frame wraps within this. */
const TERRAIN_ANIM_FRAMES = 4;

interface MapStudioTerrainLayersProps {
  terrainLayers: TerrainRenderLayer[];
  gridSize: number;
  opacity: number;
  /** Whether any painted family animates; false skips the clock entirely. */
  animated: boolean;
}

/**
 * The painted-terrain fill/boundary groups. Isolated from the canvas so the
 * shared animation clock re-renders only this subtree (a handful of nodes),
 * never the element layer. Frame 0 is the static fill, matching the export.
 */
export const MapStudioTerrainLayers = memo(function MapStudioTerrainLayers({
  terrainLayers,
  gridSize,
  opacity,
  animated,
}: MapStudioTerrainLayersProps) {
  const frame = useAnimationFrameIndex(TERRAIN_ANIM_FRAMES, animated);
  return (
    <>
      {terrainLayers.map((layer) => {
        const asset = getMapStudioTileAsset(layer.assetId);
        return (
          <g
            key={layer.assetId}
            data-terrain={layer.assetId}
            opacity={opacity}
            pointerEvents="none"
          >
            <path d={layer.fillPath} fill={terrainFillForFrame(asset, frame)} />
            {layer.boundaryPath && (
              <path
                d={layer.boundaryPath}
                fill="none"
                stroke={asset.stroke}
                strokeWidth={Math.max(2, gridSize * 0.04)}
              />
            )}
          </g>
        );
      })}
    </>
  );
});
