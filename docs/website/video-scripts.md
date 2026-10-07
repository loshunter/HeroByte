# HeroByte help center: video scripts and shot lists

This file is the plan for recording the help center's video lessons. Each lesson has a video and a written version; this covers the videos. There are 16: two quick starts, six player lessons and eight DM lessons. For each one it gives the audience, a target length, the setup before recording, chapters with start times, narration, a shot list, one common mistake worth showing, and a thumbnail.

It was drafted from the user guides in `docs/user-guide/` on 2026-10-06. Every label and step comes from those guides. It has not been checked against the running app. **Walk each video through the running app before recording it**, and clear the "Unverified" notes as you go. The guide screenshots in `docs/user-guide/img/` were taken before the new voice controls, so any thumbnail that shows the header or a character card may show the old mic controls.

How to read a script:

- **Say:** spoken narration. Short sentences, plain words.
- **Show:** the shot list, in order. `[Phone]` marks a phone shot. `Caption:` is on-screen text. `Zoom:` means punch in or highlight that area in the edit.
- Start times are approximate and assume a steady pace with short pauses.

---

## Recording setup

### What already exists: the screenshot harness

Every image in the user guide comes from one command, run from the repo root:

```bash
pnpm docs:screenshots
```

Here is what that does, step by step.

1. **`package.json`** maps it to `node scripts/run-e2e.mjs --config playwright.docs.config.ts`.
2. **`scripts/run-e2e.mjs`** picks the isolated e2e ports (client `127.0.0.1:5175`, server `127.0.0.1:8788`, each overridable with `E2E_PORT` / `E2E_WS_PORT` / `E2E_HOST` / `E2E_WS_HOST`). It checks that both ports are free with `scripts/dev-port-preflight.mjs ensure-free` (skipped when `E2E_REUSE_EXISTING_SERVER=true`). Then it runs `pnpm exec playwright test --config playwright.docs.config.ts`.
3. **`playwright.docs.config.ts`** spreads the normal `playwright.config.ts` and changes three things: `testMatch: /docs-screenshots\..+\.ts$/` (these files are not `*.spec.ts`, so `pnpm test:e2e` never runs them), a 180 s timeout per test, and no retries.
4. **`playwright.config.ts`** (inherited) starts two web servers:
   - `apps/e2e/prepare-state.mjs` wipes the e2e state file, the e2e map store, the e2e asset directory (`apps/server/herobyte-assets-e2e`) and the e2e data directory (`.e2e-data`). The server is then built, the client is built in **development mode** (that exposes the test seam `window.__HERO_BYTE_E2E__`), and the server starts with `start:e2e` and `HEROBYTE_E2E=true` on its own state files. The owner's dev table and assets are never touched.
   - `vite preview` serves the built client on port 5175.
   - It runs one worker, serially (`workers: 1`, `fullyParallel: false`), because HeroByte is a single-room server and one test's reset would break another's connection.
   - Default viewport 1440×900. It already sets `video: "retain-on-failure"`, so the stack can record video today and throws it away when a test passes.
5. **`apps/e2e/fixtures.ts`** has an automatic `resetRoom` fixture. Before every test it POSTs to `/__e2e/reset` on the server, retrying for up to 3 s, so each test starts on a clean Main Hall.
6. The **four capture files** in `apps/e2e/`, with shared plumbing in `docs-shots.helpers.ts`:
   - `docs-screenshots.player.ts`: the join screen, the **▦ NEW TABLE** form, creating a private table with no DM password, the next-steps card, the Table menu, the first-time DM password setup; then the player basics (first join, the character card, the settings window, dice build and result, drawing, measure, ping); then a **phone context** (`390×844`, `hasTouch`, `isMobile`) with CDP touch helpers from `apps/e2e/mobile/touch.helpers.ts` (dock, Tools sheet, Table screen, Party screen, DM screen).
   - `docs-screenshots.dm.ts` (1280×1000): DM elevation through the UI, the Maps tab with a typed staging zone, NPCs, Props, the Table tab, the initiative dialog, combat and Encounter.
   - `docs-screenshots.authoring.ts` (1280×1000): the live map walkthrough (room, door, hallway, torches and night, painted water, placed props, decorated hallway, generated dungeon, quick wheel, player lens), then fog on with a **second browser context as a player** for `player-fog-view.jpg`, then the CRT hero shot at 1280×720.
   - `docs-screenshots.atlas.ts`: **two contexts from the start** (DM and player). The World tab, the kick panel opened with **G**, the arrival, and the player's **🗺 WORLD** map, then cleanup.

How it signs in:

- **Player:** `joinDefaultRoom` (in `apps/e2e/helpers.ts`) opens `/`, fills the field with placeholder `Table password` with `Fun1` (or `E2E_ROOM_PASSWORD`), presses **Enter Table**, and waits for the **Snap** button.
- **DM, invisible:** `joinDefaultRoomAsDM` joins, then sends `elevate-to-dm` with `FunDM` (or `E2E_DM_PASSWORD`) through the test seam. Nothing appears on screen, so **videos must not use it**.
- **DM, visible:** `elevateViaUI` (in `docs-shots.helpers.ts`) opens the Table button, presses **Enter DM mode**, types the DM password into the dialog and confirms. Videos should use this path.
- **Two clients:** each `browser.newContext()` is a separate browser identity, so a DM context plus a player context gives two seats, like FunDM and Fun1 at a real table.
- `shotPage` writes a full-viewport JPEG after fonts load, with animations disabled. `makeSteps` lets one failed capture record its error without losing the rest.

### Proposal: adding video to the harness (not implemented)

1. **A separate config**, for example `playwright.video.config.ts`, spreading `playwright.docs.config.ts`, with:
   - `testMatch: /docs-video\..+\.ts$/`, so neither screenshots nor e2e pick the files up;
   - `use.viewport: { width: 1920, height: 1080 }` and `use.video: { mode: "on", size: { width: 1920, height: 1080 } }`;
   - `use.launchOptions: { slowMo: 150 }` (try 100 to 250) so every action is visible;
   - a much longer `timeout`, since slowMo stretches every step.
   - A script such as `"docs:videos": "node scripts/run-e2e.mjs --config playwright.video.config.ts"` reuses the same isolated servers and reset fixture.
