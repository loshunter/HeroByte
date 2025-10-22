# MapBoard.tsx Phase 3 Refactoring - ChatGPT Handoff

**Date:** 2025-10-22
**Phase:** 3 - Node Reference System
**Goal:** Extract 80 LOC of node reference management from MapBoard.tsx
**Current LOC:** 864 → **Target:** 784 LOC

---

## 📋 Project Context

### What We're Doing
Phase 3 focuses on extracting the complex Konva node reference management system into a dedicated hook. This is more challenging than Phase 2 because it involves:
- Map-based ref tracking (not simple state)
- Multiple callback functions for different object types
- Ref lifecycle management
- Node lookup logic

### Why This Phase is Important
The node reference system is currently scattered across MapBoard.tsx with:
- A shared `Map` storing node references
- 5 different node-ready callbacks (map, tokens, drawings, props, staging zone)
- Selection node ref logic
- Node lookup for transform gizmo

Centralizing this will make the system much clearer and easier to maintain.

### Project Status After Phase 2
| File | Original | After Phase 2 | Target | Status |
|------|----------|---------------|--------|--------|
| App.tsx | 1,850 | 519 | 300 | ✅ COMPLETE |
| DMMenu.tsx | 1,588 | 265 | 350 | ✅ COMPLETE |
| **MapBoard.tsx** | **1,034** | **864** | **400** | **🔄 Phase 1-2 Done** |

**Phase 1 Complete:** useElementSize, coordinateTransforms, MapBoard.types (-75 LOC)
**Phase 2 Complete:** useGridConfig, useCursorStyle, useSceneObjectsData (-95 LOC)
**Phase 3 Goal:** useKonvaNodeRefs (-80 LOC)

---

## 🎯 Phase 3 Objective

Extract **ONE** complex hook from MapBoard.tsx:

| Priority | Module | LOC Target | Location | Complexity |
|----------|--------|------------|----------|------------|
| 1 | `useKonvaNodeRefs` | 80 | `hooks/useKonvaNodeRefs.ts` | **HIGH** |

**Expected Outcome:** MapBoard.tsx: 864 → 784 LOC (-80 LOC)

---

## 🧩 Understanding the Node Reference System

### Current Architecture

The node reference system in MapBoard.tsx currently:

1. **Stores all Konva node references in a Map:**
   ```typescript
   const nodeRefsMap = useRef<Map<string, Konva.Node>>(new Map());
   ```

2. **Provides callbacks to register nodes from child components:**
   - `handleMapNodeReady` - Map image node
   - `handleTokenNodeReady` - Token nodes
   - `handleDrawingNodeReady` - Drawing nodes
   - `handlePropNodeReady` - Prop nodes
   - Staging zone node (inline ref)

3. **Tracks the currently selected node for transform gizmo:**
   ```typescript
   const selectedObjectNodeRef = useRef<Konva.Node | null>(null);
   ```

4. **Updates selected node when selection changes:**
   ```typescript
   useEffect(() => {
     if (selectedObjectId) {
       const node = nodeRefsMap.current.get(selectedObjectId);
       selectedObjectNodeRef.current = node || null;
     } else {
       selectedObjectNodeRef.current = null;
     }
   }, [selectedObjectId]);
   ```

5. **Used by multiple features:**
   - Transform gizmo (needs selected node ref)
   - Marquee selection (iterates all nodes for intersection)

### Why This is Complex

1. **Shared mutable state** - The Map is shared across many components
2. **Multiple entry points** - 5+ different callbacks register nodes
3. **Lifecycle management** - Nodes must be added/removed properly
4. **Selection tracking** - Special handling for selected node
5. **Performance sensitive** - Used in hot paths (marquee selection)

---

## 📖 The Extraction Process (Adapted for Phase 3)

Phase 3 requires a **modified approach** because we're extracting a complex system, not just simple state:

### Step 1-3: Deep Research (CRITICAL)
1. **Read MapBoard.tsx thoroughly** - Understand ALL usages of `nodeRefsMap`
2. **Trace data flow** - How do nodes get registered? How are they used?
3. **Identify dependencies** - What does the hook need as inputs?
4. **Map all consumers** - What components/functions use the refs?

