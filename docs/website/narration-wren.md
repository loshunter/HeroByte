# HeroByte lesson narration for Wren (Eleven v4)

> Pronunciation (2026-10-07): words the voice may misread are pinned with IPA between slashes, in quotes, as ElevenLabs documents for v4 (`"/ˈɪnɪt/"` for Init, `"/prɛv/"` for Prev, `"/koʊ diː ˈɛm/"` for co-DM), and explained in plain words the first time they are said. Screen labels that are abbreviations (ADV, DIS) are spelled out as letters with their meaning.

This is the narration from `video-scripts.md`, rewritten for ElevenLabs text-to-speech. Each chapter's **Say:** block
becomes one fenced `text` block below, ready to paste. The steps, their order, the facts and the on-screen names are the
same as in `video-scripts.md`; only the spelling of shorthand, the casing of button names and the delivery tags change,
plus a few short flavour lines, each listed under its block as "Added".

**Voice and settings (the same for every chapter):**

- **Voice:** Wren, `2yHLZxi5w5jF0qNJKXai` (a clone; her register is the sample in `site/narration/voices/wren-clone-source.txt`).
- **Model:** Eleven v4 (`eleven_v4`).
- **Stability:** 0.5. **Similarity:** 0.75.
- **One chapter per request.** Paste one block, brackets included. Every block is well under 2,000 characters.
- **2 or 3 takes per chapter.** Keep the best: the clearest button names, the tags read as delivery (never aloud, never
  as a sound effect), and the pace a viewer can click along to.
- If "HeroByte" is misread, v4 accepts IPA between slashes: `"/ˈhɪəroʊˌbaɪt/"` (see `narration-audition.md`).

The scripts themselves have not been walked through the running app yet (`video-scripts.md` says so). The "Check"
bullets repeat that file's "Unverified" notes where a chapter depends on them; if a check changes a label or a step,
change the narration here too.

## Rules applied

1. **Instructions unchanged.** Same steps, same order, same facts, same on-screen names. Nothing added, dropped or
   reworded except as below.
2. **Button names in normal case,** because v4 reads capitals as emphasis: "Press Enter Table", "open Build map, then
   press Start live map". No word is written in capitals for emphasis.
3. **Shorthand spelled as spoken:** d20 is "d twenty", 2d6 "two d six", Ctrl+Z / Ctrl+Y "Control Z" / "Control Y",
   WASD "W, A, S, D", HP "H P", NPC "N P C", CRT "C R T", ADD 5 NPCS "Add five N P Cs". ADV and DIS are said as
   "Advantage" and "Disadvantage". "DM" stays "DM". Emoji and arrows are dropped; no table code or link is read out.
4. **One opening tag per chapter,** always `[Warm, clear tutorial narration]`, so the delivery matches from chapter to
   chapter and video to video. After a change of delivery, the same tag starts the next paragraph of instructions to
   bring the read back.
5. **Flavour, sparingly, in Wren's register:**
   - a short in-world line at the start of most videos (the DM 3 opening already has it, so it gets none);
   - each video's "common mistake" (from `video-scripts.md`) gets a dry or sarcastic beat in the chapter that shows it,
     either a tag on the source sentence or one short added line;
   - `[lower, conspiratorial]` or `[whispering]` on a tip or a hidden thing, at most twice per video;
   - at most one change of delivery per paragraph; the instructions stay in the tutorial delivery.
6. **Pauses come from structure:** each source line is its own paragraph; ellipses mark the few held beats. No SSML or
   `<break>` tags.
7. **Lengths stay close to the source.** Flavour adds at most about one sentence per chapter.

Under each block: "Added" lists every line that is not in `video-scripts.md`; "Check" lists what to confirm in the running
app before recording that chapter.

---

## Player quick start: Your first session as a player

### 1. Get in

```text
[Warm, clear tutorial narration] Every adventure starts with getting through the door.

Your DM sends you two things: a link, and a password. They come separately. [Pause, dry amusement] The link never carries the password.

[Warm, clear tutorial narration] Open the link. Check the Connection status line. It should say Connected.

Type the table password. Passwords are case-sensitive.

Press Enter Table.
```

- Added: "Every adventure starts with getting through the door."

### 2. Find yourself

```text
[Warm, clear tutorial narration] This is your token. Your character has a row in the Party at the bottom. Your row reads "You."

Lost your token? Press the target button on your row. The map jumps to it.

Select your row to open your character card.

Click your name to rename your character.

Click a number in H P to type a new value, or drag along the bar.
```

### 3. Move

```text
[Warm, clear tutorial narration] Drag your token to move it. Turn Snap on and it clicks to the grid.

Everyone sees the new spot when you let go.

You can also step with W, A, S, D or the arrow keys. One press, one cell.

On a phone, open Tools, then Select. Tap your token, and use the d-pad.
```

### 4. Roll

