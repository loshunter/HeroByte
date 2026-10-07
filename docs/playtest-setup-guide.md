# HeroByte Playtest Setup Guide

## Pre-Playtest Checklist

### 1. Environment Setup

**DM Computer Requirements:**

- Modern browser (Chrome, Edge, or Firefox recommended)
- Stable internet connection
- Microphone for voice chat
- Headphones recommended (prevent echo)

**Player Requirements:**

- Modern browser
- Internet connection
- Microphone (optional but recommended)
- Headphones recommended

### 2. Server Preparation

**Start the Server:**

```bash
# Clone and setup (first time only)
git clone https://github.com/loshunter/HeroByte.git
cd HeroByte
corepack enable pnpm
pnpm install

# Start servers
pnpm dev:server  # Terminal 1
pnpm dev:client  # Terminal 2
```

**Verify Server is Running:**

- Server: http://localhost:8787
- Client: http://localhost:5174

### 3. Room Configuration

**Default Credentials:**

- Room Password: `Fun1`
- DM Password: `FunDM`

**To Change Passwords:**

- **The default table (Main Hall):** its passwords come from the server's `HEROBYTE_ROOM_SECRET` and `HEROBYTE_DM_PASSWORD` settings, read at every start (see [`DEPLOYMENT.md`](../DEPLOYMENT.md)), and cannot be changed from inside the app.
- **A private table:** DM Menu → Table → Security → change the table password, then share the new one with your players. A private table's DM password is the one chosen when the table is made, or set by the first person to enter DM mode on a table made without one (so set it yourself straight away); no screen changes it after that.

## DM Prep Steps (30 minutes before game)

### Step 1: Connect as DM

1. Navigate to http://localhost:5174
2. Enter room password: `Fun1`
3. Click "ENTER TABLE"
4. Open the Table button at the left of the header (on a phone: Tools → Table), choose "Enter DM mode", and enter DM password: `FunDM`

### Step 2: Upload Map

1. Open DM Menu → "Maps" tab
2. In the "Map Background" panel, paste an image URL
3. Click "Apply Background"
4. Adjust map position/scale in the "Map Transform" panel if needed
5. Lock the map to prevent accidental moves

### Step 3: Set Up Player Staging Zone

1. Open DM Menu → "Maps" tab
2. Scroll to the "Player Staging Zone" panel (unlock it with the 🔓 ZONE UNLOCKED toggle if it is locked)
3. Set Center X/Y, Width, and Height in grid tiles to define the spawn area
4. Players will spawn randomly within this zone when they join

### Step 4: Prepare NPCs (Optional)

1. Open DM Menu → "NPCs & Monsters" tab → "+ Add NPC"
2. Set NPC name, portrait, HP
3. Place tokens on map
4. Lock important NPCs to prevent accidental moves

### Step 5: Test Drawing Tools

1. Select "Draw" tool
2. Draw a few test marks
3. Test "Erase drawings" tool (including partial erase)
4. Clear test drawings
5. Verify undo/redo works

### Step 6: Save Initial State

1. Open DM Menu → "Table" tab
2. In the "Backups" section, click "Download table backup"
3. Save the file as `session-start.json`
4. This is your backup if anything goes wrong

## Player Onboarding (First-Time Players)

### Join Instructions

Share with players:

```
Welcome to HeroByte!

1. Go to: http://localhost:5174
   (Or use the IP address: http://192.168.X.X:5174)

2. Enter the room password: Fun1

3. Click ENTER TABLE

4. You'll see your token appear on the map!

5. Click your row in the Party bar (bottom of the screen) to:
   - Set your character name
   - Upload a portrait
   - Set your HP

Need help? Ask the DM!
```

### Quick Player Guide

**Movement:**

- Click and drag your token to move
- Token snaps to grid squares

**HP Tracking:**

- Click your row in the Party bar (bottom of the screen)
- Update HP in the input field
- Press Enter to save

**Dice Rolling:**

- Click "Dice" button
- Select die type (d20, d6, etc.)
- Click "Roll"
- Results appear in Roll Log

**Drawing:**

- Click "Draw" tool
- Draw on map (your drawings only)
- Use "Erase drawings" to remove mistakes

**Voice Chat:**

- Press **🎤 Join voice** (the header on a PC; **Party** on a phone), then **Mute** / **Leave voice**
- Grant the browser's microphone permission when prompted
- On a PC, a speaker's portrait glows on their character card

## During the Game

### DM Controls Quick Reference

**Token Management:**

- Create NPC: DM Menu → "NPCs & Monsters" tab → "+ Add NPC"
- Move any token: Click and drag
- Resize token: Select → Transform handles
- Delete token: Select → Delete key
- Lock token: Select → Click lock icon

**Drawing Tools:**

