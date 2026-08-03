// ============================================================================
// ASSET REFERENCE SCAN
// ============================================================================
// Which uploaded assets does a room's state actually reference? Uploads appear
// in exactly two shapes — `upload:<sha256>` asset ids inside map documents and
// `/assets/<sha256>` URLs everywhere else — so a regex over the SERIALIZED
// state finds every reference wherever it lives (tokens, portraits, props,
// scene-graph mirrors, terrain palettes), including fields added later. The
// client's session exporter uses the same pattern for the same reason
// (sessionAssets.ts): enumerating fields is a whitelist that rots.

const ASSET_REF = /(?:upload:|\/assets\/)([a-f0-9]{64})/g;

/** Every asset hash mentioned anywhere in the given serialized blobs. */
export function collectAssetHashes(...serialized: string[]): Set<string> {
  const hashes = new Set<string>();
  for (const blob of serialized) {
    for (const match of blob.matchAll(ASSET_REF)) {
      hashes.add(match[1]!);
    }
  }
  return hashes;
}
