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

## Phase 9: Scene Graph & Transform Overhaul (CURRENT)

- [ ] **Scene Object Core**
  - [ ] Define shared `SceneObject` interface (id, type, position, scale, rotation, locked, metadata)
  - [ ] Update room state + persistence to store drawings/tokens/map as `SceneObject[]`
  - [ ] Migration utilities for legacy snapshots
  - [ ] Add `transform-object` message schema & validation

- [ ] **Client Scene Layer**
  - [ ] `useSceneObjects` hook to consume unified list
  - [ ] Render layers (map/tokens/drawings) filter by type but share transform wrapper
  - [ ] Selection manager (single + multi select)

- [ ] **Transform Gizmo**
  - [ ] Konva-based handles supporting translate/rotate/scale
  - [ ] Respect lock flag; emit transforms via WebSocket
  - [ ] Server authorization (owner vs DM override)

- [ ] **Map as Object**
  - [ ] Load map background into `SceneObject` with lowest z-index
  - [ ] DM controls for map scale/rotation/lock in DM menu

- [ ] **Drawing Refactor**
  - [ ] Convert stored drawings to individual `SceneObject`s with metadata
  - [ ] Enable move/scale/rotate on drawings; update undo/redo to operate on IDs

- [ ] **Token Enhancements**
  - [ ] Token objects support rotation/scale when unlocked
  - [ ] Persist per-token lock state; expose toggle in settings
  - [ ] Prepare initiative metadata field for future combat tracker

- [ ] **Documentation & Demos**
  - [ ] Update README with new transform workflow
  - [ ] Add short demo GIF of transform handles

## Phase 10: Asset System & Initiative Prep (NEXT)

- [ ] Asset Manager Foundations
  - [ ] `AssetManager.tsx` with tabs (Maps, Tokens, Portraits, Props)
  - [ ] URL-based registry persisted to localStorage
  - [ ] DM import flow for map/token assets

- [ ] Initiative & Status Hooks
  - [ ] Store optional `initiative` stat on scene objects (when relevant)
  - [ ] Extend status-effect system to broadcast to tokens (portrait + token badge)
  - [ ] Prototype initiative ordering UI leveraging unified scene objects

- [ ] Session & Networking
  - [ ] Ensure scene-object snapshots serialize cleanly for save/load
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