- Freehand: Freehand drawing
- Line: Straight lines
- Rectangle: Boxes
- Circle: Circles
- Erase drawings: Remove drawings (supports partial erase)
- Clear all drawings: Removes all drawings

**Session Management:**

- Save: DM Menu → "Table" tab → Backups → "Download table backup"
- Load: DM Menu → "Table" tab → Backups → "Restore table backup…"
- Table password: DM Menu → "Table" tab → Security
- Clear drawings: DM Menu → "Maps" tab → "Clear All Drawings"

**Map Controls:**

- Pan: Middle-mouse drag, or drag empty space with no tool active
- Zoom: Mouse wheel
- Right-click: Opens the map-edit quick wheel while in map-edit mode
- Lock Map: Prevent accidental moves

### Player Controls Quick Reference

**Movement:**

- Drag your token to move
- (No W/A/S/D panning — not implemented; drag empty space or middle-mouse drag)

**Stats:**

- HP: your row in the Party bar
- Name: Click name to edit
- Portrait: Click portrait to upload

**Dice:**

- Quick roll: Click d20 icon
- Custom: Build formula in dice roller

**Drawing:**

- Your drawings only
- Cannot erase others' drawings
- Cannot move locked objects

## Troubleshooting

### Players Can't Connect

**Issue**: "Connection failed" or timeout

**Solutions:**

1. Verify server is running: `pnpm dev:doctor` (cross-platform; shows what owns the HeroByte dev ports)
2. Check firewall allows ports 8787 and 5174
3. Try localhost instead of IP (or vice versa)
4. Restart servers

### Voice Chat Not Working

**Issue**: Can't hear players or mic not working

**Solutions:**

1. Grant browser microphone permissions
2. Check system mic settings
3. Try headphones to prevent echo
4. Press **🎤 Join voice** again (or **🔊 Tap to hear voice** if it appears); if someone shows **Can't reach**, try Wi-Fi rather than mobile data

### Lag or Slow Performance

**Issue**: Actions delayed or choppy

**Solutions:**

1. Close other browser tabs
2. Reduce map image size
3. Clear old drawings
4. Check internet connection
5. Limit concurrent players to 6-8

### Token Disappeared

**Issue**: Player token vanished

**Solutions:**

1. Player reconnect (reload page)
2. DM: Check if token off-screen (pan around)
3. Load previous save if needed

### Map Won't Load

**Issue**: Map background not appearing

**Solutions:**

1. Verify image format (PNG, JPG, WebP)
2. Check file size < 10MB
3. Try different image
4. Check browser console for errors

### Session Won't Load

**Issue**: "Restore failed: …" toast when restoring a table backup

**Solutions:**

1. Verify JSON file is valid
2. Check file wasn't corrupted
3. Try earlier save
4. Start fresh and re-import assets

## Post-Playtest

### Save Final State

1. DM: Open DM Menu → "Table" tab → Backups → "Download table backup"
2. Name file with date: `session-2025-10-19.json`
3. Keep for next game

### Collect Feedback

Ask players:

- What worked well?
- What was confusing?
- What features are missing?
- Performance issues?

### Bug Reporting

If you encounter bugs:

1. Note exact steps to reproduce
2. Take screenshot if possible
3. Check browser console (F12) for errors
4. Report at: https://github.com/loshunter/HeroByte/issues

## Recommended Browsers

**Best Support:**

- Chrome/Edge (latest)
- Firefox (latest)

**Limited Support:**

- Safari (WebSocket issues on LAN)

**Not Supported:**

- Internet Explorer
- Very old browser versions

## Network Setup Options

### Option 1: Local Only (Localhost)

- Players and DM on same computer
- URL: http://localhost:5174
- Best for testing

### Option 2: LAN (Local Network)

- Players on same WiFi as DM
- Find DM's IP: `ipconfig` (Windows) or `ip addr` / `ifconfig` (macOS/Linux)
- URL: http://192.168.X.X:5174
- Add the matching origin to `HEROBYTE_ALLOWED_ORIGINS`, for example `http://192.168.X.X:5174`
- Best for in-person games

### Option 3: Public (Internet)

- Deploy to Cloudflare Pages or similar
- See DEPLOYMENT.md for instructions
- Best for remote games

## Tips for a Smooth Session

1. **Start 15 minutes early** - Time for technical issues
2. **Test with one player first** - Verify everything works
3. **Keep saves frequently** - Every major milestone
4. **Have backup plan** - Theater of mind if tech fails
5. **Set expectations** - This is beta software
6. **Take notes** - Document bugs and UX issues
7. **Stay positive** - Focus on what works!

## Next Steps

After your playtest:

1. Review feedback
2. Report critical bugs
3. Suggest features
4. Share your experience!

**Happy Gaming! 🎲**
