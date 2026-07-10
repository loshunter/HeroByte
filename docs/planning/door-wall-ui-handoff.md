# Door & Wall Authoring UI — Handoff

Written 2026-07-09 by the session that shipped Slice 4 (publish → first-class
image map, `2db24af8`). You are building the **door/wall placement UI** for the
Map Studio (the in-app battlemap editor) in `D:\HeroByte` (branch `dev`,
Windows/PowerShell; a Bash tool is also available). This handoff was assembled
from a **verified 5-agent recon sweep** (2026-07-09) — the `file:line` index in
§4 is checked; read the ranges it points to, then **stop searching**.

> **Read §1 before you plan anything.** The recon overturned the premise this
> feature was requested under. This is a MUCH smaller feature than "build a door
> system," and getting the mental model right first saves you a day.

---

## 0. Bootstrap — do in this order, then STOP exploring

1. **`docs/planning/renderer-endgame-playbook.md` §0 IN FULL.** This feature is
   *beyond* that doc's scope (it's not a renderer slice), but its **method is
   binding and battle-tested**: the slice loop (§0.2), the verbatim verify ritual
   (§0.3), the ADVERSARIAL REVIEW workflow (§0.4), hard invariants/traps (§0.5),
   conventions/commit trailers (§0.6), failure modes F1–F12 (§0.7). Follow it.
2. **This file** — the reframe (§1), the design + the deep tension (§2), the
   slice plan (§3), the verified context index (§4), the review workflow (§5),
   gotchas (§6), kickoff (§7).
3. `git log --oneline -4`; confirm `2db24af8` (Slice 4) and `f3422467` (its docs)
   are on `dev`. Also check `git status` for an **uncommitted secret-door fix**
   in `exportMapDocument.ts` — see §3, Slice 1: it is the SEED of this feature.
4. Do NOT re-run the recon. §4 is the map. Do NOT read the whole map-studio tree.

---

## 1. THE REFRAME — what you are NOT building (read this first)

The request was "a great, intuitive UI for door placement; doors are interactive
and need to animate; the map bakes to a static graphic." The recon found that
**almost all of that already exists**. Do not rebuild it. What's actually true:

- **There is NO door animation, and you don't need to build one.** `DoorsLayer`
  imports no animation clock and no `Konva.Tween`. Open/closed/locked/secret are
  four *static* Konva shape variants; a state change is a discrete React
  re-render triggered by the server's full-snapshot re-broadcast
  (`DoorsLayer.tsx:67-161`). Real interpolated swing animation is **net-new,
  OPTIONAL** work (an enhancement slice — §3 Slice 4), not part of the placement
  UI. Don't design the placement UI around a tween that doesn't exist.
- **The live table door system is DONE.** Doors render live from
  `snapshot.compiledScene.doors` in `DoorsLayer` (mounted `MapBoard.tsx:535`),
  are clickable (invisible hit-line → `toggle-door` / DM-alt `set-door-state`),
  and are pixel-aligned to the published raster via the same camera+transform
  Groups as `MapImageLayer`. **You will not touch `DoorsLayer`** for the
  placement feature.
- **The command path is DONE and tested.** `controller.addWall(MapWallDraft)` /
  `controller.addDoor(MapDoorDraft)` (`useMapStudioActions.ts:175/192`) build a
  valid element and dispatch an `add-element` command. They have **zero non-test
  callers** — that gap IS the missing UI.
- **Placed doors/walls already RENDER and are SELECTABLE in the editor.**
  `MapStudioElementPreview.tsx:140-168` draws walls (`<polyline>`) and doors (a
  state-colored `<line>`, open = dashed) with `doorStroke()` per state; the
  `MapStudioCanvas` `<g role=button>` selects them under the Select tool. **No
  new studio render/selection code is needed.**
