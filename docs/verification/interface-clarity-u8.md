# U8 — Encounter is the single combat home

Status: **implemented on `dev` (uncommitted slice work above nineteen own fix and test
commits, all local and unpushed); review stopped at the 3-round cap and the owner chose
“repair all, verify”; every round-3 item is repaired; the full ladder is green on the final
tree; live re-evaluation on the repaired tree 8.55. Accepted by the owner 2026-09-30 and
committed on `dev` (local, not pushed).**

## Owner decisions (2026-09-29, before building)

The plan makes destination names a product choice; the owner chose, from a concrete
desktop and phone proposal:

- **Encounter is a DM Menu tab, after World** — Maps · World · **Encounter** · NPCs &
  Monsters · Props & Objects · Players · Session — and the same chip on the phone's DM
  screen. Three sections: **Setup**, **Initiative**, **Run encounter**.
- **+ Add NPCs… forwards** to NPCs & Monsters (one home for adding; no second editor).
- **The phone gets initiative**: a player's own Party rows get **⚔️ INIT** (the same
  dialog as the desktop card), the phone DM gets Encounter's per-participant rows, and the
  turn strip names the current turn.
- **The auto-start is named, and "Start at top" is offered**: an initiative saved while
  no fight is running starts combat on that character's turn (so a bulk NPC roll hands
  the turn to the first NPC rolled, not the highest — after End combat too, since the old
  initiatives stay); Encounter says so, and while combat is on offers
  **⏮ Start at top of order**, which sends the existing `start-combat` — the server has
  always accepted it mid-fight. No server change.

## What U8 changes

Audit **IA-16** (encounter preparation crossed NPCs, Players, the cards and Session).

**DM tools → Encounter** (`features/encounter/`) composes controls that already existed —
moved, not copied:

- **Setup** — **+ Add NPCs…** (opens NPCs & Monsters); the participant list in the
  **server's** order (`encounterRoster.ts`: initiative high to low, a PC (a player's or the
  DM's own) before an NPC on a tie, then creation order — `CharacterService.
  getCharactersInInitiativeOrder`'s comparator) as **In the order** and **Not rolled yet**,
  each row with HP, NPC / Player / DM and, when it differs from the character's name, its
  seat, **hidden** for an NPC hidden with the 👁️ eye (fog can hide more than the tag
  marks), **🎲 Roll** (`roll-initiative`, stored modifier), **Set…** / **Init N** (the shared
  initiative dialog), **✕** (clear its initiative: it leaves the order, and the server's
  `leaveOrderBudget` passes a held turn to the successor) and **🎯** while its token is on
  the current map; **Monster HP players see** (moved from Players; the same
  `set-monster-hp-display`).
- **Initiative** — **🎲 Roll missing NPC initiative** (moved from NPCs; one
  `roll-initiative-all`; disabled, with the reason beside it, once every NPC has one); the
  table's hand-entry policy stated, with **Change in Session** (the permission stays under
  Session/Table until U9); **🗑️ Clear all initiative** (moved from Players).
- **Run encounter** — **⚔️ Start combat** / **🏁 End combat** (moved from Players), the
  status line **⚔️ Combat active · Turn N of M: name**, **◄ PREV / NEXT ►**, a note
  whenever the turn is not at the top (“It is X's turn; Y is at the top of the order. A
  fight started by saving an initiative begins on that character's turn, not at the
  top.” — the client cannot tell that case from an ordinary NEXT, the round not being on
  the wire, so the note blames nothing), and **⏮ Start at top of order** (which also
  starts the round over and refills everyone's movement).

Every Encounter send is the same sender the old tabs used (`useDMContext`'s combat
senders, the layout's one `useInitiativeSetting`), carried as ONE required
`EncounterControls` object (`encounterControls.ts`), so the tab cannot mount with a control
silently unwired.

**Old tabs forward, and hold no second control.** Players loses Combat Controls and
Monster HP Display, and gains **⚔️ Open Encounter**; NPCs & Monsters loses **⚔️ Roll
Missing Initiative** and gains **⚔️ Encounter**. The Party bar keeps **⚔️ Combat Active**,
**Turn N of M** and PREV / NEXT, and the card's **INIT** stays — as a shortcut into the
same dialog.

**One dialog, one permission rule, three doors.** The desktop Party, Encounter and the
phone Party each open the initiative dialog through their own `useInitiativeDialog`
instance, which applies the server's rule (the DM, or the owner), tracks the character by
id (live — `b735acb8`) and keys the dialog per character (`3225015e`); all three share
the layout's one `useInitiativeSetting` for their sends. A dialog waits on and reports
only its own save (`34e87cc2`), and only until that save's request ends (`779f22f4`).
While it is open the whole page behind it is inert — `#root` (`3225015e`) and every
window portalled to `<body>` beside it, such as a character's ⚙ settings window
(`5e1340e4`) — and focus goes into the dialog and back to its opener on close. Enter
saves from the hand-entry field only (`c761b244`); its own save in flight cannot be
overridden by a roll or a backdrop click (`8f9f8764`), nor its value edited
(`44e988ef`); the dial follows the stored modifier until touched (`ae811a28`), and an
untouched dial's Roll leaves the modifier to the server (`7d4d576d`); a reconnect does not
close it (`8f88edea`). The dialog itself (`InitiativeModal`):

- the commit vocabulary of §3.4: **Roll d20 now** (the server rolls at once and the
  dialog closes), **Enter a roll by hand**, **Save initiative**;
