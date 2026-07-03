import type { MapDocument, MapElement, MapLayer } from "@herobyte/shared";
import { getGridGeometry } from "./gridGeometry";
import { getMapStudioTileAsset } from "./starterTiles";
import {
  buildTileOccupancy,
  isAutotileCandidate,
  tileBoundaryPath,
  type AutotileGrid,
  type TileOccupancy,
} from "./tileAutotiling";

export type MapExportFormat = "json" | "svg" | "png" | "webp";

export function serializeMapDocument(document: MapDocument): string {
  return JSON.stringify(document, null, 2);
}

export function renderMapDocumentSvg(document: MapDocument): string {
  const grid = getGridGeometry(document.grid.type, document.grid.size);
  const layers = new Map(document.layers.map((layer) => [layer.id, layer]));
  const occupancy = buildTileOccupancy(document);
  const elements = document.elements
    .filter((element) => visible(element, layers.get(element.layerId)))
    .sort((a, b) => (layers.get(a.layerId)?.zIndex ?? 0) - (layers.get(b.layerId)?.zIndex ?? 0))
    .map((element) =>
      renderElement(element, layers.get(element.layerId)!, document.grid, occupancy),
    )
    .join("");
  const pattern = document.grid.visible
    ? `<defs><pattern id="grid" width="${grid.width}" height="${grid.height}" patternUnits="userSpaceOnUse" x="${document.grid.offsetX}" y="${document.grid.offsetY}"><path d="${grid.path}" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}"><title>${xml(document.name)}</title><rect width="100%" height="100%" fill="#24212b"/>${pattern}${elements}</svg>`;
}

export function createMapDocumentSvgDataUrl(document: MapDocument): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderMapDocumentSvg(document))}`;
}

export function downloadMapDocument(document: MapDocument, format: MapExportFormat): void {
  if (format === "png" || format === "webp") {
    void downloadRasterMapDocument(document, format);
    return;
  }
  const content =
    format === "json" ? serializeMapDocument(document) : renderMapDocumentSvg(document);
  const mime = format === "json" ? "application/json" : "image/svg+xml";
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), document, format);
}

export async function downloadRasterMapDocument(
  document: MapDocument,
  format: Extract<MapExportFormat, "png" | "webp"> = "png",
): Promise<void> {
  const blob = await rasterizeMapDocument(document, imageMime(format));
  downloadBlob(blob, document, format);
}

export async function rasterizeMapDocument(
  document: MapDocument,
  mimeType: "image/png" | "image/webp" = "image/png",
): Promise<Blob> {
  const svgUrl = URL.createObjectURL(
    new Blob([renderMapDocumentSvg(document)], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = await loadImage(svgUrl);
    const canvas = window.document.createElement("canvas");
    canvas.width = document.width;
    canvas.height = document.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create map export canvas context");
    context.drawImage(image, 0, 0);
    return await canvasToBlob(canvas, mimeType);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function downloadBlob(blob: Blob, document: MapDocument, format: MapExportFormat): void {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename(document.name)}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load map SVG for raster export"));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: "image/png" | "image/webp") {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Unable to create raster map export"));
      }
    }, mimeType);
  });
}

function imageMime(format: Extract<MapExportFormat, "png" | "webp">): "image/png" | "image/webp" {
  return format === "webp" ? "image/webp" : "image/png";
}

function renderElement(
  element: MapElement,
  layer: MapLayer,
  grid: AutotileGrid,
  occupancy: TileOccupancy,
): string {
  const gridSize = grid.size;
  const transform = element.transform;
  const attributes = `transform="translate(${transform.x} ${transform.y}) rotate(${transform.rotation}) scale(${transform.scaleX} ${transform.scaleY})" opacity="${layer.opacity}"`;
  if (element.type === "shape") {
    const [start, end] = element.data.points;
    if (!start || !end) return "";
    if (element.data.shape === "polygon") {
      const points = element.data.points.map((point) => `${point.x},${point.y}`).join(" ");
      return `<polygon ${attributes} points="${points}" ${paint(element)}/>`;
    }
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (element.data.shape === "ellipse") {
      return `<ellipse ${attributes} cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" ${paint(element)}/>`;
    }
    return `<rect ${attributes} x="${x}" y="${y}" width="${width}" height="${height}" ${paint(element)}/>`;
  }
  if (element.type === "wall") {
    const points = element.data.points.map((point) => `${point.x},${point.y}`).join(" ");
    return `<polyline ${attributes} points="${points}" fill="none" stroke="#e9d8a6" stroke-width="6"/>`;
  }
  if (element.type === "door") {
    return `<line ${attributes} x1="0" y1="0" x2="${element.data.width}" y2="0" stroke="#c99b55" stroke-width="8"/>`;
  }
  if (element.type === "light") {
    return `<circle ${attributes} r="${element.data.radius}" fill="${xml(element.data.color)}" fill-opacity="${element.data.intensity * 0.5}"/>`;
  }
  if (element.type === "text") {
    return `<text ${attributes} fill="${xml(element.data.color)}" font-size="${element.data.fontSize}">${xml(element.data.text)}</text>`;
  }
  const width = element.type === "stamp" ? element.data.width : element.data.columns * gridSize;
  const height = element.type === "stamp" ? element.data.height : element.data.rows * gridSize;
  const asset = getMapStudioTileAsset(element.data.assetId);
  const fill = element.data.tint ?? asset.fill;
  // Footprint elements rotate around their visual center — must match the
  // live canvas (MapStudioElementPreview) exactly.
  const footprintAttributes = `transform="translate(${transform.x} ${transform.y}) rotate(${transform.rotation} ${(width * transform.scaleX) / 2} ${(height * transform.scaleY) / 2}) scale(${transform.scaleX} ${transform.scaleY})" opacity="${layer.opacity}"`;
  if (element.type === "tile" && isAutotileCandidate(element, grid)) {
    // Autotiled terrain: no per-tile outline; borders appear only where a
    // cell faces different terrain, so contiguous paint reads as one surface.
    const boundary = tileBoundaryPath(element, grid, occupancy);
    const boundaryMarkup = boundary
      ? `<path d="${boundary}" fill="none" stroke="${xml(asset.stroke)}" stroke-width="2"/>`
      : "";
    return `<g ${footprintAttributes} data-asset-id="${xml(element.data.assetId)}"><rect width="${width}" height="${height}" fill="${xml(fill)}"/>${boundaryMarkup}</g>`;
  }
  return `<g ${footprintAttributes} data-asset-id="${xml(element.data.assetId)}"><rect width="${width}" height="${height}" fill="${xml(fill)}" stroke="${xml(asset.stroke)}" stroke-width="2"/><path d="M 0 ${height / 2} H ${width} M ${width / 2} 0 V ${height}" stroke="${xml(asset.accent ?? asset.stroke)}" stroke-opacity="0.55" stroke-width="1"/></g>`;
}

function paint(element: Extract<MapElement, { type: "shape" }>): string {
  return `fill="${xml(element.data.fill ?? "none")}" stroke="${xml(element.data.stroke)}" stroke-width="${element.data.strokeWidth}" opacity="${element.data.opacity}"`;
}

function visible(element: MapElement, layer?: MapLayer): boolean {
  const playerVisibleText = element.type !== "text" || element.data.visibleToPlayers;
  return Boolean(layer?.visible && layer.opacity > 0 && !element.hidden && playerVisibleText);
}

function xml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!,
  );
}

function filename(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "herobyte-map"
  );
}
