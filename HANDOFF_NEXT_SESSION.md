# Handoff Document for Next Claude Code Session

**Date:** 2025-11-14
**Branch:** `dev` (clean, ready for next refactor)
**Context Size:** Use this prompt to start fresh session

---

## Quick Context

You are continuing the **Phase 15 SOLID Refactor Initiative** for the HeroByte virtual tabletop project. The client-side refactoring is complete, and server-side refactoring has begun with validation.ts successfully decomposed.

**Your next task:** Refactor `apps/server/src/domains/room/service.ts` (688 LOC → ~300 LOC target)

---

## What Has Been Completed

### ✅ Client-Side Refactoring (100% Complete)
- **App.tsx:** 1,850 → 519 LOC (72% reduction, 1,331 LOC removed)
- **DMMenu.tsx:** 1,588 → 265 LOC (83% reduction, 1,323 LOC removed)
- **MapBoard.tsx:** 1,034 → 528 LOC (49% reduction, 506 LOC removed)
- **Total Impact:** 3,160 LOC reduced across 3 god files

### ✅ Server-Side Refactoring (Phase 1 Complete)
- **validation.ts:** 927 → 260 LOC (72% reduction)
  - 8 domain validator modules created
  - `constants.ts` with centralized limits
  - Test coverage: 58 → 123 tests (+112%)
  - **Status:** Merged to `dev` branch 2025-11-14

---

## Current Repository State

### Branch Structure
- **`main`:** Stable production branch
- **`dev`:** ✅ Latest work (includes validation refactor)
- **Feature branches:** Deleted (already merged)

### Test Status
- **Server tests:** 285/285 passing ✅
- **Client tests:** 1,984/1,984 passing ✅
- **Total:** 2,269 tests passing
- **Coverage:** Maintained throughout refactoring

### Key Files
```
/home/loshunter/HeroByte/
├── docs/refactoring/
│   ├── README.md                        # Overview & FAQ
│   ├── REFACTOR_ROADMAP.md              # Complete Phase 15 plan
│   ├── REFACTOR_PLAYBOOK.md             # 17-step extraction process
│   ├── BRANCHING_STRATEGY.md            # Git workflow
│   ├── NEXT_STEPS.md                    # Context & lessons learned
│   └── ROOM_SERVICE_REFACTOR_PLAN.md    # ⭐ Your roadmap (NEW)
├── apps/server/src/
│   ├── middleware/
│   │   ├── validation.ts                # ✅ Refactored (260 LOC)
│   │   └── validators/                  # ✅ 8 domain modules + constants
│   └── domains/room/
│       ├── service.ts                   # 🎯 YOUR TARGET (688 LOC)
│       └── model.ts                     # Types (unchanged)
└── pr7-validation-refactor.md           # Detailed assessment of validation work
```

---

## Your Mission: Refactor room/service.ts

### The Goal
Decompose the RoomService god object (688 LOC) into 6 focused modules following the successful validation.ts pattern.

### The Plan
**Read this first:** `/home/loshunter/HeroByte/docs/refactoring/ROOM_SERVICE_REFACTOR_PLAN.md`

**Summary:**
- **6 modules to extract:**
  1. `persistence/StatePersistence.ts` (~100 LOC) - File I/O
  2. `snapshot/SnapshotLoader.ts` (~150 LOC) - Snapshot merging
  3. `scene/SceneGraphBuilder.ts` (~170 LOC) - Scene object building
  4. `transform/TransformHandler.ts` (~180 LOC) - Transform handling
  5. `staging/StagingZoneManager.ts` (~80 LOC) - Staging zone logic
  6. `service.ts` (orchestrator, ~300 LOC) - Coordination

- **Extraction order (dependency-aware):**
  - Phase 1: StagingZoneManager, StatePersistence (2 days)
  - Phase 2: SceneGraphBuilder, SnapshotLoader (3 days)
  - Phase 3: TransformHandler (2 days)
  - Phase 4: Update RoomService orchestrator (1 day)

### Success Criteria
- ✅ service.ts reduced to ~300 LOC
- ✅ 6 focused modules created
- ✅ All 285 server tests passing
- ✅ 100+ new characterization tests
- ✅ Zero behavioral changes

---

## Step-by-Step: How to Proceed

### Step 1: Read the Documentation (15 minutes)