### Step 4-6: Design the Hook Interface
4. **Design the API** - What should the hook return?
5. **Plan the callbacks** - How will child components register nodes?
6. **Consider edge cases** - Node removal, selection changes, unmounting

### Step 7-9: Write Tests FIRST
7. **Create test file** - `hooks/__tests__/useKonvaNodeRefs.test.ts`
8. **Write comprehensive tests** - This is complex, needs thorough testing
9. **Test edge cases** - Node lifecycle, selection changes, multiple nodes

### Step 10-12: Implement Hook
10. **Create hook file** - `hooks/useKonvaNodeRefs.ts`
11. **Implement core logic** - Map storage, callbacks, selection tracking
12. **Add comprehensive JSDoc** - This is a complex hook, document well

### Step 13-15: Integrate Carefully
13. **Import hook** - Add to MapBoard.tsx
14. **Replace nodeRefsMap usage** - Use hook's API instead
15. **Replace all callbacks** - Update all 5+ node-ready callbacks

### Step 16-18: Verify Thoroughly
16. **Run all tests** - Especially integration tests
17. **Manual verification** - Test transform gizmo and marquee selection
18. **Performance check** - Ensure no performance regressions

### Step 19-20: Commit and Document
19. **Stage all files** - Hook, tests, MapBoard.tsx changes
20. **Commit with detailed message** - Explain the complexity

---

## 🔨 Detailed Task Specification

### Current Code to Extract

**Location:** `apps/client/src/ui/MapBoard.tsx`

**Lines to extract (scattered throughout file):**

1. **Node refs map** (line ~624):
```typescript
// Store all node refs (keyed by object ID)
const nodeRefsMap = useRef<Map<string, Konva.Node>>(new Map());
```

2. **Selected node ref** (line ~226):
```typescript
// Transform gizmo state
const selectedObjectNodeRef = useRef<Konva.Node | null>(null);
```

3. **Selected node update effect** (lines ~627-635):
```typescript
// Clear the selected node ref when selection changes
useEffect(() => {
  if (selectedObjectId) {
    const node = nodeRefsMap.current.get(selectedObjectId);
    selectedObjectNodeRef.current = node || null;
  } else {
    selectedObjectNodeRef.current = null;
  }
}, [selectedObjectId]);
```

4. **Map node callback** (lines ~595-606):
```typescript
// Callback to receive node reference from MapImageLayer
const handleMapNodeReady = useCallback(
  (node: Konva.Node | null) => {
    if (mapObject) {
      if (node) {
        nodeRefsMap.current.set(mapObject.id, node);
      } else {
        nodeRefsMap.current.delete(mapObject.id);
      }
    }
  },
  [mapObject],
);
```

5. **Token node callback** (lines ~637-643):
```typescript
// Callback to receive node reference from TokensLayer
const handleTokenNodeReady = useCallback((tokenId: string, node: Konva.Node | null) => {
  if (node) {
    nodeRefsMap.current.set(tokenId, node);
  } else {
    nodeRefsMap.current.delete(tokenId);
  }
}, []);
```

6. **Drawing node callback** (lines ~646-652):
```typescript
// Callback to receive node reference from DrawingsLayer
const handleDrawingNodeReady = useCallback((drawingId: string, node: Konva.Node | null) => {
  if (node) {
    nodeRefsMap.current.set(drawingId, node);
  } else {
    nodeRefsMap.current.delete(drawingId);
  }
}, []);
```

7. **Prop node callback** (lines ~655-661):
```typescript
// Callback to receive node reference from PropsLayer
const handlePropNodeReady = useCallback((propId: string, node: Konva.Node | null) => {
  if (node) {
    nodeRefsMap.current.set(propId, node);
  } else {
    nodeRefsMap.current.delete(propId);
  }
}, []);
```

