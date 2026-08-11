# Handoff — S8, the last slice in the Session One arc

Read this whole file before touching anything. Every path and number below was opened and verified on
2026-08-05 at `dev` = `83b8af07`. Where something is a judgement call rather than a fact, it says so.

---

## 0. Where things stand

**The arc is one slice from done.** `docs/planning/session-one-arc.md` is the source of truth; S0–S7
are complete and **all of them are now IN PRODUCTION**.

| Branch | Commit     | State                                                     |
| ------ | ---------- | --------------------------------------------------------- |
| `dev`  | `83b8af07` | pushed, CI run #757 green on every job                    |
| `main` | `5307d0dd` | pushed, CI run #758 green on every job, **deployed live** |

S6 (distance, diagonal rule, area templates) and S7 (per-token sight radius, explored fog) went live
together in that merge — 12 commits. Verified live rather than assumed: the served bundle contains
`fog-explored`, `Sight Radius`, `set-token-vision-radius`, `visionRadius` and `diagonalRule` (string
literals a minifier cannot rename), no console errors, and `window.__HERO_BYTE_E2E__` is `undefined`
which confirms a real production build. Client `https://herobyte.pages.dev`, server
`https://herobyte-server.onrender.com`.

**The working tree is clean apart from untracked files under `temp/`.** Those are the owner's local
art assets. **Never `git add temp/` and never `git add <directory>`** — a broad add swept them into
main once before, and untracking them deleted them off disk. Stage files explicitly by path, always.

**Commit policy, asked and answered:** commit to `dev` as you go. The owner asked for the S7 push
explicitly; do **not** push or merge to `main` again unless they ask. `main` is production and
auto-deploys the moment it moves (Render watches `main` from its own dashboard, so the deploy is NOT
gated by CI — `DEPLOYMENT.md:24-26`).

### ⚠️ Another session is editing the tree right now

The owner started a background task (`task_248dcc6b`, "Fix the wrong test that reds the nightly CI")
in a **separate local session**. It is editing **`apps/e2e/comprehensive-mvp.spec.ts`** and possibly
reading `apps/client/src/ui/AuthenticationGate.tsx`. Before you start:

```bash
git log --oneline -5 && git status --porcelain | grep -v '^?? temp/'
```

If that spec has moved, rebase your thinking on it — do not fight it, and do not touch that file.
See §5 for what it is fixing and why the e2e baseline may change under you.

---

## 1. Running it

```bash
pnpm install
pnpm dev          # client http://localhost:5174, server http://localhost:8787
```

Table password `Fun1`, DM password `FunDM`. Default table is the public "Main Hall".
DM elevation from a console (dev/test builds only):

```js
window.__HERO_BYTE_E2E__.sendMessage({ t: "elevate-to-dm", dmPassword: "FunDM" });
```

`pnpm dev` sets `HEROBYTE_DEV_ALLOW_LAN=true`, so a phone on the same Wi-Fi can reach the Network URL
Vite prints. Never use Bash to run dev servers — use the Browser pane's `preview_start`
(`.claude/launch.json` already defines `server` and `client`).

---

## 2. S8 🟢 — Staging an encounter, and finding the manual (~2 days)

Verbatim from the plan:

> Duplicate-NPC and add-×N (one loop over `create-npc`, auto-numbered). A `?` in the header opening
> an in-app help panel.
>
> **Done when.** Adding five goblins takes five inputs.

Two independent halves. **Do them as two commits.** The `?` panel is the easy one; do it first to get
a win on the board, then spend your care on the NPC guard.

---

## 3. Half A — the `?` help panel (do this first)

### Use the self-contained pattern; it touches ONE file besides your own

There are two ways to add a header button and they differ by four files.

- **Prop-driven** (the 📜 Log pattern) threads through `Header.tsx` → `TopPanelLayout.tsx` →
  `MainLayout.tsx` → `MainLayoutProps.ts`, and therefore the layout fixtures.
