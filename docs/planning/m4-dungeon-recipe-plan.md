# M4 Phase 1 — The Dungeon Recipe — Execution Plan

**Status:** READY FOR EXECUTION · Authored 2026-07-14 by the senior dev after 4-reader recon (anchors verified against dev tip `7c21198e`) · Rev 2 — adversarially reviewed; Rev 1's raw-sendMessage client design was refuted and replaced by the controller-queue design (§2.3, G5), plus 10 spec fixes (uniform id space, RNG stream split, door-position semantics, identity-transform wording, door-site grouping, min bounds, wall-run ordering, asymmetric-offset tests, DM notes overlay, e2e assertions)
**Mission:** The first Living World recipe. A DM drags a rectangle with the new GENERATE tool, picks a theme and density, and a dungeon exists on the live table in seconds — rooms, corridors, blocking walls, clickable doors (some secret), brazier lights, and GM-only spawn markers — deterministic by seed, applied as **ONE undoable command**, with fog and vision live by construction. Same seed, same params → bit-identical dungeon, forever (the foundation of Cartridge Codes).
**Vision alignment:** VISION.md Pillar 1 ("generators emit MapDocument elements, never rasters") and milestone M4. The prior plan's §7 explicitly deferred "generation recipes emitting into the live-bound document (M4 — the whole point of these rails)" — this plan cashes that IOU. Shipping order per VISION: **dungeon first**; building/wilderness/town/world recipes, the Atlas, and SceneStates are later M4 phases (§7).

---

## 0. How to execute this plan (read this first)

Same method as `live-map-toolbar-plan.md` (small verifiable slices). Rules, unchanged and binding:

1. **Do the slices in order** (G1→G6). Don't start a slice until the previous one's *Done when* is fully green.
2. **Read only the Context Capsule files.** Anchors are from 2026-07-14 (`7c21198e`); match on the quoted code, not the line number.
3. **Never exceed 348 lines in a NEW file.** The guard fails at `loc >= 350`, the trailing newline counts, and `prettier --fix` can EXPAND a file over the cap. `.json` fixtures are not scanned — prefer them for goldens.
4. **Write the slice's tests in the same commit.** Run the full verification ritual (§8) before claiming done.
5. **When a Trap or Escalate-if fires, STOP and report.** A wrong guess here ships a non-deterministic recipe or an info leak.
6. **Commit per slice to `dev`.** Do NOT push unless the owner asks.
7. **Rebuild shared after ANY `packages/shared/src` edit:** `pnpm --filter @herobyte/shared build`.
8. **Do NOT run `pnpm test` while an adversarial review Workflow is live** (client batch runner fails on contention; transient).

---

## 1. Product goal

### 1.1 What the DM experiences when this ships

- The Map Tools palette (🏗️) gains a **🎲 Generate** sub-tool. Drag a rectangle on the canvas → a compact params panel appears: **Theme** (Stone Halls / Wood Halls), **Density** (low/med/high), **Secret doors** (%), **Seed** (prefilled, with a ⟳ reroll button) → **GENERATE**.
- Within a broadcast tick, the region contains a dungeon: floored rooms joined by corridors, wall perimeters with working doors (closed; a few secret), braziers in the rooms, and — visible only to the DM — spawn markers ("SPAWN: 3 skeletons") on the GM Notes layer.
- Players see floors appear and fog reshape. They can immediately open doors (creak, fog peels back). Secret doors render as wall to them — the existing disguise contract, inherited automatically.
- **One Ctrl+Z removes the entire dungeon.** GENERATE again with the same seed → the identical dungeon. Reroll → a different one.
- Everything is elements + terrain data in the live-bound document — editable with every existing tool the moment it lands. No raster, ever.

### 1.2 Scope boundaries

**In this phase:** the generation rails (message → recipe → one command → live recompile), the dungeon recipe (layout, geometry, stocking v0), the GENERATE tool UX, determinism goldens, secrecy contract tests, e2e smoke.

**Never in this phase (deferred, §7):** the Atlas graph / MapLinks / SceneStates; other recipes (building, wilderness, town, world); reroll-preserving-pins (`provenance`/`pinned`); Bestiary-linked encounter manifests (stocking v0 is text markers only); the one-keystroke "Kicked-In Door" UX (this phase ships drag-a-rect; the keystroke rides later once the Atlas gives it a target); multi-floor dungeons; generation into non-live documents from the palette (the message supports any documentId; the UI only targets the live doc).

---

## 2. Architecture — the one decision everything hangs on

### 2.1 The insight from recon

Every hard problem this feature has was already solved by the live-map arc:

- **One-undo cross-type application exists:** the `place-room` command paints terrain cells AND adds elements under a single `commit()` — one revision bump, one undo step, all-or-nothing (`placeRoom`, `packages/shared/src/mapStudioElements.ts:67-76`). The dungeon is just a much bigger `place-room` payload.
- **Live recompile exists:** applying any command to the live-bound document triggers `recompileLiveScene` — compiled walls/doors (door runtime states preserved), `mapTerrain`, player-safe `mapElements`, broadcast, save (`MapStudioMessageHandler.ts:67-88, 175-191`). Generation inherits fog, vision, movement blocking, and the secret-door disguise with zero new code.
- **Privacy exists:** `deriveMapElements` strips `kind: "notes"` layers entirely (`scenePublish.ts:110`) — GM spawn markers are DM-only *by construction*. Secret doors are disguised as anonymous walls in player payloads (`model.ts:297-325`). Both are already contract-tested.
- **Determinism exists:** `createSeededRng` (mulberry32, `packages/shared/src/rng.ts`) — its header names "generation recipes, and Cartridge Codes" as intended consumers. `populateRoom.ts` established the discipline: fixed rolls-per-cell before any skip, seed threading, no `Math.random()`.
- **Undo/idempotency/conflicts exist:** `MapStudioService.apply` gives command dedupe (`roomId:docId:commandId` cache), per-doc undo history, and revision-conflict errors to anything that speaks `MapStudioCommand` (`domains/mapStudio/service.ts:76-105`).

### 2.2 The design

**One new message, zero new command types, zero new container services.**

```
DM palette drag ──► { t: "map-studio-generate", documentId, commandId, recipe: "dungeon",
                      seed, bounds (CELLS), params }            (zod-validated, new module)
                        │
                        ▼  MapStudioMessageHandler (map-studio-* prefix ⇒ DM-gated for free)
            resolve RecipeContext from the target document:
              layer ids by kind (walls / lighting / notes / objects), grid, caps
                        │
                        ▼  domains/generation (PURE — no state, no sockets, no clock)
            dungeonRecipe(seed, bounds, params, ctx) ──► { cells: TerrainPaintCell[],
                                                           elements: MapElement[] }
                        │
                        ▼  synthesize ONE existing command:
            { type: "place-room", commandId: message.commandId,
              documentId, baseRevision: current.revision, cells, elements }
                        │
                        ▼  this.service.apply(roomId, command)     (undo/dedupe/conflicts free)
            broadcastDocument to DMs · recompileLiveScene if live-bound
            return { broadcast: true, save: true }                 (snapshot + persistence free)
```