2. **One video per context.** Contexts a spec creates itself (`browser.newContext()`) should pass `recordVideo: { dir, size: { width: 1920, height: 1080 } }` explicitly rather than rely on the `use.video` default. A DM context and a player context then each give their own `.webm`, which suits side-by-side editing ("what the DM does / what the player sees"). Playwright writes the file when the context closes, so close contexts in `finally`, as the atlas file already does.
3. **A paced script, not a test.** In a video spec:
   - type visibly with `locator.pressSequentially(text, { delay: 80 })`, not `fill`;
   - move the mouse with `steps` (the helpers' `dragBoard` and `dragPath` already do);
   - add named `beat(page, ms)` pauses matched to the narration lines below;
   - wait for the same settle points the screenshot files use (`waitBake`, the toast clearing), so the video does not show `saving…` or a half-painted floor by accident.
4. **A cursor highlight.** Headless video does not draw the mouse. Add `context.addInitScript` that injects a fixed, `pointer-events: none`, top-z-index dot that follows `mousemove` and pulses on `mousedown`, plus a small key badge for keys the lesson teaches (**G**, **WASD**, **Esc**, **Ctrl+Z**). `pointer-events: none` keeps it out of Konva hit tests and out of `document.elementFromPoint`, which `computeGenRegion` relies on.
5. **Sign in on screen.** Use `elevateViaUI`, never `joinDefaultRoomAsDM`. For private-table lessons, reuse the UI flow from the first test in `docs-screenshots.player.ts`.
6. **Housekeeping.** Keep each video spec under the repo's 350-line file guard (the existing capture files are split for that reason), one spec per video or chapter group. Never run it at the same time as `pnpm test:e2e` (same ports, same single room). Copy raw `.webm` out of `test-results/` before the next run, because Playwright clears that folder.
7. **Audio.** Playwright video is silent. Record narration separately and lay it over the video in the edit. Add captions in the edit too, not in the page.

### Which videos to automate and which to record by hand

| Video | Best way | Why |
| --- | --- | --- |
| Player quick start | Automate, phone chapter by hand or automated phone context | Deterministic flows; dice and drag are visible with slowMo |
| DM quick start | Automate | Form, DM prompt, START LIVE MAP, kick and PLAYER VIEW are all deterministic (fix the kick seed) |
| Player 1: Join a table | Automate (two contexts for "Held in another window") | Error states are reproducible |
| Player 2: The table at a glance | Mixed: automate the tour, **voice chapter by hand** | Voice needs real mics, two people, headphones and timing |
| Player 3: Your character card | Automate | |
| Player 4: Roll dice | Automate | Results differ each run; pick a take where nothing confusing lands, or re-run |
| Player 5: Draw, measure and ping | Automate | The harness already draws, measures and pings |
| Player 6: Fog, doors and what you can see | Automate (DM + player contexts) | Needs a built map with doors first; the authoring file shows how |
| DM 1: Create a private table | Automate | |
| DM 2: Become the DM and invite players | Automate | Copying the link needs clipboard permission in the context, or show the link box |
| DM 3: Three ways to get a map on the table | Mostly automate; **grid alignment by hand** | Alignment needs a real battlemap image and careful clicks on its corners |
| DM 4: Build your first room live | Automate | The authoring file already does this |
| DM 5: Walls, doors and fog | Automate | |
| DM 6: NPCs and the token library | Automate | |
| DM 7: Run your first combat | Automate (DM + player) | |
| DM 8: Backups and keeping your work | **By hand** | Downloads and file pickers are OS dialogs that headless video does not show |
| Any phone shot | **By hand on a real phone** where possible | Real touch, real browser chrome; the automated 390 px context is a fallback |

### Recording checklist

- [ ] **Resolution 1920×1080**, browser window maximised, or the 1920×1080 viewport in the harness.
- [ ] **Browser zoom 100%.** Other zoom levels change the layout, so the video stops matching the written lesson. Punch in during the edit instead (the `Zoom:` notes).
- [ ] **CRT off** (Table button → Preferences → **Display → 📺 CRT**). Scanlines and bloom make small labels harder to read and compress badly. Turn it **on** only for intro or thumbnail shots and the moment in Player 2 that shows the setting.
- [ ] **Sound effects on** if you capture app audio (dice rattle, door creak, ping chime, turn chime). Set **Sound & motion → Motion** to **Full** so the dice tumble.
- [ ] **Hide personal data:** use a fresh browser profile with no bookmarks bar, extensions, other tabs, profile avatar or notifications. Use throwaway tables only; a table code plus its password lets anyone in, so after recording delete the table or change its password (**DM Menu → Table → Security → Change table password**). Do not show real players' names, real invite links, or **Your ID** close up.
- [ ] **A fresh browser list of tables.** The join screen remembers up to 12 tables, so a fresh profile keeps old tables out of the **Table** picker.
- [ ] **Headphones** for every voice segment, on every participant, to avoid echo.
- [ ] **Phone shots at 390 px wide** (the harness phone is 390×844). On a real phone, turn on Do Not Disturb, hide the status bar clock if you can, and use Wi-Fi (voice works best on Wi-Fi).
- [ ] **Wait out toasts and status text** before the next action: the DM-mode toast, `saving…`, `loading…`, `Painting terrain…`.
- [ ] **Move the mouse slowly** and rest it off the controls when talking, so a hovered button does not look pressed.
- [ ] **Local defaults:** Main Hall table password `Fun1`, DM password `FunDM` (unless the host changed them). Private tables use passwords you choose; password fields show dots on screen.

---

## Player quick start: Your first session as a player

- **Audience:** players. **Length:** about 2:45.
- **By the end:** the viewer can join a table, find their character, move their token and make a roll.
- **Setup:** a private recording table with a live map on it (built with **🏗️ Build map**, so the view starts on the token), fog off. DM browser signed in as DM on a second screen (not filmed, except to send the link). Player browser on the join screen, invite link ready to paste. A phone at 390 px joined as the same table for chapter 3's phone shot (a second seat is fine).
- **Thumbnail:** `img/table-first-join.jpg` (predates the new voice controls; check the header).

| Start | Chapter |
| --- | --- |
| 0:00 | Get in |
| 0:35 | Find yourself |
| 1:20 | Move |
| 1:55 | Roll |

### 1. Get in (0:00)

**Say:**
> Your DM sends you two things: a link, and a password. They come separately. The link never carries the password.
> Open the link. Check the Connection status line. It should say Connected.
> Type the table password. Passwords are case-sensitive.
> Press ENTER TABLE.

**Show:**
1. Chat message with the invite link (blurred table code). Click it.
2. Join screen. Zoom: the **Connection status** line reading `Connected`.
3. Type into the table password field. Caption: `The password comes from your DM, not the link.`
4. Click **ENTER TABLE**. The table loads with the view on your token.

### 2. Find yourself (0:35)

**Say:**
> This is your token. Your character has a row in the Party at the bottom. Your row reads You.
> Lost your token? Press the target button on your row. The map jumps to it.
> Select your row to open your character card.
> Click your name to rename your character.
> Click a number in HP to type a new value, or drag along the bar.

**Show:**
1. Zoom: your token on the grid.
2. Zoom: your row in the Party, the word **You**.
3. Pan away, then click **🎯** on your row. The view returns to the token.
4. Click your row's portrait or name. The card opens beside the rows.
5. Click the name, type a new one, press Enter.
6. Click the first number in `HP: 100 / 100`, type `24`, press Enter. Then drag along the HP bar so it shifts green, amber, red. Caption: `Click a number, or drag the bar.`
7. Press **Esc** to close the card.

### 3. Move (1:20)

**Say:**
> Drag your token to move it. Turn SNAP on and it clicks to the grid.
> Everyone sees the new spot when you let go.
> You can also step with W A S D or the arrow keys. One press, one cell.
> On a phone, open TOOLS, then Select. Tap your token, and use the d-pad.

**Show:**
1. Zoom: **SNAP** in the top toolbar; click it on.
2. Drag the token three cells. It lands on a cell.
3. Press **D D S** (key badge on screen). The token steps.
4. `[Phone]` Tap **⚒ TOOLS** → **□ Select**, tap the token, the d-pad appears in its sheet. Hold one direction: the token walks and the map follows.

### 4. Roll (1:55)

**Say:**
> Press Dice to open the roller.
> Click a die to add it to the tray. Click again for more of the same.
> Add a modifier chip if you need one.
> Pick normal, advantage or disadvantage. Then pick who sees it: the table, the DM, or only you.
> Press ROLL.
> For a quick d20, use the Roll now row. One press, one roll.
> Rolling real dice at the table? Press I ROLLED IT and type what you got. The log marks it BY HAND.

**Show:**
1. Click **⚂ Dice**.
2. Click **+d20**, then **+1**. Zoom: the tray.
3. Zoom: **NORMAL / ADV / DIS**, then **TABLE / DM / ME** and the line under them.
4. Click **⚂ ROLL!**. Let the dice land; hold on the result panel.
5. Click **d20** in the **Roll now:** row.
6. Click **✋ I ROLLED IT**, type `17`, confirm. Open **📜 Chat & Rolls → Rolls** and zoom on the **BY HAND** badge.
7. End card: links to Player lessons 1 to 6.

**Common mistake:** pasting the invite link and expecting to be let in. Show the join screen still asking for the password, then the line: `The link has no password. Ask your DM for it.`

---

## DM quick start: Set up your table before game night

- **Audience:** DMs. **Length:** about 3:00.
- **By the end:** the viewer can create a private table, claim the DM seat, put a map down, invite players and check what they see.
- **Setup:** a fresh browser profile on the join screen. A second browser (player) ready to open the invite link in chapter 4. Choose a table password (6+ characters) and a DM password (8+) before recording. Fix the kick seed in a rehearsal so the generated place looks good.
- **Thumbnail:** `img/table-next-steps.jpg` (or `img/hero-table.jpg` for a more visual card).

| Start | Chapter |
| --- | --- |
| 0:00 | Make a table |
| 0:35 | Claim the DM seat |
| 1:05 | Put a map down |
| 1:55 | Send the invite |
| 2:30 | See what they see |

### 1. Make a table (0:00)

**Say:**
> Real games live on a private table. It has its own passwords, and it is never cleared automatically.
> Press NEW TABLE. Give it a name you'll recognise.
> Choose a table password. Your players type this one.
> Choose a DM password too. Whoever knows it can run the table.
> Press CREATE PRIVATE TABLE.

**Show:**
1. Click **▦ NEW TABLE**.
2. Type the name `Sunday Game`, the table password, the DM password. Caption: `Table password: 6+ characters. DM password: 8+.`
3. Click **CREATE PRIVATE TABLE**. The table opens with the next-steps card.

### 2. Claim the DM seat (0:35)

**Say:**
> You arrive as an ordinary player. This card offers two next steps. Nothing on it happens by itself.
> Press Enter DM mode, and type your DM password.
> You can also do this any time from the Table button, top left.

**Show:**
1. Zoom: the next-steps card, **Enter DM mode** and the greyed **Invite players**.
2. Click **Enter DM mode**, type the DM password, press **ENTER DM MODE**.
3. Zoom: the new header buttons **🏗️ Build map** and **👁 PLAYER VIEW**, then **🛠️ DM MENU** at the right of the Party bar.
4. Quick insert: the **Table button** → **ENTER DM MODE** under **Your role**. Caption: `Same thing, any time.`

### 3. Put a map down (1:05)

**Say:**
> There are three ways to get a map on the table.
> If you have a map image, upload it in the DM Menu, under Maps. Lesson three covers that.
> To build one here, open Build map and press START LIVE MAP.
> Press Escape to leave the editor. The map stays live.
> Now press G. That's the Kicked-In Door. Pick a recipe, press Generate and enter, and HeroByte builds a stocked place and moves the table there.

**Show:**
1. Click **🛠️ DM MENU** → **Maps**. Zoom: **Map Background**, **⬆ UPLOAD IMAGE**. Close the menu without uploading.
2. Click **🏗️ Build map** → **▶ START LIVE MAP**. Zoom: the **● LIVE** badge.
3. Press **Esc** (key badge). The palette closes.
4. Press **G** (key badge). The kick panel opens. Set **Recipe** to building, kind tavern, size small; type the name `The Salt Hound`.
5. Click **🚪 Generate & enter**. Hold on the arrival: the party inside the entrance, fog on.

### 4. Send the invite (1:55)

**Say:**
> Now Invite players works, because you are the DM. It copies the link.
> Later, find it in the DM Menu, under Table, then Invite.
> Send the password separately. The link does not carry it.

**Show:**
1. Click **Invite players** on the next-steps card. The link is copied.
2. Quick insert: **DM Menu → Table → Invite → Copy invite link**.
3. Split screen: the player browser opens the link, types the password, presses **ENTER TABLE**. Their token appears.

### 5. See what they see (2:30)

**Say:**
> Press PLAYER VIEW. You now see exactly what players see: fog from the party's vision, secret doors hidden.
> You keep every DM power. Press it again to switch back.
> Player view is on the computer layout.

**Show:**
1. Click **👁 PLAYER VIEW**. The view darkens to the party's sight.
2. Click it again. Caption: `One click on, one click off.`
3. End card: links to DM lessons 1 to 8.

**Common mistake:** sending only the link. Show the player's join screen still asking for a password. Caption: `The link carries no password. Send it another way.`

**Unverified, check before recording:**
- Whether **G** needs keyboard focus on the map first (the screenshot harness clicks the map before pressing it), and whether it works with the build palette open.
- What **👁 PLAYER VIEW** shows when no player is at the table yet. This script has a player join in chapter 4 for that reason.
- What the invite link opens on the player's side (the join screen with that table already chosen?). The guides only say the link carries no password.
- That **👁 PLAYER VIEW** is absent from the phone layout. The guides' phone section does not list it; the brief says computer only.

---

## Player path 1: Join a table

- **Overlap:** the Player quick start's "Get in" chapter covers the happy path. This lesson goes deeper: errors, switching tables, reconnects, tabs and devices, and the Main Hall.
- **Audience:** players. **Length:** about 4:00.
- **By the end:** the viewer can get into any table and knows what each join-screen message means.
- **Setup:** two private recording tables this browser already belongs to (so the **Table** picker shows), plus the Main Hall. A second browser (different profile) for the "Held in another window" chapter. Know the code of one table.
- **Thumbnail:** `img/login-join-table.jpg`.

| Start | Chapter |
| --- | --- |
| 0:00 | The join screen |
| 0:50 | Switching tables, codes, forgetting |
| 1:40 | It remembers you |
| 2:20 | One tab, one device |
| 3:20 | The Main Hall |

### 1. The join screen (0:00)

**Say:**
> Use Chrome, Edge or Firefox on a computer. Phones get their own touch layout.
> First, the Connection status line. It should say Connected.
> Type the table password and press ENTER TABLE.
> Get it wrong and the error shows in red. What you typed stays in the field, so you can spot the typo. Passwords are case-sensitive.
> On a built map, the view starts on your token.

**Show:**
1. Join screen. Zoom: **Connection status** `Connected`.
2. Type the password with a wrong capital letter, press **ENTER TABLE**. Zoom: the red error and the kept text.
3. Fix it, press **ENTER TABLE**. The view opens centred on your token.

### 2. Switching tables, codes, forgetting (0:50)

**Say:**
> Belong to more than one table? A Table picker appears above the password. Choose the table, type its password, enter.
> Have a code instead of a link? Paste it under Join by code, and press JOIN.
> Forget this table drops a private table from this browser's list. You'll need its code to get back.
> Your browser remembers up to twelve tables. The server publishes no list of tables, so keep your codes.

**Show:**
1. Reload to the join screen. Zoom: the **Table** picker; open it, pick the other table.
2. Paste a code like `table-k3f9x2` into **Join by code**, point at **JOIN** (do not press).
3. Zoom: **Forget this table**. Caption: `You'll need the code to get back.`

### 3. It remembers you (1:40)

**Say:**
> The password is stored for that table in this tab, so a reload drops you straight back in.
> If your connection blips, HeroByte reconnects for you. You'll see Reconnecting, then Re-authenticating, under the header.
> For up to six hours, a reload or a blip brings you back as the same person.

**Show:**
1. Reload the tab. The table returns without the join screen.
2. Turn the network off for a moment (DevTools offline, or Wi-Fi off). Zoom: `Reconnecting…` then `Re-authenticating…` under the header.
3. `[Phone]` The same notice under the connection chip at the top.

### 4. One tab, one device (2:20)

**Say:**
> One live connection per device. Open the same table in a second tab and the older tab pauses. Press RECLAIM THIS TAB to switch back.
> Open it on a different device while the first is still connected, and you'll see Held in another window. Your seat is kept for the first device.
> If the first device is gone and this browser can't get back in, try again once. If it still fails, START A FRESH SESSION appears.
> That makes you a new player. You can't get back into your old character. Use it as a last resort.

**Show:**
1. Duplicate the tab. The first tab shows the "open in another tab" notice. Click **RECLAIM THIS TAB** there.
2. Second browser profile: open the table. Zoom: **Held in another window**.
3. Caption only, no click: `START A FRESH SESSION = a new player. Your old character stays behind.`

### 5. The Main Hall (3:20)

**Say:**
> Every server starts with one table, the Main Hall. It's a public test table.
> Its passwords are fixed, and by default it wipes itself after an hour with nobody in it.
> You'll see the public test table marker at the top while you're there. Build freely, but don't keep anything there.

**Show:**
1. Join the Main Hall with `Fun1`. Zoom: **⚠ PUBLIC TEST TABLE** in the header.
2. Caption: `Want to keep it? Your DM can save it as a private table. See DM lesson 1.`

**Common mistake:** a wrong capital letter in the password (chapter 1). Show the red error, then point at the kept text. Caption: `Passwords are case-sensitive.`

**Unverified, check before recording:**
- The exact wording of the "open in another tab" notice. The guides quote only **RECLAIM THIS TAB**.
- How to trigger "Held in another window" and **START A FRESH SESSION** on camera without losing a real seat. Rehearse on a throwaway table.

---

## Player path 2: The table at a glance

- **Audience:** players. **Length:** about 4:30.
- **By the end:** the viewer knows every part of the screen, can find their way around the map, and can chat and join voice.
- **Setup:** a private recording table with a built map, two or three player characters (one per browser), DM present. For chapter 5, at least two real people on headphones on separate devices. A phone at 390 px for chapter 6.
- **Thumbnail:** `img/table-menu.jpg` (or `img/table-first-join.jpg`; both predate the new voice controls).

| Start | Chapter |
| --- | --- |
| 0:00 | Toolbar, map, Party |
| 1:00 | The Table menu |
| 1:40 | Moving around the map |
| 2:20 | Chat and whispers |
| 3:00 | Voice |
| 3:50 | On a phone |

### 1. Toolbar, map, Party (0:00)

**Say:**
> Tools and toggles run along the top. Hover any button for a tooltip.
> Tools take turns. Picking one turns the last one off. Click the active tool again to turn it off.
> The map is shared. Everything on it syncs to every player.
> The Party at the bottom has a row for every character: the party, the DM's, and any NPCs you can see.
> CARDS shows every card at once. ROSTER goes back to rows. HIDE PARTY folds it down.
> The bar also holds WORLD, and PROPS when your DM allows it.

**Show:**
1. Hover two toolbar buttons; tooltips appear.
2. Zoom: the Party rows (portrait, name, HP, **🎯**, **You**).
3. Click **▦ CARDS**, then **☰ ROSTER**, then **▼ HIDE PARTY**.
4. Zoom: **🗺 WORLD** in the bar.

### 2. The Table menu (1:00)

**Say:**
> Top left is the Table button. It shows the table's name, and a dot for your connection: green online, red offline.
> It opens a menu about the table and about you. Your role is here.
> Preferences are yours alone. CRT adds scanlines and a monitor frame. Sound and motion controls animation, sound effects and volume.

**Show:**
1. Zoom: the **Table button** and its dot.
2. Click it. Zoom: **Your role** (**You are a player**, **ENTER DM MODE**), **Preferences**, **Your ID**.
3. Click **📺 CRT** on, hold two seconds, click it off. Caption: `Only you see this.`
4. Zoom: **Sound & motion** (**Motion**, **Mute sound effects**, **Volume**).

### 3. Moving around the map (1:40)

**Say:**
> Drag empty map space to pan. Middle-mouse drag works even with a tool active.
> The wheel zooms toward your cursor.
> RESET puts the view at the map's top-left corner at normal zoom. It's not the middle of the map.
> To find your token, press the target on your row.

**Show:**
1. Drag empty space; middle-drag with a tool armed.
2. Wheel zoom in toward a door, then out.
3. Click **🧭 RESET**. The view jumps to the top-left corner.
4. Click **🎯** on your row.

### 4. Chat and whispers (2:20)

**Say:**
> Open Chat and Rolls, then Chat.
> Choose Everyone for table talk, or Whisper to someone for a private message. Press SEND or Enter.
> Being the DM doesn't let anyone read other players' whispers.

**Show:**
1. Click **📜 Chat & Rolls → Chat**.
2. Choose **Everyone**, type `Ready when you are`, press **SEND**.
3. Choose **Whisper to [name]**, type a line, press Enter. Cut to the recipient's browser showing it.

### 5. Voice (3:00), record by hand

**Say:**
> Voice works like joining a call. Press Join voice. Allow the microphone when your browser asks.
> Before you join, you can see whether a call is running and how many are in it.
> Mute keeps you in the call. You still hear everyone. Leave voice hangs up.
> When someone talks, their portrait glows green and grows.
> Wear headphones. It stops echo.

**Show:**
1. Zoom: **🎤 Join voice** in the header's **Panels & settings** row, and the count (for example **2 in call**).
2. Click it; allow the mic in the browser prompt.
3. Click **Mute**, then **Unmute**. Then a card in **▦ CARDS** showing **🎧** and **🔇**.
4. The other person talks: their portrait glows and scales up.
5. Click **Leave voice**.

### 6. On a phone (3:50)

**Say:**
> On a phone the map fills the screen, with a dock of five buttons.
> PARTY, TOOLS, DICE, Chat, and RESET.
> PARTY and Chat open full screen. Close them with the X, or drag the title bar down.
> Voice is at the top of Party.

**Show:**
1. `[Phone]` Zoom: the dock **◉ PARTY**, **⚒ TOOLS**, **⚂ DICE**, **≡ Chat**, **◇ RESET**.
2. `[Phone]` Tap **◉ PARTY**; the voice row at the top lists who is in the call, **(muted)** beside anyone muted. Drag the title bar down to close.
3. `[Phone]` Tap **⚒ TOOLS → Table**. The same role and preferences.

**Common mistake:** pressing **🧭 RESET** to find your token. Show the view landing in the empty top-left corner, then press **🎯** on your row. Caption: `RESET = top-left corner. 🎯 = your token.`

**Unverified, check before recording:**
- Where **🎤 Join voice**, the call count, **Mute / Unmute** and **Leave voice** sit on screen now. The guide text is current, but every screenshot predates the new voice controls.
- Whether the header's **Panels & settings** row is labelled on screen or only named in the guide.
- The exact text of **Mute** / **Unmute** (the guide uses those words; your card's mic button shows **🎤** while live and a red **🔇** while muted).

---

## Player path 3: Your character card

- **Audience:** players. **Length:** about 4:00.
- **By the end:** the viewer can edit their character, its portrait and token art, conditions and size, save it to a file, and add a second character.
- **Setup:** Main Hall or a private table, one player signed in with one character, its token on the map. A small portrait image and a token image saved on the computer. A phone at 390 px for chapter 5.
- **Thumbnail:** `img/party-details.jpg` (predates the new voice controls; the card's mic button may look different now).

| Start | Chapter |
| --- | --- |
| 0:00 | Open your card |
| 0:30 | Name, HP and temp HP |
| 1:15 | The settings window |
| 2:20 | Your token |
| 3:00 | Save, load, add a character |
| 3:35 | On a phone |

### 1. Open your card (0:00)

**Say:**
> The Party lists characters, not players. Select your row and your card opens beside the rows.
> X or Escape closes it. Select another row to switch.

**Show:**
1. Click your row's portrait. The card opens.
2. Zoom: name, portrait, HP, **⚔️**, **INIT**, **⚙️**.
3. Press **Esc**; reopen.

### 2. Name, HP and temp HP (0:30)

**Say:**
> Click the name to edit it.
> Click either HP number to type a new value. Enter or click away saves.
> Or drag along the bar. It goes green, amber, red as you drop.
> Temp HP is a separate pool. It's used up before regular HP.
> The sword button centres the map on this character's token.

**Show:**
1. Click the name, type `Aria the Bold`, Enter.
2. Click the max HP number, type `30`; click the current, type `22`.
3. Drag along the bar down to red, then back.
4. Click Temp HP, type `5`.
5. Pan away, click **⚔️**.

### 3. The settings window (1:15)

**Say:**
> The gear opens your full settings. One window per character.
> Upload a portrait from your computer. On a phone, that's your camera roll.
> Give your token its own image too. CLEAR goes back to a coloured ring.
> Status Effects is a checklist of conditions. Up to three show on your portrait and token. The rest roll into a plus bubble.

**Show:**
1. Click **⚙️**. Zoom: the **Character** half.
2. **Portrait** → **⬆ UPLOAD IMAGE**, pick the file.
3. **Token Image** → **⬆ UPLOAD IMAGE**; the token changes on the map. Point at **CLEAR**.
4. **Status Effects**: tick Prone, Poisoned, Blessed, Concentration. Zoom: three medallions and `+1` on the token.

### 4. Your token (2:20)

**Say:**
> Token Size runs from Tiny to Gargantuan.
> Every token wears its name and, when you're allowed the numbers, a thin health bar.
> Double-click your token for a new random colour.
> With TRANSFORM, click a token for scale and rotate handles.
> A lock badge means the DM pinned it. No one can move it until they unlock it.

**Show:**
1. In **Token settings**, set **Token Size** to Large. Close the window.
2. Zoom: nameplate and HP bar on the token.
3. Click **🔄 TRANSFORM**, click the token; handles appear. Rotate once; it snaps to 45°.

### 5. Save, load, add a character (3:00)

**Say:**
> Save character downloads this character to a file. Load character brings it back, here or at another table.
> It's one character, never the whole table.
> ADD CHARACTER gives you a second one, with its own row, card, token and HP.

**Show:**
1. In **⚙️**, zoom: **Character file → Save character / Load character…**. Click **Save character**.
2. Click **Multiple Characters → ➕ ADD CHARACTER**. A second row appears with **You**.

### 6. On a phone (3:35)

**Say:**
> On a phone, open PARTY. Tap or drag your own HP to edit it.
> EDIT holds the name, portrait, token size, Add Character, and the character file.

**Show:**
1. `[Phone]` **◉ PARTY**; tap your HP and change it.
2. `[Phone]` Tap **⚙️ EDIT** on your row. Zoom: **➕ Add Character**, **Save character / Load character…**.

**Common mistake:** loading a character file that holds drawings. Caption over the **Load character…** button: `A file with drawings replaces the drawings you have on the map.` (Say it; no need to perform it.)

**Unverified, check before recording:**
- Whether double-click recolour works on a token that has a custom image. The guide says only "double-click your token for a new random color".

---

## Player path 4: Roll dice

- **Audience:** players. **Length:** about 4:30.
- **By the end:** the viewer can build any roll, choose who sees it, enter physical dice, and roll initiative.
- **Setup:** a private table, DM signed in (second browser, filmed for the audience chapter), one player. No combat running at the start (chapter 5 starts it). DM Menu → Table → Permissions: **Players can enter rolls by hand** ticked. A phone at 390 px for chapter 6.
- **Thumbnail:** `img/dice-result.jpg`.

| Start | Chapter |
| --- | --- |
| 0:00 | Build and roll |
| 1:00 | Advantage and who sees it |
| 1:50 | Quick rolls and macros |
| 2:30 | Rolling real dice |
| 3:15 | Initiative |
| 4:05 | On a phone |

### 1. Build and roll (0:00)

**Say:**
> Press Dice for the roller. Chat and Rolls holds the history.
> Click dice to add them to the tray. Nothing rolls yet. Click again for more of the same.
> Click the count badge to type an exact number.
> Add a plus one or minus one chip. Click a chip to type any value.
> Press ROLL. Each die shows, then the total.
> A natural twenty gets a critical banner. A natural one, a fumble.

**Show:**
1. Click **⚂ Dice** and **📜 Chat & Rolls → Rolls**.
2. Click **+d6** three times; zoom on `×3`. Click the badge, type `4`.
3. Click **+1**, then click the chip and type `3`.
4. Click **⚂ ROLL!**. Hold on the breakdown.
5. Zoom: the new entry in **Rolls** (name, time, formula, total). Click it for the breakdown.

### 2. Advantage and who sees it (1:00)

**Say:**
> ADV rolls the first die twice and keeps the higher. DIS keeps the lower. The other die stays, struck through.
> TABLE means everyone. DM means you and the DM. ME means only you.
> The line under the buttons says who will see it.
> A hidden roll is never sent to anyone else. Their browser has no copy.

**Show:**
1. Clear the tray, add **+d20**, click **ADV**, **⚂ ROLL!**. Zoom: the struck-through die, the **ADV** tag in the log.
2. Click **TABLE**, **DM**, **ME** in turn; zoom on the line under them each time.
3. Roll with **ME**. Split screen: the DM's log has no new entry.

### 3. Quick rolls and macros (1:50)

**Say:**
> The Roll now row rolls straight away: d20, advantage, disadvantage and 2d6.
> Build any roll and press SAVE to name it and keep it.
> Saved rolls live in this browser. They don't follow you to another device.

**Show:**
1. Click **ADV d20** in **Roll now:**.
2. Build `1d8 + 3`, click **+ SAVE**, name it `Longsword`. It appears to use again.

### 4. Rolling real dice (2:30)

**Say:**
> Rolling physical dice? Press I ROLLED IT and type the total. The tray can be empty.
> Already rolled in the app, but the real dice said something else? Press THAT'S NOT WHAT I ROLLED.
> Either way the log marks it BY HAND, and keeps the app's number struck through.
> Your DM can turn hand entry off.

**Show:**
1. With an empty tray, click **✋ I ROLLED IT**, type `17`, confirm.
2. Roll **⚂ ROLL!**, then click **✋ THAT'S NOT WHAT I ROLLED**, type `12`.
3. Zoom: the **BY HAND** badges and the struck-through number.

### 5. Initiative (3:15)

**Say:**
> Press INIT on your card.
> Set your modifier, then press ROLL D20 NOW. The server rolls it, and it lands in the log with your name.
> Or press ENTER A ROLL BY HAND and type your real d20.
> If no fight is running, setting initiative starts combat for the whole table.
> PREV and NEXT move the turn. On your turn, your card says YOUR TURN.

**Show:**
1. Select your row; click **INIT**. Zoom: the note that no fight is running.
2. Press **+** twice on **Initiative Modifier**; click **ROLL D20 NOW**. The dialog closes.
3. Zoom: **⚔️ Combat Active**, `Turn 1 of 1`, your row reading **Turn**, and **🎯 YOUR TURN** on the card.
4. Point at **ENTER A ROLL BY HAND** and **SAVE INITIATIVE** in a second take (or on a second character).

### 6. On a phone (4:05)

**Say:**
> On a phone, DICE opens a full-screen roller. Tap the result card to dismiss it.
> Initiative is INIT on your row in PARTY.

**Show:**
1. `[Phone]` **⚂ DICE**, add a d20, roll, tap the result card.
2. `[Phone]` **◉ PARTY → ⚔️ INIT** on your row.

**Common mistake:** rolling with **ME** selected when the table should see it. Show the DM's log with nothing in it, then zoom on the line under **TABLE / DM / ME**. Caption: `Check who sees it before you roll.`

**Unverified, check before recording:**
- The DM's side ends combat (**🏁 End combat**) after chapter 5; reset before the next take so the "no fight is running" note shows again. See DM lesson 7 for the controls.

---

## Player path 5: Draw, measure and ping

- **Audience:** players. **Length:** about 3:45.
- **By the end:** the viewer can draw and erase, place an area template, measure a distance and ping a spot.
- **Setup:** Main Hall or a private table with a map and a grid, two players signed in (second browser filmed to show the others see it). Fog off. A phone at 390 px for chapter 5.
- **Thumbnail:** `img/measure-tool.jpg` (or `img/drawing-tools.jpg`).

| Start | Chapter |
| --- | --- |
| 0:00 | Draw |
| 1:00 | Undo and erase |
| 1:40 | Area templates |
| 2:20 | Measure |
| 2:55 | Ping |
| 3:20 | On a phone |

### 1. Draw (0:00)

**Say:**
> Press Draw. The toolbox runs Tool, then Settings, then History.
> Pick Freehand, Line, Rectangle or Circle. Rectangle and Circle can be filled.
> Settings has colour, stroke width and opacity.
> A drawing reaches everyone when you finish the stroke.
> Press Move in the header to put the toolbox away.

**Show:**
1. Click **✏️ Draw**. Zoom: Tool, Settings, History.
2. **Freehand**, a red preset, draw an arrow.
3. **Circle**, tick **Filled**, set **Opacity (%)** to 50, drag a circle.
4. Split screen: the second player sees both.

### 2. Undo and erase (1:00)

**Say:**
> Undo and redo affect only your own drawings. Ctrl Z and Ctrl Y work while Draw is on.
> Erase drawings cuts through a freehand line. Other shapes go whole.
> You can erase your own drawings, and old ones with no owner. The DM can remove anyone's.

**Show:**
1. Press **Ctrl+Z**, then **Ctrl+Y** (key badge).
2. **Erase drawings**, cross the arrow: a section disappears. Touch the circle: it goes whole.
3. Click **✥ Move**.

### 3. Area templates (1:40)

**Say:**
> For spells, use the area templates: Burst, Cone, Cube and Bolt.
> Drag out from the point of origin. It snaps to whole squares.
> When you let go it's labelled with its size, like fifteen foot cone. Everyone sees it.

**Show:**
1. In **✏️ Draw**, **Area templates → AoE Cone**. Zoom: the line saying what shape it draws.
2. Drag from a token outward three squares. Zoom: `15 ft cone`.
3. **AoE Burst**, drag. Zoom: `20 ft circle`.

### 4. Measure (2:20)

**Say:**
> Press Measure. Click a start point, and a line follows your cursor with the distance.
> Click again to freeze it. A third click starts fresh.
> The whole table sees your line while you draw it, with your name on it.
> Distance follows the table's diagonal rule, set by the DM.

**Show:**
1. Click **📏 Measure**, click, move diagonally. Zoom: `3 Squares (15 ft)`.
2. Click to freeze. Split screen: the other player sees the line and your name.
3. Click **📏 Measure** again to put it away; the line clears.

### 5. Ping (2:55)

**Say:**
> Ping plants a coloured burst with your name, for three seconds, with a chime.
> You can also double-click empty map space, in any tool.

**Show:**
1. Click **👆 Ping**, click by a door. Zoom: the name under the burst.
2. Turn Ping off; double-click empty space. Another ping.

### 6. On a phone (3:20)

**Say:**
> On a phone, open TOOLS, then Draw. Hide controls makes room on the map. Your tool stays on.
> The small row keeps undo, redo, cancel and done.
> Double-tap empty map to ping.

**Show:**
1. `[Phone]` **⚒ TOOLS → Draw**, pick Freehand, tap **Hide controls**. Draw a line.
2. `[Phone]` Zoom: **Undo drawing**, **Redo drawing**, **Cancel stroke**, **Done drawing**. Tap **Show controls**, then **Done drawing**.
3. `[Phone]` Double-tap the map: a ping.

**Common mistake:** erasing a whole shape and reaching for Undo. Erase the circle, press **Ctrl+Z**, and nothing comes back. Caption: `Partial freehand erasing can be undone. A whole shape cannot.`

---

## Player path 6: Fog, doors and what you can see

- **Audience:** players. **Length:** about 3:30.
- **By the end:** the viewer understands fog of war, sight limits, remembered areas and doors, and can read the world map.
- **Setup:** a private table with a built map: two rooms joined by a corridor, one closed door, one **Locked** door, one **Secret** door, a hidden NPC in the far room. **Fog of War** on. One player token set to a 30 ft **Sight Radius** for chapter 2. The world tree with at least one discovered location (a kicked-in door makes this). DM browser and player browser, both filmed.
- **Thumbnail:** `img/player-fog-view.jpg`.

| Start | Chapter |
| --- | --- |
| 0:00 | Fog follows your tokens |
| 0:45 | Sight limits |
| 1:15 | Places you have been |
| 1:55 | Doors |
| 2:40 | The world map |

### 1. Fog follows your tokens (0:00)

**Say:**
> When your DM runs a built map, fog of war hides what your characters can't see.
> Vision comes from your own tokens. Walls and closed doors block it.
> Move, and your view moves with you.

**Show:**
1. Player screen: the lit area around the token, dark beyond the walls.
2. Drag the token into the corridor. The lit area follows.

### 2. Sight limits (0:45)

**Say:**
> Your DM can give a token a sight limit, like a torch or darkvision.
> Past it you see nothing, even down an open corridor.
> There's no player control for this. Ask your DM.

**Show:**
1. Player screen with the 30 ft token: the lit circle stops short in a long corridor.
2. Caption: `Sight radius is set by the DM.`

### 3. Places you have been (1:15)

**Say:**
> Somewhere you've already seen stays dimly lit, so you can find your way back.
> It's only a memory of the ground. Anything that walked in since is still hidden.
> The memory lives in your browser, for this table and this map.

**Show:**
1. Walk into room two, then back. Room two stays shaded, not black.
2. DM screen: drag an NPC into room two. Player screen: nothing appears there.

### 4. Doors (1:55)

**Say:**
> Click a door to open or close it. Everyone hears it.
> A small gold square marks a locked door. Only the DM can open those.
> Secret doors exist. Until the DM reveals one, it's a wall to you.
> At night the map darkens, and torches and braziers cast light.

**Show:**
1. Click the closed door: it swings open; fog lifts beyond it.
2. Zoom: the gold square on the locked door. Click it; it stays shut.
3. Split screen: DM sees the secret door as a dashed seam; player sees wall.

### 5. The world map (2:40)

**Say:**
> WORLD opens your campaign map: every place your party has found.
> You are here marks where you're standing.
> Door and stair sprites on a map lead somewhere else. Your DM opens them, and the whole table travels together.

**Show:**
1. Click **🗺 WORLD**. Zoom: **◀ you are here**.
2. Zoom: a **🚪** sprite on the map. Caption: `The DM opens these.`
3. `[Phone]` **⚒ TOOLS → World**.

**Common mistake:** trusting a remembered room. Chapter 3's split screen shows it: a creature the DM moved into the dim room is not drawn. Caption: `Dim means remembered, not seen.`

**Unverified, check before recording:**
- What a player sees and hears when clicking a locked door (the map editor guide says players get "Door is locked"; check where that message appears).
- How the DM sets a door to Locked or Secret on the desktop (see DM lesson 5's note on Inspect versus Properties).

---

## DM path 1: Create a private table

- **Overlap:** the DM quick start's "Make a table" chapter shows the form. This lesson adds the Main Hall, the table list, saving a Main Hall build as a private table, and password changes.
- **Audience:** DMs. **Length:** about 3:30.
- **By the end:** the viewer can choose between the Main Hall and a private table, make one, find it again, and change its password.
- **Setup:** a fresh browser profile on the join screen. A small build on the Main Hall (a few drawings, an NPC) for chapter 3, made while signed in as DM there (`Fun1` / `FunDM`). Passwords chosen in advance.
- **Thumbnail:** `img/login-new-table.jpg`.

| Start | Chapter |
| --- | --- |
| 0:00 | Main Hall or private table |
| 0:40 | The NEW TABLE form |
| 1:30 | Finding it again |
| 2:05 | Keeping a Main Hall build |
| 2:50 | Changing the password |

### 1. Main Hall or private table (0:00)

**Say:**
> Every server starts with the Main Hall. It's a public test table. Its passwords are fixed, and it wipes itself after an hour empty.
> For a real game, make a private table. It has its own passwords, and it's never cleared automatically.
> Anyone can make one. You don't need to be a DM.

**Show:**
1. Join screen; zoom on the public test table note.
2. Caption: `Main Hall = scratch space. Private table = your game.`

### 2. The NEW TABLE form (0:40)

**Say:**
> Press NEW TABLE.
> A name helps you find it in your list later.
> The table password is what your players type. Six characters or more.
> The DM password is optional, eight or more. If you skip it, the first person to enter DM mode sets it.
> Press CREATE PRIVATE TABLE. You get a random table code, and you arrive as an ordinary player.

**Show:**
1. Click **▦ NEW TABLE**. Zoom: name, table password, DM password fields.
2. Fill all three; click **CREATE PRIVATE TABLE**.
3. Zoom: the next-steps card (**Enter DM mode**, **Invite players**). Caption: `Next: DM lesson 2.` Close it with **✕**.

### 3. Finding it again (1:30)

**Say:**
> Back on the join screen, the Table picker lists your tables by name.
> Your browser remembers up to twelve. The server keeps no public list, so note your table's code.
> Forget this table removes it from this browser. You'll need the code to return.

**Show:**
1. Reload to the join screen. Open the **Table** picker; zoom on `Sunday Game`.
2. Zoom: **Join by code**, **Forget this table**.

### 4. Keeping a Main Hall build (2:05)

**Say:**
> Built something good on the Main Hall? Copy it to a table of your own.
> In the DM Menu, open Table, then Security, then Save as a Private Table.
> Give it a name and passwords, and press SAVE AND GO THERE.
> Everything comes across: the map, tokens, NPCs, drawings and images. The Main Hall carries on as before.

**Show:**
1. On the Main Hall as DM: **🛠️ DM MENU → Table → Security**. Zoom: **Save as a Private Table**.
2. Fill name and passwords; click **SAVE & GO THERE**. The new table opens with the same build.

### 5. Changing the password (2:50)

**Say:**
> On a private table, Security has Change table password. People already in stay. New joiners need the new one.
> Change it if a code leaks, or after a one-shot.
> Reset to default gives your table the Main Hall's password. Anyone with your code could join. Don't use it to tidy up.

**Show:**
1. **🛠️ DM MENU → Table → Security**. Zoom: **Change table password**, **Reset to default**.
2. Change the password; the player browser stays connected.

**Common mistake:** pressing **Reset to default** as a tidy-up. Zoom on the button and its confirmation (do not confirm). Caption: `This gives your table the Main Hall password.`

**Unverified, check before recording:**
- The exact label of **SAVE & GO THERE** (the DM guide writes it in capitals; Getting Started writes "Save & Go There").
- Where the DM password is changed later. The guide says it is not changed in Security; it is set at creation or by the first DM.

---

## DM path 2: Become the DM and invite players

- **Overlap:** the DM quick start's "Claim the DM seat" and "Send the invite" chapters show the short version. This lesson adds the first-time DM password, what DM mode gives you, co-DMs, stepping down, and managing who is at the table.
- **Audience:** DMs. **Length:** about 4:00.
- **By the end:** the viewer can enter and leave DM mode, invite players safely, and remove a player who has left.
- **Setup:** a private table **created without a DM password** (for chapter 2), you signed in as a player. A player browser on the join screen. For chapter 5, a third seat that has left the table (join from a throwaway profile, then close it and wait past "dropped just now"). A phone at 390 px.
- **Thumbnail:** `img/dm-elevate-modal.jpg` (or `img/dm-menu-table.jpg`).

| Start | Chapter |
| --- | --- |
| 0:00 | Enter DM mode |
| 0:40 | First DM on a new table |
| 1:10 | What you get |
| 1:55 | Invite players |
| 2:45 | Who is at the table |
| 3:30 | Stepping down, co-DMs |

### 1. Enter DM mode (0:00)

**Say:**
> DM mode belongs to the table, not a character. It's in the Table menu.
> Press the Table button, top left. Under Your role, press ENTER DM MODE, and type the DM password.
> A wrong password keeps the dialog open, with the reason, and you stay a player.
> After five wrong tries, the server locks it for fifteen seconds.

**Show:**
1. Click the **Table button**; zoom on **Your role**, **ENTER DM MODE**.
2. `[Phone]` **⚒ TOOLS → Table** shows the same.

### 2. First DM on a new table (0:40)

**Say:**
> This table was made without a DM password. So the first try offers to set one.
> You become the DM the moment it's saved.

**Show:**
1. Click **ENTER DM MODE**, type anything, confirm. The dialog switches to setting a password.
2. Type and confirm the new DM password; save. The DM-mode toast appears.

### 3. What you get (1:10)

**Say:**
> Two new buttons in the header: Build map, the live editor, and PLAYER VIEW.
> The DM MENU sits at the right of the Party bar. It has six tabs.
> On a phone, the dock's RESET slot becomes DM.
> The Table menu now has Table settings, which opens the DM Menu on its Table tab.

**Show:**
1. Zoom: **🏗️ Build map**, **👁 PLAYER VIEW**, **🛠️ DM MENU**; the Table button now shows **DM**.
2. Open **🛠️ DM MENU**; pan across the tabs: Maps, World, Encounter, NPCs & Monsters, Props & Objects, Table.
3. `[Phone]` Zoom: **♛ DM** in the dock.
4. Table menu → **⚙️ Table settings…**.

### 4. Invite players (1:55)

**Say:**
> Invite players on the next-steps card stays greyed until you've been the DM. Now it works.
> Any time later, DM Menu, Table, Invite. You'll see the table's code and Copy invite link.
> The link carries no password, on purpose. Send the password another way.
> On a plain local network address, the browser blocks copying, so the link shows in a box to copy by hand.

**Show:**
1. Show the next-steps card (keep it open from chapter 2; once closed with **✕** it does not come back): **Invite players** now active. Click it.
2. **DM Menu → Table → Invite**. Zoom: the code and **Copy invite link**. Click it.
3. Player browser: open the link, type the password, **ENTER TABLE**.

### 5. Who is at the table (2:45)

**Say:**
> Players at this table lists everyone who has joined, with a token count.
> SELECT ALL grabs every token a player owns.
> REMOVE appears on a player who isn't at the table. It clears their seat, characters and tokens. There's no undo.
> It's not a ban. The password still lets them back in, as a new player.

**Show:**
1. **DM Menu → Table → Players at this table**. Zoom: rows and counts.
2. Click **SELECT ALL** on the player's row; their token highlights.
3. Zoom: **REMOVE** on the departed seat. Click it, read the confirmation, confirm.

### 6. Stepping down, co-DMs (3:30)

**Say:**
> LEAVE DM MODE steps you back to player. You keep your character. The password brings the tools back.
> Share the DM password with a co-DM, and you can both hold DM powers.

**Show:**
1. Table menu → **LEAVE DM MODE**. The DM buttons disappear.
2. Re-enter DM mode for the next lesson.

**Common mistake:** trying to invite before claiming the seat. At the start of chapter 4 (or in a cut-in from a fresh table), zoom on the greyed **Invite players**. Caption: `Enter DM mode first. The link waits for you.`

**Unverified, check before recording:**
- The exact wording and buttons of the first-time DM password prompt (the guides show it only as `img/dm-bootstrap-modal.jpg`).
- Whether the next-steps card survives the DM-mode change and stays usable for chapter 4 (the guide says it comes back on a reload of that tab until you close it with **✕**, and **Invite players** stays available once you have been the DM).
- How long to wait before **REMOVE** appears for a departed seat (the guide says "dropped just now" waits; a login screen left open counts as present for five minutes).

---

## DM path 3: Three ways to get a map on the table

- **Audience:** DMs. **Length:** about 5:00.
- **By the end:** the viewer can put their own map image on the table, start a map to build by hand, and generate a place mid-session, and knows when to use each.
- **Setup:** a private table, DM signed in, one player signed in (second browser) for the arrival shot. A battlemap image with a printed grid on the computer. Rehearse the alignment clicks. Fix the kick seed in rehearsal.
- **Thumbnail:** `img/dm-kick-arrival.jpg`.

| Start | Chapter |
| --- | --- |
| 0:00 | Which one, right now? |
| 0:30 | A: a map you already have |
| 2:00 | B: build it here |
| 2:30 | C: kick in a door |
| 3:50 | Mixing them |

### 1. Which one, right now? (0:00)

**Say:**
> There are three ways to get a map down. Bring your own art. Build it here. Or kick in a door and let HeroByte make one.
> You can switch between them mid-session.
> One rule ties them together. Fog and the Kicked-In Door need a live map. A picture on its own isn't one.

**Show:**
1. Title card with the three paths and their prep time: `a minute`, `10–40 min`, `none`.

### 2. A: a map you already have (0:30)

**Say:**
> Open the DM Menu, then Maps. Everything here is under Current table map.
> Under Map Background, upload your image. It's stored with your table.
> You can paste a link instead, but the image's host must allow it. If nothing appears, download it and upload.
> Now match the grid. Open Advanced, then the Grid Alignment Wizard, and press START ALIGNMENT.
> Click two opposite corners of one square on the image. Press APPLY ALIGNMENT.
> Set Square Size in feet. Then lock the map, so nobody drags it mid-fight.

**Show:**
1. **🛠️ DM MENU → Maps**. Zoom: **On table:** line, **Map Background**.
2. **⬆ UPLOAD IMAGE**, pick the battlemap. It appears.
3. Open **Advanced: map position and grid alignment → Grid Alignment Wizard → START ALIGNMENT**.
4. Zoom into one printed square; click its top-left, then bottom-right corner. Click **APPLY ALIGNMENT**. The map shifts to mesh.
5. **Grid Controls → Square Size** `5`.
6. **Map Transform → Map is locked** on.
7. Scroll to **Fog of War**: zoom on the disabled button and its message.

### 3. B: build it here (2:00)

**Say:**
> For a scene that matters, build it. Walls block sight, doors open, fog reveals the room.
> Open Build map and press START LIVE MAP. The live badge lights up.
> Lesson four builds a room from here.

**Show:**
1. On a second table (or after clearing the background): **🏗️ Build map → ▶ START LIVE MAP**. Zoom: **● LIVE**.
2. Press **Esc**. Caption: `The map stays live.`

### 4. C: kick in a door (2:30)

**Say:**
> The party goes somewhere you never prepped. Press G.
> The panel has a name already filled in. Type a better one if you like.
> Pick the recipe. Dungeon, or a building: a tavern, shop, warehouse or house. Pick a size.
> Press Generate and enter, or Enter. Reroll only changes the seed.
> Seconds later the whole table is somewhere new. Fog is on, and the party stands inside the entrance.
> A door sprite leads back. Click it, confirm, and the old scene comes back as you left it.

**Show:**
1. On the live map, press **G** (key badge). Zoom: the panel, name, **Recipe**, dials, seed, **⟳ Reroll**.
2. Recipe building, kind warehouse, size medium; name `Kestrel & Sons`.
3. Click **🚪 Generate & enter**. Split screen: the player's view arrives too.
4. Zoom: the **🚪** sprite at the entrance. Click it, confirm; the old map returns.
5. Caption: `The party is set down at the entrance, or the map's centre. Drag them where you want.`
6. `[Phone]` **♛ DM → 🚪 Kick in a door**, and the **⏳ Kicking…** chip.

### 5. Mixing them (3:50)

**Say:**
> Want fog on your own art? Upload it, start a live map, and draw only walls and doors over it.
> Walls are invisible to players, so your art shows through.
> A kicked-in place is an ordinary map. Stay in the editor and change it.
> Every map can join your campaign tree on the World tab.

**Show:**
1. On the uploaded map: **▶ START LIVE MAP**, **🧱 Wall** along a printed wall, **🚪 Door** across it. Zoom: the editor's background warning. Caption: `The warning is about painting. Walls and doors are fine.`
2. **DM Menu → World**: zoom on **+ Create location** and **🔗 Link existing map**.

**Common mistake:** turning on fog for an uploaded image. Show the disabled **Fog of War** button and its message: *"Build a map on the table first (🏗️ Build map; on a phone, 🏗️ Edit the live map) — fog uses its walls and doors."*

**Unverified, check before recording:**
- Whether **G** needs focus on the map first (see the DM quick start note).
- Whether the uploaded background stays under a live map started on top of it (the guide's A-then-B hybrid says it does; check how it looks).

---

## DM path 4: Build your first room live

- **Audience:** DMs. **Length:** about 4:30.
- **By the end:** the viewer can start a live map, draw a walled room with the floor and walls they want, fix mistakes, and check what players see.
- **Setup:** a private table with no background image. DM signed in on a computer. A player signed in on a second browser, filmed for chapter 5. Before recording, set **DM Menu → Maps → Player Staging Zone** where the room will go and press **APPLY ZONE**, so the player spawns inside it. A phone (or tablet) signed in as DM for the phone inserts.
- **Thumbnail:** `img/mapedit-room-done.jpg`.

| Start | Chapter |
| --- | --- |
| 0:00 | Start a live map |
| 0:50 | Pick a floor and walls |
| 1:35 | Drag out the room |
| 2:20 | Undo, redo and Escape |
| 3:20 | What your players see |

### 1. Start a live map (0:00)

**Say:**
> The map editor runs on the live table. Players see each edit the moment you make it.
> Press Build map, then START LIVE MAP.
> That makes a fresh map and binds it to the table. The live badge lights up.
> You'll see saving flicker beside it as each edit lands.
> The tools are grouped: Terrain, Structures, Objects, Lighting and Generate.

**Show:**
1. Click **🏗️ Build map**. Click **▶ START LIVE MAP**. Zoom: `loading…`, then **● LIVE**.
2. Zoom: the **Tool group** menu and its five groups.
3. `[Phone]` **♛ DM → 🏗️ Edit the live map**; the dock becomes **✕ Done**, **⚒ Tool**, **↶ Undo / ↷ Redo**, **Stop**.

### 2. Pick a floor and walls (0:50)

**Say:**
> In Structures, pick Room.
> The brush deck picks the floor. Choose a shelf, or search by name.
> Wall ring picks the wall style: none, stone, brick, timber or dark.
> None leaves the wall band unpainted, but the room still blocks sight.

**Show:**
1. **Tool group → Structures → 🏠 Room**.
2. **Material category** Stone; type `flag` in **Search brushes**; pick a floor. Zoom: **Selected material**.
3. **Wall ring:** **Stone**.

### 3. Drag out the room (1:35)

**Say:**
> Drag a rectangle. The preview shows the real floor, and a size in cells.
> Let go. You get floor, a wall band, and blocking walls all round.
> That whole room is one step to undo.

**Show:**
1. Drag a room; zoom on the `cols × rows` readout during the drag.
2. Release. Wait for `saving…` to clear. Hold on the finished room.

### 4. Undo, redo and Escape (2:20)

**Say:**
> UNDO MAP and REDO MAP sit above the settings. Ctrl Z and Ctrl Y work too.
> Each drag is one step.
> Mid-drag, Escape cancels it. Press Escape again, with nothing in progress, to leave the editor.
> The map stays live. Open Build map again and you carry on.
> One edit goes at a time. If you draw while the last one is still saving, you'll see Still saving the last change. Draw it again. Nothing was half-applied.

**Show:**
1. Click **↶ UNDO MAP**: the room disappears. **↷ REDO MAP**: it returns. Then **Ctrl+Z** / **Ctrl+Y** (key badge).
2. Start a second room drag, press **Esc** mid-drag: nothing lands. Zoom: **Cancel placement** live during a drag.
3. Press **Esc** again: the editor closes. Zoom: the map is still live.
4. Click **🏗️ Build map**: resumes. Point at **Done building**.
5. `[Phone]` Start a drag, press **Stop** with a second finger; lift; nothing lands.

### 5. What your players see (3:20)

**Say:**
> Here's the player's screen. The room appeared as you built it.
> Players don't see walls. They act through fog and movement.
> To check from your side, press PLAYER VIEW. You keep building while it's on.

**Show:**
1. Split screen: the player's browser with the room, their token inside.
2. DM: **📐 PIN WALLS OVERLAY** on; player screen still shows no wall overlay.
3. DM: **👁 PLAYER VIEW** on, then off.

**Common mistake:** drawing faster than the server confirms. On the phone, finish two rooms quickly. Zoom on *"Still saving the last change — draw that again."* Caption: `Wait for saving to finish, then draw it again.`

**Unverified, check before recording:**
- The exact name of the floor shown here; pick it in rehearsal from the 34 families.
- How to trigger "Still saving the last change" on camera reliably. The guide says it is most noticeable on a phone.

---

## DM path 5: Walls, doors and fog

- **Audience:** DMs. **Length:** about 4:30.
- **By the end:** the viewer can add walls and doors, set doors locked or secret, turn on fog, and make a dungeon dark.
- **Setup:** the room from DM lesson 4, plus a hallway leaving it. DM signed in. A player signed in on a second browser with their token in the room, filmed throughout.
- **Thumbnail:** `img/mapedit-door.jpg` (or `img/dm-player-lens.jpg`).

| Start | Chapter |
| --- | --- |
| 0:00 | Walls |
| 0:40 | Doors |
| 1:15 | Locked and secret |
| 2:10 | Turn on fog |
| 2:50 | Make it dark |
| 3:50 | Check it |

### 1. Walls (0:00)

**Say:**
> Wall draws one straight blocking wall. Drag from point to point.
> Players never see walls. They stop movement and sight.
> While you edit, walls show as a see-through overlay. PIN WALLS OVERLAY keeps it after you leave.

**Show:**
1. **Structures → 🧱 Wall**; drag a wall splitting the room.
2. Zoom: **📐 PIN WALLS OVERLAY**.

### 2. Doors (0:40)

**Say:**
> Door: drag across a wall. The drag sets its length and angle.
> Doors start closed.
> At the table, anyone can click a door to open or close it.

**Show:**
1. **🚪 Door**, drag across the new wall.
2. Press **Esc** to leave the editor. Player browser: click the door; it opens.

### 3. Locked and secret (1:15)

**Say:**
> To change a door, pick it with Select, and open Inspect.
> Closed, Open, Locked or Secret.
> A locked door says it's locked to players. You can still open it.
> A secret door is invisible to players. You see it as a dashed seam.
> At the table, Alt-click a door to cycle its lock. Alt-click a secret door to reveal it.

**Show:**
1. **🏗️ Build map → 👆 Select**, click near the door; the outline traces it. Open **🔍 Inspect**; choose **Locked**.
2. Player browser: a gold square on the door; clicking it does not open it.
3. Draw a second door; set it **Secret**. Split screen: DM sees a dashed seam, player sees wall.
4. Leave the editor; **Alt+click** the secret door (key badge). The player now sees a door.

### 4. Turn on fog (2:10)

**Say:**
> Fog of War is in the DM Menu, under Maps. It needs a built map with walls and doors.
> Players then see only what their tokens see. You still see everything.
> Things outside a player's sight are never sent to them.

**Show:**
1. **🛠️ DM MENU → Maps → Fog of War** on.
2. Split screen: the player's view darkens beyond the walls; the DM's does not.

### 5. Make it dark (2:50)

**Say:**
> Table Sight Default sets how far every token sees. Set thirty feet and a corridor becomes something to walk down.
> A single token can have its own Sight Radius, in its Token settings. Darkvision, a torch, or Blind.
> A token you set yourself always wins over the table default.

**Show:**
1. **Maps → Table Sight Default** **30 ft**. Player screen: the lit area shrinks.
2. Select the player's row → **⚙** on its card → **Token settings → Sight Radius**. Zoom: the empty box reading **Table default — 30 ft**. Click **120 ft**.
3. Player screen: their sight grows to 120 ft.

### 6. Check it (3:50)

**Say:**
> PLAYER VIEW shows the table through the party's eyes. Fog, hidden doors, no DM overlays.
> Use it while you prep. It's the difference between I think that's hidden, and it is.

**Show:**
1. **👁 PLAYER VIEW** on: the DM screen matches the player's. Off.

**Common mistake:** setting **Table Sight Default** to 30 ft and expecting every token to go dark. The 120 ft token from chapter 5 stays at 120. Caption: `A token's own radius always wins.`

**Unverified, check before recording:**
- On the desktop, whether door state is set in **🔍 Inspect** (the map editor guide's door section) or in **Properties** with **Save changes** (its phone/desktop "Editing what you picked" note says "on phone or desktop"). Check which panel and buttons the desktop shows.
- The exact preset labels in the **Table Sight Default** control (the guide names **30 ft** and **Unlimited**).

---

## DM path 6: NPCs and the token library

- **Audience:** DMs. **Length:** about 4:30.
- **By the end:** the viewer can add NPCs one at a time or as a pack, use the library, hide and reveal them, and set their stance.
- **Setup:** a private table with a live map, DM signed in, one player signed in (second browser) for the hide and reveal shots. No NPCs yet.
- **Thumbnail:** `img/dm-menu-npcs.jpg`.

| Start | Chapter |
| --- | --- |
| 0:00 | Add an NPC |
| 0:50 | Place it and find it |
| 1:30 | A pack at once |
| 2:15 | The library |
| 3:10 | Hide, stance and mimics |
| 3:55 | Your own tokens |

### 1. Add an NPC (0:00)

**Say:**
> Open the DM Menu, then NPCs and Monsters. Press ADD NPC.
> Each NPC has a name, HP, temp HP, an initiative modifier, a portrait and token art.
> Players can't rename, damage or move your NPCs.

**Show:**
1. **🛠️ DM MENU → NPCs & Monsters → + ADD NPC**.
2. Type name `Ogre`, HP `59`, **Init Mod** `-1`. **Token Image → ⬆ UPLOAD IMAGE**.

### 2. Place it and find it (0:50)

**Say:**
> PLACE ON MAP drops its token at the map's top-left corner. Not the middle of your view.
> Press FOCUS to jump to it, then drag it where you want.
> Pressing PLACE again moves it back to the corner as a fresh token. It doesn't add a second one.

**Show:**
1. Click **PLACE ON MAP**. The view stays put; nothing seems to happen.
2. Click **🎯 FOCUS**: the view jumps to the corner. Drag the token into a room.

### 3. A pack at once (1:30)

**Say:**
> Set the number field to five, and the button says ADD 5 NPCS. Five arrive, numbered.
> A second batch carries on the numbering. It doesn't repeat it.
> DUPLICATE copies one NPC: HP, art, size, stance. It takes the next free number.

**Show:**
1. Set **×N** to `5`; zoom: **+ ADD 5 NPCS**. Click it. Five rows appear, numbered.
2. On one card, click **⧉ DUPLICATE**; the next number appears.

### 4. The library (2:15)

**Say:**
> LIBRARY opens the bundled pack: two hundred and forty-four tokens, monsters and townsfolk.
> Narrow it with MONSTERS or TOWNSFOLK, then Family.
> Search matches every word. Goblin archer finds goblin archers.
> Click a token and it arrives as a new NPC, with its name, art and portrait filled in, at the right size.
> The number field works here too.

**Show:**
1. Click **📖 LIBRARY**. Click **MONSTERS**, then **Family** Goblins.
2. Type `goblin archer` in **Search**. Set **×N** to `3`; click the archer. Three numbered archers arrive.

### 5. Hide, stance and mimics (3:10)

**Say:**
> Select an NPC's row for its card. The eye hides it from players. Prep an ambush hidden, reveal it on the pounce.
> Stance is Enemy, Neutral or Ally. It sets the card's colour. Players see it.
> Mimics come in pairs. Place the closed chest. When they touch it, press REVEAL MIMIC.

**Show:**
1. Select an archer's row; click **👁️**. Split screen: it vanishes from the player's Party and map. The DM's row reads **Hidden**. Click again to reveal.
2. In the DM Menu, set an NPC's **Stance** to Ally; its card turns green.
3. Library: add the mimic chest, place it, set it Neutral. Click **🎭 REVEAL MIMIC**: it becomes the monster, stance Enemy. Click **🎭 DISGUISE**.

### 6. Your own tokens (3:55)

**Say:**
> The THIS TABLE shelf holds your own tokens. Add your own, from your computer or an image link.
> Give it a name, tags and a stance, and it searches like the pack's tokens.
> Players never receive the shelf.

**Show:**
1. Library → **THIS TABLE → Add your own**; upload an image, name `Innkeeper`, tap the **villager** kind chip; add it. Zoom: the **ADDED** badge.

**Common mistake:** pressing **PLACE ON MAP** and looking for the token in the middle of the screen. Chapter 2 shows it. Caption: `PLACE ON MAP = top-left corner. Use 🎯 FOCUS.`

**Unverified, check before recording:**
- Whether a library pick places its token on the map straight away or still needs **PLACE ON MAP**. The guide says the token "is born at the pack's size" but not where.
- The exact name of a goblin archer token and the mimic chest in the library, and that `goblin archer` returns them.
- The **Stance** select's location (the guide says "in the DM menu").

---

## DM path 7: Run your first combat

- **Audience:** DMs. **Length:** about 4:45.
- **By the end:** the viewer can set up an encounter, get initiative from NPCs and players, run turns and end the fight.
- **Setup:** a private table with a live map, fog off. DM signed in. Two players signed in on separate browsers, tokens placed, each with a movement speed set (**Token settings → Movement**). Three goblin NPCs placed (DM lesson 6). No initiative on file: if needed, **Encounter → 🗑️ Clear all initiative** and **🏁 End combat** before recording.
- **Thumbnail:** `img/combat-active.jpg` (predates the new voice controls; check the cards).

| Start | Chapter |
| --- | --- |
| 0:00 | The Encounter tab |
| 0:40 | Players roll first |
| 1:30 | Roll the NPCs |
| 2:15 | Start at the top |
| 2:50 | Running turns |
| 3:50 | End the fight |

### 1. The Encounter tab (0:00)

**Say:**
> Fights live in the DM Menu, under Encounter. Prepare, roll, run and end, all here.
> Setup lists everyone who can fight: In the order, and Not rolled yet.
> Monster HP players see: Exact, Bloodied, or Hidden. The server enforces it.

**Show:**
1. **🛠️ DM MENU → Encounter**. Zoom: **Setup**, **Not rolled yet** with each row's **🎲 Roll**, **Set…**, **🎯**.
2. Set **Monster HP players see** to **Bloodied**.

### 2. Players roll first (0:40)

**Say:**
> Watch one thing. Any initiative saved while no fight is running starts combat, on that character's turn.
> Your players press INIT on their card and roll.
> The first one to roll starts the fight.

**Show:**
1. Player 1 browser: **INIT → ROLL D20 NOW**. Zoom: **⚔️ Combat Active**.
2. Player 2 browser: the same.
3. DM: the two players now under **In the order**.

### 3. Roll the NPCs (1:30)

**Say:**
> Roll missing NPC initiative rolls a d20 plus modifier for every NPC that has none.
> Each gets its own line in the log. A hidden NPC rolls into your log only.
> Players may type rolls by hand if your table allows it. The line here says which.

**Show:**
1. Click **🎲 Roll missing NPC initiative**. The goblins slot into the order. The button disables, with its reason.
2. Zoom: the line about hand entry and **Change in Table**.

### 4. Start at the top (2:15)

**Say:**
> The turn is with whoever rolled first, not the highest roll.
> Encounter shows a note when the turn isn't at the top.
> Press Start at top of order. It moves the turn there, starts the round over and refills movement.

**Show:**
1. Zoom: the note that the turn is not at the top; the **▶** on a mid-order row.
2. Click **⏮ Start at top of order**. The **▶** moves to the top.

### 5. Running turns (2:50)

**Say:**
> NEXT and PREV move the turn. A chime marks each change. Anyone can press them.
> The status line reads Turn, the number, and whose turn it is.
> On a token's plate, its movement left this turn. Overspend and it turns red. Nothing is refused.
> With monster HP on Bloodied, players see a red dot, not numbers.

**Show:**
1. Click **NEXT ►** twice. Zoom: **Turn N of M:** and the holder's name; the Party row reading **Turn**.
2. Player browser on their turn: **🎯 YOUR TURN** on the card. They drag their token; the plate counts down. Drag past it; it turns red.
3. DM: drop a goblin's HP below half on its card. Player browser: a red dot on the goblin.
4. `[Phone]` The turn strip at the top of the map, **◄ PREV / NEXT ►**, and **▶ Turn** on the row.

### 6. End the fight (3:50)

**Say:**
> End combat stops the fight and keeps every initiative on file.
> That means the next initiative anyone saves starts a new fight.
> Clear all initiative empties the order.

**Show:**
1. Click **🏁 End combat**. The banner goes.
2. Click **🗑️ Clear all initiative**. The order empties.

**Common mistake:** rolling NPCs before the fight is set, so it starts on the first goblin rolled. Chapters 2 to 4 show the fix. Caption: `Turn not at the top? ⏮ Start at top of order.`

**Unverified, check before recording:**
- The exact text of the Encounter note that the turn is not at the top.
- Where the movement **Reset** appears during the fight (the guide: in the character's settings, during combat or after spending movement).

---

## DM path 8: Backups and keeping your work

- **Audience:** DMs. **Length:** about 4:00.
- **By the end:** the viewer can download and restore a table backup, tell the three kinds of file apart, and knows how big a campaign can get.
- **Setup:** record by hand on a computer. A private table with a live map, a few NPCs, one player signed in. A downloads folder visible in the file manager. An exported editable map file ready for the "wrong file" shot.
- **Thumbnail:** `img/dm-menu-table.jpg`.

| Start | Chapter |
| --- | --- |
| 0:00 | Three kinds of file |
| 0:45 | Download a table backup |
| 1:30 | Restore one |
| 2:30 | How big a campaign can get |
| 3:20 | Habits that save campaigns |

### 1. Three kinds of file (0:00)

**Say:**
> HeroByte makes three kinds of file, and each picker tells you which it was handed.
> A table backup is the whole table. It's in the DM Menu, under Table.
> A character file is one character. It's in that character's settings.
> An editable map is one map. It's under Maps, in the map library.

**Show:**
1. **DM Menu → Table → Backups**: zoom on **Download table backup**, **Restore table backup…**.
2. A character's **⚙️**: zoom on **Save character / Load character…**.
3. **DM Menu → Maps → Map library**: zoom on **Export editable map (.json)**, **Import editable map (.json)**.

### 2. Download a table backup (0:45)

**Say:**
> Download table backup saves the entire table as one file. Tokens, characters, NPCs, props, drawings, dice history, the live map, and uploaded images.
> Private rolls and whispers are left out.
> It still holds secret doors, hidden NPCs and your notes. Keep it to yourself.

**Show:**
1. Type `sunday-2026-10-06` in **Backup file name**. Click **Download table backup**. Zoom: the two sizes it reports.
2. Cut to the downloads folder with the file.

### 3. Restore one (1:30)

**Say:**
> Restore table backup replaces the table for everyone connected. Read the confirmation.
> The map, NPCs, props, drawings and settings become the file's.
> Players keep their own characters and tokens. Nobody's DM status changes.
> Hand it the wrong kind of file and it says so, by name, and loads nothing.

**Show:**
1. Click **Restore table backup…**, pick the editable map file. Zoom: the refusal naming where that file belongs.
2. Click **Restore table backup…** again, pick the backup. Hold on the confirmation; read one line. Confirm. Split screen: the player's table updates.

### 4. How big a campaign can get (2:30)

**Say:**
> A backup has to restore in one go, so a table has a size limit.
> The line beside the map list says where you are: Room for more maps, Nearly full, Full, or Too big to restore.
> Its tooltip shows the exact size. Delete a map you're done with to make room.

**Show:**
1. **Maps → Map library**: zoom on the line (**Room for more maps**); hover for the tooltip.

### 5. Habits that save campaigns (3:20)

**Say:**
> Download a backup at the end of every session. Name it by date.
> Download one before anything risky, like mass deleting.
> On free hosting, the server's disk can reset. The file in your downloads is what you can count on.
> Building on the Main Hall? Save it as a private table before it clears. DM lesson one shows how.

**Show:**
1. Caption list: `Every session, by date.` `Before risky changes.` `Free hosting can reset.`
2. Close on the downloads folder with dated backups.

**Common mistake:** handing a backup to a player. Caption over the backup file: `A table backup holds secret doors, hidden NPCs and GM notes. It's a DM file.`

**Unverified, check before recording:**
- What the download looks like in the recording browser (save dialog or straight to the downloads folder) and that it does not reveal a personal folder path.
- The exact wording of the two sizes **Download table backup** reports.
