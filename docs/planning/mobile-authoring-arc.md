# Mobile map authoring — audit & arc plan

**Status:** audit complete (2026-07-31). **M1–M2 shipped plus B1/B4/B6/B8-partial, and marquee
select** (2026-08-01) — drawing and rectangular select both work with a finger, **verified on a
real iPhone** (see the device-pass note at the end). **M3 shipped 2026-08-09** (four commits;
B3/B4 had already been closed by other slices, and B5/B8 are now closed too — see §4 M3).
M4–M8 (map authoring) not started; see §4.
**Branch audited:** `dev`. Read-only; nothing in the original audit was run in a browser.

**What the drawing branch settled that the audit could only flag as unknown:**

- **Compatibility mouse events: a drag produces none, a tap produces them.** Both measured under
  Chromium touch emulation. A drag is safe by mechanism (movement past the tap slop cancels the tap
  gesture, so zero `mousedown`/`mouseup`). A **tap is not**: with the degenerate-shape guard removed,
  two taps produced **four** drawings — one per path per tap. The fix is the send gate
  (`useDrawingTool` now rejects a zero-size shape), which closes both paths at once instead of
  de-duplicating events. Blocker 1's "unverified and load-bearing" note is now resolved for **both**
  cases, and the answer differs between them — which is exactly why it needed measuring.
- **`touch-action: none` on an ancestor DOES kill descendant scrollers** — confirmed in the
  browser: `.mobile-chip`'s own `touch-action: manipulation` was inert. The declaration now lives
  on `.mobile-map-surface`. This unblocks M3's scroll plan and closes B4's severity question.
- **Playwright cannot simulate a drag or a pinch** — its Touchscreen API is tap-only. CDP
  `Input.dispatchTouchEvent` can, and produces trusted events. See `apps/e2e/mobile/touch.helpers.ts`.
- **`.mobile-chip` really did render at 38px** (measured), not the 54px the box-sizing reasoning
  predicted — these elements are `border-box`. The 44px-floor violation was live, not latent.

Answers the question "what work on mobile map creation needs to be fixed?" — split into
**bugs shipped today** (§2) and **the authoring gap** (§3), because they are different jobs.

Phase 3 of the live-map-toolbar arc (V1–V6, mobile _polish_) is **fully shipped**:
V1 `b0ae2fbf`, V2 `61d17d9a`, V3 `87c3aee0`, V4 `15456ce2`, V5 `dc85aef5`, V6 `f0c5430e`.
This document is the work that came after it.

---

## 1. What is actually true today

On a phone or tablet the app renders `MobileLayout` (`ui/App.tsx:884`), which mounts `MapBoard`
with 24 props (`layouts/MobileLayout.tsx:170-196`) — **none of them `mapEdit*`** and no
`mapEditController` — so `MapBoard.tsx:95` defaults `mapEditMode = false` and every authoring
branch short-circuits (tool hook `:304-322`, walls overlay `:653`, GM notes `:662`, quick wheel
`:564,573`, preview layer `:777`).

Nothing in the mobile tree can even _produce_ the `"map-edit"` tool mode. The sole producer is
`components/layout/Header.tsx:196`, inside `{isDM && (` at `:194`, and `Header` renders only from
`TopPanelLayout.tsx:185` → `MainLayout.tsx:26`. The palette itself is double-gated at
`TopPanelLayout.tsx:159` (`mapEditMode && isDM`).

A mobile DM also has **no DM Menu at all** — `DMMenuContainer` renders only from
`FloatingPanelsLayout.tsx:212`, whose one non-test importer is `MainLayout.tsx:28`. So no
background upload, grid size, fog toggle, alignment wizard, staging zone, NPC/prop CRUD, session
save/load, invite link, table password, or publish/export.

Underneath all of it sits the structural fact: **the canvas touch path is camera-only.**
`hooks/useStageEventRouter.ts:306-311, :316-321, :326-328` delegate solely to
`handleTouchStart/Move/End`, which `MapBoard.tsx:417-419` aliases to the camera hook. Konva does
not synthesize mouse events from touch, so even with the flags wired,
`handleMapEditMouseDown/Move/Up` could never fire from a finger.

Mobile can **view** everything and pan/pinch. It can author **nothing**.

**That is no longer the intended end state.** Two docs used to disagree:
`docs/planning/live-map-toolbar-plan.md:44` fenced mobile authoring out entirely, while
`VISION.md:46` commits at launch scope to "Terrain painting works with touch on tablets
**[LAUNCH]**". **Settled 2026-08-01 — VISION wins**, and the live-map-toolbar line is struck
through and annotated. Touch map painting is a launch commitment; see §5 Q1/Q2 for the scope and
sequencing that came with the decision.

---

## 2. Bugs — broken today (ranked)

Not map-edit bugs (map-edit is unreachable on mobile), but every one sits on the road any mobile
authoring work has to travel.

### B1 🔴 — Draw and Select are offered on mobile and do nothing. **M**

`useStageEventRouter.ts:306-328` — the touch path forwards only to the camera handlers.
`handleDrawMouseDown/Move/Up` (wired at `:256, :274, :289`) and `handleMarqueePointerDown/Move/Up`
(`:258, :276, :293`) have no touch entry point. `useMarqueeSelection.ts:94` additionally rejects
any event whose `evt.button !== 0`, which a `TouchEvent` has not got.

**Failure:** tap ✎ Draw in the tool sheet (`MobileFloatingControls.tsx:88-95`), get the full
drawing toolbar (`MobileLayout.tsx:260-274`), drag a finger — no line, no preview, nothing. Same
for □ Select: no marquee ever appears.

