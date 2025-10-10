# HeroByte TODO

## CRITICAL: Contributor Readiness (BLOCKING)

**These items are essential for making the repo stable and contributor-friendly.**

### Testing Infrastructure ✅ COMPLETE

- [x] **Unit Tests**
  - [x] Set up Vitest for shared package (`packages/shared/`)
  - [x] Test shared model classes (TokenModel, PlayerModel, CharacterModel)
  - [x] Test validation schemas and utilities
  - [x] Achieve >80% coverage on shared logic (99.57% achieved!)

- [x] **Integration Tests**
  - [x] Set up test environment for WebSocket
  - [x] Test socket handshake and connection lifecycle
  - [x] Test message routing and validation middleware
  - [x] Test rate limiting behavior
  - [x] Test room state synchronization

- [ ] **E2E Tests** (optional for now)
  - [ ] Set up Playwright or Cypress
  - [ ] Test critical user flows (join session, move token, roll dice)

### CI/CD Pipeline ✅ COMPLETE

- [x] **GitHub Actions Setup**
  - [x] Create `.github/workflows/ci.yml`
  - [x] Run linting on all PRs (eslint + prettier)
  - [x] Run tests on all PRs
  - [x] Build validation for client and server
  - [x] Fail PRs if any check fails

- [x] **Quality Gates**
  - [x] Add code coverage reporting
  - [x] Add build status badge to README
  - [x] Add test coverage badge to README

### Code Quality ✅ COMPLETE

- [x] **Linting & Type Safety**
  - [x] Zero-warning linting enforced (client & server)
  - [x] Eliminate all `any` types (replaced with proper types/unknown)
  - [x] Remove unused imports and variables
  - [x] Strict ESLint configuration with --max-warnings=0
  - [x] CI enforcement (no escape hatches)

### README Improvements

- [ ] **Visual Assets**
  - [ ] Add screenshots of gameplay (map, dice roller, voice chat)
  - [ ] Add GIF/video demo of core features
  - [ ] Show UI for drawing tools, token movement

- [ ] **Better Documentation**
  - [ ] Add "Running Tests" section with `pnpm test` examples
  - [ ] Expand "Contributing" section with PR workflow
  - [ ] Add troubleshooting section (common issues)
  - [ ] Add architecture diagram (optional)

### Security Hardening

- [ ] **Schema Validation** ✅ (Already have input validation middleware)
- [ ] **Authentication System**
  - [ ] Basic room passwords (Phase 9 covers this)
  - [ ] Player identity verification
  - [ ] DM authentication for private rooms

- [ ] **Additional Security**
  - [ ] CORS configuration review
  - [ ] WebSocket origin validation
  - [ ] Helmet.js for HTTP security headers (if applicable)

### Community & Governance

- [ ] **Public Roadmap**
  - [ ] Create GitHub Projects board
  - [ ] Link roadmap in README
  - [ ] Label issues by priority (P0, P1, P2)

- [x] **Issue Templates**
  - [x] Bug report template
  - [x] Feature request template
  - [x] Pull request template

- [x] **Contributing Guidelines**
  - [x] Create CONTRIBUTING.md
  - [x] Code style guide
  - [x] PR review process
  - [x] Testing requirements

---

## ✅ Phase 9: Scene Graph & Transform Overhaul (COMPLETE - Oct 2025)

- [x] **Scene Object Core**
  - [x] Define shared `SceneObject` interface (id, type, position, scale, rotation, locked, metadata)
  - [x] Update room state + persistence to store drawings/tokens/map as `SceneObject[]`
  - [x] Migration utilities for legacy snapshots (auto-migration in rebuildSceneGraph)
  - [x] Add `transform-object` message schema & validation

- [x] **Client Scene Layer**
  - [x] `useSceneObjects` hook to consume unified list
  - [x] Render layers (map/tokens/drawings) filter by type but share transform wrapper
  - [ ] Selection manager (single + multi select) - DEFERRED to Phase 10

- [x] **Transform Pipeline**
  - [x] Transform callback pipeline (App → MapBoard → sendMessage)
  - [x] Server authorization (owner vs DM override) in applySceneObjectTransform
  - [x] Respect lock flag on server side
  - [ ] Visual transform gizmo UI - DEFERRED to Phase 10

- [x] **Map as Object**
  - [x] Load map background into `SceneObject` with lowest z-index (-100)
  - [ ] DM controls for map scale/rotation/lock in DM menu - DEFERRED to Phase 10

