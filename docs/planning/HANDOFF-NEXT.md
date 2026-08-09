# Handoff — after S8, with the Session One arc complete

Read this whole file before touching anything. Paths and numbers were verified on 2026-08-05 at
`dev` = `951a3d2a`, and §0 was re-verified on 2026-08-08 after S8's review landed. Where something
is a judgement call rather than a fact, it says so.

## 0. Where things stand

**The Session One arc is DONE.** `docs/planning/session-one-arc.md` is the source of truth.
S0–S7 are in production; **S8 and its review fixes are on `dev` and NOT deployed.**

| Branch | Commit     | State                                                               |
| ------ | ---------- | ------------------------------------------------------------------- |
| `dev`  | `197fb434` | 29 commits on `main`: S8, its 7 review fixes, then the §11 cleanup. |
| `main` | `5307d0dd` | production, deployed, green                                         |

`dev` is pushed and **CI is green on it** — run #765 finished Success in 7m 4s. Nothing has been
merged to `main`, so none of it is deployed.

S8's five commits:

```
951a3d2a docs: S8 shipped, and the Session One arc is complete
201cda89 fix(dm): a whitespace-only NPC name became no name at all
3f22ad08 fix(shared): the barrel cannot declare a runtime const, so stop it doing so
254539d3 feat(dm): five goblins in one press, and duplicate for the sixth
5af9d68c feat(help): a manual you can reach without leaving the table
```

**What S8 shipped.** A `? Help` button in the header opening an eight-topic in-app manual (and a
Help entry in the mobile tool sheet opening the same one), plus a `×N` field beside **+ Add NPC**
and a `⧉ Duplicate` on every NPC card. `create-npc` gained an optional `count`; the server loops
and numbers.

### ✅ S8's adversarial review has now RUN (2026-08-08)

Six lenses over `391676a1..951a3d2a`, each finding refuted by an independent agent (two refuters
for anything claimed high or blocker), then a completeness critic. **70 agents, `agents_error: 0`,
`agents_skipped: 0`, `agents_empty_result: 0`** — so the verdict is trustworthy in the way the
previous run's was not. **53 raw findings, 11 survived**, collapsing to 7 distinct defects once
the lenses that had reached the same bug independently were merged. Every one was reproduced by
hand before being fixed, and all 7 are fixed:

```
56d96bb8 fix(dm): duplicating a hidden NPC put the copy in front of the players
ea4553fc fix(dm): numbering could push a name past the limit, bricking that NPC
4e7fb1ac fix(dm): duplicating a downed NPC failed forever, and blamed a timeout
066204be fix(mobile): the manual stacked with the other sheets instead of replacing them
c2f570a6 fix(mobile): the help sheet's only exit was clipped off the top of real phones
750f11db fix(help): the manual sent DMs looking for a token that was never there
f7d0b38b fix(dm): a goblin numbered past 2^53 wedged the whole server
```

The worst of them was an availability bug, not a UX one: `allocateNpcNames` advanced its candidate
with `next += 1`, which is a no-op at 2^53, so the loop could never terminate — and because
`handleCreateNPC` is synchronous on the socket path, that wedges the single process serving every
table. Reachable because `update-npc` stores a name verbatim, and the Main Hall's DM password is
published on purpose.

**Two findings were refuted that are worth knowing about**, because three lenses each raised them
and the refuters were right both times:

- _"`commitUpdate()` before Duplicate does not prevent the stale copy it claims to prevent."_ The
  hook pair really is order-sensitive — calling `updateNpc` then `duplicateNpc` in one tick sends
  the PRE-edit stats. But it is not reachable through the UI: mousedown on Duplicate blurs the
  field first, `useNpcUpdate` sets `isUpdating` synchronously, and `NPCEditorActions` disables the
  button on it, so the click never lands until the snapshot has round-tripped. Don't re-file it
  without first reproducing it in a browser.
