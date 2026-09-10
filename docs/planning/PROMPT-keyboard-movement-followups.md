# Handoff — keyboard movement is COMPLETE on `dev`; merge is the owner's, then the follow-ups

Written 2026-09-10 at the close of the keyboard-movement arc. `dev` is at `aacfc2ae`, ten
commits past production (`a41a8065`), every one gated by the full ladder (last run: 188 e2e
passed, 0 flaky) and live-checked with two clients. **Nothing is pushed or merged.** Read this
file, then `HANDOFF-NEXT.md` §0 (top two updates), §2, §5 and §8, then the plan
`keyboard-movement-arc-plan.md` (its three "Review round" sections and the "Open after the arc"
list are the ground truth for what shipped and what did not).

## 0. Where things stand, exactly

- **Shipped on `dev`** (`git log --oneline a41a8065..HEAD`): S1 `772e1403` one cell per press +
  phone d-pad; S2 `78a7fe60` hold-to-walk; `d4240c48` a token delta now moves its scene object;
  S3 `cd20e150` the movement budget; R1 `316c295a`; R2 `b2a0cb20`; `5f884b7e` the initiative
  modal's false "timed out" on a hand entry equal to the roll on file; R3 server `b5de1533`; R3
  client/mobile `0ac35b12`; `aacfc2ae` the save debounce.
- **The adversarial review PLATEAUED.** Round 2 was 1 critical / 18 major / 30 minor; round 3
  was 1 / 17 / 45 (six fresh Opus lenses each round). Under `review-convergence` a count that
  does not drop across two rounds means STOP and escalate — so there was no round 4. Every round-3
  defect was still fixed (the fix-bugs rule), in two commits, each sabotage-proven; the rest is
  RECORDED in the plan with its reasoning. **The owner decides whether the recorded items block
  the merge. Do not run a round 4 on the same diff; do not merge.**
- **What the review's critical finding was**, so you understand the shape of the code you are
  inheriting: round 2 hung the budget reset on the initiative-clear road, which any player may
  use on their own character — two clicks zeroed their own spend. The budget state machine was
  rewritten in `b5de1533`: the per-round stamp (`character.movementRound`) is written by the
  TURN START only, never at combat start; `state.combatRound` has no floor (0 and below are stamp
  keys); a turn pointer outside the order counts as a wrap; `load-session` resets everyone;
  clearing your own initiative keeps your spend. `movementBudgetReset.ts` carries the reasoning.
- **The wire** is ONE relative `step-object { ids, dx, dy }` per step for the whole selection
  (validator: 1–64 unique `token:`/`prop:` ids; the client chunks at `MAX_STEP_OBJECTS`). The
  server rounds each TOKEN's own cell and applies the step on the transform road. Two earlier
  absolute-cell versions teleported; a per-object message tripped the 100/s limiter past ~15
  objects. Do not reintroduce either.
- **Production** is still `a41a8065` (publish-blank-table fix + fog opacity). Players there have
  none of this arc.

## 1. The mission (recommended; the owner may redirect)

**Step 1 — the owner's merge decision comes first, and it is theirs.** Present the three
recorded owner calls below in one message if they have not decided yet, then WAIT. If the owner
says merge: `git checkout main && git merge dev` (fast-forward expected), push, spawn
`ci-watcher`, then probe the deploy with a string that differs between `a41a8065` and `aacfc2ae`
across every served chunk (memory: "Deploy probe: discriminating string") — `step-object` or
`Move selection` are in the bundle now; `MAX_STEP_OBJECTS` is NOT (server-only). A prod
functional check of the server half needs the prod DM password the owner holds. Record the
deploy in HANDOFF §0 exactly as the 2026-09-09 update does.

**Step 2 — the follow-up slice, once the owner has chosen**, in this order of value:

1. **The phone pad covers the token it moves** (round 3, the biggest open item). At 375×812 the
   selection sheet plus the dock is a ~340px opaque band over the map; the budget line sits BELOW
   the token (`TokenNameplate.tsx`, `moveY = nameY + FONT_SIZE + 2`); a player walking ↓ walks
   into the band, every press charged, no undo. Two shapes, the owner picks: (a) a camera follow
   while the pad is mounted — pan when the selected token's screen point enters the sheet's rect
   (top = `100dvh − var(--mobile-sheet-offset) − sheet height`; `useKeyboardMovement` already
   knows the movable ids, `MapBoard` owns the camera); (b) flip the plate above the token when it
   would land inside that rect. Whichever: ship it with its mobile spec at 375px measuring REAL
   rects, not the CSS var.