- [ ] **Drawing Refactor** - DEFERRED to Phase 10
  - [ ] Convert stored drawings to individual `SceneObject`s with metadata
  - [ ] Enable move/scale/rotate on drawings; update undo/redo to operate on IDs

- [ ] **Token Enhancements** - DEFERRED to Phase 10
  - [ ] Token objects support rotation/scale when unlocked
  - [ ] Persist per-token lock state; expose toggle in settings
  - [ ] Prepare initiative metadata field for future combat tracker

**Status**: Core architecture complete. Transform messages working. UI controls deferred to Phase 10.

## ✅ Phase 10: Transform UI & Lock Controls (COMPLETE - Oct 2025)

**Status**: All features implemented and tested. 116/116 tests passing.

- [x] **Transform Gizmo Component**
  - [x] Create `TransformGizmo.tsx` with Konva Transformer
  - [x] Visual handles for rotate and scale (translate via drag already works)
  - [x] Attach to selected scene objects
  - [x] Respect `locked` flag (disable handles when locked)

- [x] **Lock Controls UI**
  - [x] Add lock toggle to PlayerCard/NpcCard token settings
  - [x] Add lock button in DM menu for map object
  - [x] Visual indicator for locked objects (lock icon overlay with `LockIndicator.tsx`)
  - [x] Sync lock state via transform-object message

- [x] **DM Map Transform Controls**
  - [x] DM menu section for map positioning
  - [x] Position (x, y) input fields
  - [x] Scale slider (0.1x - 3x)
  - [x] Rotation slider (0° - 360°)
  - [x] Lock map button
  - [x] Reset transform button

- [ ] **Selection & Multi-Select** (Optional)
  - [ ] Selection manager for scene objects - DEFERRED to Phase 11
  - [ ] Click to select, ctrl+click for multi-select
  - [ ] Drag rectangle selection
  - [ ] Group transforms for multiple objects

## ✅ Phase 11: Token Size System (COMPLETE - Oct 2025)

**Status**: Token size system fully implemented with TDD methodology. 146/146 tests passing, 80.99% coverage.

### Completed Features

- [x] **Token Size System**
  - [x] Add `size` property to Token model (default: medium)
  - [x] Size variants: tiny (0.5x), small (0.75x), medium (1x), large (1.5x), huge (2x), gargantuan (3x)
  - [x] Add set-token-size message type to @shared
  - [x] Implement TokenService.setTokenSize with lock check
  - [x] Implement TokenService.setTokenSizeByDM for DM override
  - [x] Add validation middleware for set-token-size
  - [x] Update scene graph to include token size
  - [x] UI controls in PlayerCard settings to change size (3x2 button grid)
  - [x] UI controls in NpcCard settings for DM (3x2 button grid)
  - [x] Visual size scaling on tokens in TokensLayer
  - [x] Respect locked state (locked tokens require DM override)

- [x] **Comprehensive Testing (TDD)**
  - [x] 14 tests for token size service (tokenSize.test.ts)
  - [x] 7 tests for validation middleware
  - [x] 3 tests for message router
  - [x] 6 tests for TokenModel persistence
  - [x] 30 total new tests, all passing
  - [x] 99.02% coverage on TokenService

### Success Criteria Achieved
- ✅ All tests written first (TDD methodology)
- ✅ Tokens can be resized via UI settings menu
- ✅ Size changes visible in real-time on map
- ✅ Ownership validation enforced
- ✅ Lock state respected (DM override works)
- ✅ Size persists in scene graph and state
- ✅ Test coverage >80% (80.99% overall, 99.02% on TokenService)

### Deferred to Phase 12

- [ ] **Selection State Management** - See Phase 12
- [ ] **Multi-Select** - See Phase 12

---

## Phase 12: Selection & Drawing Polish (Future)

**Priority**: High - Critical UX improvements for drawing and object manipulation

### Menu System Unification

**Current Issue**: Menus have inconsistent behavior and styling. PlayerSettingsMenu causes scrolling in EntitiesPanel. DMMenu is stuck in bottom-right corner and not movable.

**Goal**: Unified draggable window system for all menus with position persistence.

**Reference Implementation**: DrawingToolbar already uses DraggableWindow correctly - replicate this pattern for all menus.

**Affected Menus**:
- ✅ DrawingToolbar (already uses DraggableWindow)
- ✅ Dice Roller (already good)
- ✅ Roll Log (already good)
- ❌ PlayerSettingsMenu (embedded in EntitiesPanel, causes scrolling)
- ❌ NpcSettingsMenu (same issue as PlayerSettings)
- ❌ DMMenu (fixed position, not movable, inconsistent styling)