- _"The barrel guard's regex misses other runtime-value forms."_ True as mechanics — `export async
function`, `export enum` and `export abstract class` all emit the same `export declare` erasure
  and all slip past `/^export (const|let|var|function|class) /` (verified by compiling an isolated
  barrel). But `packages/shared/src` contains no enums, no async functions and no default exports,
  and every value export is already the correct re-export form. It is a hardening wish, not a live
  defect — a one-line regex widening if someone wants it.

The completeness critic then listed twelve areas nobody had looked at. All twelve are now
closed — see §11.

The working tree is clean apart from untracked files under `temp/`. Those are the owner's local
art assets. **Never `git add temp/` and never `git add <directory>`** — a broad add swept them
into main once before, and untracking them then deleted them off disk. Stage files explicitly by
path, always.

**Commit policy, unchanged and confirmed:** commit to `dev` as you go. **Do not push, and do not
merge to `main`, unless the owner asks.** `main` IS production and auto-deploys the moment it
moves — Render watches `main` from its own dashboard, so the deploy is NOT gated by CI
(`DEPLOYMENT.md:24-26`).

## 1. Running it

```bash
pnpm install
pnpm dev          # client http://localhost:5174, server http://localhost:8787
```

Table password `Fun1`, DM password `FunDM`. Default table is the public "Main Hall". DM elevation
from a console (dev/test builds only):

```js
window.__HERO_BYTE_E2E__.sendMessage({ t: "elevate-to-dm", dmPassword: "FunDM" });
```

`pnpm dev` sets `HEROBYTE_DEV_ALLOW_LAN=true`, so a phone on the same Wi-Fi can reach the Network
URL Vite prints. Never use Bash to run dev servers — use the Browser pane's `preview_start`;
`.claude/launch.json` really does define `server` and `client` (it is at the REPO ROOT, so a
`cat .claude/launch.json` from inside a package will tell you it does not exist).

## 2. The verification gate — all of it, before every commit

```bash
CI=true pnpm build            # MUST precede typecheck and test
CI=true pnpm typecheck && CI=true pnpm lint && CI=true pnpm lint:structure:enforce && CI=true pnpm format:check
CI=true pnpm test
CI=true pnpm --filter herobyte-client build:check
CI=true pnpm test:e2e --reporter=list
```

`CI=true` matters — pnpm aborts on no TTY here. Build first is not optional: the server resolves
`@herobyte/shared` from `dist/` while the client resolves it from `src/`.
`pnpm lint:structure:enforce` is **NOT** part of `pnpm lint`.

**And one thing the gate cannot see — boot the dev server.** See §7.

### Baselines at `7c780642` (re-measured 2026-08-09)

| suite         | count                                | at `951a3d2a` (pre-review) |
| ------------- | ------------------------------------ | -------------------------- |
| shared        | 414 tests / 23 files                 | 411                        |
| server        | 2057 tests / 109 files               | 2042                       |
| client        | all 43 batches green                 | 43 batches                 |
| client bundle | 96.89 KB gzip vs a 175 KB threshold  | 96.75 KB                   |
| e2e           | **97 passed / 0 failed / 3 skipped** | same                       |

The client is back to 43 batches: the fixes added test files (44), then deleting
`useNpcManagement`'s 709-line suite took one away again. E2E was 83 before S8's 14 new specs
(4 desktop help, 5 mobile help, 5 bulk-NPC) and is unchanged by any of the fixes — worth noting,
because it is also the suite that does not run on a push (§11). Get the true tally with
`--reporter=list` and read the summary line — the human-readable reporter miscounts.

**`characterValidators.ts` is now at exactly 348**, the ceiling. Anything added there needs an
extraction first.

Single file, not the whole suite. **The path is relative to the PACKAGE, not the repo** — `pnpm
--filter` sets cwd to the package, and getting this wrong makes every run look broken for the
wrong reason:

