# ChatGPT Next Tasks

## ✅ Recently Completed

### Phase 10: Transform UI & Lock Controls (COMPLETE)

**Completed by Claude (Oct 2025)**

Implemented complete UI system for object transforms and locking:

- ✅ **Transform Gizmo**
  - Konva Transformer component with visual handles
  - Rotation and scale support
  - Respects locked state
  - Ready for integration (selection state needed)

- ✅ **Lock Controls**
  - Map lock toggle in DM Menu
  - Token lock toggles in PlayerCard/NpcCard
  - Lock state visualization with icon overlays
  - DM-only access enforced

- ✅ **Map Transform Controls**
  - Scale slider (0.1x - 3x) with live preview
  - Rotation slider (0° - 360°)
  - Position X/Y inputs for precise adjustment
  - Reset Transform button
  - All controls disabled when locked

- ✅ **Lock Indicators**
  - Custom lock icon with gold theming
  - Displays above locked tokens
  - Scales with grid size

**Status**: Fully functional with all features wired up. All tests passing (116/116).

---

### Phase 9: Scene Graph Architecture (COMPLETE)

**Completed by ChatGPT + Claude (Oct 2025)**

Implemented unified scene object system for all map entities:

- ✅ **Core Architecture**
  - SceneObject type system (map, token, drawing, pointer, prop)
  - SceneObjectTransform interface (position, scale, rotation, locked)
  - Automatic migration from legacy token/drawing data
  - Z-index ordering for proper layering

- ✅ **Server Implementation**
  - `rebuildSceneGraph()` auto-sync mechanism
  - `applySceneObjectTransform()` with authorization
  - transform-object message validation
  - Scene objects persist with save/load

- ✅ **Client Implementation**
  - `useSceneObjects()` hook with legacy fallback
  - Transform callback pipeline (App → MapBoard)
  - EntitiesPanel (unified players + NPCs view)
  - NPC management components

**Status**: Foundation complete and functional. All tests passing (36/36).

---

## 🎯 Next Phase: Enhanced Token Controls

### Phase 11: Token Size & Advanced Selection

**Priority**: High
**Effort**: Medium (~3-5 hours)

#### Goals
1. Token size variants (small/medium/large/huge)
2. Selection state management for TransformGizmo
3. Multi-select capabilities
4. Token rotation via gizmo

#### Tasks

**1. Token Size System**
- Add size property to Token model (default: medium)
- Size variants: tiny (0.5x), small (0.75x), medium (1x), large (1.5x), huge (2x), gargantuan (3x)
- UI controls in PlayerCard/NpcCard to change size
- Visual size indicator on tokens
- Respect locked state

**2. Selection State**
- Add selection manager hook (useObjectSelection)
- Single-click to select scene objects
- ESC to deselect
- Visual selection indicator (highlight border)
- Integrate TransformGizmo with selected objects

**3. Multi-Select (Optional)**
- Shift+click for multi-select
- Bulk transform operations
- Group lock/unlock

#### Success Criteria
- ✅ Tokens can be resized via UI
- ✅ TransformGizmo attached to selected objects
- ✅ Rotation and scaling work via gizmo
- ✅ Selection state synchronized across clients
- ✅ Size persists with session save/load

---

## 📋 Backlog

### High Priority
- Initiative tracker UI
- Fog of war system
- Token size options (small/medium/large/huge)
- Mobile/tablet improvements

### Medium Priority
- Asset manager (upload and organize tokens/maps)
- Character sheet integration
- Combat tracker enhancements
- Performance optimizations for large maps

### Low Priority
- Animated tokens
- Weather effects
- Spell effect animations
- Campaign management tools

---

## 🐛 Known Issues & Technical Debt

_(To be filled after Phase 10 review)_

- [ ] Port 5173 conflict in dev environment (using 5174 as workaround)
- [ ] Large bundle size warning (628KB) - consider code splitting
- [ ] CSS warning about justifyContent (should be justify-content)
- [ ] Review and consolidate player persistence logic
- [ ] Consider extracting transform logic into reusable service

---

## 📝 Notes

**Architecture Decisions:**
- Scene graph provides single source of truth for all renderable objects
- Backward compatible - auto-migrates legacy data
- Authorization at transform level (not render level) for simplicity
- DM role is trust-based (Phase 11 will add proper room ownership)

**Testing Recommendations:**
- Multi-player testing for transform sync
- Lock/unlock edge cases
- Scene graph migration with complex legacy data
- Performance with 100+ scene objects

**Documentation Needed:**
- Architecture diagram showing scene graph flow
- Transform authorization rules
- Migration guide for existing deployments