Read these files in order:
1. `/home/loshunter/HeroByte/docs/refactoring/ROOM_SERVICE_REFACTOR_PLAN.md` (your primary guide)
2. `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_PLAYBOOK.md` (17-step extraction process)
3. `/home/loshunter/HeroByte/pr7-validation-refactor.md` (reference for patterns used in validation)

### Step 2: Verify Clean State (5 minutes)

```bash
cd /home/loshunter/HeroByte
git status                    # Should show: On branch dev, clean
pnpm test:server              # Should show: 285/285 passing
pnpm test:client              # Should show: 1984/1984 passing
```

### Step 3: Start with Phase 1 - StagingZoneManager (Day 1)

#### Create Feature Branch
```bash
git checkout dev
git pull origin dev
git checkout -b refactor/server/staging-zone-manager
```

#### Follow the Playbook

**Pre-Extraction (Steps 1-3):**
1. **Select target:** `StagingZoneManager` (from ROOM_SERVICE_REFACTOR_PLAN.md)
2. **Understand current behavior:**
   - Read `service.ts:26-54` (sanitizeStagingZone)
   - Read `service.ts:656-687` (setPlayerStagingZone, getPlayerSpawnPosition)
   - Document inputs, outputs, edge cases
3. **Create characterization tests:**
   - File: `apps/server/src/domains/room/staging/__tests__/StagingZoneManager.test.ts`
   - Test sanitize (valid zone, invalid zone, missing fields)
   - Test spawn position (distribution, rotation)
   - Test geometric calculations

**Extraction (Steps 4-7):**
4. **Create new file:** `apps/server/src/domains/room/staging/StagingZoneManager.ts`
5. **Define interface:**
   ```typescript
   export class StagingZoneManager {
     sanitize(zone: unknown): PlayerStagingZone | undefined;
     setZone(state: RoomState, zone: PlayerStagingZone | undefined): boolean;
     getSpawnPosition(zone: PlayerStagingZone | undefined): { x: number; y: number };
   }
   ```
6. **Extract logic** from service.ts
7. **Update service.ts** to use new module:
   ```typescript
   import { StagingZoneManager } from "./staging/StagingZoneManager.js";

   class RoomService {
     private stagingManager = new StagingZoneManager();

     setPlayerStagingZone(zone) {
       return this.stagingManager.setZone(this.state, zone);
     }
   }
   ```

**Verification (Steps 8-10):**
8. **Run tests:** `pnpm test:server` (285/285 should pass)
9. **Manual verification:** Start server, test staging zone operations
10. **Add unit tests** for isolated module

**Documentation (Steps 11-12):**
11. **Add JSDoc** to all public methods
12. **Update ROOM_SERVICE_REFACTOR_PLAN.md** (mark Phase 1.1 complete)

**Review (Steps 13-15):**
13. **Self-review** changes
14. **Commit:**
    ```bash
    git add .
    git commit -m "refactor: extract StagingZoneManager from RoomService

    Extract staging zone logic (sanitize, setZone, getSpawnPosition) into
    dedicated module. service.ts reduced by ~55 LOC.

    - New module: domains/room/staging/StagingZoneManager.ts (80 LOC)
    - Characterization tests: 15 tests covering all scenarios
    - All 285 server tests passing

    Part of Phase 15 SOLID Refactor - Room Service Decomposition
    Phase 1.1 complete (utilities extraction)"
    ```
15. **Push:** `git push origin refactor/server/staging-zone-manager`

**Post-Merge (Steps 16-17):**
16. **Wait for CI checks** (if applicable)
17. **Merge to dev:**
    ```bash
    git checkout dev
    git pull origin dev
    git merge refactor/server/staging-zone-manager --no-ff
    git push origin dev
    git branch -d refactor/server/staging-zone-manager
    ```

### Step 4: Continue with Remaining Phases

Repeat the playbook for each module in order:
- Phase 1.2: StatePersistence (Day 2)
- Phase 2.1: SceneGraphBuilder (Days 3-4)
- Phase 2.2: SnapshotLoader (Day 5)
- Phase 3: TransformHandler (Days 6-7)
- Phase 4: Update RoomService orchestrator (Day 8)

---

## Key Patterns from Validation Refactor

