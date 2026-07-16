# Terrain Floor Repaint — Handoff

Written 2026-07-10 by the session that shipped the door/wall UI (Slices 1–3 +
door SFX). You are giving the Map Studio's **wood floor** and **stone floor** the
same procedural, hand-drawn treatment the natural terrain already has (grass /
dirt / path), and adding a few **variants** of each, in `D:\HeroByte` (branch
`dev`, Windows/PowerShell; a Bash tool is also available). This handoff was
assembled from a verified recon — files read in full: `terrainPalette.ts`,
`proceduralTerrain.ts`, `proceduralTerrainSurface.ts`, `starterTiles.ts` — plus a
live preview screenshot of the mismatch. The `file:line` index in §4 is checked
for those files; ranges marked **VERIFY** were not read and are your first recon.

> **Read §1 and §2 before you plan.** The root cause is architectural (two render
> systems) and there is one hard guardrail (a hash-locked frozen golden). Getting
> both right first saves you a wasted pass.

---

## 0. Bootstrap — do in this order, then STOP exploring

1. **`docs/planning/renderer-endgame-playbook.md` §0 IN FULL.** This is a renderer
   change, so that doc's METHOD is fully in scope and binding: the slice loop
   (§0.2), the verbatim verify ritual (§0.3), the review policy (§0.4), the hard
   invariants/traps (§0.5 — esp. **export byte-parity / frozen tests**, the
   **350-LOC cap**, the **stale shared-dist trap**, **units**), conventions/commit
   trailers (§0.6), failure modes F1–F12 (§0.7), and the §0.8 context index for
   the wider renderer.
2. **This file** — the reframe (§1), the design + tension (§2), the slice plan
   (§3), the verified index (§4), review policy (§5), gotchas (§6), kickoff (§7).
3. `git log --oneline -6`; confirm the door/wall work landed (`fcefe612` door SFX,
   `7b6ae2ca`/`e475a9be` Slice 3, `226ded12`/`d596f4c5` Slice 2, `96557d42` Slice
   1). The tree is clean except known bystanders (`.agents/AGENTS.md`, `.gitignore`,
   untracked `assets/images/*`, `apps/server/herobyte-assets/`, `temp/`, etc.) —
   never stage those.
4. Do NOT re-recon the whole render tree. §4 is the map. Read the listed ranges,
   then stop searching.

---

## 1. THE REFRAME — the root cause (read first)

HeroByte has **two terrain-rendering systems**, and the floors are on the old one:

- **Grass / dirt / path = the NEW procedural system.** They are listed in
  `features/render/terrainPalette.ts` (`VILLAGE_TERRAIN`), which drives a
  world-coherent **noise field** (organic bumpy edges, priority blending) plus a
  **hand-drawn interior-detail pass** (blades, pebbles). That is why they read as
  cohesive and hand-made.
- **Wood floor / stone floor = the OLD render.** They are **NOT in the palette**,
  so the procedural surface skips them and they fall through to the flat/atlas
  core render (`drawTerrain`). Up close they read as a different, older,
  more-repetitive art era sitting next to the new terrain. **That is the mismatch
  the owner is complaining about.**

**Owner-decided direction (2026-07-10, both confirmed):**
- **Approach = PROCEDURAL REPAINT** (move floors onto the procedural system to
  match) — NOT a recolor of the old tiles.
- **Variants = 3 of each.** Wood: **Oak**, **Walnut**, **weathered Grey plank**.
  Stone: **Flagstone**, **Cobblestone**, **Sandstone**. (Keep the existing
  `terrain:wood-floor` as Oak and `terrain:stone-floor` as Flagstone — see §6 —
  and add two new variants of each.)

**What is ACTUALLY missing (the feature):**
1. Floors aren't in the procedural palette → they don't bake procedurally.
2. Floors are **architectural** — they need **crisp straight edges**, unlike the
   organic bumpy field. The field applies noise displacement to *every* family;
   floors need near-zero displacement (§2).
