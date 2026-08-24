# Prompt — element select + delete reaches the phone

You are closing the last hard gap in the mobile authoring port: an element authored on a phone
(Row, Spline, anything) can be created there but never removed there. The user guide warns about
it (`docs/user-guide/map-editor-guide.md:161`). You are also making a batch of planning-doc
corrections first, so the handoff stops describing finished work as outstanding.

Everything below was verified on 2026-08-24 at `dev` = `ac47ab9e` — by a five-agent read-only
recon plus orchestrator spot-checks, reading the files, not assuming. Line numbers are from that
commit. If a path here is wrong, trust the file and say so.

**The owner made the affordance decision on 2026-08-24** (it was reserved in HANDOFF-NEXT.md §10):
**a Select mode in the map-edit tool sheet now; long-press is a recorded deferral**, to be unified
later with the quick wheel's already-deferred touch variant (`MapEditQuickWheel.tsx:9` — "Desktop
right-click only; the long-press touch variant is a recorded deferral"). Do not build any
long-press machinery in this slice.

---

## 0. Orient (do this first)

```bash
git log --oneline -3                          # expect ac47ab9e at the tip (or later — then re-verify §1's line numbers)
git status --porcelain | grep -v 'temp/'      # expect empty. Unanchored 'temp/', NOT '^?? temp/' — three of the
                                              # owner's untracked temp files have spaces and git quotes them.
```

Then read, in this order, before writing anything:

1. `apps/client/src/features/map-edit/mobile/mobileToolTiles.ts` (whole file, 46 lines) — the
   header comment explains why tiles are a `Record<DragTool, …>`. You will NOT touch this file.
2. `apps/client/src/hooks/useStageEventRouter.ts:213-227` — the unconditional mousedown fan-out.
   This is the load-bearing fact of the whole slice (§1.1).
3. `apps/client/src/features/map-edit/MapEditToolPanels.tsx:185-201` — the desktop inspector
   mount you are porting the _delete half_ of.
4. HANDOFF-NEXT.md §2 (the gate) and §8 (method) — not optional.

---

## 1. What is already built, and why this slice is small

The handoff feared this feature because the dock is pinned at five slots. The recon dissolved
that: the affordance never needed a dock slot. Three verified facts:

### 1.1 Tap-to-select already works — the UI just can't arm it

A finger tap (unlike a drag) makes the browser synthesize compat mouse events. Konva delivers
that mousedown to `useStageEventRouter`'s `onMouseDown` (`useStageEventRouter.ts:213-227`), which
calls `handleCameraMouseDown`, `handleDrawMouseDown`, `handleMapEditMouseDown`, and
`handleMarqueePointerDown` **unconditionally** — each self-gates on its own mode flag.
`handleMapEditMouseDown` is `useMapEditTool.onMouseDown` (`useMapEditTool.ts:188-222`), gated by
`active = mapEditMode && (isDrag || isBrush || isClick || isSelect)` (`:137`) — **not** by
`mapEditDragMode`. Its select branch (`:197-202`) calls
`selection.handleClick(point, activeSubTool)` → `useMapEditSelection.handleClick`
(`useMapEditSelection.ts:76-79`) → `selectElementAtPoint(document, layers, point)`
(`elementHitTest.ts:30-50`) → `onSelectElement(element?.id ?? null)`.

So the moment `activeSubTool` can be set to `"select"` from the phone UI, tapping an element
selects it, through machinery that already exists. Nothing in `MapBoard.tsx`'s `mapEditDragMode`
gate (`MapBoard.tsx:461`), `useArmedTouchTool.ts`, or `useTouchGestureRouter.ts` changes.

Why select is safe where place/scatter were not: a tap fires BOTH the native-touch path and the
compat-mouse path, which is why the click tools (two stamps per tap) were excluded from mobile in
M4c. But for `"select"` the native-touch path is inert (`useArmedTouchTool.ts:91-102` arms only
when `mapEditDragMode`, which is false for select), so select fires exactly once, via compat
mouse, and re-selecting the same element is idempotent anyway.

