# Interface clarity — comparison report

**Written 2026-10-02 at the close of U10c.** This is the durable record of what the interface arc changed, measured in
the running app against the 2026-09-22 audit. It is an **expert walkthrough**, not a study with recruited first-time
people: no task times or success rates are claimed. The arc plan is
[interface-clarity-arc-plan.md](../planning/interface-clarity-arc-plan.md), the audit
[interface-audit-2026-09-22.md](interface-audit-2026-09-22.md) (its disposition ledger is now filled in), the slice
records are `interface-clarity-u*.md` in this directory, and the U10c record is
[interface-clarity-u10c.md](interface-clarity-u10c.md).

## 1. What was driven, and what it proves

| Mode | What | Limit |
| --- | --- | --- |
| **Live, two clients** | A disposable local table (`U10c journeys`, created through New Table), a DM tab and a player tab in the built-in browser pane, pinned uids, the dev server. Desktop 1366×768 (the plan's floor) and 1440×900 (the audit's size, for the image pairs). | One browser engine (Chromium). Both tabs are one machine. |
| **Phone and tablet, live** | 375×812 phone with the pane's touch emulation (player and DM), 768×1024 tablet (DM, desktop layout). Phone taps are real pane clicks on the dock and sheets. | **Emulation.** No real device, no iOS, no Safari, no WebKit. |
| **Browser specs** | The 359 + 3 tests already in the ladder (see the step-to-spec map in section 3). | Specs prove their own assertions, not a person's path. |
| **Keyboard** | The header's Tab order, the character window, the Draw window's sliders and Undo, the dice roller, Chat, the Ambient slider and the tool-group select were driven with real key presses. | Some focus placements were scripted (a `.focus()` to land on a control). **This is a keyboard-driven walk, not a hands-off keyboard-only run of all five journeys.** |
| **Zoom** | Emulated by halving the viewport, never a real browser zoom (U10b). | See section 4. |
| **Reduced motion** | Code read only (section 5, O-6). | Not run with the OS setting. |

**Not run at all:** a real device, iOS focus-zoom, Safari's menu path, a real 200% browser zoom, WebKit, a screen reader
(live regions are asserted in the tree, not heard), a reconnect mid-journey, a failed upload, a second-finger cancel or
pinch by hand (specs cover them), and every **download** (Save character, table backup, map export): downloads need
the owner's permission. Save character and the table backup are downloaded by specs
(`interface-table-backups.spec.ts:75` and `:172`, `mobile/mobile-table.spec.ts:299`, `session-save.smoke.spec.ts`);
**no spec downloads a map export** (image or editable map).
The Invite button's clipboard write never settled in the pane (no permission prompt to answer); the manual-link
fallback it falls back to **did** appear, which is the path `interface-table.spec.ts:115` covers.

## 2. Before and after

