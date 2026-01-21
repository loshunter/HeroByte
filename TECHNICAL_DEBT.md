# Technical Debt & Known Issues

**Last Updated**: January 2025
**After**: Phase 15 (DM Lazy Loading) & Fire-and-Forget Pattern Fixes

---

## 🐛 Active Bugs

### High Priority

**None Currently** ✅

### Medium Priority

1. **Port 5173 Conflict in WSL Environment**
   - **Issue**: Dev server fails to start on default port 5173
   - **Workaround**: Using port 5174 instead
   - **Root Cause**: Likely Windows process holding port (WSL networking quirk)
   - **Fix**: Investigate Windows port usage, or update dev scripts to use 5174 by default
   - **File**: `apps/client/package.json` (dev script)

### Low Priority

**None Currently** ✅

_(CSS Property Warning resolved in commit 1e8fd0f - converted 168 properties across 45 files)_

---

## 📦 Technical Debt

### Architecture

1. **God Object Violations (Critical)**
   - **Issue**: Several core files significantly exceed the project's 350 LOC limit (`docs/guides/PREVENTING_GOD_OBJECTS.md`).
     - `apps/server/src/ws/messageRouter.ts`: ~1012 LOC. Handles all WebSocket routing; critical bottleneck.
     - `apps/client/src/ui/App.tsx`: ~713 LOC. Remains a monolithic orchestrator despite previous refactoring attempts.
     - `packages/shared/src/models.ts`: ~599 LOC. "Dumping ground" for mixed domain types.
   - **Documentation Drift**: `TODO.md` claims `App.tsx` refactoring is complete, contradicting the actual code state.
   - **Recommendation**: Prioritize splitting `messageRouter.ts` into domain handlers and decomposing `App.tsx`.
   - **Priority**: High

2. **~~Large Bundle Size (628KB minified)~~** ✅ **RESOLVED**
   - **Previous**: Single-chunk bundle at 628KB (190KB gzipped)
   - **Current**: 53 KB entry bundle (gzipped) with lazy-loaded chunks
   - **Implementation**:
     - DM tooling: 11.85 KB lazy chunk (only loads when isDM = true)
     - Map rendering: 15.38 KB lazy chunk
     - Role-based code splitting
   - **Impact**: 49.5% reduction in entry bundle, regular players save 11.85 KB
   - **Status**: ✅ Complete (Phase 15, January 2025)
   - **CI Guard**: 175 KB gzipped limit enforced via `scripts/check-bundle-size.mjs`

3. **Player Persistence Logic Scattered**
   - **Current**: Player state save/load logic in multiple places
   - **Location**: `apps/client/src/utils/playerPersistence.ts` + inline in components
   - **Recommendation**: Consolidate into single service/hook
   - **Impact**: Code duplication, harder to maintain
   - **Effort**: Small (~1 hour)
   - **Priority**: Low

4. **Transform Logic Could Be Service**
   - **Current**: Transform operations mixed into component callbacks
   - **Recommendation**: Extract to `useSceneTransform` hook or service
   - **Benefits**: Easier testing, clearer separation of concerns
   - **Impact**: Low (code works fine as-is)
   - **Effort**: Medium (~2 hours)
   - **Priority**: Low

### Testing

1. **~~No E2E Tests~~** ✅ **RESOLVED**
   - **Previous**: Unit and integration tests only
   - **Current**: 10 Playwright E2E tests covering all critical flows
   - **Coverage**: Authentication, drawing tools, dice rolling, session save/load, multi-browser sync, voice chat, reconnection
   - **Impact**: Eliminated 30-60 min manual testing workflows, 10-20x efficiency gain
   - **Status**: ✅ Complete (October 2025)

2. **~~Scene Graph Migration Needs More Test Coverage~~** ✅ **RESOLVED**
   - **Previous**: Basic migration tested via `useSceneObjects` hook
   - **Current**: Added dedicated `useSceneObjects.test.ts` covering all legacy migration paths (maps, tokens, drawings, staging zones, pointers) and mixed scenarios.
   - **Status**: ✅ Complete (January 2026)

### Performance

