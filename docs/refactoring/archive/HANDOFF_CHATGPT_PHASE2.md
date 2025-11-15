# MapBoard.tsx Phase 2 Refactoring - ChatGPT Handoff

**Date:** 2025-10-22
**Phase:** 2 - Simple State Hooks
**Goal:** Extract 95 LOC of basic state management from MapBoard.tsx
**Current LOC:** 959 → **Target:** 864 LOC

---

## 📋 Project Context

### What We're Doing
We're systematically refactoring MapBoard.tsx (a 1,034 LOC god file) by extracting reusable modules following SOLID principles. Phase 1 (Pure Utilities) is complete. You're now handling Phase 2 (Simple State Hooks).

### Why This Matters
- **Maintainability:** Reduce god file complexity (1,034 → 400 LOC target)
- **Testability:** Isolated hooks are easier to test
- **Reusability:** Extracted hooks can be used elsewhere
- **SOLID Principles:** Single Responsibility Principle compliance
- **CI Guardrails:** Files >350 LOC are flagged (MapBoard.tsx has baseline exception)

### Project Status
| File | Original | Current | Target | Status |
|------|----------|---------|--------|--------|
| App.tsx | 1,850 | 519 | 300 | ✅ COMPLETE |
| DMMenu.tsx | 1,588 | 265 | 350 | ✅ COMPLETE |
| **MapBoard.tsx** | **1,034** | **959** | **400** | **🔄 Phase 1 Done** |

---

## ✅ Phase 1 Recap (What Was Done)

**Completed:** 2025-10-22
**Extractions:**
1. `hooks/useElementSize.ts` (15 LOC + 3 tests)
2. `utils/coordinateTransforms.ts` (20 LOC + 8 tests)
3. `ui/MapBoard.types.ts` (40 LOC - type definitions)

**Result:** MapBoard.tsx reduced from 1,034 → 959 LOC (75 LOC reduction)

---

## 🎯 Phase 2 Objectives

Extract 3 state management hooks from MapBoard.tsx:

| Priority | Module | LOC Target | Location | Complexity |
|----------|--------|------------|----------|------------|
| 1 | `useGridConfig` | 25 | `hooks/useGridConfig.ts` | Low |
| 2 | `useCursorStyle` | 30 | `hooks/useCursorStyle.ts` | Low |
| 3 | `useSceneObjectsData` | 40 | `hooks/useSceneObjectsData.ts` | Medium |

**Expected Outcome:** MapBoard.tsx: 959 → 864 LOC (-95 LOC)

---

## 📖 Best Practices (HOW to Do This)

### 1. The Extraction Process (17-Step Playbook)

Follow this **exact process** for each hook:

#### **Step 1-3: Research & Understand**
1. **Read MapBoard.tsx** - Find the code to extract
2. **Identify dependencies** - What imports/props does it need?
3. **Map data flow** - What goes in, what comes out?