The audit's 19 durable images are in [interface-audit-2026-09-22/](interface-audit-2026-09-22/) (16 at 1440×900, three
phone captures — 20, 78 and 83 — at 390×844; a fresh player or DM). "After" images are in
[interface-clarity-report/](interface-clarity-report/). **Only the first two pairs (03 and 06) share the before's viewport
(1440×900); the others are at 1366×768 (the plan's floor), 375×812 or 768×1024, and no pair reproduces the before's
table state** (the afters show the journeys' built map, three goblins and a drawn stroke, where the befores are empty
or freshly built tables). The pairs show what the surfaces look like now, not a pixel comparison. Desktop afters are
JPEG captures scaled to 800 px wide; phone and tablet afters are at 375, 750 or 768 px. They show appearance, not
authority, transport or gestures.

| State | Before (2026-09-22) | After (2026-10-02) | What changed |
| --- | --- | --- | --- |
| A player at their table, nothing open | [03-player-ready.png](interface-audit-2026-09-22/03-player-ready.png) | [j1-player-ready-1440x900.jpg](interface-clarity-report/j1-player-ready-1440x900.jpg) | Twelve equal buttons wrapped onto two lines (SNAP, RECENTER, POINTER, DRAW TOOLS, CRT, JUICE, LOG … then HELP) and a UID chip became two named groups, **Play tools** (Move first) and **Panels & settings**; the table name and role live in one Table button; the Entities cards became a compact Party roster. |
| Drawing window open | [06-drawing-palette.png](interface-audit-2026-09-22/06-drawing-palette.png) | [j1-draw-tools-1440x900.jpg](interface-clarity-report/j1-draw-tools-1440x900.jpg) | Same Freehand / Line / Rectangle / Circle names as the phone; area templates AoE-prefixed; a player no longer sees an enabled **Clear All** (it did nothing); History is Undo, Redo, Cancel stroke, Done. |
| Chat | [13-chat.png](interface-audit-2026-09-22/13-chat.png) | [j1-chat-and-roller-1366x768.jpg](interface-clarity-report/j1-chat-and-roller-1366x768.jpg) | Chat & Rolls is its own header button; the composer is the 13 px body face (it was 8 px pixel type), SEND stays pixel. |
| Phone party | [20-mobile-party.png](interface-audit-2026-09-22/20-mobile-party.png) | [j1-phone-party-375x812.jpg](interface-clarity-report/j1-phone-party-375x812.jpg) | The seat's characters read as one card with Focus, INIT, Edit, HP and **Manage status** (44 px targets, no overlap with the ONLINE chip). |
| DM build palette | [29-map-tools.png](interface-audit-2026-09-22/29-map-tools.png) | [j2-build-structures-1366x768.jpg](interface-clarity-report/j2-build-structures-1366x768.jpg) | Fourteen equal tools became a **Tool group** select (Terrain, Structures, Objects, Lighting, Generate) with Select, Sample, Layers, Inspect and Undo always pinned. |
| Terrain paint | [31-paint-options.png](interface-audit-2026-09-22/31-paint-options.png) | [j2-terrain-group-1366x768.jpg](interface-clarity-report/j2-terrain-group-1366x768.jpg) | Paint terrain / Erase terrain with a 1×1, 3×3, 5×5 footprint and a status line that names the armed tool. |
| Lighting | [34-layers-light.png](interface-audit-2026-09-22/34-layers-light.png) | [j2-lighting-group-1366x768.jpg](interface-clarity-report/j2-lighting-group-1366x768.jpg) | **Ambient light — 70 %** is a Lighting-group control (Dark → Daylight), not a Layers-popover opacity. |
| Generate | [35-generator-missing-layers.png](interface-audit-2026-09-22/35-generator-missing-layers.png) | [j2-dm-tablet-768x1024.jpg](interface-clarity-report/j2-dm-tablet-768x1024.jpg) | Layers and Inspect stay reachable while Generate is armed (768×1024 DM, six header rows, every control in view). |
| World | [73-world-overlaps-settings.png](interface-audit-2026-09-22/73-world-overlaps-settings.png) | [j4-dm-world-tab-1366x768.jpg](interface-clarity-report/j4-dm-world-tab-1366x768.jpg) | World is a DM-menu tab that says what it is ("Travel here moves the whole table"; "Party is at: …") instead of a floating button over Settings. |
| Touch drawing | [78-touch-drawing.png](interface-audit-2026-09-22/78-touch-drawing.png) | [j1-phone-draw-sheet-375x812.jpg](interface-clarity-report/j1-phone-draw-sheet-375x812.jpg) | One sheet with Tool, Settings, History (Cancel stroke, Done drawing); a reserved instruction line so chips do not move. |

Further after-images with no 2026-09-22 pair (new surfaces or states the audit did not capture):
[DM just entered, next steps card](interface-clarity-report/j2-dm-entered-1366x768.jpg) ·
[map after Done building](interface-clarity-report/j2-done-building-1366x768.jpg) ·
[character window](interface-clarity-report/j1-character-window-1366x768.jpg) ·
[DM Encounter tab](interface-clarity-report/j3-dm-encounter-1366x768.jpg) ·
[phone ready](interface-clarity-report/j1-phone-ready-375x812.jpg) ·
[phone Tools](interface-clarity-report/j1-phone-tools-375x812.jpg) ·
[phone dice roller](interface-clarity-report/j1-phone-roller-375x812.jpg) ·
[phone chat](interface-clarity-report/j1-phone-chat-375x812.jpg) ·
[phone DM menu](interface-clarity-report/j2-phone-dm-menu-375x812.jpg).
The audit's [08 Clear All no-op](interface-audit-2026-09-22/08-player-clear-all-noop.png), [40 two Applies](interface-audit-2026-09-22/40-door-two-applies.png),
[62 map library](interface-audit-2026-09-22/62-map-library-after-building.png), [69 kick panel](interface-audit-2026-09-22/69-kick-panel.png),
[83 touch paint](interface-audit-2026-09-22/83-touch-paint.png), [87 region generated](interface-audit-2026-09-22/87-region-generated.png),
[04 player settings](interface-audit-2026-09-22/04-player-settings.png), [24 players](interface-audit-2026-09-22/24-players.png) and
[92 grass cancel](interface-audit-2026-09-22/92-grass-cancel-confirmed.png) have **no after-image**: their states were checked by specs and
slice records (see the disposition ledger), not re-captured.

## 3. The five journeys (plan section 7)

"Live" = driven by me in the pane against both clients. "Spec" = driven by a browser spec in the ladder (the
step-to-spec map below). A step is a pass only where the visible control was found and worked; menu presence is not parity.

### Journey 1 — player first session

| Step | Desktop 1366×768 | Phone 375×812 | Notes |
| --- | --- | --- | --- |
| Join | Spec (`smoke.spec.ts`); live (password, Enter) | Spec (`joinMobileTable`) | |
| Find / rename own character | **Live, keyboard:** Table header → Party row → details → Open player settings → Tab to **Character Name** (labelled) → type → Enter; the card, the roster row and the token's nameplate all updated, and the DM's Party bar showed the new name; Escape closed the window and focus went back to the launcher | Party → **Edit** exists on the card; **no spec and no live pass drove the phone rename** (specs rename over the socket) | Before, only typing-and-discarding was in a spec; this is the first committed rename through the UI |
| Focus / move | Live: the Focus buttons; Move is the armed tool | Move pad: spec | |
| Draw, width / opacity, undo / erase | **Live, keyboard:** Enter on Draw, a stroke, Stroke width 3→8 and Opacity 100→80 with held arrow keys (focus held), a second stroke, **Undo** by keyboard (2 → 1 drawing); **Erase drawings was not driven live** (specs: `interface-drawing-settings.spec.ts`, `partial-erase.smoke.spec.ts`) | Live: the sheet, 22 controls, none under 44 px | |
| Cancel | Escape ladder, see section 5 | Spec (second finger) | The **Cancel stroke** button is not clicked by any spec for Draw and was not by me |
| Move again | Live: Escape closes layers, the tool returns to Move | **No spec** (no spec returns from Draw to Move on a phone) | |
| Roll publicly | Live: TABLE, d20 → 18, **the DM's snapshot has it** | Spec for chips only | |
| Roll privately | **Live:** ME, d20 → 2, **the DM's snapshot does not have it** (`visibility: self`); the audience line reads "Only you see this roll. No other player or DM is sent it." | **Live:** ME, d20 → 17, only the player has it | Closes a gap: the only private-roll spec was socket-driven |
| Chat / whisper | **Live:** public line, then "Whisper to Player 1" by keyboard; the DM's chat log has both, the whisper carries `to` (the DM was the recipient: **with two clients, non-delivery to a third was not shown live**; `interface-chat-privacy.spec.ts:67-71` has three contexts) | Live: the sheet, history shown, 11 controls all ≥ 44 px (the 16 px composer was measured in U10b; the Send-to value was not) | The whisper target stays selected after sending (the placeholder changes to "Whisper something…") |
| Condition | **Live:** Status effects → Poisoned (`statusEffects: ["poisoned"]`) | Live: card shows the chip and **Manage status** (not exercised) | No spec for a phone player setting their own |
| Initiative | **Live:** Set Initiative → Roll d20 now → 4; the dialog says "saving an initiative starts combat"; the DM's Party bar then showed Combat Active | Spec | |
| Save character | Reached (the Character file section explains scope) — **the download was not run** | Spec | |
| Help | Live: opens on the first topic, Escape closes and returns focus | Spec | The first topic is World; "Getting around the map" is second (section 5, O-2) |

### Journey 2 — DM first session

| Step | Desktop | Phone | Notes |
| --- | --- | --- | --- |
| Create / join | **Live:** New Table → Create private table | Spec | |
| Enter DM mode | **Live, keyboard:** the password field takes focus, type, Enter; "You are in DM mode. The DM tools are on." | Spec | |
| Invite | **Live:** the clipboard was not granted in the pane, so the **manual link** appeared (no password, no `sessionUid`); the card says "Players also need the table password" | Spec | |
| Current table map | **Live:** Build map → "On table: no map yet" → **Start live map** | Live: DM menu → Maps shows "On table: Live Map Oct 2" | |
| Build room / hallway / door | **Live:** Structures group, a room (grass floor, "Decorate last room"), a hallway, a door across the opening | Spec | |
| Grass paint / sample / erase | **Live:** Paint, Erase (a pit appeared), Sample (it routed back to Paint with Grass) | Spec for paint (the default material) and erase (`mobile-map-edit-paint.spec.ts:74`); **terrain Sample on a phone is driven by no spec** (the phone Sample spec samples a placed object); nor is the phone's rename or self-condition | |
| Light / ambient | **Live:** Lighting group; ambient 100 → 70 by keyboard (found **F1**, fixed); Place light was armed and the map clicked (the new light was not independently confirmed) | Spec | |
| Player preview | **Live:** Player View is `aria-pressed`; toggled on and off | **No phone route: desktop-only by the owner's ruling (U10d)**; the button is in `Header.tsx` only and Help says "Desktop only" | No spec clicks it |
| Done | **Live:** Done building closed the tools | Spec | |

Map space for a DM, measured at the end of this journey (party drawer open, "next steps" card dismissable):

| Viewport | Header | Map band | Party drawer |
| --- | --- | --- | --- |
| 1366×768 | 3 rows, ~139 px | **503 px, 65.5 %** | 114 px |
| 1280×720 | 3 rows, ~139 px | **455 px, 63.2 %** | 114 px |
| 768×1024 (tablet **with a mouse pointer**, desktop layout) | 6 rows, ~220 px (U10b counted 8 rows at 768×540; the counting method differs) | not measured (screenshot only) | one scrolling row |

### Journey 3 — encounter

Live on desktop, both clients: 3 goblins added from the library with ×3 (auto-numbered), **Roll missing NPC initiative**
(19 / 18 / 7, the player's roster shows "(Enemy), initiative N"), the player's own initiative had started combat,
**Next** (wrapped to the top of the order, both clients named the same holder), **Previous**, **Remove the current
participant** (the turn passed to its successor on both clients and the player's own initiative cleared), **End combat**
(both clients inactive, initiatives kept). HP and conditions were set on the player's character in Journey 1 and not
again here. Spec covers Place and hide/reveal on desktop (`interface-encounter.spec.ts`) and the phone's Encounter tab, initiative and turns (`mobile-encounter.spec.ts`).
**Not covered by a spec or live:** the phone's Previous, Remove and library batch, NPC placement through the UI on a
phone. (**Temp HP** and **Clear Initiative** on a phone did not exist at U10c's close; U10d built them and drives them
with `mobile-temp-hp.spec.ts` and `mobile-clear-initiative.spec.ts`.)

### Journey 4 — World and recovery

Live: the DM menu's **World** tab, **Create location** (Old Cellar, with Rename, Hidden, Delete, Pick a map, Link
existing map, Generate map for location). Spec: inspect without moving the party, use at table, generate, travel
there and back, link, restore with both clients (`interface-map-identity.spec.ts`, `atlas-journey.smoke.spec.ts`,
`interface-table-backups.spec.ts`). **No spec and not run live:** Export map image, Export editable map, table backup
on a phone, a phone's travel back.

### Journey 5 — interruptions

Live: Escape with Help open and the Character window open; Escape with the Draw window and the inspector open;
character-window close/reopen; resizing a live tab between desktop, phone and tablet widths. Spec: the Escape ladder
(`interface-popover-focus`, `interface-cancel-ownership`, `interface-window-annotation-acceptance` and eight more),
reconnect (`interface-popover-blip`, `interface-table-role-drop`, `mobile-top-stack`), role switch, delayed ack, text
entry, second-finger cancel. No short-landscape viewport was driven in U10c (only U10b's 667×375 and 320×568 are cited). **Gaps (no spec, not run):** a failed upload (only a blocked-storage write is covered), click-outside on a phone, a
stand-alone phone camera pinch, the whole journey keyboard-only.

### Step-to-spec map (from the read of `apps/e2e`)

No spec chains a whole journey; coverage is by step. Journey 1: `smoke`, `interface-player-navigation`,
`interface-drawing-settings`, `interface-window-annotation-acceptance`, `dice`, `interface-chat-privacy`,
`interface-whisper-recipient-removal`, `interface-party-roster`, `player-npc-initiative-ui`, `interface-table-backups`,
`help-panel`, `mobile/mobile-draw`, `mobile/mobile-dice-roller-reach`, `mobile/mobile-encounter`, `mobile/mobile-help`.
Journey 2: `interface-table`, `interface-build-palette`, `interface-terrain-clarity`, `interface-properties-lighting`,
`interface-map-identity`, `mobile/mobile-map-edit-*`, `mobile/mobile-table`. Journey 3: `interface-encounter`,
`npc-bulk-add`, `token-library`, `turn-navigation`, `mobile/mobile-encounter`, `mobile/mobile-hp-targets`.
Journey 4: `atlas-journey.smoke`, `interface-map-identity`, `interface-table-backups`, `mobile/mobile-atlas`. Journey 5:
see above. **Everything in this table is emulation.**

## 4. Zoom, narrow viewports and touch targets

- **Name-and-size sweep** (every **visible** control, measured from the page; a control passed with *any* accessible name
  and, on touch, 44 px on its shorter side): phone home 5, Party 13, Tools 17, Draw 22, Dice 45, Chat 11, View 5, DM
  home 7, DM Maps 61, World 26, Encounter 36, NPCs & Monsters 68, Props & Objects 18, Table 29: **none under 44 px, none
  off-screen that is not inside a scroll area; two unnamed sliders** (Grid size and Square size, on the DM's Maps tab
  on both layouts; now named). Desktop: the player with Draw, Dice, Chat, the inspector and the settings window all
  open: 110 controls, none unnamed; the DM's six menu tabs and all five Build tool groups: the same two sliders and the
  NPC card's two icon buttons (now named). **What the sweep could not see**, found by the arc review: names that exist but
  do not say *which* item ("Open player settings" and "Set Initiative" repeat on every card, and "Set Initiative" shows a
  number its name does not contain), and **hidden controls that stayed focusable** (a collapsed section). The
  glyph-only buttons it did find are fixed (section 5); the repeated names are deferred.
- **DM menu tabs on a phone:** the tab strip scrolls sideways (738 px of tabs in 327 px). MAPS, WORLD and ENCOUNTER fit;
  NPCs & Monsters, Props & Objects and **Table** sit at x = 312, 498 and 684 and need a sideways scroll. A second
  route exists: **Tools → Table → "Table settings…"** opens the DM screen on the Table tab (`mobile-table.spec.ts:94-105`),
  and Help now gives the phone path (♛ DM → Table) for the Table-tab entries.
- **200% zoom** (U10b, by viewport size): 960×540 and 768×540 are the desktop layout and every one of the DM's 14 header
  controls was reachable; 1366×768 at 200% is 683×384, which is the phone shell (≤ 520 px tall).
- **Tablet:** the 768×1024 DM images were taken with a mouse-pointer viewport, so they are the desktop layout; a real
  touch tablet up to 1024 px wide gets the phone shell (`mobileLayout.ts:22`) and was not looked at.
- **Narrow landscape:** the phone drawing sheet stacks in one column below 640 px landscape (568×320); 667×375 shows the
  history row (U10b).
- **The 31 px:** the always-present tool line makes the 320×568 phone's drawing sheet scroll inside itself in every state;
  everything stays reachable and a spec measures it. **Kept, by the owner's ruling (2026-10-02).**

## 5. Findings of this pass

Found by walking the journeys (F1–F3) and by the arc-level review of this record (F4–F8). Each fix is its own commit,
RED first; mutants were run for most (the record says which); the commits are listed in [the U10c record](interface-clarity-u10c.md).

| # | Finding | Disposition |
| --- | --- | --- |
| **F1** | The DM's **Ambient light** slider (and the two Layers sliders) were `disabled` while their change was saved, so a browser took focus off them: after one arrow-key step the next key landed on the page. Reproduced live (two quick keys: one step, focus on the page) and by a spec that holds the server's replies. | **Fixed:** the sliders say they are waiting with `aria-disabled` and keep focus. Keys pressed during the save window are ignored, so a burst of four steps once (known limit). |
| **F2** | The NPC card's visibility toggle and settings button were an eye and a gear with the state only in a hover title. | **Fixed:** "Hide Goblin scout from players" / "Show … to players", "NPC settings: Goblin scout"; the titles stay. |
| **F3** | Grid size and Square size sliders had a caption and no name; the square size's spoken value ignored the slider's clamp. | **Fixed:** named, with units in `aria-valuetext` (clamped). |
| **F4** | **Collapsed "locked" sections stayed focusable and operable**: with `maxHeight: 0` alone, Tab reached invisible fields, so a keyboard user could change a LOCKED grid's size, press an invisible **Clear Zone** (no confirm), or turn the "locked" map's rotation and scale. The name sweep counted visible controls only, so it could not see this. | **Fixed:** collapsed content is `visibility: hidden` and `aria-hidden`, so it leaves the Tab order and the accessibility tree. |
| **F5** | Repeated-press buttons were `disabled` while saving and dropped focus like F1: layer **Move up / Move down**, and **Undo edit / Redo edit** on a saved map. | **Fixed** the same way (`aria-disabled`, the press ignored while saving; a true `disabled` stays for "nothing to undo / end of the stack"). |
| **F6** | More glyph-only or unnamed controls on arc surfaces: the dice chips' "×", the roll log's "⋯", Generate's "⟳", the stamp "↺ / ↻" pair, the three HP number fields. The whisper-recipient message mounted already filled. | **Fixed:** named; the status line is mounted empty (clipped) and filled when a recipient leaves. |
| **F7** | The phone player dock's fifth button said **View** and reset the camera, with the meaning only in a hover title that a phone never shows. (This report first deferred it for a label that "needs to fit"; "Reset" is five letters, the width of Tools and Chat.) | **Fixed:** the button says **Reset** (named "Reset view"). |
| **F8** | Help text that was false or incomplete: the Build map entry still taught ambient light as "Lighting opacity"; Place on map "moves that same token" (it replaces it); Undo did not say that erasing a whole shape cannot be undone (Undo then takes back the drawing before it); "DM Menu → NPCs" (the tab is "NPCs & Monsters"); Table-tab entries with no phone path; Player View with no "desktop only". | **Fixed** (`helpText.u10c.test.ts`). |
| O-1 | Escape follows paint order: the Character window (z-index 2500) outranks the Help popover (2000), so with both open and focus in Help, the first Escape closes the window and moves focus to its launcher. | **By design** (`helpOwners.u2.test.tsx` pins it). Recorded, not changed. |
| O-2 | Help opens on **World** first (mostly DM content); "Getting around the map" is second. | Open, P3 (the array order is the display order). |
| O-4 | With the Draw sheet open, opening Dice shows the sheet faintly through the roller's 85 % scrim, and "I ROLLED IT" lies over the dimmed dock. | Open, cosmetic. |
| O-5 | The phone's Party sheet lists characters, not NPCs; enemies show in the initiative strip. | **By design** (U7). |
| O-6 | `prefers-reduced-motion` is honoured by the CRT filter, the sparkle, and the Game-feel default (`data-motion`); the **infinite** CSS loops (shimmer, glow-pulse, the low-HP flash, bounce, the loading spin) are not gated. | **Deferred**: which loops are essential (the spinner) is the owner's call. |
| O-7 | Two characters spawn at the same map cell, so their nameplates overprint. | Open, minor; pre-existing. |

**Phone-parity gaps the review found: resolved in U10d (2026-10-02), with the exceptions named below.** **Temp HP** and **Clear Initiative** on your own
character now exist on the phone (the Party row's number; the character sheet's Initiative Status). **Deleting a
selection** was not an orphan: the phone already deletes map pieces (Select → 🗑 Delete), props (Props), NPCs (the NPC
editor) and drawings (Erase drawings, Undo drawing), so only Help's "press Delete" lacked a phone path (it has one now).
**Player View** and **correcting an older roll from the log** are ruled **desktop-only** (rare, deliberate desk tasks) and
Help says so. **Also desktop-only:** Voice (Help says "Desktop only"), unlocking a locked map element (Help says so since U10d),
deleting your own token (Help says so), and removing an NPC token from the table by Delete (an NPC is deleted in the
NPC editor). A player's own token cannot be deleted on a phone (ruled desktop-only; Help says to ask the DM or use a
computer); Delete on a selection of props now says "Props are deleted in the Props panel." with the app's toast.
**Still open:** phone dialogs (Party, Table, Props, Kick, Help, Tools) do not move focus in or return it
on ✕ (Chat and DM do): a keyboard or screen-reader user on a phone is the case.

**Open, not built:** names that do not say *which* item ("Open player settings", "Set Initiative", Place on Map /
Duplicate / Delete on an NPC, Remove / Select All on a player, two "Upload image" buttons in one window); and
**"Objects"**, which the DM tab "Props & Objects", Build's "Objects" group and the player's 📦 PROPS share, with one icon.
**36 controls** still use `disabled` while saving and drop focus after a press (`InitiativeModal` 5,
`MapStudioControl` 5, `ImageField` 5, `ElementPropertiesForm` 4, `NPCEditorActions` 3, `MobileSelectPanel` 2,
`MobileLayersPanel` 2, `MapEditLayersPopover` 2, `BuildEntryPrompt` 2, `ViewedMapDetails` 2, and four single sites; one of
`ElementPropertiesForm`'s four is the inspector's whole `<fieldset disabled>`); they are pressed once rather than
repeated, so they were left.

## 6. Known limits (restated, not re-argued)

Drawing sheet stacks in one column below 640 px landscape; the quick wheel still says Paint / Erase;
`.table-menu-button` runs at 10 px against a stylesheet that says 8; `.map-edit-decoration__fire` load order unverified;
DM tabs are `aria-pressed`, not tabs; the roller is not modal (the toolbar and dock stay in the tab order beneath);
no real device, iOS zoom, Safari menu path, real 200% zoom, WebKit or screen reader was observed.
**Still open and not U10's:** Q1 (two-table session lockout), Q4 (characterless-seat phone row), Q7 (Reset to default
on a private table), Q10 (a restore brings back a seat's record), Q13 (DM-authority frames queued by the transport).

## 7. Does a newcomer complete the table loop on both input models?

On this evidence, **yes for the loop as an expert walks it, with named exceptions**: on desktop every step of the five
journeys has a visible, named entry point; on a phone every step does **except Player View** and correcting an older
roll from the log, both ruled desktop-only (section 5), and the phone's focus handling in some dialogs is open. The cross-client claims held
between two live clients where they were checked: a private roll stayed with its roller (desktop and phone), the
DM's chat log carried the whisper, combat state agreed after Next, Previous, Remove and End, and the DM's Party bar
showed the rename. That a whisper reaches **only** its recipient needs a third client and is carried by
`interface-chat-privacy.spec.ts`, not by the live pass. The named exceptions are also the steps no spec or live pass
drove (section 3 gaps), the downloads, and everything that needs a real device. A first-time human usability study
remains distinct evidence that this report does not replace.
