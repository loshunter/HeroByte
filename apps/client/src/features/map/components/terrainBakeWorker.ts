// ============================================================================
// TERRAIN BAKE WORKER (P3 — never block the table)
// ============================================================================
// NOTE: no `/// <reference lib="webworker" />` — the client program compiles
// against lib.dom and mixing the two libs conflicts project-wide. The few
// worker-global touches (self.onmessage / postMessage-with-transfer) go
// through narrow local types instead.
// The heavy field bake OFF the main thread: per horizontal band, render the
// procedural field pixels (renderTerrainField — pure), layer the interior
// detail through an OffscreenCanvas, apply the lighting post-pass, and stream
// the finished band back as a transferable buffer. Between bands the loop
// yields, so a superseding job (terrain edited mid-bake) aborts the old one at
// the next band boundary. Shimmer/anim overlays stay main-thread (cheap frame
// overlays); the SVG/publish and thumbnail bakes keep the synchronous path.

import {
  buildProceduralFieldConfig,
  paintProceduralDetail,
  MAX_BAKE_DIM,
  MAX_BAKE_PIXELS,
  type TerrainPalette,
  type ProceduralGrid,
} from "../../render/proceduralTerrainSurface";
import { createTerrainField, renderTerrainField } from "../../render/proceduralTerrain";
import { applyBakeLighting, lightingActive, type BakeLighting } from "../../render/terrainLighting";
import type { StructuredTerrainLayer, TileRenderContext2D } from "../../render/tileRenderCore";
import { bandLayers, planBakeBands } from "./terrainBakeChunks";

export interface BakeJobMessage {
  jobId: number;
  terrainLayers: StructuredTerrainLayer[];
  grid: ProceduralGrid;
  /** Already night-graded on the main thread (plain data — cloneable). */
  palette: TerrainPalette;
  shadowTint?: string;
  lighting?: BakeLighting;
}

export type BakeWorkerReply =
  | {
      jobId: number;
      type: "chunk";
      top: number;
      width: number;
      height: number;
      pixels: ArrayBuffer;
      bandsDone: number;
      bandsTotal: number;
    }
  | { jobId: number; type: "done" }
  /** No bakeable field, over the caps, or OffscreenCanvas missing — the main
   * thread falls back exactly as the synchronous pipeline would. */
  | { jobId: number; type: "empty" };

let currentJobId = 0;

self.onmessage = (event: MessageEvent<BakeJobMessage>) => {
  currentJobId = event.data.jobId;
  void runJob(event.data);
};

function post(reply: BakeWorkerReply, transfer: Transferable[] = []): void {
  (self as unknown as { postMessage(r: BakeWorkerReply, t: Transferable[]): void }).postMessage(
    reply,
    transfer,
  );
}

async function runJob(job: BakeJobMessage): Promise<void> {
  const built = buildProceduralFieldConfig(
    job.terrainLayers,
    job.grid,
    job.palette,
    job.shadowTint,
  );
  if (
    !built ||
    typeof OffscreenCanvas === "undefined" ||
    built.width > MAX_BAKE_DIM ||
    built.height > MAX_BAKE_DIM ||
    built.width * built.height > MAX_BAKE_PIXELS
  ) {
    post({ jobId: job.jobId, type: "empty" });
    return;
  }
  const { config, width, height } = built;
  const field = createTerrainField(config);
  const fieldLayers = job.terrainLayers.filter((layer) => job.palette[layer.assetId]);
  const bands = planBakeBands(width, height);

  for (let index = 0; index < bands.length; index += 1) {
    if (currentJobId !== job.jobId) return; // superseded — stop mid-bake
    const band = bands[index]!;
    const bandTopWorld = config.originY + band.top;

    // Field pixels for this band: same pure sampler, origin shifted down.
    const buffer = new Uint8ClampedArray(width * band.height * 4);
    renderTerrainField(buffer, width, band.height, { ...config, originY: bandTopWorld });

    // Detail + lighting through an OffscreenCanvas, clipped to the band so a
    // margin cell paints only its in-band pixels (the neighbouring band paints
    // the rest — deterministic painters, identical seam pixels).
    const canvas = new OffscreenCanvas(width, band.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      post({ jobId: job.jobId, type: "empty" });
      return;
    }
    ctx.putImageData(new ImageData(buffer, width, band.height), 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, band.height);
    ctx.clip();
    ctx.translate(-config.originX, -bandTopWorld);
    paintProceduralDetail(
      ctx as unknown as TileRenderContext2D,
      bandLayers(fieldLayers, bandTopWorld, bandTopWorld + band.height, config.cellSize),
      job.palette,
      field,
      config.familyAt,
      config.depthOf,
    );
    ctx.restore();

    const finished = ctx.getImageData(0, 0, width, band.height);
    if (lightingActive(job.lighting)) {
      applyBakeLighting(
        finished.data,
        width,
        band.height,
        config.originX,
        bandTopWorld,
        job.lighting!,
      );
    }
    post(
      {
        jobId: job.jobId,
        type: "chunk",
        top: band.top,
        width,
        height: band.height,
        pixels: finished.data.buffer,
        bandsDone: index + 1,
        bandsTotal: bands.length,
      },
      [finished.data.buffer],
    );

    // Yield so a newer job's message can land and supersede this loop.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (currentJobId === job.jobId) post({ jobId: job.jobId, type: "done" });
}
