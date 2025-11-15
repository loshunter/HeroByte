# DMMenu.tsx Phase 7 Handoff Document

**Date:** 2025-10-21
**Phase:** DMMenu.tsx Phase 7 - State Hook Extraction (OPTIONAL)
**Branch:** `refactor/dm-menu/stateful-tabs`
**Status:** Ready to begin Phase 7
**Priority:** OPTIONAL - Phase 6 already achieved all core refactoring goals

---

## 🎯 Current Objective

Extract **state management logic** from DMMenu.tsx into a custom hook `useDMMenuState`.

**Goal:** Reduce DMMenu.tsx by ~30-40 LOC through state extraction.

**Current State:** 284 LOC → Target: ~250 LOC after Phase 7

**WARNING:** This phase is OPTIONAL. Phase 6 already achieved:

- ✅ DMMenu.tsx < 300 LOC (284 LOC)
- ✅ >80% reduction (82.1%)
- ✅ All refactoring goals met

**Proceed only if:**

- State management patterns need standardization across codebase
- Further reduction to ~250 LOC is desired
- You have explicit user approval to continue

---

## ✅ What's Complete (Phases 2-6)

### Phase 2: Entity Editors (DONE)

- **NPCEditor** extracted (210 LOC, 29 tests) ✅
- **PropEditor** extracted (191 LOC, 24 tests) ✅
- **Reduction:** 378 LOC
- **Commits:** `0c39929`, `56fe40b`

### Phase 3: Simple Map Controls (DONE)

- **CollapsibleSection** extracted (27 LOC) ✅
- **MapBackgroundControl** extracted (68 LOC) ✅
- **DrawingControls** extracted (29 LOC) ✅
- **GridControl** extracted (126 LOC) ✅
- **Reduction:** 188 LOC
- **Commits:** `979e10e`, `d439ba5`

### Phase 4: Complex Map Controls (DONE)

- **MapTransformControl** extracted (216 LOC, 47 tests) ✅
- **StagingZoneControl** extracted (350 LOC, 36 tests) ✅
- **GridAlignmentWizard** extracted (160 LOC, 56 tests) ✅
- **Reduction:** 474 LOC
- **Commits:** `df0da26`, `0fd6dc0`, `049a61e`

### Phase 5: Session Controls (DONE)

- **SessionPersistenceControl** extracted (63 LOC, 36 tests) ✅
- **RoomPasswordControl** extracted (93 LOC, 36 tests) ✅
- **Reduction:** 156 LOC
- **Commits:** `1daa97d`, `fbf4d2a`

### Phase 6: Tab Views (DONE)

- **MapTab** extracted (163 LOC, 59 tests) ✅
- **NPCsTab** extracted (94 LOC, 43 tests) ✅
- **PropsTab** extracted (94 LOC, 42 tests) ✅
- **SessionTab** extracted (100 LOC, 47 tests) ✅
- **Reduction:** 108 LOC
- **Commits:** `caba901`, `1418c6a`

### Cumulative Progress

- **Original:** 1,588 LOC
- **Current:** 284 LOC
- **Reduction:** 1,304 LOC (82.1%)
- **Components Extracted:** 15 components
- **Test Suite:** 383 passing tests

---

## 📋 Phase 7 Task: State Hook Extraction

### Priority 19: `useDMMenuState` Hook

**Target:** Extract local state management from DMMenu.tsx

**State to Extract (Lines 127-133 in DMMenu.tsx):**

```typescript
// Current implementation in DMMenu.tsx
const [open, setOpen] = useState(false);
const [activeTab, setActiveTab] = useState<DMMenuTab>("map");
const [sessionName, setSessionName] = useState("session");

const npcs = useMemo(
  () => characters.filter((character) => character.type === "npc"),
  [characters],
);

useEffect(() => {
  if (!isDM) {
    setOpen(false);
  }
}, [isDM]);
```

**Target Hook Signature:**

