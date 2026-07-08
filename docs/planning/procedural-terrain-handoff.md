# Procedural Terrain — Handoff (dirt/path/grass transitions)

Written 2026-07-07 by the session that shipped Slices 1 + 2a. You are continuing
a multi-session effort to rebuild HeroByte terrain rendering as a **procedural,
bumpy grass↔dirt↔path** system (Slynyrd "Top Down Tiles" pg-49/50). This doc is
your map. Read it after the playbook §0; then STOP exploring and execute.

Repo `D:\HeroByte`, branch `dev`, Windows/PowerShell (a Bash tool is also
available — each takes its own syntax). Owner: loshunter.

---

## 0. BOOTSTRAP — do in this order, then STOP exploring

1. **`docs/planning/renderer-endgame-playbook.md` §0 IN FULL** — this is "Fable
   5's" authoritative method and it is BINDING: the slice loop (§0.2), the
   verbatim verify ritual (§0.3), the ADVERSARIAL REVIEW workflow (§0.4), hard
   invariants/traps (§0.5), conventions (§0.6), failure modes F1–F12 (§0.7), and
   the **context index §0.8 (file→line map — use it instead of grepping)**. Do
   not re-plan around it.
2. **This file** (the plan + the delta context index for THIS work).
3. Project memory `dirt-path-transitions-direction` (auto-loaded via MEMORY.md) —
   the one-paragraph why. It OVERRIDES the playbook's old baked-atlas plan for
   dirt/path.