```bash
CI=true pnpm --filter herobyte-client exec vitest run src/path/to/file.test.tsx
CI=true pnpm --filter vtt-server exec vitest run src/path/to/file.test.ts
CI=true pnpm test:e2e --project=mobile-chromium --grep "some name"
```

## 3. What to do next — the field is open

The arc is complete, so there is no queued slice. In rough order of how strongly the code argues
for them:

### A. ~~Re-run S8's adversarial review~~ — DONE 2026-08-08, see §0

All seven surviving defects are fixed and committed. The next decision is the owner's: B, C or D
below. **Nothing here is queued** — this is a genuine fork, not a backlog.

What is still open from the review is §11, the completeness critic's list of things NOBODY looked
at. None of it is a known defect; it is unexamined ground.

### B. A room-level default vision radius (~2 days) — the strongest feature candidate

S7 left this open deliberately and it is still the best next slice. A player who deletes their
ONLY token and reconnects respawns with **unlimited sight**: a radius lives on one token record
while vision is the UNION over all of an owner's tokens, and `createToken` inherits the owner's
tightest limit, which closes the ordinary "+ Add Character" path but not this one, because there
is nothing left to inherit from. Documented in `domains/token/service.ts` and the arc doc.

Closing it needs a room-level default: a new **required** `RoomState` field, persistence, a
snapshot field, and four server fixtures that build state literals (see §7). It is also probably
the feature a DM wants anyway — "this dungeon is dark" as a table setting rather than per token.

### C. The mobile authoring arc (`docs/planning/mobile-authoring-arc.md`, M3–M8)

A launch commitment, and the arc doc says it runs AFTER Session One — which is now. Two known
mobile gaps feed straight into it:

- **The mobile party drawer renders one row per PLAYER** and resolves it to that player's FIRST
  character, so a DM on a phone cannot reach a second character's token at all — HP, portrait and
  sight radius alike. Fixing it means making that list per-character.
- **There is no mobile DM menu at all.** Mobile renders `MobileLayout`, which never reaches
  `FloatingPanelsLayout`, which is the only thing that renders `DMMenu`. That is why S8's bulk-add
  is desktop-only. It was explicitly out of Session One's scope (§6), not an oversight.

### D. Smaller, real, and unclaimed

- **`+ ADD PORTRAIT` and the NpcCard portrait still use `window.prompt("Enter image URL")`** —
  URL-only secondary paths to fields that already have upload. S8 touched the NPC surface and did
  NOT fold this in. Ask the owner before doing it.
- **Chat's SEND button is a 25px tap target** (guideline 44px). It matches every other JRPGButton
  in those panels, so it wants a deliberate panel-wide pass, not a one-button fix.
- **Client-side `Math.random()` initiative rolls** remain in `hooks/useBulkInitiativeRoll.ts` and
  `features/initiative/components/InitiativeModal.tsx`. Not a forgery hole (both are DM-only paths
  where the DM can set the value directly), but they are the last client-owned randomness.
  `InitiativeModal.test.tsx:692` explicitly pins `Math.random()` as behaviour.
- **The dice parser accepts juxtaposition** (`"d20d6"` → two dice, no operator). Unreachable
  today — there is no free-text formula input anywhere in the UI. It becomes real the moment
  someone adds one.
- **`drag-preview` is queued rather than dropped while the socket is down**, so a reconnect can
  replay stale previews. S6 fixed this for `measure` via an `ephemeralTypes` set in
  `MessageQueueManager` and deliberately did NOT change `drag-preview`; the same fix applies.
- **The asset-store dedup path double-counts existing bytes** against the whole-store quota on a
  cross-room claim. Pre-existing and conservative in direction (refuses too early).
- **A background-task chip is already queued** for wiring `characterDrawings.ts` to the shared
  `DRAWING_TYPES` instead of its hand-copied `VALID_DRAWING_TYPES` (see §7).

## 4. What S8 actually built, if you have to touch it

