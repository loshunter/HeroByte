# HeroByte Completed Work

**Last Updated**: October 2025
**Source**: Archived from `TODO.md` to keep the active roadmap lean.

---

## ✅ Multi-Object Selection & Interaction (October 2025)

### Selection System Improvements
- [x] **Selection Persistence**
  - [x] Fixed selection clearing when switching between select and transform modes
  - [x] Updated useEffect condition to preserve selection in both modes
  - [x] Added dependency on selectMode to prevent unintended deselection

- [x] **Marquee Selection Enhancement**
  - [x] Prevented onStageClick from interfering with marquee selection
  - [x] Improved deselection logic to only clear when no objects are found
  - [x] Added comprehensive debug logging for selection state tracking

### Multi-Object Dragging
- [x] **Synchronized Movement**
  - [x] Implemented real-time synchronized dragging for all selected objects
  - [x] Added onDragMove handler to update positions during drag operation
  - [x] Calculated delta movement from dragged object and applied to all selections
  - [x] Stored initial positions of all selected objects on drag start
  - [x] Eliminated rubber-band snap effect for smooth visual feedback

### Multi-Object Deletion
- [x] **Ownership-Based Permissions**
  - [x] Updated Delete/Backspace handler to support multiple selected objects
  - [x] Changed from DM-only to ownership-based deletion permissions
  - [x] Allowed users to delete objects they own (matching drag permissions)
  - [x] Implemented automatic filtering of locked and unowned objects
  - [x] Added smart confirmation dialogs with deletion counts
  - [x] Provided specific error messages for different permission issues

### Group Lock/Unlock Controls
- [x] **UI Controls**
  - [x] Group lock button appears when multiple objects selected
  - [x] Group unlock button appears when multiple objects selected
  - [x] Selection count display shows number of selected objects
  - [x] Hover states for better UX feedback

- [x] **Backend Support**
  - [x] `lock-selected` message handler in message router
  - [x] `unlock-selected` message handler in message router
  - [x] `lockSelected()` and `unlockSelected()` methods in useObjectSelection hook
  - [x] Broadcast and save state after lock/unlock operations

- [x] **Persistence**
  - [x] Lock state stored in SceneObject.locked field
  - [x] Lock state persisted through save/load in session files
  - [x] Scene graph preserves lock state across server restarts

### Bug Fixes
- [x] **WebSocket Connection Stability**
  - [x] Fixed race condition in connection handler authentication
  - [x] Added logic to close stale WebSocket connections before auth state clear
  - [x] Prevented "Unauthenticated message" errors during reconnection

- [x] **Test Corrections**
  - [x] Updated validation test error messages to match actual output
  - [x] Fixed heartbeat timeout test to use correct 6-minute threshold

**Key Achievement**: Consistent permission model across all object interactions - if you can move it, you can delete it.

### Lock Enforcement (October 2025)
- [x] **Movement Protection**
  - [x] Updated allowDrag check in DrawingsLayer to respect locked flag
  - [x] Locked objects cannot be dragged by anyone (including DM)
  - [x] Lock must be removed before object can be moved

- [x] **Deletion Protection**
  - [x] Enhanced keyboard deletion handler with explicit lock blocking
  - [x] Locked objects cannot be deleted via Delete/Backspace by anyone (including DM)
  - [x] Improved error messages to distinguish between locked vs ownership issues
  - [x] Added specific locked object count in multi-delete warning dialogs

- [x] **Clear All Override**
  - [x] Verified "Clear All Drawings" button correctly ignores lock flag
  - [x] DM can use bulk clear to reset board regardless of lock status
  - [x] Individual unlock still available for selective changes

**Lock Philosophy**: Lock is a safety mechanism to prevent accidental changes during gameplay. DM can unlock individual items when needed, or use the nuclear "Clear All" option for complete board reset. Consistent protection: locked = unmovable + undeletable by all users.

---

## ✅ Toast Notification System & Load/Save UX (October 2025)

### Toast Notification System
- [x] **Toast Component**
  - [x] Created `Toast.tsx` with four types: success, error, warning, info
  - [x] Implemented JRPG-styled notifications with accessible color coding
  - [x] Added auto-dismiss with configurable duration
  - [x] Click-to-dismiss functionality
  - [x] Enter/exit animations for smooth UX

- [x] **Toast Management Hook**
  - [x] Created `useToast` hook for managing toast state
  - [x] Convenience methods: `success()`, `error()`, `warning()`, `info()`
  - [x] Auto-incrementing toast IDs
  - [x] Toast container positioning (fixed top-right)

### Load/Save UX Improvements
- [x] **Save Session Enhancement**
  - [x] Replaced blocking `window.alert` with non-blocking toasts
  - [x] Info toast: "Preparing session file..."
  - [x] Success toast with session name confirmation
  - [x] Error toasts with specific error messages (5s duration)