1. **No Lazy Loading for Large Maps**
   - **Current**: All map data loaded at once
   - **Impact**: Potential lag with very large background images
   - **Recommendation**: Implement progressive image loading or chunked rendering
   - **Priority**: Low (not reported as issue yet)
   - **Effort**: Medium (~3 hours)

2. **Scene Graph Rebuild on Every State Update**
   - **Current**: `rebuildSceneGraph()` called frequently
   - **Optimization**: Memoize or diff-based updates
   - **Impact**: Likely minimal (small state), but could optimize
   - **Priority**: Low
   - **Effort**: Medium (~2 hours)

### Security

1. **Trust-Based DM Role**
   - **Current**: Any player can toggle DM mode client-side
   - **Design**: Intentional for Phase 9 (friends playing together)
   - **Future**: Phase 11+ will add proper room ownership
   - **Risk**: Low (social contract, not public service)
   - **Priority**: Deferred to Phase 11

2. **No HTTPS Enforcement (Dev)**
   - **Current**: Dev server runs HTTP only
   - **Impact**: WebRTC may not work on some browsers
   - **Fix**: Add SSL certs for local dev, or use Cloudflare tunnel
   - **Priority**: Low (production uses HTTPS)

---

## ⚠️ Breaking Changes to Watch

### Upcoming in Phase 10

- **Transform Gizmo UI**: May change how token dragging feels (visual handles)
- **Lock Controls**: Will prevent casual token movement when enabled
- **Map Transform**: DMs can now move/scale the map, may confuse players

### Migration Notes

**From Pre-Scene-Graph Versions:**

- Auto-migration handles legacy token/drawing data ✅
- No manual intervention needed for existing saves ✅
- Scene objects added transparently to RoomSnapshot

---

## 🔧 Maintenance Tasks

### Regular (Every Release)

- [ ] Run full test suite (`pnpm test`)
- [ ] Check bundle size (`pnpm build` output)
- [ ] Review dependency updates (`pnpm outdated`)
- [ ] Scan for new linting warnings (`pnpm lint`)

### Quarterly

- [ ] Review and close stale issues
- [ ] Update architecture diagrams
- [ ] Audit third-party dependencies for vulnerabilities
- [ ] Review and consolidate technical debt

---

## 📊 Metrics

**Code Quality (as of Jan 2025):**

- ✅ **Tests**: 2,173 passing (client: 766, server: ~1,407, E2E: 10)
- ✅ **Coverage**: 80%+ (shared: 99.57%, server: 80.99%, client: comprehensive)
- ✅ **Lint Warnings**: 0
- ✅ **TypeScript Errors**: 0
- ✅ **Bundle Size**: 53 KB entry (target: <175 KB, 69.4% under budget)

**Performance Baseline (Production Build):**

- **Entry Bundle**: 53.52 KB gzipped (185.41 kB raw)
- **DM Tooling**: 11.85 KB lazy chunk (53.33 kB raw)
- **Map Rendering**: 15.38 KB lazy chunk (47.21 kB raw)
- **Total (non-DM)**: ~237 KB gzipped
- **Total (DM)**: ~248 KB gzipped

**Technical Debt Ratio**: Very Low (1 resolved item, ~6 remaining items, mostly nice-to-haves)

---

## 🎯 Debt Reduction Plan

### Completed

- [x] Fix CSS property warnings during transform gizmo work (completed in 1e8fd0f)
- [x] Add E2E smoke tests for basic flows (October 2025 - 10 tests)
- [x] Implement code splitting for bundle size (Phase 15 - January 2025)
- [x] Fix fire-and-forget patterns (Phases 1-10 - January 2025)
- [x] Add scene graph migration tests (January 2026)

### Future Work

- Consolidate player persistence logic

### Phase 12+

- Extract transform logic into service
- Implement lazy loading for large maps
- Optimize scene graph rebuilds

---

## 📝 Notes

**Philosophy:**

- Prioritize shipping features over perfect architecture
- Address debt when it blocks new work or causes bugs
- Don't pre-optimize - measure first
- Keep debt log visible and reviewed regularly
