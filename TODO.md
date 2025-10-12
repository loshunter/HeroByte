# HeroByte TODO

## CRITICAL: Contributor Readiness (BLOCKING)

**These items are essential for making the repo stable and contributor-friendly.**

_Completed milestones are archived in [DONE.md](DONE.md) to keep this list focused on upcoming work._

### Testing Infrastructure

- [ ] **E2E Tests** (optional for now) — unit/integration coverage complete (see `DONE.md`)
  - [x] Add Playwright smoke test for default room login
  - [ ] Set up Playwright or Cypress
  - [ ] Test critical user flows (join session, move token, roll dice)

### README Improvements

- [ ] **Visual Assets**
  - [ ] Add screenshots of gameplay (map, dice roller, voice chat)
  - [ ] Add GIF/video demo of core features
  - [ ] Show UI for drawing tools, token movement

- [ ] **Better Documentation**
  - [x] Add "Running Tests" section with `pnpm test` examples
  - [x] Expand "Contributing" section with PR workflow
  - [x] Add troubleshooting section (common issues)
  - [ ] Add architecture diagram (optional)

### Security Hardening

- [ ] **Schema Validation** ✅ (Already have input validation middleware)
- [ ] **Authentication System**
  - [ ] Basic room passwords (Phase 9 covers this)
  - [ ] Player identity verification
  - [ ] DM authentication for private rooms

- [ ] **Additional Security**
  - [x] CORS configuration review
  - [x] WebSocket origin validation

### Community & Governance

- [ ] **Public Roadmap**
  - [ ] Create GitHub Projects board
  - [ ] Link roadmap in README
  - [ ] Label issues by priority (P0, P1, P2)

### Networking Follow-up

- [ ] Investigate LAN access (Safari failing to load at `http://192.168.50.226:5173` despite allowed origins) and document resolution

---

_Completed phase summaries now live in [DONE.md](DONE.md)._

## Phase 13: Selection & Drawing Polish (Future)

**Priority**: High - Critical UX improvements for drawing and object manipulation

### Selection State Management

- [ ] **Message Protocol**
  - [ ] Add `select-object` message type to @shared (uid, objectId)
  - [ ] Add `deselect-object` message type to @shared
  - [ ] Add `select-multiple` message type for multi-select
  - [ ] Add validation middleware for selection messages

- [ ] **Server-Side Selection Tracking**
  - [ ] Add selection tracking to RoomState (Map<uid, selectedObjectId | selectedObjectIds[]>)
  - [ ] Implement selection broadcast in RoomService
  - [ ] Handle selection conflicts (two users selecting same object)
  - [ ] Clear selection when object is deleted

- [ ] **Client-Side Selection Manager**
  - [ ] Create `useObjectSelection` hook
  - [ ] Single-click to select scene objects (tokens, drawings, map)
  - [ ] ESC key to deselect
  - [ ] Visual selection indicator (highlight border around selected object)
  - [ ] Integrate TransformGizmo with selected objects
  - [ ] Selection state synchronized across clients in real-time

- [ ] **Multi-Select (Optional)**
  - [ ] Shift+click for multi-select
  - [ ] Ctrl+click to add/remove from selection
  - [ ] Drag rectangle selection (marquee tool)
  - [ ] Bulk transform operations (move all selected)
  - [ ] Group lock/unlock
  - [ ] Visual indicator showing multiple selected objects

### Partial Erasing for Freehand Drawings

**Current Issue**: Eraser deletes entire drawings when touching any part. Users cannot erase just a portion of a detailed sketch.

