# ChatGPT Next Tasks

## ✅ Completed
- **Phase 1-3**: Testing Infrastructure & CI/CD (54 tests, 99.57% shared coverage)
- **Contributor Polish**: CONTRIBUTING.md + GitHub templates
- **Task 1**: Client Lint Fixes (0 errors/warnings, 24 files cleaned)

---

## 🎯 Current Task: Code Hygiene

**Goal**: Clean up all linting warnings to achieve zero-warning build and maintain code quality.

### Progress
- ✅ Task 1: Client browser globals + unused imports → **COMPLETE** (0 warnings)
- 🔄 Task 2: Server `any` types → **IN PROGRESS** (18 warnings remaining)
- ⏳ Task 3: Remove unused imports (pending)
- ⏳ Task 4: Lower linting thresholds (pending)

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

## Task 2: Replace `any` with `unknown` in Server (IN PROGRESS)

**Problem**: ~~20+~~ **18 warnings** remaining in server code due to explicit `any` types.

**Solution**: Replace `any` with `unknown` and add proper type guards/assertions.

### ✅ Already Fixed
- ✅ `apps/server/src/container.ts` - Now uses typed WebSocket instances
- ✅ `apps/server/src/domains/room/service.ts` - loadSnapshot accepts RoomSnapshot type

### 🎯 Remaining Work (18 warnings)

**Files still needing fixes:**

1. **`apps/server/src/middleware/validation.ts`**
   - Message validation functions likely use `any`
   - Replace with `unknown` and add type guards

2. **`apps/server/src/ws/**/*.ts`** (message router, connection handlers)
   - WebSocket message handlers may have `any` parameters
   - Use type predicates for ClientMessage validation

3. **Test files** (`apps/server/**/*.test.ts`)
   - Mock data or test helpers may use `any`
   - Replace with proper types or `unknown` with assertions

### Steps to Complete

1. **Run Lint to Find Remaining `any` Types**
   ```bash
   pnpm --filter vtt-server lint
   ```
   - Should show exactly 18 warnings
   - Note file paths and line numbers

2. **Fix Each File**

3. **Example Pattern** (same as before)

   **Before:**
   ```typescript
   function handleMessage(msg: any) {
     if (msg.t === "move-token") {
       // ...
     }
   }
   ```

   **After:**
   ```typescript
   function handleMessage(msg: unknown) {
     if (isClientMessage(msg) && msg.t === "move-token") {
       // ...
     }
   }

   function isClientMessage(msg: unknown): msg is ClientMessage {
     return typeof msg === "object" && msg !== null && "t" in msg;
   }
   ```

4. **Test After Each Fix**
   ```bash
   pnpm --filter vtt-server lint
   ```
   - Track progress: 18 → 10 → 5 → 0

5. **Run Full Test Suite**
   ```bash
   pnpm --filter vtt-server test
   ```
   - Ensure no tests break from type changes

### Success Criteria
- ✅ All 18 remaining `any` types replaced with `unknown` or specific types
- ✅ Type guards added where needed
- ✅ `pnpm --filter vtt-server lint` shows **0 warnings**
- ✅ All tests still pass

---

## Task 3: Remove Unused Imports

**Problem**: Multiple files have unused imports cluttering the code.

**Solution**: Auto-fix with ESLint and manually review remaining cases.

### Steps

1. **Auto-fix Unused Imports**
   ```bash
   pnpm lint --fix
   ```
   - This will automatically remove most unused imports

2. **Verify Changes**
   ```bash
   git diff
   ```
   - Review removed imports to ensure nothing critical was deleted

3. **Run Linting Again**
   ```bash
   pnpm lint
   ```
   - Check if any unused import warnings remain

4. **Manual Cleanup (if needed)**
   - If auto-fix didn't catch everything:
     - Search for "is defined but never used" warnings
     - Remove or use the imported items

### Success Criteria
- ✅ No "unused import" warnings remain
- ✅ All imports are actually used in the code
- ✅ Tests still pass after cleanup

---

## Task 4: Lower Linting Thresholds

**Problem**: Temporary high `--max-warnings` thresholds mask code quality issues.

**Solution**: Gradually reduce thresholds to zero after fixing warnings.

### Steps

1. **Check Current Warning Count**
   ```bash
   pnpm --filter herobyte-server lint
   pnpm --filter herobyte-client lint
   ```
   - Note the actual warning count for each package

2. **Update Server Threshold**
   - Location: `apps/server/package.json`
   - Current: `"lint": "eslint . --max-warnings 50"`
   - Target: Reduce to actual warning count (e.g., 10, then 5, then 0)
   - Example:
     ```json
     "lint": "eslint . --max-warnings 10"
     ```

3. **Update Client Threshold**
   - Location: `apps/client/package.json`
   - Current: `"lint": "eslint . --max-warnings 200"`
   - Target: Reduce to ~50, then 20, then 0
   - Example:
     ```json
     "lint": "eslint . --max-warnings 50"
     ```

4. **Update CI Workflow**
   - Location: `.github/workflows/ci.yml`
   - Remove `|| true` fallback from lint step:
     ```yaml
     - name: Run lint checks
       run: pnpm lint  # Remove || true
     ```

5. **Test CI Locally**
   ```bash
   pnpm lint
   pnpm test
   pnpm build
   ```
   - Ensure all checks pass before pushing

### Success Criteria
- ✅ Server lint threshold reduced to 0
- ✅ Client lint threshold reduced to 0
- ✅ CI workflow enforces strict linting (no `|| true`)
- ✅ All checks pass on CI

---

## After Completion

Once all 4 tasks are done:

1. **Commit Changes**
   ```bash
   git add .
   git commit -m "Complete code hygiene: Fix browser globals, replace any with unknown, remove unused imports, enforce zero-warning linting"
   ```

2. **Push to Dev**
   ```bash
   git push origin dev
   ```

3. **Update TODO.md**
   - Mark "Code Hygiene" items as complete in CRITICAL section

4. **Report Summary**
   - Total warnings reduced: [before] → [after]
   - Files cleaned: [count]
   - Linting thresholds: Server 50→0, Client 200→0

---

## How to Proceed

1. Work through tasks **in order** (Task 1 → Task 2 → Task 3 → Task 4)
2. Test after each task to ensure nothing breaks
3. Commit incrementally (one task per commit)
4. Report back with summary when all tasks complete

Let me know if you encounter any issues or need clarification on any step!