3. Floors need their **own interior-detail painters** — plank grain (wood),
   flagstone/cracks (stone) — to match the hand-drawn quality. The existing
   painters do blades/pebbles only.
4. No variant assets exist yet (only one wood + one stone floor).

---

## 2. The design + the deep tension (procedural repaint ↔ crisp floors ↔ frozen SVG)

**Tension 1 — organic field vs. crisp floors.** A family becomes procedural simply
by being in the palette, but the field (`proceduralTerrain.ts`) displaces *every*
family's boundary by a **global** amplitude (`AMP = 0.9`), giving organic bumpy
edges. That is correct for grass↔dirt↔path but **wrong for a floor**, whose edge
should be straight. So the field needs a **per-family edge amplitude** (floors ≈
0 = crisp; natural terrain keeps the default). The single hook is `fieldOf`
(`proceduralTerrain.ts:130` — `base - 0.5 + disp(...) * prox`): scale `disp` by a
per-family factor carried on `TerrainFieldFamily`. Keep this the ONLY field-math
change (F10 — one source of truth: `createTerrainField`).

**Tension 2 — the frozen SVG golden (STOP-SHIP guardrail).**
`apps/client/src/features/map-studio/__tests__/terrainRenderParity.frozen.test.ts`
is **hash-locked** (`scripts/check-frozen-tests.mjs` fails `pnpm lint` if it is
edited) and it **pins the portable-SVG export of painted `terrain:stone-floor`**
(lines ~34–44). Your repaint MUST stay **canvas-only**:
- The portable SVG export (`renderMapDocumentSvg` → `renderTerrain` →
  `buildTerrainRenderLayers`) renders terrain as **flat fill + boundary**, and it
  must stay byte-identical. Grass is already procedural on the canvas but flat in
  the SVG — floors follow the same split.
- Therefore: **do NOT change the existing floors' `fill`/`stroke`/`accent` in
  `starterTiles.ts`, and do NOT touch `buildTerrainRenderLayers`/`renderTerrain`.**
  The procedural look lives only in the canvas bake (studio underlay + published
  raster). Run `pnpm lint` (frozen gate) and read the diff to confirm.

**Tension 3 — double-draw.** When the procedural bake runs, **field families are
excluded from the core `drawTerrain`** (see the R4b raster tests, e.g.
`exportMapDocument.test.ts` around the "field families are excluded from the core"
assertions). Adding floors to the palette should make that exclusion apply to them
automatically — **VERIFY there is no double-draw** (a flat/atlas floor under the
procedural one) on both surfaces.

**How the fix reaches each surface:** the studio editor bakes the field live
(`MapStudioCanvasUnderlay`); **Publish bakes the whole map to a raster PNG**
(`rasterizeMapDocument` → `paintRasterUnderlay`, which composites
`bakeProceduralTerrain`) and the live table renders that PNG (the Slice-4
image-map supersedes live-terrain streaming). So floors reach the table **via the
published raster** — to see table changes you must **re-Publish**. The portable
JSON/SVG download stays flat (frozen).

---

## 3. The slice plan (one slice per session, RED-first, playbook §0.2)

Order matters: establish the render path first, then the art, then the data.

### Slice 1 — Procedural render path + crisp floor edges — DONE ✅
Shipped on `dev` (self-review + focused byte-parity check; browser-verified in the
Studio: stone + wood floors bake as crisp-edged procedural regions inside an
organic grass field, then Publish blits them to the table raster). **Actual shape:**
- `proceduralTerrain.ts`: `TerrainFieldFamily.edgeAmp?` (+ internal `FieldFamily`);
  `createTerrainField` defaults `edgeAmp ?? 1`; `fieldOf` scales the boundary bump
  by `* f.edgeAmp`. Default (undefined ⇒ 1) reproduces grass/dirt/path byte-for-byte.
