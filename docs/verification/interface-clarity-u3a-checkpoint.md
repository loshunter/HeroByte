# Interface clarity — verified U3a owner checkpoint

Date: 2026-09-24. Checkout: `D:/HeroByte`, local `dev`, HEAD `4e63230d`.
Status: **accepted by the owner on 2026-09-24** with “acccepted,” in response to the
verified-checkpoint request. The scoped local IA-18 semantic commit and continuation
to U3b are authorized. Existing working changes are preserved; no remote push, main
merge or deployment is authorized.

## What is ready to accept

The adopted IA-18 repair reports Built only after the matching successful Generate
outcome. Rejection retains the recipe and allows an unchanged retry. Document
identity, queue-entry lifetime, replay completion, containment feedback and uncertain
delivery have focused coverage. The final post-cap repair makes uncertain recovery
depend on an explicit, matching GET receipt. Ordinary same-document broadcasts and
earlier GET replies can update the map but cannot enable inspection or another
Generate. The receipt has its own 12-second deadline and settles once across
success, error, supersession, document change, disposal and late replies. Legacy
uncorrelated GET callers remain supported; private document replies remain DM-only.

The final review finding was reproduced through real browser input: DM1's outbound
Generate and GET frames stayed buffered in FIFO order while DM2's pre-generation
edit arrived through the live inbound stream. Both desktop and phone tests failed
on the intended inspection-enabled assertion before the repair. After repair,
inspection stays disabled through the stale broadcast and missing-receipt deadline;
a fresh correlated refresh recovers, exactly one generation applies, and the player
receives the public scene without a private document. Acknowledging inspection does
not send another Generate.

## Verification

| Check | Result |
| --- | --- |
| Actual authored test roots, strict TypeScript | PASS before RED and after repair |
| Behavioral RED | 3 recovery and 6 lifetime failures; 7 server failures with 3 controls passing; 2 desktop/phone FIFO failures at the intended assertion |
| Final focused checks | 686 client tests / 76 files and 50 server tests / 6 files PASS |
| Focused live Generate journeys | 6 passed / 6 attempts; no failures, skips, retries, flaky cases or reporter errors |
| Full house ladder | Build, typecheck, lint, structure, format, units, bundle and E2E PASS |
| Full units | 9,981 passed: shared 452, server 2,738, client 6,791; 4 existing client skips; all 84 client batches completed |
| Full E2E | 252 passed, 3 existing skips; 255 attempts, 0 failed attempts, retries, flaky cases, attempt errors or reporter errors |
| Entry bundle | 135.13 KB gzip / 175 KB; 39.87 KB remaining |
| Fresh boot | Server, page and module ready; survived 30 seconds on isolated 5176/8789; no error markers; owned processes cleaned up |
| Verification snapshot | HEAD and all 91 SHA256 file hashes unchanged through the gates; documentation updated afterward |

The first focused post-repair run had 215 passes and one old unqualified-GET fixture
failure. That fixture now asserts rejection of an uncorrelated reply before accepting
the actual matching receipt. It was not weakened into a success-only assertion.

Live mode was **automated live-two-client Chromium**, with two DMs plus a player in
the FIFO/rejection cases. DM viewports were desktop 1440×900 and touch-emulated phone
375×812; the observing player was desktop 1440×900. Saved screenshots were visually
inspected. Functionality 8, multiplayer integrity 8, craft 8, reach 7.5 give
**7.925/10**. Physical devices, WebKit, native Mac, phone-player and U3a-specific
landscape/tablet coverage remain unverified. The palette's existing length and
persistent-control problems belong to U3b.

Evidence lives in the ignored `output/interface-u3a-execution/` directory and does
not automatically travel with a checkout:

- [Mechanical gates and raw-log links](../../output/interface-u3a-execution/postcap-gates-report.md)
- [Full Playwright attempts/errors](../../output/interface-u3a-execution/postcap-gate-e2e-report.json)
- [Live evaluation and coverage limits](../../output/interface-u3a-execution/postcap-live-evaluation.md)
- [Desktop stalled recovery](../../output/interface-u3a-execution/postcap-browser-evidence/01-stale-broadcast-recovery.png)
- [Phone stalled recovery](../../output/interface-u3a-execution/postcap-browser-evidence/02-stale-broadcast-recovery.png)
- [Observing player's generated map](../../output/interface-u3a-execution/postcap-browser-evidence/02-player-one-dungeon.png)

## Previous slices and extraction headroom

U1 and U2 retain their recorded owner acceptance and live evidence in the
[execution ledger](interface-clarity-execution.md). IA-03 removes the player's
ineffective Clear All action while retaining DM confirmation; its fix is `1bcb7ec3`
and U1 acceptance is committed through `290f9a3d`. U1's overall live score was 7.8,
with a later focused privacy-flow score of 8.65. U2's IA-04 cancellation ownership
and bounded Atlas repair are committed as `7923c3de`; the latter has actual phone
touch plus observing-client evidence. The auth prerequisite `845d078c`, characterized
U3a extraction `42152fd3`, and separate hallway hotkey fix `4e63230d` remain trusted.
IA-18's semantic repair is the work awaiting this acceptance.

Current formatted newline counts are `useMapStudio` 285, `useMapStudioQueue` 318,
`useMapRecovery` 83, `useMapEditState` 303, `MapEditToolbar` 321, and
`MapEditToolPanels` 205. U3b must characterize and extract bounded palette
responsibilities before adding behavior near the 350-line guard. The next slice
shares an exhaustive tool descriptor inventory, groups the existing tools, keeps
history/Layers/Select/Sample/Done reachable across tools, and makes Populate's current
last-placed room/hallway target explicit and highlighted. Preserve quick wheel,
favorites, remembered choices, authority and lazy DM code. Verify fully bound phone
and short desktop palettes and a build/decorate/paint/generate/inspect/undo journey
with a second client observing.

## Decision to record

Formal U3a review remains capped at **three rounds, 5 → 1 → 1 findings, 12 completed
assignments and zero agent errors**. The last finding is now repaired and tested;
that does not retroactively turn the final review into unanimous PASS. No fourth
formal review was run.

The [handoff's bounded-repair step 5](../planning/interface-clarity-next-agent-handoff.md)
requires **“Only after verified repair and owner acceptance”** before the IA-18
semantic commit and U3b. The owner's acceptance above fulfills that requirement.
The [review-convergence rule](../../.claude/skills/review-convergence/SKILL.md) says
**“Cap the rounds at 3. Round 4 is escalation to the owner, not another loop.”**

Proposed destination names remain **Table, DM tools, Encounter, Objects, Preferences**;
DM tools eventually contains Maps, World, Encounter, Characters, Objects and Table.
U3b groups the build palette; broader DM menu relocations stay in U6–U9. Record the
owner's name choices without treating silence as approval. Unresolved names do not
block independent palette work but do block dependent menu relocation.

Delivery remains **local dev commits only**. After acceptance, inspect and stage only
the adopted U3a scope, commit the verified IA-18 repair, record the acceptance, then
start U3b under the existing plan. No shipping authorization is requested or inferred.