- **A complete authoring FORM already exists but is orphaned.**
  `MapStructureEditor.tsx` is a finished numeric add-wall/add-door form
  (structure kind, layer, x/y/width/rotation/state, blocks-flags, ADD →
  `onAddWall`/`onAddDoor`). It is **never mounted** (zero JSX usages). Cannibalize
  it or wire it — don't reinvent its logic.

**What is ACTUALLY missing (the whole feature):**
1. **Doors double-draw into the raster.** They bake as a static line AND draw
   live via `DoorsLayer` → exclude ALL doors from the raster (§3 Slice 1).
2. **No on-canvas placement input.** Add Wall/Door tools that feed the existing
   `addWall`/`addDoor` (§3 Slice 2).
3. **No door-state authoring control.** The inspector can't set a door's
   state/width (§3 Slice 3 — the one part that touches shared+server).

---

## 2. The design + the deep tension (static raster ↔ live doors)

The map publishes as a **static raster PNG** (Slice 4: baked at publish, uploaded
by reference, rendered as the "map" image). Doors are **live + interactive** —
they must render from `compiledScene`, never from the baked image. Walls are
**static and invisible at the table** — they only feed fog/movement. So the
authoritative rule this feature establishes:

- **DOORS → live only.** Exclude every door element from the baked raster; the
  table's `DoorsLayer` is the SOLE door renderer. This removes the double-draw
  AND the secret-door leak in one stroke (the server already role-strips secret
  doors from player snapshots — `model.ts:292`).
- **WALLS → keep baking.** There is **no `WallsLayer`**; the baked `<polyline>`
  is the only way a wall is ever seen. Walls carry no per-role secrecy, so baking
  is safe. (Compiled walls also feed fog/vision, independently, via
  `getVisionBlockingSegments`.)

**The publish/compile flow (how a placed door reaches the table):** the DM places
a door element in the MapDocument → **Publish** runs `compileScene(document)`
server-side (`MapStudioMessageHandler.ts:94`) → `compiledScene.doors` broadcasts
→ `DoorsLayer` renders it live. Runtime open/close (`toggle-door`) and DM
lock/reveal (`set-door-state`) are a **separate** channel that mutates the
already-published `compiledScene` by door id (= the element id, verbatim). So the
placement UI sets the *authored initial* state; runtime toggling is the existing
table system. **Gotcha:** re-publishing re-runs `compileScene`, which **resets
runtime door states to authored values** (`MapStudioMessageHandler.ts:94`) — flag
this in the UX (§6).

---

## 3. The slice plan (one slice per session, RED-first, playbook §0.2)

This is a **multi-slice feature.** Do ONE slice per session; commit each green.
Order matters: the raster fix is the safety foundation, tools are the core ask,
the inspector is the protocol-touching finale.

### Slice 0 (prerequisite) — the secret-door fix — DONE ✅ (`4737b33c`)
The seed change in `exportMapDocument.ts` `visible()` that excludes *secret*
doors from the raster was committed standalone as `4737b33c` (it was uncommitted
when this handoff was written). Slice 1 below generalizes it to *all* doors.

### Slice 1 — Doors render live only (raster exclusion) — DONE ✅ (`96557d42`)
Shipped on `dev`, client-only, careful self-review (no adversarial workflow —
pure client behavior change with strong unit coverage, playbook §0.4). What
landed: `visible()`'s `playerVisibleDoor` (secret-only) became `bakesToRaster =
element.type !== "door"` — DoorsLayer is now the sole door renderer, killing the
double-draw and subsuming the secret-door leak. The `door` branch of
`renderElement` is dead for the raster but left in place (the authoritative gate
is `visible()`; editing it would perturb byte-parity for other elements). Walls
still bake. RED-first: the secret-door export test was flipped to assert an
ordinary door no longer bakes (+ the door-only `#c99b55` stroke absent), and a
new test guards that a wall still bakes its `<polyline>`. Gates green in-session:
targeted (33) → typecheck → `pnpm lint` (frozen intact) → structure (exit 0,
file 343 LOC) → full `pnpm test` (31 batches) → bundle (entry 69.18 KB, unchanged).

