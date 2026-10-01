# HeroByte interface audit — first-session player and DM

**Date:** 2026-09-22, America/Vancouver. **Audited checkout:** `dev`, `0007e517`.
**Disposition:** audit and planning only; no application implementation or deployment.
**Implementation proposal:** [Interface clarity arc](../planning/interface-clarity-arc-plan.md).

**Latest implementation checkpoint (2026-09-30):** U9 addresses IA-17 (the host's role was buried in
character settings and ONLINE covered phone headings: a Table button in the header and
Tools → Table on the phone hold the role, Enter/Leave DM mode and the preferences, and the
connection has a row of its own), the U9 halves of IA-01 and IA-14 (backups now name their scope,
and each file picker names a wrong-kind file) and U9's part of IA-19. Implemented and verified,
uncommitted; review ended at its 3-round cap with every finding repaired, and U9 is not yet
accepted. See [the U9 record](interface-clarity-u9.md).

**Previous implementation checkpoint (2026-09-29):** U8 addresses IA-16 (encounter
preparation crossed NPCs, Players, the cards and Session; Encounter is now one DM Menu
tab, on desktop and phone, and a phone can set initiative). Review stopped at the
3-round cap, every item repaired and verified on the owner's “repair all, verify”;
accepted by the owner and committed on `dev` 2026-09-30 (local, not pushed).
See [the U8 record](interface-clarity-u8.md).

**Previous implementation checkpoint (2026-09-29):** U7 addresses IA-15 (the Party's cards
and the floating World/Props launchers obstructed play; the Party is now a compact roster
with one inspector, and the launchers sit in the Party bar) and IA-20's U7 half (the
settings name label, the clipped portrait instructions, 44 px roster targets).
Its review stopped at the round cap, every round-3 item was repaired and verified on the
owner's decision, and the owner accepted it; committed on `dev` and pushed 2026-09-29. See
[the U7 record](interface-clarity-u7.md).

**Previous implementation checkpoint (2026-09-28):** U6 addresses IA-13 (Maps, the Map
library, Build and World now say which map is on the table and which is being viewed) and
IA-14's U6 half (backups, exports and generation actions name their scope and
destination). Implemented, reviewed for three rounds, repaired and fully verified;
uncommitted pending owner acceptance. See [the U6 record](interface-clarity-u6.md).

**Earlier implementation checkpoint (2026-09-27):** the owner authorized the two
final U5 repairs with “Proceed”. Session-upload remount and ambient accessibility
have compiled RED, 194 affected unit passes/24 files, 34 strict roots and affected
two-client browser passes. Root verifies 78 controls and matching/shared outcomes;
failed test attempts remain recorded. The 58-path full gate/boot repeat is next.
No R4, U5 commit or U6. See [the U5 record](interface-clarity-u5.md).

