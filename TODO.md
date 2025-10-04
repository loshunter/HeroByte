# HeroByte TODO

## CRITICAL: Contributor Readiness (BLOCKING)

**These items are essential for making the repo stable and contributor-friendly.**

### Testing Infrastructure

- [ ] **Unit Tests**
  - [ ] Set up Vitest for shared package (`packages/shared/`)
  - [ ] Test shared model classes (TokenModel, PlayerModel, CharacterModel)
  - [ ] Test validation schemas and utilities
  - [ ] Achieve >80% coverage on shared logic

- [ ] **Integration Tests**
  - [ ] Set up test environment for WebSocket
  - [ ] Test socket handshake and connection lifecycle
  - [ ] Test message routing and validation middleware
  - [ ] Test rate limiting behavior
  - [ ] Test room state synchronization

- [ ] **E2E Tests** (optional for now)
  - [ ] Set up Playwright or Cypress
  - [ ] Test critical user flows (join session, move token, roll dice)

### CI/CD Pipeline

- [ ] **GitHub Actions Setup**
  - [x] Create `.github/workflows/ci.yml`
  - [x] Run linting on all PRs (eslint + prettier)
  - [x] Run tests on all PRs
  - [x] Build validation for client and server
  - [x] Fail PRs if any check fails

- [ ] **Quality Gates**
  - [x] Add code coverage reporting
  - [x] Add build status badge to README
  - [x] Add test coverage badge to README

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

- [ ] **Issue Templates**
  - [ ] Bug report template
  - [ ] Feature request template
  - [ ] Pull request template

- [ ] **Contributing Guidelines**
  - [ ] Create CONTRIBUTING.md
  - [ ] Code style guide
  - [ ] PR review process
  - [ ] Testing requirements

---

## Phase 9: Core State & Persistence (CURRENT)

- [ ] Undo System for Drawings
  - [x] Ctrl+Z undo functionality (already working)
  - [ ] Redo support (Ctrl+Y)

- [ ] Player State Persistence
  - [ ] PlayerState interface in packages/shared/src/models.ts
  - [ ] playerPersistence.ts utility (savePlayerState, loadPlayerState)
  - [ ] Save/Load buttons in PlayerCard.tsx
  - [ ] JSON export/import for player data

- [ ] Map + Session Save/Load
  - [ ] sessionPersistence.ts utility
  - [ ] Full RoomSnapshot export (players, tokens, drawings, map)
  - [ ] Save/Load buttons in Header.tsx
  - [ ] Session restore functionality

- [ ] Asset Manager Foundations
  - [ ] AssetManager.tsx component with tabs (Scenes/Maps, Tokens, Portraits, Props/Misc)
  - [ ] URL-based asset registry
  - [ ] Client-side persistence (localStorage)
  - [ ] Integration with MapBoard for background selection

- [ ] Private Room System
  - [ ] roomId concept in WebSocket server
  - [ ] UUID-based room links generation
  - [ ] DM controls (pre-create players/NPCs, invite links)
  - [ ] RoomConnector.ts with roomId parameter

- [ ] Server Status Polish
  - [ ] Connection state indicators (🟢 Connected, 🔴 Disconnected, 💤 Reconnecting)
  - [ ] Room name display

- [ ] Documentation
  - [ ] Save/Load instructions in README
  - [ ] Private room system documentation
  - [ ] Asset manager usage guide
  - [ ] UI tooltips for Save/Load and Undo

## Phase 10: Asset & Token Expansion (NEXT)

- [ ] Asset Manager Upgrade
  - [ ] Full registry schema with AssetType
  - [ ] UI tabs for each asset type
  - [ ] Upload via URL input
  - [ ] localStorage persistence across sessions

- [ ] Token Image Replacement
  - [ ] Add imageUrl to Token model
  - [ ] TokenRenderer.tsx image support (fallback to color)
  - [ ] "Replace Token Image" button in PartyPanel/PlayerCard
  - [ ] Asset Manager integration for token selection

- [ ] Party List Color → Name
  - [ ] Move color selection from token to player name field
  - [ ] Update PlayerCard.tsx styling
  - [ ] Keep color fallback for tokens without images

- [ ] NPC Workflow
  - [ ] Drag-spawn NPCs from Asset Manager
  - [ ] Red border styling for NPCs in party panel
  - [ ] NPC flag in Token model

- [ ] Session Persistence Upgrade
  - [ ] Include assets in snapshot
  - [ ] Include token image URLs
  - [ ] Restore assets on session load

- [ ] Onboarding Message
  - [ ] Welcome overlay in public-demo lobby
  - [ ] Click-to-dismiss functionality

- [ ] Documentation
  - [ ] Asset Manager usage
  - [ ] Token replacement guide
  - [ ] NPC spawning instructions

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
