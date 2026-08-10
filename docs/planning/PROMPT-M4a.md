# Handoff prompt — M4a (paste this into a fresh session)

Copy everything between the rules. It is deliberately short: the two docs it names carry the
detail, and both were written to be read once, in order, without further searching.

---

Read these two files in full before touching anything, in this order:

1. `docs/planning/mobile-shell-redesign.md` — the navigation model the owner approved on
   2026-08-09, the three slices M4 became, and a §3 of verified facts. **Trust §3 over anything
   you would otherwise go and re-derive; it was checked against the code at `c7d83f8f`.**
2. `docs/planning/HANDOFF-NEXT.md` — §2 (the verification gate, which is not optional and which
   you run before every commit), §5 and §6 (traps), §7 (the shared-barrel trap no test can see),
   §8 (method the owner expects), §9 (settled decisions — do not re-litigate).

Skip `docs/planning/mobile-authoring-arc.md` unless you need the original audit. Its §4 M4 is
superseded and its line numbers are from 2026-08-01.

**State.** `dev` = `c7d83f8f`, pushed and in sync with origin, 38 commits ahead of `main`. `main` =
`5307d0dd`, unchanged, so none of this is deployed — and **`main` auto-deploys the moment it moves,
so do not push or merge to it unless the owner asks.** Working tree is clean apart from untracked
files under `temp/`, which are the owner's local art assets: **never `git add temp/` and never
`git add <directory>`** — stage explicitly by path. Full gate green at `9583a176`: shared 414,
server 2057, client 44 batches, bundle 96.93 KB / 175 KB, e2e 106 passed / 0 failed / 3 skipped.

**Your slice is M4a**, defined in the redesign doc §2. It is the shell only — one state machine
owning which mobile surface is open, one `MobileScreen` component, Log and Party moved onto it, and
dock slot five made contextual so a DM gets a `DM` entry without a sixth button. **No new features.**

The two things most likely to cost you time if you skip them:

- `apps/client/src/layouts/MobileLayout.tsx` is **347 lines of a 348 ceiling**. This slice must
  extract before it adds — lift the surface state into the hook and the overlays into a child
  first, not last. `prettier --write` EXPANDS files, so re-check the count after formatting.
- Mobile geometry is only observable in a real layout engine. Measure in the `mobile-chromium`
  Playwright project (Pixel 7, `apps/e2e/mobile/`) at **both** 375×812 and 812×375; jsdom computes
  no layout and every browser available here makes `vh == dvh == svh`. `apps/e2e/mobile/mobile-shell.spec.ts`
  is the pattern to copy, and it is also the suite that must stay green.

Commit to `dev` as you go, each fix in its own commit. Prove every test can fail before you trust
it — break the fix, watch it go red, revert — and **sabotage the assertion as well as the code**:
M3 shipped a guard that stayed green with its fix removed because it hit-tested the wrong pixel.

When M4a is done, stop and report rather than rolling into M4b.

---