8. **Get selected node callback** (lines ~590-592):
```typescript
const getSelectedNodeRef = useCallback(() => {
  return selectedObjectNodeRef.current;
}, []);
```

9. **Staging zone node handling** (inline at line ~842):
```typescript
ref={(node) => {
  if (node && stagingZoneObject && selectedObjectId === stagingZoneObject.id) {
    selectedObjectNodeRef.current = node;
  }
}}
```

10. **Marquee selection usage** (lines ~679-698):
```typescript
nodeRefsMap.current.forEach((node, id) => {
  if (
    !node ||
    (!id.startsWith("token:") && !id.startsWith("drawing:") && !id.startsWith("prop:"))
  ) {
    return;
  }

  const rect = node.getClientRect({ relativeTo: stageRef.current! });
  // ... intersection logic
});
```

---

## 🎨 Hook Design Specification

### Hook Signature

```typescript
/**
 * Manages Konva node references for MapBoard objects.
 *
 * Provides a centralized system for tracking Konva node references from
 * child layers (map, tokens, drawings, props) and managing the currently
 * selected node for the transform gizmo.
 *
 * @param selectedObjectId - Currently selected object ID (for transform gizmo)
 * @param mapObject - Map scene object (for map node tracking)
 * @returns Object containing:
 *   - registerNode: Callback to register a node by ID
 *   - unregisterNode: Callback to unregister a node by ID
 *   - getNode: Function to get a node by ID
 *   - getSelectedNode: Function to get the currently selected node
 *   - getAllNodes: Function to get all registered nodes
 *   - nodeRefsMap: The underlying Map (for performance-critical uses like marquee)
 *
 * @example
 * ```tsx
 * const { registerNode, getSelectedNode, getAllNodes } = useKonvaNodeRefs(
 *   selectedObjectId,
 *   mapObject
 * );
 *
 * // In a child component:
 * <TokensLayer onNodeReady={(id, node) => registerNode(id, node)} />
 *
 * // In marquee selection:
 * getAllNodes().forEach((node, id) => {
 *   // Check intersection
 * });
 * ```
 */
export function useKonvaNodeRefs(
  selectedObjectId: string | null | undefined,
  mapObject: SceneObject | undefined,
) {
  // Implementation
}
```

### Hook Return Type

```typescript
interface UseKonvaNodeRefsReturn {
  /**
   * Register or update a node reference.
   * Pass null to unregister.
   */
  registerNode: (id: string, node: Konva.Node | null) => void;

  /**
   * Get a node by its ID.
   */
  getNode: (id: string) => Konva.Node | undefined;

  /**
   * Get the currently selected node (for transform gizmo).
   */
  getSelectedNode: () => Konva.Node | null;

  /**
   * Get all registered nodes as a Map.
   * Use for performance-critical operations like marquee selection.
   */
  getAllNodes: () => Map<string, Konva.Node>;

  /**
   * Direct access to the node refs map.
   * Provided for backward compatibility and performance-critical code.
   */
  nodeRefsMap: React.MutableRefObject<Map<string, Konva.Node>>;
}
```

---

## ✅ Test Requirements

### Test File: `hooks/__tests__/useKonvaNodeRefs.test.ts`

**Minimum 15 tests covering:**

1. **Basic node registration:**
   - Should register a node
   - Should retrieve registered node
   - Should unregister node (pass null)
   - Should handle multiple nodes

2. **Selected node tracking:**
   - Should track selected node when selectedObjectId changes
   - Should clear selected node when selectedObjectId is null
   - Should update selected node when it changes
   - Should handle selectedObjectId that doesn't exist

3. **Map object handling:**
   - Should register map node with mapObject ID
   - Should update map node when mapObject changes
   - Should handle null mapObject

4. **Node lifecycle:**
   - Should remove node when unregistered
   - Should handle re-registration of same ID
   - Should handle node updates

5. **Edge cases:**
   - Should handle undefined selectedObjectId
   - Should handle concurrent registrations
   - Should maintain performance with many nodes

### Test Structure Example

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useKonvaNodeRefs } from "../useKonvaNodeRefs";
import type Konva from "konva";