4. **`temp/_dirt_path_proto/README.md`** + `transition_v2_proto.mjs` — the
   VALIDATED algorithm and the visual target. The `.png`s next to it are the
   owner-approved look. Treat `transition_v2_proto.mjs` as the spec: the app
   renderer must reproduce it. (`temp/` is the owner's scratch — NEVER stage it.)
5. `git log --oneline -6`; confirm `200871d4` (Slice 2b) and `e1691696` (Slice 3) are on `dev`.

Do NOT read the whole render tree. Everything you need is indexed in §3 below and
in playbook §0.8.

---

## 1. The direction (owner-confirmed — don't re-litigate)

- **Procedural + bumpy, not baked tiles.** The boundary between two families is a
  world-coherent noise-displaced FIELD → organically bumpy edges that never
  repeat. This SUPERSEDES the shipped grass blob47 atlas (`a79a84e7`).
- **Bake at PUBLISH → image map.** The heavy per-pixel render runs once (at the
  editor's publish step); the result flows to the table as a first-class IMAGE
  MAP with the same scale/move/grid-match/lock controls imported images already
  have. That's both the performance answer and a workflow unification. (Slice 4.)
- **Palette = data, user-editable.** Per-family base/rim/detail grouped into
  "moods" (village=warm default, cave=cool-grey, fantasy=purple). A re-skin is a
  data swap. Future: in-app colour editor. (Slice 5.)
- **Bumpy everywhere**, including grass-meets-empty (kills the old inner-corner
  notch the owner circled).
- **SVG export stays flat-colour / byte-parity** (frozen goldens). All procedural
  work is CANVAS-only.

---

## 2. What's DONE — the API surface you can build on (don't re-read these files)

Slices 1 + 2a were INERT. **Slice 2b (`200871d4`) now WIRES them into the Map
Studio editor underlay** — the procedural field is live and owner-approved (see
§4). Entry stays **69.17 KB** (the field rides the already-lazy Map Studio chunk).
`proceduralTerrainSurface.ts` (the S2b orchestrator, below) is what S3/S4 reuse.

**Slice 1 `3171e106`** — dirt/path interior detail:
- `features/render/terrainPalette.ts`
  - `interface KeyClusterPalette { crev; dark; mid; light }` (hex strings)
  - `DIRT_DETAIL`, `PATH_DETAIL: KeyClusterPalette` (village defaults)
  - `interface TerrainFamilyPalette { base; rim; priority; keyCluster? }`
  - `VILLAGE_TERRAIN: Record<assetId, TerrainFamilyPalette>` (grass p3 / dirt p2 /
    path p1; dirt/path carry `keyCluster`)
- `features/render/terrainDetail.ts`
  - `paintKeyClusterDetail(ctx: TileRenderContext2D, cell: TerrainCellRect,
    palette: KeyClusterPalette): void` — draws the world-space "key cluster"
    pebbles (motifs + crevice shadow + coverage patches) via `ctx.fillRect`,
    inset, deterministic on the WORLD lattice. NOT dispatched by
    `paintTerrainDetail` (still grass-only).

**Slice 2a `30a114d8`** — the field renderer + shared noise:
- `features/render/valueNoise.ts` — `hash2(x,y,seed)→[0,1]` (CAN return exactly
  1 — guard array indexing), `valueNoise(x,y,seed)`, `smoothstep(t)`. The single
  noise source (detail + field both import it).
- `features/render/proceduralTerrain.ts`
  - `interface TerrainFieldFamily { assetId; priority; base; rim }` (hex)
  - `interface TerrainFieldConfig { familyAt(cx,cy)→assetId|null; families;
    cellSize; originX; originY }`
  - `renderTerrainField(pixels: Uint8ClampedArray, width, height,
    config): void` — fills an RGBA buffer in DOC space (1 buffer px = 1 world
    px) with the base/rim/shadow field. Priority layering (grass>dirt>path),
    underfill (lower fills under higher, revealed at higher's receded edge),
    grass rim lip, cast shadow (light top-right), prox confines bumps to seams.
    Painted px → alpha 255; empty / non-listed families (water, stone) → alpha 0
    (they render on their own layers). Pure + deterministic.

Tests: `__tests__/terrainDetail.test.ts` (+key-cluster block),
`__tests__/proceduralTerrain.test.ts` (buffer-inspection: interior, empty,
no-holes/prox, determinism, palette-driven, underfilled+bumpy seam). Recording-
context helper: `__tests__/recordingContext.ts` (records `set:fillStyle`).

---

## 3. Context index — where the rest lives (verified this session; don't grep)

**The wiring targets (surfaces that call the current renderer — you swap these):**
- `features/map-studio/components/MapStudioCanvasUnderlay.tsx` (~200 LOC, READ
  WHOLE — it's the reference). Camera transform set at :98–105
  (`renderedSvgViewport` letterbox → `setTransform(scale,…,translateX,translateY)`);
  view-cull rect at :111–116; grid at :118–139; **terrain block at :142–171**
  (`drawOptions = {boundaryWidth, atlas, detail: paintTerrainDetail}` at :144;
  opaque path `drawTerrain(...)` at :146; `terrainOpacity<1` offscreen
  flatten-then-fade loop at :152–169); redraw deps array at :172–182; DPR
  re-arm at :71–77. Props: `terrainLayers: StructuredTerrainLayer[]`,
  `terrainOpacity`, `grid{size,offsetX,offsetY,visible}`, `viewBox`, `animated`.
- `features/map/components/terrainSceneFunc.ts` — table's `drawTableTerrain(...)`;
  `detail: paintTerrainDetail` at :34. (Table = Slice 4.)
- `features/map-studio/rasterUnderlay.ts` — export bake `paintRasterUnderlay(...)`;
  options at :70. (Slice 3.)

**Geometry / data sources:**
- `features/map-studio/terrainRender.ts` (~115 LOC, read whole) —
  `buildStructuredTerrainLayers(terrain, grid, occupancy): StructuredTerrainLayer[]`
  is the SINGLE source of terrain geometry (SVG byte-parity contract — DON'T
  change its `edges`/sort). Each layer = `{assetId, cells:[{x,y,size,cellX,cellY,
  neighborMask}], edges}`. **Build `familyAt(cx,cy)` for `renderTerrainField`
  from these layers** (a `Map<"cx,cy",assetId>` over every layer's cells) — no
  need for the raw TerrainMap.
- `features/map-studio/tileAutotiling.ts` — `buildTerrainOnlyOccupancy(terrain)`
  (table) and `buildTileOccupancy(document)` (editor/export, includes tile
  elements). `StructuredTerrainLayer` etc. live in
  `features/render/tileRenderCore.ts` (`drawTerrain`, `TileRenderContext2D`,
  `TerrainCellRect`, `RenderViewRect`, `TerrainDrawOptions`).
- Playbook §0.8 has the rest (shared terrain codec, server publish chain, table
  MapBoard/MapImageLayer, e2e helpers, scripts). Line numbers there were verified
  2026-07-06 — re-confirm one with a single Grep only if a read contradicts them.

**Prototype = the algorithm (port faithfully):**
- `temp/_dirt_path_proto/transition_v2_proto.mjs` — the field + pass-2 DETAIL
  clipping recipe you need for Slice 2b: draw a cell's OWN detail clipped to
  `field(fam) >= RIM`; and draw the LOWER family's detail in the exposed band
  (`field(fam) < 0 && field(lower) >= 0`) so pebbles reach the seam. Grass detail
  colours are still hardcoded in `paintGrassDetail` (palette-ize in Slice 5).

---

## 4. THE PLAN — remaining slices (one verified slice per commit)

### Slice 2b — editor underlay renders procedurally  ← DONE ✅ (`200871d4`)
**Shipped & owner-approved** (first visible slice; bumpy transitions live in the
Map Studio editor). Actual shipped shape (use these, not the sketch below):
- `features/render/proceduralTerrain.ts`: `createTerrainField(config) →
  { colorAt(wx,wy), sampleField(assetId,wx,wy) }` + `TERRAIN_RIM` + optional grid
  `offsetX/offsetY`. `renderTerrainField` now calls `colorAt` → ONE field impl (F10).
- `features/render/proceduralTerrainSurface.ts` (new, 297 LOC): `buildProceduralFieldConfig`
  (filters palette-known families, bbox +1-cell margin, familyAt), `makeClipCtx`
  (wraps a ctx so only fillRects whose CENTRE passes a predicate reach it — reuses
  the existing detail painters, no forked math), `paintProceduralDetail` (own detail
  clipped to `sampleField(fam)≥RIM`; dominant lower-neighbour's detail in the
  `sampleField(fam)<0 && sampleField(lower)≥0` band — v2 proto pass-2), and
  `bakeProceduralTerrain` (renderTerrainField → ImageData → offscreen → detail pass;
  returns `{canvas, originX, originY, width, height}`; **logged size CAP** 8192px/side
  / 32M px → returns null past it).
- `MapStudioCanvasUnderlay.tsx`: a `fieldBakeRef` cache keyed on (terrainLayers
  identity, gridSig) blits the baked canvas `imageSmoothingEnabled=false` under the
  camera transform; `coreLayers` = non-field families still via `drawTerrain` (field
  UNDER, unchanged z-order); when the bake is null (no field families OR over the cap)
  the core renders ALL layers (flat fallback — terrain never vanishes); opacity<1 is a
  single group flatten-then-fade.
- Focused adversarial review: 1 confirmed (unbounded bake alloc → the cap) fixed;
  1 contested (underfill tie-break → `>=` last-wins to match the proto) fixed; 2
  refuted (re-bake-per-edit = accepted v1; paletteId-in-cache-key = S5, comment left).
- Known v1 limit: re-bakes the whole bbox on any `activeDocument` edit (S4's
  at-publish bake is the real perf answer). SVG export untouched (byte-parity holds).

The design sketch below is the historical record; the shipped shape above wins.

**Design:**
1. New module `features/render/proceduralTerrainSurface.ts` (keep <350 LOC; split
   if needed): a pure orchestrator
   `renderProceduralTerrain(ctx, {terrainLayers, grid, palette, view?})` that:
   - builds `familyAt` + the `TerrainFieldFamily[]` from `terrainLayers` ×
     `palette` (VILLAGE_TERRAIN for now);
   - computes the terrain cell bounding box (+1 cell margin for bump bleed) →
     doc-space buffer `originX/Y`, `width/height`;
   - `renderTerrainField` into an `ImageData`, `putImageData` onto an OFFSCREEN
     canvas at the bbox origin;
   - **detail pass on the offscreen** (world coords): for each cell draw its
     family detail clipped to the field (grass → `paintGrassDetail` via the
     existing `paintTerrainDetail`; dirt/path → `paintKeyClusterDetail` with
     `palette[id].keyCluster`), PLUS lower-family detail in the exposed band —
     follow the v2 proto pass-2. Expose a small field-sampler from
     `proceduralTerrain` (e.g. `createTerrainField(config) → { sampleField(fam,
     wx,wy), colorAt(...) }`) so the orchestrator can clip without re-deriving
     the math. (Refactor `renderTerrainField` to use that sampler internally so
     there's ONE field implementation — F10.)
2. **Cache** the offscreen keyed on terrain content (e.g.
   `JSON.stringify(terrainLayers)` + grid + palette id). Re-bake only on change;
   `MapStudioCanvasUnderlay` then just `drawImage`s the cache with the camera
   transform each frame (`imageSmoothingEnabled=false` for crisp pixels).
   `terrainOpacity<1` → a single `globalAlpha` on that blit (simpler than the
   current per-family flatten loop).
3. **Wire `MapStudioCanvasUnderlay`** (:142–171): replace the grass/dirt/path
   `drawTerrain` path with the cached-blit. Families the field DOESN'T handle
   (water animated, stone/wood floors) must still render — keep `drawTerrain`
   for them (they were flat/atlas) and get the z-order right (terrain field
   under; water/its layers as before). Water animation stays live (separate),
   terrain field is static per edit. Reduced-motion is automatically satisfied
   (field is frame-independent).
4. Perf: v1 may re-bake the whole terrain bbox on each change; if drag-paint
   hitches, debounce or dirty-region later — `log`/note any cap, don't hide it.

**Steps (playbook §0.2):** recon only §3 files → RED-first tests → implement →
targeted tests → full §0.3 ritual → **focused adversarial review** (§0.4; lenses
below) → **STOP, show the owner in-app, get "commit to dev"** → commit.

**Tests:** the orchestrator's canvas work is testable with `recordingContext`
(assert putImageData/detail/blit order) and with a real jsdom canvas for the
buffer. Reuse `renderTerrainField`'s buffer tests as the field's proof. Add a
`MapStudioCanvasUnderlay` render test in its existing pattern.

**Manual smoke (REQUIRED — pixels matter):** `.claude/launch.json` has client
5174 / server 8787 (server needs 8787, `autoPort:false`). Paint grass + dirt +
path in the studio; confirm bumpy organic seams, grass lip, cast shadow, pebbles
to the seam, and bumpy grass-vs-empty edges. Owner drives the final look call.

### Slice 3 — raster export bakes procedurally  ← DONE ✅ (`e1691696`)
**Shipped.** `paintRasterUnderlay` (rasterUnderlay.ts) composites grass/dirt/path
via `bakeProceduralTerrain` (the S2b module, reused — not forked); water/stone/wood
keep the core `drawTerrain` path; group flatten-then-fade opacity; flat-core
fallback for ALL layers when the bake declines. Blits the baked canvas at its
world origin under the export's identity transform (whole doc 1:1, no camera,
one-shot — no cache). SVG export path UNTOUCHED → byte-parity holds. The 3
superseded R4b raster tests in `exportMapDocument.test.ts` were rewritten with
the owner's OK (that file is add-only). Focused review: 0 confirmed findings. Downloads get the look; this is ALSO the
publish-bake foundation. Focused export-surface review. Frozen SVG goldens stay
untouched (SVG download remains flat by design).

### Slice 4 — publish → first-class image map  ← NEXT  [protocol; REQUIRED full review]
The workflow unification the owner wants. Publish rasterizes the map to a bitmap
that flows to the table as an image map (scale/move/grid-match/lock/relock —
today those exist only for imported images). Touches `packages/shared` publish
types (rebuild shared!), server publish handler, table `MapBoard`/`MapImageLayer`,
and the DM controls. Supersedes R5a/R5b's live-terrain-on-the-wire for tile maps.
Protocol/security → the §0.4 adversarial review is REQUIRED; leave uncommitted
for the owner if a lesser model executes it.

### Slice 5 — palette moods + user-editable colours
Expose cave/fantasy moods and (later) an in-app colour editor. Palette-ize
`paintGrassDetail` (currently hardcoded) here. `VILLAGE_TERRAIN` is the template;
cave/fantasy values are in `temp/_dirt_path_proto/transition_moods_proto.mjs`.

---

## 5. Fable 5's method — the binding rules (from playbook §0; summarized)

- **Slice loop (§0.2):** recon named files only → PIN current behavior if
  refactoring a contract → RED-first tests (write, watch fail, then implement the
  smallest change) → targeted tests → full ritual → review → commit. One slice
  per session; don't start a second if context is long (F7).
- **Verify ritual (§0.3), CLIENT-ONLY (you don't touch packages/shared until
  Slice 4, so skip the shared rebuild), verbatim in order:**
  ```powershell
  pnpm --filter herobyte-client exec vitest run <paths>          # targeted
  pnpm --filter herobyte-client typecheck
  pnpm --filter herobyte-client exec eslint --fix <changed files>
  pnpm lint                     # root: server+client+shared prettier + FROZEN gate
  pnpm lint:structure:enforce   # separate 350-LOC guard
  pnpm test                     # full unit (30 batches, ~1–4 min)
  pnpm test:e2e                 # 56 tests (~2–3 min)
  pnpm --filter herobyte-client build
  node apps/client/scripts/check-bundle-size.mjs   # entry stays lazy-clean
  ```
  Every gate green THIS session before commit. (When you WIRE the renderer the
  entry bundle will grow a little — that's fine, it's well under the 175 KB cap;
  only render code tree-shaking into lazy chunks kept it at 69.17 KB while inert.)
- **Pre-commit checklist:** `git branch --show-current`→`dev`; `git status
  --short` shows ONLY your files; read `git diff --cached` line by line (watch
  for auto-populated snapshots / debug leftovers). **Stage an explicit file list —
  NEVER `git add -A`/`.`.** Bystanders that must NEVER be staged:
  `.agents/AGENTS.md`, `.gitignore`, `assets/images/Inspiration/`,
  `assets/images/logo/*.png`, `temp/`.
- **Adversarial review (§0.4):** protocol/security → REQUIRED full; rendering with
  visible failure modes → focused; pure-additive well-tested → self-review is OK
  (that's why S1/S2a skipped the workflow). **Slice 2b and 3 warrant a focused
  review; Slice 4 REQUIRES a full one.** Run it AFTER the suites pass; NEVER run
  `pnpm test` while a Workflow is live (F6 contention). The template + refute-by-
  default skeptic is in §0.4 — the adapted schema is in §6 below.
- **Invariants/traps (§0.5):** SVG export byte-parity (frozen goldens hash-locked
  in `__tests__/terrainRenderParity.frozen.test.ts` — your canvas work doesn't
  touch the SVG path, keep it that way); <350 LOC/file; **NEVER `pnpm
  add/install/update`** (store trap — everything is procedural, zero deps); rebuild
  `@herobyte/shared` after ANY shared edit (Slice 4 only). Reduced motion: terrain
  is static — fine.
- **Conventions (§0.6):** commit `feat|fix: <thing> — <one-line flavor>` + body +
  trailers `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` and your own
  model. Multi-line commit in PowerShell: `git commit -m @'…'@` (closing `'@` at
  column 0) — or from Bash use a `git commit -F - <<'EOF'` heredoc.
- **Failure modes (§0.7):** F1 never edit tests to force green / never `vitest -u`;
  F4 explicit staging; F6 no suites during a Workflow; F7 one slice/session; F10
  one source of truth (don't fork the field math — the sampler is shared);
  F12 kill dev servers (`pnpm dev:free`) before e2e and at session end.

### Owner preferences (steer to these)
- Wants to SEE prototypes/offline renders BEFORE wiring, and to eyeball VISIBLE
  changes in-app before they land ("commit to dev" is the go). INERT, fully-
  verified slices were committed this session without a look — that's fine; the
  VISIBLE ones (2b onward) pause for approval.
- Prefers being asked in PROSE; has dismissed structured multiple-choice.
- Steers with reference images; is design-driven and moving fast — keep momentum,
  show renders, don't over-consult.

---

## 6. Adversarial review workflow (paste-ready, from §0.4)

Run for Slice 2b/3 (focused) and Slice 4 (full). Adapt CONTEXT + LENSES; keep the
schemas and the refute-by-default skeptic. Ultracode note: if ultracode is on,
author a Workflow per substantive task by default; only findings upheld 2/2 get
fixed; verify each scenario against the code yourself before fixing.

```js
export const meta = { name: '<slice>-review', description: '<one line>',
  phases: [{ title: 'Find' }, { title: 'Verify' }] }
const FINDINGS_SCHEMA = { type:'object', required:['findings'], properties:{ findings:{ type:'array',
  items:{ type:'object', required:['title','file','description','failureScenario','severity'],
    properties:{ title:{type:'string'}, file:{type:'string'}, line:{type:'number'},
      description:{type:'string'}, failureScenario:{type:'string'},
      severity:{type:'string', enum:['critical','major','minor']} } } } } }
const VERDICT_SCHEMA = { type:'object', required:['refuted','reasoning'],
  properties:{ refuted:{type:'boolean'}, reasoning:{type:'string'} } }
const CONTEXT = `Repo D:\\HeroByte (Windows). Review the UNCOMMITTED working-tree changes
(git diff HEAD + untracked) for <slice>: <what changed, files, invariants>. RULES: READ-ONLY.
Do NOT run pnpm test / vitest / builds. git + file reads are fine. Report only defects with a
concrete failure scenario; no style nits. Unit+e2e already pass.`
const LENSES = [
  { key:'field-seams', prompt:`${CONTEXT}\nLENS: field/underfill/rim/shadow correctness, z-order
     vs water & other families, opacity, DPR/camera-transform alignment, bumpy grass-vs-empty.` },
  { key:'cache-perf', prompt:`${CONTEXT}\nLENS: cache key/invalidation (stale bitmap after edit?),
     rebake cost, memory/leak of offscreen canvases, redraw-on-every-snapshot.` } ]
const found = await parallel(LENSES.map((l)=>()=>agent(l.prompt,{label:`find:${l.key}`,phase:'Find',schema:FINDINGS_SCHEMA})))
const findings = found.filter(Boolean).flatMap((r,i)=>r.findings.map((f)=>({...f,lens:LENSES[i].key})))
if (findings.length===0) return { confirmed:[] }
const judged = await parallel(findings.map((f)=>()=>parallel(Array.from({length:2},(_,k)=>()=>
  agent(`${CONTEXT}\nYou are skeptic #${k+1}. A reviewer claims:\nTITLE: ${f.title}\nFILE: ${f.file}\nCLAIM: ${f.description}\nSCENARIO: ${f.failureScenario}\nRead the code and try to REFUTE concretely. If it cannot occur, is pre-existing, or has no user-visible/invariant consequence, refuted=true. Default refuted=true if uncertain.`,
    {label:`verify:${f.title.slice(0,30)}`,phase:'Verify',schema:VERDICT_SCHEMA})))
  .then((v)=>({...f, upheld:v.filter(Boolean).filter((x)=>!x.refuted).length}))))
return { confirmed: judged.filter((f)=>f.upheld===2), contested: judged.filter((f)=>f.upheld===1),
         refuted: judged.filter((f)=>f.upheld===0).map((f)=>f.title) }
```

---

## 7. Gotchas this session paid for (save yourself the time)

- **Entry bundle stays 69.17 KB while inert** (tree-shakes). When you WIRE it,
  it grows — that's expected and fine (<<175 KB cap).
- Targeted test cmd: `pnpm --filter herobyte-client exec vitest run <path>`. A
  trailing `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL / Command "vitest" not found` just
  means the test process exited non-zero (i.e. a RED test) — read the vitest
  output above it, it DID run.
- **Per-pixel field render MUST be cached** (bake once per edit, blit per frame).
  Do NOT render it per animation frame — that's the whole point of the offscreen.
- **Detail must clip to the field** at seams (v2 proto pass-2) or pebbles/blades
  spill into the wrong family. Expose one shared field sampler (F10) — don't fork
  the math.
- **Water/stone/wood are NOT in the field renderer** (priority 0 → transparent);
  compose them on their own layers with correct z-order.
- `hash2` can return exactly `1.0` → guard any `array[Math.floor(hash*len)]`
  (Slice 1 has a `pickMotif` precedent).
- `temp/` and `assets/images/{Inspiration,logo}` are pre-existing owner files —
  present in `git status`, NEVER stage them.
- The prototype PNGs are the owner-approved LOOK. When your in-app render differs
  from `transition_v2_proto.png`, the app is wrong — match the prototype.

---

## 8. One-line kickoff (owner can paste this to start the next session)

> You are continuing HeroByte's procedural-terrain rework in `D:\HeroByte`
> (branch `dev`). Read `docs/planning/renderer-endgame-playbook.md` §0 in full,
> then `docs/planning/procedural-terrain-handoff.md` in full, then begin **Slice
> 2b** from its §4. Binding rules: one slice this session; RED-first tests; full
> §0.3 ritual; focused adversarial review (§0.4/§6); explicit staging only (never
> `git add -A`); never `pnpm add/install`; keep files <350 LOC and the SVG frozen
> goldens byte-identical. Slice 2b is VISIBLE — STOP before committing and let the
> owner eyeball the look in the editor; land on `dev` only when they say so.