Original design (historical):
Generalize the door exclusion in `exportMapDocument.ts` `visible()` (§4) from
"exclude secret doors" to **"exclude ALL doors"** — one line. Keep walls baking.
- **RED-first:** flip the existing `exportMapDocument.test.ts` secret-door test
  (§4) so an *ordinary* door is now `.not.toContain`'d, rename it; **ADD** a new
  positive test that a WALL element DOES bake (`#e9d8a6` polyline) — this guards
  against an over-broad exclusion that drops walls.
- The `door` branch of `renderElement` becomes dead code for the raster; leave it
  (the authoritative gate is `visible()`) to avoid touching the byte-parity SVG
  contract for other elements.
- **Verify:** the FULL ritual is not needed (client-only, no shared/server), but
  run targeted tests → typecheck → `pnpm lint` (frozen gate — the door-less
  render is byte-identical; a *baked-door* golden, if any, would change, so read
  the diff) → structure → full `pnpm test` → bundle. Careful self-review.

### Slice 2 — Wall + Door placement tools [client-only, the core ask]
Mirror the Room tool's **two-point drag** (`useMapStudioCanvasController.ts:264`)
— it is the canonical pattern. Steps (all file:line in §4):
1. Add `"wall"` and `"door"` to the `StudioTool` union; add two `<ToolButton>`s
   to the left rail.
2. Destructure `addWall`/`addDoor` from the controller in `MapStudioWorkspace`
   (currently NOT destructured) and thread them into the
   `useMapStudioCanvasController` prop bag + interface.
3. **Wall tool:** clone the room drag — pointerdown seeds a drag `{start,end}`
   (snapped), move updates `end`, pointerEnd calls
   `addWall({ layerId: wallsLayer.id, x1,y1,x2,y2, blocksMovement:true, blocksVision:true })`.
   Gate on `saving` like the room path (a real trap — see §6). Draw a live
   preview line as a canvas overlay (like the roomDrag preview), NOT by mutating
   element props each frame (the preview is memoized).
4. **Door tool — TWO-POINT DRAG (owner-confirmed 2026-07-09).** Reuse the wall
   loop, convert on commit — `x,y=start`, `width=distance(start,end)`,
   `rotation=atan2(dy,dx)` in degrees, `state:"closed"` (NOT `"open"` — an open
   door blocks nothing, see §6), `blocks*:true`. A door is exactly one segment;
   this yields a correctly angled door on a wall for free. (The one-click
   alternative was considered and rejected — it leaves orientation to the
   inspector.)
