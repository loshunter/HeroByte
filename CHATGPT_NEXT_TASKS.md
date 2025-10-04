# ChatGPT Next Tasks

## ✅ Completed
- **Phase 1-3**: Testing Infrastructure & CI/CD (54 tests, 99.57% shared coverage)
- **Contributor Polish**: CONTRIBUTING.md + GitHub templates
- **Code Hygiene (Tasks 1-4)**: Zero-warning codebase achieved
  - Task 1: Client Lint Fixes (0 warnings, 24 files cleaned)
  - Task 2: Server `any` Type Cleanup (0 warnings, 6 files hardened)
  - Task 3: Unused Imports Removed (30 files total)
  - Task 4: Zero-Warning Enforcement Locked In

---

## 🎉 Code Hygiene: COMPLETE

**Goal**: ~~Clean up all linting warnings~~ → **ACHIEVED**

### Final Results
- ✅ Task 1: Client browser globals + unused imports → **COMPLETE** (0 warnings)
- ✅ Task 2: Server `any` types → **COMPLETE** (0 warnings)
- ✅ Task 3: Remove unused imports → **COMPLETE** (30 files)
- ✅ Task 4: Zero-warning enforcement → **COMPLETE** (CI locked)

---

## ~~Task 1: Fix Browser Globals in Client~~ ✅ COMPLETE

**Problem**: 59 errors in client code due to missing browser global type definitions.

**Solution**: Add missing browser globals to ESLint configuration.

### Steps

1. **Update `eslint.config.js`**
   - Location: `/home/loshunter/HeroByte/eslint.config.js`
   - Find the React configuration section (around line 47-65)
   - Add these missing globals to the `globals` object:
     ```javascript
     globals: {
       window: "readonly",
       document: "readonly",
       navigator: "readonly",
       localStorage: "readonly",
       MediaStream: "readonly",
       Audio: "readonly",
       crypto: "readonly",
       // ADD THESE:
       WebSocket: "readonly",
       HTMLElement: "readonly",
       HTMLDivElement: "readonly",
       KeyboardEvent: "readonly",
       ResizeObserver: "readonly",
       prompt: "readonly",
       setTimeout: "readonly",
       clearTimeout: "readonly",
       setInterval: "readonly",
       clearInterval: "readonly",
     },
     ```

2. **Test the Fix**
   ```bash
   pnpm --filter herobyte-client lint
   ```
   - Should see significant reduction in errors (59 → ~10-20)

3. **Fix Remaining Unused Variable Errors**
   - Prefix unused variables with `_` (e.g., `const _token` instead of `const token`)
   - Or remove the variable if truly unused
   - Files likely affected:
     - `apps/client/src/components/dice/BuildStrip.tsx`
     - `apps/client/src/components/dice/DiceRoller.tsx`
     - `apps/client/src/ui/App.tsx`
     - `apps/client/src/ui/MapBoard.tsx`

### Success Criteria
- ✅ `pnpm --filter herobyte-client lint` passes with <10 warnings
- ✅ All 59 "not defined" errors are fixed
- ✅ Unused variable errors reduced

---

## ~~Task 2: Replace `any` with `unknown` in Server~~ ✅ COMPLETE

**Problem**: ~~20+ → 18~~ **All `any` types eliminated.**

**Solution**: Replaced `any` with `unknown` and added proper type guards/assertions.

### ✅ All Files Fixed
- ✅ `apps/server/src/container.ts` - Typed WebSocket instances
- ✅ `apps/server/src/domains/room/service.ts` - RoomSnapshot type signature
- ✅ `apps/server/src/middleware/validation.ts` - Message validation with guards
- ✅ `apps/server/src/ws/messageRouter.ts` - RTC message helpers, switch case wrappers
- ✅ `apps/server/src/domains/__tests__/roomService.test.ts` - Cast through unknown
- ✅ `apps/server/src/middleware/__tests__/validation.test.ts` - Mock WebSockets typed
- ✅ `apps/server/src/ws/__tests__/connectionHandler.test.ts` - Proper signatures

### Results
- ✅ `pnpm --filter vtt-server lint` → **0 warnings**
- ✅ `pnpm --filter herobyte-client lint` → **0 warnings**
- ✅ `pnpm lint` → **Passes successfully**
- ✅ All tests still passing

---

## ~~Task 3: Remove Unused Imports~~ ✅ COMPLETE

**Problem**: Multiple files had unused imports cluttering the code.

**Solution**: Removed during Task 1 and Task 2 cleanup.

### ✅ Work Already Done
- Client unused imports removed in Task 1 (24 files cleaned)
- Server unused imports removed in Task 2 (6 files cleaned)
- Both `pnpm --filter herobyte-client lint` and `pnpm --filter vtt-server lint` pass with 0 warnings

### Verification
```bash
pnpm lint
```
- ✅ Passes successfully with no unused import warnings

**Note**: This task was effectively completed alongside Tasks 1 and 2. No additional work needed.

---

## ~~Task 4: Zero-Warning Enforcement~~ ✅ COMPLETE

**Problem**: ~~Temporary high `--max-warnings` thresholds needed removal.~~

**Solution**: Locked in zero-warning enforcement across codebase and CI.

### ✅ Changes Made
- ✅ `apps/server/package.json` - Changed to `--max-warnings=0` (was 50)
- ✅ `apps/client/package.json` - Changed to `--max-warnings=0` (was 200)
- ✅ `.github/workflows/ci.yml` - Removed `|| true` escape hatch

### Results
- ✅ `pnpm lint` passes locally with **0 warnings**
- ✅ CI now **fails** on any lint regression
- ✅ Zero-warning standard locked in for all future PRs
- ✅ Production-ready code quality enforced

---

## 🎉 Code Hygiene: ALL TASKS COMPLETE!

### Final Summary

**Code Hygiene Results:**
- ✅ Client: 59 errors → 0 warnings (24 files cleaned)
- ✅ Server: 20+ any warnings → 0 warnings (6 files hardened)
- ✅ Unused imports: Removed across 30 files
- ✅ Linting thresholds: Server 50→0, Client 200→0
- ✅ CI enforcement: Strict zero-warning policy active

**Total Impact:**
- 33 files cleaned and type-hardened
- 79+ linting issues resolved
- Zero-warning codebase achieved
- Production-ready code quality enforced in CI

---

## 🚀 What's Next?

All Code Hygiene work is now **COMPLETE**! Choose the next focus area:

**Option A: Phase 9 Features** (State & Persistence)
- Undo/Redo for drawings (Ctrl+Y)
- Player state persistence (save/load)
- Session save/load system
- Asset manager foundations
- Private room system

**Option B: Visual Polish** (README improvements)
- Screenshots of gameplay
- GIF/video demos
- Architecture diagrams
- Troubleshooting section

**Option C: Testing Expansion**
- E2E tests with Playwright
- Increase server coverage >80%
- Performance benchmarks

Let me know which direction you want to go next!
