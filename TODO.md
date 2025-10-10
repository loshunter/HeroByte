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

- [ ] **Selection State Management**
  - [ ] Add select-object/deselect-object message types to @shared
  - [ ] Add selection tracking to RoomState (Map<uid, selectedObjectId>)
  - [ ] Implement selection broadcast in RoomService
  - [ ] Add selection manager hook (`useObjectSelection`) on client
  - [ ] Single-click to select scene objects
  - [ ] ESC to deselect
  - [ ] Visual selection indicator (highlight border)
  - [ ] Integrate TransformGizmo with selected objects
  - [ ] Selection state synchronized across clients

- [ ] **Multi-Select** (Optional)
  - [ ] Add select-multiple message type
  - [ ] Shift+click for multi-select on client
  - [ ] Bulk transform operations
  - [ ] Group lock/unlock

---

## Phase 12: Asset System & Initiative Prep (Future)

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
  - [x] Eraser tool
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