**Historical R3 stop:** U5 final R3 is VOID because
one reviewer accidentally saw a peer-report line. All four STATIC lenses completed;
runtime/dispatch errors and missing lenses are zero. Three unique flags are retained:
session-upload picker remount, ambient-slider accessibility and stale status. The
checkpoint corrects status text; two code repairs await owner direction. No R4,
product repair, U5 commit or U6 before that direction. See
[the final U5 owner checkpoint](interface-clarity-u5.md#owner-checkpoint--final-review-void-two-repairs-proposed).

**Verified snapshot before R3:** U5 R2 completed four STATIC
lenses, zero agent errors and three flags. Bounded phone-resize, session-upload-name
and evidence-label repairs have compiled RED and 170 affected unit passes/20 files.
All 31 strict roots and the phone two-client journey PASS with zero errors/retries.
Corrected full verification/boot PASS; R3's later result is above and R1 stays VOID. Later pre-R2
gate figures are historical. See [the U5 record](interface-clarity-u5.md).
The first R2 gate attempt failed test formatting and stopped its browser run
without a verdict. Formatting and strict checks are repaired; fresh full gates
under `u5-r2-format-gate-*` PASS: 10,140 unit passes/four skips, 270 browser passes/
three skips, 143.28 KB, zero browser errors/retries/raw diagnostics. All 53 hashes/
31 strict roots match; 77 controls and fresh boot pass. The interrupted attempt
stays recorded. Only result/frontier docs changed for final R3 and its checkpoint.

The interface has strong individual tools, but weak connections between them. A newcomer
must learn where a feature was added: chat inside Log, combat inside Players, DM elevation
inside character settings, night inside layer opacity, and map management inside Map Studio.
The recurring problem is task organization, control meaning and state feedback, not the
retro visual identity. Keep the material deck, live previews, token library, mobile shell,
player lens and campaign travel; give them predictable homes and interaction rules.

The highest-risk inconsistency is **Escape committing an unfinished terrain stroke**.
The most immediate navigation repairs are **an explicit Move action, visible Chat, and
removing the player's enabled but ineffective Clear All command**. A full redesign should
then group Build tools, separate current-map/library/World concepts, and bring encounter
controls together. The accompanying plan makes these separate, reviewable slices.

## Evidence and method

- Actual application use through Playwright Chromium: first as player, then DM; separate
  authenticated browser contexts against a disposable local server. No production table.
- Desktop at 1440×900 and 1366×768; responsive player inspection at 390×844; a separate
  390×844 touch-enabled Chromium context used trusted touch taps and CDP touch drags.
  These are browser emulations, not physical-device or Safari certification.
- Current source and existing tests corroborated findings. Three independent source/docs
  reviews checked feature inventory, drawing/build behavior, project conventions and the plan.
- Fresh impressions were recorded before consulting guides to recover confusing paths.
  This is an expert walkthrough, not a study with recruited first-time human participants;
  no invented task times, success rates, or accessibility certification are claimed.
- 97 raw captures, screen-text snapshots, three downloaded backups, and grass-cancel state
  evidence are in `output/ui-audit-2026-09-22/` (local, ignored). Representative raw screenshots
  (19 screenshots, about 2.8 MB) are preserved in [the durable evidence directory](interface-audit-2026-09-22/).
  Loading/baking captures document transitions; they are not proof of rendering defects.
- Server data was isolated at `output/ui-audit-2026-09-22/data`; all participants were audit
  browsers. The user explicitly approved the local player-props permission test. The setting
  was then enabled and a player-created prop and local image upload were exercised. The
  permission was restored to disabled afterward; audit browsers and dev servers were closed.
- The normal pnpm wrapper attempted dependency maintenance and aborted without a TTY.
  Existing tsx/Vite binaries booted the current source on the normal 8787/5174 dev ports.
  No dependency installation, code patch, build, full test suite, or production operation
  was performed. Existing shared build artifacts were used by the dev server.

**Evidence labels:** **Live** = observed in this walkthrough; **Source** = current code,
not independently reproduced; **Design** = a proposed improvement, not a functional defect.
P1 means repair first because interaction can commit unintended state; P2 means substantial
confusion or blocked access; P3 means terminology/polish. These are product priorities.

## Findings and disposition

| ID | Priority / evidence | Finding | Planned slice |
| --- | --- | --- | --- |
| IA-01 | P2 · Live/Design | Header gives tools, windows and preferences equal weight; no explicit desktop Move | U1, U9 |
| IA-02 | P2 · Live | Chat is concealed inside Log; its tooltip promises dice history | U1 |
| IA-03 | P2 · Live/Source | Player Clear All is enabled but does nothing | U1 |
| IA-04 | P1 · Live/Source | Escape commits an unfinished grass stroke while exiting Paint | U2 |
| IA-05 | P2 · Live/Source | Window dismissal and foreground input ownership are inconsistent | U2 |
| IA-06 | P2 · Live/Design | Fourteen equal-weight map tools and unrelated Populate controls crowd the palette | U3 |
| IA-07 | P2 · Live/Source | Generate and Spline remove Layers and Inspect from the desktop palette | U3 |
| IA-08 | P2 · Live/Source | Drawing and terrain use different meanings of Brush and unequal settings | U4 |
| IA-09 | P2 · Live/Source | Desktop and phone drawing names/settings differ | U4 |
| IA-10 | P2 · Live/Source | Material, map-object and character-token libraries teach different discovery patterns | U4 |
| IA-11 | P2 · Live/Source | Selection and inspection are separate discoveries; door form has two Apply actions | U5 |
| IA-12 | P2 · Live/Source | Night is hidden in Lighting-layer opacity | U5 |
| IA-13 | P2 · Live/Design | Map, Map Setup, Map Studio, Atlas and World do not explain their relationship | U6 |
| IA-14 | P2 · Live/Design | Backups and generation actions obscure scope and consequences | U6, U9 |
| IA-15 | P2 · Live | Large card area and floating World/Props controls obstruct play and settings | U7 |
| IA-16 | P2 · Live/Source | Encounter preparation crosses NPCs, Players, cards and Session | U8 |
| IA-17 | P2 · Live/Source | Host role is buried in character settings; ONLINE overlaps phone headings | U9 |
| IA-18 | P2 · Live/Source | Failed Generate says Built here already and blocks an unchanged retry | U3 |
| IA-19 | P3 · Live/Source | Labels, help and permission explanations drift or expose implementation details | U9, U10 |
| IA-20 | P2 · Live/Source | Small unlabeled/hover-only controls and clipped portrait instructions hinder discovery | U7, U10 |

### IA-01–03 — the first player actions

At 1440×900 the header shows Snap, Recenter, Pointer, Measure, Draw Tools, Transform,
Select, CRT, Juice, Dice, Log and Help as near-equal peers, wrapping onto another line.
The identity block displays a UID rather than a useful table/role entry. DM adds Map and
Player View. A user must infer which items toggle a mode, open a panel or alter a preference.
Mobile has an explicit Move; desktop relies on Escape or toggling the current tool off.

**Reproduce chat discovery:** enter as player → look for chat → open Log → switch from
Rolls to Chat. Public messages and a whisper to another audit browser were submitted.
The header tooltip says “View dice roll history”; the useful chat feature is not named.
Preserve the shared log implementation, but expose Chat & Rolls and an intentional tab policy.

**Reproduce Clear All:** player → Draw Tools → draw a stroke → Clear All. No confirmation
or error appears and the drawing remains. The snapshot still contained the drawing.
The toolbar renders the button without a capability prop; `handleClearDrawings` returns early
for non-DMs. This is an enabled no-op, not a proposal to grant players table-wide deletion.
Keep the existing DM confirmation and hide that command for ordinary players.

Evidence: [player entry](interface-audit-2026-09-22/03-player-ready.png),
[drawing palette](interface-audit-2026-09-22/06-drawing-palette.png),
[player Clear All](interface-audit-2026-09-22/08-player-clear-all-noop.png),
[chat](interface-audit-2026-09-22/13-chat.png).
Owners: `components/layout/Header.tsx`, `MobileFloatingControls.tsx`,
`components/dice/RollLogContent.tsx`, `features/drawing/components/DrawingToolbar.tsx`,
`hooks/useDrawingStateManager.ts` (client source paths throughout this report).

### IA-04–05 — cancellation is not predictable

**Reproduce grass:** DM → Map → Paint → choose Grass → press and drag → press Escape
before mouse-up → release. The palette closes and terrain changes. This was repeated
with Grass explicitly selected; [grass-cancel-evidence.json](interface-audit-2026-09-22/grass-cancel-evidence.json) preserves the before/after
terrain state. An earlier reproduction used the material selected after Sample.
This is not merely a stale cursor: the application snapshot changed after cancellation.

Source explains the difference: room/wall cancellation checks a current drag; terrain
uses another stroke ref. Leaving map-edit flushes that stroke. Ordinary drawing discards
its pending mark on exit. Normalize cancellation of **unsent** gestures, not server history.
Some object/light tools dispatch on pointer-down already; Escape cannot retract an operation
that has been sent. Their Undo and immediate-commit behavior must remain explicit.

**Reproduce dismissal:** open character settings or World; press Escape. Both remained
open in the observed desktop flows. Other tools close or cancel on Escape. Keyboard
ownership needs one priority rule and focus return, preserving native text editing and IME.
Opening/closing a foreground panel must not activate a hidden canvas tool.

Evidence: [grass after Escape](interface-audit-2026-09-22/92-grass-cancel-confirmed.png),
[character settings](interface-audit-2026-09-22/04-player-settings.png).
Owners: `features/map-edit/useMapEditCancel.ts`, `useMapEditTool.ts`,
`hooks/useToolMode.ts`, `useDrawingTool.ts`, `components/dice/DraggableWindow.tsx`.

### IA-06–10 — drawing versus building

Live Map Tools offers Room, Hall, Wall, Door, Light, Paint, Erase, Place, Scatter, Row,
Select, Sample, Gen and Spline in one small grid. Populate's category/density/action controls
remain while painting grass, erasing or placing light, although its target is a previous
room/hallway. Generate and Spline instead return early and remove Layers/Inspect entirely.
Mobile retains a Layers entry, adding another cross-layout difference.

Group the tools by Terrain, Structures, Objects, Lighting and Generate; keep selection,
history, Layers and Done stable. Show Populate only with a named valid target. Do not
pretend arbitrary selected-room population exists; the current last-room rule must be honest.

**2026-09-25 IA-06–07 disposition:** U3b implements these groups, persistent controls
and contextual decoration of the last valid room/hallway, and restores Layers and
Inspect for Generate and Spline. The first-round repairs passed all eight gates,
fresh boot and automated desktop/phone DM-player journeys. Second-round repairs
passed all eight gates and isolated boot. Final review found one stale status
sentence, corrected here. The owner accepted the review-cap checkpoint with
“Accept and commit locally”; U3b is locally complete as `351b5485`.
See [the U3b verification record](interface-clarity-u3b.md) for actual
counts, earlier failures and device limits. Later menu work remains separate;
this update does not expand the original audit's coverage.

**2026-09-25 IA-08 drawing portion / IA-09 disposition:** U4a shares desktop/phone
drawing names, Tool/Settings/History sections and applicable settings. Phone gains
opacity/fill; Stroke/Eraser width is labeled in pixels, and Erase drawings hides
irrelevant settings. State persists through responsive layout swaps. Hide controls
exposes more canvas and survives temporary Tools/Help sheets; restarting Draw expands
the controls. All bounded post-cap repairs pass fresh eight-gate verification and
isolated boot: 10,027 unit passes/four existing skips, 263 browser passes/three existing
skips, zero browser failures/errors/retries. Formal review counts are 3 → 3 → 3,
12 completed STATIC assignments and zero semantic agent errors. Final R3's three
P3 findings are repaired, but its two PASS/two FAIL verdicts remain recorded. The
verified owner checkpoint was accepted on 2026-09-26 with “Can you continue on now?”;
the scoped local commit and onward U4b work are authorized.
See the current verification/review frontier in
[the U4a record](interface-clarity-u4a.md) for actual two-client/touch evidence,
strict RED/GREEN, retained failures and device limits. IA-08's terrain footprints
and sample routing remain U4b; IA-10's collection browsing remains U4c.

**2026-09-26 IA-08 terrain/Sample disposition:** U4b implements square 1×1/3×3/5×5
cell brushes with matching preview, bounded interpolated strokes and one-command
history. Explicit Sample arms Paint for supported materials and Place for other
assets; Ctrl/Cmd retains the current tool. Named desktop Pin and persistent
desktop/closed-phone feedback expose the armed selection. All eight gates and
isolated boot pass: 10,066 unit passes/four existing skips, 265 browser passes/three
existing skips, 138.82 KB gzip and zero browser errors/retries. R1 subsequently found
idle-hover exit and decimal edge-cell defects; both bounded repairs pass focused
verification and six browser cases. Repaired full gates and boot also pass: 10,071 unit
passes/four skips, 265 browser passes/three skips, 138.87 KB gzip and zero browser
errors/retries. R2 found touch-release preview and decimal interior-boundary issues;
both repairs pass 768 focused tests, 47 strict roots and six browser cases without
errors/retries. R2-repaired full gates and boot also pass: 10,080 unit passes/four
skips, 265 browser passes/three skips, 138.88 KB gzip and zero browser errors/retries.
Final R3 is VOID/incomplete after an agent-limit dispatch error: UI/tests partial,
documentation/state unperformed, no new established defect. The owner accepted
the [verified U4b checkpoint](interface-clarity-u4b.md) on 2026-09-26 with “Accepted”,
authorizing scoped local closeout. See that record for
strict RED/GREEN, setup failures, automated two-client evidence and device limits.
IA-10 collection browsing remains U4c; this does not mark combined U4 complete.

**2026-09-26 IA-10 disposition:** U4c adds named object/material cards, object search,
desktop material categories, phone material search and persistent collection previews.
My uploads identifies the browser-local object shelf; Custom remains the shared table
token library. Existing pick/upload/permission contracts remain. Characterization and
compile-valid behavioral RED preceded implementation. Focused checks and six final
desktop/phone two-client journeys pass, including bounded focus-layout and size-wrap
repairs. All seven U4c reach reports pass. Initial gates 1–7 passed; the full browser
run exposed two missed old-picker test selectors. Their migration retains behavioral
assertions, with 19 strict roots and four affected browser journeys now passing.
The second full run finished 265 browser passes/three skips/two failures: one further
phone Sample selector and a real Atlas aimed tap that also opened its door. Bounded
repairs have strict unit/browser RED, 120 affected unit passes and 25 strict roots;
six focused journeys now pass across five unchanged cases and the final Atlas case,
with the public-link oracle failure/correction retained. The third full run passed
gates 1–7 (10,098 unit passes/four skips; 139.69 KB), but E2E finished 258 passes/three
skips/ten failures. Browser startup/teardown diagnosis and a bounded terrain
test-oracle repair now have eight unchanged focused passes plus two corrected
terrain passes, with intermediate failures retained. All 26 actual roots compile.
The fourth full ladder passed gates 1–7, but E2E finished 257 passes/three skips/
eleven failures in 57.1 minutes. All 35 frozen paths/HEAD/strict inputs matched.
Six page-creation failures and other runtime/test-oracle failures remain under
diagnosis; a 30-context blank-page probe passed without reproducing them. Boot
and independent review did not run for that failed snapshot. Bounded native-undo and room-receipt
test corrections compile across 28 roots; all eleven focused cases pass in 161.8
seconds, with zero errors/retries and all 37 frozen paths unchanged. The fifth full
ladder and isolated boot now PASS: 10,098 unit passes/four skips, 268 browser passes/
three existing skips in 30.3 minutes, 139.69 KB gzip and zero browser errors/retries.
Root verified all 37 paths/HEAD/full inventory, 28 strict inputs and seven reach
reports/13 controls. The runtime fault did not recur; its cause remains unresolved.
Independent R1 is VOID/INCOMPLETE after an agent-limit dispatch error: zero completed
assignments, two partial STATIC reports and two unperformed lenses. No actionable
finding was established and no valid review verdict exists. All review hashes match;
the owner accepted the verified checkpoint on 2026-09-26 with "accepted and ready
to proceed", authorizing scoped local closeout and U5 continuation. See
[the U4c record](interface-clarity-u4c.md).

**IA-11 and IA-12 — U5 final repairs implemented and verified; R3 VOID.**
The owner authorized the two product/accessibility repairs; focused verification
passes as recorded above, and the full ladder and dev boot pass on the combined
tree (10,155 units, 272 browser, 143.35 KB; see the U5 record, which also covers a
separate pre-U5 door-pan fix). The owner accepted it on 2026-09-27; U5 is
committed locally on `dev`. No fresh semantic review PASS is claimed. Pre-repair counts
are 10,140 unit passes/four existing skips, 270 browser passes/three existing skips,
143.28 KB gzip, 53 frozen paths and 31 strict roots. Properties
now share a staged desktop/phone form with a compact summary, collapsed numeric
controls and one Save changes action. Each general/door operation requires its own
matching outcome; partial and unconfirmed results retain the unsaved draft. Lighting
exposes Ambient light directly and Layers shows percentages. Focused verification
initially passed 143 affected unit cases and thirteen browser journeys across bounded runs.
Real two-client checks preserve hidden-door/privacy boundaries and verify delayed
save acknowledgement, player ambient updates and responsive 44 px targets. All eight
full gates and isolated boot passed before review. R1 stopped on a documentation-agent dispatch limit:
UI STATIC FAIL, state/tests partial, named documentation review unperformed. Five
unique flags were recorded: ambient drag, locked phone draft controls, negative coordinate
typing, uploaded asset naming and stale phone guide instructions. No U5 completion
claim. The owner authorized the five bounded repairs and renewed verification/review
on 2026-09-27. Repairs pass 152 affected unit tests, 28 strict roots and strengthened
desktop/phone two-client journeys, with all 77 controls reachable. The repaired full
run initially had one phone DM-menu-reopen failure. It is reproduced with native event diagnostics and isolated
HTML pan/tap probes. The test now separates its two gesture phases by the measured
350 ms interval, retaining all assertions; its focused case and 29 strict roots
pass. This is a test-input correction, not a physical-device/product-fix claim.
The historical pre-R2 full ladder and isolated boot PASS: 10,137 unit passes/four existing
skips, 270 browser passes/three existing skips, 143.18 KB gzip. All 52 frozen
hashes/HEAD/inventory and 29 strict roots match; browser errors/retries/raw
diagnostics are zero. R2's later repairs, corrected current counts and R3's owner
checkpoint are recorded at the top. See
[the U5 record](interface-clarity-u5.md).

The following observations describe the September 22 audit; the dispositions above
record later changes.

At the September 22 audit, Drawing had color, 1–50px Brush Size, opacity and shape fill.
U4a now calls that drawing control Stroke width (px). At that audit, Paint said “Brush: Grass”
but changed material and painted grid cells with no adjustable footprint. The erasers affect
different data. The plan keeps the semantic separation and labels it: Stroke width (px)
versus Material and Brush size (cells), Erase drawings versus Erase terrain. A wider terrain
brush is a **new bounded behavior**, explicitly split from the menu refactor and tested for
footprint, command limits, stroke history and cancellation.

Touch Drawing showed Free/Line/Rect/Circle/Eraser/AoE names, a size slider, Undo/Redo/Done;
desktop uses Draw and a separate Templates group and exposes opacity/fill. Both workflows
were used with real pointer/touch events. Share descriptors and available settings, while
retaining the shipped responsive presentation model.

The material deck already offers useful shelves/search/pins/recents. Map object selection
instead starts with a collapsed asset name and a category/swatches view; NPC tokens offer
a searchable named library. Preserve the distinct catalogs, but standardize selection
preview, item naming, search where applicable, and upload labels. The September 22 source showed the
explicit Sample tool handing off to Place; make material-versus-object sampling outcomes
explicit. Ctrl/Cmd-sampling already preserves the current tool and should keep that shortcut.

Evidence: [map palette](interface-audit-2026-09-22/29-map-tools.png),
[grass options](interface-audit-2026-09-22/31-paint-options.png),
[Generate](interface-audit-2026-09-22/35-generator-missing-layers.png),
[touch Drawing](interface-audit-2026-09-22/78-touch-drawing.png),
[touch Paint](interface-audit-2026-09-22/83-touch-paint.png).
Owners: `features/map-edit/MapEditToolbar.tsx`, `MapEditToolPanels.tsx`,
`MapEditBrushDeck.tsx`, `MapEditAssetPicker.tsx`, `usePlacementDials.ts`,
`features/map-studio/components/useTerrainBrush.ts`, `layouts/MobileDrawingControls.tsx`.

### IA-11–14 — properties, lighting and map scope

**Door:** build a door → choose map Select → click door → open Inspect. Position/layer/hidden
fields have APPLY, and state/width have APPLY DOOR. The observed lock change used the latter.
A newcomer changing both can reasonably assume one Apply saves the whole visible form.
Show the selected object immediately and offer one clearly scoped save. The current
protocol needs two commands: the plan explicitly requires matching acknowledgments, partial
failure feedback and honest two-step history, not an invented atomic transaction.

**Night:** Light explains that Lighting-layer opacity is ambient light, with 1 meaning day.
The layers list has sliders but no visible percentage on desktop. Give Ambient light a
named home under Lighting; keep ordinary transparency controls separately labeled.

**Maps:** a DM reaches Map for building, Map Setup for raster/grid/fog and a section still
called HeroByte Map Studio for documents. That section offers Open and Publish to live map
even after live authoring. Atlas manages locations; the player's launcher says World.
The retired standalone Studio is not a missing feature. Explicitly separate Current table
map, Map library details, and World travel; a library selection is not a scene transition.

**Outcomes:** Session Save Game State, map Backup JSON and Player State Save to File produced
three different files. Scope belongs in the action label before file selection. Likewise,
Map Gen fills a region, Atlas Generate prepares a location, and Kick in a Door's ROLL
creates and enters a connected scene. Atlas building generation, confirmed travel and Kick
were exercised. Keep their distinct outcomes; rename ROLL to Generate & enter.

Evidence: [two door applies](interface-audit-2026-09-22/40-door-two-applies.png),
[lighting layers](interface-audit-2026-09-22/34-layers-light.png),
[map management](interface-audit-2026-09-22/62-map-library-after-building.png),
[Kick](interface-audit-2026-09-22/69-kick-panel.png).
Owners: `features/map-edit/MapEditInspectorPopover.tsx`, `MapEditLayersPopover.tsx`,
`features/dm/components/map-controls/MapStudioControl.tsx`,
`features/atlas/AtlasTab.tsx`, `KickPanel.tsx`, `RecipeDials.tsx`.

### IA-15–17 — playing, running combat and hosting

The desktop entity area consumes about the lower 280px of a 900px viewport even with very
few cards, while header chrome takes roughly another 110px. Hiding the panel helps, but
removes convenient character actions. Use a compact roster with expandable details and
keep current-turn/HP/focus actions reachable. Validate with realistic party and NPC counts.

**Confirmed obstruction:** at 1440×900, World and Props were fixed over the own-character
card's bottom controls. A click on Open player settings was intercepted by World repeatedly;
keyboard activation was used to continue. This is actual lost pointer access, not just a
preference for smaller cards. Reserve layout space for launchers instead of floating over them.

Encounter preparation required NPCs & Monsters for library/add/duplicate/place/Roll missing
initiative, Players for start/end/turn/monster-HP controls, character cards for individual
initiative, and Session for manual-roll policy. NPC placement, duplication, missing-initiative
roll, next turn, HP-display choice and end combat were exercised. Give Encounter a canonical
home while retaining useful shortcuts. Do not change which roles may advance existing turns.

To become DM: own character gear → scroll through character/art/file settings → DM Mode →
password. This was followed on both desktop and phone. Role belongs with Table identity,
not one character. New-table host onboarding remains a planned acceptance journey, not a
claimed completed host-creation test in this run.

On a phone, ONLINE covers part of PARTY MEMBERS even during healthy operation. Connection
status should occupy a reserved header position rather than compete with every screen title.

Evidence: [blocked settings](interface-audit-2026-09-22/73-world-overlaps-settings.png),
[phone Party](interface-audit-2026-09-22/20-mobile-party.png),
[DM controls](interface-audit-2026-09-22/24-players.png).
Owners: `components/layout/EntitiesPanel.tsx`, `ServerStatus.tsx`,
`layouts/FloatingPanelsLayout.tsx`, `features/players/components/PlayerSettingsMenu.tsx`,
`features/dm/components/tab-views/PlayersTab.tsx`, `NPCsTab.tsx`, `SessionTab.tsx`.

### IA-18 — generation claims success after rejection

**Reproduce:** Map → Gen → draw a region at least 20×20 cells extending outside the
document → Generate. The panel shows both “Built here already — reroll the seed or change
a dial to build again” and “Generate region must lie fully inside the map document.”
It disables an unchanged retry. Minimum-size guidance was useful, but containment and
command-success feedback were not.

`features/map-edit/useGenerate.ts` sets `lastBuilt` immediately after dispatch rather than
acknowledgment. The queue's error does not clear it; the signature omits document identity.
Client region validation omits containment, which the server validates. Repair pending,
succeeded and failed states using matching command outcomes; preserve the region/dials
after rejection, allow retry, and never mark another document's request as built.
The report does **not** claim successful live-area generation from these rejected attempts.

**2026-09-24 disposition:** the adopted U3a outcome/containment repair and final
post-cap recovery-correlation repair are implemented locally. Strict regressions,
six actual desktop/phone Generate journeys, all eight house gates and fresh boot
pass. The original stale-broadcast finding was reproduced before repair with two
DMs, FIFO-buffered outbound traffic and an observing player. The semantic changes
were [accepted by the owner](interface-clarity-u3a-checkpoint.md) on 2026-09-24 for
the local semantic commit and continuation to U3b;
the capped review history remains 5 → 1 → 1, not a unanimous final PASS. This update
does not change the original audit's evidence limits or mark U3b complete.

Evidence: [contradictory result](interface-audit-2026-09-22/87-region-generated.png).
Owners: `features/map-edit/useGenerate.ts`, `features/map-studio/useMapStudio.ts`,
`apps/server/src/domains/generation/recipeContext.ts`.

### IA-19–20 — words and affordances

Examples needing a shared copy pass: Pointer/Ping; Draw/Free; Hall/Gen/Structs/Spline;
My Stuff/Custom; Juice versus its actual Sound & motion settings. Source help still names
some templates Circle/Square/Line while the tools use Burst/Cube/Bolt. Recenter's tooltip
promises center-of-map while its documented action resets the camera. The ME dice tooltip
says “Only you see this roll — the DM included,” which muddles the intended private audience.
Copy should describe actual behavior; no privacy failure was established by this wording.

Map library capacity text describes a mint's byte ceiling and scene installation. Session
permission text explains replacement styling and server-roll internals at length. Players
explains wire filtering. Put short outcomes and next actions in normal menus and preserve
technical detail in help/Advanced where needed. Do not remove useful scope warnings.

Empty portrait tiles clip “Add Portrait / Click to upload...” and other cards say Portrait
Pending without an upload in progress. Use a readable idle action. Source/DOM inspection
also found an unassociated Character Name label and hover-only item meanings. Some automation
locator misses were casing/accessibility-name differences; those alone are **not** recorded
as product failures. Keyboard and screen-reader work requires its own systematic follow-up.

## Coverage ledger — what was actually tried

| Feature family | This run | Remaining limits |
| --- | --- | --- |
| Join and roles | Fresh local joins, desktop/phone DM password elevation | Private-table creation/fork, password rotation, reconnect conflict/seat removal not exercised |
| Character | Rename; condition label; portrait file upload; second character creation; character backup download | Character restore, every size/status/HP path, character deletion and all token bindings not exhaustively tested |
| Player canvas | Token drag with changed position confirmed; selection and visible transform handles; resize gesture; freehand/rectangle/burst marks; measurement; drawing undo/redo; Clear All attempt; touch freehand/history | Remaining template variants, rotation, multiselect and shortcuts not exhaustively exercised |
| Dice/chat | Dice builder, public and ME rolls, manual result entry, public message, whisper between audit identities; settings inspected | Recipient transport secrecy, macros, all formula/advantage cases and voice-media delivery not certified |
| Preferences/help/World | Game Feel, Help, empty World; responsive views | Full help-topic keyboard audit, physical screen-reader and microphone permission/error paths not tested |
| DM menu | Every tab opened and contents reviewed | Every form validation branch and destructive/recovery branch not executed |
| Live authoring | Room, hallway, wall, door, light, grass/material Paint, Erase, Place, Scatter, Row, Select/Inspect, Sample, Spline, Gen controls; history and Escape; trusted touch grass/history | Spline output not independently validated; area generation requests rejected as above; all assets/material combinations and second-finger/pinch/abort cases not certified |
| Properties and visibility | Door lock via Apply Door, Layers, fog and sight default, Player View | No full secret-door/vision/movement authorization audit; ambient slider UI inspected rather than calibrated |
| NPCs and combat | Token search/add/place/duplicate, roll missing initiative, next turn, HP-display mode, end combat | Mimic transformations, custom NPC shelf, mass imports, all initiative/turn removal branches not tested |
| Objects | DM blank prop; approved permission toggle; player-owned prop and image upload on touch | Ownership reassignment, every transform/delete case and co-DM races not tested |
| Campaign | Create location; generate building; travel confirmation including declined/accepted paths; Kick generates and enters linked cellar | Manual travel-link aiming, return-scene restoration, every discovery/hierarchy branch not exhaustively tested |
| Persistence/export | Table JSON, editable-map JSON, character JSON downloaded | PNG/WebP/SVG export, reimport/restore acceptance, raster publication/alignment/staging and failure recovery inspected/source-reviewed only |
| Layout/input | Desktop 1440×900/1366×768; 390×844 responsive and trusted touch; key Escape checks | 200% zoom, short landscape, tablet, physical iOS/Android and full keyboard traversal remain execution acceptance tests |

“All features” here was approached as an inventory of reachable capabilities plus a broad
hands-on walkthrough. It is not a claim that every setting, permission branch and device
combination passed. The plan includes the remaining complete journeys as explicit gates.

## Relationship to the previous audit and next action

The September 16 audit's repaired UX-01/02/03/04/05/06/07/08/11 are not replanned as missing.
This run re-observed successful rename, condition-label activation, above-parent character
creation and a usable chat composer; it did not revalidate every repaired path. Remaining
old findings about onboarding, map scope, card size, labels and mobile overlap are refined
by the new evidence. The old ignored audit is background, not the sole basis of this plan.

**Next action after implementation authorization:** U1 in the linked plan. No product code
was changed by this audit. The broader ten-slice arc is necessary because tool-state,
permissions, map identity and layout cannot safely be treated as one cosmetic patch.
