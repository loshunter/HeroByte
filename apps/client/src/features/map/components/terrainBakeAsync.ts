// ============================================================================
// ASYNC FIELD-BAKE MANAGER (P3 — never block the table)
// ============================================================================
// Orchestrates the worker bake for the live table: on a terrain/grid/lighting
// change it PREFILLS the bake canvas with each family's flat base colour
// (instant — the table shows colour immediately), posts the job to the shared
// bake worker, and paints the streamed painterly bands over the prefill as
// they land. Same cache-key discipline as getFieldBake (layers identity +
// grid/lighting signatures). Environments without Worker/OffscreenCanvas
// (tests, old browsers) fall back to the synchronous bakeProceduralTerrain —
// exactly the pre-P3 pipeline. A tiny module-level store feeds the progress
// chip (TerrainBakeChip) without prop threading.

import {
  buildProceduralFieldConfig,
  MAX_BAKE_DIM,
  MAX_BAKE_PIXELS,
  type BakedProceduralTerrain,
  type ProceduralGrid,
  type TerrainPalette,
} from "../../render/proceduralTerrainSurface";
import type { BakeLighting } from "../../render/terrainLighting";
import { gradeTerrainPalette, nightGradeStrength } from "../../render/terrainNightGrade";
import { VILLAGE_SHADOW_TINT, VILLAGE_TERRAIN } from "../../render/terrainPalette";
import type { StructuredTerrainLayer } from "../../render/tileRenderCore";
import { createFieldBakeCache, getFieldBake } from "./terrainBake";
import { publishTerrainBakeChip } from "./terrainBakeChipStore";
import type { BakeJobMessage, BakeWorkerReply } from "./terrainBakeWorker";

export interface AsyncFieldBakeState {
  baked: BakedProceduralTerrain | null;
  /** 0..1 painterly completion; 1 when the art is final (or flat fallback). */
  progress: number;
  pending: boolean;
  /** Bumps on every visual change (prefill, band landed, done) — memo key. */
  revision: number;
}

// --- Shared worker (one per page; jobs supersede by id) ---------------------

let sharedWorker: Worker | null = null;
let workerBroken = false;
let nextJobId = 1;
const jobHandlers = new Map<number, (reply: BakeWorkerReply) => void>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(new URL("./terrainBakeWorker.ts", import.meta.url), {
        type: "module",
      });
      sharedWorker.onmessage = (event: MessageEvent<BakeWorkerReply>) => {
        jobHandlers.get(event.data.jobId)?.(event.data);
      };
      sharedWorker.onerror = () => {
        // A worker that cannot even load (CSP, bundler edge) is terminal for
        // the session — every future bake takes the synchronous path instead.
        workerBroken = true;
        sharedWorker?.terminate();
        sharedWorker = null;
      };
    } catch {
      workerBroken = true;
      sharedWorker = null;
    }
  }
  return sharedWorker;
}

/** Each family's flat base colour over its cells — the instant stand-in the
 * painterly bands then overwrite. */
function prefillFlat(
  ctx: CanvasRenderingContext2D,
  layers: readonly StructuredTerrainLayer[],
  palette: TerrainPalette,
  originX: number,
  originY: number,
): void {
  for (const layer of layers) {
    const fam = palette[layer.assetId];
    if (!fam) continue;
    ctx.fillStyle = fam.base;
    for (const cell of layer.cells) {
      ctx.fillRect(cell.x - originX, cell.y - originY, cell.size, cell.size);
    }
  }
}

export interface AsyncFieldBakeManager {
  /** Signature-guarded like getFieldBake: only a real change starts a bake. */
  request(
    layers: readonly StructuredTerrainLayer[],
    grid: ProceduralGrid,
    lighting?: BakeLighting,
  ): void;
  state(): AsyncFieldBakeState;
  dispose(): void;
}