- `terrainPalette.ts`: `TerrainFamilyPalette.edgeAmp?`; `terrain:stone-floor`
  (base `#4d5361`, priority 4) and `terrain:wood-floor` (base `#725236`, priority 5)
  added to `VILLAGE_TERRAIN`, both `edgeAmp: 0` (crisp) + a first-cut `keyCluster`
  speckle (`STONE_FLOOR_DETAIL` / `WOOD_FLOOR_DETAIL` — Slice 2 replaces with
  dedicated plank/flagstone painters). Base colours match the frozen starterTiles
  fills so the field bake and the flat fallback agree.
- `proceduralTerrainSurface.ts`: `buildProceduralFieldConfig` threads
  `edgeAmp: fam.edgeAmp`; stale header comment updated (only water is non-field now).
- **No double-draw**: adding floors to the palette auto-flips them from the flat
  core to the field bake in BOTH surfaces (the `coreLayers` filter is
  `!VILLAGE_TERRAIN[assetId]`). New export test pins it; frozen SVG golden stays
  byte-identical (`starterTiles` fills + `buildTerrainRenderLayers`/`renderTerrain`
  untouched). RED-first tests: crisp-edge amplitude (proceduralTerrain.test),
  floors-are-crisp-field-families (proceduralTerrainSurface.test), double-draw guard
  (exportMapDocument.test). Three surface fixtures + one workspace fixture that used
  a floor as a non-field stand-in were swapped to `terrain:water` (still non-field),
  preserving intent.