5. Resolve the placement layer by **kind** (`layers` → `kind === "walls"`), NOT
   via `selectedAsset`/`pickPlacementLayer` (that path is asset-driven; walls/
   doors aren't assets). The `walls` layer (`mapStudioTypes.ts:147`) is
   `visible:true, locked:false` by default — **CONFIRMED unlocked** (`defaultLayer`
   returns `{…,locked,…}` with no inversion), so `requireEditableLayer`
   (`mapStudioValidation.ts:77`) is NOT a blocker. (One recon agent misread this
   as locked — it isn't.)
- Doors/walls already render + select in the editor, so once the tools feed
  `addWall`/`addDoor`, placement is visible immediately. RED-first: test the
  controller's pointer→draft mapping (the geometry math is the risky part).

### Slice 3 — Door-state inspector control [PROTOCOL — shared+server; REQUIRED review]
The inspector must let the DM set a placed door's **state** (open/closed/locked/
secret) and **width**. Both live in `element.data`, and **there is no update path
for `data`** today (this is the hard blocker):
- `MapElementUpdate` (`mapStudioTypes.ts:139`) omits `data`.
- The `update-element` zod validator is `.strict()` with only layerId/locked/
  hidden/transform (`mapStudioValidators.ts:217`).
- The reducer `updateMapElement` (`mapStudio.ts:246`) shallow-spreads — adding
  `data` would REPLACE `element.data` wholesale, not merge.

**Fork — DECIDED (owner-confirmed 2026-07-09): option (B), a dedicated
door-state authoring command.** New wire message + validator + reducer + test,
scoped to door state/width only; keeps `update-element`'s `.strict()` validator
locked (narrow blast radius for a security-sensitive slice). Rejected (A) —
widening `update-element` with a typed `data` partial (deep-merge) — because it
loosens the strict validator across every element type's merge semantics. Then
add a
`element.type === "door"` section to `MapElementInspector` (a state `<select>`
reusing the `doorStroke` enum order + a width input, min>0 **max 1000** to match
the server validator). **Door rotation is already editable via the transform
inspector — do NOT add a second rotation control.**
- This slice edits `packages/shared` (rebuild it!) + the server validator → it is
  **PROTOCOL/SECURITY**: the FULL verify ritual (rebuild shared first, server
  tests back in) and the **REQUIRED adversarial review** (§5) apply. The
  security spine below is the review's target.

### Slice 4 (OPTIONAL) — Door open/close animation at the table [enhancement]
If the owner wants a real swing/slide instead of the instant state swap: add
interpolation to `DoorsLayer` driven by `useAnimationFrameIndex`
(`features/render/useAnimationClock.ts`, the same clock TerrainLayer uses — never
add a second timer, playbook §0.5). Net-new; not required for placement.

---

## 4. Verified `file:line` context index (5-agent recon, 2026-07-09)

Read the ranges; don't re-search. **Bold = the load-bearing ones.**

### Live table door system — DONE, do not modify (except Slice 1 exclusion is elsewhere)
- **`apps/client/src/features/map/components/DoorsLayer.tsx:44`** `DoorsLayer` — renders `compiledScene.doors`; two nested Groups (camera `:44` + `mapTransform :45`) = pixel-aligned to the raster; `:67` `DoorSprite` (secret dashed seam `:83`; closed frame+leaf `:96`; open hinge stubs `:104`; locked square `:117`); **`:131` invisible hit-line** (only listening node) → `:71` `handleActivate` (DM+alt → `onSetDoorState(lockCycle)`; else `onToggleDoor`); `:157` `lockCycle`.
- `apps/client/src/ui/MapBoard.tsx:535` `<DoorsLayer>` mount (in bg `<Layer>` `:508`, after MapImageLayer `:518`/GridLayer `:525`); `:398/:405` `handleToggleDoor`/`handleSetDoorState` → `sendMessage({t:"toggle-door"|"set-door-state"})`; `:616` `<FogLayer>` (non-DM + fogEnabled).
- `apps/client/src/features/map/components/FogLayer.tsx:36` `getVisionBlockingSegments(compiledScene)` — **the ONLY consumer of walls; walls are never drawn**.

### Shared model / compiler / messages — `packages/shared/src`
- **`mapStudioTypes.ts:78`** `MapDoorElement` `data:{width,state:"open"|"closed"|"locked"|"secret",blocksMovement,blocksVision}` (position/rotation from `MapElementBase.transform`, `:31-45`); **`:69`** `MapWallElement` `data:{points:{x,y}[],blocks*}` (polyline, no state); **`:139` `MapElementUpdate`** (layerId/locked/hidden/transform ONLY — the Slice-3 blocker); `:143-150` `DEFAULT_MAP_LAYERS` (**`:147` `walls` layer**, kind `"walls"`, zIndex 30, `locked:false`/`visible:true`).
- **`sceneCompiler.ts:68`** `compileScene` (skips `element.hidden :74`; ignores layer visibility); **`:91` door branch** (`CompiledDoor.id = element.id` verbatim; `start=toWorld(t,0,0)`, `end=toWorld(t,width,0)`); `:80` wall branch (id `${element.id}#${index}`, N points → N-1 segments); `:139` `doorBlocksMovement/Vision` (state≠"open" && blocks); `:162` `getVisionBlockingSegments`; `:177` `toWorld`; `:14-24` `CompiledDoor`/`CompiledWallSegment`/`CompiledDoorState`.
- `index.ts:562` `toggle-door`/`set-door-state` client messages; `:366` `RoomSnapshot.compiledScene`.
- `mapStudioValidation.ts:46` `sanitizeElement` wall/door; `:77` `requireEditableLayer` (throws on locked layer); `mapStudio.ts:232` `updateMapElement` reducer (`:246` shallow spread — Slice-3 deep-merge site).

### Server security spine (Slice 3 review target) — `apps/server/src`
- **`ws/handlers/SceneMessageHandler.ts:14`** `handle`; `:19` `set-door-state` (**DM-only**); `:36` `toggleDoor` (locked+!DM throws; player-usable by design); **`:45` `requireDoor`** (secret door ⇒ same "Unknown door" error as a missing one for non-DM).
- **`domains/room/model.ts:292`** `toSnapshot` compiledScene role-strip (DM intact `:297`; **players: secret doors removed from `doors[]` and re-injected as anonymous wall segments `:301-315`**); `:136` `toSnapshot(state, isDM=true, uid)` — the `=true` default is a trap (§6).
- `domains/room/service.ts:190` per-recipient broadcast (isDM from `state.players`); `ws/handlers/MapStudioMessageHandler.ts:85` publish handler (`:94` `compileScene`, DM-gated `:38`); `ws/messageRouter.ts:302` scene dispatch (**isDM server-derived, never client-trusted**); `middleware/validators/mapValidators.ts:62` toggle/set-door-state validators; `domains/room/scene/visionFilter.ts:88` vision cache keyed on door states.

### Studio authoring UI — the plug points (Slices 2 & 3)
- `map-studio/components/MapStudioWorkspace.types.ts:3` **`StudioTool`** union (add `"wall"`,`"door"`); `:6` `RoomDrag` (the two-point shape).
- `map-studio/components/MapStudioWorkspace.tsx:234-244` tool-rail `<ToolButton>`s; **`:31-56` controller destructure (missing `addWall`/`addDoor` — add them)**; `:126` `useMapStudioCanvasController(...)` prop bag.
- **`map-studio/components/useMapStudioCanvasController.ts:264-302`** the room two-point drag (THE pattern to clone); `:230/:280` `eventToMapPoint`; `:107/:267/:296` `snapPointToGrid`; `:199-217` `stampAtPoint`/`scatterAtPoint` (single-click placers); `:23-40` the prop-bag interface.
- **`map-studio/components/MapElementInspector.tsx:35`** (edits transform/layer/hidden/locked; `:110` `onUpdate`; add a `type==="door"` section here); `map-studio/components/MapStudioElementPreview.tsx:140` wall polyline, `:153-168` door line + `:261` `doorStroke` (**already renders — reuse the colors**); `MapStudioCanvas.tsx:159` select-tool hit-target.
- **`map-studio/useMapStudioActions.ts:175/192`** `addWall`/`addDoor` (call these); `map-studio/elementBuilders.ts:72` `createWallElement`/`createDoorElement`; `map-studio/types.ts:54-73` `MapWallDraft`/`MapDoorDraft` (client-only shapes); `MapStructureEditor.tsx:16` the orphaned form (cannibalize).

### Raster exclusion (Slice 1) — `apps/client/src/features/map-studio`
- **`exportMapDocument.ts:313` `visible()`** (the `playerVisibleDoor` line ~`:318` — change to exclude ALL doors); `:267-270` wall `renderElement` (**KEEP baking**); `:271-273` door `renderElement` (becomes dead); `:42-54` element pipeline; `:167` `rasterizeMapDocument`; `:24` `RenderMapDocumentSvgOptions`.
- `publishRaster.ts:20` `rasterizeAndUploadMapBackground` (`:26` `rasterizeMapDocument(doc,"image/png",{omitGrid:true})`).
- **`__tests__/exportMapDocument.test.ts` — the secret-door test** (flip to all-doors; ADD a wall-bakes test).

### Door-state data path (Slice 3) — the three sites to widen
- `packages/shared/src/mapStudioTypes.ts:139` `MapElementUpdate` (allow `data`); `apps/server/src/middleware/validators/mapStudioValidators.ts:217` `update-element` zod (`.strict()`); `packages/shared/src/mapStudio.ts:246` reducer (deep-merge `data`). Add-element door/wall validators: `mapStudioValidators.ts:105-132` (**door width ≤ 1000, state enum; wall points 2..5000; scaleX/Y strictly positive**).

---

## 5. Adversarial review — REQUIRED for Slice 3 (protocol/security). Paste-ready.

Run AFTER all suites pass; NEVER run `pnpm test` while it's live (playbook F6).
Only 2/2-upheld findings get fixed; verify each yourself against the code first.

```js
export const meta = { name: 'door-ui-slice3-review',
  description: 'Review the door-state authoring path (shared+server data update)',
  phases: [{ title: 'Find' }, { title: 'Verify' }] }
const FINDINGS_SCHEMA = { type:'object', required:['findings'], properties:{ findings:{ type:'array',
  items:{ type:'object', required:['title','file','description','failureScenario','severity'],
    properties:{ title:{type:'string'}, file:{type:'string'}, line:{type:'number'},
      description:{type:'string'}, failureScenario:{type:'string'},
      severity:{type:'string', enum:['critical','major','minor']} } } } } }
const VERDICT_SCHEMA = { type:'object', required:['refuted','reasoning'],
  properties:{ refuted:{type:'boolean'}, reasoning:{type:'string'} } }
const CONTEXT = `Repo D:\\HeroByte (Windows). Review the UNCOMMITTED working-tree changes (git diff HEAD +
untracked) for the door-state authoring slice: the Map Studio inspector can now set a placed door's
state (open/closed/locked/secret) + width, which required widening the update-element data path across
packages/shared (MapElementUpdate + updateMapElement reducer) and the server update-element zod
validator (mapStudioValidators.ts). RULES: READ-ONLY. Do NOT run tests/builds. Report only defects with
a concrete failure scenario; no style nits. Suites already pass. INVARIANTS: door state is
SERVER-authoritative; set-door-state is DM-only; secret doors are role-stripped for players in
model.ts toSnapshot (removed from doors, re-injected as anonymous walls); isDM is never client-trusted;
authored door state ('secret') must never leak to players via any path (raster is separate — doors are
now excluded from it).`
const LENSES = [
 { key:'update-path-integrity', prompt:`${CONTEXT}\nLENS — the widened update-element data path: does the
   new data patch DEEP-MERGE (not replace) element.data? Can it corrupt a non-door element's data, change
   an element's type, or set an invalid door state/width (server caps width<=1000, state enum)? Does the
   zod .strict() widening still reject unknown keys? Does the reducer preserve requireEditableLayer + the
   lock guard? Old client -> new server and new client -> old server compatibility.` },
 { key:'player-safety', prompt:`${CONTEXT}\nLENS — secret-door authoring safety: can a DM author or edit a
   door to 'secret' and have it leak to players anywhere (snapshot, compiledScene, the raster, an
   update-element broadcast, an error message)? Is the authored 'secret' state still stripped by
   model.ts:292 for players after this change? Can a non-DM client send an update-element that sets a
   door's state (bypassing set-door-state's DM gate)? Confirm the raster excludes ALL doors (Slice 1).` },
 { key:'state-lifecycle', prompt:`${CONTEXT}\nLENS — authored vs runtime door state: authored state is the
   INITIAL published state; runtime toggle-door/set-door-state mutate compiledScene by door id (=element
   id). Does editing a door's authored state/width keep the element id stable (so runtime state maps on
   re-publish)? Does re-publish reset runtime states (compileScene overwrite) in a way the UX must warn
   about? Any id collision between authored and runtime paths?` } ]
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

## 6. Gotchas the recon surfaced (save yourself the time)

- **No animation exists — don't design around one.** Doors are discrete state
  swaps (`DoorsLayer`). If the owner wants a swing, that's Slice 4 (optional).
- **Default door state MUST be `"closed"`, not `"open"`.** An open door blocks
  neither movement nor vision (`doorBlocksMovement/Vision` short-circuit on
  `state==="open"`, `sceneCompiler.ts:139`). A door defaulted to `"open"` does
  nothing until toggled — looks broken.
- **`addWall`/`addDoor` do NOT gate on `saving`** — every other pointer path does
  (`if (saving) return`). Your Wall/Door commit MUST add the same guard, or fast
  input queues commands that drop (there's a known command-queue drop under load
  — `task_85318e86`).
- **Placement layer is resolved by KIND, not asset.** Walls/doors aren't
  asset-driven; `pickPlacementLayer(document, asset)` won't yield the walls
  layer. Use `layers` → `kind === "walls"`. The walls layer is `locked:false`
  (confirmed) — no unlock dance needed.
- **Door = ONE segment (`start` → `start+width`, then rotate).** Not a polyline.
  Walls ARE polylines (N points → N-1 compiled segments; wall ids get a `#index`
  suffix, door ids don't).
