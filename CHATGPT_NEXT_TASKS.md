# ChatGPT Next Tasks

## ✅ Completed

- **Phase 1-3**: Testing Infrastructure & CI/CD (54 tests, 75% coverage)
- **Contributor Polish**: CONTRIBUTING.md + GitHub templates
- **Code Hygiene (Tasks 1-4)**: Zero-warning codebase achieved
- **Production Deployment**: Live at https://herobyte.pages.dev

---

## 🎯 Current Focus: Scene Graph & Transform Overhaul

**Goal**: Treat every drawable entity (map, tokens, drawings, props) as a unified scene object that can be selected, transformed, and locked. This unlocks future systems like initiative ordering, status overlays, and map manipulation without bespoke codepaths.**

### Guiding Principles

- Single source of truth for renderable objects (scene graph with z-order and lock state)
- Shared transform toolbox (select, move, rotate, scale) applied consistently
- Fine-grained permissions: players alter their own pieces; DM can override/lock
- Backward compatibility: migrate existing drawings/tokens into the new model

### Phase Breakdown

1. **Scene Object Model & Migration (Critical)**
   - Define `SceneObject` interface in shared package (id, type, position, scale, rotation, locked, metadata)
   - Update server room state to store drawings/tokens/map as `SceneObject[]`
   - Write migration utilities to convert existing room snapshot into scene objects on load
   - Adjust broadcast payloads + validation schemas

2. **Client-Side Scene Graph Layer (Critical)**
   - Introduce `useSceneObjects` hook to subscribe to unified object list
   - Render layers filter by object type (map/tokens/drawings) but reuse shared transform wrapper
   - Build selection manager for single/multi select; broadcast selection intent for remote awareness (MVP local only)

3. **Transform Gizmo & Edit Pipeline (Critical)**
   - Create reusable transform handles (Konva Group wrapper) supporting translate, rotate, scale with locking
   - Emit new `{ t: "transform-object"; id; position; scale; rotation }` message
   - Server: authorize (owner/DM), update object state, broadcast
   - Add lock toggle to player/NPC settings; DM menu gets lock/unlock map & global objects

4. **Map-as-Object & Layer Ordering (High)**
   - Load map image into `SceneObject` with `type: "map"`, negative z-order so it always sits behind
   - DM menu: map transform controls (scale, rotate, position) + lock button
   - Ensure transform gizmo respects viewport zoom/pan

5. **Drawing Refactor (High)**
   - Convert drawing history entries into individual `SceneObject` instances (type-specific metadata: points, color, width)
   - Selection/transform: allow moving/scaling/rotating drawings; support multi-select for group operations
   - Update undo/redo stack to operate on IDs

6. **Token Enhancements (Medium)**
   - Allow rotate/scale on tokens when unlocked
   - Persist per-token lock state + DM override
   - Prep for initiative ordering by storing optional `initiative` metadata

7. **Future Hooks (Nice to Have)**
   - Status effect overlays rendered as child objects anchored to parent token
   - Terrain props / fog-of-war as additional object types
   - Snap-to-grid toggle for transforms

### Success Criteria

- ✅ All interactive elements share the same transform controls and lock behavior
- ✅ Map, tokens, and drawings can be repositioned, rotated, scaled (within permissions)
- ✅ Locked objects ignore transform attempts until unlocked
- ✅ Server enforces ownership/lock rules for `transform-object` messages
- ✅ No regressions to undo/redo, save/load workflows (scene objects serialize cleanly)

4. **Update Shared Types**
   - Location: `packages/shared/src/index.ts`
   - Add message type:
     ```typescript
     | { t: "load-session"; snapshot: RoomSnapshot }
     ```

5. **Add Server Handler**
   - Location: `apps/server/src/ws/messageRouter.ts`
   - Handle `load-session` message
   - Validate snapshot
   - Replace room state with loaded snapshot
   - Broadcast new state to all clients

