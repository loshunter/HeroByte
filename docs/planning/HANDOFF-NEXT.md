# Handoff — after S8, with the Session One arc complete

Read this whole file before touching anything. Paths and numbers were verified on 2026-08-05 at
`dev` = `951a3d2a`; §0 was re-verified on 2026-08-08 after S8's review landed, on 2026-08-12 after
the vision-default slice shipped, and on **2026-08-18** when the loose-ends batch went to
production. Where something is a judgement call rather than a fact, it says so.

## 0. Where things stand

**Update (2026-09-20, ON `dev` — the connection-closing slice, awaiting the deploy decision).**
The session-identity-binding deploy (main `2b7fe39e`) found that Render's proxy rewrites every
server-sent WebSocket close code to 1005, so the client's 4002/4003 branches never fired live: two
tabs of one browser took the seat from each other every 2 s (since July), and the new "Held in
another window" gate never showed. The slice makes the server announce an intentional close with a
`{ t: "connection-closing", reason }` data frame before the close, and the client go terminal on
the frame (arc plan §14.1 has the full record). Gated: the full ladder green on the final tree
(counts in the commit message), three review rounds (round 3: the conflict copy failed once more
and was rewritten and pinned after the round; the server/tests/docs and script lenses passed), a
live two-client browser pass, and a new post-deploy check — `pnpm check:live-session -- --url
wss://<host>` with `HEROBYTE_ROOM_SECRET` set — which is the only thing that can see the proxy
hop. Run it against production right after the merge deploys.

**Update (2026-09-18, DEPLOYED — the SECOND UX-audit repair slice is IN PRODUCTION).** `main` =
`50472bca`, a `--no-ff` merge of `dev` at `73697c22` (14 commits). CI: dev **#881** green; the main
run was watched. Five audit findings shipped: UX-04 (both modals portal out of EntitiesPanel's
`position: fixed; zIndex: 100` stacking context), UX-06 (the inspector fits its 200-260px palette),
UX-07 (a structural sniffer names a wrong-kind backup locally instead of letting it become a server
timeout), UX-08 (entry camera: own token, else the party staging zone, else nothing — never the
scene middle), UX-11 (the chat composer sits inside the roll-log window).

**Deploy verified, discriminating probe.** Across all 11 served chunks, three strings new to this
slice went 0 hits → 1 hit each (`top-left of your view`, `not a table backup`, `could not be read or
applied`) while two controls present in both commits held at 1 (`No rolls yet`, `No messages yet`).
Server 200 on `/` and `/healthz` after a ~30 s Render swap window. Functional check on production:
the chat panel computes `border-box` and SEND sits **17 px inside** the window — it was 5 px past
the edge before. **Players with a tab already open must reload.**

**Verification ladder:** gates green four times (client 5976 tests, e2e 210 passed / 0 failed);
evaluate-live **8.8/10, live-two-client**; **three adversarial review rounds**, both final-round
lenses PASS. The review found what the gates could not: a user-reachable crash introduced while
fixing a gate failure (a file containing `null` threw, and `.then(fn, onRejected)` swallowed it into
silence), six tests that could not fail, a latch break expressible only as a HUNG CI worker, a
confounded CSS measurement behind a "corrected" comment, and ~15 false claims in comments and the
user guide.

**Recorded, not fixed (owner's call):** a player running TWO characters gets no entry recentring —
`ownTokenFallback` answers only for exactly one pc, an earlier settled rule that was not overturned;
`handleFocusSelf` is still unwired and still uses the naive `owner === uid` test; a map document the
server refuses still leaves no visible outcome (pre-existing). **17 of the original 26 audit
findings remain open** — the report is at `output/ux-audit-2026-09-16/UX-AUDIT.md`, which is
gitignored, so copy it into `docs/verification/` to keep it.

**Update (2026-09-14, DEPLOYED — FOLLOW-UP F4 IS IN PRODUCTION; the Weighed Campaign arc is
on `dev`).** The owner's three calls: merge F4 on the plateau record (done), leave the recorded
affordance/camera-follow/`role="tab"` items recorded, and start the Atlas §7 pick on the
recommendation — the byte-weighed mint path. `dev` = `main` = **`8e104dc4`** (from `c3b13676`,
the nine F4 commits), both pushed 2026-09-14; **CI #867 (dev) and #868 (main) green**. Gated
first by the full ladder (197 e2e, 0 failed; dev boot clean) and a live two-client check on a
local dev server: the player's bare ArrowRight with nothing selected sent exactly ONE
`step-object` and the token went from cell 20 to 21 in the player tab AND the DM tab; ⚔️ Focus
(inside the scrolling party panel) then ArrowLeft stepped it back — round 3's exact case.
Deploy probe-verified across all served chunks: entry bundle `index-DU0TBtuF` → `index-DLos7Gc5`;
the discriminating string "the keys move your own token" (the help entry; absent at
`c3b13676`, present at `8e104dc4`) reads 1 hit in the new bundle and 0 in the old, controls
`Apply Portrait` / `step-object` present in both; Render 502 for ~50 s on restart, then
`/health` 200. Players there must reload. NEXT: `export-weight-arc-plan.md` (W0–W2 on `dev`,
see its update below when it lands).

**Update (2026-09-13, later — FOLLOW-UP F4 on `dev`, ~~NOT merged to `main`~~ IN PRODUCTION 2026-09-14, see above: nothing selected →
your own token; three review rounds, the cap — THE OWNER DECIDES ON THE RECORD).** The one
item-4 leftover the owner queued. With an EMPTY selection the movement keys move the actor's own
token: `ownTokenFallback` (the pure half of `features/movement`) names the ONE `pc` character
owned by the uid — its linked `tokenId` when the snapshot has that token (a link to a stashed
token answers nothing), else the ONE token of theirs that NO character claims (`looseOwnToken`,
`utils/`, shared with the party panel and the phone list — an NPC token carries the placing DM's
uid and is linked to its NPC by every client-driven road; round 1's critical: "owned by me" alone
handed a DM a goblin); zero or two-plus PCs, or two loose tokens, or a claim by someone else's
character → nothing. The id takes a click's road through `movableSelection` and map-edit zeroes
it; a non-empty selection the actor may not move is NOT "nothing". The fallback road — never the
selected one — yields a key only to a surface that would USE it: a typing surface or a focused
arrow widget keeps every movement key, a focused BUTTON keeps none, ↑/↓ page the panel the player
last clicked INTO or wheeled over (the hook pages it — the browser has no focused target; a click
on a control never arms the panel around it, ⚔️ sits inside the scrolling party panel; measured
at the press; ←/→, the letters and the numpad never page), `composingTool` (draw / align /
atlas-link — from `App.tsx`) owns the keys selection or not (a deselect is now optimistic in
`useObjectSelection`), and `selectionTool` (select / transform) owns an empty selection. Nothing
yields on a fresh join; the plain cursor never holds a selection. Wire unchanged. Keyboard-only in
effect: the phone's d-pad needs the selection sheet, which needs a selection — pinned. Copy: the
help entry's Move term, 465 chars (one character; not while typing; ↑/↓ page a panel last clicked
into or scrolled; SELECT/TRANSFORM move only the picked piece; ✏️ Draw, the grid-alignment wizard
and atlas-link take the keys; TOOLS → □ Select → tap on a phone), the budget material moved to
"Combat starts"; the player guide likewise, its phone section carrying the d-pad road. Fixed on
the way, own commits: (a) the reconnect re-token — `CharacterService.ensureToken` (kept when
linked and live or stashed; a DEAD link cleared and re-tokened; adopted when exactly one own token
is loose AND the owner runs one PC; else spawned; `findTokenByOwner` deleted), the auth road
ensuring EVERY owned PC; (b) the party panel and the phone list's by-owner fallbacks →
`looseOwnToken`; (c) the optimistic deselect. Pinned by 9 rule, 27 hook blocks (37 instances),
1 selection, 1 App, 4 precedent, 1 phone, 3 e2e, 12 + 2 server cases; sabotage 10/10, 14/14,
19/19, 19/19 (12 at the hook and its App threading, 1 at the selection hook, 1 at the phone list, 4 on the server, 1 under the e2e spec — its three F4 cases red, the three others green) across the four passes (every one on its named case), sources restored
byte-identical; both real typechecks and the structure guard clean; live-checked with two clients
after rounds 1 and 2 (the server log's send counts are the evidence; the fresh-table e2e is the
landing evidence). **Review: round 1 (1 / 8 / 11) → round 2 (0 / 7 / 17) → round 3 (0 / 7 / 20)
deduplicated, every lens FAIL each round, the count never dropping — the plateau rule at the
cap: no round 4, every finding fixed or recorded in the plan's three round records, and THE OWNER
DECIDES on the record.** Open owner calls recorded there: an on-screen affordance (a persistent
"WASD moves <name>" hint, not a toast) + a desktop camera follow; `role="tab"` on the DM menu's
and the log's tab strips. Plan section "Follow-up F4" in `keyboard-movement-arc-plan.md`. NEXT
after the owner's call: the Atlas §7 pick (asked 2026-09-13); the other three item-4 leftovers
stay unqueued.

**Update (2026-09-13, DEPLOYED — F1, F2 and F3 are IN PRODUCTION).** The owner said merge.
`dev` fast-forwarded to `main` as `41ca0106` (from `e42d60bf`, nineteen commits: the three
follow-ups, the thirteen bugs fixed regardless of origin, two test-hygiene commits and the
2026-09-10 deploy record), both branches pushed 2026-09-13 and synced. Gated first by the full
ladder (194 e2e passed, 0 failed; 8,578 unit tests; dev boot clean). Deploy probe-verified across
all 10 served chunks (1,186 KB): the entry bundle went `index-Biz0-AXd` → `index-DU0TBtuF`; the
discriminating strings `reset-movement-budget` (absent from the client at `e42d60bf`, present at
`41ca0106`) read 2 hits (1 in the entry bundle, 1 in `lazy-entry-DKFouw49`) and `Reset movement
budget` 1, the controls `Apply Portrait` / `Portrait Image URL` 2 each and `step-object` 1,
`/health` 200 on Render. CI run #863 green, `e2e-full-suite` step `success` (not skipped). The
prod functional check of the server half (a DM reset at a real table, a DM's rolled character
taking a turn) needs the prod DM password the owner holds and was NOT run. Players there must
reload. The owner's next calls, decided the same day: from the follow-ups prompt's item-4 list,
ONLY the pointer-mode "nothing selected → your own token" WASD fallback (the other three stay
unqueued); and one Atlas §7 item starts next (the owner's pick — see the later update).

**Update (2026-09-11 — FOLLOW-UP F2 on `dev`, NOT merged to `main`: a DM reset-budget control;
the budget stays ADVISORY).** The owner's call ("it's a VTT, not an RPG game"): no enforcement —
a red readout is a note, not a wall, and the overspending specs stay. The DM's one lever besides
the turn is a RESET: `reset-movement-budget { characterId }`, DM-only like the speed, routed to
its own `movementBudgetMessages.ts`, zeroing the spend and the diagonal count and leaving the
per-round stamp ALONE (a stamp written ahead of its event is a no-op at the event; pinned with a
stale stamp and composed with `next-turn`); nothing spent, no such character, or a player asking
is a no-op on the handler's own result; the monster-budget redaction applies unchanged and a
second reset sends nothing. On the client `MovementSpeedField` gained `budget: { used, onReset }`
— a "Used N ft" readout and a Reset OUTSIDE the label, inert at 0, 44px when compact — threaded
the way the speed was, and shown in combat where the plate shows a budget (an initiative,
`shouldCharacterParticipateInCombat`) OR where there is a spend to clear (the server charges any
token moved in combat, initiative or not — a DM's own unrolled token included, and its card is
the only lever for that; a rolled one refills at its turn start, F3): no dead "Used 0 ft" out of
combat; the readout goes red past the speed like the
plate. Pinned by 8 server cases (6 handler, 1 validator, 1 contract), the field (4), the settings
menu (2), the actions hook (2), six phone-list cases, a real desktop-panel render of BOTH sites
(6 then; F3 rewrote the DM-section cases), the NPC tab (2), the DM menu (1), the portrait preview (3), the window caps (3), and e2e on
both layouts (the phone also resets a MONSTER through the NPC editor and the real wire, and
probes the row's one line at 5 and 10 ft). Three review rounds (4 fresh lenses each: 0/7/24 raw →
0/5/16, 0/4/37 → 0/3/24, 0/10/30 → 0/4/25 — a plateau, no round 4): every finding fixed or
recorded in the plan's F2 section — the gate on the control, the panel's real render of both
sites, and round 3's sweep of the prose the widened gate had left behind were the ones that
mattered. Sabotage: 11 red, then 14 more (12 red; the two green ones are a second DM lock
behind the speed handler's), then 7 more after round 2 (7 red: the spend clause at each of the three gates, the phone list's participation, a pre-stamp, an object id, the budget-without-speed coupling) — 32 in all, 30 red; then 14 more after round 3 (14 red, one in the browser) — 46 in all, 44 red. Fixed on the way, own commit: the settings overlay's phone branch
`vh` → `dvh` (desktop stays `vh`, reasoned in place), its safe-area bottom, the dice result
card's cap moved to CSS with the `vh`/`dvh` pair; the NPC portrait preview keyed on its
COMMITTED URL. The DM guide gained a Movement bullet. NEXT: F3 (a DM-owned character with an
initiative is a combatant) — it widens the desktop panel's DM-section reset from the spend clause
to the ordinary in-the-order case, and it is where the redaction's `type === "npc"` key (a DM-run
PC-typed character's budget ships to players) gets decided. (Done, see the F3 update above —
it moved the rolled character INTO the order instead and left the bench site on the spend
clause; the `type` key stayed.)

