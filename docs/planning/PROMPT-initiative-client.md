# Prompt — finish the initiative slice (client half)

You are continuing a slice that is half done. The server half is written, tested, pushed, and
green; nothing is deployed and nothing is visible to a user yet. Your job is commits 5, 6 and 7.

Everything below was verified by reading the files on 2026-08-18 at `dev` = `08c6e540`. Line
numbers are from that commit. You should not need to search for anything — if a path here is
wrong, trust the file and say so.

> **DONE 2026-08-24.** All three commits landed, plus the review's fixes (hidden-NPC log leak
> `d4dfda6e`, modifier bound `ac47ab9e`, vacuous sanitization test `b30fffd8`). Slice complete
> on `dev` at `ac47ab9e`, CI #808 green. Still open for the owner: the §5 `recordManual`
> judgement call. Kept for the record — do not execute.

---

## 0. Orient (do this first, it is five commands)

```bash
git log --oneline -8 && git status --porcelain | grep -v 'temp/'
```

Expect `dev` = `08c6e540`, clean apart from the owner's untracked `temp/` files. Use
`grep -v 'temp/'`, not the anchored `^?? temp/` — three of those filenames contain spaces, so git
quotes them and the anchored form misses them.

Then confirm CI was green for `08c6e540` before you build on it (a run was launched at push time;
its result may not have been read yet):

```bash
curl -s "https://api.github.com/repos/loshunter/HeroByte/actions/workflows/ci.yml/runs?branch=dev&per_page=3"
```

Read `docs/planning/initiative-server-side-plan.md` (the slice plan) and §2, §5 and §8 of
`docs/planning/HANDOFF-NEXT.md` (the gate, the traps, the method). Do not skip §8 — "prove every
test can fail" is enforced here, not aspirational.

---

## 1. What is already built, and what it means for you

Four commits, `850c4fc6..08c6e540`:

| commit     | what it did                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| `8aa91795` | the plan doc                                                                |
| `850c4fc6` | wire shape: three messages + validators, no behaviour                       |
| `bcd6aefe` | the server rolls d20 on `cryptoDiceRng` and logs it; `DiceRoll.label` added |
| `6f37fa6e` | `initiativeManualOverride` — a DM-toggleable table setting, **default ON**  |
| `08c6e540` | manual entries also log, with the superseded value struck through           |

**The server is finished and works. The client does not use any of it yet.** Both
`Math.random()` callers are still what the UI calls. That is the entire remaining job.

Three messages exist and are validated server-side:

- `{ t: "roll-initiative"; characterId }` — server rolls, applies the character's stored modifier,
  writes initiative, appends a public `DiceRoll` labelled `"<name> — initiative"`. Ownership is
  enforced (a player may roll only for their own character; the DM for anyone).
- `{ t: "roll-initiative-all" }` — **declared and validated, but NOT handled yet.** There is no
  server case for it. You write it (see commit 6).
- `{ t: "set-initiative-manual-override"; enabled }` — DM-only, stored in
  `RoomState.initiativeManualOverride`, snapshot field `initiativeManualOverride?: boolean`.

`set-initiative` still exists and is still the manual path. It now also writes a log line labelled
`"<name> — initiative (entered)"`.

---

## 2. The three commits

### Commit 5 — the modal's Roll button stops rolling

**`apps/client/src/features/initiative/components/InitiativeModal.tsx`**

- Lines 62-67, `rollD20`, is `Math.floor(Math.random() * 20) + 1` into local state. That local
  "rolled value" then feeds `onSetInitiative(initiative, modifier)` on save.
- Props today (lines 10-16): `character`, `onClose`, `onSetInitiative(initiative, modifier)`,
  `isLoading?`, `error?`.
- The Roll button's visible text is `Roll Initiative` (~line 180). **Do not change that string** —
  see the e2e note in §3.

