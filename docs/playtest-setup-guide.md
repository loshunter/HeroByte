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
- Client: http://localhost:5173

### 3. Room Configuration

**Default Credentials:**
- Room Password: `herobyte`
- DM Password: `dmpass`

**To Change Passwords:**
1. Connect as DM
2. Open DM Menu
3. Update Room Password and/or DM Password
4. Share new room password with players

## DM Prep Steps (30 minutes before game)

### Step 1: Connect as DM
1. Navigate to http://localhost:5173
2. Enter room password: `herobyte`
3. Click "Connect"
4. Click "DM" button and enter DM password: `dmpass`

### Step 2: Upload Map
1. Open DM Menu
2. Click "Upload Map"
3. Select your battle map image
4. Adjust map position/scale if needed
5. Lock the map to prevent accidental moves

### Step 3: Set Up Player Staging Zone
1. Open DM Menu
2. Click "Set Staging Zone"
3. Click and drag on map to create spawn area for players
4. Players will spawn randomly within this zone when they join

### Step 4: Prepare NPCs (Optional)
1. Open DM Menu → "Create NPC"
2. Set NPC name, portrait, HP
3. Place tokens on map
4. Lock important NPCs to prevent accidental moves

### Step 5: Test Drawing Tools
1. Select "Draw" tool
2. Draw a few test marks
3. Test "Erase" tool (including partial erase)
4. Clear test drawings
5. Verify undo/redo works

### Step 6: Save Initial State
1. Open DM Menu
2. Click "Save Session"
3. Save file as `session-start.json`
4. This is your backup if anything goes wrong

## Player Onboarding (First-Time Players)

### Join Instructions
Share with players:

```
Welcome to HeroByte!

1. Go to: http://localhost:5173
   (Or use the IP address: http://192.168.X.X:5173)

2. Enter the room password: herobyte

3. Click Connect

4. You'll see your token appear on the map!

5. Click your player card (right side) to:
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
- Click your player card (right panel)
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
- Use "Erase" to remove mistakes

**Voice Chat:**
- Click microphone icon to enable/disable
- Grant browser permissions when prompted
- Green glow = you're speaking

## During the Game

### DM Controls Quick Reference

**Token Management:**
- Create NPC: DM Menu → "Create NPC"
- Move any token: Click and drag
- Resize token: Select → Transform handles
- Delete token: Select → Delete key
- Lock token: Select → Click lock icon

**Drawing Tools:**
- Draw: Freehand drawing
- Line: Straight lines
- Rectangle: Boxes
- Circle: Circles
- Erase: Remove drawings (supports partial erase)
- Clear All: Removes all drawings

**Session Management:**
- Save: Export current state
- Load: Import saved session
- Reset: Clear all except map

**Map Controls:**
- Pan: Middle mouse or right-click drag
- Zoom: Mouse wheel
- Center: Double-click empty space
- Lock Map: Prevent accidental moves

### Player Controls Quick Reference

**Movement:**
- Drag your token to move
- W/A/S/D keys (if implemented)

**Stats:**
- HP: Edit in player card
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
1. Verify server is running: `lsof -i :8787 -i :5173`
2. Check firewall allows ports 8787 and 5173
3. Try localhost instead of IP (or vice versa)
4. Restart servers

### Voice Chat Not Working

**Issue**: Can't hear players or mic not working

**Solutions:**
1. Grant browser microphone permissions
2. Check system mic settings
3. Try headphones to prevent echo
4. Refresh page and reconnect

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

**Issue**: "Failed to load session" error

**Solutions:**
1. Verify JSON file is valid
2. Check file wasn't corrupted
3. Try earlier save
4. Start fresh and re-import assets

## Post-Playtest

### Save Final State
1. DM: Open DM Menu → "Save Session"
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
- URL: http://localhost:5173
- Best for testing

### Option 2: LAN (Local Network)
- Players on same WiFi as DM
- Find DM's IP: `ip addr` or `ifconfig`
- URL: http://192.168.X.X:5173
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
