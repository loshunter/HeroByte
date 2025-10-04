# HeroByte TODO

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

- [ ] Testing
  - [ ] Unit tests for shared logic
  - [ ] Integration tests for WebSocket communication
  - [ ] E2E tests for critical workflows

- [ ] Documentation
  - [ ] API documentation
  - [ ] User guide
  - [ ] DM guide
  - [ ] Contributing guidelines

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
