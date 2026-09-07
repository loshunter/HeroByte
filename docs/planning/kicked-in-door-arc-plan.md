# The Kicked-In Door — M4 Phase 3 — Execution Plan

**Status:** Rev 2 — authored 2026-09-02 after a 6-reader recon at `dev` = `59e55a81` (code identical
to production `main` = `a0434d39`), the Atlas arc's **mobile-surface review lens** run alone first
(§0.1), and **the pre-execution adversarial review of Rev 1** (`bb27acb2`): four lens-sized
workflows — travel physics, privacy/wire, client/mobile, recipe/determinism — one finder plus two
independent refuters per finding, 36 agents, every lens `agents_error: 0` after the session-limit
interruptions were resumed, tree audited clean after every run. **16 findings: 8 confirmed by both
refuters, 4 contested, 4 refuted.** §9 records every one and its disposition; the confirmed ones
changed the design in five places (the arrival install is door-independent, the kick adopts an
unadopted origin and refuses from true limbo, building partitions are one cell thick, the phone
opens the panel through the surface machine, and the provenance type is split so `size` is truly
optional). Do the slices in order; each slice's _Done when_ gates the next.

**Mission:** VISION.md Signature Move 1 — _"One keystroke mid-session generates a fully compiled,
playable scene — walls, doors, lights, fog — in seconds, stocked with encounter markers."_ The DM
presses **G** (or taps 🚪 on a phone), names the place, picks a recipe, and hits **ROLL**: a new
node is minted under the node the party is standing on, cashed with a recipe, a **door** is pinned
on the current map where the party stands and another on the new map at the entrance they arrive
through, and the whole table travels behind the iris. One synchronous server block; one broadcast;
every piece already shipped by the Atlas arc, composed — never bypassed. The second half of the
arc is the **building-interior recipe** (VISION Pillar 1: _"tavern/shop/warehouse grammars"_) so a
town's promises cash into something that is not a dungeon, and — if budget remains — **Cartridge
Codes** (Signature Move 4), which the provenance this arc completes finally makes possible.

**Vision alignment:** VISION.md Pillar 1 (Recipes [LAUNCH] shipping order: dungeon ✅ → **building
interiors** → wilderness → town → world; "Stocked, not just drawn"; "Keep this, reroll that";
Signature Moves 1 and 4), Pillar 3's two-input rule (_"any action a DM performs more than once per
session takes at most two inputs"_ — G, ROLL), and milestone M4's banner: _"Still to come from M4:
building/wilderness/town/world recipes, the one-keystroke Kicked-In Door (its Atlas targets now
exist), Cartridge Codes UI, and reroll-preserving-pins."_ This plan cashes the first two of those
four and takes a run at the third; pins are §7.

**The sequencing argument (recon-confirmed):** the kick BEFORE the building recipe. The kick is a
composition of `atlas-create-node` + `atlas-generate-node` + `atlas-create-link` + `atlas-travel`,
and every one of those is a synchronous, replay-idempotent, pure-over-`RoomState` function today
(`sceneTravel.ts`, `atlasGenerate.ts`, `AtlasMessageHandler.ts` — §2.1). The dungeon recipe is a
sufficient sole generator to prove the keystroke, the arrival choreography, both platforms, and
the journey end to end. The building recipe then plugs into a recipe REGISTRY the kick slice
introduces, so its own slice is a recipe plus a picker, not a second wiring pass. Doing the recipe
first would have meant wiring a second hard-coded call into two handlers and then unwiring it.

**Secrecy claim, restated:** everything the Atlas arc established holds unchanged — within the
friends-scale identity model (`recipientFilter.ts:63-75`; HANDOFF §9). This arc adds ONE node
field (`arrival`) and widens ONE (`recipe`); both are DM-only on the node by construction because
the player projection is a WHITELIST constructor (`atlasProjection.ts:8-11` — "a spread-based
projection fails OPEN for every field AtlasNode gains later"), and §4.7 makes every slice prove it
on the attacker's socket with ≥9-digit sentinels and a DM positive control. The arrival RECTANGLE,
by contrast, legitimately becomes the scene's staging zone and ships to every recipient exactly as
a DM-placed zone does (§2.3 #4) — the review made the plan say so instead of implying otherwise.

---

## 0. How to execute this plan (read this first)

Same method as `atlas-arc-plan.md`. Rules, binding:

1. **K0 first, then K1→K6 in order.** K0 is the mobile lens's four confirmed fixes — bugs in
   production, each its own commit (HANDOFF §8: fix bugs you find regardless of origin). Don't
   start a slice until the previous one's _Done when_ is fully green.
2. **Read only the Context Capsule files.** Every anchor below was verified on 2026-09-02 at
   `59e55a81` by matching the QUOTED code (a verifier script matched 92 of the readers' quoted
   lines at HEAD; the K0/K2 capsule lines and every anchor the review's refuters cited were re-read
   by hand); match on the quoted code, not the line number.
3. **Never exceed 348 lines (`wc -l`) in any non-`.test.` file** — the guard computes
   `split("\n").length >= 350` (`scripts/structure-report.mjs:138`, `:142`), which is `wc -l ≥ 349`;
   it fails only for paths absent from `scripts/structure-baseline.json` (`:351`); the ONLY
   exemption is the filename substring `.test.` (`:99`) — `__tests__/` directories, e2e `.spec.`
   files and helpers are all counted; a RENAME un-grandfathers a baselined file (the baseline is
   path-keyed). §3's headroom table names the files at the cliff; where it says "extract first",
   extract first. `prettier --write` EXPANDS files — measure AFTER formatting.
4. **Write the slice's tests in the same commit. Prove every new test can fail** — sabotage each
   rule independently (a pair can mask each other) and confirm the assertion can also PASS on the
   healthy tree.
5. **When a Trap or Escalate-if fires, STOP and report.** A wrong guess here yanks a whole table
   into a random dungeon, or leaks a seed.
6. **Commit per slice to `dev`** behind the full HANDOFF-NEXT §2 gate. Do NOT push or merge to
   `main` unless the owner asks — `main` deploys on push, ungated by CI.
7. **Rebuild shared after ANY `packages/shared/src` edit** (`pnpm --filter @herobyte/shared build`)
   — and **boot `pnpm dev` once in any slice that adds a shared runtime value** (K1's `RECIPE_IDS`
   and K4's `recipeAssets.ts` do — HANDOFF §7).
8. **Every slice ships its mobile surface in the same slice** (owner rule). Measure it in a
   browser at 375×812 AND 812×375 (`?mobile=true`; pin tab identity with `?sessionUid=`; drive
   `location.href` from javascript_tool — the pane's `navigate` strips queries). Don't compute it.
9. **Fix bugs found mid-arc regardless of origin**, each in its own commit. §2.1 already lists
   the pre-existing ones the recon and the review found; they are assigned to slices below.
10. **Size every review workflow to FINISH:** one finder (or two) plus two refuters per finding,
    ≤14 agents; check `agents_error` and `git status` after every run; a refuter-less result is
    VOID. When a run dies to the session limit, RESUME it (`resumeFromRunId`) — the finished
    agents replay from cache and only the missing ones run. §0.1 and §9 are the shape.

### 0.1 The mobile-surface lens — RUN (2026-09-02), and what it found

The Atlas arc's final review never completed this lens; the handoff's open item 3 asked for it
before this plan. It ran as one workflow (2 finders → dedupe → 2 independent refuters per finding,
12 agents, 0 errors, tree byte-identical before and after). **Four findings survived both
refuters; one was refuted.** They are K0 — bugs in production, fixed BEFORE the arc because the
kick's own return door rides the very sprite three of them are about:

| #   | Finding (confirmed by both refuters)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Severity (refuters)              | Anchor                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| L1  | **The DM's travel-sprite hit circle never yields to an armed tool.** It takes no tool-mode input, so a tap that lands within 20 doc px of a link badge while a brush/aim is armed BOTH paints the cell (the touchstart was owned by the tool) AND opens the whole-table travel confirm (Konva synthesises `tap` from the touch events themselves). With the link aim armed, `cancelBubble` stops the Stage's tap so no link is placed and a travel confirm appears instead. DoorsLayer solved this with `listening={!selectArmed}`; AtlasLinksLayer did not copy it. | high / medium                    | `AtlasLinksLayer.tsx:82` `const canTravel = dmView && Boolean(onTravel) && Boolean(link.toNodeId);` |
| L2  | **A link-placement tap that lands on a door toggles the door for the whole table and never places the link.** Arming the aim sets `activeTool = "atlas-link"`, so `mapEditMode` is false, so `selectArmed` is false, so doors keep `listening` during the aim; the door's handler wins the press.                                                                                                                                                                                                                                                                    | high / medium                    | `MapBoard.tsx:780` (`selectArmed` fed to DoorsLayer)                                                |
| L3  | **While the link aim is armed a phone cannot pan or zoom, and the pinch a DM reaches for silently cancels the aim** — `shouldPan` negates `linkAimMode`, and the two-finger touchstart returns before the camera handler runs.                                                                                                                                                                                                                                                                                                                                       | high / medium                    | `MapBoard.tsx:717` (the two-finger early return)                                                    |
| L4  | **The phone World Map screen shows its "nothing discovered yet" empty state during every reconnect** — the surface stays mounted while the snapshot is null; the neighbouring Props screen never renders without the snapshot field it needs (`:164`), so it cannot show a stale shell; the atlas surface mounts unconditionally.                                                                                                                                                                                                                                    | medium / low (a banner says why) | `MobileSurfaces.tsx:179` `{surface === "atlas" && !props.isDM && (`                                 |

**Refuted (do not re-file):** _"a single tap on a travel sprite runs `handleActivate` twice
(onTap + onClick)"_ — Konva's `Node.preventDefault` defaults to true and `Stage._pointerdown`
calls `evt.preventDefault()` on the touchstart for any listening shape it intersects, so no
compat mouse pair follows a tap on the hit circle; one activation. Both refuters found the same
mechanism independently.

**Recorded, not cleared** (the finders' own not-examined lists): nothing was run in a browser or
on WebKit; the `AtlasGeneratePanel` seed field lacks `inputMode="numeric"` (a phone opens the
alphabetic keyboard — folded into K2's panel, which replaces that field's idiom); the touch-floor
sweep skips the Atlas tab (K3 fixes); `mobile-atlas.spec.ts` drives neither link placement nor a
sprite tap by finger (K0's tests add the sprite leg; K6's journey adds the rest).

---

## 1. Product goal

### 1.1 What the DM experiences when this ships

- **Desktop:** the party has just kicked in a door you never prepped. Press **G**. A small JRPG
  panel opens (_"🚪 Kick in a door"_): **Name** (prefilled — "Dungeon", or "Tavern" for a
  building; edit it, players will see it the moment they arrive), **Recipe** (dungeon / building
  — K4), the recipe's own dials (theme + density + size, or kind + size), a **Seed** with ⟳, and
  **ROLL** (Enter). The panel closes; a sticky _"🚪 Kicking in the door…"_ toast holds until the
  iris fires, then the arrival toast names where the party is. Seconds later the whole table is
  standing in the new place, fog on, the camera on the party — inside the entrance, not in rock.
  The Atlas tree shows the new node **under** the one you were on. On the map you left there is
  now a 🚪 sprite where the party stood; on the new map, a 🚪 sprite at the entrance they came
  through leads **back** — click it (confirm) and the old scene resumes as it stood (pointers,
  selection and undo are cleared by design, as on every restore). Two inputs (G, Enter) for the
  repeat kick; the panel remembers your last recipe and dials.
- **A table that was never on the Atlas** — the majority of tables the day this ships — is
  ADOPTED by its first kick: the map you are on becomes the campaign's first node (named after its
  document, discovered), and both doors pin exactly as above. A table with no live map at all
  (an uploaded raster and nothing compiled) cannot kick: the panel says _"Start a live map first
  (🏗️ MAP → START LIVE MAP)"_ and ROLL is disabled — nothing can be suspended without a map.
- **Phone:** dock **DM** → the screen's second verb, **🚪 Kick in a door** (stacked below _🏗️
  Edit the live map_) → the same fields as a full screen → **ROLL**. The screen closes, an
  _⏳ Kicking…_ chip sits over the dock until the iris fires, then the arrival toast. Two taps to
  the sheet.
- **Also from the Atlas tab** (both platforms): a **🚪 KICK IN A DOOR** button opens the same
  panel — discoverability for a DM who does not know the key. On a phone that button and the
  DM-screen verb both open the kick screen through the surface machine.
- **Buildings (K4):** pick _building_ and a kind — **tavern / shop / warehouse / house** — and the
  new node is a `building` whose interior is a rectangular footprint partitioned into rooms by
  one-cell-thick painted walls, interior doors punched through them, ONE front door on the side
  the party enters from (the arrival cells are just inside it), a light per room, DM-only room
  keys on the notes layer, and the furniture the shipped catalog can offer (tables, crates, a
  lamp — this arc commissions no art).
- **Cartridge Codes (K5, if budget remains):** a 📼 on any node generated by this arc copies a
  short code; paste it into the kick panel or the generate panel and the same world comes back —
  same geometry, same doors, same keys.

### 1.2 Scope boundaries

**In this arc:** K0's four production fixes; the `atlas-kick` message (one atomic server
composition through `travelToDocument`, adopting an unadopted origin); the arrival zone (recipe →
node → a sticky first-visit staging zone) so the party lands in a room, not in rock; provenance
completed (`size` recorded — a real reproducibility hole today); the scene-keyed "current node"
(§2.3); the desktop keystroke + panel, the Atlas-tab button, the phone verb + screen + pending
chip; the arrival toasts; the help entry; a recipe registry and the **building** recipe (atlas
generate + kick surfaces, both platforms); Cartridge Codes as an optional slice; the journey e2e
on both platforms; the user-guide debt the Atlas arc left (DM guide, player guide, README, a
screenshot walkthrough).

**Never in this arc (deferred, §7):** the live-map GENERATE tool's recipe picker (the drag-a-region
surface stays dungeon-only; the registry makes it a follow-up); an _aimed_ kick (choose where the
door goes); reroll-preserving pins (needs per-ELEMENT provenance — `MapElementBase` has none;
VISION's `pass` field never shipped); Bestiary-linked encounter manifests (the `templateId` VISION
calls "reserved" is a commented-out line, `packages/shared/src/index.ts:494`); town / wilderness /
world recipes; furniture art; editing a node's `kind` (the adopted origin is minted as a `region`
and cannot be re-kinded today); presets smaller than 24×20 (a per-recipe floor below 20 is
unreachable until one exists); secret doors in any generated map (still blocked on fog-aware
terrain — `dungeonGeometry.ts:245-267`); a JRPG replacement for the 17 `window.confirm` sites;
split-party scenes; `.htcart` anything.

---

## 2. Architecture — the decisions everything hangs on

### 2.1 What recon established (correcting the handoff where it was wrong)

- **The composition is real, synchronous, and already replay-safe by id.** Every atlas handler
  is await-free; `travelToDocument` (`sceneTravel.ts:59`) returns `void` and its CALLER owns the
  binding and the `{broadcast, save}` result; `handleAtlasGenerateNode` (`atlasGenerate.ts:68`)
  is validate-then-persist with the NODE GUARD as its idempotency (`:86` `if (node.mapDocumentId) {`
  — the place-room dedupe cache cannot help, its key holds the per-attempt document id, `:8-15`);
  `createNode` / `createLink` no-op on an existing id (`AtlasMessageHandler.ts:128`, `:269`);
  `createLink` CLAMPS the anchor into the from-map (`:287` `x: Math.min(Math.max(anchor.x, 0),
document.width),`). One handler that chains them in order — recipe → persist → node → links →
  travel — is ONE broadcast and exactly ONE snapshot frame per recipient, which the 16 ms
  debounce (`BroadcastService.ts:96`) and the arc's contract pin
  (`sceneTravel.contract.test.ts:267` `expect(snapshotsOf(dmWs)).toHaveLength(1);`) already
  enforce for travel. The ack layer keeps a pre-minted `commandId`
  (`CommandAckManager.ts:47` `const commandId = message.commandId ?? this.generateCommandId();`),
  which is how generate's commandId already doubles as the recipe's element id prefix.
- **Client-side orchestration of the four existing messages was considered and REJECTED.** It
  would produce up to four broadcasts (players could see a sprite pop onto the old map before the
  wipe), it has no atomicity (an at-cap on message 2 orphans the node from message 1), the anchor
  would be measured on a possibly-stale client snapshot (the exact hazard `useAtlasLinkAim.ts:116`
  guards — `if (armed && sceneId !== armedSceneRef.current) cancelLinkAim();`), and `atlas-travel`
  has no cross-attempt guard beyond "am I already there" (`sceneTravel.ts:213`) — a retried
  travel after the DM moved elsewhere yanks the table back. The ack layer retries every message
  3× with the same commandId (`MessageQueueManager.ts:147`), so that hazard is real. **No new
  server→client message is needed either way**: the client learns everything from the snapshot
  (`currentAtlasNodeId` and `compiledScene.sourceDocumentId` both move in the same frame), which
  is how the generate panel already learns success (`AtlasGeneratePanel.tsx:6-7`).
- **"The current node" is derived from the BINDING, not the scene.** `atlasProjection.ts:35-37`
  `const currentNode = state.liveMapDocumentId ? nodes.find((node) => node.mapDocumentId ===
state.liveMapDocumentId) : undefined;` — while `travelToDocument` keys everything on
  `state.compiledScene?.sourceDocumentId` (`sceneTravel.ts:67`). They diverge after an unbind,
  a publish of another document, or a delete-of-live — the arc's final-review BLOCKER was a guard
  on the wrong one (`sceneTravel.ts:71-79`). During the unbound interlude "you are here" vanishes
  for everyone though the party is plainly standing on the node's map
  (`sceneTravel.contract.test.ts:524-525` pins the divergence). The kick's parent and link
  origin MUST be the scene's node (§4.5), and the projection is aligned with it in K1 (§2.3).