#### **Step 4-6: Write Tests FIRST**
4. **Create test file** - `hooks/__tests__/[hookName].test.ts`
5. **Write characterization tests** - Capture current behavior
6. **Run tests** - Should fail (hook doesn't exist yet)

#### **Step 7-9: Extract Hook**
7. **Create hook file** - `hooks/[hookName].ts`
8. **Copy code** - Move logic from MapBoard.tsx
9. **Add JSDoc** - Comprehensive documentation

#### **Step 10-12: Integrate**
10. **Import hook** - Add to MapBoard.tsx imports
11. **Use hook** - Replace inline code with hook call
12. **Remove old code** - Delete extracted lines

#### **Step 13-15: Verify**
13. **Run tests** - All tests must pass
14. **Check types** - No TypeScript errors
15. **Manual verification** - Code works as expected

#### **Step 16-17: Commit**
16. **Stage files** - git add all modified files
17. **Commit with standard message** - Follow format below

### 2. Test Writing Best Practices

**Location:** `apps/client/src/hooks/__tests__/`

**Naming:** `[hookName].test.ts`

**Structure:**
```typescript
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useYourHook } from "../useYourHook";

describe("useYourHook", () => {
  it("should return initial state", () => {
    const { result } = renderHook(() => useYourHook(...args));

    expect(result.current.someValue).toBe(expectedValue);
  });

  it("should update when dependencies change", () => {
    const { result, rerender } = renderHook(
      ({ prop }) => useYourHook(prop),
      { initialProps: { prop: initialValue } }
    );

    rerender({ prop: newValue });

    expect(result.current.someValue).toBe(updatedValue);
  });

  // Add edge cases
  it("should handle edge case", () => {
    // Test boundary conditions
  });
});
```

**Key Principles:**
- Test behavior, not implementation
- Cover happy path + edge cases
- Use descriptive test names
- Mock external dependencies (timers, ResizeObserver, etc.)

### 3. Hook Writing Best Practices

**Location:** `apps/client/src/hooks/`

**Structure:**
```typescript
import { useState, useEffect, useMemo, useCallback } from "react";
// Import only what you need

/**
 * Brief description of what this hook does.
 *
 * @param param1 - Description of parameter
 * @param param2 - Description of parameter
 * @returns Object containing { value1, value2, handler }
 *
 * @example
 * ```tsx
 * const { value, handler } = useYourHook(prop);
 * ```
 */
export function useYourHook(param1: Type1, param2: Type2) {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    // Side effects
  }, [dependencies]);

  const derivedValue = useMemo(() => {
    // Computed values
  }, [dependencies]);

  const handler = useCallback(() => {
    // Event handlers
  }, [dependencies]);

  return { state, derivedValue, handler };
}
```

**Key Principles:**
- Single responsibility
- Minimal dependencies
- Comprehensive JSDoc
- Return object (not array) for >2 values
- Use TypeScript for all parameters/returns

### 4. Integration Best Practices

**MapBoard.tsx Changes:**

1. **Add import:**
```typescript
import { useYourHook } from "../hooks/useYourHook";
```

2. **Replace inline code:**
```typescript
// BEFORE (inline)
const [state, setState] = useState(initial);
useEffect(() => {
  // logic
}, [deps]);

// AFTER (extracted)
const { state, handler } = useYourHook(props);
```

3. **Delete old code** - Remove the lines you extracted

### 5. Commit Message Format

```
refactor(MapBoard): extract [hookName] hook

Extract [description of what the hook does] from MapBoard.tsx.

New Files:
- hooks/[hookName].ts ([X] LOC)
  * [Brief description of functionality]
  * [Key features]
  * Includes comprehensive JSDoc

- hooks/__tests__/[hookName].test.ts
  * [N] tests covering [coverage areas]
  * Tests [specific scenarios]

Changes to MapBoard.tsx:
- Import [hookName] hook
- Replace inline [description] with hook
- Remove [X] LOC of inline state management
- MapBoard.tsx: [OLD] → [NEW] LOC ([X] LOC reduction)

Test Results:
- All tests passing ([TOTAL] tests)
- [N] new tests added
- Coverage maintained at 100%

Part of Phase 15 SOLID Refactor Initiative - MapBoard.tsx Phase 2
See: docs/refactoring/REFACTOR_ROADMAP.md

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🔨 Phase 2 Detailed Tasks

### Task 1: Extract useGridConfig Hook

**Current Code Location:** `apps/client/src/ui/MapBoard.tsx` (lines ~327-343)

**Code to Extract:**
```typescript
// Grid configuration state
const [grid, setGrid] = useState({
  show: true,
  size: gridSize,
  color: "#447DF7",
  majorEvery: 5,
  opacity: 0.15,
});

// Sync grid size from props
useEffect(() => {
  setGrid((prev) => ({ ...prev, size: gridSize }));
}, [gridSize]);
```

**Hook Signature:**
```typescript
export function useGridConfig(gridSize: number) {
  // Returns grid configuration that syncs with gridSize prop
  return {
    show: boolean,
    size: number,
    color: string,
    majorEvery: number,
    opacity: number,
  };
}
```

**Tests to Write:**
1. Should return default grid configuration
2. Should sync size when gridSize prop changes
3. Should maintain other properties when size changes
4. Should handle initial gridSize values

**Integration:**
```typescript
// In MapBoard.tsx
const grid = useGridConfig(gridSize);
// Remove: const [grid, setGrid] = useState(...)
// Remove: useEffect(() => { setGrid(...) }, [gridSize])
```

**Expected Reduction:** ~25 LOC

---

### Task 2: Extract useCursorStyle Hook

**Current Code Location:** `apps/client/src/ui/MapBoard.tsx` (lines ~497-504)

**Code to Extract:**
```typescript
/**
 * Determine cursor style based on active mode
 */
const getCursor = () => {
  if (isPanning) return "grabbing";
  if (pointerMode) return "none";
  if (measureMode) return "crosshair";
  if (drawMode) return "crosshair";
  if (selectMode) return "default";
  return "grab";
};
```

**Hook Signature:**
```typescript
export function useCursorStyle({
  isPanning,
  pointerMode,
  measureMode,
  drawMode,
  selectMode,
}: {
  isPanning: boolean;
  pointerMode: boolean;
  measureMode: boolean;
  drawMode: boolean;
  selectMode: boolean;
}): string {
  // Returns appropriate cursor style based on active modes
}
```

**Tests to Write:**
1. Should return "grabbing" when panning
2. Should return "none" when pointer mode active
3. Should return "crosshair" when measure mode active
4. Should return "crosshair" when draw mode active
5. Should return "default" when select mode active
6. Should return "grab" as default
7. Should respect priority order (isPanning > pointerMode > measureMode, etc.)

**Integration:**
```typescript
// In MapBoard.tsx
const cursor = useCursorStyle({
  isPanning,
  pointerMode,
  measureMode,
  drawMode,
  selectMode,
});

// In render:
<Stage style={{ cursor }} ...>
// Remove: getCursor function
```

**Expected Reduction:** ~30 LOC

---

### Task 3: Extract useSceneObjectsData Hook

**Current Code Location:** `apps/client/src/ui/MapBoard.tsx` (lines ~176-223)

**Code to Extract:**
```typescript
const sceneObjects = useSceneObjects(snapshot);
const mapObject = useMemo(
  () => sceneObjects.find((object) => object.type === "map"),
  [sceneObjects],
);
const drawingObjects = useMemo(
  () =>
    sceneObjects.filter(
      (object): object is SceneObject & { type: "drawing" } => object.type === "drawing",
    ),
  [sceneObjects],
);

const stagingZoneObject = useMemo(
  () =>
    sceneObjects.find(
      (object): object is SceneObject & { type: "staging-zone" } =>
        object.type === "staging-zone",
    ) ?? null,
  [sceneObjects],
);

const stagingZoneDimensions = useMemo(() => {
  if (!stagingZoneObject) {
    console.log("[MapBoard] No staging zone object");
    return null;
  }

  console.log("[MapBoard] Staging zone:", {
    id: stagingZoneObject.id,
    x: stagingZoneObject.transform.x,
    y: stagingZoneObject.transform.y,
    scaleX: stagingZoneObject.transform.scaleX,
    scaleY: stagingZoneObject.transform.scaleY,
    rotation: stagingZoneObject.transform.rotation,
    width: stagingZoneObject.data.width,
    height: stagingZoneObject.data.height,
  });

  return {
    centerX: (stagingZoneObject.transform.x + 0.5) * gridSize,
    centerY: (stagingZoneObject.transform.y + 0.5) * gridSize,
    widthPx: stagingZoneObject.data.width * gridSize,
    heightPx: stagingZoneObject.data.height * gridSize,
    rotation: stagingZoneObject.transform.rotation,
    label: stagingZoneObject.data.label ?? "Player Staging Zone",
  };
}, [gridSize, stagingZoneObject]);
```

**Hook Signature:**
```typescript
export function useSceneObjectsData(
  snapshot: RoomSnapshot | null,
  gridSize: number
) {
  return {
    sceneObjects: SceneObject[],
    mapObject: SceneObject | undefined,
    drawingObjects: (SceneObject & { type: "drawing" })[],
    stagingZoneObject: (SceneObject & { type: "staging-zone" }) | null,
    stagingZoneDimensions: {
      centerX: number;
      centerY: number;
      widthPx: number;
      heightPx: number;
      rotation: number;
      label: string;
    } | null,
  };
}
```

**Tests to Write:**
1. Should return all scene objects
2. Should find map object when present
3. Should return undefined when no map object
4. Should filter drawing objects correctly
5. Should find staging zone object when present
6. Should return null staging zone when not present
7. Should calculate staging zone dimensions correctly
8. Should use default label when not provided
9. Should handle null snapshot gracefully

**Integration:**
```typescript
// In MapBoard.tsx
const {
  sceneObjects,
  mapObject,
  drawingObjects,
  stagingZoneObject,
  stagingZoneDimensions,
} = useSceneObjectsData(snapshot, gridSize);

// Remove all the extracted useMemo blocks
```

**Expected Reduction:** ~40 LOC

---

## 🛠️ Commands Reference

### Testing
```bash
# Run tests for specific hook
pnpm test:client -- useGridConfig

# Run all tests
pnpm test:client

# Watch mode during development
pnpm --filter herobyte-client test -- --watch useGridConfig
```

### Git Commands
```bash
# Stage files
git add apps/client/src/hooks/useGridConfig.ts
git add apps/client/src/hooks/__tests__/useGridConfig.test.ts
git add apps/client/src/ui/MapBoard.tsx

# Commit
git commit -m "refactor(MapBoard): extract useGridConfig hook

[... your commit message ...]"

# Check status
git status
git log --oneline -3
```

---

## ✅ Quality Gates (Must Pass Before Committing)

For **EACH** extraction:

1. **Tests Pass** ✓
   - Run: `pnpm test:client -- [hookName]`
   - All tests green (0 failures)

2. **No TypeScript Errors** ✓
   - Check: `pnpm --filter herobyte-client build`
   - No type errors

3. **Code Quality** ✓
   - Hook has comprehensive JSDoc
   - Tests cover edge cases
   - Commit message follows format

4. **LOC Verification** ✓
   - Count lines removed from MapBoard.tsx
   - Matches expected reduction (+/- 5 LOC)

5. **No Regressions** ✓
   - Full test suite passes
   - MapBoard.tsx still works

---

## 📁 File Structure Reference

```
apps/client/src/
├── hooks/
│   ├── __tests__/
│   │   ├── useGridConfig.test.ts        (NEW - Task 1)
│   │   ├── useCursorStyle.test.ts       (NEW - Task 2)
│   │   ├── useSceneObjectsData.test.ts  (NEW - Task 3)
│   │   └── useElementSize.test.ts       (EXISTS - Phase 1)
│   ├── useGridConfig.ts                 (NEW - Task 1)
│   ├── useCursorStyle.ts                (NEW - Task 2)
│   ├── useSceneObjectsData.ts           (NEW - Task 3)
│   └── useElementSize.ts                (EXISTS - Phase 1)
├── ui/
│   ├── MapBoard.tsx                     (MODIFY - All tasks)
│   └── MapBoard.types.ts                (EXISTS - Phase 1)
└── utils/
    └── coordinateTransforms.ts          (EXISTS - Phase 1)
```

---

## 🎯 Success Criteria

**Phase 2 is complete when:**

1. ✅ All 3 hooks extracted and tested
2. ✅ MapBoard.tsx reduced to ~864 LOC (target: 95 LOC reduction)
3. ✅ All tests passing (expect ~1619+ total tests)
4. ✅ Zero TypeScript errors
5. ✅ Zero regressions in existing functionality
6. ✅ All code committed with proper messages
7. ✅ Documentation updated (optional, but nice)

---

## 📊 Progress Tracking

After each task, update this section:

**Task 1 (useGridConfig):** ⬜ Not Started
**Task 2 (useCursorStyle):** ⬜ Not Started
**Task 3 (useSceneObjectsData):** ⬜ Not Started

**Current MapBoard.tsx LOC:** 959
**Target MapBoard.tsx LOC:** 864
**LOC Reduced So Far:** 0 / 95

---

## 🚨 Common Pitfalls to Avoid

1. **Don't skip tests** - Write tests FIRST (TDD approach)
2. **Don't change behavior** - Extract, don't refactor logic
3. **Don't commit without testing** - All tests must pass
4. **Don't forget JSDoc** - Every hook needs documentation
5. **Don't bundle extractions** - One hook per commit
6. **Don't guess types** - Use TypeScript properly
7. **Don't remove console.logs** - Keep existing debugging (e.g., staging zone logs)

---

## 🆘 If Something Goes Wrong

1. **Tests fail after extraction?**
   - Check: Did you copy ALL dependencies?
   - Check: Are prop types correct?
   - Check: Did you maintain same return structure?

2. **TypeScript errors?**
   - Check: Did you import all types?
   - Check: Are return types explicitly defined?
   - Check: Are generics used correctly?

3. **Behavior changed?**
   - Revert: `git checkout -- [file]`
   - Review: Compare with original code
   - Re-extract: Follow steps more carefully

4. **Not sure what to do?**
   - Read: This document again
   - Check: Phase 1 examples in git history
   - Ask: User can clarify if needed

---

## 📚 Reference Materials

### Phase 1 Commits (Examples)
```bash
git log --oneline --grep="Phase 1" -3
# Shows how Phase 1 was implemented
```

### Similar Hooks (Reference)
- `apps/client/src/hooks/useElementSize.ts` (Simple state hook)
- `apps/client/src/hooks/useCamera.ts` (Complex state hook)
- `apps/client/src/hooks/useSceneObjects.ts` (Data transformation hook)

### Test Examples
- `apps/client/src/hooks/__tests__/useElementSize.test.ts` (Simple tests)
- `apps/client/src/hooks/__tests__/useCamera.test.ts` (Complex tests)

---

## 🎬 Ready to Start?

### Your Checklist:

1. ⬜ Read this entire document
2. ⬜ Understand the 17-step process
3. ⬜ Review Phase 1 commits for examples
4. ⬜ Have your IDE/editor ready
5. ⬜ Start with Task 1 (useGridConfig) - it's the simplest

### Task 1 Quick Start:

```bash
# 1. Create test file
touch apps/client/src/hooks/__tests__/useGridConfig.test.ts

# 2. Write tests (see Task 1 section above)

# 3. Create hook file
touch apps/client/src/hooks/useGridConfig.ts

# 4. Implement hook (see Task 1 section above)

# 5. Run tests
pnpm test:client -- useGridConfig

# 6. Update MapBoard.tsx (see Task 1 integration)

# 7. Run all tests
pnpm test:client

# 8. Commit
git add ...
git commit -m "..."
```

---

## 🤝 Collaboration Notes

- **Code style:** Follows existing patterns (see Phase 1)
- **Testing approach:** Vitest + React Testing Library
- **Commit style:** Conventional commits with detailed bodies
- **Branch:** Work on `dev` branch
- **Review:** User will review commits

---

## ✨ Final Notes

This refactoring is part of a larger initiative to eliminate god files from the codebase. Your work on Phase 2 continues the excellent progress from Phase 1 and sets up Phase 3 (Node Reference System).

**Remember:**
- Quality over speed
- Tests first, implementation second
- Follow the playbook precisely
- One hook per commit
- Document everything

**You've got this!** 🚀

The patterns from Phase 1 are your guide. If you follow the 17-step playbook and the examples in this document, Phase 2 will be smooth and successful.

Good luck! 🎉
