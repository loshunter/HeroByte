// The shipped palettes by id, safely: an own-property test, so "constructor",
// "__proto__" or "toString" never pass for a palette (they are on every
// plain object, and a lookup would find them).

import { FRAME_PALETTES } from "./frameCatalog.generated.js";
import type { FramePalette } from "./types.js";

export function framePaletteById(
  id: unknown,
  catalog: Readonly<Record<string, FramePalette>> = FRAME_PALETTES,
): FramePalette | undefined {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(catalog, id)
    ? catalog[id]
    : undefined;
}
