// React face of the async field bake (P3): one manager per TerrainLayer
// instance, re-rendering the layer whenever the prefill lands, a painterly
// band arrives, or the bake completes. The manager signature-guards inside,
// so calling request on every relevant dep change is cheap.

import { useEffect, useMemo, useReducer, useRef } from "react";
import type { BakeLighting } from "../../render/terrainLighting";
import type { StructuredTerrainLayer } from "../../render/tileRenderCore";
import {
  createAsyncFieldBake,
  type AsyncFieldBakeManager,
  type AsyncFieldBakeState,
} from "./terrainBakeAsync";

export function useFieldBake(
  layers: readonly StructuredTerrainLayer[],
  gridSize: number,
  gridOffsetX: number,
  gridOffsetY: number,
  lighting?: BakeLighting,
): AsyncFieldBakeState {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const managerRef = useRef<AsyncFieldBakeManager | null>(null);
  if (!managerRef.current) managerRef.current = createAsyncFieldBake(() => bump());

  useEffect(() => () => managerRef.current?.dispose(), []);

  // Key lighting by VALUE — the snapshot object identity churns per broadcast.
  const lightingKey = useMemo(() => (lighting ? JSON.stringify(lighting) : ""), [lighting]);
  useEffect(() => {
    managerRef.current!.request(
      layers,
      { size: gridSize, offsetX: gridOffsetX, offsetY: gridOffsetY },
      lighting,
    );
    // lightingKey stands in for `lighting` (value-keyed; identity churns).
  }, [layers, gridSize, gridOffsetX, gridOffsetY, lightingKey]);

  return managerRef.current.state();
}
