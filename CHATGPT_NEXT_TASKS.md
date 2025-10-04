# ChatGPT Next Tasks

## ✅ Completed
- **Phase 1-3**: Testing Infrastructure & CI/CD (54 tests, 99.57% shared coverage)
- **Contributor Polish**: CONTRIBUTING.md + GitHub templates
- **Code Hygiene (Tasks 1-4)**: Zero-warning codebase achieved
  - Task 1: Client Lint Fixes (0 warnings, 24 files cleaned)
  - Task 2: Server `any` Type Cleanup (0 warnings, 6 files hardened)
  - Task 3: Unused Imports Removed (30 files total)
  - Task 4: Zero-Warning Enforcement Locked In

---

## 🎯 Current Focus: Phase 9 - Core State & Persistence

**Goal**: Implement save/load functionality, redo support, and persistence utilities for HeroByte.

### Overview
Phase 9 focuses on making game state persistent and recoverable. Players should be able to save/load their character data, DMs should be able to save entire sessions, and the undo system needs redo support.

### What's Already Done
- ✅ Ctrl+Z undo for drawings (working in `useDrawingState.ts` + `App.tsx`)
- ✅ Drawing history stack implemented
- ✅ Server-side undo-drawing message handler

### Tasks to Complete (In Order)

---

## Task 1: Add Redo Support (Ctrl+Y)

**Problem**: Undo works (Ctrl+Z), but there's no redo functionality.

**Solution**: Implement redo stack and Ctrl+Y keyboard handler.

### Current Implementation
- `apps/client/src/hooks/useDrawingState.ts` - Has undo history stack
- `apps/client/src/ui/App.tsx` - Has Ctrl+Z handler that sends `undo-drawing` message

### Steps

1. **Update `useDrawingState.ts`**
   - Add `redoHistory: string[]` state (stores undone drawing IDs)
   - Add `canRedo: boolean` computed value
   - Add `addToRedoHistory(drawingId: string)` function
   - Add `popFromRedoHistory(): string | undefined` function
   - Modify `addToHistory()` to clear redo stack when new drawing is added
   - Return new values in hook interface

2. **Update Shared Types**
   - Location: `packages/shared/src/index.ts`
   - Add new client message type:
     ```typescript
     | { t: "redo-drawing" }
     ```

3. **Add Server Handler**
   - Location: `apps/server/src/ws/messageRouter.ts`
   - Add case for `"redo-drawing"` message
   - Implement redo logic (restore most recently undone drawing)
   - Send updated room state to all clients

4. **Update Client Keyboard Handler**
   - Location: `apps/client/src/ui/App.tsx`
   - Add Ctrl+Y / Cmd+Y handler (similar to existing Ctrl+Z)
   - Send `{ t: "redo-drawing" }` message when pressed
   - Check `canRedo` before sending

5. **Test the Feature**
   ```bash
   pnpm dev
   ```
   - Draw something
   - Press Ctrl+Z (should undo)
   - Press Ctrl+Y (should redo)
   - Draw something new (redo stack should clear)

### Success Criteria
- ✅ Ctrl+Y restores last undone drawing
- ✅ Redo stack clears when new drawing is added
- ✅ Works in both draw modes (freehand, shapes, etc.)
- ✅ All tests still pass

---

## Task 2: Player State Persistence

**Problem**: Players lose their character data (name, portrait, HP, etc.) on page refresh.

**Solution**: Implement save/load functionality for individual player state.

### Steps

1. **Create PlayerState Interface**
   - Location: `packages/shared/src/models.ts`
   - Add interface:
     ```typescript
     export interface PlayerState {
       name: string;
       portrait: string;
       hp: number;
       maxHp: number;
       micLevel: number;
       // Add any other player-specific state
     }
     ```