6. **Test the Feature**
   - Create session with NPCs, tokens, drawings, map
   - Click "Save Game State" (downloads JSON)
   - Refresh page (state lost)
   - Click "Load Game State" and select file
   - Verify everything restored

### Success Criteria

- ✅ Save downloads complete session JSON
- ✅ Load restores full session state
- ✅ All NPCs, tokens, drawings, map restored correctly
- ✅ Grid settings preserved
- ✅ DM can prepare session days in advance and reload it

---

## Task 4: Move Dangerous Controls to DM-Only

**Problem**: Players can accidentally clear all drawings or mess up the grid. Too risky.

**Solution**: Move destructive actions behind DM role check.

### Steps

1. **Remove "Clear All" from Public Drawing Toolbar**
   - Location: `apps/client/src/features/map/components/DrawingToolbar.tsx`
   - Remove "Clear All" button from toolbar
   - Move to DM Menu (already done in Task 1)

2. **Remove Grid Controls from Public Interface**
   - Location: `apps/client/src/features/map/components/MapControls.tsx` (or wherever grid controls are)
   - Remove grid size slider
   - Remove grid lock toggle
   - These are now DM-only in DM Menu

3. **Add DM Role Check to Components**
   - Use `useDMRole()` hook from Task 1
   - Only render DM-specific controls if `isDM === true`

### Success Criteria

- ✅ "Clear All" button removed from public drawing toolbar
- ✅ Grid controls removed from public interface
- ✅ All dangerous controls only accessible via DM Menu
- ✅ DM Menu only visible when DM mode is toggled on
- ✅ Non-DM players can't accidentally mess up the session

**Note**: For MVP, we're using trust-based DM mode (no server-side validation). Players are expected to only toggle DM mode if they're actually the DM. Phase 10 will add proper authorization when private rooms are implemented.

---

## Task 5: Fix Token/Drawing Movement Flicker

**Problem**: When dragging tokens or drawings, they flicker to original position briefly before settling.

**Solution**: Investigate and fix the drag end behavior in Konva layers.

### Steps

1. **Investigate Current Drag Implementation**
   - Location: `apps/client/src/features/map/components/TokensLayer.tsx`
   - Check `onDragEnd` handler
   - Look for state updates that might cause re-render during drag

2. **Likely Causes**
   - State update on drag end triggers re-render with old position
   - WebSocket message arrives with old position after local update
   - Konva drag state not syncing with React state correctly

3. **Potential Fix (Optimistic Updates)**
   - Update local state immediately on drag start
   - Send WebSocket message on drag end
   - Ignore incoming position updates for the token being dragged
   - Add `isDragging` flag to token state (client-only)

4. **Test Drawing Movement Too**
   - Same issue might affect drawings in select mode
   - Apply same fix pattern

5. **Verify Fix**
   - Drag token slowly to destination
   - Release
   - Should not flicker back to origin
   - Other clients should see smooth movement

### Success Criteria

- ✅ No flicker when releasing tokens
- ✅ No flicker when releasing drawings in select mode
- ✅ Movement feels smooth and polished
- ✅ Multiplayer sync still works correctly

---

## Task 6: Viewport Controls (Snap & Recenter)

**Problem**: No way to snap to player tokens or recenter map if you get lost.

**Solution**: Add viewport navigation controls.

### Steps

1. **Add Snap to Token Button on Player Portraits**
   - Location: `apps/client/src/features/party/components/PlayerCard.tsx`
   - Add small button/icon (📍 or camera icon)
   - On click: Find player's token, animate camera to center on it

2. **Implement Camera Animation**
   - Location: `apps/client/src/hooks/useCamera.ts`
   - Add `animateTo(x: number, y: number, scale?: number)` function
   - Use smooth transition (Konva.Tween or CSS transition)

3. **Add "Recenter Map" Button**
   - Location: `apps/client/src/features/map/components/MapControls.tsx` (or header)
   - Button with home icon 🏠 or "Reset View"
   - On click: Animate camera to (0, 0, 1) - default view

