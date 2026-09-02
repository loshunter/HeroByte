# The Kicked-In Door — M4 Phase 3 — Execution Plan

**Status:** Rev 1 — authored 2026-09-02 after a 6-reader recon at `dev` = `59e55a81` (code identical
to production `main` = `a0434d39`), plus the Atlas arc's **mobile-surface review lens**, run alone
first as the handoff asked (12 agents, `agents_error: 0`, 6 raw findings → 5 after dedupe → **4
CONFIRMED by both refuters, 1 refuted, 0 contested, 0 unexamined**; §0.1). **Adversarial review of
this plan before execution is PENDING** — Rev 2 follows it; §9 will record every disposition. Do
the slices in order; each slice's _Done when_ gates the next.

**Mission:** VISION.md Signature Move 1 — _"One keystroke mid-session generates a fully compiled,
playable scene — walls, doors, lights, fog — in seconds, stocked with encounter markers."_ The DM
presses **G** (or taps 🚪 on a phone), names the place, picks a recipe, and hits **ROLL**: a new
node is minted under the node the party is standing on, cashed with a recipe, a **door** is pinned
on the current map where the party stands and another on the new map where they arrive, and the
whole table travels behind the iris. One synchronous server block; one broadcast; every piece
already shipped by the Atlas arc, composed — never bypassed. The second half of the arc is the
**building-interior recipe** (VISION Pillar 1: _"tavern/shop/warehouse grammars"_) so a town's
promises cash into something that is not a dungeon, and — if budget remains — **Cartridge Codes**
(Signature Move 4), which the provenance this arc completes finally makes possible.

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
field (`arrival`) and widens ONE (`recipe`); both are DM-only by construction because the player
projection is a WHITELIST constructor (`atlasProjection.ts:8-11` — "a spread-based projection
fails OPEN for every field AtlasNode gains later"), and §4.7 makes every slice prove it on the
attacker's socket with ≥9-digit sentinels and a DM positive control.

---

## 0. How to execute this plan (read this first)

Same method as `atlas-arc-plan.md`. Rules, binding:

1. **K0 first, then K1→K6 in order.** K0 is the mobile lens's four confirmed fixes — bugs in
   production, each its own commit (HANDOFF §8: fix bugs you find regardless of origin). Don't
   start a slice until the previous one's _Done when_ is fully green.
2. **Read only the Context Capsule files.** Every anchor below was verified on 2026-09-02 at
   `59e55a81` by matching the QUOTED code (a verifier script matched 92 of the readers' quoted lines at HEAD, and the K0/K2 capsule lines were
   re-read by hand; the two mismatches were the verifier's own shell escaping);
   match on the quoted code, not the line number.
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
   — and **boot `pnpm dev` once in any slice that adds a shared runtime value** (K4 does: the
   recipe registry's ids — HANDOFF §7).
8. **Every slice ships its mobile surface in the same slice** (owner rule). Measure it in a
   browser at 375×812 AND 812×375 (`?mobile=true`; pin tab identity with `?sessionUid=`; drive
   `location.href` from javascript_tool — the pane's `navigate` strips queries). Don't compute it.
9. **Fix bugs found mid-arc regardless of origin**, each in its own commit. §2.1 already lists
   seven pre-existing ones the recon found; they are assigned to slices below.
10. **Size every review workflow to FINISH:** one finder (or two) plus two refuters per finding,
    ≤14 agents; check `agents_error` and `git status` after every run; a refuter-less result is
    VOID. The mobile lens in §0.1 is the shape.

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
  **ROLL** (Enter). Seconds later the whole table is standing in the new place behind the iris,
  fog on, the camera on the party, a toast naming where they are. The Atlas tree shows the new
  node **under** the one you were on. On the map you left there is now a 🚪 sprite where the
  party stood; on the new map, a 🚪 sprite where they arrived leads **back** — click it (confirm)
  and the old scene resumes exactly as it stood. Two inputs (G, Enter) for the repeat kick; the
  panel remembers your last recipe and dials.
- **Phone:** dock **DM** → the screen's second verb, **🚪 Kick in a door** (beside _🏗️ Edit the
  live map_) → the same fields as a bottom sheet → **ROLL**. The sheet closes, an _⏳ Kicking…_
  chip sits over the dock until the iris fires, then the arrival toast. Two taps to the sheet.
- **Also from the Atlas tab** (both platforms): a **🚪 KICK IN A DOOR** button opens the same
  panel — discoverability for a DM who does not know the key.
- **Buildings (K4):** pick _building_ and a kind — **tavern / shop / warehouse / house** — and the
  new node is a `building` whose interior is a rectangular footprint partitioned into rooms with
  shared walls, interior doors, ONE front door on the side the party enters from (the arrival
  zone is just inside it), a light per room, DM-only room keys on the notes layer, and the
  furniture the shipped catalog can offer (tables, crates, a lamp — this arc commissions no art).
- **Cartridge Codes (K5, if budget remains):** a 📼 on any generated node copies a short code;
  paste it into the kick panel or the generate panel and the same world comes back — same
  geometry, same doors, same keys.

### 1.2 Scope boundaries

**In this arc:** K0's four production fixes; the `atlas-kick` message (one atomic server
composition through `travelToDocument`); the arrival zone (recipe → node → first-visit staging
zone) so the party lands in a room, not in rock; provenance completed (`size` recorded — a real
reproducibility hole today); the scene-keyed "current node" (§2.3); the desktop keystroke + panel,
the Atlas-tab button, the phone verb + sheet + pending chip; the arrival toast; the help entry; a
recipe registry and the **building** recipe (atlas generate + kick surfaces, both platforms);
Cartridge Codes as an optional slice; the journey e2e on both platforms; the user-guide debt the
Atlas arc left (DM guide, player guide, README, a screenshot walkthrough).

**Never in this arc (deferred, §7):** the live-map GENERATE tool's recipe picker (the drag-a-region
surface stays dungeon-only; the registry makes it a follow-up); an _aimed_ kick (choose where the
door goes); reroll-preserving pins (needs per-ELEMENT provenance — `MapElementBase` has none;
VISION's `pass` field never shipped); Bestiary-linked encounter manifests (the `templateId` VISION
calls "reserved" is a commented-out line, `packages/shared/src/index.ts:494`); town / wilderness /
world recipes; furniture art; secret doors in any generated map (still blocked on fog-aware
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
  enforce for travel.
- **Client-side orchestration of the four existing messages was considered and REJECTED.** It
  would produce up to four broadcasts (players could see a sprite pop onto the old map before the
  wipe), it has no atomicity (an at-cap on message 2 orphans the node from message 1), the anchor
  would be measured on a possibly-stale client snapshot (the exact hazard `useAtlasLinkAim.ts:116`
  guards — `if (armed && sceneId !== armedSceneRef.current) cancelLinkAim();`), and `atlas-travel`
  has no cross-attempt guard beyond "am I already there" (`sceneTravel.ts:213`) — a retried
  travel after the DM moved elsewhere yanks the table back. The ack layer retries every message
  3× with the same commandId (`MessageQueueManager.ts:147`), so that hazard is real. **No new
  server→client message is needed either way**: the client learns everything from the snapshot
  (`currentAtlasNodeId` and `compiledScene.sourceDocumentId` both move), which is how the
  generate panel already learns success (`AtlasGeneratePanel.tsx:6-7`).
- **"The current node" is derived from the BINDING, not the scene.** `atlasProjection.ts:35-37`
  `const currentNode = state.liveMapDocumentId ? nodes.find((node) => node.mapDocumentId ===
state.liveMapDocumentId) : undefined;` — while `travelToDocument` keys everything on
  `state.compiledScene?.sourceDocumentId` (`sceneTravel.ts:67`). They diverge after an unbind,
  a publish of another document, or a delete-of-live — the arc's final-review BLOCKER was a guard
  on the wrong one (`sceneTravel.ts:71-79`). During the unbound interlude "you are here" vanishes
  for everyone though the party is plainly standing on the node's map
  (`sceneTravel.contract.test.ts:524-525` pins the divergence). The kick's parent and link
  origin MUST be the scene's node (§4.5), and the projection is aligned with it in K1 (§2.3).
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
  TOKEN convention lands exactly under the token.
- **A generated dungeon has no entrance and no staging zone.** `RecipeOutput` is `{ cells,
elements }` only (`generation/types.ts:44`); `dungeonRecipe` discards the layout's `rooms`
  (`dungeonLayout.ts:41`); `playerStagingZone` is SCENE state, not a map element, and no recipe
  can emit one. So a first visit lands the party at the document's center cell
  (`sceneSuspend.ts:249` `const centerX = Math.floor((document.width / 2 - offsetX) / size);`) —
  which may be solid rock. `placeArrivals` warps travelers on EVERY travel to the destination's
  zone when one exists (`sceneTravel.ts:131-133`), and the zone is in the captured bucket
  (`sceneTravel.contract.test.ts:697` `playerStagingZone: "captured",`) — so an arrival zone set
  on the first visit is legitimately "the entrance", captured and restored like any zone, movable
  with the existing staging tool. §2.2 designs it that way.
- **The START LIVE MAP branch leaks the limbo table's staging zone into the arrival math.**
  `sceneTravel.ts:92-99` never calls `restoreCollections`, so a travel from a never-bound table
  that had a zone set warps the party to THOSE cells on the NEW map. Untested (the limbo test at
  `sceneTravel.contract.test.ts:643` sets no zone). Pre-existing; K1 fixes it in its own commit.
- **`compileOnto` runs OUTSIDE the capture's try/catch** (`sceneTravel.ts:117` vs the `try` at
  `:106-115`): a throw there leaves `state.sceneStates[outgoingId]` written while
  `compiledScene` still points at the outgoing map — a half-traveled room, unbroadcast and
  unsaved. Pre-existing and practically unreachable today; the kick compiles a document minted in
  the same tick, so K1 reorders: compile the destination FIRST (pure), then capture, then install.
- **Provenance is FLAT and drops `size`.** `atlasGenerate.ts:177-182` writes `{ recipeId:
"dungeon", seed, theme, density }` — not `{recipeId, seed, params}` as the handoff said, and
  `size` is not recorded at all, so a node's provenance cannot reproduce its own dimensions. A
  live Cartridge-Codes blocker and a reproducibility bug today; K1 fixes it (own commit) with
  `size` OPTIONAL in the type (pre-arc nodes lack it; K5 shows no code for them).
- **There is no recipe registry.** Both generate doors call `dungeonRecipe` directly
  (`atlasGenerate.ts:132`, `MapStudioMessageHandler.ts:141`); the atlas message carries no recipe
  id at all (`AtlasGenerateMessage`, `atlasGenerate.ts:54-63`); `recipeId: "dungeon"` is a
  literal in the shared provenance type (`atlas.ts:48`), the map-studio wire union
  (`index.ts:969`), both validators (`generationValidators.ts:48` `recipe: z.literal("dungeon"),`;
  `atlasValidators.ts:92` `theme: z.enum(["stone", "wood"]),`), and both `.strict()` params
  schemas. `assertGenerateRequest` ignores its params argument (`recipeContext.ts:53`
  `_params: DungeonParams`). `AtlasNodeKind` already contains `"building"` (`atlas.ts:21`) — the
  node kind exists; only the recipe is missing.
- **`emitGeometry` is already recipe-agnostic** (`dungeonGeometry.ts:51`): it reads only
  `layout.floor / rooms / doorSites` plus the theme's two asset ids, and its wall tracer already
  walls every seam between DIFFERENT rooms (`:165` `} else if (roomOf.get(key) !==
roomOf.get(neighbour)) {`) and omits the wall at every door site (`:171` `for (const site of
layout.doorSites) blocking.delete(edgeKey(site.edge));`). A building recipe that produces a
  layout-shaped value gets sealed shells, shared partition walls, merged runs, the painted halo
  and correctly-rotated closed doors for free — already property-tested at 15 seeds × 3
  densities. The high-value internals (`wallEdgesOf`, `findDoorSites`, `pxX`) are module-private;
  the file is at 338 lines. **What does NOT exist:** a perimeter-door helper (the Room tool's
  `roomBuilder.ts:108-121` emits a closed ring with no door at all), and furniture — the complete
  indoor vocabulary is `objects:table` (2×1), `objects:crate` (1×1) and `objects:lamp`
  (`starterTileObjectAssets.ts:17-41`); no chair, barrel, bed, counter, shelf or chest anywhere,
  and the server cannot import the client's catalog (it hardcodes asset-id strings, as
  `dungeonGeometry.ts:25-26` does). `ctx.layerIds.objects` is resolved and never used
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
- **Where the hook mounts:** `AuthenticatedApp` (`App.tsx:144`) has `snapshot`, `isDM`
  (`:195` `const { isDM: serverIsDM } = useDMRole({ snapshot, uid, send: sendMessage });`),
  `sendMessage`, `activeTool`/`setActiveTool` and `mapStudio` in scope, and `useAtlasLinkAim`
  is mounted there at `:629` — the literal precedent. `App.tsx` is a grandfathered structure
  violator (baseline 713; now 903), so growth there is free at the guard. Zero
  `MainLayoutProps` churn for the hotkey itself; the panel, the tab button and the phone verb
  thread ONE optional prop object (§2.2) — `MainLayoutProps.ts:368` records the A6 convention
  ("OPTIONAL on purpose: the four layout fixtures…").
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
  map-edit)" (`herobyte.css:2104`) — rendered OUTSIDE the lazy chunk's Suspense, 44px by two
  rules, counted by no pin, costing no map. The kick is the second verb.
