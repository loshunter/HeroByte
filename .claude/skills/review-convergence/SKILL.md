---
name: review-convergence
description: Bound an adversarial review so it finishes, and gate the result. Use when closing an arc, before any merge to main, whenever the user says "review this", "adversarial review", "is this ready to ship/merge", or asks to run review lenses. Sets the agent cap, the round cap, the plateau stop, the both-must-pass gate, reviewer calibration, and the validity preconditions that make a verdict count. A 55-agent review died to the session limit three times on the Atlas arc; a review that does not finish has no verdict.
---

# Review Convergence

The review ladder's second half. `/verify-gates` answers "does it build and pass" — deterministic, mechanical, cheap. This answers "is it correct and honestly described" — semantic, adversarial, expensive. **Run the gates first; a red ladder makes every review finding noise.**

## Sizing: the review must finish

A review that dies partway still returns a tidy, plausible list. That list is void, and it looks exactly like a real one.

- **Cap the fan-out.** Budget by lenses, not by ambition: 4–8 review agents for a slice, 12–20 for a full arc. Never 50+. The Atlas 55-agent workflow died to the session limit three times.
- **Cap the rounds at 3.** Round 4 is escalation to the owner, not another loop.
- **Stop on plateau, not just on the cap.** From round 3, if the flagged-issue count has not dropped across the last two rounds, stop and escalate. Rounds that stop finding *fewer* things are not converging — the change is wrong at a level more rounds cannot reach.
- Pin `model` on every review agent. An unpinned agent inherits Fable and blows the budget you just set.

## The gate

Two independent reviewers minimum, spawned in parallel, neither seeing the other's output.

- **Ship only when every reviewer returns PASS.** No partial credit, no majority vote.
- **Take the union of findings, never the intersection.** A defect flagged by one reviewer and missed by the other is still real — the second reviewer's blind spot is precisely what the second reviewer was for. Deduplicate; do not filter to consensus.
- **Fresh agents every round.** A reviewer that saw round 1 anchors on its own earlier verdict and will re-pass what it already passed. Spawn new ones, re-feed the full diff.
- **Reviewers never fix.** Judging and repairing are separate roles, for the same reason `gates-runner` never fixes: a repair-empowered reviewer is tempted to re-pin the test instead of reporting the defect.
- Fix **only** what was flagged. An unrequested refactor mid-review invalidates the round it lands in.
- **Track regressions across rounds, not just fixes.** Every round after the first reports what improved *and* what regressed. Round-2 fixes routinely break round-1 passes, and only fresh reviewers on the full diff can see it.

## Calibrating the reviewer

Default reviewer behaviour is generous, and generous review is the failure mode this whole skill exists to prevent. Say so in the prompt, explicitly:

- **"Your natural tendency is to be generous. Fight it. Your job is to find problems, not to approve."**
- Ban the cope phrases outright: *"solid foundation"*, *"overall good effort"*, *"minor, probably fine"*, *"good enough for now"*. A reviewer reaching for these has stopped reviewing.
- **Every finding carries a concrete fix with real values** — not "the guard is wrong" but "`deriveMapElements` filters on `visible` before the DM check, so hidden NPCs ship to players; move the DM branch above the filter."
- **Quantify wherever a number exists.** "3 of 7 new paths have no error state" beats "error handling needs work."
- Two reviewers that pass everything are one reviewer. If a round returns all-PASS with zero findings on a non-trivial diff, distrust the round before you trust the code.

## Validity preconditions — check before believing any verdict

A verdict is VOID, not weak, unless all of these hold:

1. `agents_error: 0`. On any non-zero count, name the lenses that never ran and treat the whole result as void.
2. Reviewers were read-only. After any errored run, `git diff` the tree — review agents have mutated it before.
3. No sabotage that broke compilation. A sabotage that fails to compile proves nothing; it is void, not red. And prove a strengthened assertion can still **pass**, not only that it can fail.
4. **Every reviewer reports the mode it actually achieved, never the mode it was asked for.** If a reviewer was told to drive the live table but the browser or dev server was unavailable, it must say so and label its output a static review — silently scoring a diff read as a live evaluation is the exact degradation that makes an improvised gate path *less* rigorous than the one it replaced. Treat an unreported mode drop as a void round.

## Rubric

Give every reviewer the same criteria with objective pass/fail conditions. Vague rubric, vague review. Always include:

- **Correctness** against the diff, not the description of the diff.
- **Test validity** — does each new test fail when the behavior breaks? A budget assertion with only an upper bound is vacuous; a spec that derives its click point from the thing under test cannot see that thing misplaced; a spec waiting on the wrong signal is not a flake.
- **Doc-vs-code honesty** — re-read every user-facing sentence the change touches against what the code actually does. **This is the one a defect lens structurally cannot see:** three doc overclaims were walked back on the Kicked-In Door arc, all past clean defect reviews. Assign it to a named reviewer or it goes unchecked.
- **Privacy/redaction** for anything touching snapshots, logs, or the wire — the initiative slice leaked hidden NPC names past a full review.

## Escalate, don't grind

At round 3, on a plateau, or on any voided run, stop and report to the owner: what passed, what is still flagged, which lenses never ran, the round-by-round issue counts, and the cost so far. Grinding a fourth round is how the session limit gets hit — and hitting it converts a real review into a void one.
