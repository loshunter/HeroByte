# Next arc: Light & Colour II — cool shadows → emissive pools → night grade

_Handoff plan written 2026-07-19 at the end of the Water II + polar-course
arcs (dd9b663e, b20fed07) and the found-bugs cleanup (4e35fd31, e0a4c07a).
The paste-prompt for a fresh session is at the bottom; everything above it is
the context that prompt references. Read THIS file first, then only the files
a slice touches — the architecture map below exists so you don't re-derive it._

## Why this arc

The three highest-ranked unshipped techniques in
`docs/planning/czepeku-taxonomy-catalog.md` are one story — light as colour:

1. **Rank 2 — cool-hue element shadows.** Shadows are hue-shifted cool (rose
   cobble → plum, white marble → blue-lilac), never grey-multiplied. "The
   number-one depth cue on every day map." We already have the geometry
   (near/contact/long-throw terms); only the COLOUR of darkening changes.
2. **Rank 1 — baked light pools from emissive props.** The biggest cluster in
   the corpus: 3-stop radial pools (hot core ~0.3t → halo ~0.7t → wash 2.5–3t)
   that RE-TINT the family palette instead of adding white, with 4–8 sparkle
   motes. We ship flat 2-stop pools today (terrainLighting); this upgrades the
   look and makes lamp/brazier/torch SCENERY light the map automatically.
3. **Rank 3 — night grade palette transform.** Night maps compress every
   family into one cool desaturated ladder while warm accents stay untouched
   (<5% of pixels). Pure data over families-as-data; pairs with rank 1 so
   pools punch through the grade.

Order = smallest-delta-first: cool shadows are a contained recolour of shipped
terms; pools upgrade an existing post-pass; the grade crowns both. Ship each
phase completely (tests, review, live proof, commit, push) before the next.

## Slice plan — Phase 1: cool-hue shadow pass (rank 2)