- where hand entry is off for a player, a reason instead of a vanished button: “Entering a
  roll by hand is off at this table. The DM can allow it in DM Menu → Session.” (the DM
  always keeps it, in Encounter's dialog too);
- with no fight running, the auto-start said before the press: “No fight is running:
  saving an initiative starts combat, on NAME's turn.”;
- the modifier dial (`InitiativeModifierDial.tsx`, extracted — the modal was 2 lines from
  the guard) gains **−** / **+** (the keyboard's and a finger's road; bounded −20…+20) and
  `touch-action: none`, so a phone's horizontal drag moves the dial instead of the page;
  like Roll, the dial is locked while the dialog's own save is in flight.

**The phone.** Before U8 a phone had no initiative control, no order and no turn mark.
Now: the Party screen's rows the viewer may set (their own; every row for a DM) carry
**⚔️ INIT** (`MobileRowActions.tsx`, split from `MobilePlayerRow`), every row that has an
initiative reads **Init N** and, on the turn holder while combat runs, **▶ Turn**; the turn strip names,
under PREV / NEXT, whose turn it is (**Turn: name**, or **Turn: —** when nobody holds the
turn — after Clear all, or Start combat with an empty order — or when the server withheld
the pointer: a hidden NPC's turn, or one whose token is outside the player's sight); the DM screen gets the **Encounter** chip. The strip reads only the
viewer's own snapshot, which the server has already filtered.

**Dice words (§3.4).** The die buttons are builders — visible **+d20**, named **Add
d20**, in a group named “Add dice to the roll” — and roll nothing; the macro row is
captioned **Roll now:** and each macro is named **Roll d20 now** / **Roll ADV d20 now** /
…, one press one roll.

**Extraction first.** `MobileEntitiesList.tsx` (348) moved its row derivation, unchanged,
into `mobilePartyRows.ts` (the 39 layout suites / 672 tests green before any behaviour
changed); `EntitiesPanel.tsx` is 312 in the tree against HEAD's 340 (HEAD carries the own
commits below), the shared dialog having taken its copy out. `InitiativeModal.tsx` is 316
in the tree against HEAD's 348 — at the guard — because the dial moved out. Near the guard
now (`wc -l`): `DMMenuContainer.tsx` 342, `DMMenu.tsx` 332, `MobilePlayerRow.tsx` 318.
Every new source file is under 200 lines (the largest new test file,
`EncounterTab.test.tsx`, is 300).

**Help and guides.** In-app help: INIT's words, the auto-start on that character's turn,
the phone's strip, and a DM entry **⚔️ Encounter**. The DM guide gains an **Encounter**
section; Players and NPCs point to it; the player guide's initiative, dice and phone
sections are rewritten (the “initiative is desktop-only” sentence is gone). The guide
images are regenerated (`pnpm docs:screenshots`, the DM tour and the player's basics and
mobile tests) and each was read against its caption: 21 re-shot, and the new
`dm-menu-encounter.jpg`; the dialog's hint was reworded after the first shot showed the
pixel font drawing “−” (U+2212) as “.”.

### Own commits (fixes and test repairs)

- `b735acb8` **fix(initiative): the dialog follows its character, and closes when it is
  gone.** The dialog held the character object it was opened with: a character deleted
  while its dialog was open kept the dialog, whose Save sent a `set-initiative` for an id
  the server no longer has — it answers nothing, so the press waited five seconds and
  reported a timeout; a rename never reached the title. RED first
  (`EntitiesPanel.initiativeLive.test.tsx`, both cases failing for that reason).
- `68c5154d` **test(e2e): turn navigation sends the modifier set-initiative declares.**
  The spec's setup sent `modifier`, which `set-initiative` does not declare: the server
  dropped it silently (every character kept modifier 0 while the spec believed 2), and
  the strict type check reported it (U7 record, Known limits).
- `0ee06063` **test(server): characterize the two combat rules Encounter names** — the
  bulk-roll auto-start on the first NPC rolled, and `start-combat` mid-fight (top of the
  order, round 1, budgets refilled; DM-only). Real services; no behaviour change. (Round
  2's `6e8cce97` strengthened it: three NPCs rolled 10 / 19 / 3, so the turn lands on the
  first rolled — neither the top nor the bottom — and a character that never rolled
  refills too.)

Found by review round 1 in the shared initiative dialog, older than U8 (HEAD's desktop
dialog had each), so each is its own commit built from HEAD's files, RED on HEAD's code
first and verified from an export of the committed tree (typecheck, lint, format, 147
files / 1,981 tests):

- `c8819f63` **fix(initiative): an open hand entry closes when the table turns it off.**
  The dialog hid the Enter-by-hand button but kept a field already open, with an enabled
  Save; the server refuses a player's typed value without a word, so the press waited
  five seconds and timed out.
- `34e87cc2` **fix(initiative): a dialog waits on and reports only its own save.** A
  layout's one initiative hook carries every request; the dialog read its `isSetting` /
  `error` raw, so it opened disabled during another character's request, closed when that
  landed, and showed a timeout it never caused. `dialogGuards.useOwnSave`; the 21 older
  tests that set those props on a dialog with no save of its own re-pin to make that save
  first (their assertions unchanged — though round 2 found one had become a tautology and
  six siblings unre-pinned; `6e8cce97`), and the two that pinned removed `console.log`s go.
- `3225015e` **fix(initiative): the dialog is its character's alone.** The page behind
  the dialog stayed focusable: Tab then Space on another card's INIT re-rendered the same
  dialog for the new character with the first one's typed number. `#root` is inert while
  a dialog is open, and the dialog is keyed per character. (Only `#root`: round 2 found
  the windows beside it still live and Enter on a focused button still saving —
  `5e1340e4`, `c761b244`.)

Found by review round 2 — older than U8 except where marked — each again its own commit
from HEAD's files, its new test RED on the code just before it, and each verified from an
export of the staged tree (typecheck, lint, format, structure guard, the `ws` server suite
and the client initiative / interaction / characterization / layout suites — 83 files /
856 tests after the last):