Two adjacent worries, both settled: (a) **no ping fires** — `onStageClick` bails with
`if (mapEditMode) return;` (`useStageEventRouter.ts:196`) before the pointer/ping branch;
(b) **a tap pans nothing** — the camera path needs movement.

### 1.2 Selection state and delete are already plumbed to the sheet

- Selection state: `selectedElementId: string | null` (single id, never an array) at
  `useMapEditState.ts:106`; `selectedElement` is **re-derived live from the document**
  (`useMapEditState.ts:271-274`), so a deleted element's selection clears to `null` by itself.
- The `MapEditToolbarProps` bag already carries `selectedElement: MapElement | null`
  (`mapEditTypes.ts:135`) and `onRemoveElement: (elementId: string) => void`
  (`mapEditTypes.ts:140`), sourced from `useMapEditState.ts:324` →
  `useMapStudioActions.ts:148-150`, which submits `{ type: "remove-element", elementId }` with
  `commandId`/`documentId`/`baseRevision` stamped on.
- The mobile components forward the **whole bag** deliberately (`MobileMapEditSheet.tsx:118`
  spreads `{...toolbar}`; rationale comments at `MobileMapEditSheet.tsx:15-17`). **Zero new prop
  plumbing** through App/MobileFloatingControls/Palette is needed.

### 1.3 The server side is finished and you will not touch it

For your knowledge only — `remove-element` (`packages/shared/src/mapStudioCommands.ts:55`,
Zod mirror `mapStudioValidators.ts:125`) is DM-gated (`MapStudioMessageHandler.ts:50`), handled
generically for **all 8 element kinds** (`tile stamp shape wall door light text spline` —
`mapStudioTypes.ts:115-124`, no per-kind branches in `removeMapElement`,
`mapStudioElements.ts:143-153`), guarded by element-lock + layer-lock + revision-conflict checks,
pushed onto the **server-side** undo stack (`domains/mapStudio/service.ts` ~152-156), and a
deleted door's runtime open/closed state is implicitly dropped on recompile
(`scenePublish.ts:37-64` maps over `next.doors` only). Errors come back as a `map-studio-error`
toast to the sender.

**This slice is client + tests + docs only. If you find yourself editing `apps/server` or
`packages/shared`, stop and re-read this section.**

### 1.4 The sheet mechanics you will extend

- `PANEL_TOOLS: ReadonlySet<DragTool>` (`MobileMapEditToolPanels.tsx:28-34`) decides which armed
  tools keep the sheet open with a panel; `MobileMapEditSheet.tsx:49` closes the sheet for tools
  not in it, and `:52` computes `panelsOpen = isLive && PANEL_TOOLS.has(activeSubTool as DragTool)`
  — note the cast, it's one of the things you widen.
- Panel pick: top-level switch at `MobileMapEditToolPanels.tsx:66-71`, then `ToolDials` (`:73-131`).
- A new bottom-sheet panel inherits the sheet contract CSS for free (herobyte.css:1362-1420,
  selector list at :1383-1386) because it renders _inside_ the existing sheet.
- Desktop analog to copy: `MapEditToolPanels.tsx:185-201` mounts `MapEditInspectorPopover` when
  `inspectorOpen && selectedElement`; its DELETE button (`MapEditInspectorPopover.tsx:121-127`)
  calls `onRemove(element.id)` — pinned by
  `__tests__/MapEditInspectorPopover.test.tsx:72-86` ("DELETE removes the element").

### 1.5 The e2e harness already has the gesture you need

`apps/e2e/mobile/touch.helpers.ts` — `touchTap(cdp, at)` at `:83` (CDP-backed, `isTrusted`
true). It exists and **no map-edit spec has ever used it**; yours is the first. `touchDrag`
(`:61`) authors the element you'll delete. The dev seam `window.__HERO_BYTE_E2E__` exposes
snapshot state.

**Two things this section originally got wrong, both found by writing the spec** — recorded
because they cost three red e2e runs:

1. **A wall is not selectable — on ANY platform.** `selectElementAtPoint`
   (`elementHitTest.ts:30-50`) resolves **tiles, stamps and shapes only**; its own doc comment
   says so, and `elementSelectionRect` returns "null for wall/door/light". Walls, doors, lights,
   text and **splines** cannot be picked by desktop Select either. A Room is no good as a target
   either: its floor is TERRAIN (`placeRoom` takes `cells` separately) and its wall elements are
   filtered out of the `mapElements` projection. **Author with Row** — it lays `stamp` elements,
   which are selectable — or Populate.
