// ============================================================================
// TOKEN FRAMES — the shared model (C5a)
// ============================================================================
// A frame is a STACK OF BANDS drawn live around a token: each band is a
// generator (plain, masonry, plank, plate…) with its own thickness, height and
// material palette, generated in band space and warped onto the shape, then lit
// by the table's one fixed light. The design is
// docs/planning/token-frames-and-creator-plan.md §3. A token without `frame`
// draws exactly as it did before frames existed.
//
// Types only: the values (the catalog, the light, the limits) live in their
// own modules, because an `export const` in the shared barrel never reaches the
// server (shared-barrel-no-runtime-const).

/** Shapes the model names. Only "circle" is accepted until slice C5b. */
export type FrameShape = "circle" | "squircle" | "square" | "hexagon" | "octagon" | "shield";

/**
 * `in` keeps the outer edge on the token box; `out` keeps the window on it until
 * the frame stands 15% out (MAX_OUTSET), the rest growing in; `mid` splits.
 */
export type FrameGrowth = "in" | "out" | "mid";

/** Beyond "none" these are the DM's, and they arrive with slice C2. */
export type FrameFinish = "none" | "rainbow" | "shiny" | "gilded" | "void";

export type FrameBevelProfile = "round" | "chamfer" | "step" | "flat";

/** What a facet IS; the palette says what colour that is. */
export type FrameRole = "top" | "bevel" | "side" | "outline" | "crack" | "glow" | "tint" | "shadow";

export type FrameParamValue = number | string | boolean;

/** One band of a frame. Bands are listed inner → outer. */
export interface FrameBand {
  /** A generator id from the catalog ("plain", "masonry", "plank", "plate"). */
  generator: string;
  /** The generator's own knobs, validated against its schema and clamped. */
  params?: Record<string, FrameParamValue>;
  /** A palette id from the catalog ("stone.grey", "metal.steel", "personal"…). */
  palette: string;
  /** This band's thickness as a fraction of the token edge; the frame's weight is the sum. */
  weight: number;
  /** 0–1: how far the band's top face stands above the base plane. */
  depth: number;
  /** The band's edge profile; each generator has a default. */
  bevel?: { profile: FrameBevelProfile; width: number };
  /** Colour ("#rrggbb" or "personal") and strength 0–1 for the band's glow facets. */
  glow?: { color: string; strength: number };
  /** Deterministic jitter; absent = derived from the token id. */
  seed?: number;
}

/** The facing notch (C5b): one arrow gem at the top. C5c's bezel may add gems and counts. */
export interface FrameNotch {
  gem: "arrow";
  /** Only 1 until C5c. */
  count?: 1;
}

export interface TokenFrame {
  /** The shipped preset this stack was picked from (the simple-mode knobs keep it). */
  preset?: string;
  /** Default "circle". */
  shape?: FrameShape;
  /** Default "in". */
  growth?: FrameGrowth;
  /** 1–6 bands, inner → outer; weights sum to 0.04–0.34. */
  bands: FrameBand[];
  /** "#rrggbb" | "personal": what every "personal" palette role resolves to. Default "personal". */
  accent?: string;
  /** Slice C2's; only "none" (or absent) is accepted before then. */
  finish?: FrameFinish;
  /** One arrow gem at the top of the frame, pointing up (tokens have no facing yet). */
  notch?: FrameNotch;
}

/** A material: role colours plus how shiny it is. */
export interface FramePalette {
  id: string;
  name: string;
  /** "#rrggbb", or "personal" for a role that takes the frame's accent colour. */
  roles: Record<FrameRole, string>;
  /** 0–1: the strength of the white highlight under the table light. */
  specular: number;
  /** 0–1: how tight that highlight is (0 broad and soft, 1 a sharp glint). */
  gloss: number;
}

export type FramePresetTheme = "plain" | "stone" | "metal" | "wood";

/** A shipped stack with a name, for the shelf. Its frame is at regular weight. */
export interface FramePreset {
  id: string;
  name: string;
  theme: FramePresetTheme;
  tags: string[];
  frame: TokenFrame;
}
