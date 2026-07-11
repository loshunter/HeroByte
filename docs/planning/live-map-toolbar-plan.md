# Live Map Toolbar — Execution Plan

**Status:** READY FOR EXECUTION · Authored 2026-07-11 by the senior dev after full-pipeline recon · Rev 2 (owner decision: the Studio RETIRES — see Phase 2)
**Mission:** Replace the separate Map Studio editor with map authoring on the live table. A DM picks the Map tool, drags a rectangle, and a room exists — procedural floor, blocking walls, live fog — on every player's screen, instantly. Drag a hallway, hit POPULATE, and it fills with set dressing algorithmically. Doors drop onto walls. Terrain paints like the brush tools. When the arc completes, the Studio *scene* is deleted; its engine (documents, commands, compile, undo) lives on as the invisible backend of the map tool palette. The world gets built as the story happens.
**Vision alignment:** This is the bridge between M3 (The Forge) and M4 (The Living World) in VISION.md. Pillar 3's invariant — *every repeated DM action takes ≤2 inputs* — is exactly "drag a rectangle, get a room." The founding rule holds: **tools emit MapDocument elements, never rasters**; the compiled scene remains the only live geometry. Mid-session generation (M4) will ride the same live-bound-document rails this plan lays.

---

## 0. How to execute this plan (read this first)

This plan follows the small-verifiable-slices method: each slice is the smallest end-to-end change that can be built, tested, and committed independently. Rules for the executing model:

1. **Do the slices in order.** Later slices assume earlier ones landed. Do not start a slice until the previous one's *Done when* checklist is fully green.
2. **Read only the Context Capsule files.** Every slice lists exactly which files to read (with line anchors) and quotes the contracts you must match. If you find yourself grepping the repo to figure out how something works, STOP — the answer is either in the capsule, in §2–§4 of this doc, or you've drifted off-plan. Re-read, don't wander.
3. **Line anchors are from 2026-07-11.** Earlier slices shift later files' line numbers slightly. Anchors get you to the right neighborhood; match on the quoted code, not the number.
4. **Never exceed 348 lines in a NEW file** (§4.1). Split proactively.
5. **Write the slice's tests in the same commit.** Test names and coverage targets are specified per slice.
6. **Run the slice's Verify block before claiming done.** All commands run from repo root `D:\HeroByte`.
7. **When a Trap or Escalate-if condition fires, stop and report** rather than improvising. A wrong guess in this codebase ships silent unit bugs and info leaks; a paused slice costs nothing.
8. **Commit per slice to `dev`** with a message in the repo's style (`feat: <what> — <flavor>`).

---

## 1. Product goal

### 1.1 What the DM experiences when this ships

- A new **🏗️ Map** button in the header toolbar (DM-only, next to ✏️ Draw Tools). Clicking it opens a floating **Map Tools** palette (same JRPG style as the drawing toolbar) and puts the canvas in map-edit mode.
- First use: the palette shows **START LIVE MAP** — one click creates and binds a live map document. From then on the room has a live map; the palette shows the tools.
- **Room tool:** drag a rectangle on the canvas → on release, the rectangle gets a floor (chosen terrain family: wood, stone, grass, dirt, path) and a wall perimeter. Fog, vision, and movement blocking update for every player within a broadcast tick. One Ctrl+Z removes the whole room.
- **Wall tool:** two-point drag places a straight wall. **Door tool:** two-point drag places a door (renders as the existing door sprite; players can click it; it creaks — that all already works). **Terrain brush:** paints terrain cells live. **Eraser:** removes terrain cells.
- **Undo/Redo** buttons + Ctrl+Z/Ctrl+Y operate on the map document (server-side history, shared between DMs).
- Phase 2 completes the picture: **an asset picker** places tiles and stamps (Alt free-place, R rotate, seeded scatter), the **hallway tool** drags corridors with open ends, **POPULATE** fills a room or hallway with deterministic set dressing in one click (one undo), and compact **layers/inspector popovers** cover the remaining Studio chrome. Players see all of it live — tiles, stamps, shapes, public text — with GM notes and hidden elements stripped server-side.
- Players never see the toolbar, wall lines, or the document — they see floors appear, doors materialize, and fog reshape. Secret doors stay disguised (that contract already exists and is tested).
- Map Studio keeps working until parity is reached (S13), then the Studio scene is deleted. Its engine remains the backend forever.

### 1.2 Scope boundaries

**Phase 1 (S1–S8)** builds the live rails: mode, palette, walls, doors, rooms, terrain, undo. **Phase 2 (S9–S13)** reaches Studio parity — live element rendering for players, tile/stamp placement, the hallway + populate tools, layers/inspector, exports — and then **deletes the Studio scene**. The Studio stays fully functional until S13; parity first, removal last.

**Never in this arc (deferred, recorded in §7):**
- No wall-vertex editing / moving placed walls (needs a new `update-element` data path).
- No terrain gameplay semantics (difficult terrain etc. — VISION says later; walls do the blocking).
- No mobile map-edit UI (desktop-only; mobile keeps viewing everything, authoring nothing — explicit decision).
- No hex/iso terrain painting (square grids only, same constraint the Studio brush has today).
- No auto-merge of overlapping walls when rooms adjoin (overlapping segments both block — harmless, accepted).

---

## 2. Architecture — the one decision everything hangs on

### 2.1 The insight from recon

The Map Studio engine is already a **document/command engine with a live-table bridge**, and every hard part already exists:

- The client controller (`MapStudioController`) is instantiated **unconditionally at App level in the live session** — [App.tsx:286](apps/client/src/ui/App.tsx) — with server messages already routed to it (`useServerEventHandlers.ts:207-218`). A live toolbar drives this existing instance. **Never call `useMapStudio` a second time** — two queues would revision-conflict each other.
- Commands (`map-studio-command`) are DM-gated, zod-validated, revision-serialized, dedupe-cached, and undo-stacked server-side. The toolbar sends ordinary commands; **the server needs no changes to accept them.**
- Publish already "compiles, never flattens": `compileScene(document)` → walls/doors/lights the server enforces. There is a dormant-but-complete **`backgroundMode: "elements-only"`** data path where terrain rides the snapshot as RLE data and `TerrainLayer` renders it procedurally at the table — no raster anywhere. Live mode revives this path.
- All live consumers (TerrainLayer, DoorsLayer, FogLayer, server movementBlocking, server visionFilter) treat the map transform as **optional with identity fallback** (verified: `movementBlocking.ts:21` uses `?.transform`, `visionFilter.ts:42` falls back to the raw point, client layers destructure `mapTransform ?? {}` with defaults). A live-authored map has **no raster background → no "map" scene object → document space ≡ world space.** This kills the hardest coordinate problem before it starts.

### 2.2 The design

**One new server concept: the live-bound document.** `RoomState.liveMapDocumentId` names the document whose edits auto-compile into the live scene:

```
DM toolbar drag ──► existing map-studio-command (add-element / paint-terrain / place-room)
                        │  (validated, DM-gated, revisioned — all existing)
                        ▼
            MapStudioService.apply()  (existing)
                        │
                        ▼  NEW: if command.documentId === state.liveMapDocumentId
            recompile: compiledScene = preserveDoorRuntimeStates(prev, compileScene(doc))
                       mapTerrain    = deriveMapTerrain(doc, "elements-only")
                       gridSize      = toLiveGridSize(doc.grid.size)
                        │
                        ▼
            broadcast room snapshot (existing, per-recipient filtered:
            players get secret doors disguised, fog-filtered tokens — all existing)
```

No raster is ever produced in live mode. Publish-with-raster (the Studio button) keeps working unchanged for prep-time maps.