```typescript
// New hook: apps/client/src/features/dm/hooks/useDMMenuState.ts

export interface DMMenuState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  activeTab: DMMenuTab;
  setActiveTab: (tab: DMMenuTab) => void;
  sessionName: string;
  setSessionName: (name: string) => void;
  npcs: Character[];
}

export function useDMMenuState(isDM: boolean, characters: Character[]): DMMenuState {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DMMenuTab>("map");
  const [sessionName, setSessionName] = useState("session");

  const npcs = useMemo(
    () => characters.filter((character) => character.type === "npc"),
    [characters],
  );

  // Auto-close when DM mode is exited
  useEffect(() => {
    if (!isDM) {
      setOpen(false);
    }
  }, [isDM]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return {
    open,
    setOpen,
    toggleOpen,
    activeTab,
    setActiveTab,
    sessionName,
    setSessionName,
    npcs,
  };
}
```

**Expected Reduction:**

- Remove 3 useState calls
- Remove 1 useMemo
- Remove 1 useEffect
- Add 1 hook import + destructuring
- **Net reduction:** ~30-40 LOC

**Complexity:** LOW

- Pure state extraction, no business logic
- Simple hook interface
- Straightforward integration

---

## 🚀 AGENTIC WORKFLOW - CRITICAL INSTRUCTIONS

**IMPORTANT:** Work AGENTICALLY to minimize context usage!

Phase 6 used only **47% of context budget** by working with parallel agents. Follow this proven approach:

### Step 1: Discovery (USE EXPLORE AGENT)

**DO NOT read files directly.** Launch 1 Explore agent to find state code:

```
Task(
  subagent_type="Explore",
  description="Find DMMenu state code",
  prompt="Find the state management code in DMMenu.tsx that should be extracted to useDMMenuState hook. Look for:
  - useState calls for open, activeTab, sessionName
  - useMemo for npcs filtering
  - useEffect for auto-close on isDM change

  File: apps/client/src/features/dm/components/DMMenu.tsx
  Lines to examine: 127-139 (based on 284 LOC file)

  Return the exact code locations and current implementation."
)
```

**Expected Result:** Agent will return exact line numbers and code snippets for extraction.

### Step 2: Testing (USE GENERAL-PURPOSE AGENT)

Launch 1 general-purpose agent to write characterization tests:

```
Task(
  subagent_type="general-purpose",
  description="Write useDMMenuState tests",
  prompt="Create comprehensive characterization tests for the useDMMenuState hook extraction.

  Target file: apps/client/src/features/dm/hooks/__tests__/useDMMenuState.test.ts

  Test Coverage Required:
  1. Initial state
     - open: false
     - activeTab: 'map'
     - sessionName: 'session'
     - npcs: empty array when no characters

  2. State setters
     - setOpen updates open state
     - toggleOpen toggles open state
     - setActiveTab updates activeTab
     - setSessionName updates sessionName

  3. NPC filtering
     - Returns only NPC characters from characters array
     - Filters out player characters
     - Memoizes correctly

  4. Auto-close behavior
     - Closes menu when isDM changes from true to false
     - Does NOT close when isDM stays true
     - Does NOT close when isDM stays false

  Use React Testing Library's renderHook.
  Follow patterns from other hook tests in the codebase.
  Target: ~40-50 tests covering all state transitions.

  DO NOT modify DMMenu.tsx yet - only write tests that capture current behavior."
)
```

**Expected Result:** Complete test file with ~40-50 tests.

### Step 3: Extraction (USE GENERAL-PURPOSE AGENT)

Launch 1 general-purpose agent to create the hook:

