# Next-agent prompt — continue HeroByte interface clarity

Use this document as the continuation prompt. Updated 2026-09-26 after U4a local
commit `681bc391` on `dev` (parent `351b5485`, the accepted U3b commit).
Verify the current checkout
and latest execution ledger before relying on these identifiers.

## Your assignment

Continue the existing HeroByte interface-clarity arc with the same standard of evidence, small changes, and bounded review. The owner wanted a first-time player/DM audit of confusing menus, discoverability, and inconsistent interactions such as drawing versus terrain painting, followed by implementation in the project's slice style. The audit and plan already exist. Do not restart them or replace the JRPG/CRT identity.

**Current frontier:** U4b is verified at `681bc391`; its final review is incomplete and
the [owner checkpoint](../verification/interface-clarity-u4b.md#verified-owner-checkpoint--final-review-incomplete)
was accepted on 2026-09-26 with “Accepted”. Its scoped local commit is authorized;
verify that closeout before starting U4c. R3 documentation dispatch failed with `agent thread limit reached`; state
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

- Work in **`D:/HeroByte`**, PowerShell, existing branch **`dev`**. U3b is **`351b5485`**, immediately after **`b473a3dd`**. Use this existing checkout to retain ignored local evidence; verify its exact HEAD through Git.
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
Do not redo them. U4a is accepted and committed; U4b is accepted for local closeout, then U4c follows. Pending-acceptance wording in historical records
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