// Mock Konva node
const createMockNode = (id: string): Konva.Node => ({
  id: () => id,
  getClientRect: vi.fn(),
  // Add other necessary methods
} as unknown as Konva.Node);

describe("useKonvaNodeRefs", () => {
  it("should register and retrieve a node", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const mockNode = createMockNode("test-node");

    act(() => {
      result.current.registerNode("test-node", mockNode);
    });

    expect(result.current.getNode("test-node")).toBe(mockNode);
  });

  it("should track selected node when selectedObjectId changes", () => {
    const { result, rerender } = renderHook(
      ({ selectedId, mapObj }) => useKonvaNodeRefs(selectedId, mapObj),
      { initialProps: { selectedId: null as string | null, mapObj: undefined } }
    );

    const mockNode = createMockNode("node-1");
    act(() => {
      result.current.registerNode("node-1", mockNode);
    });

    // Change selected object
    rerender({ selectedId: "node-1", mapObj: undefined });

    expect(result.current.getSelectedNode()).toBe(mockNode);
  });

  it("should unregister node when null is passed", () => {
    const { result } = renderHook(() => useKonvaNodeRefs(null, undefined));
    const mockNode = createMockNode("test-node");

    act(() => {
      result.current.registerNode("test-node", mockNode);
      result.current.registerNode("test-node", null);
    });

    expect(result.current.getNode("test-node")).toBeUndefined();
  });

  // Add 12+ more tests...
});
```

---

## 🔌 Integration Guide

### Step 1: Import the Hook

```typescript
import { useKonvaNodeRefs } from "../hooks/useKonvaNodeRefs";
```

### Step 2: Use the Hook

```typescript
// Replace this:
const nodeRefsMap = useRef<Map<string, Konva.Node>>(new Map());
const selectedObjectNodeRef = useRef<Konva.Node | null>(null);