The shape to aim for: the Roll button sends `roll-initiative` and the modal shows the result the
SERVER returns (it arrives in the snapshot's `diceRolls` and on the character). Manual entry keeps
working exactly as now and keeps calling `onSetInitiative`.

The honest difficulty, and it is yours to decide: the modal is currently synchronous — click,
see a number, press save. A server roll makes it a round trip. Options, in the order I would try
them:

1. Send `roll-initiative` and let the modal close immediately; the value lands via snapshot. This
   is simplest and matches how the rest of the app behaves, but the player loses the "see the
   number, then confirm" beat.
2. Send and wait, showing the pending state `useInitiativeSetting` already models (`isSetting`,
   `error`, and a 5s timeout — see below), then display the resulting initiative.

**`apps/client/src/hooks/useInitiativeSetting.ts`** is the existing send path and the model to
copy: it takes `sendMessage: (msg: ClientMessage) => void` (line ~29), sends `set-initiative` at
line 95, stashes the previous value in `prevInitiativeRef`, sets `isSetting`, and fails the request
after 5 seconds with `"Initiative update timed out. Please try again."`. Add the roll alongside it
rather than inventing a second mechanism.

**The test you must rewrite, not delete:**
`apps/client/src/features/initiative/components/__tests__/InitiativeModal.test.tsx`, the test
titled **`"uses Math.random() internally"`** (~line 692). It assigns `Math.random = mockRandom`
and asserts the rendered string `"d20 Roll: 11 + 3"`. It pins the exact behaviour you are
removing. Replace it with one that asserts the MESSAGE goes out — `{ t: "roll-initiative",
characterId }` — and nothing about a number. HANDOFF-NEXT §3D specifically calls this out.

### Commit 6 — bulk roll becomes one message

**`apps/client/src/hooks/useBulkInitiativeRoll.ts`**

- Line 76 is the second `Math.random()`.
- The hook is `useBulkInitiativeRoll(npcs, onSetInitiative)` and loops NPCs without initiative,
  pausing every `RATE_LIMIT_SAFE_BATCH` (~line 10) to dodge the rate limiter.
- Called at **`apps/client/src/features/dm/components/tab-views/NPCsTab.tsx:104`**; the return
  value is used at line 115 as `const count = await rollAllInitiative()`, and the count is shown
  to the user.

Replace the whole loop with one `roll-initiative-all`, and **delete the batching constants rather
than porting them** — HANDOFF-NEXT §11 established the real limiter bound was 500, not 20, so that
machinery was solving a problem that did not exist.

**You must write the server side of this**, which commit 1 declared but never implemented:

- add a `case "roll-initiative-all"` to `apps/server/src/ws/dispatchers/InitiativeDispatcher.ts`
- add `handleRollInitiativeAll` to `apps/server/src/ws/handlers/InitiativeRollHandler.ts`,
  DM-only, looping every NPC with `initiative === undefined` and calling the same roll path
- watch the LOC guard: that file is 114 lines, so it has room, but re-measure after
  `prettier --write` — formatting EXPANDS files

**The count trap.** `NPCsTab.tsx:115` expects a number back. With one message the client no longer
knows how many were rolled until the snapshot arrives. Do NOT send N messages to keep the count —
that is exactly the single-flight bug recorded in the `player-props-slice` memory, where a count
riding N messages got dropped to one. Either derive the count from the snapshot after the fact, or
have the server return it. Say in the commit body which you chose and why.

### Commit 7 — the DM toggle, its mobile surface, and the missing label

**a) The toggle UI.** Copy the `playerPropsEnabled` wiring exactly; it threads through five files:

| file                                              | line   | what is there                                         |
| ------------------------------------------------- | ------ | ----------------------------------------------------- |
| `features/dm/components/tab-views/SessionTab.tsx` | 63,96  | prop declaration and default                          |
| `features/dm/components/tab-views/SessionTab.tsx` | 145    | the `<input type="checkbox">` + its explanatory blurb |
| `features/dm/components/DMMenu.types.ts`          | 113    | the prop pair on the menu's type                      |
| `features/dm/components/DMMenu.tsx`               | 97,243 | destructure and forward                               |
| `features/dm/components/DMMenuContainer.tsx`      | 259    | `snapshot?.playerPropsEnabled ?? false`               |

**The one line you must NOT copy verbatim is that last one.** Props default OFF; this flag defaults
**ON**, and the snapshot only carries it when it is off. So it reads
`snapshot?.initiativeManualOverride !== false`, never `?? false`. Getting this wrong makes the
checkbox render unchecked on every table that has never touched the setting, and the DM will
"fix" it by toggling — writing an explicit value that was already the default. This same inversion
already has a server-side test guarding it (`StatePersistence.test.ts`, "round-trips the initiative
override, reading an ABSENT key as ON"); mirror that intent on the client.

**b) The mobile surface is not optional** (§8, an owner decision: every slice ships its mobile
surface in the same slice). `apps/client/src/features/dm/buildDMMenuProps.ts` is the ONE mapping
from the `MainLayoutProps` bag onto the menu, shared by both layouts — wire the toggle there once
and both desktop and phone get it. Measure it in a browser; do not compute it.

**c) The label nobody renders — this is a real gap I left you.**

The server sets `DiceRoll.label` on every initiative roll, and **no client code reads it.** I
checked: the only `.label` hits under `apps/client/src/components/dice/` are dice-macro labels,
unrelated. So today a DM rolling five goblins gets five log lines that all read as their own name
with no indication of which creature.

- `components/dice/RollEntry.tsx` renders `roll.playerName` (line 87) and `roll.formula`
  (lines 48, 137). The label belongs here.
- Check `components/dice/MobileResultOverlay.tsx` too — the phone has its own presentation.