- **The unadopted table is the default table.** A document becomes live only through
  `bindLiveDocument` (`sceneTravel.ts:175-179`), which touches no atlas state; a node acquires a
  document only through the deliberate `atlas-link-map` (`AtlasMessageHandler.ts:258`) — the
  contract suite calls it "the adopt-my-live-map flow" (`sceneTravel.contract.test.ts:656`). So
  "compiled scene present, no node for its document" is what every pre-Atlas table looks like,
  and the Atlas reached production on 2026-09-02. A kick that minted a rootless child with no
  doors there would be one-way for most tables (review T4); §2.2 adopts the origin instead.
- **True limbo has nothing to capture.** An uploaded raster (`domains/map/service.ts:86`
  `state.mapBackground = backgroundData ?? undefined;`) mints no document, so a table with only a
  raster has `compiledScene === undefined`; `captureSceneState` is keyed by a document and no
  record can be written for it. The Atlas review recorded that travel from that state warps the
  party but leaves the raster, drawings and tokens in place ("START LIVE MAP's protection wins
  over the haunting" — `atlas-arc-plan.md` FINAL REVIEW); clearing them would DESTROY them. The
  kick therefore REFUSES from true limbo (§2.3 #10) rather than haunting or destroying.
- **Tokens are CELLS; link anchors are DOCUMENT px; the conversion exists.** `Token.x` is a grid
  cell (`packages/shared/src/index.ts:183`); the token layer draws cell CENTERS with no grid
  offset (`TokensLayer.tsx:96` `const posX = transform.x * gridSize + gridSize / 2;`); the server
  does the same for vision (`visionFilter.ts:56` `origin: gridCellToWorldPoint(state.gridSize, {
x: token.x, y: token.y }),`, `sceneGeometry.ts:108` `return { x: cell.x * gridSize + gridSize
/ 2, … }`); world → document goes through the "map" sceneObject's inverse transform
  (`visionFilter.ts:41-43`), which exists only when a raster background is set
  (`SceneGraphBuilder.ts:75` `if (!mapBackground) {` … `return null`) — for a generated map,
  document space ≡ world space (`usePointerToDoc.ts:2-4`). `AtlasLinksLayer` nests the same two
  transform groups as DoorsLayer (`AtlasLinksLayer.tsx:61-62`), so an anchor computed by the
  TOKEN convention lands exactly under the token. `placeArrivals` writes FRACTIONAL cells inside a
  zone (`sceneSuspend.ts:245-246`) — containment tests need a tolerance, not integer equality.
- **A generated dungeon has no entrance and no staging zone.** `RecipeOutput` is `{ cells,
elements }` only (`generation/types.ts:44`); `dungeonRecipe` discards the layout's `rooms`
  (`dungeonRecipe.ts:33-50`); `playerStagingZone` is SCENE state, not a map element, and no recipe
  can emit one. So a first visit lands the party at the document's center cell
  (`sceneSuspend.ts:249` `const centerX = Math.floor((document.width / 2 - offsetX) / size);`) —
  which may be solid rock. `placeArrivals` warps travelers on EVERY travel to the destination's
  zone when one exists (`sceneTravel.ts:131-133`), and the zone is in the captured bucket
  (`sceneTravel.contract.test.ts:697` `playerStagingZone: "captured",`) — so an arrival zone
  installed when the scene has none is legitimately "the entrance", captured and restored like
  any zone, movable with the existing staging tool. It is also PLAYER-VISIBLE: the scene graph
  mirrors it into a `staging-zone` object (`SceneGraphBuilder.ts:51`), the recipient filter passes
  it, and `StagingZoneLayer` draws the dashed box — exactly as for a DM-placed zone — and without a
  zone a late-joining token spawns at `(0,0)` (`StagingZoneManager.ts:126-127`). §2.3 #4 accepts
  that render explicitly.
- **The install must not depend on which door the first visit came through.** `map-studio-publish`
  (`MapStudioMessageHandler.ts:250` `state.compiledScene = compileScene(document, this.now());`)
  compiles ANY document onto the table outside `travelToDocument` — the legacy path the Atlas plan
  deliberately left outside the model. A DM who publishes a generated document, travels away, and
  later travels to its node arrives via the SAVED branch, whose zone is whatever was captured
  (nothing) — a first-visit-only install would be dead forever (review T1). §2.2 installs the
  entrance whenever a warp finds no zone and the node has one; a moved zone wins.
- **The START LIVE MAP branch leaks the limbo table's staging zone into the arrival math.**
  `sceneTravel.ts:92-99` never calls `restoreCollections`, so a travel from a never-bound table
  that had a zone set warps the party to THOSE cells on the NEW map. Untested (the limbo test at
  `sceneTravel.contract.test.ts:643` sets no zone). Pre-existing; K1 fixes it in its own commit.
- **`compileOnto` runs OUTSIDE the capture's try/catch** (`sceneTravel.ts:117` vs the `try` at
  `:106-115`): a throw there leaves `state.sceneStates[outgoingId]` written while
  `compiledScene` still points at the outgoing map — a half-traveled room, unbroadcast and
  unsaved. Pre-existing and practically unreachable today; the kick compiles a document minted in
  the same tick, so K1 splits the call: compile the destination FIRST (`compileScene` and
  `overlaySavedDoorStates` are pure), THEN capture the outgoing scene (which reads door runtime
  from `state.compiledScene` — `sceneSuspend.ts:72` — so the install must not precede it), THEN
  install the compiled outputs onto state. The review checked that this three-phase split keeps
  the outgoing `doorStates` intact (T3).
- **Provenance is FLAT and drops `size`.** `atlasGenerate.ts:177-182` writes `{ recipeId:
"dungeon", seed, theme, density }` — not `{recipeId, seed, params}` as the handoff said, and
  `size` is not recorded at all, so a node's provenance cannot reproduce its own dimensions. A
  live Cartridge-Codes blocker and a reproducibility bug today; K1 fixes it (own commit) with
  `size` OPTIONAL on the provenance type — declared so that it IS optional (§2.2; a naive
  intersection makes it required, review P1) — and the five shipped fixtures that write
  provenance without it stay untouched.
- **There is no recipe registry.** Both generate doors call `dungeonRecipe` directly
  (`atlasGenerate.ts:132`, `MapStudioMessageHandler.ts:141`); the atlas message carries no recipe
  id at all (`AtlasGenerateMessage`, `atlasGenerate.ts:54-63`); `recipeId: "dungeon"` is a
  literal in the shared provenance type (`atlas.ts:48`), the map-studio wire union
  (`index.ts:969`), both validators (`generationValidators.ts:48` `recipe: z.literal("dungeon"),`;
  `atlasValidators.ts:92` `theme: z.enum(["stone", "wood"]),`), and both `.strict()` params
  schemas. `assertGenerateRequest` ignores its params argument (`recipeContext.ts:53`
  `_params: DungeonParams`). `AtlasNodeKind` already contains `"building"` (`atlas.ts:21`) — the
  node kind exists; only the recipe is missing. `resolveRecipeContext` → `validateBounds`
  enforces the 20×20 floor for EVERY caller (`recipeContext.ts:130`); the smallest preset is 24×20
  (`atlasGenerate.ts:37`), so a per-recipe floor is unreachable in this arc and is not built.
- **`emitGeometry` is recipe-agnostic for GEOMETRY, not for PAINT.** `dungeonGeometry.ts:51`
  reads only `layout.floor / rooms / doorSites` plus the theme's two asset ids; its wall tracer
  walls every floor cell against non-floor (family 1) and every seam between DIFFERENT rooms
  (`:165` `} else if (roomOf.get(key) !== roomOf.get(neighbour)) {`), omits the wall at every door
  site (`:171` `for (const site of layout.doorSites) blocking.delete(edgeKey(site.edge));`), and
  merges collinear runs. But the ONLY visible wall a recipe can produce is the painted halo, and
  `emitWallHalo` skips floor cells (`:109` `if (layout.floor.has(cellKey(x, y))) continue;`) while
  wall ELEMENTS never render as scenery (`scenePublish.ts:164` `toRenderable` returns null for
  them). A zero-gap partition — floor on both sides — would therefore be an invisible blocking
  line (review R2). Building partitions are ONE CELL THICK (§2.2): a non-floor line between
  rooms, exactly how the dungeon separates rooms from rock, so the halo, the seam rule and the
  door rotation all work unchanged. `DungeonLayout` is already exported (`dungeonLayout.ts:40`);
  `touchesWithMargin` (`:139`) rejects only floor-abutting rooms and accepts a one-cell gap. The
  high-value internals (`wallEdgesOf`, `findDoorSites`, `pxX`, `shuffleIds`) are module-private;
  the geometry file is at 338 lines. **What does NOT exist:** a perimeter-door helper (the Room
  tool's `roomBuilder.ts:108-121` emits a closed ring with no door at all), and furniture — the
  complete indoor vocabulary is `objects:table` (2×1), `objects:crate` (1×1) and `objects:lamp`
  (`starterTileObjectAssets.ts:17-41`); no chair, barrel, bed, counter, shelf or chest anywhere,
  and the server cannot import the client's catalog (it hardcodes asset-id strings, as
  `dungeonGeometry.ts:25-26` does — K4 moves the recipe ids to a SHARED sub-module so a client
  test can assert them against the catalog). `ctx.layerIds.objects` is resolved and never used
  (`recipeContext.ts:41`) — a pre-wired seat for exactly this. `MAX_STAMP_ELEMENTS` (2000) and
  `MAX_GEOMETRY_ELEMENTS` (1000) are declared and never enforced (`generation/types.ts:68-70`).
- **The keystroke has no precedent — and the one bare letter that exists is a bug.** No
  unmodified single-letter hotkey exists in the client; `G` and `Shift+G` are unbound (grep of
  every `key ===` comparison); every letter binding is behind `ctrlKey || metaKey`
  (`useKeyboardShortcuts.ts:274`, `useMapEditHotkeys.ts:36`). The one bare letter,
  `useMapEditPlacement.ts:112` `if (event.key.toLowerCase() !== "r" || event.ctrlKey ||
event.metaKey) return;` (rotate the pending stamp), has NO `isEditableTarget` guard — typing
  "r" in a field while placement is armed rotates the stamp. Pre-existing; K2 fixes it. So does
  `useKeyboardNavigation.ts:27`'s hand-rolled editable check (misses `SELECT` and
  contentEditable). Hotkeys are mounted for players and DMs alike (`App.tsx:637`) and are not
  DM-gated per key — the kick hook gates itself. `useGenerate.ts:145-148` anticipated this:
  the `alreadyBuilt` guard was moved into `onGenerate` "so a future hotkey inherits it".
- **Konva's `tap` has no movement slop** (review C1 — the finder read the installed Konva 10.0.2:
  `Stage.js:384` sets `ListenClick` on every touchstart, `_pointermove` never clears it, and
  `_pointerup` fires `pointerclick` → `'tap'` unconditionally when no listening shape is hit). The
  repo's own comment says the same: `useTouchGestureRouter.ts:56-58` — Konva's tap "is
  synthesised from the touch events themselves, not from the compat mouse pair". So a one-finger
  DRAG while the link aim is armed would place a link at the finger-lift; that is why `shouldPan`
  negates every click-shaped tool (`useStageEventRouter.ts:95-102`), and why K0 L3 restores only
  the PINCH.
- **Where the hook mounts:** `AuthenticatedApp` (`App.tsx:144`) has `snapshot`, `isDM`
  (`:195` `const { isDM: serverIsDM } = useDMRole({ snapshot, uid, send: sendMessage });`),
  `sendMessage`, `activeTool`/`setActiveTool` and `mapStudio` in scope, and `useAtlasLinkAim`
  is mounted there at `:629` — the literal precedent. `App.tsx` is a grandfathered structure
  violator (baseline 713; now 903), so growth there is free at the guard. Zero
  `MainLayoutProps` churn for the hotkey itself; the panel, the tab button and the phone verb
  thread ONE optional prop object (§2.2) — `MainLayoutProps.ts:368` records the A6 convention
  ("OPTIONAL on purpose: the four layout fixtures…"). `FloatingPanelsLayoutProps` is its own
  interface (`FloatingPanelsLayout.tsx:50`), so `MainLayout.tsx` (432, baselined) forwards the
  prop explicitly. `useServerEventHandlers` is called at `App.tsx:377`, 250 lines ABOVE the
  hook's mount — the error seam is a ref, not a closure.
- **The TRAVEL confirm is a native `window.confirm`**, duplicated byte-for-byte at
  `AtlasNodeRow.tsx:98-99` and `MapBoard.tsx:583-584`; 17 sites use the idiom; e2e handles it
  with `dm.on("dialog", (dialog) => void dialog.accept());` (`atlas-journey.smoke.spec.ts:105`).
  The kick's panel IS its confirmation — no extra dialog.
- **The phone's affordance cannot be a dock slot and should not be a tool tile.** Slot five is
  the only entry to the DM menu (`MobileFloatingControls.tsx:250-263`) and the dock's five are
  pinned by four assertions in three files. A tool tile trips no pin (nothing counts the sheet's
  grid — R5) but a DM sits at exactly 9 tiles = 3 full rows at ≤420px (`herobyte.css:2194`
  `grid-template-columns: repeat(3, minmax(0, 1fr));`), so a tenth tile costs ~56px of MAP the
  DM can no longer tap (`herobyte.css:1531`). The DM screen already carries ONE screen-level verb
  — `MobileSurfaces.tsx:136` `className="mobile-chip mobile-screen__action"` (_🏗️ Edit the live
  map_), whose CSS reads "An action a Screen offers that LEAVES the screen (today: arming
  map-edit)" (`herobyte.css:2104`) and is `width: 100%` (`:2107-2110`, so two verbs STACK) —
  rendered OUTSIDE the lazy chunk's Suspense, 44px by two rules, counted by no pin, costing no
  map. The kick is the second verb. The surface machine holds exactly one open surface
  (`useMobileSurface.ts`; `MobileSurfaces.tsx:1-8` asserts it by `data-mobile-surface` count), so
  the panel's OPEN signal on a phone must be the machine, never a second flag ORed in (review C3).
- **Nothing shows a phone that a multi-second atlas operation is in flight.** `useAtlasActions`
  mints a commandId and throws it away (`useAtlasActions.ts:52`); `AtlasGeneratePanel` has no
  pending state; the only ambient busy chip, `.mobile-dock-saving`, is rendered only by the
  map-edit dock (`MobileMapEditDock.tsx:64`) but its CSS is generic and out of flow
  (`herobyte.css:1299-1316` — it dodges the five columns on purpose). Toasts render on mobile
  above every surface (`MobileLayout.tsx:286`; `Toast.tsx:174` `zIndex: 10000,`). Measured by the
  review (C4, refuted timeout finding): the `large` preset costs ~9 ms of CPU; the ack layer's
  retry ladder exhausts at 3.5 s and already toasts "could not reach the server" — the kick's 20 s
  pending timeout is a backstop, not a budget.
- **The three ServerMessage hand-lists are untouched by this arc** (`websocket.ts:93`,
  `MessageRouter.ts:61`, `MessageRouter.ts:367`) — assert by grep at closure. The
  `registerServerEventHandler` chain is SINGLE-subscriber (`useWebSocket.ts:206`
  `controlHandlerRef.current = handler;`): a second registration silently kills the atlas-error
  toast, so the kick hook receives failures through a callback the existing chain calls
  (`useServerEventHandlers.ts:254-258`), never a second subscription.
- **Pinned counts this arc touches:** `buildDMMenuProps` key set 44 → **45** (the tab button's
  `openKick`; `buildDMMenuProps.test.ts:93`); help topics 9 / mobile manual controls 14 stay
  (K2 adds an ENTRY to the Atlas topic, entries are not counted — `help-panel.spec.ts:76`,
  `mobile-help.spec.ts:104`); DM chips 6 stay (the screen verb is not a tab label,
  `mobile-dm.spec.ts:44-63` filters by exact label); dock 5 stays; the projection key sets stay
  (`atlasProjection.test.ts:76`, `:98`) — `arrival` and the widened `recipe` are DM-only.
- **`"size"` is not an atlas-only key.** `mapTerrain.grid.size` and `mapElements.grid.size` ride
  EVERY recipient's frame (`model.ts:207-209`, no `isDM` guard), so a raw-bytes secrecy check for
  `"size"` can never pass (review P2); the node's `recipe.size` is covered by `"recipe"` being
  absent and by the exact key set. Likewise nothing validates a node's SHAPE on the way in —
  `sessionValidators.ts` has no atlas node schema; nodes reach state through `atlasState.ts:75`
  `recordArray<AtlasNode>` (an `isRecord` filter) — so pre-K1 nodes without `size`/`arrival` load
  untouched (P3), and the round-trip sweep (`sessionRoundTrip.contract.test.ts:361`) compares
  TOP-LEVEL keys only: nested fields are pinned by explicit spot-checks, never by the sweep.