- `6b643b1b` **fix(initiative): a fogged NPC's initiative line goes to the DM only.** The
  recipient filter strips an NPC from a player whose fog hides it, but its initiative
  line — rolled, or entered by hand — reached the public log and named it. While fog is
  on over a built map (the filter's own condition), any NPC with a token logs its
  initiative to the DM, as an eye-hidden one always has (`initiativeLineConcealed`, one
  rule for both paths). U8's Encounter buttons were new doors to the leak.
- `5b02dad3` **fix(initiative): the Party bar counts the order the server walks.** A PC
  with no seat (unclaimed, or its player's seat gone) is in the server's order but draws
  no card, so “Turn N of M” counted one fewer and read “Turn —” on its turn. The bar
  counts `initiativeOrder` (`utils/initiativeOrder.ts`, the client's one copy of the
  server's comparator — Encounter's roster uses it too).
- `779f22f4` **fix(initiative): a dialog's own save ends with its request.** After one
  failed save, every later request on the layout's hook showed “Setting...” in the dialog
  and closed it on that request's confirm (the leak `34e87cc2` fixed, back after the
  first save).
- `5e1340e4` **fix(initiative): the whole page behind the dialog is inert, and focus comes
  back.** Every `<body>` child but the dialog's portal; only what it made inert is
  restored; focus in on open, back to the opener on close.
- `c761b244` **fix(initiative): Enter saves from the hand-entry field only.** A
  document-wide listener saved on the Enter that pressed a focused Cancel, Roll or (U8's)
  **+**.
- `8f9f8764` **fix(initiative): a save in flight cannot be overridden.** Roll stayed
  enabled and the backdrop closed the dialog mid-save.
- `ae811a28` **fix(initiative): the modifier dial follows the stored modifier.** A change
  made elsewhere while the dialog was open was written back over by its Save or Roll.
- `6e8cce97` **test(initiative): the dialog and encounter tests assert what they claim**
  — six auto-close negatives given a save of their own, the setup save counted exactly
  once before each `mockClear`, a tautological focus check removed, the policy-flip
  title's claim asserted, and the encounter-rules characterization's three-NPC roll and
  bystander refill. (Round 3 found the policy-flip claim still unasserted — `eb0d3573`.)

Found by review round 3 — `8f88edea` a regression from this slice's own `b735acb8`, the
others older than U8 — built, RED-checked and verified the same way (84 files / 862 client
tests and the `ws` server suite, 1,540, after the last):

- `8f88edea` **fix(initiative): a reconnect does not close the dialog.** Any socket close
  nulls the snapshot while the app stays mounted, so for the blip the Party read no
  characters and not-DM, and `b735acb8`'s “gone is closed” — or the permission rule —
  closed the dialog for good: the typed value lost, a save in flight vanished with
  neither confirm nor failure. The dialog now keeps the character it last saw until the
  snapshot is back (the app's own test: the viewer's seat is in the roster), and only
  then judges “gone” and the permission.
- `7d4d576d` **fix(initiative): an untouched dial leaves the modifier to the server.**
  Roll sent the modifier the dialog last read, so a change made elsewhere within one
  round trip was written back over; untouched, Roll now sends none.
- `44e988ef` **fix(initiative): the hand entry is fixed while its save is in flight.**
  The typed field stayed editable and “Enter a roll by hand” live during the save.
- `eb0d3573` **test(initiative): pin what the round-3 review found unpinned** — the
  policy-flip test (it pressed Enter on the document, which cannot save since
  `c761b244`), the fog rule's player-character case, and an honest title for the
  Party-count case outside a fight.

Found by the live re-evaluation, older than U8, built the same way (85 files / 863 client
tests after it):

- `60a08cea` **fix(initiative): the hand-entry field fits its column** — a content-box
  field at `width: 100%` ran 20px past the dialog's column, past the screen on a 375px
  phone. `border-box`; the Enter comment beside it is condensed to keep the file at the
  guard (348).

## Duplicates and divergence (the capsule's escalation check)

Characterized before moving anything; none diverged:

- **Turn PREV / NEXT** — Players' controls (`useDMContext`), the Party bar
  (`MainLayout`) and the phone strip all send the bare `next-turn` / `previous-turn`; the
  server ignores `isDM` for both. Players' copy is removed; the other two stay as
  play-surface shortcuts.
- **Initiative entry** — the card's dialog (`roll-initiative` with the dial's modifier, or
  `set-initiative`) and the NPC bulk roll (`roll-initiative-all`, stored modifiers) meet in
  the server's one writer, `applyInitiative`, so the auto-start rules cannot differ.
- **Start / End / Clear all / Monster HP** — one copy each (Players), moved.

## Measured bars

| Bar (plan U8) | Result |
| --- | --- |
| A DM adds a group and rolls missing initiative without re-rolling existing values | Browser (`interface-encounter.spec.ts`): a Library pick ×3 through Encounter's forward; a hand value on the first goblin, then **Roll missing NPC initiative** — the other two roll, the hand value is unchanged, the button turns disabled. The hand value is asserted exactly (1 + the goblin's modifier 0), before and after. Live: the same, with the hidden goblin's roll kept off the player's log. The existing `InitiativeRollHandler` suite pins “leaves an NPC that already has initiative alone”. |
| A player rolls their character | Desktop: the card's INIT → **Roll d20 now** (browser spec; live, with the dial at +2 → `d20 + 2`). Phone: **⚔️ INIT** on their row → **Roll d20 now** (`mobile-encounter.spec.ts`, Pixel 7 touch; `MobileLayout` unit test through the real `MobileSurfaces`). |
| Start or join combat through the existing rules, advance, edit HP and end — both tabs agree | Browser: the hand value, saved with no fight running, starts combat on its character's turn (asserted); from a middle row (a PREV off the bottom first, where a NEXT would wrap to the top too) **Start at top of order** lands the turn on the order's first row; NEXT / PREV / NEXT, the holder's HP set from its card (the player reads `HP 3/`), the holder removed from the order (the turn passes to its successor — `Turn 2 of 3` on both), END. The two clients' `currentTurnCharacterId` are asserted equal after Start at top, after the NEXT / PREV / NEXT sequence and after the removal, and the DM's `Turn N of M` equals the player's Party bar (no hidden NPC in the order there — a hidden one counts in the DM's order only, as the live run shows). Phone: the turn is stepped to the order's middle row (from the bottom a NEXT would wrap to the top as well), **Start at top** must land it on the order's first row, then the DM's Encounter and the player's strip name the same holder after it, the DM's NEXT and the player's own NEXT. |
| Existing player turn actions and the turn-successor / budget protections stay | No turn-rule change (the one server change is `6b643b1b`'s log visibility). The player's NEXT advances on the phone strip in the browser spec and on the Party bar live (every desktop spec's NEXT / PREV is the DM's); `leaveOrderBudget` hands the turn on in the browser spec; the server suites (2,774) are green; `start-combat` mid-fight is characterized as refilling budgets, which **Start at top** names on screen. |
| A large dice selection still stages a build; an instant roll produces exactly one roll | `DiceRoller.test.tsx`: thirty **Add d20** presses send nothing and then one `30d20` roll; **Roll d20 now** sends exactly one roll and stages nothing; the builders and the instant macros sit in separately named groups. |
| Desktop and mobile, permissions matching the server | Unit: the shared dialog's permission rule (the DM, or the owner — `EntitiesPanel.initiativeDemotion`, mutant M17); a player's phone offers INIT on their own characters' rows only, by the character's owner, and never on a characterless seat (M18; `MobileEntitiesList.initiative`); on the phone Party, hand entry follows the table policy for a player and never binds the DM (`MobileLayout`, three cases, the seat's own snapshot `isDM` held false so only the passed-in flag can make a DM); the DM keeps hand entry in Encounter's dialog whatever the table policy (M12); an open hand entry closes when the policy turns off (`c8819f63`). Encounter is inside the DM menu, which renders nothing for a non-DM (`DMMenu` returns null; unchanged). |
| No clipping at 375 px; 44 px targets | Browser: the phone DM screen's seven chips on one ≥44 px row, every tab (Encounter included) clipping nothing in portrait and landscape, and the touch-floor sweep over every DM tab — all also with **Verdana forced** (CI's wider fonts). `mobile-encounter.spec.ts` sweeps `.encounter` (three participants) and the initiative dialog for under-44 px controls: none. Live at 375 × 420: Encounter with six participants no overflow, no control under 44 px; the phone dialog 375 wide, top 64 / bottom 356. |

## Live evaluation (`evaluate-live`)

### The first run (before review round 1)

**Mode: `live-two-client`**, on the dev server (5174/8787) in the desktop app's browser
pane: a fresh private table created through the lobby, the host elevated through its own
card's **Table role**, a player on a separately pinned session (`?sessionUid=`), every
action driven in one tab and read in the other. The pane was hidden for the phone half
of the run, and its clicks then landed at half their coordinates (a listener read 27,202
for 53,404) — so the phone checks were driven by the **keyboard** (Tab to the control,
Enter), which is real input and independent of the pane's scaling; the phone shell was
forced with `?mobile=true` and 375 × 420 emulation. Touch itself is covered by the
Pixel 7 browser spec, not by this run.

| Check (real input in one tab, read in the other) | Result |
| --- | --- |
| DM: DM MENU → **Encounter** | PASS: Setup / Initiative / Run encounter; both seats under **Not rolled yet** with Roll / Set… / 🎯 |
| **+ Add NPCs…** → NPCs & Monsters, ×3, 📖 Library → Goblin club brute | PASS: three numbered goblins on the player's client |
| Place all three; hide Goblin 2 from its card | PASS: the player's snapshot and roster lose it; Encounter tags it **hidden**; an unplaced fourth (below) has no 🎯 |
| **Set…** on Goblin 1 | PASS: the dialog says “No fight is running: saving an initiative starts combat, on Goblin club brute 1's turn.”; **Enter a roll by hand** 5 → **Save initiative**: combat starts on Goblin 1; the player's bar reads Turn 1 of 1 and the log shows the BY HAND line |
| **Roll missing NPC initiative** | PASS: the three others roll, Goblin 1 keeps 5; the hidden goblin's roll is not in the player's log; the button disables with “Every NPC has an initiative.”; Encounter shows the auto-start note (then worded “It is Goblin club brute 1's turn, but Goblin club brute 4 is at the top…”; reworded in round 1) |
| Player: own card → INIT → **+** twice → **Roll d20 now** | PASS: the server rolls `d20 + 2`; the DM's Encounter updates by itself |
| DM: **⏮ Start at top of order** | PASS: Player 2 (the top) holds the turn on both; DM “Turn 1 of 5”, player “Turn 1 of 4” — the hidden goblin is in the DM's order only, by the server's recipient filter |
| NEXT, NEXT (onto the hidden goblin) | PASS: the player's bar reads **Turn — of 4** and the goblin's name appears nowhere in the player's snapshot |
| Reveal it from its card | PASS: the player reads Turn 3 of 5 on it; its earlier roll stays out of the player's log (fixed at roll time, by design) |
| DM sets its HP to 4 from its card | PASS: the player's row reads HP 4/10 |
| Encounter: **Remove Goblin club brute 2 from the order** (the turn holder) | PASS: the turn passes to its successor, Goblin 1, on both (Turn 3 of 4) |
| Player: NEXT on their own Party bar | PASS: the DM's Encounter reads Turn 4 of 4 |
| Phone player (375 × 420): turn strip | **FAIL, then fixed** — see finding 1 |
| Phone player: **Party** | PASS: own row **⚔️ INIT 15** (103 × 44) and “Init 15” in the subtitle; no INIT on the DM's row |
| Phone player: ⚔️ INIT → the dialog; Escape | PASS: every control ≥ 44 px and inside 375 px; Escape closes the dialog only, the Party screen stays |
| Phone DM (same seat, rejoined): ♛ DM → **Encounter** | PASS: still DM after the rejoin; seven chips; Encounter no horizontal overflow, no control under 44 px |
| Phone DM: **🏁 End combat** | PASS: “No fight is running.”; four initiatives stay on file; the player's phone strip goes |

**Score 8.4 / 10 (pass ≥ 7.0)** — Functionality 8.5 (0.35), Multiplayer integrity 9
(0.30), Craft 7.5 (0.20), Reach 8 (0.15).

Findings:

1. **Major, U8 — the phone strip's turn name was painted over by the connection badge.**
   The new line sat at the top of the strip (y 20–46 at 375 px); the ONLINE badge is fixed
   at the top centre, z-index 200 (y 12–40), so the name was in the DOM — every text
   assertion passed — and unreadable. **Fixed in U8's tree:** the line renders below
   PREV / NEXT (y 80–106, measured live); `mobile-encounter.spec.ts` now asserts the two
   boxes do not overlap, and putting the line back above the buttons fails it (mutant E5).
2. **Minor, pre-existing — the floating DM window can lie over the Party's inspector.** A
   click aimed (by position) at a card's 👁 in the inspector landed on the DM window's
   **⧉ Duplicate** and made a fourth goblin. The window is movable and closable, and
   Encounter's own rows need no inspector; the DM window's placement is a layout decision
   (IA-15 reserved space for the launchers, not for this window). Not fixed in U8; offered
   to the owner.
3. **Minor, pre-existing — on a phone the ONLINE badge overlaps the top edge of PREV /
   NEXT**, as it did before U8 (the strip's position is unchanged; the badge ignores
   pointer events, so taps still reach the buttons). U9 moves connection state out of the
   way of screen content (plan U9: “ONLINE cannot cover screen titles”).

### Re-evaluation after review round 3

The first evaluation ran before both repair rounds, so the table was evaluated again on
the repaired tree (HEAD `eb0d3573` plus the slice; the field fix below came out of this
run). **Mode: `live-two-client`**, dev server 5174/8787, the same private table
(`table-zj7zpd`) and its two pinned seats, both tabs reloaded on current code — the host
re-elevated through its own settings' **DM Mode** with the table's DM password. The pane
was hidden, so every action is a real key press on a focused control (Space for buttons,
typed digits and Enter in fields); the seam only reads state. A **real socket drop**:
touching the server's entry file makes `tsx watch` restart the server alone — every
socket closes while both pages stay mounted; a recorder in each page saw the snapshot go
null and the “Reconnecting…” banner before the table came back.

| Check (real input in one tab, read in the other) | Result |
| --- | --- |
| DM: Encounter → **Set…** on Goblin 2 (no fight), hand 7, Enter in the field | PASS: the dialog took focus and made the page inert, and named the auto-start; combat started on Goblin 2's turn; the dialog closed and focus landed on the moved row's **Initiative 7** (round 3's focus fix); the player's bar read Turn 3 of 5, the line public (no fog, not hidden) |
| Player: own card INIT, **+** once (+3), hand 12; DM: Goblin 1's card INIT, hand 9; **server restart** | PASS: the player's dialog survived the drop with +3 and 12 (`8f88edea`), and its Enter saved “12 + 3 = 15” after it. The DM's dialog closed — correctly: the restart cleared the DM elevation (server memory, as after a deploy), so with the snapshot back the viewer was no longer DM and the server would refuse Goblin 1's save |
| Player: INIT, hand 11, Enter on a focused **Cancel** | PASS: cancelled only — no log line, the initiative unchanged (`c761b244`); focus back on Set Initiative |
| Player: INIT, dial untouched (+3 shown), **Roll d20 now** | PASS: the server rolled “d20 + 3” — the stored modifier, none sent (`7d4d576d`) |
| DM (re-elevated): Encounter → **⏮ Start at top of order** from the third of five rows | PASS: Goblin 4 (the top) holds the turn on both, same id; DM “Turn 1 of 5”, the player's bar “Turn 1 of 5” |
| Phone player (375 × 420): turn strip | PASS: “Turn: Goblin club brute 4” at y 80–106, the ONLINE badge at y 12–40; no horizontal scroll |
| Phone player: Party | PASS: own row **⚔️ INIT 9** (103 × 44, “Initiative 9: set for Player 2”); none on the DM's row; every row control ≥ 44 px |
| Phone player: ⚔️ INIT, **−** once, hand 16; **server restart** | PASS: the dialog survived with +2 and 16, the Party screen behind it; Escape closed the dialog only, nothing saved |
| Phone player: the dialog's hand-entry field | **FAIL, then fixed** — finding 1 |

**Score 8.55 / 10 (pass ≥ 7.0)** — Functionality 8.5 (0.35), Multiplayer integrity 9
(0.30), Craft 8 (0.20), Reach 8.5 (0.15). Not exercised live: the fog rule (this table has
no built map; the server suite covers it, `initiativeFogConcealment`) and a save held in
flight (too quick to catch by hand; the unit suites pin it).

Findings:

1. **Minor, older than U8 — the hand-entry field overran its column.** `width: 100%` with
   8px padding and a 2px border on a content-box: at 375 px its right edge was at 376, past
   the screen. **Fixed, own commit `60a08cea`** (`border-box`); the phone browser spec now
   holds the field inside the dialog's column (browser mutant E6 — the fix removed —
   fails it: 411.4 against 391.9); live after the fix the field's right edge is 356.3,
   the Save button's 356.3.
2. **Minor, this slice — after a reconnect focus did not come back to the opener.** The
   blip empties the roster, so the phone rows re-render and the desktop Party's inspector
   closes; the opener is gone when the dialog closes. **Phone fixed in U8's tree:** the
   row's ⚔️ INIT carries a `data-focus-key`, like Encounter's rows (`MobileLayout` test;
   mutant M62); live, Escape then gave focus back to ⚔️ INIT. The desktop half is a
   known limit (below).
3. **Observed, not a defect:** a server restart clears DM elevation (the deploy model),
   so a DM's open dialog on an NPC closes once the snapshot returns without DM — the
   server would refuse its save. The DM re-elevates from their settings.

## Verification

The full ladder (`gates-runner`, with e2e) on the final tree — HEAD `60a08cea` plus the
slice, after round 3's repairs and the live re-evaluation's fixes:

| Rung | Result |
| --- | --- |
| Shared build, `pnpm lint`, `pnpm format:check`, structure guard | pass |
| Server and client typechecks | pass |
| Units | shared 29 files / 452 tests; server 165 / 2,774; client 507 files passed, 4 skipped (the `zz_*` benchmarks) / 7,346 tests passed, 4 skipped — all 77 batches |
| e2e (`pnpm test:e2e`) | **288 passed**, 3 skipped (the accepted baseline: `map-navigation` ×2, `ui-state`), 0 flaky, 0 failed |
| Dev boot | not run (no `packages/shared` change); the dev server ran, and restarted, through the live re-evaluation |

Also, on the same tree: **bundle** (on its own) **151.96 KB** of 175 (U7 left 149.95).
The **contention canary** — the whole client suite at once: 507 files passed, 4 skipped /
7,346 tests, 0 failed. The two U8 browser specs alone after their round-3 changes: 2 of 2
(the desktop journey now deterministic, the phone spec with the field check).

Earlier runs, for the history: after round 2 the ladder passed with client 7,331 and e2e
288 (its client batch runner once crashed tearing down a worker, with no failed
assertion, and passed on its own); after round 3's first repairs, 7,344 and 288. The
first ladder, before the live evaluation's strip repair, had server 2,769 / client 7,306.
The two U8 journeys and the phone DM specs with **Verdana forced** (CI's wider fonts)
passed 14 of 14 before review round 1 — not re-run since. The strict type check of every
e2e file U8 touched is clean. Every own commit was verified from an export of its staged
tree (see Own commits).

## Proof the tests can fail

Every new or changed unit test was run against a mutant of the rule it pins (script in
the session scratchpad; each file restored and sha256-checked; the working tree's
fingerprint identical before and after the run):

M01 roster tie-break PC-before-NPC reversed · M02 turn mark without combat · M03 “hidden”
on a PC · M04 Roll missing never disabled · M05 ✕ sends a roll · M06 🎯 for a token off
the map · M07 bulk roll sent twice · M08 Monster HP pressed state inverted · M09 “Change
in Session” opens NPCs · M10 auto-start note never shown · M11 Start at top ends combat ·
M12 the DM's Encounter dialog follows the players' hand-entry policy · M13 the modal's
hand-entry reason gone · M14 the auto-start note inverted · M15a the raise button never
disabled · M15b the dial unbounded · M16 the dial's `touch-action` gone · M17 the shared
dialog's permission rule opened to anyone · M18 phone INIT on every row · M19 phone ▶ Turn
without combat · M20 the strip naming a character regardless of the pointer · M21 the
phone dialog not rendered · M22 Encounter after NPCs in the tabs · M23 Encounter unmounted
· M24 Players' forward dead · M25 NPCs' forward dead · M26 macros unnamed · M27 the dice
builders' group unnamed · M28 the DM menu given a copy of the initiative instance · M29
hand entry defaulting OFF · M30 the turn pointer dropped · M31 the dialog reopening for a
returning id · M32 the phone INIT unnamed.

**Browser (E1–E5):** the phone dialog not rendered; Start at top ending combat; the
strip naming a character regardless of the pointer; ✕ rolling instead of clearing; the
strip's turn line back above the buttons (under the badge). All killed.

**After review round 1** (anchors moved with the repairs; the whole set re-run, the tree's
fingerprint identical before and after): M18 now mutates the owner rule itself, and new —
M18b the characterless seat looked up as a character; M10b the note shown at the top
too; M33 the zero-NPC reason; M34 / M35 the dialog reading the layout's pending / error
raw; M36 the open hand entry kept after the policy turns off; M37 the page not inert;
M38 the dialog unkeyed; M39a / M39b the phone Party's hand entry always offered / binding
the DM; M40 the container's map tokens unwired; M41 the dial's lower bound; M42 the
roster sorted by name; M43 Monster HP's highlight inverted. **47 of 47 killed.**

**After review round 2** (the whole set re-run over the tree; each file restored and
sha256-checked by the harness — the working tree's fingerprint moved during this run
only because comments and this record were being edited, none of them a mutant's file):
M01 / M42 now mutate `utils/initiativeOrder.ts`, M35 / M37 and the three dial mutants
follow their moved anchors, and new — M44 / M44b / M44c a fogged NPC's line public, the
fog rule without a built map, and for an unplaced NPC; M45 the Party bar counting seated
characters only; M46 the own save never ending; M47 only `#root` inert; M48 / M48b focus
not returned / not taken; M49 Enter in the field dead; M49b a document-wide Enter back;
M50 / M50b Roll and the backdrop live during the own save; M51 the modifier read once;
M52 the dial live during the own save (it survived the first run: no test pinned the
lock — `InitiativeModal.u8` now does, and kills it). **61 of 63 killed; two equivalent
survivors:** M45b (the bar's turn index without the combat gate — outside a fight the
Party bar is given no combat object at all, so the index is never shown) and M46b (a new
Save not clearing the kept failure — while its save is pending the dialog shows the
hook's error, not the kept one, and the request's end overwrites it).

**After review round 3** (the whole set re-run over the repaired tree, each file restored
and sha256-checked; M17, M31, M48 and M51 follow their moved anchors): new — M53 / M53b /
M53c a reconnect closing the dialog, forgetting its character, or judging permission on
the blip's not-DM; M54 / M54b an untouched dial's Roll sending the modifier, or a touched
one's not; M55 / M55b the field or the hand button live during the own save; M56 / M56b
focus not following the `data-focus-key`, or Set… not carrying one; M57 the policy flip
keeping the typed value (the review showed, on paper, that the old test could not kill
it); M58 the fog rule
concealing players' characters; M59a / M59b / M59c each door's dialog told “no fight”
whatever the table says; M60 Encounter's empty-order status silent; M61 the dial's drag
live during the own save. After the live re-evaluation: M62 the phone ⚔️ INIT without its
focus key (the reconnect test fails), M63 the hand-entry field back to content-box.
**79 of 81 killed; the two survivors are M45b and M46b, the equivalents above.**
**Browser (E6):** the field fix removed, the phone spec fails on the column check.

**All 33 unit mutants killed** (the pre-review set). The first run left two survivors, both repaired before the ladder: M12
(nothing pinned that the DM keeps hand entry in Encounter's dialog when players may not —
a test added) and the original single-guard dial mutant, equivalent while the + button's
own `disabled` bound stands (replaced by M15a / M15b and a test that presses + twice at
+19).

## Review (`review-convergence`)

Four fresh, read-only Opus lenses per round (identity/state, permissions/secrecy, test
validity, doc-vs-code honesty), the tree fingerprinted before and after each round.

### Round 1 — FAIL (union: 0 P1, 7 P2, 21 P3)

Tree unchanged by the reviewers (fingerprint `de4dec78…` before and after); all four ran
tests (mode `ran-tests`); zero agent errors.

- **Identity/state (1 P2, 3 P3):** the layout's one pending/error state leaked into a
  dialog for another character (P2 → `34e87cc2`); the dialog was not keyed and the page
  behind it stayed focusable (→ `3225015e`); the Party bar's “Turn N of M” leaves out a PC
  whose seat is gone (a session loaded with its player absent) while Encounter and the
  server count it (→ Known limits, an owner question); the removed no-toast guard (no
  change: the zero case is now a disabled button with its reason, and the container always
  passes the toast).
- **Permissions/secrecy (1 P2, 1 P3):** an open hand entry survived the table turning it
  off (→ `c8819f63`); the phone INIT gated on the seat rather than the character's owner,
  and looked the characterless seat's uid up as a character id (repaired: the server's
  rule, and no INIT on a characterless seat). No secrecy leak: the strip and rows read
  only the viewer's filtered snapshot.
- **Test validity (1 P2, 9 P3):** the phone Party's hand-entry permission was unpinned
  (→ `MobileLayout` three-case test); the auto-start note's negative case, Monster HP's
  visual highlight, the roster's creation-order tie-break, the PC-never-hidden case, the
  strip's lookup by id, the server characterization's neighbouring rules, the phone
  spec's Start-at-top pre-state, the desktop spec's probabilistic hand-value check, the
  container's 🎯 wiring and the dial's lower bound (all repaired as named above and in
  the tests); two record overclaims (corrected here).
- **Doc-vs-code (4 P2, 8 P3):** the player guide put the strip's name above PREV / NEXT;
  the DM guide still said six tabs; the guide images were stale and
  `dm-menu-encounter.jpg` missing (regenerated, all read); the auto-start note blamed
  auto-start after an ordinary NEXT and said “its roller's turn” (reworded, above); fog
  also withholds the turn; “in U8” in user guides; the zero-NPC and phone-INIT copy; the
  dialog's stale portal comment and Encounter's header; four record overstatements
  (all corrected).

### Round 2 — FAIL (union: 0 P1, 9 P2, 19 P3 — the four lenses' headline P3s sum to 17;
the test lens named two more in passing, the visible **+d20** and the `MobileLayout`
fixture's seat `isDM`)

Tree fingerprint `8dcede18…` before the round. No after-fingerprint was taken — repair
began as the last lens reported — so the “unchanged” evidence for this round is each
lens's own statement that it changed nothing (the test lens also checked `git status`).
All four ran tests (mode `ran-tests`); zero agent errors. Not converging yet (round 1:
7 P2, 21 P3), inside the 3-round cap.

- **Identity/state (2 P2, 4 P3):** Enter saved the dialog from any focused control —
  Cancel, Roll, U8's **+** (→ `c761b244`); only `#root` was inert, so a settings window
  beside it stayed reachable, and the own save never ended, so after one timeout a later
  request closed the dialog (→ `5e1340e4`, `779f22f4`); focus was lost on open and not
  returned (→ `5e1340e4`); unclaimed PCs were missing from the Party bar's count
  (→ `5b02dad3`); a save in flight could be overridden by Roll, the dial or the backdrop
  (→ `8f9f8764`, and the dial's lock in U8's tree); the dial read the stored modifier once
  (→ `ae811a28`).
- **Permissions/secrecy (1 P2):** a fog-hidden NPC's initiative line — rolled or entered
  by hand — reached every player's log (→ `6b643b1b`; the DM guide's line names the fog
  case too). Every INIT door's permission and the hand-entry offer were checked against
  the server and matched.
- **Test validity (3 P2, 8 P3):** Escape, Cancel and Enter under someone else's request
  were unpinned (→ `InitiativeModal.ownSaveEnds`); `useInitiativeDialog`'s pending and
  error pass-through was unpinned (→ an `EncounterTab` case driving both through the
  dialog); the only shared-dialog Save used modifier 0 (→ a stored +2, raised once, sent
  as `("gob", 16, 3)`); six older tests not re-pinned, the setup save not counted before
  `mockClear`, a tautological focus check and the policy-flip title (→ `6e8cce97`); both
  browser specs' Start-at-top steps could not tell it from NEXT (→ each now starts from a
  middle row and asserts the first row's id); the inert test rendered outside `#root`
  (→ it renders inside, beside a settings window); the visible **+d20** unasserted and
  the `MobileLayout` fixture's seat `isDM` always equal to the prop (both asserted now);
  three record overclaims (corrected above).
- **Doc-vs-code (3 P2, 5 P3):** the inert claim and `3225015e`'s scope (now true, and
  said per commit); the record's status (rewritten); “the first initiative saved starts
  combat” — any initiative saved while no fight is running does, after End combat too
  (Encounter, both help topics, both guides, this record); the seat shown only when it
  differs from the name; the Party bar desktop-only; “Turn: —”'s second cause; “public
  roll log” comments (corrected in the dialog host, the modal, the bulk-roll and
  initiative hooks and the server's modifier message); the stale note quote and the own
  commits' former heading.

### Round 3 — FAIL, the cap (union: 0 P1, 6 P2, 19 P3)

Tree fingerprint `5a11dc1d…` before the round and after it, before any repair; all four
ran tests (mode `ran-tests`); zero agent errors. P1 zero in every round; P2 7 → 9 → 6. At
the cap the owner chose **repair all, verify** (no fourth round).

- **Identity/state (1 P2, 3 P3):** a reconnect closed an open dialog for good
  (→ `8f88edea`); focus fell to `<body>` after a first initiative from Encounter, whose
  row moves lists (→ U8's tree: the opener's `data-focus-key` names its successor, and
  `useInertPage` falls back to it); the hand entry live during its own save
  (→ `44e988ef`); an untouched dial's Roll could write back an old modifier
  (→ `7d4d576d`).
- **Permissions/secrecy (0 P2, 1 P3):** the fog rule's NPC-only clause unpinned
  (→ `eb0d3573`). Every door's permission, the hand-entry offer and the fog rule's
  coverage of every line path were checked against the server and held.
- **Test validity (3 P2, 5 P3):** the policy-flip test could not fail (→ `eb0d3573`);
  the same fog gap; the desktop journey failed about one run in ten — a bulk roll of 1
  ties the hand value and reorders it — so it now steps to the third of four rows by the
  order's own ids, and pins the bulk roll by its log lines (two new, none for the
  hand-entered goblin), not by the value; the Party-count case outside a fight
  (→ `eb0d3573`); the dial's drag lock, the followed modifier's “until touched” half, the
  auto-start note per door in both directions, and Encounter's empty-order branch (each a
  test now).
- **Doc-vs-code (2 P2, 11 P3):** this record credited round 1 with `6e8cce97`'s
  strengthening, and showed the live score as current though it predated both repair
  rounds (the evaluation is re-run below); stale line and test counts; the round-2 P3
  total; a stale “(entered)” and “public” wording in the modal and the roll handler; the
  Party bar's count is the server's order as the viewer's snapshot carries it; the
  player guide's desktop-only combat effects and the phone Party's **⚔️ INIT**; “each row
  reads its Init”; the help's hand entry “where the table allows it”; the pointers
  calling test commits bug fixes.

## Known limits

- **PLACE ON MAP still drops an NPC on the top-left cell** (U7's limit): placement rules
  are Setup territory, but U8 changes none; Encounter's Setup forwards to NPCs &
  Monsters, where the button and the guide's warning are.
- **The round is not shown.** `combatRound` is server-only state (the snapshot does not
  carry it), so Encounter says “Turn N of M”, not “Round R”; adding it is a wire change.
- **Two DMs editing one NPC still race** (U7's limit; `update-npc` is a whole record).
- **A hidden NPC's turn reads “Turn: —” on a player's phone** — by design: the server
  withholds the pointer (for a hidden NPC, and for one outside the player's sight), and
  the strip says only what it was sent. It also reads “—” when nobody holds the turn
  (after Clear all).
- **The desktop Party shows no card for a player character with no seat** (older than
  U8): an unclaimed PC, or one whose player's seat is gone after a load, is in the
  server's order and Encounter lists it; since `5b02dad3` the Party bar's “Turn N of M”
  counts it too, but the Party builds its cards from seats, so on its turn no card is
  marked. Showing a seatless character in the Party is a presentation decision; put to
  the owner.
- **Under fog, an NPC the whole table can see loses its public initiative line**
  (`6b643b1b`): a log line is written once for every player, and which players see a
  token changes as tokens move, so any placed NPC's line goes to the DM while fog is on
  over a built map. The DM's log keeps every line.
- **A DM's Encounter dialog closes on a reconnect.** The DM menu hides while the DM flag
  reads false during the blip (derived, never latched, like the rest of the menu), and
  Encounter goes with it; the desktop card's and the phone's dialogs survive the blip
  (`8f88edea`).
- **After a reconnect, focus does not come back to a desktop card's INIT.** The blip
  empties the roster and the Party's inspector closes with its character, so the dialog's
  opener is gone when it closes (the phone row's and Encounter's openers name a successor
  and get it back). Keeping the inspector's selection through the blip would fix it; it
  is the inspector's behaviour, not the dialog's.
- **The floating DM window can lie over the Party's inspector** (older than U8, seen
  live): a click aimed by position at a card's 👁 landed on the window's ⧉ Duplicate. The
  window moves and closes; Encounter's rows need no inspector.
- **On a phone the ONLINE badge overlaps the top edge of PREV / NEXT**, as before U8
  (the badge ignores taps). U9 moves connection state out of the way.
