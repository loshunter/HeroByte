# U9 — The Table, role, personal preferences and recovery are separate

Status: **implemented on `dev` and verified; not accepted. Uncommitted slice work above sixteen own
fix commits, local and unpushed: `0fb9b7bd`, `5262bdb7`, `07b7844b`, `15dd3899`, `bc3e3384`,
`b54bb0ee`, `8996993a`, `c44ad4b6`, `a4ac5402`, `a89d2d60`, `ab4da6a2`, `9b88518c`, `8ad5ed24`,
`4cdcf1e2`, `1c67afa7`, `ebbd20e4`. Review ran its three rounds and ended at the cap without an
all-PASS verdict (round 1: 1 P1 and 13 P2; round 2: 1 P1 and 7 P2; round 3: 0 P1 and 8 P2); every
finding is repaired and re-verified (280 unit and 37 browser mutants, four of them equivalent and
every other one killed). The final ladder is green (318 browser tests and the 3 accepted skips, 0
flaky; units 29 / 452, 165 / 2,786 and 531 files / 7,625 tests; 157.02 KB of 175), and the live
two-client evaluation, re-run on the final tree, scores 8.0; the last two own commits came after
it and were verified on their own staged trees. A read of the finished slice by a reviewer outside
this session found it sound and three things to fix (see Review): two are those two commits, and
the third, the leave latch, edits a file the slice owns and waits for the slice to be committed.**

## Owner decisions (2026-09-30, before building)

The plan makes destination names a product choice; the owner chose, in one round, from a
concrete desktop and phone proposal (every recommended option):

- **Desktop: a Table button in the header** replaces the UID half of the logo+UID block. It
  shows the table's name, your role and a connection dot; its menu holds **Your role**
  (**Enter DM mode** / **Leave DM mode**, through the existing password dialog),
  **Preferences** (**Display**: CRT; **Sound & motion**), **⚙️ Table settings…** for a DM, and
  **Your ID**. CRT and Juice leave the header; **Help stays**; the fixed ONLINE badge is gone
  and the header moves up its 24 px; Leave DM mode loses its danger styling.
- **DM Menu: Players and Session merge into one Table tab** — **Your role**, **Invite**,
  **Players at this table**, **Permissions**, **Backups**, **Security** — after the others:
  Maps · World · Encounter · NPCs & Monsters · Props & Objects · **Table**. The “EXIT DM MODE”
  button above the tabs is gone (it is at the top of the Table tab).
- **Phone: a Table tile in the Tools sheet opens a Table screen** (the CRT tile moves into it,
  and Sound & motion, which a phone never had, arrives). The DM screen gets the same Table chip.
  The connection state moves into every screen's own title row and into a top stack over the
  map (with the combat strip and the public-table chip). The dock stays five slots.
- **The character window: its Table role section is removed, with no pointer.** “Player State”
  becomes **Save character / Load character…** (this character only) and the phone gets the
  same two buttons; a table backup or map file handed to Load character is named, not obscurely
  refused.
- My own default, which the owner did not object to: after creating a table, a dismissible,
  non-blocking **next-steps card** offers **Enter DM mode** and then **Invite players** (it
  copies the link, and is held until the host is the DM — review round 1 found why, below). It
  stays in the tab that created the table until it is dismissed. It never elevates: the DM
  password stays the gate.

The capsule's escalation rule — *escalate if a new entry flow would change table creation or
elevation authority* — was checked and does not fire: the slice adds **no way to the DM seat**
and changes neither table creation nor elevation. The next-steps card calls the same
`handleToggleDM` the old Table role button called, and Invite is the existing link copy;
creation is unchanged (pre-auth `create-room`, then a full navigation). An earlier draft of this
record said "no server code change". That was false, and review found why: **the server did
change, in the restore path, and every change narrows what a file can do** (details under
*Own commits* and in Review):

- `b54bb0ee` — a restore keeps each seated player's own `isDM`. Before it, a backup file whose
  record for a seated uid said `isDM: true` made that uid the DM with no password, and a file
  that said `false` for the restoring DM demoted them. Authority is the room's, never the file's.
- `8996993a` and `9b88518c` — a restore drops the live token of an NPC it drops (the players
  were being sent a hidden monster's token, image and all), keeps a seated player's token with
  its character, drops a file token whose character the merge dropped, and leaves a kept token's
  lock, scale and rotation as they are.
- Comments only: `removePlayer.ts` (server) and `freshSession.ts` (client) now name the Table
  tab's files instead of the deleted Players tab's.
- `AuthenticationGate.tsx` hands the words for why the table is waiting to a
  `ReconnectPhaseContext` instead of painting a fixed banner; its login, session-token,
  4002/4003 conflict and fresh-session logic is unchanged (its tests changed only where they
  pinned the banner).
- No shared change and no new message.

## What U9 changes

Audit **IA-17** (host role buried in character settings; ONLINE over phone headings), the U9
halves of **IA-01** (the header gave tools, windows and preferences equal weight) and **IA-14**
(backups obscured their scope), and U9's part of **IA-19** (prose that exposes implementation).

**The Table button** (`features/table/TableMenu.tsx`, `TableMenuContent.tsx`) is the header's own
corner: a `🟢`/`🔴` dot, the table's name (the snapshot's, else the name this browser remembered
when it joined, else the code, else “Main Hall” — `tableLabel.ts`), your role (**Player**, **DM**,
or **…** while the table has not answered) and **▾**; while the server cannot be reached the
role's slot reads **OFFLINE** and only the accessible name keeps the “…”. Its accessible name
reads the same three facts (`Table menu: u9-role, Dungeon Master, online`). The name and the
public-table flag are held from the last snapshot through a reconnect
(`useTableMenuProps`): the public-table warning is a row of the header, and one that went with
the snapshot removed a row and put it back on every reconnect. The menu is **portalled** to `<body>` (the
header is a fixed stacking context, the Help button's reason) and **hangs from the bottom edge
of the whole header**, not of the button, which sits beside two rows of controls; it watches
the header itself, so a DM's elevation that wraps the tools a row lower moves it too. It is a
non-modal popover with the Escape contract the Juice popover had (its eight U2 cases were ported
unchanged, `TableMenu.u2.test.tsx`). Inside: **Your role**, **Preferences** (`PreferencesPanel.tsx`:
**Display → 📺 CRT**; **Sound & motion** — Motion, Mute, Volume), **⚙️ Table settings…** (a DM's
way on to DM Menu → Table) and **Your ID**. One object, `TableMenuProps` (`tableMenuProps.ts`,
`buildTableMenuProps`), is built once from the layouts' props and read by the desktop popover
and the phone screen alike — the lesson of `buildDMMenuProps`. The old `ServerStatus` badge,
`JuiceMenuButton` and the header's CRT button are deleted.

**Role is derived, never latched.** `useDMRole` gained `roleKnown` (the viewer's seat is in the
roster, read off the RAW snapshot — a socket close nulls the snapshot while the app stays
mounted, and for that blip `isDM` reads false). The Table button says **…**, the menu says
**Reconnecting…** with **Enter DM mode** disabled, **Table settings…** and **Leave DM mode** are
not offered, the DM Menu's launcher goes (and an open DM Menu closes: it reopens on Maps, and
anything typed in its Table tab is lost), and the host's next steps hide — all until the table
answers. `isDM` is passed in everywhere; nothing new reads it off the snapshot. Two more
places now tell a blip from a demotion with `roleKnown`, where they used to hide a
stale thing for the blip and let it return: the phone's DM, Props and World screens end for good
when the roster says the role changed (`useMobileSurface`), so entering DM mode again does not
spring an old screen open over the map; and the App's DM snapshot cache — kept so a DM's NPCs
survive a reconnect — ends with a known demotion (`useClearOnDemotion`), where it used to
paint the pre-demotion snapshot, hidden NPCs included, over a player's screen on every later reconnect.
Review round 2 carried the same rule into four more places: the Leave dialog and `useDMElevation`
read the outcome of a leave from the roster alone (`seatKnown`), so a blip neither closes an
unanswered Leave dialog nor counts as a confirmed leave, and the “You left DM mode” toast waits for
the server (own commit `ab4da6a2`); Player View, the DM's own lens, ends when the roster says the
role ended (`useEndOnDemotion`, `a89d2d60`), where it used to come back pressed at the next
elevation; an open floating window follows the header down and never back up, so a blip that takes
a DM's two tools out of the header and back does not make it bob (`a4ac5402`); and a leave the
server never answered is undone when the request runs out — the roster still lists the seat as the
DM, so the app says so again instead of leaving the Table menu reading “Player”.
Round 3 closed that flow's stale edges: the dialog closes on the OUTCOME it was opened for even with
an old “timed out” on screen, and cannot be confirmed while the roster is unknown (a confirm would be
queued and sent after re-authentication, long after the dialog had said it timed out; it says
“Reconnecting…” instead); one timer belongs to one request, and a dialog opens clean (`4cdcf1e2`).