**The help panel.** `features/help/helpTopics.ts` (content as DATA), `HelpPanel.tsx` (renderer,
shared by both surfaces), `HelpMenuButton.tsx` (desktop, self-contained — no props, so it never
touches `MainLayoutProps` or its four layout fixtures). The mobile entry lives in
`MobileFloatingControls.tsx` and owns its own `helpOpen` state, because `MobileLayout.tsx` is at
**347 of a 348 ceiling** and lifting it would have cost an extraction for no gain.

Content decision, owner-made 2026-08-05: **curated in-app prose + links out to the guides on
GitHub**, not the guide markdown itself. `docs/user-guide/` is outside `apps/client` (what Pages
builds), its `img/` is **4.8 MB across 36 screenshots**, and the client has no markdown renderer —
so "bundle the guides" meant a new runtime dependency or a hand-written renderer for one panel.
Cost as built: 92.83 → 96.75 KB gzip. **If a slice changes behaviour the manual describes, update
`helpTopics.ts` in the same slice** — it is not generated from the guides and will drift.

**Bulk NPC add.** The chain, all verified: `packages/shared/src/index.ts` (the `count` field) →
`packages/shared/src/npcLimits.ts` (`NPC_CREATE_LIMITS`, max 20) →
`middleware/validators/characterValidators.ts` (bounded; its test is in
`middleware/__tests__/validation.test.ts`, NOT a router test) → `ws/dispatchers/CharacterDispatcher.ts`
→ `ws/handlers/NPCMessageHandler.ts` (the loop + the 500-character ceiling) →
`domains/character/npcNaming.ts` (the naming rule).

**Why `count` rides on ONE message** — this is the part not to undo. `useNpcCreation` refuses to
start a second create while one is in flight and only `console.warn`s about it, and it detects
success by watching the character COUNT against a ref. So N client messages are silently dropped
by the app's own guard, and it presents as a flaky server rather than a client bug.

**Duplicate needs no message of its own**: the server already renumbers a colliding name, so a
copy is a `create-npc` whose base name is the original's.

## 5. Traps that will cost you hours

