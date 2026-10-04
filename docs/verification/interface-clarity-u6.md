# U6 — Current map, library and World become distinguishable

Status: implemented on `dev` (uncommitted), reviewed for the full three rounds,
and repaired per the owner's round-3 decision “Repair all, verify” (2026-09-28).
Full ladder PASS after the repairs (below). No fourth review round ran. Awaiting owner acceptance;
nothing is committed. The separate phone Draw-sheet CSS fix for dev CI #903 was
committed alone as `11a3728c` and pushed to `dev` on the owner's instruction. CI #905
then showed it cured #903's three label-overflow failures but broke
`mobile-draw.spec.ts` on Linux fonts: content-width chips put the nine tools on three
rows, and the taller sheet covered the spec's stroke. The uncommitted follow-up
(a 56px basis with the flex item's min-content floor) keeps two rows; a Verdana probe
(CI's wider metrics on Windows) measured 3 rows → 2, sheet top 328 → 378 px, stroke
start back on the canvas, no label overflow, and the 23 draw-sheet browser cases pass.
#905 also flagged `door-pan.spec.ts` (U5) flaky; tracing showed a heavy-scene camera
pan can end one move-step short and carry it into the next pan — filed as its own task,
spec left unchanged.

## What U6 changes

Audit findings IA-13 (Map, Map Setup, Map Studio, Atlas and World do not explain
their relationship) and IA-14 (backup and generation actions hide their scope).

**Maps tab** (was Map Setup). Its first line always names what the party is on,
`On table: <name>`, and, when a different saved map is open, `Viewing in library:
<name>`. Same-named copies carry a short `#id` everywhere a map is named. Background,
grid, fog, vision, staging zone and drawings sit under **Current table map**; map
position and grid alignment collapse under **Advanced** (opened, and latched open,
while an alignment runs). The **Map library** (was Map Studio) inspects saved maps
without moving anyone: **View saved map** opens details only; **Use at table** binds
through the existing `map-studio-set-live` transition after a confirmation naming
both maps; **DELETE** says what it costs; exports and imports are named by what the
file holds. The raster publish lives under **Advanced → Publish map background**.

**Build** (header button “🏗️ Build map”). Opening Build never swaps documents. With a
library map open it names both maps and offers **▶ Resume editing <table map>**;
only a table with no editable map is offered **▶ Start live map**. Build's undo/redo
keys act only on the table's map.

**World tab** (was Atlas). Campaign locations and their linked maps, with **Party is
at**, **+ Create location**, **🚩 Travel here**, **🎲 Generate map for location…**
(the party stays put) and the kicked-in door committing as **🚪 Generate & enter**
(Reroll stays separate and non-committing). World errors toast as “World: …”.

**Every table-moving confirm tells the truth about the scene it replaces.** Use at
table, Publish map background, Build's start, Travel here and the canvas door sprite
share one rule (`tableSceneFate` + `sceneLossWarning` in
`features/map-studio/tableMapIdentity.ts`): a scene whose map is in the library is
suspended and comes back; a scene whose map is gone is lost (player characters come
along, nothing else); before the library has answered, the loss is called possible,
not certain; a table with no saved map suspends nothing. A generated World location's
map reached by anything but Travel here while fog is off carries a fog warning.

Controller additions: `bindRefusal` (a refused `set-live`, keyed by map, with a
sequence number), `listed` (a list reply has arrived) and `listQuietly` (Build's list
fetch, which never touches `loading`). The entry flow moved from `useMapEditState`
into `features/map-edit/useLiveMapEntry.ts` for the 350-line guard.

Docs: the DM guide, running-a-game, map editor guide, getting-started, player guide
and both READMEs; 14 regenerated screenshots (the DM menu tour and the World
walkthrough were re-shot after the last copy change).

## Review — three rounds, fresh read-only agents each round

| Round | Lenses                                      | Verdicts       | Unique items  | Notes                                                                              |
| ----- | ------------------------------------------- | -------------- | ------------- | ---------------------------------------------------------------------------------- |
| R1    | identity/state, travel/secrecy, tests, docs | 4 FAIL         | ~22 (P2 + P3) | the orphan-scene wipe found by two lenses                                          |
| R2    | same, new agents                            | 4 FAIL         | ~30 (4 P2)    | 3 regressions from my R1 fixes; Travel here and Publish had the same false promise |
| R3    | same, new agents                            | 2 PASS, 2 FAIL | ~21, all P3   | no P1/P2; one regression from an R2 latch fix                                      |

Twelve review agents in all, every one pinned to Opus, zero errored runs; the tree
was fingerprinted before and after each round and never changed. R3 reached the
round cap, so it was escalated rather than re-run; the owner chose to repair every
item and verify without a fourth round.

### R3 items and their repairs

- **Build latch regression** — a refusal left from an earlier Start could release a
  new attempt's latch, reopening the double-click window for an orphan map. The
  bind branch now forgets the last target.
- **Stale “missing map”** — a map the server once reported gone stayed flagged after
  a later list contained it (a loaded game restores maps without a document frame),
  so every confirm said “lost” and Build offered Start. A list containing it now
  clears the flag.
- **Canvas door-sprite confirm** — now uses the same fate rule (a not-yet-listed
  library reads as kept, today's wording, to avoid noise).
- **Older unbound saves** — the scene's own map, open in the library, is no longer
  named twice, and the library marks it as the map on the table.
- **Fog wording** — the fog note now says fog stays off _unless the party left a
  scene on that map_ (its own fog returns), and Publish map background carries the
  same note (it keeps the table's fog too; this predated U6).
- **Copy** — Travel here's help topic names both exceptions; World says “a background
  image (not a World location)” where Maps says the same; the guide's Use at table
  bullet covers a background-only table; two leftover “Atlas”/“atlas-link” names;
  the mid-bake publish status; the stale World screenshot.
- **Tests** — the controller's `listed`/`listQuietly` and missing-flag clearing; the
  Build latch cases (refused create, dangling bind, this attempt's refusal only, the
  stale-refusal regression, following a move during a load); eight same-name sites;
  MapTab's publish result and background flag; the World tab's scene and background
  props through the real container; export formats; Build's confirm count; and the
  identity e2e now waits on the quiet list's reply plus a round trip instead of 400 ms.

Every new assertion was proven by sabotage: six Build-latch mutants and twenty-one
panel/controller mutants each turned the targeted suites red, and every production
file was restored byte-for-byte (tree hash unchanged).

### Fixture-ripple incident

The fixture-ripple agent, repairing test literals for the new required
`sceneSourceDocumentId`, ran `git checkout --` on `useMapEditState.test.ts` after a
broken `sed`, wiping uncommitted round-1 tests, and rebuilt them from its earlier
read. I rebuilt the file independently from HEAD plus my three recorded edits and
diffed: identical apart from the agent's intended additions. Nothing was lost.

## Verification

Full ladder after every round-3 repair, run by the gates-runner (logs
`.tmp/gates-20260928/`): shared build, lint (frozen contracts intact), format:check,
structure guard (920 files, no new violation), both typechecks, units **452 shared,
2,738 server, 7,056 client** (the 4 existing bench skips), browser **274 passed, 3
existing skips, 0 failed, 0 flaky** (20.6 min, retries off), dev boot clean. Bundle,
run separately: **145.50 KB / 175 KB** gzip (U5 was 143.35 KB; the identity and
prompt helpers ship in the entry bundle).

Earlier on this tree: the full client unit suite passed 7,071 with the 4 existing
skips before R3; the seven affected browser cases (identity on desktop and phone,
World journey, kicked-in door, kick layer, phone World and phone kick) passed with
no retries after the R2 repairs. The live two-client evaluation (DM and player on the
dev server) ran before R1 and found no defects; the review repairs since then are
covered by the two-client identity and World browser specs.

## Known limits (accepted, not repaired)

- At 1280 px the longer “🏗️ Build map” label wraps the DM header's Play tools group to
  one extra row (+31 px); unchanged at 1366/1440. Deferred to U9's Table menu reflow.
- Server atlas error reasons still say “node”, and the kick's “…roll again.” reaches
  the DM verbatim after the “World:” prefix.
- The docs harness's live-map authoring walkthrough has been broken since U3b, so
  `img/dm-player-lens.jpg` still shows the old header label.
- A generated map whose World location was deleted has no recipe to key the fog note
  on; Use at table with fog off shows it without that warning.
- Build's button reads Opening…/STARTING… during any in-flight library load (the
  stuck-forever cases are fixed).