**DM Menu → Table** (`features/table/tab/`) replaces the Session and Players tabs, each of which
held some of it under a name describing where it was built. Sections, top to bottom: **Your
role** (**Leave DM mode**, with “You keep your character and your seat…”), **Invite**,
**Players at this table** (**Select All**; **Remove** with its 60 s grace and cost text, moved
unchanged, `seatRemoval.ts`), **Permissions** (players can add props; players can enter rolls by
hand — each with a sentence on what it lets them do, and the BY HAND marker said once),
**Backups** and **Security** (change the table password, or reset it to the default after a
confirmation that says who could then join — round 3 —, or **Save as a Private Table**
on the public test table). Every read and send arrives as ONE required object
(`TableControls`, `tableControls.ts`, the shape Encounter uses), built in `DMMenuContainer`. The
tab row is Maps · World · Encounter · NPCs & Monsters · Props & Objects · Table; “EXIT DM MODE”
above it is gone. `menuRequest.ts` is the one seam between the Table menu (everyone's, entry
bundle) and the lazy DM chunk: “Table settings…” files a request the DM menu takes on mount or
through a subscription (ten seconds' lifetime, for a slow chunk over a phone connection) and
honours it for a DM only. **Not carried over from the two tabs:** the Players tab's “Open Encounter”
forward (U8 added it as a compatibility pointer; the plan retires such forwarding entries once the
new home works, and Encounter is a tab of its own), the Session tab's “N players currently online”
line (each seat's row says whether it is at the table; nothing shows the count) and the red EXIT DM
MODE button (Your role, at the top of the Table tab, has Leave DM mode). An outside read of the
slice noticed all three.

**Backups say their scope before a file is chosen.** **Download table backup** / **Restore table
backup…** are “Table backup — the whole table”, with the server's own automatic saving stated
separately (and, on the public table, that it clears when empty). Restoring says what it does — it replaces
the map, NPCs, props and drawings for everyone connected; everyone with a seat keeps their own
characters and tokens as they are now, and nobody's DM status changes (the server merges:
`SnapshotLoader.mergeSnapshot`). Reviews found the merge did not do what that sentence says, and
three own commits made it so: a restored file can no longer move the DM seat (`b54bb0ee` — the file's
`isDM` for a seated player used to win, so a file marking a player DM made them the DM with no
password typed, and a file from another night's table demoted the DM who restored it), an NPC's
token goes with its NPC (`8996993a` — the DM owns the tokens of the NPCs they placed, the merge kept
every token a seated uid owns, and an NPC placed after the backup lost its record but kept its token:
no record meant no hidden flag, so players were sent a hidden monster's token and image), and a
seated player's tokens are left as they are (`9b88518c` — no second token from the file for a
character the player already has, and a kept token's lock, scale and rotation are the room's). What
the merge still takes from the file, on purpose, and the copy now says so: each seat's own record
(name, portrait, HP, conditions), a character the file has and the table has lost (a recovery), and
everything that is not a seat's — the map, the NPCs, props, drawings, settings; a monster that is in
both stays where it stands.
**Save character** and **Export editable map** are named beside them. Each of the three pickers now recognises the
other two kinds (`utils/backupFormat.ts`: `detectBackupFormat` returns `session` / `map` /
`character` / `unknown`) and names what it was handed and where it belongs, before anything is
asked or sent: a character file or a map given to Restore table backup; a table backup or a
character file given to Import editable map; a table backup or a map given to Load character.

**The character window** loses **Table role** with no pointer and gains **Character file → Save
character / Load character…** — one character's name, HP, portrait, token and conditions, plus
the row owner's drawings if they have any (a file saved with none carries none, and loading it
touches nobody's drawings; one that holds drawings replaces, on a load onto your own card, the
drawings you have on the map; a DM's load onto someone else's leaves theirs), never the table. One
module both surfaces share WRITES a file (`features/players/characterFile.ts`) and one parser READS
it (`loadPlayerState`; the desktop card calls it directly, the phone's row through the module); what
goes into a save is each surface's to hand over — the desktop card is given it by its parents, the
phone's row assembles it from the table's collections, and each is pinned by its own tests. The phone's ⚙️ EDIT sheet gets the same two buttons
(it had none): same handlers, same permission (the owner, or a DM on any row). A saved file is
named `…-character-….json`.

**The phone.** **⚒ TOOLS → Table** opens a **Table screen** (`MobileSurfaces.tsx`, the surface
machine's new `table` surface): the same `TableMenuContent`, every control at the 44 px floor and
its words at the 11 px readability floor, **Sound & motion** present on a phone for the first
time. Every full screen's header is now a grid whose first row is the connection chip and whose
second is the title and ✕ (`MobileScreen.tsx`) — a screen is an opaque cover, so it says for
itself that the table lost the server, in a row that cannot cover its title. On the map, the
chip, the public-table chip, the host's next steps and the combat strip are ONE in-flow column,
`.mobile-top-stack` (`MobileLayout.tsx`): they were three things with hand-picked `top`s (the
badge and the public-table chip fixed, the combat strip absolute; the host's card is new), and
the badge painted over the strip's PREV / NEXT. The dock stays five slots. The full-screen dice
overlay covers the screen and the stack with it, so it carries its own chip (round 2: the record
had called that a recorded limit, and it was worse than recorded — no connection state was
shown anywhere while dice were open).

**The reconnect notice** (rounds 2 and 3). While the socket is away the gate used to paint a fixed
“Reconnecting…” / “Re-authenticating…” banner at the top right, z-index 2000, taking taps. Once
the header moved up to the top edge (this slice) it lay over RECENTER and SNAP on a desktop (134 px
of it at 1280), and over 26 px of the phone's OFFLINE chip — a second fixed connection indicator
beside the chip that exists so nothing is fixed over anything. The gate now only says WHY it is
waiting (`ReconnectPhaseContext`, `features/table/reconnectPhase.ts`) and each host places the
words in its own layout (`ReconnectNotice`). On a desktop the layout hangs a `ReconnectNoticeDock`:
a FIXED sibling of the header, `top` the header's measured bottom edge plus 8 px (whatever height
its tools wrap to), z-index 2100, above every floating window. Round 2 had put it inside the
header, whose own z-index of 100 left it under Chat & Rolls; round 3's lens found that by reading
the CSS, and the browser now proves the repair — with Chat & Rolls open at the right edge,
`elementFromPoint` at the notice's centre is the notice, in both phases of a real outage. The
phone's top stack gives the words a place in its column, after the chip. Neither takes a tap (the
dock's own `pointer-events: none` is asserted as well as the notice's). A toast — the app's top
layer by design: z-index 10000, the same corner, three seconds, tap to dismiss — may cover the
desktop notice while it lives, and a full-screen phone screen shows OFFLINE but not the words (both
in Known limits).

**After creating a table** (`HostNextSteps.tsx`, `newTableMarker.ts`): creation ends in a full
navigation, so the lobby leaves a per-tab, per-table `sessionStorage` marker and the arriving tab
reads it. The card says **Your table is ready — next steps**, offers **Enter DM mode** (only
opens the password dialog — `handleToggleDM(true)`, nothing else), **Invite players** (copies
the link, which never carries a password or this tab's pinned `?sessionUid=`, with a manual
fallback when the clipboard is refused) and **✕**. The marker outlives reloads: the card returns
in that tab until ✕ is pressed. Once the host is the DM it reads “✓ You are the DM.” It waits for `roleKnown` like everything else
that judges a role.

**Invite players is disabled until the host is the DM** (review round 1, P1). On a table made
without a DM password, the first person to enter DM mode sets the password and becomes the DM
(the bootstrap dialog, unchanged), so a link sent first could hand the seat to the first guest
while the card's own text promised the DM password was the gate. The card now says “Enter DM mode
first…”, the DM step says it may ask to *set* a password, and the guides say so. Round 2: the hold
is about the seat being UNCLAIMED, so once the host has been the DM in this tab (a per-tab
`claimed` state in the same marker) Invite stays available — leaving DM mode, or a restart that
clears the elevation, no longer greys it out with a note that had become false.

**Outcome statements instead of implementation prose** (the capsule's third bullet):
- *Capacity.* The Map library's line reads **Room for more maps / Nearly full / Full / Too big
  to restore** with what to do next. “Room” holds only where even the heaviest new map — a
  `large` warehouse, about 460 KB all in: 270 KB stored plus up to 190 KB of compiled scene, the
maxima `wsLimits.ts` records — still fits under the 0.75 MB mint ceiling (from about 0.30 MB it
reads “Nearly full — a large map may be refused”); the tooltip holds the current size, and the arithmetic is in a new DM help entry,
  **How many maps fit**. (The first version counted the scene alone, 190 KB, and promised room a warehouse would not have
had — review round 1; its second, 400 KB, was short of a warehouse's 460 by the same kind of
arithmetic: at 346,000 bytes it still said “Room” where a 270 KB warehouse and its scene would
have been refused — review round 2.)
- *Roll entry.* Players can enter rolls by hand says who may type what, and that every entry is
  marked BY HAND (the old Session tab said the same in a mechanism's words).
- *Monster HP.* Encounter's note follows the chosen mode, for every NPC the players can see (the rule covers allies
and townsfolk too, not only monsters)
  (the server never sends a hidden or out-of-sight NPC's record at all): Exact — the exact HP;
  Bloodied — 🩸 Bloodied at half HP or below, Healthy above; Hidden — ??? in place of HP; never the numbers,
  and player characters always exact. The “keep the numbers off players' screens entirely”
  sentence is gone.
- The Players tab's wire-filtering prose was dropped with the tab.

**Pointers that followed their controls:** Encounter's link (**Change in Table**), the
initiative dialog's reason (“…DM Menu → Table → Permissions.”), the public-table notice's
keep-it path (“DM Menu → Table → Security → Save as a Private Table”), the DM help (Become the
DM, SAVE → Download table backup, REMOVE, Permissions, Invite, Security) and a new Table menu
help topic (eleven topics now, `tableHelpTopic.ts`), the guide-link descriptions, and the
characterless-seat comments on the phone's Party.

**Structure.** New source modules (`.ts`/`.tsx`) are all under 200 lines (largest:
`TableBackupControl.tsx` 197, `TablePasswordControl.tsx` 194, `TableMenu.tsx` 187,
`TablePlayersSection.tsx` 180); the new stylesheet `table.css` is 282 and the new e2e specs are
under the 350 guard (largest `mobile-table.spec.ts` 334). Baselined files that shrank:
`PlayerSettingsMenu.tsx` 449 (was 486), `MainLayout.tsx` 436 (was 450), `PlayerCard.tsx` 490
(was 501). **Two baselined files grew**, and an earlier draft of this paragraph said one did not:
`App.tsx` 948 → 959 (the demotion hooks, Player View's end and the leave latch's recovery;
commit `bc3e3384` had promised the slice would give its line back, and it did not — the guard
passes because the file is baselined, but it is the largest god file and U9 made it eleven lines
bigger) and `MainLayoutProps.ts` 462 → 470 (the `roleKnown` prop and its comment). Near the guard:
`DMMenuContainer.tsx` 335 (was 342), `DMMenu.tsx` 271 (was 332), `MobileSurfaces.tsx` 324 (was 279: it
gained the Table screen and the dice chip), `MobileLayout.tsx` 329 (was 328),
`DraggableWindow.tsx` 315 (was 329: its placement moved into `headerPlacement.ts`, and its stored
position into `windowPosition.ts`). All counts are `wc -l` on the final tree; “was” is the base,
`f69bb331`.

### Own commits (fixes found on the way)

Each was committed from the index alone — where the working tree carried the slice's uncommitted
changes to the same file, HEAD's copy patched by script — and verified from an export of the staged
tree (`git write-tree`: vitest, `tsc`, eslint, prettier, `lint:structure:enforce`). Round 2 added
six, round 3 three more and an outside read of the finished slice two (sixteen in all); the test
of a fix is always written and watched to fail first.

- `0fb9b7bd` **fix(dm): the elevation dialog fits a 375px phone.** The DM password dialog was a
  centred box with a 400 px minimum width (452 px outside): on a 375 px phone its left edge hung
  38 px off the screen, with the field's and Cancel's left edges. It is now
  `min(452px, calc(100vw - 32px))` wide, the same 452–552 px on a wide screen. RED first: the new
  phone spec measured the panel at x = −38.5 at HEAD and green after. (The spec was migrated in
  the slice to reach the dialog the way a host does: Tools → Table → Enter DM mode.)
- `5262bdb7` **fix(dm): a wrong DM password puts the cursor back in the field.** While a request
  is in flight the field is disabled, and a disabled field drops the cursor: after “Invalid DM
  password” the next keystroke went nowhere and Ctrl+A selected the table behind the dialog. When
  an attempt fails the dialog now focuses the field and selects its text; in bootstrap mode it is
  the new-password field; nothing moves the cursor while nothing has failed. Found driving the
  real dialog in the browser pane; RED first (two of three tests fail at HEAD with `document.body`
  as the active element); four mutants killed, one equivalent (a disabled field cannot take focus).
- `07b7844b` **fix(ui): floating windows open below the header's controls.** A window with no
  remembered place opened at a fixed 100 px, which is ON the tools under a header that has grown
  a row: HEAD's DM header already wraps at 1280 px (the old `dm-menu-session.jpg` shows the DM
  Menu covering Dice, Chat & Rolls and Help), and the new Table button made the public-table
  player's header wrap too. It was found when the docs harness could not press the Dice button
  again to close the roller it had opened. A window now opens under the header's lowest control
  (measured from the controls, so a palette that was never in the way does not move — a first
  version measured the header's frame, moved the Map Tools palette lower, and pushed
  `interface-generate-outcomes`' hint below the fold), and a window the player has placed keeps
  its place. RED first: four tests fail at HEAD (three placements and the header's new
  `data-header-root` marker).

- `15dd3899` **fix(ui): an open window follows the header when its height changes.** The
  placement `07b7844b` added is judged once, at mount, and a header's height changes while a window
  is open: a player who enters DM mode gains Build map and Player View, the tools wrap a row
  lower, and a Dice Roller opened a moment earlier lay over the buttons that moved — including the
  Dice button that would close it, the defect `07b7844b` was made to remove. An un-placed window now
  watches the header's root (`headerPlacement.ts`, `useFollowHeader`) and re-measures its lowest
  control; a dragged window and one restored from a remembered position stop following. RED first:
  three of the five new tests fail at HEAD (it never moves, never goes back up, never stops
  watching); the two that say a placed window stays put already held and pin the rule. Found by
  review round 1 (identity lens).
- `bc3e3384` **fix(dm): a demoted DM no longer keeps the DM's snapshot to paint over later
  reconnects.** App caches the last DM-visible snapshot so a DM's NPCs and tokens survive a
  reconnect, and only a LOCAL Leave DM mode cleared it: when the server ended the elevation (a
  restart, a revoke) the cache stayed and every later blip painted the pre-demotion snapshot,
  hidden NPCs included, over a player's screen. `useClearOnDemotion` ends it once the roster has
  arrived and says this seat is no DM; `roleKnown` (the roster test, which `useDMRole` returns
  from this commit on) is how it tells a demotion from a blip. RED first: nine tests fail at HEAD
  (three for `roleKnown`, five for the hook, one App-level). It predates U9; found by review round 1
  (identity lens, outside the diff). `App.tsx` 948 → 949 lines at this commit; the slice gives the line back.

- `b54bb0ee` **fix(session): a restored file can no longer move the DM seat.** Restoring a table
  backup replaced a seated player's whole record with the file's, `isDM` included. DM status is
  earned with the DM password and lives in the room's own record of the seat, yet the file carries
  every seat's flag: a file marking a seated player DM made them the DM with no password typed, and
  a file from another night's table demoted the DM who restored it (the server's own
  characterization test pinned the first as intended — that assertion is flipped). `load-session` is
  DM-only, but a hand-edited file handed to a DM by a player reaches it. The merge now keeps the
  room's own `isDM` for every seated player; name, portrait, HP and conditions still come back as
  the file had them, and a uid the file calls DM who is not at the table was never seated and still
  is not. RED first: the flipped assertion and two new tests fail at HEAD (the third, for the
  unseated DM, already held); four mutants killed. Found by review round 2 (permissions lens).
  Pre-dates U9; U9's restore copy had described the merge incompletely.
- `8996993a` **fix(session): a restore no longer strands a monster's token on the map.** The merge
  keeps every token a seated uid owns, and the DM owns the token of each NPC they placed, while an
  NPC's record belongs to the file. An NPC placed after the backup lost its record and kept its
  token — a token with no character behind it, so no hidden flag — and the players were sent it,
  image included, even for a monster the DM had hidden (the docs lens reproduced it on the compiled
  server: a player's snapshot gained `tok-mimic` and its image). An NPC the file also had, pointed at
  a different token there, left two tokens for one monster. A token now follows its character: a
  live token that the room's characters pointed at and the merged characters no longer do goes with
  them; a seated player's own character keeps its token, and an NPC the file also has keeps its live
  token where it stands, as before. The load log's “preserved N current tokens” counts what the
  merge kept. RED first: three new tests fail (the orphan survives; a player's snapshot carries the
  hidden mimic's token and image; a re-pointed NPC keeps both tokens), the fourth — the live
  position of an NPC in both — already held; four mutants killed. Found by review round 2 (doc lens,
  the one P1 of the round). Pre-dates U9.
- `c44ad4b6` **fix(ui): a click on a window's title bar no longer places the window.** A press on the
  title bar marked the window “placed” and, on release, saved its position even when the pointer
  never moved. A placed window stops following the header and a saved position is followed by no
  later visit either, so one click on the Dice Roller left it under the row a DM gains on entering
  DM mode — the defect `07b7844b` and `15dd3899` exist to prevent. A press now has to travel three
  pixels to be a drag; only then is the window placed and remembered. `DraggableWindow` crossed the
  350-line guard with it (357), so its load and save of the remembered position moved into
  `windowPosition.ts` unchanged (305 lines after). RED first: three new tests fail (a plain click
  still stops the window following; a 2 px nudge moves it; a click saves `{x: 100, y: 100}`);
  five mutants killed. Found by review round 2 (identity lens).
- `a4ac5402` **fix(ui): an open window no longer bobs when the header shrinks for a moment.**
  `15dd3899` made a window follow the header both ways. A reconnect takes a DM's Build map and
  Player View out of the header and brings them back (the page cannot know it is a DM with no
  roster), so at 1280 px the header lost a row and regained it and every un-dragged window went up
  a row and down again, under the pointer, for the length of the outage. A window now follows the
  header down and never back up (a row low is a gap; a bob costs the player the click). RED first:
  two new tests fail (it stays at 184 when the header shrinks; through shrink-regrow it reads
  100, 184, 100, 184); the test that it still goes lower when the header outgrows it already held;
  three mutants killed. Found by review round 2 (identity lens).
- `a89d2d60` **fix(ui): Player View ends when the DM role does.** Player View, the DM's one-toggle
  lens on what players receive, is view state in App and nothing ended it: a DM who left DM mode, or
  whose elevation a restart cleared, kept it — it came back on, pressed and hiding the DM's chrome,
  at the next elevation, and in between the player's own fog was built from the party's tokens
  (`fogViewerTokens` picks the tokens the viewer does NOT own under the lens) instead of their
  own. `useEndOnDemotion` ends it once the roster has arrived and says this seat is no DM, never on
  a blip. RED first: five hook tests (no such hook) and an App-level test (after the demotion the
  lens is still on). Pre-dates U9 (`d82555c3`'s lens, same at HEAD); found by review round 2
  (identity lens).
- `ab4da6a2` **fix(dm): a leave is confirmed by the roster, never by a reconnect blip.**
  `useDMElevation` read a request's outcome from the viewer's DM flag, which is false for two
  reasons: the seat is no DM, or there is no roster at all. A confirmed Leave whose frame a dying
  socket never delivered therefore read as done at once — the request ended as a success, the
  dialog closed, and “You left DM mode” had been announced — while the server still held the seat as
  the DM. The hook now waits for the seat to be in the roster before it judges anything; a roster
  that returns after the blip confirms a leave the server did hear, one that returns still listing
  the DM lets the request run out its five seconds and say it timed out; the toast moved from the
  click to the confirmation; `modalState.roleKnown` tells the dialog whether the roster is known.
  RED first: eight of eleven new tests fail (the other three pin what held); seven mutants killed.
  Found by review round 2 (identity lens). The slice's half — the dialog not closing on a blip
  (`DMElevationModal`) and the App ending its latched “leaving” state when the request runs out —
  is in the slice, where the Table button those tests observe exists.
- `9b88518c` **fix(session): a restore leaves a seated player's tokens as they are.** The restore's
  own sentence, “players already seated keep their characters and tokens as they are now”, held for a
  live token's position and not for the rest; the permissions lens proved it by probing the merge in
  round 3. A seated player's live character wins over the file's and points at the live token, but
  the file's token for that same character was added too: a second token with no character behind
  it, which the player controls and sees from. A file token one of the FILE's characters points at
  now stays only if a merged character still does (the file-side twin of `8996993a`). And a kept
  token's lock, scale and rotation live in its scene object, which the merge took from the file: a
  player's token came back unlocked, unrotated and at the file's scale (at the defaults when the file
  did not list it). The room's own scene objects for the kept tokens now go in place of the file's.
  RED first: three new tests fail (the extra token; the file's lock, scale and rotation winning; a
  live scene state the file does not list being lost) and the two that pin what held pass (a loose
  file token and a carried NPC's; the load log's count of kept tokens). Five mutants killed and one
  equivalent (keeping the file's scene entry beside the live one changes nothing: the rebuild reads
  the list into a Map and the live entry is last; its order-flipped twin is killed).
- `8ad5ed24` **fix(ui): a browser resize no longer places a window the player never placed.** A
  resize clamps a window that ended up off the screen, and it saved the clamped place whether or not
  the player had placed the window; a saved place is read back as placed. So a DM Menu or Chat &
  Rolls window opened at `innerWidth − 420` on a wide screen and then caught by a browser snapped to
  half width was remembered at the old header's `y`, never followed the header again, and a taller
  header's lowest row lay over it for good. Only a window that has a place of its own (dragged, or
  restored from one) remembers its clamp now. The click-or-drag slop got both its bounds pinned as
  well: exactly 3 px is a drag and 2.8 px is a click (the tests moved 2.24 px and 50 px, so any
  threshold between them passed; round 3's tests lens found it). RED first: the new test of an
  unplaced window's resize fails against the previous handler (it saved `{"x":760,"y":100}` for a
  window nobody touched); four mutants killed. Found by review round 3 (identity lens).
- `4cdcf1e2` **fix(dm): a request's timer belongs to its request, and a dialog opens clean.**
  `useDMElevation` kept no handle on its five-second timers, so an earlier request's timer fired
  during a later one (a DM who left, came back and left again was told the second leave had “timed
  out” at the first one's mark), and a request the roster had answered, or the server had refused,
  left a timer to fire into nothing. One timer now belongs to the one request in flight, stopped when
  the roster answers, when the server refuses, when another request starts and on unmount; the
  `console.trace` in `revoke()`, which printed a stack on every leave, is gone. A dialog that opens
  afresh no longer opens showing the last request's error (an outage's “timed out” was still on
  screen in the next Enter DM mode dialog): `handleToggleDM` clears it. Found by round 3's identity
  and permissions lenses, as the stale edges of round 2's blip-proof dialog (a confirm during an
  outage had become reachable). RED first: all eight new tests fail against the previous hook and the
  eleven older ones pass; seven mutants killed. The dialog's own half (closing on the outcome, no
  submit while the roster is unknown) is in the slice.
- `1c67afa7` **fix(ui): a remembered window place over the header's controls is lifted.** A window
  with a remembered place skipped the rule that a window opens under the header's controls, so one
  saved over them opened over them, covering the Dice and Chat buttons that close it. Until a click on
  a title bar stopped saving (`c44ad4b6`), any click saved the window's default y: anyone who ever
  clicked a title bar has about y = 100 stored, which a DM's three-row header (its lowest control ends
  at 117) has since grown past. A remembered place over the controls now opens just under them (the
  rule an unplaced window gets), and the window is not counted as placed, so it goes on following the
  header like a fresh one; a place below the controls is untouched, and a window already open when the
  header grows keeps its remembered place. RED first: three new tests fail (a remembered y of 20 under
  controls ending at 180; the old click's y of 100 under a header ending at 117; neither follows the
  header afterwards); the two older tests that said a remembered place is never moved are rewritten
  for places below the controls; six mutants killed. Found by the outside read.
- `ebbd20e4` **fix(dm): a leave the server hears after its five seconds still says it happened.**
  `useDMElevation` read a leave's answer only while the request was in flight. A leave the dying
  socket queued is sent when the socket reconnects, so the roster can confirm it after the five
  seconds have run out: the dialog had said “timed out”, the person was then demoted, and “You left DM
  mode” never appeared. The hook now remembers when a leave was asked and, for a minute afterwards,
  counts the roster's DM → not-DM change as its answer: it says so once and clears the stale timeout.
  Asking to be the DM again (Enter DM mode, or setting the DM password) withdraws it, and an answered
  leave is not waited for again, so a demotion nobody asked for (a restart clears every elevation)
  still says nothing. RED first: the late confirmation fails against the previous hook; the tests that
  bound it (a minute, a later request, once) already held; eight mutants killed. Found by the outside
  read.

Inside the slice, fixed as they were found in the slice's own new UI (they are not earlier
bugs): the open Table button drew its role text gold on its own gold ground (now a 4.5:1
contrast assertion); the Table button widened the header until RECENTER wrapped at 1280 px (the
button is capped at 200 px, its name cut with an ellipsis and shown whole in the menu; a
measured “Play tools on one row” assertion at 1280 px); the Table surfaces' labels and buttons
sat at 8–10 px on a phone (now the 11 px floor, swept by a spec); a request for the Table tab
expired after 3 s, before a lazy chunk over a slow phone connection could take it (now 10 s);
and, found by the live evaluation, the Motion dropdown's shown value at 10 px on the phone's Table
screen and the next-steps card's refused-clipboard field at 21 px tall on a phone (an 11 px sweep that now counts form controls, and a 44 px check on that field, pin both).

Inside the slice again, from review round 2 (none of them an earlier bug): the reconnect notice
(above); the full-screen dice overlay's own chip; the next steps' `claimed` state; the Leave
dialog not closing for a blip and the App ending a leave the server never answered; the Table
menu's ID no longer carrying the whole identifier in a tooltip (it claims a seat, with the table
password, whenever no session holds it — the menu shows the first eight characters, as the header
always did); the campaign allowance (460 KB); the phone's Save character contents and its
Load round trip under test; the restore copy, the character-file copy, the load errors (“That
character file…”, not “Player state…”), the Encounter note (“NPC”), and the demo-server workflow
(which still sent people to the Session tab, and to reset a password the public table cannot
change).

