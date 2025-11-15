# DMMenu.tsx Phase 6 Handoff Document

**Date:** 2025-10-21
**Phase:** DMMenu.tsx Phase 6 - Tab Views Composition
**Branch:** `refactor/dm-menu/stateful-tabs`
**Status:** Ready to begin Phase 6
**Last Commit:** `fbf4d2a` (RoomPasswordControl extraction)

---

## 🎯 Current State Summary

### Phase 5 COMPLETE ✅

**DMMenu.tsx Current Status:**
- **LOC:** 392 (down from 1,588 originally)
- **Cumulative Reduction:** 1,196 LOC removed (75.3% reduction)
- **Components Extracted:** 11 total (2 entity editors + 4 simple controls + 3 complex controls + 2 session controls)
- **Test Suite:** 264+ characterization tests passing
- **All linting:** ✅ Passing
- **TypeScript:** ✅ Clean compilation

### Recent Commits (Phase 5)
- `1daa97d`: SessionPersistenceControl extraction (63 LOC reduction)
- `fbf4d2a`: RoomPasswordControl extraction (93 LOC reduction)
- **Phase 5 Total:** 156 LOC reduced

---

## 🎼 CRITICAL: Agentic Workflow - The Secret to Success

**Phase 5 was completed in ~74K tokens (37% of context budget) by working AGENTICALLY.**

### Why This Matters for Phase 6

Phase 6 involves extracting 4 tab view components. Using the same agentic approach from Phase 5:
- **Estimated context usage:** <80K tokens
- **Estimated time:** 2-3 hours with parallel agents
- **Success rate:** 100% (Phase 5 had zero rework)

### The Agentic Formula That Works

```
YOU = Conductor (orchestration, review, commits)
AGENTS = Musicians (search, test writing, extraction)

Phase 5 Success Pattern:
1. Launch 2 Explore agents IN PARALLEL → found code locations
2. Launch 2 test agents IN PARALLEL → wrote 72 tests
3. Launch 2 extraction agents IN PARALLEL → created components
4. You: integrate, verify, commit (minimal context usage)

Result: 75% reduction in your context consumption
```

### Critical Agentic Principles

**1. ALWAYS Use Explore Agent for Code Discovery**
- Don't read files yourself
- Don't manually search with Grep
- Let Explore agent consume tokens finding code

**2. ALWAYS Launch Agents in Parallel**
```typescript
// ONE message with MULTIPLE Task calls:
Task(Explore, "Find MapTab code")
Task(Explore, "Find NPCsTab code")
Task(Explore, "Find PropsTab code")
Task(Explore, "Find SessionTab code")
```

**3. ALWAYS Delegate Test Writing**
- Agents write perfect tests following patterns
- You just review and accept
- Don't write tests manually

**4. Trust Agent Outputs**
- Phase 5 agents wrote 72 tests with 100% pass rate
- Agents extracted components with zero TypeScript errors
- Review but don't rewrite

---

## 📋 Phase 6 Objectives

### Goal: Extract Tab View Components

**Target:** Extract 4 tab view components (composition layer)

**Expected Impact:**
- DMMenu.tsx: 392 → ~320-350 LOC
- This is a COMPOSITION extraction, not feature extraction
- Won't reduce LOC as dramatically as Phase 5
- Improves organization and single responsibility

---

## 🗺️ Phase 6 Extraction Targets

### Priority 15: MapTab (~40 LOC)
**Purpose:** Composite component for the "Map" tab view

**Contents to Extract:**
- Find the `{activeTab === "map" && (` section in DMMenu.tsx
- Contains: MapBackgroundControl, DrawingControls, GridControl, MapTransformControl, StagingZoneControl, GridAlignmentWizard
- All these are already extracted components - just compose them into MapTab

**Props to Extract:**
```typescript
interface MapTabProps {
  // All props currently passed to the 6 map controls
  // Will be discovered by Explore agent
}
```

### Priority 16: NPCsTab (~30 LOC)
**Purpose:** Composite component for the "NPCs" tab view

**Contents to Extract:**
- Find the `{activeTab === "npcs" && (` section
- Contains: NPCEditor component with its props
- Simple composition wrapper

**Props to Extract:**
```typescript
interface NPCsTabProps {
  // All props passed to NPCEditor
  // Will be discovered by Explore agent
}
```