**Door-state preservation (the landmine recon found):** today a republish rebuilds `compiledScene` from the document, which **resets every door's runtime open/closed state** (door state lives in `state.compiledScene.doors[].state` and is mutated in place by `SceneMessageHandler`). Under live authoring, every wall edit would slam every open door shut. Fix (S1): when recompiling, carry forward each surviving door's runtime state by element id, EXCEPT doors whose authored state the triggering command just changed (`update-door`, or newly added doors).

**Client: one new ToolMode, one palette, three hooks.** `"map-edit"` joins the ToolMode union and behaves exactly like `"draw"`: a header toggle, a floating palette (`MapEditToolbar`, lazy-loaded, DM-only), tool hooks self-gated on the mode flag, previews in the existing non-listening overlay layer. Sub-tools (room/wall/door/terrain/erase) are palette state, NOT ToolModes — mirroring how DrawingToolbar's freehand/line/rect/circle work.

**Coordinates:** screen → world via existing `toWorld` (camera), world → document via `inverseTransformScenePoint(mapObject?.transform ?? IDENTITY)`. Since live-authored maps have no map object, this is the identity in the normal case, but writing it through the helper keeps the tools correct even when a DM binds a document onto a room that also has a raster background from an earlier publish.

### 2.3 Why not alternatives (recorded so nobody relitigates)

- **New bespoke wall/door messages outside Map Studio** (like `draw`): would fork map state into two systems, lose undo/revisions/validation, and orphan the Studio. Rejected.
- **Auto-raster republish per edit:** client-side bake is an SVG render + canvas decode + PNG encode + upload per edit — janks the DM's browser on big maps (recon-measured pipeline in `exportMapDocument.ts:167-205`). Rejected.
- **Editing the compiled scene directly** (like `set-door-state` does): loses the document as source of truth, breaks undo and Studio interop. Rejected. (`toggle-door`/`set-door-state` stay as the *runtime* channel; documents stay the *authoring* channel.)

---

## 3. The three coordinate spaces (memorize this)

| Space | Used by | Convert |
|---|---|---|
| **Screen px** | Konva Stage pointer events | → world: `toWorld(sx, sy)` = `{(sx-cam.x)/cam.scale, (sy-cam.y)/cam.scale}` — [useCamera.ts:65-68](apps/client/src/hooks/useCamera.ts) |
| **World px** | camera plane; drawings; token render (`cell*gridSize + gridSize/2`) | → document: `inverseTransformScenePoint(mapTransform ?? IDENTITY, point)` — [sceneGeometry.ts:112-124](packages/shared/src/sceneGeometry.ts); identity when no raster map object exists (always true for toolbar-created live maps) |
| **Document px** | MapDocument element transforms, wall points, door width, compiledScene geometry, mapTerrain lattice, fog bounds | → terrain cell: `floor((p - grid.offsetX) / grid.size)` — the exact math in [useTerrainBrush.ts:21-39](apps/client/src/features/map-studio/components/useTerrainBrush.ts); → snapped px: `snapPointToGrid(point, document.grid)` — [snapToGrid.ts:10-22](apps/client/src/features/map-studio/snapToGrid.ts) |

Plus **grid cells** for tokens/props only: `token.x/y` are cells on the LIVE lattice (`state.gridSize`, origin world 0,0). Tools in this plan never touch token coords; you only care that `state.gridSize` is set from `toLiveGridSize(document.grid.size)` at compile time, so keep the live document's `grid.size` equal to the room's `gridSize` at creation (S2 does this) and the lattices coincide.

**Transform math discipline:** `sceneCompiler.toWorld` (179-193) and `sceneGeometry.transformScenePoint` (90-100) are deliberately byte-identical (scale → rotate(degrees) → translate). If you ever think you need new transform math, you are wrong — use the helpers.

---

## 4. Golden rules (violating any of these fails CI or ships a bug)

1. **350-LOC guard:** every NEW `.ts/.tsx` file must stay ≤348 lines (`loc >= 350` fails; trailing newline counts). Enforced by `pnpm lint:structure:enforce` (separate from `pnpm lint`!). Grandfathered god files (MapBoard.tsx 669, App.tsx 830, useStageEventRouter.ts 321…) may receive the few-line wirings this plan specifies, but ALL new logic goes in new files.
2. **Stale shared dist:** after ANY edit under `packages/shared/src`, run `pnpm --filter @herobyte/shared build` — server and client resolve `@herobyte/shared` from `dist/`. Forgetting this makes typecheck/tests fail confusingly or, worse, pass against stale types.
3. **Validator registry is a hard gate:** any new WS message type must be registered in `apps/server/src/middleware/validation.ts` (messageValidators map, ~176-199) or the server **silently drops it** before routing (console.warn only). New map-studio command types must be added to the zod discriminated union in `mapStudioValidators.ts` (~175-258, `.strict()` — extra fields rejected).
4. **FROZEN test:** never edit/rename/delete `apps/client/src/features/map-studio/__tests__/terrainRenderParity.frozen.test.ts` (sha256-locked by `pnpm lint`). If it goes red, your product code broke terrain render parity — fix the code.
5. **One command = one undo step.** Batch client-side (stroke accumulators, `add-elements`, the new `place-room`). Never emit per-pointer-move commands.
6. **DM gating is triple:** UI render gate (`isDM &&`), mode-activation gate, server gate. The server gate already exists for all `map-studio-*` (handler throws for non-DM). Copy the render-gate pattern from Header.tsx:185-194.
7. **Bundle budget:** 175KB gzip entry chunk. The palette component must be `React.lazy` path-imported (copy CenterCanvasLayout.tsx:36-40); never re-export heavy components through barrels reachable from entry (see the warning comment in `features/map-studio/index.ts:2-5`). Lazy chunks are free.
8. **Wire budgets:** inbound WS hard-rejects >1MB pre-parse; snapshots warn >750KB (test-enforced via SnapshotCompressionGuard.test.ts). Terrain paints cap at 16384 cells/command, `add-elements` at 5000 — the plan's payloads all fit.
9. **Every stage-event tool self-gates on its mode flag** (the router calls every handler on every event), and every new mode must be added to the `shouldPan` negation (useStageEventRouter.ts:239 AND the touch copy at 288) or left-drag pans the camera mid-edit.
10. **Determinism:** terrain visuals key off `valueNoise/hash2` on integer lattices. No `Math.random()`, no time-based seeds, anywhere in render code.
11. **Verification ritual per slice:** package tests → `pnpm typecheck` → `pnpm lint` → `pnpm lint:structure:enforce` → full `pnpm test` → (UI slices) `pnpm test:e2e`. E2E is serial, ports 5175/8788, DM password `FunDM`, room password `Fun1`.

---

## 5. The slices

> Sizing legend: 🟢 small (≤~150 new LOC) · 🟡 medium (~150-400) · 🔴 large (400+, the cap — split further if you exceed it)

---

### S1 🟡 — Server: the live-bound document (auto-compile on command)

**Goal:** a room can bind one map document as "live"; every applied command to that document recompiles the scene (preserving door runtime states) and broadcasts. Pure backend — provable by tests alone, no UI.

**Deliverable:** new message `map-studio-set-live`, new `RoomState.liveMapDocumentId`, recompile-on-command, `preserveDoorRuntimeStates`, snapshot exposure of the binding to DMs, persistence, contract tests.

**Context capsule (read these, nothing else):**
- **Broadcast path (verified by the senior dev — do not re-derive):** the handler's return value flows `messageRouter.ts:290-300` (`mapStudioResult` → `handleRouteResult`) → `handleRouteResult` at `messageRouter.ts:369-391` → `routeResultHandler.handleResult` → debounced (16ms) per-recipient room snapshot broadcast + save. This is the exact path the publish case already uses, so returning `{ broadcast: true, save: true }` from the command case gives you a full room broadcast for free.
- `apps/server/src/ws/handlers/MapStudioMessageHandler.ts` (174 LOC) — whole file. The `map-studio-command` case is at 64-72; the publish case at 85-96 is your recompile template:
  ```ts
  state.mapBackground = message.background;
  state.mapTerrain = deriveMapTerrain(document, message.backgroundMode);
  state.gridSize = toLiveGridSize(document.grid.size);
  state.gridSquareSize = document.grid.squareSize;
  state.compiledScene = compileScene(document, this.now());
  return { broadcast: true, save: true };
  ```
  `deriveMapTerrain` (143-163) returns terrain data only for mode `"elements-only"` — call it with that literal.