```
Task(
  subagent_type="general-purpose",
  description="Extract useDMMenuState hook",
  prompt="Extract the state management logic from DMMenu.tsx into a new useDMMenuState hook.

  Create: apps/client/src/features/dm/hooks/useDMMenuState.ts

  Extract from DMMenu.tsx (lines ~127-139):
  - useState for open
  - useState for activeTab
  - useState for sessionName
  - useMemo for npcs filtering
  - useEffect for auto-close on isDM change

  Hook Signature:
  - Input: isDM (boolean), characters (Character[])
  - Output: DMMenuState object with:
    - open, setOpen, toggleOpen
    - activeTab, setActiveTab
    - sessionName, setSessionName
    - npcs (filtered Character[])

  Include:
  - Comprehensive JSDoc documentation
  - Type definitions (DMMenuState interface)
  - useCallback for toggleOpen
  - All necessary imports

  Follow patterns from other hooks in apps/client/src/hooks/
  Ensure tests pass: pnpm test:client -- useDMMenuState.test.ts"
)
```

**Expected Result:** Complete hook implementation in `apps/client/src/features/dm/hooks/useDMMenuState.ts`

### Step 4: Integration

**DO THIS YOURSELF** (orchestrator) - integration is simple enough:

1. Read DMMenu.tsx
2. Edit DMMenu.tsx to:
   - Import useDMMenuState
   - Replace state declarations with hook usage
   - Remove useState, useMemo, useEffect
3. Run tests: `pnpm test:client`
4. Run typecheck: `pnpm typecheck`
5. Format: `pnpm format`
6. Commit

**Integration Template:**

```typescript
// Before (DMMenu.tsx):
const [open, setOpen] = useState(false);
const [activeTab, setActiveTab] = useState<DMMenuTab>("map");
const [sessionName, setSessionName] = useState("session");
const npcs = useMemo(
  () => characters.filter((character) => character.type === "npc"),
  [characters],
);

useEffect(() => {
  if (!isDM) {
    setOpen(false);
  }
}, [isDM]);

// After (DMMenu.tsx):
import { useDMMenuState } from "../hooks/useDMMenuState";

const { open, setOpen, toggleOpen, activeTab, setActiveTab, sessionName, setSessionName, npcs } =
  useDMMenuState(isDM, characters);

// Update toggle button onClick from setOpen((prev) => !prev) to toggleOpen
```

### Step 5: Verification & Commit

**DO THIS YOURSELF** (orchestrator):

1. Verify all tests pass: `pnpm test:client`
2. Verify TypeScript: `pnpm typecheck`
3. Count LOC: `wc -l apps/client/src/features/dm/components/DMMenu.tsx`
4. Commit with message template below

---

## 📝 Commit Message Template

```
refactor: extract state management to useDMMenuState hook

Extract local state management from DMMenu.tsx to dedicated hook.

Changes:
- Create useDMMenuState.ts hook (XX LOC) with tests (XX tests)
- Import and use hook in DMMenu.tsx
- Remove 3 useState calls (open, activeTab, sessionName)
- Remove useMemo for npcs filtering
- Remove useEffect for auto-close behavior
- Add toggleOpen convenience method

DMMenu.tsx reduced: 284 → XXX LOC (XX LOC reduction)
All 1,XXX tests passing.

Part of Phase 15 SOLID Refactor Initiative - DMMenu.tsx Phase 7
See: docs/refactoring/DMMENU_PHASE7_HANDOFF.md Priority 19
```

---

## 🧪 Testing Strategy

### Test File Location

`apps/client/src/features/dm/hooks/__tests__/useDMMenuState.test.ts`

### Test Categories

**1. Initial State (8 tests)**

- Default open: false
- Default activeTab: "map"
- Default sessionName: "session"
- NPCs empty when no characters
- NPCs empty when only player characters
- NPCs filtered from mixed characters
- Type correctness of return value
- All methods present in return value

**2. State Mutations (12 tests)**

- setOpen(true) updates open
- setOpen(false) updates open
- toggleOpen from false to true
- toggleOpen from true to false
- toggleOpen multiple times
- setActiveTab to each tab type ("map", "npcs", "props", "session")
- setSessionName updates sessionName
- setSessionName with empty string
- setSessionName with whitespace

**3. NPC Filtering (10 tests)**

