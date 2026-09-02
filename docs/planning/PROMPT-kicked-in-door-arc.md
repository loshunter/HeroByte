# Handoff — the Atlas is in production; the Kicked-In Door is next

Written 2026-09-02 at `dev` = `d2363361` (this file's commit follows it). Everything below was
verified in this repo on that date, not recalled. Read `docs/planning/HANDOFF-NEXT.md` §2 (the
gate), §5 (traps), §8 (method) and §9 (settled owner decisions) before touching anything — this
file does not repeat them, it curates what the NEXT arc will hit, and it carries the owner's
standing instructions for prompting Claude Fable 5.1 (§7).

## 0. Where things stand, exactly

| Branch | Commit     | State                                                                                                                                                                                                                                                                                |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main` | `a0434d39` | **PRODUCTION**, deployed 2026-09-02 — the whole Atlas arc (A1–A7) plus its final review's four fix commits. CI #838 green with `e2e-full-suite` RUN. Cloudflare chunk-probed, Render restart observed. A FUNCTIONAL DM check on production was NOT run (needs the prod DM password). |
| `dev`  | `d2363361` | The deploy record, one docs commit ahead of `main`. CI #839 green. This handoff lands on top.                                                                                                                                                                                        |

Ladder at last full run (on `8d115c11`, identical code to `main`): shared **424**, server
**2262**, client **~5,483** / 37 batches, e2e **169 passed / 3 skipped / 0 failed**. The arc's
plan — `docs/planning/atlas-arc-plan.md` — wears a completion banner, a SHIPPED banner per slice
recording every deviation and number, and a **FINAL REVIEW** record (below the A7 banner) that
names every finding and its fix commit. Read those banners before touching anything the arc
built; they are the ground truth, and §6 of that plan is the failure-drill table for travel.

## 1. The mission (recommended; the owner may redirect)

**The Kicked-In Door** — VISION.md pillar 1, line 106: _"One keystroke mid-session generates a
fully compiled, playable scene — walls, doors, lights, fog — in seconds, stocked with encounter
markers."_ The Atlas plan's own §7.2 named it "next arc's opener — it finally has targets", and
the M4 banner in VISION.md lists what remains of M4 in order: **building/wilderness/town/world
recipes, the Kicked-In Door, Cartridge Codes UI, reroll-preserving pins.**

The shape that falls out of what exists: one keystroke (desktop) / one dock action (phone)
mints a promise node under the current node, cashes it with the shipped recipe (the atlas
generate path is validate-then-persist, `GENERATE_PRESETS` small/medium/large), pins a link
from the current map at the party's position, and TRAVELS — all through `travelToDocument`,
never around it. That is three shipped mechanisms composed, plus the keystroke, the arrival
choreography, and a **building-interior recipe** so a town's promises cash into something that
is not a dungeon. Cartridge Codes and pins are the natural second half if budget remains.

**Your first deliverable is NOT code — it is the arc plan**, in the house style of
`atlas-arc-plan.md`: recon fan-out first (pin `model` on every recon agent), context capsules
with quoted anchors, small verifiable slices in dependency order, then an **adversarial review
of the plan before execution** — and this time size the review to FINISH (see §3, first trap).
If the owner names a different arc (the fog-aware terrain spike in the Atlas plan's §7.1, the
wilderness recipe, Cartridge Codes), the method is the same; only §1 changes.

## 2. Recon already banked (verify anchors before trusting line-level claims)

- **Travel has ONE composition:** `apps/server/src/ws/handlers/sceneTravel.ts` —
  `travelToDocument` (the §2.2 table in code: re-attach when the destination IS the scene on
  the table; compile-only for the START LIVE MAP row, warping the party if it is a travel;
  capture-then-restore otherwise; resume CONSUMES its `sceneStates` record), `bindLiveDocument`
  (set-live), `handleAtlasTravel` (auto-discovers, even when already live). The pure half is
  `domains/room/scene/sceneSuspend.ts`. Any new way to change the map on the table goes
  through `travelToDocument`, or it will be the next review's BLOCKER.
- **Generation into a node:** `apps/server/src/ws/handlers/atlasGenerate.ts` —
  `handleAtlasGenerateNode` is validate-then-persist (`createMapDocument` is pure; the recipe
  and budget run before anything is stored; delete-on-apply-failure). Presets at
  `GENERATE_PRESETS`; the recipe floor is `MIN_RECIPE_COLS/ROWS` = 20. Provenance
  (`recipe { recipeId, seed, params }`) is recorded on the node; `pinned` does not exist.
- **The atlas wire:** eight `atlas-*` ClientMessages (node CRUD, link-map, create/delete-link,
  generate, travel) behind ONE DM gate with ONE constant reason (`ATLAS_DM_REQUIRED`); domain
  failures answer on the DM-only `atlas-error` channel. A new ServerMessage needs THREE client
  hand-lists (`websocket.ts` config, `MessageRouter` union, the runtime `isControlMessage`
  guard — only the guard changes behavior).
- **Privacy:** `domains/room/snapshot/atlasProjection.ts` is the ONE producer of the player
  view (whitelist constructors; exact-key-set tests). Players never receive: undiscovered
  nodes, `recipe`, `mapDocumentId`, timestamps, a link's `toNodeId` when hidden, ANY
  sceneState. The client mirrors it for the DM's lens in `features/map/playerLens.ts`
  (`visibleAtlasLinks`).
- **Caps:** `SNAPSHOT_LIMITS.atlasNodes` 64 / `atlasLinks` 256 (mirrors `ATLAS_LIMITS`);
  `MAX_SESSION_DOCUMENTS` 64 is enforced on ALL FOUR mint paths (create, import, generate,
  load-session's upsert) and `parseSceneState` is the one scene sanitizer (disk, Redis,
  export, envelope).
- **Client surfaces:** `features/atlas/` — `AtlasTab` (DM), `AtlasNodeRow`,
  `AtlasGeneratePanel`, `AtlasLinkPlacer` (lists this map's links, removable),
  `useAtlasLinkAim` (a one-shot aim on the `ToolMode` axis: `"atlas-link"`; cancels on ESC, a
  second finger, an axis steal, and a scene change), `WorldMapPanel` (player; desktop launcher
  plus the `"atlas"` mobile surface), `useAtlasActions`. `features/map/MapTransitionOverlay.tsx`
  is the iris (layout effect; cover-then-reveal); `useCameraCommands` fires a `focus-point` on
  arrival (zone cell center, else the scene midpoint through the map transform).
- **E2E templates:** `apps/e2e/atlas-journey.smoke.spec.ts` (two contexts, UI-driven
  generate/travel/aim, key-based wire asserts, teardown deletes nodes+links+docs) and
  `apps/e2e/mobile/mobile-atlas.spec.ts` (reachability by finger). Copy their helpers.
- **Budgets, measured:** a both-caps atlas weighs under a third of the snapshot guard; eight
  fat suspended scenes are 260,289 bytes and cost 1.40 ms per synchronous save — no store
  extraction is warranted.

## 3. Traps this arc WILL hit (this arc's scars, on top of HANDOFF §5)

- **Size the adversarial review to FINISH.** The 55-agent arc review died to the session limit
  THREE times; a run whose refuters errored reports `confirmed: []` — that verdict is VOID
  (errored refuters read as refutations). Run lens-sized workflows (one finder plus its
  refuters, about 10 agents), check `agents_error` and `git status` after every run, and
  re-run the `mobile-surface` lens first — it never completed.
- **A same-document "no-op" must key on the SCENE (`compiledScene.sourceDocumentId`), never
  the binding (`liveMapDocumentId`).** They diverge after an unbind, a publish, or a
  delete-of-live; the arc's worst bug was a guard on the wrong one. The contract suite pins
  it (`sceneTravel.contract.test.ts`, the orphan-row block) — extend it, don't bypass it.
- **Konva:** a shape combining `fill` + `stroke` + `opacity < 1` takes the buffer-canvas path,
  and that buffer is STAGE-sized; a 0-size first frame (mobile viewport emulation) throws
  `drawImage` and the error boundary eats the whole table. `perfectDrawEnabled={false}`.
  jsdom cannot see this — only a browser pass can.
- **Pinned counts are a discipline, not an obstacle:** `help-panel.spec.ts` pins the desktop
  topic count (now 9) and `mobile-help.spec.ts` the manual sheet's control count (now 14);
  `buildDMMenuProps.test.ts` pins the bag's exact key set (now 44). Adding a help topic or a
  bag key trips them by design — re-measure and re-pin deliberately, with the reason.
- **Playwright:** role-name matching is SUBSTRING by default (`"🎲 GENERATE"` resolves to every
  `"🎲 Generate…"` — scope to a testid); 🛠️ DM MENU is a TOGGLE (a helper that clicks it
  blindly closes the window and the next locator waits forever — the 180 s-timeout shape
  with a stack pointing at the `finally`); load-session DROPS a suspended scene whose document
  is not in the file (the ghost-scene degrade) — fixtures must mint real documents.
- **The pane browser:** `navigate` STRIPS query strings (drive `location.href` from
  javascript_tool); two same-origin tabs share `herobyte-session-uid` — pin per-tab identity
  with `?sessionUid=<uid>`; `?mobile=true` (not `=1`) forces the mobile layout; mobile
  viewport emulation plus reload can briefly run TWO app instances that 4002-war their own
  uid; seam `d.snapshot` reads race the 16 ms broadcast — re-read after every await.
- **LOC ceilings:** `RoomMessageHandler.ts` 342, `MapStudioMessageHandler.ts` 345,
  `useMapEditState.ts` 346, `CenterCanvasLayout.tsx` 316. The cures the arc used, in order:
  extract a hook (`useFollowLiveDocument.ts`), a types file
  (`useStageEventRouter.types.ts`), delete a stale `@example` prop inventory. Test files are
  NOT counted by the guard (`--include-tests` is off); e2e specs are not either.
- **Sentinels:** at least 9 digits AND high-entropy names; assert secrecy on KEYS
  (`"recipe"`, `"sceneStates"`) never on value substrings (a decimal seed inside epoch soup
  is CI #828). Non-DM tests assert the ATTACKER's socket — the fixture must REGISTER it, or a
  leak has nowhere to land and the test is vacuous (the review's F1).
- **Deploys** (owner's word only): baseline the chunk probe BEFORE merging (a string new to
  the build, absent from production; a control present in both); Render 502s about 45 s on
  restart; players must reload.

## 4. Small open items (none block the arc; fold in opportunistically)

1. **Production functional DM check** — place a link and travel on the live table. Needs the
   production DM password; the owner must supply it or do it themselves. First thing, if the
   password is offered.
2. **Travel from the pre-Atlas limbo** warps the party but deliberately leaves the limbo
   table's raster/drawings in place (START LIVE MAP's protection wins). If a legacy table
   complains about a raster haunting a generated dungeon, this is the recorded decision.
3. **The `mobile-surface` review lens never ran** (see §3). Run it alone before the next plan.
4. Carried from the previous handoff, still open: **Q4** (an in-app "use the desktop layout"
   switch for tablet DMs — an owner design question); **a11y stragglers** (the Initiative
   Modifier dial is a bare div; `GridControl`'s two sliders lack aria-labels); **critic #10**
   (the mobile leg of the `tableVisionDefault` chain has no e2e guard).

## 5. Non-negotiables (the short form; HANDOFF §8 has the full list)

Commit to `dev` as you go; full §2 gate before every commit; prove every new test can fail
(sabotage each rule independently — a pair can mask each other); required options over
optional ones for wiring that must not silently unwire; adversarial review before declaring
an arc done — SIZED TO FINISH — then check `agents_error` and audit `git status`; every slice
ships its mobile surface in the same slice; fix bugs you find regardless of origin, each in
its own commit; merging to `main` deploys and is ALWAYS the owner's word. Update
HANDOFF-NEXT's §0 AND its §10 list in the same commit as the work they describe. Stage files
by explicit path — never a directory (`temp/` is the owner's untracked art).

## 6. Tooling (unchanged from the previous handoff)

`/verify-gates` (gates-runner, sonnet — never bundle plus e2e in one prompt), `/watch-ci`
(ci-watcher, haiku — after every push), `/fix-fixture-ripple` (sonnet) for TS2741 storms,
Graphify (`graphify update .`, leads not evidence), `leakSentinels.ts` for bytes-level
secrecy. The preview harness injects `PORT`; `.claude/launch.json` (gitignored) pins
`PORT=8787` via cross-env.

## 7. Prompting Claude Fable 5.1 — the owner's standing instructions

The owner asked to be reminded of these and for the next agent to work by them. Source:
<https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1>.
The harness already carries several of these blocks; the rest are for the human running the
session and for how the agent conducts itself.

- **Effort.** Start at `high`; sweep `low`/`medium`/`xhigh`/`max` against real evals — the
  names do not map to the same thinking across models. `medium` roughly matches Fable 5 at
  lower cost; `low` often beats smaller models on cost per task. Two effort-specific traps:
  at `low` the model searches less (add the "recognizing a name is not knowing its current
  state — search it as the user wrote it" nudge); at `xhigh`/`max` a long deliverable may be
  drafted twice (in thinking, then as output) — run those at `high`, or append the
  "everything in one reply counts toward about [max_tokens]; do not draft the whole output as
  reasoning" note and leave `max_tokens` room for both.
- **Progress updates.** Fable 5.1 narrates less than Fable 5, more so at higher effort and in
  long tool chains. Progress notes arrive as `thinking` blocks and are EMPTY under the default
  `thinking.display: "omitted"` — set `"updates"` (beta header
  `thinking-display-updates-2026-08-18`) or `"summarized"`. Remove any "hold all findings for
  the final response" lines, then, if still wanted, add: _"Before you start, say in a line
  what you're about to do; brief updates while you work help the user follow along. Close
  with a short recap that stands on its own — what you found, what you did, and what's next."_
  If the UI hides tool output, say so (turn-scoped system message, `clear_at:
"next_user_message"`, beta `mid-conversation-system-clear-at-2026-08-21`): _"Only you see
  that command's output … If the user needs to read any of it, put it in your reply."_
- **Batch independent tool calls.** In coding/computer-use loops the model may issue one
  implied call per turn. Append after each batch of tool results, as a turn-scoped system
  message (a fresh copy each turn; never delete earlier copies): _"First privately list what
  you need next; then request every item that doesn't depend on another's result in this one
  response."_
- **Keep the history append-only.** Replay assistant turns byte-for-byte, thinking blocks
  included; never edit earlier turns (per-turn reminders → turn-scoped system messages;
  instruction/tool changes → mid-conversation system messages; trimming → server-side
  compaction or context editing). New accounts (from 2026-08-31) get a 400 on a replayed
  thinking block whose prefix changed, or drop it with
  `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` (beta
  `thinking-binding-controls-2026-08-01`). Cache reads are cheaper now — compact later.
- **Writing density.** If prose runs long and dense: _"Please remove all mannered prose"_ (or
  the full paragraph defining mannered prose — metaphor and flourish in place of direct
  statement; say what you mean).
- **Formatting in chat.** Fable 5.1 uses LESS bold/headers/lists than earlier models. Drop
  anti-formatting rules; replace with: _"Use lists and bullet points when asked to, or when
  the content is multifaceted enough that they help with clarity. If the person explicitly
  requests minimal formatting, format without bullets, headers, lists, or bold. In
  conversational, personal, or emotional exchanges, keep to plain prose."_
- **Quoting retrieved sources.** It may reproduce source passages unmarked. Add one complete
  example (request → response with the tool calls templated → rationale) showing indirect
  speech with at most one short marked quotation.
- **Finish the whole task.** Two blocks, both already in this harness: the _"You are operating
  autonomously … End your turn only when the task is complete or you are blocked on input only
  the user can provide"_ block (keep its first sentence verbatim), and the _"Delivering
  work"_ scope block (the request is the deliverable; don't narrow, widen, or swap it; do
  everything that doesn't depend on an open question; a decided step is something to run, not
  announce).
- **Compaction summaries (client-side).** Instruct the summarizer to preserve, exactly:
  problems and how they were resolved; options tried or set aside and why; everything asked,
  decided, ruled out, or established as a constraint — stated exactly; where things stand;
  what is still open or promised; hard-to-reconstruct details (names, numbers, dates, exact
  wording, links). Keep the user's words close; condense the model's own reasoning.
- **Scope and tests.** _"If you find a pre-existing bug, performance concern, or behavior the
  task doesn't mention, don't fix, optimize or extend it in this change unless the requested
  behavior cannot work without it; report it as a follow-up. Implement the reading the wording
  most directly supports and state the assumption. Commit tests only where the task asks or
  the repo already keeps tests for this kind of change, sized like neighbors; don't turn
  scratch checks into permanent test files."_ — NOTE the local override: HeroByte's standing
  rule (HANDOFF §8) is "fix bugs you find regardless of origin, each in its own commit" and
  "prove every new test can fail". The owner's repo rule wins here; the general snippet
  governs everything else (no unrequested extensions, no scratch-test sprawl).
- **Safeguard false positives.** Ask "are there any bugs in this program?" rather than "does
  it compile?"; give context for lesser-known languages; keep base64 out of tool output.
- **Targeted edits.** Fable 5.1 rewrites whole files more readily than Fable 5: _"The number
  of tokens used to edit files is best minimized … surgically edit a file rather than rewrite
  the entire thing."_
- **Subagents.** Let the lead keep working while subagents run: the spawn tool returns
  immediately, results arrive in a later user message, a separate tool waits on demand. The
  gates-runner/ci-watcher/workflow pattern here already does this — never poll, never
  hand-read a journal to "check".
- **Vision.** For dense images give the model a crop/zoom tool (or a container with PIL /
  OpenCV); the pane browser's `zoom` action is NOT supported yet — take screenshots and read
  canvas pixels container-locally instead.
