# Next-agent prompt — continue HeroByte interface clarity

Use this document as the continuation prompt. Updated 2026-09-27 after U5's owner
acceptance: local commits on `dev` are the door-pan fix `eb28f30a` (parent `a56e92e1`,
the accepted U4c commit), then U5 on top of it.
Verify the current checkout
and latest execution ledger before relying on these identifiers.

## Your assignment

Continue the existing HeroByte interface-clarity arc with the same standard of evidence, small changes, and bounded review. The owner wanted a first-time player/DM audit of confusing menus, discoverability, and inconsistent interactions such as drawing versus terrain painting, followed by implementation in the project's slice style. The audit and plan already exist. Do not restart them or replace the JRPG/CRT identity.

**Latest U7 frontier (2026-09-29):** U7 is accepted by the owner, committed on `dev` and
pushed to `origin/dev`, after 36 commits that fix bugs found on the way
(`ccd18b82`…`2689cf53`). U8 has not started. Its
review stopped at the round cap (34 → 28 → 33 items). The owner chose “repair all,
verify” and answered the open questions: ownership and a DM's editing of a player's HP
are built in U7, and the Table role section is accepted as the interim. Every round-3
item is repaired, the full ladder is green (286 browser, 0 flaky) and the table was
re-evaluated live (8.4); its follow-up, phone HP tap targets, is fixed (`2689cf53`).
Read [the U7 record](../verification/interface-clarity-u7.md) first.

**Previous U6 frontier (2026-09-28):** U6 is implemented, reviewed for three rounds, repaired
per the owner's round-3 decision “Repair all, verify”, and fully verified; it is uncommitted on
`dev` and awaits owner acceptance. U5 and the door-pan fix were pushed to `dev`; the Draw-sheet
CSS fix is `11a3728c`, with an uncommitted Linux-font follow-up. Two follow-up tasks are
filed: the docs harness's broken authoring walkthrough, and a heavy-scene camera pan that
can end one move-step short (the `door-pan.spec.ts` CI flake). Read
[the U6 record](../verification/interface-clarity-u6.md) first; U7 has not started.

**Previous U5 frontier:** the owner replied “Proceed” on 2026-09-27, authorizing the
two final repairs and verification. Both are implemented: copied session-upload
inventory on remount and accessible ambient percentages/endpoint help. Compiled
RED precedes **194 unit passes/24 files, 34 strict roots/1,040 inputs** and affected
two-client browser passes. The new upload browser test needed three bounded input/
oracle corrections; all failed runs remain preserved, including teardown markers.
`u5-postcap-focused-audit.json` distinguishes two passing cases from their failed
combined run and the corrected upload-only PASS. It verifies 78 controls, matching
receipts, unchanged compiler inputs and the player's uploaded asset. Full repeated
`u5-postcap-gate-*` checks were cut off mid-browser-suite by the agent's usage
limit; the one failure before the cut-off was a real pre-U5 bug (a pan starting
on a door swung it for the table), now fixed in `DoorsLayer.tsx` with unit RED/GREEN
and the new `door-pan.spec.ts`. The full ladder then PASSED on the combined tree:
10,155 units/4 skips, 272 browser/3 skips, 143.35 KB, dev boot. The owner accepted
with "yes" on 2026-09-27: the door fix is committed alone (`eb28f30a`), then U5, both
local on `dev`. U5 is closed; U6 has not started and needs owner direction. Read the
latest U5 record. The earlier STOP below is historical, not current.