**The 350-LOC guard** flags `content.split("\n").length >= 350`, i.e. `wc -l >= 349`, so **348 is
the real ceiling**. `__tests__` files are exempt; source files are not. It fails only on NEW
violators. `prettier --write` EXPANDS files — re-check LOC after formatting. Live headroom on
files near the line, re-measured 2026-08-09 after the §11 cleanup. **Three are within one line of
the ceiling** — `characterValidators.ts` **348**, `MobileLayout.tsx` **347**, `useDMContext.ts`
**347** — so any of them needs an extraction before it gains anything at all. Then
`NPCEditor.tsx` 333, `helpTopics.ts` 301, `Header.tsx` 262, `NPCsTab.tsx` 235,
`MobileFloatingControls.tsx` 223, `HelpMenuButton.tsx` 153. Already over and baselined (extract,
don't grow): `layouts/props/MainLayoutProps.ts` 432, `domains/character/service.ts` 376.

This bit three times in two days, always the same way — a comment explaining WHY a change was made
is what crosses the line. A validator comment pushed `characterValidators.ts` to 351 and had to be
cut back; a five-line comment on a one-line type guard pushed `useDMContext.ts` to 353; and the
hidden-NPC fix went into `NPCMessageHandler` rather than `createCharacter` partly because the
alternatives were full. The way out is the same each time: the reasoning goes in the commit message
and the test (tests are exempt), and the code keeps one line.

**A new `ClientMessage` type is a compile error until you register a validator** in
`messageValidators` (`middleware/validation.ts`) — that table is exhaustive-by-construction. At
runtime an unregistered type returns "Unknown message type". Widening an EXISTING message (what
S8 did with `count`) avoids this entirely.

**`router.route()` runs AFTER validation.** A contract test that routes a malformed frame proves
nothing about the validator, because `MessagePipelineManager` validated it first in production.
Validator coverage belongs in `middleware/__tests__/validation.test.ts`. This gap has now cost
three separate slices a debugging detour.

**`AuthorizationService.requiresDMPrivileges` is dead code.** `isAuthorized` has no runtime
caller. Adding a message type to that Set gates nothing, and its own test asserts hard-coded name
lists, so you would create a GREEN test for a gate that does not exist. The real gates are
`executeIfDMAuthorized` in the dispatcher (what `create-npc` uses), an inline `if (!isDM) throw`
in a handler, or an ownership check in the domain service.

**A new REQUIRED `RoomState` field breaks four server fixtures** that build state literals
(`ws/__tests__/messageRouter.test.ts`, `.../characterization/authorization.characterization.test.ts`,
`.../error-handling.characterization.test.ts`, `ws/services/__tests__/AuthorizationService.test.ts`,
plus `sessionRoundTrip.contract.test.ts`). An OPTIONAL field on a wire message breaks none of them.
Typecheck catches it either way. **This is the main cost of option B above.**

**New `MainLayoutProps` fields must be OPTIONAL** or the layout fixtures break — grep
`"optional so the layout fixtures stay untouched"`. The self-contained header pattern
(`JuiceMenuButton`, now `HelpMenuButton`) avoids all of this.

**`getByRole` matches the ACCESSIBLE NAME, not `title`.** A locator built on a `title` string
finds nothing and times out looking like an app bug. And `new RegExp(someTitle)` breaks on a title
containing `(DM)` — the parens become a capture group. Prefer the exact accessible-name string.

**A scrolling panel's controls are legitimately off-screen.** "Every control on screen at once" is
the _drawing toolbar's_ invariant because it cannot scroll; for a scrolling sheet assert
reachable-by-scrolling instead, and assert separately that the CLOSE control never scrolls away.

**E2E specs that create NPCs must delete them.** The default table is shared between specs AND
between runs, and characters cap at 500. `apps/e2e/npc-bulk-add.spec.ts` shows the pattern:
snapshot the ids before, `try/finally` a cleanup that deletes only what appeared.

**The e2e map canvas is SHORT** — the entities panel takes the bottom half — so a few grid cells
at a zoomed-in camera walks a click clean off it onto the panel. Anchor by canvas FRACTION unless
the test needs an exact world delta.

**A synchronous infinite loop cannot be caught by a test timeout.** vitest's per-test timeout needs
the event loop, and a `while` loop that never yields never gives it back — the first version of the
2^53 test did not go red, it hung the runner for 90 seconds and then died to an external `timeout`.
In CI that is a stalled job, not a failure. If you fix a potential-hang, **also make the loop
structurally bounded** so a regression returns a wrong value that a test can assert on. That is why
`allocateNpcNames` has both a safe-integer reset and an attempt ceiling; only the first is the fix.

**Every browser you can test in makes `vh`, `dvh` and `svh` identical.** Playwright's fixed viewport
does, and so does the in-app browser pane at any size — measured, `100vh === 100dvh === 100svh ===
innerHeight`. So a bug caused by mixing viewport units is invisible to the e2e suite, to jsdom, AND
to looking at it in the preview. To see one, force the container to a realistic small-viewport
height (`element.style.height` AND `min-height`, since `.mobile-layout-root` pins `min-height:
100svh` and it will otherwise win) while the cap still resolves against the large viewport. That is
what turned "the sheet looks fine" into "its close button is at −57px".

**You cannot push `.github/workflows/*`.** Git here uses Git Credential Manager over HTTPS, and the
stored token is an OAuth-app token issued WITHOUT the `workflow` scope. GitHub then refuses the
whole ref update — not just that file — with `refusing to allow an OAuth App to create or update
workflow ... without workflow scope`. **The owner hits the identical rejection from their own
PowerShell**, because it is the same cached credential, so "just push it yourself" is not a fix.
What works: put the workflow commit LAST, `git push origin HEAD~1:dev` to land everything else,
and have the owner paste the change into GitHub's web editor (the browser session is not bound by
the token's scopes). Watch for the web editor auto-indenting the first line of a pasted comment
block — harmless in YAML, but it will not match your local copy byte-for-byte.

**Windows.** No `kill -9` — use `Stop-Process -Force` or `kill-windows-port.bat`. Bash heredocs
break on embedded apostrophes and backticks; write the payload with the Write tool and run it with
`python`. **The Bash tool's cwd PERSISTS between calls** — a `cd apps/client` in one call silently
changes where the next `ls`, `cat` or `grep` runs, which will make a file that exists look missing.

**If you write a Python sabotage harness:** pass `CI` through `env=`, never as a `CI=true` prefix
(subprocess with `shell=True` is cmd.exe here, where that prefix is a syntax error and every
command fails for the wrong reason). Force `encoding="utf-8", errors="replace"` or Windows cp1252
crashes the harness on vitest's output. Strip ANSI before regexing. Use package-relative test
paths. Distinguish "N tests failed" from "non-zero exit with no test failure" — a compile error is
not a red test. Working harnesses from S8 are in this session's scratchpad (`sabotage_a.py`,
`sabotage_b.py`) and are worth copying rather than rewriting.

