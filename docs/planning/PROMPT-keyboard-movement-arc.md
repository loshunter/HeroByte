# Handoff — the Kicked-In Door is in production; keyboard movement is next

Read this whole file before touching anything. It is a launch prompt for ONE arc, in the owner's
established pattern (see `PROMPT-kicked-in-door-arc.md`, `PROMPT-atlas-arc.md`). The living
handoff — the full non-negotiables, the verification gate, the trap log — is
[HANDOFF-NEXT.md](./HANDOFF-NEXT.md); this file is the arc on top of it. Verify every line-level
anchor at `HEAD` before trusting it; they were banked 2026-09-09 at `dev` = `main` = `a41a8065`.

## 0. Where things stand, exactly

- **`main` = `dev` = `a41a8065`, IN PRODUCTION.** Render + Cloudflare deploy on push to `main`
  and CI does not gate the deploy. Both green, probe-verified (bundle `index-CHR8dA8X`).
- **The Kicked-In Door arc (VISION Signature Move 1) shipped and was reviewed** — K0–K4 + K6, K5
  (Cartridge Codes) deferred to its plan's §7. Four-lens adversarial review done. See
  `kicked-in-door-arc-plan.md` and the memory file `kicked-in-door-arc-plan.md`.
- **Two follow-on production bugs the owner found while playing are fixed and live** (this deploy):
  the PUBLISH-blanks-the-table bug (publish now rides `travelToDocument`; binding and scene can no
  longer part — `mapStudioPublish.ts`, memory `publish-blank-table-fix`) and the never-seen fog
  being 3% see-through (now opaque — `FogLayer.tsx`, memory `fog-visibility-model`).
- **Baselines to expect from a clean gate:** shared 25 files/427, server 127/2342, client 299
  files/5574, e2e 176 passed/3 skipped. LOC ceiling 350 (fails at ≥349); only `.test.` files are
  exempt — e2e `.spec.ts` and `__tests__` helpers COUNT.

## 1. The mission (recommended; the owner may redirect)

**Keyboard movement, one grid cell per press, with sight and a movement budget following it.**
The owner's words, 2026-09-08 (recorded in HANDOFF §10):

- **WASD and the arrow keys move the SELECTED token — or any selected item** (a token, a prop, an
  NPC the DM has selected) — by exactly one grid cell per press.
- **The fog cone and line-of-sight redraw per square.** Today the vision cone only recomputes when
  a drag is RELEASED; a per-press move makes exploration legible square by square. This is the
  reason the feature is worth more than convenience, and it falls out of the existing wire for free
  (see §2).
- **A movement budget ticks down per square, built in the SAME slice.** The owner asked for this
  alongside the movement, not after it.

Slice it so each piece ships behind a green gate with its mobile surface. A sane cut:

1. **The keystroke → one-cell move.** WASD/arrows move the selected token one cell; the guard; the
   fog redraw (which is automatic). No budget yet.
2. **Any selected item, and hold-to-repeat.** Extend to props/NPCs the actor may move; decide the
   repeat story (§3).
3. **The movement budget.** A per-token, per-turn allowance that decrements by the table's diagonal
   rule, displayed, and reset on a turn boundary.

## 2. Recon already banked (verify anchors before trusting line-level claims)

- **The move is an ordinary `move` message and the server already guards ownership.**
  `apps/server/src/ws/dispatchers/TokenDispatcher.ts:27` → `handler.handleMove(state, id,
senderUid, x, y, isDM)`. A per-press move is `sendMessage({ t: "move", id, x, y })` with the
  cell one step from current — the SAME path a drag uses, so a player can only move their own token
  and the server enforces it. Nothing new on the wire for movement itself.
- **Fog redraw is automatic.** `FogLayer` (`apps/client/src/features/map/components/FogLayer.tsx`)
  recomputes vision polygons from token positions on every snapshot; a `move` → server broadcast →
  new snapshot → repaint. So "the cone updates per square" needs no fog code — it needs the move to
  be per-square. Cost: ONE server round trip + one recipient re-filter PER PRESS. That is the thing
  to watch (§3), not the fog.