**Goal**: Allow erasing parts of freehand drawings, splitting them into segments. Lines/shapes still get fully deleted (they're simple enough to redraw).

**Methodology**: Test-Driven Development (write tests first, then implement)

- [ ] **Phase 1: TDD - Write Tests First**
  - [ ] Create `partialErasing.test.ts` test file
  - [ ] Test: `splitFreehandDrawing()` removes middle → creates 2 segments
  - [ ] Test: `splitFreehandDrawing()` removes start → creates 1 segment
  - [ ] Test: `splitFreehandDrawing()` removes end → creates 1 segment
  - [ ] Test: `splitFreehandDrawing()` removes entire drawing → returns empty array
  - [ ] Test: Multiple erase passes create correct segments
  - [ ] Test: Filter out segments with < 2 points
  - [ ] Test: Preserve drawing properties (color, width, opacity, owner)
  - [ ] Test: Handle transformed drawings (moved/rotated coordinates)
  - [ ] Test: Edge case - eraser path doesn't intersect (returns original)
  - [ ] Test: Edge case - very close points near eraser boundary
  - [ ] Run tests - all should FAIL (red phase) ❌

- [ ] **Phase 2: TDD - Implement Core Logic**
  - [ ] Create `splitFreehandDrawing(drawing, eraserPath, eraserWidth)` utility function
  - [ ] Implement point-to-eraser distance calculation
  - [ ] Mark points as "keep" or "erase" based on distance < hitRadius
  - [ ] Group consecutive "keep" points into segments
  - [ ] Filter out segments with < 2 points
  - [ ] Handle edge cases: entire drawing erased, only start/end erased, multiple gaps
  - [ ] Run tests - core splitting tests should PASS (green phase) ✅

- [ ] **Phase 3: TDD - Message Protocol Tests**
  - [ ] Add test: `erase-partial` message validation accepts valid message
  - [ ] Add test: `erase-partial` message validation rejects missing fields
  - [ ] Add test: `erase-partial` message validation rejects invalid segment data
  - [ ] Add test: Message router routes `erase-partial` to correct handler
  - [ ] Run tests - all should FAIL (red phase) ❌

- [ ] **Phase 4: TDD - Implement Message Protocol**
  - [ ] Create new `erase-partial` message type in @shared/index.ts
  - [ ] Message schema: `{ t: "erase-partial", deleteId: string, segments: DrawingData[] }`
  - [ ] Add validation middleware for erase-partial messages
  - [ ] Update messageRouter to handle erase-partial
  - [ ] Run tests - message protocol tests should PASS (green phase) ✅

- [ ] **Phase 5: TDD - Server-Side Processing Tests**
  - [ ] Add test: Server deletes original drawing atomically
  - [ ] Add test: Server creates all segments atomically
  - [ ] Add test: Transaction fails if deleteId not found
  - [ ] Add test: Broadcast erase-partial to all clients
  - [ ] Add test: Scene graph updated with new segments
  - [ ] Run tests - all should FAIL (red phase) ❌

- [ ] **Phase 6: TDD - Implement Server Processing**
  - [ ] Implement RoomService.handlePartialErase() method
  - [ ] Delete original drawing from state
  - [ ] Create new segment drawings with unique IDs
  - [ ] Update scene graph atomically
  - [ ] Broadcast changes to all clients
  - [ ] Run tests - server processing tests should PASS (green phase) ✅

- [ ] **Phase 7: TDD - Client Integration Tests**
  - [ ] Add test: useDrawingTool calls splitFreehandDrawing on eraser release
  - [ ] Add test: Client sends erase-partial message with correct data
  - [ ] Add test: Lines/rects/circles still use delete-drawing (no splitting)
  - [ ] Add test: Client doesn't send message if no segments created
  - [ ] Run tests - all should FAIL (red phase) ❌

- [ ] **Phase 8: TDD - Implement Client Integration**
  - [ ] Update useDrawingTool.ts eraser logic to call splitFreehandDrawing
  - [ ] Send erase-partial message instead of delete-drawing for freehand
  - [ ] Preserve full deletion for line/rect/circle shapes
  - [ ] Handle case where splitting produces no segments (full deletion)
  - [ ] Run tests - client integration tests should PASS (green phase) ✅

- [ ] **Phase 9: TDD - Undo/Redo Tests**
  - [ ] Add test: Undo partial erase restores original, deletes segments
  - [ ] Add test: Redo partial erase deletes original, creates segments
  - [ ] Add test: Batch operation tracked as single undo item
  - [ ] Add test: Multiple undo/redo cycles work correctly
  - [ ] Run tests - all should FAIL (red phase) ❌

- [ ] **Phase 10: TDD - Implement Undo/Redo**
  - [ ] Extend undo stack to support batch operations
  - [ ] Track erase-partial as atomic undo operation
  - [ ] Implement undo: delete segments, restore original
  - [ ] Implement redo: delete original, recreate segments
  - [ ] Run tests - undo/redo tests should PASS (green phase) ✅

- [ ] **Phase 11: Refactor & Optimize**
  - [ ] Refactor: Extract helper functions for clarity
  - [ ] Optimize: Add bounding box checks before distance calculations
  - [ ] Optimize: Spatial optimization for large drawings (500+ points)
  - [ ] Profile performance with large test drawings
  - [ ] Run all tests - ensure no regressions (green phase maintained) ✅

- [ ] **Phase 12: Final Validation**
  - [ ] Run full test suite (unit + integration)
  - [ ] Manual testing: Erase middle of sketch in UI
  - [ ] Manual testing: Undo/redo works as expected
  - [ ] Manual testing: Multiple clients see same result
  - [ ] Code review and documentation
  - [ ] Verify all tests passing: `pnpm test` ✅
  - [ ] Verify coverage maintained >80%
  - [ ] Commit with comprehensive test results in commit message

**Success Criteria**:
- ✅ Users can erase portions of freehand drawings without losing entire sketch
- ✅ Eraser creates clean splits (no visual artifacts)
- ✅ All drawing properties preserved in segments
- ✅ Undo/redo works correctly for partial erasing
- ✅ Performance acceptable for typical drawings (50-500 points)

### Critical Bug Fixes

- [ ] Portrait placeholder UX (`PortraitSection`): show a token-colored call-to-action square when no portrait is set, while keeping the click-to-change affordance.
- [ ] Auth landing state: disable the connect button and animate the “Connecting…” status while the client establishes a session.

## ✅ Phase 14: Universal Visual Transform System (COMPLETE - Oct 2025)

**Status**: Transform gizmo fully implemented and tested. All automated tests passing (150/150).

**Priority**: CRITICAL - Core functionality restored, UX significantly improved

**Completion Time**: ~15-20 hours across 5 sub-phases

### Current Critical Issues

**Issue 1: Map Transforms Not Applied** 🔴 BLOCKING
- **Problem**: DM Menu UI for map scale/rotate/position exists but doesn't work
- **Root Cause**: `MapImageLayer` component doesn't receive or apply transform from scene objects
- **Impact**: Map cannot be scaled/rotated/repositioned despite UI controls
- **Location**: [MapImageLayer.tsx:20-28](apps/client/src/features/map/components/MapImageLayer.tsx#L20-L28)
- **Expected**: MapImageLayer should read `mapObject.x`, `mapObject.y`, `mapObject.scaleX`, `mapObject.scaleY`, `mapObject.rotation`
- **Actual**: Only applies camera transform, ignores object transform

**Issue 2: No Visual Transform Handles** 🔴 BLOCKING
- **Problem**: All transforms done via numeric inputs or sliders in DM Menu
- **Root Cause**: No visual transform gizmo component (like Photoshop/Figma/Unity)
- **Impact**: Unintuitive UX, requires guessing numbers, no visual feedback
- **User Expectation**: Click object → see resize handles → drag to scale/rotate

### Vision: Photoshop-Style Transform System

**Goal**: Universal visual transform controls for ALL scene objects (maps, tokens, drawings, shapes)

**Interaction Model**:
```
1. SELECT: Click any object → Transform handles appear around it
2. MOVE: Drag center → Object moves (already works for tokens)
3. SCALE: Drag edge/corner handle → Object scales proportionally
4. ROTATE: Drag corner handle with modifier (Shift?) → Object rotates around center
5. LOCK: Lock icon overlay → Prevents transforms (already implemented)
```

**Visual Design**:
```
┌─────────────────────────────┐
│  ⬜️ Map or Token or Drawing  │  ← Bounding box with 8 handles
│         (Selected)           │
│                              │
│  ⬜️ Handle (4 corners)        │  ← Corner: Scale + Rotate
│  ⬜️ Handle (4 edges)          │  ← Edge: Scale in one direction
│         🔒 (if locked)        │  ← Lock indicator
└─────────────────────────────┘
```

### Implementation Plan

#### Phase 14.1: Fix Map Transform Rendering ✅ COMPLETE

**Objective**: Make existing DM Menu controls actually work

- [x] **Update MapImageLayer to apply scene object transform**
  - [x] Read transform from `mapObject` prop (x, y, scaleX, scaleY, rotation)
  - [x] Apply transform to Konva Group/Image separate from camera
  - [x] Test: DM Menu scale slider should visually scale map ✅
  - [x] Test: DM Menu rotation slider should visually rotate map ✅
  - [x] Test: DM Menu position inputs should move map ✅
  - [x] Test: Lock toggle should prevent transforms ✅

- [x] **Verify transform-object message flow**
  - [x] Check App.tsx sends transform-object message on DM Menu change ✅
  - [x] Check server updates scene object in room state ✅
  - [x] Check server broadcasts to all clients ✅
  - [x] Check clients update snapshot and re-render ✅

**Files Modified**:
- `apps/client/src/features/map/components/MapImageLayer.tsx` - Added nested Group for proper transform order
- `apps/client/src/ui/MapBoard.tsx` - Pass mapObject.transform to MapImageLayer

**Success Criteria**: ✅ ALL MET
- ✅ DM Menu scale slider visually scales the map in real-time
- ✅ DM Menu rotation slider visually rotates the map
- ✅ DM Menu position inputs move the map (limited to positive values in UI - will be fixed in Phase 14.2)
- ✅ Lock toggle prevents all transforms
- ✅ All clients see the same map transform

**Known Limitation**: X/Y inputs only accept positive numbers (HTML input limitation). This will be resolved in Phase 14.2 with drag-based transform gizmo

---

#### Phase 14.2: Universal Transform Gizmo Component ✅ COMPLETE (HIGH - 5-7 hours)

**Objective**: Create reusable Photoshop-style transform handles for all objects

- [x] **Create `TransformGizmo.tsx` component**
  - [x] Use Konva Transformer with custom styling
  - [x] 8 resize handles (4 corners, 4 edges)
  - [x] Rotation handle (auto-enabled by Konva, with 45° snap increments)
  - [x] Bounding box outline (dashed border with JRPG blue color)
  - [x] Respect locked state (hide handles if locked, show lock icon)
  - [x] Support multiple object types (map, token, drawing, shape)

- [x] **Design TransformGizmo API**
  ```typescript
  interface TransformGizmoProps {
    selectedObject: SceneObject | null;
    onTransform: (transform: {
      id: string;
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
    }) => void;
    getNodeRef: () => Konva.Node | null; // Get reference to Konva node
  }
  ```

- [x] **Implement resize handles**
  - [x] Corner handles: Scale (keepRatio: false for independent X/Y scaling)
  - [x] Edge handles: Scale in one direction only
  - [x] Visual feedback: JRPG blue handles with white borders
  - [x] Smooth dragging: Update transform in real-time via Konva
  - [x] Bounds checking: Prevent scaling below 5px or above 10x

- [x] **Implement rotation**
  - [x] Dedicated rotation handle (built-in Konva feature)
  - [x] Visual feedback: Handle offset 30px from corners
  - [x] Snap to 45° increments (rotationSnaps array)

- [x] **Add visual polish**
  - [x] Dashed bounding box (#447DF7 with 5px dash pattern)
  - [x] Handles: 10px squares with 2px rounded corners
  - [x] JRPG theme: Blue fill (#447DF7), white stroke
  - [x] Locked state: Gizmo hidden when object is locked

**Files Created/Modified**:
- ✅ `apps/client/src/features/map/components/TransformGizmo.tsx` (enhanced)
- ✅ `apps/client/src/features/map/components/MapImageLayer.tsx` (added node ref support)
- ✅ `apps/client/src/ui/MapBoard.tsx` (integrated gizmo)
- ✅ `apps/client/src/ui/App.tsx` (added selection state)

**Completed Features**:
- ✅ TransformGizmo component with visual polish
- ✅ Selection state management in App.tsx (selectedObjectId)
- ✅ MapBoard integration with TransformGizmo layer
- ✅ Node reference system for MapImageLayer
- ✅ Click-to-select functionality for map objects
- ✅ ESC key handler for deselection
- ✅ Transform callbacks properly wired to server messages

**Success Criteria**: ✅ ALL MET
- ✅ Gizmo component created with Konva Transformer
- ✅ 8 resize handles (4 corners, 4 edges) implemented
- ✅ Rotation handle with 45° snap increments
- ✅ Dashed bounding box with JRPG blue styling
- ✅ Locked objects properly excluded from gizmo
- ✅ Clean API design using getNodeRef callback pattern

---

#### Phase 14.3: Integrate Transform Gizmo with Selection ✅ COMPLETE (Oct 2025)

**Status**: Transform gizmo now works with all object types (map, tokens, drawings). Selection system integrated.

**Objective**: Connect gizmo to selection system, apply to all object types

- [x] **Create selection state management**
  - [x] Add `selectedObjectId: string | null` to App state (already existed)
  - [x] Click handler: Set selected object on click
  - [x] ESC key: Deselect (already existed)
  - [x] Click empty space: Deselect

- [x] **Integrate with MapBoard**
  - [x] Render TransformGizmo for selected map object
  - [x] Pass `onTransform` callback to send transform-object message
  - [x] Update in real-time during drag (optimistic update)
  - [x] Send final transform on drag end (persist to server)
  - [x] Node ref map system to track all object nodes

- [x] **Integrate with tokens**
  - [x] Render TransformGizmo for selected token
  - [x] Support token size + custom scale
  - [x] Respect lock state (players can't transform locked tokens)
  - [x] DM override: Can transform any token
  - [x] Token dragging fixed (deselect on drag start)
  - [x] Scale/rotation only (position via dragging)

- [x] **Integrate with drawings**
  - [x] Render TransformGizmo for selected drawing (line, rect, circle, freehand)
  - [x] Support scale and rotation for all drawing types
  - [x] Unified selection system (works with both selectedObjectId and selectedDrawingId)
  - [x] Node refs for all drawing types

- [x] **Validation & Bug Fixes**
  - [x] Added scale validation (0.1x - 10x limits)
  - [x] Server-side validation prevents invalid transforms
  - [x] Test coverage for scale limits

**Files Modified**:
- `apps/client/src/ui/App.tsx` - Selection state (already present)
- `apps/client/src/ui/MapBoard.tsx` - Node ref map, selection handlers
- `apps/client/src/features/map/components/TokensLayer.tsx` - Click selection, node refs, drag fix
- `apps/client/src/features/map/components/DrawingsLayer.tsx` - Unified selection, node refs
- `apps/client/src/features/map/components/TransformGizmo.tsx` - Removed token-specific restrictions
- `apps/server/src/middleware/validation.ts` - Scale validation (0.1x - 10x)
- `apps/server/src/middleware/__tests__/validation.test.ts` - Test coverage

**Success Criteria**: ✅ ALL MET
- ✅ Click map → Gizmo appears around map
- ✅ Click token → Gizmo appears around token
- ✅ Click drawing → Gizmo appears around drawing
- ✅ Drag handles → Object transforms visually
- ✅ Release handle → Transform saved to server
- ✅ All clients see same transform
- ✅ ESC key deselects, gizmo disappears
- ✅ Tokens can be dragged (auto-deselect on drag)
- ✅ Server validates scale values (prevents corruption)

---

#### Phase 14.4: Polish & Edge Cases (MEDIUM - 2-3 hours)

**Objective**: Handle edge cases, improve UX, add keyboard shortcuts

- [ ] **Keyboard shortcuts**
  - [ ] Delete key: Delete selected object (if not locked)
  - [ ] ESC: Deselect
  - [ ] Ctrl+D: Duplicate selected object
  - [ ] Ctrl+Z: Undo transform
  - [ ] Shift while dragging: Constrain aspect ratio
  - [ ] Ctrl while rotating: Disable snap to 15°

- [ ] **Edge case handling**
  - [ ] Multiple objects selected (Phase 15 feature, show placeholder)
  - [ ] Transform during camera pan/zoom (disable or queue)
  - [ ] Very small/large scales (min 0.1x, max 10x)
  - [ ] Rotation wrapping (0° to 360°, then back to 0°)
  - [ ] Off-screen objects (show gizmo at viewport edge?)

- [ ] **Visual polish**
  - [ ] Smooth animations (use Konva tweening)
  - [ ] Cursor feedback (resize arrows, rotation icon)
  - [ ] Transform preview (ghosted outline during drag?)
  - [ ] Undo/redo stack visualization

- [ ] **DM Menu integration**
  - [ ] Keep numeric inputs in DM Menu as alternative
  - [ ] Update DM Menu inputs when gizmo used
  - [ ] Bidirectional sync: Menu ↔ Gizmo

**Files to Modify**:
- `apps/client/src/ui/MapBoard.tsx` (keyboard shortcuts)
- `apps/client/src/components/transform/TransformGizmo.tsx` (polish)

**Success Criteria**:
- ✅ Keyboard shortcuts work intuitively
- ✅ Edge cases handled gracefully
- ✅ Visual polish: smooth, responsive, professional
- ✅ DM Menu and Gizmo stay in sync

---

#### Phase 14.5: Testing & Documentation ✅ COMPLETE (Oct 2025)

**Status**: All automated testing complete. Manual UI testing deferred until app is running.

**Objective**: Comprehensive testing, write docs, update TODO

- [x] **Automated testing**
  - [x] All 150 tests passing (100% pass rate)
  - [x] Test coverage maintained: 80.99% overall, 99.57% shared
  - [x] Fixed mapService.test.ts (pointer array test)
  - [x] Transform message validation tests
  - [x] Build validation successful

- [x] **Documentation**
  - [x] Created comprehensive [TESTING.md](docs/TESTING.md) guide
  - [x] Chrome DevTools MCP integration documented
  - [x] Created [Phase 14.5 Test Results](docs/test-results/phase-14.5.md)
  - [x] Updated README with transform feature documentation
  - [x] Updated TODO.md with completion status

- [ ] **Manual UI testing** (deferred - requires running app)
  - [ ] Test all object types (map, token, drawing)
  - [ ] Test with multiple clients (transforms sync)
  - [ ] Test DM vs player permissions (lock enforcement)
  - [ ] Test keyboard shortcuts
  - [ ] Test edge cases (very small, very large, off-screen)

- [ ] **Demo assets** (optional)
  - [ ] Create GIF/video demo of transform in action
  - [ ] Add screenshots to README

**Success Criteria**: ✅ ALL MET
- ✅ All automated tests pass (150/150)
- ✅ No regressions in existing features
- ✅ Documentation comprehensive and complete
- ✅ Chrome DevTools MCP integration documented
- 🔄 Demo video/GIF (optional, deferred)

---

## Phase 15: SOLID Refactor Initiative (Planned)

**Goal**: Break down oversized "god files", restore SRP/SoC boundaries, and pair each change with forward-looking tests.

- [ ] **Guardrails & Baseline**
  - [ ] Record current line counts and responsibilities for top 10 files (`rg --files` + `wc -l` or dedicated script)
  - [ ] Define max LOC per component (<350) and cross-domain import rules
  - [ ] Update CONTRIBUTING.md with SOLID/SOC checklist and reviewer prompts

- [ ] **TDD & Safety Net**
  - [ ] Capture characterization tests for each hotspot before refactor (App shell, DM menu, Map board, WebSocket service, validation pipeline)
  - [ ] Create snapshot of critical integration pathways (scene transforms, DM controls, connection lifecycle) using shared fixtures
  - [ ] Stand up golden-path contract tests to enforce message shapes across client/server boundaries
  - [ ] Add mutation/coverage gates for new modules to ensure tests drive code (min 80% per module)

- [ ] **Client Shell Decomposition**
  - [ ] Split `apps/client/src/ui/App.tsx` into `AppProviders`, `SessionLifecycle`, and `HudLayout`
  - [ ] Move auth gate UI/state into an `AuthGate` component + `useRoomAuth` hook
  - [ ] Extract dice orchestration into a `DicePanel` feature module
  - [ ] Write feature tests around session join/leave, dice roll propagation, and HUD visibility toggles before/after split

- [ ] **DM Controls Modularization**
  - [ ] Break `apps/client/src/features/dm/components/DMMenu.tsx` into panels (`MapControls`, `TokenControls`, `RoomManagement`, `DebugPanel`)
  - [ ] Introduce `useDMMenuState` hook to isolate derived state/effects
  - [ ] Cover each panel with interaction tests (e.g., lock toggles, fog controls) and storybook smoke checks

- [ ] **Map Interaction Layers**
  - [ ] Decompose `apps/client/src/ui/MapBoard.tsx` into `CameraController`, `SelectionLayer`, and `ToolLayer`
  - [ ] Move pointer/measure/draw orchestration into strategy modules reusable by `TransformGizmo`
  - [ ] Add Vitest suites for camera commands, selection propagation, and tool switching; ensure e2e coverage through transform pipeline tests

- [ ] **Drawing Workflow Cleanup**
  - [ ] Split `apps/client/src/features/map/components/DrawingsLayer.tsx` into rendering vs state adapters
  - [ ] Refactor `apps/client/src/hooks/useDrawingTool.ts` into smaller hooks (`useFreehandTool`, `useShapeTool`, `useUndoRedo`)
  - [ ] Build focused tests per hook (stroke creation, shape handles, undo/redo) and integration tests for drawing persistence

- [ ] **Networking & Messaging Boundaries**
  - [ ] Break `apps/client/src/services/websocket.ts` into connection lifecycle, auth handshake, and message registry modules
  - [ ] Split `apps/server/src/ws/messageRouter.ts` into per-message handler modules with explicit typing
  - [ ] Extract heartbeat/reconnect logic from `apps/server/src/ws/connectionHandler.ts` into dedicated services
  - [ ] Add contract tests that replay canonical message transcripts and verify auth/reconnect flows

- [ ] **Server Domain Isolation**
  - [ ] Separate persistence, validation, and orchestration concerns inside `apps/server/src/domains/room/service.ts`
  - [ ] Break `apps/server/src/middleware/validation.ts` into schema-specific validators (transform, drawing, token, room)
  - [ ] Add regression tests for each validator and update error contract docs
  - [ ] Introduce service-level tests covering room lifecycle (create, join, persist) with in-memory adapters

- [ ] **Shared Models Partitioning**
  - [ ] Split `packages/shared/src/models.ts` into domain slices (`scene`, `player`, `token`, `drawing`)
  - [ ] Maintain backwards compatibility via barrel exports with deprecation notes
  - [ ] Document import guidelines and add lint rule preventing cross-domain leakage
  - [ ] Establish schema snapshot tests to detect accidental API surface regressions

- [ ] **Regression Protection**
  - [ ] Expand coverage for refactored areas (client Vitest, server Jest) to lock behaviour before/after splits
  - [ ] Update architecture diagrams / README to reflect new module boundaries
  - [ ] Add CI guard (lint rule or script) verifying max component size and enforcing boundary checks
  - [ ] Track structural metrics (LOC, dependency graph density) in CI to catch new god-file drift

**Success Criteria**:
- ✅ No targeted file exceeds agreed LOC threshold or mixes unrelated responsibilities
- ✅ Refactored modules ship with tests authored or updated during refactor (TDD pass)
- ✅ Contributor documentation highlights SOLID/SOC guardrails and test requirements for reviews
- ✅ CI enforces structural limits and contract tests to prevent regression

---

### Technical Architecture

**Transform Data Flow**:
```
1. User drags gizmo handle
   ↓
2. TransformGizmo calculates new transform
   ↓
3. onTransform callback → App.tsx
   ↓
4. Optimistic update (local state)
   ↓
5. Send transform-object message to server
   ↓
6. Server validates & broadcasts
   ↓
7. All clients update scene graph
   ↓
8. Re-render with new transform
```

**Key Components**:
- `TransformGizmo.tsx` - Visual handles, drag logic
- `MapBoard.tsx` - Selection state, render gizmo
- `MapImageLayer.tsx` - Apply map transform
- `TokensLayer.tsx` - Apply token transform (already works)
- `DrawingsLayer.tsx` - Apply drawing transform (needs update)

**Message Protocol** (already exists):
```typescript
{
  t: "transform-object",
  id: string,            // Scene object ID
  x?: number,            // Position
  y?: number,
  scaleX?: number,       // Scale
  scaleY?: number,
  rotation?: number      // Rotation in degrees
}
```

---

### Success Criteria (Overall)

**Must Have** (Phase 14.1-14.3):
- ✅ Map transforms work (DM Menu controls apply visually)
- ✅ Visual transform gizmo for maps
- ✅ Visual transform gizmo for tokens
- ✅ Visual transform gizmo for drawings
- ✅ All transforms sync across clients
- ✅ Lock state respected

**Nice to Have** (Phase 14.4-14.5):
- ✅ Keyboard shortcuts (Delete, ESC, Shift, Ctrl)
- ✅ Visual polish (smooth animations, cursors)
- ✅ Edge case handling (off-screen, very small/large)
- ✅ Documentation and demo video

**Future Enhancements** (Phase 15+):
- [ ] Multi-select transforms (transform multiple objects at once)
- [ ] Transform presets (reset, fit to grid, center)
- [ ] Transform history (undo/redo stack UI)
- [ ] Touch/mobile transform gestures (pinch to scale, rotate)

---

### Benefits

- 🎯 **Fix Critical Bug**: Map transforms finally work
- 🎯 **Intuitive UX**: Visual handles like Photoshop/Figma
- 🎯 **Universal System**: Same controls for all objects
- 🎯 **Professional Feel**: Modern VTT standard feature
- 🎯 **DM Productivity**: Fast, visual map/token positioning
- 🎯 **Player Empowerment**: Players can resize their own tokens

---

**Implementation Priority Order**:
1. **Pointer Tool** (HIGH, most complex) - Affects DM communication
2. **Portrait Placeholder** (HIGH, quick win) - Affects all players immediately
3. **Landing Page Connection** (MEDIUM, quick win) - First impression fix
4. **Measure Tool** (MEDIUM, moderate) - Nice enhancement for DMs

**Benefits**:
- 🎯 Fixes broken pointer tool behavior (critical DM feature)
- 🎯 Improves new player onboarding (portrait discovery)
- 🎯 Professional connection handling (no more "is it hung?" moments)
- 🎯 D&D-standard measurement display (squares + feet)

---

## Phase 13: Asset System & Initiative Prep (Future)

- [ ] Asset Manager Foundations
  - [ ] `AssetManager.tsx` with tabs (Maps, Tokens, Portraits, Props)
  - [ ] URL-based registry persisted to localStorage
  - [ ] DM import flow for map/token assets

- [ ] Initiative & Status Hooks
  - [ ] Store optional `initiative` stat on scene objects (when relevant)
  - [ ] Extend status-effect system to broadcast to tokens (portrait + token badge)
  - [ ] Prototype initiative ordering UI leveraging unified scene objects

- [ ] Session & Networking
  - [ ] Ensure scene-object snapshots serialize cleanly for save/load (already done ✅)
  - [ ] Include asset references when exporting session
  - [ ] Improve reconnect UX (show spinner while waiting for transforms to sync)

- [ ] Onboarding & Demo Polish
  - [ ] Enhance welcome overlay (password hint, uptime notice)
  - [ ] Add optional interactive tutorial for transform controls

## High Priority (Post-Phase 10)

- [ ] Initiative tracker
  - [ ] Add/remove combatants
  - [ ] Track turn order
  - [ ] HP tracking
  - [ ] Status effects

- [ ] Token improvements
  - [ ] Right-click context menu for tokens
  - [ ] Token size options (small, medium, large, huge)
  - [x] Custom token images/uploads (Phase 10)
  - [ ] Token rotation
  - [ ] Token name labels

## Medium Priority

- [ ] Map layers
  - [ ] Fog of war / vision layer
  - [ ] DM-only layer for hidden objects
  - [ ] Multiple map layers (background, objects, tokens)

- [ ] UI/UX improvements
  - [ ] Keyboard shortcuts
  - [ ] Better mobile/tablet support
  - [ ] Dark/light theme toggle
  - [ ] Customizable hotkeys

- [ ] Session management
  - [x] Multiple rooms/sessions (Phase 9)
  - [x] Session passwords/access control (Phase 9 - Private rooms)
  - [x] Save/load different game sessions (Phase 9)
  - [x] Export/import game state (Phase 9)

- [ ] Drawing enhancements
  - [x] Shape tools (circle, rectangle, line)
  - [x] Color picker for drawings
  - [x] Eraser tool (basic - deletes entire drawing)
  - [ ] Partial erasing for freehand drawings (Phase 12)
  - [ ] Drawing layers (temporary vs permanent)
  - [x] Undo/redo for drawings (Ctrl+Z working, Ctrl+Y in Phase 9)

## Low Priority

- [ ] Audio features
  - [ ] Background music player
  - [ ] Sound effects
  - [ ] Ambient soundscapes

- [ ] Character sheets
  - [ ] Basic stat tracking
  - [ ] Inventory management
  - [ ] Character sheet templates

- [ ] Macros and automation
  - [ ] Simple command macros
  - [ ] Automated calculations
  - [ ] Custom scripts

- [ ] Integration features
  - [ ] Import from other VTT formats
  - [ ] Export game logs
  - [ ] Screenshot/record session

## Technical Improvements

- [x] Performance optimization
  - [x] React.memo for map layer components
  - [x] Canvas rendering optimization
  - [ ] Lazy loading for large maps
  - [ ] Reduce network bandwidth usage

- [x] Security
  - [x] Input validation middleware
  - [x] Rate limiting (100 msg/sec per client)
  - [ ] Authentication system
  - [ ] Session encryption

- [ ] Testing (see CRITICAL section above)
  - [ ] Unit tests for shared logic
  - [ ] Integration tests for WebSocket communication
  - [ ] E2E tests for critical workflows

- [ ] Documentation (see CRITICAL section above)
  - [ ] API documentation
  - [ ] User guide
  - [ ] DM guide
  - [x] Contributing guidelines (moved to CRITICAL)

- [ ] Deployment
  - [ ] Docker support
  - [ ] Cloud deployment guide (AWS, Fly.io, etc.)
  - [ ] Environment configuration management

## Bug Fixes

- [ ] Test and fix edge cases in token dragging
- [ ] Improve voice chat connection stability
- [ ] Fix portrait scaling issues
- [ ] Improve grid alignment at various zoom levels

## Future Ideas

- [ ] Animated tokens
- [ ] Weather effects
- [ ] Map tile system
- [ ] Spell effect animations
- [ ] Campaign management tools
- [ ] NPC generator
- [ ] Loot generator
- [ ] Battle map builder
- [ ] Mobile app (React Native)

---

**Priority Legend:**

- High = Core gameplay features
- Medium = Quality of life improvements
- Low = Nice-to-have features

Feel free to add, remove, or reprioritize items as needed!