2. **Aim the element's CENTRE, read from the document.** `transform.x/y` is the top-LEFT and the
   hit test is an inclusive bounds check, so tapping the transform origin sits on the boundary
   and misses. Read the element out of `snapshot.mapElements.layers` and add half its width and
   height; Row's jitter means the drag midpoint is not where a stamp is.

---

## 2. The commits

Each in its own commit, full §4 gate before every one, sabotage ritual per §8 of the handoff.

### Commit 0 — docs: the handoff stops describing finished work as outstanding

Mechanical edits, exact anchors below. All in `docs/planning/` unless said otherwise.

1. **HANDOFF-NEXT.md lines 15-18** — replace the state table rows (the `dev` row's
   "byte-identical to `main`" is now false):

   ```
   | `dev`  | `ac47ab9e` | pushed, CI **#808** green — carries the initiative slice, 12 commits past `main`'s tree |
   | `main` | `a78dd0e7` | **PRODUCTION**, deployed 2026-08-18, CI **#798** green, probe-verified    |
   ```

   Directly under the table add a dated paragraph:

   > **Update (2026-08-24).** The initiative slice (server-side rolls on the crypto RNG, the roll
   > log naming the character, manual override with strikethrough, DM toggle on by default — §3D's
   > owner-chosen design) is **COMPLETE on `dev`** at `ac47ab9e`, CI **#808** green including the
   > full e2e job. NOT merged to `main`; that is the owner's call and deploys. The adversarial
   > review's hidden-NPC roll-log leak was fixed on both log writers (`d4dfda6e`). Open for the
   > owner: the `recordManual` judgement call, PROMPT-initiative-client.md §5.

2. **HANDOFF-NEXT.md §3D, lines ~497-499** — the bullet opening
   "**Client-side `Math.random()` initiative rolls** remain in `hooks/useBulkInitiativeRoll.ts:76`
   and `features/initiative/components/InitiativeModal.tsx:63`." Strike the opening sentence and
   insert after it: **DONE 2026-08-24** (`dev` `ac47ab9e`, CI #808) — neither `Math.random()`
   remains (the DoD grep was run); keep the design paragraphs below it for the record.

3. **HANDOFF-NEXT.md §3D, lines 522-524** — the `drag-preview` bullet. Strike it in the sibling
   style of the line-526 asset-store bullet:
   `- ~~\`drag-preview\` is queued rather than dropped while the socket is down~~ — **DONE
   2026-08-12** (\`ba48e741\`); it sits beside \`measure\` in \`ephemeralTypes\` at
   \`MessageQueueManager.ts:119\`. This bullet just was never updated.`

4. **HANDOFF-NEXT.md §10, lines 862-864** — the "Initiative → server-side + roll log + manual
   override" bullet: strike, annotate **DONE — see the §0 update (2026-08-24)**.

5. **HANDOFF-NEXT.md §10, lines 876-878** — the "prove the `ref: dev` fix" item. Replace its tail
   with the corrected fact: run **#808** could NOT prove it either — the push was TO `dev`, so the
   old hardcoded `ref: dev` and the new event-ref default resolve to the same SHA. The
   discriminating case is the next push to **`main`** (the initiative merge): read the full-suite
   job's "Checkout repository" step on that run.

6. **HANDOFF-NEXT.md §10, lines ~866-874** — the "Mobile element removal (M6)" bullet. Three
   corrections: (a) the label — the arc doc's M6 is Paint/Erase (`mobile-authoring-arc.md:579`);
   this work is the Select half of **M8** (`:594`); (b) the design decision is now **MADE**
   (owner, 2026-08-24): Select mode in the tool sheet now, long-press deferred to the quick-wheel
   unification; (c) the "dock is pinned at five slots" blocker dissolved — the affordance lives in
   the sheet. Point the bullet at this file.

7. **PROMPT-initiative-client.md** — insert after line 8 (before the `---`):

   > **DONE 2026-08-24.** All three commits landed, plus the review's fixes (hidden-NPC log leak
   > `d4dfda6e`, modifier bound `ac47ab9e`, vacuous sanitization test `b30fffd8`). Slice complete
   > on `dev` at `ac47ab9e`, CI #808 green. Still open for the owner: the §5 `recordManual`
   > judgement call. Kept for the record — do not execute.