**Already recorded.** Commit `14604cf8` says so verbatim: _"NOT FIXED, AND IT IS A BUG NOT POLISH
— mobile Draw and Select are dead to touch … Left out of this commit deliberately: a touch fix
needs real device verification."_ This audit confirms the diagnosis and adds the reason it stayed
shipped: see M1 — the e2e harness structurally cannot observe a touch defect.

### B2 🔴 — In Ping / Measure / Draw / Select, one-finger pan is dead too. **S**

`useStageEventRouter.ts:183-184` — one `shouldPan` const
(`!alignmentMode && !pointerMode && !measureMode && !drawMode && !selectMode && !mapEditMode`)
feeds both the mouse path (`:255`) and the touch path (`:308`); `useCamera.ts:171` gates
one-finger pan on it.

**Failure:** in four of the six reachable mobile tool modes a one-finger drag does nothing —
neither pans (suppressed for a tool that has no touch handler) nor draws (B1). Two-finger pinch is
ungated (`useCamera.ts:176-185`) and a two-finger drag pans exactly, so the camera is not frozen —
but `docs/user-guide/player-guide.md:22` and `:161` promise "One finger pans", true only in Move
and Transform.

### B3 🟡 — The tool sheet and the selection sheet render at the identical screen slot. **S**

`theme/herobyte.css:1311` and `:1345` are byte-identical
`bottom: calc(var(--mobile-safe-bottom) + var(--mobile-dock-height) + 22px)`, both `z-index: 1600`
(`:1299`). `closeAllSheets` (`MobileLayout.tsx:138-143`) does not clear the selection, and the
selection-sheet gate (`:227`) is orthogonal to `showTools`. The selection sheet is later in DOM
order (`:228` vs `:212`), so it paints over the tool grid.

**Failure:** select a token, tap ⚒ Tools — the sheet's bottom row is covered. At 4 columns that
row is Transform / Select / Snap (`MobileFloatingControls.tsx:96-121`); at ≤420px the grid drops
to 3 columns (`herobyte.css:1417-1419`) and Snap is the casualty.

### B4 🟡 — Both horizontal sheets overflow a phone and push their action buttons off-screen. **S**

`.mobile-drawing-sheet` and `.mobile-selection-sheet` are flex with `overflow-x:auto`
(`herobyte.css:1366-1373`, `:1344-1352`) and nothing shrinks: `.mobile-chip { flex: 0 0 auto }`
(`:1361`), `__control { flex: 0 0 150px }` (`:1383`), `__tools { flex: 0 0 auto }` (`:1377`).

**Estimated** (arithmetic on CSS values, not browser measurement; assumes Press Start 2P ≈ 1em
advance): drawing sheet ≈ 850px of content in a ~329px box at 375px viewport; selection sheet ≈
510px for a DM. **Undo / Redo / Done fall off the right edge of the drawing sheet, and Clear falls
off the selection sheet** — and Clear is the stated recovery from B3.

**Gating unknown:** `.mobile-layout-root` sets `touch-action: none` (`herobyte.css:1204`) above
both scrollers. The spec's intersection walk arguably stops at the scroll container, so it may
scroll fine — **one device check decides B4's severity and M3's scroll plan.**

### B5 ✅ FIXED (M3) — The mobile roll log is a full-screen takeover with a 32px exit. **S**

**It was 24px in landscape, not 32** — see §4 M3. The takeover itself is kept; the exit is now 44px
with an accessible name, and the window paints above the bottom sheets instead of under them.

`MobileLayout.tsx:326` wraps `RollLog`, which returns a `DraggableWindow`
(`RollLog.tsx:255-266`). `DraggableWindow.tsx:68` sets `isMobile = innerWidth < 768` and
`:168-183` applies `position:fixed; inset 0` with an opaque background.

**Failure:** ≡ Log covers the entire map and the action dock; the only exit is a 32×32px close
button (`:239-240`), below the 44px floor the rest of the mobile UI honours. All of
`.mobile-roll-log-panel`'s sizing CSS (`herobyte.css:1396-1401`) is dead.

### B6 🟡 — Pinch-zoom drifts whenever the pinch centre moves. **S**

`useCamera.ts:182-184` seeds `camOrigin`/`lastCenter`/`lastDist` once at touchstart and `:191-239`
never refreshes them, yet `:219-232` uses the _incremental_ recipe (anchor from the current centre
against the original camera, plus `dx = newCenter − lastCenter`). Error term `(c − c₀)·(1 − d/d₀)`
— zero for a pure zoom (centre still) and zero for a pure two-finger drag (`d = d₀`), which is why
it survived review.

**Failure:** pinch to 2× while sliding 100px and the map lands ~100px off, visibly sliding out
from under the finger mid-gesture.

### B7 🟡 — `<Stage pixelRatio>` is inert; the V2 DPR clamp does nothing. **S**

`MapBoard.tsx:590` passes `pixelRatio={pixelRatio}`, but **react-konva contains zero occurrences
of `pixelRatio`** (verified by grep over `apps/client/node_modules/react-konva/`) — it lands in
`stage.attrs` and is never read. Konva reads a `pixelRatio` only from the `_toKonvaCanvas(config)`
argument (the `toDataURL`/`toCanvas` export path); layers build their scene canvas with no config
and capture raw `window.devicePixelRatio` at module load.

**Consequence:** `MAX_DEVICE_PIXEL_RATIO = 3` (`useDevicePixelRatio.ts:10,16-19`) never bites;
layers render at raw DPR. On a 3.5–4× Android that is a 12–16× backing store per layer. **No crash
or OOM is demonstrated anywhere in the repo** — a confirmed no-op with an unmeasured consequence
(sharper today, a memory risk on high-DPR devices). Note the comment at `MapBoard.tsx:140-142`
argues for native-resolution rendering, not capping — the two intents were never reconciled.

