# Handoff — production is clean and the Atlas arc is next

Written 2026-08-31 at `dev` = `41df84a6`. Everything below was verified in this repo on that
date, not recalled. Read `docs/planning/HANDOFF-NEXT.md` §2 (the gate), §5 (traps), §8
(method) and §9 (settled owner decisions) before touching anything — this file does not
repeat them, it curates what the ATLAS arc specifically will hit.

## 0. Where things stand, exactly

| Branch | Commit     | State                                                                                                                                                                  |
| ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` | `a37a068f` | **PRODUCTION**, deployed 2026-08-31 — the mobile arc, its review's nine fixes, fork C's three, the boot watchdog, the sentinel-clock fix. Probe- and browser-verified. |
| `dev`  | `41df84a6` | One docs-only commit ahead (the deploy record). Pushed.                                                                                                                |

Ladder at last full run: shared **424**, server **2191**, client **5426** / 36 batches, e2e
**167 passed / 3 skipped / 0 failed** (`boot-recovery.spec.ts`'s two tests joined). The
planning docs' tactical backlog is EMPTY — every §10 bullet in HANDOFF-NEXT is struck
through. The owner accepted this path on 2026-08-30: watchdog deploy (done), then **the
Atlas arc**.

**One unverified loose end:** CI run **#830** (main, `a37a068f`) — its conclusion was never
read; the watcher hit GitHub's unauthenticated rate limit mid-poll. The SAME sha passed
everything as #829 on dev and the deploy was probe-verified, so this is bookkeeping — but
close it first (one API call) rather than let an unread run become folklore.

## 1. The mission

**The Atlas** (VISION.md Pillar 1, the M4 remainder): the campaign becomes a navigable graph
of linked maps. `AtlasNode { kind, mapDocumentId, parentId, seed, recipeId, discovered }` +
`MapLink { anchor, linkType, visibleToPlayers }`, persisted in the room snapshot; players get
a **discovered-only** projection through the recipient filter; ungenerated nodes are
~100-byte promises; each published node owns a **SceneState** (token positions, door states,
drawings, per-player fog memory, combat state) that travel suspends and resumes — one active
scene per room at launch, behind an iris wipe. Provenance + pinning make reroll-preserving-
edits possible later.

**Your first deliverable is NOT code — it is the arc plan**, in the house style of
`m4-dungeon-recipe-plan.md`: a recon fan-out first, context capsules with quoted anchors,
small verifiable slices in dependency order, then an **adversarial review of the plan before
execution** (that step refuted the m4 plan's client design and it was WRONG three times in
the vision-default plan — the reviews were cheaper than the mistakes).

**The sequencing argument, pre-made:** Atlas-BEFORE-more-recipes. The town recipe needs
buildings-as-promises, which needs the Atlas; the Kicked-In Door needs Atlas targets; the
shipped dungeon recipe is a sufficient sole generator to prove the graph, links, travel and
SceneState end to end. Building interiors then cash the first promise. Argue against this in
the plan if recon disproves it — but this is the default.

## 2. Recon already banked (verify anchors before trusting line-level claims)

- **The graph is in the top hubs.** Graphify (see §4) ranks this codebase's god nodes:
  `RoomState` 250 edges, `ClientMessage` 119, `RoomService` 114, `RoomSnapshot` 111.
  AtlasNode/MapLink/SceneState land in exactly those — so the §3 traps are not maybes.
- **Four import cycles** run through `domains/room/model.ts` (with
  `snapshot/recipientFilter.ts`, `scene/visionFilter.ts`, `selectionSerialization.ts`, and
  the shared barrel). Likely type-only; look while you are in those files, do not "fix"
  blind.
- **`m4-dungeon-recipe-plan.md` §7** is the deferral list this arc cashes; its
  `[G7-SHIPPED]` note is load-bearing: generated dungeons author NO secret doors because
  `mapTerrain` ships the whole floor plan (a doorless seam group is recoverable 202/202).
  **Restoring that dial needs fog-aware terrain** — if SceneState's per-player fog memory
  makes unexplored-terrain stripping feasible, that is this arc's candidate bonus, not a
  side quest to start with.
- **The wire has rules already**: documents fetch over HTTP with WS notify; generation lands
  as batch commands under `baseRevision` (one undo step); only the active compiled scene
  broadcasts. The Atlas must stay metadata — the 750KB snapshot guard and 1MB message cap
  are respected by design, not luck (VISION Pillar 1, last bullet).
- **Travel = rebind, probably.** The live table already has ONE live-bound document
  (`liveMapDocumentId`) and the client controller queues one-in-flight commands against the
  ACTIVE document (`useMapStudio`). Recon question one: is travel "set-live to another
  document + SceneState swap", and what happens to the in-flight queue and every
  `document.id !== liveDocumentId` guard when the binding changes mid-session? Grep
  `liveDocumentId` consumers before designing.

## 3. Traps this arc WILL hit (curated from §5 + this week's scars)

- **A new REQUIRED `RoomState` field breaks five fixture files** — use `/fix-fixture-ripple`,
  do not hand-edit from the orchestrator. **Every new snapshot collection must join
  `SNAPSHOT_LIMITS` or load-session crashes.**
- **The shared barrel cannot declare a runtime const** (HANDOFF §7). Sub-module + re-export,
  then **boot `pnpm dev` once** — nothing in the gate can see this failure.
- New `ClientMessage` types are compile errors until registered in `messageValidators`;
  validator coverage lives in `middleware/__tests__/validation.test.ts` — `route()` runs
  AFTER validation, so contract tests through the router prove nothing about validators.
- **The recipient filter is the ONE privacy-filtered producer.** Discovered-only Atlas
  projection belongs there, beside the hidden-NPC and monster-HP redactions. Test at the
  raw-frames level with `ws/__tests__/leakSentinels.ts` (`sentinelHits` — structural walk),
  **never a substring**: CI #828 went red because a `Date.now()` heartbeat spelled a
  sentinel's digits. Positive substring asserts are the same bomb inverted.
- **LOC ceilings (wc -l, 348 real):** `useMapEditTool.ts` 348, `characterValidators.ts`
  348, `useDMContext.ts` 347, `useMapEditState.ts` 343. E2e specs are NOT exempt. Prettier
  expands files — pre-format touched files before gating (two gate runs died on >100-col
  lines this week).
- **Widening any callback signature: grep every test for `toHaveBeenCalledWith` on it
  first** (exact-arity; two stale asserts cost a full gate run).
- **Gates:** `/verify-gates` after every burst; never ask it for a bundle figure AND e2e in
  one prompt; the batched client runner fail-fasts (a red batch under-reports coverage);
  read summary LINES, not exit codes; a mass e2e failure is a harness fault until one named
  spec fails alone.
- **Deploys** (owner's word only; merging deploys, CI does not gate it): baseline the probe
  BEFORE merging; pick the tell per deploy (entry-hash change vs an `index.html` marker —
  the watchdog deploy moved no asset hashes); Render's first 200 can be the OLD process
  still serving — wait out a real 502 window; players must reload after.
- **Base-rate discipline** (this week's biggest lesson): before declaring anything
  unreproducible, mine `.tmp/gates-*` for the denominator — 41 preserved e2e logs hold
  ~5,700 page loads. Attach forensics BEFORE the failing operation
  (`page.on("requestfailed")` names the exact net error). Symptoms name the wrong bug:
  every one of this week's eight investigations ended somewhere other than where it
  started.
- **Stage by explicit path, never a directory** — `temp/` is the owner's untracked art and
  has been swept into main once. And `git checkout -- <file>` during a sabotage pass
  destroys uncommitted work; copy to `$TEMP` first.

## 4. Tooling that did not exist last week

- **Graphify** maps the repo: `graphify update .` (1 min, local, no LLM) →
  `graphify-out/` (gitignored). `graphify explain "Name"`, `graphify path "A" "B"`.
  Regenerate at arc boundaries. Answers are LEADS — §8 still requires reading the file at
  HEAD. Blind spots, measured: methods on a returned object are not nodes
  (`touchAim.cancel`-class questions stay grep), and `temp/` is indexed so name collisions
  can mint bogus edges into the owner's protos.
- **`boot-recovery.spec.ts`** is the login flake made deterministic (route-interception
  chunk kill). The watchdog in `apps/client/index.html` reloads once on an empty mount;
  keyed on MOUNT state, never network. If a join helper ever times out again, its failure
  now prints the page's actual state — believe that over folklore.
- **`leakSentinels.ts`** — use it for any bytes-level secrecy assertion (see §3).

## 5. Small open items (none block the arc; fold in opportunistically)

1. **Verify CI #830's conclusion** (rate limit has reset by now).
2. **`recordManual` reconcile**: memory says the judgement call was DECIDED (overturned);
   `PROMPT-initiative-client.md`'s banner still says open-for-owner. Five minutes to
   reconcile doc vs reality before anyone acts on either.
3. **Q4** — the in-app "use the desktop layout" switch for tablet DMs. Open design
   question; blocks nothing; worth surfacing to the owner once, with the M4c
   resize-crossing evidence.
4. **A11y stragglers:** the Initiative Modifier dial is a bare div (no role, no keyboard);
   `GridControl`'s two sliders have no aria-label (they swept as `INPUT:` with empty
   names).
5. **Critic #10:** the mobile leg of the `tableVisionDefault` chain is wired but has no
   e2e guard (the desktop leg does, and the prop's own commit says an e2e over the whole
   chain is the only guard that shape allows).

## 6. Non-negotiables (the short form; §8 has the full list)

Commit to `dev` as you go; full §2 gate before every commit; prove every new test can fail
(sabotage each rule independently — a pair can mask each other); required options over
optional ones for wiring that must not silently unwire; adversarial review before declaring
an arc done, then check `agents_error` and audit `git status`; every slice ships its mobile
surface in the same slice; fix bugs you find regardless of origin, each in its own commit;
merging to `main` deploys and is ALWAYS the owner's word. Update HANDOFF-NEXT's §0 AND its
§10 list in the same commit as the work they describe — that file has gone stale three
times, and its whole value is that you can trust it.
