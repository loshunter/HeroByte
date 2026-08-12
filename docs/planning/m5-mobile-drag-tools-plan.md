# M5 — the rest of the drag tools on the phone — slice plan

> **SHIPPED to `dev` 2026-08-12 — eleven commits, `a8639d8a..39fd5ac0`, each behind the full §2
> gate. NOT merged to `main`, so not deployed.** Baselines moved: client 263 files / 5249 → **266 /
> 5276** (+4 skipped unchanged), e2e 129 → **132 passed / 0 failed / 3 skipped**; shared (424/24) and
> server (2108/110) untouched.
>
> **The bundle bet paid, measured the same way both times (`gzip -9` on the real dist).** Entry
> 102,153 → 104,711 bytes = **+2.50 KB**, against an estimate of 3.5–4 KB and a flip trigger of 8 KB.
> The desktop `MapEditToolbar` chunk is **still split** at 7,442 bytes — writing touch-sized panels
> instead of reusing desktop ones kept DM-only UI out of every player's first load, and avoided the
> Rollup hazard where a static import from an entry-reachable file hoists a chunk and silently
> deletes an existing split. `build:check`: 102.67 KB of a 175 KB budget, 58.7% used.
>
> **Three things below turned out to be WRONG. Sabotage and the gate caught each; reading did not.**
>
> 1. **§4's sabotage for commit 9 is false for a REGION tool.** "Change `touchDrag`'s waypoint to
>    equal its start — every leg goes red at the positive control" left the hall leg GREEN.
>    `roomBoundsFromDrag` is inclusive and floors at one cell, so a tap on Room or Hall legitimately
>    commits a minimum unit with walls — the same designed behaviour four review lenses mis-filed as
>    a bug in M4c. The zero-before assertion proves the CHAIN is alive, not that the drag had the
>    shape intended. What actually reds that spec is setting `mapEditDragMode` to `false`. Anything
>    later that wants to pin drag GEOMETRY must measure extent, not existence.
> 2. **Commit 5 could not carry the open/close rule the ladder gave it.** The plan had "dial-bearing
>    tools keep the sheet open" landing before any dials existed, which makes Room-stays-open-but-
>    Wall-closes look arbitrary. It moved to commit 6, beside the dials that motivate it.
> 3. **Commit 6 broke an e2e that every unit suite was structurally unable to see.**
>    `mobile-map-edit.spec.ts` asserted the sheet was hidden after tapping Room — the contract that
>    commit deliberately replaced. Unit tests render the sheet in isolation, so only the full gate
>    could catch it. The spec now encodes BOTH halves of the rule, which is stronger than the single
>    direction it had.
>
> **Two coverage holes found while gating, both now closed.** The sibling
> "palette fits a 375x812 phone" spec never binds a live document, so it measures the dock and the
> one-button pre-bind sheet and would pass however badly the real grid fitted — commit 10 is the spec
> that opens it. And **POPULATE had no e2e at all**, on either layout, which meant commit 2 changed
> its enabled state with nothing to catch a regression; commit 9 closes that.
>
> **Follow-ups, none of them defects:** `useMapEditState.ts` spent its last legal line in commit 1
> and is now 349 against a guard that flags at 350 — anything further there needs an extraction
> first. The deferrals in §6 stand (phone asset upload, the walls-overlay pin, Layers/Inspector, and
> a real touch brush deck). The mobile party drawer still resolves one row per PLAYER to that
> player's FIRST character (`MobileEntitiesList.tsx:67`), which is adjacent to this arc and still
> unclaimed. Owner question Q4 (an in-app "use the desktop layout" switch) remains open and did not
> block anything here.

Owner chose M5 on 2026-08-12, after the vision-default slice. Every path, line number and measurement
below was verified against `dev` = `b9af0a15` on 2026-08-12 by reading the files and by measuring the
real `dist/` the gate had just built — not from memory and not from the arc doc. Where something is a
judgement call rather than a fact, it says so.

Read `docs/planning/HANDOFF-NEXT.md` §2/§5/§7/§8 first if you have not: the gate, the traps and the
owner's method all apply here and are not repeated in full.

## 0. The finding that reshapes this slice

**M4c armed the entire drag class, not just Room and Wall.**

```
mapEditToolKinds.ts:8-16   DRAG_TOOLS = ["wall","door","room","hallway","generate","row","spline"]
MapBoard.tsx:459           mapEditDragMode = mapEditMode && isDragTool(mapEditActiveSubTool)
useArmedTouchTool.ts:91    arms the touch path off mapEditDragMode alone
```