### B8 ✅ FIXED (M3 closed the remainder) — Sub-11px functional text and missing safe-area insets on fixed chrome. **S**

V5's ≥11px floor landed only on the dock/tool-sheet group (`herobyte.css:1259-1260, :1413-1414`).
Still under it: `.mobile-drawing-sheet__control` 0.58rem = 9.28px (`:1386`),
`.mobile-selection-sheet strong` 0.62rem = 9.92px (`:1357`), `ServerStatus.tsx:25` = 8px,
`PublicTableNotice.tsx:46` = 7px, `TurnNavigationControls.tsx:73` = 10px. (1rem = 16px — there is
no `html`/`:root` font-size; `body{font-size:12px}` at `:108` does not affect rem.)

V6 insets exist (`herobyte.css:1205-1208`) and the combat strip uses them (`:1219`), but
`ServerStatus.tsx:16-17`, `PublicTableNotice.tsx:38-39` and `Toast.tsx:167-169` do not — the
ONLINE/OFFLINE banner renders under the notch.

### B9 🟢 — Rapid taps spam pings; a token can be left selected with no sheet. **S**

`useStageEventRouter.ts:242` calls `detectDoubleTap`, then `:246` calls `onStageClick` which calls
it again at `:190` — two invocations per tap, defeating the anti-triple-tap reset at
`useDoubleTap.ts:71`. Three deliberate taps broadcast two `point` messages. (A single tap cannot
ping — the `timeDiff > 50` guard at `:69` catches the duplicate.)

Separately `TokensLayer.tsx:729-730` binds `onTap` gated only on `interactionsEnabled`, so in
Ping/Measure a tap can select a token, no selection sheet renders (`MobileLayout.tsx:227` requires
transform/select), and an empty-canvas tap routes to `handlePointerClick` instead of clearing.

### Explicitly NOT bugs — raised in audit, refuted, do not re-open

- **Mobile Measure units** — the readout uses `snapshot?.gridSquareSize` from the server
  (`MapBoard.tsx:768` → `MeasureLayer.tsx:34`), not the dead layout prop. Correct on mobile.
- **`82vh` landscape cap "always overflows"** (`herobyte.css:1445`) — the tool sheet measures
  ~219px against ~273px of space in 812×375. A forward-looking constraint for a bigger palette,
  not a shipped defect.
- **"The landscape dock is still 68px"** — `.mobile-dock-button{min-height:40px}` (`:1436`) does
  win the cascade over `:1252`; its effect is swallowed by
  `.mobile-action-dock{min-height: var(--mobile-dock-height)}` (`:1236`/`:1209`). Cosmetic.
- **`.mobile-chip{min-height:38px}` under the 44px floor** (`:1362`) — real ordering smell, but
  with no global `box-sizing` reset the chip renders 38+12+4 = 54px. Latent; it goes live the day
  someone adds `box-sizing: border-box` globally.
- **`useElementSize` AND-vs-OR zero guard** (`:25`) — real in source, unreachable given
  `.mobile-map-surface{position:absolute;inset:0}` inside a `100vw/100dvh` root.
- **Toast/CRT z-index tie at 10000** — `.crt-bezel` renders only via `FloatingPanelsLayout.tsx:294`,
  which mobile never mounts.
- **"Alignment is half-wired on mobile"** — `alignmentMode` can only be set by the DM-menu wizard
  (`useMapAlignment.ts:190`), so the props at `MobileLayout.tsx:182-185` are constant. Unused, not
  broken.

---

## 3. The authoring gap — four blockers in dependency order

### Blocker 1 — The touch event layer (foundation)

`useStageEventRouter.ts:306-328` delegates touch to the camera only. No touch entry into
`handleMapEditMouseDown/Move/Up` (`useMapEditTool.ts:184, :230, :267`), `handleDrawMouse*`
(`useDrawingTool.ts:94, :121, :147`), `handleMarqueePointer*` (`useMarqueeSelection.ts:87, :111,
:175`), or `handlePointerMouseMove` (`usePointerTool.ts:81` — the measure rubber-band never
follows a finger). `onTouchEnd` (`:326-328`) calls no tool's mouse-up, so a drag that somehow
started could never commit.

**The hard part is gesture arbitration, which does not exist anywhere in this stack:**

- Pinch is completely ungated (`useCamera.ts:176-185`). `useMapEditTool.onMouseDown` (`:184-212`)
  never inspects `touches.length` and `stage.getPointerPosition()` returns finger one. Wire touch
  naively and planting a second finger to zoom fires a second `touchstart` that **restarts the
  wall/room drag at finger one's position** (`:210-211` overwrites `dragRef.current`) while the
  pinch runs concurrently.
- `shouldPan` already zeroes one-finger pan in map-edit, so arbitration must be explicit: one
  finger = tool, two = camera, and a mid-gesture 1→2 promotion must **cancel** the tool drag, not
  commit it.
- `useMarqueeSelection.ts:94` rejects `evt.button !== 0`; touch events have no `button`.
- **Unverified and load-bearing:** browsers emit compatibility mouse events after an unprevented
  tap, and Konva only calls `preventDefault()` on touchstart when a _listening shape_ was hit —
  empty-canvas taps are not prevented. If those compat events fire, some click-tools already
  half-work by accident and new touch wiring will **double-fire**. Measure on a device _before_
  writing the fix.

**Difficulty: M–L.** Delegation is ~30 lines; arbitration and compat de-duplication are the work,
and neither is honestly verifiable under the current harness (`playwright.config.ts:66-71` defines
one project on `devices["Desktop Chrome"]`, `hasTouch: false`; `apps/e2e/mobile-layout.spec.ts`
only calls `setViewportSize`). **That harness gap is why B1 shipped and stayed shipped.**

### Blocker 2 — Mode reachability and state plumbing (cheap)