**Earlier R3 checkpoint:** final R3 completed all four
STATIC lenses with zero runtime/dispatch errors and three retained unique flags.
One reviewer accidentally saw a peer-report line in search output, so R3 is VOID
for strict independence. No R3 lens was missing. Session-upload picker remount and
ambient slider accessibility remain open; stale handoff status is corrected only
as checkpoint bookkeeping. All product/test/guide bytes retain their verified
snapshot. Read the [final U5 owner checkpoint](../verification/interface-clarity-u5.md#owner-checkpoint--final-review-void-two-repairs-proposed)
for the bounded two-repair proposal, verification, cost and limits. Rounds are
VOID (5 retained) → valid FAIL (3) → VOID (3 retained). Do not run R4, repair product
code, commit U5 or start U6 before owner direction. Only five result/frontier docs
change after R3; `u5-r3-checkpoint-doc-audit.json` and
`u5-owner-r3-checkpoint-freeze.json` preserve that boundary. No active tests or
services belong to this checkpoint. Earlier “next” entries below are history.

**Verified snapshot before final R3:** valid R2 completed all four STATIC lenses with zero agent
errors: UI FAIL/one P2, docs FAIL/two P3, state/tests PASS. All 52 hashes, HEAD and
inventory matched. The three bounded repairs address reversed phone resize outside
0.1–10, session-only upload names, and a superseded “Latest” evidence paragraph.
Compiled RED reproduced three failures; affected GREEN passes 170 tests/20 files.
All 31 strict roots/1,038 inputs and the strengthened phone two-client journey
PASS: zero errors/retries, 44 reachable controls and four matching receipts.
First R2 gates passed build/typecheck/structure, 10,140 unit tests/four skips and
143.28 KB bundle, but lint/format failed on test whitespace. E2E was stopped under
the current fail-fast rule; partial results have no verdict and boot did not run.
Formatting is corrected with syntax-equivalence, stable formatter/ESLint and fresh
31-root strict checks. The corrected `u5-r2-format-gate-*` full ladder and fresh
boot now PASS: **10,140 unit passes/four skips, 270 browser passes/three skips**
in 23.6 minutes, 273 attempts with zero errors/retries/flaky/raw diagnostics,
143.28 KB gzip. Root verifies all 53 hashes/HEAD/inventory, 31 strict roots/1,038
inputs, all 77 controls, matching receipts, Atlas ownership and 30,027 ms boot
survival/owned cleanup. See `u5-r2-root-final-audit.json` and
`u5-r2-format-gates-report.md`. Only five result/frontier docs change afterward.
R3's later VOID outcome and owner checkpoint are above. R1 stays VOID; R3 was the final
permitted round. No U5 commit or U6. The previous green ladder below is historical
evidence for the pre-R2 snapshot, not verification of these repairs.

**Prior frontier:** U4c is accepted and locally committed as `a56e92e1`, parent
`63505c56`. Its 37-path commit audit confirms approved hashes, scope, attribution and
a clean `dev` checkout. U5 properties/save feedback and ambient-light work is implemented;
read `output/interface-u3a-execution/u5-current-frontier.md` before continuing.
U5 R1 is VOID: documentation dispatch hit `agent thread limit reached`.
UI completed STATIC FAIL with four findings; state is PARTIAL STATIC with two flags,
including one overlapping guide issue; tests stopped before semantic work and docs
never started. Counts: one completed/two partial/one undispatched assignment,
agents_error 1, five unique flags. All 50 review hashes/HEAD/full inventory
matched after interruption. Only five result/frontier docs were updated afterward.
Read the [U5 owner checkpoint](../verification/interface-clarity-u5.md#owner-checkpoint--review-interrupted-five-issues-flagged)
and latest scratch frontier. The owner replied “yes” on 2026-09-27, authorizing the
five bounded repairs, regression/strict/focused/live/full verification and fresh R2.
The repairs pass 152 affected unit tests across 18 files, 28 strict roots and both
real mouse/touch/keyboard two-client journeys; 19 reach reports cover 77 controls.
The touch-cleanup failure/correction and first repaired full run's Atlas menu
failure remain in the [U5 record](../verification/interface-clarity-u5.md).
Passive diagnostics reproduced uncanceled button touches without a click.
Isolated HTML probes establish pan/tap timing sensitivity; the Atlas test now
separates its ordinary-door control from the next gesture by a measured 350 ms.
It preserves the real tap and every assertion. All 29 strict roots and the focused
two-client Atlas case pass. This test-input correction adds the 52nd authored
path; it does not claim a physical-device or production gesture fix.

**Pre-R2 result:** the `u5-gesture-gate-*` ladder and isolated `u5-r1-devboot`
PASS. Full units: 10,137 passes/four existing skips, all 91 client batches. Browser:
270 passes/three existing skips in 23.5 minutes, 273 attempts, zero failures,
retries, flaky cases, attempt/reporter errors or raw step diagnostics. Bundle:
143.18 KB/175 KB. Root verifies all 52 frozen hashes/HEAD/full inventory, 29 strict
roots/1,038 unchanged inputs, matching receipts, all 77 controls and Atlas native
ownership. Boot readiness, 30,036 ms survival and owned cleanup pass. Images and
228 copied browser attachments are preserved. Only five result/frontier docs
change afterward for fresh independent R2, four pinned STATIC lenses in two
batches of two. No source/test/user-guide change after verification. Read
`u5-r1-root-final-audit.json` and `u5-gesture-gates-report.md`. R2's result is above.
R1 remains VOID. Do not reinterpret this authorization as acceptance of U5,
restart R1, commit U5 or start U6 before the recorded closeout requirements pass.
U4c's accepted incomplete review remains
recorded below; do not reopen it or rerun its unchanged green checks.

U4b is accepted and committed as `63505c56`; its 54-path commit
audit passed with the accepted hashes, parent, attribution and clean checkout.
U4c collection browsing passes focused/live verification: 702 initial focused tests,
22/28 affected repair checks and six collection/palette/terrain browser cases.
Initial gates 1–7 passed (10,094 unit passes/four skips; 139.69 KB gzip), but the full
browser run exposed two missed old-picker test selectors. Their bounded migration
retains the behavioral assertions; 19 strict roots and all four affected browser
journeys now pass without errors/retries. See [its record](../verification/interface-clarity-u4c.md)
and the latest scratch RESUME. The second full run finished 265 browser passes/three
existing skips/two failures: a remaining phone Sample selector and a real Atlas tap
that also opened its underlying door. Both have bounded repairs; Atlas has strict
unit/browser RED, 120 affected unit passes and 25 strict roots. All six focused
journeys now pass across five unchanged cases and the final two-client Atlas case;
its native trace has no compatibility mouse events. The intervening public-link
oracle failure and correction remain recorded. The third full ladder passed gates
1–7 (10,098 unit passes/four skips; 139.69 KB), but E2E finished 258 passes/three skips/
ten failures. Full artifacts and all 34 frozen hashes/HEAD/strict inputs were audited.
Five page-creation failures, one navigation timeout and two masked teardown errors
need diagnostic evidence; both terrain failures exposed a stale one-time DM-state
comparison. Its bounded receipt/revision oracle repair and Atlas diagnostic checks
compile across 26 actual roots. Focused diagnosis completed eight unchanged passes
and, after correcting a DM-only binding assertion, two terrain passes. The failed
eight-PASS/two-FAIL intermediate run remains recorded. Root verified current inputs
and zero errors/retries in the final two cases. Fourth full `u4c-sync-gate-*` checks
passed gates 1–7 (10,098 unit passes/four skips; 139.69 KB), but E2E finished
257 passes/three skips/eleven failures in 57.1 minutes. All 35 frozen paths, HEAD,
inventory and 26 strict inputs matched afterward. Six page-creation failures,
one initial-navigation timeout and one reset-409 fixture failure remain distinct
from a phone tap timeout, late decoration readiness and an overly specific native
text-undo assertion. All artifacts are preserved; a 30-context blank-page probe
passed without reproducing the runtime failure. Bounded test-oracle repairs and
protocol diagnosis followed: both corrections compile across 28 actual roots, and all
eleven focused cases pass in 161.8 seconds without errors/retries. Root verified all
37 frozen paths/HEAD/strict inputs and preserved every trace. The focused protocol
run did not reproduce the runtime failure. The fifth full `u4c-runtime-gate-*`
ladder and isolated boot now PASS: 10,098 unit passes/four existing skips,
268 browser passes/three existing skips in 30.3 minutes, and 139.69 KB gzip.
There were 271 browser cases/attempts and zero failures, retries, flaky cases,
attempt/reporter errors or raw step-ID diagnostics. Root verified all 37 frozen
paths, full inventory, HEAD, 28 strict inputs, seven reach reports/13 controls and
Atlas native-touch ownership. Boot readiness, 30-second survival and owned cleanup
passed. All artifacts are preserved. The runtime fault did not recur with capped
protocol logging; its cause remains unproven. Independent R1 is now VOID/INCOMPLETE:
documentation dispatch hit `agent thread limit reached`; state never started.
UI/tests stopped with partial STATIC reports, no valid verdict and no established
finding. Counts: INCOMPLETE, zero completed/two partial assignments, one dispatch
error/two unperformed lenses. All 37 review hashes/HEAD/full inventory still match.
No replacement reviewer or further round ran. The
[verified U4c owner checkpoint](../verification/interface-clarity-u4c.md#verified-owner-checkpoint--review-incomplete)
was accepted on 2026-09-26 with "accepted and ready to proceed". Scoped local
commit and U5 continuation are authorized. All 37 acceptance hashes and HEAD match;
only the five result/frontier documents are updated for acceptance. Commit and
audit the approved snapshot before U5. Do not reopen U4c review or repeat unchanged
green suites; the incomplete R1 remains recorded as such.
Preserve the initial timeout and antivirus-related interruption
records; do not rerun the blocked scratch PowerShell write or change antivirus settings.
U4b's final review is incomplete and
the [owner checkpoint](../verification/interface-clarity-u4b.md#verified-owner-checkpoint--final-review-incomplete)
was accepted on 2026-09-26 with “Accepted”. Its local closeout is complete.
R3 documentation dispatch failed with `agent thread limit reached`; state
never started. UI/tests stopped with partial STATIC reports and no new established
finding, not PASS. R3 is VOID: one dispatch error, two partial assignments and two
unperformed lenses. Counts **2 → 2 → INCOMPLETE**. No fourth review. The explicit
U4b acceptance satisfies this checkpoint; do not reopen it. No product defect remains
established after the four verified R1/R2 repairs.

R2 verification detail follows:
R2 found two P3 issues: the touch outline persists after release, and decimal interior
boundaries select the preceding cell. Both have strict behavioral RED and bounded
repairs; **768 focused tests/75 files, 47 strict roots and six browser cases PASS**,
zero browser errors/retries. All eight repaired gates and fresh boot PASS: **10,080
unit passes/four existing skips, 265 browser passes/three existing skips, 138.88 KB
gzip**. Root confirmed all 54 frozen paths/HEAD/strict inputs unchanged and zero
browser errors/retries. Local closeout is authorized by acceptance of the R3 record above.
R1/R2 counts are **2 → 2**, eight completed STATIC assignments, zero errors in those rounds.
Both rounds returned UI/state FAIL and tests/docs PASS; all four findings are repaired.

Round 1's four STATIC reviews completed, zero semantic agent errors, union **two findings**:
idle hover persists after canvas exit, and decimal grid division drops full edge cells.
Both have strict behavioral RED and bounded repairs; **759 focused tests/75 files**
and **47 strict actual roots** pass. Repaired live verification passes six cases with
zero errors/retries. All eight repaired gates and isolated boot PASS: **10,071 unit
passes/four existing skips, 265 browser passes/three existing skips, 138.87 KB gzip**.
Root confirmed all 54 frozen paths, HEAD, strict inputs and zero browser errors/retries.
Those full results describe the R1-repaired snapshot. R2's latest results are above;
local closeout remains pending.
The initial U4b snapshot passed all eight gates plus isolated boot: **10,066 unit passes/four
existing skips, 265 browser passes/three existing skips, 138.82 KB gzip**. There are
zero browser failures/errors/retries. Root confirmed all 53 frozen paths and all
strict inputs. Characterization passed 55 tests, focused verification passed 722 tests
and 47 strict actual roots, and the expanded two-client run passed six cases.
R1 verdicts remain UI/state FAIL and tests/docs PASS. The sandbox runtime setup failure
and recovery are preserved separately; no product failure is hidden by that recovery.
Read [the U4b record](../verification/interface-clarity-u4b.md)
and latest scratch RESUME before continuing. Preserve accepted U4a and its evidence;
do not reopen its checkpoint or repeat unchanged green tests.

**Completed U4a:** drawing settings/terminology and all bounded post-cap
repairs are verified. All eight gates and fresh boot PASS: **10,027 unit passes/four
existing skips**, **263 browser passes/three existing skips**, **137.53 KB gzip**,
zero browser failures/errors/retries. Root confirmed all 26 frozen paths and HEAD;
only result/frontier docs changed afterward. Final R3 remains UI/tests PASS,
docs/state FAIL, with three P3 findings, now repaired. Formal counts are
**3 → 3 → 3**, 12 completed STATIC assignments, zero semantic agent errors.
The cap and plateau are reached. Repairs preserve hidden controls through Tools/Help,
correct the phone guide and clarify the approval route. **The owner accepted U4a
and authorized continuation on 2026-09-26 with “Can you continue on now?”** after
being told acceptance was the remaining step. The scoped local commit is `681bc391`;
all 26 committed paths matched the acceptance freeze. No fourth round. Read
[the U4a record](../verification/interface-clarity-u4a.md) and scratch RESUME before
doing work. The normal commit path requires unanimous final PASS with zero semantic
agent errors. A capped non-unanimous result instead requires stopping formal review,
recording the union, completing bounded repairs/verification and presenting the owner
checkpoint; commit locally only after that acceptance. The initial mechanical runner recovered from
a tool authentication interruption without changing the 22-file frozen snapshot or
repeating green gates. U4b terrain footprints/sample routing follows U4a closeout;
U4c collection browsing remains separate. Later owner messages say to proceed onward.

The owner accepted the verified U3a checkpoint on 2026-09-24 with “acccepted.”
The scoped IA-18 semantic commit is **`b473a3dd`**. **U3b's grouped build palette is
accepted and locally complete; formal review counts are 2 → 5 → 1**. The first-round
repairs passed all gates/boot (10,016 unit passes,256 browser passes). Round 2's
hidden-perimeter validity gap and four copy/label findings are now repaired with
strict behavioral RED/GREEN,548 focused unit passes and twelve browser passes.
The full ladder under `u3b-r2-repaired-gate-*` and isolated boot now PASS:
10,018 unit passes/four existing skips, 258 browser passes/three existing skips,
137.29 KB gzip. A mechanical usage interruption was recovered after an unchanged
87-file hash audit; preserve that history. Final R3 is complete: UI/privacy PASS,
evidence/interaction FAIL on the same P3 stale audit-status sentence. All 12
review assignments completed, zero semantic agent errors, all 87 hashes unchanged.
The sentence is now corrected as a bounded result-document update. No additional
product defect was found, but unanimous final PASS was not achieved. The review
cap checkpoint is satisfied: the owner explicitly replied “Accept and commit
locally” to [the U3b checkpoint](../verification/interface-clarity-u3b.md). The scoped
local commit is `351b5485`. Do not reopen either acceptance decision,
run a fourth U3b review or repeat unchanged green tests. That earlier continuation
stopped before U4; the current U4a frontier above supersedes it. Check the latest execution
ledger and scratch RESUME before repeating any work.
The bounded recovery repair is implemented and verified; do not redo it. Read
[the checkpoint](../verification/interface-clarity-u3a-checkpoint.md) first. This is
the next part of the existing arc, not a new unrelated arc. Most substantial menu
rearrangement has not happened yet; do not describe the redesign as complete.

## Working tree and authority

- Work in **`D:/HeroByte`**, PowerShell, existing branch **`dev`**. Accepted U4c is **`a56e92e1`**, after **`63505c56`**. Use this existing checkout to retain ignored local evidence; verify its exact HEAD through Git.
- Preserve the current tree. Do not reset, clean, stash changes away, recreate the implementation from old drafts, or stage everything indiscriminately. Inspect `git status`, `git diff`, untracked files, and recent commits first.
- Local implementation, testing and scoped commits are authorized under the existing plan; U3a, U3b, U4a and U4b's recorded cap checkpoints are satisfied. **No remote push, merge to main, or deployment is authorized.** Main deploys on push. Do not infer shipping authorization from a passing review or from this handoff.
- The explicit U3a review-cap checkpoint is satisfied: the owner accepted the verified result on 2026-09-24, and `b473a3dd` committed it. Earlier pending-acceptance language below is historical; it does not reopen this decision.
- The U3a checkpoint records the proposed destination names and local-only shipping scope. Do not repeatedly ask for a decision that the owner has already made in a subsequent message.
- User prefers action and candid, concise progress. Explain a required approval by naming/linking the exact rule. Do not bury an unresolved finding beneath green test counts.

## Read these, in order

1. [`D:/HeroByte/.agents/AGENTS.md`](../../.agents/AGENTS.md), plus any applicable nested instructions. Preserve the user's instruction to confirm an apparent project switch before investigating another project.
2. [`interface-clarity-execution.md`](../verification/interface-clarity-execution.md): current frontier and final sections, especially **“U3a final review round 3 — owner checkpoint required”** and **“Owner-reported hallway keyboard history — local fix”**. Earlier “next” statements are historical; the latest entries supersede them.
3. [`interface-clarity-arc-plan.md`](interface-clarity-arc-plan.md): status banner, §0/§0.1, §2 product model, §3 interaction contracts, current U3a/U3b capsules, and §8 gates. Historical line numbers are navigation aids; match symbols against source.
4. [`interface-audit-2026-09-22.md`](../verification/interface-audit-2026-09-22.md): original observations, evidence limitations, and disposition ledger. Do not promote an untested feature to a verified one.
5. [`HANDOFF-NEXT.md`](HANDOFF-NEXT.md) §2/§5/§7/§8. Its earlier product frontiers are historical; use the interface execution ledger for this task's current state.
6. [verify-gates](../../.claude/skills/verify-gates/SKILL.md), [gates-runner](../../.claude/agents/gates-runner.md), [evaluate-live](../../.claude/skills/evaluate-live/SKILL.md), and [review-convergence](../../.claude/skills/review-convergence/SKILL.md).
7. Local scratch frontier: `D:/HeroByte/output/interface-u3a-execution/RESUME.md`. Read its latest entries, not just the opening snapshot. `output/` evidence may be ignored by Git and will not automatically follow a new checkout.

## Trusted work — preserve it

| Commit | Completed work |
| --- | --- |
| `7923c3de` | U2 cancellation/interaction ownership, following the earlier U1 and focused repairs |
| `845d078c` | Authentication retry waits for reconnect after rejected password |
| `42152fd3` | Characterized U3a queue/lifecycle extraction and seams |
| `4e63230d` | Focused map Ctrl/Cmd+Z/Redo beside desktop floating panels, with mobile protections |
| `b473a3dd` | Owner-accepted U3a Generate outcomes and correlated recovery receipts |

U1, U2, U3a and U3b are locally complete with their recorded owner acceptance.
Do not redo them. U4a/U4b/U4c are accepted and committed; U5 is active. Pending-acceptance wording in historical records
below is superseded by this frontier.

The latest owner-reported hotkey defect is finished. Leaving Chat open blocked Ctrl+Z even after a hallway was drawn on uncovered map canvas. Canvas interaction now focuses the map. Only explicitly opted-in desktop floating panels can coexist with that map's history shortcuts. Mobile screens/sheets, dialogs, popovers, text editing and composition remain protected. `DraggableWindow` revokes its opt-in when entering mobile layout. The owner's exact original window arrangement was not confirmed; the Chat-open case was independently reproduced.

Read [`map-history-hotkeys.md`](../verification/map-history-hotkeys.md) for its scope and manual steps. `MapBoard.tsx`'s seven focus lines are in `4e63230d`; its remaining U3a changes are in `b473a3dd`. Do not revert or double-apply them. The hotkey review was separate from U3a acceptance: findings **1 → 0**, four reviewer assignments over two rounds, final two reviewers PASS, zero agent errors.

## Historical U3a repair checkpoint — completed and accepted

**Current result:** the following historical defect has strict behavioral RED/GREEN
evidence and a completed bounded repair. Matching GET request/document identity now
gates inspection; generic loading, ordinary broadcasts and earlier GETs do not.
Legacy GET callers and private DM reply boundaries are preserved. Six focused
Generate journeys, all eight gates and isolated fresh boot PASS. The semantic work
was subsequently accepted and committed as `b473a3dd`; no fourth review ran.

Read `D:/HeroByte/output/interface-u3a-execution/u3a-r3-ui-review.md`, then the execution ledger's disposition and bounded repair proposal. **The ledger's explicit request-correlation proposal supersedes the report's weaker suggestion to filter out frames carrying `appliedCommandId`.** Absence of an applied command ID does not distinguish a recovery GET from an earlier same-document GET.

The reachable sequence is:

1. DM1 sends Generate, but its outbound socket/network writes remain buffered. Inbound traffic can still arrive. Retry exhaustion occurs at approximately 7.5 seconds while the original Generate writes have not reached the server.
2. DM1 requests Refresh. Its GET queues behind the buffered Generate writes.
3. DM2 edits the same map before DM1's original Generate arrives. DM2's incoming document broadcast therefore still lacks DM1's generation.
4. Before repair, the controller treated that same-document broadcast as completion of the GET and cleared generic loading. The recovery UI used changed document object identity plus loading=false to enable **I've checked the map**.
5. DM1 acknowledges inspection and queues another Generate with a new command ID. Releasing the outgoing buffer in FIFO order can apply both distinct generations.

Originally source-supported, this finding is **now reproduced by live desktop and
phone network-fault tests** in `interface-generate-correlation.spec.ts`. Both failed
at the intended inspection assertion before repair and pass after it. It needs
neither same-direction WebSocket reordering nor a later acknowledgement overtaking
an earlier frame. A broadcast already including the generation is not the harmful
stale case. The regression preserves this causal distinction.

U3a's three review rounds found **5 → 1 → 1** distinct issues. All four lenses ran in the last round; three passed and UI/state failed with this P2. There were 12 completed reviewer assignments and zero agent errors. The cap and plateau were both reached. The exact [review-convergence rule](../../.claude/skills/review-convergence/SKILL.md) is: **“Cap the rounds at 3. Round 4 is escalation to the owner, not another loop.”** Do not reset the count, spawn a disguised fourth formal round, or claim unanimous U3a acceptance.

### Bounded post-cap repair checklist

Steps 1–5 below are complete, with evidence in the verified checkpoint and latest
execution-ledger entry. The owner accepted the result and local commit `b473a3dd`
completed step 5; this checklist records the historical recovery path.

1. Add a discriminating regression with two DMs, FIFO-buffered outbound Generate/GET traffic, and live inbound same-document broadcasts. Prove the unrelated stale broadcast cannot unlock inspection or permit a fresh Generate. Include the generic loading watchdog expiring without a recovery receipt.
2. Add explicit **recovery GET request correlation**, echoed on the matching document/error reply. Gate recovery inspection on that matching receipt, not document identity, revision, generic loading, or a map-edit command's `appliedCommandId`. Preserve legacy GET callers and keep ordinary broadcasts updating the document without satisfying recovery.
3. Cover matching success/error, deadline, superseding refresh, document switch, earlier same-document GETs, late replies, and exactly-once settlement. Preserve the already-repaired conflict-refresh behavior: an unrelated GET drop must not cancel a valid queued successor; the lost prerequisite refresh has an independent 12-second deadline.
4. Strict-check the actual authored tests and establish behavioral RED before implementation. Repair the smallest relevant production seam. Then focused checks, strict checks, the complete house ladder, fresh boot, and two-client desktop/phone Generate evidence.
5. Present the verified post-cap repair for the recorded owner acceptance path. This is not a fourth formal convergence review. Only after verified repair and owner acceptance, locally commit the IA-18 semantic repair and finish the U3a checkpoint. Do not confuse the already committed extraction with this semantic commit.

Start source inspection at:

- `apps/client/src/features/map-edit/useGenerateOutcome.ts`, `useGenerate.ts`, `GeneratePanel.tsx`, `mobile/MobileGeneratePanel.tsx`.
- `apps/client/src/features/map-studio/useMapStudio.ts`, `useMapStudioRequests.ts`, `useMapStudioActions.ts`, `useMapStudioQueue.ts`, `useConflictRefresh.ts`, `mapOperation.ts`, `types.ts`.
- `apps/server/src/ws/handlers/MapStudioMessageHandler.ts`, `mapStudioGenerate.ts`, and shared message definitions/validation reached from `packages/shared/src/index.ts`.
- Existing `generateTransportOutcomes.test.ts`, `useGenerate.acknowledgement.test.ts`, `useGenerate.lifetime.test.ts`, queue outcome/disposal/refresh-failure tests, `apps/e2e/interface-generate-outcomes.spec.ts`, `interface-generate-recovery.spec.ts`, and `u3a-generate.helpers.ts`.

Keep queue-entry handles attached before dispatch mints the command ID. Every unsent drop must settle; sent-but-untracked must not be described as successful cancellation. Keep one controller and server-authoritative success. Preserve private document/preview boundaries and named privacy checks when touching this wire path.

## Completed U3b — the first substantial build-palette rearrangement

The following U3b scope is completed and accepted; retain it during later work.
Read plan §2.2 and the U3b capsule for its contracts. Current continuation follows
the U4a frontier above, not a replay of U3b or a full shell rewrite.

- Introduce a shared, exhaustive descriptor inventory for current tool groups, labels, help and capabilities; derive from existing tool-kind sets so no parallel inventory drifts.
- Separate persistent map controls from active-tool settings. History, Layers, Select/Sample and Done must stay reachable when switching Room → Paint → Generate → Spline. Fix Generate/Spline's early-return loss of persistent controls.
- Make Populate's valid target explicit and highlighted; preserve its current last-room contract unless an owner-approved change is needed. Preserve quick wheel, favorites, remembered tools/groups, player/DM authority and lazy DM code.
- Characterize and extract bounded responsibilities before adding behavior to files near their limits. Re-measure current LOC; the plan's old `useMapEditState`/`MapEditToolbar` headroom numbers are not current evidence. New files stay below the 350-LOC guard, with margin after formatting.
- Verify every current tool appears once and activates its existing action. Test fully bound palettes at phone width and short desktop height; an empty/pre-bind palette is insufficient. Build, decorate, paint, generate, inspect and undo with a second client observing the result.

The proposed navigation destinations remain product decisions: **Table, DM tools, Encounter, Objects, Preferences**, with DM tools eventually containing Maps/World/Encounter/Characters/Objects/Table. Check recorded owner choices before asking. U3b groups the build palette; broader DM menu relocations follow in U6–U9. Later order remains **U4 → U5 → U6 → U7 → U8 → U9 → U10**, each gated by its Done-when criteria.

## Verification and review discipline

- Use characterization before risky extraction. New regressions must compile strictly and fail for the intended behavior before repair. Setup failures, invalid typing, re-pinned expectations or simulated state writes are not behavioral RED evidence.
- Run focused tests first. Then use the current `HANDOFF-NEXT.md` §2 ladder: **build → typecheck → lint → structure guard → format check → full tests → client build:check → full E2E**. Preserve build-before-server-checks because shared `dist` must be current.
- Apply `verify-gates`: delegate mechanical checks to its report-only runner; only the implementing agent fixes failures. Use separate logs and capture exits. Parse Playwright's actual summary and JSON attempts/errors; exit code alone is insufficient. No blind retry or hiding a failed attempt.
- `D:/HeroByte/output/interface-u3a-execution/run-capture.mjs` is the existing wrapper: unique prefix, pinned **pnpm 10.17.1**, `CI=true`, raw log/exit/Playwright JSON, refuses overwrite. Inspect before reuse. Bare local pnpm previously selected a different version. Sandbox-restricted worker/pinned-runtime commands required normal escalated tool execution; do not invent a bypass.
- `D:/HeroByte/output/interface-u3a-preparation/check-actual-types.mjs` strictly checks actual authored test roots excluded by normal package builds. Use a unique label and actual paths; no substituted candidate files.
- Two clients means separate authenticated browser contexts/identities in the same disposable table. Drive real input; use the E2E seam read-only. Verify the observing player's state as well as the DM's. Include phone/touch and failure cases relevant to the slice; measure reach rather than inferring it from CSS.
- Report actual live mode and evidence limits. Static reviewers reading screenshots are not live browser testers. Never claim physical-device, WebKit or native-Mac coverage from Chromium emulation or synthetic key tests.
- Preserve existing services on **5174/8787**. E2E uses its own **5175/8788**. Recent fresh boot checks used disposable data and free **5176/8789**, ran 30 seconds, checked server/client/module readiness and logs, and cleaned only owned processes. Recheck occupancy; never kill unowned listeners. Fresh boot is mandatory after shared export changes and wherever the house gate requires it.
- Freeze source/test hashes during full gates and review. No implementation edits while another agent verifies that snapshot. Reverify after actual fixes; do not rerun an unchanged green suite without a new reason.
- For future uncapped review checkpoints, follow `review-convergence`: bounded scope/fan-out, pinned models, fresh independent read-only reviewers, at least two in parallel, union findings, named test-validity/documentation-honesty and privacy lenses where applicable, zero agent errors, all PASS required, at most three rounds and stop on plateau. This does **not** reopen capped U3a.
- Keep commits focused and attributed: `🤖 Generated by Codex` and `Co-Authored-By: Codex <codex@openai.com>`. Inspect staged hunks; preserve unrelated working changes. Hand-edit `docs/**`, rather than running a formatter across them. Update the execution/audit ledger with actual outcomes and remaining limits.

## Evidence anchors at handoff

All following scratch paths are beneath `D:/HeroByte/output/interface-u3a-execution/`:

| Artifact | Meaning |
| --- | --- |
| `u3a-r2-repaired-gates-report.md` | Last U3a-only full green ladder before final review: 9,944 reported unit passes, 248 browser passes/3 existing skips, 134.36 KB bundle, fresh boot |
| `u3a-r3-{queue,transport,ui,evidence}-review.md` | Actual final U3a verdicts; historical UI FAIL repaired after the cap, owner acceptance pending |
| `r2-repaired-browser-evidence/` | U3a's last desktop/phone-DM plus desktop-player evidence; not the missing asymmetric-network reproduction |
| `hallway-hotkey-r1-gates-report.md` | Historical full ladder after hotkey review repair: all eight + boot PASS; 250 browser passes/3 existing skips, 253 attempts, zero failures/retries/flaky/reporter errors; bundle 134.57 KB/175 KB |
| `hallway-hotkey-r2-{focus,evidence}-review.md` | Final hotkey reviewers both PASS, static/read-only; not U3a acceptance |
| `hallway-hotkey-r2-review-freeze.json` | 82 hashes matched after review and after hotkey commit; the execution ledger was subsequently appended, so do not treat that later documentation change as an unexplained product mutation |
| `postcap-gates-report.md` | Latest full ladder + boot PASS: 9,981 unit passes/4 existing skips, 252 browser passes/3 existing skips, 255 attempts and no failures/retries/flaky/attempt/reporter errors; bundle 135.13 KB/175 KB |
| `postcap-browser-{red,green}-report.json` | Two desktop/phone FIFO cases fail before repair; all six Generate journeys pass after repair |
| `postcap-live-evaluation.md`, `postcap-browser-evidence/` | Actual automated live-two-client evidence, screenshots, measured phone controls and coverage limits; score 7.925 |
| `postcap-gate-freeze.json` | All 91 hashes and HEAD matched before/after the gates; checkpoint documentation changed afterward, with source/tests unchanged |
| `postcap-unit-count-reconciliation.json` | Resolves the old hotkey count: progress-dot-prefixed five-test summary omitted by the earlier parser |

Latest hotkey focused checks: **395 tests/37 files PASS**, strict actual roots PASS,
two real desktop DM/player hallway journeys PASS. Its mobile retained-focus
protection has real-component regression coverage, not physical mobile keyboard
coverage. The old report said **9,957 passes/4 skips**; the later read-only
reconciliation found a five-test summary at line 568 prefixed by a progress dot.
All 84 client summaries total 6,782 passes, yielding **9,962 passes/4 skips** with
server/shared. The eight-new-case discrepancy is resolved. Preserve the old report
and this explicit correction; neither count is a deduplicated per-file claim.

Before claiming completion of your next step, record exactly what changed, what failed and passed, the achieved browser mode, reviewer outcomes, current commit, and the remaining owner decisions. Carry the original goal forward: make the player's and DM's next action easier to find without losing existing capabilities.