All five of M5's tools are **already reachable by finger**. `rowDrafts.test.ts:90` even pins
`isDragTool("row") === true`. And the complete `MapEditToolbarProps` bag already reaches the phone at
`MobileLayout.tsx:222` — `splineKind`, `generateParams`, `hallwayWidth`, `roomWallFamily`,
`selectedAssetId`, `canPopulate` and every matching callback.

**So M5 is a UI + bundle-placement slice, not an input-path slice.** Nothing in the touch routing
changes. That removes the category of work where M4c found three of its four defects.

What is actually missing: `MobileMapEditPalette.tsx` (199 lines) offers a 3-button grid — Room, Wall,
Recenter — and its `selectSubTool` is hard-typed `(tool: "room" | "wall")` at line 46. There are no
sub-panels on mobile at all, so mobile Room and Hall silently use whatever default state holds.

## 1. The bundle question, answered with measurements

Measured from the real `dist/` (built by the gate at `b9af0a15`):

| chunk                                  |     raw |       gzip |
| -------------------------------------- | ------: | ---------: |
| `index-*.js` (entry)                   | 345,482 |    99.8 KB |
| `MapEditToolbar-*.js`                  |  23,114 |     7.2 KB |
| `MapBoard-*.js`                        | 111,066 |    36.1 KB |
| threshold (`check-bundle-size.mjs:32`) |         | **175 KB** |

Two facts settle the design, and both are counter-intuitive:

1. **The tile catalog is ALREADY in the entry chunk.** `grep -c 'Unknown Tile'` returns 1 for
   `index-*.js` and 0 for both the MapEditToolbar and MapBoard chunks. The path is
   `App.tsx` (static `MobileLayout`) → the map-edit glue → `useMapEditState` → `usePopulate` →
   `MAP_STUDIO_TILE_ASSETS`. So `WALL_FAMILIES`, `PAINT_FAMILIES` and `getMapStudioTileAsset` cost
   this slice **nothing marginal**. Mobile panels may use the choice data freely.
2. **The 7.2 KB in the toolbar chunk is pure desktop UI** — `MapEditBrushDeck`'s hover card, search
   and right-click-to-pin, the asset picker, the swatch grid, `GeneratePanel`, the popovers. Two of
   the brush deck's three interactions do not exist on a finger, and its buttons are `fontSize: 8px`
   at roughly 20px tall.

**Therefore writing touch-sized panels is bundle-CHEAPER than reusing the desktop ones**, not more
expensive: reuse would pull 7.2 KB into the entry _and_ ship sub-44px controls to a phone. Estimated
cost of the mobile panels: **+3.5–4 KB gzip**, entry ~99.8 → ~104 KB against a 175 KB ceiling.

**No new lazy boundary, deliberately.** Map-edit mode disables one-finger pan, makes tokens
non-interactive, and has no Escape on a phone — the dock is the only way out. A lazy boundary there
is a new way for a DM to be trapped, and this repo has already shipped a dead "Try again" at exactly
this seam. 3.6 KB out of 75 KB of headroom does not buy a new failure axis in the mode with the worst
failure consequence.

**Flip trigger, stated in advance so it is not rationalised later:** if `build:check` shows the entry
grew by more than **8 KB gzip**, `features/map-edit/mobile/` goes behind a lazy boundary _inside the
sheet_ — never around the dock — with a reload-only fallback modelled on `DMMenuLoadFailure.tsx`,
never a retry.

## 2. The UI model

**The dock is unchanged and stays at five slots:** `[✕ Exit][⚒ Tool][↶ Undo][↷ Redo][⨯ Abort]`.
Nothing in M5 wants a sixth. Labels stay ≤5 characters.

**The sheet grows a second level.**

Level 1 — the tool grid, 8 tiles:
`🏠 Room · 🚇 Hall · ▬ Wall · 🚪 Door · 📏 Row · 〰️ Spline · 🏰 Gen · ◇ Recenter`

The tile set is **derived from `DRAG_TOOLS`**, not hand-listed, so a tool added to the drag machine
cannot be silently absent from the phone — and the phone can never offer a tool the touch path
refuses to arm (constraint 7 becomes true by construction rather than by a test remembering).

Level 2 — the armed tool's dials, below the grid in the same sheet.

