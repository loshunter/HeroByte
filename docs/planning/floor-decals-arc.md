# Floor Decals & Inlays arc — taxonomy rank 7

_Planned and executed 2026-07-26, immediately after the Wear & Canopy arc
(1f88921c, 4e78a9c2). Rank 7 is the catalog's `new-system` flagship:
oversized low-contrast floor graphics that unify rooms and aim the eye._

## The scope decision

The catalog route says "new placeable floor-decal scenery class rendered
between terrain and props" — and the Wear & Canopy arc's P1 already BUILT
that class: procedural decal stamps (`decal` flag on a bundled asset) with
the fillStyle/globalAlpha/fillRect painter contract, rendered by the Konva
`Shape` branch in MapElementsLayer (which sits exactly in the floor-decal
z-slot), exported through the SVG rect shim, seeded per element, hit-tested
and undo-able like any element, with no server or schema change (elements
carry only assetId; kinds live in bundled asset data). Rank 7 is therefore
NEW PAINTER KINDS on shipped machinery, not a new pipeline:

- **medallion** — the SacredBallcourt 10t tessera sun emblem: a region mask
  (centre disc, alternating ray wedges, outer ring, in the three golds)
  tessellated into a jittered tessera lattice with grout gaps, top-left
  bevel highlights, per-tessera value jitter and wear dropout.
- **tracery** — the PrintingPress oversized lattice at ~30% opacity: a pale
  diamond/quatrefoil grid drawn translucent so it unifies a floor without
  competing with tokens.
- **rug** — tone-on-tone: woven value-jittered rows with RAGGED ends,
  border band with scroll dashes and corner squares, ~15%-lighter centre
  sigil. The rug hue is prop-declared and tint-overridable (the stain rule).
- **ceremony** — the radial ceremonial stain: translucent multiply rings
  fading over the footprint at story focal points. Tint-overridable.

**Deferred out of this arc:** the two PATH-shaped observations — plaza inlay
ribbons swept along arcs and gold filigree causeway inlays — need the
path-spline + repeat-along-line machinery that rank 11 builds; they join
that arc as data. The emblem-mask "maze disc / meander" motif variants are
follow-on palette data once the tessellation core ships.

## Shape of the change

- `features/render/floorDecalDetail.ts` — NEW module holding the four
  painters (`paintFloorDecal` dispatch) + `FLOOR_DECAL_ART` colour data +
  a local hex shade helper. Same context-subset contract as the wear
  painter; imports only TYPES from wearStampDetail (no runtime cycle).
- `wearStampDetail.ts` — the kind union widens; `paintWearStamp` routes the
  new kinds to `paintFloorDecal`. The `stain` else-branch becomes explicit
  so a new kind can never silently fall through to stain art. Every
  consumer (MapElementsLayer, wearStampSvg, exportMapDocument) is
  kind-agnostic and untouched. Naming debt, accepted deliberately: the
  module/function/type names still say "wear" — renaming a 2-commit-old
  API for cosmetics isn't worth the churn; revisit if a third decal family
  ever lands.
- Assets: `inlay:sun-medallion` 6×6, `inlay:tracery-panel` 6×6, `inlay:rug`
  2×3, `inlay:rug-runner` 1×4, `inlay:ceremony-stain` 6×6 in a NEW
  `"inlays"` category (picker tab "Inlays"). Set-pieces must never join
  POPULATE's scatter pools, so the category is deliberately absent from
  `PopulateCategory` — no flag logic, the type union IS the exclusion.
- Night grade: inlays are props — deliberately ungraded (rank 3's accent
  rule), same as wear decals.

## Invariants

- Kinds are BUNDLED DATA, not wire data: elements store only assetId, so
  the union can grow or rename freely with zero schema/server impact.
- The dispatch stays the ONLY kind-aware code; renderers stay generic.
- 350-LOC caps: wearStampDetail 248 (+~6), starterTileObjectAssets 110
  (+~65), floorDecalDetail must land under 350 or split rugs out.
- Frozen SVG parity untouched: the export decal branch already exists;
  inlay assets merely flow through it.
- Painter contract: only fillStyle/globalAlpha/fillRect, alpha restored to
  1, every rect inside the footprint — pinned per kind in tests.

## Verification ritual (per phase)

Focused new tests → `pnpm test:client` → `pnpm typecheck` → `pnpm lint` →
`pnpm lint:structure` → live browser proof (place each kind, pixel-sample
palettes) → commit per phase.