8. **mobile-authoring-arc.md, under line 594's `### M8 🟢` heading** — one line: the Select +
   delete half is planned in PROMPT-mobile-element-delete.md (owner affordance decision
   2026-08-24: sheet mode now, long-press later); the Inspector's edit fields and the mobile DM
   sheet remain M8's tablet-and-up remainder.

9. **docs/user-guide/getting-started.md:98** — the "open the DM Menu and press 🔓 EXIT DM MODE"
   line is no longer mobile-impossible (M4b shipped the DM screen) but names no mobile route.
   Append: "(on a phone: **≡ LOG → ♛ DM**)".

Commit message shape (match the repo's voice): `docs: the handoff stops describing finished work
as outstanding`.

### Commit 1 — Select mode and its panel, by finger

**New file** `apps/client/src/features/map-edit/mobile/MobileSelectPanel.tsx` (own file — keeps
`MobileMapEditToolPanels.tsx` clear of the 350 guard):

- Props from the toolbar bag: `selectedElement`, `onRemoveElement`.
- `selectedElement === null` → a hint ("Tap an element on the map"), styled like
  `MobilePopulateBlock`'s idle status.
- Element selected → its kind (`element.type`) as the identity line, and a DELETE button calling
  `onRemoveElement(element.id)`. Use the sheet's own button class
  (`.mobile-tool-sheet__button`) so the 44px floor applies (§3.5). Disable DELETE when
  `element.locked` (better than desktop, which round-trips a locked delete to an error toast —
  see §5). Render synchronously — **no** `lazy()`/Suspense (§3.4).

**`MobileMapEditToolPanels.tsx`**:

- Widen `PANEL_TOOLS` to `ReadonlySet<DragTool | "select">` (or a named
  `type SheetPanelTool = DragTool | "select"` beside `DragTool` in `mapEditToolKinds.ts` — your
  call) and add `"select"`.
- Top-level branch before/beside the generate branch (`:66-71`):
  `if (props.activeSubTool === "select") return <MobileSelectPanel … />;`.

**`MobileMapEditSheet.tsx`**:

- Adjust the `:52` cast to the widened type.
- Add the Select control as a **separate, always-visible control in the sheet** — e.g. a
  full-width button below the tile grid — wired to `selectSubTool("select")`, with `aria-pressed`
  when active. It is deliberately NOT a tile: `mobileToolTiles.ts` stays untouched (§3.3).
  Because `"select"` is in `PANEL_TOOLS`, the `:49` auto-close leaves the sheet open, which is
  exactly what the flow needs: arm Select → sheet shows the hint → tap the canvas above the sheet
  → panel names the element → DELETE.

**Tests (same commit, sabotage-proven both directions):**

- `MobileMapEditPalette.test.tsx:330-341` ("offers NOTHING the touch path refuses to arm") —
  remove `/Select/` from the absence list **with a comment**: tap-to-select rides the
  compat-mouse path, fires once, and never shared the click tools' double-fire risk; the other
  five (`/Place/ /Scatter/ /Light/ /Paint/ /Erase/`) stay pinned absent. Line 340's
  `MOBILE_TOOL_TILES.every(isDragTool)` stays — tiles are still drag-only. Add an assertion the
  Select control exists and calls `onSelectSubTool("select")` (query the sheet, not
  `within(grid)` — the control is outside the grid).
- `MobileMapEditToolPanels.test.tsx:127` pins `PANEL_TOOLS ⊆ DRAG_TOOLS` — that assertion goes
  red the moment `"select"` joins. Update to: every member `isDragTool(tool) || tool === "select"`.
  Also re-check its "every PANEL_TOOL renders ≥ 1 section" walk now that select renders the panel.
- New `__tests__/MobileSelectPanel.test.tsx`: null → hint; element → kind named, DELETE fires
  `onRemoveElement` with the right id; `locked: true` → disabled; keep assertions role/name-based
  (§3.6).

Model the test prose on `MapEditInspectorPopover.test.tsx:72-86`.

### Commit 2 — the e2e proof

New spec `apps/e2e/mobile/mobile-map-edit-delete.spec.ts` (spec files count toward the 350 guard
— §3.9). Copy the DM journey scaffolding from `mobile-map-edit.spec.ts` ("a DM authors a room and
a wall from the dock…"):

1. DM on the mobile layout → map edit armed → `touchDrag` a Wall; note the wall count via the
   `__HERO_BYTE_E2E__` seam.
2. Open the sheet (⚒ Tool) → tap the Select control (chrome taps via `getByRole`, like existing
   specs) → `touchTap(cdp, wallMidpoint)` on the canvas → assert the panel names a wall.
3. Tap DELETE → assert the wall count returns to baseline.
4. Not-sticky: a subsequent `touchDrag` still authors a wall (mirrors the abort spec's pattern).
5. Optionally a second (player) context asserts the wall is gone from their view — the pattern is
   in `mobile-map-edit.spec.ts` already.

Fold the new control into the measurement journey of `mobile-map-edit-panels.spec.ts` (44px floor

- no clipping, both orientations) rather than duplicating that rig — it's 157 lines, there is
  room, but watch the guard.

Run forms: `pnpm test:e2e --project=mobile-chromium --grep "<name>"`; single unit file is
`CI=true pnpm --filter herobyte-client exec vitest run src/…` (package-relative path — §3.10).

### Commit 3 — docs: the user guide stops warning about it

- `docs/user-guide/map-editor-guide.md:161` — the "One trap before you use Row or Spline on a
  phone" callout: rewrite to document the flow (⚒ Tool → SELECT → tap the element → DELETE), and
  update the surrounding "missing half" list this line references, since Select is leaving it.
- Grep `docs/user-guide/` for other "cannot remove on a phone" phrasing while you are there.
- Text-only: do **not** run `pnpm docs:screenshots` (it re-records all 36 images for nothing).

---

## 3. Traps that will cost you hours

1. **Two pinning tests go red before your feature works** — the palette absence list
   (`MobileMapEditPalette.test.tsx:337`) and the PANEL_TOOLS-subset assertion
   (`MobileMapEditToolPanels.test.tsx:127`). Update them WITH the feature, and prove each updated
   assertion can still FAIL (sabotage) **and still PASSES on the healthy tree** — M4a's arc paid
   for that second half with a regex that only ever passed on the healthy tree.
2. **The widened type touches two files** — `PANEL_TOOLS`'s declared type AND the
   `activeSubTool as DragTool` cast at `MobileMapEditSheet.tsx:52`. Typecheck before you write
   tests; a stale cast compiles as a lie.
3. **Do not touch `mobileToolTiles.ts`.** The `Record<DragTool, …>` derivation is the compile-time
   guard that keeps tiles honest (its header explains). Select is not a tile by owner decision.
4. **No lazy/Suspense on the new panel.** React caches a rejected lazy chunk forever, and
   `MobileMapEditToolPanels.test.tsx` pins synchronous rendering for exactly that reason.
5. **The 44px floor is a cascade, not one rule.** Base list herobyte.css:1318-1335; later
   per-context overrides (~:1501-1527) can re-narrow it; a landscape media block (~:2012-2024)
   re-declares it. The e2e measurement pass in both orientations is the only honest check —
   jsdom cannot see any of it.
6. **jsdom cannot see layout at all** — unit tests assert roles and wiring; sizes, clipping, and
   grid geometry belong to the e2e specs.
7. **A tap fires two paths by design** (native touch + compat mouse). Select consumes via the
   compat path only and is idempotent. Do NOT "fix" the duplication by editing
   `useTouchGestureRouter`/`useArmedTouchTool` — the zero-length-drag rejections are the existing,
   deliberate defense, and nothing there needs to change for this slice.
8. **Selection self-clears after deletion** (`useMapEditState.ts:271-274` re-derives from the
   live document). The panel must handle `selectedElement` going null mid-interaction; never cache
   the element in local state.
9. **e2e specs count toward the 350-LOC guard** — the exemption regex is the literal filename
   substring `.test.`, and specs are `.spec.ts` (`scripts/structure-report.mjs:99`).
10. **Vitest paths are package-relative** — `pnpm --filter herobyte-client exec vitest run
src/...`, never repo-root paths; wrong paths silently match nothing and the run looks broken
    for the wrong reason.
11. **Run each gate step so its exit code survives** (`cmd > log 2>&1 && echo OK`), never
    `cmd | tail`; read the e2e summary LINE yourself — a flaky suite exits 0.
12. **Never ask a gates agent for a bundle figure AND e2e in one prompt** — the extra build
    clobbers `dist/` mid-run and ~every e2e test fails at the 30s timeout, looking systemic.
13. **After touching mobile shell styles, run the `webkit-check` skill** locally. Never add a
    webkit project to `playwright.config.ts` — CI installs chromium only and goes red on push.
14. **Stage files explicitly** — never `git add <dir>`; the owner's untracked `temp/` files (three
    with spaces in their names) have been swept into main by a broad add before.

---

## 4. The gate — all of it, before every commit

```bash
CI=true pnpm build            # MUST precede typecheck and test — the server resolves @herobyte/shared from dist/
CI=true pnpm typecheck && CI=true pnpm lint && CI=true pnpm lint:structure:enforce && CI=true pnpm format:check
CI=true pnpm test
CI=true pnpm --filter herobyte-client build:check
CI=true pnpm test:e2e --reporter=list
```

`pnpm lint:structure:enforce` is **NOT** part of `pnpm lint`. `CI=true` matters. The
`/verify-gates` skill runs this exact ladder on the cheap agent — use it after every edit burst.
Baselines at `ac47ab9e` (from its commit body): shared 424, server 2165, client all 45 batches,
e2e **134 passed / 0 failed / 3 skipped**. Put your run's numbers in each commit body.

No `packages/shared` change is needed in this slice, so the §7 dev-boot ritual should not
trigger; if you added one anyway, you are off-plan — stop and re-read §1.3.

---

## 5. Judgement calls made here that you may reverse

- **The Select control sits below the tile grid, full width.** Placement inside the sheet is
  yours; the requirements are only: in the sheet (not the dock, not the tile Record),
  always visible while the sheet is open, `aria-pressed`, ≥ 44px.
- **The panel is identify + DELETE only.** No transform fields, no door form — the owner's 2026-08-01
  answer gates the hostile-on-phone Inspector surfaces to tablet-and-up; this slice is the phone
  floor. The rest of the Inspector is M8's remainder.
- **Locked elements: DELETE disables on `element.locked` only.** A LAYER-locked element still
  round-trips to the server's error toast (the bag may not carry layers) — same as desktop
  behaves for both cases today. Desktop's non-disabled DELETE is a rough edge, not a bug; not
  fixed here.
- **No in-flight guard on DELETE.** A double-tap's second send draws "Unknown map element" and a
  toast; the selection self-clears when the first lands, so the window is one broadcast wide. If
  a matching saving flag already reaches the bag, wiring `disabled` to it is a fine improvement;
  do not build a new flag for this.

---

## 6. Definition of done

- In the mobile-chromium e2e (and ideally once on a real phone): DM arms map edit → ⚒ Tool →
  SELECT → taps a placed wall → the panel names it → DELETE → the element is gone from the
  compiled scene, and authoring afterwards still works.
- `git diff --stat` for commits 1-2 shows **nothing** under `apps/server/` or `packages/shared/`.
- The map-editor-guide.md:161 trap callout is rewritten; grep confirms no user-guide text still
  claims a phone cannot remove an element.
- Both updated pinning tests sabotage-proven red AND proven green on the healthy tree.
- Full gate green before every commit, e2e included, numbers in the commit body.
- **Stop before merging to `main`.** That is the owner's call, and it deploys immediately to
  Render and Cloudflare, ungated by CI. Players with a tab open must reload after any deploy.
  (When that merge does happen: read the full-suite job's checkout step — it is the first run
  that can prove the `a7bfb961` ref fix, per Commit 0 item 5.)
