# Player Guide

You've [joined a table](getting-started.md) — here's everything you can do at it.

## The table at a glance

![The table: toolbar along the top, map in the middle, Entities panel below](img/table-first-join.jpg)

- **Top toolbar** — tools and toggles. Hover any button for a tooltip. Tools are exclusive: picking one turns the previous one off, and clicking the active tool turns it off again.
- **Map canvas** — the shared battlemap. Everything here syncs live to every player.
- **Entities panel** (bottom) — a card for every character at the table: the party, the DM, and any visible NPCs. **▼ HIDE ENTITIES** collapses it.
- **🟢 ONLINE** (top center) — your connection to the server.

### Moving around the map

| Action             | How                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Pan                | Drag empty map space (with no tool active), or **middle-mouse drag** (works even with a tool active) |
| Zoom               | Mouse wheel — zooms toward your cursor (0.1× to 8×)                                                  |
| Reset the camera   | **🧭 RECENTER** — returns to the map's origin at 1× zoom, which is not always where you started      |
| Jump to your token | The ⚔️ button on your player card (**Focus camera on token**)                                        |
| Touch              | One finger pans, two fingers pinch-zoom                                                              |

## Your character card

Your card in the Entities panel is your character sheet in miniature:

- **Name** — click it to edit inline.
- **Portrait** — open **⚙️** settings and **⬆ UPLOAD IMAGE** a portrait straight from your device — on a phone, that's your camera roll. (Clicking the **+ ADD PORTRAIT** square also takes a pasted image URL, and any image URL still works.) When you talk on voice, your portrait glows and swells.
- **HP** — click either number in `HP: 100 / 100` to type a new value (Enter or click away to save), or **drag along the HP bar** to scrub it. The bar shifts color as you drop: green, amber, red.
- **Temp HP** — a separate pool absorbed before regular HP; click to edit.
- **⚔️ / INIT** — status effects and initiative (covered below).
- **🎤** — voice chat (covered below).
- **⚙️** — opens your full settings window.

### The settings window (⚙️)

![Player settings showing the character name, portrait, token image, and player-state controls](img/player-settings.jpg)

Everything about your character in one draggable window:

- **Character Name**, **Portrait**, and a **Token Image** — give your portrait and map token custom art: **⬆ UPLOAD IMAGE** from your device (camera roll on a phone), or paste an image URL. **CLEAR** the token image to go back to a colored ring.
- **Player State → SAVE TO FILE / LOAD FROM FILE** — download your character (name, HP, portrait, token, position, status effects, your drawings) as a JSON file and restore it later — handy insurance between sessions, or for moving your character to another table.
- **Dungeon Master Mode** — see [Becoming the DM](getting-started.md#becoming-the-dm).
- **Initiative Status** — your current initiative, with a **🧹 CLEAR INITIATIVE** reset.
- **Token Size** — Tiny, Small, Medium, Large, Huge, or Gargantuan (half a cell up to 3 cells).
- **Status Effects** — a checklist of 38 conditions (Prone, Poisoned, Blessed, Rage, Concentration…). Up to three show as emoji medallions on your portrait and token; the rest roll up into a `+N` bubble.
- **Multiple Characters → ➕ ADD CHARACTER** — run a second PC (or a familiar): each character gets its own card, token, HP, and initiative.

## Tokens

Your token is your presence on the map:

- **Nameplate and HP bar** — every token wears its character's name, and a thin health bar when you're allowed the numbers (your party always; monsters at the DM's discretion — a red dot means bloodied). Names hold their size at any zoom.

- **Move** — drag it. With **SNAP** on (top toolbar) it clicks to grid cells; others receive its new position when you release it. Or step it from the keyboard: **WASD** / **arrows** move it one cell (Q E Z C for the diagonals; hold a key to walk). With nothing selected the keys move your own token, as long as you run just the one character (with a second, pick the one you mean first) — except while you are typing, and **↑/↓** page a panel you last clicked into or scrolled, such as Chat & Rolls (WASD and ←/→ still walk). With **🖱️ SELECT** or **🔄 TRANSFORM** armed the keys move only the piece you have picked (nothing picked, nothing moves); **✏️ Draw**, the grid-alignment wizard and atlas-link take the keys entirely. To move something else you may move, pick it with SELECT or TRANSFORM first.
- **Recolor** — double-click your token for a new random color.
- **Select** — click it. **Shift-click** adds to a selection, **Ctrl/Cmd-click** toggles. With the **🖱️ SELECT** tool you can drag a marquee to grab several tokens and drawings at once, then drag any one of them to move the whole group.
- **Resize / rotate** — with the **🔄 TRANSFORM** tool, click a token for Photoshop-style handles: 8 scale handles plus a rotation handle above (rotation snaps to 45°; hold **Ctrl/Cmd** to rotate freely). The center crosshair drags the object.
- **Delete** — select and press **Delete** (you can only delete what you own; a confirm dialog lists the exact casualties).
- **Locked** tokens (🔒 badge) can't be moved or deleted until unlocked — DMs use this to pin scenery and important pieces.
- **Ping** — double-click (or double-tap) empty map space to drop a quick ping everyone sees, in any tool mode.

You can only move **your own** tokens. The DM can move everyone's.

## Table chat and whispers

Open **📜 Chat & Rolls → Chat**, or **Chat** in the phone dock. Choose **Everyone**
for table talk or **Whisper to [name]** for a private message, then press **SEND**
or Enter. Whispers go to the sender's and recipient's table seats; being the DM does
not grant access to other players' whispers. A connected seat is protected against
another person claiming it. After a seat is fully offline and its session-token
grace expires, someone with the table password can claim it and read whispers
retained for that seat. This is the same offline-identity limit as private rolls.

If the selected recipient is removed from the table, your draft stays in the box
and sending is blocked. Choose a recipient again or explicitly choose **Everyone**
before sending, even if the removed seat returns. New whispers keep the recipient's
name as it was when sent; older messages fall back to the current roster name, or
“unknown” when that name is unavailable. Closing the panel or switching to Rolls
clears an unsent draft.

## Dice

Press **⚂ Dice** for the roller and **📜 Chat & Rolls → Rolls** for dice history.
On a phone, open **Chat** in the dock. Chat opens first; your last tab is remembered
for your player in this browser session when you close it or switch layouts.

![Building a roll: two d20s and a +1 modifier queued up](img/dice-roller-built.jpg)

1. Click dice to add them to the tray — **d4, d6, d8, d10, d12, d20, d100** — and click again for more of the same (a `×N` badge appears; click the badge to type an exact count).
2. Add **+1 / −1** modifier chips; click a chip to type any value (−99 to +99).
3. Pick **NORMAL / ADV / DIS** and **TABLE / DM / ME** (below).
4. Press **⚂ ROLL!**

The dice tumble, land with a satisfying rattle, and the result panel breaks down every die:

![A roll result: each die face, the modifier, and the total — plus the shared roll log](img/dice-result.jpg)

- Natural 20 on a d20 → a gold **★ CRITICAL! ★** banner (and a sting). Natural 1 → **✖ FUMBLE! ✖**.
- Every roll lands in **Chat & Rolls → Rolls** with your name, timestamp, formula, and total, newest first. Its TABLE / DM / ME audience still applies. Long formulas collapse; click an entry for its full breakdown.

### Rolling real dice instead

If your table rolls physical dice, HeroByte will take your word for it — and say so, loudly, so nobody has to wonder which numbers came from the app.

There are two ways in, and they cover the two moments you need them:

- **Before rolling.** Build the formula if you like, then press **✋ I ROLLED IT** instead of ROLL and type what the dice came to. You do not have to build anything first — with an empty tray, type `17` and that is what lands.
- **After rolling.** The result panel offers **✋ THAT'S NOT WHAT I ROLLED**. Type the real number and the log entry is rewritten in place: the app's total struck through, yours beside it.

Either way the entry wears a **BY HAND** badge in the log, in its own colour, with anything it replaced struck through. Nothing typed is ever dressed up as something the server rolled. Correct the same roll twice and the struck-through number stays the app's **original** roll, which is the one worth being able to check.

You can correct your own rolls; the DM can correct anybody's. And your DM can switch hand entry off for players entirely (**DM Menu → Session**), in which case the app's dice are the only way in.

### Advantage and disadvantage

**ADV** rolls the first die of your formula twice and keeps the higher; **DIS** keeps the
lower. The discarded dice stay in the breakdown, struck through, so you can see what you
got away with. The log tags the entry **ADV** or **DIS**.

### Who sees a roll

- **TABLE** — everyone. The default.
- **DM** — you and the DM only.
- **ME** — only you. Other players and DMs do not receive the roll.

A hidden roll is not merely hidden in other people's app: it is never sent to them. Their
browser has no copy to find. While you are at the table, your seat is yours: another browser
claiming your id gets nothing and cannot knock you off. (Within reason: someone with the table
password could still claim your seat hours after you leave, as a plain player — so hidden
rolls protect you from the other people at your table, not from one who waits for you to go.)

### Macros

**d20**, **ADV d20**, **DIS d20** and **2d6** are always there. Build any roll and press
**+ SAVE** to name it and keep it. Saved macros live in **this browser** — they do not
follow you to another device.

### The dice are the server's

You do not roll — the server does. Your browser sends the formula ("2d20 + 5") and nothing
else; the server rolls it, adds it up, and stamps your name on it from your connection.
There is no number in the message for a modified client to change, and no name field to
put someone else's in.

## Drawing, measuring, pointing

### ✏️ Draw

![The drawing toolbar with freehand strokes and a circle on the map](img/drawing-tools.jpg)

The desktop toolbox and phone sheet use **Tool → Settings → History**, followed by
**Done drawing**. Choose **Freehand**, **Line**, **Rectangle**, **Circle**, or
**Erase drawings**, or one of the four **area templates** below. Settings include
**Color**, **Stroke width (px)** from 1–50, and **Opacity (%)**. Rectangle and Circle
also offer **Filled**. Desktop includes 12 preset colors; both layouts have a color
picker. Your settings stay selected when the layout changes. The screenshot above
shows the earlier arrangement.

On the phone, **Hide controls** makes room on the map while your drawing tool stays
active. The compact row keeps **Undo drawing**, **Redo drawing**, **Cancel stroke**
and **Done drawing** available. Opening and closing Tools or Help keeps that compact
row. **Show controls** restores the tools and your selected settings; **Done drawing**
exits drawing mode. Starting Draw again opens the settings sheet.

- A completed drawing syncs to everyone when you finish the stroke or shape.
- Choose **✥ Move** in the header (phone: **Tools → Move**) to put the toolbox away and return to moving tokens and panning the map.
- **Undo/redo** (buttons, or **Ctrl+Z / Ctrl+Y** while draw mode is active) affect **your own** drawings only.
- **Erase drawings** affects annotations, with **Eraser width (px)** as its only setting.
  Crossing a freehand stroke removes that section; other drawing shapes are removed
  whole. Partial freehand erasing supports Undo; whole-shape deletion currently does not.
- You can erase, move and delete only your own drawings; the DM can remove anyone's.
  **Clear all drawings** removes all annotations, with confirmation, and is DM-only.
  Terrain painting and **Erase terrain** are separate Build map tools.

### Area templates

Choose **AoE Burst**, **AoE Cone**, **AoE Cube**, or **AoE Bolt** under desktop
**Area templates**, or in the phone's Tool group. Drag from the point of origin
outward — the origin snaps to the grid, and the size snaps to whole squares, so a
template reads as a round number of feet. Release and it lands on the map labelled
with its size (`15 ft cone`), with an automatic translucent fill. Stroke width changes
the outline; the drag determines the area. There is no separate Filled toggle.

Templates use your color. Opacity changes the outline and translucent fill; the size
label stays visible, including at 0% opacity. Creation supports Undo/Redo, and the
eraser removes the template. Everyone at the table sees it. A cone is drawn to 5e's
rule — as wide at its far edge as it is long.

### 📏 Measure

Click a start point, and a dashed line follows your cursor with a live readout like `3 Squares (15 ft)`; click again to freeze it, click a third time to start fresh.

**The whole table sees your line while you draw it**, labelled with your name, so "is Grak in range?" is one question with one answer. Putting the tool away clears it again.

Distance is counted by the table's **diagonal rule**, which the DM sets (5e by default: every square costs the same, so a two-square diagonal is 10 ft). Feet-per-square is a DM setting too; 5 ft is the default.

![Measuring a diagonal: squares and feet update as the line moves](img/measure-tool.jpg)

### 👆 Ping

Your cursor becomes a pulsing ring; click to plant a ping — a colored burst with your name under it, visible to the whole table for 3 seconds, with a chime.

![A ping on the map, labeled with the player's name](img/pointer-ping.jpg)

## Props (when your DM turns them on)

If your DM ticks **Players can add props** in their menu, a **📦 PROPS** button appears at the bottom right (on a phone: **Tools → Props**). It turns any picture into a piece of the scene:

- **Add a prop** — upload an image or paste a URL, give it a label, pick a size, press **+ ADD PROP**. It lands at the centre of your view; drag it into place. Generate a treasure chest in your favorite image tool and put it on the table while the DM describes the room — that's exactly what this is for.
- **Scatter** — set **×N** before adding and that many copies land in a loose pile, numbered, each grabbable on its own.
- **Reshape it** — the **🔄 Transform** tool puts scale and rotate handles on your props, the same handles drawings get.
- **Yours are yours** — you can edit and delete only the props _you_ created. The DM can adjust or remove anything.

If the button isn't there, the table has props switched off — ask your DM.

## Voice chat

Press the **🎤** on your own card and grant the browser's microphone permission. That's the whole setup:

- Voice is **peer-to-peer** (WebRTC) between everyone at the table.
- When someone talks, their **portrait glows green and scales up** — an at-a-glance "who's speaking".
- Press the button again (now **🔇**, red) to switch the mic fully off.
- Headphones are strongly recommended to avoid echo. Microphone access requires `https://` or `localhost`.

## Initiative and combat

Press **INIT** on your card to set initiative:

![The initiative dialog: modifier, roll, or enter a physical die](img/initiative-modal.jpg)

- Drag the **Initiative Modifier** number left/right (or roll with it at 0), then **ROLL INITIATIVE**. The **server** throws the die, on the same generator the dice roller uses, and the result appears in the roll log for the whole table with your character's name on it. The dialog closes itself — there is nothing further to save.
- Or press **USE PHYSICAL DICE**, type the d20 you rolled at your real table, and press **SAVE**. That reaches the log too, badged **BY HAND** — see [Rolling real dice instead](#rolling-real-dice-instead), which works the same way everywhere else you roll.
- **The first initiative set starts combat** for the whole table: cards reorder by initiative, a **⚔️ Combat Active** banner appears with `Turn N of M`, and the current combatant's card wears a white ring in a gold glow (a DM's own card has a gold border of its own, so the ring is the cue, not the colour).

![Combat active: turn banner, turn controls, and the current character highlighted](img/combat-active.jpg)

- **◄ PREV / NEXT ►** advance the turn (any player can nudge it; a chime marks each turn change).
- On **your** turn, your card says **🎯 YOUR TURN**.
- Ending combat and clearing everyone's initiative are DM controls.

## Doors, fog, and what you can see

When the DM runs a built map (walls, doors, fog of war):

![A player's view with fog of war: you see what your character sees](img/player-fog-view.jpg)

- **Fog of war** hides everything your characters can't see. Vision radiates from **your own tokens** and is blocked by walls and closed doors — move, and your view moves with you.
- **Your token may have a sight limit.** The DM can give any token a radius in feet — a torch, darkvision, a blindfold — and beyond it you see nothing even down an open corridor. Unset means you see as far as the walls allow, which is how every table worked before. Ask your DM; there is no player control for it, by design (a limit only ever narrows what you can see, so being able to switch it off would just undo the dark).
- **Somewhere you have already been stays dimly lit.** Once your tokens have seen a patch of map it is remembered and drawn shaded rather than black, so you can find your way back through a dungeon you have explored. It is only a memory of the GROUND — anything that has wandered in since is still hidden, because the table never sent it to you. The memory is stored in your own browser, per table and per map, so it does not follow you to another device and clears when the DM publishes a different map.
- **Doors are clickable**: click to open or close (everyone hears the creak/slam). A small gold square marks a **locked** door — only the DM can open those.
- **Secret doors exist.** You won't see them until the DM reveals one — to you it's just wall.
- At night the whole map cools and darkens, and torches, braziers, and other glowing props cast light pools.

## The World Map

**🗺 WORLD** (on a phone, **⚒ TOOLS → World**) opens your campaign map: every place your party has actually discovered, in a tree, with **◀ you are here** on the one you are standing in.

![The world map: the places your party has discovered](img/player-world-map.jpg)

Places your DM has not revealed are not on it — and they are not hidden from it either, they were never sent to your browser at all.

Some maps have **🚪 door, stair or signpost sprites** on them — a way through to somewhere else. They are signposts, not buttons: your **DM** opens them, and when they do the whole table travels together. When you arrive somewhere new you will often find yourselves in a marked **entrance** — a dashed box just inside the door — which is simply where the party walks in.

## Look & feel

- **📺 CRT** — scanlines, bloom, and a monitor bezel for the full retro-dungeon experience. Purely local to you.
- **🔊 JUICE** — the game-feel panel: **Motion** (Full / Subtle / Off) for animations, plus sound mute and volume. HeroByte respects your OS "reduce motion" setting by default. Damage and healing float off cards and tokens as rising `-7` / `+4` numbers.

## Playing on a phone or tablet

Initiative and turns are desktop-only today: the phone's party screen shows no **INIT** badge, no order and no turn mark (your spend and the DM's Reset are still in each row's **⚙ EDIT**).

On a small or touch screen, HeroByte switches to a full-screen map with a five-button dock — no setup required:

|                                                                              |                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| ![Mobile layout: full-screen map with the bottom dock](img/mobile-table.jpg) | ![The mobile tools sheet](img/mobile-tools.jpg) |

- **◉ PARTY** — the party screen: portraits, HP (tap or drag to edit), status effects, and — on your own row — **⚙️ EDIT** for name, portrait, and DM mode.
- **⚒ TOOLS** — Move, Ping, Measure, Draw (opens the drawing sheet; Hide controls makes room on the map), Transform, Select, Snap, Recenter (re-centers the camera), CRT, and Help. Players also have World, plus Props when the DM allows players to add them.
- **⚂ DICE** — a full-screen roller; the result appears as a tap-to-dismiss card.
- **≡ Chat** — opens **Chat & Rolls** full screen for table messages, whispers, and dice history. **◇ VIEW** recenters the camera; if you're the DM, that slot reads **♛ DM** and opens the full DM menu — the same six tabs as the desktop window (Maps, World, NPCs & Monsters, Props & Objects, Players, Session) behind a swipeable chip row. Recenter in TOOLS covers the camera for a DM.

![The DM menu on a phone](img/mobile-dm.jpg)

Party and Chat & Rolls open as full screens: close them with the **✕**, or drag their title bar downward to flick them away.

![The mobile party screen](img/mobile-party.jpg)

To move a piece by steps on a phone: **TOOLS → □ Select**, tap the piece, and a d-pad appears in its sheet (hold a direction to walk; the map scrolls to keep the piece in view — the whole piece and its nameplate when the strip above the sheet has room, otherwise its top edge).

One finger pans, two fingers pinch-zoom. The game-feel settings and player-state files remain desktop-only; CRT is in TOOLS. DM map authoring also works on mobile — see [On a phone or tablet](map-editor-guide.md#on-a-phone-or-tablet) in the map editor guide.