**The strike-through already works and needs nothing.** `components/dice/RollResultContent.tsx:98`
already renders `roll.dropped` with `data-testid="roll-dropped"`, which is precisely why the server
puts the superseded value in that field. Verify it renders for an initiative override; do not
build a second mechanism.

---

## 3. Traps that will cost you hours

- **The e2e specs drive initiative by visible text.**
  `apps/e2e/player-npc-initiative-ui.spec.ts:195` finds buttons matching `/INIT/i`, clicks the
  first, and then looks for a **`Roll Initiative`** button. `player-npc-initiative-simple.spec.ts`
  is its sibling. If you rename that button or make the modal close on roll, update these
  deliberately and say so — do not discover it in CI.
- **A CI job timeout reports as `cancelled`, not `failure`,** and the run summary hides which. Check
  that `e2e-full-suite`'s "Run full E2E suite" step says `success` and not `skipped`; the
  `Upload test artifacts` step is `if: failure()`, so its being skipped is independent evidence
  nothing failed. Full detail in HANDOFF-NEXT §5.
- **`useMapEditState.ts` (349) and `characterValidators.ts` (348)** are one line from the 350 guard.
  Nothing here should touch them, but if you do, extract first.
- **Writing files with Python on Windows introduces CRLF** and turns every line of the file into a
  `prettier/prettier` "Delete `␍`" lint error. Use `newline=''` on the write, or run
  `pnpm exec prettier --write <file>` afterwards. This cost me a full gate cycle.
- **The shell's working directory persists between tool calls.** A `cd apps/server` in one command
  is still in effect in the next one. Prefer absolute paths; Python on this machine wants
  `D:/HeroByte/...`, not the Git-Bash `/d/HeroByte/...`, which it cannot resolve.
- **A quantity of one is dropped from a canonical formula**, so an initiative roll reads `d20`, not
  `1d20`. My first three test expectations were wrong about this.

---

## 4. The gate — all of it, before every commit

```bash
CI=true pnpm build            # MUST precede typecheck and test
CI=true pnpm typecheck && CI=true pnpm lint && CI=true pnpm lint:structure:enforce && CI=true pnpm format:check
CI=true pnpm test
CI=true pnpm --filter herobyte-client build:check
CI=true pnpm test:e2e --reporter=list
```

`pnpm lint:structure:enforce` is **NOT** part of `pnpm lint`. Never pipe a gate into `tail` — a
pipe hides the exit code, and it has already caused a red run to read as green twice in this repo.

**Baselines at `08c6e540`:** shared **424** / 24 files, server **2140** / 112 files, client all
**45 batches**. E2E was 134 passed / 0 failed / 3 skipped before this slice; the client is
untouched so far, so any e2e movement is yours.

**Sabotage every test you add** (§8). Break the fix, watch the right test go red, revert, re-run to
confirm green. Two warnings from this session: a sabotage that fails to APPLY runs green against
unsabotaged code and proves nothing — assert the target string was found. And a sabotage that goes
red for the wrong reason is not a proof either; read which test failed.

---

## 5. Judgement calls I made that you may reverse

These were mine, not the owner's, and none is load-bearing enough to defend if you disagree:

- **`roll-initiative-all` as ONE message** rather than N. §3D did not specify bulk behaviour.
- **`DiceRoll.label` as a new optional field.** The alternative was putting the character's name in
  `playerName`, which I rejected because that field is bound from the connection and would have
  been a lie in the data model.
- **The override toggle gates SETTING a value, not CLEARING one** — a player withdrawing from a
  fight is not claiming a number. There is a test pinning this
  (`InitiativeMessageHandler.test.ts`, "still lets a player CLEAR their initiative while the toggle
  is off"). If the owner wants clearing gated too, that test is where to start.
- **`DiceService.recordManual`** bends the rule in that file's header, which says no client-built
  roll shape is accepted. I documented why at length in the method comment; the owner has been
  asked to review it and has not yet responded. **If they say it is too wide a door, the fix is to
  move manual logging behind a narrower API — do not just delete the log line**, because "both
  paths are visible to the table" is the point of the slice.

---

## 6. Definition of done

- Neither `Math.random()` remains in `apps/client/src/hooks/useBulkInitiativeRoll.ts` nor
  `apps/client/src/features/initiative/components/InitiativeModal.tsx`. Grep to confirm.
- A player rolling initiative produces a log line the whole table can see, naming the character.
- An override strikes through what it replaced, visibly, in the browser.
- The DM toggle renders CHECKED on a table that has never touched it.
- The phone has the toggle, measured in a browser.
- Full gate green, e2e included, with the numbers in the commit body.
- **Stop before merging to `main`.** That is the owner's call, and it deploys immediately to Render
  and Cloudflare, ungated by CI. Players with a tab open must reload after any deploy.
