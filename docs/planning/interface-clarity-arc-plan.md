# Interface clarity — the first session should teach the table — arc plan

> **STATUS: U8 ACCEPTED AND COMMITTED ON `dev` (LOCAL, NOT PUSHED) — 2026-09-30.**
> U8 (Encounter is the single combat home: a DM Menu tab and phone DM chip; initiative
> on the phone) is committed on `dev` above nineteen local, unpushed fix and
> test commits for what was found on the way (`b735acb8`…`60a08cea`, among them a fog
> secrecy leak in initiative lines, `6b643b1b`). Review stopped at the 3-round cap (P2
> 7 → 9 → 6, P1 zero throughout); the owner chose “repair all, verify”, and every
> round-3 item is repaired. The ladder is green on the final tree (288 browser/3
> accepted skips/0 flaky; 151.96 KB); the live two-client re-evaluation on the repaired
> tree scores 8.55. Read [the U8 record](../verification/interface-clarity-u8.md).
>
> Previous status (U7):
>
> **STATUS: U7 ACCEPTED, COMMITTED AND ON `origin/dev` — 2026-09-29.**
> U7 (Party is compact; a character is not a player seat) is committed on `dev` after 36
> fix/test/refactor commits (`ccd18b82`…`2689cf53`) for bugs found along the way, and
> pushed with them. Three review rounds of four fresh Opus lenses: 34 → 28 → 33 items (P1:
> 1 → 1 → 0). At the round-3 stop the owner chose “repair all, verify” and decided three
> questions (a DM edits a player's HP and moves a character between seats, both built in
> U7; the Table role section is the interim role home). Every round-3 item is repaired;
> the ladder is green (286 browser/3 accepted skips/0 flaky; 149.95 KB) and the live
> two-client evaluation scores 8.4. Its one follow-up, phone HP tap targets, is fixed
> (`2689cf53`). U6 is committed and on `origin/dev` (`4af2cc5e`). Read
> [the U7 record](../verification/interface-clarity-u7.md).
>
> Previous status (U6):
>
> **STATUS: U6 IMPLEMENTED, REVIEWED AND REPAIRED — AWAITING OWNER ACCEPTANCE — 2026-09-28.**
> U5 was pushed to `dev` with the door-pan fix on the owner's instruction. U6 (current map,
> library and World become distinguishable) is uncommitted on `dev`. Three review rounds of
> four fresh Opus lenses: ~22 → ~30 → ~21 unique items; round 3 had no P1/P2 (2 PASS,
> 2 FAIL on P3s). At the round cap the owner chose “Repair all, verify”: every round-3
> item is repaired, each new assertion proven by sabotage (27 mutants killed), and the full
> ladder PASSES (452 shared, 2,738 server, 7,056 client units; 274 browser, 0 flaky; dev
> boot; 145.50 KB). The separate Draw-sheet CSS fix is `11a3728c` on `dev`; its Linux-font
> follow-up is uncommitted. Read [the U6 record](../verification/interface-clarity-u6.md).
>
> Previous status (U5):
>
> **STATUS: U5 ACCEPTED AND COMMITTED LOCALLY ON `dev` — 2026-09-27.**
> The owner's “Proceed” authorizes the two final repairs and required verification.
> Session-upload remount and ambient accessibility repairs have compiled RED,
> 194 affected unit passes/24 files, 34 strict roots and three affected browser
> journey passes across bounded runs. Failed test attempts remain recorded.
> Full gates/boot now PASS (10,155 units, 272 browser, 143.35 KB) with a separate
> pre-U5 door-pan fix found by the interrupted run. Owner accepted 2026-09-27; the
> door fix (`eb28f30a`) and U5 are committed locally on `dev`. U6 not started.
> Read [the latest U5 record](../verification/interface-clarity-u5.md).
> Historical R3 stop follows; it is not a new repair-permission request.
> Final U5 R3 completed all four STATIC lenses, but is VOID after one reviewer's
> search exposed a peer-report line. Runtime/dispatch errors: zero; missing lenses:
> zero. Three unique flags remain in the record: session-upload picker remount,
> ambient slider accessibility and stale handoff status. This checkpoint corrects
> the status text; the two code repairs await owner direction. Counts are VOID (5)
> → valid FAIL (3) → VOID (3 retained), not a valid plateau trend. No R4, product
> repair, U5 commit or U6 before direction. See the
> [final owner checkpoint](../verification/interface-clarity-u5.md#owner-checkpoint--final-review-void-two-repairs-proposed)
> for the concrete proposal, cost and evidence limits.
> Prior: valid U5 R2 completed four STATIC lenses, zero agent errors, three flags
> (UI one P2; docs two P3; state/tests PASS). Bounded resize/name/evidence repairs
> have compiled RED and 170 affected unit passes/20 files. All 31 strict roots and
> the strengthened phone journey PASS with no errors/retries. Corrected full checks
> and boot now PASS: 10,140 unit passes/four skips, 270 browser passes/three skips,
> 143.28 KB; all 53 hashes/31 strict roots match, zero browser errors/retries/raw
> diagnostics. R3's later result is above. Older full-gate numbers describe pre-R2.
> The first R2 gate attempt failed test formatting; its browser run was deliberately
> stopped, with no verdict/boot. Whitespace is corrected and strict checks pass;
> fresh `u5-r2-format-gate-*` verification now passes. Preserve the failed attempt.
> U4c local commit `a56e92e1` passed its 37-path scope/hash/parent/attribution audit;
> the checkout was clean. U5 properties and ambient light are implemented.
> U5 R1 is VOID after documentation dispatch hit the agent thread limit. UI completed
> FAIL, state/tests are partial, documentation never ran; five unique issues were
> flagged. The owner authorized bounded repairs, verification and fresh R2 with “yes”
> on 2026-09-27. Repairs pass 152 affected unit tests, 28 strict roots and both
> strengthened two-client input journeys. A full-run Atlas menu failure was diagnosed
> with passive events and isolated HTML probes; a measured 350 ms test-phase
> separation preserves all assertions. No physical-device gesture fix is claimed.
> The historical pre-R2 `u5-gesture-gate-*` ladder and isolated boot PASS: 10,137 unit passes/
> four existing skips, 270 browser passes/three existing skips in 23.5 minutes,
> 143.18 KB gzip. All 52 hashes/HEAD/inventory and 29 strict roots match; browser
> errors/retries/raw diagnostics are zero. R2's later result is recorded above.
> No U5 commit or U6 work. See the U5 record and preserved failure history.
> U1 and U2 are locally committed following their recorded owner acceptance. U3a's
> auth prerequisite and characterized extraction are committed; its semantic repair
> is locally committed as `b473a3dd`. Final review round 3 left one P2 recovery-correlation finding
> (round counts 5 → 1 → 1). The authorized bounded repair now has strict behavioral
> RED/GREEN evidence, six desktop/phone Generate journeys, all eight gates and fresh
> boot PASS. [The verified owner checkpoint](../verification/interface-clarity-u3a-checkpoint.md)
> records scope, evidence and choices. The owner's “acccepted” fulfills the
> checkpoint. U3b's grouped palette and layout repairs pass the full eight gates,
> fresh boot and automated two-client journeys. Round 1 found two distinct issues;
> those repairs passed full verification: 10,016 unit and 256 browser passes.
> Round 2 found five issues (one behavior gap, four copy/label mismatches); bounded
> repairs now pass all eight gates and isolated boot: 10,018 unit passes and
> 258 browser passes, with four and three existing skips respectively. The frozen
> ladder resumed after a recorded usage interruption with all 87 hashes unchanged.
> Final R3 found one stale audit-status sentence, corrected after review; no
> additional product defect was found. Formal counts 2 → 5 → 1, 12 completed
> assignments, zero semantic agent errors. Two PASS/two FAIL verdicts reflect
> the duplicated P3, not unanimous review acceptance. The owner accepted the
> [U3b checkpoint](../verification/interface-clarity-u3b.md) with “Accept and commit
> locally.” The scoped local commit is `351b5485`; no fourth U3b review ran.
> U4a started at `351b5485`. Its initial and R1-repaired drawing settings passed
> all eight gates and fresh boot. R2 found landscape canvas obstruction, a missing
> snapshot oracle gap and stale linked evidence. Bounded repairs pass all eight
> gates and fresh boot: 10,025 unit passes, 263 browser passes, four/three existing
> skips and 137.51 KB gzip. Final R3 completed with three P3 findings: disclosure
> remount lifetime, stale phone-guide copy and the handoff's cap-approval route.
> Formal counts are 3 → 3 → 3, 12 completed reviews, zero semantic agent errors.
> All three bounded repairs now pass fresh full verification and boot: 10,027 unit
> passes/four skips, 263 browser passes/three skips, 137.53 KB gzip and zero browser
> failures/errors/retries. The owner accepted continuation on 2026-09-26 with
> “Can you continue on now?” The scoped local commit is `681bc391`. U4b passed
> characterization, then implementation and 722 focused tests with strict compilation.
> Its final two-client browser run passes six tests without errors or retries.
> All eight gates and isolated boot pass: 10,066 unit passes/four existing skips,
> 265 browser passes/three existing skips and 138.82 KB gzip. R1 then found two issues:
> idle hover exit and fractional edge-cell rounding. Four STATIC assignments completed,
> zero semantic agent errors. Bounded repairs pass 759 focused tests and 47 strict roots;
> repaired live verification passes six cases without errors/retries. All eight repaired
> gates and boot pass: 10,071 unit passes/four skips, 265 browser passes/three skips,
> 138.87 KB gzip, zero browser errors/retries and all 54 frozen paths unchanged.
> R2 found two P3 issues: touch-release preview cleanup and decimal interior-boundary
> assignment. Both bounded repairs pass 768 focused tests, 47 strict roots and six browser
> cases without errors/retries. All eight R2-repaired gates and boot also pass:
> 10,080 unit passes/four skips, 265 browser passes/three skips, 138.88 KB gzip and
> zero browser errors/retries; all 54 hashes/HEAD/strict inputs match. Final R3 is VOID:
> `agent thread limit reached` blocked documentation dispatch; state never started.
> UI/tests filed partial reports without PASS or a new established defect. Counts
> 2 → 2 → INCOMPLETE: eight completed and two partial STATIC assignments, one R3 dispatch
> error, two unperformed final lenses. The [U4b owner checkpoint](../verification/interface-clarity-u4b.md)
> was accepted on 2026-09-26 with “Accepted”; its scoped local commit is authorized.
> All four R1/R2 findings are repaired. The incomplete final review remains recorded.
> No fourth round. See
> [its verification record](../verification/interface-clarity-u4a.md).
> U4b is locally committed as `63505c56`; its 54-path acceptance audit passed.
> U4c collection browsing is active; U5–U10 remain ahead.
> U4c's focused/live checks pass: 702 initial tests, 22/28 affected repair checks,
> six final browser cases, plus 19 strict roots and four browser passes after migrating
> two old-picker test selectors exposed by the first full run. Initial gates 1–7
> passed. The second full browser run finished 265 passes/three skips/two failures:
> a remaining phone Sample selector and an Atlas touch/compatibility-mouse defect.
> Bounded repairs have strict unit/browser RED, 120 affected unit passes and 25 strict
> roots. The six focused journeys now pass (five unchanged cases plus the corrected
> Atlas case); public-link oracle failure history is retained. The third full run
> passed gates 1–7 (10,098 unit passes/four skips; 139.69 KB), but finished E2E with
> 258 passes/three skips/ten failures. All frozen inputs matched afterward. Browser
> startup/teardown diagnosis and a bounded terrain test-oracle repair now have eight
> unchanged focused passes plus two corrected terrain passes; intermediate failures
> remain recorded. All 26 actual roots compile. The fourth full ladder passed
> gates 1–7, but E2E finished 257 passes/three skips/eleven failures in 57.1 minutes.
> All 35 frozen paths/HEAD/strict inputs matched. Six failures were page creation;
> further runtime diagnosis and bounded test-oracle repairs precede another full
> verification attempt. A 30-context blank-page probe passed but did not establish
> a cause. Two bounded test-oracle corrections now compile across 28 actual roots;
> all eleven focused cases pass in 161.8 seconds without errors/retries. All 37
> frozen paths match. The fifth full ladder and isolated boot now PASS: 10,098 unit
> passes/four existing skips, 268 browser passes/three existing skips in 30.3 minutes,
> 139.69 KB gzip, zero browser errors/retries/flaky cases or raw step-ID diagnostics.
> Root verified all 37 frozen paths/HEAD/full inventory, 28 strict inputs, seven reach
> reports/13 controls and Atlas touch ownership. The runtime fault did not recur;
> its cause remains unproven. R1 is VOID/INCOMPLETE after documentation dispatch hit
> the agent limit; state never started, UI/tests returned only partial STATIC reports.
> Counts: INCOMPLETE, zero completed/two partial assignments, one error/two unperformed
> lenses. All 37 review hashes matched. No replacement or further round ran. The
> [verified U4c checkpoint](../verification/interface-clarity-u4c.md#verified-owner-checkpoint--review-incomplete)
> was accepted on 2026-09-26 with "accepted and ready to proceed". Scoped local
> closeout and U5 continuation are authorized; incomplete R1 remains recorded.
> Do not start a fourth formal U3a review. Remote pushes,
> main merge and production deployment remain outside the execution authorization.
> Execution evidence: [interface-clarity-execution.md](../verification/interface-clarity-execution.md).
> Audited checkout: `0007e517`. The current live record is `HANDOFF-NEXT.md` §0
> (`main` deployed as `7f63156b`). Recheck symbols against the executor's checkout;
> historical line numbers and old plan banners are navigation aids, not current facts.
>
> Evidence and coverage: [interface-audit-2026-09-22.md](../verification/interface-audit-2026-09-22.md).
> That report distinguishes hands-on observations, source corroboration, recommendations,
> and untested cases. This plan does not turn an untested feature into a verified one.
>
> Review amendments incorporated on 2026-09-22: mobile naming, complete Escape-owner
> inventory, queue-entry outcome settlement, measured extraction constraints, and the
> U3a checkpoint. This records a plan review, not a live implementation acceptance.

**Mission:** a new player can find their character, move, draw, roll, and talk without
learning the implementation; a new DM can become the DM, prepare a map, run an encounter,
and return to play without hunting across unrelated menus. The existing capability stays.
Its entry points, names, editing contracts, and control positions become predictable.

**Thesis:** the main problem is that menus describe where features were implemented rather
than the task someone is trying to complete. Drawing and terrain painting are different
systems, but their cancellation, tool state, settings, and history controls need a shared
interaction language. A polished brush deck cannot fix an unclear distinction between a
mark, terrain, a blocking wall, a saved map, and the map currently on the table.

**Vision alignment:** preserve the JRPG identity while making ordinary actions legible.
Keep the map useful during play, aim for at most two inputs for repeated actions once a
tool is selected, and ship touch alongside each relevant change. The shipped mobile
shell's usability-first decision still stands. This arc does not implement the future
Battle Strip, co-DM role migration, damage automation, or another map renderer.

## 0. How to execute this plan

1. **Implementation authorized on 2026-09-22.** Execute locally on dev, keeping the
   U3a checkpoint and the separate production-delivery decision below.
2. Execute **U1 → U2 → U3a → U3b → U4 → U5 → U6 → U7 → U8 → U9 → U10**. Each slice's
   *Done when* gates the next. Each is a working end-to-end increment and its own commit(s),
   not ten branches awaiting a final integration rewrite. Split a slice further if its
   reviewable change is growing beyond the repository's usual small-PR scale.
3. Read `.agents/AGENTS.md`, `HANDOFF-NEXT.md` §2/§5/§7/§8, this plan, the audit report,
   and the current slice's Context capsule. Match symbols, not stale line anchors.
4. Before risky extraction, pin the affected behavior with characterization tests; prove
   new behavior tests can fail. Reuse existing fixtures and run focused tests first.
   A renamed label does not need a redundant implementation-mirroring unit test.
5. Follow the verification gate in §8. New source files must stay below the 350-LOC
   guard; budget at most 348 after formatting. Extract bounded responsibilities rather
   than feeding another toolbar, layout, or App file.
6. Each slice includes desktop and phone/tablet behavior. Share descriptors and state,
   not necessarily the same rendered component. Preserve lazy-loaded DM code.
7. Record discoveries, verified fixes, and deliberate deferrals in the frontier ledger.
   Do not relist a shipped repair as a new defect. Real bugs found during execution get
   their own focused fix and evidence, consistent with the house workflow.
   In particular, land IA-03 in U1, IA-04 in U2, and IA-18 in U3a as focused fix commits
   separate from presentation refactors where possible; explain inseparable changes in
   the commit body. Apply the full gate to each commit.
8. Source changes, commits, and production deployment remain separate actions. `main`
   deploys on push. No production push follows merely because this plan passes review.
9. Hand-edit this and other `docs/**` files; do not run `prettier --write` on them.

### 0.1 Owner decisions and the checkpoint after U3a

Two decisions remain proposed until the owner accepts them:

- **Shipping cadence:** recommend completing the full house ladder for each slice and
  shipping that slice from dev to main. The current house default remains commit to dev
  as work proceeds, with no remote push, and no merge to main, unless the owner asks. Implementation
  authorization alone does not authorize production delivery. An explicitly approved
  per-slice shipping cadence persists; do not request the same permission each slice.
- **Destination names:** §2.1's Table, DM tools, Encounter, Objects, and Preferences are
  product choices. Confirm the concrete desktop/phone destination proposal when the owner
  authorizes execution or at the checkpoint below. The existing password and session
  identity flow stays; this is navigation work, not a new identity model.

After U3a passes, checkpoint the U1/U2/U3a live evidence, IA-03/04/18 fixes, extraction
headroom, and proposed destination map before U3b's broader information-architecture
changes begin. U3b groups the build palette; the DM-menu relocations follow in U6–U9.
Record already accepted choices without asking again. Unresolved destination choices do
not block separately authorized defect repairs, but do block dependent menu relocation.

## 1. The frontier this arc starts from

**Already shipped; preserve and reuse:** live on-table map authoring and its single
MapStudio controller; procedural material deck with search, pins and recents; gesture
previews; worker baking; player lens; quick wheel; the mobile mode/sheet/screen shell;
touch drawing, map tools, layers and inspector; Atlas travel and scene suspend/resume;
chat, whispers, dice macros, backup/import checks, and current session identity gates.

The separate full-screen Map Studio scene was retired. Its document/command engine is
still the backend, and `MapStudioControl` is now document management, publication, export,
and backup UI. It is not a second live editing workspace to restore.

The July [UX overhaul](./ux-overhaul-handoff.md) and August mobile plans contain shipped
work, not a new backlog. In particular, `mobile-workbench-design.md` is an older proposal;
the implemented [mobile shell](./mobile-shell-redesign.md) is the navigation contract.
Old opening banners in `mobile-authoring-arc.md` are superseded by its completed slices.

The September 16 audit recorded 26 findings. Nine have already been repaired: UX-01/02/03/05
(settings rename, conditions, condition labels, background clearing) and UX-04/06/07/08/11
(modal stacking, inspector fit, wrong-kind backup feedback, entry camera, chat composer).
Use those repairs as regression coverage. Reconcile the remaining UX-09/10/12–26 with
the new report; a fresh observation may refine or retire an older recommendation.

The new hands-on audit already reproduces: player **Clear All** is enabled but does
nothing; the phone's ONLINE badge overlaps headings; Escape leaves some windows open;
the map palette presents fourteen peers; Populate appears in unrelated tools; Layers and
Inspect disappear for Generate/Spline; a door has two Apply buttons; Escape can commit
an unfinished grass stroke. With Party/NPC cards and player props enabled at 1440×900,
the fixed World/Props launchers also cover the character's settings control and intercept
its click. **IA-18** additionally reproduces Generate claiming **Built here already** and
disabling an unchanged recipe after the server rejected an out-of-bounds region. Refer
to the report for exact steps and final dispositions.

## 2. Product model — one home per task

### 2.1 Entry points and destinations

The desktop header has three visual groups, with labels rather than icon-only discovery:

- **Play tools:** Move, Ping, Measure, Draw. Move is the explicit default and escape route.
- **At the table:** Party, Dice, Chat & Rolls, World. These open content; they are not tools.
- **Table:** table name and a menu containing Table settings, Enter/Leave DM mode,
  Preferences, and Help. A DM additionally gets **Build map** and **DM tools** launchers.

At smaller desktop widths, secondary utilities move into Table before primary play
actions wrap across the map. Do not solve width by replacing every label with an icon.
The phone keeps its five-slot dock and contextual DM/build mode; **Log becomes Chat** in
the dock and **Chat & Rolls** is the screen title. The five-column layout needs short dock
labels: retain a five-character design budget, not a claimed runtime truncation rule.
World, Preferences and Help
remain discoverable from Tools/Table without a sixth dock slot. Draw remains a sheet,
Party/Dice/Chat/DM remain screens, and build authoring remains a mode.

| Current entry or label | Proposed home and visible name | Scope and effect made explicit |
| --- | --- | --- |
| Header Pointer; mobile Ping | Play tools → **Ping** | Points at the table; does not select or move an object. |
| No desktop normal-mode button | Play tools → **Move** | Returns to ordinary map/token interaction. |
| Draw Tools / Draw / Free | Play tools → **Draw** → **Freehand** | Adds annotations, shapes or area templates. |
| Log / Roll Log, default Rolls tab | **Chat & Rolls** screen; phone dock **Chat**; tabs **Chat** and **Rolls** | One shared history surface; reopen the last tab, first entry opens Chat. |
| WORLD floating launcher | **World** | Player view of discovered campaign locations; DM's shortcut opens the same campaign home with DM controls. |
| CRT / Game Feel / JUICE | Table → **Preferences** → **Display**, **Sound & motion** | Personal presentation preferences; preserve reduced-motion choices. |
| DM elevation deep in character settings | Table → **Enter DM mode** | Password gate and role state, separate from character identity. |
| EXIT DM MODE above DM tabs | Table role control → **Leave DM mode** | Ends DM privileges; no danger styling implying table deletion. |
| Header Map | **Build map** | Edits the current live table map, with its name always visible. |
| Map Setup + HeroByte Map Studio | DM tools → **Maps** | Two sections: **Current table map** and **Map library**. |
| Atlas | DM tools → **World** | Locations, discovery, linked maps, generation and table travel. |
| Players tab combat + NPC Roll Missing Initiative | DM tools → **Encounter** | Setup, initiative, turn controls, HP visibility; one canonical combat home. |
| NPCs & Monsters | DM tools → **Characters** → **NPCs** | Library, add/batch, duplicate, hide/reveal, place and edit. |
| Player cards + player settings | **Party** → selected **Character** | Character identity, HP, conditions, art and token; table preferences moved out. |
| Props & Objects / player PROPS | **Objects** | Same term for placed props, with role/ownership-appropriate actions. |
| DM Session + Players roster | DM tools → **Table** | Invite, seated players, permissions, table backups, table security. |
| Save Game State / Player State / map JSON | **Download table backup**, **Save character**, **Export editable map** | Names identify contents before choosing a file. |
| PNG / WebP / SVG export | Maps → **Export map image** | Image output; explicitly distinct from editable or whole-table backup. |

DM tools therefore has **Maps · World · Encounter · Characters · Objects · Table**.
The existing tabs migrate one slice at a time; do not introduce empty destinations early.
Temporary old entry points may forward to a new home for compatibility, but must not keep
independent state or a second authoritative editor.

### 2.2 Build map: stable commands, contextual options

Always show the current map name and live/draft relationship, **Select**, **Sample**,
**Layers**, scoped Undo/Redo, and **Done building**. Properties appear when an element is
selected; Layers must remain reachable for every active tool.

| Tool group | Tools, using full visible names | Options shown only in that context |
| --- | --- | --- |
| **Terrain** | Paint terrain, Erase terrain | Material, brush size in cells, footprint; no annotation color/fill controls. |
| **Structures** | Room, Hallway, Wall, Door | Floor material, wall choices, width where relevant; explain blocking geometry. |
| **Objects** | Place object, Scatter objects, Repeat along line, Rope / curve | Object library, grid tile/free placement, rotation, spacing/variation as applicable. |
| **Lighting** | Place light | Light settings and explicitly named Ambient light. |
| **Generate** | Generate area | Region, recipe parameters and **Generate in this area** action. |

**Populate room** is an action on a valid recently created/selected room or hallway target,
not permanent boilerplate under Paint/Erase/Light. Until arbitrary selected-room targeting
exists, label the actual supported target: **Decorate last room** / **Decorate last hallway**,
highlight that target on the map, and disable with a reason when it is no longer valid.
Do not imply a new target model merely by renaming the button.

Keep the material deck's existing shelves/search/pins/recents. Tool groups reduce choice
overload, while the last active group, recent tools, keyboard shortcuts, and existing quick
wheel keep repeated use fast. A group heading is not another scrolling modal.

### 2.3 Maps are three different things

- **Current table map:** what the party currently occupies. Build map edits this document.
- **Map library:** saved documents, including maps not currently at the table. Selecting a
  library item changes the inspected document; it does not silently move the party.
- **World:** campaign locations and their linked maps. **Travel here** changes location
  through the existing suspend/resume path; it does not mean opening a library item.

Always show **On table: <name>** and, when different, **Viewing in library: <name>**.
Use **View saved map** for the existing open/select action and **Use at table** for explicit
live binding through the existing transition path. Build map should offer **Resume editing
<current map>** when another document is selected, not **Start Live Map** as though none exists.
Here **View saved map** means the existing document metadata/details and management
surface, not a rendered preview or a revived Studio editor. If library document B was
explicitly opened while A is live, keep B selected until the user chooses **Resume editing
A** or another explicit action. Opening Build alone must not silently replace B.

Keep legacy raster publication under **Advanced → Publish map background**, preserving its
existing warning and actual semantics. Do not alias Publish, Use at table, and Travel to one
generic Open button. **Create map**, **Generate in this area**, **Generate map for location**,
and **Generate & enter** must describe their different destinations before committing.

## 3. Interaction contracts — pin these before changing chrome

### 3.1 Cancellation and closing priority

One interaction owner handles an Escape; competing global handlers must not also run.

1. Let a native control popup or IME composition handle its own Escape.
2. If a modal or foreground popover is open, close/cancel that topmost layer only; preserve
   the underlying tool and selection. A destructive confirmation's Escape means Cancel.
3. Otherwise, an active canvas gesture is cancelled first: discard its preview and
   **unsent gesture accumulation**, retain the armed tool, and ignore the eventual
   pointer/finger release. This is not cancellation of an already dispatched operation.
4. Otherwise, close the topmost open content panel/sheet and return focus to its launcher.
5. Otherwise, leave the active tool/build mode for Move. A later Escape may clear a Move
   selection through the existing selection contract; it must not destroy content.

Opening a foreground modal, changing roles, or choosing Done/Move while a gesture is in
flight discards its unsent accumulation before changing the surface. For release-committed
gestures, releasing normally commits. Desktop Place/Scatter/Light currently dispatch on
pointerdown: Escape after dispatch cannot retract that command, even before its reply;
**Undo map edit** is the distinct recovery action. This arc does not change those desktop
tools to a release/confirmation model. A mere layout breakpoint change preserves compatible tool/dial
state and cancels any in-flight pointer gesture; it must never flush an unfinished stroke.
Mobile **Cancel stroke/placement** and second-finger cancellation use the same cancellation
primitive. Back closes a screen; it does not undo data. Navigation never silently saves a
staged inspector form: **Save changes / Discard changes / Keep editing** names the choices.

### 3.2 Draw and terrain share a grammar, not units or data

Both show **Tool → Settings → History → Done**, the active tool, and a preview footprint.
Drawing settings are **Stroke width (px)**, Color, Opacity (%), and Fill for shapes.
Terrain settings are **Material** and **Brush size (cells)**. Default terrain size stays
one cell; the planned explicit size choices are 1, 3 and 5 cells with a centered square
footprint. Erase uses the matching footprint and names its target.

**Erase drawings** affects annotations; **Erase terrain** affects terrain cells; **Delete
selected object** affects the selected document/table object. A terrain wall material is
not a movement-blocking Wall. Area templates retain their grid/measurement behavior.
Color is not shown while erasing; map material selection is not called brush thickness.

History remains honest: **Undo drawing** is the player's annotation history; **Undo map
edit** is the current document's server history, shared by DMs. Selection transforms keep
their existing history route. Visible controls and keyboard shortcuts must choose the
same history owner; pressing Undo in a text input retains native text editing.
Cancelling an unsent gesture produces zero commands; it does not retract previously
dispatched point-tool actions. One committed brush gesture stays one command.

### 3.3 Authority and state

- Preserve server-enforced role, ownership, fog, discovery, secret-door, and document gates.
  Hiding a button is presentation, never the permission implementation.
- A player sees no enabled destructive DM command. **Clear all drawings** is DM-only and
  keeps the current confirmation. Do not invent player-wide clear semantics in this arc.
- Reuse the one App-level MapStudio controller. No second queue, document store, rendering
  producer, or client-side secret filtering is created for a new menu.
- Role elevation uses the existing password flow. On successful demotion, cancel authoring,
  dismiss DM-only panels, clear privileged selections/previews, and return to Move. Do not
  wait for another user interaction to hide DM controls. Failed elevation retains the player
  surface and announces the error; Player View remains a preview, not a role switch.
- Library inspection, travel, reconnect, and role changes must not apply a queued edit to a
  different document. A save result belongs to its original document and element identity.
- Preserve character-vs-player distinctions. One seat may own multiple characters; Party
  and character editing must not merge their names, conditions, HP, or focus targets.

### 3.4 Feedback, defaults and accessibility

Use visible labels and native buttons; icons supplement meaning. Active tools expose
`aria-pressed`; tabs expose the correct tab relationships; labels name inputs including
units. Keyboard focus is visible. Dialog focus is contained and returned; nonmodal tool
palettes do not trap the canvas. Hover-only instructions and right-click-only pinning get
equivalent accessible controls. Body copy uses the readable body font, not tiny pixel text.

Every interactive target is at least 44×44 CSS px on touch. Critical action/close controls
remain reachable at 375×812, a short landscape viewport, tablet size, and desktop with 200%
zoom. The status badge takes layout space or moves into the screen header; it cannot cover
a title. Reduced motion and existing sound preferences survive migration; no new motion
is needed to explain these controls.

Forms with multiple related properties stage a draft and have one primary **Save changes**;
immediate commands use action verbs such as **Roll d20 now**, **Travel here**, **Open door**.
Dice selection says **Add d20** and does not resemble immediate rolling. Disabled actions
have a nearby reason; pending operations show Working/Saving accurately, errors retain the
draft, and success means an acknowledged result. Existing confirms are reused, not doubled.

### 3.5 Operation feedback is correlated to the operation

Generate and the combined inspector form need a bounded outcome seam in the existing
controller. Current action methods return `void`; `saving` and `error` describe the queue,
not a particular form or command. Attach a local request handle/callback to the **queue
entry at enqueue**, retaining its original document identity. The existing wire
`commandId` is minted only at dispatch; bind it to that handle when dispatch occurs and
match its `appliedCommandId` acknowledgement/error. Do not infer operation success from
`saving === false`, a revision increase, a document broadcast, or an unrelated command's
success.

Characterize every existing removal path before adding the handle. Today a dispatch-time
document mismatch clears the queue, a deletion frame clears queue/in-flight bookkeeping,
and unmount has no settlement cleanup. A document switch does not itself recall a command
already sent; a late matching response can still complete that original request.

| Request lifecycle | Required outcome |
| --- | --- |
| Matching command acknowledged | Succeeded once, for the original request/document. |
| Matching server refusal | Failed once with its reason; retain editable inputs for deliberate retry. |
| Unsent entry dropped on document mismatch, deletion, or disposal | Failed once with a cancelled-before-send reason; never remain Pending waiting for a wire ID it never received. |
| Already-sent request loses tracking on deletion/disposal | Settle with completion unavailable; the effect may have occurred. Never claim rollback or unchanged state. Reconcile before a fresh retry that could duplicate the edit. |
| Disconnect with retained in-flight request | Pending/reconnecting; preserve replay of the exact message and command ID, not a new generation. |
| Late reply after settlement or screen/document change | Cannot settle twice or mark another screen's operation successful. |

Use explicit pending/succeeded/failed outcomes with reasons that distinguish rejection,
unsent cancellation, and unavailable completion. A dropped entry must settle rather than
leaving Generate stuck Pending. An unresolved timeout is not success or proof of failure;
the existing list/get/create/import loading watchdog is not a command timeout. Preserve
command serialization, reconnect replay/deduplication and protocol authority. This is a
bounded API addition in the existing controller, not a second queue or a transaction
engine. U3a establishes this seam; U5 reuses it for each save member.

## 4. Context and implementation boundaries

Paths below are relative to `apps/client/src/` unless explicitly qualified. Read the named
symbols and existing tests, not every neighboring feature. Recheck current headroom with
`pnpm lint:structure`; the measured baseline below is specific to the audited checkout.
Bare filenames following a qualified file are siblings in that directory; in map-edit
capsules, `mobile/` means `features/map-edit/mobile/`. The common seam names below also
provide the full paths for abbreviated layout references.

Common seams: `components/layout/Header.tsx`, `layouts/TopPanelLayout.tsx`,
`layouts/FloatingPanelsLayout.tsx`, `layouts/MobileLayout.tsx`,
`components/layout/MobileFloatingControls.tsx`, `layouts/mobile/MobileScreen.tsx`,
`hooks/useToolMode.ts`, and `ui/App.tsx` for the existing shared state/controller plumbing.
Use small sibling modules for navigation descriptors, tool descriptors, draft forms, and
interaction ownership. Keep DM/map-edit implementation imports behind existing lazy chunks;
the player entry may import a small data-only descriptor, not the full editor.

### 4.1 Measured headroom and extraction order

The structure reporter counts `readFileSync(...).split("\n").length`. At `0007e517`:

| File | LOC | First affected work |
| --- | --- | --- |
| `features/map-edit/useMapEditTool.ts` | 349 | U2 cancellation; U4 reuses the extracted gesture seam. |
| `features/map-studio/useMapStudio.ts` | 328 | U3a queue lifecycle and correlated outcomes. |
| `features/map-edit/useMapEditState.ts` | 347 | U3b tool/state composition; U5 reuses it. |
| `features/map-edit/MapEditToolbar.tsx` | 341 | U3b persistent controls and contextual panels. |
| `features/dm/components/map-controls/MapStudioControl.tsx` | 349 | U6 current-map/library management. |
| `features/players/components/PlayerCard.tsx` | 480 | U7 compact Party/character responsibilities. |

U2 starts with the Escape inventory below, then characterizes and extracts the minimal
cancel seam before behavior changes. U3a characterizes queue lifecycle and extracts a
bounded responsibility before adding outcome handling. U3b and U6 likewise open with
characterization and the necessary composition/presentation extraction before feature
edits. U4/U5 reuse earlier seams and check remaining headroom first; do not perform another
extraction merely to satisfy a ritual. U7 must characterize and extract the relevant
PlayerCard responsibility before adding compact-Party behavior. Do not grow grandfathered
oversized files, raise the guard baseline, or turn these extractions into general cleanup.
Keep each extracted module within the 348-LOC working budget after formatting.

## 5. The slices

### U1 — The player finds Move and Chat

**Goal:** the first improvement is a complete, small player journey: draw a mark, return
to Move, and send a message without interpreting Log as communication.

**Context capsule:** `Header.tsx`; `MobileFloatingControls.tsx`; `hooks/useToolMode.ts`;
`components/dice/RollLog.tsx`, `RollLogContent.tsx`, `ChatTab.tsx`;
`features/drawing/components/DrawingToolbar.tsx`; `hooks/useDrawingStateManager.ts`.

**Changes:** add explicit desktop Move with active state; share Ping/Draw terminology;
rename the Log/Roll Log screen to Chat & Rolls and its phone dock entry to Chat. Expose
Chat on first entry, remembering the last tab thereafter. Group current header controls
into tools versus panels without relocating the entire app yet. Gate Clear all drawings
by DM capability and keep its confirmation.
Update the affected help entry and mobile labels in the same slice.

**Tests:** real player journey drawing → Move → token movement → Chat; Rolls remains
reachable, private/public scope unchanged, and no duplicate log panel mounts. Assert the
player cannot see an enabled Clear command and the DM confirmation still cancels safely.
At 375px width the five dock labels fit without wrapping, overflow, or shrinking the
established font/touch targets; the opened screen still identifies Chat & Rolls.

**Done when:** a fresh player can locate the next action from visible labels on desktop
and phone, and the other tab receives the chat message and completed drawing.

**Traps:** do not reset the active log tab on every snapshot; do not conflate Move with
Transform or map-element Select; preserve roll-result auto-open behavior deliberately.

**Escalate if:** changing the Chat default would lose pending compose text or duplicate
subscriptions; isolate and repair that state ownership before moving more controls.

### U2 — Cancel means cancel, and Escape has one owner

**Goal:** no unfinished grass stroke is published by Escape; foreground windows close
predictably without changing a hidden tool.

**Context capsule:** `hooks/useToolMode.ts`, `useDrawingTool.ts`, `useKeyboardShortcuts.ts`;
`features/map-edit/useMapEditCancel.ts`, `useMapEditTool.ts`, `useMapEditHotkeys.ts`;
`components/dice/DraggableWindow.tsx`; `features/players/components/PlayerSettingsMenu.tsx`;
`features/atlas/WorldMapPanel.tsx`; mobile screen/sheet and `MobileMapEditDock` adapters.

**First commit — inventory and characterization:** re-scan every executable Escape
handler before changing handlers. The audited checkout has 15 owning files, **8 global
and 7 local**, not fifteen global listeners:

| Ownership at audit | Files/symbols to classify |
| --- | --- |
| Global capture | `MapEditQuickWheel`, `useMapEditCancel` |
| Global bubble | `useKeyboardNavigation`, `useToolMode`, `InitiativeModal`, `useAtlasLinkAim`, `useKickedInDoor`, `HelpMenuButton` |
| Local React handlers | `MacroBar`, `HandEntry`, `DiceToken`, `AtlasNodeRow`, `KickPanel`, `MapEditBrushDeck`, `CharacterCreationModal` |

Record event target (window/document/element), phase, activation condition, editable/IME
handling, action, propagation, focus behavior, and ownership against §3.1's ladder.
Characterize overlapping handlers before the bounded extraction in §4.1. Inventorying all
owners does not authorize rewriting all fifteen: new window close/focus-return behavior
remains scoped to Character, World, Chat & Rolls, and DM. Preserve valid local input
cancel behavior and explicitly classify handlers that remain unchanged.

**Changes:** implement §3.1 through one explicit interaction-owner contract. Reuse the
existing full map cancel primitive for Escape, including brush refs and touch aiming;
remove the exit-mode flush for an explicitly cancelled gesture. Apply close/focus-return
behavior first to Character, World, Chat & Rolls and DM windows. Scope Undo labels and
keyboard ownership to the same active interaction context. Keep an accessible Cancel
stroke/placement action while a gesture is active.

**Tests:** press/paint/Escape/release emits zero terrain commands and retains Paint;
second Escape exits when no panel is open. Repeat for annotation, room drag, erase and
unsent touch placement. Separately prove desktop point-tool pointerdown still dispatches
once, Escape does not claim to retract it, and Undo reverses the acknowledged edit.
Escape on a foreground Character/World/Log panel closes only that panel;
text undo stays native. Use trusted pointer/touch events for canvas paths.

**Done when:** keyboard and touch follow the same cancel contract; ghosts disappear;
release after cancel cannot commit; close returns focus to the correct launcher.

**Traps:** capture listeners currently compete; consuming an event in two places can make
tests pass while the wrong owner changes state. Opening a modal must cancel a preexisting
gesture before taking ownership. Do not break the second-finger camera escape.

**Escalate if:** the ownership change requires replacing the camera/touch router. Extract
the minimal cancel/dismiss seam and characterize it first; do not rewrite input wholesale.

**Senior review gate:** run `review-convergence` under §8, including independent
gesture/cancellation and keyboard-focus lenses and the negative assertion that no
command reached the server.

### U3a — Generate reports the server's outcome (IA-18)

**Goal:** a rejected generation remains editable and retryable; **Built here already**
appears only for a matching successful generation on this document.

**Context capsule:** `features/map-edit/useGenerate.ts`, `GeneratePanel.tsx`;
`features/map-studio/useMapStudio.ts`, `useMapStudioActions.ts`, `types.ts`, and the
existing acknowledgement/readout handlers. At the audited checkout, `useGenerate.ts`
dispatches at line 151 and eagerly sets `lastBuilt` at line 157; the recipe
signature at line 132 omits document identity. Match these symbols before editing.

**Changes:** characterize/extract the controller lifecycle under §4.1, introduce §3.5's
queue-entry request handle and settlement rules, then drive Generate's pending/succeeded/
failed UI from its matching request. Set `lastBuilt` only on its success;
include document identity in the successful recipe/region signature. After rejection,
retain the chosen region/dials and allow the same inputs to retry without a forced seed
reroll. Validate region containment against the actual document bounds before dispatch,
show the invalid portion/reason in the preview, and preserve authoritative server checks.
An unrelated edit or late result for document A must not label a request on B as built.

**Tests:** out-of-bounds region gives a useful local preview; server-side rejection despite
local validation shows Failed and permits unchanged retry; successful retry sets Built
only after the matching acknowledgement. Test pending/unrelated acknowledgement,
document switch, same recipe on another document, late success/error, and reconnect replay
without duplicate generation. Do not use a synthetic revision bump as the success oracle.
Exercise an entry queued before it receives a wire ID; every unsent drop path; a sent
request followed by document switch and late acknowledgement; deletion/disposal; and
exactly-once settlement after late replies. Characterize deletion of an unrelated document
before altering its current queue-clearing behavior. A dropped entry cannot hang Pending,
and loss of tracking for a sent request cannot be described as a successful cancellation.

**Done when:** reproduce IA-18, observe a truthful failure, correct or retry the inputs,
and receive exactly one successful generation; status and disabled state agree with its
own outcome on desktop/mobile and across document changes.

**Traps:** queue-wide `saving/error` cannot identify the generation result. Clearing an
error alone does not undo eager `lastBuilt`. The existing `void` action API must gain the
bounded request handle/readout before the UI can truthfully claim acknowledgement.

**Escalate if:** a relevant error lacks existing command correlation; identify the exact
gap before adding protocol fields. Do not substitute guessed success from a revision.

### U3b — A grouped build palette with stable controls

**Goal:** a DM can switch Room → Paint → Generate and still find history, Layers and Done
in the same place; only the selected tool's settings compete for space.

**Context capsule:** `features/map-edit/MapEditToolbar.tsx`, `MapEditToolPanels.tsx`,
`mapEditToolKinds.ts`, `useMapEditState.ts`, `usePopulate.ts`;
`mobile/MobileMapEditSheet.tsx`, `MobileMapEditToolPanels.tsx`, `mobileToolTiles.ts`;
`components/layout/MobileMapEditPalette.tsx`, `MobileMapEditDock.tsx`.

**Dependency:** U3a's outcome repair lands and passes first; palette rearrangement must not
bury its regression or relabel a rejected operation as successful. Complete §0.1's
checkpoint and record the destination decisions before dependent restructuring.

**Changes:** create a shared descriptor inventory for §2.2's groups, names, help and
capabilities. Separate persistent document controls from active-tool panels, eliminating
Generate/Spline early-return losses. Pin scoped history and Done; render contextual
Populate with a named/highlighted valid target. Preserve quick wheel, favorites and last
tool/group. Surface Working state when the current interaction is temporarily unavailable.

**Tests:** every current tool appears once, all groups activate the existing handler,
Layers/history/Done remain reachable from all tools, and invalid Populate never looks
ready. Exercise fully bound palettes at phone and short desktop heights, not just the
one-button pre-bind empty state.

**Done when:** build a room, decorate that room, paint, generate, inspect and undo without
scrolling through unrelated tool options; no tool or mobile capability has disappeared.

**Traps:** renderer/tool-kind sets already exist; descriptors must derive from or exhaust
them instead of adding another drifting list. Preserve DM chunk splitting. A disabled
gesture must not silently vanish behind a button whose busy flag is unrelated.

**Escalate if:** Populate needs a different geometric target model; keep the last-room
contract explicit and record arbitrary-room targeting separately.

### U4 — Drawing and terrain feel related without lying about units

**Goal:** a user understands green ink versus grass, sees the footprint before committing,
and can find equivalent settings on desktop and touch.

**Context capsule:** `features/drawing/components/DrawingToolbar.tsx`;
`layouts/MobileDrawingControls.tsx`; `features/map-edit/MapEditBrushDeck.tsx`, `brushDeck.ts`,
`usePlacementDials.ts`, `useMapEditSelection.ts`, `useMapEditTool.ts`;
`features/map-studio/components/useTerrainBrush.ts`; `features/map-edit/MapEditAssetPicker.tsx`;
`features/dm/token-library/TokenLibrary.tsx`; the existing preview layer and tests.

**Commit sequence:** U4a aligns drawing settings and terminology; U4b adds terrain
footprints and sample routing; U4c aligns collection browsing. Gate each before the next;
do not bundle the new brush behavior with the picker presentation refactor.

**U4a status (2026-09-25):** drawing settings and terminology passed initial full
verification/fresh boot. R1's three test/documentation findings are repaired and
pass the repeated full ladder and fresh boot. R2's three repairs also pass the full
ladder and boot. Final R3 reached the cap and plateau with three P3 findings;
all three bounded repairs now pass fresh full verification and boot. The verified
owner checkpoint was accepted on 2026-09-26 and committed as `681bc391`. See the verification
record. Desktop and phone
share labels/settings and retain the existing drawing state, history and authority.
U4b's R1 and R2 repairs pass full verification and boot. Final R3 was incomplete after
an agent-limit error; the owner accepted the verified checkpoint on 2026-09-26 with
“Accepted”. The scoped local commit is `63505c56`; its audit passed. U4c collection
browsing is active under the existing onward authorization. The combined U4 Done-when below
is not yet complete.

**Changes:** use the Tool/Settings/History grammar and explicit eraser names; provide
mobile opacity/fill where applicable and hide irrelevant settings. Add actual terrain
1/3/5-cell brush footprints, default 1, through the existing accumulated-cell command;
preview the exact footprint and deduplicate/interpolate crossed cells for fast strokes.
The explicit **Sample** tool sends material samples to Paint and object samples to Place,
with the resulting tool and selection shown. Preserve the existing Ctrl/Cmd-sample shortcut's
same-tool behavior; do not silently change that accelerator while fixing explicit Sample.
Keep material pins/recents and expose a labeled Pin action.
Collection pickers share visible item names, search, category selection, selected-item
preview and **My uploads** terminology where uploads exist. Material, object and character
token collections remain distinct catalogs with their existing storage/permissions;
reuse capabilities rather than inventing one universal asset store. Object swatches must
not depend on hover alone to reveal what will be placed. Mobile keeps the supported local
library; a new upload pipeline remains deferred.

**Tests:** footprint boundaries at grid offsets/transforms; fast strokes have no unintended
gaps; overlapping footprint samples yield one command and one undo entry; cancel sends
nothing; explicit Sample of grass resumes Paint while an object chooses Place, and
Ctrl/Cmd-sample retains the active tool. Drawing opacity,
fill and widths survive a responsive layout change without changing terrain semantics.
Find a named object and character token by search, select it by keyboard/touch, inspect
its name before placement, and verify that category changes preserve a valid selection.

**Done when:** annotate in green, erase the mark, paint grass with each size, sample it,
erase terrain and undo; the user can predict the affected data and footprint throughout.

**Traps:** terrain cells, document pixels and world pixels are different units. Do not
change frozen render output or terrain generation to make a slider look effective. Keep
brush growth bounded by existing command validation/size limits and deterministic cells.

**Escalate if:** a 5-cell stroke exceeds current validation limits under ordinary usage;
measure the cap and split footprint functionality from any needed protocol work.

### U5 — Selected properties and lighting have an obvious home

**Goal:** selecting a door explains what is selected and gives one clear save action;
making it night no longer requires interpreting layer compositing.

**Context capsule:** `features/map-edit/useMapEditSelection.ts`, `useMapEditState.ts`,
`MapEditInspectorPopover.tsx`, `MapEditLayersPopover.tsx`;
`mobile/MobileElementInspector.tsx`, `MobileLayersPanel.tsx`;
`features/map-studio/useMapStudio.ts`, `useMapStudioActions.ts`, `types.ts`;
`packages/shared/src/mapStudioTypes.ts` for the real update contract.

**Changes:** selecting an element shows a compact Properties summary (type/name/layer),
with advanced position/scale controls collapsed and units visible. Keep the phone map
reachable: selection updates the summary but does not force a full-height inspector.
Replace APPLY/APPLY DOOR with one **Save changes** covering the staged form and a distinct
Delete action. Queue existing `update-element` and `update-door` operations through the
single controller; reuse U3a's command-correlated outcome seam (§3.5) for each member and
show success only when every required command has its matching applied acknowledgement.
Current `void` actions and queue-wide `saving/error` alone cannot provide this guarantee;
do not infer per-field completion from queue idle or document revision.
On partial failure name what saved, retain unsaved fields and prevent duplicate retries.
Add **Ambient light** (percentage, Dark → Daylight) in Lighting, backed by the existing
Lighting-layer opacity. Other layer sliders say Opacity and show their percentage.

**Tests:** combined transform/door edit, delayed acknowledgements, first/second operation
failure, element switch with unsaved draft, and selected-element deletion. No snapshot
ack wipes unrelated staged fields; unrelated/late acknowledgements cannot complete the
form for another document or element. Ambient light and the underlying layer remain one
value, survive reopen, and update the player view without exposing hidden elements.

**Done when:** select a door, change width/state/position, save once and observe the
acknowledged result; set ambient light and place a light without opening layer internals.

**Traps:** `MapElementUpdate` does not include door data. A two-command save is not atomic
and can require two **Undo map edit** actions; keep that honest in help/feedback. Do not
manufacture a client-only combined undo or silently promise one server transaction.

**Escalate if:** a product requirement demands atomic combined save/undo; that needs a
separate server command-contract slice, not a hidden addition to this inspector refactor.

### U6 — Current map, library and World become distinguishable

**Goal:** a DM always knows what the party sees, what document is being inspected, and
whether the next action edits, changes the table, or travels to a location.

**Context capsule:** `features/dm/components/tab-views/MapTab.tsx`;
`features/dm/components/map-controls/MapStudioControl.tsx`;
`features/map-edit/useMapEditState.ts`; `features/map-studio/useMapStudio.ts`;
the existing `useFollowLiveDocument` behavior;
`features/atlas/AtlasTab.tsx`, `WorldMapPanel.tsx`, `RecipeDials.tsx`, `KickPanel.tsx`;
`atlas-arc-plan.md` binding-transition table and existing transition/backup tests.

**Changes:** implement §2.3's Current table map/Map library status and action names.
If another document is selected, opening Build offers **Resume editing <current map>**;
only choosing it resumes that document. Preserve explicitly opened library B through
`useFollowLiveDocument` until that choice. **View saved map** shows current metadata/details,
not a new rendered preview or retired editor. Group background/grid/fog/vision under Current table map → Settings, with
advanced transform/alignment collapsed. Rename Atlas's home World, keeping the location
tree, discovery and links. Make generation actions state their destination and make
Kick in a Door's committing button **Generate & enter**; seed reroll remains a separate,
noncommitting control. Rename backup/image actions
by scope, preserve existing confirmations, and distinguish copies in library labels.

**Tests:** live A, inspect imported B, open Build and retain B until explicit Resume A;
then resume A; explicitly use B at table; World A→B→A
travel preserves scene state. Reopen/resize cannot bind a different map. Verify import,
background publish, map image export and table backup remain different working paths.

**Done when:** at every map entry point a DM can identify On table and Viewing in library,
and predict whether the party moves. Players retain a discovered-only World surface.

**Traps:** do not invoke another controller, reintroduce Studio scene UI, equate raster
publish with set-live, or treat a generated location as a painted region. Privacy remains
server-projected; changing navigation cannot reveal undiscovered names in player markup.

**Escalate if:** a desired library action lacks an existing safe binding transition. Add a
bounded integration sub-slice with the Atlas transition contracts before exposing it.

**Senior review gate:** run `review-convergence` under §8 with map identity,
travel/state preservation and player secrecy lenses.

### U7 — Party is compact; a character is not a player seat

**Goal:** keep common HP/condition/focus actions available without filling the lower map
with expanded cards, and make every owned character independently discoverable.

**Context capsule:** `components/layout/EntitiesPanel.tsx`, `MobileEntitiesList.tsx`;
`features/players/components/PlayerCard.tsx`, `PlayerSettingsMenu.tsx`, `NameEditor.tsx`,
`HPBar.tsx`; `layouts/mobile/MobileCombatStrip.tsx`; existing multi-character, conditions,
rename, focus, and character deletion tests.

**Changes:** default desktop Party to a compact character roster with name, portrait,
HP, condition summary and Focus; selection opens the existing character details in one
inspector. Expand the roster on demand. Phone Party remains a screen and lists characters
under their player seat instead of silently choosing the first character. Separate
**Character** (name/art/HP/status/token) from **Token settings** (size, movement, vision,
ownership where allowed), retaining accessible upload empty-state instructions.
Move role and table controls out through U9; until then provide a forwarding shortcut.

**Tests:** two characters on one seat keep distinct condition/HP/name/focus/delete paths;
DM and player see permitted actions only. At 1366×768 the collapsed roster leaves at
least 60% of viewport height for the map with ordinary header chrome and no open modal;
no clipping at 200% zoom or 375px phone width. At 1440×900 with Party/NPC cards and player
props enabled, every character gear/focus/HP control receives the intended click:
World/Objects launchers occupy reserved layout space and cannot overlap the roster.

**Done when:** find either of two owned characters, focus/move it, adjust HP and condition,
then close details and resume play; a DM can do the equivalent permitted NPC operations.

**Traps:** preserve the recent per-character condition repairs and deletion/refill rules.
Do not derive focus from a naive owner match that accidentally selects an NPC or sibling.
This is a presentation change, not the future animated Battle Strip implementation.

**Escalate if:** a roster cannot resolve all characters from current snapshot data; verify
the real identity links before adding fields or assuming one character per player.

### U8 — Encounter is the single combat home

**Goal:** prepare combat, roll initiative, change turns, and finish combat from one place.

**Context capsule:** `features/dm/components/tab-views/PlayersTab.tsx`, `NPCsTab.tsx`,
`SessionTab.tsx`; `features/dm/components/DMMenuTabs.tsx` and existing DM prop plumbing;
`features/initiative/components/InitiativeModal.tsx`; `hooks/useCombatOrdering.ts`,
`useBulkInitiativeRoll.ts`, `useInitiativeSetting.ts`; current combat strip/card tests.

**Changes:** introduce Encounter as a composition of existing controls: **Setup** (add
NPCs shortcut, participant list, monster HP visibility), **Initiative** (**Roll missing
initiative**, character rolls/manual values as permitted), and **Run encounter** (start/end,
previous/next, current turn). Keep compact turn/focus controls on the play surface and
character INIT as shortcuts into this same state. Table permissions remain under Table,
but disabled manual entry links to the relevant permission instead of seeming broken.
Label dice builders **Add d20** and instant actions **Roll d20 now**; apply the same
commit vocabulary to initiative. Remove duplicate authoritative controls from old tabs.

**Tests:** DM adds a group, rolls missing initiative without rerolling existing values,
a player rolls their character, starts
or joins combat through existing rules, advances, edits HP, and ends; both tabs agree.
Keep existing allowed player turn actions and recent turn-successor/budget protections.
Large dice selection still stages a build; instant roll produces exactly one roll.

**Done when:** the encounter journey needs no hunt through Players/NPCs/Session; all
outcomes and turn/HP permissions match existing server behavior on desktop and mobile.

**Traps:** initiative can currently start combat automatically; name that effect instead
of assuming Start is always a separate step. Do not migrate the combat state machine,
change turn ownership, or introduce new damage automation while moving controls.

**Escalate if:** duplicate controls have diverged behavior; characterize and reconcile
that behavior explicitly before composing them into the new home.

### U9 — Table, role, personal preferences and recovery are separate

**Goal:** a new host can find DM elevation and invitations; a player can find personal
settings; everyone can tell a character export from a whole-table restore.

**Context capsule:** `features/players/components/PlayerSettingsMenu.tsx`;
`features/dm/components/DMMenu.tsx`, `DMMenuTabs.tsx`, `tab-views/SessionTab.tsx`,
`tab-views/PlayersTab.tsx`; current table entry/elevation and session controllers;
`components/layout/ServerStatus.tsx`; `features/help/helpTopics.ts`, `dmHelpTopic.ts`;
existing presentation preference hooks and current session-identity tests.

**Changes:** complete Table and Preferences destinations from §2.1. Put role state and
Enter/Leave DM mode in Table, reusing password/error handling. After creating a table,
show **Enter DM mode** and **Invite players** as the next host steps without auto-elevating.
Table contains **Invite**, **Players at this table**, **Permissions**, **Backups**, and
**Security**; NPC editing stays Characters, combat stays Encounter. Name all backup and
restore scopes before file selection, with automatic persistence explained separately.
Preferences contains Display and Sound & motion; retain existing stored values. Put
connection state in the active header/status area so ONLINE cannot cover screen titles.
Replace implementation prose in ordinary panels with short outcome statements: capacity
says what can still be created and what to do next; roll-entry permission says who may
enter results; monster HP says what players can see. Mint byte ceilings, scene installation
details, and connection-filter implementation belong in Advanced/help, not the main task.

**Tests:** fresh host creation → elevation → invitation; failed elevation; successful
demotion while a build gesture/panel is active; reconnect and conflict gates keep their
existing protections. Exercise valid/wrong-kind/cancelled imports in a disposable table,
character save/load, and preference persistence. Measure status/title non-overlap.

**Done when:** host and player settings are findable by task; role changes cannot leave
DM controls or unfinished commands active; the correct recovery scope is obvious.

**Traps:** do not bypass the session token/password flow or add a new owner/co-DM role.
An absent seat is not a deleted character; retain REMOVE's existing server refusal and
cost explanation. Keep quota/storage internals under Advanced, with useful errors visible.

**Escalate if:** a new entry flow would change table creation or elevation authority;
keep the guided links and leave permission changes for their own authorized arc.

### U10 — Finish the words, accessibility, and complete journeys

**Goal:** the proposed information architecture is consistent in every reachable surface,
with evidence that a newcomer can complete the table loop on both input models.

**Context capsule:** the audit report and U1–U9 changed files; `features/help/helpTopics.ts`,
`dmHelpTopic.ts`; relevant `docs/user-guide/` pages; existing desktop/mobile e2e journeys.

**Changes:** remove obsolete forwarding entries once new homes work; audit visible text,
tooltips, accessible names, help, empty states and error messages against §2.1. Resolve
Burst/Cone/Cube/Bolt naming consistently (explain shape in descriptions), Pointer/Ping,
Free/Freehand, Hall/Hallway, Gen/Generate, Spline/Rope or curve, My Stuff/Custom → **My
uploads**, JUICE → Sound & motion, and save/export scope terms. Fix Recenter's misleading
center-of-map claim; name the actual action rather than promising new camera behavior.
Audit private dice copy so Me means only the roller, and DM means the documented DM
audience. Microphone failure instructions must fit the browser and permission failure.
Complete keyboard/focus/label/touch target checks on every changed surface; accessibility
is part of each earlier slice, not postponed wholesale to this pass.

**Tests:** complete the §7 journeys with player and DM clients, realistic data, narrow
landscape, phone/tablet, keyboard-only, 200% zoom and reduced motion. Validate the actual
controls currently visible; a test of an unopened accordion is not proof that it fits.
Use existing feature suites for behavior and targeted e2e for cross-surface routes.

**Done when:** every audit finding has a linked fix/evidence, a reasoned nonissue, or a
named deferral; no capability in the inventory is orphaned. Publish a durable comparison
report with screenshots, measured map space, task paths, observed failures and limits.

**Traps:** tests often pin old labels. Update them to the intended user contract without
weakening unrelated assertions. A screenshot proves appearance, not authority, transport,
device gestures, or recovery. Do not call an emulated phone a physical-device pass.

**Escalate if:** a promised journey remains blocked by an unrelated missing product
capability; record the exact gap instead of declaring feature parity from menu presence.

**Senior review gate:** run `review-convergence` under §8 with discoverability/content,
keyboard and touch, state/history/permissions, and test-quality lenses, using the completed
two-client journey evidence. Report any lens that failed to run and record residual risks.

## 6. Failure drills and deliberate deferrals

| Trigger | Required behavior / check |
| --- | --- |
| Escape while painting, then release | No terrain command, no ghost, same tool; next Escape follows the closing ladder. |
| Character dialog over an active tool | Escape closes only the dialog and restores launcher focus. |
| Resize or rotate mid-gesture | Cancel pending gesture, retain compatible settings, leave a reachable exit. |
| Demote DM while building | Cancel and hide DM-only state immediately after confirmed role change; server stays authoritative. |
| Select map B while A is live | Name both; opening Build resumes A deliberately, never creates a third map by implication. |
| Travel or reconnect during inspector save | No edit sent to the wrong document; report actual acknowledged/unsaved fields. |
| Undo after drawing, building, typing | Each visible/key action targets the stated owner; text undo stays native. |
| Generated area or Rope active | Layers, history, Properties and Done remain reachable. |
| Generation rejected or late result from another document | Failed/retryable for the original request; no false Built state or lockout on this document. |
| Unsent queued request dropped before dispatch | Handle settles failed/cancelled-before-send even though no wire command ID exists; no permanent Pending. |
| Switch document while a sent request is in flight | Its matching late reply belongs to the original document; a switch alone does not recall the command. |
| Deletion/disposal discards a sent request's tracking | Completion unavailable with possible effect; reconcile before duplicate-producing retry, never promise rollback. |
| Disconnect and reconnect with retained request | Replay the same command ID/message and settle once; no duplicate generation. |
| Populate after its target is invalidated | Disabled with a reason; no stale target presented as selected. |
| Two characters for one player | Distinct HP/status/focus/edit/delete; no first-character shortcut masquerading as the whole party. |
| Private roll or World on player | Only permitted recipients/data; UI relocation adds no secret-bearing client state. |
| Wrong backup kind or declined restore | Clear scope-specific feedback, no table mutation; existing working checks remain. |

**Deferred:** future Battle Strip presentation and damage loop; new co-DM/owner roles;
new generation recipes; fog-aware terrain; replacing the map/renderer/document engine;
physical-device certification beyond hardware actually tested; player map authoring;
unified server transactions for compound inspector saves; arbitrary Populate targets;
new global search/command palette; mobile asset-upload pipeline where still absent.
These are not prerequisites for making existing controls coherent.

## 7. Acceptance journeys and evidence ledger

Use a disposable local table, seeded with two owned PCs, several NPCs, a prop, a raster,
two map documents, discovered/undiscovered locations, a light, and doors in varied states.
Use separate authenticated player/DM identities; testing two tabs that share one seat
can invoke the legitimate session-conflict gate instead of testing collaboration.

1. **Player first session:** join → find/rename own character → focus/move → Draw → change
   width/opacity → undo/erase → cancel → Move → roll publicly/privately → Chat/whisper →
   condition → initiative → save character → help. Every step has a visible entry point.
2. **DM first session:** create/join → Enter DM mode → invite → Current table map → build
   room/hall/door → grass paint/sample/erase → light/ambient → player preview → Done.
3. **Encounter:** library NPC batch → place/hide/reveal → initiative → current turn →
   HP/conditions → next/previous → remove current participant → end; compare player view.
4. **World and recovery:** inspect other map without moving party → use at table explicitly
   → generate location → travel there/back → link → export image/editable map/table backup
   → restore the disposable backup and verify both clients.
5. **Interruptions:** Escape ladder, click outside, close/reopen, text entry, failed upload,
   delayed ack, role switch, reconnect, viewport change, second-finger cancel and pinch.

Record success, assisted discovery, wrong turns, actual control path and visible feedback.
Test at least 1366×768 desktop, 375×812 phone, a short landscape viewport, and tablet;
include keyboard and reduced motion. Record which were emulation versus real hardware.
The executor's before/after screenshots must use comparable state and viewport. Do not
substitute arbitrary task-time targets for measurement with actual users; this audit is
expert evaluation, and a first-time human usability study remains distinct evidence.

## 8. Verification and handoff

Before code commits, use the current `HANDOFF-NEXT.md` §2 gate. PowerShell equivalent:

```powershell
$env:CI = 'true'
pnpm build
pnpm typecheck
pnpm lint
pnpm lint:structure:enforce
pnpm format:check
pnpm test
pnpm --filter herobyte-client build:check
pnpm test:e2e --reporter=list
```

Stop on a failed command; PowerShell does not make this list fail-fast automatically.
Run focused tests before this gate; rebuild shared after any shared-source change. Boot
the dev server when required by the project rules. Preserve existing dev/e2e ports and
running user processes; use the repository's launch configuration. The linked execution
ledger records actual gates and their scope; this plan itself is not verification evidence.

### 8.1 Live acceptance and independent review

Each slice's **Done when** runs through the project's
[`evaluate-live`](../../.claude/skills/evaluate-live/SKILL.md) ladder with separate DM and
player clients. Drive actual input in one and verify the resulting behavior in the other;
use the slice's local UI assertions as well. Use supported browser tools and separate
authenticated contexts available to the executor; do not copy tool-specific launch recipes
from another agent environment. Include desktop and touch paths, measured 44px targets,
and the relevant failure drills. Record observed findings, the weighted score and its
dimensions, and any coverage limits. A score cannot override a failed acceptance condition.
If two-client live evidence is unavailable, report the actual mode and missing evidence;
single-client or static inspection is not a two-client acceptance pass.

Run [`review-convergence`](../../.claude/skills/review-convergence/SKILL.md) at U2, U6, and
U10, and before every owner-authorized merge to main. Per-slice shipping therefore adds
the corresponding per-slice pre-merge reviews, not just the three named arc checkpoints.
Mechanical gates pass before review. Use independent read-only reviewers, union their
findings, fix and reverify, and require successful reviewer runs with all PASS verdicts
and no agent errors. Follow the skill's slice/arc lens coverage and bounded three-round
convergence rules; report a plateau or unavailable reviewer rather than inventing a pass.
Batch lenses within available concurrency. Keep production authorization distinct from
the review verdict and apply the house ladder/current handoff at execution time.

Each execution handoff records: completed slice and commits; next slice; behavior changed;
focused/full checks with actual counts; browser evidence and limitations; review lenses
that ran or failed; live evaluation mode/scores; owner decisions and the U3a checkpoint;
remaining risks and deferrals. Preserve the Escape inventory and queue-settlement evidence
with their slices. Update the audit disposition ledger
as work lands. **The first authorized implementation step is U1, not a shell rewrite.**