- [x] **Load Session Enhancement**
  - [x] Info toast showing filename being loaded
  - [x] Snapshot validation for expected data
  - [x] Warning toasts for missing scene objects or characters
  - [x] Success toast confirming load with filename
  - [x] Error toasts for corrupted files with helpful messages

**Benefits**: Non-blocking feedback, professional UX, better error communication, validation warnings help DM understand session state.

---

## ✅ Player Staging Zone Transform Tool Support (October 2025)

### Visual Transform Tool Integration
- [x] **Staging Zone Selectable**
  - [x] Made staging zone unlocked by default (was previously locked)
  - [x] Added click/tap handlers for staging zone selection in select/transform modes
  - [x] DM can click staging zone to select it like any other scene object
  - [x] Wired staging zone to transform gizmo node reference system

- [x] **Transform Tool Support**
  - [x] Staging zone works with unified transform tool
  - [x] Move: Drag staging zone to reposition spawn area
  - [x] Scale: Resize staging zone width/height with transform handles
  - [x] Rotate: Rotate staging zone for map alignment

- [x] **Server Integration**
  - [x] Backend already handled staging zone transforms (RoomService.applySceneObjectTransform)
  - [x] Position updates sync to playerStagingZone.x/y
  - [x] Scale updates sync to playerStagingZone.width/height
  - [x] Rotation updates sync to playerStagingZone.rotation
  - [x] DM-only permission enforced on server side

**Benefits**: Replaced awkward DM menu number inputs with intuitive visual transform tool. Consistent UX across all transformable objects (map, tokens, staging zone). Direct manipulation with visual feedback.

---

## ✅ Contributor Readiness

### Testing Infrastructure

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

### CI/CD Pipeline

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

### Code Quality

- [x] **Linting & Type Safety**
  - [x] Zero-warning linting enforced (client & server)
  - [x] Eliminate all `any` types (replaced with proper types/unknown)
  - [x] Remove unused imports and variables
  - [x] Strict ESLint configuration with --max-warnings=0
  - [x] CI enforcement (no escape hatches)

### Community & Governance

- [x] **Issue Templates**
  - [x] Bug report template
  - [x] Feature request template
  - [x] Pull request template

- [x] **Contributing Guidelines**
  - [x] Create CONTRIBUTING.md
  - [x] Code style guide
  - [x] PR review process
  - [x] Testing requirements

### Security Hardening

- [x] Enforce configurable CORS policy for REST endpoints
- [x] Validate WebSocket origins during handshake

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

---

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

---

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

## ✅ Phase 13: Tool & Alignment Polish (COMPLETE - Oct 2025)

**Status**: UX polish for tabletop tooling shipped; tool toggles, measurement flow, and map alignment now feel cohesive.

- [x] Unified tool state management so header buttons instantly reflect the active mode and deselect prior tools.
- [x] Measurement tool now auto-closes after a distance is placed and exits with `Esc`, staying consistent with other tool workflows.
- [x] Delivered a Grid Alignment Wizard: DM captures two grid corners, previews scale/rotation deltas, and applies the transform directly from the DM menu.
- [x] Added alignment math helpers (`computeMapAlignmentTransform`) plus overlay guidance to capture points at high zoom.
- [x] Extended the transform gizmo with a center translation handle while restoring original draggable settings after interaction.

## ✅ Phase 12: Menu System Unification (COMPLETE - Oct 2025)

**Status**: All draggable windows now have position persistence. All menus use DraggableWindow component with localStorage.

### Completed Features

- [x] **Enhanced DraggableWindow Component**
  - [x] localStorage persistence with `storageKey` prop
  - [x] Bounds checking to prevent off-screen dragging
  - [x] Window resize event handling

- [x] **All Menus Refactored**
  - [x] PlayerSettingsMenu uses DraggableWindow + Portal (`storageKey="player-settings-menu"`)
  - [x] NpcSettingsMenu uses DraggableWindow + Portal (`storageKey="npc-settings-menu"`)
  - [x] DMMenu uses DraggableWindow (`storageKey="dm-menu"`)
  - [x] DrawingToolbar uses DraggableWindow (`storageKey="drawing-toolbar"`)
  - [x] DiceRoller uses DraggableWindow (`storageKey="dice-roller"`)
  - [x] RollLog uses DraggableWindow (`storageKey="roll-log"`)

### Success Criteria Achieved

- ✅ All menus use DraggableWindow component
- ✅ Menu positions persist across page refreshes
- ✅ PlayerSettingsMenu no longer causes EntitiesPanel scrolling
- ✅ DMMenu is movable and remembers position
- ✅ Consistent JRPG styling across all windows
- ✅ No z-index conflicts when multiple menus open
- ✅ Sensible default positions for first-time users

---