Original brief (historical):
Make the **two existing** floors (`terrain:wood-floor`, `terrain:stone-floor`)
render procedurally with crisp edges:
- `terrainPalette.ts`: add both to `VILLAGE_TERRAIN` with `base`/`rim` (tuned to
  the mood; keep them distinct from grass/dirt/path priority ordering — decide
  where floors sit vs. natural terrain, likely **above** so they don't get a
  natural family's rim bumped over them) and a **crisp** edge factor.
- `proceduralTerrain.ts`: add the optional per-family edge amplitude and apply it
  in `fieldOf`. Default (undefined) must reproduce today's grass/dirt/path bytes.
- Give floors a **first-cut** interior detail so they bake as something (e.g. a
  temporary `keyCluster` recolor) — real painters land in Slice 2.
- **RED-first:** extend `proceduralTerrain.test.ts` to pin that a crisp family
  gets ~no boundary displacement while a default family still does; add a
  surface/bake test that floors now bake (were skipped before). **Confirm the
  frozen golden is byte-identical** and there is **no double-draw**.
- Verify on the preview (open the Studio with painted floors; §6 for how).

### Slice 2 — Floor detail painters (the art) — DONE ✅
Shipped on `dev` (`d279176d`, with Slice 3). **Actual shape:** painters live in a
NEW `terrainFloorDetail.ts` (the 350-LOC cap ruled out growing `terrainDetail.ts`);
routing is a new `floor?: FloorDetail` field on `TerrainFamilyPalette`
(`{ kind: "plank" | "flagstone", palette, scale? }`) checked FIRST in
`paintFamilyDetail`. Pure fillRect art by contract (the clip ctx forwards nothing
else) — pinned, along with cross-cell seam continuity, determinism, bounds, and
palette-only colours, in `terrainFloorDetail.test.ts`.

Original brief (historical):
- `terrainDetail.ts`: add `paintPlankDetail` (long straight grain lines + knots,
  warm/cool per variant) and `paintFlagstoneDetail` (irregular slab seams +
  crack/moss speckle), mirroring the existing painter signature. Route them from
  `proceduralTerrainSurface.ts` `paintFamilyDetail` (currently keyCluster →
  `paintKeyClusterDetail`, else `paintTerrainDetail`).
- Tune plank direction / seam density / colors **on the preview** — this is the
  subjective core; expect iteration.
- Watch the **350-LOC cap** on `terrainDetail.ts`; split by responsibility if it
  approaches (precedent: `gridRenderCore` out of `tileRenderCore`).

### Slice 3 — Variants (data) — DONE ✅
Shipped on `dev` (`d279176d`, with Slice 2). Cobblestone = the flagstone painter at
`scale: 0.5`; the four variants are pure data (`floorVariants.test.ts` pins the
contract). **Plan correction:** "they auto-appear as terrain brush swatches" was
written before S13 deleted the Map Studio scene — the live map-edit palette is a
hardcoded `MapEditFloorFamily` union (mapEditTypes/mapEditFamilies/MapEditToolbar),
so new floors must be wired there explicitly. All six floors browser-verified from
a second client (full server round trip).

Original brief (historical):
- `starterTiles.ts`: add `terrain:wood-walnut`, `terrain:wood-grey`,
  `terrain:stone-cobble`, `terrain:stone-sandstone` (new asset entries; they
  auto-appear as terrain brush swatches). Rename the existing two to their variant
  names (Oak / Flagstone) but **keep their assetIds and fills unchanged**.
- `terrainPalette.ts`: palette entries for the 4 new families (base/rim/detail
  params + crisp edge).
- **RED-first:** a small test that each new assetId resolves and is a field
  family; verify the palette count and that the Shelf lists them.

If a slice ends and context is long, stop and commit what is green — do not start
the next slice in the same session (playbook §0.1).

---

## 4. Verified `file:line` context index

Read the ranges; don't re-search. **Bold = load-bearing.** Line numbers verified
2026-07-10 for the four files read in full; **VERIFY** = read it yourself first.

### The procedural terrain system — `apps/client/src/features/render`
- **`terrainPalette.ts` (62 LOC, read whole):** `VILLAGE_TERRAIN` `:57-61`
  (grass `:58`, dirt `:59` + `DIRT_DETAIL`, path `:60` + `PATH_DETAIL`);
  `TerrainFamilyPalette` `:44-49` (`base`,`rim`,`priority`,`keyCluster?`);
  `KeyClusterPalette` `:13-20`; `DIRT_DETAIL` `:23`, `PATH_DETAIL` `:31`. **This is
  where floor families are added (palette-as-data; mood-swappable).**
- **`proceduralTerrain.ts` (194 LOC, read whole):** `TerrainFieldFamily` `:23-31`
  (**add an optional edge-amplitude field here**); `AMP = 0.9` `:65`; `TERRAIN_RIM
  = 0.16` `:63`; `createTerrainField` `:88`; `disp` `:110-112`; **`fieldOf`
  `:130-134` — the single crisp-edge hook** (`disp(...) * prox`); `colorAt` `:135`;
  `sampleField` `:158`; `renderTerrainField` `:171`.
- **`proceduralTerrainSurface.ts` (298 LOC, read whole):**
  `buildProceduralFieldConfig` `:72` (**families are taken from the palette
  `:83-86` — floors auto-join once listed**); **`paintFamilyDetail` `:168` — route
  new floor painters here** (keyCluster → `paintKeyClusterDetail`, else
  `paintTerrainDetail`); `paintProceduralDetail` `:216`; `makeClipCtx` `:120`;
  `bakeProceduralTerrain` `:261`; `MAX_BAKE_DIM/PIXELS` `:251-252`. The header
  comment `:8-12` ("stone/wood floors NOT baked here") goes **stale — update it**.
- `terrainDetail.ts` (**VERIFY, read whole**): `paintTerrainDetail`,
  `paintKeyClusterDetail` — the painter signature to mirror for
  `paintPlankDetail` / `paintFlagstoneDetail`. It consumes `KeyClusterPalette`.
- `valueNoise.ts` (**VERIFY**): `valueNoise`, `smoothstep` — the noise primitives
  the detail painters and field share.

### Terrain assets + geometry — `apps/client/src/features/map-studio`
- **`starterTiles.ts` (199 LOC, read whole):** `MapStudioTileAsset` `:7-25`
  (`fill`,`stroke`,`accent`,`animFills?`); `MAP_STUDIO_TILE_ASSETS` `:27`;
  **`terrain:stone-floor` `:29-38`** and **`terrain:wood-floor` `:40-49`
  (KEEP these fills unchanged — frozen)**; `terrain:water` `:51-62` (animFills
  example, if a floor ever animates); grass/dirt/path `:66-98`; `getMapStudioTileAsset`
  `:146`; `terrainStyleForFrame` `:179`. **Add the 4 variant assets here.**
- `terrainRender.ts` (~100 LOC, **VERIFY, read whole**): `buildStructuredTerrainLayers`
  (single source of terrain cell/edge geometry — the bake consumes it) and
  `buildTerrainRenderLayers` (**byte-parity SVG adapter — do NOT change floor
  output; frozen**).
- `exportMapDocument.ts` (~345 LOC; see playbook §0.8 anchors): `renderTerrain`
  `:67` (**flat SVG path — frozen**); `rasterizeMapDocument` `:167` (`composite =
  terrainLayers.length > 0`; `paintRasterUnderlay` blits the procedural bake `:199`).
- `rasterUnderlay.ts` (**VERIFY, read whole; small**): `paintRasterUnderlay` —
  composites `bakeProceduralTerrain` into the export raster.
- `components/MapStudioCanvasUnderlay.tsx` (~200 LOC, **VERIFY** — playbook calls
  it the reference canvas surface): bakes + blits the procedural field live in the
  editor. How the studio SEES your change.

### Frozen + tests
- **`map-studio/__tests__/terrainRenderParity.frozen.test.ts` — HASH-LOCKED.**
  Paints `terrain:stone-floor` (`:34-36`, `:44`). **NEVER edit.** If it goes red,
  the bug is in your code / you changed the SVG path — fix the code.
- `render/__tests__/proceduralTerrain.test.ts`: `FAMILIES` `:15-18` (the
  field-family test list — extend for crisp-edge + floor).
- `render/__tests__/` — grep for the `terrainDetail` test to mirror for the new
  painters (recording-context canvas tests; see playbook §0.6).
- `map-studio/__tests__/exportMapDocument.test.ts` — the **R4b raster-composite**
  block (`describe("Map Studio raster composite (R4b)")`, ~`:557+`): asserts the
  bake blits and **field families are excluded from the flat core** (grep
  `#386820`, `"field families are excluded"`). Extend so floors ride the field,
  not a flat fill — this is your **double-draw** guard.
- `map-studio/__tests__/MapStudioCanvasUnderlay.test.tsx` — the live editor bake.

### Recon to VERIFY first (the double-draw integration point)
- How floors render **today**: grep `drawTerrain` in `render/tileRenderCore.ts`
  and how the underlay/export decide flat-vs-atlas-vs-field per family. Find the
  filter that **excludes palette (field) families from the core `drawTerrain`** —
  adding floors to the palette must flip them from "core-drawn" to "field-baked"
  with no overlap. If recon shows floors do NOT auto-exclude, STOP and re-plan
  (that filter, not the palette, is then the real hook).

---

## 5. Review policy

Per playbook §0.4 this is **client rendering, additive → a careful self-review of
`git diff`, NOT the adversarial Workflow.** BUT the frozen-golden / export
byte-parity surface is **compatibility-critical**, so do a **focused self-review
of exactly that surface** every slice: re-read the diff for any change to
`starterTiles` fills, `buildTerrainRenderLayers`, `renderTerrain`, or the frozen
test; confirm `pnpm lint` (frozen gate) is green and the portable SVG is
byte-identical; confirm the raster composite still blits once (no double-draw).
There is **no required Workflow** here — do not manufacture one, but do not skip
the byte-parity self-check either.

---

## 6. Gotchas the recon surfaced

- **Frozen SVG golden is hash-locked** and pins painted `terrain:stone-floor`
  (§2). Keep the repaint canvas-only; keep existing floor `fill`/`stroke`
  unchanged; never edit the frozen test. This is the #1 way to break the build.
- **Floors must be crisp, not organic.** Adding to the palette alone gives them
  bumpy field edges. Add per-family edge amplitude (§2) or they'll look wrong.
- **Default field output must not drift.** The per-family amplitude MUST default
  to today's behaviour so grass/dirt/path stay byte-identical (there are pinned
  bake tests + the frozen golden).