- `packages/shared/src/sceneCompiler.ts` (193 LOC) — whole file. `CompiledScene`/`CompiledDoor` types (14-58), `compileScene` (68-131), `toLiveGridSize` (135-137).
- `apps/server/src/domains/room/model.ts` 32-55 (RoomState fields — add `liveMapDocumentId?: string` beside `mapTerrain`) and 273-336 (`toSnapshot` — see how `compiledScene` is attached per-recipient; secret doors are disguised at 292-320 with `${door.id}#0` ids — DO NOT TOUCH that block).
- `apps/server/src/ws/handlers/SceneMessageHandler.ts` (56 LOC) — how runtime door state is mutated in place; this is the state you must preserve across recompiles.
- `apps/server/src/middleware/validation.ts` 176-199 — the registry where `"map-studio-set-live"` must be registered.
- `apps/server/src/middleware/validators/mapStudioValidators.ts` 322-335 — the publish validator, template for the new one.
- `packages/shared/src/index.ts` 549-566 (ClientMessage union — add the new member) and 349-372 (RoomSnapshot — add `liveMapDocumentId?: string`).
- `apps/server/src/domains/room/persistence/StatePersistence.ts` — find the selective field save/load lists; `compiledScene`/`mapTerrain`/`mapBackground` are already persisted; mirror them for `liveMapDocumentId`.
- Test conventions: `apps/server/src/ws/__tests__/visionChannels.contract.test.ts` (fake sockets `{readyState:1, send:vi.fn()}`, real Container, frame inspection) and `apps/server/src/domains/__tests__/roomModel.test.ts` (the secret-door disguise tests — extend, don't weaken).

**Changes:**
1. `packages/shared/src/index.ts`: add `| { t: "map-studio-set-live"; documentId: string | null }` to ClientMessage (next to map-studio-publish, ~561); add `liveMapDocumentId?: string` to RoomSnapshot.
2. NEW `packages/shared/src/scenePublish.ts` (~60 LOC): `export function preserveDoorRuntimeStates(previous: CompiledScene | undefined, next: CompiledScene, authoredDoorIds: ReadonlySet<string>): CompiledScene` — for each door in `next`: if `previous` had a door with the same id AND the id is not in `authoredDoorIds`, keep the previous door's `state`. Also `export function authoredDoorIdsOf(command: MapStudioCommand, document: MapDocument): Set<string>` — `update-door` → `{elementId}`; `add-element`/`add-elements`/(later `place-room`) → ids of door-type elements in the command; everything else (incl. undo/redo) → empty set. Export both from `packages/shared/src/index.ts`. **Rebuild shared after.**
3. `apps/server/src/ws/handlers/MapStudioMessageHandler.ts`: extract a private `recompileLiveScene(roomId, document, authoredDoorIds)` doing the five-line publish block minus `mapBackground`, using `preserveDoorRuntimeStates` and `deriveMapTerrain(document, "elements-only")`. Call it (a) in the `map-studio-command` case after a successful apply when `state.liveMapDocumentId === command.documentId` → return `{ broadcast: true, save: true }`; (b) in the new `map-studio-set-live` case: null → clear the field, `{broadcast: true, save: true}`; string → verify the document exists (`this.service.get` throws if not — catch and send a `map-studio-error`-style reply consistent with 115-129), set the field, recompile with empty authoredDoorIds. If this file threatens 350 lines, move `deriveMapTerrain` + `recompileLiveScene` into a new `apps/server/src/ws/handlers/mapStudioLiveScene.ts`.
4. Validator: new entry in `mapStudioValidators.ts` (`documentId: id.nullable()` — reuse the `id` helper, `.strict()`), registered in `validation.ts` as `"map-studio-set-live"`.
5. `model.ts`: add the RoomState field; in `toSnapshot`, attach `liveMapDocumentId` **only when `isDM`** (players have no use for it; don't grow their payload).
6. `StatePersistence.ts`: persist/restore the field.

**Tests (new file `apps/server/src/ws/__tests__/liveMapBinding.contract.test.ts`, plus unit tests in `packages/shared/src/__tests__/scenePublish.test.ts`):**
- shared unit: door state preserved by id; authored door takes the new state; removed doors drop; added doors keep authored state; undo preserves runtime states.
- contract: DM binds doc → players receive compiledScene + mapTerrain in the next snapshot; DM sends `add-element` wall command → player snapshot's walls grow WITHOUT any publish message; a door opened via `toggle-door` stays open after an unrelated wall `add-element`; a `"secret"` door added live is disguised in the player payload with a `#0`-suffixed id (reuse the assertion style of roomModel.test.ts:92-121); non-DM sending `map-studio-set-live` is rejected; unbound rooms behave exactly as before (regression).
- Extend `SnapshotCompressionGuard.test.ts` with a live scene (200 walls + 40 doors + 2000 terrain cells) staying under the 750KB gzip budget.

**Design decision (recorded — do not relitigate): binding does NOT clear `mapBackground`.** If a room already has a raster-published map, clearing the background would delete the "map" scene object and snap all compiled geometry from the map object's (possibly DM-moved) transform to identity — walls would jump relative to tokens. So bind leaves the raster in place; the cosmetic cost is that terrain already baked into the raster may render doubled under live terrain edits. The intended flow is binding FRESH documents; a DM who wants to clear an old raster uses the existing MapBackgroundControl in the DM menu. Note this caveat in the toolbar's START LIVE MAP flow (S2 shows a one-line hint when `snapshot.mapBackground` is set).

**Verify:** `pnpm --filter @herobyte/shared build && pnpm --filter @herobyte/shared test && pnpm --filter vtt-server test && pnpm typecheck && pnpm lint && pnpm lint:structure:enforce`

**Done when:** all above green + full `pnpm test` green.
**Traps:** don't touch the secret-door disguise block except to read it; `deriveMapTerrain` returns `undefined` when the terrain layer is hidden or terrain is empty — that's correct, TerrainLayer just unmounts; `service.get` throws for unknown docs — handle, don't crash the socket.
**Escalate if:** you find `toSnapshot` or `StatePersistence` diverging from the recon description, or the recompile needs >O(elements) work.

---

### S2 🔴 — Client: map-edit mode + wall tool, end to end (ARCHITECTURE-PROOF SLICE)

**Goal:** the thinnest full vertical: DM clicks 🏗️ Map → palette opens → START LIVE MAP (creates/binds a document) → drags a wall → wall exists in the live scene; a player's fog changes. After this slice the architecture is proven; everything later is more tools on the same rails.

**Context capsule:**
- The pattern you are cloning, end to end: `apps/client/src/hooks/useDrawingTool.ts` (240 LOC, whole file — THE template: self-gating handlers, `toWorld`, ref-accumulated preview with rAF flush, send on mouseup), `apps/client/src/hooks/useDrawingStateManager.ts` (276 LOC — the glue-hook shape: takes `sendMessage`+mode+`setActiveTool`, returns `toolbarProps`+board props), `apps/client/src/features/drawing/components/DrawingToolbar.tsx` (279 LOC — DraggableWindow palette template).
- Mode plumbing: `components/layout/Header.tsx` 11-19 (ToolMode union — add `"map-edit"`) and 185-194 (the DM-gated button pattern); `hooks/useToolMode.ts` 110-149 (derived booleans — add `mapEditMode`; note the global Escape listener at 123-136); `layouts/TopPanelLayout.tsx` 135 (palette mount point); `layouts/props/MainLayoutProps.ts` 91-110 (tool state block); `layouts/CenterCanvasLayout.tsx` 245-287 (MapBoard prop forwarding); `ui/MapBoard.types.ts` 23-59 (MapBoardProps); `ui/MapBoard.tsx` 244-261 (tool-hook mount point), 325-360 (useStageEventRouter wiring), 365-373 (cursor + tokenInteractionsEnabled), 628-652 (overlay Layer for previews).
- Arbitration: `hooks/useStageEventRouter.ts` 175-218 (onStageClick priority chain — map-edit must be handled ABOVE the "no tools active → clear selection" branch at 192-201), 239 + 288 (`shouldPan` negations — add `!mapEditMode`).
- Controller: `features/map-studio/types.ts` 76-124 (MapStudioController — you call `createDocument`, `openDocument`, `updateGrid`, `addWall`, `undo`, `redo`; `activeDocument` holds the doc; **every action no-ops while `activeDocument` is null**); `App.tsx` 286 (the ONE controller instance; it's already in layoutProps at ~788).
- Pure geometry to reuse verbatim: `features/map-studio/components/wallDoorDrafts.ts` (84 LOC, whole file), `features/map-studio/snapToGrid.ts` (75 LOC, whole file), `features/map-studio/elementBuilders.ts` 72-112.
- Coordinate hop: §3 of this doc. Get `mapObject` the way MapBoard already does (`useSceneObjectsData` provides it; see MapBoard.tsx ~176-191) and apply `inverseTransformScenePoint(mapObject?.transform ?? {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, worldPoint)`.
- Lazy pattern: `layouts/CenterCanvasLayout.tsx` 36-40; z-index/storageKey conventions in `DrawingToolbar.tsx` (DraggableWindow zIndex 200).
- Konva-mock test pattern: `features/map/components/__tests__/DoorsLayer.test.tsx` 14-33.

**Changes (all new files ≤348 LOC):**
1. `Header.tsx`: add `"map-edit"` to ToolMode; add DM-gated `🏗️ Map` button (toggle semantics).
2. `useToolMode.ts`: derive `mapEditMode`.
3. NEW `apps/client/src/features/map-edit/useMapEditState.ts` (~150): palette state — `activeSubTool: "room" | "wall" | "door" | "terrain" | "erase"` (this slice: wall only, but type the union now), selected floor family, wall/door defaults (`blocksMovement: true, blocksVision: true`, door `state: "closed"`); the **bind flow** — SEQUENCING MATTERS because every controller action no-ops until the server's `map-studio-document` reply activates the document: `startLiveMap()` — if `snapshot.liveMapDocumentId` exists → `controller.openDocument(it)` and done; else `pendingLiveId = controller.createDocument("Live Map", 8192, 8192)` and STOP — then an effect watches for `controller.activeDocument?.id === pendingLiveId` and only THEN sends `sendMessage({t:"map-studio-set-live", documentId: pendingLiveId})` followed by `controller.updateGrid({ size: currentRoomGridSize })` (set-live first so the grid command rides the S1 live-recompile hook and the table lattice self-corrects — §3). Also an effect: when `snapshot.liveMapDocumentId` is set and `controller.activeDocument?.id !== it`, `openDocument(it)` (rebind after reload).
4. NEW `apps/client/src/features/map-edit/MapEditToolbar.tsx` (~180): DraggableWindow palette (unique storageKey `"map-edit-toolbar"`), JRPGButton sub-tools, START LIVE MAP state, undo/redo buttons wired to controller, close button (`setActiveTool(null)`). Shows a small "LIVE" badge when bound.
5. NEW `apps/client/src/features/map-edit/useMapEditTool.ts` (~180): the stage-event hook (clone useDrawingTool's shape): self-gates on `mapEditMode && activeSubTool === "wall"`; mousedown → screen→world→document→`snapPointToGrid` → start drag; mousemove → update drag end (snapped) in a ref + rAF-flushed preview state; mouseup → `commitSegmentDrag("wall", layersById, drag, controller.addWall, controller.addDoor)` (reuse verbatim; build `layersById` from `controller.activeDocument.layers`). Guard: skip commit when `controller.saving` (the Studio's rule — addWall does not self-gate). Escape while dragging cancels the drag: window keydown listener with `capture: true` + `stopImmediatePropagation()` so the global Escape-clears-tool listener doesn't fire mid-drag.
6. NEW `apps/client/src/features/map-edit/MapEditPreviewLayer.tsx` (~120): Konva preview inside the overlay Layer — dashed wall line + endpoint dots (port the SVG SegmentDragPreview look from `MapStudioCanvas.tsx` 278-306 to Konva); nested Groups `<Group cam><Group mapTransform ?? identity>`; stroke widths divided by `cam.scale`.
7. Wire-through: `MapBoard.types.ts` + `MapBoard.tsx` (mount hook near useDrawingTool ~244-261, render preview layer in the overlay Layer ~628-652, add `mapEditMode` to `tokenInteractionsEnabled` logic at 373 — token dragging off during map-edit), `useStageEventRouter.ts` (thread handlers; add `!mapEditMode` to BOTH shouldPan sites 239/288; handle map-edit above the clear-selection branch in onStageClick), `MainLayoutProps.ts`, `CenterCanvasLayout.tsx`, `TopPanelLayout.tsx` (lazy mount: `{mapEditMode && isDM && <Suspense><MapEditToolbar …/></Suspense>}` with `React.lazy` path import), `App.tsx` (instantiate the glue hook, pass props). Desktop only: do NOT add to MobileFloatingControls (decision §1.2).
8. `useCursorStyle` (hooks/useCursorStyle.ts): crosshair in map-edit mode.

**Tests:**
- `features/map-edit/__tests__/useMapEditState.test.ts`: bind flow (creates doc + updates grid + sends set-live; reuses existing binding from snapshot; rebind-on-reload effect).
- `features/map-edit/__tests__/useMapEditTool.test.ts`: inactive-mode no-op; snapped two-point drag calls `controller.addWall` with document-space draft (assert exact numbers incl. a non-identity mapTransform case); saving-gate skips commit; Escape cancels.
- `features/map-edit/__tests__/MapEditPreviewLayer.test.tsx`: konva div-mock; preview geometry + `/cam.scale` widths.
- Extend `useStageEventRouter` tests if present; otherwise assert shouldPan behavior via the tool test (drag while mapEditMode must not pan — unit-test the flag wiring).

**Verify:** `pnpm --filter herobyte-client test && pnpm typecheck && pnpm lint && pnpm lint:structure:enforce && pnpm --filter herobyte-client build:check` (bundle budget) then full `pnpm test` + `pnpm test:e2e` (existing suites must stay green — especially drawing-tools and map-navigation specs, which exercise the router you touched).

**Done when:** manual proof — `pnpm dev` both apps, DM at 5174: 🏗️ → START LIVE MAP → drag wall → open a second browser as player with fog on → fog respects the wall. Plus all suites green.
**Traps:** the controller no-ops silently without an active document — the palette must disable tools until `activeDocument` matches the binding; do not forget BOTH shouldPan sites; do not import MapEditToolbar statically from any entry-reachable file (bundle gate will catch it — `build:check` locally).
**Escalate if:** the wall appears offset from the cursor (unit bug — stop, write down the numbers at each hop of §3, compare) or the e2e router specs break in ways the shouldPan change doesn't explain.

**🔎 SENIOR REVIEW GATE:** after this slice, request adversarial review before continuing. The remaining slices stack on these rails.

---

### S3 🟢 — Door tool + DM walls overlay

**Goal:** doors drag onto the map exactly like walls (the compiled door then renders + toggles via the EXISTING DoorsLayer — zero new door rendering); DMs get a subtle walls overlay so they can see what they've built (players never do).

**Context capsule:** S2's files; `wallDoorDrafts.ts` (doorDraftFromDrag — width=hypot, rotation=atan2 degrees, authored `"closed"` on purpose: an "open" door neither blocks nor renders usefully); `DoorsLayer.tsx` (41-57 — how compiled doors render; door colors per state); `MapBoard.tsx` 535-544 (DoorsLayer mount + handlers already send toggle-door/set-door-state); `sceneCompiler.ts` 91-103 (door element → compiled segment from (0,0) to (width,0) through the transform).
**Changes:** extend `useMapEditTool` sub-tool `"door"` (same drag machine, `commitSegmentDrag("door", …)` routes it); NEW `apps/client/src/features/map-edit/WallsOverlayLayer.tsx` (~100): DM-only, renders `snapshot.compiledScene.walls` as thin lines (Konva, nested cam+mapTransform groups, `listening={false}`, subtle color e.g. `#e9d8a6` at 0.35 opacity, widths `/cam.scale`); overlay toggle button in the palette (default ON in map-edit mode, OFF otherwise); mount in MapBoard beside DoorsLayer gated `isDM && (mapEditMode || wallsOverlayPinned)`.
**Tests:** door drag → `controller.addDoor` with width/rotation asserted from a diagonal drag; WallsOverlayLayer div-mock render (players/`isDM=false` renders nothing); door state preservation already covered by S1.
**Verify:** client tests + typecheck + lint + structure + full test.
**Done when:** manual: place a door in a wall gap, player clicks it, it creaks open (existing foley), fog updates through the opening; DM sees wall lines, player doesn't.
**Traps:** doors author `"closed"` — do not "fix" that to open; don't render walls for players "just for debugging".

---

### S4 🟡 — The Room tool + `place-room` command (the headline)

**Goal:** drag a rectangle → floor + wall perimeter, ONE undo step. This needs the one new command type, because floor is terrain (`paint-terrain`) and walls are elements (`add-elements`) and no cross-type batch exists (recon-verified).

**Context capsule:**
- New-command recipe (three mandatory sites, from recon): (1) union + dispatcher: `packages/shared/src/mapStudioCommands.ts` 35-55 (add `| (MapCommandBase & { type: "place-room"; cells: TerrainPaintCell[]; elements: MapElement[] })`) and the switch at 100-139; (2) mutation: `packages/shared/src/mapStudio.ts` — study `paintTerrain` (206-246) and `commit` (253-265); the element-add path lives in `mapStudioElements.ts` (`addMapElementsBatch`, see 13-121 incl. `requireEditableLayer`); (3) zod: `mapStudioValidators.ts` 174-258 — clone the `paint-terrain` cells schema (240-257) + the element schema used by `add-elements`, `.strict()`, caps cells ≤16384 / elements ≤5000.
- **The one-commit subtlety:** `paintTerrain` and `addMapElementsBatch` each call `commit` (revision+1 each). The new mutation must apply BOTH then commit ONCE (one revision bump = one undo step). Refactor pattern: extract the non-committing core of each (e.g. `paintTerrainCells(document, cells)` returning the new terrain, and the batch-add element logic), have the existing functions call core+commit, and the new `placeRoom(document, cells, elements, timestamp)` call both cores + one commit. All-or-nothing: validate everything before mutating anything.
- Geometry: `mapStudioWorkspaceUtils.ts` 137-148 `roomBoundsFromDrag` (inclusive cell bounds from a drag); wall perimeter = ONE `MapWallElement` whose `data.points` is the closed rect polyline `[TL, TR, BR, BL, TL]` (5 points, zeroed transform — `elementBuilders.ts:72-89` pattern) → compiles to 4 segments `${id}#0..3`; floor cells = every cell in bounds with the selected family's assetId (`"terrain:wood-floor"` etc. — ids in `features/map-studio/starterTiles.ts` 27-132).
- Server-side: NOTHING new — `place-room` flows through the existing `map-studio-command` path; S1's recompile hook must include door ids from `place-room` elements in `authoredDoorIdsOf` (add the case; v1 rooms place no doors, but the command type allows elements generally — keep it correct).
- MAX_ROOM_TILES=5000-style clamp: cap the room floor at 16384 cells; toast + refuse beyond (JRPG toast pattern — see how MapStudioWorkspace surfaces errors, or the simpler `error` state on the palette).

**Changes:** shared (3 sites + `authoredDoorIdsOf` case + **rebuild dist**), client room sub-tool in `useMapEditTool` (rect drag preview via MapEditPreviewLayer — dashed rect + dimensions label like "12 × 8"), a `buildRoomCommand(bounds, family, layers)` pure helper in NEW `features/map-edit/roomBuilder.ts` (~100), palette floor-family picker (5 families from VILLAGE_TERRAIN: grass/dirt/path/stone-floor/wood-floor).
**Tests:** shared: `placeRoom` one-revision bump, all-or-nothing on locked layer, undo restores both terrain and elements in one step; zod acceptance/rejection (extra field, >16384 cells); client: drag → exact cells + 5-point perimeter asserted for a known rect; roomBuilder pure tests (1×1 room, huge-room clamp).
**Verify:** shared build + shared/server/client tests + typecheck + lint + structure + full test.
**Done when:** manual: drag a rect → wood floor + walls + fog instantly on the player screen; ONE Ctrl+Z removes it all (once S7 lands hotkeys — until then the palette's UNDO button).
**Traps:** the commit-once rule (two revision bumps = two undo steps = failed slice); layers: floor cells need no layer, wall element needs the walls-kind layer id (`findWallsLayer` logic in wallDoorDrafts.ts 54-59); don't forget the validator or the server silently rejects with `command-rejected`.
**Escalate if:** the mutation refactor in `mapStudio.ts` can't keep both files under 350 LOC — propose the file split before doing it.

---

### S5 🟢 — Live terrain brush + eraser

**Goal:** paint grass/dirt/path/floors cell-by-cell on the live table; erase likewise. One stroke = one undo.

**Context capsule:** `useTerrainBrush.ts` (49 LOC, whole file — reuse it VERBATIM: it only needs `activeDocument` + `paintTerrain` and already dedupes, caps at 16384, and flushes one command per stroke); its cell math + bounds gate reject cells outside the document; stroke preview cells come back from the hook (`strokeCells`) — render them in MapEditPreviewLayer as translucent cell rects (Studio's look: 0.55 opacity, erase = `#10121a`); the saving-gate asymmetry rule (Studio controller comments): terrain strokes must NOT gate on `saving` mid-stroke (a command ack mid-drag would freeze the brush) — only the commit already-in-flight queue handles ordering.
**Changes:** `"terrain"` + `"erase"` sub-tools in `useMapEditTool` (pointer streams feed `addStrokePoint(docPoint, familyAssetId | null)`); mount `useTerrainBrush` inside the map-edit glue hook with `controller.activeDocument` + `controller.paintTerrain`; preview wiring; palette terrain-family picker doubles for the brush (same 5 families + water can be included — it animates at the table via the existing clock).
**Tests:** stroke accumulation → exactly one `paintTerrain` call with deduped cells; erase sends `assetId: null`; out-of-document cells rejected; preview cells rendered (div-mock).
**Done when:** manual: paint a dirt path across the floor live; player sees it appear on release; water shimmer animates at the table (elements-only path renders it via TerrainLayer + shared clock — already built).
**Traps:** the brush paints per-sample with no interpolation (fast strokes gap — same as Studio; accept it, note as polish); don't gate stroke accumulation on `saving`.

---

### S6 🟡 — Editor-grade procedural terrain at the table

**Goal:** the live table currently renders terrain as flat fills (recon-verified: TerrainLayer → `drawTableTerrain` → flat/atlas core only). Port the procedural field bake (bumpy grass/dirt/path, crisp wood/stone floors) so live-authored maps look like the Studio/exports.

**Context capsule:** `features/map-studio/components/MapStudioCanvasUnderlay.tsx` 164-206 — THE pattern to port: bake cached on (terrain-layers identity, gridSig `size|offsetX|offsetY`), re-bake per edit never per frame, blit with `imageSmoothingEnabled=false`, non-field families (water) still draw via the core with the animation frame; `features/render/proceduralTerrainSurface.ts` 73-119 + 268-283 (`bakeProceduralTerrain` — surface-agnostic, returns null past 8192px/32Mpx caps → caller MUST fall back to the flat core so terrain never vanishes); `features/map/components/TerrainLayer.tsx` (126 LOC, whole file) + `terrainSceneFunc.ts`; the FROZEN parity test (§4.4) pins `buildTerrainRenderLayers` SVG strings — you are not touching that function, only the Konva sceneFunc path.
**Changes:** NEW `features/map/components/terrainBake.ts` (~120): the cache + bake orchestration (pure, testable, takes structured layers + grid + returns canvas or null); TerrainLayer: field families blit the baked canvas inside the existing nested groups; non-field families + null-bake fallback keep the current `drawTableTerrain` path. Keep TerrainLayer ≤348 (it's 126 now; if the wiring pushes it, split the sceneFunc).
**Tests:** recordingContext-based: bake called once per terrain change, not per frame; fallback path when bake returns null; water still animates (frame-keyed draw calls); cache invalidates on gridSig change. The frozen parity test must stay green untouched.
**Done when:** manual: wood floor renders with crisp plank edges at the table, grass painted next to dirt shows the bumpy seam; zooming stays sharp (`imageSmoothingEnabled=false`); performance sane on a 100×100 painted map (bake once, pan/zoom smooth).
**Traps:** never re-bake inside the Konva sceneFunc (it runs per frame); the bake canvas is in document px — blit at the bake's originX/originY inside the mapTransform group; VILLAGE_TERRAIN identity is part of the cache key discipline.

---

### S7 🟢 — Undo/redo routing, hotkeys, polish

**Goal:** Ctrl+Z/Ctrl+Y hit the map document while map-edit is active (and ONLY the map document); Escape ends drags before it ends the mode; the palette exposes undo/redo/erase states properly.

**Context capsule:** `hooks/useKeyboardShortcuts.ts` 261-284 (verified by the senior dev): Ctrl+Z is two prioritized branches — (1) drawing undo, gated `drawMode && drawingManager.canUndo` (no conflict with map-edit: modes are exclusive), then (2) **DM selection-undo, gated only `isDM && canUndoSelection`** — THIS branch fires in any mode and is the double-fire risk; Ctrl+Y (279-284) is drawMode-gated (no conflict). Also: `features/map-studio/components/useStudioHotkeys.ts` (the scoped-listener alternative pattern); the S2 Escape-capture listener; four keydown listeners coexist repo-wide with no registry — your changes must be additive and mode-gated.
**Changes:** in the map-edit glue hook, a window keydown listener (mode-gated): Ctrl+Z → `controller.undo()`, Ctrl+Y/Ctrl+Shift+Z → `controller.redo()`. Then add a `mapEditMode` guard to useKeyboardShortcuts' **selection-undo branch** (skip priority 2 when map-edit is active) so exactly one handler acts. Write the double-fire test first. Also: `canUndo/canRedo` from the controller drive palette button disabled states; toast on `map-studio-error` surfaced from `controller.error`.
**Tests:** with mapEditMode on, Ctrl+Z produces exactly one `{type:"undo"}` command and zero `undo-drawing` messages; with drawMode on, behavior unchanged (regression); Escape mid-drag cancels the drag and does NOT clear the tool; Escape idle clears the tool (existing useToolMode behavior).
**Done when:** all suites green; manual sanity of the hotkey matrix.

---

### S8 🟡 — E2E, hardening, docs

**Goal:** lock the whole arc in.

**Changes:**
1. NEW `apps/e2e/live-map-toolbar.smoke.spec.ts` (≤348 lines — spec files COUNT against the structure guard): DM joins (helpers.ts patterns, `elevateToDM`), activates map-edit, starts live map, drags a room rect on the Stage (Playwright mouse on canvas coordinates), asserts via `window.__HERO_BYTE_E2E__` snapshot polling: compiledScene.walls length grows, mapTerrain present; second (player) page: fog behavior + door click round-trip after placing a door. Keep it serial-safe (workers:1).
2. Adding the spec to the PR smoke list (`.github/workflows/ci.yml:157`) is an OWNER decision — propose it in the handoff, don't edit CI unilaterally.
3. Update `docs/planning/map-studio-roadmap.md` with a short "live map toolbar shipped" note + this doc's link; note the raster-hybrid and vertex-editing deferrals.
4. Sweep: `pnpm lint:structure:enforce` clean, `pnpm --filter herobyte-client build:check` (entry budget), full `pnpm test`, full `pnpm test:e2e`.

**Done when:** everything green end to end.
**🔎 SENIOR REVIEW GATE:** request adversarial review of Phase 1 before starting Phase 2.

---

## 5B. Phase 2 — Studio parity, then retirement (S9–S13)

Owner decision (2026-07-11): the Map Studio *scene* is removed once the palette reaches parity. The engine — documents, commands, validation, history, compile — is untouched forever; only the separate editor UI dies. Sequencing rule: **parity before removal**; every slice here keeps the Studio working until S13 deletes it.

---

### S9 🔴 — Player-visible live elements (the parity keystone)

**Goal:** with no raster and no Studio, players must SEE tiles, stamps, shapes, and player-visible text live — today those render at the table only via the baked raster (recon-verified). Extend the live snapshot with a sanitized, player-safe element list and render it at the table. This is a protocol change with secrecy implications — the most senior-review-worthy slice in Phase 2.

**Context capsule:**
- What exists: RoomSnapshot already carries `mapTerrain` (data path) and `compiledScene`; `assets`/`assetRefs` (`packages/shared/src/index.ts` 311-322, `model.ts:271`) are ONLY a dedup channel for background/drawing payloads — do not extend them. Uploaded images resolve as same-origin `/assets/<hash>` URLs (the client helper `uploadedAssetUrl` lives in `features/map-studio/uploads/`); starter tile assets are bundled client data with fills/strokes (`features/map-studio/starterTiles.ts` 27-132). Props already render uploaded images at the table via `use-image` (`PropsLayer.tsx:50`) — same mechanism.
- Element shapes to render: `packages/shared/src/mapStudioTypes.ts` 47-98 — `MapTileElement {assetId, columns, rows}` (sized in CELLS of the document grid — the snapshot field must carry the grid like `MapTerrainSnapshot` does), `MapStampElement {assetId, width, height}` (document px), `MapShapeElement` (points/stroke/fill/opacity), `MapTextElement {text, color, fontSize, visibleToPlayers}`.
- Privacy rules (these ARE the security contract): exclude `element.hidden`; exclude elements on layers with `visible: false` (render semantics — the OPPOSITE of compile's rule, which ignores layer visibility for blocking; both are correct, do not unify — see `sceneCompiler.ts:1-8`); exclude entire layers of kind `"notes"`; exclude text with `visibleToPlayers: false`; walls/doors/lights excluded (walls are DM-overlay + blocking only, doors ride `compiledScene`, lights don't render at the table yet). Carry per-layer `opacity` and render in layer `zIndex` order.
- Where it plugs in: S1's `recompileLiveScene` + the `map-studio-set-live` case; the SVG renderer being replicated (for reference, not reuse) is `renderMapDocumentSvg` in `exportMapDocument.ts:34-64`; Studio's SVG element rendering for visual parity reference: `MapStudioElementPreview.tsx`.
- Table layer order: `MapBoard.tsx` 508-545 — new layer mounts between TerrainLayer and GridLayer.
- Budget: `SnapshotCompressionGuard.test.ts` (extend), 750KB guard; element lists are references + numbers — small.

**Changes:**
1. NEW shared type `MapElementsSnapshot` in `packages/shared/src/index.ts`: `{ grid: { size: number; offsetX: number; offsetY: number }; layers: Array<{ opacity: number; elements: RenderableMapElement[] }> }` where `RenderableMapElement` is a narrowed union of tile/stamp/shape/text with only render-relevant fields (id, transform, data). Add `mapElements?: MapElementsSnapshot` to RoomSnapshot.
2. `packages/shared/src/scenePublish.ts` (from S1): add `deriveMapElements(document: MapDocument): MapElementsSnapshot | undefined` implementing the privacy rules above (pure; return undefined when nothing is visible). **Rebuild shared.**
3. Server: `recompileLiveScene` also sets `state.mapElements` (new RoomState field, persisted like `mapTerrain`); attach in `toSnapshot` for ALL recipients (it is player-safe by construction).
4. NEW `apps/client/src/features/map/components/MapElementsLayer.tsx` (≤348; split a `mapElementRenderers.ts` helper if needed): Konva render inside the standard nested `cam` + `mapTransform ?? identity` groups — tiles as fills/strokes resolved from starter-tile data (grid-cell sized: `columns * grid.size`), stamps via `use-image` on `uploadedAssetUrl(assetId)` with bundled-asset fallback, shapes as Line/Rect/Ellipse per `data.shape`, text as Konva.Text. `listening={false}` throughout — elements are scenery, not interactive.
5. Mount in MapBoard between TerrainLayer and GridLayer, gated on `snapshot.mapElements`.

**Tests:** shared unit tests for every privacy rule (hidden / invisible layer / notes layer / private text NEVER emitted — one test per rule, adversarial style); server contract test: DM adds a stamp via command → player snapshot gains it; DM adds GM-note text → player payload contains NO trace (grep the raw frame string, `visionChannels.contract.test.ts` style); client div-mock render tests per element kind; SnapshotCompressionGuard extension (500 mixed elements).
**Verify:** shared build + all package tests + typecheck + lint + structure + full test.
**Done when:** manual: DM stamps a crate from the Studio (still alive!) onto the live-bound doc → it appears on the player's table without any publish.
**Traps:** the layer-visibility rule is OPPOSITE compile's — a wall on a hidden layer still blocks but a tile on a hidden layer must not render; text privacy is a hard contract — test it like the secret-door disguise; don't make elements listening/interactive (token clicks must pass through).
**🔎 SENIOR REVIEW GATE:** protocol + secrecy review before S10.

---

### S10 🟡 — Placement tools: tiles, stamps, scatter, asset picker

**Goal:** place set dressing from the palette: pick an asset (starter tiles + uploads), click to place tiles (grid-snapped) or stamps (Alt = free-place, R = rotate), scatter-brush for organic spreads. All existing commands; no server work.

**Context capsule:** the pure helpers to reuse verbatim (recon-verified portable): `mapStudioWorkspaceUtils.ts` `buildRoomTileDrafts` 80-135 / `pickPlacementLayer` 150-158 / `topmostTileAtPoint` 183-200; `scatterBrush.ts` `buildScatterDrafts` 20-53 (seeded, one `add-elements` = one undo — pass a seed derived from the drop point, never `Math.random()`); `elementBuilders.ts` 16-70 (tile/stamp constructors); Studio's placement state machine for reference: `useMapStudioCanvasController.ts` 227-323 (paintAtPoint/stampAtPoint/scatterAtPoint self-gate on `saving`); asset catalog: `starterTiles.ts` MAP_STUDIO_TILE_ASSETS 27-132 (categories); uploads: `controller.uploadAsset` + the upload flow in `features/map-studio/uploads/`; My Stuff/Shelf UI reference: the Studio's asset rail in `MapStudioWorkspace.tsx` 116-169.
**Changes:** NEW `features/map-edit/MapEditAssetPicker.tsx` (≤348 — a compact popover in the palette: category tabs, asset grid, upload drop target reusing `uploadAsset`); extend `useMapEditTool` with `"place"` sub-tool (click = tile lattice placement or stamp at snapped point; Alt = free-place at pointer; R rotates the pending placement — 15° stamps / 90° tiles, matching `useStudioHotkeys.ts:62-64` semantics) and `"scatter"` sub-tool (click → `buildScatterDrafts` → `controller.addStamps`); ghost preview in MapEditPreviewLayer (semi-transparent element at cursor).
**Tests:** placement produces exact drafts (grid-snap + Alt-free cases + rotation); scatter emits ONE `add-elements`; self-gates on `saving`; picker renders categories (div-mock).
**Done when:** manual: stamp crates into the S4 room live; players see them (S9); one Ctrl+Z removes a whole scatter.

---

### S11 🟡 — Hallway tool + POPULATE (the "on the fly" headline)

**Goal:** the owner's signature move: drag a hallway, populate it algorithmically, keep playing.

**Context capsule:** S4's `place-room` command and `roomBuilder.ts`; `roomBoundsFromDrag` (`mapStudioWorkspaceUtils.ts:137-148`); `buildScatterDrafts` (S10); `place-room` accepts arbitrary `cells` + `elements` — hallways and populate are CLIENT-side geometry feeding the SAME command (no new server work).
**Changes:**
1. `"hallway"` sub-tool in `useMapEditTool` + NEW `features/map-edit/hallwayBuilder.ts` (~120, pure): drag along an axis → floor cells (default width 2 cells, adjustable 1–4 in the palette) + TWO wall polylines (the long sides only — open ends so hallways junction with rooms; walls stop at the drag ends). Snap the axis to horizontal/vertical (dominant drag direction); L-shaped hallways = two drags (v1 keeps it dumb).
2. **POPULATE** action in the palette: applies to the last-placed room/hallway (track its bounds + element ids in palette state) or to a fresh drag-rect; builds a deterministic population — seeded scatter of stamps from a chosen category (e.g. *Dungeon Dressing*), density low/med/high, seeded from the bounds origin so identical inputs produce identical results — emitted as ONE `add-elements`. NEW `features/map-edit/populateRoom.ts` (~100, pure): takes bounds + density + category assets + seed → drafts, keeping a clear margin along walls (inset 0.5 cell) and never covering door cells (pass the room's door segments in, skip cells within 1 cell of them).
3. Palette: hallway width control, populate density + category, POPULATE button.
**Tests:** hallwayBuilder pure tests (horizontal/vertical/1-wide/snapped-axis; wall polylines open-ended, exact points); populateRoom determinism (same seed → identical drafts), margin + door-avoidance rules; one-undo per action.
**Done when:** manual: room → hallway off its side → POPULATE → crates and barrels appear along the hallway, live on the player screen; three Ctrl+Z's unwind populate, hallway, room in order.
**Traps:** determinism (no Math.random — thread the seed); populate emits `add-elements`, NOT `place-room` (no terrain change → door-state preservation irrelevant); hallway walls must NOT close the ends.

---

### S12 🟡 — Layers, inspector, eyedropper parity

**Goal:** the remaining Studio chrome, compacted into the palette: layer visibility/lock/opacity, a selected-element inspector (move/rotate via numeric inputs, door state/width, delete), Ctrl/Cmd-click eyedropper.

**Context capsule:** `MapStudioLayersPanel.tsx` 17-90 (drives `update-layer`/`move-layer` — port the logic, shrink the UI); `MapElementInspector.tsx` 19-53 + 127-175 (transform APPLY + the door form → `updateElement`/`updateDoor`); selection: Studio is click-only selection — the live palette gets a `"select"` sub-tool: click hit-tests elements via `topmostTileAtPoint` (tiles) + simple bounds checks for stamps/shapes (NEW pure helper, ~80 LOC — document px, rotation-aware for stamps using the same math as `topmostTileAtPoint` 279-302); eyedropper: `sampleAssetAtPoint` (`mapStudioWorkspaceUtils.ts` 165-181, pure — reuse verbatim) re-arms the place tool with the sampled asset.
**Changes:** NEW `MapEditLayersPopover.tsx` + `MapEditInspectorPopover.tsx` (each ≤200, JRPG-panel styled, opened from palette buttons); `"select"` sub-tool + selection highlight rect in MapEditPreviewLayer; Ctrl/Cmd-click in place/terrain sub-tools samples via `sampleAssetAtPoint`.
**Tests:** layer toggles emit exact commands; inspector door form emits `update-door`; eyedropper returns the Studio-identical sample for a fixture document; selection hit-tests (rotated stamp case).
**Done when:** manual parity walk: everything you could do in the Studio's right rail, you can do from the palette (except deliberately-deferred vertex editing).

---

### S13 🔴 — Exports move, the Studio dies

**Goal:** relocate the last Studio-only features (PNG/WebP/JSON export, JSON import), then delete the Studio scene. The engine, validators, shared model, and all engine tests stay untouched.

**Context capsule:** export functions are ALREADY UI-independent: `exportMapDocument.ts` (rasterize/download/SVG — stays, it also powers raster publish) and `controller.importDocument`; the DM menu's `MapStudioControl.tsx` (doc management + publish) is the natural new home for EXPORT/IMPORT buttons; deletion inventory — REMOVE: `"map-studio"` from ToolMode + Header button (185-194) + MobileFloatingControls entry (110-119) + the CenterCanvasLayout/MobileLayout workspace branches (222-243 / 144-156) + `MapStudioWorkspace.tsx` + `useMapStudioCanvasController.ts` + `MapStudioCanvas.tsx` + `MapStudioCanvasUnderlay.tsx` + `useStudioCamera.ts` + `useStudioHotkeys.ts` + `useStudioPublish.ts` + `MapStudioElementPreview.tsx` + `MapStudioLayersPanel.tsx` + `MapElementInspector.tsx` + `MapStudioWorkspace.types.ts` + their tests; KEEP (used by the palette/table/export/publish): `useMapStudio.ts`, `useMapStudioActions.ts`, `types.ts`, `elementBuilders.ts`, `wallDoorDrafts.ts`, `snapToGrid.ts`, `mapStudioWorkspaceUtils.ts` (pure helpers only — if workspace-specific functions remain unused after deletion, prune them), `useTerrainBrush.ts`, `scatterBrush.ts`, `terrainRender.ts`, `starterTiles.ts`, `tileAutotiling.ts`, `exportMapDocument.ts`, `publishRaster.ts`, `rasterUnderlay.ts`, uploads/, **the FROZEN parity test and everything it imports**.
**Changes:** EXPORT PNG/WEBP/JSON + IMPORT buttons in `MapStudioControl.tsx` (wired to the existing export helpers + `controller.importDocument`); delete per inventory; fix `docs/planning/map-studio-roadmap.md` and any docs referencing the workspace; replace `apps/e2e/map-studio.smoke.spec.ts` coverage with palette-driven equivalents (extend S8's spec — the Studio spec dies with the Studio); `pnpm --filter herobyte-client build:check` should show the entry bundle SHRINK (the lazy studio chunk disappears entirely).
**Verify:** the FULL ritual + e2e; grep the repo for `MapStudioWorkspace|map-studio"` ToolMode remnants — zero hits outside git history.
**Done when:** the app has no Studio scene; every S1–S12 feature works; all suites green; bundle no bigger.
**Traps:** do NOT delete anything the frozen test imports (`terrainRender.ts` chain); do NOT remove the `map-studio-*` wire protocol, validators, or server service — Studio-less clients still speak it; check `MobileLayout.tsx` — it has its own workspace branch and lazy import.
**🔎 SENIOR REVIEW GATE (final):** full-arc adversarial review — units lens, info-leak lens, race lens, deletion-completeness lens.

---

## 6. Failure drills (when X happens, do Y — do not improvise)

| Symptom | Cause | Fix |
|---|---|---|
| New WS message never reaches the handler, no error anywhere | not registered in `middleware/validation.ts` registry | add validator entry (§4.3) |
| `map-studio-error` code `command-rejected` | zod `.strict()` rejected an extra/malformed field | diff your payload against the validator schema field-by-field |
| Command seems applied but table doesn't change | doc isn't the live-bound one, or S1 hook not returning `{broadcast:true}` | check `state.liveMapDocumentId` vs `command.documentId` |
| Repeated `revision-conflict` errors | something bypassed the single controller queue (second `useMapStudio`?) or two DMs racing (normal — auto-recovers via refetch) | ensure ONE controller instance; racing DMs are fine if it recovers |
| Wall lands offset from cursor | a missing/extra hop in §3 (usually the `mapTransform` inverse or `gridSize/2` style half-cell logic) | log the point at each hop; compare against §3 table |
| Camera pans while dragging a tool | mode missing from a `shouldPan` negation (there are TWO: mouse 239 + touch 288) | add it to both |
| Doors all slam shut after an edit | `preserveDoorRuntimeStates` not applied on that path | every recompile call site must route through S1's helper |
| Terrain invisible at the table | `deriveMapTerrain` returned undefined (terrain layer hidden/zero-opacity/empty) — correct behavior | check the document's terrain layer visibility |
| Typecheck errors that make no sense after touching packages/shared | stale dist | `pnpm --filter @herobyte/shared build` |
| `pnpm lint` fails on a file you never touched (frozen) | you changed terrain render output | fix the product code; NEVER edit the frozen test |
| CI bundle-size gate fails | something editor-weight got statically imported into the entry graph | find it with `pnpm --filter herobyte-client build:check`; lazy-import it |
| Client test batch runner fails randomly under parallel runs | test contention (known) | re-run serially; don't run `pnpm test` while other agents run tests |

---

## 7. Deferred follow-ups (recorded, not licensed)

Wall vertex/move editing (new command for element `data` updates), door placement snapped onto existing walls with auto wall-splitting, L-shaped/polyline hallways in one drag, richer populate recipes (per-room-type grammars — the road to M4 generation), brush stroke interpolation, brush sizes, mobile map-edit, terrain gameplay semantics, wall merge on room adjacency, raster-import maps coexisting with live authoring (bind-over-raster keeps working but stays cosmetic-double-terrain — see S1's recorded decision), generation recipes emitting into the live-bound document (M4 — the whole point of these rails).

---

## 8. Command crib sheet

```bash
pnpm --filter @herobyte/shared build     # ALWAYS after shared edits
pnpm --filter @herobyte/shared test
pnpm --filter vtt-server test            # single file: pnpm --filter vtt-server test -- path/to.test.ts
pnpm --filter herobyte-client test       # single file: pnpm --filter herobyte-client exec vitest run <path>
pnpm typecheck                           # vitest does NOT typecheck
pnpm lint                                # includes frozen-test gate; NOT the structure guard
pnpm lint:structure:enforce              # the 350-LOC guard (separate, from repo ROOT)
pnpm --filter herobyte-client build:check# entry-bundle 175KB gzip budget
pnpm test                                # full suite
pnpm test:e2e                            # serial; ports 5175/8788; passwords Fun1 / FunDM
```

**Glossary:** *live-bound document* — the MapDocument named by `RoomState.liveMapDocumentId`, auto-compiled on every command. *Compiled scene* — server-enforced walls/doors/lights in document px produced by `compileScene`. *Elements-only publish* — terrain-as-data path (no raster) that live mode reuses. *Document px / world px / cells* — §3. *Field families* — VILLAGE_TERRAIN procedural terrains (grass, dirt, path, stone-floor, wood-floor). *One-in-flight queue* — useMapStudio's serial command dispatcher; the only legal way to send map-studio commands.