2. **Create Persistence Utility**
   - Location: `apps/client/src/utils/playerPersistence.ts`
   - Implement:
     ```typescript
     export function savePlayerState(player: PlayerState): void {
       // Create JSON blob
       // Trigger download as "player-{name}.json"
     }

     export function loadPlayerState(file: File): Promise<PlayerState> {
       // Read file
       // Parse JSON
       // Validate schema
       // Return PlayerState
     }
     ```

3. **Add Save/Load Buttons to PlayerCard**
   - Location: `apps/client/src/features/party/components/PlayerCard.tsx`
   - Add "Save" button (downloads JSON)
   - Add "Load" button (file input)
   - Wire up to persistence utilities

4. **Add Client Message Types**
   - Location: `packages/shared/src/index.ts`
   - Add:
     ```typescript
     | { t: "load-player-state"; state: PlayerState }
     ```

5. **Add Server Handler**
   - Location: `apps/server/src/ws/messageRouter.ts`
   - Handle `load-player-state` message
   - Update player in room state
   - Broadcast updated state to all clients

6. **Test the Feature**
   - Create a player with custom name, portrait, HP
   - Click "Save" (should download JSON)
   - Refresh page (state lost)
   - Click "Load" and select saved file
   - Verify state restored

### Success Criteria
- ✅ Save button downloads valid JSON file
- ✅ Load button restores player state from file
- ✅ Schema validation prevents corrupt data
- ✅ Other players see updated state

---

## Task 3: Session Save/Load

**Problem**: DMs lose entire session state (all players, tokens, drawings, map) on refresh.

**Solution**: Implement full session snapshot save/load.

### Steps

1. **Create Session Persistence Utility**
   - Location: `apps/client/src/utils/sessionPersistence.ts`
   - Implement:
     ```typescript
     import { RoomSnapshot } from "@shared/index";

     export function saveSession(snapshot: RoomSnapshot): void {
       // Create JSON blob from entire RoomSnapshot
       // Trigger download as "herobyte-session-{timestamp}.json"
     }

     export function loadSession(file: File): Promise<RoomSnapshot> {
       // Read file
       // Parse JSON
       // Validate RoomSnapshot schema
       // Return RoomSnapshot
     }
     ```

2. **Add Save/Load Buttons to Header**
   - Location: `apps/client/src/features/header/Header.tsx`
   - Add "Save Session" button (downloads full snapshot)
   - Add "Load Session" button (file input)
   - Wire up to sessionPersistence utilities

3. **Add Client Message Type**
   - Location: `packages/shared/src/index.ts`
   - Add:
     ```typescript
     | { t: "load-session"; snapshot: RoomSnapshot }
     ```

4. **Add Server Handler**
   - Location: `apps/server/src/ws/messageRouter.ts`
   - Handle `load-session` message
   - Use existing `RoomService.loadSnapshot()` (already typed from Task 2 of Code Hygiene!)
   - Broadcast new session to all clients

5. **Test the Feature**
   - Create session with multiple players, tokens, drawings
   - Click "Save Session" (should download JSON)
   - Refresh or clear page
   - Click "Load Session" and select file
   - Verify everything restored (players, tokens, drawings, map state)

### Success Criteria
- ✅ Save downloads complete session JSON
- ✅ Load restores full session state
- ✅ All players, tokens, drawings restored correctly
- ✅ Map background and grid settings preserved

---

## Task 4: Connection Status Indicator

**Problem**: No visual feedback for connection state (connected, disconnected, reconnecting).

**Solution**: Add connection status indicator to UI.

### Steps

1. **Update WebSocket Hook**
   - Location: `apps/client/src/hooks/useWebSocket.ts`
   - Add connection state tracking:
     ```typescript
     const [connectionState, setConnectionState] = useState<
       "connected" | "disconnected" | "reconnecting"
     >("disconnected");
     ```
   - Update state on connection events

2. **Add Status Indicator Component**
   - Location: `apps/client/src/features/header/components/ConnectionStatus.tsx`
   - Create component showing:
     - 🟢 Connected (green dot + text)
     - 🔴 Disconnected (red dot + text)
     - 💤 Reconnecting (yellow dot + text)

