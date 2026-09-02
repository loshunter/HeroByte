# The Atlas — M4 Phase 2 — Execution Plan

> **THE ARC IS COMPLETE — all seven slices SHIPPED on `dev`, 2026-09-01, NOT pushed/merged
> (the owner's call).** A1 `fd7afb17` → A2 `a17d6b99` → review fixes `1543a08e..effddc5b` →
> A3 `7d7251a5` → A4 `3fcce20b` → A5 `efabc884` → A6 `c4d86c97` → A7 (this commit). Every
> slice: full gate, sabotage-all-red, live browser verification on desktop AND phone. The
> per-slice SHIPPED banners below carry every deviation and every number; §6's failure drills
> and §7's deferrals are the map for whoever comes next. Maya's Tuesday works: promise →
> GENERATE → TRAVEL behind the iris → suspend/resume that survives a round trip, links on the
> map, and a discovered-only world in every player's pocket.

**Status:** Rev 2 — authored 2026-08-31 after a 6-reader recon at `dev` = `567c57cb`;
**adversarially reviewed before execution** (four attack lenses at `5260cadb`; one lens died to a
session limit mid-report and was re-run in full — an errored review is unexamined ground, not a
clean pass). The review produced 2 BLOCKERs, 10 HIGHs and ~20 more findings; §9 records every
disposition. The three settled decisions (§2.3) all survived refutation attempts. Do the slices
in order; each slice's _Done when_ gates the next.

**Mission:** the campaign becomes a navigable graph of linked maps. A DM opens an **Atlas** tab and
sees their world as a tree — nodes for dungeons, buildings, regions; some backed by real maps, some
~100-byte **promises**. Clicking GENERATE on a promise mints a real dungeon in seconds (the shipped
recipe, provenance recorded). **Travel** moves the whole table to another node behind an iris wipe:
the old scene — NPC tokens, door states, drawings, combat — is **suspended exactly as it stands**,
and coming back **resumes it exactly as you left it**. Players see a discovered-only world map and
link sprites on the live map. One active scene per room at launch.

**Secrecy claim, stated honestly (review finding P3):** "a curious player reading frames learns
nothing" holds **within the friends-scale identity model** — secrecy is from the other people at
the table reading their own frames, not from someone willing to impersonate the DM's
client-asserted uid (`recipientFilter.ts:63-75` documents this bound; §9 owner decision, settled).
The Atlas raises the value of what that model protects; §7.2 records the cheap hardening
(per-connection re-elevation) as a future arc's option, not this one's scope.

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
2. **Read only the Context Capsule files.** Anchors were verified 2026-08-31 at `567c57cb` (and
   re-verified by four review agents); match on the quoted code, not the line number.
3. **Never exceed 348 lines** in any source file (the guard fails at `wc -l >= 349` and only on
   NEW violators — baselined files may grow; prettier EXPANDS files — measure AFTER
   `prettier --write`). §3's headroom table lists the at-risk files; where it says "extract
   first", extract first.
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
  NPC tokens, drawings, door states, combat and initiative stay with the scene they belong to; the
  party's tokens arrive at the destination's staging zone (first visit) or simply re-enter the
  resumed scene. Going back finds the room **exactly** as it was left. First travel to a node
  marks it discovered.
- On the live map, **links** render as door/stair/signpost sprites. The DM places one from the
  Atlas tab (aim, click/tap the canvas), and clicking a sprite offers travel to its target.
- Players get a **🗺 World Map** (desktop header window; mobile tool-sheet entry): discovered
  nodes only, with "you are here". Undiscovered nodes, their names, seeds, and suspended scenes
  never reach a player's wire — enforced in the recipient filter and proven at the raw-frames
  level (within the identity model stated above).

### 1.2 Scope boundaries

**In this arc:** the graph (AtlasNode/MapLink) in room state + persistence + session files + table
fork; the discovered-only projection; promise-cashing via the dungeon recipe with recorded
provenance; scene suspend/resume + travel (and the same preservation for `set-live` rebinds); the
iris wipe; link sprites + placement; DM tree UI and player world map, desktop AND mobile;
contract/leak/e2e coverage.

**Never in this arc (deferred, §7):** building/wilderness/town/world recipes; the one-keystroke
Kicked-In Door (needs Atlas targets — it is the _next_ arc's opening move); reroll-preserving-pins
(this arc only RECORDS provenance); split-party simultaneous scenes; player-initiated travel;
arrival at the link's anchor (launch arrives at staging zone/center); fog-aware terrain (§7.1 —
investigate-only candidate bonus); changing `map-studio-publish`'s physics (it stays a legacy
compile-onto-the-table path outside the suspend/resume model — see the transition table);
`.htcart` anything.

---

## 2. Architecture — the decisions everything hangs on

### 2.1 What recon established (correcting the handoff where it was wrong)

- **Rebinding the live document today preserves NOTHING.** `setLiveDocument`
  (`MapStudioMessageHandler.ts:223-253`) never compares the incoming id to the current one and
  always calls `recompileLiveScene(roomId, undefined, document)` — the `undefined` skips
  `preserveDoorRuntimeStates`, so even a same-document rebind discards every door a player opened.
  Tokens, drawings, combat, fog flags are simply left dangling (grep-verified: the handler never
  touches them). Travel is not "set-live plus a little" — the suspend/resume machinery is the
  arc's real center, and set-live itself rides it (§2.2).
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
  an Atlas graph will evict a player's own campaign masks; A5 reworks it (with migration — the
  old index is the only evictor, so abandoning it orphans masks forever).
- **The recipient filter is the ONE privacy seam** (`recipientFilter.ts`, 329 lines — 19 from the
  ceiling): hidden NPCs filter on `visibleToPlayers !== false` (lines 148-160), monster HP redacts
  per display mode (203-219), whispers/dice fail closed. The discovered-only Atlas projection
  slots beside them — as an **extracted module** the filter calls, because the file has no
  headroom.
