// Terrain palettes as DATA — the per-family colours the procedural terrain
// renderer and the interior-detail painters read. Keeping colour out of the
// draw code means a map's "mood" (warm village, cool cave/swamp, or a
// user-chosen fantasy palette — purple grass, say) is a config swap, not a
// code change. See features/render/terrainDetail (the painters that consume
// these) and temp/_dirt_path_proto (the validated prototypes).

/**
 * Interior "key cluster" detail shades for a dirt-like family (dirt, path):
 * pebble clusters in three tans over a darker crevice/shadow tone. Slynyrd
 * "Top Down Tiles" pg-49 uses 3–4 low-contrast earthy tones.
 */
export interface KeyClusterPalette {
  /** Darker-than-base crevice tone — ground cracks and each pebble's shadow. */
  crev: string;
  /** The three pebble tans, dark → light (weighted toward `mid`). */
  dark: string;
  mid: string;
  light: string;
}

/** Default (warm "village" mood) dirt detail palette. */
export const DIRT_DETAIL: KeyClusterPalette = {
  crev: "#4a3420",
  dark: "#7a6440",
  mid: "#a49060",
  light: "#bfa876",
};

/** Default (warm "village" mood) path detail palette — worn, cooler-olive. */
export const PATH_DETAIL: KeyClusterPalette = {
  crev: "#3f3d28",
  dark: "#6a6748",
  mid: "#8f8a66",
  light: "#a6a07a",
};
