# THE WORKBENCH — mobile map authoring at phone parity

**Status:** design complete, not started (2026-08-01). Implementation slices M4–M12 below continue
the numbering in [mobile-authoring-arc.md](./mobile-authoring-arc.md), where M1–M3 shipped.

**Scope decision this implements:** the owner chose **phone parity**, not graceful degradation —
"dropdowns or other space-saving tricks can be employed… swipe down or swipe left gestures… design
a killer mobile app worthy of the HeroByte moniker." This supersedes the earlier recorded reading
("degrade gracefully, hostile tools stay tablet-and-up") in
[session-one-arc.md](./session-one-arc.md) §7a, which was my interpretation and was wrong.

**How this was produced.** Four independent designs were written from deliberately opposed angles
(progressive sheets / contextual-radial / mode-fullscreen / compact-persistent), then scored by
three adversarial judge panels — one recomputing every layout number as a hostile surveyor, one
judging interaction quality and thumb reach, one checking parity and buildability against the real
codebase. This is the winner with the runners-up's best ideas grafted in; the "Why this shape"
section names what was rejected and on whose finding.

**Independently verified before publishing** (do not re-derive):

- `useTouchGestureRouter.ts:137-146` really does count `event.evt.touches.length` **document-wide**
  for the tool branch — so a thumb resting on any chrome cancels an in-flight drag. That is live in
  shipped code today, affects the already-released drawing feature, and is why M4 is slice zero.
- `--mobile-safe-bottom` is `max(12px, env(safe-area-inset-bottom))` (herobyte.css:1221) — **34px**
  on a notched iPhone, not the 12px every draft design assumed. Any hardcoded detent table built on
  12 is wrong; the budget below is expressed as `calc()` against the live variables.
- `usePopulate.previewGhosts` exists and carries the exact drafts, so the Populate Anvil costs a
  render call rather than new preview machinery.
- `BRUSH_GROUP_ORDER` is real (`brushDeck.ts:10`) — the chip rail uses the actual groups, not
  invented ones.

---

## The design in one paragraph

Authoring on a phone is one bottom sheet — **the Workbench** — with three detents (PEEK 100px / HALF 300px / FULL ~430px) sitting above a paging 5-cell dock, and everything above it is **the Window**: the live Konva stage, never covered, never re-rendered, with a gold reticle pinned to _its_ centre that re-centres whenever the sheet changes height. You arm a tool from a flat 15-tile grid at FULL; picking one drops the sheet to PEEK and hands you 598px of map with a six-slot hot row (TOOL / BRUSH / ACTION / MOD / CANCEL / EXPAND) and a 20px status strip that permanently reads out every modifier the desktop hides in a key (`PLACE · CRATE · STAMP · 45°`). Drag tools drag with one finger exactly as on desktop; the three hover-dependent tools (Place / Scatter / Light) aim by moving the map under the reticle with two fingers — the shipped camera — and commit only on the ACTION cell, so the real `ghost`/`draftGhosts` machinery previews the true result with no new render code. Nav is two levels deep, maximum, and the back/title/close bar is a **sticky footer** at the bottom of the sheet, not a header at the top, because at FULL the top of the sheet is 380px up an 812px screen. Landscape rotates the axis: the deep surfaces become a 360px right-hand drawer that costs zero vertical budget, and the DM menu is that same drawer, full-height, hosting `MapTab`/`NPCsTab`/`PropsTab`/`PlayersTab`/`SessionTab` verbatim under a CSS wrapper that forces 44px minimums.

---

## Why this shape

**Spine: `progressive-sheets`.** It won the arithmetic judge and the parity-and-build judge, and both for the same reason — it is the only submission whose layout claims survive recomputation _and_ whose file plan can be scheduled. Ten new files, largest 250 LOC, one non-additive change to shipped code. The other three each need a machine nobody sized: `contextual-radial` needs a Konva transform-handle layer for `MapDocument.elements` that does not exist plus ~14 learned gestures; `mode-fullscreen` needs THE CAST, which asserts a client-side baked-painter channel; `compact-persistent` declares `useArmedTouchTool` unchanged while requiring one-finger drags for eight of thirteen tools — and I confirmed the hook's own comment: _"Map-edit is deliberately absent."_

**Three things the spine got wrong, fixed here.**

1. **The FULL detent left 120px of map.** progressive-sheets derives FULL from a 710px ceiling. That is the wrong direction. This design derives it from a **220px Window floor** instead: `sheet-max = 100dvh − sheet-bottom − safe-top − 220px`. On a notched 375×812 that is 430px of sheet and **264px of map at FULL**, not 120. Every arithmetic claim below is written as `calc()` against the live safe-area variables, because `--mobile-safe-bottom: max(12px, env(safe-area-inset-bottom))` (herobyte.css:1218) is **34px** on the exact iPhone geometry all four designs quoted as 12 — the arithmetic judge's catch, and it invalidates any hardcoded detent table.
2. **Breadcrumbs and a top header.** Three levels with a `TOOLS ▸ PLACE ▸ ASSET` trail is web grammar, and at FULL the back chevron lands in the top fifth of the screen. Cut to **two levels** (L0 home grid, L1 detail) and moved the nav to a **sticky footer** hard against the dock. The top of the sheet carries only the grabber and the status strip — both non-interactive, so their unreachability costs nothing.
3. **The two-finger swipe-down-to-collapse.** Cut, as its own author pre-authorised. Two fingers are unconditionally the camera; `useCamera` leaves pinch ungated on purpose and the router's comment says why.