- **Self-contained** (the `JuiceMenuButton` pattern) is one import plus one line in `Header.tsx`.
  `apps/client/src/features/juice/JuiceMenuButton.tsx` (51 LOC) says why, verbatim: _"Self-contained
  header button that toggles a small popover with the game-feel settings. No props, so it can be
  dropped into the toolbar without threading any state through the layout."_ It owns its own
  `useState` and closes on outside `mousedown`.

**Copy `JuiceMenuButton`.** It bypasses `MainLayoutProps` and every fixture concern. Verified LOC:
`Header.tsx` is **257** (ceiling 348, so 91 lines of headroom) and holds a 13-button row.

### The docs-asset question — MEASURED, so you can just decide

The plan flags that `docs/user-guide/` sits outside `apps/client` (what Cloudflare Pages builds) and
says "decide before starting". Measured today:

| thing                              | size                           |
| ---------------------------------- | ------------------------------ |
| `docs/user-guide/img/`             | **4.8 MB**, 36 images          |
| `docs/user-guide/*.md` (text only) | **45 KB**                      |
| `apps/client/public/` today        | 2.0 MB                         |
| client entry bundle                | **92.83 KB** gzip / 175 KB cap |

**Recommendation: bundle the markdown, link out to GitHub for screenshots.** The prose is nearly free
and the images are the whole cost. That is a recommendation, not a decision the owner has made — if
you want to differ, ask, don't assume.

Note the guides are **already accurate for S6 and S7**: `docs/user-guide/dm-guide.md` documents Fog of
War and the new Sight Radius control (including that it is player-tokens-only and why), and
`player-guide.md` explains the sight limit and remembered ground. So the help panel has real,
current content to show on day one.

### Mobile home for it

The dock is **full and must stay at five**. `apps/client/src/theme/herobyte.css:1253` is
`grid-template-columns: repeat(5, minmax(0, 1fr))`, never overridden, and two separate code comments
record this as the reason chat became a tab in the roll log and S5's roll options went inside the dice
roller. **Do not add a sixth dock button.**

Put a mobile help entry in the **tool sheet** — `MobileFloatingControls.tsx` (177 LOC) is a wrapping
4-up/3-up grid with room to spare — or as a tab inside an existing sheet.

**`MobileLayout.tsx` is at 347 of a 348 ceiling. ONE line of headroom.** S7 spent two of the three it
had. If you need to touch it at all, extract first — `MobileSelectionSheet.tsx` (52 LOC) and
`MobileDrawingControls.tsx` were both carved out of it for exactly this reason.

---

## 4. Half B — duplicate-NPC and add-×N

### The single-flight guard is the entire difficulty. Read it before designing.

`apps/client/src/features/dm/hooks/useNpcCreation.ts` (138 LOC). Verified behaviour:

- `createNpc` (:105) **refuses to run while `isCreating` is true** and just `console.warn`s. So a
  naive `for (let i = 0; i < n; i++) createNpc()` fires **once** and silently drops the rest.
- Success is detected by **watching `snapshot.characters` COUNT** against a `prevNpcCountRef`
  (:90-100), with a **5-second timeout** that raises `"NPC creation timed out. Please try again."`
  (:121-130). So an add-×N that sends five messages will see the count jump by five and must reason
  about that ref, or it reports a spurious timeout.
- The payload is fixed: `sendMessage({ t: "create-npc", name: "New NPC", hp: 10, maxHp: 10 })` (:118).

### Decide the wire shape FIRST. This is the one real design call in S8.

**Recommendation: add an optional `count` to `create-npc` and loop server-side.** Reasons:

- It makes the single-flight guard **correct by construction** instead of by accident — one message,
  one round trip, one count delta to reconcile. The N-messages approach leaves you fighting a guard
  and a ref that were built for exactly one in-flight create.
- It is one broadcast and one state-file write instead of N. `create-npc` already goes through
  `executeIfDMAuthorized` (`CharacterDispatcher.ts:96`), so the gate is unchanged.
- Cost is small and the chain is short (see below).