// With this:
const {
  registerNode,
  getNode,
  getSelectedNode,
  getAllNodes,
  nodeRefsMap, // For backward compatibility
} = useKonvaNodeRefs(selectedObjectId, mapObject);
```

### Step 3: Update All Callbacks

**Before:**
```typescript
const handleTokenNodeReady = useCallback((tokenId: string, node: Konva.Node | null) => {
  if (node) {
    nodeRefsMap.current.set(tokenId, node);
  } else {
    nodeRefsMap.current.delete(tokenId);
  }
}, []);
```

**After:**
```typescript
const handleTokenNodeReady = useCallback((tokenId: string, node: Konva.Node | null) => {
  registerNode(tokenId, node);
}, [registerNode]);
```

### Step 4: Update getSelectedNodeRef

**Before:**
```typescript
const getSelectedNodeRef = useCallback(() => {
  return selectedObjectNodeRef.current;
}, []);
```

**After:**
```typescript
// Use getSelectedNode directly, or keep wrapper for compatibility:
const getSelectedNodeRef = useCallback(() => {
  return getSelectedNode();
}, [getSelectedNode]);
```

### Step 5: Update Marquee Selection

**Before:**
```typescript
nodeRefsMap.current.forEach((node, id) => {
  // ... intersection logic
});
```

**After:**
```typescript
getAllNodes().forEach((node, id) => {
  // ... intersection logic
});
```

### Step 6: Remove Old Code

Delete these lines:
- `const nodeRefsMap = useRef<Map<string, Konva.Node>>(new Map());`
- `const selectedObjectNodeRef = useRef<Konva.Node | null>(null);`
- The useEffect that updates selectedObjectNodeRef
- All the old callback implementations

---

## 🎯 Expected LOC Reduction Breakdown

| Code Section | Lines | Action |
|--------------|-------|--------|
| nodeRefsMap ref declaration | 1 | Remove |
| selectedObjectNodeRef declaration | 1 | Remove |
| Selected node update useEffect | 9 | Remove |
| handleMapNodeReady | 12 | Simplify to 3 |
| handleTokenNodeReady | 7 | Simplify to 3 |
| handleDrawingNodeReady | 7 | Simplify to 3 |
| handlePropNodeReady | 7 | Simplify to 3 |
| getSelectedNodeRef | 3 | Simplify to 1-2 |
| Staging zone inline ref | 5 | Update callback |
| **Total Removed** | **52** | |
| **Total Simplified** | **~28** | |
| **Net Reduction** | **~80 LOC** | ✅ |

---

## ⚠️ Special Considerations for Phase 3

### 1. Performance is Critical

The node refs system is used in hot paths:
- Marquee selection iterates ALL nodes on every mousemove
- Transform gizmo accesses selected node frequently

**Action:** Keep the `nodeRefsMap` ref exposed for direct access when needed.

### 2. Callback Dependencies Matter

The callbacks are passed to child components. If they change frequently, it causes re-renders.

**Action:** Carefully manage callback dependencies with `useCallback`.

### 3. Node Lifecycle is Important

Nodes must be properly unregistered when components unmount.

**Action:** Ensure null handling works correctly in registerNode.

### 4. Selection Updates are Async

The selectedObjectId prop changes, then the hook must update the selected node ref.

**Action:** Use useEffect to watch selectedObjectId and update internal selected node.

### 5. Map Object Changes

The map object can change (new map loaded, map deleted).

**Action:** Watch mapObject and update node refs accordingly.

---

## 🚨 Common Pitfalls

1. **Don't break callback references** - Child components rely on stable callbacks
2. **Don't lose the Map** - Some code needs direct Map access for performance
3. **Don't forget dependencies** - useCallback dependencies must be complete
4. **Don't skip edge cases** - null/undefined handling is critical
5. **Don't change behavior** - This is a pure extraction, no logic changes
6. **Don't forget staging zone** - It has special inline ref handling
7. **Don't make it too clever** - Keep the API simple and obvious

---

## 📊 Success Criteria

Phase 3 is complete when:

1. ✅ useKonvaNodeRefs hook created with comprehensive JSDoc
2. ✅ 15+ tests written and passing (covering all edge cases)
3. ✅ MapBoard.tsx reduced to ~784 LOC (target: -80 LOC)
4. ✅ All existing tests still pass (no regressions)
5. ✅ Zero TypeScript errors
6. ✅ Transform gizmo still works perfectly
7. ✅ Marquee selection still works perfectly
8. ✅ No performance regressions (verify with manual testing)
9. ✅ Code committed with detailed message
10. ✅ All callbacks properly replaced

---

## 🔍 Quality Checklist

Before committing, verify:

- [ ] Hook has comprehensive JSDoc with examples
- [ ] All 15+ tests pass
- [ ] No TypeScript errors
- [ ] MapBoard.tsx LOC reduced by ~80
- [ ] No duplicate code remains
- [ ] All node-ready callbacks updated
- [ ] getSelectedNodeRef works
- [ ] Marquee selection works
- [ ] Transform gizmo works
- [ ] Staging zone selection works
- [ ] No console errors
- [ ] No performance regressions
- [ ] Commit message is detailed

---

## 📝 Commit Message Template

```
refactor(MapBoard): extract useKonvaNodeRefs hook

Extract complex Konva node reference management system into dedicated hook.

New Files:
- hooks/useKonvaNodeRefs.ts (XX LOC)
  * Centralized node reference management
  * Tracks all Konva nodes from child layers
  * Manages selected node for transform gizmo
  * Provides callbacks for node registration/unregistration
  * Exposes Map for performance-critical code (marquee selection)
  * Comprehensive JSDoc with usage examples

- hooks/__tests__/useKonvaNodeRefs.test.ts
  * 15+ tests covering all functionality
  * Tests node registration/unregistration
  * Tests selected node tracking
  * Tests map object handling
  * Tests edge cases and lifecycle

Changes to MapBoard.tsx:
- Import useKonvaNodeRefs hook
- Replace nodeRefsMap ref with hook
- Replace selectedObjectNodeRef with hook's tracking
- Simplify all node-ready callbacks (5 callbacks updated)
- Remove selected node update useEffect
- Update marquee selection to use getAllNodes
- Update transform gizmo to use getSelectedNode
- MapBoard.tsx: 864 → 784 LOC (80 LOC reduction)