- **Double-draw.** Confirm floors are excluded from the flat/atlas core once they
  are field families (§2 / §4 recon).
- **To SEE it:** the live **table renders the published raster** (Slice-4
  image-map), so re-**Publish** to see floor changes at the table. The **Studio**
  editor re-bakes live — paint floors there and the underlay updates. App is DM-
  only and renders a mobile layout below ~1280px (no DM MENU button) — use a
  window ≥1280px. Dev servers: client 5174 / server 8787 (`pnpm dev`).
- **350-LOC cap** (`pnpm lint:structure:enforce`, separate from lint). `terrainDetail.ts`
  is the file most likely to approach it — split by responsibility, never bump the
  baseline.
- **No new deps.** `pnpm add/install` is banned (store trap, playbook §0.5). The
  painters are pure canvas math — no libraries needed.
- **Bake cap / perf.** `bakeProceduralTerrain` skips past `MAX_BAKE_DIM`/`PIXELS`
  and falls back to the core render; keep floor detail cheap per pixel (it runs in
  the same heavy bake).
- **Priority ordering.** Decide where floors sit in the field priority vs.
  grass(3)/dirt(2)/path(1). Floors are usually placed as their own region, so a
  high priority (drawn over natural terrain, crisp edge) reads best — but verify a
  floor-next-to-grass boundary on the preview.
