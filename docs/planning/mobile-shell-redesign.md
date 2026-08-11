# Mobile shell redesign — the navigation model, and M4

**Owner decision, 2026-08-09.** A mobile DM **gets a full menu** (arc §5 Q3, answered). It should
be **a separate screen** rather than another sheet stacked over the map, and more broadly: _"a more
mobile-focused usable UI over the RPG of it"_ — where the JRPG chrome and mobile usability
conflict, usability wins. Swipeable screens and pull-down drawers were named as the shape to aim
for.

This document is the model that answers that, plus the slices. It supersedes the single "M4" entry
in [mobile-authoring-arc.md](./mobile-authoring-arc.md) §4, which assumed one slice and a
`MobileMapEditSheet`. Everything else in the arc doc still stands.

Every architectural claim in §3 was checked against the code on 2026-08-09 at `dev` = `c7d83f8f`.
Nothing here is inferred from the arc doc, whose line numbers are from 2026-08-01 and are stale.

---

## 1. The model — one map, one surface, one mode

The mobile shell has exactly **three presentation kinds**, and which one a feature gets is decided
by _whether you need to see the map while using it_ — not by how it was built on desktop.

| kind       | geometry                                           | map visible? | what belongs here                                |
| ---------- | -------------------------------------------------- | ------------ | ------------------------------------------------ |
| **Sheet**  | bottom, capped by `--mobile-sheet-offset` (M3)     | yes          | tool palette, selection, drawing, map-edit tools |
| **Screen** | full height, opaque, own sticky header with a Back | no           | Party, Dice, Log, Help, **DM**                   |
| **Mode**   | no panel of its own — it re-purposes the dock      | **fully**    | map authoring                                    |

**Sheets are for things you operate _against_ the map. Screens are for things you read.** The
current shell gets this wrong in both directions: the roll log is a full-screen takeover built out
of a desktop draggable window, while the party list is a right-edge drawer, and help is a sheet
tall enough that it needed its own cap. One rule replaces three accidents.

**Map authoring is a Mode, and that is the load-bearing call.** The arc doc proposed a
`MobileMapEditSheet` (§4 M4). A sheet is wrong for it: authoring is the one activity where you must
see the whole canvas, and the M3 cap means a sheet big enough for 13 tools eats most of a 375×812
phone. So when map-edit is armed the **dock itself becomes the palette** and nothing covers the
map:

```
player dock      [ Party ][ Tools ][ Dice ][ Log ][ View ]
DM dock          [ Party ][ Tools ][ Dice ][ Log ][  DM  ]
map-edit mode    [ Exit  ][ Tool ▾][ Undo ][ Redo][ More ]
```

`Tool ▾` opens a short Sheet holding the tool grid — the M3 contract already caps and scrolls it.
The dock keeps the two actions you reach for constantly (undo/redo) at the bottom of the screen
where a thumb is.

### 1a. The dock stays five wide, and slot five becomes contextual

`theme/herobyte.css` pins `.mobile-action-dock` to `grid-template-columns: repeat(5, minmax(0, 1fr))`
and a sixth child **overlaps rather than wraps** — this is a settled owner decision
([[handoff §9]]), and it is why chat became a tab in the roll log and why S8's Help went into the
tool sheet. So the DM entry does not get a sixth button.

It gets slot five. **`View` today is a single action — `onResetCamera` — occupying a whole dock
slot** (`MobileFloatingControls.tsx:214-219`). Reset-camera moves to a small floating control on
the map (or into the tool sheet beside Snap), and slot five becomes `DM` for a DM and stays `View`
for a player. No CSS change, no sixth button, no fight with a settled decision.

### 1b. Gestures: no horizontal page-swipe on the map