### Pattern 1: Extract to Domain Modules
```
Before:
  middleware/validation.ts (927 LOC)

After:
  middleware/
    validation.ts (260 LOC - orchestrator)
    validators/
      tokenValidators.ts (103 LOC)
      playerValidators.ts (111 LOC)
      ...8 total modules
      constants.ts (77 LOC)
```

**Apply to room/service.ts:**
```
Before:
  domains/room/service.ts (688 LOC)

After:
  domains/room/
    service.ts (300 LOC - orchestrator)
    persistence/StatePersistence.ts (100 LOC)
    snapshot/SnapshotLoader.ts (150 LOC)
    scene/SceneGraphBuilder.ts (170 LOC)
    transform/TransformHandler.ts (180 LOC)
    staging/StagingZoneManager.ts (80 LOC)
```

### Pattern 2: Characterization Tests First
**From validation:**
- 58 tests → 123 tests (+112%)
- No existing tests broken
- Captured all edge cases

**Apply to room/service:**
- Write tests BEFORE extraction
- Cover all current behavior
- Test edge cases (null values, empty arrays, etc.)

### Pattern 3: Small Atomic Commits
**From validation:**
```
54d96e3 - Initial decomposition
6328ab7 - Extract constants
cf70973 - Apply constants to tokenValidators
46fbd36 - Complete constants migration
```

**Apply to room/service:**
- One module per branch
- One extraction per commit
- Clear commit messages
- Push frequently

### Pattern 4: Constants Extraction
**From validation:**
Created `constants.ts` with:
- PAYLOAD_LIMITS (portrait 2MB, map 10MB)
- STRING_LIMITS (names, colors, URLs)
- ARRAY_LIMITS (effects, objects, drawings)
- RANGE_LIMITS (grid, scale, mic)

**Apply to room/service (if needed):**
- Extract any magic numbers
- Use const assertions (`as const`)
- Export from central module

---

## Common Pitfalls to Avoid

### 1. Don't Add Features
**❌ Wrong:**
```typescript
// While refactoring, add new validation
if (zone.width < 0.5) {
  throw new Error("Zone too small"); // NEW FEATURE!
}
```

**✅ Correct:**
```typescript
// Preserve exact current behavior
if (zone.width < 0.5) {
  return undefined; // EXISTING BEHAVIOR
}
```

### 2. Don't Skip Tests
**❌ Wrong:**
```bash
# Extract module without tests
git commit -m "refactor: extract StagingZoneManager"
# OOPS - no tests written!
```

**✅ Correct:**
```bash
# Write characterization tests FIRST
git add staging/__tests__/StagingZoneManager.test.ts
git commit -m "test: add characterization tests for StagingZoneManager"
# THEN extract
git commit -m "refactor: extract StagingZoneManager from RoomService"
```

### 3. Don't Create Circular Dependencies
**❌ Wrong:**
```typescript
// StagingZoneManager.ts
import { RoomService } from "../service.js"; // CIRCULAR!

// service.ts
import { StagingZoneManager } from "./staging/StagingZoneManager.js";
```

**✅ Correct:**
```typescript
// StagingZoneManager.ts
import type { RoomState } from "../model.js"; // TYPE IMPORT ONLY

// service.ts
import { StagingZoneManager } from "./staging/StagingZoneManager.js";
```

### 4. Don't Batch Unrelated Changes
**❌ Wrong:**
```bash
# Extract 3 modules in one commit
git commit -m "refactor: extract StagingZoneManager, StatePersistence, and SceneGraphBuilder"
# TOO BIG! Hard to review
```

**✅ Correct:**
```bash
# One module per commit
git commit -m "refactor: extract StagingZoneManager"
git commit -m "refactor: extract StatePersistence"
git commit -m "refactor: extract SceneGraphBuilder"
```

---

## Troubleshooting

### If Tests Fail After Extraction
1. **Compare behavior:** Use `git diff` to see what changed
2. **Check imports:** Verify all imports are correct
3. **Check types:** Ensure TypeScript compiles without errors
4. **Run specific test:** `pnpm --filter vtt-server test <file>`
5. **Add debug logs:** Temporarily add console.log to trace execution

### If TypeScript Errors
1. **Check circular imports:** Use type-only imports where possible
2. **Check module paths:** Ensure `.js` extensions on imports
3. **Check exported types:** Verify all types are exported
4. **Run typecheck:** `pnpm --filter vtt-server exec tsc`