3. **Add to Header**
   - Location: `apps/client/src/features/header/Header.tsx`
   - Import and render ConnectionStatus component
   - Position in header (top-right corner)

4. **Test the Feature**
   - Start dev server
   - Check status shows "🟢 Connected"
   - Stop server
   - Check status changes to "🔴 Disconnected"
   - Restart server
   - Check status shows "💤 Reconnecting" then "🟢 Connected"

### Success Criteria
- ✅ Status indicator visible in header
- ✅ Correctly shows connected/disconnected/reconnecting states
- ✅ Updates in real-time on connection changes

---

## Task 5: Add UI Tooltips

**Problem**: New features (Save/Load, Undo/Redo) lack user guidance.

**Solution**: Add tooltips to buttons explaining keyboard shortcuts and functionality.

### Steps

1. **Add Tooltip Component** (if not exists)
   - Location: `apps/client/src/components/Tooltip.tsx`
   - Simple hover tooltip using CSS or library

2. **Add Tooltips to Drawing Toolbar**
   - Location: `apps/client/src/features/map/components/DrawingToolbar.tsx`
   - Add tooltips:
     - Undo button: "Undo (Ctrl+Z)"
     - Redo button: "Redo (Ctrl+Y)"

3. **Add Tooltips to PlayerCard**
   - Location: `apps/client/src/features/party/components/PlayerCard.tsx`
   - Add tooltips:
     - Save button: "Save player state to file"
     - Load button: "Load player state from file"

4. **Add Tooltips to Header**
   - Location: `apps/client/src/features/header/Header.tsx`
   - Add tooltips:
     - Save Session: "Save entire session to file"
     - Load Session: "Load session from file"

### Success Criteria
- ✅ All new buttons have helpful tooltips
- ✅ Tooltips show keyboard shortcuts where applicable
- ✅ Tooltips appear on hover

---

## After Task 5 Completion

Once all 5 tasks are done:

1. **Run Full Test Suite**
   ```bash
   pnpm test
   pnpm lint
   pnpm build
   ```

2. **Commit Changes**
   ```bash
   git add .
   git commit -m "Complete Phase 9: Redo support, player/session persistence, connection status, tooltips"
   git push origin dev
   ```

3. **Update TODO.md**
   - Mark Phase 9 items as complete

4. **Report Summary**
   - Redo support added (Ctrl+Y)
   - Player state save/load implemented
   - Session save/load implemented
   - Connection status indicator added
   - UI tooltips added for guidance

---

## Important Notes

### What NOT to Implement (Already Done or Out of Scope)

- ❌ **Undo for drawings** - Already working via Ctrl+Z
- ❌ **Drawing history stack** - Already implemented in useDrawingState.ts
- ❌ **Asset Manager** - Deferred to Phase 10
- ❌ **Private Room System** - Deferred to Phase 10
- ❌ **Room name display** - Part of private rooms (Phase 10)

### Testing Reminders

- Always run `pnpm test` after changes
- Test both keyboard shortcuts AND button clicks
- Test edge cases (empty files, corrupt JSON, etc.)
- Verify WebSocket messages work in multiplayer scenario

### Code Quality

- Follow existing patterns in the codebase
- Use TypeScript strict mode (no `any` types!)
- Add JSDoc comments to new functions
- Keep functions small and focused (SOLID principles)

---

## 🚀 Let's Get Started!

Work through tasks **in order** (Task 1 → Task 2 → Task 3 → Task 4 → Task 5).

Each task builds on the previous one:
- Task 1: Redo support (completes undo/redo system)
- Task 2: Player persistence (single player save/load)
- Task 3: Session persistence (full session save/load)
- Task 4: Connection status (user feedback)
- Task 5: Tooltips (polish and guidance)

Report back when each task is complete, or if you encounter any blockers!