- **No `data` update path.** Changing a placed door's state/width needs the
  Slice-3 shared+server widening; `MapElementUpdate` today is transform/layer/
  hidden/locked only. Rotation is already editable via transform — reuse it.
- **`transform.scaleX/scaleY` must be strictly POSITIVE** (sanitizer + zod). You
  cannot flip a door with negative scale — use rotation. **Door width capped at
  1000** server-side.
- **Re-publish RESETS runtime door state** (`compileScene` overwrite). If a DM
  opened a door at the table then re-publishes, it snaps back to authored state.
  Warn in the UX; don't "fix" it silently.
- **Secret-door wire fingerprint (flag for the review, don't fix blindly):** a
  secret door re-emitted as a player wall keeps `door.id` (no `#index`), unlike
  real walls (`model.ts:306` vs `sceneCompiler.ts:82`) — a subtle tell. Pre-
  existing; decide with the owner whether it's in scope.
- **`toSnapshot(state, isDM=true, …)` defaults isDM to true** — any new
  snapshot/broadcast caller that forgets the arg leaks secret doors. Pass the
  real isDM explicitly.
- **Rebuild `@herobyte/shared` after ANY shared edit** (Slice 3) or server/client
  see stale `dist` (playbook §0.5).

---

## 7. Kickoff — one prompt per slice (owner pastes to start a session)

Start with Slice 1; do not batch slices. Suggested first kickoff:

> You are building the **Door/Wall placement UI** for HeroByte's Map Studio in
> `D:\HeroByte` (branch `dev`). Read `docs/planning/renderer-endgame-playbook.md`
> §0 IN FULL (its METHOD binds), then `docs/planning/door-wall-ui-handoff.md` IN
> FULL — especially §1 (the reframe: doors don't animate, the command path +
> editor rendering already exist, a form is orphaned) — then execute **Slice 1
> only** (doors render live only / raster exclusion) from §3, RED-first, using
> the §4 context index instead of searching. Binding rules: one slice this
> session; RED-first tests; explicit staging only (never `git add -A`); never
> `pnpm add/install`; keep files <350 LOC; the frozen SVG goldens stay
> byte-identical for non-door elements. First check `git status` for the
> uncommitted secret-door fix (§3 Slice 0) and reconcile it. Stop and confirm the
> Slice-2 door-tool fork (single-click vs two-point drag) and the Slice-3 data-
> path fork (widen update-element vs a dedicated door-state command) with the
> owner before coding those slices. Slice 3 is PROTOCOL/SECURITY — full verify
> ritual + the REQUIRED §5 adversarial review + owner sign-off before it lands.
