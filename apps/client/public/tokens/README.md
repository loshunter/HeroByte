# HeroByte token pack (Pixel15, pack 1.0.0)

244 tokens — 184 monsters and 60 civilians across 34
families — as transparent PNGs in three tiers: the 1254 × 1254 master (drawn on the map), a
336 × 336 medium (the portrait) and an 84 × 84 thumbnail (the picker; one pixel per pixel-15 cell).
Every file is byte-identical to the community pack's `Pixel15/` output (manifest of 2026-09-15)
and sits at the pack's own path, so `/tokens/<path>` here is `Pixel15/<path>` there.

Generated: do not edit these files by hand. `node scripts/import-token-library.mjs` copies the
pack from `temp/Library` and regenerates the catalog the DM menu's Library reads
(`apps/client/src/features/dm/token-library/tokenCatalog.generated.ts`).

## Provenance

Generator: OpenAI ChatGPT image generation.
233 approved originals generated with the built-in image tool; 11 user-provided ChatGPT goblin references retained.
Pixel finish: Pixel Size 15: calibrated goblinClub preset, brightness 0, contrast 0, saturation 0; existing goblin exports retained byte-for-byte.
Derivatives: Fixed nearest-neighbour center sampling from each 1254px master to an 84px logical grid, then exact fourfold pixel repetition to 336px. Canvas origin and padding are preserved.
Art direction, prompts and the pixel pass by OpenAI Codex (September 2026). The pack's own manifest
carries every source hash and prompt path.

## Licence

Not yet published (the pack says `pending-owner-decision`). The owner intends to
release the images under an open licence as a standalone community pack; until that lands they are
part of this repository under its root LICENSE.
