// The shipped palettes by id, safely: an own-property test, so "constructor",
// "__proto__" or "toString" never pass for a palette (they are on every
// plain object, and a lookup would find them).

import { FRAME_PALETTES, FRAME_PRESETS } from "./frameCatalog.generated.js";
import type { FramePalette } from "./types.js";

export function framePaletteById(
  id: unknown,
  catalog: Readonly<Record<string, FramePalette>> = FRAME_PALETTES,
): FramePalette | undefined {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(catalog, id)
    ? catalog[id]
    : undefined;
}

/**
 * A shipped preset's shelf name. Apart from findFramePreset on purpose: the
 * settings button that shows it loads with the app, and frameDefaults would
 * bring the wire's validation into the app's entry chunk with it.
 */
export function framePresetName(id: string | undefined): string | undefined {
  return id === undefined ? undefined : FRAME_PRESETS.find((preset) => preset.id === id)?.name;
}