**Update (2026-09-11, latest — FOLLOW-UP F3 on `dev`, NOT merged to `main`: a DM-owned
character with an initiative is a combatant).** The owner's call ("the dm controls all that is
not a player"): the DM's own character is treated like a monster — in the fight once it has
rolled, on the bench until then, regardless of `type`. One rule, one home:
`shouldCharacterParticipateInCombat` (shared) admits a PC owned by ANY DM iff `initiative !==
undefined` (any DM, not the first found: the panel groups on `player.isDM` and the rule must
agree with the grouping — a co-DM's unrolled character rendered NOWHERE under the first cut,
found live); the server's `character/service.ts` had a private copy of the old rule, deleted.
The rule decides "may be in a fight"; every caller but the panel's ordering hook also asks for
a roll (`isInInitiativeOrder`), so today the clause is load-bearing only at the hook's bench split. By that rule: the server's order includes it (so
`next-turn` lands on it and its turn start refills its budget), the plate wears its budget on
every screen, the party panel's ordering hook moves it out of the DM group into the ORDER while
combat is on (kind `dm` kept for the DM's affordances; the turn counter and the current-turn mark
can land on it) — the bench is "DM-owned, not in the ACTIVE order", so after END COMBAT (which
keeps initiatives) the card comes home instead of the DM's column unmounting — and the bench's
reset site is the spend clause alone. Redaction STAYS keyed on `type` (HP's axis too; a DM who
wants an ally's numbers hidden makes it an NPC — no gesture changes `type` today; the guide says
a character on the DM's card is visible to the table) — pinned by the secrecy contract. Pinned
by the shared rule (7 cases incl. `isInInitiativeOrder` — round 2's one spelling of "in the
order", which the server's order, the plates and both reset controls read), the server order (1,
plus a mocked-helper case pinning that the order consults it), the handler (2), the contract (1),
the plate (3, incl. a player's screen and the DM's player lens), the ordering hook (5, incl. a
co-DM, the fight ended with the roll kept, and combat off with only the DM rolled), the desktop
panel (6, incl. a PLAYER viewer and the return home) and its turn banner (3), the phone list (2),
and e2e on both layouts (`dm-combatant.spec.ts` — two clients, a speed of the spec's own choosing,
the plate keyed by its nameplate and asserted as the only one on a quieted table, the order
asserted on both screens, END COMBAT sends the card home — and `mobile/mobile-dm-combatant.spec.ts`).
Three review rounds (4 fresh lenses each: 1/12/28 raw → 0/6/16 — the critical was the co-DM
hole, fixed before the lenses finished — then 0/9/28 → 0/7/17, then 1/14/27 → 0/9/20, the last
round finding a REGRESSION of round 2's own badge gate — the number vanished for players — and
a server chain three "DMs never have tokens" sites long): every finding fixed or recorded in the
plan's F3 section. Sabotage 35 attempts, 30 red, 4 green by construction, 1 with no single-line sabotage (the server's rule filter before round 2 replaced it with the helper; the helper's own rule conjunct — unobservable while the rule admits every rolled character, which is what the helper is for). Fixed on
the way, own commits: the combat banner read "Turn 1 of N" while nobody held the turn
(`852701aa`); `PlayerCard`'s memo comparator ignored the movement fields (`b19beb97`); the
settings menu hid a DM's card's token image, size and lock ("DM players don't have tokens") —
the only route to a PC token's art, size and lock (`24c5f5b8`); the initiative badge was
offered on every card to every viewer, a silent no-op or a 5 s timeout for anyone but the owner
or a DM (`991c8697`; and then its badge READS again for everyone, `4c2e7e1a`); the current-turn
ring was the same gold as a DM card's own border — white now, in the gold glow (`7b7827cb`); the
server still skipped a DM's token on join, reconnect and add-character, and a deleted token left
its character's `tokenId` dangling (`65c7cd67`); "+ Add Character" hidden on a DM's card
(`44875505`); the Token Image field where it could not act (`0d0fb5bb`); the memo comparator's
closure clause (`1e0fb3cf`). The DM guide's Movement bullet says how a DM's
own character joins a fight (from its card; the phone has no initiative control), comes home,
and that it is visible to the table. NEXT: nothing queued from the keyboard-movement follow-ups — the optional item-4 list in
`PROMPT-keyboard-movement-followups.md` waits on the owner; F1, F2 and F3 are on `dev` for the
owner's merge call (MERGED and DEPLOYED 2026-09-13 — the update atop §0).

**Update (2026-09-10, later — FOLLOW-UP F1 on `dev`, NOT merged to `main`: the phone pad no
longer covers the piece it moves).** The owner's call (a): a camera follow while the pad is
mounted. Mobile-local, like the map-edit cancel counter — `useMovePadCameraFollow`
(features/movement) runs in `MobileLayout` only while the d-pad is up and the map is showing,
follows the first movable token, else prop, as a world-px box (cells → px for both; the sprite
times the size ladder and the gizmo scale; a token's plate as 40 screen px below), measures the
sheet's, the combat strip's and the surface's REAL rects, and when the box leaves the open band
issues one `focus-point` with the SCREEN point to land on (`at`, the command's new optional
field), on the axis that left the band, a lead inside the crossed edge so a held walk scrolls one
cell per step (glided 120 ms); the band is chosen so the piece fits (the strip is given up before
the sheet, and its box now lets taps through between its buttons); the landscape pad is one row
of eight so a token and its plate fit above the sheet there too; any camera command cancels a
glide; a pan or pinch absorbs an outside camera change without losing the finger's travel, and a
thumb on the d-pad no longer turns a one-finger pan into a pinch; app-level commands go first
and the follow re-evaluates once they have moved the camera; the surface machine DERIVES "none"
while a screen's role gate refuses it (never latching — `isDM` reads false on every reconnect
blip). Pinned by 49 unit cases across six files and `mobile-move-pad-follow.spec.ts` in portrait,
landscape and landscape-in-combat (a DM in a second context; the token's rect from its painted
Konva node; a tap over the strip's gap reaches the canvas). Three review rounds (4 fresh lenses
each: 1/14/25, 1/18/38, 1/17/36 raw — the last two dropping once duplicates merge); round 3 was
the last under review-convergence and every finding is fixed or recorded in the plan's F1
section and its three round subsections. Sabotage: 13, then 14, then 21, then 17
red — 65 across the four passes, 59 at unit level and 6 in the browser. Fixed on the way, own commit: a flipped token's nameplate rendered above its sprite.
TRAPS paid for: a `cameraCommand` built as an inline literal inside `renderHook`'s callback
re-fires `useCameraControl`'s handler effect forever and the worker dies of a heap limit that
looks like the suite's batch OOM — hoist it; `requestAnimationFrame`'s timestamp and
`performance.now()` are different clocks under jsdom — anchor an animation on its first frame; a
lazy `MapBoard` mock is not mounted when `render` returns — `await screen.findByTestId("map-board")`
before reading its props; a hidden pane tab freezes Konva's tween AND the camera glide, so a
sprite read there sits a cell behind the state and the follow appears not to fire; a stage stub
that returns the same pointer object it later mutates moves the recorded drag origin with it;
a snapshot-derived flag in a LATCHING effect is a reconnect bug (the map-edit guard's rule, again).
NEXT: F2 (a DM reset-budget control, the budget stays advisory) and F3 (a DM-owned character with
an initiative is a combatant).

**Update (2026-09-10, DEPLOYED — the keyboard-movement arc is IN PRODUCTION).** The owner said
merge. `dev` fast-forwarded to `main` as `e42d60bf` (from `a41a8065`, twelve commits: the arc's
three slices, three review rounds in four commits, the two bugs fixed regardless of origin, the
save debounce, and two docs commits), pushed 2026-09-10, `dev` pushed to match. Deploy probe-verified across all 11
served chunks (1,205 KB): the entry bundle went `index-CHR8dA8X` → `index-Biz0-AXd`; the
discriminating strings `step-object` and `Move selection` (absent from the client at `a41a8065`,
present at `e42d60bf`) read 1 hit each in the new entry bundle, the controls `Apply Portrait` and
`Portrait Image URL` 2 each, `/health` 200 on Render. NOTE for the next probe: Cloudflare returns
403 to Python's default user agent — send a browser UA. CI run #857 green, `e2e-full-suite` step `success` (not skipped). The prod
functional check of the server half (a charged step at a real table) needs the prod DM password
the owner holds and was NOT run. Players there must reload. The owner's follow-up calls, decided
the same day (the owner's gut plus "use your best judgment"): (1) pad-covers-token → (a) a
camera follow while the pad is mounted; (2) the budget stays ADVISORY — "it's a VTT, not an RPG
game" — with a DM reset-budget control; (3) a DM-owned character with an initiative IS a
combatant regardless of `type` ("the DM controls all that is not a player" — an ally, a disguised
villain, anything), reversing the pre-existing DM-owned-PC exclusion. Each ships as its own slice
in the `PROMPT-keyboard-movement-followups.md` order.

**Update (2026-09-09, later — KEYBOARD MOVEMENT SLICE 1 on `dev`, NOT merged).** WASD / arrows
(and `Q E Z C` + numpad corners for diagonals) step the SELECTED token or prop one grid cell per
press over the relative `step-object` message, which the server resolves against its own
authoritative cell and applies over the ordinary transform road, so the ownership/lock/wall checks
apply unchanged and the fog cone redraws per square from the next snapshot. The phone gets a 3×3
d-pad in the selection sheet (eight chips, each ≥ 44×44 — measured 69×44 at 375×812). Plan, decisions and traps:
[keyboard-movement-arc-plan.md](./keyboard-movement-arc-plan.md). CORRECTION to the launch
prompt's recon: the client never sends `move` — every drag is `transform-object`, which is why
props came for free. The wire carries a DIRECTION, never a cell (two absolute-cell versions
teleported — review rounds 1 and 2), so N presses are N one-cell steps applied in order; the
server rounds a fractional origin (a staging-zone spawn) before adding the direction. Selection still needs Select/Transform mode (existing model). **Slice 2
(hold-to-repeat) also SHIPPED 2026-09-09:** a held key or a held d-pad button walks at one cell
per 150 ms. **Slice 3 (the movement budget) SHIPPED 2026-09-09 too — the arc is COMPLETE on
`dev`:** every token move in combat is charged server-side under the diagonal rule (Pathfinder's
alternation kept per turn), the nameplate reads `remaining / speed ft`, the budget resets on the
character's turn start (once per round — a rewind refills nothing), the DM sets a player's speed from the settings menu on both layouts and a monster's from the DM menu's NPC editor, and a monster's
budget never reaches a player's frame. Also fixed on the way (own commit `d4240c48`): a
`token-updated` delta never moved the token's SCENE OBJECT, so a `move` over the delta channel
left the sprite behind until the next full snapshot. Adversarial review rounds 1 (`316c295a`) and
2 (`b2a0cb20`) are FIXED on `dev`; **round 3 PLATEAUED** (1/17/45 against round 2's 1/18/30 —
the plan's "Review round 3" section has the counts and every disposition) so per
`review-convergence` there is no round 4: its defects are fixed in two commits (server: the
budget state machine — a player could zero their own spend by clearing their initiative, round-1
turn starts never reset, the PREV floor minted rounds, a load carried a file's spend, and the
shared-prop rule was locked to players; client/mobile: a multi-select walk tripped the limiter
past ~15 objects — one `step-object` per step now carries the whole selection; a full-screen
modal did not stop the keys; the d-pad's arrows were 11px on portrait phones and the landscape
fold made a phone pay double for a diagonal; real holds are now proven over CDP and a mouse) and
~~the OWNER decides whether the remaining recorded items — the pad covering the token it moves is
the biggest — block the merge~~ (merged 2026-09-10; the pad item is F1, see above). **The next agent's prompt is
[PROMPT-keyboard-movement-followups.md](./PROMPT-keyboard-movement-followups.md)**: ~~the merge
decision first (theirs), then the pad-covers-token fix~~ (both done 2026-09-10 — see the updates
above) and the other owner calls as slices. The one deferred follow-up is DONE too (own commit): `saveToDisk`
is a trailing debounce (`saveDebounce.ts`, 250 ms), so a held key no longer writes the state file
~6.7 times a second; `awaitPendingWrites` flushes first, and a test teardown can
`awaitAllPendingWrites()` across every instance. A second bug fixed regardless of origin, own commit: the initiative modal confirmed a
save by watching the value CHANGE, so a physical-die entry equal to the roll on file "timed out"
after 5 s and STAYED OPEN over the toolbar (one d20 face in twenty; the e2e suite hit it three
times in two days as a "flake"). `useInitiativeSetting` now also confirms on a newer frame
(`stateVersion`) carrying the requested value; `initiative-repeat-entry.spec.ts` pins it.

**Update (2026-09-09, DEPLOYED + NEXT ARC PROMPTED).** `dev` merged to `main` as `a41a8065`
(from `7c555d32`), pushed, deploy probe-verified (bundle `index-DRpA0XA6` → `index-CHR8dA8X`; the
publish-confirm strings are live in the served `lazy-entry` chunk, control string present). Both
the publish blank-table fix and the fog opacity fix are IN PRODUCTION. **The next arc is written up
as its own launch prompt: [PROMPT-keyboard-movement-arc.md](./PROMPT-keyboard-movement-arc.md)** —
keyboard movement (WASD/arrows, one cell per press), the per-square fog redraw that falls out of it
for free, and the per-square movement budget, all recon-banked and sliced. Its §7 embeds the
owner's standing prompting instructions. The §10 keyboard-movement entry below is the source it was
built from.

**Update (2026-09-08, later — FOG VISIBILITY, investigated + one fix).** The owner noticed a
player could see the whole map layout dimly through fog. Investigated live: the explored mask is
per-uid localStorage (survives a DM elevate→revoke round-trip byte-identical — verified; no
save/load needed), and a fresh player's mask measured only 4% painted. So the dim whole-map look
was NOT stale exploration — it was the never-seen fog band rendering at opacity 0.97, letting ~3%
of the terrain bleed through. FIXED (`b055f8e5`): never-seen fog is opacity 1 now, unexplored
renders black. This closes the VISUAL leak only — geometry still reaches every client (fog is a
render layer, not a data boundary: `compiledSceneView` sends all non-secret walls, `mapTerrain`
ships the floor to all roles), so a determined player reading devtools can still reconstruct the
layout. That is the accepted design (it's why generated dungeons author no secret doors). ALSO
NOTED, not yet actioned: DM status persists across a page reload (a revoked-then-reloaded session
came back as DM) — likely intended, worth a conscious yes. On `dev`, not pushed.

**Update (2026-09-08, TWO ITEMS QUEUED BY THE OWNER — see §10).** (1) A production BUG:
`PUBLISH TO LIVE MAP` drops live terrain by design (`backgroundMode: "full"`) and, when the baked
PNG does not render, leaves the table showing only its bounding box and the staging zone — with no
error, and with travel-to-the-same-node no-opping so the obvious recovery fails. Recovery that DOES
work: clear the background, travel away, travel back. (2) A FEATURE: WASD/arrow keys move the
selected token or item one square per press, so the fog cone redraws per square instead of only on
drag release, with a per-square movement budget built alongside it. Also confirmed this day: the
Kicked-In Door's SERVER half works at a real production table — G, reroll, ROLL, adoption, the
return stair, and fog through the generated doors, all good.

**Update (2026-09-07, THE OWNER DECIDED).** The one item the final review put to the owner is
**CLOSED: generated encounter markers are prep notes, not secrets** — option (1) of the plan's §7
RNG-oracle entry. Reasoning on the record: the attack costs a deliberate reconstruction from source
by a player whose own game it spoils. Do NOT reopen it as a defect and do NOT reseed the markers
(that costs seed-reproducibility, which Cartridge Codes rest on). Transmission secrecy is unchanged
and must not regress — the keys are still stripped from every player frame by two independent
locks. One adjacent idea from the same exchange is NOT yet recorded anywhere: a streaming DM's
screen shows the markers to their own players, which wants a "hide GM notes" toggle; and the same
conversation raised **stream mode for JOIN CODES** (hidden by default, toggled into a visible
overlay for open community nights) — that belongs with invite links and the Claim Window in M6, not
in this arc.

**Update (2026-09-07, THE COMPLETENESS CRITIC).** The review's last step found **8 gaps, and the
two HIGH ones were real misses the four lenses had no reason to look for.** (1) The PLAYER guide,
written in K6, told players to click a travel sprite — but `AtlasLinksLayer`'s hit circle is gated
`dmView`, so a player's click does nothing, ever, by design. The same class of overclaim the review
had already caught once in the DM guide; nobody had re-read the player's. (2) K4's Tests list
promised "both panels render the picker and send the right shape", and the ATLAS GENERATE panel's
building path had zero client coverage at any level — the kick panel got all of it. Also real and
fixed: the generate panel still minted its seed with `Math.random` in violation of invariant §4.8
(K2's capsule assigned that change and it never happened) and still lacked the `inputMode="numeric"`
the Atlas arc's mobile lens recorded against it — the note said K2 would fold it in, and K2 built a
NEW panel and left this one alone; K2's own promised `inputMode` assertion was never written on
either. And the phone journey's "you are here" used two independent locators, so it passed with the
marker on the WRONG node — PROVEN vacuous by running the old form against a player-only projection
break (green) beside the new one (red). Two gaps are recorded in §7 rather than fixed: deleting a
mapped node leaves its 207-235 KB document with nothing testing or documenting the reclamation
(the lifecycle lens nobody ran), and `MAX_GEOMETRY_ELEMENTS` is still dead. The critic's clean list
is worth reading too — it verified K1's whole Tests list, K4's 26 properties, both orientations,
the validators, §4.16 by its own `git diff`, and confirmed the `entranceAnchor` self-referential
assertion is NOT vacuous because independent boundary maths back it.

**Update (2026-09-07, THE FINAL REVIEW IS DONE).** Four lens-sized workflows (state-machine,
privacy, client/mobile, recipe), **22 agents, `agents_error: 0` on every one**, each followed by a
`git status` audit — the reviews mutated nothing. **8 findings: 1 refuted 2/2, 1 contested, 6
confirmed.** Five commits answer them: `26c36486` (an e2e spec race in the initiative suite — a
bug found mid-review and fixed in its own commit), `4a003551` (a reconnect blip threw away the
kick form; CANCEL and Escape were dead controls on a phone; the ✕ left the App flag set; a layout
crossing mid-kick left no pending indicator), `9e14e5fb` (the generated room keys are recoverable
by INFERENCE — a refuter recovered the seed from the published lights in 68.8 s and reproduced all
19 keys, so the comments no longer promise secrecy they cannot deliver, and a kicked building's
keys are pinned off the player wire at last), `2e83124e` (a table's own export can outgrow the
1 MiB wire frame — the client now weighs it and says so, `WS_MAX_MESSAGE_BYTES` is one shared
constant, and K6's budget test, which measured ONE real document among seven empty shells and read
as proof, now weighs the real frame beside a characterization test that pins the gap). Full ladder
green on a quiescent tree, dev boot included: shared 25/427, server 127/2341, client 298 files /
5561 tests, e2e 176 passed / 3 skipped (179). **Three findings are recorded in the plan's §7 rather
than fixed, deliberately and not silently** — the RNG-oracle (three priced options, all costing
something the owner should choose), the byte-aware mint cap (the real fix for the export ceiling; a
slice, because refusing a DM's kick is a product decision), and travel re-placing the party at the
origin's centre (the Atlas arc's settled semantics, whose fix installs a player-visible zone).
Still NOT pushed and NOT merged.

**Update (2026-09-06, THE ARC IS COMPLETE).** **The Kicked-In Door arc is finished on `dev`** —
K0–K4 and K6 shipped, K5 (Cartridge Codes) deferred to the plan's §7 as the one slice the plan
itself marked optional. A DM presses G (or the phone's 🚪 verb), names the place, and the whole
table is standing in a generated dungeon or building with a door back; a table that was never on
the Atlas is adopted by its first kick. K6 closed it in three commits: **`eaac49e8`** (a bug the
closure gate found — the e2e reset fixture's retry ladder let a THROWN transport error escape its
budget, so one `ECONNRESET` killed an unrelated spec; both failure shapes now share the budget,
pinned by a server-free `reset-retry.spec.ts`), **`10415f67`** (the `kicked-in-door.smoke.spec.ts`
journey — G on an unadopted table → adoption → tavern → the player's wire → the return door home
→ a second kick on the now-adopted origin — plus the phone's building leg and budgets that can
actually fail: BOTH recipe budget tests were vacuous, the dungeon twin included, and the
eight-scene export ceiling was weighing empty documents), and the docs commit (both user guides
with re-recorded screenshots, the §7.2 IOUs cashed in two older plans, `helpTopics.ts` re-read,
the VISION M4 Phase 3 banner). Sabotage 14/14; final ladder green on a quiescent tree — e2e 176
passed / 3 skipped (179), server 127/2339, client 298 files / 5553 tests. NOT pushed, NOT merged —
that is the owner's call. The final adversarial review is the last step; see the plan's SHIPPED
banner and each slice's own.

**Update (2026-09-06, K4).** **K4 is SHIPPED on `dev`** — the building recipe (`f869d200`) and its
behaviour-preserving groundwork (`f0361359`, the dungeon golden byte-identical through it), each
behind the full ladder (dev boot included: shared gained runtime exports) and a sabotage pass (17/17),
with a tavern kicked in and inspected in a browser. Both pinned goldens pass. NOT pushed, NOT merged.
Next: K5 (Cartridge Codes, optional) or K6 (the journey e2e, budgets, user-guide debt, the final
review). The plan's K4 banner records the answered escalation question.

**Update (2026-09-06, later).** **K3 is SHIPPED on `dev`** — the kicked-in door on a phone
(`c7ac1506`), the touch-floor sweep's Atlas gap (`149b2b64`), and a hit-graph wait that closes a
first-time flake in K0's aim spec (`4ddc2abf`), each behind the full ladder and a sabotage pass
(9/9), measured in a browser at 375×812. The new e2e spec caught a real bug in K2's panel: an
inline `min-height` on its selects beat the mobile touch floor. NOT pushed, NOT merged. Next: K4,
the building recipe. The plan's K3 banner carries the traps.

**Update (2026-09-06).** **K2 is SHIPPED on `dev`** — the desktop kicked-in door (`de2c3102`) and
the two pre-existing hotkey bugs it cleared first (`9fe080b4` the bare `r`, `35f1eff5` Delete in a
select), each behind the full ladder and a sabotage pass (24/24), with the whole flow driven by real
keystrokes in a browser on the dev table. NOT pushed, NOT merged. Next: K3 (the phone verb, the kick
screen, the pending chip), whose drafts are staged. The plan's K2 banner carries the traps.

**Update (2026-09-03).** **K1 is SHIPPED on `dev`** — the `atlas-kick` composition (`116d6443`) and
its four bug commits (`c1c946e4` provenance size + the shared recipes vocabulary, `23debe85` the
limbo-zone leak, `3e41af54` compile-before-capture, `e38b6576` trimmed names), each behind the full
ladder and a sabotage pass (29/29 on the composition), with the console harness run in the browser
on the dev table. K1's senior review (two lens-sized workflows, 8 agents, `agents_error: 0`): a
confirmed guard bug and a contested origin gap FIXED (`4117c195`, `db88f49d`), the adopted name bounded
(`01338134`), the privacy finding refuted as settled design — plan §9.1. NOT pushed, NOT merged.
Next: K2 (G, the panel, the arrival toasts — desktop),
whose drafts are staged. The plan's K1 banner carries the traps and the flake register.

**Update (2026-09-02, late).** The Kicked-In Door arc has STARTED on `dev`: plan Rev 2 (`285b8a54`,
recon-grounded and adversarially reviewed) is the spec, and **K0 is SHIPPED** — the Atlas review's
missing mobile lens's four production fixes (`659c65f0`, `1cf4a424`, `1be8913d`, `52d83e50`) plus two
persistence bugs the gates exposed (`204e7e37`, `58cf6ad5`), each behind the full ladder and a
sabotage pass, with a CDP-driven mobile spec as the browser proof. NOT pushed, NOT merged. The plan's K0
banner records the one deviation (L3 pans under the aim, guarded, not pinch-only). Next: K1, the
`atlas-kick` server composition. Baselines: shared 424, server 2270, client 5500 (+4 skipped), e2e
170/3/0 of 173.

**Current state (2026-08-18).** The **loose-ends batch is IN PRODUCTION.** Ten commits,
`c24845d9..a7bfb961`, each behind the §2 gate and each sabotage-proven before commit, merged to
`main` as `a78dd0e7` and deployed to Render + Cloudflare on 2026-08-18. It closes five of the six
"unexamined areas" M5's review left (the sixth, real-device iOS, is now probeable but not closed).

| Branch | Commit         | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`  | Atlas arc HEAD | **THE ATLAS ARC IS COMPLETE, PUSHED (CI #837 green at `8d115c11`) AND IN PRODUCTION via `main` (2026-09-02)** — A1 `fd7afb17` (graph/wire/projection/persistence/fork) → A2 `a17d6b99` (DM tree, both platforms) → five A1-review fixes `1543a08e..effddc5b` → A3 `7d7251a5` (atlas-generate-node) → A4 `3fcce20b` (sceneSuspend/sceneTravel — set-live REBUILT on the one suspend/resume path) → A5 `efabc884` (iris wipe, focus-point camera, palette follow, fog v2, 🚩 TRAVEL) → A6 `c4d86c97` (link sprites, one-shot ⚓ aim, 🗺 world map both platforms) → A7 `ae43bb8d` (atlas-journey + mobile-atlas e2e, budgets weighed, large-campaign round-trip, docs) → the final adversarial review's fixes: `69e83c45` (travel physics — the unbind→rebind wipe BLOCKER), `c9726ce8` (mint ceiling on import + load, one scene sanitizer), `c1738db6` (client: aim/lens/delete/camera/mobile), then the journey spec's post-suspension assert. [atlas-arc-plan.md](./atlas-arc-plan.md)'s SHIPPED banners carry every deviation; its §6 failure drills and §7 deferrals are the map for what's next |
| `main` | `a0434d39`     | **PRODUCTION**, deployed **2026-09-02** — the Atlas arc merge (no-ff of dev `8d115c11`). CI **#838** green with `e2e-full-suite` RUN (6m05s). Deploy verified: Cloudflare served the arc's bundle within ~1 min (chunk-probed for a string absent from the previous build, control present in both) and Render restarted (502 → `ok` in ~45s). Players must reload. A FUNCTIONAL DM check on production (place a link, travel) was NOT run — it needs the production DM password                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## 0.2 Fork C is closed too, and it is IN PRODUCTION (2026-08-29)

`PROMPT-mobile-arc-ship.md` has nothing open left. Its three deferred items are fixed and
deployed at `1eaf2f1b` (CI **#822** dev / **#823** main, both with `e2e-full-suite` verified
RUN; probe- and browser-verified). The lesson worth carrying: **in all three the symptom named
the wrong bug.**

- **`pnpm docs:screenshots` passes all five walkthroughs** (`50977c48`) — two had failed since
  before 2026-08-09. The generator's "Region badge never appears" was a drag whose MOUSEUP
  landed on the entities panel, so it never reached the Konva stage; `computeGenRegion` now
  probes `elementFromPoint` inward for canvas it can actually reach. `closeTopWindow` matched a
  button named `×` when DraggableWindow's `aria-label` ("Close <title>") WINS — it had been
  closing NOTHING, leaving windows open to intercept later clicks. And `getByText("saving…")`
  hits TWO render sites, so it needs `toHaveCount(0)`, not `toBeHidden`.
- **The recolour flake is a product fix** (`a008bcf5`): the draw was free over 360 hues, so 1
  press in 360 redrew the hue already showing. It now draws an offset of 1..359 and always
  changes. RNG injected — and the default must CALL `Math.random`, not capture it, or
  `vi.spyOn` in that suite stops reaching it.
- **My Stuff reaches a phone** (`bf02f9fe`) via ImageField. ImageField commits a URL and never
  the File, so the hash is parsed back out of it and the footprint measured from the URL,
  BOUNDED at 5s — an unbounded measure leaves a stalled upload never arming.

**Deploy note, for the next probe:** the first `200` from Render after a main push can be the
OLD process still running — the restart came later, and the browser showed "Reconnecting" with
CORS errors on `/healthz` (a 502 response carries no `Access-Control-Allow-Origin`). Wait out a
real 502 window, then re-check; a fresh tab is what tells you the errors were the restart.

## 0.3 The login flake is SOLVED — it was a real product bug (2026-08-30)

The suite's one recurring flake (`join*` timing out on the password field; four sightings
across 41 preserved gate runs ≈ 1 in 1,900 page loads) is diagnosed, reproduced, and fixed.

**Mechanism, named by forensics:** the app is an ES-module graph, and ONE failed vendor-chunk
fetch kills the whole graph silently — React never runs, so no error boundary exists yet, and
the page stays blank. Reproduced under a 3,000-load hunt (6 workers, request forensics armed
before each load): `vendor-voice` answered `net::ERR_CONNECTION_FAILED` between two requests
that SUCCEEDED milliseconds apart on the same vite preview; `mounted:false`, zero websocket
contact — matching every archaeological sighting (the server was idle in all four failure
windows; the 2026-08-18 note's "look at client asset delivery" guess was right).

**The fix is in the PRODUCT, not the harness:** a boot watchdog in `apps/client/index.html`
reloads ONCE if the mount point is still empty 4s after `load` (sessionStorage-guarded, so a
truly broken deploy cannot loop), and paints a visible "HeroByte didn't load" message if the
retry fails too. A real player losing one chunk on a flaky connection used to get a silent
forever-blank page. `apps/e2e/boot-recovery.spec.ts` is the flake made DETERMINISTIC via
route interception — with the watchdog disarmed, its first test IS the original bug.

**Base-rate lesson, §8-grade:** the earlier "cannot reproduce" verdict came from 25 repeats
against a 1-in-1,900 event — about a 2% chance of a sighting. Mine the corpus for the
denominator BEFORE declaring something unreproducible.

## 0.1 The mobile authoring arc is COMPLETE (2026-08-27)

**M6, M7 and M8 all shipped to `dev` in one session, and with them the arc that has been
running since 2026-08-09.** Every map-edit tool now reaches a finger. Nineteen commits on
top of `16499eb2`, each behind the §2 gate and each sabotage-proven before commit.
**IN PRODUCTION since 2026-08-29** (`6dd9e864`), together with the nine fixes its
adversarial review produced — see the UPDATE atop
[PROMPT-mobile-arc-ship.md](./PROMPT-mobile-arc-ship.md).

**[PROMPT-mobile-arc-ship.md](./PROMPT-mobile-arc-ship.md) is the handoff for what happens
next** — the review/push/merge fork, the exact baselines at `36633e14`, the three items
deliberately left open, and the traps this arc paid for. Read that first if you are picking
this up cold. [mobile-authoring-arc.md](./mobile-authoring-arc.md) §4 has the per-slice
write-ups.
The four things a next session most needs to know:

- **The compat-mouse trap is CLOSED at source.** A touch tap synthesises a mouse pair and
  the mouse path routes to the same handlers; `useTouchGestureRouter` now cancels the
  touchstart a tool takes ownership of. MEASURED at 2 `paint-terrain` commands per tap
  before, 1 after. Every "this tool cannot be armed on touch because it would double-fire"
  comment in the tree is now history — the reasons that remain are about AIMING.
- **Click tools have a different gesture from a mouse**: press AIMS, release DROPS
  (`useMapEditTouchAim`). The map-edit handlers take an `input: "mouse" | "touch"`
  discriminator; nothing else cares.
- **Two hooks were extracted because they had to be**, exactly as this file predicted:
  `useMapEditTool.ts` (350 cap) lost its drag lifecycle to `useMapEditDragGesture.ts`, and
  `useMapEditState.ts` (350 cap) lost the placement dials to `usePlacementDials.ts`.
- **Adding a tool tile costs MAP.** The sheet is bottom-anchored, so a new grid row is
  ~56px a DM can no longer tap — which broke a spec that tapped "empty canvas". The column
  count is now derived (`auto-fill, minmax(120px, 1fr)` at ≥700px) and
  `mobile-map-edit-panels.spec.ts` holds a floor on the MAP, not a ceiling on the sheet.

Also closed in the same session: the initiative e2e that had zero `expect()` calls, the
last two `window.prompt()` dialogs, the 44px panel-wide pass (now one `(pointer: coarse)`
rule scoped to `[data-mobile-surface]`), and two of the three vision-default follow-ups.

> **Update (2026-08-24).** The initiative slice (server-side rolls on the crypto RNG, the roll
> log naming the character, manual override with strikethrough, DM toggle on by default — §3D's
> owner-chosen design) is **COMPLETE on `dev`** at `ac47ab9e`, CI **#808** green including the
> full e2e job. NOT merged to `main`; that is the owner's call and deploys. The adversarial
> review's hidden-NPC roll-log leak was fixed on both log writers (`d4dfda6e`). Open for the
> owner: the `recordManual` judgement call, PROMPT-initiative-client.md §5.

**CI #797 was the first run in which the full e2e suite ever executed against this work** — see
the `cancelled`-is-not-`failure` trap in §5, which is why #796 looked green-ish and proved nothing.
Production was verified serving this build by the discriminating-string probe in §5, not by a
bundle-hash comparison (which cannot work here — same entry). **Players with a tab open from
before the deploy must reload**; stale clients blank silently.

What the batch did, in dependency order rather than commit order:

- **`c24845d9`** — `/__e2e/reset` answered a transient teardown race with a bare 500, identical to
  a dead server, and the fixture gave up after one POST. Now 409 + the real reason, and a bounded
  3s retry. Found by the WebKit run below, but it is engine-independent hardening: the race is
  Chromium's too, just rarer.
- **`eed07ce3`** — the `webkit-check` skill is committed. It was written but untracked, so it
  existed only in one working tree. Run it by hand; it is deliberately NOT in CI (see its SKILL.md
  for why, and read that before adding a webkit project to `playwright.config.ts`).
- **`a5059036`** — the asset store charged a cross-room claim twice against the WHOLE-STORE
  ceiling. §3D listed this; it is fixed. The per-room ceiling was correct and is unchanged.
- **`d75fe22b`** — GENERATE's aimed region survived leaving map-edit, because `armed` only ever
  watched the sub-tool and `activeSubTool` outlives the mode. Reopening came back armed at an
  invisible rectangle.
- **`1a0c351c` + `70b36238`** — portraits go through ImageField. The player card was the only
  surface still prompting (the phone had been routing correctly all along); **NPCs had no upload
  path anywhere** and now do. The dead prop chain and the last image-path `window.prompt` went with
  it.
- **`4336387b`** — the authoring journey now runs at 390 as well as at the tablet's 820.
- **`ca36ed03`** — a tablet rotating across the layout rule keeps its armed tool and dial values.
  The review feared it did not; it does, because those live in App-level `useMapEditState`. Also
  the first coverage `(pointer: coarse)` has ever had.
- **`a7bfb961`** — `e2e-full-suite` pinned its checkout to `ref: dev` **unconditionally**, and that
  job runs on every trigger. So a push to `main`, or a PR targeting it, checked out dev's tree and
  reported the result as the pushed commit's. Now scoped to the `schedule` trigger, which is the
  only one that needs it. **This fix is NOT yet proven by a run.** The merge made both trees
  byte-identical, so #798 could not tell the old pin from the new one — the first run that can is
  the next one where `dev` and `main` genuinely differ. Same commit bounds the Playwright install
  at 10 minutes (§5).

**Baselines at `ca36ed03` (measured, not carried forward):** shared **424** / 24 files, server
**2110** / 110 files, client **5302 passed + 4 skipped** / 268 files, e2e **134 passed / 0 failed /
3 skipped**, entry bundle **103.05 KB** of the 175 KB budget (`build:check`'s own measure — do not
mix it with a `gzip -9` figure). The bundle moved +0.38 KB, which is the NPC portrait field minus
the deleted prompt handler. **These still stand at `a7bfb961`**: the two commits added since
`ca36ed03` are this file (`4efe1064`) and a workflow-only change (`a7bfb961`), neither of which
touches a test, a source file, or the bundle. CI #797 and #798 both ran the full suite green.

**One flake observed once and not reproduced.** A full e2e run had
`mobile-help.spec.ts` "…(landscape)" fail in `joinMobileTable` on a 15s timeout. The page snapshot
was `main [ref=e2]` and nothing else — and `apps/client/index.html:46` is `<main id="root">`, so
that is the UNFILLED mount point: React never mounted, the bundle did not run. Not a landscape bug
and not a layout bug; that test merely held the dice. It passed in isolation (5/5) and the two
full runs since were clean at 134. If it recurs, look at client asset delivery, not at the sheet.

**The prior state follows.** **M5 of the mobile authoring arc is SHIPPED to `dev`** —
eleven commits, `a8639d8a..39fd5ac0`, each behind the full §2 gate, on top of the vision-default
slice below. A DM on a phone can now author with every drag tool: Room, Hall, Wall, Door, Row,
Spline and Generate, plus Populate. The slice plan and its SHIPPED banner are
`docs/planning/m5-mobile-drag-tools-plan.md`; read that banner before touching the mobile palette.

**M5's adversarial review has RUN and its findings are fixed** (39 agents, `agents_error: 0`; 16 raw
findings, 3 survivors collapsing to 2 distinct defects, plus 2 more from the completeness critic —
four fix commits, `c9b72444`, `53009cf2`, `a8b82e29`). The tree was fingerprinted before and after
and is byte-identical. Full write-up in the plan doc's review section, including the critic's six
still-unexamined areas.

Baselines now: shared 424/24, server 2108/110, client **266 files / 5277 passed + 4 skipped**, e2e
**132 passed / 0 failed / 3 skipped**, entry bundle **102.67 KB** of a 175 KB budget (that figure is
`build:check`'s own measure; the +2.50 KB slice delta is `gzip -9`, a different tool — do not mix
them). Three pre-existing DESKTOP bugs were fixed along the way (GENERATE never said why it was
disabled; POPULATE disagreed with its own ghosts; a failed map-edit chunk took the whole table
down). ~~Nothing is pushed and nothing is deployed.~~ **(True when written on 2026-08-12; all of
this reached production on 2026-08-18 — §0.)**

**The one thing the review found that is NOT fixed, and wants an owner decision:** a drag whose
commit is skipped because a command is still in flight is silent on every surface —
`useMapEditTool.ts:284-287` returns early and does not retry, and nothing raises an error, so no
toast fires. The e2e specs sleep 800ms between legs to dodge it. M5 multiplies the tools exposed to
it and real-device latency is nothing like localhost. A busy affordance has nowhere obvious to go:
the dock is pinned at five slots.

Two traps this slice added to §5's list, both earned the hard way. **A degenerate-drag sabotage
does NOT prove a region-tool spec can fail** — a tap on Room or Hall legitimately commits a
minimum unit, so the drag-never-moved sabotage stays green; sabotage `mapEditDragMode` instead.
And **`useMapEditState.ts` is now 349 against a guard that flags at 350** — it has no legal lines
left, so it joins `characterValidators.ts` on the extract-before-you-touch-it list.

**Prior state (2026-08-12).** The vision-default slice (§3B) is SHIPPED to `dev`, adversarially
reviewed, and NOT merged — thirteen commits since `93e284f8`: the six-commit slice
(`120103f8..dd29bec0`), three review fixes, two docs corrections, the review-closure tests
(`7a8bb703`), and this handoff update. CI green through run #780. ~~Nothing new is deployed.~~
**(True when written; in production since 2026-08-18 — §0.)**

_(That table is superseded by §0's, above. Both branches have moved since: `main` took the
silence arc to production on 2026-08-13 and now sits at `c0b6e648`.)_

Two documents carry what this file cannot: the **SHIPPED banner** atop
[room-vision-default-plan.md](./room-vision-default-plan.md) — the three places that plan was
wrong (a union member cannot precede its validator; the snapshot contract test cannot guard the
`visionSignature` cache, only the pointer-relay test can; "reuse VisionRadiusField as-is" shipped
a per-token control that called an inherited radius "Unlimited") and the follow-ups it left — and
§5's newest trap here (a client build DURING the e2e collapses the whole suite looking exactly
like a systemic regression). **Go to §10 for what to do next.**

The paragraphs below are the S8/M4-era history this document was written for; they remain
accurate as history.

**The Session One arc is DONE.** `docs/planning/session-one-arc.md` is the source of truth.
S0–S7 are in production; S8 and everything since is on `dev`.

**Read §3C first — M4a, M4b AND M4c are SHIPPED; the whole of M4 is done.** _Update 2026-08-11:
the owner chose §3B (the room-level default vision radius) as the next slice, ahead of M5 — the
full plan is [room-vision-default-plan.md](./room-vision-default-plan.md); it has since shipped
(see above)._ The owner
chose the mobile authoring arc on 2026-08-09; M3, M4a, M4b and M4c landed in sequence, and the
design is in [mobile-shell-redesign.md](./mobile-shell-redesign.md), whose §2 notes record what
each slice shipped and where it deviated. M4b's headline: a DM on a phone now has the FULL menu
(five tabs, chip row, same lazy chunk as desktop), `buildDMMenuProps` is the one bag→menu mapping
both layouts share, and the predicted phone treatment measured out as unnecessary — the fit is
guarded by `apps/e2e/mobile/mobile-dm.spec.ts`, not fixed by hand. **M4c's headline: a DM can
author the live map with a finger.** The design doc's one wrong claim cost the most — "room and
wall already work through M2's touch path" was false, touch never dispatched to map-edit at all —
so read that slice's SHIPPED note before touching the input path.

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

Re-run in full on 2026-08-09 at `9f4b3f15`: every row above still holds, and `tsx` boots the server
(§7) cleanly. The e2e row held only after `5f93db94` — the first run of it was `96 passed / 1 flaky`
(§5).

**M4a moved the baselines (gate run in full before each of its commits, 2026-08-09):** M3 had
already taken e2e to 106; at `f1952138` it is **109 passed / 0 failed / 3 skipped** (a drag-dismiss
spec and two dock specs joined), the client is 44 batches, bundle 97.28 KB, shared/server counts
unchanged.

**M4b moved them again (2026-08-10):** e2e is **115 passed / 0 failed / 3 skipped** at `9cc11906`
(six `mobile-dm.spec.ts` specs joined: tab reach, an NPC create/delete round trip by touch, fit
guards in both viewports, the armed alignment wizard). Bundle 97.18 KB — the DM chunk is still
lazy on both layouts. MainLayout 462→415 and FloatingPanelsLayout 333→180 after `buildDMMenuProps`
absorbed the DM wiring; things a DM feature now needs are wired ONCE, in that builder.

**M4b's adversarial review ran CLEAN (2026-08-10, 15 agents, `agents_error: 0`)** — unlike M4a's,
whose verifiers died. 6 findings: 4 refuted with engine-level reasoning (the chip row's
touch-action fear is wrong because used touch-action RESETS at a scroll container — worth knowing
next time that fear comes up), 1 low fixed alongside, and **1 confirmed by both refuters**:
deleting the builder's `mapStudio: props.mapStudio` line passed tsc (optional prop), every unit
suite, every characterization suite AND the full e2e while silently removing the Map Studio
section from BOTH layouts. Fixed by pinning the mapping (sentinel + identity assertion) and, for
the whole class, pinning the builder's COMPLETE key set — any dropped mapping is now a missing
key. The critic's unexamined areas, recorded not cleared: the mobile Suspense has no local error
boundary (a failed DM-chunk load bubbles to the app-root boundary and replaces the whole table —
the realistic trigger is a deploy invalidating hashed chunk names mid-session);
software-keyboard/iOS behaviour is invisible to every browser here; and MapStudioControl is now
reachable from a phone with no phone-specific coverage.

**M4c moved them again (2026-08-10):** e2e is **121 passed / 0 failed / 3 skipped** at `c58c5bbc`
(six specs joined: a finger authoring a wall on the desktop layout with a second-finger cancel, the
full mobile DM→Map→START LIVE MAP→room→wall path with a player in a second context, the palette's
fit in both phone orientations, two resize-crossing specs, and Map Studio measured on a phone).
Bundle 98.05 KB. `useMapEditTool` came DOWN from 346 to 334 despite gaining the cancel work, because
the extraction went first — `useMapEditDragPreview` (80) and `useMapEditCancel` (~90) are the two
new files. `MobileLayout` 226 → 276, `MobileFloatingControls` 220 → 244, and the new
`MobileMapEditPalette` is 176.

**M4c's adversarial review ran CLEAN (2026-08-10, 41 agents, `agents_error: 0`,
`agents_skipped: 0`, `agents_empty_result: 0`).** Six finder lenses, two skeptics per finding (one
pure refuter, one asked to write the user's path to it), then a completeness critic. **17 raw
findings, 8 survived, collapsing to 3 distinct defects** once the lenses that had reached the same
bug independently were merged. All three were verified BY HAND against the source before being
fixed, and all three were in code M4c itself had just shipped:

```
da53a370 fix(map-edit): a dropped socket looked exactly like losing DM
e3bd751a fix(mobile): map-edit could arm behind the DM screen after all
9b5f6091 fix(dm): the chunk-failure panel offered a retry that could never work
ddcc4534 fix(mobile): the abort button did nothing in the one case it exists for
```

The worst was the first: the de-elevation guard read `isDM`, which is DERIVED from the snapshot,
and **any** socket close nulls the snapshot while the app stays mounted — so a phone locking its
screen dropped the DM out of map-edit and left them out after reconnecting. The last was not a
review finding but what the critic's "the Abort button's path is never driven end to end" turned
into once it WAS driven: **Chromium generates no compat click for a second finger during an active
multi-touch sequence**, so an `onClick` abort could never fire during the drag it exists to
abandon. That one is worth carrying forward as a general fact about touch UI here.

**The critic's unexamined areas, recorded not cleared.** Two were closed by the fixes above (the
abort's end-to-end path, and the uncommitted work then in the tree). The rest stand: the click and
brush sub-tools remain reachable BY TAP on the mobile layout through the compat mouse path, and the
resize-crossing rule deliberately carries them across; the terrain-discard half of the new cancel
has no reachable caller in the shipped wiring (brushes are not armed for touch); a drag committed
while a map-studio command is in flight is dropped silently and the mobile palette has no way to
show it; the whole touch contract is verified on Chromium's CDP emulation only, because WebKit is
not installed here or in CI; nothing in the slice touches focus, announcement or modal semantics
for the new mode; and no lens considered a second DM at the same table now that Undo/Redo are on a
phone dock.

**One notable refutation, four lenses deep.** "A stray TAP with Room armed commits a 1×1 walled
room" was raised by four independent finders and refuted every time, correctly: a one-cell room is
the Room tool's minimum unit by design (`roomBoundsFromDrag` is inclusive, `buildRoomCommand`
floors at 1), it is pre-existing desktop-mouse behaviour, and the `saving` gate means the touch and
compat paths still produce exactly one. Do not re-file it.

**M4c's traps, for whoever touches this next.** Four are worth carrying forward. (1) **Touch and the
mouse path both reach the same tool handlers**, and a touch TAP generates compat mouse events while
a touch DRAG does not — that asymmetry is why only the DRAG sub-tools are armed for touch, and it is
the seam where double-firing reappears if anyone widens it. (2) **A test whose drag never moves
cannot fail**: `wallDraftFromDrag` rejects a zero-length drag, so the pre-existing Escape test was
green with the whole Escape handler deleted. (3) **An edge latch tested only from the side it starts
on is blind** — freezing both refs in `useMobileSurface` left every one of its tests green until one
crossed the boundary from outside it. (4) **A prop whose consumer treats it as optional can be
deleted silently**, which is M4b's lesson again: `MobileLayout`'s map-edit forwarding is pinned by a
complete-key-set test for exactly that reason. (5) **A boolean derived from the snapshot is FALSE
during every reconnect**, not just when the server says so — `isDM` is the one that bit, and any
new "the server told us X" guard needs to know the difference. (6) **A second finger gets no compat
click**, so a control meant to be used mid-gesture must bind a pointer or touch event.

**Baselines after the review fixes:** e2e **122 passed / 0 failed / 3 skipped**, bundle **98.13
KB**, client 44 batches, shared 414, server 2057. One unrelated desktop flake was observed ONCE in
nine full runs — `map-navigation.spec.ts › player can zoom in and out with mouse wheel` — and
passed on retry; it is outside M4c's surface and was not diagnosed.

**The player-props and vision-default slices moved them again (2026-08-12, measured at
`7a8bb703`):** shared **424** tests / 24 files, server **2108** / 110 files, client **5249
passed / 4 skipped** across 263 files, e2e **129 passed / 0 failed / 3 skipped**
(`vision-default.spec.ts` joined), bundle **~99.97 KB** gzip against the 175 KB threshold. None
of the at-ceiling files in §5 gained a line — the vision-default slice's DM control rides
`DMMenuContainer`'s inline `sendMessage` precedent, dodging `useDMContext` (347) and
`MainLayoutProps` entirely.

**`useMapEditState.ts` is now 347 of the 348 ceiling** — it joins `characterValidators.ts` (348)
and `useDMContext.ts` (347) on the list of files that need an extraction before they gain a single
line.

**M4a's adversarial review RAN 2026-08-10 and its verdict needs this caveat:** the four finder
lenses completed (9 raw findings) but **all 11 verify/critic agents died on a session limit**, so
no adversarial refutation happened and the completeness critic never ran — those angles are
unexamined, not clean. Every finding was instead reproduced BY HAND; six were real and all six are
fixed on `dev` (`34cf38d0` second-finger drag freeze, `0e15de4b` horizontal safe-area, `983ae6d2`
OFFLINE banner above screens + pointer-events, `cdfe7307` dead drawer CSS, `47cf60ec` four test
holes). Two process notes from those fixes, both now also in §5's spirit: lifting the banner
REGRESSED drag-to-dismiss and only the full per-commit gate caught it (the fix needed
pointer-events: none — and note `elementFromPoint` skips such elements, so paint must be asserted
structurally); and a strengthened assertion must be proven able to PASS as well as fail — the
first paint-pin regex never matched the healthy tree because Chromium drops the default `180deg`
when serializing gradients.

**Known-broken, pre-existing, NOT M4a's:** two of `pnpm docs:screenshots`' five walkthroughs fail —
`docs-screenshots.player.ts` "player basics" (the character-name edit input intercepts the dice-bar
click) and `docs-screenshots.dm.ts` "live map authoring" (the `Region: N × N cells` badge never
appears for the Generate step). Verified identical at pre-M4a `0441bcfd` before concluding that.
The harness is not in the §2 gate, so nothing guards it; the mobile walkthrough still passes and
the three mobile screenshots were re-recorded from it.

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

## 3. What to do next — **M4a is queued** (§3C)

The Session One arc is complete and the owner has since chosen the mobile authoring arc and
approved M4's design. **Start at §3C.** B and D below are the roads not taken; they are still real
and still unclaimed, but they are not next.

### A. ~~Re-run S8's adversarial review~~ — DONE 2026-08-08, see §0

All seven surviving defects are fixed and committed. The next decision is the owner's: B, C or D
below. **Nothing here is queued** — this is a genuine fork, not a backlog.

What is still open from the review is §11, the completeness critic's list of things NOBODY looked
at. None of it is a known defect; it is unexamined ground.

### B. A room-level default vision radius — **SHIPPED to `dev` 2026-08-11, NOT deployed**

Nine commits, `120103f8..df6e1103`, CI green (#777), adversarially reviewed. `main` has
NOT moved, so this is not in production. The plan doc
([room-vision-default-plan.md](./room-vision-default-plan.md)) now opens with a SHIPPED
block listing the three things it got wrong and the two follow-ups it left. **Read that
block before touching vision, fog, or `RoomState`** — in particular, the snapshot-payload
contract test does NOT guard the `visionSignature` cache; the pointer-relay test does.

The original framing follows, for context.

### B (original). A room-level default vision radius (~2 days)

The owner picked this slice on 2026-08-11 and the full implementation plan — verified paths,
design decisions, six-commit build order, fixture ripple, traps — is
[room-vision-default-plan.md](./room-vision-default-plan.md). What follows is the original
framing, kept for context.

S7 left this open deliberately and it is still the best next slice. A player who deletes their
ONLY token and reconnects respawns with **unlimited sight**: a radius lives on one token record
while vision is the UNION over all of an owner's tokens, and `createToken` inherits the owner's
tightest limit, which closes the ordinary "+ Add Character" path but not this one, because there
is nothing left to inherit from. Documented in `domains/token/service.ts` and the arc doc.

Closing it needs a room-level default: a new **required** `RoomState` field, persistence, a
snapshot field, and four server fixtures that build state literals (see §7). It is also probably
the feature a DM wants anyway — "this dungeon is dark" as a table setting rather than per token.

### C. The mobile authoring arc — **CHOSEN 2026-08-09; M3 SHIPPED, M4 is next**

The owner picked this fork. **M3 (mobile sheet shell repair) is done** — four commits, `7a333036`
→ `9583a176`, guarded by `apps/e2e/mobile/mobile-shell.spec.ts` and
`apps/e2e/public-table-chip.spec.ts`. Half of it turned out to be already done and two of its six
items were understated; the full write-up is in the arc doc's §4 M3, which is the thing to read
before M4.

**What M3 built that M4 stands on:** every bottom sheet now derives its height from
`--mobile-sheet-offset`, the same variable that positions it, so a sheet taller than the screen
scrolls inside the viewport instead of opening above the top of it. A new sheet gets that by
joining the shared selector list in `herobyte.css`. It was measured with 900px of injected filler,
because nothing shipped today is tall enough to reach the cap — M4's palette is the first thing
that will be.

**M4a, M4b and M4c are all SHIPPED (2026-08-09/10). M5 is next — read
[mobile-authoring-arc.md](./mobile-authoring-arc.md) §4 for M5–M8; its §4 M4 is superseded by
[mobile-shell-redesign.md](./mobile-shell-redesign.md), whose §2 carries all three SHIPPED notes.**
M4c closed the arc's Blocker 2: the mobile path can now produce the map-edit tool mode, the 17
`mapEdit*` props are no longer dropped on the floor, and a finger can author a room and a wall.

The owner answered Q3 on 2026-08-09 (**a mobile DM gets a full menu**) and asked
for a mobile-native shell — a separate screen rather than another sheet, "a more mobile focused
usable UI over the RPG of it". That doc holds the model, the three slices M4 became (M4a shell /
M4b DM screen / M4c room+wall), and — the part that saved the most time in M4b — **all 50 of
`DMMenuContainer`'s props traced back to `MainLayoutProps`, one by one.** The arc doc's own §4 M4
assumed one slice and a `MobileMapEditSheet`; it is superseded. Its line numbers are from
2026-08-01 and stale, though its file names held up.

Only **Q4** is still open (an in-app "use the desktop layout" switch), and it does not block M5.
It is worth re-asking now: a tablet DM authoring maps is exactly the user who might want the real
desktop palette, and M4c's resize-crossing spec shows the mode survives the switch cleanly.

One known mobile gap still feeds into M5+:

- **The mobile party drawer renders one row per PLAYER** and resolves it to that player's FIRST
  character, so a DM on a phone cannot reach a second character's token at all — HP, portrait and
  sight radius alike. Fixing it means making that list per-character.

_(The second gap listed here — "there is no mobile DM menu at all" — was closed by M4b.)_

### D. Smaller, real, and unclaimed

- ~~`+ ADD PORTRAIT` and the NpcCard portrait still use `window.prompt`~~ — **DONE 2026-08-14**
  (`1a0c351c`, `70b36238`). Both go through ImageField now, and NPCs gained a portrait upload they
  never had. Two non-image prompts remain and are NOT this item: `usePlayerActions.ts:296`
  (character name) and `NpcCard.tsx:214` (NPC rename).
- **Chat's SEND button is a 25px tap target** (guideline 44px). It matches every other JRPGButton
  in those panels, so it wants a deliberate panel-wide pass, not a one-button fix.
- ~~**Client-side `Math.random()` initiative rolls** remain in `hooks/useBulkInitiativeRoll.ts:76`
  and `features/initiative/components/InitiativeModal.tsx:63`.~~ — **DONE 2026-08-24** (`dev`
  `ac47ab9e`, CI #808) — neither `Math.random()` remains (the DoD grep was run).

  **Correction to what this entry used to say:** it called both "DM-only paths". That is wrong for
  the modal. `EntitiesPanel.tsx` passes `onInitiativeClick` **unconditionally** (three call sites),
  so any player can open it and roll for their own character; the SERVER is what enforces
  ownership, in `InitiativeMessageHandler.handleSetInitiative`. Still not a forgery hole — manual
  entry exists on purpose — but do not reason from "DM-only".

  **The owner chose a design for this on 2026-08-14, deferred to its own slice.** Rolls go
  server-side on the same crypto RNG as dice AND land in the roll log, so the table can see them.
  Players keep a manual override for the case it exists to serve: a bad roll, the DM allows a
  physical re-roll, the real number is entered by hand and recorded as that player's roll, with the
  superseded value struck through. The override is a DM-toggleable table setting, **on by default**.

  Four pieces of machinery to reuse rather than reinvent: `DiceRoll.breakdown[].dropped` is already
  the struck-through channel (it is how advantage renders its discard); `{ t: "dice-roll" }` carries
  a FORMULA not a result and an initiative roll must follow that rule or it reintroduces arc defect
  D2; `cryptoDiceRng` is the one RNG caller; and `set-player-props-enabled` is the exact shape of
  the DM toggle. Two traps it will hit: a new REQUIRED `RoomState` field breaks five server fixtures
  (§5 — use `/fix-fixture-ripple`), and any new snapshot collection must join `SNAPSHOT_LIMITS` or
  load-session crashes. `InitiativeModal.test.tsx:692` pins `Math.random()` as behaviour and will
  need rewriting, not deleting.

- **The dice parser accepts juxtaposition** (`"d20d6"` → two dice, no operator). Unreachable
  today — there is no free-text formula input anywhere in the UI. It becomes real the moment
  someone adds one.
- ~~`drag-preview` is queued rather than dropped while the socket is down~~ — **DONE
  2026-08-12** (`ba48e741`); it sits beside `measure` in `ephemeralTypes` at
  `MessageQueueManager.ts:119`. This bullet just was never updated.
- ~~The asset-store dedup path double-counts existing bytes~~ — **DONE 2026-08-14** (`a5059036`).
- ~~A background-task chip is queued for wiring `characterDrawings.ts` to the shared
  `DRAWING_TYPES`~~ — **DONE, and had been since §11 closed it (2026-08-09)**: the file imports
  `DRAWING_TYPES` from `@herobyte/shared` (verified 2026-08-30). This bullet outlived its fix.

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

**A job timeout reports as `cancelled`, not `failure` — and the run summary hides which.** Run
**#796** read as "cancelled" and looked like somebody pressed the button. What actually happened:
`e2e-full-suite`'s "Install Playwright browsers" hung for **29m53s** in `--with-deps` (it shells
out to apt-get, which is what stalls), consumed the job's whole 30-minute budget, and the suite
step was marked **`skipped`**. Every other job was green, so the batch looked verified when its
e2e coverage had never run at all. **Check that "Run full E2E suite" says `success` and not
`skipped`** before believing an e2e claim — and note that `Upload test artifacts` is gated
`if: failure()`, so its being skipped is independent evidence nothing failed. The install step is
now bounded at 10 minutes (`a7bfb961`); normal duration is 21s, or ~2m on a cold runner.

**You cannot push a commit that touches `.github/workflows/` from the CLI here.** The credential
is an OAuth App token without the `workflow` scope, and the push is rejected outright — nothing in
the repo can fix it. **GitHub Desktop can** (the owner installed it 2026-08-18 for exactly this);
push that one commit from its top bar. Two things to know: in that window the Changes tab lists the
owner's ~87 untracked `temp/` files **pre-checked** under a "Commit N files to dev" button — do not
touch it — and the rejection does **not** recur on a later merge, because GitHub only blocks a push
that introduces a NEW workflow blob. So `main` merges and pushes normally from the CLI afterwards.

**A local bundle hash can never match production's, so do not probe a deploy that way.** The client
bakes in `import.meta.env.VITE_WS_URL`, which is set in the Cloudflare dashboard; there is no
`.env.production` in the repo, so a local `pnpm build` omits it and content-hashes differently
(`index-BOgYtKle.js` local vs `index-C27sMvnF.js` live, 2026-08-18 — a mismatch that means
nothing). **Probe with a DISCRIMINATING string instead**: one whose presence differs between the
outgoing and incoming production commits, which `git grep <string> <old-sha>` settles before you
fetch anything. Pair it with a **control** string that should be present either way — if the
control also reads zero, the method is broken and the marker's zero is meaningless. And grep
**every served chunk**, not just the entry bundle, or a string that merely MOVED into a lazy chunk
reads as removed: fetch `assets/index-*.js`, extract the chunk names it references, download those
too (10 files / ~1.14 MB on 2026-08-18). Worked example in that deploy: `"Enter image URL"` and
`"Enter portrait URL"` existed at the outgoing `c0b6e648` and were deleted by the batch → 0 hits
across all 10 files, while controls `"Apply Portrait"` and `"Portrait Image URL"` returned 1 each.
**Render 502s for ~15s after the push** — that is its restart, not a failure; poll until 200.

**The 350-LOC guard** flags `content.split("\n").length >= 350`, i.e. `wc -l >= 349`, so **348 is
the real ceiling**. `__tests__` files are exempt; source files are not — and **e2e specs are NOT
exempt** (M4a learned this at 374 lines: `mobile-shell.spec.ts` had to split off
`mobile-dock.spec.ts`). It fails only on NEW violators. `prettier --write` EXPANDS files —
re-check LOC after formatting. Live headroom on files near the line, re-measured 2026-08-09 after
M4a. **Two are within one line of the ceiling** — `characterValidators.ts` **348**,
`useDMContext.ts` **347** — so either needs an extraction before it gains anything at all.
`MobileLayout.tsx` is no longer one of them: M4a's extraction took it 347 → 219, and M4c's
forwarding put it back to **276**. **`useMapEditTool.ts` was the third file within two lines of the
ceiling (346) and M4c had to extract before it could add anything** — it is **334** now, with
`useMapEditDragPreview.ts` (80) and `useMapEditCancel.ts` (90) carrying the difference. Re-measured
2026-08-10: `NPCEditor.tsx` 333, `mobile-shell.spec.ts` 345, `mobile-dm.spec.ts` 291,
`MobileLayout.tsx` 276, `helpTopics.ts` 301, `Header.tsx` 262, `mobile-map-edit.spec.ts` 241,
`MobileFloatingControls.tsx` 244, `NPCsTab.tsx` 235, `MobileMapEditPalette.tsx` 176. **`mobile-shell.spec.ts`
at 345 is three lines from the ceiling** — the next mobile-shell spec goes in a new file, as
`mobile-dock.spec.ts` and `mobile-map-edit-resize.spec.ts` already did. Already over and
baselined (extract, don't grow): `layouts/props/MainLayoutProps.ts` 432,
`domains/character/service.ts` 376.

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

**A PIPE HIDES THE EXIT CODE, and it bit twice in one session.** `cmd | tail -40` reports
`tail`'s status, not `cmd`'s. A WebKit run that failed a test printed `exited with code 0`, and
later `pnpm format:check | tail -2 && git commit` committed an UNFORMATTED file because the `&&`
saw a zero from `tail`. Capture the real one — `cmd > log 2>&1; echo "EXIT=$?"` — and read the
summary line as well. This is the same family as the flaky-test note below and the `cmd | tail`
warning M4a already recorded; it keeps recurring because the masked run looks green.

**Do not run `node scripts/run-e2e.mjs` directly.** It spawns `pnpm` without a shell, so on
Windows it dies with `spawn pnpm ENOENT` before running a single test — and prints a plausible
"HeroByte ports are free" first, so it reads like a successful no-op run. Go through
`pnpm test:e2e ...`, which puts pnpm's shim dir on PATH for the nested spawn. Two "re-runs" that
proved nothing were lost to this.

**The 44px touch floor is ONE shared selector list**, near the top of `herobyte.css`:
`.mobile-dock-button, .mobile-tool-sheet__button, .mobile-tool-sheet__close, .mobile-chip`. The
per-class rules further down (`.mobile-chip`, `.mobile-screen__close`, `.help-panel__link`) are
narrower overrides. The map-edit sheet's dials are `.mobile-tool-sheet__button` — deliberately, so
the floor "cannot be lost by editing this file" (`MobileSwatchRow`'s own header says so). **A
sabotage aimed at `.mobile-chip` to prove a dial-size assertion can fail stays GREEN**, and reads
exactly like a vacuous test when the test is fine and the sabotage simply missed. Suspect the test
first, per §8 — but confirm the sabotage reached the code path before concluding anything.

**A flaky test reports as a PASS.** Playwright retries, so a failure that clears on the second
attempt prints `1 flaky` and still exits 0 — and `pnpm test:e2e` looks green. Read the summary
line, not the exit code. Re-running the gate on 2026-08-09 turned up exactly one:
`vision-radius.smoke.spec.ts` found its explored-fog entry with a bare prefix match, which also
matches `exploredFogStore`'s own LRU index key — and **Chromium does not enumerate `localStorage`
in insertion order**, so writing the mask first did not make it come first. Measured over 60
trials: the index won 7 times (~12%), throwing inside `atob()` every one of those. Fixed in
`5f93db94`. The general shape — a prefix that matches more keys than you meant, ordered by
something you assumed — is worth checking wherever a test picks a key out of storage.

**A client build running DURING the e2e fails almost every test, and it looks exactly like a
systemic regression.** Playwright's webServer serves the client; a concurrent `pnpm build`
rewrites the `dist/` underneath it, and from then on every test dies at the ~30.5s default
timeout across totally unrelated features (dice, voice, reconnect), then at 0ms once the run
gives up. On 2026-08-11 this happened twice and cost over an hour. **The cause was asking the
`gates-runner` agent for a "client bundle gzip size" alongside `e2e`** — that figure is not part
of the ladder, so the agent satisfies it with an extra build and has twice overlapped the two.
The proof is in the log timestamps (`.tmp/gates-*/`): `11-client-bundle.log` written 18:49 while
`10-e2e.log` ran 18:48→19:48; the runs that PASSED had the build as an earlier numbered step than
e2e. **Ask for e2e or a bundle figure, never both in one prompt.** Two corollaries: a mass e2e
failure across unrelated features is a HARNESS fault until proven otherwise (re-run one named
failing spec alone — if it passes in seconds, the suite result was environmental), and a collapse
can orphan `node` on 5175/8788, so check those ports before re-running.

**Correction to `7fb0bc7e`'s commit message:** it blames the first of these collapses on resuming
a gate agent whose e2e was still in flight. That was wrong — it was the concurrent build above.
Resuming a mid-e2e agent is still a bad idea (it starts a second run against the same ports), but
it was not the cause.

**You cannot push `.github/workflows/*`.** Git here uses Git Credential Manager over HTTPS, and the
stored token is an OAuth-app token issued WITHOUT the `workflow` scope. GitHub then refuses the
whole ref update — not just that file — with `refusing to allow an OAuth App to create or update
workflow ... without workflow scope`. **The owner hits the identical rejection from their own
PowerShell**, because it is the same cached credential, so "just push it yourself" is not a fix.
What works: put the workflow commit LAST, `git push origin HEAD~1:dev` to land everything else,
and have the owner paste the change into GitHub's web editor (the browser session is not bound by
the token's scopes). Watch for the web editor auto-indenting the first line of a pasted comment
block — harmless in YAML, but it will not match your local copy byte-for-byte.

**Never write a repo file with Python's text mode.** `io.open(p, "w", encoding="utf-8")` translates
`\n` to `\r\n` on Windows, so a one-line patch silently rewrites the whole file to CRLF. Prettier
did not object, and `git diff --stat` still looked like a one-line change because `.gitattributes`
normalises on the way in — but vitest reads the WORKING COPY, and
`MobileFloatingControls.test.tsx`'s `(?<!,)\n` lookbehind then matched a different CSS rule and
three assertions went red for a reason that had nothing to do with the change. Pass `newline=""`,
or read/write bytes.

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
- Launch is a **friends-scale soft launch**. `uid` is still client-asserted on the wire, but since
  the session identity binding arc (2026-09-19, `dev`) a LIVE session belongs to the socket that
  proved its session token: a second socket claiming the uid is held, its messages dropped, and it
  cannot evict or impersonate the real one without the token; a tokenless reclaim of an OFFLINE uid
  comes back as a non-DM. The remaining residual — a room-password holder claiming a fully offline
  uid after the 6-hour grace, as a non-privileged impersonator — is documented at
  `domains/room/snapshot/recipientFilter.ts` and is the deferred opaque-identity arc, not a
  vulnerability to re-flag.
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

1. `git log --oneline -3 && git status --porcelain | grep -v 'temp/'` — confirm you are at or
   just past `a7bfb961` on `dev` with a clean tree. (Use `grep -v 'temp/'`, not
   `grep -v '^?? temp/'`: three of the owner's untracked files have spaces in their names, so git
   quotes them and the anchored form misses them.)
2. Read the **SHIPPED banner** atop
   [room-vision-default-plan.md](./room-vision-default-plan.md) and §5's newest trap (the
   concurrent-build e2e collapse) before touching vision, fog, `RoomState`, or the gates agent.
3. Run the full gate once (§2) to confirm the 2026-08-12 baselines still hold, and **boot
   `pnpm dev`** (§7) if anything in `packages/shared` will change.
4. The fork is the owner's, and nothing is queued. ~~Push `dev` and merge to `main`~~ — **DONE
   2026-08-18**, see §0; both branches are pushed, both runs green, production probe-verified.
   What remains:
   - ~~**Initiative → server-side + roll log + manual override.** Owner-chosen design, 2026-08-14;
     the full shape and the machinery to reuse are in §3D. This is the biggest _user-visible_ item
     outstanding.~~ — **DONE — see the §0 update (2026-08-24)**.
   - ~~**Mobile element removal — the Select half of M8.**~~ — **IN PRODUCTION 2026-08-26**
     (merge `6a605af4`). The affordance is a Select mode in the map-edit tool sheet; the "dock is
     pinned at five slots" blocker never applied, because it never needed a dock slot. Plan and
     the traps it cost: `docs/planning/PROMPT-mobile-element-delete.md`.
   - ~~**Physical dice / hand-entered rolls.**~~ — **IN PRODUCTION 2026-08-26**. Every roll can be
     hand-entered, before rolling or over a result, desktop and mobile. `{ t: "enter-roll" }` is
     the one client message carrying a RESULT; safety is the `handEntered` MARKER, not trust.
   - ~~**Element proximity selection — IN PROGRESS.**~~ — shipped to `dev` (`4b6cc7f9`). Five of
     the eight kinds (wall, door, light, text, spline) could not be selected and so could not be
     deleted, on any platform. Plan: `docs/planning/PROMPT-element-proximity-select.md`.
   - ~~**M6, M7 and M8** of the mobile authoring arc~~ — **DONE 2026-08-27, the arc is
     COMPLETE, and it is IN PRODUCTION 2026-08-29** with the nine fixes its adversarial
     review produced; see §0.1. With them: ~~the vacuous initiative e2e~~, ~~the last two
     `window.prompt()` dialogs~~ and ~~the 44px panel-wide pass~~. **What is open here now is
     fork C too** — ~~the `docs:screenshots` failures plus the wrong Map Setup shot~~,
     ~~the `TokenMessageHandler` recolour flake~~ and ~~My Stuff uploads in the mobile asset
     picker~~ are all CLOSED (2026-08-29, `a008bcf5`/`50977c48`/`bf02f9fe`, IN PRODUCTION
     2026-08-29, CI #822/#823). `pnpm docs:screenshots` passes all five walkthroughs for the first time. That
     file's UPDATE block has the three diagnoses, each of which was a different bug from the
     one its symptom named.
   - **Smaller work**: §3D's remainder. Of the vision-default follow-ups, two are DONE (the
     per-token card now reads "Table default — 60 ft"; the 44px pass covers the DM menu) and ~~the ONE that
     remained — the Map Setup screenshot~~ is **DONE with fork C (2026-08-29, `50977c48`)**:
     the shot is two anchored frames now, `dm-menu-map-sight.jpg` shows the Table Sight
     Default control, and the strict-mode `getByText("saving…")` failure is fixed —
     `docs:screenshots` passes all five walkthroughs.
     ~~Prove the `ref: dev` fix~~ — **DONE 2026-08-26**: runs #798,
     #808 and #811 could none of them prove it, each being a push TO `dev` where the old hardcoded
     ref and the new event-ref default resolve to the same SHA. The merge-to-main run (**#814**,
     `6a605af4`) discriminates, and its `e2e-full-suite` checkout logs
     `rev-parse refs/remotes/origin/main -> 6a605af4` — main, not dev's `720443ab`.
   - ~~**The Atlas arc (VISION Pillar 1 / M4 phase 2)**~~ — **COMPLETE on `dev` 2026-09-01** (seven slices A1–A7, each gated + sabotage-proven + browser-verified on both platforms; see §0's dev row and the plan's SHIPPED banners). What it opens next, per the plan's §7: building-interior recipes cashing town promises, the one-keystroke Kicked-In Door (its Atlas targets now exist), reroll-preserving-pins (`pinned` — provenance already recorded), player-initiated travel/knocking, arrival at the link anchor, art-track link sprites, a spatial world-map view. **The next agent's handoff prompt is [PROMPT-kicked-in-door-arc.md](./PROMPT-kicked-in-door-arc.md)** — the Kicked-In Door + building interiors is the recommended arc (the owner may redirect), and its §7 carries the owner's standing instructions for prompting Claude Fable 5.1. **Update 2026-09-02:** the plan is written — [kicked-in-door-arc-plan.md](./kicked-in-door-arc-plan.md) Rev 1, recon-grounded (six pinned-model readers; every quoted anchor re-verified at HEAD), adversarially REVIEWED before execution — Rev 2 records the 16 findings (8 confirmed by both refuters, 4 contested, 4 refuted) and their dispositions in its §9; four lens-sized workflows, 36 agents, every lens finished with `agents_error: 0` after the session-limit deaths were RESUMED. **K0 SHIPPED** (six commits, see the update atop §0); **K1 SHIPPED** (2026-09-03, five commits + three review fixes — the plan's K1 banner and
     its §9.1 review record); **K2 SHIPPED** (2026-09-06, three commits — the plan's K2
     banner); **K3 SHIPPED** (2026-09-06, three commits — the plan's K3 banner); **K4 SHIPPED** (2026-09-06, two
     commits — the plan's K4 banner); **K6 SHIPPED** (2026-09-06 — the journey spec, the budgets, the
     user-guide debt); **K5 (Cartridge Codes) DEFERRED to the plan's §7.** **The arc is complete.** The Atlas review's missing `mobile-surface` lens RAN first, alone (12 agents, `agents_error: 0`): 4 findings confirmed by both refuters, 1 refuted — they are the plan's K0, four production bugs fixed before the arc starts.
   - **FIXED 2026-09-08 — `PUBLISH TO LIVE MAP` was publishing the WRONG DOCUMENT and blanking the
     table.** The button published `controller.activeDocument` — whatever the Map Studio list had
     SELECTED — which after a kicked-in door is the map the DM LEFT, not the one the table is on.
     The server compiled that document into `state.compiledScene`, cleared `mapElements`, dropped
     `mapTerrain`, stored its baked background — and never touched `liveMapDocumentId`, leaving the
     binding on one document and the scene on another (nothing on screen but the bounding box and
     the staging zone, no error). The fix is Fable 5.1's (b)+(c)+(a), all three:
     - **(b) binding and scene never part.** `map-studio-publish` moved out of the 345-line handler
       into `mapStudioPublish.ts` and now rides `travelToDocument` — the ONE suspend/resume
       composition, the same road set-live and atlas-travel take. A publish is a travel with a
       raster on top: it captures the outgoing scene, installs the destination, and sets
       `liveMapDocumentId` to what it compiled. The split is now unreachable.
     - **(c) the Studio follows the live pointer even with the palette CLOSED.**
       `useFollowLiveDocument` was gated on `mapEditMode`; that gate is gone, because the DM menu's
       Studio panel reads the same active document and the palette is usually shut when a DM opens
       Map Setup after a kick. The active document now follows travel/publish, so the button acts
       on the map the DM is standing on.
     - **(a) a publish that would REPLACE the live scene confirms first,** naming both maps and
       saying the old one is still reachable by travel (`publishGuard.ts`). Publishing the map the
       table is already on is a bake and asks nothing.
       Re-pinned four contracts that encoded the old split (`sceneTravel`, `atlasKick` incl. the
       retired PUBLISH-BURN row, `liveMapDoorPreservation`, the handler unit test) and added five new
       pins (the guard both ways, the bake, the palette-closed follow, and the whole
       bag->container->menu->tab->control threading via the REAL container). Sabotage 9/9 red after
       two vacuity fixes (a walls-only doc derives no scenery to clear; the threading needed the real
       container, not a layout stub). LIVE-CHECKED in a browser: the Studio followed origin->dungeon
       (showed the dungeon's 211 elements) and a bake asked nothing — but the confirm dialog and the
       accepted server-swap could NOT be exercised locally because asset uploads have no server in
       the dev preview ("Upload failed"); those rest on the contract/component pins. NOT the
       Kicked-In Door arc; the map-studio publish path, fixed under fix-bugs-regardless-of-origin.
       **On `dev`, NOT pushed — the owner's merge call.**
     - DEAD HYPOTHESES from the diagnosis, kept so nobody re-runs them: the 8192x8192 canvas is not
       too big (paints + encodes fine, 1.27 MB PNG); the tile atlas is not missing (production
       serves it 200). And travel to the node does NOT no-op — `alreadyThere` needs binding AND
       scene to agree, and publish is exactly what parts them, which is why travel was the owner's
       recovery.
   - **DONE on `dev` 2026-09-09 — keyboard movement, all three slices** (see the §0 update and
     [keyboard-movement-arc-plan.md](./keyboard-movement-arc-plan.md)): one cell per press +
     phone d-pad; hold-to-walk at a bounded cadence; the movement budget with the diagonal rule,
     nameplate readout, turn-start reset and DM-set speed; review rounds 1 and 2 fixed
     (`316c295a`, `b2a0cb20`), and on the way the initiative modal's false "timed out" on a
     hand entry equal to the roll on file. **MERGED and IN PRODUCTION 2026-09-10 (`e42d60bf`,
     CI #857).** The owner's three follow-up calls are decided (§0, 2026-09-10): F1 the camera
     follow — DONE on `dev` 2026-09-10, NOT merged to `main`; F2 a DM reset-budget control with the budget staying
     ADVISORY — DONE on `dev` 2026-09-11, NOT merged; F3 a DM-owned character with an initiative is a combatant regardless of
     `type` — DONE on `dev` 2026-09-11, NOT merged (the shared rule admits it once rolled; the
     server's private copy deleted; it stands in the visible order; redaction stays on `type`).
     **F1–F3 MERGED and IN PRODUCTION 2026-09-13 (`41ca0106`, CI #863) — see the §0 update;
     from item 4 the owner queued only the own-token WASD fallback — DONE on `dev` 2026-09-13 as
     Follow-up F4, NOT merged (§0).** The original queue note follows.
     ~~QUEUED BY THE OWNER 2026-09-08~~ — keyboard movement, one square per press, with sight and
     movement following it. WASD and the arrow keys move the SELECTED token — or any selected
     item, so it serves the DM moving an NPC or a prop too — by exactly one grid cell. Three
     reasons it is worth more than the convenience: it makes the fog and line-of-sight work
     legible, because today the cone only updates when a drag is RELEASED and a per-press move
     would redraw it square by square; it is the natural home for a **movement budget that ticks
     down per square**, which the owner wants built at the same time; and the keys are free — the
     client currently binds only Enter, Escape, z, y, r, g, Delete, Backspace and modifiers, so
     nothing has to be rebound. Design notes gathered when it was queued, none of them settled:
     the per-press move is an ordinary `move` message, so fog updates fall out of the existing wire
     rather than needing a new one, but it is one server round trip and one recipient re-filter PER
     PRESS — hold-to-repeat needs a think, and a sight radius makes fog dramatically cheaper on a
     big generated map. A movement counter MUST honour the table's diagonal rule (5e / Pathfinder /
     Euclidean are all live settings), so a diagonal press is not always one square of budget. It
     needs the `isEditableTarget` + no-modifier + no-`event.repeat` guard that invariant 4.17 of the
     Kicked-In Door plan established for `G`, or WASD will fire while a DM types a node name. And
     the budget wants a per-turn reset, which lands it next to initiative and M5's Battle Strip.
5. Stop before merging to `main`. That is the owner's call, and it deploys.

**Note (2026-08-26):** this section has now gone stale twice in one week — both times because the
work it described as outstanding shipped, and nobody rewrote §0's table. If you finish something
here, correct §0 AND this list in the same commit; the doc's whole value is that the next session
trusts it.

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