export function createAsyncFieldBake(onUpdate: () => void): AsyncFieldBakeManager {
  let state: AsyncFieldBakeState = { baked: null, progress: 1, pending: false, revision: 0 };
  let source: readonly StructuredTerrainLayer[] | null = null;
  let gridSig = "";
  let lightingSig = "";
  let activeJobId = 0;
  // Fallback bakes go through the SAME tested sync path (grade + bake) the
  // pre-P3 pipeline used — one implementation, no drift.
  const syncCache = createFieldBakeCache();

  const update = (patch: Partial<AsyncFieldBakeState>): void => {
    state = { ...state, ...patch, revision: state.revision + 1 };
    publishTerrainBakeChip(state.pending, state.progress);
    onUpdate();
  };

  const finishJob = (): void => {
    jobHandlers.delete(activeJobId);
    activeJobId = 0;
  };

  function request(
    layers: readonly StructuredTerrainLayer[],
    grid: ProceduralGrid,
    lighting?: BakeLighting,
  ): void {
    const nextGridSig = `${grid.size}|${grid.offsetX}|${grid.offsetY}`;
    const nextLightingSig = lighting ? JSON.stringify(lighting) : "";
    if (source === layers && gridSig === nextGridSig && lightingSig === nextLightingSig) return;
    source = layers;
    gridSig = nextGridSig;
    lightingSig = nextLightingSig;
    finishJob(); // supersede any in-flight bake

    const palette = gradeTerrainPalette(
      VILLAGE_TERRAIN,
      nightGradeStrength(lighting?.ambient ?? 1),
    );
    const worker = getWorker();
    if (!worker) {
      // Synchronous fallback: byte-exact pre-P3 behaviour (tests, old browsers).
      update({
        baked: getFieldBake(syncCache, layers, grid, lighting),
        progress: 1,
        pending: false,
      });
      return;
    }

    const built = buildProceduralFieldConfig(layers, grid, palette, VILLAGE_SHADOW_TINT);
    if (
      !built ||
      built.width > MAX_BAKE_DIM ||
      built.height > MAX_BAKE_DIM ||
      built.width * built.height > MAX_BAKE_PIXELS
    ) {
      // No field terrain, or over the caps — flat/atlas core fallback, as ever.
      update({ baked: null, progress: 1, pending: false });
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = built.width;
    canvas.height = built.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      update({ baked: null, progress: 1, pending: false });
      return;
    }
    prefillFlat(ctx, layers, palette, built.config.originX, built.config.originY);
    const baked: BakedProceduralTerrain = {
      canvas,
      originX: built.config.originX,
      originY: built.config.originY,
      width: built.width,
      height: built.height,
    };

    const jobId = nextJobId++;
    activeJobId = jobId;
    jobHandlers.set(jobId, (reply) => {
      if (jobId !== activeJobId) {
        jobHandlers.delete(jobId);
        return;
      }
      if (reply.type === "chunk") {
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(reply.pixels), reply.width, reply.height),
          0,
          reply.top,
        );
        update({ progress: reply.bandsDone / reply.bandsTotal, pending: true });
      } else if (reply.type === "done") {
        finishJob();
        update({ progress: 1, pending: false });
      } else {
        // "empty": the worker could not bake (e.g. no OffscreenCanvas). Take
        // the synchronous path so the painterly art still lands.
        finishJob();
        update({
          baked: getFieldBake(syncCache, layers, grid, lighting),
          progress: 1,
          pending: false,
        });
      }
    });
    const job: BakeJobMessage = {
      jobId,
      terrainLayers: layers as StructuredTerrainLayer[],
      grid,
      palette,
      shadowTint: VILLAGE_SHADOW_TINT,
      lighting,
    };
    worker.postMessage(job);
    update({ baked, progress: 0, pending: true });
  }

  return {
    request,
    state: () => state,
    dispose(): void {
      finishJob();
      if (state.pending) publishTerrainBakeChip(false, 1);
    },
  };
}