- **The docs debt is two arcs deep.** `docs/user-guide/` has NO Atlas, travel or world-map
  section in any guide (the DM guide's only generation line is `dm-guide.md:144`); the in-app
  Help topic (`helpTopics.ts:63-93`) is the only end-user prose; the screenshot harness has no
  Atlas step (`docs-screenshots.dm.ts` is at 341 lines — a new walkthrough file, not growth).
  The Atlas arc's A7 checklist never named the user guide. K6's does.

### 2.2 The design

**State model — ONE new optional field and ONE widened field on `AtlasNode`; zero new RoomState
fields; zero new stores; zero new ServerMessages.**

```ts
// packages/shared/src/atlas.ts
export interface AtlasNode {
  …
  /**
   * Provenance, recorded when a promise is cashed. K1 records `size`; it is
   * optional on the PROVENANCE because production nodes minted before K1 lack
   * it (K5 shows no cartridge code for those). K4 widens the union with the
   * building recipe. DM-only on the wire (whitelist projection).
   */
  recipe?: RecipeProvenance;
  /**
   * Where the party ARRIVES: the recipe's entrance as a center-anchored CELL
   * rect in the staging-zone convention. Installed as the scene's
   * playerStagingZone whenever a WARP finds the scene without one (first visit,
   * or a scene captured zone-less after a publish); a moved zone wins forever.
   * The rectangle is then ordinary, player-visible scene state — only this
   * node FIELD is DM-only on the wire.
   */
  arrival?: PlayerStagingZone;
}

// packages/shared/src/recipes.ts (NEW sub-module — K1 types, K4 grows it; the
// barrel RE-EXPORTS only; RECIPE_IDS is the one runtime value — boot pnpm dev)
export type GenerateSize = "small" | "medium" | "large";
type DungeonParams  = { recipeId: "dungeon"; theme: "stone" | "wood"; density: "low" | "medium" | "high" };
type BuildingParams = { recipeId: "building"; kind: "tavern" | "shop" | "warehouse" | "house"; entrySide?: "north" | "south" | "east" | "west" }; // K4
export type RecipeParams = DungeonParams | BuildingParams;
// `size` is ADDED per type, never overridden by intersection: an intersection
// keeps a property required unless it is optional in EVERY constituent, so
// `GenerateRequest & { size?: … }` would silently require it (review P1/R1).
export type GenerateRequest  = RecipeParams & { size: GenerateSize };
export type RecipeProvenance = RecipeParams & { seed: number; size?: GenerateSize };
export const RECIPE_IDS = ["dungeon", "building"] as const; // K4 adds "building"

// apps/server/src/domains/generation/types.ts
export interface RecipeOutput {
  cells: TerrainPaintCell[];
  elements: MapElement[];
  /** The entrance, absolute document cells, staging-zone shape (center-anchored). K1. */
  arrival?: PlayerStagingZone;
}
```

The five shipped fixtures that write a provenance literal without `size` —
`StatePersistence.test.ts:99`, `atlasProjection.test.ts:49` and `:67`,
`atlasGraph.contract.test.ts:299` (and its `toEqual` at `:485-489`, which K1 extends),
`sessionRoundTrip.contract.test.ts:301` — must compile UNTOUCHED under the new type; that is K1's
proof that `size` is optional in fact and not only in prose.

**The wire — ONE new ClientMessage, eight becomes nine, same family gate:**

```ts
{
  t: "atlas-kick";
  commandId: string; // client-minted (≤120 chars — the element-id headroom, atlasValidators.ts:88):
  // the recipe's element idPrefix + place-room dedupe key
  nodeId: string; // client-minted uuid: the CHILD node — and the replay guard
  originNodeId: string; // client-minted uuid: used ONLY when the origin must be ADOPTED
  linkId: string; // client-minted uuid: origin → child, at the party's position
  returnLinkId: string; // client-minted uuid: child → origin, at the entrance
  name: string; // the child's name, node-name bounds (atlasValidators' existing schema); TRIMMED by the handler
  seed: number; // int — rides the message, never minted server-side (§4.8)
  recipe: GenerateRequest;
  linkType: "door" | "stair" | "signpost"; // default "door"
}
```

`atlas-generate-node` gains the same `recipe: GenerateRequest` in place of its flat
`params` + implicit dungeon (K1 for dungeon, K4 for building). Every domain failure answers on
`atlas-error` (sent to the acting DM only) with `nodeId = message.nodeId` so the client's pending
state can match it.

**The kick, server-side — ONE synchronous block in NEW `apps/server/src/ws/handlers/atlasKick.ts`
(the `atlasGenerate.ts` / `sceneTravel.ts` extraction precedent; `AtlasMessageHandler.ts` is at
311 and gains one `case`):**

```
handleAtlasKick(deps, state, uid, roomId, message): RouteHandlerResult
  0. REPLAY: a node with message.nodeId exists → (re-broadcast its document to DMs, the
     generate idiom) → NO_OP. The first attempt is atomic (below), so "node exists" means
     "the whole kick landed" — a replay never re-travels.
  1. ORIGIN: originDocId = state.compiledScene?.sourceDocumentId — the SCENE only, derived the
     way the projection derives "you are here" (§4.5); no binding fallback (K1's review, SM2).
     No originDocId (nothing compiled — a binding alone is limbo too) → atlas-error "Start a
     live map first" — nothing can be suspended without a compiled scene (§2.3 #10).
     origin = atlasNodes.find(n => n.mapDocumentId === originDocId) — when undefined the origin is
     ADOPTED in this same block (step 5): the document the party stands on becomes a node.
  2. PRE-FLIGHT (state untouched on failure; constant reasons; atlas-error carries nodeId):
     atlasNodes.length + (origin ? 1 : 2) ≤ ATLAS_LIMITS.nodes;
     atlasLinks.length + 2 ≤ ATLAS_LIMITS.links;
     mapStudioService.list(roomId).length + 1 ≤ MAX_SESSION_DOCUMENTS;
     mapStudioService.get(roomId, originDocId) resolves (the origin's document exists).
  3. ANCHOR (computed NOW — before anything moves): travelers = tokens.filter(isTravelingToken);
     centroid of their cells (fractional is fine) → gridCellToWorldPoint(state.gridSize, centroid)
     → inverseTransformScenePoint(the "map" sceneObject's transform, if any) → pushLink clamps.
     Zero travelers → the compiled scene's center {width/2, height/2}. Never refuse for lack of
     tokens (a solo prep is normal). Tested on a BOUND origin — limbo has no origin to anchor on.
  4. CASH: child = { id, kind: RECIPES[recipe.recipeId].nodeKind, name, parentId: origin?.id ??
     message.originNodeId, discovered: false, … } (an OBJECT, not yet pushed) →
     cashNode(deps, state, roomId, child, seed, recipe) — the generate core extracted from
     handleAtlasGenerateNode: mint the document object, resolve ctx, assert request + the
     recipe's params, run RECIPES[recipe.recipeId].run, assert budget (all pure) → persist →
     apply (delete-on-apply-failure) → child.mapDocumentId, child.recipe (with size),
     child.arrival ← output.arrival. Any failure returns atlas-error; nothing else was mutated.
  5. PUSH: if the origin was unadopted, push { id: message.originNodeId, kind: "region",
     name: originDocument.name, mapDocumentId: originDocId, discovered: true, … } — then the child,
     then BOTH links through the same pushLink core the atlas-create-link case uses (clamp,
     endpoint and origin-has-a-map checks apply):
       { id: linkId, fromNodeId: origin.id, toNodeId: child.id, anchor, linkType, visibleToPlayers: true }
       { id: returnLinkId, fromNodeId: child.id, toNodeId: origin.id,
         anchor: entranceAnchor(child.arrival, document), linkType, visibleToPlayers: true }
     entranceAnchor = the arrival rect's boundary cell on the side nearest the document edge
     (the way in), by the token convention — never the zone's CENTER, which is where the party
     STANDS and where the tokens layer would cover the sprite (review T-dropped).
  6. TRAVEL: handleAtlasTravel(deps, state, uid, roomId, child.id, sendError) — warp on, fog on
     (recipe provenance), firstVisitStagingZone: child.arrival, auto-discover.
  7. return MUTATED  (+ the generate core's own map-studio-document frame to DMs)
```

Steps 4–7 are one synchronous block: no recipient, no racing fork, sees a node without its map, a
link without its node, or a party without its scene. After pre-flight the only reachable failure
is the recipe/apply inside `cashNode`, before anything is pushed (a travel throw is unreachable —
the document exists by construction); §4.3's fingerprint test covers exactly that window. The
composition goes THROUGH `handleAtlasTravel` → `travelToDocument`, never around it (§4.1).

**Arrival zones — how a recipe's entrance becomes where the party lands:**

```
RecipeOutput.arrival            dungeon: the layout's FIRST room (placement order is seeded and
  (K1, dungeonRecipe)           stable); building (K4): the entry room's cells just inside the
        │                       front door, CLIPPED to that room (1–3 cells, never across a seam).
        ▼                       Absolute document cells, {x, y} = CENTER cell (the zone convention:
AtlasNode.arrival               placeArrivals spreads ±width/2 around x; useCameraCommands focuses
  (cashNode records it;         (zone.x + 0.5) * gridSize).
   DM-only by the whitelist)
        │
        ▼
SceneTravelOptions.firstVisitStagingZone   handleAtlasTravel passes node.arrival for EVERY travel
        │                                  to the node. ONE door-independent install, immediately
        │                                  before EACH placeArrivals call in travelToDocument:
        │      if (options.warpTravelers && !state.playerStagingZone && options.firstVisitStagingZone)
        │          state.playerStagingZone = structuredClone(options.firstVisitStagingZone);
        │      placeArrivals(state, travelers, document, options.rng);
        ├─ capture-then-restore row: a first visit has no zone → installed; a resume whose
        │    captured zone is undefined (a publish burned the first visit, or the DM cleared it)
        │    → installed again — the entrance is STICKY; a MOVED zone wins forever.
        ├─ START LIVE MAP row with warp: the outgoing table's zone is dropped first
        │    (state.playerStagingZone = undefined — the limbo-zone leak, K1 bug b) → installed.
        └─ set-live rows: warpTravelers is false → no install → START LIVE MAP untouched.
        ▼
placeArrivals (unchanged) — the party lands in the entrance; the zone is captured with the scene,
restored on resume, drawn to every recipient as a staging zone (dashed box + label, exactly as a
DM-placed one), spawns late joiners inside the entrance, and the DM can move it.
```

**The client — one App-level hook, one panel rendered by both layouts, one optional prop:**

```
apps/client/src/features/atlas/useKickedInDoor.ts   (App-level, beside useAtlasLinkAim — App.tsx:629)
  inputs: { isDM, snapshot, sendMessage, activeTool, toast, atlasErrorRef }
  state:  open: boolean; pending: { nodeId, name, startedAt, expired: boolean } | null;
          settings (remembered)
  G keydown (window, bubble): ignore when isEditableTarget(target) | !isDM | activeTool !== null
    (ANY tool on the axis — map-edit, aim, alignment, draw, select, pointer, measure) | any modifier |
    event.repeat → openKick()
  kick(request): mint nodeId/originNodeId/linkId/returnLinkId/commandId ONCE per panel session
    (a ROLL after a timeout REUSES them so §4.4's replay guard covers the retry) → sendMessage({
    t: "atlas-kick", … }) → pending = {…}; closeKick(); remember settings (localStorage
    "herobyte:kick:last", versioned, try/catch); desktop: a sticky toastInfo("🚪 Kicking in the
    door…") whose id the hook keeps to dismiss it
  arrival:  snapshot.currentAtlasNodeId === pending.nodeId → pending = null; dismiss the sticky
            toast; toastSuccess("🚪 <name> — kicked in")  (a LATE arrival after expiry still does this)
  failure:  atlas-error with nodeId === pending.nodeId → pending = null; dismiss the sticky toast
            (the existing error toast shows the reason). Delivered through useServerEventHandlers'
            existing chain (App.tsx:377, above the hook) via `onAtlasError: (m) => atlasErrorRef.current?.(m)`
            — a ref the hook fills; the chain stays single-subscriber.
  timeout:  20 s → pending.expired = true (NOT cleared); dismiss the sticky toast;
            toastError("The door didn't budge — ROLL again (same ids)")
  returns:  KickControls = { open, openKick, closeKick, kick, pending, defaults }

apps/client/src/features/atlas/KickPanel.tsx        (role="dialog" aria-label="Kick in a door";
  the fields of §1.1; Enter = ROLL, Escape = close; data-testid="kick-panel"; ROLL is disabled
  while pending and not expired, and when the table has no compiled scene — with the copy of §1.1;
  seed input inputMode="numeric")
apps/client/src/features/atlas/kickDefaults.ts       (pure: defaultName(nodes, recipe),
  freshSeed() — crypto.getRandomValues signed-32, the useGenerate convention, NOT Math.random —
  and the remembered-settings codec)

MainLayoutProps.kick?: KickControls  (ONE optional field — the A6 convention)
  MainLayout → FloatingPanelsLayout (its own props interface): {isDM && kick?.open && <KickPanel …/>}
  buildDMMenuProps: openKick: props.kick?.openKick   (44 → 45 keys, re-pinned deliberately)
  AtlasTab: 🚪 KICK IN A DOOR button → onOpenKick?.()
  MobileLayout: overrides ONE callback before the bag reaches the builder — kick.openKick becomes
    () => machine.openSurface("kick") — so the tab button and the DM-screen verb both land on the
    MACHINE; kick.open is desktop-only. MobileSurfaces: surface "kick" (DM only) mounts <KickPanel/>
    in a MobileScreen; ROLL → kick() + setSurface("none"); a layout crossing mid-panel drops the
    FORM (acceptable — pending is App-level and survives).
  MobileFloatingControls: {kick?.pending && !expired && <span className="mobile-dock-saving">⏳ Kicking…</span>}
```

**Default names** (the node auto-discovers on arrival, so players see the name at once — never
"Unnamed #3"): `Dungeon`, `Tavern`, `Shop`, `Warehouse`, `House`, with a numeric suffix only on
collision against the DM's own node list (`Dungeon 2`). Editable before ROLL. Kind follows the
recipe: dungeon → `"dungeon"`, building → `"building"`. An adopted origin is named after its
document and minted as `"region"` (the tree's most generic container; `kind` cannot be edited
today — §7).

**The recipe registry (K1 introduces it with one entry; K4 adds the second):**

```ts
// apps/server/src/domains/generation/recipes.ts
export interface Recipe<P extends RecipeParams> {
  id: P["recipeId"];
  nodeKind: AtlasNodeKind;
  assertParams(params: RecipeParams): asserts params is P; // the gap assertGenerateRequest leaves
  run(seed: number, bounds: CellBounds, params: P, ctx: RecipeContext): RecipeOutput;
}
export const RECIPES: { [K in RecipeId]: Recipe<Extract<RecipeParams, { recipeId: K }>> } = {
  dungeon,
  building,
};
```

Both atlas doors dispatch through it. The live-map `map-studio-generate` door keeps calling
`dungeonRecipe` directly in this arc — `MapStudioMessageHandler.ts` is at 345 and is NOT touched
(§7 records the picker as the follow-up that extracts its generate case first). No per-recipe
floor: every atlas caller sizes bounds from `GENERATE_PRESETS` (smallest 24×20), so the 20×20
floor in `validateBounds` is never the binding constraint (§7 for smaller presets).

### 2.3 Settled by this plan — attacked in the review; do not relitigate them after

1. **One server message, not four client sends.** §2.1's rejection stands; the review found no
   atomicity hole the pre-flight does not close.
2. **G opens the panel; ROLL (Enter) fires — the key never generates by itself.** A bare keypress
   that moves the whole table is a mis-press disaster with a two-click undo; VISION's own Maya
   beat is _"She presses G. Sewer, medium, adjacent. ROLL."_ — a panel; and G, Enter is inside the
   two-input rule. The panel remembers, so the repeat kick is exactly two keys. The panel CLOSES
   on ROLL on both platforms (a dialog over the iris, the arrival and the return door is wrong).
3. **The kick pins TWO doors** — out at the party's position, back at the ENTRANCE (the arrival
   rect's boundary cell nearest the document edge, never its center, which the arriving tokens
   cover). The return door is the one-click undo and the "door you came through".
4. **Arrival zones are scene state, installed whenever a warp finds no zone and the node has one.**
   Not a synthetic zone re-derived while a zone exists (a moved zone wins forever), not a new
   bucket, not a new RoomState field. The installed zone RENDERS to every player as a staging zone
   (dashed box, the default label) — accepted, because that is exactly what a DM-placed zone
   shows, and it is what spawns a late-joining token inside the entrance instead of at `(0,0)`.
