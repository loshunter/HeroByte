# ChatGPT Next Tasks

## ✅ Recently Completed

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

## 🎯 Next Phase: UI Polish & Transform Controls

### Phase 10: Transform Gizmo & Lock Controls

**Priority**: High
**Effort**: Medium (~4-6 hours)

#### Goals
1. Visual transform handles (rotate, scale)
2. Lock/unlock UI controls
3. DM map transform controls
4. Individual drawing transforms

#### Tasks

**1. Transform Gizmo Component**
- Location: `apps/client/src/features/map/components/TransformGizmo.tsx`
- Visual handles for rotate and scale (translate already works via drag)
- Attach to selected scene objects
- Konva Transformer component integration
- Respect `locked` flag

**2. Lock Controls**
- Add lock toggle to PlayerCard/NpcCard
- Add lock button to DM menu for map
- Visual indicator for locked objects (lock icon overlay)
- Server already enforces locks ✅

**3. Map Transform Controls**
- DM menu section for map positioning
- Position, scale, rotation sliders/inputs
- Lock map button
- Preview while adjusting

**4. Drawing Refactor (Optional - Can Defer)**
- Convert drawings to individual scene objects
- Enable transforms on drawings
- Multi-select for drawings

#### Success Criteria
- ✅ Can rotate/scale tokens with visual handles
- ✅ Lock toggle prevents transforms
- ✅ DM can position/scale/rotate map
- ✅ Visual feedback for locked state
- ✅ No regressions to existing functionality

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
