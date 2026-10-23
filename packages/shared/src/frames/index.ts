// Token frames (C5a): the model, the catalog, the rules, and the pure bake.

export * from "./types.js";
export * from "./frameLimits.js";
export * from "./generatorSpecs.js";
export * from "./frameCatalog.generated.js";
export * from "./catalogSource.js";
export * from "./frameValidation.js";
export * from "./frameDefaults.js";
export {
  layoutFrame,
  bandLength,
  warpPoint,
  warpPolygon,
  courseCount,
  type BandRing,
  type Facet,
  type FrameLayout,
} from "./engine/bandSpace.js";
export {
  bakeFrame,
  framePaints,
  type FrameBakeInput,
  type FrameBakeResult,
} from "./engine/frameBake.js";
export { frameSeed, bandSeed, pinFrameSeeds } from "./engine/frameSeeds.js";
export { frameBakeKey, frameGlowsPersonal, frameUsesAccent } from "./engine/frameBakeKey.js";
export { framePaletteById, framePresetName } from "./catalogLookup.js";
export { insideOutline, isPolygonShape, shapeOutline, type PolygonShape } from "./engine/shapes.js";
export { personalRoleColor, diffuse, LIGHT as FRAME_LIGHT_VECTOR } from "./engine/shading.js";
export { FRAME_GENERATORS } from "./engine/generators/index.js";