- **The wire has compile-enforced inbound validation and NOTHING outbound.**
  `messageValidators` is a mapped type over `ClientMessage["t"]` ("adding a new message type …
  without registering a validator here is a COMPILE ERROR", `validation.ts:6-11`). But the
  server→client direction has no registry: the client `MessageRouter.ts` hand-lists control
  messages in TWO places — the type union (:50-62) AND the runtime `isControlMessage` guard
  (:349-366) — and silently warns-and-drops unknown types (255-279). **A new server message
  missing from the runtime guard is silently inert.** Also: an unhandled ClientMessage is
  ACKNOWLEDGED AS SUCCESS (`messageRouter.ts:395-396` — the initiative slice shipped four commits
  of a message no dispatcher routed).
- **"Fire-and-forget" is not what the transport does.** Every outgoing message gets a `commandId`
  stamped by the ack layer (`CommandAckManager.attachCommandId:42-51`; `shouldTrack` covers
  everything not explicitly excluded), is acked, and is **retried up to 3× with the same
  commandId** on a missed ack (`MessageQueueManager.ts:365-396`), including across reconnects.
  Atlas mutations must therefore be replay-idempotent (§4).
- **The client controller queue has no concept of "live".** `useMapStudio` drops queued commands
  wholesale when `queued.documentId !== document.id` (lines 87-91), never cancels an in-flight
  send, and ignores document broadcasts it didn't request. The map-edit hooks are guarded
  (`useMapEditTool.ts:157-159` nulls `document` when `activeDoc.id !== liveDocumentId`), so a
  travel cannot MISROUTE an edit — but `useMapEditState`'s rebind effect deliberately bails when
  any document is already active (`useMapEditState.ts:233-236`), leaving `NotesOverlayLayer` and
  `MapEditPreviewLayer` rendering the OLD document's notes/grid over the NEW map. A5 closes this.
- **Fixture blast radius.** A new REQUIRED RoomState field breaks four test files
  (`messageRouter.test.ts`, `authorization.characterization`, `error-handling.characterization`,
  `AuthorizationService.test.ts` — all `stateVersion: 0,` literals) → `/fix-fixture-ripple` —
  PLUS the production literals: `createEmptyRoomState`, `StatePersistence`'s load literal, and
  **`SnapshotLoader.mergeSnapshot`'s complete RoomState literal** (`SnapshotLoader.ts:131-199`),
  where the value choice is a real decision, not mechanics (§4.13).
  `sessionRoundTrip.contract.test.ts` breaks at RUNTIME instead: its sweep walks every RoomState
  key and demands each round-trips through the session file or is on `NOT_PERSISTED` — that test
  is this arc's ally, not its victim (but its `hadValue` check passes vacuously for `[]`/`{}`, so
  A1's fixture must POPULATE the new collections with sentinels).

### 2.2 The design

**State model — three new RoomState fields, one derived snapshot field, zero new stores:**

```
RoomState (apps/server/src/domains/room/model.ts — 216 lines, headroom fine)
  atlasNodes: AtlasNode[]                      // required; [] default
  atlasLinks: MapLink[]                        // required; [] default
  sceneStates: Record<string, SceneState>      // required; {} default; keyed by mapDocumentId;
                                               // SERVER-ONLY — stripped from every recipient

RoomSnapshot (wire, all optional)
  atlasNodes?: AtlasNode[]                     // DM: whole; players: whitelist projection below.
                                               // OMITTED when the RECIPIENT's projected array is
                                               // empty (an empty [] would itself announce "there
                                               // is an atlas you haven't seen")
  atlasLinks?: MapLink[]                       // same per-recipient omission rule
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
  }; // provenance, recorded at generation; NEVER projected to players
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
  tokens: Token[]; // stayers only (see the traveler predicate)
  props: Prop[];
  drawings: Drawing[]; // AoE templates ride Drawing.template — captured with them
  sceneObjects: SceneObject[]; // the graph residue: the "map" object's transform (an INPUT to
  //                              server-side fog — visionFilter.ts:41-43), per-object gizmo
  //                              scale/rotation, locked flags, zIndex. NOT derivable (review S3)
  characterLinks: Record<string, string>; // tokenId -> characterId at capture, for restore-GC
  doorStates: Record<string, { state: CompiledDoorState; authored: MapDoorState }>;
  combatActive: boolean;
  currentTurnCharacterId?: string;
  initiatives: Record<string, { initiative: number; modifier?: number }>; // per-character values
  //                              held at capture (verify the exact modifier field name on
  //                              Character at slice time) — the roster is global and a second
  //                              fight legitimately clears it (review S2)
  fogEnabled: boolean;
  defaultVisionRadius: number | null; // fog's companion dial — same scene-local argument
  playerStagingZone?: PlayerStagingZone;
  mapBackground?: string;
}
export const ATLAS_LIMITS = { nodes: 64, links: 256 } as const;
```

**The document-count cap (review F2 overturned Rev 1's invariant):** `ATLAS_LIMITS.nodes = 64`
alone protects nothing — nodes and documents are decoupled (promises mint nothing; unlinked
drafts exist by design), and export is uncapped while import rejects >64 documents
(`sessionValidators.ts:18` bounds only the inbound envelope; `RoomMessageHandler.ts:178` exports
everything). The real invariant: **no minting path may take a room past `MAX_SESSION_DOCUMENTS`
documents.** `atlas-generate-node` AND `map-studio-create` refuse when
`mapStudioService.list(roomId).length >= MAX_SESSION_DOCUMENTS` (export the constant — it is
module-private today). The cap-refusal test replaces Rev 1's 64==64 equality test; an at-cap
room's export must round-trip.

**Why sceneStates live in RoomState and not a sibling store (settled — survived refutation):** a
`SceneStateStore` in the container mirrors `MapDocumentStore` cleanly, but adds a MessageRouter
constructor parameter — and four contract suites construct the real router positionally (12/13 of
14 args today). RoomState residency gets StatePersistence durability and the sessionRoundTrip
sweep for free. The refutation attempt's one quantified pressure point stands as a WATCH ITEM:
`RoomService.broadcast` calls `saveState()` on every broadcast and `StatePersistence` serializes
SYNCHRONOUSLY on the message loop (`StatePersistence.ts:269-275`), so worst-legal-case suspended
payloads put multi-MB `JSON.stringify` on the hot path — A7 measures the serialized cost, and the
store extraction is the recorded escape hatch. Redis mode: `RedisRoomStore.hydrate` is a bare
`JSON.parse` with no defaults, so A1's normalization helper (§4.13) is shared by BOTH load paths.

**The suspend/resume machine — ONE path, one table.** NEW
`apps/server/src/domains/room/scene/sceneSuspend.ts` (pure, synchronous functions over RoomState):

```
captureSceneState(state): { saved: SceneState; travelers: Token[] } | null
    // null when there is nothing capturable (no compiledScene, or its source document no longer
    // exists). Capture KEY is compiledScene.sourceDocumentId — the scene actually on the table —
    // NEVER liveMapDocumentId (the binding can be cleared or point elsewhere; review S1).
    // Splits tokens by the traveler predicate; captures the §4.7 "captured" bucket including the
    // sceneObjects residue (minus travelers' entries, which stay live and ride along).
restoreSceneState(state, document, saved | undefined, now)
    // compiles the document fresh; overlays saved door runtime only where the door still exists
    // AND its authored state matches the captured `authored` (the preserveDoorRuntimeStates
    // rule); installs saved collections or first-visit defaults; RESTORE-GC (below); overlays
    // saved initiatives onto still-existing characters and re-validates currentTurnCharacterId
    // against the resulting order (clear it if absent); sceneObjects := saved residue ∪ the
    // travelers' live entries; sets mapBackground from saved (or clears it); applies the CLEAR
    // list. The clear list runs on EVERY restore, not every travel (review S1).
placeArrivals(state, travelers, document)
    // TRAVEL ONLY. Travelers land via the StagingZoneManager.getSpawnPosition precedent
    // (zone rects are CELL-space and center-anchored — §3); px→cells conversion exists ONLY for
    // the document-center fallback. Injectable rng (getSpawnPosition uses Math.random today);
    // tests assert containment-in-rect, never exact cells.
```

**Restore-GC (review S4):** on restore, drop a captured token when `characterLinks` says it was
character-linked at capture and that character is now gone or now links a DIFFERENT token (the
`place-npc-token` delete-and-recreate flow mints new tokens while the old one is suspended —
`character/service.ts:234-244`). This is the one code site that keeps suspended scenes coherent
with the global roster's lifecycle operations (`delete-npc`/`delete-character` force-delete only
LIVE tokens). `clear-all-tokens` deliberately clears the LIVE scene only — suspended scenes are
per-map history and survive it (documented behavior, tested).

**The traveling-token predicate (review C3 overturned Rev 1's — classify by CHARACTER first,
ownership second; `isDM` is dynamic and EXIT DM MODE would have turned every goblin into a
traveler):**

1. a token that is the `tokenId` of a `type: "npc"` character → scene-local, always;
2. a token that is the `tokenId` of a `type: "pc"` character → travels;
3. a character-less token → travels iff its `owner` uid has a player record with
   `isDM === false` at travel time; otherwise scene-local.

One pure function over (token, players, characters). Ground truth verified: join auto-creates
character+token for non-DMs; NPC tokens carry the placing DM's uid; neither disconnect nor
heartbeat timeout deletes player records or tokens anymore (`HeartbeatTimeoutManager.ts:50-67`),
so offline players' tokens still travel with the party.

**Cleared on every RESTORE, by design (documented, tested):** `pointers` (ephemeral),
`selectionState` (references dead ids), `drawingUndoStacks`/`drawingRedoStacks` (undo must not
replay cross-scene). `characters` (the roster, PC and NPC alike) is room-global — an NPC's sheet
stays in the panel; its TOKEN stays in its scene; its INITIATIVE value is captured per scene
(above) because the roster copy is legitimately destroyed by the next fight.

**The binding-transition table (review S1's BLOCKER — this table IS the spec; every row gets a
contract test in A4):**

| Transition                                                                                                                                                 | Capture?                                                                                        | Restore?                                                                                                              | Travelers                                                                                                      | Notes                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`atlas-travel` (bound→bound)**                                                                                                                           | yes, under `compiledScene.sourceDocumentId`                                                     | yes (saved or first-visit defaults)                                                                                   | split; `placeArrivals` warps them to staging/center                                                            | then rebind, auto-discover, `{broadcast, save}`                                                                                                                                                                                                                                                                               |
| **`set-live` bound→bound (rebind)**                                                                                                                        | yes, same                                                                                       | yes, same                                                                                                             | split; travelers **KEEP their current cells** — a prep rebind must not teleport the party (no `placeArrivals`) | fixes today's lose-everything rebind                                                                                                                                                                                                                                                                                          |
| **`set-live`/travel to the SAME doc**                                                                                                                      | no                                                                                              | no                                                                                                                    | —                                                                                                              | idempotent no-op; directly kills today's same-doc door-state loss                                                                                                                                                                                                                                                             |
| **`set-live` unbound→bound, NO compiled scene on the table**                                                                                               | no (nothing capturable)                                                                         | compile-only — no saved-scene install, no defaults, no traveler handling; tokens/drawings stay exactly where they are | —                                                                                                              | this IS the START LIVE MAP flow (review C1's BLOCKER: an uploaded-background table with placed tokens must survive its first bind untouched)                                                                                                                                                                                  |
| **`set-live`/travel away from an ORPHAN scene** (compiledScene present, binding absent or ≠ sourceDocumentId — after unbind, delete-of-live, or a publish) | yes IF the source document still exists, else no (uncapturable — its doc is gone; log, proceed) | destination as usual                                                                                                  | per the row above that applies                                                                                 | capture keys on the scene, not the binding                                                                                                                                                                                                                                                                                    |
| **`set-live` null (unbind)**                                                                                                                               | **no**                                                                                          | no                                                                                                                    | —                                                                                                              | today's exact semantics kept: binding cleared, scene keeps playing (`MapStudioMessageHandler.ts:229-233`). Suspension happens when a scene is REPLACED, never before — so the post-unbind interlude keeps evolving and is captured intact at the next real transition (review S1's "interlude discarded" hazard designed out) |
| **`map-studio-delete` of the live doc**                                                                                                                    | no                                                                                              | no                                                                                                                    | —                                                                                                              | today's semantics kept (binding cleared, scene keeps playing) PLUS `sceneStates[documentId]` is deleted — for EVERY deleted doc, live or not (id-reuse via import round-trips ids would resurrect a stale scene onto a different map; review S8/C8)                                                                           |
| **`map-studio-publish`**                                                                                                                                   | no                                                                                              | no                                                                                                                    | —                                                                                                              | legacy path, unchanged physics: compiles an arbitrary doc onto the table without binding (`:205-215`). Scene continuity through publish is NOT promised; the client wipe fires (the map did change). Recorded in §1.2 as out of scope                                                                                         |

**Wire flow** (all DM-gated; snapshot-confirmed; **replay-idempotent per §4.5** — the ack layer
retries same-commandId, so "fire-and-forget" was never true):

```
atlas-create-node { node: { id, kind, name, parentId? } }     // create-with-existing-id → success ack
atlas-update-node { nodeId, patch: { name?, discovered?, parentId? } }
atlas-delete-node { nodeId }                 // children reparent to the deleted node's parent;
                                             // touching links removed; the DOCUMENT is untouched
                                             // — and therefore its sceneState is too (say it:
                                             // scene follows document, not node); delete-absent
                                             // → success ack
atlas-link-map    { nodeId, documentId }     // bind an existing document; 1:1 enforced;
                                             // already-bound-to-the-same-doc → success ack
atlas-generate-node { nodeId, commandId, seed, params: { theme, density, size } }
atlas-create-link { link }                   // anchor aimed on the canvas
atlas-delete-link { linkId }                 // delete-absent → success ack
atlas-travel      { nodeId }                 // per the transition table + auto-discover;
                                             // node unmapped OR its document missing from the
                                             // store (state file vs maps file can desync at
                                             // boot) → atlas-error, state untouched
```

Server→client: `{ t: "atlas-error", code, reason, nodeId? }` to the ACTING DM only (the
`sendControlMessage` path — verified single-uid). The client `MessageRouter` gains it in **A1**
(golden rule 5 — Rev 1 deferred this to A2, violating its own rule), in BOTH hand-lists: the
type union (:50-62) AND the runtime `isControlMessage` guard (:349-366) — only the guard changes
behavior, so the sabotage targets the guard.

**`atlas-generate-node` (review F1 overturned Rev 1's ordering — validate before persisting):**

1. **Node guard first** (before anything is minted): node already has `mapDocumentId` → success
   ack + `broadcastDocument` (the REPLAY_LANDED posture — this guard, not the place-room dedupe
   cache, is the cross-attempt idempotency: the cache key contains the document id, which a
   retry doesn't have yet, so it is structurally dead here).
2. Doc-count cap check (above) → `atlas-error` at the cap.
3. Mint the document OBJECT purely — `createMapDocument({ id: crypto.randomUUID(), name:
node.name, width: cols·50, height: rows·50 })` (`node:crypto` import precedent exists in
   character/chat/dice services; document names are safe — no player-visible channel carries
   them, verified) — then `resolveRecipeContext` + `assertGenerateRequest` + `dungeonRecipe` +
   `assertRecipeBudget` against that in-memory object. **Nothing is persisted yet**, so a
   validation/budget failure orphans nothing.
4. Only on success: `MapStudioService.create` (persist) → `service.apply` the ONE synthesized
   `place-room` (`commandId: message.commandId`, `baseRevision: 0`) → set `node.mapDocumentId` +
   `node.recipe` provenance → `broadcastDocument` + `{broadcast, save}`. Any throw after create
   deletes the document (`service.delete`) before rethrowing — no orphans (tested by killing the
   flow between create and node-update, then retrying: exactly one document must exist).

Size presets: small 24×20, medium 48×36, large 96×64 cells — the recipe floor is **20×20**
(`MIN_RECIPE_COLS/ROWS`, `types.ts:87-88` — Rev 1 said 8×8, which is the VALIDATOR's floor, not
the recipe's; small sits at zero row margin ON PURPOSE) and the ceiling 16384 cells; a test pins
every preset ≥ the floor. Generation fills bounds `{0, 0, cols, rows}` on the default 50px grid.

**The projection** — NEW `apps/server/src/domains/room/snapshot/atlasProjection.ts` (extracted
because `recipientFilter.ts` is at 329/348), called from `buildRecipientView`. **Whitelist
CONSTRUCTORS, never strip-lists** (review P2 — a spread-based projection fails OPEN for every
future field; the codebase's own standard is `compiledSceneView.ts`'s re-merge because "the
SEGMENTATION talks too"):

- DM: nodes and links pass through whole (recipe provenance included — export needs it).
- Player node: **exactly** `{ id, kind, name, parentId?, discovered }` — `recipe` (a seed plus a
  reimplemented recipe is a floor-plan oracle), `mapDocumentId` (promise-vs-mapped is DM prep
  state; "you are here" rides `currentAtlasNodeId` instead), and `createdAt`/`updatedAt` (a
  ticking timestamp with no visible change narrates hidden edits) never exist on the player
  shape. `parentId` only when the parent is discovered (an orphan renders at the player's root).
- Player link: **exactly** `{ id, fromNodeId, toNodeId?, anchor, linkType }` — included iff
  `visibleToPlayers && fromNode.discovered`; `toNodeId` only when the target is discovered (the
  sprite renders without knowing where it leads); `visibleToPlayers` itself is a tautological
  byte and is dropped.
- The projection unit tests assert the player objects' **key sets exactly** — a field added to
  AtlasNode later fails the test by name (the capture-completeness pattern applied to privacy).
- `sceneStates` are stripped from EVERY recipient including the DM — they exist on the wire
  nowhere. (The TABLE FORK is not a wire path: it copies state server-side via an unfiltered
  snapshot plus an out-of-band document loop, `tableFork.ts:117-126` — so A1 gives it an
  out-of-band `sceneStates` copy too, or forking silently destroys every suspended scene on the
  one flow that exists to "keep what I built"; review P1/S9.)
- Discovery is TRAVEL's side effect only. `set-live` to a node-bound document does NOT
  auto-discover (Map Setup is a prep surface); players standing on an undiscovered node's map see
  the map with no "you are here" — an accepted, deliberately mysterious frame, pinned by a
  projection unit case (review P7).

### 2.3 Why not alternatives (recorded so nobody relitigates)

- **Atlas nodes as MapDocument elements:** links/nodes are ROOM state (who discovered what, what
  is suspended where), not authored map content; putting them in documents would ship them to any
  future map-helper role and tie graph edits to document revisions. Rejected.
- **A `SceneStateStore` sibling service:** constructor-arity ripple across four real-router
  contract suites for zero functional gain at launch scale. Rejected (revisit if A7's serialized
  cost measurement says otherwise — see §2.2's watch item).
- **Per-player fog memory in SceneState:** the codebase already made and documented the opposite
  call (`exploredFogStore.ts:1-19`); the client store is per-document TODAY. The privacy lens
  attempted refutation and failed: the mask can only re-show art the client legitimately held,
  and a server-side grid would ENLARGE the leak surface. Rejected.
- **Atlas messages through the `useMapStudio` controller queue:** the queue exists to serialize
  REVISION-BOUND document commands; atlas messages carry no `baseRevision`. Atlas ops are
  snapshot-confirmed room mutations like `create-npc`; they get their own thin error channel
  (`atlas-error`). Replay-safety comes from §4.5's idempotency rule, not the queue. Rejected.
- **Auto-creating nodes for every existing document:** surprising, unwanted hierarchy; the DM
  opts documents in via LINK EXISTING MAP. Rejected.
- **Storing `activeAtlasNodeId` in RoomState:** derivable from `liveMapDocumentId` + the 1:1
  node↔document rule; a stored copy is a drift bug waiting. Derived in `toSnapshot`. Rejected.

---

## 3. Units, caps, and headroom (memorize this)

| Thing                                                                                   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MapLink.anchor`                                                                        | **DOCUMENT px** on the from-node's map (same space as element transforms). Client converts pointer→doc via the existing `usePointerToDoc` path. Validator bounds each coord finite, `\|v\| ≤ 1_000_000`; the handler additionally clamps into the from-document's `width`/`height`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Token positions & staging zones                                                         | Tokens are **grid CELLS** (`Token.x/y`), captured/restored verbatim. **`PlayerStagingZone` is a CELL-space rect whose `x/y` is its CENTER** — Rev 1 called it px and was wrong both ways at once (review S5): the existing spawn math feeds zone coords STRAIGHT into token cells (`StagingZoneManager.getSpawnPosition` → `createToken(state, uid, spawn.x, spawn.y)`, `AuthenticationHandler.ts:190-194`), and the client multiplies by gridSize to render (`useSceneObjectsData.ts:64-67`). No conversion on the zone path; px→cells ONLY for the document-center fallback (documents are px). `getSpawnPosition` ignores the zone sceneObject's scaleX/scaleY — arrivals match that (the drawn rect may differ; accepted, noted). A destination smaller than the party spreads into the off-map void — harmless at HEAD (the void renders; `isWorldPointVisible` treats outside-the-rect as visible) and accepted. |
| `ATLAS_LIMITS`                                                                          | nodes 64, links 256 — enforced at the handlers (create rejects at cap) AND at load via `SNAPSHOT_LIMITS` entries. The EXPORT promise is protected by the document-count mint cap (§2.2), not by these numbers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `SNAPSHOT_LIMITS`                                                                       | gains `atlasNodes: 64`, `atlasLinks: 256` — **mandatory**: a key missing from that table reaches state unvalidated and a later `.filter` inside the debounced broadcast timer kills the process (`sessionValidators.ts:69-75`). `sceneStates` do NOT join it (they never ride RoomSnapshot); they ride the SessionFile ENVELOPE with their own zod caps beside `mapDocuments` (≤64 scenes; per-scene tokens ≤1000, drawings ≤5000, props ≤500 — the SNAPSHOT_LIMITS numbers). **The 1MB socket/pipeline cap is the true import ceiling** (review P9): a maxed legal envelope exceeds it by an order of magnitude, so A7 proves a realistically-large export re-imports, and the plan accepts that pathological exports fail the same way pathological drawings already would.                                                                                                                                          |
| Session-file carriage (review F4)                                                       | `atlasNodes`/`atlasLinks` ride **the snapshot half ONLY** (they're RoomSnapshot fields; the DM export view carries them whole, provenance included; `SnapshotLoader.mergeSnapshot` restores them; SNAPSHOT_LIMITS validates them). `sceneStates` ride **the envelope ONLY** (they can never touch a snapshot). One carriage each — an exported file never holds the same data in two places, so no unvalidated decoy copy exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Snapshot guard                                                                          | 750KB warn (`SNAPSHOT_SIZE_LIMIT_BYTES`). 64 nodes + 256 links ≈ ≤60KB worst case; A7 adds the `SnapshotSizeGuard.test.ts` case (NOTE: that is the file's real name — older plans say "SnapshotCompressionGuard", stale).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Message cap                                                                             | 1MB at socket AND pipeline; every atlas message is O(100) bytes; `load-session` is the one message sceneStates can bloat (row above).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LOC headroom (measured 2026-08-31, ceiling 348 for NEW files; baselined files may grow) | `recipientFilter.ts` **329** → projection is a NEW module. `StatePersistence.ts` **329** → the honest count is ~6-10 lines with guards (save list AND load literal both change); if the shared normalize helper (§4.13) lives in its own module, it fits. `MapStudioMessageHandler.ts` **310** → set-live's suspend/resume calls into `sceneSuspend.ts`; travel lives in a NEW `AtlasMessageHandler`. `RoomMessageHandler.ts` **301** → session export/load additions fit. `model.ts` 216, `SnapshotLoader.ts` 238, `sessionValidators.ts` 146, `buildDMMenuProps.ts` 115 — fine. E2e specs are NOT exempt.                                                                                                                                                                                                                                                                                                            |

---

## 4. Golden rules (violating any of these fails CI or ships a leak)

1. **The recipient filter stays the ONE privacy-filtered producer.** The Atlas projection lives in
   `atlasProjection.ts` called from `buildRecipientView` — never a second producer, never
   post-filtering elsewhere. `toSnapshot` NEVER copies `sceneStates`. Player-facing shapes are
   whitelist constructors with exact-key-set tests (§2.2).
2. **Leak tests are structural, never substrings — and sentinels are collision-proof.** Use
   `sentinelHits`/`sentinelHitsIn` (walks values, arrays, object KEYS; string leaves match by
   `.includes(digits)`). Atlas frames are uuid-dense and can carry base64 `mapBackground`, so
   4-digit sentinels WILL false-positive (review P4): numeric sentinels are ≥9 digits outside any
   coordinate/id range; name sentinels are high-entropy strings; never a sentinel that substrings
   any fixture id or asset. Non-DM rejection tests assert on the ATTACKER's socket (nack only, no
   payload, no broadcast) — the existing "refuses to export" test asserts only the DM's socket
   and is the weak shape not to copy.
3. **The shared barrel never declares a runtime value.** `ATLAS_LIMITS` lives in `atlas.ts` and is
   re-exported. After the shared edit: rebuild shared AND boot `pnpm dev` once.
4. **Every new ClientMessage type**: validator in a NEW module (`atlasValidators.ts`) registered
   in `validation.ts`'s mapped table (compile-enforced); validator tests in
   `middleware/__tests__/validation.test.ts` (`route()` runs AFTER validation); **a routing test
   through a REAL 13-arg MessageRouter and `router.route(...)`** asserting the handler's
   observable effect — a directly-constructed dispatcher unit test stays green when `route()`
   never reaches it, which is exactly the failure this rule exists for (review F8); DM gating
   asserted per §4.6. Top-level schemas NOT `.strict()` (the ack layer stamps `commandId` — and
   because wire-payload and stamp are the same flat field, validators may require `commandId`
   without the UI minting one); nested objects `.strict()`.
5. **Every atlas mutation is replay-idempotent** (review F7): the transport retries every message
   up to 3× with the same commandId on a missed ack. Create-with-existing-id, delete-absent,
   link-already-same, travel-already-there → success ack, state untouched. The REPLAY_LANDED
   posture, generalized.
6. **The DM gate is the FIRST statement of every atlas handler, and the non-DM nack reason is one
   constant string** (review P5): the generic nack echoes `error.message` to the sender, so a
   pre-gate lookup turns the error channel into a node-status oracle for players. The non-DM test
   sabotages the ORDER (move the gate below the lookup; the reason changing must fail the test).
7. **Every new ServerMessage type joins BOTH client hand-lists in its introducing slice** — the
   ControlMessage type union AND the runtime `isControlMessage` guard; only the guard changes
   behavior, so the sabotage removes the guard entry (review F12/C9).
8. **One suspend/resume path, specified by the §2.2 transition table.** `atlas-travel` and
   `map-studio-set-live` both go through `sceneSuspend.ts`; every table row has a contract test;
   the clear list runs on every RESTORE.
9. **The whole travel mutation is one synchronous block** — no `await` between capture and the
   returned `{broadcast: true}` (review P6: the debounce serializes state at fire time, so
   synchrony is the ONLY thing preventing a half-traveled frame; an await would also let a racing
   fork copy the half-state). Enforced by an A4 assert that one travel produces exactly ONE
   snapshot frame per recipient.
10. **The §4.7 capture contract classifies EVERY RoomState field into five buckets** (review S6 —
    Rev 1 left ten fields unclassified and the completeness test unwritable):
    **captured** — tokens(stayers)/props/drawings/sceneObjects-residue/doorStates/combatActive/
    currentTurnCharacterId/initiatives/fogEnabled/defaultVisionRadius/playerStagingZone/
    mapBackground; **cleared on restore** — pointers/selectionState/drawingUndoStacks/
    drawingRedoStacks; **global** — users' roster-adjacent content: players/characters/chatLog/
    diceRolls/monsterHpDisplay/diagonalRule/playerPropsEnabled/initiativeManualOverride/
    isPublicTable/tableName; **derived** — compiledScene/mapTerrain/mapElements/gridSize/
    gridSquareSize (from the document on recompile); **infrastructure, never touched by travel**
    — users/stateVersion/liveMapDocumentId (the binding travel itself mutates). A4's
    capture-completeness test walks RoomState keys at runtime against this table; a future field
    fails it by name.
11. **`mapBackground` is part of the scene.** `recompileLiveScene` deliberately never touches it —
    restore MUST set it from the saved SceneState (or clear it), or the old map's raster haunts
    the new map.
12. **Determinism discipline is inherited, not re-litigated:** generation still flows through
    `dungeonRecipe` + `assertRecipeBudget` with `idPrefix = commandId`; goldens and the disguise
    machinery untouched. Atlas records provenance; it never re-rolls.
13. **Loads are file-authoritative and poison-proof.** A session file without atlas keys loads as
    `[]`/`{}` — NEVER as the room's current values (`SnapshotLoader.mergeSnapshot`'s own
    mapElements lesson at :165-174; the preserve reading compiles, passes the sweep, and bleeds
    campaign A's scenes into campaign B — review F5). And `?? []` is the exact poisoned-non-array
    anti-pattern StatePersistence itself documents (`{}` is truthy AND non-nullish): the guards
    are `Array.isArray(x) ? x : []` / `isRecord(x) ? x : {}`, in ONE `normalizeAtlasState`
    helper shared by StatePersistence load AND `RedisRoomStore.hydrate` (review F6/F9).
14. **Snapshot compatibility:** all three RoomSnapshot additions are optional and omitted when
    the RECIPIENT's projected array is empty (per-recipient, after projection — an `[]` for a
    player whose atlas is all-undiscovered would itself announce the atlas exists; review P8). A
    pre-Atlas room's snapshot stays byte-identical (serialization test).
15. **No `features/atlas/index.ts` barrel** (review C14): entry-bundle code (MobileSurfaces, the
    desktop header) and the lazy DM chunk both import atlas modules — a shared barrel that
    re-exports the DM tab would pull the DM graph into the entry bundle, and `build:check` only
    measures size, not the split. Direct module-path imports on both sides, the `lazy-entry.ts`
    discipline.
16. **Grep `toHaveBeenCalledWith` before widening ANY callback signature**; stage files by
    explicit path, never a directory.

---

## 5. The slices

> Sizing: 🟢 ≤~150 new LOC · 🟡 ~150–400 · 🔴 400+ (split if exceeded)

---

### A1 🟡 — The graph exists (shared types → RoomState → wire → projection → persistence → fork)

**Goal:** AtlasNode/MapLink live in room state; round-trip disk, session files, AND the table
fork; reach the DM's snapshot whole and the player's snapshot as the whitelist projection; leak
proven closed at the frames level. Backend plus a thin client persistence leg (the session-file
loader whitelists its envelope — review F3); no UI.

**Context capsule:**

- `packages/shared/src/index.ts:566-640` (RoomSnapshot fields), `:674-694` (SessionFile),
  `:909-937` (the map-studio ClientMessage cluster — atlas messages go in their own labeled block
  beside it), `:1053` (`commandId` on ClientMessage).
- `apps/server/src/domains/room/model.ts:36-78` (RoomState interface), `:108` (empty-state
  defaults), `:132-216` (`toSnapshot` — conditional-include idiom; the DM-gate precedent at
  203-205).
- `apps/server/src/domains/room/snapshot/recipientFilter.ts:143-165` (the filter shape),
  `:32-45` + `:318-329` (RecipientView interface + return — atlas fields thread through here).
- `apps/server/src/middleware/validators/sessionValidators.ts:18` (`MAX_SESSION_DOCUMENTS` —
  module-private; EXPORT it, the cap tests need the constant), `:69-96` (SNAPSHOT_LIMITS
  mechanism + the process-killing failure mode — read the whole comment), `:124-144` (the loop).
- `apps/server/src/domains/room/persistence/StatePersistence.ts:93-164` (load literal) +
  `:235-267` (save list) + `:127-130` (the poisoned-non-array lesson — `|| []` kept `{}` once);
  `apps/server/src/domains/room/store/RedisRoomStore.ts` (`hydrate` is a bare `JSON.parse` —
  the normalize helper covers it too).
- `apps/server/src/domains/room/snapshot/SnapshotLoader.ts:131-199` (**the complete RoomState
  literal — a fifth fixture site, and the file-authoritative precedent at :165-174**), `:176-179`
  (dangling-binding validation).
- `apps/server/src/ws/handlers/RoomMessageHandler.ts:44-66` (`flattenForFile` + its three-ways-
  broken lesson), `:139-159` (load flow + dangling-binding clear at :147-153), `:172-192`
  (export gate + export).
- `apps/server/src/ws/auth/tableFork.ts:84-87` (DM gate), `:117-126` (unfiltered snapshot copy +
  the out-of-band document loop — the seam the `sceneStates` copy joins).
- `apps/server/src/domains/room/roomStatePristine.ts:17-39` (the public-table sweep predicate —
  atlas fields join it or atlas-only rooms persist for strangers; review S10).
- Routing home (review F13): the MapStudio family precedent — `mapStudioHandlerUtils.ts:56-60`
  (`t.startsWith("map-studio-")`) invoked directly in `route()` ahead of the dispatchers
  (`messageRouter.ts:316-326`) with the family DM gate at `MapStudioMessageHandler.ts:52-54`.
  Atlas mirrors it: an `atlas-` prefix guard + `AtlasMessageHandler` in the route chain
  (messageRouter.ts is baselined — it may grow).
- `apps/server/src/middleware/validators/generationValidators.ts` (standalone-module pattern +
  the non-strict-top-level comment to copy verbatim).
- Client leg: `apps/client/src/utils/sessionPersistence.ts` (~139-186 — `loadSession()` rebuilds
  the envelope from a whitelist: snapshot/mapDocuments/liveMapDocumentId/assets; the "SPREAD,
  NEVER WHITELIST" header rule is applied only to the snapshot half) and
  `apps/client/src/features/session/useSessionManagement.ts:194` (builds `load-session` from
  those fields). `apps/client/src/services/websocket/MessageRouter.ts:50-62` (type union) +
  `:349-366` (runtime guard) for `atlas-error`.
- Templates: `sessionRoundTrip.contract.test.ts` (13-arg router construction; the runtime key
  sweep + `NOT_PERSISTED`; **its `hadValue` check at :291-298 passes vacuously for empty
  collections — populate the fixture**), `leakSentinels.ts`, `hpSecrecy.contract.test.ts:168-170`
  (usage shape — but see §4.2's sentinel discipline), `liveMapBinding.contract.test.ts`
  (12-arg construction, `flush()` 25ms).

**Changes:**

1. NEW `packages/shared/src/atlas.ts` — §2.2 types + `ATLAS_LIMITS`; barrel re-exports.
   **Rebuild shared; boot `pnpm dev` once.**
2. `model.ts`: the three REQUIRED fields (+ defaults); `toSnapshot` threads projected
   nodes/links (per-recipient omit-when-empty) + derives `currentAtlasNodeId`. **NEVER copy
   `sceneStates`.** `/fix-fixture-ripple` for the four test files; hand-decide the two
   production literals (`SnapshotLoader.mergeSnapshot` → file-authoritative empties per §4.13;
   `StatePersistence` → normalize helper).
3. NEW `snapshot/atlasProjection.ts`: whitelist constructors per §2.2; `recipientFilter` calls
   it; NEW `normalizeAtlasState` helper (§4.13) used by StatePersistence + RedisRoomStore.
4. NEW `middleware/validators/atlasValidators.ts`: the six CRUD messages (generate/travel are
   A3/A4); registered in the mapped table.
5. NEW `ws/handlers/AtlasMessageHandler.ts` + the `atlas-` prefix guard in `route()`: family DM
   gate FIRST (§4.6), replay-idempotency (§4.5), `ATLAS_LIMITS` enforcement, 1:1 node↔document
   on `atlas-link-map`, delete-node reparenting + link cleanup. `atlas-error` declared server-side
   AND added to BOTH client MessageRouter lists with a routing test (§4.7).
6. Persistence: StatePersistence save/load via the normalize helper; SessionFile gains
   **`sceneStates?` ONLY** (envelope; array shape; zod caps per §3) — nodes/links ride the
   snapshot half (§3 carriage row); export writes sceneStates from state; load validates +
   restores them, drops orphans; `SnapshotLoader` restores atlasNodes/atlasLinks
   (file-authoritative, guarded) and clears a node's `mapDocumentId` when the file carries no
   such document (the liveMapDocumentId precedent). `SNAPSHOT_LIMITS` entries; export the
   MAX_SESSION_DOCUMENTS constant. `roomStatePristine` gains the three fields.
7. Table fork: copy `sceneStates` out-of-band beside the document loop (structuredClone —
   never a shared reference).
8. Client leg: `sessionPersistence.loadSession()` carries `sceneStates` through;
   `useSessionManagement` includes it in the `load-session` message. (Old clients re-saving a
   new file drop it — accepted degradation, stated here.)

**Tests:** validator accept/reject per message; **routing tests through a real 13-arg
MessageRouter per §4.4** (one per type); non-DM nack per type on the ATTACKER's socket with the
constant reason + the gate-order sabotage (§4.6); replay-idempotency per mutation (§4.5); CRUD
contract test (create → snapshot carries it; players see the whitelist projection; discover
toggle flips visibility on the NEXT frame); projection unit tests (exact key sets, orphan
parentId, toNodeId blanking, recipe absence on a DISCOVERED generated node too); the **leak
gate** with §4.2-grade sentinels → `sentinelHits(playerWs) === []` across every frame AND
sceneStates sentinels absent from the DM's frames; per-recipient omission (undiscovered-only
atlas → player frame has NO atlas keys); persistence round-trip (save→load; old file → empties;
poisoned `"atlasNodes": {}` → normalized, process lives); **load an atlas-FREE file into an
atlas-BEARING room → atlas gone** (§4.13); sessionRoundTrip sweep green with POPULATED
sentinel-bearing fixtures; **fork round-trip** (fork a room holding a suspended scene → the fork
holds it); doc-cap refusal reserved for A3 but the exported constant's test lands here;
empty-atlas snapshot byte-identity; `loadSession()` envelope passthrough unit test.

**Done when:** full gate green; `pnpm dev` boots; a console-harness DM can create/link/discover
nodes and a player tab's `__HERO_BYTE_E2E__.snapshot` shows exactly the whitelist projection.
**Traps:** the barrel (§4.3); the SNAPSHOT_LIMITS crash comment is not hypothetical; the four
fixtures are TS2741 but sessionRoundTrip fails at RUNTIME — read its failure as instructions; the
sweep is vacuous on empty collections — populate; `sceneStates` is required-with-default, so old
`herobyte-state.json` files must load (test it).
**Escalate if:** the projection can't express a rule without touching recipientFilter beyond a
call site + RecipientView fields, or fixture ripple exceeds the named files by more than trivia.

**🔎 SENIOR REVIEW GATE:** privacy lens (every projection rule attacked at the frames level) +
persistence lens (old files, dangling refs, the fork) before any UI exists.

> **A1 SHIPPED** (2026-09-01, one commit, full gate: shared 424, server **2225** (+34),
> client **5429** (+3), e2e 167/3/0, dev boot clean with the new shared const). Sabotage:
> 12/12 red — one initially stayed green and it was the TEST's fault (a swallowed throw is
> invisible to frame counts when no commandId rides the message; the replay test now pins the
> routing-error log). Browser-verified live: a fresh-uid player received exactly
> `[discovered, id, kind, name]` for the discovered node, zero bytes of the hidden one, no
> sceneStates key, and the atlasNodes key left the wire entirely once the graph emptied.
> Three discoveries for later slices: (1) the client has **THREE** ControlMessage hand-lists,
> not two — `services/websocket.ts:77` keeps a config copy of the union (tsc catches it
> drifting; the runtime guard is still the only behavioral one); (2) `.claude/launch.json` is
> GITIGNORED (machine-local) — which is why HANDOFF §1's "it really does exist" claim went
> stale: the file evaporates with the machine. Recreated locally; and the preview harness injects
> `PORT=<preview port>` into the child env, so the entry pins `PORT=8787` via cross-env or the
> server collides with Vite; (3) two same-profile browser tabs share `herobyte-session-uid`
> and fight (the documented connection war) — the A7 journey spec keeps its two
> `browser.newContext()`s, and any in-pane manual check needs a hand-minted uid.
>
> **A1's SENIOR REVIEW GATE RAN** (2026-09-01, privacy + persistence lenses, both complete).
> Five findings accepted and FIXED in the commits that follow the A2 slice: (1) **the table
> fork aliased live node/link objects across rooms** — the one in-process snapshot copy, so an
> in-place discover/rename bled between the public table and a private fork (probe-confirmed;
> `discovered` is privacy-bearing) → the whole atlas trio is now structuredClone'd out of
> band; (2) **normalize was one level too shallow** — `projectAtlasFor` dereferences
> `link.anchor.x`, so an anchor-less link in a loaded file crashed the debounced broadcast
> timer, persisted into a crash-on-every-restart loop → anchors are now finiteness-checked in
> the one shared normalize; (3) **`map-studio-delete` left the id-reuse bomb armed at
> runtime** — orphan scene kept, node still "mapped" → the delete case now drops the scene
> and degrades the node, broadcasting the change; (4) **a poisoned scene exported an
> unimportable file** → export skips schema-non-conforming scenes with a warn; (5) **the
> disk-file round trip was untested and the save list is an untyped literal** — deleting
> `sceneStates:` from it compiled clean through the whole gate → StatePersistence now has the
> promised round-trip/poison tests, and that exact deletion sabotage goes red. Accepted
> WITHOUT code: a server ROLLBACK sheds the atlas keys from `herobyte-state.json` on its
> next save (the client-side old-client caveat's server twin — stated here); Redis hydrate's
> normalize covers the three atlas fields ONLY (`selectionState`'s Map→`{}` flattening is a
> pre-existing gap of that opt-in store, now said honestly at the site). Everything else
> held, including gate-first/constant-reason, single-carriage, replay-idempotency, and the
> loadSnapshot identity-preservation question the lens called sharpest.

**Goal:** the 🗺 Atlas DM Menu tab: tree render, create/rename/discover/delete, LINK EXISTING MAP,
status badges. Mobile via the DM screen's existing `presentation="content"` chip row.

**Context capsule:**

- `apps/client/src/features/dm/components/DMMenuTabs.tsx:5-10` (the tab list — add
  `{ tab: "atlas", label: "Atlas" }`; the `DMMenuTab` union lives at `useDMMenuState.ts:20`),
  `DMMenu.tsx:139` (tab mount pattern), `DMMenu.types.ts:123-129` (`presentation` — mobile is
  free if the tab renders in "content").
- **The prop audit is already decided** (review C5 — verified: `buildDMMenuProps.ts:105-106`
  passes `snapshot: props.snapshot, sendMessage: props.sendMessage` whole, and the key-set
  literal — **42 keys, not Rev 1's 39** — already contains both): **zero new bag keys, zero
  MainLayoutProps additions, zero fixture churn.** `DMMenuContainer` extracts
  `snapshot?.atlasNodes ?? []` etc. and passes down via new DMMenu/DMMenu.types props — the
  `playerPropsEnabled` idiom (`DMMenuContainer.tsx:260-265`).
- `apps/client/src/features/dm/components/map-controls/MapStudioControl.tsx:85-87` (the ONLY
  `refresh()` mount caller — DMMenu renders only the active tab, so the document list is EMPTY
  until Map Setup has mounted once; review C6: **AtlasTab mounts its own `refresh()` effect
  through the SAME controller** — same channel, second caller, never a second list mechanism)
  and `:200-229` (list/action idioms).
- `apps/client/src/features/dm/lazy-entry.ts:1-7` (chunk boundary; §4.15's no-barrel rule).
- `apps/client/src/components/ui/JRPGPanel.tsx` (panel/button variants),
  `MapEditLayersPopover.tsx:26-30` (the closest list idiom).
- **A11y decision (review C13, recorded):** a plain list with visual depth
  (`paddingLeft = depth·16px`), real buttons with accessible names, and NO `role="tree"` — the
  tree role promises the full APG keyboard contract (roving tabindex, arrow navigation,
  aria-expanded) that nothing in this repo implements; a bare tree role is WORSE for screen
  readers than an honest list. The APG tree is recorded in §7.2 as the upgrade path.
- `apps/e2e/mobile/mobile-dm.spec.ts:44-57` — the chip guard filters by a HARD label array and
  asserts `count === 5`; a new chip silently escapes it (review C12): **add "Atlas" to the array,
  count → 6**, or the 44px/fit guards cover nothing new.

**Changes:** NEW `features/atlas/` modules (direct imports, no barrel — §4.15): `AtlasTab.tsx`
(tree + actions), `useAtlasActions.ts` (sendMessage wrappers), `atlasTree.ts` (pure parent/child
ordering; cycle members render at root, defensively); DMMenu tab wiring + container extraction;
AtlasTab `refresh()` effect; `atlas-error` toast in the tab (the router entry landed in A1). LINK
EXISTING MAP reads `mapStudio.documents` from the shared controller.

**Tests:** `atlasTree` unit (ordering, orphans, cycle defense); AtlasTab render states (promise
vs mapped vs current; discover toggle sends `atlas-update-node`; delete confirms); toast fires on
an `atlas-error` frame; refresh-on-mount (sabotage: remove the effect, the list stays empty);
key-set test UNTOUCHED (assert by running it — zero churn is the claim); mobile: the chip-array
update + reach the Atlas chip, create a node by touch, fit guards both orientations.

**Done when:** gate green; in the browser a DM builds a 3-node tree, links the live map's
document to a node, toggles discovery, and a second (player) tab's world state follows; same flow
on the mobile DM screen, measured.
**Traps:** the DM chunk boundary (§4.15 — verify the built chunk list, not just the budget);
`getByRole` matches ACCESSIBLE names; DMMenuTabs chips scroll — don't shrink labels.
**Escalate if:** the tab needs data that snapshot + sendMessage + the mapStudio controller do not
already carry.

> **A2 SHIPPED** (2026-09-01, one commit; gate: shared 424, server 2225, client **5442** (+13),
> e2e 167/3/0 with the six-chip guard passing LIVE as `ok 96`). Sabotage 6/6 red. The audit's
> zero-churn claim held exactly: no new prop-bag keys, no MainLayoutProps change, the 42-key
> literal untouched — DMMenu's own props gained three REQUIRED fields (one fixture site).
> Browser-verified desktop AND mobile (375px: six chips, one row, 44px floor, row scrolls; tab
> content + a live node fit the width). Deviations from the spec, recorded: the `atlas-error`
> toast lives in `useServerEventHandlers`' existing control-message chain (no new plumbing —
> the dm-password-failed idiom), and DMMenu gained a MOUNT test (chip + props both survive
> deleting the `activeTab === "atlas"` block; only rendered content proves the wiring — the
> M4b lesson applied before it could bite). In-pane manual checks need `/DM$/`-style text
> matching: the dock buttons' textContent carries their glyph (`♛DM`).

**Goal:** GENERATE on a promise node mints a document server-side (validate-then-persist),
runs the dungeon recipe into it, records provenance on the node. The first Atlas moment.

**Context capsule:**

- §2.2's generate flow — the ORDER is the spec (node guard → cap → mint object → validate →
  recipe → budget → persist → apply → node update; delete-on-failure after persist).
- `apps/server/src/ws/handlers/MapStudioMessageHandler.ts:119-169` (the generate case — the
  REPLAY_LANDED catch at :160-167 is the posture; note its dedupe-cache replay path does NOT
  transfer here, §2.2 says why).
- `apps/server/src/domains/generation/recipeContext.ts:27-51` (`resolveRecipeContext` +
  `assertGenerateRequest` — "the gate for any server-side caller"), `types.ts:32-47, 55, 87-88`
  (RecipeContext/RecipeOutput; `MAX_RECIPE_CELLS`; **`MIN_RECIPE_COLS/ROWS = 20`**),
  `dungeonRecipe.ts:26-31` (signature).
- `apps/server/src/domains/mapStudio/service.ts:42-50` (`create` persists immediately — hence
  the mint-object-first order), `packages/shared/src/mapStudio.ts:39-71` (`createMapDocument` is
  PURE — defaults 2048×2048, grid 50; pass explicit width/height), `service.ts:163-175`
  (`delete` — the failure cleanup).
- `import { randomUUID } from "node:crypto"` — the existing precedent in character/chat/dice
  services; follow it.
- `apps/server/src/middleware/validators/generationValidators.ts` (reuse params/seed
  sub-schemas; new size-preset enum).
- Client: `GeneratePanel.tsx` + `mobile/MobileGeneratePanel.tsx` (params-panel idiom + testids).

**Changes:** `atlas-generate-node` validator + prefix-route case + handler per §2.2; document
named after the node (verified safe — no player channel carries document names); the doc-count
mint cap here AND on `map-studio-create` (a deliberate new cap on an old path — its own test +
one line in the commit body); provenance written to the node; NEW `AtlasGeneratePanel` in the
tab (theme/density/size/seed/reroll — seed prefilled random, UI-side nondeterminism fine),
mobile-fitting (renders inside the DM screen — measure).

**Tests:** contract — generate on a promise: document exists with preset dimensions, node
carries `mapDocumentId` + provenance, DM snapshot updated, player projection never shows recipe;
same-message replay double-applies nothing; generate on an already-mapped node → success ack, no
second document; **kill the flow between create and node-update, retry → exactly ONE document**
(the orphan test); validation failure (budget trip) → `atlas-error`, ZERO documents; at the doc
cap → `atlas-error`; `map-studio-create` at the cap → `map-studio-error`; at-cap room's export
re-imports; every preset ≥ `MIN_RECIPE_COLS/ROWS` (the floor is 20×20 — Rev 1's 8×8 was the
validator's floor, not the recipe's); determinism: same seed+params into two promise nodes →
equal geometry modulo idPrefix.

**Done when:** gate green; browser: GENERATE on a promise → the document appears in Map Setup's
list; `map-studio-set-live` to it shows the dungeon (travel is A4).
**Traps:** the recipe's element ids still come from `idPrefix = message.commandId`, NOT the doc
id; `assertGenerateRequest` is the real gate — zod never sees server-minted values; the dedupe
cache CANNOT provide cross-attempt idempotency here (its key contains the per-attempt doc id) —
the node guard does.
**Escalate if:** the handler can't stay a thin composition of existing pieces.

> **A3 SHIPPED** (2026-09-01, one commit; gate: shared 424, server **2236** (+6), client
> **5445** (+3), e2e 167/3/0). Sabotage 7/7 red (node guard, orphan cleanup, both mint caps,
> provenance, client commandId, panel mount). Browser-verified: a promise node cashed into a
> 28-wall / 6-door dungeon with terrain, live on the table, `currentAtlasNodeId` reading
> "you are here", provenance seed on the node, ZERO bytes of it on the player wire; the
> mobile generate panel measured 327px inside the 375px DM screen. As planned, the handler
> extracted to `atlasGenerate.ts` BEFORE the case landed (AtlasMessageHandler was at 282);
> the `map-studio-create` mint cap ships in the same slice with its own test. One deviation:
> size presets are a `size` param on the message (small/medium/large → GENERATE_PRESETS in
> the server module), not client-sent bounds — the client cannot mis-size a document it
> never measures.

---

### A4 🔴 — SceneState + travel (the keystone)

**Goal:** `sceneSuspend.ts`, the rebuilt `set-live`, and `atlas-travel` — the §2.2 transition
table made real, row by row. After this slice the server moves the table between nodes
losslessly. Client experience is A5; this slice is proven by contract tests and the console
harness.

**Context capsule:**

- **The §2.2 transition table and the §4.10 five-bucket contract ARE the spec.** Read them
  before any file.
- `apps/server/src/ws/handlers/MapStudioMessageHandler.ts:223-253` (`setLiveDocument` — rebuilt),
  `:170-185` (delete — gains the `sceneStates[docId]` drop), `:264-280` (`recompileLiveScene` —
  restore reuses compile + `deriveMapTerrain("elements-only")` + `deriveMapElements` + grid
  assignment; door overlay from SAVED doorStates; `mapBackground` assigned per §4.11).
- `packages/shared/src/scenePublish.ts:37-84` (`preserveDoorRuntimeStates` +
  `authoredDoorStatesOf` — the authored-equality rule; `CompiledDoorState` aliases the authored
  union, so the saved pair is type-coherent).
- `apps/server/src/ws/handlers/SceneMessageHandler.ts:85-104` (door toggles mutate
  `compiledScene.doors[].state` in place — capture reads THIS).
- `apps/server/src/ws/services/SceneGraphBuilder.ts:80-91, 107-133, 155-165` (the rebuild is a
  continuity-preserving FOLD — prev transform/locked/zIndex/characterId survive, and the "map"
  object under the constant id `"map"` carries the raster alignment that
  `visionFilter.ts:41-43` inverse-transforms every fog point through — this is WHY sceneObjects
  residue is captured, review S3).
- `apps/server/src/domains/character/service.ts:234-244` (`place-npc-token`
  delete-then-recreate — the restore-GC scenario), `:315-342` (initiative order derivation +
  clear-all), `InitiativeMessageHandler.ts:239-245` (end-combat keeps values), `:269-271`
  (next-turn's `findIndex === -1` → index 0 — why currentTurnCharacterId revalidates),
  `applyInitiative.ts:36-39` (setting initiative auto-starts combat).
- `apps/server/src/ws/services/StagingZoneManager.ts:124-148` (`getSpawnPosition` — CELL-space,
  center-anchored, `Math.random` inside; the arrivals precedent) +
  `AuthenticationHandler.ts:176-205` (join auto-create + reconnect token re-create — ground
  truth for the predicate), `NPCMessageHandler.ts:200-206` (NPC tokens carry the placing DM's
  uid), `CharacterMessageHandler.ts:128-135` (extra owned tokens via add-character).
- `apps/server/src/domains/room/service.ts:175-233` (broadcast + save + size guard; `saveState`
  on every broadcast), `TokenMessageHandler.ts:84-95` (a move for an absent token silently
  no-ops — no resurrection race).
- Templates: `liveMapDoorPreservation.contract.test.ts` (door assertions through real sockets),
  `sessionRoundTrip.contract.test.ts` (13-arg construction with explicit mapStudioService).

**Changes:**

1. NEW `domains/room/scene/sceneSuspend.ts` (capture/restore/placeArrivals per §2.2; pure;
   synchronous; ≤300 — split a `sceneRestore.ts` if the GC + initiative overlay crowd it).
2. `setLiveDocument` → the transition table's set-live rows (including the compile-only
   unbound→bound row — the START LIVE MAP regression test is the slice's first sabotage target).
3. NEW `atlas-travel` in `AtlasMessageHandler`: gate → resolve node (unmapped or store-missing
   document → `atlas-error`, constant reason, state untouched) → the travel row → auto-discover
   → `{broadcast, save}`. One synchronous block (§4.9).
4. `map-studio-delete` drops `sceneStates[documentId]` (every delete, live or not).
5. First-visit defaults: empty collections; combat off; **`fogEnabled = true` when the node
   carries `recipe` provenance** (a generated dungeon unmasked on arrival is an irreversible
   reveal and the content §7.1's machinery assumes concealed — review S7), else inherit the
   room's current value; `defaultVisionRadius` inherits current; staging zone undefined →
   arrivals spread at document center.
6. The capture-completeness test (§4.10) — the sweep's sibling.

**Tests (the heart of the arc):** one contract test PER transition-table row; travel A→B→A
round-trip through real sockets — NPC token positions, sceneObjects residue (the MAP transform:
drag the raster on A, travel, return, fog geometry still correct — assert via the vision filter,
not the transform alone), drawings (including a template), an OPEN door, **combat with the
interleaved-fight sequence** (fight on A → travel → clear + new fight on B → return to A →
initiative order and current turn restored from the capture, not the wrecked roster — the idle
round-trip alone is vacuously green, review S2), fog flag + defaultVisionRadius, staging zone,
mapBackground; PC tokens ARRIVE (containment-in-rect asserts; travelers keep gizmo residue; not
duplicated in either scene across visit-B→A→B); set-live rebind preserves the same way but does
NOT warp travelers; restore-GC: delete-suspended-NPC → ghost dropped on resume;
place-npc-token-while-suspended → exactly one token after resume; a door whose AUTHORED state
changed while suspended takes the new authored state; doc-command-in-flight during travel
applies cleanly to the suspended doc with NO conflict and no recompile (the race's true shape —
Rev 1's "revision conflicts answer it" was wrong, review S11) — and the stale room-gesture
window (a draw or token-move landing right after travel) is documented-by-test as self-healing,
not prevented; non-DM travel nack on the attacker's socket; exactly ONE snapshot frame per
recipient per travel (§4.9); suspended-scene sentinels absent from every frame during the whole
dance; undo stacks cleared (sabotage the clear); capture-completeness sweep; snapshot size guard
unmoved for empty atlas.

**Done when:** gate green; console harness: two nodes, travel between them with a player tab
open — the player's map, fog, and tokens follow; doors reopened on return stay open; START LIVE
MAP on a token-laden unbound table changes nothing but the map.
**Traps:** `mapBackground` (§4.11); staging zones are CELLS, center-anchored (§3 — Rev 1 had
this backwards); `structuredClone` every captured collection; the 16ms debounce — `flush()` 25ms
before reading frames; `getSpawnPosition`'s `Math.random` — inject or assert containment;
`sceneSuspend` and both handlers stay await-free (§4.9).
**Escalate if:** the traveling predicate can't be stated as one pure function over
(token, players, characters); or a transition-table row turns out to need state the table
doesn't name — that's a spec bug, report it before coding around it.

**🔎 SENIOR REVIEW GATE:** state-machine lens (every table row + every §4.10 bucket attacked),
privacy lens (sceneStates + travel frames), race lens (travel vs in-flight commands vs
reconnect vs fork).

> **A4 SHIPPED** (2026-09-01, one commit; gate: shared 424, server **2246** (+10), client 5445,
> e2e 167/3/0 with every START-LIVE-MAP flow green — the set-live rebuild's riskiest claim,
> proven by the suite that existed before it). Sabotage 11/11 red (two REDONE after the first
> pass: a vacuous clear-list assert — empty stacks in, empty out — and a sabotage that crashed
> inside route()'s catch and read as a no-op; both now red for the right reason). Live-verified
> on the dev table: travel to a generated node turned fog ON and auto-discovered it, all 8
> party tokens followed, a door opened on Vault A was STILL OPEN after a round trip through
> Vault B, currentAtlasNodeId tracked every hop. Deviations, recorded: (1) BOTH handler bodies
> extracted into sceneTravel.ts (`bindLiveDocument` + `handleAtlasTravel`) — the case-in-place
> versions blew the 348 ceiling at 359/353; (2) the compile-only row ALSO applies the
> first-visit fog default — the tests caught it eating the recipe-node concealment when
> traveling from an unbound table, and for set-live the assignment is an identity so START
> LIVE MAP is untouched; (3) initiative restore clears UNCAPTURED characters' initiative (the
> B-only-bandit case) but never touches modifiers — modifiers are character-sheet data. Known
> noise, not this slice's: ~287 Windows EPERM tmp-rename warnings across a dozen contract
> suites' durability saves — pre-existing, every test green.

---

### A5 🟡 — The travel experience (client)

**Goal:** travel feels like the vision: iris wipe, camera arrives, nothing stale lingers; the DM
tree gets its TRAVEL button; per-node fog memory survives a real campaign's node count.

**Context capsule:**

- `apps/client/src/ui/MapBoard.tsx:155-159` (fog key from `compiledScene.sourceDocumentId` —
  the SAME field is the wipe trigger: player-visible because `compiledSceneFor` spreads the
  scene for players, verified), `:671-898` (layer order — the overlay mounts above everything,
  `listening={false}`).
- **Wipe mechanism (review C2 overturned Rev 1's "over the old frame"):** nothing in the client
  captures a stage frame, and by the time a React effect sees the new `sourceDocumentId` the new
  scene is already committed — an old-frame overlay is a timing trick the plan refuses. The
  wipe is **cover-then-reveal**: on transition, snap a full-cover overlay (black, SNES-stepped),
  then grow a circle mask revealing the NEW scene (~600ms, stepped radii). No pixel readback —
  the Boss Wipe philosophy (`VISION.md:75`). Genuinely ~120 LOC.
- **Trigger matrix (review C4 — publish and load-session also move the field):** undefined→A no
  wipe (first bind/reload); A→A no (live edits, undo, publish of the live doc); A→B YES —
  travel, rebind, **publish of another document, session load** (the map changed; the wipe is
  honest either way); unbind keeps the scene → no wipe. Reduced motion
  (`features/juice/juiceSettings.ts:28` precedent) → instant swap.
- Camera: `MapBoard.types.ts:16` — `CameraCommand = {type: "focus-token"} | {type: "reset"}`;
  reset goes to origin, NOT map center. **A new variant `{type: "focus-rect", rect}`** plus a
  producer effect in `useCameraCommands` (which already receives the snapshot) watching the
  sourceDocumentId transition (review C11 — "rides a cameraCommand" was true, "no new
  mechanism" was not).
- `apps/client/src/features/map/exploredFogStore.ts:33-43` (`MAX_REMEMBERED_MAPS = 6`, ONE
  global `INDEX_KEY`, quota math in the header; eviction happens ONLY via the index — an
  abandoned index orphans masks forever, review C10).
- `apps/client/src/features/map-edit/useMapEditState.ts:233-236` (the rebind bail — add the one
  missing case: if `activeId` WAS the previous live id and the live id changed,
  `openDocument(new)`; an explicitly-opened DRAFT stays), `useGenerate.ts:71-89` (clear aimed
  bounds when `activeDocument?.id` changes), `usePopulate.ts:72-112` (same for
  `lastPlacedBounds`).

**Changes:** NEW `features/map/MapTransitionOverlay.tsx` (cover-then-reveal per the capsule);
the `focus-rect` camera command + producer (staging-zone center, else document center); the
`useMapEditState` rebind case; the two stale-aim clears; fog store rework: per-room index keys
(`INDEX_KEY:{roomId}`), 24 entries per room, an 8-room LRU over the room indexes, **one-time
migration that deletes the old global index and its orphans** (quota math stated in the header:
24 × ~44KB ≈ 1MB/room, 8 rooms ≈ the old whole-store budget); TRAVEL button + confirm in the
Atlas tab (desktop + mobile DM screen); `helpTopics.ts` gains the travel/Atlas entry (the
manual updates in the slice that changes behavior).

**Tests:** overlay unit tests (full trigger matrix including the publish and load rows;
reduced-motion skip; prove the reveal can PASS on a healthy transition, not only fire); camera
producer (fires on A→B, not on undefined→A; targets staging center); rebind-case unit test
(prove it can PASS — the M4c lesson); aim-clear tests (sabotage each independently); fog store:
25 documents in one room retain 24; a second room doesn't evict the first; migration removes
the old index and its masks; e2e: DM travels, player screen shows the new map, recentered,
fresh fog; RETURNING shows the old fog memory (read the mask via `page.evaluate` on
localStorage — no harness seam exists for it, and none is needed).

**Done when:** gate green; two browser tabs travel both directions and it LOOKS right, desktop
and mobile viewport; the DM palette never shows another map's notes after travel.
**Traps:** do NOT key anything on `liveMapDocumentId` (DM-only — players would never wipe);
Konva ignores synthetic events (CDP where interaction-proofing is needed); the overlay sizes
from the Stage, not the viewport.
**Escalate if:** the wipe wants an old-frame capture after all — that is a spike, not a slice
item; report instead of improvising canvas readback.

> **A5 SHIPPED** (2026-09-01, one commit; gate: shared 424, server 2246, client **5454** (+9),
> e2e 167/3/0 — the first run caught this slice's own help topic against THREE pinned counts
> (desktop topics 8→9, mobile manual sheet 13→14 in both orientations); they were re-measured,
> not auto-accepted, and the re-run then proved all 14 mobile targets hold the 44px floor).
> Sabotage 13/13 red; the two follow-the-live rows re-proven after their effect changed files.
> Live-verified two-tab: the iris caught by MutationObserver in BOTH directions and absent on
> the first bind (undefined→A); a mid-flight phone screenshot shows the full-viewport cover;
> mobile arrival recentered the camera (0,0)→(−1012.5,−494) with the whole party warped into
> the staging room; the player's nodes carried EXACTLY `{id, kind, name, discovered}`; the DM
> palette's LIVE badge followed travel with the menu open. Deviations, recorded: (1) the camera
> command shipped as `focus-point` (staging zone's CELL center at +0.5, else scene center) —
> `focus-rect` was more plumbing than an arrival needs; (2) the fog registry holds **4 rooms**,
> not 8 (24 masks/room ≈ 1MB — the whole store stays at HALF the old budget on purpose); (3)
> the follow-the-live effect lives in its own `useFollowLiveDocument.ts` (the 350 guard read
> useMapEditState at 360; extract-before-add); (4) the plan's e2e travel legs are A7's journey
> spec by design — they ran LIVE here instead, which minted the traps: the browser pane's
> navigate STRIPS query strings, two same-origin tabs share `herobyte-session-uid` (pin
> per-tab identity with `?sessionUid=`), and `?mobile=true` — not `=1` — forces the layout.

---

### A6 🟡 — Links on the map + the player world map

**Goal:** MapLinks render as sprites on the live table (per-recipient filtered server-side); the
DM places them by aiming; sprite-click offers travel; players get their discovered-only world
map on both platforms.

**Context capsule:**

- `apps/client/src/ui/MapBoard.tsx:708-743` (DoorsLayer + the dmView-gated overlay mounts — the
  link layer sits in the background Layer beside DoorsLayer, copying its cam+mapTransform group
  nesting exactly; DM-only affordances gate on `dmViewActive` (`playerLens.ts:25-27`), not raw
  isDM).
- `snapshot/atlasProjection.ts` (A1 — links arrive filtered; the client renders what it is
  given, no client-side privacy). **The no-client-refilter posture is DELIBERATE** (A1 review,
  recorded): the player surfaces trust the server projection and do not re-assert
  `discovered` — defense-in-depth here would be a second implementation of the privacy rules
  that could silently disagree with the real one.
- The shipped touch-aim pattern (`useMapEditTouchAim` consumers — press AIMS, release DROPS) and
  `usePointerToDoc.ts` (world→doc px). Link placement is an ATLAS action with a one-shot canvas
  aim, NOT a map-edit sub-tool — links are room state, not document elements (§2.3), so the
  palette, `MapEditSubTool`, and the fixture prop clusters stay untouched.
- `apps/client/src/hooks/useMobileSurface.ts:13` (the surface union — add `"atlas"`) **and
  `apps/client/src/layouts/mobile/MobileSurfaces.tsx` — the surface MOUNT host Rev 1's capsule
  omitted** (review C7). No exhaustive switch exists over the union (all uses are `===`
  equality), so a missed mount is SILENT: the render test below is mandatory, and the tile is
  gated `!isDM` (DMs have the Atlas tab; the props tile's double gate at
  `MobileFloatingControls.tsx:170-179` + `MobileSurfaces.tsx:163` is the idiom).
- `MobileFloatingControls.tsx:104-187` (tool-sheet grid — the 🗺 entry; the dock stays five,
  settled). The ordinary tool sheet's guard (`mobile-shell.spec.ts:77-115`) is deliberately
  scroll-tolerant — Rev 1's MAP-floor trap cite belonged to the map-edit sheet and is
  withdrawn.
- `apps/client/src/components/dice/DraggableWindow.tsx:9-21` (desktop player window;
  aria-label "Close <title>" free) + the optional-MainLayoutProps convention for the header
  button wiring (the PLAYER surface does need threading — unlike A2's DM tab, nothing hands the
  header a snapshot today; keep every new prop optional).

**Changes:** NEW `features/map/AtlasLinksLayer.tsx` (sprites by linkType — Konva glyphs v0;
art-track sprites later); DM sprite-click → travel-confirm (A5's confirm), player sprite-click
inert at launch; link placement flow in the Atlas tab (LINK → pick target node → aim on canvas →
`atlas-create-link`; ESC/second-finger cancels — the shipped cancel semantics); NEW
`features/atlas/WorldMapPanel.tsx` (read-only discovered tree + "you are here" from
`currentAtlasNodeId`; a friendly empty state — the snapshot omits atlas keys until something is
discovered) mounted desktop (header button + DraggableWindow, optional props) and mobile (the
`"atlas"` surface + gated tool-sheet entry, `data-mobile-surface="atlas"`). Direct module
imports only (§4.15).

**Tests:** AtlasLinksLayer render (player sees only what the projection sent — feed a
player-shaped snapshot; DM sees hidden links marked); placement unit tests (aim converts via
the document grid; cancel drops cleanly); WorldMapPanel render states ("you are here", empty
state); **the surface render test** (tile → `surface="atlas"` → the panel actually MOUNTS —
the machine test alone cannot see a missing mount); one-open-surface invariant holds; e2e: DM
places a link, player tab sees the sprite at the anchor, DM clicks → confirm → travel fires;
mobile: place a link by touch (CDP), open the world map from the tool sheet, fit guards.

**Done when:** gate green; the Maya loop's navigation skeleton exists: sprites on maps, a world
map in every player's pocket, travel one click from either.
**Traps:** sprites must not intercept map input (`listening` only on the DM's hit area);
anchors are DOCUMENT px through the same transform nesting as DoorsLayer; `getByRole`
accessible-name discipline.
**Escalate if:** the aim flow wants to become a map-edit sub-tool (settled in §2.3 — report,
don't drift).

> **A6 SHIPPED** (2026-09-01, one commit; gate: shared 424, server 2246, client **5467** (+13,
> full 289-file run — the first attempt's batched runner fail-fasted with 7 batches unreported,
> so the suite was re-run whole), e2e 167/3/0 at identical production code. TWO deliberate
> guards tripped and re-pinned: the buildDMMenuProps exhaustive-key test (42→44 keys) and
> nothing else — the tool-sheet guard is scroll-tolerant as predicted. Sabotage **16/16 red**
> (links scope/mystery/transform/player-hit/hidden-marker, aim one-shot/ESC-guard/axis-steal,
> placer visibility+promise-gate, router slot, mobile mount, DM tile gate, you-are-here,
> desktop mount, arming-clears-surface). Live-verified: DM placed a door by AIM→click and the
> anchor landed at the EXACT doc point; sprite-click → confirm → the whole table hopped;
> the player saw the sprite (and fog covered it until fog was lifted — door semantics), their
> click was inert, their link carried no `visibleToPlayers` byte; the world map's ◀ you are
> here moved LIVE mid-wipe; on a phone the DM sheet closed itself on arming and a TAP placed
> a link at the tapped point. Deviations, recorded: (1) the desktop world map is a
> self-launching floating panel (the PlayerPropsPanel idiom, 🗺 WORLD at bottom-right) — a
> Header button would have threaded new props through four fixtures for no gain; (2) the aim
> banner is AlignmentInstructionOverlay with a new `title` prop, not a new component; (3) the
> A6 e2e rows live in A7's journey spec by design — driven live here instead; (4) the 350
> guard forced useStageEventRouter's prop types into a types file and killed
> CenterCanvasLayout's stale @example prop inventory. And ONE REAL BUG the browser found that
> jsdom never could: fill+stroke+opacity<1 sends Konva down its buffer-canvas path, the buffer
> is STAGE-sized, and a 0-size first frame (mobile viewport emulation) made its drawImage
> throw — the error boundary ate the WHOLE table. `perfectDrawEnabled={false}` on the badge;
> remember the pattern: any Konva shape combining those three is a mobile-mount grenade.

---

### A7 🟢 — The journey, the budgets, the docs, the sweep

**Goal:** lock the arc in end to end.

**Changes:**

1. NEW `apps/e2e/atlas-journey.smoke.spec.ts` (≤348 — specs count): DM context + player
   context; DM builds a two-node graph (UI drives the moments that matter: GENERATE panel,
   TRAVEL confirm, a link placement; the harness seam drives the rest), travels A→B→A;
   assertions: player map/fog follow, door state survives the round trip, the player's raw
   snapshot never contains an undiscovered node's name/seed or any sceneState (§4.2 sentinels),
   world map shows discovered-only, one Undo on B removes the generated dungeon. Serial;
   cleanup in `finally` deletes created nodes/links AND generated documents and restores the
   live binding — plus the `resetRoom` fixture as the backstop (state the reliance).
2. `SnapshotSizeGuard.test.ts`: a 64-node/256-link atlas + a maxed suspended scene stays under
   750KB per recipient — built by the REAL handlers, not literals. **Plus the §2.2 watch item:
   measure `JSON.stringify` cost of a realistic sceneStates payload on the synchronous save
   path and record the number** (the store-extraction trigger, quantified).
3. **Session export→import round-trip with realistically LARGE suspended scenes** (review P9) —
   the 1MB ceiling is the real bound; prove a big-but-legitimate campaign survives it.
4. Mobile journey leg in `apps/e2e/mobile/` (join, DM screen Atlas chip, travel, world map).
5. Docs: VISION.md M4 note (Atlas + SceneStates shipped); `m4-dungeon-recipe-plan.md` §7.2
   cashed-IOU note; HANDOFF-NEXT §0 + §10 updated IN THE SAME COMMIT as this closure; the
   SHIPPED banner atop this plan; memory file for the arc.
6. Full ladder end to end, twice; restate every suite count in the final report (recon counts
   are stale by then — re-run, don't copy).

**🔎 SENIOR REVIEW GATE (final):** the standing adversarial review of the arc (finder lenses +
independent refuters + completeness critic), then `agents_error` checked and `git status`
audited.

> **A7 SHIPPED** (2026-09-01, one commit; the final ladder ran TWICE with e2e — run 1 fell to
> ONE unused eslint-disable in the new budget test (removed), run 2 fully green: shared 424,
> server **2249** (+3), client 5477, e2e **169/3/0** (+2 — the two new atlas specs). The
> journey spec passes in 23s: promise → generate → travel → player-wire whitelist (`{discovered,
id, kind, name}` exactly, no `"recipe"`, no `"sceneStates"`, no hidden name — KEY asserts,
> never value substrings; the CI #828 shape) → door opened on A → travel B → world map's
> here-marker → a stair pinned by ⚓ aim → travel back → **the door is still open**. The mobile
> leg passed FIRST RUN (21s): DM-sheet Atlas chip → generate panel → TRAVEL by finger; player's
> Tools → World → here-marker. Budgets: a both-caps atlas (64 max-name nodes / 256 links,
> built by the REAL handlers) weighs in under a THIRD of the snapshot guard; 8 fat suspended
> scenes = **260,289 bytes**, full-state `JSON.stringify` averages **1.40ms** — the §2.2
> store-extraction question is answered NO with two orders of headroom; the 8-scene campaign
> export→imports inside the 1 MiB wire ceiling (scenes must key REAL documents — the loader's
> ghost-scene degrade eats orphans, which the test now proves from both sides). Spec-writing
> traps recorded: Playwright role-name matching is SUBSTRING by default ("🎲 GENERATE" resolves
> to every "🎲 Generate…" — scope to the panel testid), and 🛠️ DM MENU is a TOGGLE (a helper
> that blindly clicks it closes the menu and the next locator waits forever — the 180s-timeout
> shape with a stack pointing at the finally block). Deviations: (1) the plan's e2e rows landed
> as TWO specs (journey + mobile reachability) instead of one; (2) VISION's "documents fetch
> over HTTP" line stays as-written in §2.1's refutation — the wire note in VISION.md was left
> untouched, the M4 banner carries the shipped truth.

> **🔎 FINAL REVIEW — RUN, AND ACTED ON** (2026-09-01/02). The workflow (6 finder lenses →
> 2 independent refuters per finding → completeness critic, 55 agents) was launched THREE
> times and each run died to the session limit mid-refutation (49 / 37 / 39 of 55 errored);
> `git status` was clean after every run. Its first-pass "confirmed: [], refuted: 24" was
> VOID — errored refuters read as refutations — and was treated as unexamined ground. What
> survived: 5 finder lenses (the mobile lens never ran) produced **24 findings**; the two
> that reached both refuters were CONFIRMED (the vacuous non-DM export test; import outside
> the mint ceiling); the other 22 were triaged BY READING THE SOURCE rather than by burning a
> fourth 40-agent run. All 24 were real. Disposition, in four commits each behind its own
> sabotage pass: **`69e83c45` travel physics** — the BLOCKER three lenses found
> independently (same-doc guards keyed on the BINDING while capture keys on the SCENE: unbind →
> rebind first-visit-WIPED the live table uncaptured; fixed by a re-attach branch), resume
> now CONSUMES its record, first visits clear the roster's initiative, modifiers are never
> captured (the A4 banner had said so; the code disagreed), limbo travel warps, and
> already-live travel still discovers — nine contracts including the S1 keystone (capture key
> reverted → red). **`c9726ce8` session** — the ceiling on import AND on load-session's
> upsert (whole-refuse, pre-mutation), ONE scene sanitizer (`parseSceneState`) for the disk
> boundary and the export filter, delete drops anchored links, the export test asserts on the
> attacker's socket with a sentinel walk, the fork test seeds a link. **`c1738db6` client** —
> the aim cancels on a scene change, the lens mirrors the link projection, links are deletable
> from the placer, the camera fallback goes through the map transform, the aim is the mobile
> machine's own rising edge, the iris is a layout effect (jsdom-blind — recorded, not pinned).
> **Journey spec** — the sceneStates secrecy assert re-runs AFTER a real suspension. Recorded
> partials: travel from the pre-Atlas limbo warps the party but deliberately leaves the limbo
> table's raster/drawings in place (START LIVE MAP's protection wins over the haunting); the
> FIELD_BUCKETS table is now `satisfies keyof RoomState`. Lesson for the next arc: a 55-agent
> review needs the budget to FINISH — run it in lens-sized workflows, and never read a
> refuter-less result as clean.

---

## 6. Failure drills (when X happens, do Y — do not improvise)

| Symptom                                                       | Cause                                                                                        | Fix                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| An atlas message does nothing, no error, ack success          | prefix-route case missing (unhandled = acknowledged)                                         | the real-router routing test from §4.4 catches it; add the case AND the test                 |
| `atlas-error` never appears in the client                     | the RUNTIME `isControlMessage` guard entry missing (the type union alone changes nothing)    | §4.7; sabotage the guard                                                                     |
| A DM action errors with "already exists" after a laggy click  | replay-idempotency rule violated — the ack layer retried                                     | §4.5; success-ack the replay                                                                 |
| Player sees a node flash before discovery                     | projection bypassed — something copied `state.atlasNodes` outside `buildRecipientView`       | §4.1; grep for the second producer                                                           |
| Players learn a hidden node's status from error text          | a handler looked up the node before the DM gate                                              | §4.6; gate first, constant reason                                                            |
| Load-session kills the server after adding a collection       | key missing from `SNAPSHOT_LIMITS`                                                           | §3; the sessionValidators comment names this death                                           |
| A restart kills the server the same way                       | a poisoned non-array in the state file rode a `?? []`                                        | §4.13; `normalizeAtlasState`                                                                 |
| Suspended scenes vanish after a real save/re-upload           | the CLIENT session loader whitelists its envelope                                            | A1's client leg (`sessionPersistence.ts`)                                                    |
| Suspended scenes vanish after a table fork                    | fork copies via snapshot; sceneStates never ride snapshots                                   | A1's out-of-band fork copy                                                                   |
| Loading an old file keeps the current campaign's scenes       | `mergeSnapshot` "preserved" instead of file-authoritative                                    | §4.13; the load-atlas-free-file test                                                         |
| `pnpm dev` won't boot after the shared edit; every gate green | `ATLAS_LIMITS` declared in the barrel                                                        | §4.3; sub-module + boot check                                                                |
| Orphaned unnamed documents accumulate                         | generate persisted before validating                                                         | §2.2's ordering; the kill-and-retry test                                                     |
| Export succeeds, import rejects ">64 documents"               | minting passed the cap                                                                       | §2.2's mint cap on BOTH create paths                                                         |
| START LIVE MAP wipes the table's tokens                       | the unbound→bound row implemented as restore-with-defaults                                   | the transition table; that row is compile-only                                               |
| Old map's raster under the new map after travel               | `mapBackground` not restored                                                                 | §4.11                                                                                        |
| Doors reset on travel back                                    | restore overlaid before compile, or authored-equality skipped                                | the preserve rule; A4's door test                                                            |
| Fog reveals/strips the WRONG entities after travel            | the "map" sceneObject transform wasn't restored (visionFilter inverse-transforms through it) | §2.2 sceneObjects residue                                                                    |
| Combat resumes on the wrong creature / order is garbage       | initiative lived only on the roster and a second fight cleared it                            | SceneState.initiatives + revalidation; the interleaved-fight test                            |
| A ghost token nobody can select haunts a resumed scene        | its character was deleted while the scene was suspended                                      | restore-GC                                                                                   |
| The same NPC has two tokens after travel                      | place-npc-token minted a new one while the old was suspended                                 | restore-GC (link moved → captured token dropped)                                             |
| Party lands in the map corner instead of the staging zone     | zone treated as px and divided by gridSize                                                   | §3 — zones are CELL rects, center-anchored                                                   |
| Wipe fires for the DM but never for players                   | keyed on `liveMapDocumentId` (DM-only)                                                       | key on `compiledScene.sourceDocumentId`                                                      |
| Travel wipes to… the new map already visible                  | the overlay tried to capture the old frame and lost the race                                 | A5 — cover-then-reveal, no old frame                                                         |
| A player's fog memory vanishes mid-campaign                   | the 6-entry global LRU                                                                       | A5's per-room index rework (with migration)                                                  |
| Fixture TS2741 storm on RoomState                             | the required fields                                                                          | `/fix-fixture-ripple` for the four test files; hand-decide SnapshotLoader + StatePersistence |
| Mass e2e failure across unrelated features                    | harness fault (concurrent build, orphaned ports)                                             | re-run ONE named spec alone before believing anything                                        |

---

## 7. Deferred follow-ups (recorded, not licensed)

### 7.1 Fog-aware terrain — the candidate BONUS, investigate-only

`m4-dungeon-recipe-plan.md` §7.1: the generated-secret-door dial needs unexplored terrain to stop
shipping. SceneState + per-document explored fog do NOT unblock it — explored fog is client-local
and NOT a privacy boundary (owner-settled; re-verified by this review's refutation attempt:
`mapTerrain` ships identically to every role). The honest unlock remains server-side
per-recipient terrain filtering. AFTER A7, if the arc lands with budget to spare: a spike doc
sizing `deriveMapTerrain` per-recipient + incremental reveal, no code. Anything more is a new arc.

### 7.2 Everything else

The Kicked-In Door keystroke (next arc's opener — it finally has targets); building-interior
recipes cashing town promises; reroll-preserving-pins (provenance now exists; `pinned` does not);
split-party simultaneous scenes; player-initiated travel/knocking; arrival at the link anchor;
link sprites from the art track; a graphical (spatial) world map view; the full APG tree-role
keyboard pattern for the Atlas tree; per-connection DM re-elevation (the identity hardening the
Atlas makes worth pricing — review P3); Cartridge Codes UI.

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
resume_ — `sceneSuspend.ts` capture/restore per the §2.2 transition table; the ONE path shared by
travel and set-live; suspension happens when a scene is REPLACED, never before. _the capture
key_ — `compiledScene.sourceDocumentId`, never the binding. _projection_ — `atlasProjection.ts`,
whitelist constructors; the only legal producer of wire-visible atlas data. _traveling token_ —
§2.2 predicate (character-first); arrives at the destination, never suspends. _restore-GC_ — the
resume-time reconciliation of captured tokens against the global roster. _the sweep_ —
sessionRoundTrip's runtime walk over RoomState keys; A4 adds its capture-completeness sibling
over the §4.10 buckets.

**Review-gate sizing** (the m4 lesson, re-learned THIS review): run gate workflows in small
waves — ≤4 concurrent agents; an errored or empty verify pass is an infrastructure failure, NOT
a clean pass — this plan's own state-machine lens died mid-report and was re-run in full before
any finding was trusted; check `agents_error` and audit `git status` after every run.

---

## 9. Rev 2 — what the pre-execution adversarial review changed

Four lenses ran against Rev 1 (`5260cadb`): protocol/compat, privacy/leak, client/slice, and
state-machine/travel (the last died to a session limit mid-report and was **re-run in full** —
its re-run found the plan's worst blocker). Every finding was evidence-backed (file:line) and
adjudicated; the big ones:

**Design overturned (Rev 1 was wrong):**

- **The suspend/resume machine was specified for one of its four binding transitions** (state
  lens, BLOCKER) — Rev 2's §2.2 transition table is the fix; the capture key moved from
  `liveMapDocumentId` to `compiledScene.sourceDocumentId`; unbind no longer captures (suspension
  happens on REPLACEMENT); set-live rebinds don't warp travelers.
- **START LIVE MAP would have wiped the table** (client lens, BLOCKER) — the unbound→bound row
  is compile-only.
- **The traveling-token predicate keyed on dynamic `isDM`** — EXIT DM MODE turned every goblin
  into a traveler. Now character-first.
- **Combat could not survive an interleaved fight** — initiative values live on the global
  roster and a second fight legitimately destroys them; SceneState now captures them.
- **`sceneObjects` was misclassified as derived** — the rebuild is a continuity-preserving fold,
  and the "map" object's transform is an INPUT to server-side fog; the residue is captured.
- **Staging zones are CELL rects, center-anchored** — Rev 1's §3 said px and the arrivals math
  would have landed the party in the map corner.
- **The generate flow persisted before validating** (orphaned documents; and its claimed dedupe
  was structurally dead — the cache key contains the per-attempt doc id). Reordered;
  node-guard-first idempotency; kill-and-retry test.
- **The 64==64 cap equality protected nothing** — nodes and documents are decoupled; the mint
  cap on both create paths is the real invariant.
- **The iris wipe's "old frame" doesn't exist** — no stage capture exists and React commits the
  new scene first; cover-then-reveal instead.
- **The recipe floor is 20×20, not 8×8.**

**Coverage the review added:** the table fork (silently destroyed every suspended scene — the
one flow that exists to "keep what I built"); the CLIENT session loader's envelope whitelist
(real save/re-upload dropped sceneStates while the server-side round-trip test stayed green);
single-carriage session files; file-authoritative loads + poison-proof guards shared with Redis
hydrate; replay-idempotency for every mutation (the transport retries — "fire-and-forget" was
never true); DM-gate-first with constant error reasons (the nack channel was a node-status
oracle); whitelist projections with exact-key-set tests (mapDocumentId and timestamps were
quiet leaks); per-recipient key omission; ≥9-digit sentinel discipline (atlas frames are
uuid+base64 digit soup — the CI #828 bomb inverted); the one-synchronous-block travel rule with
an exactly-one-frame assert; restore-GC for roster lifecycle ops; `sceneStates` cleanup on
document delete; real-router routing tests (direct dispatcher tests cannot catch the
silent-ack failure); BOTH client MessageRouter lists; the mobile surface mount test + `!isDM`
gate; the mobile-dm chip-array update (the guard counts a hard label list); fog-LRU migration
(the old index is the only evictor); the `focus-rect` camera command; the no-barrel chunk rule;
A2's zero-churn prop audit (snapshot + sendMessage already ride the bag — 42 keys, untouched);
the a11y decision (plain list, no bare `role="tree"`).

**Refutation attempts that FAILED (the settled decisions stand):** sceneStates in RoomState
(with A7's serialized-cost watch item as the extraction trigger); per-player fog memory
client-local; atlas messages off the controller queue. The identity-model caveat (client-asserted
uid) was acknowledged in the Mission rather than treated as a finding — it is the owner's
settled friends-scale posture, with the hardening priced into §7.2.