No producer of `"map-edit"` on the mobile path, and `MobileLayout.tsx:170-196` forwards none of
the 17 `mapEdit*` props. The good news: **every one of them is already computed on every mobile
render** — `MainLayoutProps.ts:115-149`, wired at `App.tsx:751-767` from `useMapEditState` (mounted
unconditionally at `App.tsx:330-339`), controller at `App.tsx:327`. They are constructed and
dropped on the floor. Wiring is prop-passing, not new machinery.

**Trap:** `mapEditMode` already **survives** a live desktop→mobile resize (`App.tsx:394`
re-evaluates `isMobile` live; `activeTool` is not reset) and `useMapEditHotkeys`
(`useMapEditState.ts:138-144`) stays armed — Ctrl+Z on a keyboard-equipped tablet already undoes
the live map document while the mobile layout is showing. Any entry point must define the
resize-crossing behaviour explicitly. **Difficulty: S.**

### Blocker 3 — The UI shell (where the desktop design dies)

The desktop palette is a `DraggableWindow` (`MapEditToolbar.tsx:88`) holding a 13-button grid
(`:18-32, :134-145`) plus a brush deck, wall-ring swatches, a hallway-width row, an asset picker,
a Populate/Generate/Spline panel, a layers popover and an inspector popover
(`MapEditToolPanels.tsx:69-183`). None of it survives as-is:

- `DraggableWindow` **disables dragging entirely on mobile** (`:73`, `isMobile = innerWidth < 768`
  at `:68`) and goes full-screen opaque (`:168-183`) — see B5.
- Measured sheet geometry (content-box; no global `box-sizing` reset): tool button 60px, header
  66px, chrome 26px. A 15-tool 4-column grid = **353px**; with a ~5-row inspector ≈ **673px**.
  Portrait 375×812 has a **710px ceiling** before `.mobile-layout-root{overflow:hidden}` (`:1202`)
  clips — palette + inspector leaves **37px of map**. At ≤420px (3 columns) the pair is **740px,
  clipped outright**. Landscape 812×375 has **273px**: the palette alone overflows by 80px and the
  `82vh` cap (`:1445` = 307.5px) is too large to intervene.
- Portrait has **no** `max-height` and **no** `overflow-y` — those exist only inside
  `@media (orientation: landscape) and (max-height: 500px)` (`:1441-1447`).
- The sheet is one flow, so `overflow-y:auto` would scroll the header and its close button
  (`MobileFloatingControls.tsx:54-61`) out of reach — the same failure that makes B5 hard to
  escape. A sticky header + scrolling body is mandatory. Any scroll plan is blocked on B4's
  `touch-action` question.
- **Tablets are the widest devices running the phone shell with zero tablet CSS:** `App.tsx:384`
  routes any coarse-pointer device up to 1024px into `MobileLayout`, while the narrowest CSS
  adaptation is 420px (`:1404`). A 1024×768 iPad renders the 5-column dock at ~200px per cell.

**Difficulty: L.** A design problem, not a porting problem.

### Blocker 4 — Tool-by-tool translation

**Translate cleanly (drag-shaped, one finger, once Blocker 1 exists):** 🏠 Room, 🚇 Hall, 🧱 Wall,
🚪 Door, 〰️ Spline, 📏 Row, 🏰 Gen's region drag (`mapEditToolKinds.ts:8-18` classifies these DRAG;
commits at `commitDragTool.ts:61-133`). Room/Hall/Gen are forgiving (force-snapped rectangles,
`mapEditToolKinds.ts:43-47`). Wall/Door need endpoint precision that is rough at phone zoom.
**All of them need a touch cancel gesture** — today the only cancel is capture-phase Escape
(`useMapEditTool.ts:323-334`); releasing a finger commits.

**Need redesigned interaction (the ghost-and-modifier problem):**

- 📦 Place, 🎲 Scatter, 💡 Light are single-click commits (`useMapEditTool.ts:191-206`) whose
  entire pre-commit affordance is a **hover** ghost (`:235-238` → `useMapEditPlacement.ts:128-159`).
  Touch has no hover — needs a reticle or drag-then-confirm model.
- **Alt = free stamp vs grid tile** (`useMapEditPlacement.ts:74, :105-117`, ghost branch `:133`) is
  a binary _element-kind_ switch with **no UI control anywhere** — the only affordance is the hint
  string at `MapEditToolbar.tsx:213`. Needs a real toggle.
- **R / Shift+R rotate the pending stamp** in 15° steps (`useMapEditPlacement.ts:36, :86-98`) — no
  on-screen control; post-commit rotation exists only via the Inspector.
- **Ctrl/Cmd+click = eyedropper** (`useMapEditSelection.ts:16, :42-61, :71-75`) — not in the
  13-entry `SUB_TOOLS` list; it exists _only_ as a modifier.
- 🖌️ Paint / 🧹 Erase are press-and-drag brush streams (`useMapEditTool.ts:204, :243`, flush at
  `:268-274`). Mechanically the cleanest touch tool — and the one `VISION.md:46` promises — but it
  collides head-on with pan, forcing the arbitration decision.
- **Quick wheel** (right-click, `MapBoard.tsx:561-567`) and **brush pinning** (right-click,
  `MapEditBrushDeck.tsx:193-196`) have no touch analogue; the long-press variant is a recorded
  deferral (`MapEditQuickWheel.tsx:9-10`) and no long-press handling exists anywhere in the client.

**Genuinely hostile on a phone:** the brush deck (hover preview card at
`MapEditBrushDeck.tsx:197-201, :220-246` plus a typed search field at `:99-117`); the Inspector's
six numeric fields + layer select + apply/delete (`MapEditInspectorPopover.tsx:28-173`); the Layers
popover's per-layer visibility/lock/reorder/opacity row (`MapEditLayersPopover.tsx:20-90`); and
Generate's ≥20×20-cell / ≤16384-cell region aim (`useGenerate.ts:34-36`) at phone zoom. These want
a tablet, or a different UI entirely.