2. **A DM "reset budget" control** outside a turn boundary, and whether the budget ENFORCES
   (today a negative readout is advisory and red). If enforcement: the refusal must be visible
   (a toast, like the dropped-gesture toast), never silent — and it changes the e2e specs that
   overspend on purpose (`movement-budget.spec.ts` "-5 / 5 ft").
3. **Whether a DM-owned PC with an initiative is a combatant** (today it is not, by
   `shouldCharacterParticipateInCombat`; its plate is suppressed and the server still charges
   it). If yes, the participation rule changes for initiative too — read `initiative-slice.md`
   memory before touching it.
4. Small, do only if the owner asks: a "nothing selected → your own token" fallback for WASD in
   pointer mode; a slower phone hold cadence (one constant, `HOLD_STEP_INTERVAL_MS`); next/prev
   turn ignoring `combatActive`; a `pc`-typed DM-run boss shipping its budget like its HP (the
   pre-existing `type` axis — a real redaction change, review it as one).

Each item is its own slice: plan bullet → implement → sabotage → gate → commit → HANDOFF §0 and
§10 in the same commit → live two-client check. Do not batch them into one commit.

## 2. Recon already banked (verify anchors at HEAD before trusting line-level claims)

- **Files that carry the arc**: `packages/shared/src/movementBudget.ts` (charge, budget, reset,
  coercion, `MAX_STEP_OBJECTS`); `apps/server/src/domains/room/transform/{movementCharge,
movementBudgetReset,TransformHandler}.ts`; `apps/server/src/ws/handlers/
{TransformMessageHandler,InitiativeMessageHandler,applyInitiative,CharacterMessageHandler,
NPCMessageHandler,TokenMessageHandler}.ts`; `apps/server/src/domains/room/snapshot/
movementRedaction.ts` (wired at the END of `recipientFilter.ts` — the only privacy boundary);
  `apps/server/src/domains/room/persistence/{loadCoercions,saveDebounce}.ts`; client
  `apps/client/src/features/movement/{keyboardMovement,useKeyboardMovement}.ts`,
  `apps/client/src/layouts/{MobileMovePad,MobileSelectionSheet}.tsx`, `apps/client/src/features/
map/tokenPlates.ts` + `TokenNameplate.tsx`, `apps/client/src/features/players/components/
MovementSpeedField.tsx`, `apps/client/src/hooks/useInitiativeSetting.ts`.
- **Contract and e2e that must stay green and are worth reading first**: `apps/server/src/ws/
__tests__/movementSecrecy.contract.test.ts` (five-digit sentinels, every road incl. the DM's
  speed write); `apps/e2e/{keyboard-movement,movement-budget,initiative-repeat-entry}.spec.ts`;
  `apps/e2e/mobile/{mobile-move-pad,mobile-movement-budget}.spec.ts` (the pad spec holds a finger
  over CDP via `touchHold` in `touch.helpers.ts` and releases a mouse far off the chip).
- **Line-count guard** fires at `wc -l >= 349`; the files nearest it: `InitiativeMessageHandler.ts`
  339, `StatePersistence.ts` 347, `helpTopics.ts` 345, `NPCEditor.tsx` 345, `MobileLayout.tsx` 324. Extract before you add.
- **Modal overlays** carry `data-modal-overlay` (initiative, elevation, character creation); the
  keyboard hook leaves the key alone while one is in the DOM. A new full-screen modal must carry
  it too, or the keys step the token underneath.
- **Selection** lives only in Select/Transform mode (`useSelectionManager` auto-clears elsewhere);
  the pad renders only when `movableCount > 0`.

## 3. Traps this session paid for (on top of HANDOFF §5)

- **A stamp written ahead of its event is a no-op at the event.** Pre-stamping everyone with
  round 1 at combat start made every round-1 turn start inert. Write stamps where the event
  happens. A clamp on one side of a symmetric counter is a refill. A reset hung on a road a
  PLAYER may drive is a refill. A test pinned at the one index where a clamp never fires is green
  over the hole — pin the boundary index too.
- **jsdom has no `PointerEvent` and no `setPointerCapture`**: `fireEvent.pointerDown(el,
{pointerId})` arrives with `pointerId` undefined. `MobileLayout.test.tsx` polyfills a
  `MouseEvent` subclass; nothing in jsdom can see capture — only the CDP/mouse e2e can.
