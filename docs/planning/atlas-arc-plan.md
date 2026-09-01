# The Atlas — M4 Phase 2 — Execution Plan

**Status:** Rev 1 — authored 2026-08-31 after a 6-reader recon at `dev` = `567c57cb`.
**ADVERSARIAL REVIEW PENDING — do not execute until this banner says Rev 2** (the m4 plan's
review refuted its client design; the vision-default plan was wrong three times; the reviews were
cheaper than the mistakes). Do the slices in order; each slice's _Done when_ gates the next.

**Mission:** the campaign becomes a navigable graph of linked maps. A DM opens an **Atlas** tab and
sees their world as a tree — nodes for dungeons, buildings, regions; some backed by real maps, some
~100-byte **promises**. Clicking GENERATE on a promise mints a real dungeon in seconds (the shipped
recipe, provenance recorded). **Travel** moves the whole table to another node behind an iris wipe:
the old scene — NPC tokens, door states, drawings, combat — is **suspended exactly as it stands**,
and coming back **resumes it exactly as you left it**. Players see a discovered-only world map and
link sprites on the live map; a curious player reading frames learns nothing about what the DM
hasn't revealed. One active scene per room at launch.

**Vision alignment:** VISION.md Pillar 1 (the Atlas [LAUNCH], promises [LAUNCH], SceneState
[LAUNCH], wire-reality bullet) and milestone M4. `m4-dungeon-recipe-plan.md` §7.2 defers exactly
this arc; this plan cashes that IOU.