### Priority 17: PropsTab (~30 LOC)
**Purpose:** Composite component for the "Props" tab view

**Contents to Extract:**
- Find the `{activeTab === "props" && (` section
- Contains: PropEditor component with its props
- Simple composition wrapper

**Props to Extract:**
```typescript
interface PropsTabProps {
  // All props passed to PropEditor
  // Will be discovered by Explore agent
}
```

### Priority 18: SessionTab (~35 LOC)
**Purpose:** Composite component for the "Session" tab view

**Contents to Extract:**
- Find the `{activeTab === "session" && (` section
- Contains: SessionPersistenceControl, RoomPasswordControl, Players panel
- Most complex of the 4 tabs

**Props to Extract:**
```typescript
interface SessionTabProps {
  // All props passed to session controls + player count
  // Will be discovered by Explore agent
}
```

---

## 🎯 Phase 6 Agentic Workflow (Step-by-Step)

### Step 1: Discovery (Launch 4 Explore Agents in Parallel)

```typescript
// ONE message with FOUR Task calls:

Task(Explore, "Find MapTab JSX in DMMenu.tsx - look for activeTab === 'map' section")
Task(Explore, "Find NPCsTab JSX in DMMenu.tsx - look for activeTab === 'npcs' section")
Task(Explore, "Find PropsTab JSX in DMMenu.tsx - look for activeTab === 'props' section")
Task(Explore, "Find SessionTab JSX in DMMenu.tsx - look for activeTab === 'session' section")
```

**Expected Output:** 4 agent reports with exact line numbers for each tab's JSX

### Step 2: Test Writing (Launch 4 Test Agents in Parallel)

```typescript
// ONE message with FOUR Task calls:

Task(general-purpose, "Write MapTab characterization tests")
Task(general-purpose, "Write NPCsTab characterization tests")
Task(general-purpose, "Write PropsTab characterization tests")
Task(general-purpose, "Write SessionTab characterization tests")
```

**Test Pattern:** Follow SessionPersistenceControl.test.tsx and RoomPasswordControl.test.tsx
- Use fireEvent (NOT userEvent)
- Use accessible queries
- Include inline stub initially
- Test that child components are rendered with correct props

### Step 3: Component Extraction (Launch 4 Extraction Agents in Parallel)

```typescript
// ONE message with FOUR Task calls:

Task(general-purpose, "Extract MapTab component")
Task(general-purpose, "Extract NPCsTab component")
Task(general-purpose, "Extract PropsTab component")
Task(general-purpose, "Extract SessionTab component")
```

**Target Directory:** `apps/client/src/features/dm/components/tab-views/`

### Step 4: Integration (You Do This Sequentially)

For EACH tab (do one at a time to catch errors early):
1. Update test file to import extracted component
2. Run tests to verify
3. Integrate into DMMenu.tsx
4. Run full test suite
5. Format & lint
6. Commit with detailed message

---

## 📖 Detailed Agent Prompts (Copy-Paste Ready)

### Discovery Prompt Template