4. **Wire Up to Token Positions**
   - When clicking player portrait button:
     - Find token with matching owner UID
     - Get token's (x, y) position
     - Call `animateTo(tokenX, tokenY, 1.5)` - zoom in slightly

### Success Criteria

- ✅ Clicking player portrait button centers on their token
- ✅ "Recenter Map" button returns to default view
- ✅ Camera animation is smooth (not instant jump)
- ✅ Works with current pan/zoom controls

---

## Task 7: Enhanced Selection Tools

**Problem**: Can only select one drawing at a time. No multi-select with drag rectangle.

**Solution**: Add rectangular selection tool and multi-select support.

### Steps

1. **Add Selection Rectangle Tool**
   - Location: `apps/client/src/features/map/components/SelectionLayer.tsx` (new file)
   - In "Select" mode, allow click-drag to create selection rectangle
   - Show blue translucent rectangle during drag
   - On release: Select all drawings that intersect rectangle

2. **Update Selection State**
   - Location: `apps/client/src/hooks/useDrawingState.ts`
   - Change `selectedDrawing: string | null` to `selectedDrawings: string[]`
   - Update all references to support array

3. **Multi-Select Actions**
   - Delete: Remove all selected drawings
   - Move: Move all selected drawings together (group drag)
   - Deselect: Click empty area to clear selection

4. **Make Tokens Selectable Too**
   - Location: `apps/client/src/features/map/components/TokensLayer.tsx`
   - In "Select" mode, allow clicking tokens to select them
   - Show selection highlight (border or glow)
   - Support multi-select with Ctrl/Cmd+Click

5. **Selection Visual Feedback**
   - Selected drawings: Show thicker stroke or highlight color
   - Selected tokens: Show border or glow effect
   - Selection rectangle: Blue translucent with dashed border

### Success Criteria

- ✅ Can drag rectangle to select multiple drawings
- ✅ Can delete multiple selected drawings at once
- ✅ Can select tokens in select mode
- ✅ Multi-select with Ctrl/Cmd+Click works
- ✅ Clear visual feedback for what's selected

---

## Task 8: Improved Roll Display

**Problem**: Roll log lacks detail. "Copy as text" button is unnecessary.

**Solution**: Enhance roll breakdown display, remove copy button.

### Steps

1. **Remove "Copy as Text" Button**
   - Location: `apps/client/src/features/dice/components/RollLog.tsx` (or similar)
   - Find and remove the copy button
   - Clean up related code

2. **Enhance Roll Breakdown Display**
   - Current: "Result: 23"
   - New format:
     ```
     Result: 23
     2d20 (4, 17) + 3d4 (1, 1, 4, 2) + 2
     ```
   - Show formula in smaller, darker text below result
   - Include individual die results in parentheses

3. **Update Roll Message Format**
   - Location: `packages/shared/src/index.ts`
   - Ensure dice-roll message includes full breakdown
   - Or calculate breakdown from existing data

4. **Style the Formula Display**
   - Font size: 0.85em
   - Color: rgba(255, 255, 255, 0.6) - dimmed
   - Position: Below the main result
   - Add slight spacing

### Success Criteria

- ✅ "Copy as text" button removed
- ✅ Roll log shows detailed formula
- ✅ Formula includes individual die results
- ✅ Formula is visually distinct (smaller, dimmed)
- ✅ Easy to read and understand

---

## Task 9: Private Lobbies & Password Protection (PHASE 10)

**Problem**: No way to create private game sessions. Anyone can join the live demo.

**⚠️ DEFER TO PHASE 10**: This is a major architectural change requiring:

- Room ID system (instead of single global room)
- URL routing (`/room/ABC123`)
- Password authentication
- Room creation flow
- Separation of public demo vs. private games

**Current Workaround**: Live demo at herobyte.pages.dev is public sandbox. For private games, players can run locally or wait for Phase 10.

