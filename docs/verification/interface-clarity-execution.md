# Interface clarity — execution ledger

**Started:** 2026-09-22, following the owner's “let's execute” instruction.
**Plan:** [interface-clarity-arc-plan.md](../planning/interface-clarity-arc-plan.md).
**Starting checkout:** `dev` at `0007e517`.
**Delivery:** local commits under the house ladder; no remote push or main merge authorized.

## Frontier

- U1 is in progress. IA-03 is a focused fix; Move/Chat navigation follows separately.
- U2–U10 are not implemented. The checkpoint after U3a remains in force.
- The September 22 audit is historical evidence; new acceptance results are recorded here.
- U2 history follow-up, reproduced through the live UI: after the player draws and the DM
  confirms Clear All, both snapshots contain no drawings but the player's Undo stays
  enabled. This predates IA-03. Fix history feedback without confusing an ordinary Undo
  to an empty map (where Redo must remain possible) with a table-wide clear.

## U1 / IA-03 — player Clear All

**Behavior:** carry the existing DM capability through drawing-toolbar props. Omit Clear
All when capability is absent, including after demotion. Retain the existing DM confirmation
and server/handler permission checks. Mobile's drawing sheet already has no Clear All
action; its existing controls remain covered by the focused suite.

**Regression evidence:** the new toolbar/real-hook test failed on the original code because
the player could see Clear All. After the fix, four focused files passed, 150 tests total.
The first full typecheck caught overly narrow inference in the new test's initial props;
the fixture type was corrected, its two tests passed again, and typecheck passed.
Temporarily ignoring the DM confirmation return value made the second new test fail on an
unexpected `clear-drawings` send. Restoring the guard returned both tests to green. The
probe was reverted before the final browser gate; no mutation probe is part of the fix.

**Browser coverage added:** distinct DM/player contexts draw through
actual pointer input; the player has no Clear All; DM cancellation retains replicated
drawings and working Undo/Redo; confirmation clears both clients. The partial-erase smoke
test no longer clicks a player's no-op Clear All in setup; the automatic fixture reset
already gives it a clean table.

**Live development check:** `live-two-client` at 1440×900. DM elevation used the actual
settings/password UI; a player drew through pointer input; the drawing replicated to the
DM; player Clear All was absent; declining the DM confirmation preserved the drawing on
both clients. Inspected [player screenshot](./interface-clarity-u1/player-no-clear.png)
and [DM screenshot](./interface-clarity-u1/dm-clear-cancelled.png). No physical-device pass
is claimed. This is evidence for IA-03, not acceptance of the remaining U1 navigation.

**Gates:** build, typecheck, lint/frozen contracts, structure, formatting, the full unit
suite (client 51 batches / 6,056 passing tests; server 2,637; shared 449), and the bundle
check (123.90 KB gzip against 175 KB) passed. Isolated dev startup passed. The first E2E
run exposed a new-test locator mistake: exact title text included the close control in the
rendered window. The test now waits for that window's accessible close button; focused
browser rerun passed both affected tests. The full E2E rerun passed **211 tests, 3 existing
skips**, with no failures (11.3 minutes). Independent focused review passed. U1 as a
whole is not complete: the Move/Chat changes still need integration and their own gate.
Raw logs are in the ignored
`output/interface-u1-execution/` directory.

**Environment:** the default bundled pnpm 11 launcher began recreating dependencies before
the first test. It was stopped; the repository's pinned pnpm 10.17.1 restored all 518
packages from local cache with `--frozen-lockfile --offline`. Subsequent commands explicitly
put that launcher first on PATH, including child commands. No package/lockfile change.

**Focused review, round 1:** two independent static reviewers completed, no agent errors.
Correctness passed; evidence review found two test gaps. The browser test now rechecks
player Clear All absence after the player's history is nonempty and after DM updates,
and missing snapshots throw instead of masquerading as empty drawing lists. A mutation
that exposed Clear All whenever Undo was available failed the new post-drawing assertion;
the mutation was reverted. Both affected browser tests passed again after the probe
(33.6 seconds). The full-suite result above precedes
these assertion-only improvements; product code is unchanged.

**Focused review, round 2:** two fresh independent static reviewers returned PASS, no
agent errors and no new scoped findings. This was a bounded review of the focused repair;
the U1 navigation acceptance/review remains separate. Role changes are covered by a real
hook/toolbar rerender test; live role-revocation coverage is not claimed. No mutation probe
remains. Ready for the focused local commit on dev.