```text
[Warm, clear tutorial narration] Press Dice to open the roller.

Click a die to add it to the tray. Click again for more of the same.

Add a modifier chip if you need one.

Pick Normal, A D V for advantage, or D I S for disadvantage. Then pick who sees it: the table, the DM, or only you.

Press Roll.

For a quick d twenty, use the Roll now row. One press, one roll.

Rolling real dice at the table? Press I Rolled It, and type what you got. The log marks it "by hand."
```

---

## DM quick start: Set up your table before game night

### 1. Make a table

```text
[Warm, clear tutorial narration] Every campaign needs somewhere to happen.

Real games live on a private table. It has its own passwords, and it is never cleared automatically.

Press New Table. Give it a name you'll recognise.

Choose a table password. Your players type this one.

Choose a DM password too. Whoever knows it can run the table.

Press Create Private Table.
```

- Added: "Every campaign needs somewhere to happen." (from the audition)

### 2. Claim the DM seat

```text
[Warm, clear tutorial narration] You arrive as an ordinary player. This card offers two next steps. Nothing on it happens by itself.

Press Enter DM mode, and type your DM password.

You can also do this any time from the Table button, top left.
```

### 3. Put a map down

```text
[Warm, clear tutorial narration] There are three ways to get a map on the table.

If you have a map image, upload it in the DM Menu, under Maps. Lesson three covers that.

To build one here, open Build map and press Start live map.

Press Escape to leave the editor. The map stays live.

[lower, conspiratorial] And the third way... [soft chuckle] is the fun one.

[Quick, light, playful pace] Now press G. That's the Kicked-In Door. Pick a recipe, press Generate and enter, and HeroByte builds a stocked place and moves the table there.
```

- Added: "And the third way... is the fun one." (from the audition)
- Check: whether G needs keyboard focus on the map first, and whether it works with the build palette open.

### 4. Send the invite

```text
[Warm, clear tutorial narration] Now Invite players works, because you are the DM. It copies the link.

Later, find it in the DM Menu, under Table, then Invite.

Send the password separately. The link does not carry it.

[mischievously] Unless you enjoy answering "what's the password?" for the next ten minutes. [sigh]
```

- Added: "Unless you enjoy answering "what's the password?" for the next ten minutes." (from the audition)
- Check: what the invite link opens on the player's side (the join screen with that table already chosen?).

### 5. See what they see

```text
[Warm, clear tutorial narration] Press Player view. You now see exactly what players see: fog from the party's vision, secret doors hidden.

You keep every DM power. Press it again to switch back.

Player view is on the computer layout.
```

- Check: what Player view shows when no player is at the table yet.
- Check: that Player view is absent from the phone layout.

---

## Player path 1: Join a table

### 1. The join screen

```text
[Warm, clear tutorial narration] Before the dice come out, you have to get in.

Use Chrome, Edge or Firefox on a computer. Phones get their own touch layout.

First, the Connection status line. It should say Connected.

Type the table password and press Enter Table.

Get it wrong and the error shows in red. What you typed stays in the field, so you can spot the typo. [Pause, dry amusement] Passwords are case-sensitive.

[Warm, clear tutorial narration] On a built map, the view starts on your token.
```

- Added: "Before the dice come out, you have to get in."

### 2. Switching tables, codes, forgetting

```text
[Warm, clear tutorial narration] Belong to more than one table? A Table picker appears above the password. Choose the table, type its password, enter.

Have a code instead of a link? Paste it under Join by code, and press Join.

Forget this table drops a private table from this browser's list. You'll need its code to get back.

Your browser remembers up to twelve tables. [lower, conspiratorial] The server publishes no list of tables, so keep your codes.
```

### 3. It remembers you

```text
[Warm, clear tutorial narration] The password is stored for that table in this tab, so a reload drops you straight back in.

If your connection blips, HeroByte reconnects for you. You'll see Reconnecting, then Re-authenticating, under the header.

For up to six hours, a reload or a blip brings you back as the same person.
```

### 4. One tab, one device

```text
[Warm, clear tutorial narration] One live connection per device. Open the same table in a second tab and the older tab pauses. Press Reclaim this tab to switch back.

Open it on a different device while the first is still connected, and you'll see Held in another window. Your seat is kept for the first device.

If the first device is gone and this browser can't get back in, try again once. If it still fails, Start a fresh session appears.

[measured, serious] That makes you a new player. You can't get back into your old character. Use it as a last resort.
```

- Check: the exact wording of the "open in another tab" notice (the guides quote only Reclaim this tab).
- Check: how to trigger Held in another window and Start a fresh session on camera without losing a real seat.

### 5. The Main Hall

```text
[Warm, clear tutorial narration] Every server starts with one table, the Main Hall. It's a public test table.

Its passwords are fixed, and by default it wipes itself after an hour with nobody in it.

You'll see the public test table marker at the top while you're there. Build freely, but don't keep anything there.
```

---

## Player path 2: The table at a glance

### 1. Toolbar, map, Party