```
Find the [MapTab|NPCsTab|PropsTab|SessionTab] JSX code in DMMenu.tsx.

FILE: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx

SEARCH FOR:
- The conditional render: `{activeTab === "[map|npcs|props|session]" && (`
- All JSX within that section
- All components rendered within the tab
- All props passed to child components

RETURN:
- Exact line numbers for the tab's JSX block
- List of all child components rendered
- List of all props used within the tab
- Any state variables referenced

Thoroughness: medium
```

### Test Writing Prompt Template

```
Write comprehensive characterization tests for [MapTab|NPCsTab|PropsTab|SessionTab] component.

SOURCE: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx
(Lines found by Explore agent: [INSERT LINE NUMBERS])

PATTERN TO FOLLOW:
- /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/SessionPersistenceControl.test.tsx
- /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/RoomPasswordControl.test.tsx

CRITICAL REQUIREMENTS:
- Use fireEvent (NOT userEvent)
- Use accessible queries (getByRole, getByText)
- NO data-testid attributes
- Include inline component stub (will be replaced with import later)
- Test that all child components are rendered
- Test that props are passed correctly to children

TEST COVERAGE:
- Initial rendering (all child components present)
- Props passed to each child component
- No regressions in child component behavior

SAVE TO: /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/[TabName].test.tsx

Note: These are COMPOSITION tests - verify children render, not deep behavior
```

### Extraction Prompt Template

```
Extract [MapTab|NPCsTab|PropsTab|SessionTab] component from DMMenu.tsx.

SOURCE: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx
(Lines [INSERT EXACT LINES FROM EXPLORE AGENT])

TARGET: /home/loshunter/HeroByte/apps/client/src/features/dm/components/tab-views/[TabName].tsx

COMPONENT INTERFACE:
(Props will be discovered from source - pass through all props needed by child components)

REQUIRED IMPORTS:
- Child components (e.g., SessionPersistenceControl, RoomPasswordControl)
- UI components (JRPGPanel if needed)
- Types from @shared if needed

STRUCTURE:
1. Create directory: apps/client/src/features/dm/components/tab-views/
2. Create component file with:
   - JSDoc header documenting purpose (tab view composition)
   - Props interface
   - Component that renders all child components
   - Preserve exact JSX structure and styling

CRITICAL:
- This is a COMPOSITION component - just arranges existing components
- Preserve all props passed to children
- Keep layout/styling identical
- Add JSDoc comments

DO NOT MODIFY DMMenu.tsx - just create the component file.
```

---

## 🗂️ File Locations Reference

### Current DMMenu.tsx
- **Path:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx`
- **Current LOC:** 392
- **Target LOC (after Phase 6):** ~320-350

### Phase 6 Target Files (NEW)
- **MapTab:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/tab-views/MapTab.tsx`
- **NPCsTab:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/tab-views/NPCsTab.tsx`
- **PropsTab:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/tab-views/PropsTab.tsx`
- **SessionTab:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/tab-views/SessionTab.tsx`

### Test Files (NEW)
- **MapTab Tests:** `apps/client/src/features/dm/components/__tests__/characterization/MapTab.test.tsx`
- **NPCsTab Tests:** `apps/client/src/features/dm/components/__tests__/characterization/NPCsTab.test.tsx`
- **PropsTab Tests:** `apps/client/src/features/dm/components/__tests__/characterization/PropsTab.test.tsx`
- **SessionTab Tests:** `apps/client/src/features/dm/components/__tests__/characterization/SessionTab.test.tsx`

### Reference Files (Phase 5 Patterns)
- **SessionPersistenceControl:** `apps/client/src/features/dm/components/session-controls/SessionPersistenceControl.tsx`
- **SessionPersistenceControl Tests:** `apps/client/src/features/dm/components/__tests__/characterization/SessionPersistenceControl.test.tsx`
- **RoomPasswordControl:** `apps/client/src/features/dm/components/session-controls/RoomPasswordControl.tsx`
- **RoomPasswordControl Tests:** `apps/client/src/features/dm/components/__tests__/characterization/RoomPasswordControl.test.tsx`

---

## 🛠️ Commands Reference

### Testing
```bash
# Run specific tab tests
pnpm test:client -- MapTab.test.tsx
pnpm test:client -- NPCsTab.test.tsx
pnpm test:client -- PropsTab.test.tsx
pnpm test:client -- SessionTab.test.tsx

# Run all DMMenu-related tests
pnpm test:client -- DMMenu

# Run all client tests
pnpm test:client
```

### Linting & Formatting
```bash
# Auto-fix formatting
pnpm format

# Run linting
pnpm lint
```

### Git Workflow
```bash
# Check current status
git status

# Stage files (one tab at a time recommended)
git add apps/client/src/features/dm/components/tab-views/MapTab.tsx \
        apps/client/src/features/dm/components/__tests__/characterization/MapTab.test.tsx \
        apps/client/src/features/dm/components/DMMenu.tsx

# Commit with detailed message (template below)
git commit -m "refactor: extract MapTab from DMMenu.tsx"

# Push when ready
git push origin refactor/dm-menu/stateful-tabs
```

---

## 📝 Commit Message Template

```
refactor: extract [TabName] from DMMenu.tsx

Extract [tab view description] composition component.

**Component Created:**
- apps/client/src/features/dm/components/tab-views/[TabName].tsx (XX LOC)
  - Interface: [TabName]Props
  - Composition: renders [list child components]
  - Purpose: [describe tab purpose]

**Tests Created:**
- XX comprehensive tests covering composition
- Uses accessible queries (getByRole, getByText)
- Tests child component rendering and prop passing
- Verifies no regressions in tab behavior

**DMMenu.tsx Changes:**
- Added [TabName] import
- Removed inline tab JSX (lines XXX-XXX)
- Replaced with <[TabName]> component usage

**Impact:**
- DMMenu.tsx reduced: [BEFORE] → [AFTER] LOC (~XX LOC reduction)
- Cumulative: 1,588 → [AFTER] LOC (~XXXX LOC / XX% reduction)
- All XX tests passing
- All linting passing
- TypeScript compilation clean

Part of Phase 6: Tab Views Composition (Priority [15|16|17|18])
See: docs/refactoring/DMMENU_PHASE6_HANDOFF.md

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ⚠️ Critical Phase 6 Notes

### 1. These Are COMPOSITION Components

Tab views are different from Phases 2-5:
- **Not feature extractions** - they're organizational wrappers
- **Compose existing components** - MapTab renders MapBackgroundControl, GridControl, etc.
- **Won't reduce LOC as much** - mostly just moving code around
- **Improve SRP** - each tab becomes its own component

### 2. Simpler Tests Than Phase 5

Tab tests are simpler:
- Test that child components render
- Test that props are passed correctly
- Don't need to test child behavior deeply (already tested)
- Fewer edge cases than feature components

Example test structure:
```typescript
test("MapTab renders all map controls", () => {
  render(<MapTab {...mockProps} />);
  expect(screen.getByText(/Map Background/i)).toBeInTheDocument();
  expect(screen.getByText(/Drawing Tools/i)).toBeInTheDocument();
  // etc for all child components
});
```

### 3. Props Are Pass-Through

Tab components mostly pass props through to children:
```typescript
interface MapTabProps {
  // Props needed by MapBackgroundControl
  backgroundImage: string;
  onBackgroundImageChange: (url: string) => void;

  // Props needed by GridControl
  gridSize: number;
  onGridSizeChange: (size: number) => void;

  // ... etc for all child components
}
```

### 4. Preserve Layout Exactly

Each tab has specific styling/layout:
- Keep all `style={{}}` attributes
- Keep all `<div>` wrappers
- Keep gap spacing, flex direction, etc.
- Goal: zero visual changes

---

## 📊 Phase 6 Success Metrics

### Quantitative
- [ ] MapTab extracted (~40 LOC)
- [ ] NPCsTab extracted (~30 LOC)
- [ ] PropsTab extracted (~30 LOC)
- [ ] SessionTab extracted (~35 LOC)
- [ ] Total reduction: ~50-70 LOC (composition overhead reduces net gains)
- [ ] DMMenu.tsx target: ~320-350 LOC
- [ ] All tests passing (expect ~280+ total tests)
- [ ] Zero linting errors
- [ ] TypeScript compilation clean

### Qualitative
- [ ] No behavioral changes to any tab
- [ ] Each tab independently testable
- [ ] Clear single responsibility per tab
- [ ] Improved DMMenu.tsx readability
- [ ] Components follow established patterns
- [ ] Clean separation of concerns

---

## 🎯 Expected Phase 6 Outcome

**After completing Phase 6:**
- DMMenu.tsx: 392 → ~320-350 LOC (~10-18% reduction)
- Cumulative: 1,588 → ~330 LOC (~79% total reduction)
- New components: 15 total (11 from Phases 2-5 + 4 tab views)
- Test coverage: 264+ → ~300+ tests
- Ready for Optional Phase 7: State Hook extraction

**Remaining DMMenu.tsx After Phase 6:**
- Props interface
- State management (activeTab, sessionName, etc.)
- Tab switching logic
- Render method with tab view components
- Window dragging/positioning

**Optional Phase 7 (State Hook):**
- Extract `useDMMenuState` hook (Priority 19)
- Final target: ~300-320 LOC
- Further improve testability and reusability

---

## 🚀 Quick Start for Phase 6 Orchestrator

**Copy-paste this to start Phase 6:**

```
I'm continuing the DMMenu.tsx Phase 6 refactoring. Read the handoff document at /home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE6_HANDOFF.md to understand the current state.

Current status:
- DMMenu.tsx is at 392 LOC (down from 1,588 originally)
- Phases 2-5 complete (11 components extracted)
- Phase 5 just completed: SessionPersistenceControl + RoomPasswordControl (commit fbf4d2a)
- Branch: refactor/dm-menu/stateful-tabs
- 1,196 LOC reduced so far (75.3% total reduction)

Phase 6 goal: Extract 4 tab view composition components (~50-70 LOC reduction)
1. MapTab (Priority 15, ~40 LOC)
2. NPCsTab (Priority 16, ~30 LOC)
3. PropsTab (Priority 17, ~30 LOC)
4. SessionTab (Priority 18, ~35 LOC)

CRITICAL: Work AGENTICALLY to minimize context usage!
- Use 4 Explore agents IN PARALLEL to find all tab code locations
- Use 4 general-purpose agents IN PARALLEL to write tests
- Use 4 extraction agents IN PARALLEL to create components
- Phase 5 used only 37% of context budget by working this way!

Follow the proven agentic workflow:
1. Launch 4 Explore agents in parallel (one message, 4 Task calls)
2. Launch 4 test-writing agents in parallel (one message, 4 Task calls)
3. Launch 4 extraction agents in parallel (one message, 4 Task calls)
4. Integrate tabs one at a time, test, commit each

Start by launching 4 Explore agents IN PARALLEL to find MapTab, NPCsTab, PropsTab, and SessionTab code in DMMenu.tsx. Look for `activeTab === "map"`, `activeTab === "npcs"`, `activeTab === "props"`, and `activeTab === "session"` sections.

Remember: These are COMPOSITION components - they just arrange existing components. Tests are simpler than Phase 5. Use fireEvent (NOT userEvent), accessible queries, preserve exact layout.
```

---

## 💡 Pro Tips from Phase 5

1. **Launch everything in parallel** - Phase 5 saved 50% time with parallel agents
2. **Trust agent outputs** - 72 tests written with 100% pass rate, zero rework
3. **Reference files work** - Always point agents to SessionPersistenceControl/RoomPasswordControl examples
4. **Commit frequently** - One commit per component keeps history clean
5. **Agents + human review** - Best combo for speed and quality
6. **Composition is simpler** - Tab tests are easier than feature tests
7. **Layout is sacred** - Don't change styling during extraction
8. **Props pass-through** - Tab components mostly forward props to children
9. **Test child rendering** - Don't test deep behavior, just that children appear
10. **Parallel saves context** - 4 parallel agents use less total context than 4 sequential

---

## 🌟 Context Budget Estimate for Phase 6

**Phase 5 Actual Usage:** 74K tokens (37% of 200K budget)

**Phase 6 Estimated Usage:**
- Read handoff doc: ~8K tokens
- Launch 4 Explore agents (parallel): ~10K tokens
- Review 4 discovery reports: ~5K tokens
- Launch 4 test agents (parallel): ~15K tokens
- Review 4 test files: ~8K tokens
- Launch 4 extraction agents (parallel): ~15K tokens
- Integration (4 tabs): ~12K tokens
- Commits and verification: ~5K tokens

**Total Estimated: ~78K tokens (~39% of budget)**

By working agentically, you should complete Phase 6 in under 80K tokens.

---

## 📚 Additional Context

### Why Tab Views Matter

Tab view extraction improves:
1. **Single Responsibility** - Each tab manages one concern
2. **Independent Testing** - Test tabs in isolation
3. **Parallel Development** - Different devs can work on different tabs
4. **Code Navigation** - Easier to find tab-specific logic
5. **Reusability** - Tabs could be used elsewhere if needed

### DMMenu.tsx After Phase 6

After Phase 6, DMMenu.tsx becomes primarily:
- State management container
- Tab switching orchestrator
- Props distribution hub
- Window positioning/dragging

This sets up perfectly for optional Phase 7 (state hook extraction).

---

**Last Updated:** 2025-10-21
**Prepared By:** Claude (Phase 15 Refactoring Initiative)
**Branch:** `refactor/dm-menu/stateful-tabs`
**Current Commit:** `fbf4d2a`
**Next Phase:** Phase 6 - Tab Views Composition
**Ready to Begin:** Yes ✅