**Implementation Plan**:

- [ ] **Phase 1: Enhance DraggableWindow Component** (2 hours)
  - [ ] Add optional `storageKey?: string` prop for localStorage persistence
  - [ ] On component mount: Load position from `localStorage['herobyte-window-position-{storageKey}']`
  - [ ] On drag end: Save position as JSON `{ x: number, y: number }` to localStorage
  - [ ] Ensure backward compatibility (works without storageKey)
  - [ ] Add bounds checking (prevent dragging windows off-screen)
  - [ ] Handle window resize events (reposition if window shrinks)

- [ ] **Phase 2: Refactor PlayerSettingsMenu** (2 hours)
  - [ ] Remove absolute positioning from PlayerSettingsMenu component
  - [ ] Wrap content in DraggableWindow component
  - [ ] Pass `storageKey="player-settings-menu"`
  - [ ] Set sensible defaults: `initialX={300} initialY={100} width={280}`
  - [ ] Use React Portal to render at root level (not inside EntitiesPanel)
  - [ ] Update PlayerCard to conditionally render DraggableWindow when settings open
  - [ ] Add close button that calls parent's `setSettingsOpen(false)`
  - [ ] Test: Verify no more scrolling in EntitiesPanel
  - [ ] Test: Verify position persists across page refreshes

- [ ] **Phase 3: Refactor NpcSettingsMenu** (1 hour)
  - [ ] Same approach as PlayerSettingsMenu
  - [ ] Pass `storageKey="npc-settings-menu"`
  - [ ] Set different initial position to avoid overlap: `initialX={350} initialY={150}`
  - [ ] Test same scenarios as PlayerSettings

- [ ] **Phase 4: Refactor DMMenu** (2 hours)
  - [ ] Convert from fixed bottom-right positioning to DraggableWindow
  - [ ] Pass `storageKey="dm-menu"`
  - [ ] Calculate smart initial position: `initialX={window.innerWidth - 420} initialY={100}`
  - [ ] Ensure JRPG styling matches other windows (use JRPGPanel variant="bevel")
  - [ ] Keep toggle button in bottom-right corner (opens/closes the window)
  - [ ] Make DM Menu closable but not required (optional workflow)
  - [ ] Test: Verify DM can drag menu to preferred position
  - [ ] Test: Verify position remembered across sessions

- [ ] **Phase 5: Testing & Polish** (2 hours)
  - [ ] Manual test: Open all menus simultaneously, verify z-index layering
  - [ ] Manual test: Drag each menu, refresh page, verify position restored
  - [ ] Manual test: Resize browser window, verify menus stay visible
  - [ ] Manual test: First-time user (clear localStorage), verify sensible defaults
  - [ ] Edge case: Very small screens (< 768px width) - ensure menus don't overlap
  - [ ] Polish: Ensure all windows use consistent JRPG title bar styling
  - [ ] Polish: Add subtle entrance animation (fade + slide) - optional
  - [ ] Document: Update user guide with menu dragging feature

**Storage Key Convention**:
```
"herobyte-window-position-player-settings-menu" → { x: 300, y: 150 }
"herobyte-window-position-npc-settings-menu" → { x: 350, y: 200 }
"herobyte-window-position-dm-menu" → { x: 900, y: 100 }
"herobyte-window-position-drawing-toolbar" → { x: 8, y: 100 }
```

**Success Criteria**:
- ✅ All menus use DraggableWindow component
- ✅ Menu positions persist across page refreshes
- ✅ PlayerSettingsMenu no longer causes EntitiesPanel scrolling
- ✅ DMMenu is movable and remembers position
- ✅ Consistent JRPG styling across all windows
- ✅ No z-index conflicts when multiple menus open
- ✅ Sensible default positions for first-time users

**Benefits**:
- 🎯 Eliminates EntitiesPanel scrolling frustration
- 🎯 Flexible menu positioning for user preference
- 🎯 Professional, consistent UX across entire app
- 🎯 "Magic" moment when positions are remembered
- 🎯 Low complexity, high impact improvement

**Future Enhancements** (Optional, post-Phase 12):
- [ ] Touch/mobile support (onTouchStart/Move/End handlers)
- [ ] Keyboard navigation (Tab, Escape, Arrow keys)
- [ ] Window snapping (snap to edges/corners)
- [ ] Minimize/maximize buttons
- [ ] Save/restore window layout presets

---

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