### If Merge Conflicts
1. **Rebase frequently:** `git pull origin dev --rebase`
2. **Keep branches small:** Extract one module at a time
3. **Coordinate:** Check if others are working on same file

---

## Key Commands Reference

```bash
# Navigate to project
cd /home/loshunter/HeroByte

# Check status
git status
git branch -a

# Run tests
pnpm test:server                           # 285 server tests
pnpm test:client                           # 1984 client tests
pnpm test                                  # All 2269 tests

# Run specific test file
pnpm --filter vtt-server test service.test.ts

# Type checking
pnpm --filter vtt-server exec tsc

# Linting
pnpm lint

# Formatting
pnpm format

# Create branch
git checkout dev
git pull origin dev
git checkout -b refactor/server/<module-name>

# Commit
git add .
git commit -m "refactor: extract <Module> from RoomService"

# Push
git push origin refactor/server/<module-name>

# Merge to dev (manual)
git checkout dev
git pull origin dev
git merge refactor/server/<module-name> --no-ff
git push origin dev
git branch -d refactor/server/<module-name>
```

---

## Success Checklist

After completing all phases, verify:

- [ ] ✅ `service.ts` is ~300 LOC (down from 688)
- [ ] ✅ 6 focused modules created (total ~580 LOC)
- [ ] ✅ All 285 server tests passing
- [ ] ✅ All 1,984 client tests passing
- [ ] ✅ 100+ new characterization tests added
- [ ] ✅ No TypeScript errors
- [ ] ✅ All code formatted with Prettier
- [ ] ✅ All branches merged to `dev`
- [ ] ✅ ROOM_SERVICE_REFACTOR_PLAN.md updated with completion status
- [ ] ✅ Commit history is clean (atomic commits)

---

## What Success Looks Like

**Before:**
```
apps/server/src/domains/room/
├── service.ts     # 688 LOC - God object
└── model.ts       # Types
```

**After:**
```
apps/server/src/domains/room/
├── service.ts                  # 300 LOC - Clean orchestrator
├── model.ts                    # Types (unchanged)
├── persistence/
│   └── StatePersistence.ts     # 100 LOC - File I/O
├── snapshot/
│   └── SnapshotLoader.ts       # 150 LOC - Snapshot merging
├── scene/
│   └── SceneGraphBuilder.ts    # 170 LOC - Scene building
├── transform/
│   └── TransformHandler.ts     # 180 LOC - Transforms
└── staging/
    └── StagingZoneManager.ts   # 80 LOC - Staging logic
```

**Metrics:**
- 56% LOC reduction in orchestrator
- 6 focused, testable modules
- 100+ new tests
- 0 regressions
- Clean architecture following SOLID

---

## Questions & Support

**If you get stuck:**
1. Re-read the relevant section in ROOM_SERVICE_REFACTOR_PLAN.md
2. Check pr7-validation-refactor.md for similar patterns
3. Review commit history: `git log --oneline --grep="refactor" -i`
4. Run tests to identify regressions: `pnpm test:server`

**Documentation:**
- Primary plan: `/docs/refactoring/ROOM_SERVICE_REFACTOR_PLAN.md`
- Extraction process: `/docs/refactoring/REFACTOR_PLAYBOOK.md`
- Validation reference: `/pr7-validation-refactor.md`
- Phase 15 overview: `/docs/refactoring/REFACTOR_ROADMAP.md`

---

## Final Notes

**You have everything you need:**
- ✅ Clean `dev` branch with validation refactor complete
- ✅ Detailed plan in ROOM_SERVICE_REFACTOR_PLAN.md
- ✅ Proven playbook from validation.ts success
- ✅ All tests passing (2,269/2,269)
- ✅ Clear dependency order for extraction
- ✅ Success patterns documented

**Remember:**
- Follow the playbook exactly (17 steps)
- Write characterization tests BEFORE extracting
- One module per branch
- Small, atomic commits
- Test after every change
- No feature additions during refactoring

**You got this! 🚀**

---

**Handoff Date:** 2025-11-14
**Prepared By:** Claude Code (Phase 15 Initiative)
**Next Session:** Ready to execute room/service.ts refactor
**Estimated Duration:** 6-8 days (1-1.5 weeks)