**The sequencing argument (pre-made, recon-confirmed):** Atlas BEFORE more recipes. The town recipe
needs buildings-as-promises, which needs the graph; the Kicked-In Door needs Atlas targets; and the
shipped dungeon recipe is a sufficient sole generator to prove graph, links, travel and SceneState
end to end — recon found the generate handler already targets non-live documents
(`generateDungeon.contract.test.ts:344` — "applies to a non-live document without broadcasting the
table") and the resolver's own comment names "a future Atlas auto-generation" as its anticipated
caller (`recipeContext.ts:47-51`). Nothing blocks the graph; everything after it needs it.

---

## 0. How to execute this plan (read this first)

Same method as `m4-dungeon-recipe-plan.md`. Rules, binding:

1. **Do the slices in order** (A1→A7). Don't start a slice until the previous one's _Done when_ is
   fully green.
2. **Read only the Context Capsule files.** Anchors were verified 2026-08-31 at `567c57cb`; match
   on the quoted code, not the line number.
3. **Never exceed 348 lines** in any source file (the guard fails at `wc -l >= 349`; prettier
   EXPANDS files — measure AFTER `prettier --write`). §3's headroom table lists the at-risk files;
   where it says "extract first", extract first.
4. **Write the slice's tests in the same commit. Prove every new test can fail** — sabotage each
   rule independently (a pair can mask each other) and confirm the assertion can also PASS.
5. **When a Trap or Escalate-if fires, STOP and report.** A wrong guess here ships a privacy leak
   or a scene that cannot be resumed.
6. **Commit per slice to `dev`** behind the full HANDOFF-NEXT §2 gate. Do NOT push or merge to
   `main` unless the owner asks — `main` deploys on push, ungated by CI.
7. **Rebuild shared after ANY `packages/shared/src` edit** (`pnpm --filter @herobyte/shared build`)
   — and **boot `pnpm dev` once in any slice that adds a shared runtime value** (HANDOFF §7:
   nothing in the gate can see a barrel-erased const).
8. **Every slice ships its mobile surface in the same slice** (owner rule). Measure it in a
   browser, don't compute it.
9. **Fix bugs found mid-arc regardless of origin**, each in its own commit.

---

## 1. Product goal

### 1.1 What the DM experiences when this ships

- The DM Menu gains an **🗺 Atlas** tab (desktop window and mobile DM screen alike): the campaign
  as an indented tree. Each node shows kind, name, and status — **⬒ promise** (no map yet),
  **▣ mapped**, **▶ you are here**. Actions per node: rename, discover/hide from players, delete,
  **LINK EXISTING MAP** (bind a Map Setup document), **GENERATE** (promise → dungeon via the
  shipped recipe: theme, density, size preset, seed with reroll), and **TRAVEL**.
- **TRAVEL** suspends the current scene and resumes the destination's behind an SNES iris wipe.
  NPC tokens, drawings, door states, and combat stay with the scene they belong to; the party's
  tokens arrive at the destination's staging zone (first visit) or simply re-enter the resumed
  scene. Going back finds the room **exactly** as it was left. First travel to a node marks it
  discovered.
- On the live map, **links** render as door/stair/signpost sprites. The DM places one from the
  Atlas tab (aim, click/tap the canvas), and clicking a sprite offers travel to its target.
- Players get a **🗺 World Map** (desktop header window; mobile tool-sheet entry): discovered
  nodes only, with "you are here". Undiscovered nodes, their names, seeds, and suspended scenes
  never reach a player's wire — enforced in the recipient filter and proven at the raw-frames
  level.

### 1.2 Scope boundaries

**In this arc:** the graph (AtlasNode/MapLink) in room state + persistence + session files; the
discovered-only projection; promise-cashing via the dungeon recipe with recorded provenance; scene
suspend/resume + travel (and the same preservation for plain `set-live` rebinds); the iris wipe;
link sprites + placement; DM tree UI and player world map, desktop AND mobile; contract/leak/e2e
coverage.

**Never in this arc (deferred, §7):** building/wilderness/town/world recipes; the one-keystroke
Kicked-In Door (needs Atlas targets — it is the _next_ arc's opening move); reroll-preserving-pins
(this arc only RECORDS provenance); split-party simultaneous scenes; player-initiated travel;
arrival at the link's anchor (launch arrives at staging zone/center); fog-aware terrain (§7.1 —
investigate-only candidate bonus); `.htcart` anything.

---

## 2. Architecture — the decisions everything hangs on

### 2.1 What recon established (correcting the handoff where it was wrong)

- **Rebinding the live document today preserves NOTHING.** `setLiveDocument`
  (`MapStudioMessageHandler.ts:223-253`) never compares the incoming id to the current one and
  always calls `recompileLiveScene(roomId, undefined, document)` — the `undefined` skips
  `preserveDoorRuntimeStates`, so even a same-document rebind discards every door a player opened.
  Tokens, drawings, combat, fog flags are simply left dangling (grep-verified: the handler never
  touches them). Travel is not "set-live plus a little" — the suspend/resume machinery is the
  arc's real center, and set-live itself should ride it (§2.2).
- **Door runtime state lives INSIDE `state.compiledScene.doors[].state`** (mutated in place by
  `SceneMessageHandler.ts:91`), not in any dedicated collection. Capturing a scene means reading
  it out of the compiled scene; restoring means overlaying it onto a fresh compile.
- **Correction to PROMPT-atlas-arc.md §2:** documents do NOT "fetch over HTTP with WS notify."
  There is no MapDocument HTTP route anywhere (`http/routes.ts` has only assets/health/e2e).
  Documents travel WS-only and DM-only: `map-studio-get` → `map-studio-document`, broadcast via
  `sendMapStudioMessageToDMs` (`messageRouter.ts:721-726`). Players receive only derived output
  (`compiledScene`/`mapTerrain`/`mapElements`) on the snapshot. This is GOOD for the Atlas:
  players already never see documents, so node privacy reduces to filtering the graph metadata.
- **Per-player fog memory is already solved, client-side, per-document.** `exploredFogStore.ts`
  keys `roomId:uid:documentId` and its header documents the deliberate S7 decision that a
  per-player grid in RoomState "would be a new persisted collection, a new SNAPSHOT_LIMITS entry,
  and a per-player namespace inside shared state" for "something whose whole value is that it is
  yours." SceneState therefore does NOT carry fog memory — travel gets per-node fog memory for
  free because the client already keys the mask by `compiledScene.sourceDocumentId`
  (`MapBoard.tsx:155-159`). The one sharp edge: `MAX_REMEMBERED_MAPS = 6` on a global LRU index —
  an Atlas graph will evict a player's own campaign masks; A5 raises it.
- **The recipient filter is the ONE privacy seam** (`recipientFilter.ts`, 329 lines — 19 from the
  ceiling): hidden NPCs filter on `visibleToPlayers !== false` (lines 148-160), monster HP redacts
  per display mode (203-219), whispers/dice fail closed. The discovered-only Atlas projection
  slots beside them — as an **extracted module** the filter calls, because the file has no
  headroom.
- **The wire has compile-enforced inbound validation and NOTHING outbound.**
  `messageValidators` is a mapped type over `ClientMessage["t"]` ("adding a new message type …
  without registering a validator here is a COMPILE ERROR", `validation.ts:6-11`). But the
  server→client direction has no registry: the client `MessageRouter.ts` hand-lists control
  messages (lines 50-62) and silently warns-and-drops unknown types (255-279). **A new server
  message that is not added to that union is silently inert.** Also: an unhandled ClientMessage is
  ACKNOWLEDGED AS SUCCESS (the initiative slice shipped four commits of a message no dispatcher
  routed) — every new type gets a dispatcher test.
- **The client controller queue has no concept of "live".** `useMapStudio` drops queued commands
  wholesale when `queued.documentId !== document.id` (lines 87-91), never cancels an in-flight
  send, and ignores document broadcasts it didn't request. The map-edit hooks are guarded
  (`useMapEditTool.ts:157-159` nulls `document` when `activeDoc.id !== liveDocumentId`), so a
  travel cannot MISROUTE an edit — but `useMapEditState`'s rebind effect deliberately bails when
  any document is already active (`useMapEditState.ts:233-236`), leaving `NotesOverlayLayer` and
  `MapEditPreviewLayer` rendering the OLD document's notes/grid over the NEW map. A5 closes this.
- **Fixture blast radius is known exactly.** A new REQUIRED RoomState field breaks four files
  (`messageRouter.test.ts`, `authorization.characterization`, `error-handling.characterization`,
  `AuthorizationService.test.ts` — all `stateVersion: 0,` literals) → `/fix-fixture-ripple`.
  `sessionRoundTrip.contract.test.ts` breaks at RUNTIME instead: its sweep walks every RoomState
  key and demands each round-trips through the session file or is on `NOT_PERSISTED` — that test
  is this arc's ally, not its victim.

### 2.2 The design

**State model — three new RoomState fields, one derived snapshot field, zero new stores:**

```
RoomState (apps/server/src/domains/room/model.ts — 216 lines, headroom fine)
  atlasNodes: AtlasNode[]                      // required; [] default
  atlasLinks: MapLink[]                        // required; [] default
  sceneStates: Record<string, SceneState>      // required; {} default; keyed by mapDocumentId;
                                               // SERVER-ONLY — stripped from every recipient

RoomSnapshot (wire, all optional — pre-Atlas rooms stay byte-identical)
  atlasNodes?: AtlasNode[]                     // DM: all; players: discovered-only projection
  atlasLinks?: MapLink[]                       // DM: all; players: visible + discovered-from
  currentAtlasNodeId?: string                  // DERIVED in toSnapshot: the node whose
                                               // mapDocumentId === liveMapDocumentId (players:
                                               // only if that node passes their projection)
```

Shared types in a NEW sub-module `packages/shared/src/atlas.ts` (types + `ATLAS_LIMITS` const;
barrel RE-EXPORTS only — §4.3):

```ts
export type AtlasNodeKind =
  | "world"
  | "region"
  | "settlement"
  | "building"
  | "dungeon"
  | "wilderness";
export interface AtlasNode {
  id: string; // client-minted uuid (create) — same convention as map-studio-create
  kind: AtlasNodeKind;
  name: string;
  parentId?: string; // absent = root
  mapDocumentId?: string; // absent = an ungenerated PROMISE (~100 bytes)
  discovered: boolean;
  recipe?: {
    recipeId: "dungeon";
    seed: number;
    theme: "stone" | "wood";
    density: "low" | "medium" | "high";
  }; // provenance, recorded at generation; DM-only on the wire
  createdAt: number;
  updatedAt: number;
}
export interface MapLink {
  id: string;
  fromNodeId: string; // the map the sprite sits on
  toNodeId: string;
  anchor: { x: number; y: number }; // DOCUMENT px on the from-node's map (§3)
  linkType: "door" | "stair" | "signpost";
  visibleToPlayers: boolean;
}
export interface SceneState {
  mapDocumentId: string;
  suspendedAt: number;
  tokens: Token[]; // the NON-traveling tokens (NPCs etc.) left in the scene
  props: Prop[];
  drawings: Drawing[]; // AoE templates ride Drawing.template — captured with them
  doorStates: Record<string, { state: CompiledDoorState; authored: MapDoorState }>;
  combatActive: boolean;
  currentTurnCharacterId?: string;
  fogEnabled: boolean;
  playerStagingZone?: PlayerStagingZone;
  mapBackground?: string;
}
export const ATLAS_LIMITS = { nodes: 64, links: 256 } as const;
```

`ATLAS_LIMITS.nodes = 64` is deliberate: `MAX_SESSION_DOCUMENTS = 64`
(`sessionValidators.ts:19`) caps how many documents a session file may carry, and a graph that
can't export is a graph that breaks the Cartridge promise. The two caps are asserted equal by a
test so neither moves alone.

**Why sceneStates live in RoomState and not a sibling store (settled — do not relitigate):** a
`SceneStateStore` in the container mirrors `MapDocumentStore` cleanly, but adds a MessageRouter
constructor parameter — and four contract suites construct the real router positionally (12/13 of
14 args today). RoomState residency gets StatePersistence durability, Redis-store compatibility
(plain JSON), and the sessionRoundTrip sweep for free, at the cost of three lines in the
persistence field lists. The snapshot cost is ZERO because `toSnapshot` never copies the field —
enforced by a leak test, not by hope. If per-scene payloads ever threaten the state file, the
store extraction is the known escape hatch.

**The travel mechanism — ONE suspend/resume path, shared with set-live:**

NEW `apps/server/src/domains/room/scene/sceneSuspend.ts` (pure functions over RoomState):

```
captureSceneState(state): SceneState        // reads tokens/props/drawings/compiledScene.doors/
                                            // combat/fog/staging/mapBackground; splits tokens
                                            // into (traveling, staying) — see the predicate below
restoreSceneState(state, document, saved | undefined, now)
                                            // compiles the document fresh, overlays saved door
                                            // runtime (only where the door still exists AND its
                                            // authored state matches the captured `authored` —
                                            // the preserveDoorRuntimeStates rule, reused);
                                            // installs saved collections or first-visit defaults
placeArrivals(state, travelers, document)   // traveling tokens land in the restored scene's
                                            // staging zone, else spread at document center
```

**The traveling-token predicate:** a token travels iff its `owner` uid belongs to a player with
`isDM === false`, OR it is the `tokenId` of a `type: "pc"` character (covers a DM piloting a PC).
Everything else — NPC tokens, DM scenery tokens — is scene-local and suspends with the map.
(A4's capsule verifies NPC token ownership against `NPCMessageHandler` before coding this.)

**Cleared on every travel, by design (documented, tested):** `pointers` (ephemeral),
`selectionState` (references dead ids), `drawingUndoStacks`/`drawingRedoStacks` (undo must not
replay cross-scene). `sceneObjects` needs nothing — it is rebuilt every broadcast.
`characters` (the roster, PC and NPC alike, with initiative values) is room-global and does NOT
suspend — an NPC's sheet stays in the panel; its TOKEN stays in its scene.

**Wire flow** (all DM-gated, fire-and-forget + snapshot confirmation — §2.3 on why not the
controller queue):

```
atlas-create-node { node: { id, kind, name, parentId? } }
atlas-update-node { nodeId, patch: { name?, discovered?, parentId? } }
atlas-delete-node { nodeId }                 // children reparent to the deleted node's parent;
                                             // touching links removed; the DOCUMENT is untouched
atlas-link-map    { nodeId, documentId }     // bind an existing document; 1:1 enforced
atlas-generate-node { nodeId, commandId, seed, params: { theme, density, size } }
atlas-create-link { link }                   // anchor aimed on the canvas
atlas-delete-link { linkId }
atlas-travel      { nodeId }                 // suspend → rebind → resume → auto-discover
                                             // idempotent when the node's doc is already live
```

Server→client: `{ t: "atlas-error", code, reason, nodeId? }` to the ACTING DM only (the
`sendControlMessage` path) — and the client `MessageRouter` ControlMessage union gains it in the
same slice, with a test, because that direction has no compile gate (§2.1).

`atlas-generate-node` composes existing machinery end to end: `crypto.randomUUID()` mints the
document id server-side → `MapStudioService.create` (bare TS call, no zod dependency — the
"future Atlas auto-generation" seam the resolver comment names) → `resolveRecipeContext` +
`assertGenerateRequest` + `dungeonRecipe` + `assertRecipeBudget` → ONE synthesized `place-room`
under `message.commandId` (dedupe-safe) → `node.mapDocumentId` + `node.recipe` provenance set →
`broadcastDocument` to DMs + snapshot broadcast + save. A retry that finds the node already
generated acks as success (the REPLAY_LANDED pattern, `MapStudioMessageHandler.ts:160-167`).
Size presets: small 24×20, medium 48×36, large 96×64 cells (all within the recipe's 8×8 floor and
16384-cell ceiling); the document is minted at exactly `cols·grid.size × rows·grid.size` with the
default 50px grid and generation fills bounds `{0, 0, cols, rows}`.

`map-studio-set-live` is REBUILT on the same suspend/resume path: binding away from a live doc
captures it; binding to a doc restores its saved scene if one exists. This fixes today's
lose-everything rebind as a side effect and means travel has no privileged physics — one code
path, tested once, used twice.

**The projection** — NEW `apps/server/src/domains/room/snapshot/atlasProjection.ts` (extracted
because `recipientFilter.ts` is at 329/348), called from `buildRecipientView`:

- DM: nodes and links pass through whole.
- Player: nodes where `discovered === true`, each projected with `recipe` STRIPPED (provenance is
  DM business; a seed plus a reimplemented recipe is a floor-plan oracle) and `parentId` blanked
  when the parent is undiscovered (an orphan renders at the player's root; the parent's existence
  leaks nothing). Links where `visibleToPlayers === true` AND the from-node is discovered, each
  projected with `toNodeId` blanked unless the target is discovered (the sprite renders without
  knowing where it leads). `sceneStates` are stripped from EVERY recipient including the DM —
  they exist on the wire nowhere.

### 2.3 Why not alternatives (recorded so nobody relitigates)

- **Atlas nodes as MapDocument elements:** links/nodes are ROOM state (who discovered what, what
  is suspended where), not authored map content; putting them in documents would ship them to any
  future map-helper role and tie graph edits to document revisions. Rejected.
- **A `SceneStateStore` sibling service:** constructor-arity ripple across four real-router
  contract suites for zero functional gain at launch scale. Rejected (revisit if per-scene
  payloads threaten the state file — see §2.2).
- **Per-player fog memory in SceneState:** the codebase already made and documented the opposite
  call (`exploredFogStore.ts:1-19`); the client store is per-document TODAY. Rejected.
- **Atlas messages through the `useMapStudio` controller queue:** the queue exists to serialize
  REVISION-BOUND document commands; atlas messages carry no `baseRevision`, and the m4 review's
  lesson was about map-studio errors specifically (foreign-commandId drops). Atlas ops are
  snapshot-confirmed room mutations like `create-npc`; they get their own thin error channel
  (`atlas-error`) instead of renting the queue's. Rejected.
- **Auto-creating nodes for every existing document:** surprising, unwanted hierarchy; the DM
  opts documents in via LINK EXISTING MAP. Rejected.
- **Storing `activeAtlasNodeId` in RoomState:** derivable from `liveMapDocumentId` + the 1:1
  node↔document rule; a stored copy is a drift bug waiting. Derived in `toSnapshot`. Rejected.

---

## 3. Units, caps, and headroom (memorize this)

| Thing                                           | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MapLink.anchor`                                | **DOCUMENT px** on the from-node's map (same space as element transforms). Client converts pointer→doc via the existing `usePointerToDoc` path. Validator bounds each coord to a finite number, `\|v\| ≤ 1_000_000`; the handler additionally clamps into the from-document's `width`/`height`.                                                                                                                                                                                                                |
| Token positions                                 | **grid CELLS** (`Token.x/y`); captured/restored verbatim; arrivals computed in cells from the staging-zone RECT (which is world px ÷ gridSize — read `PlayerStagingZone` consumers before converting).                                                                                                                                                                                                                                                                                                         |
| `ATLAS_LIMITS`                                  | nodes 64 (= `MAX_SESSION_DOCUMENTS`, asserted equal by test), links 256. Enforced at the handlers (create rejects at cap) AND at load via `SNAPSHOT_LIMITS` entries.                                                                                                                                                                                                                                                                                                                                           |
| `SNAPSHOT_LIMITS`                               | gains `atlasNodes: 64`, `atlasLinks: 256` — **mandatory**: a key missing from that table reaches state unvalidated and a later `.filter` inside the debounced broadcast timer kills the process (`sessionValidators.ts:69-75`). `sceneStates` do NOT join it (they never ride RoomSnapshot); they get their own envelope caps in `sessionValidators` beside `MAX_SESSION_DOCUMENTS` (≤64 scenes; per-scene tokens ≤1000, drawings ≤5000, props ≤500 — the SNAPSHOT_LIMITS numbers, reused by import).          |
| Snapshot guard                                  | 750KB warn (`SNAPSHOT_SIZE_LIMIT_BYTES`). 64 nodes + 256 links ≈ ≤60KB worst case; A7 adds the `SnapshotSizeGuard.test.ts` case so the budget tracks reality. NOTE the test file is `SnapshotSizeGuard.test.ts` — older plans say "SnapshotCompressionGuard", a stale name.                                                                                                                                                                                                                                    |
| Message cap                                     | 1MB at socket AND pipeline; every atlas message is O(100) bytes.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LOC headroom (measured 2026-08-31, ceiling 348) | `recipientFilter.ts` **329** → projection is a NEW module. `StatePersistence.ts` **329** → three field lines fit; anything more extracts. `MapStudioMessageHandler.ts` **310** → set-live's suspend/resume calls into `sceneSuspend.ts`; travel lives in a NEW `AtlasMessageHandler`. `RoomMessageHandler.ts` **301** → session export additions fit. `model.ts` 216, `SnapshotLoader.ts` 238, `sessionValidators.ts` 146, `RoomDispatcher.ts` 90, `buildDMMenuProps.ts` 115 — fine. E2e specs are NOT exempt. |

---

## 4. Golden rules (violating any of these fails CI or ships a leak)

1. **The recipient filter stays the ONE privacy-filtered producer.** The Atlas projection lives in
   `atlasProjection.ts` called from `buildRecipientView` — never a second producer, never
   post-filtering elsewhere. `toSnapshot` NEVER copies `sceneStates`.
2. **Leak tests are structural, never substrings.** Use `sentinelHits`/`sentinelHitsIn`
   (`ws/__tests__/leakSentinels.ts` — walks values, arrays, object KEYS) with sentinel node
   names/seeds. CI #828 was a `Date.now()` clock colliding with a substring sentinel; positive
   substring asserts are the same bomb inverted.
3. **The shared barrel never declares a runtime value.** `ATLAS_LIMITS` lives in `atlas.ts` and is
   re-exported (`export { ATLAS_LIMITS } from "./atlas.js"`). After the shared edit: rebuild
   shared AND boot `pnpm dev` once — no gate can see this failure.
4. **Every new ClientMessage type**: validator in a NEW module (`atlasValidators.ts`) registered
   in `validation.ts`'s mapped table (compile-enforced); validator tests in
   `middleware/__tests__/validation.test.ts` (`route()` runs AFTER validation — router tests
   prove nothing about validators); a DISPATCHER test proving the type reaches the handler (an
   unhandled type is acknowledged as success); DM gating asserted by a non-DM nack test. Top-level
   schemas NOT `.strict()` (the ack layer stamps `commandId`); nested objects `.strict()`.
5. **Every new ServerMessage type** is added to the client `MessageRouter` ControlMessage union in
   the same slice, with a test that the handler fires — that direction has NO compile gate and an
   unknown type is silently dropped.
6. **One suspend/resume path.** `atlas-travel` and `map-studio-set-live` both go through
   `sceneSuspend.ts`. If the two ever diverge, one of them is wrong.
7. **The scene-capture field table in §2.2 is a CONTRACT.** Captured: tokens(staying)/props/
   drawings/doorStates/combat/fog/staging/mapBackground. Cleared: pointers/selection/undo-stacks.
   Global: characters/players/chat/dice/grid-from-document. Every field gets a travel-round-trip
   assertion; a field added to RoomState later must be classified here or the sessionRoundTrip
   sweep's sibling (A4's capture-completeness test) fails.
8. **`mapBackground` is part of the scene.** `recompileLiveScene` deliberately never touches it —
   travel MUST set it from the restored SceneState (or clear it), or the old map's raster haunts
   the new map.
9. **Determinism discipline is inherited, not re-litigated:** generation still flows through
   `dungeonRecipe` + `assertRecipeBudget` with `idPrefix = commandId`; the golden fixtures and the
   three-attack disguise machinery are untouched. Atlas records provenance; it never re-rolls.
10. **Snapshot compatibility:** all three RoomSnapshot additions are optional and OMITTED when
    empty — a pre-Atlas room's snapshot stays byte-identical (guard with a serialization test).
11. **Grep `toHaveBeenCalledWith` before widening ANY callback signature** (exact-arity asserts);
    stage files by explicit path, never a directory.

---

## 5. The slices

> Sizing: 🟢 ≤~150 new LOC · 🟡 ~150–400 · 🔴 400+ (split if exceeded)

---

### A1 🟡 — The graph exists (shared types → RoomState → wire → projection → persistence)

**Goal:** AtlasNode/MapLink live in room state, round-trip disk and session files, reach the DM's
snapshot whole and the player's snapshot filtered, with the leak proven closed at the frames
level. Backend only; the tree UI is A2.

**Context capsule:**

- `packages/shared/src/index.ts:566-640` (RoomSnapshot fields), `:674-694` (SessionFile — note
  `mapDocuments` comment "not just the live one, so drafts survive too"), `:909-937` (the
  map-studio ClientMessage cluster — atlas messages go in their own labeled block beside it).
- `apps/server/src/domains/room/model.ts:36-78` (RoomState interface), `:108` (empty-state
  defaults), `:132-216` (`toSnapshot` — the DM-gate precedent at 203-205:
  `if (isDM && state.liveMapDocumentId)`).
- `apps/server/src/domains/room/snapshot/recipientFilter.ts:143-165` (the `visibleToPlayers`
  filter shape to mirror), `:32-45` + `:318-329` (RecipientView interface + return — atlas fields
  thread through here).
- `apps/server/src/middleware/validators/sessionValidators.ts:19` (`MAX_SESSION_DOCUMENTS = 64`),
  `:69-96` (the SNAPSHOT_LIMITS mechanism and its process-killing failure mode — read the whole
  comment), `:124-144` (the validation loop).
- `apps/server/src/domains/room/persistence/StatePersistence.ts:142` (load defaults), `:255`
  (save field list) — at 329 LOC; three one-line fields fit, nothing more.
- `apps/server/src/domains/room/snapshot/SnapshotLoader.ts:176-179` (the dangling-binding
  validation precedent to copy for `node.mapDocumentId`).
- `apps/server/src/ws/handlers/RoomMessageHandler.ts:44-66` (`flattenForFile` + its three-ways-
  broken lesson), `:139-159` (load flow + dangling-binding clear), `:178-192` (session export).
- `apps/server/src/ws/dispatchers/RoomDispatcher.ts` (90 LOC — route the atlas types here or in a
  new dispatcher; either way a dispatcher TEST per type).
- `apps/server/src/middleware/validators/generationValidators.ts` (the standalone-module pattern +
  the non-strict-top-level comment to copy verbatim).
- Templates: `ws/__tests__/sessionRoundTrip.contract.test.ts` (13-arg router construction, the
  runtime key sweep + `NOT_PERSISTED` list), `ws/__tests__/leakSentinels.ts` (API),
  `ws/__tests__/hpSecrecy.contract.test.ts:168-170` (sentinel usage shape),
  `ws/__tests__/liveMapBinding.contract.test.ts` (12-arg construction, `flush()` 25ms).

**Changes:**

1. NEW `packages/shared/src/atlas.ts` — the §2.2 types + `ATLAS_LIMITS`; barrel re-exports (types
   - value re-export). **Rebuild shared; boot `pnpm dev` once.**
2. `model.ts`: `atlasNodes: AtlasNode[]`, `atlasLinks: MapLink[]`, `sceneStates:
Record<string, SceneState>` (all REQUIRED; defaults in `createEmptyRoomState`). `toSnapshot`:
   thread `view.atlasNodes`/`view.atlasLinks` (omit when empty), derive `currentAtlasNodeId`
   (only when the matching node survives the recipient's projection). **NEVER copy
   `sceneStates`.** Run `/fix-fixture-ripple` for the four TS2741 files.
3. NEW `snapshot/atlasProjection.ts`: `projectAtlasFor(state, isDM)` per §2.2 (recipe stripped,
   orphaned parentId, link visibility + toNodeId blanking); `recipientFilter` calls it.
4. NEW `middleware/validators/atlasValidators.ts`: schemas for the six CRUD messages (§2.2 wire
   list minus generate/travel — those are A3/A4); register all in the mapped table.
5. NEW `ws/handlers/AtlasMessageHandler.ts` (+ dispatcher wiring): CRUD + link-map with DM gating
   (inline `if (!isDM) throw`, the live-gate precedent), `ATLAS_LIMITS` enforcement, 1:1
   node↔document on `atlas-link-map`, delete-node reparenting + link cleanup. Each mutation
   returns `{ broadcast: true, save: true }`. `atlas-error` ServerMessage type declared (client
   union entry lands with A2's UI).
6. Persistence: `StatePersistence` save/load lines (`?? []` / `?? {}` defaults for old files);
   `SessionFile` gains `atlasNodes?`, `atlasLinks?`, `sceneStates?` (as an ARRAY — file shape,
   Record rebuilt on load); export writes them; load validates + restores; `SnapshotLoader` clears
   a node's `mapDocumentId` when the session file carries no such document (copy the
   liveMapDocumentId precedent); orphaned sceneStates dropped. `SNAPSHOT_LIMITS` +
   session-envelope caps per §3.

**Tests:** validator accept/reject per message; dispatcher routing per type; non-DM nack per type;
CRUD contract test (create → snapshot carries it; players see discovered-only; discover toggle
flips player visibility on the NEXT frame); the **leak gate**: sentinel-named undiscovered node +
seed + suspended-scene sentinel → `sentinelHits(playerWs, …) === []` across every frame, AND
`sceneStates` sentinels absent from the DM's frames too; projection unit tests (orphan parentId,
toNodeId blanking, recipe stripping); persistence round-trip (save→load, old-file defaults);
sessionRoundTrip sweep green with the three fields round-tripping; ATLAS_LIMITS ==
MAX_SESSION_DOCUMENTS assertion; empty-atlas snapshot byte-identity test.

**Done when:** full gate green; `pnpm dev` boots; a console-harness DM can create/link/discover
nodes and a player tab's `__HERO_BYTE_E2E__.snapshot` shows exactly the discovered projection.
**Traps:** the barrel (§4.3); the SNAPSHOT_LIMITS crash comment is not hypothetical; the four
fixtures are TS2741 but sessionRoundTrip fails at RUNTIME — read its failure as instructions;
`sceneStates` is required-with-default, so old `herobyte-state.json` files must load (test it).
**Escalate if:** the projection can't express a rule without touching recipientFilter beyond a
call site + RecipientView fields (the module boundary is wrong), or fixture ripple exceeds the
four known files by more than trivia.

**🔎 SENIOR REVIEW GATE:** privacy lens (every projection rule attacked at the frames level) +
persistence lens (old files, dangling refs) before any UI exists.

---

### A2 🟡 — The DM sees the Atlas (tree UI, desktop + mobile)

**Goal:** the 🗺 Atlas DM Menu tab: tree render, create/rename/discover/delete, LINK EXISTING MAP,
status badges. Mobile via the DM screen's existing `presentation="content"` chip row.

**Context capsule:**

- `apps/client/src/features/dm/components/DMMenuTabs.tsx:5-10` (the tab list — add
  `{ tab: "atlas", label: "Atlas" }`), `DMMenu.tsx:139` (tab mount pattern),
  `DMMenu.types.ts:123-129` (`presentation` — mobile is free if the tab renders in "content").
- `apps/client/src/features/dm/buildDMMenuProps.ts:1-3` + `__tests__/buildDMMenuProps.test.ts:86-137`
  (the complete-key-set pin — new keys UPDATE the 39-key literal; the sentinel-not-undefined
  lesson at lines 51-55).
- `apps/client/src/layouts/props/MainLayoutProps.ts:109-110` ("OPTIONAL so the four layout
  fixtures stay untouched" — follow it; the four fixture files are listed in recon and must stay
  untouched if every new prop is optional).
- `apps/client/src/features/dm/components/map-controls/MapStudioControl.tsx:200-229` (document
  `<select>` + action-button idioms to match; note "no rename anywhere on the wire" applies to
  DOCUMENTS — Atlas nodes rename via `atlas-update-node`).
- `apps/client/src/features/dm/lazy-entry.ts:1-7` (the chunk boundary — the tab ships in the DM
  chunk; type-only imports from entry code).
- `apps/client/src/components/ui/JRPGPanel.tsx` (panel/button variants),
  `MapEditLayersPopover.tsx:26-30` (the closest list idiom; there is NO tree precedent — build a
  flat list with `paddingLeft = depth * 16px`, `role="tree"`/`treeitem` with `aria-level`, and
  keyboard reachability — the initiative-dial a11y gap is not a precedent to copy).
- `apps/client/src/services/websocket/MessageRouter.ts:50-62` (ControlMessage union —
  `atlas-error` joins here NOW, §4.5) + wherever control messages fan out to features (follow one
  existing member end to end before wiring the toast).
- Mobile fit guard template: `apps/e2e/mobile/mobile-dm.spec.ts` (chip-row reach + fit pattern).

**Changes:** NEW `features/atlas/` — `AtlasTab.tsx` (tree + actions), `useAtlasActions.ts`
(sendMessage wrappers), `atlasTree.ts` (pure parent/child ordering — unit-testable, handles
cycles defensively by treating a cycle member as root); DMMenu tab wiring; `buildDMMenuProps`
keys (+ key-set test update); optional `MainLayoutProps` additions threading `atlasNodes`/
`atlasLinks`/`sendMessage`-shaped needs (audit what `DMMenuContainer` already receives first —
prefer reusing an existing prop over adding one); `atlas-error` → ControlMessage union + toast in
the tab. LINK EXISTING MAP reuses the document summaries the Map Setup tab already fetches
(`map-studio-list` — do not invent a second list channel).

**Tests:** `atlasTree` unit (ordering, orphans, cycle defense); AtlasTab render states (promise vs
mapped vs current; discover toggle calls `atlas-update-node`; delete confirms); key-set test
updated; fixture sweep green (all props optional); MessageRouter test: an `atlas-error` frame
reaches the handler (sabotage: remove the union entry, watch it fail). Mobile: extend the
`mobile-dm.spec.ts` pattern — reach the Atlas chip, create a node by touch, fit guard in both
orientations.

**Done when:** gate green; in the browser a DM builds a 3-node tree, links the live map's document
to a node, toggles discovery, and a second (player) tab's world state follows; same flow on the
mobile DM screen, measured.
**Traps:** the DM chunk boundary (a value import from entry code un-splits it — `build:check`
catches the budget, not the split; verify the chunk list); `getByRole` matches ACCESSIBLE names;
`DMMenuTabs` chips already handle overflow by scrolling — don't shrink labels.
**Escalate if:** the tab needs a prop that cannot be optional, or DMMenuContainer's bag can't
carry the atlas data without a second snapshot plumbing path.

---

### A3 🟢 — Cashing a promise (atlas-generate-node)

**Goal:** GENERATE on a promise node mints a document server-side, runs the dungeon recipe into
it, records provenance on the node. The first Atlas moment: click → a dungeon exists.

**Context capsule:**

- `apps/server/src/ws/handlers/MapStudioMessageHandler.ts:119-169` (the generate case — dedupe
  replay first, context/assert/recipe/budget, ONE place-room, REPLAY_LANDED catch; your handler
  mirrors this shape minus the isLive branch, plus doc minting + node update).
- `apps/server/src/domains/generation/recipeContext.ts:27-51` (`resolveRecipeContext` +
  `assertGenerateRequest` — "the gate for any server-side caller that bypasses [zod]"),
  `types.ts:32-47` (RecipeContext/RecipeOutput), `dungeonRecipe.ts:26-31` (signature).
- `apps/server/src/domains/mapStudio/service.ts:42-50` (`create` — duplicate-id guard only),
  `packages/shared/src/mapStudio.ts:39-71` (`createMapDocument` defaults: 2048×2048, grid 50,
  DEFAULT_MAP_LAYERS, revision 0 — pass explicit width/height from the preset).
- `apps/server/src/middleware/validators/generationValidators.ts` (reuse its params/seed
  sub-schemas; new size-preset enum).
- Client: `apps/client/src/features/map-edit/GeneratePanel.tsx` + `mobile/MobileGeneratePanel.tsx`
  (the params-panel idiom + testids to mirror in the Atlas tab's generate popover).

**Changes:** `atlas-generate-node` validator + dispatcher case + handler flow per §2.2 (idempotent
retry: node already generated → success ack + `broadcastDocument`); provenance written to the
node; NEW `AtlasGeneratePanel` in the tab (theme/density/size/seed/reroll — seed prefilled random,
UI-side nondeterminism fine) with a mobile-fitting layout (it renders inside the DM screen —
measure).

**Tests:** contract — generate on a promise: document exists with the preset dimensions, node
carries `mapDocumentId` + provenance, DM snapshot updated, player snapshot shows the node ONLY if
discovered and never the recipe; replay of the same message double-applies nothing; generate on an
already-mapped node → idempotent ack; on a linked-but-foreign document constraint (1:1) still
holds; budget rejection surfaces `atlas-error`. Determinism: same seed+params twice into two
promise nodes → `toEqual` geometry (compare via each document's elements modulo idPrefix — reuse
the golden-test comparison idiom, don't add a new golden).

**Done when:** gate green; browser: GENERATE on a promise → the document appears in Map Setup's
list; TRAVEL is still absent (A4) but `map-studio-set-live` to the new doc shows the dungeon.
**Traps:** `crypto.randomUUID` is Node-native (CI runs 18/20 — fine) but the recipe's element ids
still come from `idPrefix = message.commandId`, NOT the doc id; `assertGenerateRequest` is the
real gate — the zod layer never sees server-minted values.
**Escalate if:** the handler can't stay a thin composition of existing pieces (if you're writing
new geometry/validation logic, stop — something's being reinvented).

---

### A4 🔴 — SceneState + travel (the keystone)

**Goal:** `sceneSuspend.ts`, the rebuilt `set-live`, and `atlas-travel`. After this slice the
server can move the table between nodes losslessly. Client experience is A5; this slice is proven
by contract tests and the console harness.

**Context capsule:**

- `apps/server/src/ws/handlers/MapStudioMessageHandler.ts:223-253` (`setLiveDocument` — the code
  being rebuilt), `:264-280` (`recompileLiveScene` — travel reuses `compileScene` +
  `deriveMapTerrain("elements-only")` + `deriveMapElements` + grid assignment, but door overlay
  comes from the SAVED doorStates, and `state.mapBackground` MUST be assigned from the restored
  scene — §4.8).
- `packages/shared/src/scenePublish.ts:37-84` (`preserveDoorRuntimeStates` +
  `authoredDoorStatesOf` — the authored-state-equality rule your restore reimplements per-door;
  read why `sourceDocumentId` participates).
- `apps/server/src/ws/handlers/SceneMessageHandler.ts:85-104` (door toggles mutate
  `compiledScene.doors[].state` in place — capture reads THIS).
- `apps/server/src/domains/room/model.ts:36-78` (the full field inventory — §4.7's contract
  classifies every line of it), `packages/shared/src/index.ts:457-467` (Character.type/tokenId —
  the traveling predicate), `:642-650` (PlayerStagingZone rect).
- `apps/server/src/ws/handlers/NPCMessageHandler.ts` (verify NPC token ownership for the
  predicate BEFORE coding it) and `domains/token/service.ts:84` (`createToken` — arrivals do NOT
  create tokens, they MOVE existing ones; read it anyway for the staging-zone math precedent, and
  note vision inheritance is irrelevant here because traveling tokens keep their own radius).
- `apps/server/src/domains/room/service.ts:175-233` (broadcast + save + size guard),
  `RouteResultHandler.ts:121-135` (broadcast/save triggers).
- Templates: `liveMapDoorPreservation.contract.test.ts` (door-state assertions through real
  sockets), `sessionRoundTrip.contract.test.ts` (13-arg construction with explicit
  mapStudioService — travel tests need it too).

**Changes:**

1. NEW `domains/room/scene/sceneSuspend.ts` (capture/restore/placeArrivals per §2.2; pure; ≤300).
2. `MapStudioMessageHandler.setLiveDocument` → suspend/resume path (unbind captures too;
   `set-live` to a doc with a saved scene resumes it).
3. NEW `atlas-travel` in `AtlasMessageHandler`: resolve node (must be mapped — else
   `atlas-error`), idempotent no-op when already live, suspend → rebind → resume → arrivals →
   auto-discover → clear pointers/selection/undo-stacks → `{ broadcast: true, save: true }`.
4. First-visit defaults: empty collections, combat off, `fogEnabled` KEEPS the room's current
   value (a judgment call — recorded here so the review can attack it), staging zone undefined →
   arrivals spread at document center.
5. Persistence already carries `sceneStates` (A1); this slice makes the sweep's classification
   real: the capture-completeness test asserts every RoomState key is captured, cleared, global,
   or derived — a NEW key added later fails it by name.

**Tests (the heart of the arc):** travel A→B→A round-trip through real sockets — NPC token
positions, drawings (including a template), an OPEN door, combat mid-fight, fog flag, staging
zone, mapBackground all restored exactly; PC tokens ARRIVE at B (staging zone, then center
fallback) and are NOT duplicated back into A's suspension; a door whose AUTHORED state changed
while suspended takes the new authored state (the preserve rule); `set-live` now preserves the
same way (regression: the old lose-everything rebind is dead); un-generated node travel →
`atlas-error`, state untouched; player frames during the whole dance never contain suspended-
scene sentinels (leakSentinels); non-DM travel nack; snapshot size guard unmoved for empty atlas;
capture-completeness sweep; undo stacks cleared (sabotage: skip the clear, watch the cross-scene
undo test fail).

**Done when:** gate green; console harness: build two nodes, travel between them with a player
tab open — the player's map, fog, and tokens follow; doors reopened on return stay open.
**Traps:** `mapBackground` (§4.8); tokens are grid CELLS while staging zones are px rects —
convert once, in `placeArrivals`, with a test on a non-default grid; `structuredClone` captured
collections (the store-clone lesson: never share references into live state); the 16ms debounce —
`flush()` 25ms before reading frames; travel during an in-flight map-studio command is legal
(revision conflicts already answer it — test it, don't prevent it).
**Escalate if:** the traveling-token predicate can't be stated as one pure function over
(token, players, characters) — if it needs new state, the model is wrong; or if set-live
unification breaks an existing contract test in a way that looks like anything but the old
data-loss behavior dying.

**🔎 SENIOR REVIEW GATE:** state-machine lens (every §4.7 row attacked), privacy lens
(sceneStates + travel frames), race lens (travel vs in-flight commands vs reconnect).

---

### A5 🟡 — The travel experience (client)

**Goal:** travel feels like the vision: iris wipe, camera arrives, nothing stale lingers; the DM
tree gets its TRAVEL button; per-node fog memory survives a real campaign's node count.

**Context capsule:**

- `apps/client/src/ui/MapBoard.tsx:155-159` (fog key from `compiledScene.sourceDocumentId` — the
  SAME field is the wipe trigger: player-visible, changes exactly on travel/rebind), `:671-898`
  (layer order — the wipe overlay mounts ABOVE everything, `listening={false}`).
- `apps/client/src/hooks/useCamera.ts:51` + `useCameraControl.ts:159-163` (camera state + the
  explicit reset path — travel recenter rides a `cameraCommand`, not a new mechanism).
- `apps/client/src/features/map/exploredFogStore.ts:33-36` (`MAX_REMEMBERED_MAPS = 6`, global
  index) — raise to 24 and scope the LRU index per room (`INDEX_KEY` + roomId), migrating nothing
  (old entries just age out).
- `apps/client/src/features/map-edit/useMapEditState.ts:233-236` (the deliberate rebind bail —
  add the one missing case: if `activeId` WAS the previous live id and the live id changed,
  `openDocument(new)`; an explicitly-opened DRAFT stays), `useGenerate.ts:71-89` (clear aimed
  bounds when `activeDocument?.id` changes), `usePopulate.ts:72-112` (same for
  `lastPlacedBounds`).
- `prefers-reduced-motion` handling: find the JuiceDirector-adjacent precedent via
  `grep -r "prefers-reduced-motion" apps/client/src` and match it — reduced motion gets an
  instant swap, not a slower wipe.
- Mobile: the wipe is layout-agnostic (it lives in MapBoard) — verify at 390×844 via the mobile
  e2e project.

**Changes:** NEW `features/map/MapTransitionOverlay.tsx` (~120: canvas/Konva iris — a shrinking
circle mask over the old frame, ~600ms, SNES-stepped radii; skipped entirely under reduced
motion) keyed on `sourceDocumentId` transitions where BOTH old and new are defined (first bind
never wipes); camera recenter on the same transition (staging zone center, else document center);
the `useMapEditState` rebind case; the two stale-aim clears; the fog LRU bump; TRAVEL button +
confirm in the Atlas tab (desktop + mobile DM screen); `helpTopics.ts` gains the travel/Atlas
manual entry (house rule: the manual updates in the slice that changes behavior).

**Tests:** overlay unit tests (trigger matrix: undefined→A no, A→A no, A→B yes; reduced-motion
skip); rebind-case unit test through `useMapEditState` (the M4c lesson: prove the strengthened
effect can PASS on the healthy tree, not only fail); aim-clear tests (sabotage each clear
independently); fog store: 25 documents in one room retain the last 24 (and a second room's
entries don't evict the first's); e2e: DM travels, player screen shows the new map with a
recentered camera and fresh fog, RETURNING shows the old fog memory (poll the mask store through
the harness seam).

**Done when:** gate green; in two browser tabs travel LOOKS right both directions, desktop and
mobile viewport; the DM palette never shows another map's notes after travel.
**Traps:** `vh==dvh==svh` in every local browser — the overlay sizes from the Stage, not the
viewport, so this shouldn't bite, but measure on the mobile project anyway; Konva ignores
synthetic events (drive with CDP where the wipe needs interaction-proofing); do NOT key the wipe
on `liveMapDocumentId` (DM-only field — players would never wipe).
**Escalate if:** the wipe needs MapBoard restructuring beyond mounting one overlay layer, or the
rebind case can't distinguish "was on the live doc" without new plumbing.

---

### A6 🟡 — Links on the map + the player world map

**Goal:** MapLinks render as sprites on the live table (per-recipient filtered server-side); the
DM places them by aiming; sprite-click offers travel; players get their discovered-only world map
on both platforms.

**Context capsule:**

- `apps/client/src/ui/MapBoard.tsx:708-743` (DoorsLayer + the dmView-gated overlay mounts — the
  link layer sits in the background Layer beside DoorsLayer; DM-only affordances gate on
  `dmViewActive`, `playerLens.ts:25-27`, NOT raw isDM).
- `apps/server/src/domains/room/snapshot/atlasProjection.ts` (A1 — links already arrive
  filtered; the client renders what it's given, no client-side privacy).
- The shipped touch-aim pattern for mobile placement: `useMapEditTouchAim` consumers ("press
  AIMS, release DROPS") and `usePointerToDoc.ts` (world→doc px). Link placement is an ATLAS
  action with a one-shot canvas aim, NOT a map-edit sub-tool — links are room state, not document
  elements (§2.3), so the palette, `MapEditSubTool`, and the four-fixture prop clusters stay
  untouched.
- `apps/client/src/hooks/useMobileSurface.ts:13` (the surface union — add `"atlas"`; the props
  surface is the precedent for a conditional player surface), `MobileFloatingControls.tsx:104-187`
  (tool-sheet grid — add the 🗺 entry; the dock stays five, settled), the M6 trap: a new sheet
  entry can cost MAP height — `mobile-map-edit-panels.spec.ts` holds a floor on the MAP; measure.
- `apps/client/src/components/dice/DraggableWindow.tsx:9-21` (desktop player window; aria-label
  "Close <title>" comes free) + `MainLayoutProps.ts` optional-prop convention for the header
  button wiring.

**Changes:** NEW `features/map/AtlasLinksLayer.tsx` (sprites by linkType — pixel-art glyphs are
fine as Konva shapes/text v0; art-track sprites can replace them later); DM sprite-click →
travel-confirm (reusing A5's confirm), player sprite-click inert at launch; link placement flow
in the Atlas tab (LINK → pick target node → aim on canvas → `atlas-create-link`; ESC/second-
finger cancels — mirror the shipped cancel semantics); NEW `features/atlas/WorldMapPanel.tsx`
(read-only discovered tree + "you are here" from `currentAtlasNodeId`) mounted desktop (header
button + DraggableWindow, optional props) and mobile (new `"atlas"` surface + tool-sheet entry,
`data-mobile-surface="atlas"`).

**Tests:** AtlasLinksLayer render (player sees only what the projection sent — assert by feeding
a player-shaped snapshot; DM sees hidden links marked); placement unit tests (aim converts via
the document grid; cancel drops cleanly); WorldMapPanel render states ("you are here", empty
state for undiscovered campaigns); surface-machine tests (one open surface at a time still
holds); e2e: DM places a link, player tab sees the sprite at the anchor, DM clicks → confirm →
travel fires; mobile: place a link by touch, open the world map from the tool sheet, fit guards.

**Done when:** gate green; the Maya loop's navigation skeleton exists: sprites on maps, a world
map in every player's pocket, travel one click from either.
**Traps:** sprites must not intercept map input (`listening` only on the sprite hit area, DM
only); anchors are DOCUMENT px — rendering multiplies through the same cam+mapTransform groups as
DoorsLayer (copy its transform nesting exactly); the tool-sheet MAP-height floor; `getByRole`
accessible-name discipline for the new buttons.
**Escalate if:** the aim flow wants to become a map-edit sub-tool after all (that decision is
settled in §2.3 — report, don't drift into it).

---

### A7 🟢 — The journey, the budgets, the docs, the sweep

**Goal:** lock the arc in end to end.

**Changes:**

1. NEW `apps/e2e/atlas-journey.smoke.spec.ts` (≤348 — specs count): DM context + player context;
   DM builds a two-node graph over the harness seam (UI drives the moments that matter: GENERATE
   panel, TRAVEL confirm, a link placement), travels A→B→A; assertions: player map/fog follow,
   door state survives the round trip, the player's raw snapshot never contains the undiscovered
   node's name/seed or any sceneState, world map shows discovered-only, one Undo on B removes the
   generated dungeon (generation and travel compose). Serial, cleanup in `finally` (delete
   created nodes/links; the table is shared).
2. `SnapshotSizeGuard.test.ts`: a 64-node/256-link atlas + a maxed suspended scene stays under
   750KB per recipient — built by the REAL handlers, not literals.
3. Mobile journey leg in `apps/e2e/mobile/` (join, DM screen Atlas chip, travel, world map).
4. Docs: VISION.md M4 note (Atlas + SceneStates shipped); `m4-dungeon-recipe-plan.md` §7.2 gets
   its cashed-IOU note; HANDOFF-NEXT §0 + §10 updated IN THE SAME COMMIT as this closure;
   memory file for the arc.
5. Full ladder end to end; restate every suite count in the final report (recon counts are
   stale by then — re-run, don't copy).

**Done when:** everything green, twice (the determinism habit); the arc's SHIPPED banner lands
atop this plan with what changed against Rev 2.

**🔎 SENIOR REVIEW GATE (final):** the standing adversarial review of the arc (finder lenses +
independent refuters + completeness critic), then `agents_error` checked and `git status` audited.

---

## 6. Failure drills (when X happens, do Y — do not improvise)

| Symptom                                                       | Cause                                                                                  | Fix                                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| An atlas message does nothing, no error, ack success          | dispatcher case missing (unhandled = acknowledged)                                     | the dispatcher test from §4.4 should have caught it; add the case AND the test |
| `atlas-error` never appears in the client                     | ControlMessage union entry missing (silent drop by design)                             | §4.5; MessageRouter test                                                       |
| Player sees a node flash before discovery                     | projection bypassed — something copied `state.atlasNodes` outside `buildRecipientView` | §4.1; grep for the second producer                                             |
| Load-session kills the server after adding a collection       | key missing from `SNAPSHOT_LIMITS`                                                     | §3; the sessionValidators comment names this exact death                       |
| `pnpm dev` won't boot after the shared edit; every gate green | `ATLAS_LIMITS` declared in the barrel                                                  | §4.3; sub-module + re-export; boot check                                       |
| Old map's raster background under the new map after travel    | `mapBackground` not restored (recompile never touches it)                              | §4.8                                                                           |
| Doors reset on travel back                                    | restore overlaid before compile, or authored-state equality skipped                    | reuse the `preserveDoorRuntimeStates` rule; A4's door test pins it             |
| Party token duplicated in two scenes                          | traveler removed from arrival set but not from the capture                             | the predicate splits ONCE, in `captureSceneState`                              |
| Undo after travel edits the wrong scene                       | undo stacks not cleared                                                                | §2.2 cleared-list; its sabotage test                                           |
| Wipe never fires for players                                  | keyed on `liveMapDocumentId` (DM-only)                                                 | key on `compiledScene.sourceDocumentId` (A5)                                   |
| DM palette shows the old map's notes after travel             | the rebind bail (`useMapEditState:233-236`)                                            | A5's rebind case                                                               |
| A player's fog memory vanishes mid-campaign                   | the 6-entry global LRU                                                                 | A5 raises + room-scopes it                                                     |
| Session export rejected on import                             | >64 documents (nodes minted past the cap)                                              | ATLAS_LIMITS == MAX_SESSION_DOCUMENTS; the equality test                       |
| Fixture TS2741 storm on RoomState                             | the required fields                                                                    | `/fix-fixture-ripple`, never hand-edit from the orchestrator                   |
| Mass e2e failure across unrelated features                    | harness fault (concurrent build, orphaned ports)                                       | re-run ONE named spec alone before believing anything                          |

---

## 7. Deferred follow-ups (recorded, not licensed)

### 7.1 Fog-aware terrain — the candidate BONUS, investigate-only

`m4-dungeon-recipe-plan.md` §7.1: the generated-secret-door dial needs unexplored terrain to stop
shipping. SceneState + per-document explored fog do NOT unblock it by themselves — explored fog is
client-local and NOT a privacy boundary (owner-settled). The honest unlock remains server-side
per-recipient terrain filtering. AFTER A7, if the arc lands with budget to spare: a spike doc
sizing `deriveMapTerrain` per-recipient + incremental reveal, no code. Anything more is a new arc.

### 7.2 Everything else

The Kicked-In Door keystroke (next arc's opener — it finally has targets); building-interior
recipes cashing town promises; reroll-preserving-pins (provenance now exists; `pinned` does not);
split-party simultaneous scenes; player-initiated travel/knocking; arrival at the link anchor;
link sprites from the art track; a graphical (spatial) world map view; Cartridge Codes UI.

---

## 8. Command crib sheet

```bash
pnpm --filter @herobyte/shared build       # ALWAYS after shared edits; then boot pnpm dev once
CI=true pnpm build && CI=true pnpm typecheck && CI=true pnpm lint && CI=true pnpm lint:structure:enforce && CI=true pnpm format:check
CI=true pnpm test
CI=true pnpm --filter herobyte-client build:check
CI=true pnpm test:e2e --reporter=list      # read the summary LINE; a flaky pass prints "1 flaky" and exits 0
pnpm --filter vtt-server test -- atlasProjection      # single-file, package-relative paths
```

Use `/verify-gates` after every burst (never ask it for a bundle figure AND e2e in one prompt);
`/fix-fixture-ripple` for the TS2741 storm; `/watch-ci` after any push.

**Glossary:** _promise_ — an AtlasNode with no `mapDocumentId` (~100 bytes of metadata). _cashing
a promise_ — `atlas-generate-node` or `atlas-link-map` giving it a real document. _suspend/
resume_ — `sceneSuspend.ts` capture/restore around a live-binding change; the ONE path shared by
travel and set-live. _projection_ — `atlasProjection.ts`, the per-recipient discovered-only view;
the only legal producer of wire-visible atlas data. _traveling token_ — §2.2 predicate; arrives
at the destination, never suspends. _the sweep_ — sessionRoundTrip's runtime walk over RoomState
keys; A4 adds its capture-completeness sibling.

**Review-gate sizing** (the m4 lesson): run gate workflows in small waves — ≤4 concurrent agents;
an errored or empty verify pass is an infrastructure failure, not a clean pass; check
`agents_error` and audit `git status` after every run.

---

## 9. Rev 2 — what the pre-execution adversarial review changed

_(Populated after the review ran; see the commit that produced Rev 2.)_