The alternative — N messages from the client — means reworking `useNpcCreation`'s completion
detection. Either is defensible; pick one deliberately and write the reason in the commit.

### The exact chain for a `count` field, all verified

1. **Shared type:** `packages/shared/src/index.ts:720-728` — the `create-npc` member already carries
   `name, hp, maxHp, tempHp?, portrait?, tokenImage?`. Add `count?: number`.
2. **Validator:** `apps/server/src/middleware/validators/characterValidators.ts:81-108`
   (`validateCreateNpcMessage`, file is 330 LOC — 18 lines of headroom, watch it). Bound `count`
   explicitly: `isFiniteNumber`, integer, `>= 1`, and a hard ceiling. `isFiniteNumber` alone admits
   `1e308`, and this one loops — an unbounded count is a self-inflicted DoS. Note
   `SNAPSHOT_LIMITS.characters` is **500** (`sessionValidators.ts:76-85`); pick a per-message cap well
   under that (10 or 20 is plenty for "five goblins").
3. **Table registration:** `apps/server/src/middleware/validation.ts:161` already maps
   `"create-npc"`. No change needed — you are widening an existing message, not adding one.
4. **Dispatcher:** `apps/server/src/ws/dispatchers/CharacterDispatcher.ts:94-102` — passes
   `message.name, message.maxHp, message.portrait, { hp, tokenImage }` into
   `npcHandler.handleCreateNPC`. Thread the count here.
5. **Handler:** `apps/server/src/ws/handlers/CharacterMessageHandler.ts` (316 LOC — 32 lines of
   headroom; put the loop in the SERVICE and keep the handler thin, as S7 did for
   `handleSetVisionRadius`).
6. **Client send site:** `apps/client/src/features/dm/hooks/useNpcCreation.ts:118`.

### Auto-numbering has no precedent — you are inventing it

Names are the literal string `"New NPC"` today. `"Goblin 3"` in the arc document is an **aspiration,
not existing behaviour**. Grep confirmed: no duplicate-NPC path and no numbering helper exists
anywhere. Decide the rule (suffix the next free integer for that base name? always suffix when
count > 1?) and put it in **shared** if both halves ever need to agree on it — otherwise server-side
next to the loop is fine, since the server owns the create.

### Duplicate-NPC

`apps/client/src/features/dm/components/tab-views/NpcsTab.tsx` (183 LOC) and
`useNpcManagement.ts` (167 LOC) are the surfaces. Duplicate = read an existing NPC's fields and
create one like it; `create-npc` already accepts `portrait` and `tokenImage`, so a duplicate is a
`create-npc` with the source's values and a numbered name. No new message needed.

---

## 5. The other thing in flight, and the e2e baseline

A separate session is fixing `apps/e2e/comprehensive-mvp.spec.ts:32` ("1. Authentication Flow"). It
is a **wrong test, not an app defect**: it asserts the table-password field clears after a rejected
attempt, which the gate does not do by design. It is the **only** reason the nightly
`e2e-full-suite` job is red — verified via the GitHub API: on `main`, scheduled runs #744, #748 and
#756 all failed with `e2e-full-suite` as the sole failing job, on three different commits, while every
`push` run succeeded because the 4-spec smoke set excludes that spec.

**So your e2e baseline depends on whether that task has landed:**

- If it has NOT landed: **82 passed / 1 failed / 3 skipped**, the failure being that spec. Not yours.
- If it HAS landed: expect **83 passed / 0 failed / 3 skipped**. If you see a failure that is not
  that spec, it IS yours.

Get the true tally with `--reporter=list` and read the summary line — the human-readable reporter
sometimes miscounts.

---

## 6. The verification gate — all of it, before every commit

```bash
CI=true pnpm build            # MUST precede typecheck and test
CI=true pnpm typecheck && CI=true pnpm lint && CI=true pnpm lint:structure:enforce && CI=true pnpm format:check
CI=true pnpm test
CI=true pnpm --filter herobyte-client build:check
CI=true pnpm test:e2e --reporter=list
```