Implementation Notes:
- Maintained direct Map access for performance
- All callbacks properly memoized with useCallback
- Selected node tracking uses internal useEffect
- Backward compatible API design
- Zero behavior changes

Test Results:
- All tests passing (1,620+ tests)
- 15 new tests added for useKonvaNodeRefs
- Coverage maintained at 100%
- Transform gizmo verified working
- Marquee selection verified working
- No performance regressions

Part of Phase 15 SOLID Refactor Initiative - MapBoard.tsx Phase 3
See: docs/refactoring/REFACTOR_ROADMAP.md

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🛠️ Commands Reference

### Testing
```bash
# Run tests for the hook
pnpm test:client -- useKonvaNodeRefs

# Run all tests
pnpm test:client

# Run tests in watch mode
pnpm --filter herobyte-client test -- --watch useKonvaNodeRefs
```

### Verification
```bash
# Lint check
pnpm lint

# Type check
pnpm --filter herobyte-client build

# Count LOC
wc -l apps/client/src/ui/MapBoard.tsx
```

### Git
```bash
# Stage files
git add apps/client/src/hooks/useKonvaNodeRefs.ts
git add apps/client/src/hooks/__tests__/useKonvaNodeRefs.test.ts
git add apps/client/src/ui/MapBoard.tsx

# Commit
git commit -m "refactor(MapBoard): extract useKonvaNodeRefs hook

[... your detailed message ...]"

# Push
git push origin dev
```

---

## 📚 Reference Materials

### Similar Hooks (for reference)
- `apps/client/src/hooks/useCamera.ts` - Complex state management hook
- `apps/client/src/hooks/useSceneObjects.ts` - Data transformation hook
- `apps/client/src/hooks/useDrawingSelection.ts` - Ref tracking hook

### Test Examples
- `apps/client/src/hooks/__tests__/useCamera.test.ts` - Complex hook testing
- `apps/client/src/hooks/__tests__/useSceneObjectsData.test.ts` - Phase 2 example

### Phase 2 Commits (for pattern reference)
```bash
git log --oneline --grep="Phase 2" -5
```

---

## 🎯 Key Differences from Phase 2

| Aspect | Phase 2 | Phase 3 |
|--------|---------|---------|
| **Complexity** | Low-Medium | High |
| **Hook Count** | 3 hooks | 1 hook |
| **LOC per Hook** | 25-40 | 80 |
| **State Type** | Simple useState | Refs + Map |
| **Callbacks** | 0-1 | 5+ callbacks |
| **Testing** | Straightforward | Complex lifecycle |
| **Integration** | Simple replacement | Careful callback updates |
| **Performance** | Not critical | Very critical |

**Bottom Line:** Phase 3 is more complex but follows the same principles. Take your time, test thoroughly, and verify all features work.

---

## 🎬 Getting Started

1. **Read this entire document** - Understand the complexity
2. **Read MapBoard.tsx carefully** - Find all nodeRefsMap usages
3. **Design the hook API** - Think through the interface
4. **Write tests first** - TDD approach is critical here
5. **Implement incrementally** - Build up the hook step by step
6. **Integrate carefully** - Update callbacks one at a time
7. **Verify thoroughly** - Test transform gizmo and marquee selection

---

## ✨ Final Notes

Phase 3 is the most complex extraction so far because:
- It involves mutable refs, not just state
- Multiple callbacks need to be replaced
- Performance is critical
- The API design matters a lot

But it's also very rewarding because:
- You'll centralize a scattered system
- You'll make the code much clearer
- You'll set up for easier Phase 4-5 work

**Take your time, test thoroughly, and ask questions if anything is unclear.**

**You've got this!** 🚀

The pattern from Phase 2 still applies, just with more complexity. Follow the playbook, write good tests, and Phase 3 will be successful.

Good luck! 🎉
