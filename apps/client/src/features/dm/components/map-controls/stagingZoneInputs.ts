// ============================================================================
// STAGING ZONE INPUTS
// ============================================================================
// Pure helpers behind StagingZoneControl: the five text fields to and from a
// zone, and the zone placed from the DM's current view. Everything here is in
// grid tiles; the camera and grid size convert from screen pixels.

export interface StagingZone {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface StagingInputs {
  x: string;
  y: string;
  width: string;
  height: string;
  rotation: string;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

export const DEFAULT_STAGING_INPUTS: StagingInputs = {
  x: "0",
  y: "0",
  width: "6",
  height: "6",
  rotation: "0",
};

// The smallest zone the table keeps. The server refuses anything under 0.5
// (validateStagingZone) and stores anything under 1 as 1 (sanitizeStagingZone),
// so a 0.5 typed here would silently come back as 1.
export const MIN_STAGING_SIZE = 1;

export function stagingInputsFrom(zone?: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): StagingInputs {
  if (!zone) return DEFAULT_STAGING_INPUTS;
  return {
    x: zone.x.toFixed(2),
    y: zone.y.toFixed(2),
    width: zone.width.toFixed(2),
    height: zone.height.toFixed(2),
    rotation: (zone.rotation ?? 0).toFixed(1),
  };
}

// Number("") is 0, so a cleared field would silently become 0 without the
// blank check.
function parseField(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The typed size and rotation, or null if any of them would be refused. */
export function parseStagingShape(
  inputs: StagingInputs,
): Pick<StagingZone, "width" | "height" | "rotation"> | null {
  const width = parseField(inputs.width);
  const height = parseField(inputs.height);
  const rotation = parseField(inputs.rotation);
  if (width === null || height === null || rotation === null) return null;
  if (width < MIN_STAGING_SIZE || height < MIN_STAGING_SIZE) return null;
  return { width, height, rotation };
}

/** The zone exactly as typed, or null if any field would be refused. */
export function parseStagingInputs(inputs: StagingInputs): StagingZone | null {
  const x = parseField(inputs.x);
  const y = parseField(inputs.y);
  const shape = parseStagingShape(inputs);
  if (x === null || y === null || shape === null) return null;
  return { x, y, ...shape };
}

function viewportSize() {
  return {
    width: typeof window !== "undefined" ? window.innerWidth : 800,
    height: typeof window !== "undefined" ? window.innerHeight : 600,
  };
}

/**
 * The middle of the DM's screen, in grid tiles. It is the browser window's
 * centre, so it ignores the panels drawn over the map.
 */
export function viewCenter(camera: Camera, gridSize: number): { x: number; y: number } {
  const viewport = viewportSize();
  // Screen centre -> world pixels through the camera transform -> tiles.
  const centerWorldX = (viewport.width / 2 - camera.x) / camera.scale;
  const centerWorldY = (viewport.height / 2 - camera.y) / camera.scale;
  return { x: centerWorldX / gridSize, y: centerWorldY / gridSize };
}

/**
 * A first zone with nothing typed: centred on the view and about 40% of its
 * size at the current zoom, at least one tile each way.
 */
export function viewportZone(camera: Camera, gridSize: number): StagingZone {
  const viewport = viewportSize();
  const widthInWorld = viewport.width / camera.scale;
  const heightInWorld = viewport.height / camera.scale;
  return {
    ...viewCenter(camera, gridSize),
    width: Math.max(1, (widthInWorld * 0.4) / gridSize),
    height: Math.max(1, (heightInWorld * 0.4) / gridSize),
    rotation: 0,
  };
}