**Also missing, outside the palette:** everything in the DM Menu's Map tab — background
(`MapTab.tsx:134`), publish-to-live (`MapStudioControl.tsx:298-306`), grid size (`MapTab.tsx:166`),
fog (`:176`), alignment wizard (`:184`), staging zone (`:198`), clear drawings (`:208`), JSON
import (`MapStudioControl.tsx:240`), PNG/WEBP/SVG/JSON export (`MapStudioExportControls.tsx:10-47`).

---

## 4. Proposed slices

House style per `live-map-toolbar-plan.md`. All new files ≤350 LOC (`prettier --fix` expands —
budget ~330). **M1, M2 and M3 are mutually independent and can run in parallel.** M4 depends on
M1+M2. M5–M8 stack on M4.

### M1 🔴 — A touch e2e project (unblocks honest verification of everything below)

**Goal:** the repo can observe a touch defect. Today it structurally cannot, which is precisely why
B1 shipped.

**Context capsule:**

- `playwright.config.ts:66-71` (repo ROOT, not `apps/e2e/`) — one `chromium` project on
  `devices["Desktop Chrome"]`, `hasTouch: false`.
- `apps/e2e/mobile-layout.spec.ts` (55 lines, 2 tests) — `?mobile=true` at `:11, :41`,
  `setViewportSize` only, every assertion mouse-driven.
- The one place touch emulation already exists: `apps/e2e/docs-screenshots.player.ts:159-161`
  (`hasTouch: true, isMobile: true`) under `playwright.docs.config.ts` (`package.json:41`).
- Dev logins and DM elevation: memory note `herobyte-browser-testing`; e2e ports 5175/8788.

**Changes:** (1) add a second Playwright project `mobile-chromium` on `devices["Pixel 7"]` (or
explicit `hasTouch: true, isMobile: true, viewport 390×844`), scoped by `testMatch` to
`mobile-*.spec.ts` so the desktop suite is untouched; (2) NEW `apps/e2e/mobile-touch.spec.ts`
(~120) characterizing _current_ behaviour via `page.touchscreen`/`locator.tap()` — one-finger drag
pans in Move; one-finger drag in Draw produces nothing (**assert the bug**, flip in M2); a single
empty-canvas tap sends at most one ping; a tap in Ping mode does not strand a token selection;
(3) document the project in `docs/TESTING.md`.

**Done when:** `pnpm test:e2e` green with both projects; the Draw-is-dead assertion passes
_because the bug exists_, and its inversion is M2's acceptance criterion.

**Traps:** Playwright's touch emulation may not reproduce a real device's compatibility-mouse-event
behaviour — any assertion about tap→click double-firing must be cross-checked on hardware before
it is trusted. Do NOT add `hasTouch` to the existing desktop project; the drawing-tools and
map-navigation specs depend on mouse semantics.

### M2 🔴 — Touch reaches the tools that already exist (architecture-proof slice)

**Goal:** the thinnest full vertical of the touch layer — Draw and marquee Select work with a
finger, one/two-finger arbitration is explicit, desktop unchanged. After this, every authoring tool
is a wiring exercise.

**Context capsule:**

- `useStageEventRouter.ts:183-184` (the single `shouldPan`), `:252-268 / :271-284 / :287-301` (the
  mouse delegation to clone), `:306-328` (the camera-only touch handlers to extend), `:239-249`
  (`onTap` → `onStageClick`, the double `detectDoubleTap` at `:242`+`:190`).
- `useCamera.ts:164-186` (touchstart: one finger + `shouldPan` → pan at `:171`; two fingers →
  **ungated** pinch at `:176-185`), `:191-239` (touchmove), `:244-250` (touchend).
- Handlers to reach: `useDrawingTool.ts:94/121/147` (note `:111` seeds `[world, world]`, `:163`
  eraser needs `length > 1`, `:195` sends at `length >= 2`); `useMarqueeSelection.ts:87/111/175`
  (**`:94` rejects `evt.button !== 0`**); `usePointerTool.ts:81`.
- `MapBoard.tsx:594-599` (Stage bindings), `:232-234` + `:417-419` (camera touch aliases).

**Changes:**

1. NEW `hooks/useTouchGestureArbiter.ts` (~140): finger-count state machine. `begin(touches)` →
   `"tool" | "camera" | "idle"`; a 1→2 promotion emits **cancel** to the active tool then hands the
   gesture to the camera; a 2→1 demotion stays camera-only until all fingers lift.
2. `useStageEventRouter.ts`: `onTouchStart/Move/End` delegate to the same handler set as the mouse
   path, filtered through the arbiter; add an explicit `cancelTools()` path. Fix the double
   `detectDoubleTap` (call it once, in `onStageClick`).
3. `useMarqueeSelection.ts:94`: accept events with no `button`; reject only an explicit non-zero.
4. `useDrawingTool.ts`: refuse a degenerate commit (two identical points, `:111` + `:195`) — also
   defends against compat-event double-fire.
5. `useCamera.ts`: refresh `lastCenter`/`lastDist`/`camOrigin` per move, or switch `:219-232` to
   the pure absolute form — **fixes B6** while you are in the file (house rule: bugs found mid-arc
   get fixed, own commit).

**Tests:** `useTouchGestureArbiter.test.ts` (1→2 cancels the tool; 2→1 does not resume it; all-lift
resets); extend `useStageEventRouter.test.ts` (touch reaches draw + marquee; `detectDoubleTap`
invoked exactly once per tap); `useCamera.test.ts` (pinch with a moving centre lands on the
analytically correct camera — assert exact numbers); flip M1's Draw assertion positive.