**Deterministic ids (the golden-snapshot landmine, solved by construction):** the recipe NEVER calls `generateUUID`. Every element id comes from ONE shared counter: `${idPrefix}:e<n>` (e.g. `abc123:e0`, `abc123:e17`), where `idPrefix = message.commandId`. The commandId is client-minted per generation (unique → no collision with prior generations in the same doc), and a network retry with the same commandId hits the dedupe cache instead of double-applying. Golden tests pin `idPrefix: "golden"` + a fixed seed + a fixed timestamp → byte-stable output.
**Why ONE counter and NO kind letters (security, do not "improve"):** player payloads disguise secret doors as anonymous wall segments with id `${door.id}#0` next to real walls' `${wall.id}#<i>`. If door ids carried a `d` marker and walls a `w`, a player reading frames could fingerprint every disguised secret door by its id shape. A uniform `e<n>` space makes them indistinguishable.
**[G4.5 — the above was NOT ENOUGH. Two more properties are load-bearing; the gate broke the disguise three ways.]**
1. **The ids must be PERMUTED, not sequential.** A kind-free counter still leaks when the emission order is kind-grouped: walls took `e0..e(W-1)` and doors `e(W)..`, so the ORDINAL was the kind tag and a disguised door arrived in the wall list carrying a door-range number (gate: 27/32 recall, 0 false positives). `dungeonRecipe` now re-mints every id from a seeded Fisher-Yates permutation on its own frozen `ID_STREAM`. This also makes id GAPS meaningless, which matters because of (2).
2. **The player's blocking set must be RE-MERGED** (`compiledSceneView.compiledSceneFor`). Generated walls are maximal runs, so among real walls no two segments are ever collinear AND touching; splicing a 1-cell disguised door into a run creates exactly that impossible junction (gate: 30/32 recall, 0 false positives — and a `secretDoorChance: 0` control flagged ZERO, which is what made it conclusive). Merging fuses the door back into its neighbours, so the payload becomes what a plain wall on that seam would emit. It also makes the door's own id vanish. **Fusion must never join segments that block differently** (a window beside a wall) — blocking is the one thing that may never be cosmetic.
3. **Secret doors must bake AS WALL in the raster** (`exportMapDocument`). Walls leave a one-cell gap where a door sits and `DoorsLayer` only covers doors the recipient received — never the secret ones — so baking nothing left a bare hole in the published art that read as "secret door here" with no socket inspection at all.

**One RNG stream per stage (stream-stability across stages):** `dungeonRecipe` derives three independent generators — `layoutRng = createSeededRng(seed)`, `geometryRng = createSeededRng(seed ^ 0x1f123bb5)`, `stockingRng = createSeededRng(seed ^ 0x6a09e667)` — and passes each stage its own. A roll-count change inside layout can then never shift geometry or stocking output (the constants are arbitrary but FROZEN; they are part of the determinism contract).

**Recipes are pure server modules, not a container service.** `domains/generation/` exports pure functions imported directly by `MapStudioMessageHandler` — exactly how it already imports `compileScene` and `deriveMapElements`. No state, no store, no DI arity changes.

### 2.3 Why not alternatives (recorded so nobody relitigates)

- **A new `MapStudioCommand` variant ("generate-dungeon") applied in shared:** puts recipe params in the wire command union and the recipe inside `applyMapDocumentCommand` — bloats the shared protocol, and `mapStudioValidators.ts` sits AT the 349-line structure ceiling. The recipe's *output* is already expressible as `place-room`. Rejected.
- **A new `GenerationService` in the Container:** the recipe is stateless; a service adds a 13th MessageRouter constructor param, and four contract tests construct MessageRouter with exactly 12 positional args relying on defaulted trailing params (`messageRouter.ts:129-144`). Pure imports carry zero risk. Rejected (revisit when recipes need stores — e.g. custom recipe packs).
- **Client-side generation (POPULATE-style drafts):** works today, but VISION mandates server-side recipes ("pure, seeded server-side functions in a DI-registered domains/generation") because mid-session generation must be server-authoritative and Cartridge Codes need one canonical implementation. Also: a maxed dungeon payload as a client message flirts with the 1MB WS cap; the trigger message is ~200 bytes. Rejected.
- **Generating into a fresh document + auto-binding it:** hostile to the "kick in a door mid-session" flow (the party is standing on the current map) and adds a bind/unbind state machine. The recipe generates into the CURRENT live doc at the dragged bounds. Rejected for this phase.
- **Client sends `map-studio-generate` via raw `sendMessage`:** REJECTED — this was Rev 1's design and adversarial review killed it twice over. (1) `useMapStudio.handleServerMessage` DROPS any `map-studio-error` whose commandId it didn't mint (`useMapStudio.ts:243` — `if (message.commandId !== inFlightCommandId.current) return;`), so a failed generate would surface nothing and wedge forever. (2) There is no other channel: `registerServerEventHandler` is a SINGLE-SLOT ref (`useWebSocket.ts:140-142`) — a second registration from a generate hook silently clobbers ALL control-message routing. The controller's one-in-flight queue is the only legal transport (it already owns error surfacing, revision-conflict refetch, reconnect re-send, and the loading watchdog) — generate becomes a controller action (G5).

---

## 3. Units and spaces (memorize this)

| Space | Used by | Convert |
|---|---|---|
| **Grid cells** (integer) | `bounds` in the generate message; `TerrainPaintCell.x/y`; layout algorithm (G2) | cell → document px: `px = cell * grid.size + grid.offsetX` (corner), center adds `grid.size / 2` |
| **Document px** | element transforms, wall `data.points`, door `transform.x/y` + `data.width`, light radius | px → cell: `Math.round((px - grid.offsetX) / grid.size)` |
| **Wall lattice** | wall polylines run along CELL EDGES (corners at `cell * size + offset`), not cell centers | a door's `transform.x/y` is the edge's START corner (the lower-coordinate end); the compiled segment runs from the transform to `(width, 0)` THROUGH the transform (`sceneCompiler.ts:91-94`) — so a door on edge (x,y)→(x+1,y) has transform at the (x,y) corner, `width = grid.size`, rotation 0 (horizontal) or 90 (vertical) |

The recipe works internally in cells and converts to px exactly once, in G3's emission step, using the document's OWN `grid` (from `RecipeContext`) — never a hardcoded 50. Client-side, the drag rect converts world→doc px via the existing `usePointerToDoc`, then px→cells with the math above. **If a wall lands offset from a floor by half a cell, you have mixed corner-lattice and center-lattice — stop and re-read this table.**