- **Variants keep existing ids.** `terrain:wood-floor` → Oak, `terrain:stone-floor`
  → Flagstone (same ids/fills, frozen-safe); add the other four as new ids.

---

## 7. Kickoff — the prompt for the executor session

> You are giving HeroByte's Map Studio floors a **procedural repaint** so wood &
> stone floor match the grass/dirt/path terrain, plus **3 variants of each**, in
> `D:\HeroByte` (branch `dev`). Read `docs/planning/renderer-endgame-playbook.md`
> §0 IN FULL (its METHOD binds — slice loop, verify ritual, invariants, failure
> modes), then `docs/planning/terrain-floor-repaint-handoff.md` IN FULL —
> especially §1 (the reframe: floors are on the OLD render, not in the procedural
> palette) and §2 (the deep tension: floors need CRISP edges via a per-family
> amplitude, and the **hash-locked frozen SVG golden** pins painted
> `terrain:stone-floor`, so the repaint stays canvas-only and the existing floor
> fills stay unchanged). Then execute **Slice 1 only** from §3 (procedural render
> path + crisp floor edges), RED-first, using the §4 context index instead of
> searching — and FIRST do the §4 "VERIFY" recon (how floors render today + the
> field-exclusion filter) since Slice 1's design assumes floors auto-exclude from
> the flat core once they join the palette; if that assumption fails, STOP and
> re-plan. Binding rules: one slice this session; RED-first tests; explicit
> staging only (never `git add -A`); never `pnpm add/install`; keep files <350
> LOC; the frozen SVG goldens stay byte-identical and there is no terrain
> double-draw. Review is a careful self-review with a FOCUSED byte-parity check of
> the export/frozen surface (§5) — not the adversarial Workflow. Verify Slice 1 on
> the preview (open the Studio with painted floors; re-Publish to see the table).
> Slices 2 (detail painters) and 3 (variants) are their own sessions; the art in
> Slice 2 is subjective — tune it on-screen with the owner.