## 6. Layout traps S8 paid for, which will recur

**A fixed container with a `z-index` is a STACKING CONTEXT.** The header is `position: fixed;
z-index: 100`, so a popover rendered inside it cannot paint above the entities panel — a later
sibling at the same z-index — no matter what z-index the popover itself claims. The 500px help
panel lost its bottom half to a panel drawn over it, and every unit test was green because jsdom
computes no layout. **Portal any tall popover to `document.body`.** `JuiceMenuButton` never
noticed because it is a few rows tall; it is still in-place and still fine.

**A vh height and a dock offset do not know about each other.** The mobile help sheet's height
came from a vh fraction while its position came from `bottom: calc(safe + dock + 22px)`. At
812×375 the shared 82vh landscape cap (307px) plus a 102px offset made a 409px sheet in a 375px
viewport, putting its header — and the ✕ that is the only way to close it — 34px above the top of
the screen. **Derive the height FROM the same offset** so "it fits" is arithmetic, and exclude the
sheet from the shared landscape `max-height` override or that will put it back. A long sheet also
needs `position: sticky` on its header, or the close button scrolls away.

Both bugs were invisible to jsdom and to reading the code. `apps/e2e/mobile/mobile-help.spec.ts`
and `apps/e2e/help-panel.spec.ts` now guard them; the desktop one hit-tests
`document.elementFromPoint` inside the panel, which is the assertion that actually catches
occlusion.

## 7. The trap that no test can see — read this before adding a shared constant

**`packages/shared/src/index.ts` must never declare a runtime `const`.**

A direct `export const` in the barrel compiles to `export declare const` in `dist/index.d.ts`,
which is what `apps/server/tsconfig.json` maps `@herobyte/shared` to and what tsx honors **at
runtime** — where an ambient type declaration has no value to import. A value RE-EXPORT from a
real sub-module (`export { X } from "./x.js"`) is followed through to the compiled `.js`.

Adding `NPC_CREATE_LIMITS` to the barrel meant **`pnpm dev` could not boot at all**
(`SyntaxError: does not provide an export named 'NPC_CREATE_LIMITS'`) while `pnpm build`,
`pnpm typecheck`, `pnpm lint`, all three unit suites AND the full 97-test e2e suite were green.
Each of those resolves the package by a route that skips the mapping. Nothing in §2 can see it.

`packages/shared/src/__tests__/barrelValueExports.test.ts` now fails on any top-level
`export const|let|var|function|class` in the barrel and quotes the offending line. **Types are
fine; only runtime values break.** Put the constant in its own module and re-export it —
`npcLimits.ts`, `drawingTypes.ts`, `wsCloseCodes.ts`. **After adding any shared constant, boot the
dev server once.**

