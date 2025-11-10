# Technical Debt & Known Issues

**Last Updated**: October 2025
**After**: Phase 9 (Scene Graph Architecture)

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

1. **Large Bundle Size (628KB minified)**
   - **Current**: Single-chunk bundle at 628KB (190KB gzipped)
   - **Threshold**: Rollup warns at 500KB
   - **Recommendation**:
     - Implement code splitting with dynamic imports
     - Split Konva/heavy libraries into separate chunks
     - Use `build.rollupOptions.output.manualChunks`
   - **Impact**: Slower initial load on poor connections
   - **Effort**: Medium (~2-3 hours)
   - **Priority**: Medium

2. **Player Persistence Logic Scattered**
   - **Current**: Player state save/load logic in multiple places
   - **Location**: `apps/client/src/utils/playerPersistence.ts` + inline in components
   - **Recommendation**: Consolidate into single service/hook
   - **Impact**: Code duplication, harder to maintain
   - **Effort**: Small (~1 hour)
   - **Priority**: Low

3. **Transform Logic Could Be Service**
   - **Current**: Transform operations mixed into component callbacks
   - **Recommendation**: Extract to `useSceneTransform` hook or service
   - **Benefits**: Easier testing, clearer separation of concerns
   - **Impact**: Low (code works fine as-is)
   - **Effort**: Medium (~2 hours)
   - **Priority**: Low

### Testing

1. **No E2E Tests**
   - **Current**: Unit and integration tests only (36 tests)
   - **Missing**: Critical user flows (join session, move token, roll dice)
   - **Recommendation**: Add Playwright tests for smoke testing
   - **Impact**: Risk of UI regressions going unnoticed
   - **Effort**: Medium (~4 hours for basic suite)
   - **Priority**: Medium

2. **Scene Graph Migration Needs More Test Coverage**
   - **Current**: Basic migration tested via `useSceneObjects` hook
   - **Missing**: Complex legacy data scenarios (100+ objects, mixed types)
   - **Recommendation**: Add unit tests for `rebuildSceneGraph` edge cases
   - **Effort**: Small (~1 hour)
   - **Priority**: Medium

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

**Code Quality (as of Oct 2025):**

- ✅ **Tests**: 36/36 passing (9 test files)
- ✅ **Coverage**: 75%+ (shared: 99.57%, server: 75%+)
- ✅ **Lint Warnings**: 0
- ✅ **TypeScript Errors**: 0
- ⚠️ **Bundle Size**: 628KB (target: <500KB)

**Technical Debt Ratio**: Low (~8 items, mostly cosmetic)

---

## 🎯 Debt Reduction Plan

### Phase 10 (Current)

- [x] Fix CSS property warnings during transform gizmo work (completed in 1e8fd0f)
- [ ] Add E2E smoke tests for basic flows

### Phase 11

- Implement code splitting for bundle size
- Consolidate player persistence logic
- Add scene graph migration tests

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