- **`vi.spyOn(mod, "fn").mockRestore()` on an export that is already a `vi.fn`** de-mocks it for
  every later test in the file (five persistence tests died to this). Use the file's existing mock.
- **A debounced save on a SECOND instance lands in the NEXT test.** `awaitAllPendingWrites()`
  (exported from `StatePersistence.ts`) flushes every instance — call it in teardown of any suite
  that mints extra `RoomService`s and counts writes.
- **A Playwright "settled" check must sample AFTER the last in-flight round trip lands**: a step is
  a round trip, and reading at once saw the last step arrive and called it "still walking".
- **`pnpm test:e2e <spec> --repeat-each=N` runs only from PowerShell** (the runner's `spawn pnpm`
  is ENOENT under Git Bash). The flake denominator lives in `.tmp/gates-*/*e2e*.log` — mine it
  before calling anything a flake; the "flake" this arc found was a 1-in-20 product bug.
- **A hidden pane tab does not draw Konva** (no RAF): after a reload the hit canvas is empty and
  a synthetic click selects nothing. `tabs_select` the tab first, then click.
- **A one-NPC spec cannot see `npcs[0].id` wired for `npc.id`.** Binding tests need two.
- **`<input type=number>` reports `""` for a REJECTED entry** with `validity.badInput` set;
  jsdom sanitises to `""` without the flag — define it in the test.
- **The e2e `snapshot.players.isDM` lags the real role** on the dev seam; the server log is truth.

## 4. Small open items (none block; fold in opportunistically or leave in §10)

- Frame-cadence side channel: a hidden monster walked by a held key sends a player a full
  per-recipient snapshot per step (byte-identical but for `stateVersion`). Fix if wanted: in
  `RoomService.broadcast`, send `{t:"state-sync", stateVersion}` to a recipient whose payload
  differs from the last only in `stateVersion`.
- The initiative modal's newer-frame confirmation proves the STATE is what was asked, not that
  this request produced it; a server ack would be the honest signal.
- Drawings are not steppable (their transform is in pixels); the launch prompt's "any selected
  item" meant tokens, props and NPCs. Say so in help if it ever confuses anyone.
- DM status persists across a page reload (noted 2026-09-08, not actioned; likely intended).

## 5. Non-negotiables (short form; HANDOFF §8 is the full list)

- Commit to `dev` as you go; the full §2 gate before EVERY commit (`CI=true`; `gates-runner`,
  sonnet-pinned; never ask it for a bundle figure AND e2e in one prompt). Stage by explicit path,
  never a directory (`temp/` is the owner's untracked art).
- Prove every new test can fail — sabotage one rule at a time; a sabotage that breaks compilation
  is VOID; prove a strengthened assertion can still PASS.
- Every slice ships its mobile surface in the same slice, measured at 375px on the 44px floor
  with REAL rects.
- Fix bugs found regardless of origin, each in its own commit. Update HANDOFF §0 AND §10 in the
  same commit as the work.
- Review with `review-convergence` sized to finish (4–8 agents per slice, ≤3 rounds, fresh agents
  each round, union of findings, `agents_error: 0`, `git status` audit after any errored run),
  then `evaluate-live` with two clients. Pin `model` on every subagent.
- **Merging/pushing to `main` deploys and is ALWAYS the owner's word.** Never push or merge on
  your own judgment; the CLI credential cannot push a commit touching `.github/workflows`.

## 6. Tooling (unchanged)

`preview_start {name: "dev"}` (client 5174, server 8787; e2e rails on 5175/8788); two tabs pinned
by `?sessionUid=` (navigate strips queries — set the URL once); `?mobile=true` forces the phone
layout; the dev seam is `window.__HERO_BYTE_E2E__` (replaced per render — re-read after every
await); Konva needs real `MouseEvent`s on `.konvajs-content`; the pane's `zoom` is unsupported;
Bash heredocs break on apostrophes — write scripts with the Write tool; the real typechecks are
`tsconfig.typecheck.json` in BOTH `apps/client` and `apps/server`.

## 7. Prompting the running model — the owner's standing instructions

Copied verbatim from `PROMPT-keyboard-movement-arc.md` §7, itself a copy of `PROMPT-kicked-in-door-arc.md` §7 (that file is the source if they diverge).
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