Noticed while fixing this and deliberately NOT folded in (a chip is queued for it):
`DRAWING_TYPES` has no importers at all, while `apps/client/src/utils/characterDrawings.ts`
hand-maintains its own `VALID_DRAWING_TYPES` copy of the same six strings — and
`playerPersistence.test.ts:84` already warns in a comment that a missing entry there silently
turns a cone into something else.

## 8. Method the owner expects (these are not optional)

- **Verify before asserting.** An absence is not evidence; exit 0 is not a pass; read the file. If
  you say something is fixed, show the output that proves it. §7 is the strongest example this
  repo has produced: five green suites and a completely broken dev server.
- **Prove every test can fail.** Break the fix, watch it go red, revert. S8 ran 42 sabotages; one
  came back GREEN and it was a genuine finding about unreachable code. When a sabotage stays green,
  suspect the test first — but check the sabotage too, and watch for one that goes red for the
  wrong reason.
- **Probe edges empirically rather than re-reading.** Running S8's name allocator against
  whitespace, padded numbers and unicode found a regression that reading it twice had not.
- **Adversarial review before declaring done — and check `agents_error`.** A review that never ran
  returns the same shape as a clean one. S7's died partway and looked complete; S8's died entirely
  and returned `{rawCount: 0}`. Review agents are read-only; audit `git status` after any errored
  run, because a past run left a mutation probe in the tree.
- **Fix bugs you find regardless of origin**, each in its own commit where the files allow it.
  When a fix is genuinely inseparable, say so loudly in the commit body rather than burying it.
- **Ship the mobile surface in the same slice** (arc §7a — an owner decision). Measure it in the
  browser, do not compute it. If a feature genuinely has no mobile surface, say WHY in the commit
  rather than leaving it unmentioned.
- **Do not poll a Workflow or a background agent.** They notify on completion.

## 9. Owner decisions — settled, do not re-litigate

- The Main Hall is a **public test table on purpose**, including public DM elevation, and the
  published `Fun1` / `FunDM` fallbacks stay in production. Do not re-flag it as a finding.
- Launch is a **friends-scale soft launch**. Signed session tokens are deferred to a later identity
  arc, so `uid` is client-asserted: secrecy is from the other people at the table, not from someone
  willing to impersonate one. Documented at
  `domains/room/snapshot/recipientFilter.ts:63-75`. Not a vulnerability.
- Drawings and area templates are **not position-filtered**, by design.
- **Explored fog is client-local and explicitly NOT a privacy boundary** — it can only re-show map
  ART the client already holds. "localStorage can be edited" is not a finding.
- A radius on an **NPC** token is inert, and the control was deliberately removed from NPC cards.
- Fog deliberately does not hide anything outside the published map rect — staging zones live there.
- Every slice ships its mobile surface in the same slice (arc §7a).
- **The mobile dock stays at five buttons.** `theme/herobyte.css` pins it to
  `repeat(5, minmax(0, 1fr))` and a sixth child overlaps rather than wraps. That is why chat became
  a tab in the roll log, why the dice options went inside the roller, and why S8's Help went in the
  tool sheet. `MobileFloatingControls.test.tsx` now pins it.

## 10. Suggested order of work

1. `git log --oneline -6 && git status --porcelain | grep -v 'temp/'` — confirm you are at
   `7c780642` with a clean tree. (Use `grep -v 'temp/'`, not `grep -v '^?? temp/'`: three of the
   owner's untracked files have spaces in their names, so git quotes them and the anchored form
   misses them.)
2. Run the full gate once (§2) to establish that the baselines in this document still hold, and
   **boot `pnpm dev`** (§7).
3. Ask which of §3B / §3C / §3D they want next. The arc is complete, its review is closed and §11
   is fully cleared, so this is a genuine fork, not a queue — there is nothing queued at all.
4. Stop before merging to `main`. That is the owner's call, and it deploys.