Caps the recipe must respect **by construction** (validated in G1's context resolver, not after the fact):
- `MAX_TERRAIN_PAINT_CELLS = 16384` floor cells per command (shared, thrown, all-or-nothing — `mapStudio.ts:200`) → bounds are clamped to ≤ 16384 total cells (e.g. 128×128) at the validator AND the resolver.
- 5000 elements per command (zod `elementsBatch`; server-initiated applies bypass zod, respect it anyway). Recipe budget: walls+doors+lights+notes ≤ 1000, stamps ≤ 2000 (`MAX_POPULATE_STAMPS` precedent).
- Integer cell coords, `|cell| ≤ 65536`; terrain palette ≤ 512 (a theme uses ~2 families — fine).
- Snapshot soft guard 750KB gzip (`SNAPSHOT_SIZE_LIMIT_BYTES`, `room/service.ts:18`) — G6 adds a dungeon-scale golden to `SnapshotCompressionGuard.test.ts`.

---

## 4. Golden rules (violating any of these fails CI or ships a bug)

1. **Determinism is the product.** No `Math.random()`, no `Date.now()`, no `crypto.randomUUID()`, no iteration over object-key order anywhere in `domains/generation`. All randomness flows from the three derived `createSeededRng` streams (§2.2 — do NOT reimplement the seeding; the float64 seed-hash collision was already found and fixed once). All ids from the single `idPrefix` counter (§2.2 — the kind-free shape is a SECURITY property). Timestamps come from the handler's injectable `this.now()`.
1b. **"Identity transform at (x, y)" means `{ x, y, scaleX: 1, scaleY: 1, rotation: r }`.** NEVER emit scale 0: `sanitizeElement` requires POSITIVE scaleX/scaleY (`mapStudioValidation.ts:20-21`) and one bad element aborts the whole all-or-nothing command. Wherever this plan says a wall has an "identity transform", the points carry the geometry and the transform is `{x:0, y:0, scaleX:1, scaleY:1, rotation:0}`.
2. **RNG-stream stability discipline** (from `populateRoom.ts:103-108`): draw a FIXED number of rolls per decision point *before* any conditional skip, so adding a skip case never shifts the stream for everything after it.
3. **One command = one undo step.** The whole dungeon rides ONE `place-room`. If any output exceeds a cap, the recipe FAILS (clear error to the DM) — it never silently chunks into multiple commands.
4. **The validator registry is a hard gate:** `map-studio-generate` must be registered in `apps/server/src/middleware/validation.ts` (the mapped type makes omission a COMPILE error once the message joins `ClientMessage`). New zod goes in a NEW module — `mapStudioValidators.ts` is AT the 349-line ceiling. Top-level message schemas must NOT be `.strict()` (the client ack layer stamps `commandId` onto outgoing messages).
5. **Layer-kind discipline:** walls+doors → the `kind: "walls"` layer; lights → `"lighting"`; spawn markers → `"notes"` (this IS the privacy boundary); stamps → `"objects"`. Never the locked `"background"` layer (`requireEditableLayer` throws → all-or-nothing abort). Resolve by kind, never by hardcoded id.
6. **Doors author `"closed"`** (or `"secret"`). An authored-open door compiles to nothing blocking — an invisible hole in the wall (`wallDoorDrafts.ts:29-35` documents this).
7. **Stale shared dist / frozen test / 350-LOC guard / bundle budget:** all prior rules apply verbatim (prior plan §4). `apps/server/src/domains/room/model.ts` is AT the cap — this plan never touches it (nothing here changes RoomState).
8. **Secrecy invariant:** `deriveMapElements` stays the SOLE producer of `RoomSnapshot.mapElements`. The recipe gets privacy by *emitting onto the right layers*, never by post-filtering.
9. **`terrain` is shared-by-reference in store clones** (`cloneMapDocument` doesn't deep-clone it): never mutate `TerrainMap` chunks in place — always go through `placeRoom`/`paintTerrainCells` (immutable by design).

---

## 5. The slices

> Sizing legend: 🟢 small (≤~150 new LOC) · 🟡 medium (~150–400) · 🔴 large (400+ — split further if exceeded)

---

### G1 🟡 — The generation rails (message → recipe → one command → live table)

**Goal:** the thinnest full vertical, pure backend: a `map-studio-generate` message with a TRIVIAL placeholder recipe (floored rect + perimeter wall — a server-side twin of the client room tool) lands on the live table as one undoable command. After this slice the rails are proven; G2–G4 only ever swap the recipe's brain.

**Context capsule (read these, nothing else):**
- `apps/server/src/ws/handlers/MapStudioMessageHandler.ts` — whole file. The `map-studio-command` case (67-88) is your template: `isLive` check at 69, pre-edit snapshot at 72-74 (needed by door-state preservation), `this.service.apply(roomId, message.command, this.now())` at 75, `broadcastDocument` at 76, `recompileLiveScene(roomId, previous, result.document)` at 80-82, `return { broadcast: true, save: true }`. Errors → `sendCommandError` (206-220) sends `{ t: "map-studio-error", commandId, documentId, code: "revision-conflict" | "command-rejected", reason }`. The `t.startsWith("map-studio-")` guard (256-260) + the DM throw (41-43) give the new message routing and DM-gating for free. Constructor (23-30) already injects `this.now` — thread it to the recipe's timestamp.
- `apps/server/src/domains/mapStudio/service.ts:76-105` — `apply(roomId, command, timestamp)`: dedupe cache keyed `${roomId}:${documentId}:${commandId}` (replay returns cached result — this is why `idPrefix = commandId` is retry-safe); undo push (HISTORY_LIMIT 100); throws `MapDocumentNotFoundError` / `MapDocumentRevisionConflictError`. `get(roomId, documentId)` at 62-69 — read `baseRevision` from `.revision` immediately before `apply`.
- `packages/shared/src/mapStudioCommands.ts:28-59` — the `place-room` variant: `MapCommandBase & { type: "place-room"; cells: TerrainPaintCell[]; elements: MapElement[] }`. `packages/shared/src/mapStudioElements.ts:67-76` — `placeRoom` is all-or-nothing under one commit.
- `packages/shared/src/mapStudioTypes.ts:19-29, 39-107, 174-181` — `MapLayerKind`, element data shapes (wall points; door width/state at `transform.x/y`; light radius/color/intensity; text `visibleToPlayers`), `DEFAULT_MAP_LAYERS` (background is locked; layer id === kind for defaults, but resolve by kind anyway).
- `packages/shared/src/index.ts:562-580` — the ClientMessage map-studio block; add the new variant beside `map-studio-set-live` (575).
- `apps/server/src/middleware/validators/mapStudioLiveValidators.ts:1-31` — the minimal single-message validator module to clone (created for exactly this reason: the main validator file is at the ceiling). Registry: `middleware/validation.ts:114-125` (mapped type — compile-enforced) with map-studio entries at 192-199. Re-export via `validators/index.ts`.
- Test templates: `apps/server/src/ws/__tests__/liveMapBinding.contract.test.ts:154-233` — real MessageRouter (12-arg construction) + real MapStudioService, `flush()` = 25ms sleep for the 16ms broadcast debounce, `snapshotsOf` frame filtering, DM/player socket assertions. `packages/shared/src/__tests__/placeRoom.test.ts:44-93` — the one-revision / all-or-nothing assertions to mirror.

**Changes:**
1. `packages/shared/src/index.ts`: add to ClientMessage:
   `| { t: "map-studio-generate"; documentId: string; commandId: string; recipe: "dungeon"; seed: number; bounds: { x: number; y: number; cols: number; rows: number }; params: { theme: "stone" | "wood"; density: "low" | "medium" | "high"; secretDoorChance: number } }`
   (bounds in CELLS; `secretDoorChance` 0..1). **Rebuild shared.**
2. NEW `apps/server/src/domains/generation/types.ts` (~80): `RecipeContext { grid: MapGridSettings; layerIds: { walls: string; lighting: string; notes: string; objects: string }; idPrefix: string }`, `RecipeOutput { cells: TerrainPaintCell[]; elements: MapElement[] }`, `DungeonParams`, the element-budget constants (§3), and `makeIdFactory(idPrefix)` → `() => string` emitting `${idPrefix}:e${counter++}` (ONE counter, no kind letters — §2.2 security rationale).
3. NEW `apps/server/src/domains/generation/recipeContext.ts` (~90): `resolveRecipeContext(document, bounds, idPrefix)` — finds the four layers by kind (first unlocked of each kind; throw a plain-English error naming the missing/locked kind), validates bounds (integer, cols ≥ 8 AND rows ≥ 8 — smaller can't fit a room plus gaps, and the validator enforces the same floor — cols·rows ≤ 16384, within `|cell| ≤ 65536`, inside document dimensions), returns `RecipeContext`.
4. NEW `apps/server/src/domains/generation/dungeonRecipe.ts` (~60 for now): `dungeonRecipe(seed, bounds, params, ctx): RecipeOutput` — G1 placeholder: every cell in bounds floored with the theme family (`terrain:stone-floor` / `terrain:wood-floor`), ONE closed 5-point perimeter wall polyline (doc-px corner lattice, identity transform per §4.1b, `blocksMovement/blocksVision: true`, id from the factory). No RNG use yet beyond plumbing the seed.
5. `MapStudioMessageHandler.ts`: new `case "map-studio-generate"`: resolve context → run recipe → synthesize the `place-room` command (`commandId: message.commandId`, `baseRevision: this.service.get(roomId, documentId).revision`) → the exact apply/broadcast/recompile/return sequence of the command case. Recipe/context errors → `sendCommandError` with code `"command-rejected"`. **If the file approaches 349 lines, extract the case body to NEW `apps/server/src/ws/handlers/mapStudioGenerate.ts`** (function taking `{ service, getRoomState, now, sendCommandError, broadcastDocument, recompileLiveScene }`-style deps — mirror how the file already delegates).
6. NEW `apps/server/src/middleware/validators/generationValidators.ts` (~70): zod for the message — ids ≤128 chars, `recipe: z.literal("dungeon")`, integer bounds with `cols/rows: z.number().int().min(8).max(16384)` PLUS a `.refine(b => b.cols * b.rows <= 16384, ...)` on the bounds object (per-field caps cannot express the product), `seed: z.number().int()`, params enums, `secretDoorChance: z.number().min(0).max(1)`; NOT `.strict()` at top level. Register in `validation.ts`; re-export via `validators/index.ts`.

**Tests:**
- `domains/generation/__tests__/recipeContext.test.ts`: layer resolution by kind; locked/missing kind errors; bounds cap math (16384 boundary, 16385 rejected); id factory sequence.
- NEW `apps/server/src/ws/__tests__/generateDungeon.contract.test.ts` (liveMapBinding template): DM sends `map-studio-generate` against the live-bound doc → player snapshot gains `compiledScene.walls` + `mapTerrain` with NO publish; document revision advanced by exactly 1; DM `map-studio-document` frame carries `appliedCommandId === message.commandId`; a follow-up `{ type: "undo" }` command removes floor AND wall together; replaying the SAME message (same commandId) does not double-apply (revision unchanged); non-DM sender → nack, nothing applied; unknown documentId → `map-studio-error`, no crash.
- Validator tests: acceptance + rejections (non-integer bounds, over-cap area, bad enum, chance > 1).

**Verify:** `pnpm --filter @herobyte/shared build && pnpm --filter @herobyte/shared test && pnpm --filter vtt-server test && pnpm typecheck && pnpm lint && pnpm lint:structure:enforce` then full `pnpm test`.
**Done when:** all green; manual harness proof — dev servers up, DM tab: `elevate-to-dm` → `map-studio-create` → `map-studio-set-live` → send `map-studio-generate` via the console harness → player tab's snapshot shows walls + terrain; one undo command clears it.
**Traps:** read `baseRevision` immediately before `apply` (a racing DM edit between get and apply throws revision-conflict — catch and `sendCommandError`, don't crash the socket); server-initiated applies bypass the zod middleware — the resolver's own validation is the real gate; don't touch `model.ts` (at cap; nothing here needs RoomState).
**Escalate if:** the handler can't stay under the cap even with the extraction, or you find `service.apply` behaving differently than the capsule describes.

**🔎 SENIOR REVIEW GATE:** protocol + units + info-leak lenses on the rails before building the brain.

---

> **G1 SHIPPED** (`9d6189af` + gate fixes). The rails, the resolver, the placeholder recipe, and 39 tests are on `dev`; the senior gate ran and its findings are fixed. What G2/G3 inherit: `resolveRecipeContext` (layer-by-kind + bounds + square-grid + id-prefix guards), `assertGenerateRequest` (seed/params), `assertRecipeBudget` (the element cap — wire your output through it), `makeIdFactory`, and a handler that already acks replays from the dedupe cache before validating. Replace ONLY `dungeonRecipe`'s body.

### G2 🔴 — The layout brain (rooms + corridors, pure, property-tested)

**Goal:** `dungeonLayout.ts` — the algorithmic heart. Pure cell-space layout: non-overlapping rooms, connecting corridors, door sites. No elements, no px, no I/O. This slice is graded on its property tests.

**Context capsule:**
- `packages/shared/src/rng.ts:9-29` — `createSeededRng(seed): () => number` in `[0,1)`. The ONLY randomness source.
- `apps/client/src/features/map-edit/populateRoom.ts:82-156` — the determinism discipline to copy (fixed rolls before skips; seed threading; caps as exported constants).
- `apps/client/src/features/map-edit/hallwayBuilder.ts:118-160` — corridor band math precedent (axis-dominant, width band centered on the low cell).
- Determinism test pattern: `populateRoom.test.ts:27-38` (same seed → `toEqual`, different seed → `not.toEqual`).

**Changes — NEW `apps/server/src/domains/generation/dungeonLayout.ts` (≤300, split `dungeonLayoutCorridors.ts` if needed):**
`generateLayout(rng, cols, rows, density): DungeonLayout` (takes the ALREADY-CREATED `layoutRng` — §2.2 stream split) where `DungeonLayout = { rooms: CellRect[]; floor: Set-like of cells (encode "x,y" strings or a typed 2D bitset — pick one and document it); doorSites: Array<{ edge: { x: number; y: number; orientation: "h" | "v" }; roomIndex: number }> }`. Algorithm (deterministic by contract — where this spec leaves slack, the FIRST green implementation's golden freezes the choice; do not "improve" it later without owner sign-off):
1. Room count target: `clamp(Math.round(area / divisor), 2, 40)` with divisor 140 (low), 90 (medium), 60 (high).
2. Rejection-sample room rects: per attempt draw EXACTLY 4 rolls in order — `w = 3 + floor(rng()*7)`, `h = 3 + floor(rng()*7)`, `x = 1 + floor(rng()*(cols-w-1))`, `y = 1 + floor(rng()*(rows-h-1))` — BEFORE any overlap test; accept iff the rect plus a 1-cell margin overlaps no accepted room; stop at `attempts = target * 12` or when the target is met.
   **[G2-RESOLVED]** The spec gap: a rolled side of up to 9 does not fit the 8×8 minimum, so `x`'s span goes negative. Shipped resolution — CLAMP each side to what fits (`min(rolled, cols-2)`) instead of rejecting the attempt. Keeps the 4-roll stream, and makes the first attempt always accept, so every legal region yields ≥1 room for EVERY seed rather than leaving "did anything generate?" to chance.
3. Connect: rooms in placement order; each room after the first connects to the NEAREST already-connected room (Manhattan distance between integer centers `floor((x0+x1)/2)`; ties broken by lower room index — never by object identity). Corridor = L-shape between the two centers, horizontal leg first iff `rng() < 0.5` (one roll per corridor, drawn unconditionally), width 1 (density high: 2 — the band adds the cell at `cross+1`, i.e. below/right of the primary run).
4. Door sites: group CONTIGUOUS boundary edges between a corridor and a room (a width-2 corridor meets a room across 2 adjacent edges — that is ONE group); each group yields exactly ONE door site at its lowest-(y,x) edge; the group's remaining edges stay walled. This rule is what keeps width-2 corridors sealed: one door, one wall, never a hole.
5. Floor = union of room interiors + corridor cells.

**Tests (`__tests__/dungeonLayout.test.ts`) — the properties ARE the spec:**
- **Determinism pair:** same (seed, cols, rows, density) twice → deep-equal; 5 different seeds → all pairwise different floor sets.
- **Connectivity:** flood-fill from the first floor cell reaches EVERY floor cell (4-connected), for seeds 1..25 × three densities (cheap: ≤128×128).
- **Bounds:** no floor cell outside (0..cols-1, 0..rows-1); no room touches another (gap ≥1) for seeds 1..25.
- **Door sites** lie on a room boundary edge with corridor floor on the outside and room floor on the inside.
- **[G2-ADDED] Walkability** (the load-bearing one — plain floor connectivity passes even if every room is walled shut): flood-fill where crossing a room/corridor seam is legal ONLY through a door site — i.e. simulate what G3 builds. Must reach every floor cell, seeds 1..25 × three densities. This is what proves a seam group can never lose its door.
- **Caps:** floor count ≤ cols·rows ≤ 16384 by construction; minimum bounds (8×8) yield ≥1 room, no throw; below-minimum bounds never reach the layout (G1's validator + resolver reject them — assert that in G1's tests, not here).
**Done when:** all green; run the determinism suite TWICE in a row (`pnpm --filter vtt-server test -- dungeonLayout`) to shake out accidental global state.
**Traps:** never iterate a JS `Set`/object keys to make a random choice (insertion order is deterministic here, but make the *roll count* independent of it anyway — rule §4.2); Manhattan-nearest with index tie-break, or two runs on different V8 versions may disagree.
**Escalate if:** connectivity requires post-hoc repair passes (a correct connector never disconnects — repair loops are where determinism dies).

---

### G3 🟡 — Geometry emission (layout → walls with door gaps → golden)

**Goal:** `dungeonGeometry.ts` turns a `DungeonLayout` into the `place-room` payload: floor `TerrainPaintCell`s, merged wall polylines with gaps at door sites, door elements (some secret). Wire it into `dungeonRecipe.ts`, replacing G1's placeholder. First golden snapshot.

**Context capsule:**
- §3's unit table (the corner-lattice rule) — this slice is where it bites.
- `packages/shared/src/mapStudioTypes.ts:69-88` — wall `data.points` (absolute doc px, zeroed transform, ≥2 points); door: point element at `transform.x/y`, `data.width`, rotation degrees in transform.
- `apps/client/src/features/map-edit/roomBuilder.ts:39-91` + `hallwayBuilder.ts:118-160` — px conversion + wall element construction precedents (client-side; you are re-implementing the ~30 relevant lines server-side, NOT importing client files).
- `packages/shared/src/sceneCompiler.ts:143-145` — `doorBlocksVision`: closed/locked/secret block; open doesn't. Secret door disguise is server-snapshot machinery — free.
- Golden precedent: `packages/shared/src/__tests__/terrain.test.ts:134-149` (pinned JSON: "Changing it is a schema migration, not a refactor"). Fixture as `.json` (not scanned by the structure guard).

**Changes:**
1. NEW `apps/server/src/domains/generation/dungeonGeometry.ts` (≤300): `emitGeometry(layout, params, ctx, rng): RecipeOutput` (rng = `geometryRng`, §2.2 — layout's stream is spent and never leaves `generateLayout`):
   - **Floors:** every floor cell → `{ x, y, assetId: theme family }` (offset by `bounds.x/y` — layout is bounds-local, cells are document-absolute). Emit in scan order (y, then x) so the golden is order-stable.
   - **Walls:** collect boundary edges (floor cell ↔ non-floor neighbor), REMOVE door-site edges, merge collinear adjacent edges into maximal runs, SORT runs by (min y, min x, horizontal-before-vertical), then assign factory ids in that sorted order. Each run → one `MapWallElement` (2-point polyline in doc px on the corner lattice, identity transform per §4.1b, `blocksMovement/blocksVision: true`, walls layer).
   **[G3-RESOLVED — the text above was WRONG; shipped code does this]** Door sites sit on room↔corridor seams, where BOTH cells are floor — so they are never in the floor↔non-floor set, and "remove door-site edges" removes nothing while every non-door seam of a wide corridor goes unwalled (a hole into the room). Wall edges are TWO families minus the doors:
   `wallEdges = (floor ↔ non-floor)  ∪  (room ↔ corridor seams)  −  doorSites`
   Family 1 is the outer shell; family 2 is the doorway line, where G2's grouping already left exactly one door per seam group and every other seam must be walled. G2's walkability property is what pins this, and G3's sealed-dungeon property verifies it from the emitted geometry alone.
   - **Doors:** each door site (already one per contiguous group — G2 rule 4) → `MapDoorElement` with `transform.x/y` at the edge's START corner (§3 — the compiled segment runs from the transform toward `(width, 0)`), `width = grid.size`, rotation 0 (h) / 90 (v), `state: rng() < secretDoorChance ? "secret" : "closed"` (one roll per door, drawn in door-site order), both blocks true.
2. `dungeonRecipe.ts`: `generateLayout` → `emitGeometry`; delete the G1 placeholder body (keep the signature).
3. Contract test extension (`generateDungeon.contract.test.ts`): a generated `"secret"` door appears in the PLAYER payload only as a `#0`-suffixed anonymous wall id (mirror `roomModel.test.ts:92-121` assertions) and in the DM payload as a door.
**Tests (`__tests__/dungeonGeometry.test.ts` + golden):**
- **Sealed-dungeon property (the correctness gate):** for seeds 1..15 — every boundary edge between floor and non-floor is covered by exactly one wall run or one door; no wall run crosses a door site; no zero-length or duplicate wall.
  **[G3-SHIPPED]** Stated as the full invariant, re-derived from the EMITTED geometry (walls expanded back to unit edges), across 15 seeds × 3 densities: shell edge → exactly 1 wall, 0 doors · room/corridor seam → exactly 1 blocker (wall XOR door) · open floor (same room, or corridor-to-corridor) → 0 blockers. The third clause is what catches a wall that leaks into walkable space.
- **Unit property:** every wall endpoint ≡ `cell * grid.size + grid.offset` on its axis, for a non-default ASYMMETRIC grid (size 64, offsetX 13, offsetY 7 — equal offsets would hide an x/y swap; the default grid hides offsets entirely).
- **Golden:** `__tests__/fixtures/dungeon-seed1-16x12-stone.json` — full `RecipeOutput` for (seed 1, 16×12 bounds at offset (4,4), medium, chance 0.15, idPrefix "golden") asserted with `toEqual(JSON.parse(fixture))`. Comment: regenerating this fixture is a determinism-contract change, owner sign-off required.
**Done when:** all green + G1's contract suite still green with the real recipe; manual harness generate shows rooms/corridors with working doors and correct fog on the player tab.
**Traps:** door state rolls draw one-per-site unconditionally (rule §4.2); wall ids in scan order, not Set-iteration order; the door element sits at the EDGE, not the cell center (§3 table).
**Escalate if:** the sealed-dungeon property needs edge-case whack-a-mole (>2 fix rounds means the edge-collection model is wrong — stop and report).

---

> **G2 + G3 SHIPPED.** `dungeonLayout.ts` (rooms/corridors/door sites, 19 property tests incl. walkability), `dungeonGeometry.ts` (floor/walls/doors, 17 tests incl. the sealed-dungeon property + the golden), and `dungeonRecipe.ts` (stream split; `GEOMETRY_STREAM = 0x1f123bb5` is FROZEN). What G4 inherits: add `STOCKING_STREAM = 0x6a09e667` beside it, call `emitStocking` with `createSeededRng(seed ^ STOCKING_STREAM)`, and append to `emitGeometry`'s elements — the id factory must stay ONE counter across walls→doors→stocking, so thread the SAME `nextId` through (today `emitGeometry` owns it; G4 should hoist it into `dungeonRecipe` and pass it down). Regenerating `fixtures/dungeon-seed1-16x12-stone.json` for stocking is expected — that is a contract change; call it out in the commit.

### G4 🟢 — Stocking v0 (braziers + GM spawn markers) + the secrecy gate

**Goal:** dungeons arrive stocked, not just drawn: brazier lights in rooms and DM-only spawn markers. VISION's "stocked, not just drawn," v0.

**Context capsule:**
- `mapStudioTypes.ts:90-98` — light `data { radius, color, intensity, castsShadows }` (compiled but unrendered today — authoring them now is deliberate: they become live the day the light system ships); text `data { text, color, fontSize, visibleToPlayers }`.
- `packages/shared/src/scenePublish.ts:104-110` — `deriveMapElements` skips `kind: "notes"` layers entirely; secrecy contract style: `visionChannels.contract.test.ts` (grep the raw frame string).
- Element budget constants from G1 (`types.ts`).

**Changes:**
1. NEW `apps/server/src/domains/generation/dungeonStocking.ts` (~140): `emitStocking(layout, params, ctx, rng): MapElement[]` (rng = `stockingRng`, §2.2) — per room (one fixed roll-block per room, §4.2): a brazier `MapLightElement` at a deterministic corner (radius `3 * grid.size` px, warm color `#ffb347`, intensity 0.8, castsShadows true, lighting layer) for ~60% of rooms; a spawn marker `MapTextElement` on the notes layer (`visibleToPlayers: false`, text from a fixed table — `["SPAWN: 2d4 skeletons", "SPAWN: 3 giant rats", "LOOT: locked chest — DC 12", "EMPTY — dust and echoes", …]` indexed by roll) for every room. Append output in `dungeonRecipe.ts` before the element-budget check.
2. NEW `apps/client/src/features/map-edit/NotesOverlayLayer.tsx` (~90): the DM has no way to SEE notes-layer elements at the live table (`deriveMapElements` strips `kind: "notes"` from `mapElements` for EVERY recipient, DM included — the raw document only reaches the DM as data). Clone the `WallsOverlayLayer.tsx` pattern (45 LOC — DM-only, `listening={false}`, nested cam + mapTransform groups, mounted in MapBoard gated `isDM && mapEditMode`): render text elements from `controller.activeDocument` whose layer kind is `"notes"` as small gold Konva.Text labels. Without this, generated spawn markers are invisible to everyone and stocking is dead weight.
**Tests:** determinism pair; budget respected at max bounds/high density; **the secrecy gate** (contract): generate with markers → serialize the PLAYER snapshot frame → `expect(frame).not.toContain("SPAWN")` and no notes-layer element ids present; DM frame contains them (via the `map-studio-document` channel). Client: NotesOverlayLayer div-mock render (DM in map-edit mode sees labels; `isDM=false` renders nothing).
**Done when:** all green; golden fixture regenerated ONCE to include stocking (owner-visible diff); manual: DM sees "SPAWN: …" labels at the table in map-edit mode, the player tab never does.
**Traps:** markers go on the notes layer — do NOT also set `hidden: true` (hidden hides from the DM's own render too); `visibleToPlayers: false` is belt-and-suspenders on top of the notes-layer strip, keep both; NotesOverlayLayer reads the DM's own `activeDocument`, NEVER `snapshot.mapElements` (§4.8 — don't create a second producer).
**🔎 SENIOR REVIEW GATE:** determinism + secrecy lenses (the golden's stability across Node versions; any channel where marker text could reach a player frame).

---

### G5 🟡 — The GENERATE tool (client)

**Goal:** the DM-facing flow: 🎲 Generate sub-tool → drag a rect → params panel → GENERATE → pending → done/error toast. Desktop-only, like all map-edit tools.

**Architecture note (from the Rev-1 adversarial review — §2.3 last bullet):** generate MUST ride the controller's one-in-flight queue. Raw `sendMessage` has no error channel (the controller drops foreign-commandId errors at `useMapStudio.ts:243`) and no reply channel (`registerServerEventHandler` is single-slot — a second registration clobbers the whole control plane). The queue gives generate everything for free: `saving` as the pending state, `error` + the existing palette toast, revision-conflict refetch, reconnect re-send (dedupe-safe), and the loading watchdog.

**Context capsule:**
- `apps/client/src/features/map-studio/useMapStudio.ts` — the queue you are extending: `dispatchNextCommand` (146-172) mints the commandId, sets `inFlightCommandId`/`inFlightMessage`, and today HARDCODES the envelope `{ t: "map-studio-command", command: queued.build(document, commandId) }` (164-167); resolution at 282-291 (`message.appliedCommandId === inFlightCommandId.current` → shift queue, clear in-flight, drain `saving`); the error guard at 242-257 (matching commandId → `setError`, conflict → refetch); reconnect re-send at 179-189. 309 LOC — ~40 free; the change below is ~4 lines.
- `apps/client/src/features/map-studio/useMapStudioActions.ts` (286 LOC, ~62 free) — every action enqueues a `CommandBuilder` via `applyCommand`; clone that shape for `generate`. `apps/client/src/features/map-studio/types.ts` (120 LOC) — the `MapStudioController` interface to extend.
- `apps/client/src/features/map-edit/mapEditTypes.ts:16-25` — `MapEditSubTool` union (9 members; add `"generate"`); header rule: sub-tools are palette state, not ToolModes. `MapEditToolbarProps` (41-88) — POPULATE's prop cluster (69-74) is the shape for the generate cluster. **Trap (from memory + prior arc): every new prop that reaches `MainLayoutProps` must be added to all FOUR layout characterization fixtures** (CenterCanvas/TopPanel/FloatingPanels/Mobile tests).
- `apps/client/src/features/map-edit/MapEditToolbar.tsx:15-25` (SUB_TOOLS grid — a 10th entry), `:211` (`<MapEditToolPanels {...props} />` mount), 265 LOC = ~83 free. `MapEditToolPanels.tsx:80-88` — the POPULATE button pattern; 137 LOC = ~211 free (params panel goes in its own file).
- **`useMapEditTool.ts` is 346/350 — effectively frozen.** The rect-drag path for room/hallway routes through `commitDragTool.ts` (71 LOC) and `usePointerToDoc.ts` (52 LOC); the drag preview lives in `MapEditPreviewLayer.tsx` (227 LOC) and the grid used for snapping comes from `useMapEditState`'s `effectiveGrid`. Read all five before deciding the minimal wiring; budget: extract before adding.
- `apps/client/src/features/map-edit/usePopulate.ts:34-81` — the hook shape to clone: busy guard (`controller.saving`), error callback, bounds tracking, `populateSeedFromBounds`.

**Changes:**
1. `useMapStudio.ts`: generalize the queue item — `queued.build(document, commandId)` returns a full `ClientMessage` instead of a command (each existing builder wraps itself in the `map-studio-command` envelope; the generate builder returns the `map-studio-generate` message with `commandId` and `documentId: document.id`). Resolution/error/reconnect logic is UNTOUCHED — the server echoes the same commandId through `map-studio-document.appliedCommandId` (G1) and `map-studio-error.commandId`, which is all the queue keys on.
2. `useMapStudioActions.ts` + `types.ts`: add `generate(input: { recipe: "dungeon"; seed: number; bounds: CellBounds; params: DungeonParams }): void` — enqueues via `applyCommand` exactly like `placeRoom`. `controller.saving` is now the generate pending state; `controller.error` surfaces rejections through the EXISTING palette toast (S7 wiring) — no new error plumbing anywhere.
3. `mapEditTypes.ts`: add `"generate"` to the union + a `GenerateParams` type + prop cluster (`generateParams/onGenerateParamsChange/onGenerate/canGenerate`).
4. NEW `apps/client/src/features/map-edit/useGenerate.ts` (~110): params state (theme/density/secretDoorChance/seed — seed prefilled from `populateSeedFromBounds(bounds)`; ⟳ reroll mints a fresh random seed — UI-side nondeterminism is fine, only the recipe is pure); converts the dragged world-rect to CELL bounds against `effectiveGrid` (§3); `onGenerate` calls `controller.generate(...)`; `canGenerate = Boolean(bounds) && !controller.saving && isLiveBound`. Keep the committed bounds in hook state (the drag preview is transient — it must survive until GENERATE is clicked or the sub-tool changes).
5. NEW `apps/client/src/features/map-edit/GeneratePanel.tsx` (~140): JRPG-styled params popover (theme/density/secret%/seed/reroll/GENERATE, disabled per `canGenerate`; busy label while `controller.saving`). Mounted from `MapEditToolPanels` when the sub-tool is `"generate"`.
6. Wire the rect-drag: reuse the room tool's drag machinery for the `"generate"` sub-tool (dashed rect + "W × H" label via `MapEditPreviewLayer`), committing to `useGenerate.setBounds` instead of `place-room`. If `useMapEditTool.ts` needs more than ~2 lines, FIRST extract its rect-commit dispatch into `commitDragTool.ts` (~277 lines of headroom).
7. SUB_TOOLS entry `🎲 Generate`; fixture updates (all four layouts).
**Tests:** `useMapStudio.test.ts` extension — a queued generate message round-trips: dispatch sends the generate envelope with the queue's commandId; a `map-studio-document` with that `appliedCommandId` drains it; a `map-studio-error` with that commandId sets `controller.error` (this is the regression test for the Rev-1 design bug). `useGenerate.test.ts` — bounds→cells conversion against an asymmetric grid (size 64, offsetX 13, offsetY 7); `canGenerate` gates (no bounds / saving / unbound); reroll changes seed. `GeneratePanel.test.tsx` — render states. Fixture-prop sweep green.
**Verify:** client tests + typecheck + lint + structure + `pnpm --filter herobyte-client build:check` (palette-side, already lazy — budget must not move) + full `pnpm test`.
**Done when:** manual: DM drags a rect, tweaks density, GENERATE → dungeon appears for DM and player tabs; a locked walls layer produces a visible error toast and a re-enabled button; Ctrl+Z removes the dungeon; GENERATE again same seed → identical; reroll → different.
**Traps:** the four-fixture prop trap; do not put params state in `useMapEditTool` (frozen); NEVER send map-studio traffic via raw `sendMessage` (the §2.3 rejection — the queue is the only legal transport); the builder runs at DISPATCH time with the then-current document, so `documentId` is always fresh; disable the tool when `!snapshot.liveMapDocumentId`.

---

### G6 🟢 — E2E, budget, docs, sweep

**Goal:** lock the arc in.

**Changes:**
1. NEW `apps/e2e/dungeon-generate.smoke.spec.ts` (≤348 — spec files COUNT): DM page: elevate → create → set-live → send `map-studio-generate` via the harness (`window.__HERO_BYTE_E2E__` / `sendMessage` — canvas dragging is not the point here); poll DM snapshot for `compiledScene.walls.length > 4` and `mapTerrain` present; player page (own `browser.newContext()` — shared-context UID collision trap): fog present, a door click round-trips, and the raw player snapshot contains no `"SPAWN"` text and no notes-layer ids. Run serially (`pnpm test:e2e -- dungeon-generate`; NEVER `node scripts/run-e2e.mjs`).
2. `SnapshotCompressionGuard.test.ts`: sibling case — a max-bounds high-density generated dungeon stays under the 750KB guard.
3. Docs: `docs/planning/map-studio-roadmap.md` gets a "generation shipped (M4 Phase 1)" note; VISION.md M4 line gets a checkmark note for the dungeon recipe; this plan's §7 stays the deferral record.
4. Sweep: full ritual (§8) end-to-end, restate suite counts in the final report (recon counts are stale — re-run, don't copy).
**Done when:** everything green end to end.
**🔎 SENIOR REVIEW GATE (final):** determinism lens (goldens, Node-version stability), info-leak lens (markers, secret doors, all preview channels), units lens (non-default grid), race lens (generate racing a DM edit → revision-conflict path), cap lens (all four budgets).

---

## 6. Failure drills (when X happens, do Y — do not improvise)

| Symptom | Cause | Fix |
|---|---|---|
| `map-studio-generate` never reaches the handler, no error | validator not registered in `middleware/validation.ts` | add the registry entry (compile error says the same) |
| Generate fails silently; button wedged in pending | generate sent via raw `sendMessage` instead of the controller queue | §2.3 last bullet — the queue is the only legal transport; the controller drops foreign-commandId errors by design |
| A reconnect re-send of a generate is REJECTED though the dungeon is on the map | validation ran before the dedupe cache was consulted | ack replays from `service.cachedResult` FIRST, before `get`/resolver/recipe (G1 fix, gate-confirmed) |
| Generated rooms don't line up with the visible grid | the document is hex/isometric; recipes are square-lattice only | the resolver refuses non-square grids — don't "fix" by fudging the math |
| Players can pick out secret doors from wall ids | kind-marked element ids (`:d2`), or a SEQUENTIAL counter over kind-grouped emission (the ordinal is then the kind tag) | §2.2 — one uniform counter, re-minted through a seeded permutation |
| Players can pick out secret doors from the wall GEOMETRY | the disguised 1-cell segment splices a maximal run — a junction real walls can never have | §2.2 — `compiledSceneFor` re-merges the player's blocking set; never regress this to a plain append |
| Secret doors visible as holes in a published raster | walls bake with a gap at every door site; `DoorsLayer` covers only the doors a recipient received | §2.2 — secret doors bake as WALL in `exportMapDocument` |
| A DM changes density and nothing happens | all densities saturated ONE shared MAX_ROOMS | per-density ceilings (`dungeonLayout.MAX_ROOMS`) |
| `command-rejected` on every generate | zod mismatch, or the resolver threw (missing/locked layer kind) | diff payload vs `generationValidators.ts`; check the target doc's layers |
| `revision-conflict` errors under concurrent DM edits | a DM edit landed between `get().revision` and `apply` | expected — surface the error; the DM retries (dedupe makes retry safe) |
| Golden test flaps between runs | nondeterminism: uuid, Date.now, Set-iteration choice, roll-count drift | audit against §4.1/§4.2; diff the two outputs to localize the first diverging id |
| Golden differs on another machine/Node | float math in cell logic or locale-dependent sort | integers only in layout; explicit comparators everywhere |
| Walls offset from floors by half a cell | corner-lattice vs center-lattice mixup | §3 table; the non-default-grid unit test catches it |
| Doors don't block fog | doors authored `"open"`, or door edge not removed from wall runs | §4.6; sealed-dungeon property |
| Dungeon half-applies | impossible if via one `place-room` (all-or-nothing) — you chunked | one command, always; shrink bounds instead |
| Players see "SPAWN:" text | markers not on the notes layer / a new producer of mapElements | §4.8; secrecy contract test pins it |
| Handler file trips the 350 guard | generate case inlined | extract to `mapStudioGenerate.ts` (G1 escape hatch) |
| Typecheck nonsense after shared edits | stale dist | `pnpm --filter @herobyte/shared build` |
| `pnpm lint` fails on the frozen test | you touched terrain render output | fix product code; never the frozen file |

---

## 7. Deferred follow-ups (recorded, not licensed)

The Atlas graph (`AtlasNode`/`MapLink`, discovered-only player world map via the per-recipient filter), SceneStates with suspend/resume travel, building/wilderness/town/world recipes, recipe `provenance { recipeId, seed }` + `pinned` for keep-this-reroll-that, Bestiary-linked encounter manifests replacing text markers, the one-keystroke Kicked-In Door UX (needs Atlas targets), Cartridge Codes UI (the determinism contract this plan ships is its foundation), multi-floor dungeons with stair links, room-shape variety (non-rect rooms, diagonal corridors), theme packs beyond stone/wood (blocked on the art track), density-aware corridor widths, generation into non-live documents from the palette, per-room-type populate grammars (the prior plan's IOU — partially cashed by stocking v0).

---

## 8. Command crib sheet

```bash
pnpm --filter @herobyte/shared build     # ALWAYS after shared edits
pnpm --filter @herobyte/shared test
pnpm --filter vtt-server test            # single file: pnpm --filter vtt-server test -- dungeonLayout
pnpm --filter herobyte-client test       # single file: pnpm --filter herobyte-client exec vitest run <path>
pnpm typecheck                           # vitest does NOT typecheck
pnpm lint                                # eslint+prettier+frozen-test gate; NOT the structure guard
pnpm lint:structure:enforce              # the 350-LOC guard (separate, from repo ROOT)
pnpm --filter herobyte-client build:check# entry-bundle 175KB gzip budget
pnpm test                                # full suite
pnpm test:e2e -- dungeon-generate        # serial; ports 5175/8788; passwords Fun1 / FunDM
```

**Glossary:** *recipe* — a pure server function `(seed, bounds, params, ctx) → { cells, elements }`; deterministic by contract. *RecipeContext* — grid + layer ids by kind + id factory, resolved from the target document. *idPrefix* — the generate message's commandId; every generated element id is `${idPrefix}:e<n>` (one counter, no kind letters — §2.2). *Sealed-dungeon property* — every floor/non-floor boundary edge is covered by exactly one wall or door (G3's correctness gate). *One-in-flight queue* — `useMapStudio`'s serial dispatcher; after G5 it carries `map-studio-generate` alongside `map-studio-command`, and it remains the ONLY legal way to send either. *Live-bound document / compiled scene* — see the prior plan's glossary; unchanged.

**Senior-gate sizing (lesson from this plan's own review):** run gate Workflows in small waves — ≤4 concurrent agents. This plan's Rev-1 review lost 29 of 39 agents to the session limit mid-verify; unverified findings then masquerade as "refuted". An empty or partially-errored verify pass is an infrastructure failure, NOT a clean pass — re-verify inline or re-run after the limit resets.