```text
[Warm, clear tutorial narration] A quick tour of the table, before anything tries to eat you.

Tools and toggles run along the top. Hover any button for a tooltip.

Tools take turns. Picking one turns the last one off. Click the active tool again to turn it off.

The map is shared. Everything on it syncs to every player.

The Party at the bottom has a row for every character: the party, the DM's, and any N P Cs you can see.

Cards shows every card at once. Roster goes back to rows. Hide party folds it down.

The bar also holds World, and Props when your DM allows it.
```

- Added: "A quick tour of the table, before anything tries to eat you."

### 2. The Table menu

```text
[Warm, clear tutorial narration] Top left is the Table button. It shows the table's name, and a dot for your connection: green online, red offline.

It opens a menu about the table and about you. Your role is here.

Preferences are yours alone. C R T adds scanlines and a monitor frame. Sound and motion controls animation, sound effects and volume.
```

### 3. Moving around the map

```text
[Warm, clear tutorial narration] Drag empty map space to pan. Middle-mouse drag works even with a tool active.

The wheel zooms toward your cursor.

Reset puts the view at the map's top-left corner at normal zoom. [Pause, dry amusement] It's not the middle of the map. Or, sadly, your token.

[Warm, clear tutorial narration] To find your token, press the target on your row.
```

- Added: "Or, sadly, your token." (the common-mistake beat; the source's caption says Reset is the top-left corner, the target is your token)

### 4. Chat and whispers

```text
[Warm, clear tutorial narration] Open Chat and Rolls, then Chat.

Choose Everyone for table talk, or Whisper to someone for a private message. Press Send or Enter.

[lower, conspiratorial] Being the DM doesn't let anyone read other players' whispers.
```

### 5. Voice

```text
[Warm, clear tutorial narration] Voice works like joining a call. Press Join voice. Allow the microphone when your browser asks.

Before you join, you can see whether a call is running and how many are in it.

Mute keeps you in the call. You still hear everyone. Leave voice hangs up.

When someone talks, their portrait glows green and grows.

Wear headphones. It stops echo.
```

- Check: where Join voice, the call count, Mute / Unmute and Leave voice sit on screen now (every guide screenshot predates the new voice controls).
- Check: whether the header's Panels and settings row is labelled on screen.
- Check: the exact text of Mute / Unmute (the card's mic button shows a mic while live and a red muted mic while muted).

### 6. On a phone

```text
[Warm, clear tutorial narration] On a phone the map fills the screen, with a dock of five buttons.

Party, Tools, Dice, Chat, and Reset.

Party and Chat open full screen. Close them with the X, or drag the title bar down.

Voice is at the top of Party.
```

---

## Player path 3: Your character card

### 1. Open your card

```text
[Warm, clear tutorial narration] Every hero needs a name, a face, and a place to count the bruises.

The Party lists characters, not players. Select your row and your card opens beside the rows.

X or Escape closes it. Select another row to switch.
```

- Added: "Every hero needs a name, a face, and a place to count the bruises."

### 2. Name, HP and temp HP

```text
[Warm, clear tutorial narration] Click the name to edit it.

Click either H P number to type a new value. Enter or click away saves.

Or drag along the bar. It goes green, amber, red as you drop.

Temp H P is a separate pool. It's used up before regular H P.

The sword button centres the map on this character's token.
```

### 3. The settings window

```text
[Warm, clear tutorial narration] The gear opens your full settings. One window per character.

Upload a portrait from your computer. On a phone, that's your camera roll.

Give your token its own image too. Clear goes back to a coloured ring.

Status Effects is a checklist of conditions. Up to three show on your portrait and token. The rest roll into a plus bubble.
```

### 4. Your token

```text
[Warm, clear tutorial narration] Token Size runs from Tiny to Gargantuan.

Every token wears its name and, when you're allowed the numbers, a thin health bar.

Double-click your token for a new random colour.

With Transform, click a token for scale and rotate handles.

A lock badge means the DM pinned it. No one can move it until they unlock it.
```

- Check: whether double-click recolour works on a token that has a custom image.

### 5. Save, load, add a character

```text
[Warm, clear tutorial narration] Save character downloads this character to a file. Load character brings it back, here or at another table.

It's one character, never the whole table.

[Pause, dry amusement] One warning. A file with drawings replaces the drawings you have on the map.

[Warm, clear tutorial narration] Add Character gives you a second one, with its own row, card, token and H P.
```

- Added: "One warning. A file with drawings replaces the drawings you have on the map." The second sentence is the source's common-mistake caption, which says "Say it; no need to perform it"; it was not in the Say block.

### 6. On a phone

```text
[Warm, clear tutorial narration] On a phone, open Party. Tap or drag your own H P to edit it.

Edit holds the name, portrait, token size, Add Character, and the character file.
```

---

## Player path 4: Roll dice

### 1. Build and roll

```text
[Warm, clear tutorial narration] Sooner or later, everything comes down to the dice.

Press Dice for the roller. Chat and Rolls holds the history.

Click dice to add them to the tray. Nothing rolls yet. Click again for more of the same.

Click the count badge to type an exact number.

Add a plus one or minus one chip. Click a chip to type any value.

Press Roll. Each die shows, then the total.

A natural twenty gets a critical banner.

[Pause, dry amusement] A natural one, a fumble.
```

- Added: "Sooner or later, everything comes down to the dice."

### 2. Advantage and who sees it

```text
[Warm, clear tutorial narration] Advantage rolls the first die twice and keeps the higher. Disadvantage keeps the lower. The other die stays, struck through.

Table means everyone. DM means you and the DM. Me means only you.

The line under the buttons says who will see it. [Pause, dry amusement] A natural twenty only you can see is a very lonely natural twenty.

[lower, conspiratorial] A hidden roll is never sent to anyone else. Their browser has no copy.
```

- Added: "A natural twenty only you can see is a very lonely natural twenty." (the common-mistake beat: rolling with Me selected)

### 3. Quick rolls and macros

```text
[Warm, clear tutorial narration] The Roll now row rolls straight away: d twenty, advantage, disadvantage and two d six.

Build any roll and press Save to name it and keep it.

Saved rolls live in this browser. They don't follow you to another device.
```

### 4. Rolling real dice

```text
[Warm, clear tutorial narration] Rolling physical dice? Press I Rolled It and type the total. The tray can be empty.

Already rolled in the app, but the real dice said something else? Press That's Not What I Rolled.

Either way the log marks it "by hand," and keeps the app's number struck through.

[lower, conspiratorial] Your DM can turn hand entry off.
```

### 5. Initiative

```text
[Warm, clear tutorial narration] Press "/ˈɪnɪt/" on your card. "/ˈɪnɪt/" is short for initiative: you roll it to find your place in the coming battle.

Set your modifier, then press Roll d twenty now. The server rolls it, and it lands in the log with your name.

Or press Enter a roll by hand, and type your real d twenty.

If no fight is running, setting initiative starts combat for the whole table.

"/prɛv/" and Next move the turn. "/prɛv/" means previous: it steps the turn back one. On your turn, your card says Your Turn.
```

- Check: the DM ends combat after this chapter; reset before the next take so the "no fight is running" note shows again.

### 6. On a phone

```text
[Warm, clear tutorial narration] On a phone, Dice opens a full-screen roller. Tap the result card to dismiss it.

Initiative is "/ˈɪnɪt/" on your row in Party.
```

---

## Player path 5: Draw, measure and ping

### 1. Draw

```text
[Warm, clear tutorial narration] Every battle plan needs a picture, or at least a very confident arrow.

Press Draw. The toolbox runs Tool, then Settings, then History.

Pick Freehand, Line, Rectangle or Circle. Rectangle and Circle can be filled.

Settings has colour, stroke width and opacity.

A drawing reaches everyone when you finish the stroke.

Press Move in the header to put the toolbox away.
```

- Added: "Every battle plan needs a picture, or at least a very confident arrow."

### 2. Undo and erase

```text
[Warm, clear tutorial narration] Undo and redo affect only your own drawings. Control Z and Control Y work while Draw is on.

Erase drawings cuts through a freehand line. [Pause, dry amusement] Other shapes go whole. All of it. At once.

[Warm, clear tutorial narration] You can erase your own drawings, and old ones with no owner. The DM can remove anyone's.
```

- Added: "All of it. At once." (the common-mistake beat: a whole shape erased)

### 3. Area templates

```text
[Warm, clear tutorial narration] For spells, use the area templates: Burst, Cone, Cube and Bolt.

Drag out from the point of origin. It snaps to whole squares.

When you let go it's labelled with its size, like fifteen foot cone. Everyone sees it. [Pause, dry amusement] Including whoever is standing in it.
```

- Added: "Including whoever is standing in it."

### 4. Measure

```text
[Warm, clear tutorial narration] Press Measure. Click a start point, and a line follows your cursor with the distance.

Click again to freeze it. A third click starts fresh.

The whole table sees your line while you draw it, with your name on it.

Distance follows the table's diagonal rule, set by the DM.
```

### 5. Ping

```text
[Warm, clear tutorial narration] Ping plants a coloured burst with your name, for three seconds, with a chime.

You can also double-click empty map space, in any tool.
```

### 6. On a phone

```text
[Warm, clear tutorial narration] On a phone, open Tools, then Draw. Hide controls makes room on the map. Your tool stays on.

The small row keeps undo, redo, cancel and done.

Double-tap empty map to ping.
```

---

## Player path 6: Fog, doors and what you can see

### 1. Fog follows your tokens

```text
[Warm, clear tutorial narration] The dark is where all the interesting things hide.

When your DM runs a built map, fog of war hides what your characters can't see.

Vision comes from your own tokens. Walls and closed doors block it.

Move, and your view moves with you.
```

- Added: "The dark is where all the interesting things hide."

### 2. Sight limits

```text
[Warm, clear tutorial narration] Your DM can give a token a sight limit, like a torch or darkvision.

Past it you see nothing, even down an open corridor.

There's no player control for this. Ask your DM. [Pause, dry amusement] Nicely.
```

- Added: "Nicely."

### 3. Places you have been

```text
[Warm, clear tutorial narration] Somewhere you've already seen stays dimly lit, so you can find your way back.

[lower, conspiratorial] It's only a memory of the ground. Anything that walked in since is still hidden.

[Pause, dry amusement] Dim means remembered. Not safe.

[Warm, clear tutorial narration] The memory lives in your browser, for this table and this map.
```

- Added: "Dim means remembered. Not safe." (the common-mistake beat; the source's caption is "Dim means remembered, not seen")

### 4. Doors

```text
[Warm, clear tutorial narration] Click a door to open or close it. Everyone hears it.

A small gold square marks a locked door. Only the DM can open those.

[whispering] Secret doors exist. Until the DM reveals one, it's a wall to you.

[Warm, clear tutorial narration] At night the map darkens, and torches and braziers cast light.
```

- Check: what a player sees and hears when clicking a locked door (the map editor guide says players get "Door is locked"; check where it appears).
- Check: how the DM sets a door to Locked or Secret on the desktop, for the setup (see DM 5's note on Inspect versus Properties).

### 5. The world map

```text
[Warm, clear tutorial narration] World opens your campaign map: every place your party has found.

"You are here" marks where you're standing.

Door and stair sprites on a map lead somewhere else. Your DM opens them, and the whole table travels together.
```

---

## DM path 1: Create a private table

### 1. Main Hall or private table

```text
[Warm, clear tutorial narration] Every campaign needs a home.

Every server starts with the Main Hall. It's a public test table. Its passwords are fixed, and it wipes itself after an hour empty.

For a real game, make a private table. It has its own passwords, and it's never cleared automatically.

Anyone can make one. You don't need to be a DM.
```

- Added: "Every campaign needs a home."

### 2. The NEW TABLE form

```text
[Warm, clear tutorial narration] Press New Table.

A name helps you find it in your list later.

The table password is what your players type. Six characters or more.

The DM password is optional, eight or more. [lower, conspiratorial] If you skip it, the first person to enter DM mode sets it.

[Warm, clear tutorial narration] Press Create Private Table. You get a random table code, and you arrive as an ordinary player.
```

- Check: where the DM password is changed later (the guide says not in Security; it is set at creation or by the first DM).

### 3. Finding it again

```text
[Warm, clear tutorial narration] Back on the join screen, the Table picker lists your tables by name.

Your browser remembers up to twelve. The server keeps no public list, so note your table's code.

Forget this table removes it from this browser. You'll need the code to return.
```

### 4. Keeping a Main Hall build

```text
[Warm, clear tutorial narration] Built something good on the Main Hall? Copy it to a table of your own.

In the DM Menu, open Table, then Security, then Save as a Private Table.

Give it a name and passwords, and press Save and Go There.

Everything comes across: the map, tokens, N P Cs, drawings and images. The Main Hall carries on as before.
```

- Check: the exact label of Save and Go There (the DM guide writes "SAVE & GO THERE", Getting Started writes "Save & Go There").

### 5. Changing the password

```text
[Warm, clear tutorial narration] On a private table, Security has Change table password. People already in stay. New joiners need the new one.

Change it if a code leaks, or after a one-shot.

Reset to default gives your table the Main Hall's password. Anyone with your code could join. [Pause, dry amusement] Don't use it to tidy up.

[sarcastic] Sure, it looks tidier. It also leaves your front door wide open.
```

- Added: "Sure, it looks tidier. It also leaves your front door wide open." (the common-mistake beat: Reset to default as a tidy-up)

---

## DM path 2: Become the DM and invite players

### 1. Enter DM mode

```text
[Warm, clear tutorial narration] Someone has to sit behind the screen, and today it's you.

DM mode belongs to the table, not a character. It's in the Table menu.

Press the Table button, top left. Under Your role, press Enter DM mode, and type the DM password.

A wrong password keeps the dialog open, with the reason, and you stay a player.

After five wrong tries, the server locks it for fifteen seconds.
```

- Added: "Someone has to sit behind the screen, and today it's you."

### 2. First DM on a new table

```text
[Warm, clear tutorial narration] This table was made without a DM password. So the first try offers to set one.

You become the DM the moment it's saved.
```

- Check: the exact wording and buttons of the first-time DM password prompt.

### 3. What you get

```text
[Warm, clear tutorial narration] Two new buttons in the header: Build map, the live editor, and Player view.

The DM Menu sits at the right of the Party bar. It has six tabs.

On a phone, the dock's Reset slot becomes DM.

The Table menu now has Table settings, which opens the DM Menu on its Table tab.
```

### 4. Invite players

```text
[Warm, clear tutorial narration] Invite players on the next-steps card stays greyed until you've been the DM. [Pause, dry amusement] Clicking it harder doesn't help.

[Warm, clear tutorial narration] Now it works.

Any time later, DM Menu, Table, Invite. You'll see the table's code and Copy invite link.

The link carries no password, on purpose. Send the password another way.

On a plain local network address, the browser blocks copying, so the link shows in a box to copy by hand.
```

- Added: "Clicking it harder doesn't help." (the common-mistake beat: inviting before claiming the seat)
- Check: whether the next-steps card survives the DM-mode change and stays usable for this chapter.

### 5. Who is at the table

```text
[Warm, clear tutorial narration] Players at this table lists everyone who has joined, with a token count.

Select All grabs every token a player owns.

Remove appears on a player who isn't at the table. It clears their seat, characters and tokens. [measured, serious] There's no undo.

[Warm, clear tutorial narration] It's not a ban. The password still lets them back in, as a new player.
```

- Check: how long to wait before Remove appears for a departed seat (a login screen left open counts as present for five minutes).

### 6. Stepping down, co-DMs

```text
[Warm, clear tutorial narration] Leave DM mode steps you back to player. You keep your character. The password brings the tools back.

[lower, conspiratorial] Share the DM password with a "/koʊ diː ˈɛm/", a second Dungeon Master, and you can both hold DM powers.
```

---

## DM path 3: Three ways to get a map on the table

### 1. Which one, right now?

```text
[Warm, clear tutorial narration] There are three ways to get a map down. Bring your own art. Build it here. Or kick in a door and let HeroByte make one.

You can switch between them mid-session.

One rule ties them together. Fog and the Kicked-In Door need a live map. [Pause, dry amusement] A picture on its own isn't one. However lovely it is.
```

- Added: "However lovely it is." (the common-mistake beat: fog on an uploaded image)

### 2. A: a map you already have

```text
[Warm, clear tutorial narration] Open the DM Menu, then Maps. Everything here is under Current table map.

Under Map Background, upload your image. It's stored with your table.

You can paste a link instead, but the image's host must allow it. If nothing appears, download it and upload.

Now match the grid. Open Advanced, then the Grid Alignment Wizard, and press Start Alignment.

Click two opposite corners of one square on the image. Press Apply Alignment.

Set Square Size in feet. Then lock the map, so nobody drags it mid-fight.
```

### 3. B: build it here

```text
[Warm, clear tutorial narration] For a scene that matters, build it. Walls block sight, doors open, fog reveals the room.

Open Build map and press Start live map. The live badge lights up.

Lesson four builds a room from here.
```

### 4. C: kick in a door

```text
[Warm, clear tutorial narration] The party goes somewhere you never prepped. [Pause, dry amusement] They always do.

[Quick, light, playful pace] Press G.

[Warm, clear tutorial narration] The panel has a name already filled in. Type a better one if you like.

Pick the recipe. Dungeon, or a building: a tavern, shop, warehouse or house. Pick a size.

Press Generate and enter, or Enter. Reroll only changes the seed.

[Gradually building energy] Seconds later the whole table is somewhere new. Fog is on, and the party stands inside the entrance.

[Warm, clear tutorial narration] A door sprite leads back. Click it, confirm, and the old scene comes back as you left it.
```

- Added: "They always do." (from the audition)
- Check: whether G needs keyboard focus on the map first (see the DM quick start note).

### 5. Mixing them

```text
[Warm, clear tutorial narration] Want fog on your own art? Upload it, start a live map, and draw only walls and doors over it.

[lower, conspiratorial] Walls are invisible to players, so your art shows through.

[Warm, clear tutorial narration] A kicked-in place is an ordinary map. Stay in the editor and change it.

Every map can join your campaign tree on the World tab.
```

- Check: whether the uploaded background stays under a live map started on top of it, and how it looks.

---

## DM path 4: Build your first room live

### 1. Start a live map

```text
[Warm, clear tutorial narration] Every dungeon starts with one room.

The map editor runs on the live table. Players see each edit the moment you make it.

Press Build map, then Start live map.

That makes a fresh map and binds it to the table. The live badge lights up.

You'll see "saving" flicker beside it as each edit lands.

The tools are grouped: Terrain, Structures, Objects, Lighting and Generate.
```

- Added: "Every dungeon starts with one room."

### 2. Pick a floor and walls

```text
[Warm, clear tutorial narration] In Structures, pick Room.

The brush deck picks the floor. Choose a shelf, or search by name.

Wall ring picks the wall style: none, stone, brick, timber or dark.

None leaves the wall band unpainted, but the room still blocks sight.
```

- Check: the exact name of the floor shown (pick it in rehearsal from the 34 families).

### 3. Drag out the room

```text
[Warm, clear tutorial narration] Drag a rectangle. The preview shows the real floor, and a size in cells.

Let go. You get floor, a wall band, and blocking walls all round.

That whole room is one step to undo.
```

### 4. Undo, redo and Escape

```text
[Warm, clear tutorial narration] Undo map and Redo map sit above the settings. Control Z and Control Y work too.

Each drag is one step.

Mid-drag, Escape cancels it. Press Escape again, with nothing in progress, to leave the editor.

The map stays live. Open Build map again and you carry on.

One edit goes at a time. If you draw while the last one is still saving, you'll see "Still saving the last change." Draw it again. Nothing was half-applied.

[Pause, dry amusement] Think of it as building one brick at a time.
```

- Added: "Think of it as building one brick at a time." (the common-mistake beat: drawing faster than the server confirms)
- Check: how to trigger "Still saving the last change" on camera reliably (the guide says it is most noticeable on a phone).

### 5. What your players see

```text
[Warm, clear tutorial narration] Here's the player's screen. The room appeared as you built it.

Players don't see walls. They act through fog and movement.

To check from your side, press Player view. You keep building while it's on.
```

---

## DM path 5: Walls, doors and fog

### 1. Walls

```text
[Warm, clear tutorial narration] Good walls make good secrets.

Wall draws one straight blocking wall. Drag from point to point.

Players never see walls. They stop movement and sight.

While you edit, walls show as a see-through overlay. Pin walls overlay keeps it after you leave.
```

- Added: "Good walls make good secrets."

### 2. Doors

```text
[Warm, clear tutorial narration] Door: drag across a wall. The drag sets its length and angle.

Doors start closed.

At the table, anyone can click a door to open or close it.
```

### 3. Locked and secret

```text
[Warm, clear tutorial narration] To change a door, pick it with Select, and open Inspect.

Closed, Open, Locked or Secret.

A locked door says it's locked to players. You can still open it.

[whispering] A secret door is invisible to players. You see it as a dashed seam.

[Warm, clear tutorial narration] At the table, Alt click a door to cycle its lock. Alt click a secret door to reveal it.
```

- Check: on the desktop, whether door state is set in Inspect or in Properties with Save changes; if it is Properties, the first line changes.

### 4. Turn on fog

```text
[Warm, clear tutorial narration] Fog of War is in the DM Menu, under Maps. It needs a built map with walls and doors.

Players then see only what their tokens see. You still see everything.

[lower, conspiratorial] Things outside a player's sight are never sent to them.
```

### 5. Make it dark

```text
[Warm, clear tutorial narration] Table Sight Default sets how far every token sees. Set thirty feet and a corridor becomes something to walk down.

A single token can have its own Sight Radius, in its Token settings. Darkvision, a torch, or Blind.

[Pause, dry amusement] A token you set yourself always wins over the table default.
```

- Check: the exact preset labels in the Table Sight Default control (the guide names 30 ft and Unlimited).

### 6. Check it

```text
[Warm, clear tutorial narration] Player view shows the table through the party's eyes. Fog, hidden doors, no DM overlays.

Use it while you prep. It's the difference between "I think that's hidden"... [Pause, dry amusement] and "it is."
```

---

## DM path 6: NPCs and the token library

### 1. Add an NPC

```text
[Warm, clear tutorial narration] A world is only as good as the things living in it.

Open the DM Menu, then N P Cs and Monsters. Press Add N P C.

Each N P C has a name, H P, temp H P, an initiative modifier, a portrait and token art.

Players can't rename, damage or move your N P Cs.
```

- Added: "A world is only as good as the things living in it."

### 2. Place it and find it

```text
[Warm, clear tutorial narration] Place on Map drops its token at the map's top-left corner. [Pause, dry amusement] Not the middle of your view. It hasn't vanished. It's sulking in the corner.

[Warm, clear tutorial narration] Press Focus to jump to it, then drag it where you want.

Pressing Place again moves it back to the corner as a fresh token. It doesn't add a second one.
```

- Added: "It hasn't vanished. It's sulking in the corner." (the common-mistake beat: looking for the token mid-screen)

### 3. A pack at once

```text
[Warm, clear tutorial narration] Set the number field to five, and the button says Add five N P Cs. Five arrive, numbered.

A second batch carries on the numbering. It doesn't repeat it.

Duplicate copies one N P C: H P, art, size, stance. It takes the next free number.
```

### 4. The library

```text
[Warm, clear tutorial narration] Library opens the bundled pack: two hundred and forty-four tokens, monsters and townsfolk.

Narrow it with Monsters or Townsfolk, then Family.

Search matches every word. "Goblin archer" finds goblin archers.

Click a token and it arrives as a new N P C, with its name, art and portrait filled in, at the right size.

The number field works here too.
```

- Check: whether a library pick places its token on the map straight away or still needs Place on Map.
- Check: the exact name of a goblin archer token, and that "goblin archer" returns it.

### 5. Hide, stance and mimics

```text
[Warm, clear tutorial narration] Select an N P C's row for its card. The eye hides it from players. [lower, conspiratorial] Prep an ambush hidden, reveal it on the pounce.

[Warm, clear tutorial narration] Stance is Enemy, Neutral or Ally. It sets the card's colour. Players see it.

Mimics come in pairs. Place the closed chest. When they touch it... [soft chuckle] press Reveal Mimic.
```

- Check: the exact name of the mimic chest in the library.
- Check: where the Stance select is (the guide says "in the DM menu").

### 6. Your own tokens

```text
[Warm, clear tutorial narration] The This Table shelf holds your own tokens. Add your own, from your computer or an image link.

Give it a name, tags and a stance, and it searches like the pack's tokens.

[lower, conspiratorial] Players never receive the shelf.
```

---

## DM path 7: Run your first combat

### 1. The Encounter tab

```text
[Warm, clear tutorial narration] Steel is drawn, and the dice are out.

Fights live in the DM Menu, under Encounter. Prepare, roll, run and end, all here.

Setup lists everyone who can fight: In the order, and Not rolled yet.

Monster H P players see: Exact, Bloodied, or Hidden. The server enforces it.
```

- Added: "Steel is drawn, and the dice are out."

### 2. Players roll first

```text
[Warm, clear tutorial narration] Watch one thing. Any initiative saved while no fight is running starts combat, on that character's turn.

Your players press "/ˈɪnɪt/", short for initiative, on their card, and roll for their place in the battle.

The first one to roll starts the fight.
```

### 3. Roll the NPCs

```text
[Warm, clear tutorial narration] Roll missing N P C initiative rolls a d twenty plus modifier for every N P C that has none.

Each gets its own line in the log. [lower, conspiratorial] A hidden N P C rolls into your log only.

[Warm, clear tutorial narration] Players may type rolls by hand if your table allows it. The line here says which.
```

### 4. Start at the top

```text
[Warm, clear tutorial narration] The turn is with whoever rolled first, not the highest roll. [Pause, dry amusement] Yes, even if that was a goblin.

[Warm, clear tutorial narration] Encounter shows a note when the turn isn't at the top.

Press Start at top of order. It moves the turn there, starts the round over and refills movement.
```

- Added: "Yes, even if that was a goblin." (the common-mistake beat: the fight starting on the first goblin rolled)
- Check: the exact text of the Encounter note that the turn is not at the top.

### 5. Running turns

```text
[Warm, clear tutorial narration] Next and "/prɛv/", for previous, move the turn. A chime marks each change. Anyone can press them.

The status line reads Turn, the number, and whose turn it is.

On a token's plate, its movement left this turn. Overspend and it turns red. Nothing is refused.

With monster H P on Bloodied, players see a red dot, not numbers.
```

- Check: where the movement Reset appears during the fight (the guide: in the character's settings, during combat or after spending movement).

### 6. End the fight

```text
[Warm, clear tutorial narration] End combat stops the fight and keeps every initiative on file.

That means the next initiative anyone saves starts a new fight.

Clear all initiative empties the order.
```

---

## DM path 8: Backups and keeping your work

### 1. Three kinds of file

```text
[Warm, clear tutorial narration] Campaigns take months to build and one bad afternoon to lose.

HeroByte makes three kinds of file, and each picker tells you which it was handed.

A table backup is the whole table. It's in the DM Menu, under Table.

A character file is one character. It's in that character's settings.

An editable map is one map. It's under Maps, in the map library.
```

- Added: "Campaigns take months to build and one bad afternoon to lose."

### 2. Download a table backup

```text
[Warm, clear tutorial narration] Download table backup saves the entire table as one file. Tokens, characters, N P Cs, props, drawings, dice history, the live map, and uploaded images.

Private rolls and whispers are left out.

[lower, conspiratorial] It still holds secret doors, hidden N P Cs and your notes.

[Pause, dry amusement] Keep it to yourself.
```

- Check: what the download looks like in the recording browser (save dialog or straight to the downloads folder), and that it does not reveal a personal folder path.
- Check: the exact wording of the two sizes Download table backup reports.

### 3. Restore one

```text
[Warm, clear tutorial narration] Restore table backup replaces the table for everyone connected. Read the confirmation.

The map, N P Cs, props, drawings and settings become the file's.

Players keep their own characters and tokens. Nobody's DM status changes.

Hand it the wrong kind of file and it says so, by name, and loads nothing.
```

### 4. How big a campaign can get

```text
[Warm, clear tutorial narration] A backup has to restore in one go, so a table has a size limit.

The line beside the map list says where you are: Room for more maps, Nearly full, Full, or Too big to restore.

Its tooltip shows the exact size. Delete a map you're done with to make room.
```

### 5. Habits that save campaigns

```text
[Warm, clear tutorial narration] Download a backup at the end of every session. Name it by date.

Download one before anything risky, like mass deleting.

On free hosting, the server's disk can reset. The file in your downloads is what you can count on.

Building on the Main Hall? Save it as a private table before it clears. DM lesson one shows how.
```