- **Nothing shows a phone that a multi-second atlas operation is in flight.** `useAtlasActions`
  mints a commandId and throws it away (`useAtlasActions.ts:52`); `AtlasGeneratePanel` has no
  pending state; the only ambient busy chip, `.mobile-dock-saving`, is rendered only by the
  map-edit dock (`MobileMapEditDock.tsx:64`) but its CSS is generic and out of flow
  (`herobyte.css:1299-1316` — it dodges the five columns on purpose). Toasts render on mobile
  above every surface (`MobileLayout.tsx:286`; `Toast.tsx:174` `zIndex: 10000,`).
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
   * optional because production nodes minted before K1 lack it (K5 shows no
   * cartridge code for those). K4 widens the union with the building recipe.
   * DM-only on the wire (whitelist projection — never projected to players).
   */
  recipe?: RecipeProvenance;
  /**
   * Where the party ARRIVES on a first visit: the recipe's entry room as a
   * center-anchored CELL rect in the staging-zone convention. Installed as
   * the scene's playerStagingZone on the first visit only; after that the
   * scene's own captured zone wins (the DM can move it). DM-only on the wire.
   */
  arrival?: PlayerStagingZone;
}

// packages/shared/src/recipes.ts (NEW sub-module — K1 types, K4 grows it; the
// barrel RE-EXPORTS only; RECIPE_IDS is the one runtime value — boot pnpm dev)
export type GenerateSize = "small" | "medium" | "large";
export type GenerateRequest =
  | { recipeId: "dungeon"; theme: "stone" | "wood"; density: "low" | "medium" | "high"; size: GenerateSize }
  | { recipeId: "building"; kind: "tavern" | "shop" | "warehouse" | "house"; size: GenerateSize }; // K4
export type RecipeProvenance = GenerateRequest & { seed: number; size?: GenerateSize };
//   (`size` optional on the PROVENANCE only — see above; required on the REQUEST)
export const RECIPE_IDS = ["dungeon", "building"] as const; // K4 adds "building"

// apps/server/src/domains/generation/types.ts
export interface RecipeOutput {
  cells: TerrainPaintCell[];
  elements: MapElement[];
  /** The entry room, absolute document cells, staging-zone shape (center-anchored). K1. */
  arrival?: PlayerStagingZone;
}
```

**The wire — ONE new ClientMessage, eight becomes nine, same family gate:**

```ts
{
  t: "atlas-kick";
  commandId: string; // client-minted: the recipe's element idPrefix + place-room dedupe key
  nodeId: string; // client-minted uuid: the CHILD node — and the replay guard
  linkId: string; // client-minted uuid: origin → child, at the party's position
  returnLinkId: string; // client-minted uuid: child → origin, at the arrival zone
  name: string; // the child's name, node-name bounds (atlasValidators' existing schema)
  seed: number; // int — rides the message, never minted server-side (§4.8)
  recipe: GenerateRequest;
  linkType: "door" | "stair" | "signpost"; // default "door"
}
```

`atlas-generate-node` gains the same `recipe: GenerateRequest` in place of its flat
`params` + implicit dungeon (K1 for dungeon, K4 for building). Every domain failure answers on
`atlas-error` with `nodeId = message.nodeId` so the client's pending state can match it.

**The kick, server-side — ONE synchronous block in NEW `apps/server/src/ws/handlers/atlasKick.ts`
(the `atlasGenerate.ts` / `sceneTravel.ts` extraction precedent; `AtlasMessageHandler.ts` is at
311 and gains one `case`):**

```
handleAtlasKick(deps, state, uid, roomId, message): RouteHandlerResult
  0. REPLAY: a node with message.nodeId exists → (re-broadcast its document to DMs, the
     generate idiom) → NO_OP. The first attempt is atomic (below), so "node exists" means
     "the whole kick landed" — a replay never re-travels.
  1. ORIGIN: originDocId = state.compiledScene?.sourceDocumentId ?? state.liveMapDocumentId;
     origin = atlasNodes.find(n => n.mapDocumentId === originDocId)   // may be undefined (limbo)
  2. PRE-FLIGHT (state untouched on failure; constant reasons; atlas-error carries nodeId):
     atlasNodes.length + 1 ≤ ATLAS_LIMITS.nodes;
     origin ? atlasLinks.length + 2 ≤ ATLAS_LIMITS.links : true;
     mapStudioService.list(roomId).length + 1 ≤ MAX_SESSION_DOCUMENTS;
     origin ? mapStudioService.get(roomId, origin.mapDocumentId) resolves : true.
  3. ANCHOR (origin only, computed NOW — before anything moves):
     travelers = tokens.filter(isTravelingToken); centroid of their cells (fractional is fine)
     → gridCellToWorldPoint(state.gridSize, centroid) → inverseTransformScenePoint(mapTransform
     of the "map" sceneObject, if any) → createLink clamps. Zero travelers → the compiled
     scene's center {width/2, height/2}. Never refuse for lack of tokens (a solo prep is normal).
  4. CASH: node = { id, kind: kindOf(recipe), name, parentId: origin?.id, discovered: false, … }
     (an OBJECT, not yet pushed) → cashNode(deps, state, roomId, node, seed, recipe) — the
     generate core extracted from handleAtlasGenerateNode: mint the document object, resolve
     ctx, assert request + recipe params, run RECIPES[recipe.recipeId], assert budget (all
     pure) → persist → apply (delete-on-apply-failure) → node.mapDocumentId, node.recipe
     (with size), node.arrival ← output.arrival. Any failure returns atlas-error; nothing else
     was mutated (the node object is discarded).
  5. PUSH the node; PUSH the links when origin exists:
       { id: linkId, fromNodeId: origin.id, toNodeId: node.id, anchor, linkType, visibleToPlayers: true }
       { id: returnLinkId, fromNodeId: node.id, toNodeId: origin.id,
         anchor: gridCellToWorldPoint(document.grid.size, node.arrival center), linkType, visibleToPlayers: true }
  6. TRAVEL: handleAtlasTravel(deps, state, uid, roomId, node.id, sendError) — warp on, fog on
     (recipe provenance), firstVisitStagingZone: node.arrival, auto-discover.
  7. return MUTATED  (+ the generate core's own map-studio-document frame to DMs)
```

Steps 4–7 are one synchronous block: no recipient, no racing fork, sees a node without its map, a
link without its node, or a party without its scene. The composition goes THROUGH
`handleAtlasTravel` → `travelToDocument`, never around it (§4.1).

**Arrival zones — how a recipe's entry room becomes where the party lands:**

```
RecipeOutput.arrival            dungeon: the layout's FIRST room (placement order is seeded and
  (K1, dungeonRecipe)           stable); building (K4): the 3×1 strip just inside the front door.
        │                       Absolute document cells, {x, y} = CENTER cell (the zone convention:
        ▼                       placeArrivals spreads ±width/2 around x; useCameraCommands focuses
AtlasNode.arrival               (zone.x + 0.5) * gridSize).
  (cashNode records it; DM-only by the whitelist)
        │
        ▼
