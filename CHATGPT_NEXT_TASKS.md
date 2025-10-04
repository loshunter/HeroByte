# ChatGPT Next Tasks

## ✅ Completed
- **Phase 1-3**: Testing Infrastructure & CI/CD (54 tests, 99.57% shared coverage)
- **Contributor Polish**: CONTRIBUTING.md + GitHub templates
- **Task 1**: Client Lint Fixes (0 errors/warnings, 24 files cleaned)
- **Task 2**: Server `any` Type Cleanup (0 warnings, 6 files hardened)

---

## 🎯 Current Task: Code Hygiene

**Goal**: Clean up all linting warnings to achieve zero-warning build and maintain code quality.

### Progress
- ✅ Task 1: Client browser globals + unused imports → **COMPLETE** (0 warnings)
- ✅ Task 2: Server `any` types → **COMPLETE** (0 warnings)
- ✅ Task 3: Remove unused imports → **COMPLETE** (done during 1 & 2)
- 🔄 Task 4: Lower linting thresholds → **READY TO START**

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

## Task 4: Lower Linting Thresholds (FINAL TASK)

**Problem**: Temporary high `--max-warnings` thresholds (server: 50, client: 200) are now unnecessary since we have **0 warnings**.

**Solution**: Lock in zero-warning enforcement by removing thresholds and CI fallbacks.

### Steps

1. **Verify Current State**
   ```bash
   pnpm --filter vtt-server lint
   pnpm --filter herobyte-client lint
   ```
   - Both should show **0 warnings** ✅

2. **Remove Server Threshold**
   - Location: `apps/server/package.json`
   - **Before:** `"lint": "eslint . --max-warnings 50"`
   - **After:** `"lint": "eslint ."`
   - This enforces **0 warnings** as the default

3. **Remove Client Threshold**
   - Location: `apps/client/package.json`
   - **Before:** `"lint": "eslint . --max-warnings 200"`
   - **After:** `"lint": "eslint ."`
   - This enforces **0 warnings** as the default

4. **Update CI Workflow**
   - Location: `.github/workflows/ci.yml`
   - **Before:** `run: pnpm lint || true`
   - **After:** `run: pnpm lint`
   - Remove the `|| true` fallback to make CI fail on lint errors

5. **Test Locally**
   ```bash
   pnpm lint
   pnpm test
   pnpm build
   ```
   - All commands should pass without errors

6. **Commit and Push**
   ```bash
   git add .
   git commit -m "Enforce zero-warning linting: remove --max-warnings thresholds and CI fallback"
   git push origin dev
   ```

### Success Criteria
- ✅ `apps/server/package.json` has no `--max-warnings` flag
- ✅ `apps/client/package.json` has no `--max-warnings` flag
- ✅ `.github/workflows/ci.yml` has no `|| true` fallback on lint step
- ✅ `pnpm lint` passes locally with 0 warnings
- ✅ CI enforces strict zero-warning policy going forward

---

## 🎉 After Task 4 Completion

Once Task 4 is done, **all Code Hygiene work will be complete!**

### Final Summary to Report

**Code Hygiene Results:**
- ✅ Client: 59 errors → 0 warnings (24 files cleaned)
- ✅ Server: 20+ any warnings → 0 warnings (6 files hardened)
- ✅ Unused imports: Removed across 30 files
- ✅ Linting thresholds: Server 50→0, Client 200→0
- ✅ CI enforcement: Strict zero-warning policy active

**Total Impact:**
- 30 files cleaned and type-hardened
- 79+ linting issues resolved
- Zero-warning codebase achieved
- Production-ready code quality enforced in CI

### Next Steps After Completion

Update `TODO.md` to mark Code Hygiene tasks as complete, then choose next focus:

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