The owner suggested "swipes left". **Do not implement it as a swipe across the canvas.** M2's touch
arbitration already spends both gestures: one finger is the active tool or a pan, two fingers are
the camera (`useTouchGestureArbiter`, and `useCamera` two-finger pinch is deliberately ungated
because it is the user's only escape). A horizontal page-swipe over the map would have to steal one
of those and would regress drawing and marquee select, both of which are iPhone-verified.

The mobile-native gesture that costs nothing: **a Screen is dismissed by dragging DOWN on its own
header handle**, which never touches the canvas. Same for a Sheet. Add the drag in M4a as
progressive enhancement over a Back/✕ button that always works — the button is the contract, the
drag is the affordance. (Do not make the drag the only exit: M3 has already paid twice for a panel
whose only exit was unreachable.)

### 1c. What this means for the JRPG look

Keep the palette, the pixel font for labels, and the frame treatment. Drop, on mobile only:
`DraggableWindow` dress for anything that is really a Screen (it is a desktop window pretending),
and the assumption that a panel must look like a floating window. A Screen is a plain full-height
surface with a header. Body copy already has permission to leave Press Start 2P
([[ux-cleanup-decisions]]); a Screen's prose should.

---

## 2. Slices

The arc doc's M4 is three slices, not one. M5–M8 are unchanged and still stack after these.

### M4a — the shell (no new features) — **SHIPPED 2026-08-09**

Four commits on `dev`: `5507e741` (the machine + the extraction), `a2f6737d` (MobileScreen; Log
and Party become Screens), then the slot-five commit and the docs commit that carries this note.
Two deltas against the plan below, both deliberate:

- **Reset-camera went into the tool sheet** (`◇ Recenter`, beside Snap) rather than floating on
  the map: every floating anchor collides with something (combat strip top-centre, sheets and the
  selection sheet bottom), and the sheet slot was free. A player's dock slot five is still `View`,
  so for players this is a second copy, not a move. The floating-control option remains open as
  §5's taste call.
- **The DM screen is a placeholder** ("the menu lands here next slice") — M4a ships the slot and
  the surface; M4b ships the menu.

`MobileLayout.tsx` ended at 219 lines; the machine's invariant is pinned by unit tests counting
`data-mobile-surface` roots and by the e2e log-screen spec. `mobile-shell.spec.ts` was split
(the slot-five specs live in `mobile-dock.spec.ts`) because e2e specs are NOT `__tests__`-exempt
from the 350 guard.

The keystone, and the analogue of what `--mobile-sheet-offset` did for M3: **one owner of "which
surface is open."** Today that state is split across two components with two different arbitration
mechanisms — `MobileLayout.closeAllSheets` (`:143-148`, covering entities/tools/dice/log) and
`MobileFloatingControls.closingHelp` (`:54-57`, covering help, which lives there only because
`MobileLayout` is at its line ceiling). A third surface added to that split is how S8's help sheet
ended up mounting _underneath_ the tool sheet.

- NEW `hooks/useMobileSurface.ts` — exactly one of `none | party | tools | dice | log | help | dm`
  is open, plus the map-edit `mode` flag as an orthogonal axis. Opening any surface closes the rest
  by construction rather than by four callbacks remembering to.
- NEW `layouts/mobile/MobileScreen.tsx` — full-height surface, sticky header, Back/✕ at ≥44px,
  optional drag-down-to-dismiss. One component, used by every Screen.
- Move **Log** and **Party** onto it. The roll log stops being a `DraggableWindow`
  (`MobileLayout.tsx:320-334`), which removes the whole mobile branch of that component from the
  mobile path — and with it the `.mobile-roll-log-panel` stacking-context workaround M3 had to add.
- Move reset-camera off dock slot five; make slot five contextual (`DM` when `isDM`).
- **`MobileLayout.tsx` is 347 of a 348 ceiling.** This slice must EXTRACT before it adds. Moving
  the surface state into the hook and the overlays into a `MobileSurfaces` child is what buys the
  room; do that first, not last.

**Done when:** every existing mobile surface behaves as before, opened from one state machine, with
nothing stacking; `mobile-shell.spec.ts` still green; a new test asserts at most one surface is
mounted at a time.

### M4b — the DM screen — **SHIPPED 2026-08-10**

Three commits on `dev`: `d11164e7` (`buildDMMenuProps` + desktop switches to it in the same
commit; the FloatingPanelsLayout characterization suite — MainLayoutProps in, mocked container
out — passed UNCHANGED, which is the byte-identical proof), `c4247e06` (the menu on the screen),
`9cc11906` (the fit guards). Deltas against the plan below, all deliberate:

- **`presentation: "window" | "content"` instead of a content extraction** — DMMenu's ~90 props
  made an extracted `DMMenuContent` pure churn; the shared-JSX variant costs 15 lines and keeps
  the desktop path byte-identical by construction.
- **`onSetInitiative` rides `buildDMMenuProps`' second argument** — it is a `useInitiativeSetting`
  hook result, not bag state; the doc's trace glossed that. Mobile owns its own hook instance
  (it has no entities panel to share one with).
- **The predicted phone treatment was NOT needed**: measured at both viewports, no tab view clips
  content — the views were written for a 360–500px window and ~351px of body is close enough.
  The measurement shipped as e2e guards (`mobile-dm.spec.ts`) instead of fixes.
- Two recorded non-goals: 44px floors INSIDE the tab views (the owner's deferred panel-wide pass,
  like chat's SEND) and alignment CAPTURE on a phone (arming works from the screen; capturing
  needs the map, so close-tap-reopen — an M4c candidate).

**This is much cheaper than it looks, and here is the verified reason.** `DMMenuContainer` takes
**50 props**, hand-wired in `FloatingPanelsLayout.tsx:225-297`. All 50 are derivable from
`MainLayoutProps` — checked one by one:

- **Direct**, already in the bag (18): `isDM`, `gridSize`, `gridSquareSize`, `gridLocked`, `camera`,
  `snapshot`, `sendMessage`, `toast`, `name`, `dmPassword`, `roomPassword`, `roomPasswordStatus`,
  `roomPasswordPending`, `alignmentPoints`, `alignmentSuggestion`, `alignmentError`, `mapStudio`,
  `onSaveAsPrivateTable`.
- **Renames**: `onToggleDM`←`handleToggleDM`, `onClearDrawings`←`handleClearDrawings`,
  `onGridSizeChange`←`setGridSize`, `onGridSquareSizeChange`←`setGridSquareSize`,
  `onSetMapBackground`←`setMapBackgroundURL`, `onSetRoomPassword`←`handleSetRoomPassword`,
  `onDismissRoomPasswordStatus`←`dismissRoomPasswordStatus`,
  `onSetPlayerStagingZone`←`playerActions.setPlayerStagingZone`,
  `alignmentModeActive`←`alignmentMode`, `onSelectPlayerTokens`←`selectPlayerTokens`,
  `onSetInitiative`←`setInitiative`, and the four alignment callbacks.
- **Derived from `snapshot`**: `fogEnabled`, `hasCompiledScene`, `mapBackground`,
  `playerStagingZone`; `onFogEnabledChange` is one `sendMessage` lambda.
- **Derived from `mapSceneObject` / `stagingZoneSceneObject`** (both in the bag): `mapLocked`,
  `stagingZoneLocked`, `mapTransform`, and the `onMapLockToggle` /
  `onStagingZoneLockToggle` / `onMapTransformChange` lambdas — copy them verbatim from
  `FloatingPanelsLayout.tsx:243-276`.
- **Toast helpers** `success/error/warning/info` come off `toast` (`ToastState`, `useToast.ts:61-64`).

So: NEW `features/dm/buildDMMenuProps.ts`, a pure `(MainLayoutProps) => DMMenuContainerProps`.
**Desktop switches to it in the same commit** — otherwise the mapping exists twice and every future
DM feature has to be wired in two places, which is exactly the drift that made the mobile gap
expensive in the first place. Then mobile renders `DMMenuContainer` inside a `MobileScreen` with a
**scrollable tab chip row** instead of the desktop tab strip (five tabs: Map / NPCs / Players /
Props / Session, 1 515 LOC of tab views, all reused unchanged).

**Traps:** `DMMenuContainer` is lazy-loaded on desktop (`FloatingPanelsLayout.tsx:27-29`) to keep
DM code out of the entry bundle — keep it lazy on mobile too or `build:check` will notice. The tab
views were written for a wide panel; expect the Map tab's numeric fields and the alignment wizard
to need the phone treatment, and remember §5 Q1's answer: **gate individual controls, not the whole
screen** — a tablet gets everything, a phone gets what fits.

**Done when:** a DM on a phone can reach background, grid size, fog, staging zone, NPC/prop CRUD,
session save/load, invite link and table password; desktop is byte-identical in behaviour.

### M4c — map-edit reachable: room + wall, end to end — **SHIPPED 2026-08-10**

Nine commits on `dev`, `2eb5ed8b` → `c58c5bbc`, each behind the full §2 gate and each
sabotage-proven. **The plan below was wrong about one load-bearing thing, and it cost the
most:**

- **"Room and Wall … already work through M2's touch path" is FALSE.** Touch never
  dispatched to map-edit at all — `useArmedTouchTool`'s own comment said so
  ("deliberately absent … needs a design pass, not a wire-up"), and `useStageEventRouter`
  repeated it. Every control M4c adds would have driven nothing. Arming it is
  `ceb73f63`, and it is armed for the **drag sub-tools only**: a touch DRAG generates no
  compat mouse events but a TAP generates a full pair, and the mouse path routes to the
  same handlers — so `place`/`scatter`/`light` would drop two stamps per tap. Room and
  wall are both drag tools, so the scope is unchanged; the restriction is recorded in the
  hook.
- **The 348 ceiling bit before anything could be added.** `useMapEditTool` was at 346, so
  the drag+preview came out first (`useMapEditDragPreview`, `2eb5ed8b`) and the
  cancellation second (`useMapEditCancel`, `f8af4af2`).
- **Slot five is `Cancel`, not the §1 sketch's `More`.** The sketch never said what More
  held, and the persistent CANCEL DRAG the plan asks for is the one control a DM can need
  mid-gesture. Recenter went into the sheet instead. The mechanism is a **counter**
  (`mapEditCancelSignal`) crossing from `MobileLayout` to `MapBoard`, because the dock and
  the canvas are siblings — and it works with the finger still down, since clearing the
  drag ref makes the release commit nothing.
- **Two bugs fixed that the traps pointed at but did not name.** Losing DM mid-edit left
  the table unusable on BOTH layouts (`86ab1fd0`) — every exit from map-edit is DM-gated
  while the mode's effects are not, so a revoked DM could neither author nor pan nor
  select. And the pre-existing Escape test could not fail: it never moved the pointer, so
  the drag was zero-length and `addWall` was uncalled either way.
- **Both M4b feed-ins landed** (`e29ced62`): arming alignment now yields the screen (the
  same edge as map-edit, but disarming deliberately does NOT — its Cancel lives inside the
  menu), and both layouts' lazy DM chunk got a scoped error boundary. M4b's own fit guard
  went red on the alignment change and was updated, not relaxed.
- **The resize-crossing rule: KEEP the mode** (`0251b9db`). It is now true rather than
  merely tolerated — each layout has a palette, so `useMapEditHotkeys` staying armed is
  consistent with a visible Undo. Encoded as a spec with no `?mobile` parameter, and
  sabotage-proven against the road not taken.

**Then its adversarial review found three defects in it** (41 agents, `agents_error: 0`; 17 raw,
8 survivors collapsing to 3), all in code this slice had just shipped, plus a fourth found by
closing the critic's gap:

- the de-elevation guard read `isDM`, which is DERIVED from the snapshot — and **any** socket close
  nulls the snapshot while the app stays mounted, so a phone locking its screen dropped the DM out
  of map-edit and left them out after the reconnect;
- `needsTheMap = mapEditMode || alignmentMode` has no RISING edge when alignment is already armed,
  so map-edit could still arm behind the DM screen — by the one path the edge could not see;
- the chunk-failure panel's "Try again" could never work: React caches a lazy payload's REJECTION
  permanently (verified against the installed react 18.3.1, not the docs);
- and the **⨯ ABORT button did nothing in the one case it exists for** — Chromium generates no
  compat click for a second finger during an active multi-touch sequence, so an `onClick` abort
  never fired during the drag it was there to abandon. It fires on `pointerdown` now.

Baselines after the fixes: e2e **122 passed / 0 failed / 3 skipped**, bundle **98.13 KB**, client
44 batches, shared 414, server 2057.

The arc doc's original M4, minus the shell work M4a already did.

- Forward the **17 `mapEdit*` props** (`MainLayoutProps.ts:120-154`) and `mapEditController`
  (`= mapStudio`) in `MobileLayout`. They are already computed on every mobile render and dropped
  on the floor; desktop passes the controller at `CenterCanvasLayout.tsx:297` and is **not**
  `isDM`-gated there, because the server gates the commands.
- Dock becomes the palette in map-edit mode (§1). `Tool ▾` opens the tool Sheet.
- START LIVE MAP reuses `useMapEditState.startLiveMap` verbatim.
- Room and Wall only. Both are drag-shaped and already work through M2's touch path.
- A persistent **CANCEL DRAG** control — today the only cancel is a capture-phase Escape
  (`useMapEditTool`), and on touch, releasing a finger commits.
- Decide and encode the **resize-crossing rule** (arc Blocker 2): `mapEditMode` survives a
  desktop→mobile resize today and `useMapEditHotkeys` stays armed, so Ctrl+Z on a keyboard-equipped
  tablet already edits the live map while the mobile layout is showing.

**Traps:** the controller **no-ops silently** without an active document — disable every tool until
`activeDocument.id === liveMapDocumentId`. A two-finger zoom mid-drag must **cancel**, not commit.
`MapBoard` kills token interaction in map-edit, so the selection Sheet becomes unreachable in the
mode — check a DM cannot get stranded.

_All three held._ The first is why Room and Wall do not RENDER until `isLive` (and why Undo/Redo
carry their own `isLive` gate — a DM with a Studio document open has `canUndo` true while `isLive`
is false, and an ungated Undo would rewind the wrong document). The second was already handled by
`useTouchGestureRouter`'s promotion rule, which needed only a real `cancel` to call — wiring it to
the COMMIT handler instead makes the e2e land a second wall, measured. The third turned out not to
strand: `transformMode` and `selectMode` are false in the mode by construction, so the selection
sheet cannot be orphaned behind it — but the de-elevation path DID strand, on both layouts, and is
fixed.

**Done when:** on a tablet, `DM → Map → START LIVE MAP → drag a room → drag a wall`, and a second
browser as a player sees fog respect the wall. — **Met**, driven end to end by
`apps/e2e/mobile/mobile-map-edit.spec.ts` at 820×1180, with the player in a second browser context
receiving the walls as `blocksVision: true` occluders.

---

## 3. Verified facts (do not re-derive these)

At `dev` = `c7d83f8f`, 2026-08-09 — **M4a has since moved four of these** (marked ✎):

- ✎ `MobileLayout.tsx` was **347 lines of a 348 ceiling**; M4a's extraction took it to **219**,
  and it still takes the whole `MainLayoutProps` bag — so anything the desktop has, mobile
  already receives. It is a plumbing problem, not a data one.
- `MainLayoutProps.ts` is **432 lines** and already over the guard (baselined; extract, don't grow).
- ✎ `MobileFloatingControls.tsx` owns the dock and the tool sheet; since M4a it owns **no state**
  (`useMobileSurface` arbitrates, `MobileSurfaces` hosts the panels).
- ✎ The dock's five buttons: Party, Tools, Dice, Log, then **View (player) / DM (isDM)**.
- ✎ The tool sheet holds nine: Move, Ping, Measure, Draw, Transform, Select, Snap, Recenter, Help.
  Since M4c the same sheet slot ALSO hosts the map-edit palette's sheet while the mode is armed
  (`MobileMapEditPalette`) — Start live map, then Room / Wall / Recenter.
- ✎ **Touch reaches map-edit's drag sub-tools since M4c** (`useArmedTouchTool`). The click ones
  (`place`, `scatter`, `light`) are still out, and the reason is now recorded rather than a
  general "needs a design pass": a tap's compat mouse events would double-fire them.
- ✎ `DMMenuContainer` ← `DMMenu` / `DMMenuTabs` / five tab views (`MapTab` 217, `NPCsTab`
  235, `PlayersTab` 243, `PropsTab` 140, `SessionTab` 127). Since M4b it renders from BOTH
  layouts — `FloatingPanelsLayout` (window) and `MobileSurfaces` (screen content) — through the
  same lazy chunk, fed by `buildDMMenuProps` in both cases.
- The M3 sheet contract: join the selector list in `herobyte.css` and a new sheet is capped,
  scrolls, and keeps a sticky header for free. `--mobile-sheet-offset` is the one variable.
- `mobile-chromium` (Pixel 7, scoped by testDir to `apps/e2e/mobile/`) is the harness. `?mobile=true`
  pins the layout. Touch drags need CDP, not Playwright's tap-only touchscreen —
  `apps/e2e/mobile/touch.helpers.ts`.

## 4. Traps carried in

- **Sabotage the assertion, not just the code.** M3's first occlusion check hit-tested a close
  button and stayed GREEN with the fix removed, because the intruder covered the panel's body and
  never its title bar.
- **A `position: fixed` element has a null `offsetParent`** — a "find everything under 11px" sweep
  built on it skips exactly the fixed chrome it is looking for. Use `checkVisibility()`.
- **content-box bit three times in M3 alone.** Assume it until measured.
- **Every browser here makes `vh == dvh == svh`**, so viewport-unit bugs are invisible to e2e,
  jsdom and the preview alike.
- **A flaky e2e exits 0.** Read the summary line, not the exit code.
- **`getByRole` matches the accessible name, not `title`** — and a name containing a common word
  will collide with a loose regex elsewhere (S8's `Close ⚂ ROLL LOG` broke a `/Log/i` locator).
- **Never write a repo file with Python's text mode** — it rewrites the file to CRLF and a CSS
  source-text test's `(?<!,)\n` lookbehind then silently matches a different rule.

## 5. Still open for the owner

- **Q4 (unchanged):** should there be an in-app "use the desktop layout" switch? Only `?mobile=false`
  exists and it is undocumented. A tablet DM who would rather have the real palette cannot ask for
  it. M4a is the natural place if the answer is yes.
- **The reset-camera control's new home** (floating on the map vs into the tool sheet) is a taste
  call worth one screenshot before it is settled. M4a put it in the tool sheet (`◇ Recenter`,
  beside Snap) because every floating anchor collides with existing chrome; the floating control
  is still on the table if the owner prefers it after seeing the screenshot.