**What was grafted, and from where.**

| From                 | Grafted                                                                                                                                                                                                                                                                                     | Why                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contextual-radial`  | **The Populate Anvil** — the room frame survives its own commit, dims to a dashed outline, and a contextual band transforms in place with `previewGhosts` filling it live                                                                                                                   | Best answer to requirement 10 in the whole set. `usePopulate` already computes the exact drafts (`previewGhosts`, verified); this costs a band and a render call  |
| `contextual-radial`  | **The dropdown law**: any segmented control with >3 options becomes a native `<select>` below 500px viewport height                                                                                                                                                                         | The owner asked for dropdowns by name. Native selects are OS wheel pickers — best space-per-choice control that exists on a phone                                 |
| `contextual-radial`  | **The DM drawer reusing the five tab-views verbatim** under a `.mobile-dm-body` wrapper                                                                                                                                                                                                     | ~40 lines of CSS for the largest missing surface in the app                                                                                                       |
| `compact-persistent` | **Generate as `⤢ FIT` + numeric COLS/ROWS + two-corner tap-aim**                                                                                                                                                                                                                            | The only design that saw the real blocker: at ~20 screen px/cell a legal 20×20 region is ~400px against a 375px screen. It cannot be a drag                       |
| `compact-persistent` | **`useReticleAnchor` = centre of the visible Window, re-centring on every chrome change**; **the `<350px` rail breakpoint**; **search field at the BOTTOM of the deck**; **the CANCEL priority ladder**                                                                                     | Each solves a named failure with no new API. The bottom-anchored search kills progressive-sheets' unproven `visualViewport` re-anchor outright                    |
| `mode-fullscreen`    | **Landscape rotates the axis** (right drawer, zero vertical cost); **≤6-char label discipline**; **the danger-red live-binding banner**; **build the numeric steppers first, handles second**; **layer picker as a list overlay, not a `<select>`** (a wheel picker cannot show lock state) | The porthole idea itself is free in portrait — a bottom sheet already _is_ a hole with the live stage above it. What was worth taking is the discipline around it |

**Disproved, discarded.** THE CAST as specified (no client channel: terrain goes `controller.paintTerrain` → command → server) — but see **TASTE** below, which is the same idea through machinery that does exist. The 20px canvas edge gutters (they are `touch-action:none` divs at z-1450 _over_ the canvas — they amputate 11% of the drawing surface). Two-finger-tap = undo (collides head-on with the shipped two-finger cancel reflex). Long-press-anywhere-on-canvas (fights the terrain brush stream; its own author's fallback guts the angle). GRASS/DIRT filter chips (not shelves — `BRUSH_GROUP_ORDER` is ground/water/molten/stone/wood/roof/canopy/crystal, verified).

**The one hazard every design but one ignored, and it decides the foundation slice.** `useTouchGestureRouter.ts:137-146` counts `event.evt.touches.length`, which is document-wide — the comment says so explicitly: _"a finger landing anywhere — the toolbar, the dock, the bezel — makes this 2 without ever reaching the stage's touchstart."_ Every design here puts 100–430px of chrome exactly where a two-handed grip rests its thumb. That means **every authoring drag dies under a supporting thumb** unless the tool-arbitration count is scoped to the stage container. That is not a polish item; it is slice zero.

---

## The layout, with numbers

All widths derived: portrait outer `375 − 12 − 12 = 351`; minus `3px` border ×2 = 345; minus `8px` padding ×2 = **329px of content** (matches the shipped `.mobile-drawing-sheet` figure). Press Start 2P at `0.7rem` = 11.2px, advance width 1.0em, so _n_ chars = 11.2*n* px.

### The budget, as CSS

```css
--dock-h: 68px; /* 48px in landscape — see below */
--pager-h: 8px; /* the two-dot dock pager */
--sheet-bottom: calc(var(--mobile-safe-bottom) + var(--dock-h) + var(--pager-h) + 8px);
--window-floor: 220px; /* the map is never smaller than this */
--sheet-max: calc(100dvh - var(--sheet-bottom) - var(--mobile-safe-top) - var(--window-floor));
```

### Portrait 375×812 — worst case (notched: safe-bottom 34, safe-top 44)

`--sheet-bottom = 34 + 68 + 8 + 8 = 118px`. `--sheet-max = 812 − 118 − 44 − 220 = 430px`.

| Detent             | Sheet | + bottom | Chrome | **Map visible** | %   |
| ------------------ | ----- | -------- | ------ | --------------- | --- |
| **PEEK** (resting) | 100   | 118      | 218    | **594px**       | 73% |
| **HALF**           | 300   | 118      | 418    | 394px           | 49% |
| **FULL**           | 430   | 118      | 548    | **264px**       | 32% |
| PEEK + Anvil       | 264   | 118      | 382    | 430px           | 53% |

On a non-notched 375×812 (safe 12/12) `--sheet-max` resolves to 488 and FULL leaves 312px. **Every number below is computed against the 430px worst case.**

**PEEK = 100px** = border 6 + padding 16 + status strip 20 + gap 6 + hot row 52.
**FULL body = 430 − 6 − 16 − 20 − 6 − 6 − 48 (footer nav) = 328px.**

### Portrait element table

| Surface                 | Row arithmetic                                                                               | Total                | Fits 328?           |
| ----------------------- | -------------------------------------------------------------------------------------------- | -------------------- | ------------------- |
| **L0 tool grid**        | 3 cols × 105px (`(329−14)/3`), 56px rows, 15 tiles → `5×56 + 4×7`                            | **308**              | ✓ no scroll         |
| **Hot row (PEEK)**      | 6 slots × 49.8px (`(329−30)/6`) × 52 tall                                                    | 329                  | ✓ ≥44 floor         |
| **Status strip**        | `PLACE · CRATE · STAMP · 45°` = 26 chars = 291px                                             | 291/329              | ✓ (truncates at 29) |
| **Footer nav**          | `[◀ 44][ title 225 ][✕ 44]` + 2×8 gaps                                                      | 329 × 48             | ✓                   |
| **Brush deck**          | chips 44+6, shelves scroll, search 44+6 at bottom                                            | 50 + **228** + 50    | ✓ shelves scroll    |
| — deck tiles            | 4 cols × 77px (`(329−18)/4`); shelf = 18 label + 77 + 6 = 101                                | 2.25 shelves visible | scrolls             |
| **Inspector TRANSFORM** | tabs 46 + 5 steppers `5×44+4×6` 244 + layer/hidden row 50                                    | 340                  | scrolls 12px        |
| — stepper row           | `[label 68][− 44][value 105][+ 44][⇕ 44]` + 4×6                                              | 329 × 44             | ✓                   |
| **Inspector DOOR**      | state `<select>` 44 + width stepper 44 + gap 6                                               | 94                   | ✓                   |
| **Layers** collapsed    | row 52 = `[👁44][🔒44][name 179][⌄44]` + 3×6; 6 layers `6×52+5×6`                            | 342                  | scrolls 14px        |
| — name column           | 179px = 16 chars → holds `Walls & Doors` (13) and `Background` (10)                          | ✓                    |                     |
| — one expanded          | + opacity band 44 + `[▲ MOVE UP 161][▼ MOVE DOWN 161]` 44 + 12                               | 442                  | scrolls 114px       |
| **Generate panel**      | themes 2×161 44, density 3×105 44, COLS/ROWS steppers 2×44, seed 44, `⤢ FIT` 44, GENERATE 52 | 316 + gaps           | ✓                   |
| **Populate Anvil**      | label 20 + category `4×77` 44 + density `3×105` 44 + `[FILL 161][DONE 161]` 44 + 12          | **164**              | rides on PEEK       |

**What gets cut in portrait:** nothing from the 13 sub-tools. What scrolls, and I am naming it rather than hiding it: the brush deck shelves (by design — 40+ families), the inspector by 12px, the layers panel by 14px collapsed. Everything else fits without a scroll on the worst-case phone.

**Narrow phones (<350px, iPhone SE at 320px):** content box is 274px. Six hot-row slots resolve to `(274−30)/6 = 40.7px` — **under the 44px floor the e2e suite enforces.** At `@media (max-width: 349px)` the hot row drops to **5 slots** at `(274−24)/5 = 50px`, folding MOD into the L1 panel (where its segmented row already lives). The tool grid stays 3 columns at 86px, which still holds a 6-char label (67px). The shipped 420px query does not cover this; the breakpoint is new and required.

### Landscape 812×375 — the axis rotates

The `195px` problem is real and unsolvable by shrinking a bottom sheet. So deep surfaces stop being bottom sheets.

Add the missing override — `--mobile-dock-height` is declared once at `:1218` and **never overridden in the landscape block**, so `.mobile-action-dock{min-height:68px}` currently swallows the 40px button rule:

```css
@media (orientation: landscape) and (max-height: 500px) {
  .mobile-layout-root {
    --mobile-dock-height: 48px;
    --window-floor: 0px;
  }
}
```

| Surface                                 | Geometry                                                                                                                    | Vertical cost  | Map left      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------- |
| **PEEK rail**                           | `6 + 12 + 44 = 62px` tall; 6 slots × `(766−30)/6 = 122px` — wide enough for glyph **+ label**                               | 62 + 72 = 134  | 812 × **241** |
| **L0 / L1 / deck / inspector / layers** | **right-anchored drawer**, `top: safe-top; bottom: safe-bottom`, width `min(360px, 46vw)`                                   | **0**          | 428 × 351     |
| — drawer content                        | `360 − 6 − 16 = 338px`; L0 grid 3 cols × 108px, **48px** rows → `5×48 + 4×6 = 264` in `351 − 6 − 16 − 48 footer − 12 = 269` |                | ✓ no scroll   |
| — inspector stepper                     | `[label 60][− 44][value 102][+ 44][⇕ 44]` + 4×6 = 318 ≤ 338                                                                 |                | ✓             |
| **DM drawer**                           | same anchor, `min(360px, 92vw)`, full height                                                                                | 0              | —             |
| **Populate Anvil**                      | 2 columns: label+category row / density+actions row → 20 + 44 + 6 + 44 = **114**                                            | 114 + 72 = 186 | 812 × 189     |

Landscape is the _better_ deck browser: 338px of drawer content gives 4 columns of 78px tiles over a full 351px column height. The 15-tile grid, the deck, the inspector and the layers panel all fit landscape **without touching the 195px band at all**, because they no longer live in it.

**What gets cut in landscape:** the status strip loses its `· 45°` tail below 700px of content (truncation, not removal). The Generate panel's theme row goes 2-up instead of 4-up. That is the whole list.

---

## Every hard case, answered

| #   | Case                               | The answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Code seam                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **All 13 sub-tools**               | Flat **15-tile grid**, 3×105px cols, 56px rows, 308px — no scroll, no grouping, no submenu. The 13 from `SUB_TOOLS` plus **PICK** (eyedropper) and **FILL** (populate) promoted to real tiles. **2 taps to any tool** from the map (dock TOOLS → tile); 1 swipe to an adjacent tool on the footer nav. Grouping was rejected: it costs a third tap on the hottest path, and progressive disclosure belongs on _options_, not reach                                                                                                                                                                                                                                                                                                                                                                             | none — reads `SUB_TOOLS`                                                                                                                                                                                                                                                                                         |
| 2   | **Placement without hover**        | **The reticle is the cursor.** Gold L-bracket reticle pinned to the centre of the _Window_ (not the screen), re-centring on every detent change. Its doc point feeds `placement.updateCursor()` — so `ghost` and `draftGhosts` (the true seeded scatter cluster) light up with **zero new preview code**. Aim by moving the map with two fingers (shipped camera). **Commit only on the ACTION cell.** After the first drop, ACTION offers a `⚡ RAPID` toggle: one canvas tap places at the tap point, ghost flashing 200ms. Off by default                                                                                                                                                                                                                                                                   | `updateCursor` already decoupled from the mouse; the touch path must NOT route click tools through `onMouseDown` (see Gestures)                                                                                                                                                                                  |
| 3   | **Alt (tile vs free stamp)**       | Three readouts for a bit that today has **no UI anywhere**: the **MOD hot-row cell** (`▦`/`◈`), a 2-up segmented row `[▦ TILE][◈ STAMP]` at 161px each in PLACE's L1, and the status-strip tail. The ghost visibly changes shape on toggle — grid-snapped `tileFootprint` vs free centred rect — which is the affordance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `useMapEditPlacement` gains `freeStamp?: boolean`, OR'd with `altHeld` at `:108`. Desktop Alt untouched                                                                                                                                                                                                          |
| 4   | **Rotation (R / Shift+R)**         | Two different rotations, because the code has two. **Pending stamp:** PLACE L1 row `[⟲ 60][ 045° 197 ][⟳ 60]`, ±`STAMP_ROTATION_STEP` (15) per tap, hold-repeats at 8/s after 400ms, tap the readout → 0°, long-press → an 8-cell snap pad (0/45/90/…). Disabled and dimmed in TILE mode, matching `createTileElement`'s axis-aligned lattice. **Selected element:** the inspector stepper, **step 1**, matching the shipped `step={1}`                                                                                                                                                                                                                                                                                                                                                                        | `setRotation` exposed alongside the existing keydown listener                                                                                                                                                                                                                                                    |
| 5   | **Eyedropper**                     | Promoted to the 14th tile, **momentary**. Arm PICK → reticle becomes a hollow sampling ring → ACTION reads `⌖ SAMPLE` → `sampleAssetAtPoint` fires → **auto-restores the tool you came from** and the strip flashes gold `SAMPLED · OAK CRATE` for 1.2s. No long-press-on-canvas variant — it would fight the paint stream                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `onSampleAsset` currently forces `setActiveSubTool("place")` (`useMapEditState:229`); add a `returnTool` ref. `SAMPLEABLE` and `ctrlHeld` unchanged for desktop                                                                                                                                                  |
| 6   | **Brush deck**                     | L1 at FULL. Chip rail from the real `BRUSH_GROUP_ORDER` (`★ PINNED · RECENT · GROUND · WATER · MOLTEN · STONE · WOOD · ROOFS · CANOPY · CRYSTAL`), `touch-action: pan-x`. 4 cols × 77px tiles. **Search field at the BOTTOM** so iOS raises the keyboard directly under the caret with results above it — no `visualViewport` API needed. **Hover card → 350ms long-press** opens a centred 240px card: 200px preview, name, the family's grammar `note`, and a 44px `★ PIN` (the touch replacement for right-click pinning) + `USE`. **TASTE**: arming a family paints a synthetic 3×3 `TerrainPaintCell[]` block at the reticle into the _existing_ `strokeCells` preview prop — which already tints with the family's real baked chip via `brushThumbnails`. Uncommitted, client-only, zero new render code | Keep the `brushDeck.ts` localStorage keys verbatim so desktop pins follow the DM to the phone. Keep the existing `stopPropagation` + Escape-clears-query guard on the field                                                                                                                                      |
| 7   | **Inspector**                      | L1, two tabs `[TRANSFORM][DOOR]` (kills the scroll). **No bare number inputs.** Every field is a 44px stepper: `[label 68][−][value 105][+][⇕]`. Steps are what a DM thinks in — X/Y = 1 grid cell on tap, ⅛ cell on hold; scale 0.05; rotation 1 (matching desktop). `⇕` is a drag-scrub at 1 step per 12px. Tapping the value _then_ raises `inputmode="decimal"`. **Layer is a list overlay, not a `<select>`** — a wheel picker cannot show lock state, and the existing `!layer.locked \|\| layer.id === element.layerId` filter needs to be visible. APPLY/DELETE in the sticky footer; **DELETE is two-stage** (`SURE?` for 3s, red + scanline)                                                                                                                                                         | `MapEditInspectorPopover` stays; the mobile file is a sibling reading the same props                                                                                                                                                                                                                             |
| 8   | **Layers**                         | Accordion. Collapsed 52px row: `[eye 44][lock 44][name 179][⌄ 44]`. 179px holds every real `DEFAULT_MAP_LAYERS` name including `Walls & Doors`. Expanded adds an opacity band + `[▲ MOVE UP][▼ MOVE DOWN]` — **buttons, not drag**: drag-reorder inside a vertical scroller is a second arbitration problem and this design refuses to open one. Lighting is special-cased and labelled `LIGHTING — 100% = DAY` with a sun/moon end-cap, because that opacity _is_ the ambient dial                                                                                                                                                                                                                                                                                                                            | Generalise `.mobile-drawing-sheet__control input[type="range"]` into a shared class. **The two vendor track pseudo-elements MUST stay separate rules** — the comment at `herobyte.css:1486` was paid for once already                                                                                            |
| 9   | **Generate ≥20×20**                | Not a drag — a legal minimum region is ~400px against a 375px screen. Three paths, built in this order: (a) **`⤢ FIT`** — one tap sets the region to the Window's visible doc rect, clamped to ≥20×20 and ≤16384 cells. This is the "I just want a dungeon" path and it will outdraw everything else 10:1. (b) **COLS / ROWS steppers** — exact resize, step 1, hold-repeat. (c) **Two-corner tap-aim** — ACTION reads `⌗ SET A`, tap; pan/pinch freely; the rect renders live between A and the moving reticle; `⌗ SET B` locks. Decouples region size from viewport size, which a drag structurally cannot. The status strip is live and legal-or-not continuously: `GEN · 24×31 · 744 ✓` gold, `GEN · 14×31 · SIDE < 20` red. `vibrate([10,40,10])` on crossing 20 in either axis                           | Export `MIN_REGION_SIDE`/`MAX_REGION_CELLS` and `regionProblem` from `useGenerate` for the strip. All three paths synthesise a `RoomBounds` and call the unchanged `onRegionDragged`                                                                                                                             |
| 10  | **Populate's invisible adjacency** | Two visible things, both. (a) **`FILL` is a permanent L0 tile**, rendered at 40% with a diagonal hatch and a 2-line sub-label `DRAW A ROOM OR HALL FIRST` when `canPopulate` is false — visible-but-disabled is what makes a rule _learnable_. (b) **The Anvil**: the moment a room or hall commits, its bounds draw as a gold dashed outline (`renderRoom` + `goldFill`, existing), `previewGhosts` fill it with the true drafts, and a 164px band slides in above the status strip — `DRESS THIS ROOM?` / 4 category chips / 3 density chips / `[FILL][DONE]`. **Touching a chip re-rolls the ghosts live.** Populate is armed exactly when it is visible, welded to the region it affects, previewing exactly what it commits                                                                               | `previewGhosts` and `canPopulate` already exist and are already exact. `setLastPlacedBounds(null)` on commit already dismisses it; the stale `regionHasFloor` case turns the outline red and collapses the Anvil to `AREA IS EMPTY NOW`                                                                          |
| 11  | **Undo / redo / cancel**           | UNDO and REDO are **dock cells 3 and 4** — the one surface that never moves, never collapses, never changes level. Cancel is the **`✕` hot-row cell as a documented priority ladder**: (1) a drag in flight → `cancel()`; (2) a pending GEN corner A → clear it; (3) an L1 screen open → back to L0; (4) otherwise disarm to Move. Plus the free one: **planting a second finger already cancels the in-flight gesture** (`useTouchGestureRouter:115-120`), taught by a 24px chip `2 FINGERS = MOVE MAP / CANCEL` shown during the first five drags of a session, then never again                                                                                                                                                                                                                             | **`useMapEditTool` must export `cancel`** — `clearDrag` is internal today and the only external cancel is a capture-phase Escape no finger can reach. **`useTerrainBrush` must gain `cancelStroke`** — it has _no_ discard path, only `flushStroke`, so an aborted brush gesture currently cannot be thrown away |
| 12  | **Swipes**                         | See the next section — all six live on chrome, none on the canvas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | none in the router's canvas path                                                                                                                                                                                                                                                                                 |
| 13  | **Landscape**                      | The axis rotates: PEEK becomes a 62px rail with 122px labelled slots; every deep surface becomes a 360px right drawer costing **zero** vertical budget. Add the missing `--mobile-dock-height: 48px` landscape override                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | one media-query block                                                                                                                                                                                                                                                                                            |
| 14  | **DM menu**                        | Dock cell 5 `▣ TABLE` → a **full-height right drawer**, reusing the shipped `.mobile-entities-drawer` slide + z2000, `min(360px, 92vw)`. Sticky 44px tab scroller (`pan-x`): `MAP · NPCS · PROPS · PLAYERS · SESSION`. Bodies are `MapTab` / `NPCsTab` / `PropsTab` / `PlayersTab` / `SessionTab` **verbatim**, wrapped in `.mobile-dm-body` forcing every input/select/button to `min-height:44px`, labels to 0.7rem, single-column stacking. START LIVE MAP and PUBLISH TO LIVE pin to the top of MAP. **EXIT DM MODE stays in the Party drawer settings**, where `handleToggleDM` is already wired through `MobileEntitiesList` — and `docs/user-guide/getting-started.md:98`, which today gives mobile users a literally impossible instruction, gets repointed there                                      | ~40 lines of CSS instead of five new components. Entry into map-edit at all: a DM-gated `🏗 MAP` tile in the existing play Tools sheet calling `setActiveTool("map-edit")` — requires threading `isDM` into `MobileFloatingControls`, which it does not receive today                                            |

---

## Gestures

**The complete vocabulary.** Ten entries, and every one of them has a visible twin.

| Gesture                | Surface                | Result                                                                                | Visible twin                                 |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1 finger drag          | canvas                 | the armed tool (shipped contract)                                                     | the armed tile + status strip                |
| 2 fingers              | canvas                 | pan + pinch, always, ungated (shipped)                                                | `◇ VIEW` on the play dock page               |
| 1 → 2 promotion        | canvas                 | **cancels** the in-flight tool gesture (shipped)                                      | the `✕` hot-row cell                         |
| drag ↕                | grabber / status strip | PEEK ↔ HALF ↔ FULL. >0.5px/ms snaps a whole detent, else nearest                    | `▲` EXPAND hot-row cell                      |
| swipe ↓ at PEEK        | grabber                | dismiss the sheet (dock stays)                                                        | the `✕` cell / dock TOOLS toggle             |
| swipe ◂ ▸              | **dock**               | page the dock: author (EXIT/TOOLS/UNDO/REDO/TABLE) ⇄ play (Party/Tools/Dice/Log/View) | the 2-dot pixel pager between sheet and dock |
| swipe ◂ ▸              | **footer nav**         | cycle the armed tool, grid order — what makes the PEEK hot row bearable               | the TOOL cell → grid                         |
| swipe ▸ from left 24px | L1 body                | back to L0                                                                            | `◀` in the footer nav                       |
| swipe ▴                | dock cell              | open that sheet at HALF                                                               | tapping the cell                             |
| long-press 350ms       | deck tile / layer row  | detail card / full name                                                               | the card's own `USE` button                  |

**Proof it cannot collide with the shipped contract.** Every swipe recogniser binds to `.workbench-*` or `.mobile-action-dock` — DOM elements that are **not ancestors of the Konva stage**. A touch starting on chrome never reaches the stage's `touchstart`, so `useTouchGestureRouter` never sees it: no finger count to arbitrate, no `toolGestureActive` to cancel. There are **zero canvas-interior swipes** and **zero new multi-finger gestures**. `useTouchGestureRouter.ts` and `useCamera.ts` keep their gesture semantics byte-for-byte.

**`touch-action`, stated exactly, because the intersection is absorbing and this file has already been burned once.**

```
.mobile-layout-root      pan-x pan-y   (unchanged — blocks browser pinch/double-tap zoom)
.mobile-map-surface      none          (unchanged)
.workbench               pan-y         → ∩ root = pan-y   (horizontal never claimed by the browser)
.workbench__grabber      none          → sibling of the body, NEVER its ancestor
.workbench__body         pan-y  + overscroll-behavior: contain
.workbench__chiprail     pan-x         → ∩ root = pan-x
.workbench__footer       none          (all 44px buttons)
```

The grabber and the body are **siblings**. If a future refactor ever wraps the sheet in a `touch-action:none` container, every scroller in this design dies silently with no error and no test failure. That invariant gets a comment in the CSS and an assertion in the detent unit test.

**Hidden gestures and how each is taught.** Dock paging → the 2-dot pager is always visible. Footer tool-cycling → a first-run coach mark: the footer nav grows 24px for 4 seconds on first entry and prints `◂ SWIPE TO CHANGE TOOL ▸`, persisted next to the brush pins. Two-finger cancel → the `2 FINGERS = MOVE MAP / CANCEL` chip on the first five drags. Long-press for the deck card → the card's own `★ PIN` button is the only pin path, so it gets found; a 9px `HOLD FOR DETAIL` caption sits under the first shelf until the first successful long-press. Edge-back → redundant with the visible `◀`; taught by nothing, and that is fine.

**The law:** no gesture is the sole path to any capability. Every row above has a twin, and the twin is always the thing a first-time DM finds.

**The one required change to shipped touch code, and why.** `event.evt.touches` is document-wide by design. The tool-arbitration branch — and _only_ that branch, not the camera — must count touches whose `target` is inside `stageRef.current.container()`:

```ts
const stageFingers = countTouchesInside(event.evt.touches, container);
```

Without it, a supporting thumb on 218px of resting chrome cancels every drag on a two-handed grip. With it, the shipped promotion-cancel behaviour is unchanged for fingers that actually land on the map.

---

## Slices

House style. All new files ≤330 LOC (prettier expands; the guard is 350). Continues the arc doc's numbering — M1–M3 shipped 2026-08-01.

### M4 — Stage-scoped touch counting + a real cancel — ARCHITECTURE-PROOF

**Goal:** a tool drag survives a thumb resting on the dock, and any in-flight map-edit gesture can be discarded without committing. Nothing visual ships. This is the slice that proves the whole design is buildable, because every surface below sits on chrome that will be under a thumb.

**Changes.** (1) `useTouchGestureRouter.ts` — a `countStageTouches(touches, container)` helper used by the tool branch in `onTouchStart` and `onTouchMove`; the camera path keeps the document-wide count untouched. (2) `useMapEditTool.ts` returns `cancel` (currently `clearDrag` is internal and the only external cancel is a capture-phase Escape). (3) `useTerrainBrush.ts` gains `cancelStroke()` — clears the accumulator and `strokeCells` without calling `paintTerrain`; `cancel` routes brush tools there and drag tools to `clearDrag`. (4) `useArmedTouchTool.ts` gains a `mapEdit` branch returning `{start, move, commit, cancel}` — it returns `null` for map-edit today by explicit design, and that is the blocker the whole arc exists to remove.

**Done when:** a unit test proves a synthetic touch on a chrome element does not cancel an in-flight stage stroke, and that a cancelled brush stroke never calls `paintTerrain`; then a real device pass — draw a line with the index finger while the other thumb rests on the dock.

**Traps.** The camera must keep the document-wide count; scoping it would break pinch when a finger strays onto the bezel. `cancel` on click tools must be a no-op, not a throw. Do not "fix" the ungated pinch at `useCamera.ts:176`. Re-run `apps/e2e/mobile/mobile-draw.spec.ts` — it is the only harness that observes this.

### M5 — Map-edit reachable + the Workbench shell + Room and Wall end to end

**Goal:** a DM on a phone taps MAP, binds the live map, drags a room and a wall, and a second browser sees fog respect the wall.

**Changes.** DM-gated `🏗 MAP` tile in `MobileFloatingControls` (thread `isDM`). Forward the 17 `mapEdit*` props + controller in `MobileLayout` (all already computed in `layoutProps` and discarded today) — **as a sibling `<MobileAuthoring>` mount, not inline**: MobileLayout is at 331/350. NEW `layouts/mobile/Workbench.tsx` (~230) — grabber, status strip, hot row, body slot, sticky footer nav. NEW `layouts/mobile/workbenchDetents.ts` (~90) — **pure detent math and gesture classification, unit-tested**, because gesture code is where this dies. CSS: the `--sheet-max` block, the sibling `touch-action` set, the `<350px` breakpoint, the landscape `--mobile-dock-height: 48px`. Two tools only: ROOM and WALL.

**Done when:** manual on a phone — MAP → START LIVE MAP → drag a room → drag a wall → player sees it. The status strip reads the armed tool. The sheet drops to PEEK on arm.

**Traps.** The controller **no-ops silently** without the live-bound active document (`useMapEditTool:189`) — the status strip goes `--jrpg-danger` and the hot row disables when `activeDocument.id !== liveMapDocumentId`. `MapBoard.tsx:439` kills token interaction in map-edit, so the mobile selection sheet becomes unreachable — verify a DM cannot get stranded. Do not statically import the authoring subtree from an entry-reachable file; `build:check` enforces the bundle budget. Add every new prop to **all four** layout characterization fixtures.

### M6 — The full grid, the rest of the drag tools, the cancel ladder, the dock pager

15-tile L0 grid; Hall / Door / Spline / Row on the same rails; the tool-option L1 panels (hallway width, spline kind, wall family, room ring) reflowed from `MapEditToolPanels`; the `✕` priority ladder; the paging dock + 2-dot pager; footer-nav tool cycling + its coach mark; the `2 FINGERS = CANCEL` first-run chip.

**Done when:** all seven drag tools commit from a finger; two fingers mid-drag leaves no stray geometry; UNDO is one tap from every state.

**Trap.** `commitDragTool` re-checks the live binding and `controller.saving` — a drag during a save silently does nothing; surface that in the strip rather than letting it read as a dead tool.

### M7 — Paint / Erase + the brush deck + TASTE

The deck as an L1 screen: real `BRUSH_GROUP_ORDER` chip rail, 4×77px tiles, bottom-anchored search, 350ms long-press detail card with `★ PIN`. TASTE feeds a synthetic 3×3 `TerrainPaintCell[]` at the reticle into the existing `strokeCells` prop.

**Traps.** Keep the `brushDeck.ts` localStorage keys. Keep the search field's `stopPropagation` + Escape-clears-query guard — a tablet with a keyboard would otherwise let Ctrl+Z hit the live map. The chip rail is the _primary_ path; typing is the fallback, never the requirement.

### M8 — Place / Scatter / Light: the reticle, TILE⇄STAMP, rotation, PICK

NEW `useReticleAnchor.ts` (~110) — "centre of the visible Window", re-centring with a 150ms ease on every detent/orientation/drawer change. `freeStamp` into `useMapEditPlacement`. The rotation row + snap pad. PICK as tile 14 with tool-restore. The ACTION cell and `⚡ RAPID`.

**Traps.** Click tools commit inside `onMouseDown` — the touch path must **not** route them there, or a two-finger promotion drops a prop that `cancel()` has nothing to retract. Commit moves to the ACTION cell (and, under RAPID only, to an explicit tap). A tap synthesises compatibility mouse events; a drag does not — RAPID needs the same degenerate-guard reasoning `useDrawingTool` already carries.

### M9 — Generate + the Populate Anvil

`⤢ FIT` and the COLS/ROWS steppers **first**; the two-corner tap-aim second. Live legality in the strip from `regionProblem`. Then the Anvil: the surviving dashed region, live `previewGhosts`, the category/density chips, the hatched disabled `FILL` tile.

**Trap.** `regionProblem` and the two constants are module-private today; export them rather than duplicating the numbers — the comment says the server mirrors them and they must stay in step.

### M10 — Select + Inspector + Layers

The stepper primitive (`StepperRow.tsx`, ~120, reused by the inspector, grid size, and hallway width), the two-tab inspector, the layer accordion, the list-overlay layer picker, two-stage DELETE. Generalise the range-slider CSS off `.mobile-drawing-sheet__control` — **do not duplicate the separate-vendor-rule fix**.

### M11 — The DM drawer

The right drawer, the five verbatim tab bodies, `.mobile-dm-body`, publish/start-live pinned. Repoint `docs/user-guide/getting-started.md:98`.

### M12 — Landscape, polish, haptics

The drawer variant of every L1 screen, the 62px rail, haptics gated on `[data-motion="off"]` (motion sensitivity and haptic sensitivity travel together), stepped `140ms steps(4)` detent motion, chamfered corner brackets instead of border-radius, the SNES commit sample.

**M4 is the architecture-proof slice.** It is small, it is entirely in shipped code, it is unit-testable, and if it does not hold on a real iPhone then no shell in this document works — which is exactly what an architecture-proof slice is for.

---

## Risks and open questions

**Risk 1 — M4 edits iPhone-verified code, and the harness can only partly observe it.** Scoping the tool-arbitration touch count to the stage container changes a deliberate behaviour whose comment explains why it is document-wide. If I get it wrong in one direction, a resting thumb cancels every drag; in the other, a stray finger on the bezel commits a truncated stroke. Playwright + CDP can dispatch trusted multi-touch, but it cannot reproduce a hand's actual contact geometry. **This must be device-verified before M5 starts**, and M4 ships as its own commit so it can be reverted alone.

**Risk 2 — one finger means two things depending on the armed tool.** For room/wall/hall/spline/row/gen it is a destructive drag; for place/scatter/light it is a reticle nudge that commits nothing. That is defensible — "the armed tool always owns the finger" is the shipped contract, and the reticle plus the status strip both name the state loudly — but a DM switching from PLACE to WALL with muscle memory will draw a wall. It is the price of the placement model and there is no version of this that does not pay it.

**Risk 3 — TASTE may not be enough at FULL.** 264px of map while browsing 40+ brush families is the weakest moment in the design. TASTE (a real-chip 3×3 patch at the reticle) is the mitigation and it is genuinely free — it rides the existing `strokeCells` preview path — but a 3×3 patch at typical phone zoom may be too small to judge a family by. If it is, the fallback is that the deck opens at HALF instead of FULL (394px of map, 198px of body, 1.5 shelves visible) and you scroll more. Measurable on the first device pass; do not pre-optimise it.

**Owner decisions — three, and only you can make them.**

1. **Does a canvas tap commit, or only aim?** I have chosen **aim only**, with `⚡ RAPID` as an opt-in per tool, because tap-to-commit inherits the compat-mouse-event doubling _and_ the promotion hazard, and because a crosshair that says "I am the cursor" next to a tap that commits somewhere else is a mode-confusion generator. The cost is two taps per prop for bulk work. If you would rather have one tap and eat the mis-drops, say so before M8 — it changes the ACTION cell's whole meaning.

2. **Is phone parity really the bar for NPC/prop CRUD, the alignment wizard, and JSON import/export, or is tablet-and-up acceptable?** M11 gives all five DM tabs a _home_ at 44px minimums, which is a real improvement over having none — but "reachable in a 338px drawer" is not the same as "designed for a thumb." I have scoped M11 as reachability, not redesign. Tell me if the wizard in particular needs a real pass.

3. **Should the dock page, or should authoring exit to play?** I have it paging (author ⇄ play, one swipe, 8px of pager), so a DM can roll dice mid-build. It costs 8px of permanent vertical and one more learned swipe. The alternative is that EXIT is the only route back to Party/Dice/Log, which is one tap but loses your place in the sheet stack.

**Files this was grounded in:** `D:\HeroByte\apps\client\src\hooks\useTouchGestureRouter.ts`, `useArmedTouchTool.ts`, `useCamera.ts`; `D:\HeroByte\apps\client\src\layouts\MobileLayout.tsx` (331/350), `MobileDrawingControls.tsx`, `props\MainLayoutProps.ts:114-149`; `D:\HeroByte\apps\client\src\components\layout\MobileFloatingControls.tsx`; `D:\HeroByte\apps\client\src\features\map-edit\useMapEditTool.ts` (346/350), `useMapEditPlacement.ts`, `useMapEditSelection.ts`, `useMapEditState.ts`, `usePopulate.ts`, `useGenerate.ts`, `mapEditToolKinds.ts`, `brushDeck.ts`, `MapEditPreviewLayer.tsx`, `MapEditToolbar.tsx`, `MapEditInspectorPopover.tsx`, `MapEditLayersPopover.tsx`; `D:\HeroByte\apps\client\src\features\map-studio\components\useTerrainBrush.ts`; `D:\HeroByte\packages\shared\src\mapStudioTypes.ts:215-222`, `mapStudio.ts:205-209`; `D:\HeroByte\apps\client\src\theme\herobyte.css:1193-1575`; `D:\HeroByte\docs\planning\mobile-authoring-arc.md`.