5. **"The current node" keys on the SCENE.** `projectAtlasFor` derives `currentAtlasNodeId` from
   `compiledScene.sourceDocumentId ?? liveMapDocumentId`. Semantics change: during the unbound
   interlude "you are here" stays truthful; after a publish of another document it names the map
   the party is actually on (publish is the legacy compile-onto-the-table path outside the model —
   Atlas plan §1.2 — and a kick taken there parents under the published map's node, truthfully).
   The kick, the sprites layer (`currentNodeId`), the world map and the Atlas tab all read the
   same field, so they cannot disagree with the server's parent choice. For players it stays gated
   on `discovered` (the review traced the change and found no new leak).
6. **The phone verb lives on the DM screen**, stacked below 🏗️ Edit the live map — not a dock slot
   (pinned at five, and slot five IS the DM menu), not a tool tile (costs map, off-register). On a
   phone the surface MACHINE is the panel's only open signal.
7. **The building recipe reuses `emitGeometry`** by producing a layout-shaped value with ONE-CELL
   partitions (so the walls are painted and visible); furniture is the shipped three props, placed
   by kind; this arc commissions no art and says so in the copy.
8. **Cartridge Codes mean STRUCTURAL identity:** same code → same geometry, doors, keys and
   arrival; element ids differ by `idPrefix` (the commandId). VISION's "bit-identical" is read as
   that; a code-derived idPrefix is §7. The golden fixture is the contract and is NOT regenerated
   in this arc — the `arrival` pin is a NEW assertion beside it, and the golden's `toEqual` is
   narrowed to `{cells, elements}` so the fixture stays byte-identical (the commit body says so).
9. **The live-map GENERATE tool stays dungeon-only in this arc** (§7) — its handler file has 3
   lines of headroom and its picker is a follow-up the registry makes cheap.
10. **The kick ADOPTS an unadopted origin and REFUSES from true limbo** (review T2/T4). Adoption
    mints the origin node (`region`, named after the document, discovered) in the same block so
    every kick has two doors; the alternative recorded for the owner is a one-way kick with
    honest copy and no adoption. Refusal from a table with nothing compiled is the only honest
    option: there is no document to capture the raster/drawings/tokens under, and travel-from-limbo
    keeps its recorded haunting behaviour (an Atlas-review decision this arc does not reopen).
11. **The pending timeout is a 20 s backstop, non-destructive** (review C4, refuted as a budget
    problem — a large recipe is ~9 ms and the ack ladder toasts at 3.5 s): expiry marks the pending
    kick expired, a late arrival still toasts, and a ROLL after expiry reuses the same client-minted
    ids so the server's replay guard makes the retry a no-op rather than a second dungeon.

---

## 3. Coordinate spaces and the headroom table

**Spaces, once:** tokens and staging zones are **CELLS** (a zone's `x,y` is its CENTER cell; a
token draws at `(cell + 0.5) · gridSize`, no grid offset; `placeArrivals` writes fractional cells
inside a zone); link anchors, element transforms and `RoomBounds` are **DOCUMENT px**; the stage
is world px = `cam` applied to document px, with the raster "map" sceneObject's transform between
them when a raster exists (identity for generated maps). The recipe works in `bounds`-relative
cells and emits absolute document px (`dungeonGeometry.ts:307` `function pxX(cellX: number,
bounds: CellBounds, ctx: RecipeContext)`); `RecipeOutput.arrival` is ABSOLUTE document cells. Two
conversions the arc uses, both shared and already imported server-side:
`gridCellToWorldPoint(gridSize, cell)` and `inverseTransformScenePoint(transform, point)`
(`sceneGeometry.ts:107`, `:112`). Live `gridSize` is `toLiveGridSize(document.grid.size)`
(`sceneCompiler.ts:135` — a rounded clamp; identical to the document's for generated maps, grid 50).

**Headroom (`wc -l`, measured 2026-09-02; the cliff is 348):**

| File                                                                                                          | Lines |      Headroom | Plan                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ----: | ------------: | --------------------------------------------------------------------------------------------------------------------- |
| `apps/client/src/features/map-edit/useMapEditTool.ts`                                                         |   348 |             0 | untouched                                                                                                             |
| `apps/server/src/container.ts`                                                                                |   348 |             0 | untouched                                                                                                             |
| `apps/client/src/features/map-edit/useMapEditState.ts`                                                        |   347 |             1 | untouched                                                                                                             |
| `apps/client/src/features/dm/hooks/useDMContext.ts`                                                           |   347 |             1 | untouched                                                                                                             |
| `apps/server/src/ws/handlers/MapStudioMessageHandler.ts`                                                      |   345 |             3 | **untouched in this arc** (§2.3 #9)                                                                                   |
| `apps/e2e/mobile/mobile-shell.spec.ts`                                                                        |   345 |             3 | untouched; new mobile specs are new files                                                                             |
| `apps/server/src/ws/handlers/RoomMessageHandler.ts`                                                           |   342 |             6 | untouched                                                                                                             |
| `apps/e2e/docs-screenshots.dm.ts`                                                                             |   341 |             7 | K6's walkthrough is a NEW file `docs-screenshots.atlas.ts`                                                            |
| `apps/server/src/domains/generation/dungeonGeometry.ts`                                                       |   338 |            10 | K4 extracts `geometryLattice.ts` (the px/edge helpers, ~36 lines) BEFORE its signature change                         |
| `apps/client/src/features/help/helpTopics.ts`                                                                 |   334 |            14 | K2 adds ONE ≤6-line entry; if `prettier` lands it ≥345, split the Atlas topic's entries to `helpTopicsAtlas.ts` first |
| `apps/server/src/domains/room/snapshot/recipientFilter.ts`                                                    |   333 |            15 | untouched                                                                                                             |
| `apps/server/src/domains/room/persistence/StatePersistence.ts`                                                |   345 |             3 | K0's two bonus fixes took it here — untouched by K1–K6; extract before the next line                                  |
| `apps/server/src/domains/generation/dungeonLayout.ts`                                                         |   324 |            24 | untouched by K1 (the `arrival` comes from `dungeonRecipe.ts`, 77); K4 must not grow it                                |
| `apps/server/src/middleware/validation.ts`                                                                    |   321 |            27 | +1 row (K1); watch it                                                                                                 |
| `apps/client/src/hooks/useKeyboardShortcuts.ts`                                                               |   317 |            31 | untouched — the kick is its own hook                                                                                  |
| `apps/e2e/mobile/mobile-dm.spec.ts`                                                                           |   316 |            32 | untouched; the Atlas-tab sweep fix lands in `mobile-panel-touch-floor.spec.ts` (171)                                  |
| `apps/client/src/features/dm/components/DMMenu.tsx`                                                           |   312 |            36 | +1 prop pass-through (K2)                                                                                             |
| `apps/server/src/ws/handlers/AtlasMessageHandler.ts`                                                          |   311 |            37 | +1 case (K1), the kick body lives in `atlasKick.ts`; `pushLink` extracted so the case shrinks                         |
| `apps/client/src/layouts/MobileLayout.tsx`                                                                    |   289 |            59 | +~6 (K3: the `openKick` override, two props)                                                                          |
| `apps/client/src/hooks/useServerEventHandlers.ts`                                                             |   277 |            71 | +~6 (the `onAtlasError` seam, K2)                                                                                     |
| `apps/client/src/components/layout/MobileFloatingControls.tsx`                                                |   275 |            73 | +1 chip line (K3) — NOT near the cap (the handoff's list was stale)                                                   |
| `apps/server/src/ws/handlers/sceneTravel.ts`                                                                  |   265 |            83 | +~16 (K1: the option, the three-phase split, the two installs)                                                        |
| `apps/server/src/domains/room/scene/sceneSuspend.ts`                                                          |   255 |            93 | ±0 (K1 — the installs live in sceneTravel)                                                                            |
| `apps/e2e/atlas-journey.smoke.spec.ts`                                                                        |   236 |           112 | untouched; the kick journey is a NEW spec                                                                             |
| `apps/client/src/layouts/FloatingPanelsLayout.tsx`                                                            |   220 |           128 | +~4 (K2: the panel mount; its own props interface at `:50`)                                                           |
| `apps/client/src/layouts/mobile/MobileSurfaces.tsx`                                                           |   208 |           140 | +~14 (K3: the verb + the surface mount)                                                                               |
| `apps/e2e/mobile/mobile.helpers.ts`                                                                           |   207 |           141 | +~20 (K3: `undersizedControls` moves here from the touch-floor spec — it counts)                                      |
| `apps/server/src/ws/handlers/atlasGenerate.ts`                                                                |   189 |           159 | K1 splits `cashNode` out (`atlasCash.ts`) so both doors share it                                                      |
| `apps/client/src/features/atlas/AtlasTab.tsx`                                                                 |   141 |           207 | +1 button (K2)                                                                                                        |
| `apps/client/src/features/atlas/AtlasLinksLayer.tsx`                                                          |   144 |           204 | K0                                                                                                                    |
| `apps/client/src/features/atlas/WorldMapPanel.tsx`                                                            |   106 |           242 | K0 L4 (the empty state is shared by both platforms — fix it here)                                                     |
| `MapBoard.tsx` 979 / `App.tsx` 903 / `MainLayoutProps.ts` 453 / `MainLayout.tsx` 432 / `messageRouter.ts` 779 |     — | grandfathered | small additions are free at the guard (verify each path is in `structure-baseline.json` first); extract nothing here  |

---

## 4. Arc invariants (numbered; every slice cites the ones it proves)

- **4.1 Through `travelToDocument`, never around it.** The kick's travel is
  `handleAtlasTravel`; any new way to change the map on the table that bypasses `sceneTravel.ts`
  is the next review's BLOCKER (the handoff's exact words).
- **4.2 One synchronous block, one broadcast, one frame per recipient.** `atlasKick.ts` is
  await-free; the contract test asserts `toHaveLength(1)` on both sockets, after `flush()` — the
  DM additionally receives the generate core's `map-studio-document` frame, which is not a snapshot.
- **4.3 Validate-then-persist across the WHOLE composition.** Pre-flight every cap before any
  mutation; run the recipe pure; persist the document; apply with delete-on-failure; only then
  push the nodes and links. A failure after pre-flight (the recipe or the apply) leaves state
  byte-identical (the test fingerprints `JSON.stringify(state)` before and after); nothing after
  the pushes can fail by construction.
- **4.4 Replay-idempotent on client-minted ids.** `nodeId` exists → NO_OP (+ document
  re-broadcast). The same commandId three times = one dungeon, two links, one travel. A ROLL after
  a timeout reuses the same ids for the same reason.
- **4.5 The origin is the SCENE's node** — `compiledScene.sourceDocumentId` only; no
  binding fallback (K1's review corrected the formula) — adopted when the document has none, refused when there is no
  document — and `projectAtlasFor` derives `currentAtlasNodeId` the same way. The contract
  suite's orphan-row block (`sceneTravel.contract.test.ts:524`) is extended, never bypassed: a
  kick during the unbound interlude parents under the scene's node and pins its door on the
  scene's map.
- **4.6 Gate first, constant reason; domain failures on `atlas-error` carrying the child
  `nodeId`.** A non-DM kick is nacked on the ATTACKER's socket with `ATLAS_DM_REQUIRED` and state
  untouched; the fixture REGISTERS the attacker in `players`, `uidToWs` AND `clients`
  (`atlasGraph.contract.test.ts:123-137`) or the leak has nowhere to land.
- **4.7 The `arrival` field, the `recipe` (seed, size, kind), and every `sceneStates` byte never
  reach a player ON AN ATLAS NODE or on any frame.** The projection is a whitelist; the tests
  assert on KEYS (`"arrival" in node === false`, exact key sets) and on ≥9-digit / high-entropy
  SENTINELS (the seed, the names) through the structural walk (`leakSentinels.ts:27`
  `sentinelHitsIn`) — with the DM POSITIVE CONTROL (`sentinelHits(dmWs, …).length > 0`) so a zero
  is evidence, not vacuity. Value substrings never (CI #828), and `"size"` never as a raw-bytes
  check (`grid.size` rides every frame). The arrival RECTANGLE, once installed, ships to everyone
  as `playerStagingZone` by design (§2.3 #4).
- **4.8 The seed rides the message.** Never minted server-side; the client's `freshSeed()` is
  the `useGenerate` crypto convention. Same seed + request + size → the same geometry, twice.
- **4.9 Anchors by the TOKEN convention.** Out: the traveler centroid → `gridCellToWorldPoint`
  → inverse map transform → the shared `pushLink` clamp; back: the arrival rect's boundary cell
  nearest the document edge on the new map. Zero travelers → scene center, never a refusal.
- **4.10 Arrival zones are scene state, installed door-independently.** Whenever a WARP finds the
  scene without a zone and the node has an `arrival`, the entrance is installed (`structuredClone`);
  a zone that exists — captured, moved, or hand-placed — wins; the START LIVE MAP row drops the
  outgoing table's zone before installing (only when it warps — set-live stays an identity).
- **4.11 Recipes: fixed rolls before conditionals; fresh XOR salts per recipe** (`0x6a09e667`
  and `0x85ebca6b` are the dungeon's, `0x1f123bb5` is reserved — `dungeonRecipe.ts:20-24`);
  kind-grouped emissions SHUFFLE ids (`shuffleIds`, `:70` — sequential ordinals were a kind
  oracle; K4 makes it shared); paint (theme / floor family) never reaches a roll; every emitted
  wall run has a wall-painted cell adjacent to it (walls are visible or they are bugs).
- **4.12 The golden fixture is a contract, not a snapshot.** `dungeon-seed1-24x20-stone.json`
  is never regenerated in this arc; the test's `toEqual` narrows to `{cells, elements}` and the
  `arrival` gets its own literal pin; each new recipe ships its own golden with a guard-the-guard
  assertion (`dungeonGeometry.test.ts:338`).
- **4.13 LOC: extract before add** (§3). New specs are new files. `.spec.` counts; so do helpers.
- **4.14 Pinned counts are re-pinned deliberately, with the reason in the commit:** 44 → 45 bag
  keys; everything else unchanged by construction (assert by running the pins).
- **4.15 Mobile in the same slice, measured.** Both orientations; the coarse-pointer 44px rule
  reaches new controls only inside `[data-mobile-surface]` (`herobyte.css:1358`); any Konva
  shape combining fill + stroke + opacity < 1 sets `perfectDrawEnabled={false}`; pending state
  lives at App level so a layout crossing (`mobile-map-edit-resize.spec.ts:12`) cannot drop it;
  on a phone the surface machine is the panel's only open signal.
- **4.16 No new ServerMessage.** The three hand-lists are byte-identical at closure (grep).
- **4.17 The hotkey's guard is the precedent for every bare letter after it:** `isEditableTarget`,
  no modifiers, no `event.repeat`, DM-only, inert while ANY tool holds the axis
  (`activeTool !== null`), and it opens a panel — it never mutates state by itself.
- **4.18 Shared runtime values live in sub-modules; boot `pnpm dev` after adding one.**

---

## 5. Slices

### K0 🔴 — The mobile lens's four fixes (before the arc; four commits)

**Goal:** close §0.1's confirmed defects in the shipped Atlas surface, each in its own commit,
each sabotage-proven, so the kick's return door inherits a sprite that behaves.

**Context capsule:**

- `apps/client/src/features/map/components/AtlasLinksLayer.tsx:82` (`canTravel`), `:130-141`
  (the hit circle: `listening={true}`, `onClick`/`onTap={handleActivate}`, `radius={BADGE_RADIUS

* 4}`), `:85` (`event.cancelBubble = true;`).

- `apps/client/src/features/map/components/DoorsLayer.tsx:149-154` (`listening={!selectArmed}`
  and its comment — the door "must yield the press to the stage while either is armed") and
  `apps/client/src/ui/MapBoard.tsx:778-781` (`selectArmed` = `mapEditMode && (select |
eyedropper)`), `:787-803` (the links layer mount; `onTravel={dmView ? handleLinkTravel :
undefined}` at `:801`).
- `apps/client/src/ui/MapBoard.tsx:717-720` (the two-finger early return while the aim is
  armed), `apps/client/src/hooks/useStageEventRouter.ts:95-102` (`shouldPan` — the seven-term
  negation `!alignmentMode && !linkAimMode && !pointerMode && !measureMode && !drawMode &&
!selectMode && !mapEditMode`: the repo's ONE statement of "a tool owns the press"), `:117-121`
  (`if (linkAimMode) { handleLinkAimClick(); return; }`), `apps/client/src/hooks/useCamera.ts:171`
  (`if (touches.length === 1 && shouldPan)`), `:176-184` (the pinch branch),
  `apps/client/src/hooks/useTouchGestureRouter.ts:56-58` (Konva's `tap` is synthesised from the
  touch events — no slop; §2.1).
- `apps/client/src/features/atlas/WorldMapPanel.tsx:38-46` (the shared empty state — "The map is
  blank… for now." — rendered by BOTH the desktop window and the phone screen) and
  `apps/client/src/layouts/mobile/MobileSurfaces.tsx:176-182` (the atlas surface mount; the Props
  screen's mount condition at `:164` `props.snapshot?.playerPropsEnabled` never renders without
  its snapshot field — the atlas surface has no condition, and must not simply unmount either, or
  the machine latches on `"atlas"` with nothing on screen).
- Tests to extend: `AtlasLinksLayer.test.tsx` (renders at 7 sites, no tool prop yet),
  `DoorsLayer` tests, `useStageEventRouter` tests, `WorldMapPanel` render tests.

**Changes (one commit each):**

1. **L1** — `AtlasLinksLayer` gains `sceneInputArmed: boolean`, fed from MapBoard as the
   NEGATION of `shouldPan`'s exact term list (`mapEditMode || linkAimMode || alignmentMode ||
pointerMode || measureMode || drawMode || selectMode` — export the predicate from the router
   rather than hand-copy it); the hit circle renders `listening={!sceneInputArmed}`. Tests: one
   case PER TERM (seven) → the hit shape does not listen; with none armed it does (prove it can
   PASS); a sprite click with nothing armed still travels.
2. **L2** — DoorsLayer yields during the aim: `listening={!selectArmed && !linkAimMode}` (plumb
   `linkAimMode`). Test: a link-aim click on a door's hit area reaches the Stage's aim capture
   and does NOT toggle the door; a door click with the aim disarmed still toggles.
3. **L3** — the aim no longer freezes the phone camera, PINCH ONLY: drop the two-finger early
   return (`MapBoard.tsx:717-720`) so `useCamera`'s pinch branch runs and the aim survives; LEAVE
   `!linkAimMode` in `shouldPan` for BOTH input paths — a one-finger drag while aimed still does
   not pan, because Konva would fire `tap` at the finger-lift and place a link (§2.1). Tests:
   pinch while aimed → zoom, aim still armed; a one-finger DRAG while aimed → no link, no pan
   (the guard); tap → link placed. Browser-verify under CDP: a ≥100 px drag while aimed places
   nothing; the Done-when gains that line.
4. **L4** — the SHARED `WorldMapPanel` shows a reconnecting state (or keeps the last discovered
   list) while the snapshot is null — never the first-run empty copy, on either platform — and
   the phone surface stays MOUNTED. Test: snapshot null after a prior list → no empty-state copy,
   the screen still mounted; the healthy path still renders the list (prove it can PASS).

**Done when:** gate green; sabotage every rule red (L1's seven cases count as seven); on a phone
(CDP): a brush tap on a badge paints and does NOT prompt; an aim tap on a door places the link; a
pinch while aimed zooms; a drag while aimed places nothing; a reconnect keeps the world map's
rows. `mobile-atlas.spec.ts` gains the sprite-tap leg.
**Traps:** the second-finger-cancel semantics belong to map-edit DRAGS (`useMapEditCancel`), not
to a one-shot aim — don't remove them there; `useStageEventRouter.ts` lives in `hooks/`, not
`features/map/`. **Escalate if:** the pinch path needs `useTouchGestureRouter` to learn a new
tool kind — that is a design change; report it.

> **K0 SHIPPED** (2026-09-02, four fix commits + two bonus fixes, each behind the full ladder
> and a sabotage pass — the ladder moved shared 424 → 424, server 2262 → 2270, client 5488 →
> 5500 (+4 skipped), e2e 169 → 170/3/0 of 173 with the new spec; no flakes). The browser proof
> is `apps/e2e/mobile/mobile-atlas-aim.spec.ts` under Chromium touch emulation (CDP): a 120 px
> drag under the aim places nothing and moves the camera, a pinch places nothing and zooms, the
> banner survives both, a tap then places; an aimed tap on a door places instead of swinging; a
> tap on a badge with Draw armed opens no travel confirm. **L1 `659c65f0`** — the badge's hit
> circle listens only when NO tool owns the press: `isSceneInputArmed`, the router's seven-term
> predicate, exported ONCE and fed as a REQUIRED prop (dropping the wiring is a TS2741).
> **L2 `1cf4a424`** — doors yield to the link aim (`linkAimArmed`, required). **L3
> `1be8913d`** — a finger pans and pinches under the aim and only a tap places. **Deviation from
> Rev 2, recorded:** the plan said pinch-only because Konva's tap has no slop, but a pinch ENDS
> in a Stage tap too (ListenClick is cleared only after the first finger-lift fires it), so the
> fix had to be a guard either way — `useAimTouchGuard`, a touchstart/move memory the capture
> consumes once — and with the lift guarded, one-finger touch pan is safe and restores the
> DM's ability to bring the target into view (`touchShouldPan = shouldPan || linkAimMode`, touch
> path only; the mouse path keeps `!linkAimMode` because a mouse drag ends in a click). The
> second-finger cancel and its `onLinkAimCancel`/`cancelLinkAim` chain (six files) are deleted;
> a phone DM abandons an aim by picking another tool. **L4 `52d83e50`** — the SHARED
> WorldMapPanel says "Reconnecting…" on a null snapshot (both platforms; the surface stays
> mounted). **Two bugs the gates exposed, fixed in their own commits (HANDOFF §8):**
> `204e7e37` — the state-file rename retries Windows-transient EPERM/EBUSY (`atomicRename.ts`;
> a contract test asserting a clean error log had reddened a full ladder on it), and
> `58cf6ad5` — the tmp-file counter is PROCESS-wide (per-instance counters restarted at 1, so
> two instances on one file renamed the SAME tmp path and the loser logged ENOENT: 234 "Failed to
> save state" lines per ladder → 0). Traps: a Bash heredoc past ~150 lines is cut off by the tool
> and bash dies at parse time (no edit runs — use the Write tool + short scripts); TRAVEL on the
> phone leaves the DM screen up and it COVERS the dock (close it through its own ✕; an
> `openAtlasChip` helper must skip the dock when the dialog is already visible); the placer's
> target select starts on "Pick a node…" with AIM disabled; `StatePersistence.ts` is at 345 of
> 348 — the next line there needs an extraction.

---

### K1 🔴 — `atlas-kick`, the server composition (the keystone)

**Goal:** one message adopts or resolves the origin, mints the child under it, cashes it, pins two
doors, and travels — proven by contract tests before any UI exists. Plus the pre-existing bugs the
recon and the review found on this path, each its own commit FIRST: (a) provenance records `size`;
(b) the limbo-zone leak; (c) compile-before-capture (the three-phase split); (d) the stale
`default:` comment in the atlas switch (with the case); (e) the node name is validated trimmed but
stored untrimmed (`atlasValidators.ts` trims for length; `run()` discards the parsed value) — the
handler trims.

**Context capsule:**

- `apps/server/src/ws/handlers/sceneTravel.ts:45-52` (`SceneTravelOptions` — gains
  `firstVisitStagingZone?`), `:59-134` (`travelToDocument`: the re-attach row `:80`, the START
  LIVE MAP row `:92-99` — `:94` `state.fogEnabled = options.firstVisitFogEnabled;`, `:96`
  `placeArrivals(state, travelers, document, options.rng);` — the capture `:105-115`, the
  compile `:117`, the consume `:126`, the second `placeArrivals` `:131-133`), `:188-250`
  (`handleAtlasTravel` — `:213` the already-there row, `:242` `firstVisitFogEnabled: node.recipe
? true : state.fogEnabled,`), `:253-265` (`compileOnto` — split into the pure compile and the
  install).
- `apps/server/src/domains/room/scene/sceneSuspend.ts:34-41` (`isTravelingToken`), `:72`
  (capture reads door runtime from `state.compiledScene` — the install must come AFTER),
  `:197-215` (the first-visit branch — `:212` `state.playerStagingZone = undefined;` stays; the
  install lives in sceneTravel before `placeArrivals`), `:231-255` (`placeArrivals`, unchanged;
  `:245-246` fractional cells).
- `apps/server/src/ws/handlers/atlasGenerate.ts:36-40` (`GENERATE_PRESETS`), `:54-63` (the
  message shape — becomes `recipe: GenerateRequest`), `:68-189` (`handleAtlasGenerateNode` —
  the core `:110-183` extracts to `cashNode` in NEW `atlasCash.ts`; `:176-182` the provenance
  write gains `size` and `arrival`).
- `apps/server/src/ws/handlers/AtlasMessageHandler.ts:34` (`ATLAS_DM_REQUIRED`), `:60-65` (the
  family gate), `:68-110` (the switch — `+ case "atlas-kick"`; the `default:` comment at
  `:107-108` is stale: "Future atlas-\* types (generate, travel)"), `:113-121` (`error` —
  reuse), `:123-148` (`createNode` — the cap and parent checks the pre-flight mirrors), `:263-295`
  (`createLink` — extract its body to a `pushLink` core the kick calls too: the anchor clamp
  `:286-289`, the endpoint check `:276`, the origin-has-a-map check `:280`).
- `apps/server/src/ws/handlers/MapStudioMessageHandler.ts:250` (`map-studio-publish` compiles any
  document onto the table — the publish-burn row's cause; the file is NOT edited).
- `apps/server/src/domains/room/snapshot/atlasProjection.ts:35-37` (the current-node
  derivation — becomes scene-first), `:54-59` (the whitelist constructor — `arrival` and the
  widened `recipe` are simply absent), `:89` (the player gate on `discovered` — unchanged).
- `apps/server/src/domains/generation/dungeonRecipe.ts:26-51` (returns `{cells, elements}`;
  `layout.rooms[0]` is the arrival), `types.ts:44-47` (`RecipeOutput` + `arrival?`),
  `recipeContext.ts:53` (`assertGenerateRequest` — the registry's `assertParams` replaces the
  ignored `_params`), NEW `recipes.ts` (§2.2).
- `apps/server/src/middleware/validators/atlasValidators.ts:85-97` (`generateNodeSchema` —
  becomes a `recipe` discriminated union; top level NOT `.strict()` because the ack layer stamps
  `commandId`, nested objects strict — `:6-7`), `:88` (the commandId ≤120 bound — the kick
  schema carries it), `:134-141` (the travel pair — the kick's validator twin),
  `apps/server/src/middleware/validation.ts:231-238` (the ATLAS block of the exhaustive table —
  a missing row is a `tsc` error), `packages/shared/src/index.ts:985-1013` (the atlas
  ClientMessage block — the ninth member), `packages/shared/src/atlas.ts:47-52` (`recipe`),
  `:131` (`playerStagingZone` on SceneState — the zone TYPE to reuse for `arrival`).
- Persistence: `apps/server/src/middleware/validators/sessionValidators.ts:82-96`
  (`SNAPSHOT_LIMITS` — unchanged: no new collection; there is NO atlas node schema in this file
  to widen — nodes reach state through `apps/server/src/domains/room/persistence/atlasState.ts:75`
  `recordArray<AtlasNode>`, an `isRecord` filter, so pre-K1 nodes load untouched and nothing
  validates the new fields on load — the pre-existing posture, stated),
  `apps/server/src/ws/__tests__/sessionRoundTrip.contract.test.ts:294-313` (the fixture) and
  `:376-397` (the SPOT-CHECK block — add explicit `recipe.size` and `arrival` checks beside `:395`;
  the top-level sweep at `:361` cannot see nested fields).
- Templates: `apps/server/src/ws/__tests__/atlasGraph.contract.test.ts` (13-arg router
  `:140-154`, `fakeSocket`/`messagesOf`/`latestSnapshot`, sentinels `:47-49`, the attacker test
  `:214-232`, the positive controls `:328-329`, the provenance `toEqual` at `:485-489`),
  `sceneTravel.contract.test.ts` (`flush()` `:52`, the drain-before-clear trap `:467-469`,
  one-frame `:267-268`, the orphan-row block `:524`, the limbo row `:643`, the adopt flow `:656`,
  `FIELD_BUCKETS` `:688-724`), `atlasProjection.test.ts:133-144` (the existing player-gate test
  runs with `compiledScene: undefined` — the new tests must SET it).
- Geometry: `packages/shared/src/sceneGeometry.ts:107-109` (`gridCellToWorldPoint`), `:112`
  (`inverseTransformScenePoint`), `apps/server/src/domains/room/scene/visionFilter.ts:41-43`
  (the map-transform lookup to copy), `apps/server/src/domains/room/scene/SceneGraphBuilder.ts:51`
  (the zone mirrored into the scene graph — the player-visible render the test pins).

**Changes:**

1. Bug (a): `cashNode` records `size` in provenance; the `recipes.ts` types of §2.2 (`size`
   ADDED per type); the five fixtures compile untouched; the `atlasGraph` provenance `toEqual`
   (`:485-489`) extends; a spot-check pins the round trip.
2. Bug (b): the START LIVE MAP branch, when it WARPS, drops the outgoing table's zone
   (`state.playerStagingZone = undefined`) before the install; contract test: limbo table with
   a zone at (12,14) → travel to a linked map → the party lands at the document center, not
   (12,14); set-live from the same table → zone untouched (prove the identity).
3. Bug (c): `travelToDocument` compiles the destination FIRST (pure), captures SECOND, installs
   THIRD; tests: a `compileScene` that throws leaves `sceneStates` and `compiledScene` untouched;
   the OUTGOING scene's `doorStates` survive the reorder (an open door on A is captured open).
4. Bug (e): the handler stores the trimmed name; test: `"  Cellar  "` → `"Cellar"` on the node.
5. `RecipeOutput.arrival`; `dungeonRecipe` reports its first room as a center-anchored zone; the
   golden test narrows to `{cells, elements}` + a literal `arrival` pin (§4.12).
6. `recipes.ts` registry (one entry; no floor), `GenerateRequest` in shared `recipes.ts` (types +
   the `RECIPE_IDS` const in the sub-module; barrel re-export; boot `pnpm dev`);
   `atlas-generate-node` takes `recipe`; `AtlasNode.arrival`; the projection's scene-first
   current node.
7. The door-independent install (§2.2's arrival diagram) before BOTH `placeArrivals` calls;
   `handleAtlasTravel` passes `firstVisitStagingZone: node.arrival`.
8. `pushLink` extracted from `createLink`; NEW `atlasKick.ts` per §2.2 (adoption, refusal from
   limbo, pre-flight, anchors, cash, pushes, travel); validator (with the commandId bound) + table
   row + shared union + the switch case (and the comment fix, (d)).
9. Client-side type plumbing only where `tsc` demands it (`useAtlasActions` `generateNode` takes
   `recipe`) — the UI is K2.

**Tests (the heart of the slice — through the REAL router, per §4.6's fixture):** the happy path
on an ADOPTED origin (create → set-live → create-node → `atlas-link-map` → travel, the `:656`
flow): the child under it with `parentId`; document with the preset's dimensions; provenance with
`size`; `arrival` inside the document and inside a floor cell; TWO links — out at the traveler
centroid in doc px (assert the exact px from known cells: tokens at (4,4) and (6,6) on grid 50 →
(275, 275)), back at the arrival rect's edge cell nearest the map edge; the party inside the
arrival zone (containment with a tolerance — cells are fractional; rng injected); fog on;
discovered; `currentAtlasNodeId` = the child; the player's frame carries the `staging-zone` scene
object (the accepted render); exactly ONE snapshot per recipient plus the DM's
`map-studio-document` frame; the UNADOPTED origin (set-live only, no node) → the origin node is
minted `region`, named after the document, discovered, and both links pin; replay (same message
×3 → one document, one adopted origin, two links, one travel, `NO_OP` on 2 and 3, still one frame
each); pre-flight (nodes at 64 / 63-with-adoption, links at 255, documents at 64, missing origin
document → `atlas-error` with the child `nodeId`, state fingerprint unchanged); recipe/apply
failure → nothing persisted, no node, no links; true limbo (no compiled scene) → `atlas-error`,
state untouched; the unbound interlude (set-live null then kick → parent = the scene's node, door
on the scene's map — the orphan-row block extended); the PUBLISH-BURN row (generate G under a
node, publish G, travel away, travel to G's node → the party inside `arrival`; a DM-moved zone
survives the same dance); zero travelers → anchor at the scene center (on a bound origin); a
raster map with a moved "map" transform → the anchor goes through the inverse transform (assert
via the sprite's doc point); non-DM → constant reason on the attacker's socket, state untouched;
secrecy — sentinel seed (≥9 digits) and sentinel names, `"arrival"`/`"recipe"`/`"sceneStates"`
absent by KEY on every player frame during the whole dance, with the DM positive control; the
projection unit tests for the scene-first current node BY ROLE with `compiledScene.sourceDocumentId`
SET (unbound interlude → still the node for the DM, and for a player only when discovered;
publish-of-another → that map's node; nothing on the table → undefined); `FIELD_BUCKETS`
untouched (no RoomState field — assert by running it); the spot-checks for `arrival` and
`recipe.size`; the validators (`atlasValidation.test.ts` gains the kick variations, the
commandId bound and the strict-params rejection).

**Done when:** gate green; sabotage every rule (≥18: each cap, the replay guard, the order —
push-before-persist goes red, both anchors, the sticky install, the publish-burn row, the
adoption, the limbo refusal, the scene-first origin, the projection by role, the size, the trim,
the limbo zone, the three-phase compile, the door-state survival, the attacker socket); console
harness (`window.__HERO_BYTE_E2E__.sendMessage({ t: "atlas-kick", … })`) on the dev table with a
player tab open: the party lands in a room, both doors render, the player's world map gains the
child, the return door travels back and the origin resumes.
**Traps:** `handleAtlasTravel`'s already-there row would NO_OP a kick whose node is somehow
already live — unreachable after the replay guard, but assert it; the 16 ms debounce — `flush()`
25 ms before reading frames, and DRAIN before `mockClear` (`:467-469`); `structuredClone` the
captured zone AND the installed one; `atlasValidators` top-level must not be `.strict()`; the
projection change moves `currentAtlasNodeId` for the journey spec's expectations — re-read them,
they hold (travel binds); `Omit<GenerateRequest, "size">` would collapse the discriminant — use
the split types of §2.2.
**Escalate if:** the composition cannot stay one synchronous block (some step wants an await —
report, do not thread a promise); or `arrival` wants to live anywhere but the node.

**🔎 SENIOR REVIEW GATE:** state-machine lens (every §2.2 step vs every transition-table row of
the Atlas plan, replay, pre-flight, adoption), privacy lens (`arrival`/`recipe`/frames on the
attacker's socket) — lens-sized workflows, ≤14 agents each.

> **K1 SHIPPED** (2026-09-03, five commits on `dev`, each behind the full ladder and a sabotage
> pass). The bug commits first: **(a) `c1c946e4`** provenance records `size` through the shared
> `recipes.ts` vocabulary (GenerateRequest / RecipeProvenance, `size` added per type; RECIPE_IDS a
> sub-module value; the five fixtures compiled untouched and a type pin proves the optionality);
> **(b) `23debe85`** a warp from limbo drops the limbo table's zone; **(c) `3e41af54`** travel
> compiles the destination FIRST (pure), captures SECOND, installs THIRD; **(e) `e38b6576`** node
> names stored trimmed; and **the composition `116d6443`** — `atlasKick.ts` (steps 0–7 of §2.2),
> `atlasCash.ts` (the cash core both doors share), `atlasLink.ts` (`pushLink`, the door core),
> the recipe registry, `RecipeOutput.arrival` → `AtlasNode.arrival` → the door-independent sticky
> install in `travelToDocument`, the scene-first `currentAtlasNodeId`, the `recipe: GenerateRequest`
> wire shape on both atlas doors, and the stale `default:` comment (d). **Tests:** the kick contract
> suite (`atlasKick.contract.test.ts`, through the real router via the new shared
> `routerHarness.ts`) covers the happy path on an adopted origin (out-door at the exact centroid,
> return door on the entrance edge, party inside the zone, one frame per recipient, secrecy by KEY
> with the DM control), adoption, replay ×3, every pre-flight cap, the registry refusal, true
> limbo, the unbound interlude, scene-first after a publish, the publish-burn row, the moved zone,
> zero travelers, the raster transform, and the non-DM gate; plus registry, entrance-anchor,
> projection-by-role and validator units, the sticky-install travel rows, and the golden narrowed
> to `{cells, elements}` with the arrival pinned as a literal. **Sabotage: 29/29 red.**
> **Console harness on the dev table** (browser, DM + player tabs): the kick from an UNBOUND
> interlude adopted the origin, landed the whole party in the arrival room, fog on, both doors
> rendered (the return sprite on the room's south edge), the player's world map gained the child
> with whitelist key sets, and the return-door click resumed the origin at its center. **Traps:**
> the map-studio store CLONES on read — poison a document through a spy on the service's `get`,
> never through the object it hands back; `mockRestore()` clears a spy's recorded calls, so read
> the spy BEFORE a `finally` restores it; a second tab in the same browser pane shares the
> identity and REPLACES the first socket (4002) — pin it with `?sessionUid=` via `location.assign`
> (the navigate tool strips queries); a dev table whose compiled scene's document is gone from
> the map store refuses the kick with "missing from the store" exactly as pre-flight promises.
> **Flake register:** the zero-height mobile canvas at table join (observed ONCE on K1-a's gate,
> 8/8 isolated repeats green, ~19 prior full runs clean; a spin-off task carries it), and ONE
> `page.goto` `ERR_CONNECTION_FAILED` to the vite preview on K1-main's gate (`map-navigation` pan
> spec, 344 ms, the first such line in ~90 gate logs; 6/6 isolated repeats green; artifacts copied
> aside). Neither reproduces; both are registered, not fixed.
> `sceneTravel.ts` is at 326, `AtlasMessageHandler.ts` at 311.

---

### K2 🟡 — G: the keystroke, the panel, the arrival (desktop)

**Goal:** the DM's experience of §1.1 on desktop. Plus two pre-existing hotkey bugs, own commits
first: the bare `r` without `isEditableTarget` (`useMapEditPlacement.ts:112`) and
`useKeyboardNavigation.ts:27`'s hand-rolled editable check → the shared helper.

**Context capsule:**

- `apps/client/src/ui/App.tsx:377` (the `useServerEventHandlers({…})` call — the `onAtlasError`
  option is supplied HERE, 250 lines above the hook, through a ref the hook fills), `:629-634`
  (the `useAtlasLinkAim` mount — mount `useKickedInDoor` right after it, before
  `useKeyboardShortcuts` at `:637`; inputs in scope: `snapshot`, `isDM`, `sendMessage`,
  `activeTool`, the toast object).
- `apps/client/src/features/atlas/useAtlasLinkAim.ts` (the App-level atlas-hook shape: refs for
  one-shot state, the ESC listener guarded by `isEditableTarget` `:121-129`, the scene-change
  disarm `:113-117`), `apps/client/src/utils/isEditableTarget.ts:8-12`.
- `apps/client/src/hooks/useServerEventHandlers.ts:254-258` (the atlas-error toast — add an
  `onAtlasError?(message)` option called beside it; single-subscriber rule
  `useWebSocket.ts:206`).
- `apps/client/src/features/atlas/AtlasGeneratePanel.tsx` (the dial idiom + testids; the seed
  minting to REPLACE — `:13-15` uses `Math.random`; use `useGenerate.ts:193-198`'s
  `crypto.getRandomValues` signed-32 convention), `apps/client/src/features/map-edit/GeneratePanel.tsx:8-9`
  (why the seed is shown and ⟳ is explicit), `:116` (`{busy ? "⏳ GENERATING…" : "🎲 GENERATE"}`).
- `apps/client/src/features/atlas/WorldMapPanel.tsx:79-87` (the self-launching fixed panel
  idiom), `apps/client/src/layouts/FloatingPanelsLayout.tsx:50` (`FloatingPanelsLayoutProps` —
  its OWN interface; add `kick?`) and `:184` (`{!isDM && <WorldMapPanel snapshot={snapshot} />}`
  — the KickPanel mounts beside it, `isDM && kick?.open`), `apps/client/src/layouts/MainLayout.tsx`
  (forwards `kick` to the floating layout — baselined at 432; verify in the baseline before
  growing it), the toast API (`useToast` — `dismiss(id)` for the sticky pending toast; if no id
  is returned, add one — its own small change with a test).
- `apps/client/src/layouts/props/MainLayoutProps.ts:368-…` (the A6 optional-prop block — add
  `kick?: KickControls`), `apps/client/src/features/dm/buildDMMenuProps.ts:105-111` (add
  `openKick: props.kick?.openKick` — the exhaustive key test at `buildDMMenuProps.test.ts:93-139`
  re-pins 44 → 45), `DMMenu.tsx:186-196` (the AtlasTab mount — pass `onOpenKick`),
  `AtlasTab.tsx:76-83` (the create-node row — the 🚪 button sits beside it).
- `apps/client/src/hooks/useCameraCommands.ts:88-113` (arrival already focuses the zone center —
  K1's `arrival` makes it land on the party for free) and
  `apps/client/src/features/map/MapTransitionOverlay.tsx:44-51` (the iris already fires on
  A→B). The kick adds only the toasts.
- `apps/client/src/features/help/helpTopics.ts:62-93` (the Atlas topic — ONE new entry;
  `help-panel.spec.ts:76` and `mobile-help.spec.ts:104` stay at 9 / 14 — assert by running them).
- Hotkey precedents: `useKeyboardShortcuts.ts:167` (`if (isEditableTarget(e.target)) return;`),
  `:302` (window keydown, bubble), `useToolMode.ts:133`; the two capture-phase Escape handlers
  (`MapEditQuickWheel.tsx:71`, `useMapEditCancel.ts:81`) never swallow a letter.
- Z-order: the S8 stacking-context lesson (HANDOFF §6) — the panel is `position: fixed` OUTSIDE
  the header, like `WorldMapPanel`; measure that it paints above the entities panel.

**Changes:** `useKickedInDoor.ts`, `KickPanel.tsx`, `kickDefaults.ts` per §2.2; the
`MainLayoutProps.kick` prop, forwarded through `MainLayout` to `FloatingPanelsLayout`; the
FloatingPanelsLayout mount; the Atlas-tab button through the bag (45 keys); the `onAtlasError`
seam (ref); the panel closes on ROLL; the sticky pending toast + the arrival toast; the
non-destructive expiry with id reuse; the help entry; the remembered settings (localStorage,
try/catch, versioned key); the two hotkey bug fixes (own commits).

**Tests:** hook — G opens (not with Ctrl/Meta/Alt, not on `repeat`, not when a field is focused,
not for a player, not while ANY tool is on the axis — one case per tool); Escape closes; `kick()`
sends exactly one `atlas-kick` with five distinct client-minted ids and the remembered settings,
and closes the panel; pending clears on `currentAtlasNodeId === nodeId` and toasts (also AFTER
expiry); clears on a matching `atlas-error` (nodeId match — a foreign error does not clear it);
the 20 s expiry toasts, marks expired, keeps the ids, and a second `kick()` reuses them; settings
survive a remount; `defaultName` (collision suffix; kind label per recipe); `freshSeed` is an
int32; ROLL disabled with no compiled scene (the §1.1 copy). Panel — render states,
Enter/Escape, disabled while pending, `inputMode="numeric"` on the seed, accessible names. Bag —
the 45-key pin re-pinned WITH the reason; deleting the mapping line goes red (the M4b sentinel
idiom). Hotkey fixes — `r` in an input no longer rotates; Delete in a `<select>` no longer
deletes. **Prove the arrival detection can PASS** (a healthy snapshot sequence clears pending) and
not only fire.

**Done when:** gate green; sabotage every rule; browser: G → panel → ROLL on the dev table with a
player tab — the panel closes, the pending toast, the iris, the camera on the party in a room, the
arrival toast, both sprites, the world map row on the player; the return door click → confirm →
the old scene resumes; the Atlas-tab button opens the same panel; typing G in the chat box does
nothing; G with the alignment wizard armed does nothing.
**Traps:** `helpTopics.ts` at 334 (§3); the e2e journey's `dm.on("dialog")` acceptor would
auto-accept any NEW confirm — the kick adds none; `registerServerEventHandler` is
single-subscriber — never register a second handler for `atlas-error`; the panel must not be a
child of the fixed header.
**Escalate if:** the panel needs data the snapshot + the DM's node list do not carry.

> **K2 SHIPPED** (2026-09-06, three commits on `dev`, each behind the full ladder and a sabotage
> pass). The two pre-existing hotkey bugs first: **`9fe080b4`** — the placement tools' bare `r`
> turned the pending stamp while the DM typed an "r" into any field (every other window-level
> single-key shortcut asks `isEditableTarget`; this one never did); **`35f1eff5`** —
> `useKeyboardNavigation` rolled its own typing-surface check covering only input and textarea, so
> Delete inside a `<select>` deleted the selected drawing. Then **`de2c3102`**: `useKickedInDoor`
> (App-level beside `useAtlasLinkAim`, so the pending kick survives the layout swap), `KickPanel`
> (the fields of §1.1, Enter rolls, Escape closes), `kickDefaults` (the collision-suffixed name,
> a crypto int32 seed, the remembered dials), the ONE optional `kick` prop through MainLayout to
> FloatingPanelsLayout, the DM bag at 45 keys, the Atlas tab's 🚪 button, the help entry, and two
> small seams the slice needed: `useToast` now RETURNS the id it minted (the sticky
> "Kicking in the door…" toast has to be dismissable) and `useServerEventHandlers` gained an
> optional `onAtlasError` beside its existing toast — a ref the hook fills, because that chain is
> single-subscriber. **Sabotage: 24/24 red.** **Browser proof on the dev table** (a real DM, real
> keystrokes): G opened the panel with every §1.1 field; Escape closed it; Ctrl+G and a "g" typed
> into the Atlas tab's name field did nothing; the Atlas tab's 🚪 button opened the same panel;
> ROLL closed it, held the sticky "🚪 Kicking in the door…" until the arrival, then toasted
> "🚪 Proof Cellar — kicked in" — an adopted "K2 Origin" region, the child under it with its
> arrival installed as the staging zone, both doors pinned, fog on. **Traps K2 paid for:** jsdom's
> `localStorage` in this config is NOT a full `Storage` (no `clear()`) — install a working one per
> test, the `juiceSettings.test.ts` precedent, which also isolates the suite from what the last
> test remembered; a DISABLED submit button does not stop a form submit (Enter still fires it), so
> the handler's own guard is what makes "disabled" real; a sabotage marker must be a string that
> actually appears in the runner's output — a test-name fragment, not a source comment the
> reporter truncates (three of K2's 24 read as green until the markers were fixed, and one of
> those three was a REAL vacuity: nothing pinned that `loadKickSettings` sanitizes what it read,
> so a tampered store would have poisoned every ROLL).

---

### K3 🟡 — The phone: the verb, the screen, the chip

**Goal:** §1.1's phone flow, measured. Plus the Atlas-tab gap in the touch-floor sweep (own
commit).

**Context capsule:**

- `apps/client/src/layouts/mobile/MobileSurfaces.tsx:127-160` (the DM screen: the verb at
  `:134-140` `className="mobile-chip mobile-screen__action"` → the SECOND verb copies it, stacked
  below, and calls `openSurface("kick")`), `:176-182` (a surface mount to copy for `"kick"`,
  gated `isDM`), `apps/client/src/hooks/useMobileSurface.ts:13` (the union + `"kick"`), `:133-137`
  (the rising-edge rule — ROLL closes the surface the way arming does),
  `apps/client/src/layouts/mobile/MobileScreen.tsx` (the full-screen host; its ✕ is the close).
- `apps/client/src/layouts/MobileLayout.tsx:115` (the machine) — the `openKick` OVERRIDE happens
  here, before `buildDMMenuProps` is called, so the Atlas-tab button lands on the machine
  (§2.2; review C3); `:286` (toasts mount — the toasts are free).
- `apps/client/src/components/layout/MobileFloatingControls.tsx:204-272` (the player dock nav —
  the pending chip renders inside it, out of flow), `apps/client/src/components/layout/MobileMapEditDock.tsx:57-64`
  (the `.mobile-dock-saving` idiom and why it has no `aria-live`), `apps/client/src/theme/herobyte.css:1291-1316`
  (the chip's CSS — reused, not duplicated), `:2104-2110` (`.mobile-screen__action`, `width: 100%`),
  `:1337-1358` (the coarse-pointer floor scoped to `[data-mobile-surface]` — the screen's
  controls need the attribute on the surface root).
- Specs: `apps/e2e/mobile/mobile-atlas.spec.ts` (the template: two 375×812 contexts, seam
  elevation, `openDMScreen`, `waitForFunction` on the seam with 30 s, teardown deleting nodes +
  documents + links — ADD links), `apps/e2e/mobile/mobile-panel-touch-floor.spec.ts:27`
  (`undersizedControls` — a LOCAL function; move it to `mobile.helpers.ts` so the new spec can
  use it) and `:115` (the DM-tab loop lists five tabs — add `"Atlas"`; if the Atlas tab's generate
  panel has a sub-44px control the sweep will now say so — fix it, do not shrink the loop),
  `mobile.helpers.ts:20` (`joinMobileTable`), `touch.helpers.ts:83` (`touchTap`),
  `mobile-dm.spec.ts:176-198` (every tab view measured against the viewport width — the new
  button must not spill).

**Changes:** the verb; the `"kick"` surface mounting `<KickPanel>` inside a `MobileScreen`
titled _Kick in a door_ (`data-mobile-surface="kick"`); the `openKick` override in `MobileLayout`;
ROLL → `kick()` + `setSurface("none")`; the pending chip on the player dock; `MobileLayout`
passes `kick` down; `undersizedControls` extracted to the helpers; the touch-floor loop gains
"Atlas".

**Tests:** unit — the verb renders for a DM only and opens the surface; the Atlas-tab button
opens the SAME surface on the phone (render test through the override — the machine test alone
cannot see a missing mount, the A6 lesson); the surface mounts the panel; the chip renders iff
`pending && !expired` (a UNIT test — the e2e does not race it); one-open-surface holds. E2E NEW
`apps/e2e/mobile/mobile-kick.spec.ts`: DM (seam-elevated) → dock DM → 🚪 Kick in a door → the
screen's controls all ≥ 44px (`undersizedControls(page, "[data-mobile-surface='kick']")`) in
BOTH orientations → name "Cellar" → ROLL → `currentAtlasNodeId` becomes the node named Cellar with
a parent (30 s) → player: Tools → World → `you are here: Cellar`; teardown (links included).

**Done when:** gate green; sabotage every rule; measured on a phone viewport in both
orientations: the verb is 44px, the screen fits and scrolls, the chip sits above the dock without
touching the five columns, the iris and the arrival toast show; the DM screen is gone when the
iris fires (ROLL left the surface); the Atlas-tab button opens the kick screen.
**Traps:** `mobile-shell.spec.ts` is at 345 — new assertions go in the new spec; the chip must be
`pointer-events: none` (it floats over the canvas the DM taps through); `?mobile=true` on the
`goto`, never via `navigate`; two same-origin tabs share the uid — two contexts; the map-edit
palette REPLACES the player dock while map-edit is armed — the chip belongs to the player nav
only (a kick cannot be started from the palette, by design).
**Escalate if:** the screen wants a sixth dock slot or a tool tile — settled (§2.3 #6).

> **K3 SHIPPED** (2026-09-06, three commits on `dev`, each behind the full ladder and a sabotage
> pass). **`149b2b64`** — the DM-menu touch-floor sweep reaches the Atlas tab, and reaches it
> HONESTLY: an empty atlas shows only the create row, so the Atlas leg mints a promise, opens its
> generate panel, measures, and deletes the node. The floor itself was already right (the
> container-scoped `[data-mobile-surface] select` rule covers those dials); proven non-vacuous by
> dropping `select` from that rule and running the Atlas leg alone, which names all four at 28px.
> `undersizedControls` moved to `mobile.helpers.ts` so the kick spec measures by the same
> definition. **`c7ac1506`** — the phone slice: the surface union gains `"kick"`, the DM screen
> carries a SECOND verb (🚪 Kick in a door) below Edit the live map, and both it and the Atlas
> tab's button route through the surface MACHINE (`MobileLayout` overrides `openKick` and wraps
> `kick` so ROLL leaves the surface) — one open signal, so the one-open-surface invariant holds;
> the ⏳ chip floats over the player dock while a kick is pending and not expired. **Sabotage: 9/9
> red**, after two of them exposed real gaps: the kick surface's `isDM` guard is about
> DE-ELEVATION (a player has no way to open it at all), which needed its own test, and a union
> member is enforced by `tsc`, not by vitest — sabotaging it has to be run against typecheck to
> mean anything. **The e2e spec found a real bug in K2's own panel:** `KickPanel` set an inline
> `min-height: 28px` on its five selects, and an inline `min-*` beats the touch floor's rule —
> which is the very reason that floor uses `min-*` rather than padding. All five dials sat under
> 44px on a phone; the inline height is gone and a comment says why it must not come back.
> **Browser proof at 375×812:** the verb measures 44×351, the kick screen fits the viewport, ROLL
> leaves the surface, and the ⏳ chip sits above the dock (bottom 729 vs dock top 732), overlaps
> none of the five columns, carries `pointer-events: none` so the DM draws through it, and clears
> on arrival. **Trap:** the map-edit palette REPLACES the player dock, so a spec that starts the
> live map must EXIT the mode — the tool sheet's own ✕ says "Close tools" and leaves it armed,
> which cost this spec one 150 s timeout. **`4ddc2abf`** — K3's gate turned up a first-time
> failure in K0's OWN spec (`mobile-atlas-aim`): an aimed tap both placed the link and swung the
> door. The mechanism is Konva's, not the product's — the hit graph is rebuilt on the next PAINT,
> so `listening={false}` (a door yielding to the aim) and a camera move are only true for
> hit-testing one frame later; a tap sooner lands on the stale graph, hits the door's old
> listening region AND bubbles to the Stage where the armed aim takes it, which is exactly the
> pair of outcomes observed. The spec now waits two animation frames after arming and after
> centring. It did not reproduce in isolation (4/4) or across the whole mobile project (78/78),
> so the wait is the fix and the classification is a timing hazard in the test, not a regression.

---

### K4 🔴 — The building recipe

**Goal:** `recipeId: "building"` — tavern / shop / warehouse / house — cashable from the Atlas
generate panel and the kick, on both platforms, deterministic, sealed by VISIBLE walls, entered by
ONE front door, stocked with DM-only keys, furnished with what the catalog has.
`MAX_STAMP_ELEMENTS` finally enforced.

**Context capsule:**

- `apps/server/src/domains/generation/dungeonGeometry.ts:24-34` (`THEME_FLOOR`/`THEME_WALL` —
  `emitGeometry` takes explicit `{floorAssetId, wallAssetId}` instead; the dungeon passes its
  theme map), `:51` (`emitGeometry(layout, bounds, params, ctx, nextId?)`), `:100-123`
  (`emitWallHalo` — paints every NON-floor cell that 8-touches floor: the ONLY visible wall;
  `:109` `if (layout.floor.has(cellKey(x, y))) continue;`), `:154-190` (`wallEdgesOf` +
  `mergeRuns` — family 1 walls floor against non-floor, family 2 the seam at `:165`; the
  door-site omission `:171`), `:268-301` (`emitDoors` — closed doors, rotation by seam),
  `:303-338` (the lattice helpers → NEW `geometryLattice.ts` FIRST, the file is at 338),
  `dungeonLayout.ts:40` (`DungeonLayout` — already exported; alias `RecipeLayout`), `:107` (the
  fixed-4-rolls discipline), `:139` (`touchesWithMargin` — accepts a one-cell gap: usable), `:146`
  (`indexRoomCells` — reusable as-is), `:260` (`findDoorSites` — corridor-specific; buildings
  punch their own doors), `dungeonStocking.ts:23-32` (`ROOM_KEYS`), `:42-59` (the fixed roll
  block), `:106-134` (`markerFor` — notes layer, `visibleToPlayers: false`, NOT hidden),
  `dungeonRecipe.ts:20-24` (the salts — mint NEW ones), `:70` (`shuffleIds` — module-private:
  move it to `recipeIds.ts` in the domain and export), `types.ts:55-70` (`MAX_RECIPE_CELLS`,
  `MAX_RECIPE_ELEMENTS`, the unenforced `MAX_GEOMETRY_ELEMENTS`/`MAX_STAMP_ELEMENTS`),
  `recipeContext.ts:41` (`layerIds.objects` — finally used), `packages/shared/src/scenePublish.ts:164`
  (`toRenderable` — walls never render; §2.1).
- Vocabulary: `apps/client/src/features/map-studio/starterTileObjectAssets.ts:17-41` (crate 1×1
  wall-biased, table 2×1 open-biased, lamp emissive), `starterTileAssets.ts` floors —
  `terrain:wood-floor` (plank), `terrain:wood-walnut`, `terrain:wood-grey`, `terrain:stone-floor`
  (flagstone), `terrain:stone-cobble`; walls `terrain:wall-stone|brick|timber|dark`
  (`starterTileStructureAssets.ts:27-66`) — brick and dark are free theme slots. Stamps carry
  document-px `width/height` (`mapStudioTypes.ts:52-55`); position by `transform.x/y`. The ids
  the recipe uses move to a SHARED sub-module `packages/shared/src/recipeAssets.ts` (runtime
  consts; barrel re-export; boot `pnpm dev`) — the server imports them, and a CLIENT test asserts
  the shared list ⊂ the catalog (only the client can see both; a hand-copied list could not fail).
- `packages/shared/src/recipes.ts` (K1 — `BuildingParams` joins the union; the discriminated
  validator `z.discriminatedUnion("recipeId", …)` grows a member — params strict), the fixtures
  carrying literal `recipeId: "dungeon"` records (the five of §2.2) stay valid and untouched.
- Client: `AtlasGeneratePanel.tsx` + `KickPanel.tsx` gain the recipe picker with per-recipe
  dials (kind for buildings; theme + density for dungeons); `useAtlasActions.ts:13`
  (`AtlasGenerateParams` → `GenerateRequest`); the mobile DM screen measures both panels.
- Golden: `apps/server/src/domains/generation/__tests__/dungeonGeometry.test.ts:322-339` (the
  pattern, incl. the guard-the-guard `:338`), `__tests__/fixtures/` (a sibling
  `building-seed1-24x20-tavern.json`), `SnapshotSizeGuard.test.ts:114-128` (the maxed-output
  twin — 128×128 by DIRECT call, that file's convention; `large` is 96×64),
  `generateDungeon.contract.test.ts:374` (the marker-leak test — a building twin).

**Changes:** `geometryLattice.ts` extraction (first); `emitGeometry` takes asset ids;
`shuffleIds` → shared `recipeIds.ts`; `recipeAssets.ts` (shared); NEW `buildingLayout.ts`
(footprint = bounds inset 1; seeded BSP partitions with ONE-CELL-THICK walls — each split reserves
a non-floor line, rooms are the sub-rects inset off it, min room 4×3, a FIXED roll count per
split drawn before any test; `indexRoomCells`; one interior door per partition line = ONE floor
cell punched through its middle, with a door site on one of its two room edges; ONE front door on
`entrySide` (a param, default `"south"`, the middle of that side — never a roll, so the kick can
later face the party) — the cell outside it is the halo-painted inset ring, accepted;
`arrival` = the entry room's cells just inside the door, clipped to that room, 1–3 cells), NEW
`buildingRecipe.ts` (kind → floor + wall ids: tavern wood-floor/timber, shop stone-cobble/brick,
warehouse wood-grey/dark, house wood-walnut/timber; `emitGeometry`; a warm `MapLightElement` per
room center; NEW `buildingDressing.ts` — kind-specific keys (`"PATRONS: 2d4 locals, one of them
listening"`, `"LOOT: strongbox under the counter — DC 14"`, `"EMPTY — closed for the night"`, …)
on the notes layer with `visibleToPlayers: false`, and stamps on the objects layer: tavern →
tables in the largest room on a spaced grid, crates in the smallest; warehouse → crates along
walls; shop → tables as a counter row near the front door; house → one table; fresh salts;
`shuffleIds`); registry entry with `assertParams`; `assertRecipeBudget` counts stamps against
`MAX_STAMP_ELEMENTS`; both panels' picker; the provenance union; the validator union.

**Tests:** golden (tavern, seed 1, 24×20) with guard-the-guard (≥2 rooms, ≥1 door, ≥1 stamp);
properties over 15 seeds × 4 kinds × 3 presets: exactly ONE perimeter door; every room reachable
through door cells (BFS over floor cells); sealed otherwise (no floor cell touches the outside
without a door); VISIBLE walls — every emitted wall run has a wall-painted cell adjacent to it;
every stamp inside a floor cell and off every door cell; every element inside the document;
`arrival` inside the floor, inside the entry room, adjacent to the front door; deterministic
(seed) and different across seeds; kind changes paint and dressing; `entrySide` moves the front
door, the perimeter run it splits, `arrival` and (for `shop`) the counter row — the ROOM
PARTITION is invariant (`layout.rooms`, the floor set, the interior doors, the lights, the keys are
identical across two `entrySide` values); determinism independent of `idPrefix` (the
stocking-stream test's twin); budgets: the maxed tavern (128×128 by direct call) under the
snapshot guard, and `assertRecipeBudget` red on a SYNTHETIC stamp-heavy output (a realistic layout
cannot reach 2000 — the unit test must); the marker-leak test on a player socket; the client
catalog-subset test over the shared ids; validator — a building `theme` is rejected (strict), a
dungeon `kind` is rejected; both panels render the picker and send the right shape; the kick with
`recipe: building` lands a `building` node (contract); e2e leg (K6's spec carries it: kick a
tavern on desktop; generate a shop from the phone's Atlas chip).

**Done when:** gate green; sabotage every property (weaken BSP → the reachability test goes red;
drop the front door → the perimeter test goes red; paint a partition as floor → the visibility
test goes red; …); browser: kick a tavern — the party stands just inside its door, walls VISIBLE
between rooms, tables in the common room, fog on, keys DM-only; a shop from the phone.
**Traps:** the 20×20 floor is in THREE places — `recipeContext.ts:130` (`validateBounds`, run
for every caller — untouched: presets are ≥24×20), `generationValidators.ts:22` (the live-map
door — stays), and `atlasGenerate.test.ts:14` (every preset clears the floor — still true);
`prettier` on `dungeonGeometry.ts` — measure after; the golden of a sealed box pins the bug, not
the contract; `ctx.layerIds.objects` requires an UNLOCKED objects layer (already required today);
a 3-cell arrival strip must never cross a partition line.
**Escalate if:** the one-cell partitions cannot ride `wallEdgesOf` + `emitWallHalo` after all
(that is the load-bearing reuse — a fork of the wall tracer is a different slice).

**🔎 SENIOR REVIEW GATE:** determinism / recipe lens (streams, salts, shuffle, golden hygiene,
visibility, budgets) — lens-sized.

---

### K5 🟢 — Cartridge Codes (do if budget remains; else §7 — and say so in the banner)

**Goal:** Signature Move 4's minimal honest form: a code on every node this arc generated (whose
provenance carries `size`), pasteable into the kick and generate panels, structural identity
CI-pinned.

**Context capsule:** `packages/shared/src/recipes.ts` (K1/K4 — the request union to encode);
`AtlasNodeRow.tsx:33-37` (row state + status glyph — the 📼 button beside 🚩 for mapped nodes
whose `recipe.size` is present); `KickPanel.tsx` / `AtlasGeneratePanel.tsx` (a _📼 paste a code_
field that prefills the dials — no `window.prompt`, the owner retired the last of those); the
golden and determinism tests (`dungeonGeometry.test.ts:341`); `navigator.clipboard` with a
selectable read-only fallback.

**Changes:** NEW shared `cartridgeCode.ts` — `encode({ ...request, seed })` →
`"HB1-" + base64url(canonical JSON)`; `decode(code)` → the request or `null` (version prefix
checked; shape validated structurally, then the SERVER re-validates through the normal zod path
when the request is sent); the two UI surfaces on both platforms.

**Tests:** round trip; garbage/`HB0-`/truncated → `null`; canonical key order (two encodes of
equal requests are byte-equal); a code from node A pasted into a new kick produces geometry equal
modulo `idPrefix` to A's document (server contract: generate twice from one decoded request
through two nodes); the 📼 hidden for a node whose provenance has no `size` (a pre-K1 node — the
type keeps it optional, so the guard is real, not dead); e2e: copy on desktop, paste on the
phone's generate panel, the shop matches.

**Done when:** gate green; sabotage 5/5; both platforms measured.
**Traps:** clipboard permissions in Playwright (grant `clipboard-read`/`clipboard-write` in the
context, or assert the selectable fallback); do NOT put the code in the URL.
**Escalate if:** "bit-identical" is demanded at the element-id level — §2.3 #8 settles the
reading; a code-derived `idPrefix` is a design change.

---

### K6 🟢 — The journey, the budgets, the docs, the sweep

**Goal:** lock the arc in end to end, and pay the user-guide debt.

**Changes:**

1. NEW `apps/e2e/kicked-in-door.smoke.spec.ts` (≤348; two contexts; copy
   `atlas-journey.smoke.spec.ts`'s helpers verbatim — `waitForSnap`, the TOGGLE-safe `openAtlasTab`,
   `dm.on("dialog")`): from an UNADOPTED live table the DM clicks the canvas (blur), presses `g`
   (`page.keyboard.press("g")` — the first bare-letter keystroke in the suite), sees the dialog,
   names it "Cellar", picks _building / tavern_ (K4) or dungeon, ROLL; asserts: arrival
   (`currentAtlasNodeId`), the ADOPTED origin (named after the document, discovered) as the
   parent, the party inside `arrival` (seam tokens, tolerance), fog on, two links
   (`atlasLinks.length === 2`), the player's wire — node key sets exactly
   `[discovered,id,kind,name,parentId]` for Cellar, raw JSON has no `"recipe"`, `"arrival"`,
   `"sceneStates"` KEYS (after a real suspension — the journey's `:173-180` lesson; `"size"` is
   NOT a raw-bytes check — `grid.size` rides every frame — the seed is pinned by a ≥9-digit
   sentinel through `sentinelHitsIn` with a DM positive control), a link with `toNodeId` present
   (the origin is discovered) — then clicks the return door by projecting its anchor through
   `data.cam` (`readCam`'s math: `screen = anchor · scale + cam`) → confirm → the origin resumes
   (`sourceDocumentId` back, the door state / a drawing survived); a second run on an ALREADY
   adopted origin (the `:656` flow) takes the other branch; teardown deletes links, nodes,
   documents.
2. `apps/e2e/mobile/mobile-kick.spec.ts` (K3) gains the building leg (generate a shop from the
   Atlas chip; world map shows it).
3. Budgets: `SnapshotSizeGuard.test.ts` — a kick's DM frame (a maxed tavern + 2 links) under the
   guard; the 8-scene export/import round trip with a building scene inside the 1 MiB ceiling.
4. Docs: `docs/user-guide/dm-guide.md` gains **The Atlas, travel, and the Kicked-In Door** (the
   Atlas arc's debt included: tab, promises, GENERATE, TRAVEL, discovery, links; then G / 🚪, the
   panel, adoption, the return door, buildings, codes); `player-guide.md` gains **The World Map**
   (including the entrance box the party arrives in); `README.md`'s table row; NEW
   `apps/e2e/docs-screenshots.atlas.ts` walkthrough (`docs-screenshots.dm.ts` is at 341) and the
   re-recorded shots; `helpTopics.ts` re-read against the guides (the owner's rule: curated in-app
   prose + links to the guides — the guides must exist for the links to mean anything).
5. VISION.md M4 banner: Phase 3 shipped (the Kicked-In Door + building interiors [+ codes]);
   `m4-dungeon-recipe-plan.md` §7.2 and `atlas-arc-plan.md` §7.2 cashed-IOU notes; HANDOFF-NEXT
   §0 + §10 IN THE SAME COMMIT; the SHIPPED banner atop this plan; a memory file.
6. Full ladder end to end, twice; restate every suite count in the final report (re-run, don't
   copy); the three hand-lists grepped byte-identical (§4.16).

**🔎 SENIOR REVIEW GATE (final):** the standing adversarial review of the arc — run as
LENS-SIZED workflows (state-machine, privacy, client/mobile, recipe), each ≤14 agents, each
checked for `agents_error` and followed by a `git status` audit, RESUMED if the session limit
cuts in; a completeness critic last.

---

## 6. Failure drills (when X happens, do Y — do not improvise)

| Symptom                                                                        | Cause                                                                                                                                                 | Fix                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `atlas-kick` does nothing, ack success, no error                               | the switch's `default:` throws for unrouted atlas types — so this is the validator ROW missing (tsc) or the client sent a shape zod rejected silently | check the exhaustive table; the strict params; the routing test via the real router |
| A kick minted a node with no map                                               | the node was pushed before the recipe/persist                                                                                                         | §2.2 step order; the fingerprint test                                               |
| Two dungeons after a laggy click, or after "ROLL again"                        | the replay guard keyed on something other than the client-minted `nodeId`, or the panel minted fresh ids on retry                                     | §4.4                                                                                |
| The party lands in solid rock                                                  | `arrival` not emitted, or the install skipped because a zone existed (moved) — that one is by design                                                  | K1 steps 5 + 7; the containment test                                                |
| The party lands in rock only after a publish + travel-away                     | the install was first-visit-only                                                                                                                      | §4.10 — the sticky install; the publish-burn row                                    |
| The party lands at the OLD table's staging cells on the new map                | the limbo-zone leak (START LIVE MAP branch warped with the outgoing zone)                                                                             | K1 bug (b)                                                                          |
| A kick from a fresh table has no doors                                         | the origin was not adopted                                                                                                                            | §2.3 #10; the unadopted-origin test                                                 |
| A kick from a raster-only table hauled the raster along                        | the limbo refusal missing                                                                                                                             | §2.3 #10; the limbo row                                                             |
| The door sprite is off by half a cell / in the wrong place after a raster move | anchor computed in cells or without the inverse map transform                                                                                         | §4.9; the raster-transform test                                                     |
| The return door is invisible under the party                                   | it was pinned at the zone's CENTER                                                                                                                    | §2.2 step 5 — the entrance edge                                                     |
| "You are here" says nothing while the party stands on a node's map             | the projection keyed on the binding                                                                                                                   | §2.3 #5 — scene-first                                                               |
| The kick parents under the wrong node after a publish                          | origin resolved from `liveMapDocumentId` first                                                                                                        | §4.5                                                                                |
| A player's frame carries `arrival` / `recipe`                                  | someone spread a node instead of the whitelist constructor                                                                                            | `atlasProjection.ts:54`; the key-set tests                                          |
| The secrecy e2e reds on `"size"` on a healthy build                            | `grid.size` rides every frame                                                                                                                         | §4.7 — never a raw-bytes check for `size`                                           |
| `tsc` reds five fixtures on K1's first typecheck                               | `size` became required through an intersection                                                                                                        | §2.2's split types                                                                  |
| Doors reset on travel after K1                                                 | the compiled outputs were INSTALLED before the capture (the capture reads door runtime from the compiled scene)                                       | the three-phase split; the door-survival test                                       |
| `pnpm dev` won't boot after the shared edit; every gate green                  | `RECIPE_IDS` / `recipeAssets` declared in the barrel                                                                                                  | §4.18; sub-module + boot                                                            |
| G does nothing                                                                 | a field has focus or a tool is armed (correct), or the hook mounted below the layout swap and unmounted                                               | mount in `AuthenticatedApp`; the render test                                        |
| G fires while typing a node name                                               | the `isEditableTarget` guard missing                                                                                                                  | §4.17 — the `r` bug's lesson                                                        |
| Pending never clears                                                           | arrival detection compares the wrong id, or the `onAtlasError` ref was never filled                                                                   | the hook tests; the 20 s expiry is the backstop, not the fix                        |
| The atlas-error toast disappeared after K2                                     | a second `registerServerEventHandler` call replaced the chain                                                                                         | single-subscriber — use the option                                                  |
| The phone's Atlas-tab 🚪 button does nothing                                   | it drove `kick.open`, which nothing mounts on a phone                                                                                                 | K3 — the `openKick` override onto the machine                                       |
| The phone shows the DM screen over the iris                                    | ROLL did not leave the surface                                                                                                                        | K3 — `setSurface("none")` on ROLL                                                   |
| A link appears at the end of a pan while aimed                                 | one-finger pan was enabled during the aim                                                                                                             | K0 L3 — pinch only; §2.1 Konva                                                      |
| A tap on the return door prompts twice / paints and prompts                    | K0 not applied, or `sceneInputArmed` not plumbed (or missing a term)                                                                                  | K0 L1 — the seven-term predicate                                                    |
| Partition walls block but cannot be seen                                       | zero-gap partitions                                                                                                                                   | K4 — one-cell partitions; the visibility property                                   |
| The building's rooms are unreachable / the shell has two doors                 | a partition line was not punched / the front-door site duplicated                                                                                     | K4's BFS and perimeter properties                                                   |
| The building golden changed after a refactor                                   | a roll moved before a conditional, or a salt collided with the dungeon's                                                                              | §4.11; never "fix" by regenerating                                                  |
| `structure-report` reds a file you did not touch                               | prettier expanded it, or a `??` junk file at the root                                                                                                 | measure after prettier; `git status --porcelain` for root `??`                      |
| Mass e2e failure across unrelated features                                     | harness fault (concurrent build, orphaned ports)                                                                                                      | re-run ONE named spec alone before believing anything                               |

---

## 7. Deferred follow-ups (recorded, not licensed)

- **The live-map GENERATE tool's recipe picker.** Extract `MapStudioMessageHandler.ts`'s generate
  case to `mapStudioGenerate.ts` first (3 lines of headroom), dispatch through the registry,
  widen `map-studio-generate`'s wire union and `generationValidators.ts:48`, add the picker to
  `GeneratePanel` + `MobileGeneratePanel`, and give the dragged region a building's `entrySide`.
- **Smaller presets** (and only then a per-recipe floor below 20×20) — a house at 16×12 wants a
  `tiny` preset; `validateBounds` would need the floor passed in.
- **Editing a node's `kind`** — `atlas-update-node` patches name/discovered/parentId only; the
  adopted origin is a `region` forever until this exists.
- **The one-way alternative to adoption** — recorded for the owner: mint a root child, pin no
  doors, say so in the panel.
- **A phantom suspension record after publish-then-rebind** (K1's review) — the re-attach row
  leaves `sceneStates[doc]` un-consumed when a suspended document is published onto the table
  and then rebound; the record rides saves and exports until the next real departure overwrites
  it. Consuming it on re-attach would lose that scene's stayers (the record is their only copy),
  so it stays; the real fix is publish going through travel.
- **The kick panel previews the adoption name** (K1's privacy lens, PR1 — UX, not privacy) —
  when the table's map has no node, the panel should show "This table becomes: <document name>",
  editable, and the kick message would carry an `originName` override; today the adopted node is
  named after its document, as §1.1 says.
- **An aimed kick** — G, then click where the door goes; the outbound anchor comes from the aim
  instead of the party. Rides `useAtlasLinkAim`'s one-shot capture; must still pin the link
  BEFORE the travel (the scene-change disarm kills an armed aim the instant travel lands).
- **The building faces the party** — pass `entrySide` from the outbound door's side of the
  origin map so the return door is on the wall the party came through.
- **Reroll-preserving pins** — needs per-ELEMENT provenance (`MapElementBase` has none;
  VISION's `pass` never shipped) and a name that is not `pinned` (already the brush-deck
  favourites' word). A side-table keyed by element id vs a field on the base type is undecided.
- **Bestiary-linked encounter manifests** — `templateId` is a commented-out line; the keys stay
  text until a Bestiary exists.
- **Cartridge Codes at the id level** — a code-derived `idPrefix` if "bit-identical" must mean
  ids too. **Cartridge Codes at all**, if K5 was skipped.
- **Furniture art** — chairs, barrels, beds, counters, shelves, chests (the czepeku prop-kit
  prose in `docs/planning/czepeku-taxonomy-catalog.md:136-195`) — the art track's, not this arc's.
- **A shared JRPG confirm** replacing the 17 `window.confirm` sites (the TRAVEL string is
  duplicated in two files today).
- **Validating atlas node shapes on load** — nothing checks a node's fields at the disk or
  session boundary today (`atlasState.ts:75` is an `isRecord` filter); the Atlas arc accepted
  that posture and this arc keeps it.
- **Town / wilderness / world recipes**; secret doors in generated maps (fog-aware terrain);
  the APG tree role; per-connection DM re-elevation; a spatial world-map view — carried from the
  Atlas plan's §7.2.
- **`docs-screenshots.dm.ts` at 341 and `mobile-shell.spec.ts` at 345** — the next additions to
  either need a split first.

---

## 8. Command crib sheet

```bash
pnpm --filter @herobyte/shared build       # ALWAYS after shared edits; then boot pnpm dev once (K1, K4)
CI=true pnpm build && CI=true pnpm typecheck && CI=true pnpm lint && CI=true pnpm lint:structure:enforce && CI=true pnpm format:check
CI=true pnpm test
CI=true pnpm --filter herobyte-client build:check
CI=true pnpm test:e2e --reporter=list      # read the summary LINE; a flaky pass prints "1 flaky" and exits 0
CI=true pnpm --filter vtt-server exec vitest run src/ws/__tests__/atlasGraph.contract.test.ts   # package-relative
CI=true pnpm test:e2e --project=mobile-chromium --grep "kick"
```

Use `/verify-gates` after every burst (never ask it for a bundle figure AND e2e in one prompt);
`/fix-fixture-ripple` for a TS2741 storm (none expected — no required field lands, and the five
provenance fixtures are the proof); `/watch-ci` after any push.

**Glossary:** _kick_ — `atlas-kick`: adopt-or-resolve the origin, mint + cash the child, two
doors, travel, in one block. _origin_ — the SCENE's node (`compiledScene.sourceDocumentId`),
adopted when the document has none; the kick's parent and the outbound door's map. _arrival_ —
a recipe's entrance as a center-anchored CELL rect, recorded on the node, installed as the
scene's staging zone whenever a warp finds none. _entrance edge_ — the arrival rect's boundary
cell nearest the document edge; where the return door sits. _return door_ — the child→origin
link. _cashNode_ — the generate core both atlas doors share: validate → persist → apply →
provenance. _pushLink_ — the create-link core both the handler case and the kick share. _the
registry_ — `RECIPES[recipeId]`, exhaustive by construction. _structural identity_ — same
request + seed + size → same cells, elements modulo id, arrival. _the token convention_ — cells
to px at cell centers, no grid offset, through the map transform.

**Review-gate sizing** (§0 rule 10): lens-sized workflows, ≤14 agents, two refuters per finding,
`agents_error` checked, `git status` audited, session-limit deaths RESUMED; a refuter-less or
errored result is unexamined ground, never a clean pass.

---

## 9. Rev 2 — what the pre-execution adversarial review changed

Four lens-sized workflows ran against Rev 1 (`bb27acb2`), each one finder (Opus) and two
independent refuters per finding (a code refuter and a scenario refuter, Opus), read-only, ≤9
agents: **travel-physics** (9 agents), **privacy-wire** (9), **client-mobile** (9),
**recipe-determinism** (9). Two finders and one refuter died to the account's session limit
mid-run; every run was RESUMED with its cached agents replaying, so all four lenses finished with
`agents_error: 0`, and `git status` was clean after every run. 16 findings; every one is listed.
Severity in parentheses is what the refuters believed, not what the finder claimed.

**Confirmed by both refuters (8) — design changed:**

- **T1/travel (contested → accepted; medium).** A generated node's first visit can be consumed by
  a door that installs no zone — not set-live (unreachable for an existing document) but
  `map-studio-publish` — after which the saved branch never installs `arrival`. Fix: the install
  is door-independent and STICKY (§2.2, §4.10): whenever a warp finds no zone and the node has
  one. Also `structuredClone` the installed zone.
- **T4/travel (contested → accepted; low).** "Origin undefined" is the DEFAULT table, not an
  edge: a rootless child with no doors was one-way for most tables. Fix: the kick ADOPTS the
  origin (§2.3 #10); the one-way alternative is recorded for the owner (§7).
- **P1/privacy = R1/recipe (blocker → medium; reproduced with the repo's tsc).** The
  `RecipeProvenance` intersection made `size` REQUIRED — five shipped fixtures would red K1's
  first typecheck, the "no TS2741" promise was false, and K5's "hidden without size" guard would
  be dead code. Fix: `size` is ADDED per type on split members (§2.2); the five fixtures are named
  and must compile untouched.
- **P2/privacy (high → medium).** K6's raw-JSON check for `"size"` could never pass —
  `mapTerrain.grid.size` rides every frame. Fix: dropped from the raw list; the seed is pinned by
  a sentinel walk with a DM positive control (§4.7, K6).
- **C1/client (blocker → high).** K0 L3's premise was false: Konva's `tap` has no movement slop
  (the finder read the installed Konva 10.0.2), so a one-finger pan while aimed would place a
  link at every finger-lift. Fix: L3 restores only the PINCH; `shouldPan` keeps `!linkAimMode` on
  both input paths (§2.1, K0).
- **C2/client (high → medium).** L1's `sceneInputArmed` omitted alignment, pointer and measure;
  the repo's predicate is the seven-term `shouldPan`. Fix: the negation of the exported predicate,
  one test per term (K0).
- **C3/client (high → medium).** The Atlas-tab 🚪 button drove `kick.open`, which nothing mounts
  on a phone; ORing the flags would break the one-open-surface invariant. Fix: on a phone the
  surface MACHINE is the only opener — `MobileLayout` overrides `openKick` (§2.2, K3).
- **R2/recipe (high; both refuters).** Zero-gap partitions are INVISIBLE: the halo paints only
  non-floor cells and wall elements never render as scenery. Fix: ONE-CELL-THICK partitions,
  doors punched through them, a visibility property (§2.1, §2.3 #7, §4.11, K4).

**Contested (4) — one refuter each way; adjudicated by reading the code:**

- **T2/travel (high vs refuted).** The START LIVE MAP branch carries the limbo table's raster,
  drawings, props and combat onto a generated map on a warp. Adjudication: the haunting is the
  Atlas review's RECORDED decision, and the alternative (clearing) DESTROYS data that has no
  document to be captured under. Disposition: the KICK refuses from true limbo (§2.3 #10); travel
  from limbo is not reopened; bug (b) (the zone leak) stays a travel fix.
- **P3/privacy (low vs refuted).** K1's persistence bullet claimed an atlas node schema in
  `sessionValidators.ts` (there is none) and leaned on the round-trip sweep for nested fields (it
  is top-level only). Disposition: the bullet is corrected; explicit spot-checks for `recipe.size`
  and `arrival` are specified (K1). Recorded, not fixed: nothing validates node shapes on load (§7).
- **R3/recipe (low/medium).** Installing `arrival` as the scene's zone paints the dashed
  "Player Staging Zone" box on every player's screen. Disposition: ACCEPTED explicitly (§2.3 #4) —
  it is what a DM-placed zone shows and it spawns late joiners inside the entrance; K1 pins the
  player frame carrying the scene object.
- **R4/recipe (low/medium).** K4's property "`entrySide` changes only the door" was false — the
  door site splits the perimeter run and moves `arrival` and the shop counter. Disposition: the
  property is restated on the PARTITION (K4).

**Refuted by both refuters (4) — no change, one hygiene edit each:**

- **T3/travel.** "Compile-before-capture empties the outgoing `doorStates`" — §2.1 already
  prescribed compile (pure) → capture → install; K1's one-line summary was expanded to say so
  and "the outgoing doorStates survive" joined the sabotage list.
- **P4/privacy.** "§4.7's `arrival` claim is unenforceable" — the plan already distinguished the
  node FIELD (DM-only) from the RECTANGLE (scene state, player-visible); §4.7's headline now says
  "on an atlas node" and the Mission says the rectangle ships.
- **C4/client.** "The 20 s timeout is under the 30 s budget" — the 30 s figures are Playwright
  ceilings; the refuters MEASURED the `large` recipe at ~9 ms and the ack ladder at 3.5 s. Kept
  as a backstop; expiry made non-destructive with id reuse (§2.3 #11) — the finding's one good
  idea.
- **(mobile lens, §0.1)** the double-activation claim — Konva's shape-level `preventDefault`.

**Dropped candidates the lenses ranked below their caps, folded in without a verdict:**
§4.3's "byte-identical" reworded to the reachable window; step 5 pushes through the shared
`pushLink` core (clamp + checks); the return door at the ENTRANCE EDGE, never the zone center
(the tokens layer covers it); "resumes exactly" → "resumes (pointers, selection, undo cleared by
design)"; the zero-travelers test on a bound origin; fractional cells → tolerance; publish-parents
noted in §2.3 #5; the commandId ≤120 bound in the kick schema; the handler trims the name (bug
e); the projection tests by ROLE with `compiledScene` set; `useStageEventRouter.ts` is in
`hooks/`; `undersizedControls` extracted to the helpers; the desktop panel closes on ROLL with a
sticky toast; the `onAtlasError` ref seam; G inert while ANY tool holds the axis;
`FloatingPanelsLayoutProps` + `MainLayout` forwarding named; L4 fixed in the SHARED panel; the
chip pinned by a unit test, not a racing e2e; the verbs STACK; the per-recipe floor DROPPED as
unreachable; the 128×128 label corrected; `MAX_STAMP_ELEMENTS` proven on a synthetic output;
`shuffleIds` made shared; the recipe asset ids moved to a shared sub-module so the client test
can fail; the front door's outside cell accepted; the arrival strip clipped to its room; the
`DungeonLayout` anchors corrected.

**Traced and found CLEAN by the lenses (worth knowing, not re-filing):** the scene-first
`currentAtlasNodeId` opens no new leak (still gated on `discovered` for players); `arrival` and
the widened `recipe` reach no other channel (`atlas-error` and `map-studio-document` are DM-only;
export and fork carry the DM view whole, as the Atlas arc decided); pre-K1 nodes survive disk,
Redis and export/import untouched; no slice needs a new ServerMessage; `atlas-kick` has exactly
the four registration sites named; the remembered settings hold no secret; the ack layer keeps a
pre-minted commandId.

**Recorded, not cleared (the finders' own not-examined lists):** nothing was run in a browser,
under CDP, on WebKit, or through the e2e suite; the BSP itself is unwritten (its fixed roll count
and whether 4×3 rooms partition every legal footprint for all seeds); the Cartridge codec does
not exist yet; the KickPanel's z-order was not measured; the four layout fixtures were not
typechecked against the optional prop; landscape behaviour of the kick screen and chip. Each is
a slice's Done-when, not a plan defect.

### 9.1 K1's senior review (2026-09-03) — two lens-sized workflows, 10 agents, `agents_error: 0`

Method as §9: one finder per lens over the plan + the shipped code, ≤4 findings with file:line
evidence and a failing scenario, two refuters per finding (by code, by a throwaway contract probe
against the real router — deleted afterwards, `git status` audited clean). A finding is
CONFIRMED when neither refutes, CONTESTED when one does, REFUTED when both do.

**State-machine lens** (5 agents; 2 findings):

- **SM1 — CONFIRMED (high) → FIXED `4117c195`.** `handleAtlasTravel`'s "already there" guard
  keyed on the BINDING (`liveMapDocumentId === node.mapDocumentId`) while K1 moved "where the party
  is" to the SCENE. After a `map-studio-publish` of another map (binding A, scene B), a travel back
  to A short-circuited to a silent no-op — forever — and the re-attach row written for exactly
  that divergence never ran. The same guard shape in `bindLiveDocument` no-op'd a rebind of the
  bound document. Both guards now require the binding AND the scene to agree; two travel contract
  rows pin the return trip and the rebind after a publish. Sabotaged both guards.
- **SM2 — CONTESTED (medium) → FIXED `db88f49d`.** The kick's origin fell back to the binding
  (`compiledScene?.sourceDocumentId ?? liveMapDocumentId`), so a binding with nothing compiled
  (reachable through the load paths) passed the limbo refusal and the START LIVE MAP row then
  swept the table's stayers into the dungeon uncaptured. One refuter reproduced it; the other
  defended the fallback as §2.2's own formula. Decided for the fix on §4.5: the kick must derive
  the origin exactly as the projection does, and the projection calls that state "nothing on the
  table". The fallback is gone; a contract row pins the refusal with the state untouched. (§2.2's
  step-1 formula is corrected below.)
- Two footnotes the finder ruled non-findings: the re-attach row leaves a scene's record
  un-consumed after a publish-then-rebind of the same document (a phantom suspension record for
  the live scene rides saves and exports until the next real departure overwrites it) —
  **deferred to §7**: the record is the only copy of that scene's stayers, and consuming it on
  re-attach would lose them, so the phantom is the lesser harm; and the adopted origin's name
  came straight from the document — untrimmed, unbounded, and minted discovered — **FIXED
  `01338134`** (trimmed and bounded to the node-name rule, pinned).

**Privacy lens** (3 agents; 1 findings):

- **PR1 — REFUTED 2/2 (medium as filed).** "The kick's adoption publishes the DM's private
  map-document name to every player." The mechanism is real and one refuter reproduced it
  byte-for-byte through the router — but it is the settled design: §1.1 ("named after its
  document, discovered"), §2.2 step 5 and §2.3 #10 say it in so many words, a discovered node's
  `name` is the pinned player-facing contract (three exact key-set assertions), and K1's own test
  list required it. Not a leak of a secret class: `mapDocumentId`, `recipe`, `arrival` and the
  timestamps stay DM-only. **Follow-up in §7 (UX, not privacy):** the kick panel should preview
  the adoption name when the table's map has no node yet, so the DM sees what players will see
  before ROLL — and the kick message may then carry an `originName` override.
- The finder's clean sweep is worth keeping: the whitelist constructor still omits `arrival`,
  `recipe`, `mapDocumentId` and the timestamps by construction; `sceneStates` serializes to no
  recipient; both `map-studio-document` frames go to DMs only; `atlas-error` goes to the acting
  DM only and the family gate throws before any lookup, so a non-DM's nack carries only the
  constant; the kick's one frame carries the child already discovered; the return door renders
  without naming an undiscovered target; no HTTP route serves a state or map file; a player
  cannot pre-plant a staging zone (DM-gated); `installArrival` and the capture both
  `structuredClone`, so `node.arrival` is never aliased onto the wire. Noted, pre-existing and
  not this slice's: the whole floor plan of a kicked dungeon (walls, doors, terrain, elements)
  reaches every player socket — fog is client-side over that geometry, which is why generated
  maps author no secret doors; the seed's DM-only status protects nothing about the map the
  party is standing on. And the non-DM test's frame loop is vacuous by design (the gate throws
  before any frame) — the fingerprint and the error count carry that test.