**Verify:** `pnpm --filter herobyte-client test && pnpm typecheck && pnpm lint &&
pnpm lint:structure:enforce && pnpm --filter herobyte-client build:check`, then full `pnpm test` +
`pnpm test:e2e` — the drawing-tools and map-navigation specs exercise this exact router.

**Traps:** `live-map-toolbar-plan.md:121, :190, :204, :216, :524` all instruct you to edit "BOTH
shouldPan sites 239/288" — **they were merged into one at `useStageEventRouter.ts:183-184` by commit
`3aa74602`**; there is no second site. Do NOT "fix" the ungated pinch at `useCamera.ts:176` by
adding `shouldPan` — ungated pinch is correct and is the user's only escape today. If a tap now
fires both a touch path and a mouse path you will double-commit — de-duplicate by gesture id, not
by timing.

### M3 ✅ SHIPPED 2026-08-09 — Mobile sheet shell repair

Four commits on `dev`: `7a333036` (dock height), `e6d896a7` (the sheet cap), `38039b96` (roll log),
`9583a176` (the chrome pass). Guarded by `apps/e2e/mobile/mobile-shell.spec.ts` (8 tests, both orientations)
plus `utils/__tests__/mobileLayout.test.ts`. Every number below was measured in a Pixel 7 context,
not computed.

**Half of this slice was already done when it started, and two of its six items were wrong.**
B3 (the two sheets at the same slot) had been closed by the single-sheet arbitration in
`MobileLayout` — both sheets carry `&& !showTools`. B4 (horizontal overflow) had been closed by
turning both sheets into `auto-fit` wrapping grids. What remained:

- **Item 6 was bigger than "a stale landscape value".** `--mobile-dock-height` is used as the whole
  dock's height by every sheet's `bottom: calc(safe + dock + 22px)`, but under content-box it
  described only the content: 68 declared against **86 rendered** portrait, **82** landscape. The
  22px gap was really 4px. `box-sizing: border-box` scoped to `.mobile-action-dock` makes the
  variable true; landscape overrides it to 62px on the ROOT (the sheets read it too). The
  landscape `min-height: 40px` on the button was deleted rather than honoured — it had never taken
  effect, and now that it could it would break the 44px floor.
- **Item 2 was live in BOTH orientations, not just landscape.** Injecting 900px of filler put the
  tool sheet's top at **-428px** portrait (no cap at all) and **-60px** landscape (82vh was too
  large to intervene). The fix is the shared `--mobile-sheet-offset`, so anchor and cap are one
  derivation, plus `border-box` — on a content box the 26px of padding and border land outside the
  calc. The landscape `82vh` override is deleted, not moved: it was the rule the help sheet had
  needed an exemption from, and a rule needing an exemption is the wrong rule. Sticky headers moved
  out of their help-only scope for the same reason. Now: +48px top, scrolls, header stays.
- **Item 4 (B5) was worse than recorded.** The close button was 32px portrait AND **24px
  landscape**, because `DraggableWindow` decided "mobile" with its own `innerWidth < 768` while
  `App.tsx` routes an 812x375 phone and a 1024px tablet into `MobileLayout`. Every landscape phone
  and every tablet got the desktop window inside the phone shell. The rule now lives in
  `utils/mobileLayout.ts` and both read it. The button also had **no accessible name at all**
  ("×" is not one).
- **Item 5 (B8) is closed on mobile, and deliberately NOT on desktop.** `ServerStatus` 8px→11px at
  `var(--mobile-safe-top)`, `PublicTableNotice` chip 7px→11px stacked below it,
  `TurnNavigationControls` 10px→11px, `Toast` anchored off the insets. These only started
  mattering when S8 began rendering all three on mobile.

  **The chip is still 7px on desktop, and that is now a recorded constraint rather than an
  oversight.** It is `position: fixed` at z-index 199 with pointer-events on, centred in the same
  band as the header, so its WIDTH decides what the header can still be clicked through. At 11px
  the sentence measures 682px and covers the buttons: `elementFromPoint` at the centre of "Draw
  Tools" returned the chip, and six specs in `ui-state.spec.ts` each sat out a full timeout. The
  suite went from 3.5 minutes to over 25 with nothing in the output naming the chip. Presentation
  therefore moved from inline styles to `.public-table-chip` in `herobyte.css`, with the phone
  treatment scoped under `.mobile-layout-root`. **Making it readable on desktop needs it moved out
  of the header band first — a design decision, not a font size.** Guarded by
  `apps/e2e/public-table-chip.spec.ts`.

**Three things found along the way**, each fixed in the commit whose blast radius it was: the
`.mobile-roll-log-panel` wrapper painted an empty bordered box behind the window (it is not a sheet
— its child is `position: fixed` and escapes it) and now does nothing but establish a stacking
context, because the drawing sheet at z 1600 was painting across the log at 1100; and
`ui-state.spec.ts`'s `getByRole("button", {name: /Log/i})` had matched one element only because the
close button was anonymous.

**Traps worth carrying into M4:**

- **Sabotage the assertion, not just the code.** The first occlusion check hit-tested the roll log's
  ✕ and stayed GREEN with the fix removed — the sheet covers the log's BODY, never its title bar.
- **A `position: fixed` element has a null `offsetParent`.** A "find every element under 11px" sweep
  built on `offsetParent !== null` skips exactly the fixed chrome it is looking for, and reports
  clean while a 7px chip is on screen. Use `checkVisibility()`.
- **content-box bites three times in this stylesheet** — the dock, the sheet cap, and the chip's
  `maxWidth`. Assume it until measured.
- **A CSS source-text test's line anchors need `\r?`.** Under CRLF a `(?<!,)\n` lookbehind matches
  the wrong rule silently.