SceneTravelOptions.firstVisitStagingZone   handleAtlasTravel passes node.arrival for EVERY travel
        │                                  to the node — it only matters on a FIRST visit:
        ├─ capture-then-restore row: restoreCollections' first-visit branch sets
        │    state.playerStagingZone = options.firstVisitStagingZone (was: undefined)
        ├─ START LIVE MAP row with warp: state.playerStagingZone = options.firstVisitStagingZone
        │    (fixes the limbo-zone leak: the outgoing table's zone no longer places arrivals)
        └─ set-live rows: option absent → identity → START LIVE MAP untouched, exactly as today
        ▼
placeArrivals (unchanged) — the party lands in the entry room; the zone is captured with the
scene and restored on resume, and the DM can move it with the staging tool like any zone.
```

**The client — one App-level hook, one panel rendered by both layouts, one optional prop:**

```
apps/client/src/features/atlas/useKickedInDoor.ts   (App-level, beside useAtlasLinkAim — App.tsx:629)
  inputs: { isDM, snapshot, sendMessage, activeTool, mapEditMode, linkAimActive, toast, onAtlasError-seam }
  state:  open: boolean; pending: { nodeId, name, startedAt } | null; settings (remembered)
  G keydown (window, bubble): ignore when isEditableTarget(target) | !isDM | mapEditMode |
    linkAimActive | any modifier | event.repeat → openKick()
  kick(request): mint nodeId/linkId/returnLinkId/commandId → sendMessage({ t: "atlas-kick", … })
    → pending = {…}; remember settings (localStorage "herobyte:kick:last", try/catch)
  arrival:  snapshot.currentAtlasNodeId === pending.nodeId → pending = null; toastSuccess("🚪 …")
  failure:  atlas-error with nodeId === pending.nodeId (delivered through useServerEventHandlers'
            existing chain via an `onAtlasError` option — single subscriber) → pending = null
  timeout:  20 s → pending = null; toastError("The door didn't budge — try again")
  returns:  KickControls = { open, openKick, closeKick, kick, pending, defaults }

apps/client/src/features/atlas/KickPanel.tsx        (role="dialog" aria-label="Kick in a door";
  the fields of §1.1; Enter = ROLL, Escape = close; data-testid="kick-panel"; the ROLL button
  reads "⏳ KICKING…" and is disabled while pending; seed input inputMode="numeric")
apps/client/src/features/atlas/kickDefaults.ts       (pure: defaultName(nodes, recipe),
  freshSeed() — crypto.getRandomValues signed-32, the useGenerate convention, NOT Math.random —
  and the remembered-settings codec)

MainLayoutProps.kick?: KickControls  (ONE optional field — the A6 convention)
  FloatingPanelsLayout: {isDM && kick?.open && <KickPanel …/>}   (the WorldMapPanel idiom)
  buildDMMenuProps: openKick: props.kick?.openKick   (44 → 45 keys, re-pinned deliberately)
  AtlasTab: 🚪 KICK IN A DOOR button → onOpenKick?.()
  MobileLayout → MobileSurfaces: surface "kick" mounts <KickPanel/> in a MobileScreen; the DM
    screen's second mobile-screen__action verb → setSurface("kick"); ROLL closes the surface
  MobileFloatingControls: {kickPending && <span className="mobile-dock-saving">⏳ Kicking…</span>}
```

**Default names** (the node auto-discovers on arrival, so players see the name at once — never
"Unnamed #3"): `Dungeon`, `Tavern`, `Shop`, `Warehouse`, `House`, with a numeric suffix only on
collision against the DM's own node list (`Dungeon 2`). Editable before ROLL. Kind follows the
recipe: dungeon → `"dungeon"`, building → `"building"`.

**The recipe registry (K1 introduces it with one entry; K4 adds the second):**

```ts
// apps/server/src/domains/generation/recipes.ts
export interface Recipe<P> {
  id: RecipeId;
  nodeKind: AtlasNodeKind;
  assertParams(params: unknown): asserts params is P;   // the gap assertGenerateRequest leaves
  run(seed: number, bounds: CellBounds, params: P, ctx: RecipeContext): RecipeOutput;
  minCols: number; minRows: number;                     // per-recipe floor (buildings may go below 20)
}
export const RECIPES: { [K in RecipeId]: Recipe<…> } = { dungeon, building };  // exhaustive by construction
```

Both atlas doors dispatch through it. The live-map `map-studio-generate` door keeps calling
`dungeonRecipe` directly in this arc — `MapStudioMessageHandler.ts` is at 345 and is NOT touched
(§7 records the picker as the follow-up that extracts its generate case first).

### 2.3 Settled by this plan — attack them in the review, don't relitigate them after

1. **One server message, not four client sends.** §2.1's rejection stands unless the review finds
   an atomicity hole the pre-flight does not close.
2. **G opens the panel; ROLL (Enter) fires — the key never generates by itself.** A bare keypress
   that moves the whole table is a mis-press disaster with a two-click undo; VISION's own Maya
   beat is _"She presses G. Sewer, medium, adjacent. ROLL."_ — a panel; and G, Enter is inside the
   two-input rule. The panel remembers, so the repeat kick is exactly two keys.
3. **The kick pins TWO doors** — out at the party's position, back at the arrival zone. The
   return door is the one-click undo and the "door you came through"; it costs one more push into
   `atlasLinks` and one more cap term.
4. **Arrival zones are scene state, installed on the first visit from the node's `arrival`.** Not
   a synthetic zone re-derived on every resume (the captured one wins after the first visit), not
   a new bucket, not a new RoomState field.
5. **"The current node" keys on the SCENE.** `projectAtlasFor` derives `currentAtlasNodeId` from
   `compiledScene.sourceDocumentId ?? liveMapDocumentId`. Semantics change: during the unbound
   interlude "you are here" stays truthful; after a publish of another document it names the map
   the party is actually on. The kick, the sprites layer (`currentNodeId`), the world map and the
   Atlas tab all read the same field, so they cannot disagree with the server's parent choice.
6. **The phone verb lives on the DM screen**, beside 🏗️ Edit the live map — not a dock slot
   (pinned at five, and slot five IS the DM menu), not a tool tile (costs map, off-register).
7. **The building recipe reuses `emitGeometry`** by producing a layout-shaped value; furniture is
   the shipped three props, placed by kind; this arc commissions no art and says so in the copy.
8. **Cartridge Codes mean STRUCTURAL identity:** same code → same geometry, doors, keys and
   arrival; element ids differ by `idPrefix` (the commandId). VISION's "bit-identical" is read as
   that; a code-derived idPrefix is §7. The golden fixture is the contract and is NOT regenerated
   in this arc — the `arrival` pin is a NEW assertion beside it, and the golden's `toEqual` is
   narrowed to `{cells, elements}` so the fixture stays byte-identical (the commit body says so).
9. **The live-map GENERATE tool stays dungeon-only in this arc** (§7) — its handler file has 3
   lines of headroom and its picker is a follow-up the registry makes cheap.

---

## 3. Coordinate spaces and the headroom table

**Spaces, once:** tokens and staging zones are **CELLS** (a zone's `x,y` is its CENTER cell; a
token draws at `(cell + 0.5) · gridSize`, no grid offset); link anchors, element transforms and
`RoomBounds` are **DOCUMENT px**; the stage is world px = `cam` applied to document px, with the
raster "map" sceneObject's transform between them when a raster exists (identity for generated
maps). The recipe works in `bounds`-relative cells and emits absolute document px
(`dungeonGeometry.ts:307` `function pxX(cellX: number, bounds: CellBounds, ctx: RecipeContext)`);
`RecipeOutput.arrival` is ABSOLUTE document cells. Two conversions the arc uses, both shared and
already imported server-side: `gridCellToWorldPoint(gridSize, cell)` and
`inverseTransformScenePoint(transform, point)` (`sceneGeometry.ts:107`, `:112`). Live `gridSize`
is `toLiveGridSize(document.grid.size)` (`sceneCompiler.ts:135` — a rounded clamp; identical to the
document's for generated maps, grid 50).

**Headroom (`wc -l`, measured 2026-09-02; the cliff is 348):**

| File                                                                                      |                 Lines |      Headroom | Plan                                                                                                                  |
| ----------------------------------------------------------------------------------------- | --------------------: | ------------: | --------------------------------------------------------------------------------------------------------------------- |
| `apps/client/src/features/map-edit/useMapEditTool.ts`                                     |                   348 |             0 | untouched                                                                                                             |
| `apps/server/src/container.ts`                                                            |                   348 |             0 | untouched                                                                                                             |
| `apps/client/src/features/map-edit/useMapEditState.ts`                                    |                   347 |             1 | untouched                                                                                                             |
| `apps/client/src/features/dm/hooks/useDMContext.ts`                                       |                   347 |             1 | untouched                                                                                                             |
| `apps/server/src/ws/handlers/MapStudioMessageHandler.ts`                                  |                   345 |             3 | **untouched in this arc** (§2.3 #9)                                                                                   |
| `apps/e2e/mobile/mobile-shell.spec.ts`                                                    |                   345 |             3 | untouched; new mobile specs are new files                                                                             |
| `apps/server/src/ws/handlers/RoomMessageHandler.ts`                                       |                   342 |             6 | untouched                                                                                                             |
| `apps/e2e/docs-screenshots.dm.ts`                                                         |                   341 |             7 | K6's walkthrough is a NEW file `docs-screenshots.atlas.ts`                                                            |
| `apps/server/src/domains/generation/dungeonGeometry.ts`                                   |                   338 |            10 | K4 extracts `geometryLattice.ts` (the px/edge helpers, ~36 lines) BEFORE its signature change                         |
| `apps/client/src/features/help/helpTopics.ts`                                             |                   334 |            14 | K2 adds ONE ≤6-line entry; if `prettier` lands it ≥345, split the Atlas topic's entries to `helpTopicsAtlas.ts` first |
| `apps/server/src/domains/room/snapshot/recipientFilter.ts`                                |                   333 |            15 | untouched                                                                                                             |
| `apps/server/src/domains/generation/dungeonLayout.ts`                                     |                   324 |            24 | untouched by K1 (the `arrival` comes from `dungeonRecipe.ts`, 77); K4 must not grow it                                |
| `apps/server/src/middleware/validation.ts`                                                |                   321 |            27 | +1 row (K1); watch it                                                                                                 |
| `apps/client/src/hooks/useKeyboardShortcuts.ts`                                           |                   317 |            31 | untouched — the kick is its own hook                                                                                  |
| `apps/e2e/mobile/mobile-dm.spec.ts`                                                       |                   316 |            32 | untouched; the Atlas-tab sweep fix lands in `mobile-panel-touch-floor.spec.ts` (171)                                  |
| `apps/client/src/features/dm/components/DMMenu.tsx`                                       |                   312 |            36 | +1 prop pass-through (K2)                                                                                             |
| `apps/server/src/ws/handlers/AtlasMessageHandler.ts`                                      |                   311 |            37 | +1 case (K1), the kick body lives in `atlasKick.ts`                                                                   |
| `apps/client/src/layouts/MobileLayout.tsx`                                                |                   289 |            59 | +2 props (K3)                                                                                                         |
| `apps/client/src/hooks/useServerEventHandlers.ts`                                         |                   277 |            71 | +~6 (the `onAtlasError` seam, K2)                                                                                     |
| `apps/client/src/components/layout/MobileFloatingControls.tsx`                            |                   275 |            73 | +1 chip line (K3) — NOT near the cap (the handoff's list was stale)                                                   |
| `apps/server/src/ws/handlers/sceneTravel.ts`                                              |                   265 |            83 | +~12 (K1: the option, the reorder, the zone assignment)                                                               |
| `apps/server/src/domains/room/scene/sceneSuspend.ts`                                      |                   255 |            93 | +~4 (K1)                                                                                                              |
| `apps/e2e/atlas-journey.smoke.spec.ts`                                                    |                   236 |           112 | untouched; the kick journey is a NEW spec                                                                             |
| `apps/client/src/layouts/mobile/MobileSurfaces.tsx`                                       |                   208 |           140 | +~14 (K3: the verb + the surface mount)                                                                               |
| `apps/server/src/ws/handlers/atlasGenerate.ts`                                            |                   189 |           159 | K1 splits `cashNode` out (`atlasCash.ts`) so both doors share it                                                      |
| `apps/client/src/features/atlas/AtlasTab.tsx`                                             |                   141 |           207 | +1 button (K2)                                                                                                        |
| `apps/client/src/features/atlas/AtlasLinksLayer.tsx`                                      |                   144 |           204 | K0                                                                                                                    |
| `apps/client/src/ui/MapBoard.tsx` / `App.tsx` / `MainLayoutProps.ts` / `messageRouter.ts` | 979 / 903 / 453 / 779 | grandfathered | small additions are free at the guard; extract nothing here                                                           |

---

## 4. Arc invariants (numbered; every slice cites the ones it proves)

- **4.1 Through `travelToDocument`, never around it.** The kick's travel is
  `handleAtlasTravel`; any new way to change the map on the table that bypasses `sceneTravel.ts`
  is the next review's BLOCKER (the handoff's exact words).
- **4.2 One synchronous block, one broadcast, one frame per recipient.** `atlasKick.ts` is
  await-free; the contract test asserts `toHaveLength(1)` on both sockets, after `flush()`.
- **4.3 Validate-then-persist across the WHOLE composition.** Pre-flight every cap before any
  mutation; run the recipe pure; persist the document; apply with delete-on-failure; only then
  push the node and links. A failure after pre-flight leaves state byte-identical (the test
  fingerprints `JSON.stringify(state)` before and after).
- **4.4 Replay-idempotent on client-minted ids.** `nodeId` exists → NO_OP (+ document
  re-broadcast). The same commandId three times = one dungeon, two links, one travel.
- **4.5 The origin is the SCENE's node** — `compiledScene.sourceDocumentId` first,
  `liveMapDocumentId` second — and `projectAtlasFor` derives `currentAtlasNodeId` the same way.
  The contract suite's orphan-row block (`sceneTravel.contract.test.ts:524`) is extended, never
  bypassed: a kick during the unbound interlude parents under the scene's node and pins its door
  on the scene's map.
- **4.6 Gate first, constant reason; domain failures on `atlas-error` carrying the child
  `nodeId`.** A non-DM kick is nacked on the ATTACKER's socket with `ATLAS_DM_REQUIRED` and state
  untouched; the fixture REGISTERS the attacker in `players`, `uidToWs` AND `clients`
  (`atlasGraph.contract.test.ts:123-137`) or the leak has nowhere to land.
- **4.7 `arrival`, `recipe` (seed, size, kind), and every `sceneStates` byte never reach a
  player.** The projection is a whitelist; the tests assert on KEYS (`"arrival" in node ===
false`, exact key sets) and on ≥9-digit / high-entropy SENTINELS through the structural walk
  (`leakSentinels.ts:27` `sentinelHitsIn`) — with the DM POSITIVE CONTROL
  (`sentinelHits(dmWs, …).length > 0`) so a zero is evidence, not vacuity. Value substrings never
  (CI #828).
- **4.8 The seed rides the message.** Never minted server-side; the client's `freshSeed()` is
  the `useGenerate` crypto convention. Same seed + request + size → the same geometry, twice.
- **4.9 Anchors by the TOKEN convention.** Out: the traveler centroid → `gridCellToWorldPoint`
  → inverse map transform → clamp; back: the arrival center on the new map. Zero travelers →
  scene center, never a refusal.
- **4.10 Arrival zones are scene state.** Installed from `node.arrival` on a FIRST visit only;
  captured/restored thereafter; `placeArrivals` unchanged; the START LIVE MAP branch sets the
  zone only when it WARPS (set-live stays an identity).
- **4.11 Recipes: fixed rolls before conditionals; fresh XOR salts per recipe** (`0x6a09e667`
  and `0x85ebca6b` are the dungeon's, `0x1f123bb5` is reserved — `dungeonRecipe.ts:20-24`);
  kind-grouped emissions SHUFFLE ids (`shuffleIds`, `:70` — sequential ordinals were a kind
  oracle); paint (theme / floor family) never reaches a roll.
- **4.12 The golden fixture is a contract, not a snapshot.** `dungeon-seed1-24x20-stone.json`
  is never regenerated in this arc; the test's `toEqual` narrows to `{cells, elements}` and the
  `arrival` gets its own literal pin; each new recipe ships its own golden with a guard-the-guard
  assertion (`dungeonGeometry.test.ts:338`).
- **4.13 LOC: extract before add** (§3). New specs are new files. `.spec.` counts.
- **4.14 Pinned counts are re-pinned deliberately, with the reason in the commit:** 44 → 45 bag
  keys; everything else unchanged by construction (assert by running the pins).
- **4.15 Mobile in the same slice, measured.** Both orientations; the coarse-pointer 44px rule
  reaches new controls only inside `[data-mobile-surface]` (`herobyte.css:1358`); any Konva
  shape combining fill + stroke + opacity < 1 sets `perfectDrawEnabled={false}`; pending state
  lives at App level so a layout crossing (`mobile-map-edit-resize.spec.ts:12`) cannot drop it.
- **4.16 No new ServerMessage.** The three hand-lists are byte-identical at closure (grep).
- **4.17 The hotkey's guard is the precedent for every bare letter after it:** `isEditableTarget`,
  no modifiers, no `event.repeat`, DM-only, inert while map-edit or an aim holds the axis, and
  it opens a panel — it never mutates state by itself.
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
  armed), `apps/client/src/features/map/useStageEventRouter.ts:95-102` (`shouldPan` negates
  `linkAimMode`), `:117-121` (`if (linkAimMode) { handleLinkAimClick(); return; }`),
  `apps/client/src/hooks/useCamera.ts:171` (`if (touches.length === 1 && shouldPan)`), `:176-184`
  (the pinch branch).
- `apps/client/src/layouts/mobile/MobileSurfaces.tsx:176-182` (the atlas surface mount) and the
  Props screen's mount condition at `:164` (`props.snapshot?.playerPropsEnabled` — it never renders
  without its snapshot field; the atlas surface has no condition at all, and must not simply
  unmount either, or the machine latches on `"atlas"` with nothing on screen).
- Tests to extend: `AtlasLinksLayer.test.tsx` (renders at 7 sites, no tool prop yet),
  `DoorsLayer` tests, `useStageEventRouter` tests, `MobileSurfaces` render tests.

**Changes (one commit each):**

1. **L1** — `AtlasLinksLayer` gains `sceneInputArmed: boolean` (fed from MapBoard as
   `mapEditMode || linkAimMode || drawMode || selectMode`); the hit circle renders
   `listening={!sceneInputArmed}`. Tests: with any of the four armed the hit shape does not
   listen; with none armed it does (prove it can PASS).
2. **L2** — DoorsLayer yields during the aim: `listening={!selectArmed && !linkAimMode}` (plumb
   `linkAimMode`). Test: a link-aim click on a door's hit area reaches the Stage's aim capture
   and does NOT toggle the door.
3. **L3** — the aim no longer freezes the phone camera: remove the two-finger early return while
   `linkAimMode` (pinch zooms; the aim survives), and let a one-finger DRAG pan (`shouldPan`
   keeps `!linkAimMode` only for the mouse path; on touch, Konva fires `tap` only when the finger
   did not move, so a pan can never place a link). Tests: touch drag while armed → camera moves,
   aim still armed; tap → link placed; pinch → zoom, aim still armed. Browser-verify under CDP.
4. **L4** — the atlas surface shows a reconnecting state (or keeps the last discovered list)
   while the snapshot is null — never the first-run empty copy, and never an UNMOUNTED surface
   (the machine would latch on `"atlas"` with nothing on screen, the finder's dropped
   candidate). Test: snapshot null after a prior list → no empty-state copy, the screen still
   mounted; prove the healthy path still renders the list.

**Done when:** gate green; sabotage 4/4 red; on a phone (CDP): a brush tap on a badge paints
and does NOT prompt; an aim tap on a door places the link; a pinch while aimed zooms; a
reconnect keeps the world map's rows. `mobile-atlas.spec.ts` gains the sprite-tap leg.
**Traps:** the second-finger-cancel semantics belong to map-edit DRAGS (`useMapEditCancel`), not
to a one-shot aim — don't remove them there. **Escalate if:** the pinch path needs
`useTouchGestureRouter` to learn a new tool kind — that is a design change; report it.

---

### K1 🔴 — `atlas-kick`, the server composition (the keystone)

**Goal:** one message mints the child under the scene's node, cashes it, pins two doors, and
travels — proven by contract tests before any UI exists. Plus the four pre-existing bugs the
recon found on this path, each its own commit FIRST: (a) provenance records `size`; (b) the
limbo-zone leak; (c) compile-before-capture; (d) the stale `default:` comment in the atlas
switch (with the case).

**Context capsule:**

- `apps/server/src/ws/handlers/sceneTravel.ts:45-52` (`SceneTravelOptions` — gains
  `firstVisitStagingZone?`), `:59-134` (`travelToDocument`: the re-attach row `:80`, the START
  LIVE MAP row `:92-99` — `:94` `state.fogEnabled = options.firstVisitFogEnabled;`, `:96`
  `placeArrivals(state, travelers, document, options.rng);` — the capture `:105-115`, the
  compile `:117`, the consume `:126`), `:188-250` (`handleAtlasTravel` — `:213` the
  already-there row, `:242` `firstVisitFogEnabled: node.recipe ? true : state.fogEnabled,`).
- `apps/server/src/domains/room/scene/sceneSuspend.ts:34-41` (`isTravelingToken`), `:137-140`
  (`RestoreOptions`), `:197-215` (the first-visit branch — `:212` `state.playerStagingZone =
undefined;` becomes the option), `:231-255` (`placeArrivals`, unchanged).
- `apps/server/src/ws/handlers/atlasGenerate.ts:36-40` (`GENERATE_PRESETS`), `:54-63` (the
  message shape — becomes `recipe: GenerateRequest`), `:68-189` (`handleAtlasGenerateNode` —
  the core `:110-183` extracts to `cashNode` in NEW `atlasCash.ts`; `:176-182` the provenance
  write gains `size` and `arrival`).
- `apps/server/src/ws/handlers/AtlasMessageHandler.ts:34` (`ATLAS_DM_REQUIRED`), `:60-65` (the
  family gate), `:68-110` (the switch — `+ case "atlas-kick"`; the `default:` comment at
  `:107-108` is stale: "Future atlas-\* types (generate, travel)"), `:113-121` (`error` —
  reuse), `:123-148` (`createNode` — the cap and parent checks the pre-flight mirrors), `:263-295`
  (`createLink` — the anchor clamp `:286-289`).
- `apps/server/src/domains/room/snapshot/atlasProjection.ts:35-37` (the current-node
  derivation — becomes scene-first), `:54-59` (the whitelist constructor — `arrival` and the
  widened `recipe` are simply absent).
- `apps/server/src/domains/generation/dungeonRecipe.ts:26-51` (returns `{cells, elements}`;
  `layout.rooms[0]` is the arrival), `types.ts:44-47` (`RecipeOutput` + `arrival?`),
  `recipeContext.ts:53` (`assertGenerateRequest` — the registry's `assertParams` replaces the
  ignored `_params`), NEW `recipes.ts` (§2.2).
- `apps/server/src/middleware/validators/atlasValidators.ts:85-97` (`generateNodeSchema` —
  becomes a `recipe` discriminated union; top level NOT `.strict()` because the ack layer stamps
  `commandId`, nested objects strict — `:6-7`), `:134-141` (the travel pair — the kick's
  validator twin), `apps/server/src/middleware/validation.ts:231-238` (the ATLAS block of the
  exhaustive table — a missing row is a `tsc` error), `packages/shared/src/index.ts:985-1012`
  (the atlas ClientMessage block — the ninth member), `packages/shared/src/atlas.ts:47-52`
  (`recipe`), `:131` (`playerStagingZone` on SceneState — the zone TYPE to reuse for `arrival`).
- Persistence: `apps/server/src/middleware/validators/sessionValidators.ts:82-96`
  (`SNAPSHOT_LIMITS` — unchanged: no new collection), the atlas node schema in the same file
  (gains optional `arrival` + the widened `recipe`), `apps/server/src/ws/__tests__/
sessionRoundTrip.contract.test.ts:294-313` (the fixture — populate `arrival` and `recipe.size`
  with sentinels so the sweep is not vacuous).
- Templates: `apps/server/src/ws/__tests__/atlasGraph.contract.test.ts` (13-arg router
  `:140-154`, `fakeSocket`/`messagesOf`/`latestSnapshot`, sentinels `:47-49`, the attacker test
  `:214-232`, the positive controls `:328-329`), `sceneTravel.contract.test.ts` (`flush()` `:52`,
  the drain-before-clear trap `:467-469`, one-frame `:267-268`, the orphan-row block `:524`, the
  limbo row `:643`, `FIELD_BUCKETS` `:688-724`).
- Geometry: `packages/shared/src/sceneGeometry.ts:107-109` (`gridCellToWorldPoint`), `:112`
  (`inverseTransformScenePoint`), `apps/server/src/domains/room/scene/visionFilter.ts:41-43`
  (the map-transform lookup to copy).

**Changes:**

1. Bug (a): `cashNode` records `size` in provenance; type `size?: GenerateSize`; round-trip test
   pins it; the `atlasGraph` provenance test (`:485-490`) extends.
2. Bug (b): the START LIVE MAP branch sets `state.playerStagingZone = options.firstVisitStagingZone`
   when it WARPS; contract test: limbo table with a zone at (12,14) → travel to a linked map →
   the party lands at the document center, not (12,14); set-live from the same table → zone
   untouched (prove the identity).
3. Bug (c): `travelToDocument` compiles the destination BEFORE capturing the outgoing scene;
   test: a `compileScene` that throws leaves `sceneStates` and `compiledScene` untouched.
4. `RecipeOutput.arrival`; `dungeonRecipe` reports its first room as a center-anchored zone; the
   golden test narrows to `{cells, elements}` + a literal `arrival` pin (§4.12).
5. `recipes.ts` registry (one entry), `GenerateRequest` in shared `recipes.ts` (types + the
   `RECIPE_IDS` const in the sub-module; barrel re-export; boot `pnpm dev`);
   `atlas-generate-node` takes `recipe`; `AtlasNode.arrival`; the projection's scene-first
   current node.
6. `handleAtlasTravel` passes `firstVisitStagingZone: node.arrival`; `restoreCollections`'
   first-visit branch installs it.
7. NEW `atlasKick.ts` per §2.2; validator + table row + shared union + the switch case (and the
   comment fix, (d)).
8. Client-side type plumbing only where `tsc` demands it (`useAtlasActions` `generateNode` takes
   `recipe`) — the UI is K2.

**Tests (the heart of the slice — through the REAL router, per §4.6's fixture):** the happy path
(node under the scene's node with `parentId`; document with the preset's dimensions; provenance
with `size`; `arrival` inside the document and inside a floor cell; TWO links — out at the
traveler centroid in doc px (assert the exact px from known cells: tokens at (4,4) and (6,6) on
grid 50 → (275, 275)), back at the arrival center; the party inside the arrival zone (containment,
rng injected); fog on; discovered; `currentAtlasNodeId` = the child; exactly ONE snapshot per
recipient; the DM's `map-studio-document` frame); replay (same message ×3 → one document, two
links, one travel, `NO_OP` on 2 and 3, still one frame each); pre-flight (nodes at 64, links at
255, documents at 64, missing origin document → `atlas-error` with the child `nodeId`, state
fingerprint unchanged); recipe/apply failure → nothing persisted, no node, no links; the unbound
interlude (set-live null then kick → parent = the scene's node, door on the scene's map — the
orphan-row block extended); limbo (no compiled scene → root node, no links, party warped to the
arrival zone, fog on); zero travelers → anchor at the scene center; a raster map with a moved
"map" transform → the anchor goes through the inverse transform (assert via the sprite's doc
point); non-DM → constant reason on the attacker's socket, state untouched; secrecy — sentinel
seed (≥9 digits), sentinel arrival cell (a 9-digit x is out of range — use the name and seed
sentinels and assert `"arrival"`/`"recipe"`/`"sceneStates"` absent by KEY on every player frame
during the whole dance, with the DM positive control); the projection unit tests for the
scene-first current node (unbound interlude → still the node; publish-of-another → that map's
node; nothing on the table → undefined); `FIELD_BUCKETS` untouched (no RoomState field — assert
by running it); the session sweep with populated `arrival` and `size`; the validators
(`atlasValidation.test.ts` gains the kick variations and the strict-params rejection).

**Done when:** gate green; sabotage every rule (≥14: each cap, the replay guard, the order —
push-before-persist goes red, both anchors, the zone install, the scene-first origin, the
projection, the size, the limbo zone, the compile order, the attacker socket); console harness
(`window.__HERO_BYTE_E2E__.sendMessage({ t: "atlas-kick", … })`) on the dev table with a player
tab open: the party lands in a room, both doors render, the player's world map gains the child,
the return door travels back and the origin resumes.
**Traps:** `handleAtlasTravel`'s already-there row would NO_OP a kick whose node is somehow
already live — unreachable after the replay guard, but assert it; the 16 ms debounce — `flush()`
25 ms before reading frames, and DRAIN before `mockClear` (`:467-469`); `structuredClone` the
captured zone; `atlasValidators` top-level must not be `.strict()`; the projection change moves
`currentAtlasNodeId` for the journey spec's expectations — re-read them, they hold (travel binds).
**Escalate if:** the composition cannot stay one synchronous block (some step wants an await —
report, do not thread a promise); or `arrival` wants to live anywhere but the node.

**🔎 SENIOR REVIEW GATE:** state-machine lens (every §2.2 step vs every transition-table row of
the Atlas plan, replay, pre-flight), privacy lens (`arrival`/`recipe`/frames on the attacker's
socket) — lens-sized workflows, ≤14 agents each.

---

### K2 🟡 — G: the keystroke, the panel, the arrival (desktop)

**Goal:** the DM's experience of §1.1 on desktop. Plus two pre-existing hotkey bugs, own commits
first: the bare `r` without `isEditableTarget` (`useMapEditPlacement.ts:112`) and
`useKeyboardNavigation.ts:27`'s hand-rolled editable check → the shared helper.

**Context capsule:**

- `apps/client/src/ui/App.tsx:629-634` (the `useAtlasLinkAim` mount — mount `useKickedInDoor`
  right after it, before `useKeyboardShortcuts` at `:637`; inputs in scope: `snapshot`,
  `isDM`, `sendMessage`, `activeTool`, `mapEditMode`, `linkAimActive`, the toast object).
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
  idiom) and `apps/client/src/layouts/FloatingPanelsLayout.tsx:184` (`{!isDM && <WorldMapPanel
snapshot={snapshot} />}` — the KickPanel mounts beside it, `isDM && kick?.open`).
- `apps/client/src/layouts/props/MainLayoutProps.ts:368-…` (the A6 optional-prop block — add
  `kick?: KickControls`), `apps/client/src/features/dm/buildDMMenuProps.ts:105-111` (add
  `openKick: props.kick?.openKick` — the exhaustive key test at `buildDMMenuProps.test.ts:93-139`
  re-pins 44 → 45), `DMMenu.tsx:186-196` (the AtlasTab mount — pass `onOpenKick`),
  `AtlasTab.tsx:76-83` (the create-node row — the 🚪 button sits beside it).
- `apps/client/src/hooks/useCameraCommands.ts:88-113` (arrival already focuses the zone center —
  K1's `arrival` makes it land on the party for free) and
  `apps/client/src/features/map/MapTransitionOverlay.tsx:44-51` (the iris already fires on
  A→B). The kick adds only the toast.
- `apps/client/src/features/help/helpTopics.ts:62-93` (the Atlas topic — ONE new entry;
  `help-panel.spec.ts:76` and `mobile-help.spec.ts:104` stay at 9 / 14 — assert by running them).
- Hotkey precedents: `useKeyboardShortcuts.ts:167` (`if (isEditableTarget(e.target)) return;`),
  `:302` (window keydown, bubble), `useToolMode.ts:133`; the two capture-phase Escape handlers
  (`MapEditQuickWheel.tsx:71`, `useMapEditCancel.ts:81`) never swallow a letter.

**Changes:** `useKickedInDoor.ts`, `KickPanel.tsx`, `kickDefaults.ts` per §2.2; the
`MainLayoutProps.kick` prop; FloatingPanelsLayout mount; the Atlas-tab button through the bag
(45 keys); `onAtlasError` seam; the arrival toast (`toastSuccess`, 4 s, naming the node); the
help entry; the remembered settings (localStorage, try/catch, versioned key); the two hotkey bug
fixes (own commits).

**Tests:** hook — G opens (not with Ctrl/Meta/Alt, not on `repeat`, not when a field is focused,
not for a player, not in map-edit, not while the aim is armed); Escape closes; `kick()` sends
exactly one `atlas-kick` with four distinct client-minted ids and the remembered settings; pending
clears on `currentAtlasNodeId === nodeId` and toasts; clears on a matching `atlas-error`
(nodeId match — a foreign error does not clear it); the 20 s timeout toasts and clears; settings
survive a remount; `defaultName` (collision suffix; kind label per recipe); `freshSeed` is an
int32. Panel — render states, Enter/Escape, disabled while pending, `inputMode="numeric"` on the
seed, accessible names. Bag — the 45-key pin re-pinned WITH the reason; deleting the mapping
line goes red (the M4b sentinel idiom). Hotkey fixes — `r` in an input no longer rotates; Delete
in a `<select>` no longer deletes. **Prove the arrival detection can PASS** (a healthy snapshot
sequence clears pending) and not only fire.

**Done when:** gate green; sabotage every rule; browser: G → panel → ROLL on the dev table with a
player tab — the iris, the camera on the party in a room, the toast, both sprites, the world map
row on the player; the return door click → confirm → the old scene resumes; the Atlas-tab button
opens the same panel; typing G in the chat box does nothing.
**Traps:** `helpTopics.ts` at 334 (§3); the e2e journey's `dm.on("dialog")` acceptor would
auto-accept any NEW confirm — the kick adds none; `registerServerEventHandler` is
single-subscriber — never register a second handler for `atlas-error`.
**Escalate if:** the panel needs data the snapshot + the DM's node list do not carry.

---

### K3 🟡 — The phone: the verb, the sheet, the chip

**Goal:** §1.1's phone flow, measured. Plus the Atlas-tab gap in the touch-floor sweep (own
commit).

**Context capsule:**

- `apps/client/src/layouts/mobile/MobileSurfaces.tsx:127-160` (the DM screen: the verb at
  `:134-140` `className="mobile-chip mobile-screen__action"` → the SECOND verb copies it and
  calls `setSurface("kick")`), `:176-182` (a surface mount to copy for `"kick"`, gated `isDM`),
  `apps/client/src/hooks/useMobileSurface.ts:13` (the union + `"kick"`), `:133-137` (the
  rising-edge rule — ROLL closes the surface the way arming does),
  `apps/client/src/layouts/mobile/MobileScreen.tsx` (the full-screen host; its ✕ is the close).
- `apps/client/src/components/layout/MobileFloatingControls.tsx:204-272` (the player dock nav —
  the pending chip renders inside it, out of flow), `apps/client/src/components/layout/MobileMapEditDock.tsx:57-64`
  (the `.mobile-dock-saving` idiom and why it has no `aria-live`), `apps/client/src/theme/herobyte.css:1291-1316`
  (the chip's CSS — reused, not duplicated), `:2104-2110` (`.mobile-screen__action`), `:1337-1358`
  (the coarse-pointer floor scoped to `[data-mobile-surface]` — the sheet's controls need the
  attribute on the surface root).
- `apps/client/src/layouts/MobileLayout.tsx:115` (the machine), `:286` (toasts mount — the
  arrival toast is free).
- Specs: `apps/e2e/mobile/mobile-atlas.spec.ts` (the template: two 375×812 contexts, seam
  elevation, `openDMScreen`, `waitForFunction` on the seam with 30 s, teardown deleting nodes +
  documents + links — ADD links), `apps/e2e/mobile/mobile-panel-touch-floor.spec.ts:115` (the
  DM-tab loop lists five tabs — add `"Atlas"`; if the Atlas tab's generate panel has a sub-44px
  control the sweep will now say so — fix it, do not shrink the loop), `mobile.helpers.ts:20`
  (`joinMobileTable`), `touch.helpers.ts:83` (`touchTap`), `mobile-dm.spec.ts:176-198` (every
  tab view measured against the viewport width — the new button must not spill).

**Changes:** the verb; the `"kick"` surface mounting `<KickPanel>` inside a `MobileScreen`
titled _Kick in a door_ (`data-mobile-surface="kick"`); ROLL → `kick()` + `setSurface("none")`;
the pending chip on the player dock; `MobileLayout` passes `kick` down; the touch-floor loop
gains "Atlas".

**Tests:** unit — the verb renders for a DM only and sets the surface; the surface mounts the
panel (a render test — the machine test cannot see a missing mount, the A6 lesson); the chip
renders iff `pending`; one-open-surface holds. E2E NEW `apps/e2e/mobile/mobile-kick.spec.ts`:
DM (seam-elevated) → dock DM → 🚪 Kick in a door → the sheet's controls all ≥ 44px
(`undersizedControls(page, "[data-mobile-surface='kick']")`) in BOTH orientations → name
"Cellar" → ROLL → `currentAtlasNodeId` becomes the node named Cellar with a parent (30 s) → the
chip was visible while pending (assert before the arrival, race-tolerant: `toBeVisible` then
`toBeHidden`) → player: Tools → World → `you are here: Cellar`; teardown.

**Done when:** gate green; sabotage every rule; measured on a phone viewport in both
orientations: the verb is 44px, the sheet fits and scrolls, the chip sits above the dock without
touching the five columns, the iris and the arrival toast show; the DM screen is gone when the
iris fires (ROLL left the screen — the finder's "the DM never sees the wipe" concern is answered
by the verb leaving the screen).
**Traps:** `mobile-shell.spec.ts` is at 345 — new assertions go in the new spec; the chip must be
`pointer-events: none` (it floats over the canvas the DM taps through); `?mobile=true` on the
`goto`, never via `navigate`; two same-origin tabs share the uid — two contexts.
**Escalate if:** the sheet wants a sixth dock slot or a tool tile — settled (§2.3 #6).

---

### K4 🔴 — The building recipe

**Goal:** `recipeId: "building"` — tavern / shop / warehouse / house — cashable from the Atlas
generate panel and the kick, on both platforms, deterministic, sealed, entered by ONE front door,
stocked with DM-only keys, furnished with what the catalog has. `MAX_STAMP_ELEMENTS` finally
enforced.

**Context capsule:**

- `apps/server/src/domains/generation/dungeonGeometry.ts:24-34` (`THEME_FLOOR`/`THEME_WALL` —
  `emitGeometry` takes explicit `{floorAssetId, wallAssetId}` instead; the dungeon passes its
  theme map), `:51` (`emitGeometry(layout, bounds, params, ctx, nextId?)`), `:154-190`
  (`wallEdgesOf` + `mergeRuns` — the seam rule at `:165`, the door-site omission `:171`),
  `:268-301` (`emitDoors` — closed doors, rotation by seam), `:303-338` (the lattice helpers →
  NEW `geometryLattice.ts` FIRST, the file is at 338), `dungeonLayout.ts:41` (`DungeonLayout`
  — alias `RecipeLayout`, export the interface), `:107` (the fixed-4-rolls discipline),
  `:139` (`touchesWithMargin` — WRONG for buildings: partitions share walls, zero gap),
  `:146` (`indexRoomCells` — reusable as-is), `:260` (`findDoorSites` — corridor-specific;
  buildings need a seam-middle picker), `dungeonStocking.ts:23-32` (`ROOM_KEYS`), `:42-59` (the
  fixed roll block), `:106-134` (`markerFor` — notes layer, `visibleToPlayers: false`, NOT
  hidden), `dungeonRecipe.ts:20-24` (the salts — mint NEW ones), `:70` (`shuffleIds` — reuse),
  `types.ts:55-70` (`MAX_RECIPE_CELLS`, `MAX_RECIPE_ELEMENTS`, the unenforced
  `MAX_GEOMETRY_ELEMENTS`/`MAX_STAMP_ELEMENTS`), `:87-88` (the 20×20 floor is a DUNGEON
  finding; the registry's per-recipe `minCols/minRows` lets a house be 16×12; the `small`
  preset still clears both), `recipeContext.ts:41` (`layerIds.objects` — finally used).
- Vocabulary: `apps/client/src/features/map-studio/starterTileObjectAssets.ts:17-41` (crate 1×1
  wall-biased, table 2×1 open-biased, lamp emissive), `starterTileAssets.ts` floors —
  `terrain:wood-floor` (plank), `terrain:wood-walnut`, `terrain:wood-grey`, `terrain:stone-floor`
  (flagstone), `terrain:stone-cobble`; walls `terrain:wall-stone|brick|timber|dark`
  (`starterTileStructureAssets.ts:27-66`) — brick and dark are free theme slots. Stamps carry
  document-px `width/height` (`mapStudioTypes.ts:52-55`); position by `transform.x/y`. The
  server hardcodes the strings (no shared registry) — a CLIENT-side test asserts the recipe's
  ids ⊂ the catalog (only the client can see both).
- `packages/shared/src/atlas.ts:47-52` → the `RecipeProvenance` union (K1's `recipes.ts`),
  `apps/server/src/middleware/validators/atlasValidators.ts:85-97` (the `recipe` discriminated
  union grows a member — `z.discriminatedUnion("recipeId", …)`, params strict), the fixtures
  carrying literal `recipeId: "dungeon"` records (`StatePersistence.test.ts:99`,
  `atlasProjection.test.ts:49,67`, `sessionRoundTrip.contract.test.ts:301`) stay valid.
- Client: `AtlasGeneratePanel.tsx` + `KickPanel.tsx` gain the recipe picker with per-recipe
  dials (kind for buildings; theme + density for dungeons); `useAtlasActions.ts:13`
  (`AtlasGenerateParams` → `GenerateRequest`); the mobile DM screen measures both panels.
- Golden: `apps/server/src/domains/generation/__tests__/dungeonGeometry.test.ts:322-339` (the
  pattern, incl. the guard-the-guard `:338`), `__tests__/fixtures/` (a sibling
  `building-seed1-24x20-tavern.json`), `SnapshotSizeGuard.test.ts:114-128` (the maxed-output
  twin), `generateDungeon.contract.test.ts:374` (the marker-leak test — a building twin).

**Changes:** `geometryLattice.ts` extraction (first); `emitGeometry` takes asset ids; NEW
`buildingLayout.ts` (footprint = bounds inset 1; seeded BSP partitions, min room 4×3, fixed
rolls per split, zero-gap; `indexRoomCells`; one interior door per shared seam at its middle
cell; ONE front door on `entrySide` (a param, default `"south"`, the middle of that side —
never a roll, so the kick can later face the party); `arrival` = the 3×1 strip inside it),
NEW `buildingRecipe.ts` (kind → floor + wall ids: tavern wood-floor/timber, shop
stone-cobble/brick, warehouse wood-grey/dark, house wood-walnut/timber; `emitGeometry`; a
warm `MapLightElement` per room center; NEW `buildingDressing.ts` — kind-specific keys
(`"PATRONS: 2d4 locals, one of them listening"`, `"LOOT: strongbox under the counter — DC 14"`,
`"EMPTY — closed for the night"`, …) on the notes layer with `visibleToPlayers: false`, and
stamps on the objects layer: tavern → tables in the largest room on a spaced grid, crates in the
smallest; warehouse → crates along walls; shop → tables as a counter row near the front door;
house → one table; fresh salts; `shuffleIds`); registry entry with `minCols: 16, minRows: 12`
and `assertParams`; `assertRecipeBudget` counts stamps against `MAX_STAMP_ELEMENTS`; both
panels' picker; the provenance union; the validator union.

**Tests:** golden (tavern, seed 1, 24×20) with guard-the-guard (≥2 rooms, ≥1 door, ≥1 stamp);
properties over 15 seeds × 4 kinds × 3 presets: exactly ONE perimeter door; every room reachable
through door sites (BFS over floor cells with doors as passable seams); sealed otherwise (no
floor cell touches the outside without a door); every stamp inside a floor cell and off every
door cell; every element inside the document; `arrival` inside the floor and adjacent to the
front door; deterministic (seed) and different across seeds; kind changes paint and dressing but
`entrySide` changes only the door; determinism independent of `idPrefix` (the stocking-stream
test's twin); budgets: the maxed tavern (128×128, `large`) under the snapshot guard and under
`MAX_STAMP_ELEMENTS`; the marker-leak test on a player socket; the client catalog-subset test;
validator — a building `theme` is rejected (strict), a dungeon `kind` is rejected; both panels
render the picker and send the right shape; the kick with `recipe: building` lands a `building`
node (contract); e2e leg (K6's spec carries it: kick a tavern on desktop; generate a shop from the
phone's Atlas chip).

**Done when:** gate green; sabotage every property (weaken BSP → the reachability test goes red;
drop the front door → the perimeter test goes red; …); browser: kick a tavern — the party stands
just inside its door, tables in the common room, fog on, keys DM-only; a shop from the phone.
**Traps:** the 20×20 floor is in THREE places — `recipeContext.ts:130` (`validateBounds`, which
`resolveRecipeContext` runs for EVERY caller, so the registry's per-recipe floor must be PASSED
into it as a parameter with the dungeon's numbers as the default, not "replace" it),
`generationValidators.ts:22` (the live-map door — stays at 20), and `atlasGenerate.test.ts:14`
(every preset clears the floor — still true for a 16×12 house, `small` is 24×20); `touchesWithMargin` is a dungeon idiom; `prettier` on
`dungeonGeometry.ts` — measure after; the golden of a sealed box pins the bug, not the contract;
`ctx.layerIds.objects` requires an UNLOCKED objects layer (already required today).
**Escalate if:** the shared-wall partitions cannot ride `wallEdgesOf`'s seam rule after all (that
is the load-bearing reuse — a fork of the wall tracer is a different slice).

**🔎 SENIOR REVIEW GATE:** determinism / recipe lens (streams, salts, shuffle, golden hygiene,
budgets) — lens-sized.

---

### K5 🟢 — Cartridge Codes (do if budget remains; else §7 — and say so in the banner)

**Goal:** Signature Move 4's minimal honest form: a code on every generated node (with `size`),
pasteable into the kick and generate panels, structural identity CI-pinned.

**Context capsule:** `packages/shared/src/recipes.ts` (K1/K4 — the request union to encode);
`AtlasNodeRow.tsx:33-37` (row state + status glyph — the 📼 button beside 🚩 for mapped nodes
with `recipe.size`); `KickPanel.tsx` / `AtlasGeneratePanel.tsx` (a _📼 paste a code_ field that
prefills the dials — no `window.prompt`, the owner retired the last of those); the golden and
determinism tests (`dungeonGeometry.test.ts:341`); `navigator.clipboard` with a selectable
read-only fallback.

**Changes:** NEW shared `cartridgeCode.ts` — `encode({ ...request, seed })` →
`"HB1-" + base64url(canonical JSON)`; `decode(code)` → the request or `null` (version prefix
checked; shape validated structurally, then the SERVER re-validates through the normal zod path
when the request is sent); the two UI surfaces on both platforms.

**Tests:** round trip; garbage/`HB0-`/truncated → `null`; canonical key order (two encodes of
equal requests are byte-equal); a code from node A pasted into a new kick produces geometry equal
modulo `idPrefix` to A's document (server contract: generate twice from one decoded request
through two nodes); the 📼 hidden for a node without `size`; e2e: copy on desktop, paste on the
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
   `dm.on("dialog")`): DM adopts the live map as node "Hall" (create + LINK EXISTING MAP + TRAVEL
   — the shipped adopt flow), clicks the canvas (blur), presses `g`
   (`page.keyboard.press("g")` — the first bare-letter keystroke in the suite), sees the dialog,
   names it "Cellar", picks _building / tavern_ (K4) or dungeon, ROLL; asserts: arrival
   (`currentAtlasNodeId`), parent = Hall, the party inside `arrival` (seam tokens), fog on, two
   links (`atlasLinks.length === 2`), the player's wire — node key sets exactly
   `[discovered,id,kind,name,parentId]` for Cellar, raw JSON has no `"recipe"`, `"arrival"`,
   `"size"`, `"sceneStates"` KEYS (after a real suspension — the journey's `:173-180` lesson), a
   link with `toNodeId` present (Hall is discovered) — then clicks the return door by projecting
   its anchor through `data.cam` (`readCam`'s math: `screen = anchor · scale + cam`) → confirm →
   Hall resumes (`sourceDocumentId` back, the door state / a drawing survived); teardown deletes
   links, nodes, documents.
2. `apps/e2e/mobile/mobile-kick.spec.ts` (K3) gains the building leg (generate a shop from the
   Atlas chip; world map shows it).
3. Budgets: `SnapshotSizeGuard.test.ts` — a kick's DM frame (a maxed tavern + 2 links) under the
   guard; the 8-scene export/import round trip with a building scene inside the 1 MiB ceiling.
4. Docs: `docs/user-guide/dm-guide.md` gains **The Atlas, travel, and the Kicked-In Door** (the
   Atlas arc's debt included: tab, promises, GENERATE, TRAVEL, discovery, links; then G / 🚪, the
   panel, the return door, buildings, codes); `player-guide.md` gains **The World Map**;
   `README.md`'s table row; NEW `apps/e2e/docs-screenshots.atlas.ts` walkthrough
   (`docs-screenshots.dm.ts` is at 341) and the re-recorded shots; `helpTopics.ts` re-read
   against the guides (the owner's rule: curated in-app prose + links to the guides — the guides
   must exist for the links to mean anything).
5. VISION.md M4 banner: Phase 3 shipped (the Kicked-In Door + building interiors [+ codes]);
   `m4-dungeon-recipe-plan.md` §7.2 and `atlas-arc-plan.md` §7.2 cashed-IOU notes; HANDOFF-NEXT
   §0 + §10 IN THE SAME COMMIT; the SHIPPED banner atop this plan; a memory file.
6. Full ladder end to end, twice; restate every suite count in the final report (re-run, don't
   copy); the three hand-lists grepped byte-identical (§4.16).

**🔎 SENIOR REVIEW GATE (final):** the standing adversarial review of the arc — run as
LENS-SIZED workflows (state-machine, privacy, client/mobile, recipe), each ≤14 agents, each
checked for `agents_error` and followed by a `git status` audit; a completeness critic last.

---

## 6. Failure drills (when X happens, do Y — do not improvise)

| Symptom                                                                        | Cause                                                                                                                                                 | Fix                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `atlas-kick` does nothing, ack success, no error                               | the switch's `default:` throws for unrouted atlas types — so this is the validator ROW missing (tsc) or the client sent a shape zod rejected silently | check the exhaustive table; the strict params; the routing test via the real router |
| A kick minted a node with no map                                               | the node was pushed before the recipe/persist                                                                                                         | §2.2 step order; the fingerprint test                                               |
| Two dungeons after a laggy click                                               | the replay guard keyed on something other than the client-minted `nodeId`                                                                             | §4.4                                                                                |
| The party lands in solid rock                                                  | `arrival` not emitted / not installed on the first visit                                                                                              | K1 step 4 + 6; the containment test                                                 |
| The party lands at the OLD table's staging cells on the new map                | the limbo-zone leak (START LIVE MAP branch warped with the outgoing zone)                                                                             | K1 bug (b)                                                                          |
| The door sprite is off by half a cell / in the wrong place after a raster move | anchor computed in cells or without the inverse map transform                                                                                         | §4.9; the raster-transform test                                                     |
| "You are here" says nothing while the party stands on a node's map             | the projection keyed on the binding                                                                                                                   | §2.3 #5 — scene-first                                                               |
| The kick parents under the wrong node after a publish                          | origin resolved from `liveMapDocumentId` first                                                                                                        | §4.5                                                                                |
| A player's frame carries `arrival` / `size` / `kind`                           | someone spread a node instead of the whitelist constructor                                                                                            | `atlasProjection.ts:54`; the key-set tests                                          |
| `pnpm dev` won't boot after the shared edit; every gate green                  | `RECIPE_IDS` declared in the barrel                                                                                                                   | §4.18; sub-module + boot                                                            |
| G does nothing                                                                 | a field has focus (correct), or the hook mounted below the layout swap and unmounted                                                                  | mount in `AuthenticatedApp`; the render test                                        |
| G fires while typing a node name                                               | the `isEditableTarget` guard missing                                                                                                                  | §4.17 — the `r` bug's lesson                                                        |
| Pending never clears                                                           | arrival detection compares the wrong id, or the `onAtlasError` seam was not wired                                                                     | the hook tests; the 20 s timeout is the backstop, not the fix                       |
| The atlas-error toast disappeared after K2                                     | a second `registerServerEventHandler` call replaced the chain                                                                                         | single-subscriber — use the option                                                  |
| The phone shows the DM screen over the iris                                    | ROLL did not leave the surface                                                                                                                        | K3 — `setSurface("none")` on ROLL                                                   |
| A tap on the return door prompts twice / paints and prompts                    | K0 not applied, or `sceneInputArmed` not plumbed                                                                                                      | K0 L1                                                                               |
| The building's rooms are unreachable / the shell has two doors                 | BSP seam-door picker skipped a seam / the front-door site duplicated                                                                                  | K4's BFS and perimeter properties                                                   |
| The building golden changed after a refactor                                   | a roll moved before a conditional, or a salt collided with the dungeon's                                                                              | §4.11; never "fix" by regenerating                                                  |
| `structure-report` reds a file you did not touch                               | prettier expanded it, or a `??` junk file at the root                                                                                                 | measure after prettier; `git status --porcelain` for root `??`                      |
| Mass e2e failure across unrelated features                                     | harness fault (concurrent build, orphaned ports)                                                                                                      | re-run ONE named spec alone before believing anything                               |

---

## 7. Deferred follow-ups (recorded, not licensed)

- **The live-map GENERATE tool's recipe picker.** Extract `MapStudioMessageHandler.ts`'s generate
  case to `mapStudioGenerate.ts` first (3 lines of headroom), dispatch through the registry,
  widen `map-studio-generate`'s wire union and `generationValidators.ts:48`, add the picker to
  `GeneratePanel` + `MobileGeneratePanel`, and give the dragged region a building's `entrySide`.
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
`/fix-fixture-ripple` for a TS2741 storm (none expected — no required field lands);
`/watch-ci` after any push.

**Glossary:** _kick_ — `atlas-kick`: mint + cash + two links + travel in one block. _origin_ —
the SCENE's node (`compiledScene.sourceDocumentId`), the kick's parent and the outbound door's
map. _arrival_ — a recipe's entry room as a center-anchored CELL rect, recorded on the node,
installed as the scene's staging zone on the first visit. _return door_ — the child→origin link
at the arrival center. _cashNode_ — the generate core both atlas doors share: validate → persist
→ apply → provenance. _the registry_ — `RECIPES[recipeId]`, exhaustive by construction.
_structural identity_ — same request + seed + size → same cells, elements modulo id, arrival.
_the token convention_ — cells to px at cell centers, no grid offset, through the map transform.

**Review-gate sizing** (§0 rule 10): lens-sized workflows, ≤14 agents, two refuters per finding,
`agents_error` checked, `git status` audited; a refuter-less or errored result is unexamined
ground, never a clean pass.

---

## 9. Rev 2 — what the pre-execution adversarial review changed

_Pending. The review runs as separate lens-sized workflows over this document — state-machine /
travel physics of the composition; privacy and wire; client and mobile surfaces; recipe and
determinism — each with two independent refuters per finding. Every finding, its evidence and its
disposition will be recorded here, and the plan's Status line will read Rev 2._