**The one behavioural change:** a tool with no dials (Wall, Door) arms and closes the sheet, as
today. A tool with dials (Room, Hall, Row, Spline, Gen) arms and _keeps the sheet open_, revealing
its dials plus a wide `▶ To the map` that closes it. Tap counts are identical (4 either way), but the
dial-bearing version never requires the DM to know they must reopen the sheet.

The primary reads **`▶ To the map`, not `▶ Use Room`** — `mobile-map-edit.spec.ts:145,176` use
unscoped `getByRole("button", { name: /Room/ })`, and a second button containing "Room" is an instant
strict-mode violation. Those two locators get scoped to `.mobile-tool-sheet__grid` before the panels
can collide with them.

The panels:

| tool   | dials                                                                       |
| ------ | --------------------------------------------------------------------------- |
| Room   | `Wall ring:` + `Floor:` (shelf-grouped, see below)                          |
| Hall   | `Width:` [1–4] + `Side walls:` + `Floor:`                                   |
| Row    | `Asset:` a 6-tile strip over the bundled `objects:*`; no upload, no search  |
| Spline | `Curve:` [Rope\|Chain\|Ribbon\|Filigree]                                    |
| Gen    | region readout, theme, density, seed + ⟳, GENERATE, and the disabled reason |

**The `Floor:` picker is shelf-grouped, not a flat row.** There are **38** `terrain:` assets in the
catalog (counted). A flat grid at the 44px touch floor is ~13 rows ≈ 570px — unusable in a landscape
sheet capped near 240px. So: material shelf chips first, then only that shelf's swatches, over
`buildBrushDeckGroups()` (pure data, already written). This is the one place the design departs from
the desktop shape rather than shrinking it.

**Populate's adjacency**, which the arc doc flags as invisible in a sheet UI, is **already two-thirds
solved and nobody noticed**: `usePopulate.ts:99-116` builds `previewGhosts` — the exact drafts the
button would commit — and `MobileLayout.tsx:169` already forwards them to MapBoard. A phone DM who
drags a room already sees translucent footprints, and they re-render live when density changes. What
is missing is the _sentence_, not the affordance. M5 adds a three-state message:

```
saving      -> "Saving…"
canPopulate -> "Fills the room you just drew."  + category + density + ✨ POPULATE
otherwise   -> "Draw a room or hallway first — Populate fills the last one you placed."
```

The three-way split is load-bearing, not decoration: `canPopulate = Boolean(lastPlacedBounds) &&
!controller.saving`, so a two-state message tells a DM to draw a room they drew 300 ms ago.

## 3. Three bugs found while reading, each getting its own commit

Per the owner's standing rule, a bug found mid-arc is fixed in its own commit rather than deferred.
All three are **pre-existing and desktop-affecting**, not introduced by M5.

1. **GENERATE never says why it is disabled.** `useGenerate.ts` computes `regionProblem(bounds)` twice
   and discards it both times. `canGenerate` goes false for four distinct reasons (no region / under
   20 cells a side / over 16384 cells / saving) with nothing on screen explaining any of them.
2. **POPULATE stays armed over a room that was undone.** `previewGhosts` checks
   `regionHasFloor(activeDocument, lastPlacedBounds)` (`usePopulate.ts:101`), but
   `canPopulate` (`:118`) does **not**. After an undo the ghosts vanish while the button stays live,
   so M5's "Fills the room you just drew" would render over a room that no longer exists.
3. **A failed map-edit chunk takes the whole table with it.** `TopPanelLayout.tsx:34` is a
   `React.lazy` and `:162-181` is a bare `<Suspense>` with **no ErrorBoundary anywhere in the file**.
   A hashed-chunk 404 after a deploy — the realistic trigger `DMMenuLoadFailure.tsx` documents —
   throws to the app root and replaces a live shared table with a full-page error. M4c fixed exactly
   this for the mobile DM chunk and left the desktop one unguarded.

## 4. The commit ladder

Each commit passes the full §2 gate independently.

| #   | commit                                                                  | why it is here                            |
| --- | ----------------------------------------------------------------------- | ----------------------------------------- |
| 1   | `fix(map-edit): GENERATE says why it is disabled`                       | bug 1; adds REQUIRED `generateHint`       |
| 2   | `fix(map-edit): POPULATE stayed armed over a room that was undone`      | bug 2                                     |
| 3   | `fix(map-edit): a failed tool chunk no longer takes the table with it`  | bug 3                                     |
| 4   | `refactor(mobile): split the palette into dock and sheet`               | extraction BEFORE addition; bisect anchor |
| 5   | `feat(mobile): the remaining drag tools reach the phone's tool grid`    | the 8-tile derived grid                   |
| 6   | `feat(mobile): touch-sized sub-panels for Room, Hall, Row and Spline`   | + the shelf-grouped floor picker          |
| 7   | `feat(mobile): the Generate panel, carrying the reason it is disabled`  | consumes commit 1                         |
| 8   | `feat(mobile): Populate on the phone, with its adjacency said out loud` | consumes commit 2                         |
| 9   | `test(e2e): the phone authors a hall, a door and a spline`              | drives the chain by finger                |
| 10  | `test(e2e): the tallest sheet this shell has ever had fits`             | both orientations                         |