---

**Original plan below.**

**Goal:** the existing sheets stop colliding, stop hiding their own buttons, and gain the scroll
machinery any larger palette will need.

**Context capsule:** `herobyte.css:1292-1299` (shared sheet block, z 1600), `:1310-1313` /
`:1344-1352` / `:1366-1373` (the three bottom anchors — the first two byte-identical),
`:1395-1401` (dead roll-log CSS), `:1404-1420` (≤420px), `:1430-1452` (landscape;
`--mobile-dock-height: 68px` at `:1209` is never overridden), `:1202` (`overflow:hidden`), `:1204`
(`touch-action:none`). `MobileLayout.tsx:138-143`, `:212` vs `:227`, `:229-256`.
`MobileDrawingControls.tsx:31-74`. `DraggableWindow.tsx:68, :168-183, :239-242`.

**Changes:** (1) give the selection sheet its own anchor, or fold it into a single arbitrated sheet
slot — **B3**; (2) add a portrait `max-height` + `overflow-y` to `.mobile-tool-sheet` expressed as
`calc(100dvh - (var(--mobile-safe-bottom) + var(--mobile-dock-height) + 22px) - 12px)` rather than
a bare `vh`, replace the `82vh` at `:1445` with the same expression, and make sheet headers sticky;
(3) let the chip rows wrap or shrink instead of overflowing — **B4** (verify on device first
whether `touch-action:none` suppresses the `overflow-x:auto` scrollers; if it does, that is the
fix); (4) 44px close target on the mobile `DraggableWindow`, or stop routing the mobile roll log
through it — **B5**; (5) raise the remaining sub-11px functional labels and add safe-area insets to
`ServerStatus`, `PublicTableNotice`, `Toast` — **B8**; (6) resolve the stale
`--mobile-dock-height` in the landscape block.

**Done when:** at 375×812 and 812×375, with a DM selection active and Draw armed, every control in
every open sheet is tappable without horizontal scrolling.

**Traps:** `.mobile-chip{min-height:38px}` (`:1362`) is harmless only because there is no global
`box-sizing` reset — do not add one in this slice. There is no CSS breakpoint matching the JS
layout switch (`App.tsx:384/387/388` vs `herobyte.css:582/600/1404/1430`); if you add one, put it
at 700/1024 and say so.

### M4 🔴 — Map-edit reachable on mobile: room + wall, end to end (second architecture-proof slice)

**Goal:** a DM on a tablet taps a Map button, binds the live map, drags a room and a wall, players
see it. Two tools only; everything after is more tools on the same rails.

**Context capsule:**

- Entry to clone: `Header.tsx:194-203` (the DM-gated toggle); `MobileFloatingControls.tsx:63-122`
  (the tool-sheet button pattern; `selectTool` → `onToolSelect` = `setActiveTool`).
- The 17 props already computed and discarded: `MainLayoutProps.ts:115-149`, built at
  `App.tsx:751-767`; `MobileLayout.tsx:170-196` is where they must land. Controller at
  `App.tsx:327` (`useMapStudio`), passed on desktop as `mapEditController={mapStudio}` at
  `CenterCanvasLayout.tsx:294` (**not** isDM-gated there — server commands are DM-gated
  server-side).
- What turns on once `mapEditMode` is true: `MapBoard.tsx:304-322`, `:439`
  (`tokenInteractionsEnabled` → false), `:653`, `:662`, `:777`.
- Bind flow to reuse verbatim: `useMapEditState.ts:157-215` (`startLiveMap`: create →
  `map-studio-set-live` → `updateGrid`, plus the rebind-after-reload effect); button at
  `MapEditToolbar.tsx:105-112`.
- Commits: `commitDragTool.ts:98-111` (room), `:131-133` (wall/door); `mapEditToolKinds.ts:43-47`.

**Changes:** (1) DM-gated 🏗️ Map tile in `MobileFloatingControls.tsx` (requires threading `isDM`,
which the component does not currently receive); (2) forward the 17 `mapEdit*` props + controller
in `MobileLayout.tsx` (already in `layoutProps`); (3) NEW
`features/map-edit/MobileMapEditSheet.tsx` (~220) — a bottom sheet, **not** `DraggableWindow`
(drag is disabled on mobile at `:73`) — sticky header (title, LIVE badge, close), scrolling body,
START LIVE MAP, room/wall chips, undo/redo, and a persistent **CANCEL DRAG** control (the touch
stand-in for `useMapEditTool.ts:323-334`); (4) `useMapEditTool.ts` accepts a cancel signal from the
arbiter (M2) and from the sheet; (5) decide and encode the resize-crossing rule (Blocker 2 trap).

**Done when:** manual on a tablet — 🏗️ → START LIVE MAP → drag a room → drag a wall → a second
browser as player sees fog respect the wall.

**Traps:** the controller **no-ops silently** without an active document — disable every tool until
`activeDocument.id === liveMapDocumentId`. Two-finger zoom mid-drag must cancel, not commit.
`MapBoard.tsx:439` kills token interaction in map-edit, so the mobile selection sheet
(`MobileLayout.tsx:227`) becomes unreachable in the mode — verify a DM cannot get stranded. Do not
statically import the sheet from an entry-reachable file; `build:check` enforces the bundle budget.

### M5 🟡 — The rest of the drag tools + Generate/Populate

Hall, Door, Spline, Row, Generate's region aim (`commitDragTool.ts:61-133`,
`useGenerate.ts:34-36, :61-91`, `usePopulate.ts:66-130`). Same rails as M4 — chips plus the
width/kind/theme sub-panels (`MapEditToolbar.tsx:168-185`, `MapEditToolPanels.tsx:69-153`).
**Trap:** Populate is armed only by an immediately preceding room/hallway drag
(`usePopulate.ts:94, :118`) — that adjacency is invisible in a sheet-based UI and needs an explicit
affordance.