---

## After Task 8 Completion

Once Tasks 1-8 are done, HeroByte will be **fully playable** for game sessions!

### Testing Checklist

1. **DM Workflow**
   - [ ] Open app, become DM (first player)
   - [ ] Load map background via DM Menu
   - [ ] Set grid size and lock it
   - [ ] Add 3 NPCs with portraits and token images
   - [ ] Place NPC tokens on map
   - [ ] Draw some encounter areas
   - [ ] Save game state as JSON
   - [ ] Refresh page
   - [ ] Load game state from JSON
   - [ ] Verify everything restored

2. **Player Workflow**
   - [ ] Join as player (second client/incognito)
   - [ ] Set name and portrait
   - [ ] Set custom token image
   - [ ] Move token around map
   - [ ] Cannot see DM Menu
   - [ ] Cannot change grid or clear drawings
   - [ ] Roll dice, see detailed results
   - [ ] Click portrait to snap to own token

3. **Combat Simulation**
   - [ ] DM places monsters
   - [ ] Players move tokens into position
   - [ ] DM draws area effect (fireball)
   - [ ] Players update HP
   - [ ] DM deletes defeated monster tokens
   - [ ] Save state mid-combat
   - [ ] Reload and continue

### Commit & Deploy

```bash
pnpm test
pnpm lint
pnpm build
git add .
git commit -m "Complete Phase 9: DM Tools & Session Management

Implemented full game session workflow:
- DM Menu with map setup, NPC management, session save/load
- Token image upload for players and NPCs
- Save/load game state as JSON
- DM-only controls (protect from accidental player actions)
- Fixed token/drawing movement flicker
- Viewport controls (snap to token, recenter map)
- Enhanced selection with multi-select rectangle
- Improved roll display with detailed formula
- Phase 10: Private lobbies deferred (major feature)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin dev
```

---

## Important Notes

### DM Role Logic (MVP)

For Phase 9, use **trust-based DM toggle**:

- **Any player can toggle DM mode on/off** via checkbox in DM Menu
- Add `isDM: boolean` to Player model (defaults to false)
- DM Menu only appears when player has DM mode enabled
- Multiple players can be DMs simultaneously (co-DM support)
- **No server-side authorization** - players are trusted not to abuse this

**Why this works:**

- VTTs are used by friends playing together
- Trust is implicit in tabletop gaming
- Simplifies implementation (no auth logic needed)
- Flexible (anyone can become DM mid-session if needed)

Phase 10 will add proper authorization when private rooms are implemented (DM password, room creator privileges, etc.).

### File Format for Save/Load

Use existing `RoomSnapshot` type - it already includes:

- All players (name, HP, portrait)
- All tokens (position, owner, imageUrl)
- All drawings
- Map state (background, grid settings)

Just add timestamp and session name to wrapper:

```typescript
{
  sessionName: "Dragon's Lair - Session 3",
  savedAt: "2025-10-04T16:30:00Z",
  snapshot: RoomSnapshot
}
```

### Testing Reminders

- Test in TWO browser windows (DM + Player) for multiplayer
- Test save/load with complex state (many NPCs, drawings, tokens)
- Test error cases (corrupt JSON, missing images, etc.)
- Verify DM controls are truly hidden from players (server-side validation!)

---

## 🚀 Ready to Build!

Work through Tasks 1-8 in order. Each builds on the previous:

1. **Task 1**: DM Menu foundation (all DM tools in one place)
2. **Task 2**: Token customization (players + NPCs)
3. **Task 3**: Save/Load (makes sessions persistent)
4. **Task 4**: DM-only guards (prevents accidents)
5. **Task 5**: Fix flicker (polish UX)
6. **Task 6**: Viewport nav (better navigation)
7. **Task 7**: Multi-select (advanced editing)
8. **Task 8**: Roll display (better feedback)

Report back after each task, or if blockers arise! 🎲