- Filters NPCs from mixed array
- Returns empty when no NPCs
- Updates when characters prop changes
- Memoizes (doesn't recompute on unrelated state change)
- Handles character type edge cases
- Large NPC arrays
- Character addition
- Character removal
- Character type change
- Multiple rerenders

**4. Auto-Close Behavior (10 tests)**

- Closes when isDM changes true → false
- Menu open + isDM true → false = menu closes
- Menu closed + isDM true → false = stays closed
- Menu open + isDM stays true = stays open
- Menu closed + isDM stays true = stays closed
- isDM false → true doesn't affect menu
- Multiple isDM toggles
- Edge case: rapid isDM changes
- Edge case: isDM change with active tab changes
- Edge case: isDM change with session name changes

**5. Integration (5 tests)**

- All state updates work together
- Multiple concurrent state changes
- State persistence across rerenders
- Hook cleanup
- Error cases (if any)

**Target:** 40-50 comprehensive tests

### Test Patterns

**Use renderHook from @testing-library/react:**

```typescript
import { renderHook, act } from "@testing-library/react";
import { useDMMenuState } from "../useDMMenuState";
import type { Character } from "@shared";

describe("useDMMenuState", () => {
  const mockNPC: Character = {
    id: "npc1",
    type: "npc",
    name: "Goblin",
    hp: 10,
    maxHp: 10,
    position: { x: 0, y: 0 },
  };

  const mockPlayer: Character = {
    id: "player1",
    type: "player",
    name: "Hero",
    hp: 20,
    maxHp: 20,
    position: { x: 0, y: 0 },
  };

  it("should have initial state", () => {
    const { result } = renderHook(() => useDMMenuState(true, []));

    expect(result.current.open).toBe(false);
    expect(result.current.activeTab).toBe("map");
    expect(result.current.sessionName).toBe("session");
    expect(result.current.npcs).toEqual([]);
  });

  it("should filter NPCs from characters", () => {
    const { result } = renderHook(() => useDMMenuState(true, [mockNPC, mockPlayer]));

    expect(result.current.npcs).toEqual([mockNPC]);
  });

  it("should close menu when isDM changes to false", () => {
    const { result, rerender } = renderHook(
      ({ isDM, characters }) => useDMMenuState(isDM, characters),
      { initialProps: { isDM: true, characters: [] } },
    );

    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);

    rerender({ isDM: false, characters: [] });
    expect(result.current.open).toBe(false);
  });
});
```

---

## 🎯 Success Criteria

### Phase 7 Goals

- [ ] Create useDMMenuState hook (~80-100 LOC)
- [ ] Create comprehensive tests (~40-50 tests)
- [ ] Integrate hook into DMMenu.tsx
- [ ] All tests passing (1,400+ tests)
- [ ] TypeScript clean
- [ ] Code formatted
- [ ] DMMenu.tsx reduced to ~245-255 LOC
- [ ] Context usage < 50%

### Quality Checks

- [ ] Hook has comprehensive JSDoc
- [ ] All state properly typed
- [ ] useCallback used for toggleOpen
- [ ] Auto-close behavior preserved
- [ ] NPC filtering memoized
- [ ] No behavior changes
- [ ] All existing tests still pass

---

## 📁 Expected File Changes

### New Files

```
apps/client/src/features/dm/hooks/
├── useDMMenuState.ts                      (~80-100 LOC)
└── __tests__/
    └── useDMMenuState.test.ts             (~40-50 tests)
```

### Modified Files

```
apps/client/src/features/dm/components/DMMenu.tsx
  Before: 284 LOC
  After:  ~245-255 LOC
  Change: Remove 5-6 lines of state declarations
          Remove 5-6 lines of useEffect
          Add 1 import line
          Add 9 lines of hook destructuring
          Update 1 onClick handler (setOpen → toggleOpen)
  Net:    -30 to -40 LOC
```

---

## 🔍 Code Location Reference

### Current DMMenu.tsx Structure (284 LOC)

```
Lines 1-17:   Imports
Lines 18-76:  DMMenuProps interface (58 lines)
Lines 78:     DMMenuTab type
Lines 80-126: Function signature and props destructuring
Lines 127-133: STATE TO EXTRACT ⭐
Lines 135-139: Auto-close useEffect ⭐
Lines 141-143: Early return if not DM
Lines 145-146: Derived state (saveDisabled, loadDisabled)
Lines 148-156: TabButton component
Lines 158-283: JSX render
```

**Target Lines for Extraction:** 127-139 (13 lines including blank lines)

### DMMenu.tsx State Dependencies

**Current state used in render:**

- `open` - Line 169, 177
- `setOpen` - Line 169, 180
- `activeTab` - Line 151, 213, 244, 254, 264
- `setActiveTab` - Line 150
- `sessionName` - Line 266
- `setSessionName` - Line 267
- `npcs` - Line 246

**No other components depend on this state** - extraction is isolated.

---

## 💡 Implementation Notes

### Why This Extraction?

**Benefits:**

1. **Separation of Concerns:** State management separated from presentation
2. **Testability:** Hook can be tested in isolation
3. **Reusability:** Pattern can be applied to other menu components
4. **Readability:** DMMenu.tsx becomes even cleaner

**Trade-offs:**

1. **Added indirection:** One more file to navigate
2. **Minimal benefit:** Only ~30-40 LOC reduction
3. **Pattern complexity:** Introduces hook pattern for simple state

**Recommendation:** Only proceed if standardizing state patterns across codebase.

### Hook Design Decisions

**1. toggleOpen() convenience method**

- Avoids `setOpen((prev) => !prev)` inline in render
- Makes intent clearer
- Follows React best practices

**2. Return object (not array)**

- More readable: `state.open` vs `state[0]`
- Self-documenting
- Easier to add properties later

**3. NPCs as derived state**

- Kept in hook (not moved to parent)
- Maintains memoization
- Encapsulates filtering logic

**4. Auto-close in effect**

- Kept in hook (not moved to parent)
- Encapsulates menu behavior
- Single responsibility

---

## 🚨 Common Pitfalls

### ❌ DON'T: Read files directly

```
# Bad:
Read(DMMenu.tsx)
Read(other files...)
```

### ✅ DO: Use Explore agent

```
# Good:
Task(subagent_type="Explore", ...)
```

### ❌ DON'T: Write tests manually

```
# Bad:
Write(useDMMenuState.test.ts)
```

### ✅ DO: Use general-purpose agent

```
# Good:
Task(subagent_type="general-purpose", prompt="Write comprehensive tests...")
```

### ❌ DON'T: Sequential execution

```
# Bad:
1. Find code (wait for result)
2. Write tests (wait for result)
3. Create hook (wait for result)
```

### ✅ DO: Parallel execution where possible

```
# Good (if independent):
Task(...) + Task(...) + Task(...)  // All in one message
```

### ❌ DON'T: Guess line numbers

After file changes, line numbers shift. Always re-search.

### ✅ DO: Use Explore agent for current locations

Each time you need line numbers, use fresh Explore agent.

---

## 📊 Context Budget Guidelines

**Target:** < 50% of 200K token budget (< 100K tokens)

**Phase 6 Achieved:** 47% (94K tokens)

### Token-Efficient Approach

**High Token Cost:**

- Reading large files directly
- Sequential file operations
- Multiple grep/find commands
- Repeated file reads

**Low Token Cost:**

- Explore agents (parallel)
- General-purpose agents (parallel)
- Single targeted file reads
- Batch operations

### Recommended Flow

1. **Discovery Phase:** 1 Explore agent (~5K tokens)
2. **Testing Phase:** 1 general-purpose agent (~10K tokens)
3. **Extraction Phase:** 1 general-purpose agent (~10K tokens)
4. **Integration Phase:** Direct orchestration (~15K tokens)
5. **Buffer:** 20K tokens for adjustments

**Total Estimate:** ~60K tokens (30% of budget)

---

## 🎓 Learning from Phase 6

### What Worked Well

✅ **Parallel agent launches**

- All 4 Explore agents in one message
- Reduced context by ~40%

✅ **Characterization tests first**

- Caught integration issues early
- vi.mock() with inline factories pattern

✅ **Batch integration**

- After MapTab proved pattern, integrated 3 together
- Saved ~20K tokens

### What to Replicate

1. **Launch agents in parallel** when tasks are independent
2. **Write tests before extraction** to capture behavior
3. **Integrate in batches** when pattern is proven
4. **Use agent outputs** without re-reading files

### New Optimizations for Phase 7

Since Phase 7 is simpler (1 hook vs 4 components):

1. **Single extraction cycle:** All work in one batch
2. **Lighter testing:** Hook tests simpler than component tests
3. **Direct integration:** No iteration needed

---

## 📋 Quick Start Checklist

When you begin Phase 7:

- [ ] Read this entire handoff document
- [ ] Confirm user approval to proceed (Phase 7 is OPTIONAL)
- [ ] Launch 1 Explore agent to find state code
- [ ] Launch 1 general-purpose agent to write tests
- [ ] Launch 1 general-purpose agent to create hook
- [ ] Integrate hook into DMMenu.tsx (direct)
- [ ] Run all tests
- [ ] Run typecheck
- [ ] Format code
- [ ] Commit changes
- [ ] Update documentation (DONE.md, PHASE7_COMPLETE.md)
- [ ] Verify final LOC count
- [ ] Report completion

---

## 🎯 Final State After Phase 7

**DMMenu.tsx:**

- Current: 284 LOC
- Target: ~245-255 LOC
- Reduction: ~30-40 LOC
- Cumulative: 1,588 → ~250 LOC (84.2% reduction)

**New Hook:**

- useDMMenuState: ~80-100 LOC
- Tests: ~40-50 tests
- Total test suite: ~1,420 tests

**Directory Structure:**

```
features/dm/
├── components/
│   ├── DMMenu.tsx (~250 LOC) ⭐ FINAL
│   ├── tab-views/ (4 components)
│   ├── map-controls/ (7 components)
│   ├── session-controls/ (2 components)
│   ├── NPCEditor.tsx
│   └── PropEditor.tsx
└── hooks/
    ├── useDMMenuState.ts ✨ NEW
    └── __tests__/
        └── useDMMenuState.test.ts ✨ NEW
```

---

## 🎉 Completion Criteria

Phase 7 is complete when:

1. ✅ useDMMenuState hook created and tested
2. ✅ Hook integrated into DMMenu.tsx
3. ✅ DMMenu.tsx at ~245-255 LOC
4. ✅ All tests passing (1,400+)
5. ✅ TypeScript clean
6. ✅ Code formatted
7. ✅ Changes committed
8. ✅ Documentation updated (DONE.md, PHASE7_COMPLETE.md)
9. ✅ Context usage < 50%
10. ✅ Zero behavior changes

---

## 📚 Related Documentation

- **Phase 6 Completion:** `docs/refactoring/DMMENU_PHASE6_COMPLETE.md`
- **Branching Strategy:** `docs/refactoring/BRANCHING_STRATEGY.md`
- **Refactor Playbook:** `docs/refactoring/REFACTOR_PLAYBOOK.md`
- **Refactor Roadmap:** `docs/refactoring/REFACTOR_ROADMAP.md`

---

## 🚀 Ready to Begin?

This handoff provides everything needed to complete Phase 7 agentically:

- Clear objectives and success criteria
- Agentic workflow instructions
- Code locations and extraction guidance
- Testing strategy and patterns
- Commit message templates
- Context optimization guidelines

**Remember:** Phase 7 is OPTIONAL. Only proceed with explicit user approval.

**Good luck with the final phase!** 🎯