### M6 🟡 — Paint / Erase + a touch brush deck

The tool `VISION.md:46` actually promises. Brush stream at `useMapEditTool.ts:204, :243, :268-274`.
The deck (`MapEditBrushDeck.tsx:42-246`) must be rebuilt for touch: the hover preview card
(`:197-201, :220-246`) becomes tap-to-preview or a detail row, and right-click pinning (`:193-196`)
needs a real control. **Trap:** pins/recents live in localStorage (`brushDeck.ts:75-125`) — keep
the same keys so a DM's desktop pins follow them.

### M7 🟡 — Place / Scatter / Light with a reticle

The hover-ghost problem (`useMapEditPlacement.ts:128-159`). Needs a reticle or drag-then-confirm
placement model; an explicit **stamp vs tile** toggle to replace Alt (`:105-117`); on-screen rotate
buttons to replace R/Shift+R (`:36, :86-98`); and an eyedropper as a real sub-tool rather than a
Ctrl modifier (`useMapEditSelection.ts:16, :42-75`). The most novel design in the arc.

### M8 🟢 — Select + Inspector + a mobile DM sheet

Select (`useMapEditSelection.ts:68-84`) plus a touch Inspector
(`MapEditInspectorPopover.tsx:28-173`) and Layers (`MapEditLayersPopover.tsx:20-90`) — both hostile
on a phone, plausible on a tablet. Fold in the minimum DM chrome a mobile author cannot work
without: publish-to-live (`MapStudioControl.tsx:298-306`), grid size (`MapTab.tsx:166`), background
(`:134`), fog (`:176`). Independent of M5–M7 once M4's shell is stable.

---

## 5. Questions for the owner

**Q1 and Q2 were ANSWERED 2026-08-01. Q3 and Q4 remain open.**

1. ~~**Tablet-only, or phones too?**~~ **ANSWERED: both, degrading gracefully.** The owner's
   framing is "as featured as possible within the limitations". That means the full palette on a
   tablet, and on a phone the subset that genuinely fits — the drag-shaped tools (paint, room,
   wall, hall) plus whatever the sheet shell can hold at 375px. The surfaces the audit found
   genuinely hostile on a phone (the brush deck's hover-preview and typed search, the Inspector's
   six numeric fields, Generate's ≥20×20-cell region aim) are tablet-and-up rather than
   force-fitted. Do NOT gate authoring behind a width check — gate individual tools.

2. ~~**`VISION.md:46` vs `live-map-toolbar-plan.md:44`?**~~ **ANSWERED: VISION wins.** Touch map
   painting is in launch scope. `live-map-toolbar-plan.md:44` is struck through and annotated as
   overturned. The target is a useful subset, not desktop parity: **paint + rooms + walls first**
   (roughly M4 + M6), with the rest earning its way in.

**Sequencing decided with it:** this arc runs AFTER the Session One arc
([session-one-arc.md](./session-one-arc.md)) — mobile authoring improves _authoring_ on a table
that still cannot chat, upload a face, or read a token's name. Session One raises the floor for
every device; this finishes the port. The touch event layer this arc needed is already built and
iPhone-verified (drawing + marquee select), so M1–M2 are done and M3 is partly done: the wrapping
grid pattern the sheet shell needs now exists in `.mobile-drawing-sheet`.

3. **Does a mobile DM get the DM Menu, or only map authoring?** Today a mobile DM has _no_ DM
   surface: no background, grid, fog, alignment, staging zone, NPC/prop CRUD, combat start/end,
   session save/load, invite link, or table password (`FloatingPanelsLayout.tsx:212` is
   desktop-only). Authoring without publish/grid/background is half a tool; a full mobile DM Menu
   is its own arc. `docs/user-guide/getting-started.md:98` already gives mobile users an impossible
   instruction ("open the DM Menu and press 🔓 EXIT DM MODE") regardless of the answer.

4. **Should there be an in-app "use the desktop layout" switch?** The only escape hatch is the
   undocumented `?mobile=false` (`App.tsx:377-380`), which appears nowhere in `docs/` or
   `README.md`. A tablet DM who would rather have the real palette cannot ask for it, and a desktop
   DM who narrows a window below 700px loses the entire toolset mid-session (`App.tsx:387-389` plus
   the live `resize` listener at `:394`) while `mapEditMode` and its Ctrl+Z hotkeys quietly stay
   armed. If mobile authoring ships as a subset, this switch may be the cheaper answer for tablets.

---

## Device pass — PASSED on a real iPhone (2026-08-01)

Both items below were flagged as unverifiable without hardware. Both are now closed by an
owner-run session on an actual iPhone over Safari, not by emulation:

- **Compatibility mouse events.** Settled during implementation and confirmed on device: a _drag_
  produces none, a _tap_ does. The fix is the degenerate-shape send gate, which closes the touch
  path and the mouse path together rather than de-duplicating events.
- **`touch-action` on `.mobile-layout-root`.** Confirmed absorbing down the ancestor chain; the
  declaration now lives on `.mobile-map-surface` and the sheets behave.

**What the owner exercised, corroborated by the server log:** a multi-stroke freehand drawing (12
`draw` messages), a marquee drag that selected 13 objects in one `select-multiple` (the token plus
every stroke), and moving the whole selection (`transform-object` stream). No errors, no rejected
origins. Reported as "everything worked and felt perfect… exactly as I would expect".

All CSS pixel figures in this document are arithmetic on values read from source, not browser
measurements; the Press Start 2P 1em-advance assumption underlies the B4 and B8 width estimates.
The layout numbers were separately confirmed by in-browser measurement during implementation.