`generateHint` is **REQUIRED, not optional**, and so is every new forwarding prop in this slice. An
optional field can be deleted with zero typecheck errors and every suite green — the defect shape
that shipped in M4b and twice more in the vision slice. Expect TS2741 fixture ripple on commit 1; use
the `fix-fixture-ripple` skill rather than hand-editing.

## 5. Traps this slice must respect

1. **348 is the real LOC ceiling** and the exemption is the filename pattern `/\.test\./`, **not** the
   `__tests__` directory. e2e specs are not exempt. `MobileMapEditPalette.tsx` is at 199 and cannot
   absorb 5 tools + 5 panels + Populate — hence commit 4 goes first. Re-run
   `lint:structure:enforce` _after_ prettier, which expands files.
2. **The CSS test anchors on block ORDER.** `MobileFloatingControls.test.tsx:240` runs
   `/\.mobile-tool-sheet,\r?\n[\s\S]*?\.mobile-help-sheet\s*\{([^}]*)\}/` against the raw
   `herobyte.css` text. Appending a selector into that comma list, or inserting any `.mobile-*-sheet`
   block between the two, silently changes what the non-greedy capture returns and reds a describe
   block that has nothing to do with the change. New classes go **outside** that region.
3. **A second finger gets no compat click.** Any control usable mid-gesture binds `pointerdown`.
   Note that nothing enforces "the sheet is closed during a drag" — `mapEditDragMode` does not
   consider sheet state, and the sheet is capped so the top of the canvas stays exposed.
4. **The controller no-ops silently** without an active live document — every tool stays disabled
   until `isLive`.
5. **A test whose drag never moves cannot fail** (M4c). Every e2e leg opens with a positive control
   reading zero, so "nothing appeared" cannot be satisfied by a build where dragging never worked.
6. **`mobile-shell.spec.ts` is at 345** and `mobile-map-edit.spec.ts` at 254 — new e2e specs go in
   new files.
7. **Row places `objects:crate` forever** without an asset control (`useMapEditState.ts:82`).

## 6. Scope calls

**Ships:** all five tools, Populate (fully plumbed already — deferring leaves working code
unreachable), and a reduced 6-tile Row asset strip.

**Deferred, with reasons rather than silence:**

- **Asset upload from the phone** — needs a file-input affordance and quota UX; no consumer in this
  slice besides Row's strip, which works without it.
- **The walls-overlay pin** — would need a 9th tile; the overlay is always on while editing anyway.
- **Layers and Inspector popovers** — both are driven by the Select sub-tool, which is a CLICK tool
  and barred from the armed touch set by constraint 7. Shipping them without a way to select an
  element would be a panel that can only ever say "Pick the Select tool".
- **The brush deck proper** — 325 lines of hover card, search, right-click pinning and live-baked
  thumbnails; two of its three interactions do not exist on touch. A real mobile brush browser is its
  own slice. Room and Hall get the shelf-grouped swatch picker instead.

## 7. Provenance

Four independent designs were generated and scored by three judging lenses (7 agents,
`agents_error: 0`). "Two-level sheet, whole-bag props, zero new lazy boundaries" won 9 / 9 / 7.
Grafted in from the losing proposals: the shelf-grouped floor picker, the `TopPanelLayout`
ErrorBoundary, and the CSS-ordering trap above.

**One commit the panel proposed was dropped after verification.** It wanted a new `liveDoc` e2e seam
through `MapBoard` / `useE2ETestingSupport` / `e2e.d.ts`, on the grounds that `CompiledScene` carries
only walls, doors and lights so Row, Spline and Populate would have no observable. `CompiledScene` is
indeed limited that way — but `RoomSnapshot.mapElements` (`index.ts:548`, "sent to ALL recipients")
carries `layers[].elements`, and `window.__HERO_BYTE_E2E__.snapshot` already exposes the whole
snapshot. The observable exists today; the seam was unnecessary.
