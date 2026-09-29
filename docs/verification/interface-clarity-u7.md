# U7 — Party is compact; a character is not a player seat

Status: **accepted by the owner and committed on `dev`, 2026-09-29, then pushed to
`origin/dev`.** Review stopped at the round cap (round 3 FAIL); the owner chose “repair
all, verify” with no fourth round. Every round-3 item is repaired, the ladder re-run
green and the table re-evaluated live (8.4 / 10) — see
[Repairs after round 3](#repairs-after-round-3).
Bugs found on the way — before the review and by it — were fixed first, each in
its own commit on `dev` (below), pushed with U7.

## What U7 changes

Audit findings IA-15 (the card area and the floating World/Props launchers
obstruct play and settings) and IA-20's U7 half (small unlabeled or hover-only
controls; clipped portrait instructions).

**Desktop Party is a compact roster.** The bottom panel (was “Entities”) opens as
one row per **character** — never per player seat — in the panel's existing order:
the DM's bench first, then the party and the NPCs (the party before the NPCs until
anyone rolls; once anyone has, everyone together by initiative).
A row shows the portrait, the name, a tag (**You**, **DM**, an NPC's stance, or — on
another player's character named differently from their seat — the seat's name),
**Turn**/**Init N** in combat, HP with a thin bar (a withheld monster's numbers stay
withheld: *Bloodied*, *Healthy* or *HP ???*), a condition summary (the first
condition's emoji and name, “+N” for the rest, and an accessible label listing all
of them) and **🎯** (focus the map on that character's token; a character with no
token says so instead). Rows scroll sideways and never wrap, so the panel's height
does not grow with the party.

**One inspector.** Selecting a row opens that character's existing card — the same
wiring the full cards use — in an inspector to the right of the rows (so no row
moves under the pointer). One character at a time; selecting another row switches
it, the same row or its **✕** closes it, and **Escape** closes it as a content panel
in the §3.1 ladder (after any settings window or modal above it, never ahead of a
canvas gesture) and returns focus to that character's row — the row itself, not
whatever held focus when the inspector last mounted (a Cards/Roster switch remounts
it). A selected character that leaves the roster (deleted, hidden, fogged) clears
the selection, so its details do not reopen by themselves. **▦ Cards** shows every
full card at once (the old view); **☰ Roster** returns; **▼ Hide party** folds the
panel to its bar.

**The Party bar reserves the launchers' space (IA-15).** 🗺 WORLD and 📦 PROPS (players)
and 🛠️ DM MENU (the DM) render into a dock at the right of the bar instead of floating
over the bottom-right cards. The dock is a required input of every window-presentation
launcher (a discriminated `LauncherPresentation` type), so a launcher cannot silently
fall back to floating. The bar, dock and turn controls stay up while the panel is
hidden.

**The map follows the panel.** The canvas's bottom edge is set from the panel's
height. Before U7 the panel announced a height change only when it was hidden or
shown, with a synthetic window `resize`. U7's panel changes height by itself (roster or
cards, details open or closed, a row re-wrapping), and a window `resize` cancels any
in-flight map gesture and pending focus return (`useToolContextTransitions`); so it
now observes its own box and announces a named event (`partyPanelSize.ts`), and
opening details or a remote HP change that re-wraps a row never cancels a DM's stroke.

**Character vs Token settings.** Both settings windows are now two named sections:
**Character** (name, portrait, token art, status effects, initiative, the character
file, add/delete character) and **Token settings** (size — for the token's owner, and
since `bf0e982a` for the DM on any token, as the server has allowed since `087a8bdd` (2026-08-11); for the DM
also sight radius, movement speed, lock and Delete Token; for an NPC, Place Token,
size and lock). The token controls moved into `TokenSettingsSection.tsx`.

**Role is not a character setting — a deviation for the owner.** The plan says
“Move role and table controls out through U9; until then provide a forwarding
shortcut.” **Nothing forwards.** What ships is the DM Mode control itself,
unchanged (label and password flow), moved out from among the character and token
settings into its own **Table role** section at the end of the viewer's own
character window (“Your role at this table, not this character's”), on desktop and
phone. U9 gives role a Table home. The owner accepted this as the interim until U9
(2026-09-29). No other table control lived in the window. The character file's Save/Load stays in Character: since `2727ecb9` it
carries the character's own name, HP, portrait, token and conditions — plus every
drawing of the seat, which is the seat's; its “Player State” label is U9's
scope-naming work.

**NPCs.** The DM's NPC window gains a **Status Effects** picker (the server always let
a DM set an NPC's conditions, and the map draws them, but no NPC editor offered them).
The client's legacy condition mirror never copies an NPC's conditions onto the DM's
own list (an NPC the DM placed can carry the DM's uid); since `561bc77c` it writes
the seat's list only for the sender's *sole* player character.

**Added after round 3** (2026-09-29) — two by the owner's decisions, one a round-3 repair:

- **A DM edits a player's HP** — current, max and temp — from the character's card and,
  on a phone, from its row. The server always allowed it; the card offered it to the
  owner only.
- **Ownership where allowed.** Token settings gain an **Owner** select for the DM on a
  player character. A new `set-character-owner` message moves the character *and its
  token* to another seated player, so who may move it, whose fog it lights and whose
  “You” row it is all follow. The server refuses a player's request, an NPC, a uid
  with no seat, and a no-op. Desktop and phone.
- **An NPC's conditions and 🎯 Focus in the DM menu's NPC editor** (the round-3 phone
  parity finding) — the phone's only route to either (its Party lists seats, not NPCs). Focus shows only while the NPC's
  token is on the current map, and on a phone it closes the DM screen.

**Phone Party lists characters under their seat.** The Party screen shows one
section per player seat — you first, then the DM, then everyone alphabetically —
headed by the seat's name (“(you)”, “· DM”, “· N characters”), with that seat's
characters beneath it in creation order. Each character row gains **🎯 FOCUS**, which
closes the screen and centres the map on that character's token. The row's
conditions editor moved into `MobileRowConditions.tsx` (its owner-or-DM gate now
lives at the one call site) to make room under the 350-line guard.

**IA-20 (U7 half).** The portrait empty state no longer inherits the global button
rule's uppercase pixel type (which clipped “Click to upload one, or paste a URL.”):
it reads **+ Add portrait / Upload or paste a link** in body type that wraps, and
another player's empty portrait says **No portrait yet** instead of the misleading
“Portrait Pending”. The settings window's **Character Name** label is now associated
with its input (a screen reader announced an unnamed field). Roster rows have 44 px
targets on coarse pointers and visible focus rings.

**Extraction first (§4.1).** The desktop panel rendered the full player card from two
hand-kept ~150-line copies (the DM's bench and the party order); they are now one
`PartyCharacterCard` (plus `PartyNpcCard`), proven by the existing EntitiesPanel
suites before any behavior changed (22 files / 670 tests unchanged and green).
`EntitiesPanel.tsx` fell from 814 lines at the U7 base (835 at HEAD after the fix commits below) to 332 in the tree, and `PlayerSettingsMenu.tsx` from 526 to 474 (all counts `wc -l`); every new TS/TSX file is under 350. (The guard reads `.ts/.tsx/.js/.jsx` only; `party.css` is 397 lines.)

### Bugs fixed on the way (own commits)

- `ccd18b82` **fix(party): a character's temporary HP is its own on the cards.** The
  desktop card displayed the *player*-level temp HP, so temp HP entered on a character
  never showed, and dragging the HP bar sent the player's value back as the
  character's; the phone list painted a legacy value onto a second character.
- `feeaaed6` **fix(map): a token wears its own character's conditions, as its card
  does.** Token badges fell back to the owner's player-level list, so a player's second
  character wore its sibling's conditions on the map, and a DM clearing a player's
  condition left the token badged.
- `c296ff1c` **docs(dm-guide)**: the guide claimed a DM edits a player's HP from their
  card; the card offered HP editing to its owner only. The owner then decided a DM
  does edit it (after round 3): U7 widens the card and the phone row, and the guide
  says so again.
- `00566c70` **fix(party): an NPC's Party card acts for the DM again.** Since the DM
  menu's extraction (`60d22d65`, November 2025) MainLayout passed the Party
  `onNpcUpdate`/`onNpcDelete`/`onNpcPlaceToken` as `undefined`, so every HP, name,
  art, Place Token and Delete NPC edit on an NPC's card silently did nothing. U7's
  “DM can do the NPC equivalent” bar could not pass without it.

Found by the round-1 review (all older than U7's tree, or in the fixes above), each
with a test that failed first:

- `2727ecb9` **fix(party): a character's save file carries its own conditions** — it
  saved the seat's legacy list (with two characters, whichever was edited last).
- `31dcea40` **fix(npc): clearing an NPC's temp HP or token art sticks** — a clear
  went out as `undefined`, which the whole-record merge refilled with the old value
  (Party card and DM menu); and every DM-menu edit of an NPC with no art waited out
  the five-second timeout (`null` on the wire vs `undefined` expected).
- `0ee4ce4d` **fix(party): a quick second NPC edit no longer undoes the first** — the
  second whole-record send was built from the snapshot the first was sent from.
- `561bc77c` **fix(conditions): a deleted sibling's conditions stay deleted** — new
  player characters start with their own empty list; the mirror writes the seat's
  list only for a sole character.
- `ef4a7292` **fix(phone): leaving the EDIT name field no longer reverts a rename.**
- `209b603d` **fix(party): losing DM rights closes the windows the server now
  refuses** — the phone's EDIT sheet on another's row, and the initiative dialog.
- `bf0e982a` **fix(tokens): token size is offered wherever the server allows it** — a
  DM on a player's card, and phones at all.
- `9ed2e7fa` **fix(party): a seat's old portrait is only its sole character's.**
- `049d49a4` **test(party)**: the Party's NPC delete wiring and a DM-owned NPC's badges.
- `f417b334` **fix(conditions): a character's old conditions survive its player adding
  another** — found while fixing `561bc77c`: a character saved before characters had
  their own list lost its conditions from view the moment its player gained a second
  character (the seat fallback is a sole character's only); claiming a second now
  makes the seat's list the first one's own.
- `573d9da7` **refactor(npc): one rule for what an NPC edit sends to clear a field** —
  `31dcea40`'s clear rule, written out in both NPC editors, now lives once in
  `npcUpdate.ts` with its own tests; it also brought the Party's `NpcCard.tsx` back
  under the 350-line guard with U7's conditions picker in it (below).

Found by the round-2 review, each with a test that failed first:

- `204c3e0b` **fix(party): loading a player's file never replaces the loader's
  drawings** — `sync-player-drawings` carries no owner, so a DM loading a player's file
  lost every drawing of their own.
- `274baa23` **fix(party): loading a file no longer puts a character into
  initiative** — the modifier rode `set-initiative` with `initiative: current ?? 0`.
- `56ef4cff` **fix(dm-menu): an NPC's half-typed fields survive unrelated table
  activity** — the DM menu's editor re-filled on the object, new every broadcast.
- `375e049c` **fix(conditions): tables saved before 561bc77c stop resurfacing a
  sibling's** — every player character without a list gets one at all three load doors.
- `e58c5d88` **fix(characters): a sole character keeps its seat's temp HP and
  portrait** when its player gains a second.
- `1915dc7b` **fix(party): a DM's windows stay closed when DM rights come back** — the
  card's settings, an NPC card's settings and HP editors, the phone's Manage Status.
- `6010b536` **fix(party): a refused NPC edit no longer rides every later one** — a
  regression of `0ee4ce4d` (each steered send restamped the clock); NPC name inputs
  stop at the server's 50.
- `b091373a` **fix(party): an NPC's Focus waits for its token to be on the map** (NPC
  tokens are scene-local).
- `73ba410d` **fix(phone): a phone adds a character, and its DM locks and deletes
  tokens.**
- `94e06c21` **refactor(persistence): one coercion for a loaded room's seats** — brought
  `StatePersistence.ts` (pushed over the 350-line guard by `375e049c`) back under it.

Found by the round-3 review (the owner chose to repair all), each with a test that
failed first:

- `b1e9344a` **fix(dm-menu): an NPC edit made while another saves is sent, not
  dropped** — the P2 regression of `56ef4cff`: the menu held one in-flight slot, so a
  second NPC's edit was refused silently and, with the fields re-syncing on values,
  kept looking saved. Edits now queue per NPC.
- `5df6516f` **fix(initiative): a loaded file restores the modifier alone** — a new
  `set-initiative-modifier` (DM or owner, −20 to 20, writes only the modifier), so a
  file loaded after END COMBAT no longer restarts combat on that character's turn, and
  none writes a public manual-entry line mid-combat. `274baa23` had narrowed this; it
  could not close it without a modifier-only message.
- `7aac7f31` **fix(characters): a seat's temp HP and portrait move to its first
  character** — `e58c5d88` copied them, so they resurfaced on a later sole character.
- `90f95f3c` **fix(session): a loaded file's legacy lists settle against the file's
  seats** — the session door settled after the live merge (a regression of `375e049c`).
- `303965a0` **fix(party): portrait fields follow the server** — the Party NPC card's
  portrait and token-art fields and the phone EDIT sheet's portrait never re-filled, so
  a blur re-committed a stale URL.
- `659a2219` **fix(party): an NPC's Lock and Size wait for its token to be on the map**,
  as its Focus does since `b091373a`.
- `30da5509` **fix(party): a player is offered no NPC settings gear** (it rendered,
  disabled).
- `4c2acfc1` **fix(phone): a seat with no character lists no editors the server
  refuses** — after a DM cleared an offline player's only character, the phone kept a
  stats row for that seat.
- `cb7ff1d0` **test**: the round-3 test-strength items that pin committed code (see
  [Proof](#proof-the-tests-can-fail)).

Found by the live evaluation after round 3, with a test that failed first:

- `f494c655` **fix(party): a read-only portrait is a “Portrait”, not a “Player
  portrait”** — the frame shows on every card the viewer cannot edit, NPCs' included,
  so a screen reader called a monster's portrait a player's.
- `2689cf53` **fix(party): an HP number is a 44px target on a touch screen** — the
  editable HP numbers were ~10×11 px underlined spans on a phone's Party row, outside
  the touch floor's rules and unreachable by keyboard. They are buttons named for what
  they set (“Set current HP: 42” — not “Edit…”, which a row's “⚙️ EDIT” already is),
  styled as before; on a coarse pointer each is a 44 px box of its own, side by side,
  so current and max (~30 px apart) cannot steal each other's taps. The owner asked for
  it after the round-3 report (it had been proposed as a follow-up).

Two commit messages overclaim; the commits are local but are not rewritten, so they
are corrected here. `73ba410d` says the phone's new list props are all required, so
none can silently unwire: `onPlayerTokenDelete` stayed optional until the round-3
repair made it a required key. `204c3e0b` says the rest of a loaded file, token
included, restores “through the character-scoped messages”: name, HP, portrait and
conditions do; the token's colour, art, size and position restore through token
messages keyed by the card's token id.

HEAD `049d49a4` (the fixes without U7) was verified on its own from an export of
the committed tree: client and server typechecks clean; server 161 files / 2,739
tests; client 474 of 477 files green — the help-links test needs `docs/` in the
export and passes with it (15/15), and two DM-library tests hit their 5 s timeout
while other suites shared the CPU and pass alone (9/9). That covered the first 13
fix commits; each later one was verified by its own suites from an export of the
staged tree as it was committed.

HEAD `cb7ff1d0` — all 34 commits since the U7 base, without U7's tree — was then
verified on its own after the round-3 repairs, from an export whose `@herobyte/shared`
resolves to the export's own build (the tree's new `set-character-owner` cannot leak
in): shared build and 29 files / 452 tests; client and server typechecks clean;
server 162 files / 2,760 tests; client 481 files passed and 3 skipped (the benchmark
files) / 7,204 tests. `f494c655`, committed after that, was checked the same way: the
client typecheck clean and the players and layout suites green (37 files / 786 tests).

## Measured bars

| Bar (plan U7) | Result |
| --- | --- |
| 1366×768, ordinary header, collapsed roster: map ≥ 60% of viewport height | Before (3 cards): header ends 132, panel starts 480 → **348 px, 45.3%**. After (9 rows): **66.5%** Segoe UI; **66.5%** with Verdana forced (CI's wider Linux metrics); 64.2% at 1280×720. Browser spec pins ≥ 60% with 9 rows; a wrap-instead-of-scroll mutant drops it to 56.8% and fails. |
| 1440×900, Party/NPC rows and player props on: every gear/focus/HP control takes its click; launchers cannot overlap | Every NPC placed, so all 9 rows have a Focus: every row's select and Focus (9 of 9, on the DM's client and the player's; the count is asserted); each client's own inspector (gear, Set Initiative, Focus, HP bar) and the DM's NPC inspector (⚙️, HP bar); and in Cards view, on both clients, every card's Focus, gear and HP bar, counted first — the player 9 / 2 / 9, the DM 9 / 9 / 9 — are hit-tested once where they sit (`elementFromPoint` at the control's centre is the control) — not by Playwright's trial click, whose retries at other scroll alignments can slide a control out from under an overlay. The scroll that brings a control into view may move only boxes a person can scroll (`overflow: auto`/`scroll`); a script's scroll also moves an `overflow: hidden` box, and a control reached that way fails. Dock and launchers are not `position: fixed`; their boxes are disjoint from the roster, and a missing box fails the check rather than passing it. |
| Two characters on one seat keep distinct condition/HP/name/focus/delete paths | Unit (roster, inspector delete, phone seats) and browser (HP 42 and Poisoned on the Companion only, on both clients; the two tokens stand on different cells, each Focus centres its own and not the other — desktop, and both rows on the phone). The DM's NPC equivalent likewise moves the NPC off the DM's own token first. |
| DM and player see permitted actions only | Unit permission suite (no settings/HP edit on another player's card; withheld NPC HP stays withheld in the row; DM-only token controls and Owner; NPC conditions and the NPC gear for the DM only; a DM edits any player's HP). Browser: the counted gears above; a DM sets a player's HP from the card and the phone row, and moves a character between seats (desktop, then back from a phone). |
| No clipping at 200% zoom or 375 px | 1920×1080 at 200% (960×540) is the desktop case: no horizontal overflow, every bar button inside the viewport, last row reachable; no portrait instruction overflows its frame down or sideways, and in the frames 72 px wide or less (which occur there) the hint gives way to the title (`interface-party-roster-zoom.spec.ts`). 1366×768 and 1440×900 at 200% (683×384, 720×450) are the phone shell by `isMobileLayout`'s short-viewport rule: 720×450 checked as a zoomed desktop (no touch emulation, no `?mobile` flag — the shell with two characters on the viewer's seat, all three rows' Focus reached by scrolling the screen as a person would, the DM's below the fold; no overflow), 683×384 and 375×812 in the phone journey — no overflow, seats and Focus reachable. |

## Live evaluation (`evaluate-live`)

**Mode: `live-two-client`** for everything the DOM can show, on the dev server
(5174/8787) in the desktop app's browser pane: a DM and a player in separate
pinned sessions (`?sessionUid=`) on a fresh private table, driven by real clicks
and keys, each result read in the *other* client. The pane is not composited, so
its `requestAnimationFrame` is throttled: animation-frame work (focus return after
Escape, desktop camera moves, canvas redraw) could not be judged there. The
Playwright journeys cover camera moves (real Chromium, two contexts, same input
model). Focus return after Escape was claimed covered there too, but no spec
asserted it until the round-1 review caught the claim; the two-character journey
now asserts the row is focused after Escape. The dev server restarted repeatedly under the concurrent gates run
(it watches the packages the gates rebuild), which ends DM elevation by design;
that stopped the DM half of one check (below), not a U7 behavior.

| Check (real input in one tab, read in the other) | Result |
| --- | --- |
| Host creates a table; elevates via own row → inspector → ⚙ → **Table role** → DM Mode | PASS; dock switches 🗺 WORLD → 🛠️ DM MENU |
| Escape × 2 with settings open over the inspector | PASS: first closes settings only, second the inspector |
| Player adds a second character (⚙ → ➕ Add Character → modal) | PASS: “Companion (You)” row on both clients |
| Draft name typed in the settings window, then the DM adds an NPC (broadcast) | PASS: the draft survives |
| Player sets Poisoned on the Companion from its own window | PASS: Companion only, on both clients; the sibling stays clean although the legacy mirror wrote the seat's list (since `561bc77c` it no longer writes it for a seat with two characters) |
| DM edits the NPC's HP from the Party inspector (was a no-op before `00566c70`) | PASS: HP 4/10 on both clients |
| DM sets Monster HP Display → Hidden | PASS: player's row reads “HP ???”, snapshot carries no number; DM still sees 4/10 |
| DM hides the NPC (👁 in its card) | PASS: DM row “hidden from players”; player's roster and snapshot lose it |
| Phone (375×812): Party screen | PASS: seat “Player 2 (you) · 2 characters” with both rows, then “Player 1 · DM”; no target under 44 px; no horizontal overflow |
| Phone FOCUS on the Companion | PASS: the screen closes; camera centred on its token (0 px off) |
| Focus the Companion, arm Select, click its token, → | PASS: it steps 0,0 → 1,0 on both clients; the sibling stays |
| 1366×768, player, compact roster | 66.5% of the viewport to the map; canvas edge within 0.5 px of the panel |
| Launcher dock with player props on | Not re-run live (the DM was demoted by a dev-server restart); covered by the browser spec (WORLD + PROPS docked, disjoint from the roster, every control hit-tested) |

**Score 8.3 / 10 (pass ≥ 7.0)** — Functionality 8 (0.35), Multiplayer integrity 9
(0.30), Craft 7.5 (0.20), Reach 8.5 (0.15).

Findings:

- **Minor — desktop rows don't say whose seat another player's character is on.**
  The DM's roster read “Player 2” and “Companion” with no hint that both belong to
  one seat; the phone groups by seat. Repair: tag another player's character with
  its seat's name when it differs from the character's (see
  [Repairs after evaluation](#repairs-after-evaluation)).
- Pre-existing, not U7: new characters spawn stacked on one cell, so their
  nameplates overlap until one is moved.

### After round 3 (2026-09-29)

**Mode: `live-two-client`** on the dev server in the desktop app's browser pane, on the
public test table (the pane remembers it; the lobby shows only before a tab has joined):
the DM in one pinned tab (“Player 4”, elevated through its own card's **Table role**),
a player in another (“Player 5”, who added a “Companion” from their own window). Each
result read in the other tab. The phone is the DM's tab with touch emulation at 375×450:
at 375×812 the pane scales the page down and its clicks landed at half their
coordinates (a click listener read 92,349 for 184,698), so the phone checks ran at a
height the pane shows unscaled.

| Check (real input in one tab, read in the other) | Result |
| --- | --- |
| Desktop DM sets the player's HP from their card in the inspector | PASS: the player's own row reads HP 42/100 |
| DM moves the player's Companion to the DM's seat: ⚙ → Token settings → Owner | PASS: the player's row turns “Companion (DM)”, the DM's “Companion (You)”; the character's and its token's owner both move |
| DM Menu → NPCs: + ADD NPC, PLACE ON MAP, Status Effects → Poisoned | PASS: the player's roster shows the NPC wearing “Conditions: Poisoned” |
| The NPC editor's 🎯 Focus | PASS: centred to 0 px, once the condition list was closed (below) |
| Phone: the DM taps the HP on the player's row, types 17 | PASS: the player's row reads HP 17/100 — but the number is a 10×11 px target (finding) |
| Phone: the Companion now lists under the DM's seat; its ⚙ EDIT → Owner (a 44 px select) → Player 5 | PASS: the player's row reads “Companion (You)” again; both owners back |
| Phone: ♛ DM → NPCs & Monsters: the NPC reads “1 Active Effect”; its 🎯 Focus (46 px) | PASS: the DM screen closes and the map centres on it (0 px) |
| Player: their own settings window, and the NPC's details | PASS: no Owner control; the NPC's card has no ⚙, only Focus |

**Score 8.4 / 10 (pass ≥ 7.0)** — Functionality 9 (0.35), Multiplayer integrity 9
(0.30), Craft 7.5 (0.20), Reach 7 (0.15).

Findings:

- **Minor, older than U7 (which widened it to the DM) — a phone's HP numbers are
  10×11 px tap targets**, far under the 44 px floor; the pane's scaled clicks missed
  them. Not fixed inline: current and max sit about 30 px apart, so a 44 px target each
  would overlap and a tap meant for one would open the other — a layout decision for
  coarse pointers. Proposed as a follow-up; the owner asked for it the same day, and it
  is fixed in `2689cf53` (boxes side by side, not overlays). Re-checked live on the
  phone DM tab: each number 44×44 with a 9 px gap, and a tap 5 px inside the corner of
  the player's current HP opened its field; the player's tab read the new value. On the
  desktop (fine pointer) the numbers keep their size (16×12, 24×12, 8×12) and now take
  the keyboard: Enter on a focused number opens its field.
- **Minor, older than U7 — a read-only portrait was a “Player portrait”**, NPCs'
  included. Fixed in `f494c655`.
- Not defects: an open condition list lies over the editor's buttons until it is closed
  (it is a dropdown; an outside click or Escape closes it) — a click aimed by position,
  not by sight, ticked Prone, and was undone; and the phone's full-screen Party covers
  the dock by design (✕ first).

## Repairs after evaluation

- **Seat tag.** Another player's character named differently from their seat now
  carries the seat's name as its tag (the row shows an **Alice** tag and reads
  “Companion (Alice)” aloud), so the DM's desktop roster says whose it is, as the phone's seats do.
  Unit-tested in `EntitiesPanel.roster` and the `rosterEntryView` suite; its
  mutant (U19) is killed. The player guide's Party bullet says so.

## Verification

After the round-1 repairs (`gates-runner`, tree on HEAD `f417b334`):

| Rung | Result |
| --- | --- |
| Shared build, `pnpm lint`, `pnpm format:check` | pass |
| Structure guard (`pnpm lint:structure:enforce`) | **fail**: `NpcCard.tsx` 356 by the guard's count, which is one more than `wc -l` (355: 346 at HEAD + U7's picker). Repaired by `573d9da7` (345 by `wc -l`); the guard then exits 0 |
| Server and client typechecks | pass |
| Units | shared 29 files / 452 tests; server 161 / 2,741; client 483 files passed and 4 skipped (the `zz_*` benchmark files, skipped unless asked) / 7,196 tests |
| e2e (`pnpm test:e2e`) | 280 passed, 3 skipped, 0 flaky, 0 failed. The skips are runtime `test.skip()` calls in `map-navigation` ×2 and `ui-state` — the accepted baseline since U4a (execution ledger; U5 record), not U7's |
| Dev boot | client and server up; no export or syntax errors |

After `573d9da7`: the NPC, DM and Party suites green in the tree (63 files / 1,401
tests) and from an export of the committed tree (typecheck clean; 80 files / 1,586
tests); the U7 journeys 6/6 as written and 6/6 again with **Verdana forced** in every
context (CI's Linux fonts are wider; a probe confirmed the font applied to the page and
its buttons); the strict type check of the U7 e2e files clean. **Bundle** (measured on
its own): entry 148.92 KB gzipped of 175 (U6 left 145.50).

After the round-2 repairs (`gates-runner`, tree on HEAD `73ba410d`): shared build,
lint, format, both typechecks and dev boot pass; units shared 29 files / 452 tests,
server 161 / 2,749, client 487 files passed and 4 skipped (the benchmarks) / 7,228
tests; e2e **281 passed**, 3 skipped (the same accepted baseline), 0 flaky, 0 failed.
The structure guard failed again, this time on committed code: `375e049c` had pushed
`StatePersistence.ts` to 357 lines. `94e06c21` folds the two load doors' seat
coercion into one (`coerceLoadedSeats`), the file is 343 and the guard exits 0; the
server suite stays green (2,749) and dropping the migration from the shared coercion
fails both door tests. **Bundle:** 149.38 KB of 175.

After the round-3 repairs (`gates-runner`, tree on HEAD `cb7ff1d0`): shared build,
`pnpm lint`, `pnpm format:check`, the structure guard, both typechecks and dev boot
pass; units shared 29 files / 452 tests, server 163 / 2,766, client 488 files passed and
4 skipped (the benchmarks) / 7,257 tests; e2e **284 passed**, 3 skipped (the same
accepted baseline: `map-navigation` ×2, `ui-state`), 0 flaky, 0 failed. Before it, the
structure guard caught the tree's `NpcCard.tsx` at 350 by its count (349 by `wc -l`;
U7's picker props on top of `30da5509`); two blank lines came out. **Bundle** (on its
own): 149.95 KB of 175. The ten U7 journeys (three specs) pass again with **Verdana
forced** in every context, and the strict type check of the U7 e2e files is clean.
`f494c655` landed after the ladder: lint, format, the structure guard and the client
typecheck clean on the tree, and its suites green in the tree (43 files / 831 tests)
and at HEAD (above).

After `2689cf53` (the HP targets), the ladder again (`gates-runner`): every rung green
but e2e, where `mobile-portrait-upload`'s two cases failed on a strict-mode clash — its
`/EDIT/i` found the row's “⚙️ EDIT” and the new HP buttons, then named “Edit current
HP…”. The labels became “Set …” (a second “Edit” on a row is ambiguous to voice control
too); then the full e2e suite: **286 passed**, 3 skipped (the accepted baseline), 0
flaky, 0 failed. The whole client suite run at once (the contention canary — the
batched CI command gives each file an idle machine) then failed one case:
`NPCsTab.test.tsx`'s twenty editors, ~1.2 s idle, timed out at 6.8 s. U7 made each NPC
editor heavier (its conditions picker and Focus), so that file and U7's
`NPCsTab.conditions.test.tsx` (~0.8 s idle) carry the Token Library files' file-scoped
30 s `testTimeout`; set to 10 ms, it times out 27 and 4 cases, so it reaches them. The
canary then: 488 files passed, 4 skipped (the benchmarks) / 7,259 tests, the same 7,263
total. `2689cf53` alone was checked from an export of HEAD with its own shared build:
its spec red on HEAD's app (no HP buttons) and green with the fix, the client typecheck
clean, and the players, layout and layouts suites green (47 files / 1,185 tests).

## Proof the tests can fail

Every new or changed test was run against a mutant of the rule it pins, and each file
was restored and hash-checked afterwards.

- **Unit, before the review (U1–U19, R1):** roster conditions ignoring the
  sole-character gate; the roster dropping temp HP; Focus sending a fixed token; the
  Party opening as Cards; the inspector ignoring Escape; the inspector not keyed per
  character; a phone row letting anyone manage conditions; a phone seat listing every
  row; no NPC condition handler for the DM; Token settings never rendering; an
  unassociated name label; “Portrait Pending” back; the World launcher, MainLayout or
  the bar not carrying the dock; no NPC conditions picker; withheld NPC HP shown; a
  hidden NPC untagged; no seat tag (U19); the Party's NPC handlers back to
  `undefined` (R1). All killed.
- **Browser, before the review (E1–E7):** App ignoring the panel's size event;
  launchers floating (no dock); the Party opening as Cards; phone Focus leaving the
  screen up; rows wrapping instead of scrolling (share 0.568, fails ≥ 0.6); the
  portrait hint never hiding; the phone name column squeezed. All killed.
- **Round-1 repairs, unit:** each bug commit's test failed before its fix. U7-tree
  repairs: the inspector with no return-focus resolver, and no stale-selection clear;
  seven `rosterEntryView` mutants (no legacy fallback; seat temp HP and seat portrait
  on a sibling; an empty list yielding to the seat's; NPC exactness on HP alone; no
  seat tag; hidden ignored); four row-render mutants (+N, the hidden word in the
  label, the Turn mark, “Healthy” as “HP ???”); the bench order swapped; the phone's
  Manage Status owner-only; `partyPanelSize` dispatching `resize` (alone, and with
  its own event); the sight and speed gates dropped on a player's card; the loading
  placeholder undocked. All killed. **Delete Token** has two redundant gates (the
  card's and the window's): removing either alone survives, both together are killed
  — each is a backstop for the other.
- **Round-1 repairs, browser (E-R1–E-R5):** the phone's Focus ignoring its token, the
  roster's Focus centring the first token, the container query removed, and the dock
  floating — killed. **E-R1, `partyPanelSize` dispatching a window `resize`,
  survives the journeys:** the focus return completes in its animation frame before
  the ResizeObserver fires, so the harm the reviewer predicted (focus not returned)
  does not occur there. Its real harm, cancelling an in-flight map gesture when the
  panel changes height, has no browser journey; the unit test kills it by pinning
  “the named event, never a window resize”.
- **Round-2 repairs, unit:** each bug commit's test failed before its fix, and each rule
  has its mutant: the drawings gate; enrolment, the manual-entry setting and a DM
  treated as a player (initiative); keying the NPC editor's resync on the object, and
  dropping its in-flight guard; each of the three load doors, and a non-sole character
  adopting the seat's list; temp HP not adopted, and the portrait overwriting its own;
  each of the three re-elevation closes; the expiry restamping the clock, and any
  broadcast ending the steering; the NPC token resolution; the phone's Add Character and
  lock gates; the Party's Delete NPC unwired; the inspector's band raised to 3000
  (settings no longer first on Escape); Hide dispatching a window `resize`. All killed.
  Delete Token on the phone survives its row gate alone for the same reason as on
  desktop: the settings window's own DM gate is the backstop.
- **Round-2 repairs, browser (E-R6–E-R9):** the roster's Focus centring the first
  token (NPC journey), NPC rows without Focus (9 asserted), the short-viewport rule
  removed (720×450), and the portrait placeholder never wrapping a word — all killed.
  One test was itself wrong on first run: the NPC placement helper passed before the
  new NPCs had reached the snapshot, so nothing was placed; it now waits for all of
  them.
- **Round-3 repairs, unit:** each bug commit's test failed before its fix (a RED run
  each), and each rule has its mutant: the session door not settling, or settling
  against no seats; the phone listing another player's characterless seat, and a
  characterless row keeping its HP bar, conditions picker or name editor (the name
  editor's mutant first survived — two gates hid each other — and the row now gates it
  once). `cb7ff1d0`'s nine, against committed code: the drawings gate with a DM who
  owns another character; an expired steering stamp; `shows` ignoring HP, and
  disposition (every whole-record field is now listed); the editor never re-syncing HP;
  the owner's own window closing on demotion; an NPC's max HP editor surviving it; the
  load migration counting NPCs; a non-array players list thrown on. The owner's
  additions: the DM menu not sending an NPC's conditions, Focus offered for a token not
  on the map, no Focus button, the builder dropping the focus; on the server, a player
  may transfer, an NPC may, any uid is accepted, the token stays behind, the message is
  unrouted; on the client, the desktop sending the wrong character, and Token settings
  hidden when Owner is its only control (survived until a test gave it that case). The
  phone: its lock state not read; MobileSurfaces dropping Delete Token or the Owner send;
  the DM screen's NPC Focus not closing the screen, or not centring. All killed. The
  Owner control's DM gates — the desktop card's, the phone row's, and the settings
  window's own — each survive alone, since the window's gate backs the other two; the
  three removed together are killed.
- **Live evaluation after round 3:** `f494c655`'s tests failed first (three, on the old
  label). `2689cf53`'s unit test failed first, and each rule has its mutant: a number
  its viewer may edit staying text, anyone's number a button, no `type="button"`, the
  label dropping the number; in the browser, no floor on the numbers, the width floor
  missing, the two boxes overlapping, and the height floor missing — which first
  survived, because a phone's Party screen lifts every button to 44 px tall anyway, so
  the spec also measures a touchscreen desktop's card, and that kills it. All killed.
- **Round-3 repairs, browser (E-R10–E-R19):** a phone screen a person cannot scroll
  (it first survived: at 720×450 both of the viewer's rows fit, so nothing scrolled; the
  check now reaches the DM's seat below the fold, and kills it); a roster a person cannot
  scroll sideways; a Cards list a person cannot scroll; the DM losing the gear on
  players' cards (the count reads 7, not 9); the NPC gear not taking its click; the
  card's HP editor, and the phone row's, back to owner-only; the server leaving the token
  behind on a transfer; the phone offering no Owner; the DM menu sending no NPC
  conditions. All killed.

## Review

`review-convergence`, four fresh read-only `opus` lenses per round; the tree was
fingerprinted before and after each round.

### Round 1 — FAIL (union: 1 P1, 8 P2, 25 P3)

Tree `884f2e102266ffc2` before and after (the reviewers changed nothing). Verdicts:
identity/state FAIL (3 P2, 2 P3); permissions/secrecy FAIL (1 P2, 3 P3); test validity
FAIL (1 P1, 4 P2, 7 P3); doc-vs-code FAIL (1 P2, 13 P3). Every finding was real on
reading. The lenses' P2s sum to 9; the NPC-clear P2 was found by two of them and is
counted once, so the union holds 8. Dispositions:

| Finding | Disposition |
| --- | --- |
| P1 — `partyPanelSize`'s reason untested; the record claimed Escape focus return was covered in the browser | Unit test drives the observer callback; the journey asserts the row is focused after Escape; the record corrected (above) |
| P2 — clearing an NPC's temp HP or art from the Party did nothing (identity + permissions) | `31dcea40` (with the DM menu's art clear and the art-less confirm timeout) |
| P2 — a deleted sibling's conditions resurfaced | `561bc77c` (then `f417b334` for the opposite case it exposed) |
| P2 — the phone's EDIT name field could revert a rename (older) | `ef4a7292` |
| P2 — the save file held the seat's conditions | `2727ecb9`; the guide's list says drawings are the seat's |
| P2 — Focus journeys could not tell two stacked tokens apart | Tokens on their own cells; “not centred” asserted before each press, desktop and phone |
| P2 — the player-side permission test exercised only the lock | All three DM-only handlers supplied; sight/speed/delete asserted absent for the player and present for the DM |
| P2 — MainLayout's `onNpcDelete` wiring untested | `049d49a4` |
| P2 — roster attribution and marks untested beyond one case | `rosterEntryView` and row-render suites; bench order pinned |
| P3 (identity) — a stale selection reopened details; Escape focus went to the view toggle | Selection cleared when its character leaves; focus returns to the row by id |
| P3 (identity) — portrait fallback ignored the sole-character rule | `9ed2e7fa` (cards, phone) and the roster view |
| P3 (permissions) — a quick second Party NPC edit undid the first | `0ee4ce4d` (one DM; two DMs racing is a known limit) |
| P3 (permissions) — a DM could not resize a player's token; phones had no size | `bf0e982a` |
| P3 (permissions) — demotion left the phone sheet and initiative dialog open | `209b603d` |
| P3 (tests) — overlap check passed on a missing element; DM-side missing row passed | `overlaps` throws on no box; 9 rows required on both clients; the row's HP asserted first |
| P3 (tests) — trial clicks could scroll a control out from under an overlay | One `elementFromPoint` hit test where the control sits; dock and launchers not `fixed` |
| P3 (tests) — container query never exercised; phone DM Manage Status; DM-uid NPC badge | Narrow-frame hint asserted hidden at 960×540; seats test with a DM; `049d49a4` |
| P3 (tests) — mutant evidence not in the record | [Proof the tests can fail](#proof-the-tests-can-fail) |
| P3 (docs) — help: phone path, stale “glows gold”, 🎯 on every row | Help corrected (phone path, rows outlined and tagged Turn, 🎯 only with a token; a DM resizes anyone's) |
| P3 (docs) — guides: phone HP own-only, “no group”, “three toolbar powers”, NPC 🎯 | Corrected in the player, DM and getting-started guides |
| P3 (docs) — record: dangling link, tag list, DM size, forwarding, “every new file”, NPC order | Corrected; the forwarding deviation is raised to the owner below |
| P3 (docs) — FloatingPanelsLayout comments; “Loading DM tools…” floated over the Party | Comments corrected; the placeholder waits in the dock (unit-tested, mutant killed) |
| P3 (docs) — `dm-menu-npcs.jpg` shot mid-update, caption wrong | The step waits for the NPC to settle; re-shot and read; caption matches |

### Round 2 — FAIL (union: 1 P1, 8 P2, 19 P3)

Fresh lenses on the full diff since `6e92e75d` (15 commits and the tree); tree
`de0b0de2c763f7ee` before and after (the reviewers changed nothing). Verdicts:
identity/state FAIL (2 P2, 3 P3); permissions/secrecy FAIL (1 P1, 1 P2, 2 P3); test
validity FAIL (3 P2, 5 P3); doc-vs-code FAIL (2 P2, 11 P3). Shared findings counted
once: the re-elevation reopen (identity and permissions) and the overstated 1440 Focus
coverage (tests and docs). Every finding was real on reading; the count fell from 34
to 28. Dispositions:

| Finding | Disposition |
| --- | --- |
| P1 — a DM's Load from File on a player's card wiped the DM's own drawings (pre-existing) | `204c3e0b` |
| P2 — loading a file enrolled a character in initiative, or was refused (pre-existing) | `274baa23` |
| P2 — tables saved before `561bc77c` still resurfaced a deleted sibling's conditions (UNREPAIRED in round 1) | `375e049c` (load migration at all three doors) |
| P2 — the DM menu's NPC editor wiped typed input on unrelated broadcasts (pre-existing) | `56ef4cff` |
| P2 — the Party's Delete NPC step unpinned | Unit test from the window's button; its mutant killed |
| P2 — the NPC pending state's “snapshot shows the send” unpinned | Unit test with an unrelated broadcast between two edits (`6010b536`) |
| P2 — Escape order (settings before inspector) untested | Unit test; the band-3000 mutant killed |
| P2 — help sent phone users to desktop-only controls; the record overstated 1440 Focus coverage | Phones now have Add Character (`73ba410d`); token art marked desktop-only; the 1440 journey places every NPC and asserts 9 of 9 |
| P3 — a refused NPC send steered every later edit (REGRESSION of `0ee4ce4d`); NPC names unbounded | `6010b536`; dependent-value race kept as a known limit |
| P3 — re-elevation reopened DM windows; a dead NPC HP input | `1915dc7b` |
| P3 — NPC Focus for a token on another scene | `b091373a` |
| P3 — the phone lacked Add Character, token lock, Delete Token (pre-existing) | `73ba410d` |
| P3 — a sole character's seat temp HP and portrait vanished on a second character | `e58c5d88` |
| P3 (tests) — NPC journey stacked tokens; phone pressed 1 of 2 Focus; 200% evidence was a touch phone; horizontal overflow unchecked; no-resize only pinned in `partyPanelSize` | NPC moved off the DM's cell with before/after checks; both phone rows; 720×450 as a zoomed desktop; sideways overflow asserted; a Party-controls no-resize test |
| P3 (docs) — record counts (8 P2), “always allowed”, stale line counts and units, date | Corrected (above) |
| P3 (docs) — help: DM phone path, “—” and Turn tag desktop-only; ⚔️ misdescribed; “shortcut” comments; PartyRoster order comment; PLACE ON MAP cause; getting-started phone slot | Corrected |
| P3 (docs) — the plan's “ownership where allowed” dropped silently | Raised under [Owner questions](#owner-questions-answered-2026-09-29); built after round 3 |

### Round 3 — FAIL (union: 0 P1, 12 P2, 21 P3) — stopped at the round cap

Fresh lenses on the full diff since `6e92e75d` (25 commits and the tree); tree
`0d55cc1ad7c8b912` before and after (the reviewers changed nothing). Verdicts:
identity/state FAIL (1 P2, 4 P3); permissions/secrecy FAIL (1 P2, 5 P3; no P1 — no path
found for a player to gain a DM action or see DM-only data); test validity FAIL (10 P2,
5 P3, where the lens's P2 means “a named rule has a surviving mutant”); doc-vs-code FAIL
(1 P2, 8 P3). Shared findings counted once: an NPC's lock and size on another scene
(identity and permissions) and the phone's unpinned wiring (tests and docs).

**Round counts: 34 → 28 → 33.** Serious findings fell (P1: 1 → 1 → 0), but the total
did not converge, and round 3 is the cap. Per `review-convergence`, **no repair was made
after round 3** until the owner decided; the union below was escalated to the owner.

Behaviour defects (2 P2, 9 P3):

- **P2 REGRESSION of `56ef4cff`** — the DM menu refuses an NPC edit while another NPC's
  update is in flight (one slot, `useNpcUpdate`); the refused edit is dropped silently
  and, since the fields now re-sync on values, keeps showing as if saved.
- **P2, `274baa23` incomplete** — loading a character file after END COMBAT (which keeps
  initiatives) sends `set-initiative`, which restarts combat on that character's turn;
  mid-combat it writes a public manual-entry line. The complete fix is a modifier-only
  server message.
- P3 — `e58c5d88` copies the seat's temp HP and portrait instead of moving them, so they
  resurface on a later sole character (and a drag writes the temp HP as its own).
- P3 REGRESSION of `375e049c` — the session-file door settles after the live merge, so a
  file's sole legacy character can start empty; settle the file's own seats first.
- P3 — two portrait fields never re-fill from the server (the Party NPC card; the phone
  EDIT sheet), so a blur re-commits a stale URL.
- P3 — an NPC token on another scene still gets Lock and Size (only Focus was gated).
- P3 — players see the NPC card's ⚙ (disabled); “permitted actions only”.
- P3 — after a DM clears an offline player's only character, the phone keeps a stats row
  for the seat whose editors the server refuses (desktop shows none).
- P3 — a DM on a phone cannot set an NPC's conditions or focus an NPC (phone parity).
- P3 — a DM cannot edit a player's HP (already an owner question below).
- P3 — pre-upgrade tables where one of two characters was already deleted: the survivor
  adopts the seat's list, possibly the deleted sibling's (known-limit wording owed).

Test strength (10 P2, 5 P3): surviving mutants in the phone's MobileSurfaces wiring (and
`onPlayerTokenDelete` is optional, which `73ba410d`'s message denies); the phone lock
state; the steering timestamp and six of `shows`'s seven conjuncts; the drawings gate's
fixture (loader owns no character); the load migration counting NPCs; the claim adoption's
sole gate; the NPC editor's resync of HP, max, temp, modifier, portrait and art; the
desktop re-elevation close's owner exception; the 1440 hit tests run on the player's client
only (the DM's gears unhit, Cards loops uncounted); plus NpcCard's max/temp HP editors on
demotion, the session door's players argument, the non-array players hardening, scroll-based
reachability, and a silent `if (cards)` path.

Doc/record (1 P2, 8 P3): `73ba410d`'s “required props” claim; the pre-upgrade limit
above; the verification paragraph covers only the first 13 fix commits on their own; the
E-R6–E-R10 label lists four; two stale DM-guide lines (combat banner, Sight Radius path);
help lines that are desktop-only (inline rename, 🎤); the `partyPanelSize` rationale
overstates what dispatched `resize` before; the Party bullet promises 🎯 on every row;
`204c3e0b`'s message says the token restores through character-scoped messages.

**Cost so far:** twelve review agents (three rounds × four, about 3.2M subagent tokens),
three full gate ladders (about 32 minutes each), and the local mutant runs listed above.

**Repair options for the owner:**

1. **Repair all, verify** (U6's precedent): every round-3 item repaired — behaviour
   defects in their own commits with a failing test first, test-strength items with their
   mutants, docs and messages corrected (commit messages by `--amend` only before push, or
   by follow-up commits) — then the full ladder, with no fourth review round.
2. **Repair behaviour and docs, file the test strength**: the 11 behaviour items and the
   doc/record items now; the 15 test-strength items as a follow-up task; full ladder.
3. **Accept as is**: record all 33 as known limits and follow-ups. Not recommended: one
   P2 is a regression introduced by a round-2 repair.

A pattern for the owner to weigh: each round's repairs of pre-existing bugs (25 local
commits outside U7's own tree) widened the surface the next round reviewed, and two of
round 3's regressions came from round-2 repairs.

### Owner decisions after round 3 (2026-09-29)

- **Repair all, verify** — every round-3 item repaired, then the full ladder; no fourth
  review round.
- **Table role accepted as the interim** for the role forwarding shortcut, until U9.
- **A DM edits a player's HP in U7** (the card and the phone row).
- **“Ownership where allowed” is owed in U7.** Implemented reading: the DM — the only role
  that may reassign — moves a player character and its token to another player's seat
  from Token settings, on desktop and phone. NPCs stay the DM's: handing one to a player
  would change what fog and HP redaction show them, a separate decision.

## Repairs after round 3

The owner chose **repair all, verify** (no fourth round). Every round-3 item:

- **Behaviour (2 P2, 9 P3)** — the eight fix commits listed under
  [Bugs fixed on the way](#bugs-fixed-on-the-way-own-commits), each with a failing test
  first; the phone's missing NPC conditions and Focus, in U7's tree (the DM menu's NPC
  editor, above in [What U7 changes](#what-u7-changes)); the DM's HP editing, which the
  owner added; the pre-upgrade case, a [known limit](#known-limits).
- **Test strength (10 P2, 5 P3)** — `cb7ff1d0` for committed code. In U7's tree: the
  phone's `onPlayerTokenDelete` is a required key (`… | undefined`); MobileLayout's
  suite drives the real `MobileSurfaces` (a DM deletes another player's token and moves
  their character from the phone Party; an NPC's Focus from the DM screen centres it and
  closes the screen); the phone reads a locked token as locked; the four committed
  `if (cards)` helpers call the asserting `showCards()`; the browser checks gained the
  DM's inspector, counted Cards loops on both clients, person-scrollable reachability
  and a two-character 720×450 seat. Each with the mutants in
  [Proof](#proof-the-tests-can-fail).
- **Docs and record (1 P2, 8 P3)** — the two overclaiming commit messages corrected
  above; the pre-upgrade limit; the verification scope (HEAD verified on its own); the
  E-R6–E-R9 label; the DM guide's combat line (the Party bar's **⚔️ Combat Active** and
  **Turn N of M**) and Sight Radius path; the in-app help's inline rename (a phone renames
  through ⚙️ EDIT) and 🎤 (desktop only), and the player guide's 🎤 and 🎯 lines; the
  `partyPanelSize` rationale, here and in its comment.
- **New in U7's tree for these:** `characterOwnerMessages.ts` and its
  validator; the Owner select in `TokenSettingsSection` (desktop and phone); the DM's HP
  editor on the card and phone row; `NpcConditionsField` and Focus in the DM menu's NPC
  editor; the DM guide's Owner, HP and NPC lines and a DM help entry; and a browser spec,
  `interface-party-dm.spec.ts`, driving all three through real input on two to four
  clients.

## Owner questions (answered 2026-09-29)

All three were answered after round 3 ([Owner decisions](#owner-decisions-after-round-3-2026-09-29)):
ownership is built in U7, the Table role section is accepted as the interim, and a DM
edits a player's HP in U7. As asked:

- **“Ownership where allowed” is not in Token settings.** The plan lists ownership among
  the Token settings; nothing ships for it. Nothing transfers a token between players
  today: the server has a `claim-character` (a player takes an unclaimed character) that
  no client sends. Decide whether U7 owes it or a later slice does.

- **No forwarding shortcut for role (a deviation from the plan).** The plan asks U7
  for a forwarding shortcut until U9 moves role and table controls out. What ships is
  the DM Mode control itself in its own **Table role** section of the viewer's own
  character window. Accept this as the interim, or ask for a shortcut that leads
  somewhere else before U9.

- **A DM cannot edit a player's HP from the Party.** The server accepts it, and the
  guide used to claim it (corrected in `c296ff1c`); the card's HP editor has been
  owner-only since the DM-permissions change. Widening it is a permission decision
  (and a DM could scrub a player's bar by accident), so U7 leaves it; U8's Encounter
  (HP during combat) is the natural home.

## Known limits

- **A table saved before `561bc77c` where one of a seat's two characters had already
  been deleted.** The load migration gives the survivor the seat's legacy list, which
  may be the deleted sibling's conditions: nothing in the old file says whose they were.

- **Two DMs editing one NPC at once still race.** `update-npc` carries the whole
  record, so a co-DM's rename can be overwritten by the other DM's HP drag from a
  snapshot that predates it. `0ee4ce4d` fixes the one-DM case; the two-DM case needs
  a partial update on the server.
- **PLACE ON MAP drops an NPC on the top-left cell** (pre-existing), where it covers
  whatever stands there — in `dm-menu-npcs.jpg`, the DM's own token under the header.
- **A Party NPC edit derives dependent values from the snapshot.** The card normalizes
  an HP entry against the snapshot's max HP, so setting max HP and then HP within one
  round trip (≈0.1 s) sends the old max back. A person cannot type the second entry that
  fast; a DM on a stalled connection could.

- Pre-existing strict-type diagnostics in untouched e2e lines (Playwright does not
  type-check): `interface-player-navigation.spec.ts` (`drawings` possibly undefined),
  `kicked-in-door.helpers.ts` (a `waitForFunction` overload), `turn-navigation.spec.ts`
  (a `modifier` field `set-initiative` does not declare).
- `pnpm test:e2e -- <spec> -g <title>` does not filter by title: after `--` the
  Playwright CLI takes `-g` and its value as file filters (it matched
  `interface-generate-*`). Use `pnpm test:e2e <spec> -g "<title>"`.