- **The diagonal-cost math already exists — reuse it, don't reimplement.** `packages/shared/src/
measurement.ts` exports `measureGridDistance({ ..., rule: DiagonalRule })` and `DIAGONAL_RULES`
  (`5e` / `pathfinder` / `euclidean`). The table's rule is a live setting
  (`snapshot`/Map Setup → Diagonals). A diagonal press is NOT always one square of budget — charge
  it through this, or 5e/Pathfinder/Euclidean tables will disagree with the ruler the DM set.
- **The keys are free.** The whole client binds only Enter, Escape, z, y, r, g, Delete, Backspace
  and modifiers (grep `event.key ===` / `.toLowerCase()`), so WASD/arrows collide with nothing —
  but grep again at HEAD before trusting it.
- **Selection lives in `useSelectionManager`** (`apps/client/src/features/selection`), surfaced on
  App as the selection state. "The selected item" is that; confirm what it holds (single token?
  multiselect set? map-edit element id is separate — `mapEdit.selectedElementId`).
- **The hotkey guard precedent is invariant 4.17** (kicked-in-door plan §4.17), used by `G`:
  `isEditableTarget(event.target)`, no modifiers, no `event.repeat`, inert while a tool owns the
  axis. **Movement is NOT DM-only** — that is the one clause of the G guard that must NOT carry
  over, since a player moving their own token is the whole point.

## 3. Traps this arc WILL hit (on top of HANDOFF §5)

- **One round trip per press.** A held key firing 10 moves/second is 10 `move` messages, 10
  broadcasts, 10 re-filters per recipient. Decide the repeat model deliberately: swallow
  `event.repeat` and require discrete presses; or debounce/coalesce; or move optimistically on the
  client and reconcile. Do NOT let hold-to-run flood the socket — the rate limiter is 100 msg/s and
  fog recompute is not free on a big generated map (a sight radius makes it cheaper — see the fog
  memory).
- **The budget needs a per-turn reset, which drags in initiative/combat.** A movement allowance
  that never resets is a nuisance; one that resets on the wrong signal is a bug. Initiative and turn
  order already exist (the initiative arc); the budget's reset belongs on a turn boundary, which is
  M5 Battle-Strip-adjacent. Scope the reset explicitly with the owner if it grows past "reset on
  your turn start".
- **Mobile has no WASD.** Every slice ships its mobile surface in the same slice (HANDOFF §8). A
  phone equivalent is a real design question — an on-screen d-pad, tap-an-adjacent-cell, or just the
  budget readout — not an afterthought. Raise it before slice 1 lands, and measure it at 375px.
- **Diagonal budget vs. movement.** Moving one cell diagonally is one keypress but not one square of
  budget under 5e (alternating 5-10) or Euclidean. Keep the MOVE (one cell) and the CHARGE (rule-
  dependent) separate; a test that drives the layout and asserts the charge is what pins it.
- **`isEditableTarget` is load-bearing.** WASD will fire while a DM types a node name, a character
  name, or chat unless the guard holds — the exact class of bug invariant 4.17 exists for. Pin it.
- **Fog is a visual boundary, not a data one** (memory `fog-visibility-model`): per-press moves
  reveal more of a layout the client already holds. That is unchanged and accepted; do not "fix" it
  as part of this arc.

## 4. Small open items (none block the arc; fold in opportunistically or leave in §10)

- **DM status persists across a page reload** (noted 2026-09-08, unactioned): a revoked-then-
  reloaded session came back as DM. Likely intended; get a conscious yes before changing it.
- **K5 Cartridge Codes** remains deferred (kicked-in-door plan §7) — provenance already records
  `size`, so a node carries everything a code would encode.
- The kicked-in-door plan's §7 also lists: the return door arriving under a party token; travel
  re-placing the party at the origin's centre; a byte-aware mint cap for the export ceiling. None
  are this arc.

## 5. Non-negotiables (short form; HANDOFF §8 is the full list)

Commit to `dev` as you go; full §2 gate before every commit; **prove every new test can fail**
(sabotage each rule independently — a pair can mask each other, and a sabotage that breaks
compilation is VOID, not red); required options over optional for wiring that must not silently
unwire; **adversarial review before declaring the arc done — SIZED TO FINISH** (see the
`review-convergence` skill), then check `agents_error` and audit `git status`; **evaluate the
running table in a browser, two clients** (the `evaluate-live` skill) — a diff-clean change can
still be unreachable or one-sided; every slice ships its mobile surface in the same slice, measured
at 375px; fix bugs you find regardless of origin, each in its own commit; **merging to `main`
deploys and is ALWAYS the owner's word — do NOT push or merge without it.** Update HANDOFF-NEXT's
§0 AND its §10 list in the same commit as the work. Stage files by explicit path — never a
directory (`temp/` is the owner's untracked art). On the dev seam, `snapshot.players.isDM` LAGS the
real role — the SERVER LOG is ground truth (memory `fog-visibility-model`).

## 6. Tooling (unchanged)

`/verify-gates` (gates-runner, sonnet — never ask for a bundle figure AND e2e in one prompt),
`/watch-ci` (ci-watcher, haiku — after every push), `/fix-fixture-ripple` (sonnet) for TS2741
storms, the `evaluate-live` and `review-convergence` skills for the ship gate, `leakSentinels.ts`
for bytes-level secrecy, Graphify (`graphify update .`, leads not evidence). The preview harness
injects `PORT`. Deploy-probe method: a string that differs between the OLD and NEW production
commits, plus a control, checked across EVERY served chunk INCLUDING the lazy ones named only
inside the entry bundle (memory `deploy-probe-discriminating-string`).

## 7. Prompting the running model — the owner's standing instructions

Copied verbatim from `PROMPT-kicked-in-door-arc.md` §7 (that file is the source if they diverge).
It is written against **Claude Fable 5.1**; the running model may differ (this session ran across
Fable 5.1, Opus 5, and Opus 4.8). If it does, re-fetch that model's prompting guide and adapt — the
principles below (effort sweep, progress updates, batch independent calls, append-only history,
finish the task, the HeroByte fix-bugs override) carry regardless.

The owner asked to be reminded of these and for the next agent to work by them. Source:
<https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1>.
The harness already carries several of these blocks; the rest are for the human running the
session and for how the agent conducts itself.

- **Effort.** Start at `high`; sweep `low`/`medium`/`xhigh`/`max` against real evals — the
  names do not map to the same thinking across models. `medium` roughly matches Fable 5 at
  lower cost; `low` often beats smaller models on cost per task. Two effort-specific traps:
  at `low` the model searches less (add the "recognizing a name is not knowing its current
  state — search it as the user wrote it" nudge); at `xhigh`/`max` a long deliverable may be
  drafted twice (in thinking, then as output) — run those at `high`, or append the
  "everything in one reply counts toward about [max_tokens]; do not draft the whole output as
  reasoning" note and leave `max_tokens` room for both.
- **Progress updates.** Fable 5.1 narrates less than Fable 5, more so at higher effort and in
  long tool chains. Progress notes arrive as `thinking` blocks and are EMPTY under the default
  `thinking.display: "omitted"` — set `"updates"` (beta header
  `thinking-display-updates-2026-08-18`) or `"summarized"`. Remove any "hold all findings for
  the final response" lines, then, if still wanted, add: _"Before you start, say in a line
  what you're about to do; brief updates while you work help the user follow along. Close
  with a short recap that stands on its own — what you found, what you did, and what's next."_
  If the UI hides tool output, say so (turn-scoped system message, `clear_at:
"next_user_message"`, beta `mid-conversation-system-clear-at-2026-08-21`): _"Only you see
  that command's output … If the user needs to read any of it, put it in your reply."_
- **Batch independent tool calls.** In coding/computer-use loops the model may issue one
  implied call per turn. Append after each batch of tool results, as a turn-scoped system
  message (a fresh copy each turn; never delete earlier copies): _"First privately list what
  you need next; then request every item that doesn't depend on another's result in this one
  response."_
- **Keep the history append-only.** Replay assistant turns byte-for-byte, thinking blocks
  included; never edit earlier turns (per-turn reminders → turn-scoped system messages;
  instruction/tool changes → mid-conversation system messages; trimming → server-side
  compaction or context editing). New accounts (from 2026-08-31) get a 400 on a replayed
  thinking block whose prefix changed, or drop it with
  `thinking.block_binding.prefix_mismatch_behavior: "drop_block"` (beta
  `thinking-binding-controls-2026-08-01`). Cache reads are cheaper now — compact later.
- **Writing density.** If prose runs long and dense: _"Please remove all mannered prose"_ (or
  the full paragraph defining mannered prose — metaphor and flourish in place of direct
  statement; say what you mean).
- **Formatting in chat.** Fable 5.1 uses LESS bold/headers/lists than earlier models. Drop
  anti-formatting rules; replace with: _"Use lists and bullet points when asked to, or when
  the content is multifaceted enough that they help with clarity. If the person explicitly
  requests minimal formatting, format without bullets, headers, lists, or bold. In
  conversational, personal, or emotional exchanges, keep to plain prose."_
- **Quoting retrieved sources.** It may reproduce source passages unmarked. Add one complete
  example (request → response with the tool calls templated → rationale) showing indirect
  speech with at most one short marked quotation.
- **Finish the whole task.** Two blocks, both already in this harness: the _"You are operating
  autonomously … End your turn only when the task is complete or you are blocked on input only
  the user can provide"_ block (keep its first sentence verbatim), and the _"Delivering
  work"_ scope block (the request is the deliverable; don't narrow, widen, or swap it; do
  everything that doesn't depend on an open question; a decided step is something to run, not
  announce).
- **Compaction summaries (client-side).** Instruct the summarizer to preserve, exactly:
  problems and how they were resolved; options tried or set aside and why; everything asked,
  decided, ruled out, or established as a constraint — stated exactly; where things stand;
  what is still open or promised; hard-to-reconstruct details (names, numbers, dates, exact
  wording, links). Keep the user's words close; condense the model's own reasoning.
- **Scope and tests.** _"If you find a pre-existing bug, performance concern, or behavior the
  task doesn't mention, don't fix, optimize or extend it in this change unless the requested
  behavior cannot work without it; report it as a follow-up. Implement the reading the wording
  most directly supports and state the assumption. Commit tests only where the task asks or
  the repo already keeps tests for this kind of change, sized like neighbors; don't turn
  scratch checks into permanent test files."_ — NOTE the local override: HeroByte's standing
  rule (HANDOFF §8) is "fix bugs you find regardless of origin, each in its own commit" and
  "prove every new test can fail". The owner's repo rule wins here; the general snippet
  governs everything else (no unrequested extensions, no scratch-test sprawl).
- **Safeguard false positives.** Ask "are there any bugs in this program?" rather than "does
  it compile?"; give context for lesser-known languages; keep base64 out of tool output.
- **Targeted edits.** Fable 5.1 rewrites whole files more readily than Fable 5: _"The number
  of tokens used to edit files is best minimized … surgically edit a file rather than rewrite
  the entire thing."_
- **Subagents.** Let the lead keep working while subagents run: the spawn tool returns
  immediately, results arrive in a later user message, a separate tool waits on demand. The
  gates-runner/ci-watcher/workflow pattern here already does this — never poll, never
  hand-read a journal to "check".
- **Vision.** For dense images give the model a crop/zoom tool (or a container with PIL /
  OpenCV); the pane browser's `zoom` action is NOT supported yet — take screenshots and read
  canvas pixels container-locally instead.