## Duplicates and divergence (the capsule's escalation check)

The capsule says to characterize each control and any divergence between duplicates before
moving it. The moves were done under the existing characterization: every moved control's
tests were **ported, not rewritten** — the backup control, the table-password control, the
players list (REMOVE's grace and cost text), the permissions — by case count, `it` blocks:
`SessionPersistenceControl` 33 → `TableBackupControl` 33, `RoomPasswordControl` 39 →
`TablePasswordControl` 44, `PlayersTab` 11 → `TablePlayersSection` 13, `SessionTab.initiative` 8 →
`TablePermissionsSection` 15, `JuiceEscape.u2` 8 → `TableMenu.u2` 8 (the extra cases, where there are any, pin copy and wiring that did not exist before the move — for the password control, what Reset to default does and now asks; `TableMenu.u2` carries
eight cases but not the old `toHaveTextContent("🔇 Juice")` — the mute indicator went with the
header's Juice button, and Sound & motion in the Table menu is where mute is said now). The old tab-level
characterization (`SessionTab.test.tsx`, 779 lines: 47 cases that mock the three children and
check that each prop passes through, “undefined when not provided” included) was replaced by
`TableTab.test.tsx` (28 cases over the real sections). The optional-prop cases have no
successor on purpose: every read and send is now one required object (`tableControls.test.ts`).
Duplicates that existed, and what became of each:

- **Enter DM mode** lived in one control reached two ways (the character window's Table role:
  desktop inspector → ⚙️, phone Party → ⚙️ EDIT); it is now the Table menu/screen, and the
  next-steps card calls the same handler. Both open the one dialog (whose bootstrap mode, for a
  table made without a DM password, is unchanged).
- **Leave DM mode** had two (the DM menu's EXIT DM MODE, the Table role button); it is now the
  Table menu/screen and DM Menu → Table → Your role, both the same `handleToggleDM(false)`.
- **The connection state** had one fixed badge; it is one component (`ConnectionChip`) placed by
  its host in four places on purpose: the desktop popover (beside the Table button's dot), every phone
screen's header row, the full-screen dice overlay, and the phone map's top stack — and the words for
WHY the table is waiting, `ReconnectNotice`, are placed by the same hosts, not painted over them.
- **CRT** had a header button and a Tools-sheet tile for one preference (`herobyte:crt`); it has
  one toggle in the Table menu and one on the Table screen, reading the same value. Sound &
  motion (`herobyte:juice`) had one desktop popover; it is in the same two places.
- **The invite link** has two surfaces (the Table tab and the next-steps card) sharing one hook.
- No divergence between duplicates was found (the moved controls had no twins). Two sharp
  edges were kept and are now stated instead of implied: **Reset to default** gives a private
  table the password the setup docs publish for the public Main Hall (round 3 made the button ask
  first; it still does it); and a player's **REMOVE** still refuses inside its 60 s grace. Neither
  was otherwise changed.

The capsule's escalation rule — *escalate if a new entry flow would change table creation or
elevation authority* — does not fire: nothing adds a path to the DM seat or changes creation or
elevation (the server changes are all in the restore merge and narrow what a file can do — see
the top of this record); no shared change, no new message; the next-steps card is a prompt that
calls the one handler the old Table role button called.

## Measured bars

| Bar (plan U9) | Result |
| --- | --- |
| Fresh host creation → elevation → invitation, driven through the NEW UI (not `elevateBySeam`) | Browser (`interface-table.spec.ts`): create a private table through the lobby → the next-steps card, and the host is a **player** (`viewerIsDM` false, no DM MENU, the Table button reads `…, Player, online`) → a wrong password → the right one typed by keyboard alone → “✓ You are the DM.” → **Invite players** puts the link on the clipboard (the room, neither password) → a guest opens it and enters the table password: a player, no next-steps card, no **Table settings…**. The manual-copy fallback when the clipboard is refused has its own spec. A table made with no DM password has its own spec: Invite stays disabled through the bootstrap dialog and opens only once the host has set the password and is the DM. Phone: `mobile-table.spec.ts` covers the same path by touch from the host's side (Invite disabled, a wrong password, the right one, Invite, and — with the clipboard refused — the manual-copy field), without the guest's join. The specs that are ABOUT becoming or leaving a DM go through `table-role.helpers.ts` (`enterDMMode`, `leaveDMMode`: the UI); specs that merely need a DM as setup keep the older `elevateToDM` / `elevateBySeam` helpers, as that file says on purpose. |
| Failed elevation keeps the error visible and the viewer a player | Browser: “Invalid DM password” stays in the open dialog, `viewerIsDM` stays false, no DM MENU; the cursor is back in the field (`toBeFocused`) with the wrong text selected (the next keystrokes replace it). Unit: `DMElevationModal.test.tsx`. Phone: same by touch, with the dialog's box measured inside 375 px. |
| A successful demotion while a build gesture or panel is active leaves no DM control or unfinished command active | Browser (`interface-table-role-drop.spec.ts`): Build map armed on Grass with a stroke IN FLIGHT (button held, **Cancel stroke** on screen), **Leave DM mode** by keyboard → the launcher, the brush, Cancel stroke, DM MENU and Player View are gone; the release sends **no** `map-studio-command` (the page's wire ledger); re-entering DM mode does not come back armed. Panel: DM Menu open on Table → **Leave DM mode** from the tab → the window is gone (`interface-table.spec.ts`). |
| Reconnect and the conflict gate keep their protections | Browser, real socket close (`routeWebSocket`), in the two phases an outage has: (A) the page's socket is closed from the server's side → the Table button reads `…, offline` with role **…** (not “Player”) and the open menu's own chip reads OFFLINE; (B) the page's first retry has connected and the held socket stays silent (waited for — it comes seconds after the drop) → the role is STILL unknown whatever the dot says, because a socket is open and the table has not said who anyone is. In both, the menu says **Reconnecting…** with **Enter DM mode** disabled and **Table settings…** / **Leave DM mode** absent, DM MENU is gone, the host's next steps are gone; released → the same seat, `Dungeon Master, online`, no password dialog, exactly ONE `elevate-to-dm` frame in the whole test and the re-`authenticate` carried a session token. Conflict (`interface-table-conflict.spec.ts`): a second browser presenting a live seat's uid without its token lands on “Held in another window”, **Try Again** then **Start a Fresh Session** (confirm) makes it a new player; the first browser is untouched and still the DM. A server RESTART (which clears DM elevation) is covered by the live evaluation. The gate's own logic is unchanged (it only hands the reconnect words to a context); the server's session-token and conflict code is untouched. |
| Valid / wrong-kind / cancelled imports in a disposable table; character save/load; preference persistence (storage keys kept) | Browser (`interface-table-backups.spec.ts`): a real **Download table backup**, a change, then a character file and an editable map refused BY NAME with no confirm and no `load-session` frame; a cancelled restore sends nothing; a confirmed one brings the table back, everyone still seated; the editable-map picker names a table backup and a character file; **Save character** → change → **Load character…** restores the character; a table backup and a map handed to Load character are named, nothing applied. `herobyte:juice` keeps `{motion, muted, volume}` (seeded, changed from the menu with keyboard steps, reloaded); `herobyte:crt` via `crt-preference.spec.ts` (migrated). |
| Measured status/title non-overlap, desktop and phone | Desktop (`interface-table-geometry.spec.ts`): with the menu closed no chip is fixed anywhere and the Table button shares no area with any header control (1440 and 1024); open, the menu starts at or below the header's bottom edge, inside the screen, its chip clear of its title, no header control under it; the open button's role text is ≥ 4.5:1 against the button; at 1280 the Play tools stay on ONE row on the public table and with a 60-character name (the button is cut, ≤ 200 px); a floating window opens under the header's lowest control and the Dice toggle closes it again; the host's next steps sit below the header, inside the screen and clear of every header control (1280×720). Phone (`mobile-table.spec.ts`, `mobile-shell.spec.ts`, `mobile-top-stack.spec.ts`, `interface-chat-dock.spec.ts`, `mobile-encounter.spec.ts`): every screen's chip is above its title and its ✕ (measured) and is what a finger hits at its centre; the top stack's members share no area and stay inside the screen. The reconnect notice (rounds 2 and 3),
in BOTH phases of a real outage: on a desktop (`interface-table-role-drop.spec.ts`, with Chat &
Rolls open at the right edge) it lies below the header's frame, over no button in it, takes no tap
(the notice and its dock are both checked), and is what is on top at its own centre; on a phone
(`mobile-top-stack.spec.ts`, portrait and landscape) it is a member of the top stack, below the
chip, on screen, and takes no tap, first with the chip OFFLINE and then, once the first retry has
connected, with “Re-authenticating…”. On a window 480 px tall the Table menu stays on screen and scrolls inside itself until Your ID
is reachable (`interface-table-geometry.spec.ts`; the cap's numbers — 106 px from the top, 362 px
tall, never under 160 — are `TableMenu.test.tsx`'s). |
| A restore neither moves the DM seat nor leaves a hidden monster's token behind, nor adds one to a seated player (review rounds 2 and 3) | Server units (`SnapshotLoader.test.ts`): a file naming a seated player DM does not make them one; the restoring DM keeps the seat though the file's record says player; a DM the file names who is not at the table is not seated; a restore drops the token of an NPC it drops, and a player's view of the restored room carries neither that token nor its image; a re-pointed NPC leaves one token; a seated player's own character keeps its token and gains no second one from the file; a kept token keeps its live lock, scale and rotation, and a live scene state the file does not list survives; a loose file token and a carried NPC's still arrive; an NPC the file also has keeps its live token where it stands; the load log counts what was kept. |
| Phone: 44 px targets and readable words on the new surfaces | `mobile-table.spec.ts`: no control on the Table screen or the next-steps card under 44 px (the checkbox row measured separately), no text under 11 px in either — counting text-bearing form controls by their own size (the Motion dropdown's shown value) and the manual-copy field a refused clipboard leaves on the card (both found by the live evaluation, see it); `mobile-panel-touch-floor.spec.ts` sweeps the DM Menu's Table tab; `mobile-dm.spec.ts`: six chips at ≥ 44 px on one scrollable row, Table's sections each reachable by scrolling. |

## Live evaluation (`evaluate-live`, mode achieved: **live-two-client**)

Two real clients on the dev server (client 5174, server 8787) in the Browser pane, Chromium:
**the host** (the browser's own uid) created a private table through the lobby and became its DM;
**a guest** (a second tab pinned with `?sessionUid=`, so the two never share a session) joined
through the invite link with the table password. Desktop at 1280×720; the phone at the pane's
375×812 touch emulation (Android user agent, five touch points) and 375×450. Everything was
driven through the UI; `window.__HERO_BYTE_E2E__` was used to READ state, never to cause it, and
the password values are the ones the e2e helpers already hold.

**What was driven, and what each client saw**

| Step | Host | Guest |
| --- | --- | --- |
| Create a private table | Arrives as a **Player**: `Table menu: U9 live evaluation, Player, online`, no DM MENU, the next steps card (“Your table is ready”), its marker in this tab's `sessionStorage` only | — |
| Enter DM mode from the card: a wrong password, then the right one | “Invalid DM password” stays in the open dialog, the cursor is back in the field with all 19 typed characters selected, still a player; the right one → `Dungeon Master`, DM MENU appears, the card reads “✓ You are the DM.” | — |
| Invite link | The Table tab shows `…/?room=table-nmsr9p` (no password, no uid); the pane refused the clipboard (an unfocused document), so the manual-copy field appeared — the fallback seen live | Opens it, enters the table password: **Player 2**, no next steps, no marker, menu = “You are a player.” + Enter DM mode + Preferences + Your ID — **no Table settings…, no Leave DM mode** |
| DM Table tab → Permissions → Players can add props | seam `playerPropsEnabled: true` | **📦 PROPS appears** in the Party bar (the change arrived) |
| Table tab → Restore table backup… with a character file, an editable map, then `{"hello":"world"}` | “Restore failed: That is a character file, not a table backup…” and “…an editable map, not a table backup. Import it with Import editable map (.json) under DM Menu → Maps → Map library…”; **no `load-session` frame** and no confirm for either; the third gives the old “tokens must be an array” (see Known limits) | — |
| **Real server restart** (`tsx watch`), both tabs left open | Reconnects on its own within seconds with **one `authenticate`**, no `elevate-to-dm`, seat kept, **demoted to Player** (elevation does not survive a restart); the DM menu is gone; the card is back with Enter DM mode | Reconnects, seat kept, props setting kept |
| Enter DM mode again, this time from the **Table menu** | One `elevate-to-dm`; the popover closes itself under the dialog; DM MENU back | — |
| Build map open + DM Menu open on Encounter, then **Leave DM mode** from the Table menu (confirm “You keep your character and your seat…”) | Map Tools window, DM Menu, Build map and Player View are all gone; a second Enter DM mode reopens **nothing** and leaves nothing armed | roster loses “(DM)” |
| Phone: Tools → Table → Enter DM mode (guest); wrong password | The dialog is 343 px wide at x = 16 (inside 375), Cancel / Enter DM mode 44 px, the wrong password keeps its error and re-selects the field (0–14 of 14) | — |
| Phone, **a real socket closed from inside the page** while the Table screen was open (`close(3000)`) | 🔴 OFFLINE, role **“Reconnecting…”**, **Enter DM mode disabled**, Leave DM mode and Table settings… gone, the dock's fifth slot is View not DM — then, about three seconds later, 🟢 ONLINE, **DM again**, buttons back, one `authenticate`, no password asked | — |
| Phone DM screen → Table chip | Six chips at 44 px on one scrollable row; every Table control 44 px; Your role, Invite, Players at this table, Permissions, Backups, Security all reachable (body scrolls 709 → 1963 px) | — |
| A long unicode table name (`Ünïcode 🐉 Taverne der Sieben Überlangen Namen`, 46 characters) | The button stays 200×26 (name cut, header stays two rows), its accessible name carries the whole name, and the menu wraps it whole in two lines | — |
| A player who left: DM Table tab → Players at this table | “Player 2 · 1 token · not at the table” gains **REMOVE** (a connected player has none); its confirm names the cost (“Their character sheets and 1 token … There is no undo … The table password still lets them back in, as a new player.”) — cancelled | — |
| **Monster HP**, the Encounter note's three sentences, with an NPC at 30/30 then 10/30 | Note follows the mode, verbatim from the code | **Exact**: `hp 30 / maxHp 30` in the snapshot. **Bloodied**: no `hp`, no `maxHp`, `hpBadge: "healthy"` at 30/30 and `"bloodied"` at 10/30. **Hidden**: no number and no badge, and the Party row reads “HP ???”. Player characters stayed 100/100 throughout. The note is true on the wire and on screen |
| Preferences | CRT toggled from the Table menu: `herobyte:crt` = `true`, overlay drawn, button pressed; motion Off + mute on: `herobyte:juice` = `{"motion":"off","muted":true,"volume":0.6}`; **survived a reload** (then put back) | — |
| 1280×480 (short laptop) | The DM's menu is capped to 323 px and scrolls inside itself (562 px of content), bottom edge at 468 of 480 | — |
| 375×450 (short phone) | The Table screen covers the viewport, the body scrolls 254 px, **Your ID** ends at y = 426 of 450, chip and ✕ stay | — |
| Help | Eleven topics; “Your table: role, preferences, files” renders and says what the live UI does; the character file does hold conditions and drawings (`playerPersistence.ts`) | — |

**Findings** (every one carries its repro; none critical)

1. **Major — fixed in this slice.** *Phone Table screen: the Motion dropdown's shown value was
   10 px*, under the 11 px floor this record claims for the surface. Repro: guest, 375×812,
   Tools → Table, measure `select` → `10px`. The readability sweep could not see it: a select's
   visible value is not a text node of any element. Fix: `.table-prefs select { font-size: 11px }`
   (`table.css`), and the sweep (`tooSmallText`, `mobile-table.spec.ts`) now measures every
   text-bearing form control by its own size. RED first (the extended spec failed with
   `10px "SELECT"` against the unfixed CSS), GREEN after; browser mutant **E19** puts the 10 px
   back and is killed.
2. **Major — fixed in this slice.** *The next-steps card's manual-copy field was 21 px tall on a
   phone.* Repro: host on a phone, refuse the clipboard (this pane did it by accident), press
   Invite players → `INPUT 351×21`, below the 44 px floor, on a card that sits over the map where
   the mobile surfaces' floor does not reach; and no phone spec had ever put the field on
   screen. Fix: class `host-steps__manual` with `min-height: 44px` under `(pointer: coarse)`.
   RED first (`INPUT:Invite link — copy t 351x21`), GREEN after; the phone spec now refuses the
   clipboard and sweeps the field; browser mutant **E20** is killed.
3. **Not U9's, for the owner (session identity).** *A player who uses one browser for two tables
   is turned away from the first after a server restart.* Repro: guest `live-guest` seated at
   table A; the server restarts (its token records are in memory); the guest then opens table B
   (minted a fresh token); back at table A the client presents A's stored per-table token —
   stale — and the server answers “session held by another connection” because B's record is
   live (`AuthenticationHandler.ts` ~L201–204; `readSessionToken` prefers the per-table key and
   only falls back to the newest token when the table has none). **Try Again** does not help;
   only **Start a Fresh Session** does, and that is a new player. `matches()` accepts a token
   from ANY of the uid's tables, so presenting the newest one would have been proven. Nothing in
   this slice touches it (confirmed: no diff in `AuthenticationHandler.ts`, the token records or the conflict path; the slice's server changes are in the restore merge, and the gate's change only hands words to a context) and it is a protocol-level
   decision, so it is raised, not patched: the options are (a) on a turn-away, retry once with
   the newest token, (b) persist session records, (c) accept. A DM who moves between a public
   and a private table right after a deploy is the realistic victim.
4. **Minor — measured, recorded as a limit.** The header's Table button shows a table's name
   whole only up to nine characters to a Player and thirteen to the DM (see Known limits).
5. **Minor — recorded.** A valid JSON file that is none of HeroByte's three kinds still gets
   the field-level message (see Known limits).
6. **Environment, not product.** The long-running dev server had kept a stale module
   resolution for `hostNextSteps.ts` (renamed `HostNextSteps.tsx` earlier in the slice; Windows
   ignores the case difference) and served the app blank until it was restarted — nothing in the
   source refers to the old name (grep). A dev server also restarts whenever the e2e build
   runs (it watches `packages/shared/dist`), which clears every DM's elevation on it.

**Score** (pass at 7.0)

| Criterion | Weight | Score | Why |
| --- | --- | --- | --- |
| Functionality | 0.35 | 8.0 | Every path driven; wrong-kind, wrong-password, leave/enter with windows open, three entries into DM mode (card, menu, phone screen), restart and socket-drop recovery all behave; two real phone defects found and fixed inside the pass; a non-HeroByte file still gets the old wording |
| Multiplayer integrity | 0.30 | 8.5 | The guest never sees a DM control; a permission change reaches the guest; the role re-derives after a real restart and a real socket close with no password re-asked and no auto-elevation; the invite carries no password; the monster-HP statements hold on the wire in all three modes. Held back by finding 3 (not U9's) |
| Craft | 0.20 | 7.5 | Feedback on every action (error + cursor, Reconnecting…, manual-copy fallback, confirms with cost text); the new surfaces keep the JRPG/CRT identity. Held back by the nine-character name fit, the DM's three-row header at 1280 (older than U9) and the 10 px defects above |
| Reach | 0.15 | 7.5 | Table screen, next steps, DM Table tab and password dialog hold 44 px targets at 375 wide after the fixes; the dock stays five slots; the short phone scrolls to the last control. Held back by the ✕ glyph (older than U9), the DM Table tab's older 10 px file-name field, and an emulated — not a real — touchscreen |
| **Weighted** |  | **7.98 → 8.0** | pass |

What improved since the last evaluation (U8's): a host is told what to do after creating a table
and can find DM mode, the invitation and the personal settings from the header and from the
phone's Tools; the connection state no longer sits over a phone heading. What regressed: nothing
seen. This was a pass over the U9 surface and the parts of U8's that share it (the Encounter
tab's monster-HP control, the NPC editor, the initiative list), not a fresh pass of all of U8.
What this evaluation cannot say: one browser engine, one touchscreen *emulation*, two players
(not a full table), and the desktop layout at 1280×720 and 1280×480 only.

### Re-run on the final tree (after round 3's repairs; mode achieved: **live-two-client**)

Round 1 and 2's repairs and round 3's came after the evaluation above, so it was run again over the
surface they touched, on the tree this record describes. The same rig: **the host** created a
private table (“U9 final evaluation”) through the lobby and became its DM from the next-steps card;
**a guest** (a second tab pinned with `?sessionUid=`) joined through the invite link with the table
password. Desktop at 1280×720; then the guest tab as a 375×812 touch emulation (Android user agent,
five touch points). An outage was driven from inside the page: its own socket closed with `close(3000)`
and every retry made to open and never be answered (a wrapper on `window.WebSocket`, released by
hand) — the two phases of a real outage; the server restart was a real `tsx watch` restart.
`window.__HERO_BYTE_E2E__` was read, never used to cause anything, and the passwords are the e2e
helpers' own constants.

| Step | Host (desktop) | Guest |
| --- | --- | --- |
| Create the table; Enter DM mode from the card | Arrives as a **Player**, the card says “next steps”; the dialog; the toast reads **“You are in DM mode. The DM tools are on.”**; the card reads “✓ You are the DM.”; the button `…, Dungeon Master, online` | — |
| Invite link, table password | — | **Player 2**: `…, Player, online`, no DM MENU, no next steps; the roster shows Player 1 as DM; the host's chat line arrived in `chatLog` |
| **A real outage with Chat & Rolls open at the right edge and the Leave DM mode dialog open** | Phase A (socket closed): “Reconnecting…”, button `…, offline`, DM MENU gone, the dialog still open with **Leave DM mode disabled and “Reconnecting…” under it**. Phase B (the retry opens, nobody answers): “Re-authenticating…”, `…, online`, still unknown. The notice (z-index 2100) is **what is on top at its own centre** while it overlaps the window (z-index 999), with no header button under it, and takes no tap (the notice and its dock). Released: DM again in 2.5 s with the same seat, **one `authenticate`, no `elevate-to-dm`, no password dialog**, Leave enabled and its hint gone | Throughout: the roster still lists the host as DM, no notice, no DM control |
| Reset to default (DM Table tab → Security) | The confirm names who could then join; declined: **no frame sent** | — |
| Player View on, then Leave DM mode from the Table menu (confirm) | One `revoke-dm`; “You left DM mode. You are a player again.” arrives with the confirmation; DM MENU, Player View and the open DM windows gone. Enter DM mode again: **Player View not pressed**, Build map not armed | The roster loses “(DM)” at once, and regains it |
| Encounter → Monster HP **Hidden** | The note reads “Players see ??? in place of HP on every NPC they can see — never the numbers…” | — |
| **Restore, driven live**: a backup downloaded from the app, an NPC added and placed after it, then Restore table backup… with that file | The confirm is the new text (“Everyone with a seat here keeps their own characters and tokens as they are now, and nobody's DM status changes”); afterwards no NPC and **no NPC token**; the two player tokens unchanged; Player 1 still DM | The same view: no NPC, no extra token, **their own token and character unchanged**, still a player, online |
| **Real server restart** (`tsx watch`), both tabs left open | Reconnects on its own with one `authenticate`, no `elevate-to-dm`, no password dialog, **demoted to Player** (a restart clears elevation), the next-steps card back; Enter DM mode again with the password | Reconnects, seat kept |
| Phone (guest, 375×812): the map's top stack | — | The connection chip, then in an outage “Reconnecting…” / “Re-authenticating…” **below it**, in the column, on screen, at 11 px, taking no tap |
| Phone: the full-screen dice overlay | — | Carries its own chip: 🟢 ONLINE, flipping to 🔴 OFFLINE in the outage (the notice is behind the overlay: a recorded limit) |
| Phone: the Table screen in the outage | — | Role “Reconnecting…”, **Enter DM mode disabled**, Leave DM mode and Table settings… not offered; released: “You are a player.”, Enter DM mode live again, one `authenticate` |
| Phone: PARTY | — | EDIT only on the viewer's own row (the DM's row has FOCUS alone); its **Character file** note reads “…plus your own drawings, if you have any. Loading a file that holds drawings replaces the ones you have on the map…”, with Save character and Load character… |

**Findings.** No new product defect: nothing was found that the e2e and the mutants had not
already pinned. Three things worth recording:

1. **Minor — recorded.** The desktop notice, drawn above every window, covers the top of an open
   Chat & Rolls window's title for the length of an outage; it takes no tap, so the title bar under it
   still works. And a toast covers the notice while it lives (Known limits).
2. **Not explained.** One drop in the pass did nothing: the page stayed connected, heartbeats
   flowing, for twenty-eight seconds. The identical sequence (including closing the Leave dialog
   first) behaved as above three more times, and nothing in the page's state said why. It is the
   test rig's wrapper or a stale socket reference, and is recorded rather than explained.
3. **Not re-driven live** (covered by e2e and units): a wrong DM password's cursor, the manual-copy
   fallback, the 44 px sweeps and the short-window caps, DM mode by touch on a phone (the e2e now
   leaves it by touch), a restore that carries a *hidden* NPC's token (pinned by the server unit
   test and the permissions lens's probe, which is the case that matters; the NPC in the live run
   was visible), and a real touchscreen.

**Score** (pass at 7.0)

| Criterion | Weight | Score | Why |
| --- | --- | --- | --- |
| Functionality | 0.35 | 8.0 | Every driven path behaved, including both outage phases with a window open, the Leave dialog's gate, Reset's confirm, Player View's end, a restore and a restart; no defect found, but fewer paths were driven than the first pass (above) |
| Multiplayer integrity | 0.30 | 8.5 | The guest never saw a DM control or a stale role; a host's outage and its leave and re-entry reached the guest's roster; a restore left the guest's token alone and dropped the NPC's for both; roles re-derived after a real restart with no password asked of anyone who was not elevating. Held back by the two-table lockout (finding 3 of the first pass, not U9's) |
| Craft | 0.20 | 7.5 | The words say where the table is in both phases and in the right place; the Leave dialog says why it waits. Held back by the notice over a window's title, the toast corner, the nine-character name fit and the DM's three-row header at 1280 |
| Reach | 0.15 | 7.5 | The phone's stack, overlay and Table screen all keep their words and chips; the phone's character file says its scope. Held back, as before, by an emulated touchscreen |
| **Weighted** |  | **7.98 → 8.0** | pass |

**What improved since the first pass:** the Leave dialog can no longer be confirmed into an outage
and closes on the outcome; the notice is above every window; the phone's dice overlay has a chip;
the restore copy says what the server does, and the server does what it says for tokens; Reset to
default asks; Player View ends with the role. **What regressed:** nothing seen. **What this
evaluation cannot say:** one browser engine, an emulated touchscreen, two players (not a full
table), the desktop at 1280×720 only, and no fresh read of round 3's repairs (see Review).

## Verification

**The final ladder**, on the tree this record describes (HEAD `4cdcf1e2` plus the slice), after
round 3's repairs — `gates-runner` with e2e, then the rungs it was told not to run, one after
another:

| Rung | Result |
| --- | --- |
| Shared build, `pnpm lint` (with the frozen-test contracts), `pnpm format:check`, structure guard (`lint:structure:enforce`: “No new structural violations”, 994 files scanned, 22 flagged, all baselined) | pass |
| Server and client typechecks, and CI's own `pnpm typecheck` | pass |
| Units | shared 29 files / 452 tests; server 165 / 2,786; client **531 files = 527 passed + 4 skipped** (the `zz_*` benchmarks, `describe.skipIf(!RUN_BENCH)`) / **7,625 tests = 7,621 passed + 4 skipped**, in one `npx vitest run` (292 s, no timeouts) |
| e2e (`pnpm test:e2e`, both projects) | 321 tests: **318 passed**, 3 skipped (the accepted baseline: `map-navigation` ×2, `ui-state`), 0 flaky, 0 failed — 24.3 min; chromium 210 passed, mobile-chromium 108 |
| Dev boot | not run (no `packages/shared` change); the dev server ran through the live evaluation |

The working tree changed twice while the ladder ran (a test file of mine was reverted to its
committed form, and two docs were edited), so lint, format and the structure guard were re-run on
the final tree and passed; the typechecks, the unit suites and e2e had all started after the revert.

Also, on the final tree:

- **Bundle** (on its own, `pnpm --filter herobyte-client build:check`): entry **157.02 KB** of 175
  gzipped, 17.98 KB remaining (U8 left 151.96, so U9 adds 5.06 KB: 155.81 before any review, and the
  repairs of three rounds — the notice, the claimed marker, the dialog's gates, the window helpers —
  added 1.21 KB more; the Table menu, its content and the host card are entry code, the DM Table tab
  is in the lazy chunk).
- **CI's shape of the client run** (`pnpm --filter herobyte-client test`, the batched runner): all 75
  batches passed, 527 files. The full single run above is the contention canary, and it had no
  timeouts.
- **Verdana forced** (CI's wider Linux fonts; a temporary `addInitScript` copy of each spec, deleted
  after): **54 of 54** across the same 14 spec files (the first pass ran 48 tests in them: the
  repairs added specs) — the five `interface-table*` specs, `crt-preference`, `public-table-chip`,
  `mobile-table`, `mobile-top-stack`, `mobile-shell`, `mobile-dm`, `mobile-elevation`,
  `mobile-encounter`, `interface-chat-dock` — 2.9 minutes, the copies deleted afterwards.
- **Strict type check of the e2e files** (a scratch project over every `apps/e2e` file, since none is
  in a typecheck gate): 61 errors, the same 61 as before the review (by file and code), none in a new
  file and none on a line this slice added.
- **HEAD alone** (an export of the committed tree, without the slice's uncommitted work): both
  typechecks, lint, the structure guard, the server's 165 files / 2,786 tests and the client suites
  of the own commits (106 files / 1,452 tests) all pass — the fourteen own commits that existed then
  stand without the slice; the two after the outside read were each verified from an export of their
  own staged tree (every one of the sixteen was; see Own commits).

The raw logs are under `.tmp/gates-u9-final-2/` (`g-*` the gates-runner's, `h-*` the bundle, the
batched run, the slop mutants and the e2e type check, `i-*` Verdana; the unnumbered `01`–`06` are
focused e2e runs and the screenshot re-shoot made during round 3's repairs) and `.tmp/gates-u9-head/`
(HEAD alone).

**Before any review round**, the full ladder (`gates-runner`, with e2e) on HEAD `07b7844b` plus the
slice — the tree the live evaluation's two fixes left:

| Rung | Result |
| --- | --- |
| Shared build, `pnpm format:check`, structure guard (`lint:structure:enforce`: “No new structural violations”, 989 files, 22 baselined) | pass |
| `pnpm lint` | **failed once**: `no-setter-return` at `TableBackupControl.test.tsx:660`, a test this slice wrote (the `set` of its instance accessor returned `void push()`); repaired (a block body, and the `C:\fakepath\…` literal's escapes), then `pnpm lint`, the client typecheck, `format:check` and the structure guard re-run clean and the file's 34 tests pass |
| Server and client typechecks (`tsc -p tsconfig.typecheck.json`) | pass |
| Units | shared 29 files / 452 tests; server 165 / 2,774; client **525 files = 521 passed + 4 skipped** (the `zz_*` benchmarks, `describe.skipIf(!RUN_BENCH)`) / **7,509 tests = 7,505 passed + 4 skipped** — all 75 batches ran |
| e2e (`pnpm test:e2e`) | **311 passed**, 3 skipped (the accepted baseline: `map-navigation` ×2, `ui-state`), 0 flaky, 0 failed — 24.1 min; chromium 207, mobile-chromium 104 |
| Dev boot | not run (no `packages/shared` change); the dev server ran, and restarted, through the live evaluation |

Also, on the same tree:

- **Bundle** (on its own, `pnpm --filter herobyte-client build:check`): entry **155.81 KB** of 175 gzipped
  (U8 left 151.96, so U9 adds 3.85 KB — the Table menu, its content and the host card are entry
  code; the DM Table tab is in the lazy chunk); 19.19 KB remain.
- **Contention canary** (`npx vitest run` in `apps/client`, every file at once): 521 files passed, 4
  skipped / 7,505 tests passed, 4 skipped, **0 failed, 0 timeouts** (the earlier full run had one
  5 s timeout on an untouched render test; it passes alone and did not recur).
- **Verdana forced** (CI's wider Linux fonts; a temporary `addInitScript` copy of each spec, deleted
  after): 48 of 48 across 14 spec files — the five `interface-table*` specs, `crt-preference`,
  `public-table-chip`, `mobile-table`, `mobile-top-stack`, `mobile-shell`, `mobile-dm`,
  `mobile-elevation`, `mobile-encounter`, `interface-chat-dock` — and, after the live evaluation's two
  CSS fixes, `mobile-table` again: 6 of 6.
- **Strict type check of the e2e files** (a scratch project over every `apps/e2e` file, since none is in
  a typecheck gate): 61 errors, none in a new file or on a line this slice added.
- Every own commit was verified from an export of its staged tree (see Own commits).

The raw logs are under `.tmp/gates-u9-final/` (`01`–`07` the gates-runner's, `08` the lint repair's
re-runs, `09` the canary, `10` the bundle, `11` Verdana, `12` the e2e type check).

## Proof the tests can fail

One mutant per rule, each restored byte-for-byte and sha256-checked (`mutate.py`, kept in the
session scratchpad; it retries a refused Windows open rather than skipping a restore). The
ledger ran on the real tree, nothing else running against it.

**Unit (vitest): 144 mutants in five groups, 143 killed by a unit suite and one — a fixed
position set by an inline style (C27) — invisible to jsdom and killed by browser mutant E5b.**
Eight survived the first run; seven were real test gaps, each closed with a new assertion and
re-killed:

- `tableMenuProps` passed `isConnected: true` whatever the socket said → now a test that a lost
  server reads offline (and CRT as set).
- the backup chooser was never reset after a choice (the same file could not be picked twice) →
  a test that observes the assignment the component makes.
- “1 token” / “2 tokens” were one string → a test per number.
- a map needing only `layers`, not `elements`, was still a map → two rows in the kind table.
- `roleKnown` (the roster test) had NO test at all, so “always true” and “any snapshot” both
  survived → three cases (seat present, no snapshot, roster without the viewer).
- the phone's Table screen would have carried its own chip a second time → a one-chip assertion.

Three more patches first missed their anchor (“BAD-PATCH”, void by the ledger's own rule) and
were rewritten and re-run; three window-placement mutants were added after the placement
moved from the header's frame to its controls. The groups:

| Group | What it pins | Mutants |
| --- | --- | --- |
| A | `tableLabel`, `tableMenuProps`, `menuRequest`, `newTableMarker`, `TableRoleControl`, `ConnectionChip`, `PreferencesPanel` | 31 |
| A2 | `TableMenuContent`, `TableMenu` (role text, status, close-first, request, outside press, dialog role, portal, Escape), `HostNextSteps` (gate, marker, never elevates, dismiss, copy, fallback, pointer-events), `useInviteLink` | 26 |
| B | `tableControls`, `TableTab`, `TableBackupControl`, `TablePlayersSection`, `seatRemoval` (grace, confirm, token count), `TablePermissionsSection` | 32 |
| C1 | `detectBackupFormat` (every arm and its order), the three pickers' wrong-kind refusals, the restore's cancel and too-big paths, the filename | 19 |
| C2 | `useDMRole`, Header, the phone's Tools tile / top stack / screen chip / Table screen, the password dialog, the character window and phone row, the DM menu's intake and Table tab, the two pointers, `CampaignWeight`, `EncounterTab`'s HP note, `DraggableWindow`'s placement | 36 |

The DM password dialog's focus fix (`5262bdb7`) carries its own five: four killed, one
equivalent (focusing while the request is still in flight — a disabled field cannot take focus,
and the effect runs again when loading ends).

**Browser: 21 mutants, each a real `pnpm test:e2e` run, all killed.** Two survived the first
run, and both were the TEST's blind spot, not the product's (two more, E19 and E20, were
added after the live evaluation found their defects — see the evaluation):

- **E2, the open Table button's role text gold on its own gold ground.** The contrast check
  measured the button with the pointer still on it, and a hovered button's ground computes
  transparent (it read black, so gold-on-black passed). It now moves the pointer off first
  and walks up to the first opaque ground.
- **E8, the Sound & motion labels back at 8 px on a phone.** The readability sweep took only
  LEAF elements, and “Motion”, “Mute sound effects” and “Volume” are text beside a control
  inside a label. It now counts every element that owns a text node.

| Mutant | Killed by |
| --- | --- |
| E1 the menu hangs from the button's bottom, not the header's | `interface-table-geometry` |
| E2 gold role text on the open (gold) button | `interface-table-geometry` (after the fix above) |
| E3 the button allowed its old width, so RECENTER wraps at 1280 px | `interface-table-geometry` |
| E4 a floating window opens at its fixed y | `interface-table-geometry` |
| E5 / E5b the top stack's chip fixed, or the stack itself fixed | `mobile-top-stack` |
| E6 a screen's chip laid over its title | `mobile-table` |
| E7 the DM dialog's 452 px minimum back | `mobile-elevation` |
| E8 8 px Sound & motion labels on a phone | `mobile-table` (after the fix above) |
| E9 10 px next-steps buttons on a phone | `mobile-table` |
| E10 the next steps judge a role the page cannot know | `interface-table-role-drop` |
| E11 Enter DM mode live while the role is unknown | `interface-table-role-drop` |
| E12 the role known the moment any snapshot exists | `interface-table-role-drop` |
| E13 the button reads Player before the table answers | `interface-table-role-drop` |
| E14 a wrong password leaves the cursor behind | `interface-table` |
| E15 a refused clipboard shows no link | `interface-table` |
| E16 a character file restored as a table | `interface-table-backups` |
| E17 Table settings never reaches the Table tab | `interface-table` |
| E18 a phone screen without its own chip | `mobile-table` |

**After review round 1** (forty more, each a real run; the three browser ones are E21–E23):
Invite offered before the DM (R1) and the two sentences around it (R2, R3); the window following
the header (R4 never, R5 even when placed, R6 a drag does not place it, R7 a remembered position
does not, R8 watched forever); the phone DM screen ended by a blip (R9), kept after a known
demotion (R10), or never told the role is known (R11); the request seam honouring a non-DM (R12);
the popover not watching the header (R13); the invite link carrying the pinned uid (R14); the
restore confirm and the Backups note saying “the whole table” (R15, R16); the capacity allowance
back at the scene alone (R17); the Monster HP note promising every monster (R18); the character
file back at “this character only” (R19); the old revoke toast (R20); App never ending the DM
snapshot cache (R21) or ending it on a blip (R22); the table's facts going with the snapshot
(R23–R25); the container's permission senders (R26, R27), password answer (R28) and Select All
(R29) dropped; the tab dropping the password status, pending state, dismiss and hand-entry value
(R30–R33); Select All doing nothing (R34); Load character not resetting its picker (R35) or
applying to no character on a DM's phone row (R36); the Chat screen's chip always online (R37);
and, in the browser, Invite live before the DM (E21), the open menu's chip always online (E22)
and the desktop card parked at the top of the screen (E23). **Thirty-nine were killed at once;
one survived, R21**: the App-level test that was written to kill it passed with the hook removed,
because a neighbouring test had left the role mock at “not a DM”, so the cache was never
filled. It now sets its role itself — and so does the map-edit test beside it, which had been
passing on the same inherited state — and the whole file fails with the hook gone (**40 of 40**).

Six of the new browser specs also assert things no mutant above moves (the conflict gate, the
real socket drop's one `elevate-to-dm` frame, the editable-map picker's two refusals); they were proved by the failures each one caught on the way to green.

**After review round 2** (fifty-nine more, each a real run; the seven browser ones are E24–E29 and E25b). Server:
the file's `isDM` restored again, explicitly, for everyone, or only as a demotion (S1-1 to S1-4); a
stranded token kept, nothing ever stranded, every live character's token dropped, stranding by
character id instead of token (S2-1 to S2-4). Window: a drag not placing, a press placing before it
moves, no slop, a click saving, a remembered place not pulled onto the screen (W1 to W5), and the
follow going back up, only up, or nowhere (W6 to W8). The leave flow: a blip confirming a leave,
the confirmation never reported, the seat always known, the toast at the click or naming the
wrong thing, the dialog always told the roster is known, the timeout reporting nothing (L1 to L7).
The phone's file and chips: a Save carrying everyone's drawings, no token scene or no initiative
modifier, the layout handing the list an apply that does nothing or no drawings, three screens
and the dice overlay always saying online, the overlay with no chip (P1 to P10 — the survivors the
tests lens found, M1, M2 and M7, are P6–P8, P1–P3 and P4–P5). The rest of the slice: a claimed seat
re-locking Invite or never written down, the Leave dialog closing for a blip, the whole ID in a
tooltip, the old 400 KB allowance, the gate swapping its two phases, the header or the phone stack
not hosting the notice, the notice never showing, the Table menu without a height floor or
without its scroller, Reset to default sending a secret, the restore confirm dropping its DM
sentence, a refusal saying “player state”, a DM told the player's note, a request made to a
non-DM opening the menu at the next elevation, a loaded portrait not reaching the open sheet,
and the App never ending — or ending too early — a leave the server did not answer (Q1 to Q19).
**All fifty-two unit mutants were killed at once.** Browser: the desktop notice a fixed banner at
the top right again (E24), the notice taking taps (E25b), the Table menu's panel not scrolling
(E26), the phone stack not hosting the notice (E27), a phone Load character doing nothing (E28)
and a private table's Reset to default 28 px tall on a phone (E29): **all killed.** E25 — removing
`pointer-events: none` from the notice's own rule — SURVIVED, and is equivalent: the property is
inherited, and both hosts (the header's dock, the phone's stack) set it themselves; the rule on the
notice is defence in depth for a future host, and E25b, which removes it from the span and the
dock, is killed. The running totals were 233 unit mutants and 31 browser mutants (an earlier draft
said 30: it had left E25b out), each restored byte-for-byte.

**After review round 3** (thirty-nine more, each a real run; the six browser ones are E30–E35 — in
the session's scratch ledger they carry their batch names). Server (`9b88518c`): a file token whose
character the live one replaced added again, no file character's token carried (an NPC's token
dropped with it), the file's scene list winning over a seated token's again, the file's scene entry
kept beside the live one — **equivalent**: the rebuild reads the list into a Map and the live entry
is last, and its order-flipped twin is killed — and a live token scene the file does not list
dropped (T1–T5, T4b). Window (`8ad5ed24`): a resize remembering the clamp of a window nobody placed,
or nothing at all; exactly three pixels read as a click; a five-pixel slop (W9–W12). The leave flow
(`4cdcf1e2`): a timer left running after an answered leave, an answered elevation, a refused one, a
new request or an unmount; `clearError` doing nothing; a dialog opening with the last request's error
(X1–X7). The dialog and the other repairs of the slice: closing on the outcome only with no error
showing, a blip counted as a confirmed leave, a submit live without a roster, no “Reconnecting…”
hint (S1–S4); Reset to default not asking, or asking and ignoring the answer (S5, S6); a claim
stored for a flag the roster has not backed (S7); the DM menu staying subscribed, a request not
spent when it is taken (S8, S9); a phone screen the props switch hides ended for good (S10); the
Table menu deaf to a window resize (S11); the drag slop at three, four and two and a half pixels
(S12–S14); and, in the browser, the touch leave leaving the Table screen open (E35, S15). The
notice's placement: the dock under the floating windows (E30), at the top of the screen (E31),
taking taps (E33), the phone's notice above its chip (E34), a layout hanging it on the header's edge
with no offset (D4) and a dock that draws with no phase (D5). **Thirty-seven were killed at once;
two are equivalent**: T4 above, and E32 — removing the notice span's own `pointer-events: none`, which
the dock sets and the property inherits (E33 removes the dock's, and is killed). The running totals
were **266 unit mutants and 37 browser mutants, each restored byte-for-byte, four of them equivalent**
(the focus mutant of `5262bdb7`, E25, T4 and E32).

**After the outside read** (fourteen more unit mutants, all killed at once). The remembered place
(`1c67afa7`): kept as it was, lifted but still counted as placed, lifted only to the window's own
default y, every remembered place thrown away for the default, a place below the controls not
counted as placed, the remembered x forgotten (Y1–Y6). The late answer (`ebbd20e4`): no late answer
at all, a late answer waited for however late it comes, Enter DM mode and setting the DM password not
withdrawing a leave, an answered leave still waited for, the stale timeout left on screen, a leave never
recorded as asked, a late answer not announced (L1–L8). The totals are **280 unit mutants and 37
browser mutants**, four equivalent. (The leave latch's mutants are counted with its commit.)

## Review (`review-convergence`)

Four fresh, read-only Opus lenses per round (identity/state, permissions/secrecy, test validity,
doc-vs-code honesty), the tree fingerprinted before each round and again after it, before any
repair.

### Round 1 — FAIL (union: 1 P1, 13 P2, about 25 P3)

All four lenses returned (none errored), each reported the mode it reached (static reads; the
test lens also ran code in its own export directory), and the tree's fingerprint was identical
before and after the round (`f5dd3edf…`, 213 changed or untracked files).

| Lens | Verdict | P1 | P2 | P3 |
| --- | --- | --- | --- | --- |
| identity / state | FAIL | 0 | 2 | 5 |
| permissions / secrecy | FAIL | 1 | 0 | 3 |
| test validity | FAIL | 0 | 6 | 8 |
| doc vs code | FAIL | 0 | 5 | 12 |

(The lenses' own counts sum to 1 / 13 / 28; three P3s and several P2s were the same finding seen
by two lenses — the record's “every other spec enters DM mode through the helper” was flagged
by all three of the others.) What each finding became:

**P1 — Invite before the seat is claimed.** On a table made without a DM password, the first
person to press Enter DM mode sets the password and becomes the DM; the card offered Invite
beside Enter DM mode with nothing ordering them, and its own text promised the DM password was
the gate. → **fixed**: Invite is disabled until the host is the DM, the card and the guides say
why (unit tests; two e2e specs, one for a table with no DM password; mutants R1–R3, E21).

**P2 (13), by lens.**
- *Window placement* (identity): a window already open did not follow a header that grew when a
  player became DM. → **fixed**, own commit `15dd3899` (RED first).
- *Overclaims in this record* (three lenses): how specs become DM, what the phone spec covers,
  “the observer's map is unchanged”. → **corrected** to what the specs assert.
- *Copy that was not true of the server* (doc lens): the capacity line promised room a large
  warehouse would not have had (**fixed**: allowance 190 → 400 KiB, “a large map may be
  refused”; help, guide and tests; R17); Load character's “this character only” while it replaces
  all of the owner's drawings (**fixed**: the scope is stated in the window, the help and both
  guides; R19); the restore's “replaces the whole table” while the server keeps seated players'
  characters and tokens (**fixed** in the confirm, the Backups note, the help and the guide; R15,
  R16); guides that still sent people to the Players and Session tabs, Make myself DM, Save Game
  State and Map Setup (**renamed** in the guides, the README, DEPLOYMENT and the demo-server
  workflow).
- *Tests that could not fail* (test lens): Select All clicked a disabled button and asserted
  “not called” (**now a real click**; R34); the picker-reset assertions read jsdom's always-empty
  value (**now value-setter spies**, in the Backups tab and the character window; R35); the DM's
  phone Load asserted only that a button exists (**now names the character and token it writes
  to**; R36); the Table tab's password status, pending state, dismiss and hand-entry value could be
  dropped with every test green, as could the container's permission senders
  (**`DMMenuContainer.table.test.tsx`, six cases, and four TableTab cases**; R26–R33); the
  socket-drop spec never observed the held socket its record described (**rewritten** in two
  phases that wait for it).

**P3.** Fixed, each with a test or a measured assertion where one was possible: the Monster HP
note promised “every monster” (the server sends only those a player can see); the invite link
carried a pinned `?sessionUid=` (every invitee would have been handed the host's identity); the
phone DM screen sprang open again when the host re-entered DM mode from the card; the request seam
honoured a request made for a non-DM; the Table menu's popover did not watch the header; the
table's name and public flag went with the snapshot on every reconnect, removing and restoring a
header row (`useTableMenuProps`); the DM snapshot cache outlived a server-side demotion
(own commit `bc3e3384`); the revoke toast was pinned only by a hand-written copy of the handler;
the chip was checked offline on one phone screen of four; a desktop card parked at the top of the
screen would have passed; a translucent background was skipped as transparent (`Number(" 0.9)")`
is NaN); the top stack's readability sweep was the leaf-only one this record calls blind; a
label on a two-second timer was tapped by name; stale names in comments and test titles
(Players tab, Save Game State, EXIT DM MODE, Table role, “session file”, a server comment naming
the deleted PlayersTab.tsx — the slice's one server diff, comment only). Recorded as limits
rather than changed: the phone's Dice tray has no connection chip; an open DM Menu closes on every
reconnect; a player's button fits only a nine-character name whole (measured, asked of the owner).
(Round 2 found the first of these worse than recorded and fixed it.)

### Round 2 — FAIL (union: 1 P1, 7 P2, about 25 P3)

All four fresh lenses returned (none errored), each reported the mode it reached (the permissions
lens a static read; the identity lens a static read plus a headless-Chromium measurement of the old
banner in its own export; the tests lens static plus seven mutants run in an export of its own,
removed after; the doc lens static plus two node probes that only imported the server's compiled
`SnapshotLoader` and `recipientFilter`), and the tree's fingerprint was identical before and after
the round (`be0f452c…`, 224 changed or untracked files — the lenses wrote nothing into the tree).

| Lens | Verdict | P1 | P2 | P3 |
| --- | --- | --- | --- | --- |
| identity / state | FAIL | 0 | 1 | 6 |
| permissions / secrecy | FAIL | 0 | 1 | 2 |
| test validity | FAIL | 0 | 2 | 4, plus four unpinned rules, stale numbers and the size guard |
| doc vs code | FAIL | 1 | 3 | 7 |

Round 1's count was 1 P1 and 13 P2; round 2's is 1 P1 and 7 P2, so the review is converging on
severity, not yet on the count of things flagged at all. **Regressions across rounds:** one round-1
repair had a side effect — `15dd3899` made an open window follow the header in both directions, and
the identity lens found that a reconnect blip (which takes a DM's two tools out of the header and
back) made every window bob (fixed, `a4ac5402`); one round-1 test, “tells the truth on every
screen”, stopped at four of seven (completed). No other round-1 pass was broken: every other
round-2 P1 and P2 is older than U9 (the two restore bugs, the lens, the leave flow) or in something
round 1 could not see (the banner, which only became wrong when this slice moved the header up).

**P1 — a restore left a hidden monster's token on the map** (doc lens, from a copy audit: the
confirm, the Backups note, the help and the guide said NPCs are replaced, and the server kept every
NPC token a seated DM placed). A server bug older than U9. → **fixed**, own commit `8996993a`, with
the copy made true.

**P2 (7), by lens.**
- *A restore could give the DM seat to a player, or take it from the DM* (permissions lens): the
  file's `isDM` won for every seated player. → **fixed**, own commit `b54bb0ee`; the confirm, the
  Backups note, the help and the guide now say nobody's DM status changes.
- *The reconnect banner lay over the header's controls and the phone's OFFLINE chip* (identity lens):
  a second fixed indicator the header's move up had put on top of RECENTER and SNAP; nothing had
  measured anything during a reconnect. → **fixed**: the gate says why, the hosts place the words
  (`ReconnectNotice`), measured in both phases on both layouts (mutants E24, E25b, E27).
- *The phone's Save character and Load character were tested only as buttons* (tests lens): six
  suites stayed green with the saved drawings unfiltered, the token scene and initiative modifier
  dropped, or the layout handing the list an apply that does nothing; the e2e saved a file and
  never read it; and `characterFile.ts` claimed to be the one place a save is assembled. →
  **fixed**: contents and wiring pinned at the list and the layout (P1–P5), the phone spec reads the
  saved file and loads it back, the comment says what is shared (writing and reading) and what is
  each surface's (what goes into a save).
- *“Tells the truth on EVERY screen” covered four of seven* (tests lens): Props, World Map and Kick
  passed `isConnected` on their own. → **fixed**: all seven, plus the dice overlay (P6–P10).
- *Doc overclaims* (doc lens, three): `DEMO_SERVER_WORKFLOW.md` still sent people to the Session tab,
  and to reset a password the public table cannot change (**rewritten** around Save as a Private
  Table); the phone dice roller is a full-screen overlay with no connection state anywhere while it
  is open (**it now carries its own chip**; the guide and comments corrected); and the capacity
  allowance was short of a warehouse's own arithmetic (**460 KB**, from the maxima `wsLimits.ts`
  records; help, guide and tests; Q5).

**P3.** Fixed, each with a test or a measured assertion where one was possible: a click on a title
bar placed a window (`c44ad4b6`); windows bobbed with every reconnect blip (`a4ac5402`); the
next-steps card re-locked Invite after the host had held the seat (Q1–Q2); a leave the dying socket
never delivered read as a success and announced itself (`ab4da6a2`, and the slice's two halves,
Q3, Q18, Q19); Player View survived a demotion (`a89d2d60`); the Table menu's ID carried the whole
identifier in a tooltip (Q4); stale wording in comments, test titles and help in about ten places
(the connection banner, “four fixed things”, the public-table notice's claim that a new password
claims the table, “beside Help”, “backups” for the help topic, “Player State” in describe titles);
the load errors said “player state”; the Encounter note said “monster” for a rule that covers every
NPC; a DM's settings note said “your own drawings” of a file that holds the row owner's; the Table
role control promised the DM password where a table without one asks to set it; the test that a
request made to a non-DM opens nothing could not fail (DMMenu renders nothing for a non-DM anyway),
the three reset-named backup tests asserted jsdom's always-empty file value, and a Header test
named a badge the header never had. The four rules no test checked now have one: the Table menu's
short-window cap (unit numbers and an e2e at 1280×480, Q10–Q11, E26), a private table's
password controls at the phone's 44 px floor (E29), Reset to default sending no secret (Q12), and
the phone's portrait field showing a loaded portrait (Q17). Recorded as limits rather than
changed: a phone Load character picked after a reconnect can be lost; a full-screen phone screen
shows OFFLINE without the words; unit tests are not size-gated (this draft said five test files
were past 349 lines; round 3 counted seven, see Known limits); the private-table sweep does not
include REMOVE (it needs a dropped seat); a seat's own record comes back as the file had it on a
restore (this draft said only its name and portrait: round 3 found the whole record but the DM
flag, heartbeat and microphone level); the header's mute indicator left with its button.

### Round 3 — FAIL, and the last the rules allow (union: 0 P1, 8 P2, about 25 P3)

All four fresh lenses returned (none errored), each reported the mode it reached (the identity lens
a static read; the permissions lens a static read plus three `tsx` probes in an export of its own
that imported the real `SnapshotLoader`, `SceneGraphBuilder`, `model` and `backupFormat` and wrote
nothing into the repo; the tests lens a static read plus four mutants and one cleanup edit run on
copied files in an export of its own; the doc lens a static read that recomputed every number from
git, `wc -l`, the gate logs and the mutant ledger, with two image extracts it deleted), and the tree's
fingerprint was identical before and after the round (`9d8c32cf…`, 230 changed or untracked files).

| Lens | Verdict | P1 | P2 | P3 |
| --- | --- | --- | --- | --- |
| identity / state | FAIL | 0 | 2 | 1, plus two regressions of round 2's repairs |
| permissions / secrecy | FAIL | 0 | 2 | 2 |
| test validity | FAIL | 0 | 3 | 7 |
| doc vs code | FAIL | 0 | 3, plus two regressions | 5 headings of about a dozen items, plus two regressions |

The lenses' own counts overlap (the record's “no server change” sentences were flagged by three of
the four, the demo-server guide by two). The distinct findings, and what each became:

**P2 (8).**
- *A browser resize placed a window nobody had placed* (identity): the clamp was saved whether or
  not the window had a place of its own, and a saved place is read back as placed, so a window
  opened at the right edge of a wide screen and caught by a browser snapped to half width never
  followed the header again. → **fixed**, own commit `8ad5ed24` (RED first).
- *The record said no server or auth file changed* (identity, permissions, docs): false since round 2
  (`SnapshotLoader.ts`, `service.ts` and `AuthenticationGate.tsx` had changed), and the escalation
  check rested on it. → **rewritten** at the top of this record: the server changes are all in the
  restore merge and narrow what a file can do; the check does not fire, and now says why.
- *The demo-server guide told hosts to reset a table's password to the published default* (permissions,
  docs), round 2's rewrite of it: following it left every table a host kept open to anyone with its
  code. → **the steps and the advice are deleted**, the guide says to change the password if it may
  have leaked and never to Reset to default on a table you keep, and **Reset to default now asks
  first** (a `window.confirm` naming who could then join; tests, mutants S5 and S6).
- *The restore copy was not what the merge does* (docs, and the permissions lens's three probes): a
  seated player's live character wins over the file's, yet the file's token for it was added as a
  second, character-less token the player controls; a kept token took the file's lock, scale and
  rotation; NPCs “become the file's” except one in both, which stays where it stands; the rule
  covers every seat on the roster, present or not; and the seat's whole record (name, portrait, HP,
  conditions) comes back. → **fixed** as two things: own commit `9b88518c` makes the merge do what
  the sentence says for tokens, and the confirm, the Backups note, the help and the guide now say
  what is kept, what comes back and what is replaced.
- *“Loading replaces the drawings you have on the map” was false for a file saved with none* (docs):
  a save with no drawings writes none, and a load only syncs drawings the file holds. → **the copy
  says so** in the window, the help topic and both guides (the alternative, always saving an empty
  list, would make loading such a file delete a player's drawings).
- *The test that the DM menu stops listening once unmounted could not fail* (tests): removing the
  unsubscribe survived all 233 tests of fifteen files once a file-wide reset was added (it had been
  caught only by the dead listeners earlier tests left behind). → **fixed**: the test now checks
  that nobody spent a request made after the unmount, the “taken once” test remounts instead of
  re-rendering (an effect that runs on mount cannot take a request twice by re-rendering), and both
  files reset the request seam after every test (mutants S8, S9).
- *The phone's reconnect notice was measured in one phase of an outage, and the record said both*
  (tests): after the first retry connects the chip reads ONLINE, which the first measurement's
  assertion could not pass. → **fixed**: the spec waits for the held socket, for “Re-authenticating…”,
  and measures again, in portrait and landscape.
- *The record's sizes and counts were stale* (tests, docs, identity): `App.tsx` is baselined and
  grew; six line counts and three ported-case counts were off; seven test files, not five, passed
  349 lines; the browser mutant count was short by one. → **recomputed** on the final tree (see
  Structure and Proof).

**P3.** Fixed, each with a test or a measured assertion where one was possible, and the regressions
first, since they are what round 2's repairs broke:
- *The Leave dialog could be confirmed during an outage* (identity, permissions): round 2 had made it
  stay open through a blip, so its button stayed live while the socket was down; the `revoke-dm`
  was queued, an outage past five seconds said “timed out”, the app un-latched DM for a round trip,
  and the flushed request then demoted the seat under a dialog stuck open on the stale error. →
  **fixed** in two halves: own commit `4cdcf1e2` (one timer per request, stopped on every ending; a
  dialog opens clean) and the slice's dialog (closes on the outcome with an error showing, cannot be
  confirmed while the roster is unknown, says “Reconnecting…”; mutants S1–S4).
- *The desktop notice lay under floating windows* (identity): inside the header's z-index-100 layer,
  under Chat & Rolls. → **fixed**: a fixed sibling of the header above every window (mutants D1–D5),
  and the browser probe opens Chat & Rolls and asks what is on top at the notice's centre. That
  probe also showed that a toast (z-index 10000, same corner) covers the notice while it lives; the
  test waits it out and the limit is recorded.
- *Round 2's record sentences and numbers that its own repairs made false* (docs): the escalation
  check, the Structure paragraph, two screenshots shot before the role control's copy was edited, the
  guide's “banner in the corner”. → rewritten, recomputed, **re-shot**, reworded.
- Test validity: the next-steps card's blip test used `isDM: false`, so removing the `roleKnown`
  guard passed (now `isDM: true` with no roster, S7); the phone list's “no Save character on another's
  row” asserted zero buttons with no sheet open (now one, the viewer's own); a screen the table's
  props switch hides must come back, and the only test passed no `roleKnown` while the layout
  always does (S10); the window's 3 px slop had no upper bound tested (exactly 3 px is a drag and 2.8 px
  a click, pinned inside `8ad5ed24`: mutants W11 and W12, and S12–S14 as three more variants); the
  Table menu's resize re-anchor had no test (S11); the phone's `leaveDMMode`
  helper left the Table screen open and nothing used it (now a spec leaves DM mode by touch: S15).
- Words: the enter-DM toast still said “DM elevation successful!” where the leave toast says “DM mode”
  (now “You are in DM mode. The DM tools are on.”, and the three specs that watch for it follow);
  “Five headed sections” (six), a settings section that was a label, “title row”, “Load Game State”,
  “backups and passwords” where only the table password can be changed, a public-table chip said to
  be fixed at z-index 199, a spec header that called a rewritten block “moved unchanged”, a test
  title promising a DM's rows it never checked, the Encounter note's “HP: ???” (the party row says
  “HP ???” and the card “HP: ???”; the note now says “??? in place of HP”), and `characterFile.ts` calling itself the one place a file is read.

**The review ended at the cap, not at a pass.** Round 3 returned FAIL from every lens. It found no P1
(rounds 1 and 2 each found one) and eight P2s, against round 2's seven, so severity has stopped
converging; and it found seven repairs of round 2 that were incomplete or wrong (round 2 had found
two of round 1's). The rules allow three rounds and an escalation at the cap with “repair all,
verify”, which is what was done: every finding above is repaired, each with a test watched to fail
or a mutant killed, and the final ladder and the live two-client evaluation were run on the tree
the repairs left. **What was not done is a fourth round**, so the round-3 repairs have had no fresh
adversarial read: the owner should weigh that, and the questions below, before this goes further.

### An outside read of the finished slice

After the final report the owner had the slice read once more, by a reviewer outside this session
(the fourth read the cap had not allowed, and a fresh one). The verdict: sound, nothing serious,
commit it. They re-ran the typecheck, the structure guard, the format check and 186 client test files,
checked that the 277-path commit list matched the working tree (the 17 deletions included, the three
untracked prompts left out), confirmed no debug code was added, and read the three server fixes, the
moved controls and the new invite link. Their notes that are not defects: fourteen own commits, five of
them on window placement, were more than the slice needed (the owner's rule is to fix bugs regardless
of origin); `MobileEntitiesList.tsx`, `MobileSurfaces.tsx` and `DMElevationModal.tsx` are 314–329
lines against a 350 limit; leaving DM mode has become six mechanisms where one would do; and CRT and
Sound & motion sit in a popover that does not take keyboard focus (Known limits, U10). Three findings
were defects, each checked against the code before it was touched:

- **A remembered window place skipped the below-the-header rule** — a position an old title-bar click
  saved opens over a DM's taller header, the original bug. → **fixed**, own commit `1c67afa7`.
- **A leave the server hears after its five seconds never said so.** → **fixed**, own commit
  `ebbd20e4`.
- **The leave latch could flash the DM's tools back.** An old effect in `App.tsx` ended the wait for a
  leave whenever the DM flag read false, and a reconnect blip reads false without anyone having left:
  with a leave in flight, the DM's tools came back when the roster returned, still listing the DM until
  the queued leave was heard. Reproduced first by an App test (it fails: the Table menu reads DM). The
  fix ends the wait with the request, not with a blip, and so replaces the two effects that decided it
  with one; it also takes `App.tsx` three lines smaller. (The review suggested adding `roleKnown &&` to
  the old check; once the wait ends with the request, a roster guard cannot be observed, so the rule
  has none.) **It edits `App.tsx`, which the slice owns, and it only holds together with the slice's
  recovery of a leave nobody heard, so it cannot stand on HEAD without the slice: the fix and its two new
  App tests are prepared and apply as a commit right after the slice's.**

## Known limits

- **The Table menu is a non-modal popover, like the Help and Juice popovers before it.** It
  does not take focus when it opens and does not return it when it closes (the U2 contract the
  ported cases pin: “closes without adding launcher focus return”); a keyboard user opens it with
  Enter and reaches its controls by Tab after the rest of the page. Moving focus in and out is
  U10's accessibility pass, for all three popovers together.
- **The phone's ✕ is a 10 px glyph in a 44 px target.** `herobyte.css` declares 18 px for
  `.mobile-screen__close`, but `jrpg.css` loads after it and its single-class `.jrpg-button`
  wins the tie (the file's own warning about exactly this). Older than U9 and untouched; the
  target holds the floor, only the glyph is small.
- **A long table name is cut in the header button.** The button is capped at 200 px so the
  header's tools keep one row at 1280 px, and the role takes its share: measured live in the
  pixel font, **a name of up to nine characters fits whole as a Player, thirteen as the DM**; a
  longer one shows one glyph fewer and an ellipsis (the docs' `table-next-steps.jpg` shows
  `TABLE-FV…`, eight and the ellipsis, for a player at a table named by its code). The menu shows the name whole (wrapping, unicode and emoji included) and the
  button's accessible name carries it whole. A table made without a name reads its code, cut
  the same way. Whether a player's button should spend its room on the word “Player” is an
  owner question.
- **A DM's header is three rows at 1280 px**: the Play tools wrap at BUILD MAP, which is older
  than U9 (HEAD's DM header already wrapped — its `dm-menu-session.jpg` shows the DM Menu over
  Dice, Chat & Rolls and Help). A player's stays two.
- **A file that is none of HeroByte's three kinds still gets the field-level message**:
  Restore table backup says “tokens must be an array” of `{"hello":"world"}`, and Load character says “That character file is missing a valid name”. U9 names wrong KINDS (a table backup, a map, a
  character), and detection is deliberately the only thing allowed to refuse a file — a client
  parser must never be stricter than the server. Polishing the messages for files nobody
  saved from HeroByte is an owner call.
- **The Table tab's headings and the Players list keep the DM menu's older pixel-font sizes**
  on the phone's DM screen (its backup file-name field is 10 px); U9's new phone surfaces (the
  Table screen, the next-steps card) are the ones held to the 11 px floor.
- **A characterless seat keeps its phone row** for ➕ Add Character only now that the role left
  it — an owner question (whether that row is still wanted).
- **Reset to default** still gives a private table the password the setup docs publish for the
  public Main Hall. The panel says so and, since round 3, the button asks first (it was one tap
  beside Change table password, and the demo-server guide had told hosts to use it as a clean-up
  step); it does not refuse.
- **A table made without a DM password is claimed by the first person to enter DM mode on it**
  (the bootstrap dialog, unchanged). The next-steps card makes that person the host the card
  addresses, but it does not change who may.
- **A full-screen phone screen shows OFFLINE but not the words Reconnecting…** The notice lives in
  the top stack, which a screen covers; the screen's own chip says the table is away, and the Table
  screen's role control says “Reconnecting…”.
- **An open DM Menu closes on every reconnect** (the menu unmounts while the role is unknown) and
  reopens on Maps; anything typed into its Table tab — a backup file name, a new password — is
  lost with it. Older than U9, and the price of never judging the role from a blip.
- **A restore cannot roll a seated player's character back**: the server keeps the characters and
  tokens of every seat on the roster, present or not, so a backup's older version of a seated
  player's character is not loaded (one the file has and the table has lost does come back, as a
  recovery). It has always merged that way; the confirm, the Backups note, the help and the guide now
  say so. A monster that is in both the table and the file keeps its live token and its place.
- **A phone Load character picked after a reconnect can be lost.** The hidden file input lives in
  the row's settings sheet, and the phone's rows come from the snapshot: while the snapshot is null
  the rows, and the sheet and its input with them, are not mounted. The OS file picker backgrounds
  the page on a phone, and a background tab can lose its socket, so a file chosen on return may be
  applied to nothing, with no message. Reasoned, not reproduced on a device (review round 2).
- **Unit tests are not size-gated** (`structure-report.mjs` skips `*.test.*`). Seven test files
  this slice created or took past 349 lines: `TablePasswordControl.test.tsx` (678) and
  `TableBackupControl.test.tsx` (657), the old suites' ports, which were that size already;
  `TableTab.test.tsx` (351); `DraggableWindow.belowHeader.test.tsx` (508); and, crossed from
  below, `MobileDiceRoller.test.tsx` (318 → 426), `DMMenu.test.tsx` (332 → 417) and
  `PlayerSettingsMenu.test.tsx` (277 → 385).
- **The phone's private-table 44 px sweep does not include REMOVE**, which exists only for a seat
  that has dropped; the password fields, Change and Reset are swept.
- **A seat's own record comes back as the file had it on a restore** — name, portrait, HP and
  conditions (the merge restores the whole record except the heartbeat, the microphone level and,
  since `b54bb0ee`, the DM flag). The copy says so; whether a restore should leave those live too
  is the owner's.
- **The header no longer shows a mute indicator**: it went with the Juice button. Sound & motion in
  the Table menu says whether sound is muted.
- **A window stays a row low after a DM leaves DM mode** (it follows the header down, never back up,
  so a reconnect blip cannot make it bob).
- **A remembered window that is already open when the header grows keeps its place.** Only the
  opening is lifted (`1c67afa7`): a remembered place below the controls is the player's, and does not
  follow the header, so a DM who enters DM mode with such a window open can find its top row under
  the new one. A place the player dragged over the header on purpose does not survive a reopening.
- **The private table's REMOVE is covered by unit tests only** (it needs a seat that has dropped);
  the reconnect notice is not shown on a full-screen phone screen at all (above), so nothing covers
  it there.
- **A toast covers the desktop reconnect notice while it lives.** Toasts are the app's top layer by
  design (z-index 10000, `top: 80px`, right 20 px), the notice sits in the same corner just under the
  header (z-index 2100), and a toast lasts three seconds and is tapped away. Nothing in the app
  raises a toast for a lost connection, so the two meet only when something else speaks during an
  outage. The e2e waits the elevation toast out before it looks.
- **Two DMs, sharing the password, editing the same thing race** (the M6 batch; untouched).
- U8's limits stand (PLACE ON MAP's top-left cell, the round not on the wire, two DMs
  editing one NPC, the floating DM window lying over the Party inspector).
- **The cavernFamilies “glow” test** timed out once in a full-suite run (5 257 ms against a 5 000
  ms limit; 982 ms alone) on a file U9 never touched, and two others (`NpcTokenImageField`,
  `TokenLibrary.u4c`) did in an earlier run: the contention canary's known shape, not a U9
  regression.
- **The browser's real network was not severed in the e2e spec**: the socket-drop spec closes the
  page's socket and holds the next one (Playwright `routeWebSocket`). The live evaluation
  closed a real socket and restarted the real server (see the evaluation).
- **A dev server restarts whenever the e2e build runs** (`tsx watch` sees `packages/shared/dist`
  change), which clears every DM's elevation on it — a trap for anyone evaluating live while a
  spec builds, not a product limit: the same clearing is what a real deploy does.

## Questions for the owner

Nothing below blocks acceptance; each is a choice the slice did not make for you.

1. **Session identity, not U9 — the two-table lockout** (live finding 3). A player who uses one
   browser (one uid) for two tables is turned away from the first after a server restart that
   happened while they were at the second: “Held in another window”, and only *Start a Fresh
   Session* (a new player, a new seat) gets them in. The client presents the stale per-table
   token where the server would have accepted the newest. Options: retry once with the newest
   token after a turn-away; keep session records across restarts; or accept it. The realistic
   victim is a DM who moves between the public table and a private one straight after a deploy.
   It touches the auth flow U9 was told not to weaken, so it was not patched here.
2. **The Table button fits a name of only nine characters for a Player** (thirteen for a DM). The role
   word takes the room. Drop the word for players (the dot and the name say where you are; a DM
   alone gets a DM mark), widen the cap and let the header wrap, or keep it?
3. **Files that are none of HeroByte's kinds still get the field-level message** (“tokens must be
   an array”, “That character file is missing a valid name”). Name those too, in a later change?
4. **The phone's characterless-seat row** survives only for ➕ Add Character now that the role
   left it. Keep the row, or fold Add Character into the Table screen?
5. **The Table menu is a non-modal popover with no focus management**, like Help's and the old
   Juice's. Take and return focus for all three in U10's accessibility pass?
6. **The phone's ✕ is a 10 px glyph** (a dead CSS rule older than U9). Fix it in U10, or leave it?
7. **Reset to default** gives a private table the password the setup docs publish for the
   public Main Hall; the panel says so and the button now asks first (round 3 found the demo-server
   guide telling hosts to use it as clean-up). Refuse it on a private table instead?
8. **`docs/playtest-setup-guide.md`'s “To Change Passwords”** (steps 2–3: “Update Room Password
   and/or DM Password”) names a DM Menu step that does not exist — the default table's
   password cannot be changed from any screen, and no screen changes an existing table's DM
   password (only a table's creation, or the first entry on one made without, sets it). The other
   paths in the guide were renamed here; this step's real answer is yours to state.
9. **A DM's header is three rows at 1280 px** (Play tools wrap at BUILD MAP; older than U9).
   Move Build map and Player View to their own group?
10. **A restore brings back each seat's own record from the file** — name, portrait, HP and
    conditions (the DM status, the characters and the tokens stay live). Keep it, or leave the seat's
    record live too, as the character and token are?
11. **The header lost its mute indicator** with the Juice button. Put a small muted mark on the
    Table button, or leave it to the menu?
12. **Review ended at the cap with every finding repaired, but with no all-PASS round.** Round 3
    found no P1 and eight P2s; the repairs have had the mutants, the final ladder and a live
    two-client evaluation, not a fresh read. The rules say escalate: accept on that evidence, or
    have the round-3 repairs reviewed once more before this is committed?
13. **A frame the socket cannot send is queued and sent after re-authentication** — including
    `elevate-to-dm` and `revoke-dm`. The dialog no longer lets anyone confirm while the roster is
    unknown, so the UI cannot reach it now, but the queue still would (the permissions lens suggested
    dropping DM-authority frames beside the ephemeral types). It is shared transport, so it was not
    changed here: drop them at the queue?
14. **Toasts and the reconnect notice share the top-right corner**, and a toast (z-index 10000,
    three seconds) covers the notice while it lives. Nothing raises a toast for a lost connection, so
    they meet only by coincidence; stack them, or leave it?