`CI=true` matters — pnpm aborts on no TTY here. **Build first is not optional:** the server resolves
`@herobyte/shared` from `dist/` while the client resolves it from `src/`, so a new shared type is
invisible to the server until you rebuild. S8 touches `packages/shared/src/index.ts` if you add
`count` — rebuild after every edit there. **`pnpm lint:structure:enforce` is NOT part of `pnpm lint`.**

### Current baselines at `83b8af07`

| suite         | count                                   |
| ------------- | --------------------------------------- |
| shared        | **410** tests / 22 files                |
| server        | **2009** tests / 108 files              |
| client        | all **43** batches green                |
| client bundle | **92.83 KB** gzip vs a 175 KB threshold |
| e2e           | see §5                                  |

Single file, not the whole suite:

```bash
CI=true pnpm --filter herobyte-client exec vitest run src/path/to/file.test.tsx
CI=true pnpm --filter vtt-server exec vitest run src/path/to/file.test.ts
CI=true pnpm test:e2e --project=mobile-chromium --grep "some name"
```

Note the path is **relative to the package**, not the repo — `pnpm --filter` sets cwd to the package.
Getting this wrong makes every run look broken for the wrong reason.

---

## 7. Traps that will cost you hours

**The 350-LOC guard** flags `content.split("\n").length >= 350`, i.e. `wc -l >= 349`, so **348 is the
real ceiling**. `__tests__` files are exempt; source files are not. It fails only on NEW violators.
`prettier --write` EXPANDS files — re-check LOC after formatting. Live headroom on S8's files:
`MobileLayout.tsx` **347 (one line!)**, `characterValidators.ts` 330 (18),
`CharacterMessageHandler.ts` 316 (32), `Header.tsx` 257 (91), `NpcsTab.tsx` 183,
`useNpcManagement.ts` 167, `useNpcCreation.ts` 138. Already over and baselined (extract, don't grow):
`MainLayoutProps.ts` 432.

**A new `ClientMessage` type is a compile error until you register a validator** in `messageValidators`
(`apps/server/src/middleware/validation.ts:133`) — that table is exhaustive-by-construction. At
runtime an unregistered type returns `"Unknown message type"`. S8 widens an existing message instead,
so this only bites if you add one.

**`router.route()` runs AFTER validation.** A contract test that routes a malformed frame proves
nothing about the validator, because `MessagePipelineManager` validated it first in production.
Validator coverage belongs in `apps/server/src/middleware/__tests__/validation.test.ts`. This gap hid
an untested validator in S5 and cost S6 a debugging detour. **If you add a `count` bound, its test
goes there.**

**`AuthorizationService.requiresDMPrivileges` is dead code.** `isAuthorized` has no runtime caller.
Adding a message type to that Set gates nothing, and its own test asserts hard-coded name lists so you
would create a GREEN test for a gate that does not exist. The real gates are: `executeIfDMAuthorized`
in the dispatcher (what `create-npc` uses), an inline `if (!isDM) throw` in a handler, or an ownership
check in the domain service.

**A new REQUIRED `RoomState` field breaks four server fixtures** that build state literals
(`ws/__tests__/messageRouter.test.ts`, `.../characterization/authorization.characterization.test.ts`,
`.../error-handling.characterization.test.ts`, `ws/services/__tests__/AuthorizationService.test.ts`,
plus `sessionRoundTrip.contract.test.ts`). An OPTIONAL field on a wire message breaks none of them.
Typecheck catches it either way.

**New `MainLayoutProps` fields must be OPTIONAL** or the layout fixtures break. That is the documented
convention — grep `"optional so the layout fixtures stay untouched"`. The fixtures are three
`*.characterization.test.tsx` files (CenterCanvasLayout, FloatingPanelsLayout, TopPanelLayout) plus
`MobileLayout.test.tsx`. `BottomPanelLayout.characterization.test.tsx` declares its own local props
type and is unaffected. **The self-contained header pattern avoids all of this.**

**Windows.** No `kill -9` — use `Stop-Process -Force` or `kill-windows-port.bat`. **Bash heredocs
break on embedded apostrophes and backticks** — write the payload with the Write tool and insert it
with `python <file>`. This will bite you; it bit me twice.

**If you write a Python sabotage harness:** pass `CI` through `env=`, never as a `CI=true` prefix
(`subprocess` with `shell=True` is cmd.exe here, where that prefix is a syntax error and every command
fails for the wrong reason). Force `encoding="utf-8", errors="replace"` or Windows cp1252 crashes the
harness on vitest's output. Strip ANSI before regexing. Use **package-relative** test paths.
Distinguish "N tests failed" from "non-zero exit with no test failure" — a compile error is not a red
test.

**The e2e map canvas is SHORT** — the entities panel takes the bottom half — so a few grid cells at a
zoomed-in camera walks a click clean off it onto the panel. Anchor by canvas FRACTION unless the test
needs an exact world delta.

**The default e2e table is shared between specs AND between runs.** A spec that changes a per-room
setting must establish a known starting point and put it back.

---

## 8. Method the owner expects (these are not optional)

- **Verify before asserting.** An absence is not evidence; exit 0 is not a pass; read the file. If you
  say something is fixed, show the output that proves it.
- **Prove every test can fail.** Break the fix, watch it go red, revert. S7 ran 48 such sabotages;
  **six came back GREEN and five were real test gaps** — and one sabotage was itself defective and
  reported a false GREEN until rewritten. When a sabotage stays green, suspect the test first, but
  check the sabotage too. Watch for a sabotage that goes red _for the wrong reason_ (S7 had one that
  only failed because a method was missing from a stub).
- **Adversarial review before declaring done.** Fan out read-only reviewers by lens (correctness /
  regression / security / test quality / mobile), then a separate pass that tries to REFUTE each
  finding; drop what does not survive. **Check `agents_error` in the completion notification.** S7's
  first review died partway and returned a tidy findings list that looked complete while two whole
  lenses had never run — re-running them found the worst bug in the slice. A dead lens must never read
  as a clean bill of health. Review agents are **read-only**; audit `git status` after any errored run,
  because a past run left a mutation probe in the tree.
- **Fix bugs you find regardless of origin**, each in its own commit where the files allow it. When a
  fix is genuinely inseparable, say so loudly in the commit body rather than burying it.
- **Ship the mobile surface in the same slice** (arc §7a — an owner decision, not a preference).
  Measure it in the browser, do not compute it: S7's mobile claim is backed by measuring all five
  controls at 44px on a real 375×812 viewport, and that same browser check is what caught a control
  that was wired end-to-end and completely unreachable.
- **Do not poll a Workflow or a background agent.** They notify on completion. A wait loop I wrote in
  S7 grepped a marker the journal never writes and spun for 25 minutes for nothing.

---

## 9. Known open items — flagged so you neither rediscover nor "fix" them

- **A player who deletes their ONLY token and reconnects respawns with unlimited sight.** A radius
  lives on one token record while vision is the UNION over all of an owner's tokens; `createToken`
  now inherits the owner's tightest limit, which closes the ordinary "+ Add Character" path but not
  this one, because there is nothing left to inherit from. Closing it needs a **room-level default
  vision radius** — a new required `RoomState` field, four fixtures, persistence and a snapshot field.
  Documented in `token/service.ts` and the arc doc. **This is the strongest candidate for the next
  slice after S8**, and it is probably the feature a DM wants anyway ("this dungeon is dark").
- **The mobile party drawer renders one row per PLAYER** and resolves it to that player's FIRST
  character, so a DM on a phone cannot reach a second character's token at all — HP, portrait and
  sight radius alike. Inherited, not introduced by S7. Fixing it means making that list per-character,
  which belongs to the mobile authoring arc.
- **Client-side `Math.random()` initiative rolls** remain in `hooks/useBulkInitiativeRoll.ts` and
  `features/initiative/components/InitiativeModal.tsx`. Not a forgery hole (both are DM-only paths
  where the DM can set the value directly), but they are the last client-owned randomness.
  `InitiativeModal.test.tsx:692` explicitly pins `Math.random()` as behaviour.
- **The dice parser accepts juxtaposition** (`"d20d6"` → two dice, no operator). Unreachable today —
  there is no free-text formula input anywhere in the UI. It becomes real the moment someone adds one.
- **`+ ADD PORTRAIT` and the NpcCard portrait still use `window.prompt("Enter image URL")`** — URL-only
  secondary paths to fields that already have upload. **S8 touches the NPC surface, so this is the
  natural slice to fold it into if the owner wants it — ASK, do not assume.**
- **Chat's SEND button is a 25px tap target** (guideline 44px). It matches every other JRPGButton in
  those panels, so it wants a deliberate panel-wide pass, not a one-button fix.
- **The asset-store dedup path double-counts existing bytes** against the whole-store quota on a
  cross-room claim. Pre-existing and conservative in direction (refuses too early).
- **`drag-preview` is queued rather than dropped while the socket is down**, so a reconnect can replay
  stale previews. S6 fixed this for `measure` via an `ephemeralTypes` set in `MessageQueueManager` and
  deliberately did NOT change `drag-preview`; the same fix applies if anyone wants it.

---

## 10. Owner decisions — settled, do not re-litigate

- The **Main Hall is a public test table on purpose**, including public DM elevation, and the published
  `Fun1` / `FunDM` fallbacks stay in production. It exists so visitors can try DM-gated features. Do
  not re-flag it as a finding.
- Launch is a **friends-scale soft launch**. Signed session tokens are deferred to a later identity
  arc, so `uid` is client-asserted: secrecy is from the other people at the table, not from someone
  willing to impersonate one. Documented at
  `apps/server/src/domains/room/snapshot/recipientFilter.ts:63-75`. Do not report it as a
  vulnerability.
- **Drawings and area templates are not position-filtered**, by design.
- **Explored fog is client-local and explicitly NOT a privacy boundary** — it can only re-show map ART
  the client already holds. "localStorage can be edited" is not a finding.
- **A radius on an NPC token is inert** and the control was deliberately removed from NPC cards (fog is
  computed per recipient from the tokens that recipient OWNS, and NPC tokens are DM-owned).
- **Fog deliberately does not hide anything outside the published map rect** — staging zones live there.
- Every slice ships its mobile surface in the same slice (arc §7a).

---

## 11. Suggested order of work

1. `git log --oneline -5 && git status --porcelain | grep -v '^?? temp/'` — see whether the
   Authentication-Flow task has landed, and establish your e2e baseline (§5).
2. Read `docs/planning/session-one-arc.md` §0–§2 and `### S8`. The §7 decision questions are already
   answered — do not re-ask them.
3. **Half A, the `?` panel.** Copy `JuiceMenuButton`'s self-contained shape into `Header.tsx`. Bundle
   the guide markdown, link out for images (§3). Mobile entry goes in the tool sheet, dock stays at
   five. Commit.
4. **Half B, the wire shape decision.** Read `useNpcCreation.ts:90-138` first, then choose `count` on
   the message vs N messages, and write the reason down (§4).
5. Implement the server loop and the numbering rule. Validator bound on `count` **with its test in
   `validation.test.ts`, not a router test**.
6. Wire `add ×N` and `duplicate` into `NpcsTab` / `useNpcManagement`, plus their mobile surface.
7. Tests, then sabotage every one. Expect a couple of GREEN-BADs; they are usually real.
8. Full gate, then adversarial review by lens — and **check `agents_error`** before believing the
   verdict.
9. Update `docs/planning/session-one-arc.md`: mark S8 shipped, and note that **the whole Session One
   arc is complete**. Update `docs/user-guide/dm-guide.md` for add-×N and duplicate.
10. Stop. **Do not merge to `main`** — that is the owner's call, and it deploys.

**Done when:** adding five goblins takes five inputs, and a new player can find the manual without
leaving the table.