## 11. The completeness critic's list — CLEARED 2026-08-09

Twelve areas nobody had examined. Four were investigated by a read-only agent fan-out, the rest by
hand. **Ten are closed; two are waiting on the owner.** Nothing here was a defect found by testing
— these were places no lens had looked, and several turned out to be fine.

### Both owner decisions are now made, applied, and VERIFIED IN CI (2026-08-09)

- **The full e2e suite runs on push and pull_request.** The `if:` gate on `e2e-full-suite` is gone;
  the nightly cron stays as a backstop. `e2e-smoke-tests` is now a strict subset, kept only for the
  faster first signal — dropping it later costs no coverage.

  Confirmed from the runs themselves, not assumed. Run **#764** (before): `e2e-full-suite` **skipped**,
  no `playwright-report-full` artifact, 7m 32s total. Run **#765** (after): that job **succeeded in
  3m 55s**, the artifact exists, and its log reads `97 passed (3.1m)` / `3 skipped` — matching a
  local run exactly. S8's own specs ran in CI for the first time ever, including
  `npc-bulk-add.spec.ts › five goblins take five inputs`, the test its commit message cited as the
  verification.

  **The CI-minutes worry was misplaced, and this settles a question §11 used to raise.** #765's total
  wall-clock was 7m 4s — SHORTER than #764's 7m 32s — because `e2e-full-suite` has no `needs:` and
  runs in parallel with the test matrix, finishing inside a window that was already occupied. So do
  NOT "fix" it by adding `needs: lint-and-build`: that would serialize it and make every run slower,
  to save a runner on a branch that does not compile.

- **`useNpcManagement.ts` and its 709-line suite are deleted.** Verified caller-less first: the only
  references anywhere were a stale git worktree, generated coverage artifacts, and historical docs
  (`DONE.md`, `docs/refactoring/REFACTOR_ROADMAP.md`, `HANDOFF-S8.md`), which are records of when it
  was written and are left as they are.

### Closed

| area                       | outcome                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `DRAWING_TYPES` unused     | deduped — the sanitiser imports it; a subset copy used to compile green |
| barrel guard is a proxy    | now also asserts against built `dist/index.d.ts`                        |
| `SNAPSHOT_LIMITS` dual use | second consumer documented and pinned by a test                         |
| `count` into constructor   | call site narrowed to a literal; excess-property check restored         |
| `duplicateNpc` type guard  | added; the asset-sharing half was refuted (see below)                   |
| popover re-anchoring       | ResizeObserver on the button, not just `window.resize`                  |
| dm-guide structure         | three controls un-orphaned; screenshot re-recorded                      |
| guide links                | existence now asserted; branch deliberately left at `main`              |
| bulk initiative vs limiter | batched at 80/window — the real bound was 500, not 20                   |
| sticky `countInput`        | behaviour pinned; the false "can never disagree" comment corrected      |

### Two claims that were refuted, and should not be re-filed

- **Duplicate does NOT multiply image storage.** Uploads are content-addressed to
  `/assets/<sha256>` and ownership is a SET of rooms, not a per-character reference — so copies
  share one file and reclaim is per-room. Duplicate is cheap by design.
- **The popover was not leaking its resize listener.** Cleanup already removed it. The observer
  added for the re-anchor fix is the thing that could leak, so its teardown is now asserted.

One correction to what this document said before: it suggested wiring
`scripts/smoke-server-start.mjs` into the gate as the fix for the barrel-guard gap. That would not
have worked. The script runs the COMPILED server under plain node, which resolves
`@herobyte/shared` through `node_modules` to `package.json` "main" (`dist/index.js`) and never
consults the tsconfig path mapping — so it cannot see this bug class at all. Asserting against
`dist/index.js` fails for the same reason, and worse: under the S8 bug the value really was present
in the emitted `.js`. Only `dist/index.d.ts` shows the erasure. Wiring the smoke script up is still
worth doing one day, for boot failures in general — just not for this.