- **C1 — Shadow colour as data.** Today every darkening term in `colorAt`
  (contact AO, near cast shadow, long throw — proceduralTerrain.ts ~line 250+)
  multiplies all three channels by one `keep` factor. Replace the final
  `color * keep` with a hue-aware darken: mix toward a map-level SHADOW TINT
  (e.g. plum `#3A2F45`) as `keep` falls, so shadowed pixels stay saturated.
  Config knob: `shadowTint?: string` on `TerrainFieldConfig` (default
  undefined ⇒ today's grey multiply, BIT-IDENTICAL — the parity invariant).
  Data plumb: `bakeProceduralTerrain` input → a map-level knob (start with a
  VILLAGE constant; a per-map UI dial is a later arc).
- **C2 — Per-family shadow length multiplier.** The taxonomy wants height
  classes as data (parapets 0.25t, walls 1t, domes 2–4t). `shadow.band`
  already does this — audit + retune the wall/roof/polar-roof bands against
  the reference ratios and pin the ordering (walls < roofs < domes) in
  wallVariants/polarCourse suites. Data-only slice.
- **C3 — Verify + review + ship.** Full ritual; visual proof = the wall/roof
  test scene, comparing shadow hue before/after (sample pixels, don't eyeball
  — this arc's dome-crescent lesson).

## Slice plan — Phase 2: emissive-prop light pools (rank 1)

- **E1 — 3-stop pool profile + palette re-tint.** In `terrainLighting.ts`
  `applyBakeLighting`: replace the single quadratic falloff with the 3-stop
  profile (hot core → inner halo at ~50% → broad wash to 2.5–3× radius) and
  strengthen the tint model so pooled ground re-tints toward the light hue
  (sage → olive-gold) rather than just cancelling the veil. Keep
  `lightingActive` semantics EXACTLY: daylight (ambient 1, no lights) must
  remain a bit-identical no-op — pinned already in terrainLighting.test.
- **E2 — Sparkle motes.** 4–8 deterministic motes per pool (hash2 on the
  world lattice, seeded per light), drawn in the same post-pass. Off when
  ambient is 1.
- **E3 — Emissive scenery.** An `emissive?: { color, radius, intensity }`
  field on bundled scenery assets (starterTileAssets — lamp orb, brazier,
  torch, chandelier are in the prop-kit catalog): placed emissive props
  contribute BakeLights automatically. FIND THE LIGHTS FLOW FIRST — placed
  💡 lights go map-edit `lightPlacement.ts` → live doc → snapshot
  `MapLightingSnapshot` → TerrainLayer lighting signature → bake. I did NOT
  trace where the snapshot's lights array is assembled server-side; locate it
  (grep `MapLightingSnapshot` in packages/shared + apps/server) before
  designing E3, and decide client-derived vs server-derived deliberately.
  Mind the player-safe lighting channel (see lighting-shadows-arc memory).
- **E4 — Verify + review + ship.** Live proof: a night scene (Lighting layer
  opacity down) with placed lamps + an emissive prop; pixel-sample the 3
  stops.

## Slice plan — Phase 3: night grade (rank 3)

- **N1 — The grade transform.** A pure function over `TerrainFamilyPalette`
  colour fields (hue toward blue, saturation down, value compressed —
  `terrainFieldColor.ts` is the natural home) producing a graded palette
  record. Every consumer of VILLAGE_TERRAIN goes through one accessor so the
  grade is a swap, not a rewrite; prop/accent palettes untouched.
- **N2 — Wiring + dial.** Where does "night" come from? Simplest honest v1:
  derive grade strength from the existing ambient (Lighting layer opacity)
  so DMs get it for free; a separate grade dial can come later. The bake
  cache key must include it (terrainBake lightingSig probably already
  covers ambient — verify).
- **N3 — Verify + review + ship.** Full ritual; proof = same scene day vs
  night; the SVG export and swatches must be UNgraded (flat path reads
  starterTiles, never VILLAGE_TERRAIN — pinned).

## Architecture you inherit (post-Water-II/polar file map)

All in `apps/client/src/features/render/` unless noted. The 350-line guard
(`node scripts/structure-report.mjs --threshold 350 --fail-on-new`) is at
ZERO violations — keep it there; budget lines BEFORE writing and split into
sibling modules early (precedent: everything below).

- `proceduralTerrain.ts` — the field: `colorAt`/`sampleField`, compositing
  loop with contact/near/long-throw darkening terms (Phase 1 target). Types
  re-exported from `proceduralTerrainTypes.ts`.
- `terrainFieldColor.ts` — colour terms: parseHex/mixRgb/pickBand/mottledRgb,
  foam/caustics/sunken curves, waterBandsFor. Phase 1's tinted-darken and
  Phase 3's grade function belong here (or a sibling if it outgrows).
- `terrainLighting.ts` — ambient veil + pools post-pass (Phase 2 target);
  `lightingActive` gates the whole pass.
- `terrainPolarField.ts` — polar regions + course painter (courseWidth/
  jointPitch in CELLS, ramp over normalized radius, joint phase seed+33).
- `proceduralTerrainSurface.ts` — orchestrator: combined water∪sunken BFS
  (`computeBodyDepths`), polar regions, detail routing (sunken → tinted
  sibling painters via `terrainDetailCtx.makeTintCtx`), bake + lighting.
- Painters: terrainFloorDetail / terrainWallDetail / terrainRoofDetail /
  terrainWaterDetail (dashes + algae) / terrainDetail — all fillRect-only,
  hash2 world-lattice deterministic. Painter seeds in use: 1–99 (terrain),
  51–89 (floor), 141–155 (roof/stairs), 161–174 (water). Field seeds:
  priority*97+3 (+offsets 1,5,11,12,21,22,25,31,32,33).
- `terrainPalette.ts` — VILLAGE_TERRAIN data; types in terrainPaletteTypes;
  shades in terrainMaterialPalettes; swatch data in
  `map-studio/starterTileAssets.ts` (API in starterTiles.ts).
- Live wiring: map-edit unions/lists/toolbar; `map/components/terrainBake.ts`
  (cache keyed layers-identity + grid + lighting VALUE sig; body-aware
  shimmer via `waterBodyLayers`); TerrainLayer.tsx.
- Lights: map-edit `lightPlacement.ts`, shared `MapLightingSnapshot`,
  player-safe channel (lighting-shadows-arc memory).

## Traps (accumulated — every one bit us already)

- Families/config without a new knob must render BYTE-identically — every new
  term needs a default reducing to the old arithmetic. Pin it.
- Daylight (ambient 1, no lights) is a bit-identical no-op through the whole
  lighting pass. Phase 2 must preserve this exactly.
- `terrain:water` underfill:false, priority 3.5; sunken families ditto at
  3.6/3.7; the waterline rim is DEPTH-GATED (<1.5 body depth) for banded
  families; the sunken band tint uses the WATER's jitter seed. One combined
  water∪sunken BFS registered under every member id.
- SVG export + swatches read starterTiles fills only — never VILLAGE_TERRAIN,
  and therefore never the night grade. Goldens are byte-pinned.
- The dungeon golden fixture is an owner-sign-off contract — untouchable.
- wallVariants pins: ring-protection = ground-level (priority < 20) families
  with floor||stairs||sunken||polar routing; roofs read via roof||polar
  (exactly one). Evolve pins deliberately, never delete.
- The four layout characterization fixtures all take MainLayoutProps — a new
  MapBoard prop touches all four test files.
- prettier --fix can push a file over the 350 guard; the guard counts RAW
  lines and flags AT 350 (>=). Check `wc -l` before committing.
- OWNER RULE (memory: fix-bugs-regardless-of-origin): any bug found mid-arc
  gets FIXED in its own commit, even pre-existing/other-agent ones. No silent
  deferrals; a confirmed review finding is never "accepted" without sign-off.

## Ritual

- Verify: `pnpm --filter herobyte-client typecheck`; `pnpm lint` (run in BOTH
  apps/client and apps/server if you touched server); `pnpm test` (client),
  `pnpm test:shared`, `pnpm test:server`;
  `node scripts/structure-report.mjs --threshold 350 --fail-on-new` must stay
  at zero. `zz_perfbench.test.ts` (untracked scratch) is gated behind
  PERF_BENCH=1 — use it for bake-cost deltas, never commit it.
- Visual proof: `.claude/launch.json` has `server` (8787) + `client` (5174);
  login `Fun1`, DM via ⚙ → DM Mode → `FunDM`; MAP → START LIVE MAP. Konva
  needs real MouseEvents on `.konvajs-content` (define a __drag helper;
  RE-QUERY the element each call, and click swatches in a SEPARATE call from
  the drag — React state flushes between tool calls, not within one script).
  A stale live binding after a server restart now self-recovers (e0a4c07a).
  If pane screenshots time out while page JS responds: composite the Konva
  canvases to a dataURL, slice it out (oversized results land in
  tool-results/*.txt files), reassemble with python, Read the PNG. Sample
  pixels for colour claims instead of eyeballing. Undo test edits when done.
- Review: adversarial multi-agent Workflow over the diff before committing —
  lens reviewers (schema'd findings) → per-finding adversarial verifiers.
  It has caught real ship-blockers three arcs running (phantom rim, joint
  anchor). If subagents die on a session usage limit, the run is NOT a clean
  review — re-run after reset; salvage nothing from errored agents.
- Commit conventional style to `dev`, push `origin dev` (dev does NOT deploy;
  `main` is production — never push main). Separate commits for unrelated
  fixes found along the way. End with the Claude co-author line. Update
  memory files + MEMORY.md after each shipped phase, and correct any memory
  the arc makes stale.

---

## Paste-prompt for the fresh session

Let's continue the Czepeku-style renderer arcs. This session's job is the
Light & Colour II arc — the full plan, slice by slice, is in
`docs/planning/light-colour-2-arc.md`. Read that file first and follow it; it
carries the architecture map, the accumulated traps, and the ship ritual.

Context in one paragraph: HeroByte's live-table terrain is fully procedural —
palette-as-data families over a per-pixel field (rim/priority/underfill,
mottle, contact AO, height-scaled shadow throws, depth-banded water with foam/
caustics/dashes, sunken structures over a combined water-body BFS, and the
polar-course engine for round towers/domes/dais rings) plus fillRect-only
deterministic detail painters, baked once per edit, with an ambient-veil +
light-pool post-pass. The technique backlog lives in
`docs/planning/czepeku-taxonomy-catalog.md` — never copy assets, only build
our own generators toward that grammar.

The goal, in order — ship each phase completely before the next:

Phase 1 — cool-hue shadow pass (catalog rank 2): shadows mix toward a
map-level shadow tint instead of grey-multiplying, default-off bit-identical;
plus per-family shadow-length retune. Slices C1–C3.
Phase 2 — emissive light pools (rank 1): 3-stop pool profile with palette
re-tint and sparkle motes in terrainLighting, then emissive scenery props
contributing lights automatically (trace the MapLightingSnapshot flow before
designing that slice). Slices E1–E4.
Phase 3 — night grade (rank 3): a pure palette transform driven by the
existing ambient, applied at bake, never touching the SVG/swatch path.
Slices N1–N3.

Definition of done per phase: all new behavior pinned by tests (bit-parity
defaults for knob-less configs — non-negotiable); typecheck + lint + all
three package suites + the structure guard green; visual proof painted in the
running app with pixel-sampled colour verification; an adversarial
multi-agent review workflow over the diff with confirmed findings fixed;
conventional commit pushed to origin/dev (never main — that's production);
memory files updated and stale memories corrected.

Mind the traps section especially: the daylight bit-identical no-op, the
byte-parity default rule, the untouchable dungeon golden and SVG goldens, the
evolved wallVariants pins, the 350-line guard at zero, and the owner rule
that any bug found gets fixed regardless of origin.
