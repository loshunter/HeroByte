# DMMenu.tsx Phase 5 Handoff Document

**Date:** 2025-10-21
**Phase:** DMMenu.tsx Phase 5 - Session Controls
**Branch:** `refactor/dm-menu/stateful-tabs`
**Status:** Ready to begin Phase 5

---

## 🎯 Current Objective

Extract **Session Controls** from DMMenu.tsx as part of Phase 5.

**Goal:** Reduce DMMenu.tsx by ~140 LOC through extraction of session management controls.

**Current State:** 548 LOC → Target: ~408 LOC after Phase 5

---

## ✅ What's Complete

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

### Cumulative Progress
- **Original:** 1,588 LOC
- **Current:** 548 LOC
- **Reduction:** 1,040 LOC (65.5%)
- **Test Suite:** 192 passing tests (53 entity editors + 139 map controls)

---

## 📋 Phase 5 Targets

Extract two session management controls:

### Priority 13: SessionPersistenceControl (~60 LOC)
**Source Location:** Search DMMenu.tsx for "Save Session" / "Load Session" / session file management
**Complexity:** Low-Medium (file I/O, JSON handling)
**Features:**
- Save Session button (triggers session export)
- Load Session button (triggers file picker)
- Session file name display
- Success/error feedback via toasts

**Dependencies:**
- `onSaveSession` callback
- `onLoadSession` callback
- Possibly session metadata (last save time, session name)
- Toast notification system

**Expected Behavior:**
- Save button exports current room state as JSON file
- Load button opens file picker for .json files
- Display feedback on success/failure
- Validation of loaded JSON structure

### Priority 14: RoomPasswordControl (~80 LOC)
**Source Location:** Search DMMenu.tsx for "Room Password" / "Password" / authentication
**Complexity:** Low-Medium (password validation, state management)
**Features:**
- Current room password display (masked)
- Change password input field
- Set/Update password button
- Password visibility toggle (show/hide)
- Validation feedback

**Dependencies:**
- `roomPassword` prop (current password)
- `onSetRoomPassword` callback
- Password validation rules
- Toast notification for success/errors

**Expected Behavior:**
- Display current password (masked with •••••)
- Allow DM to change room password
- Validate password strength/requirements
- Update authentication state on change
- Show success/error feedback

---

## 🎼 Agent Orchestration Strategy

**CRITICAL:** Work agentically to minimize your context usage. You are the orchestrator, not the implementer.

### When to Use Agents

1. **Code Search & Discovery** → Use `Explore` agent
   ```
   Task: "Find all session persistence code in DMMenu.tsx (Save Session, Load Session buttons and handlers)"
   Agent: Explore (quick or medium thoroughness)
   Why: Efficient discovery without manual reading
   ```

2. **Test Writing** → Use `general-purpose` agent
   ```
   Task: "Write characterization tests for SessionPersistenceControl component. Follow the pattern in NPCEditor.test.tsx. Use fireEvent, not userEvent."
   Agent: general-purpose
   Why: Tests are repetitive pattern work - perfect for agents
   ```

3. **Component Extraction** → Use `general-purpose` agent (after tests exist)
   ```
   Task: "Extract SessionPersistenceControl component from DMMenu.tsx to new file apps/client/src/features/dm/components/session-controls/SessionPersistenceControl.tsx"
   Agent: general-purpose
   Why: Mechanical extraction with import updates
   ```

4. **Parallel Work** → Launch multiple agents in SINGLE message
   ```typescript
   // ONE message with TWO tool calls:
   Task("Write SessionPersistenceControl tests", ...)
   Task("Write RoomPasswordControl tests", ...)
   ```

### Agent Best Practices

✅ **DO:**
- Launch agents in parallel when tasks are independent
- Give agents complete context (file paths, line numbers, examples)
- Trust agent outputs (review but don't rewrite)
- Use agents for repetitive work (tests, extractions)
- Specify exact patterns to follow (reference files)

❌ **DON'T:**
- Read files yourself when agents can do it
- Write tests yourself when agents can write them
- Do manual search when Explore agent is available
- Launch agents sequentially when parallel is possible
- Micromanage agent outputs

---

## 📖 Extraction Pattern (Proven from Phases 2-4)

Follow this 4-step pattern for each component:

### Step 1: Write Characterization Tests
**File:** `apps/client/src/features/dm/components/__tests__/characterization/[ComponentName].test.tsx`

**Pattern to Follow:** See `NPCEditor.test.tsx`, `MapTransformControl.test.tsx`

**Key Requirements:**
- Use `fireEvent`, NOT `userEvent` (not available in codebase)
- Use accessible queries: `getByLabelText`, `getByRole`, `getByText`
- NO `data-testid` attributes needed
- Cover all user interactions (button clicks, input changes, prop updates)
- Test success and error scenarios
- Test validation and edge cases

**Agent Prompt Example:**
```
Write comprehensive characterization tests for SessionPersistenceControl component.

SOURCE: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx
(Use Explore agent first to find exact lines)

PATTERN: Follow the testing style in:
- /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx
- /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/MapTransformControl.test.tsx

REQUIREMENTS:
- Use fireEvent (NOT userEvent)
- Use accessible queries (getByLabelText, getByRole, getByText)
- Test save button click (triggers onSaveSession)
- Test load button click (triggers onLoadSession)
- Test error handling scenarios
- Mock file I/O operations

SAVE TO: /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/SessionPersistenceControl.test.tsx
```

### Step 2: Extract Component File
**Agent Prompt Example:**
```
Extract SessionPersistenceControl component from DMMenu.tsx to a new file.

SOURCE: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx
(Lines found by Explore agent)

TARGET: /home/loshunter/HeroByte/apps/client/src/features/dm/components/session-controls/SessionPersistenceControl.tsx

INTERFACE: Extract SessionPersistenceControlProps from DMMenuProps
IMPORTS: Ensure JRPGPanel, JRPGButton are imported

Add comprehensive JSDoc comments documenting:
- Component purpose (session save/load management)
- Props interface
- Callback expectations (onSaveSession, onLoadSession)
```

### Step 3: Update Tests
**Changes:**
1. Remove inline component stub from test file
2. Add import: `import { SessionPersistenceControl } from "../../session-controls/SessionPersistenceControl";`
3. Run tests: `pnpm test:client -- SessionPersistenceControl.test.tsx`
4. Verify all tests pass

### Step 4: Integrate into DMMenu.tsx
**Changes:**
1. Add import: `import { SessionPersistenceControl } from "./session-controls/SessionPersistenceControl";`
2. Remove inline component code
3. Replace with: `<SessionPersistenceControl onSaveSession={onSaveSession} onLoadSession={onLoadSession} ... />`
4. Run full test suite: `pnpm test:client -- DMMenu`
5. Run linting: `pnpm lint` and `pnpm format` if needed

### Step 5: Commit
**Commit Message Template:**
```
refactor: extract SessionPersistenceControl from DMMenu.tsx

Extract session save/load controls into standalone component.

**Component Created:**
- apps/client/src/features/dm/components/session-controls/SessionPersistenceControl.tsx (XXX LOC)
  - Interface: SessionPersistenceControlProps
  - Features: save session button, load session button, file I/O handling

**Tests Created:**
- XX comprehensive tests covering all interactions
- Uses accessible queries (getByRole, getByText)
- Tests save/load flows and error handling

**DMMenu.tsx Changes:**
- Added SessionPersistenceControl import
- Removed inline session controls
- Replaced with <SessionPersistenceControl> component usage

**Impact:**
- DMMenu.tsx reduced: 548 → ~488 LOC (~60 LOC reduction)
- Cumulative: 1,588 → ~488 LOC (~1,100 LOC / 69% reduction)
- All XX tests passing
- All linting passing
- TypeScript compilation clean

Part of Phase 5: Session Controls (Priority 13)
See: docs/refactoring/DMMENU_PHASE5_HANDOFF.md

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🗺️ File Locations Reference

### Current DMMenu.tsx
- **Path:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx`
- **Current LOC:** 548
- **Target LOC (after Phase 5):** ~408

### Phase 5 Target Files
- **SessionPersistenceControl:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/session-controls/SessionPersistenceControl.tsx`
- **RoomPasswordControl:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/session-controls/RoomPasswordControl.tsx`

### Test Files
- **SessionPersistenceControl Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/SessionPersistenceControl.test.tsx`
- **RoomPasswordControl Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/RoomPasswordControl.test.tsx`

### Reference Files (Patterns to Follow)
- **NPCEditor:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/NPCEditor.tsx`
- **NPCEditor Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx`
- **MapTransformControl:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/MapTransformControl.tsx`
- **MapTransformControl Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/MapTransformControl.test.tsx`

### Documentation
- **Roadmap:** `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_ROADMAP.md`
- **Phase 4 Completion:** `/home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE4_FINAL_HANDOFF.md`

---

## 🛠️ Commands Reference

### Testing
```bash
# Run specific component tests
pnpm test:client -- SessionPersistenceControl.test.tsx
pnpm test:client -- RoomPasswordControl.test.tsx

# Run all DMMenu-related tests
pnpm test:client -- DMMenu

# Run all client tests
pnpm test:client
```

### Linting & Formatting
```bash
# Run linting
pnpm lint

# Auto-fix formatting
pnpm format
```

### Git Workflow
```bash
# Check current status
git status

# Stage files
git add <files>

# Commit with message
git commit -m "refactor: <description>"

# Check current branch
git branch --show-current
# Should be: refactor/dm-menu/stateful-tabs
```

---

## ⚠️ Critical Notes

### 1. Testing Pattern
- **MUST use `fireEvent`, NOT `userEvent`** (userEvent not installed)
- Pattern: `fireEvent.click()`, `fireEvent.change()`, `fireEvent.blur()`
- Example from NPCEditor.test.tsx:
  ```typescript
  fireEvent.click(getByRole("button", { name: /save/i }));
  expect(mockCallback).toHaveBeenCalledTimes(1);
  ```

### 2. Accessible Queries Only
- Use `getByRole("button", { name: /save session/i })` for buttons
- Use `getByLabelText("Password")` for inputs
- Use `getByText()` for text content
- **NO `data-testid` attributes needed** - components use JRPGPanel

### 3. File I/O Testing
- Mock file operations in tests (save/load)
- Don't actually write files in tests
- Test callback invocations, not file system
- Example:
  ```typescript
  const mockOnSaveSession = vi.fn();
  fireEvent.click(getByRole("button", { name: /save/i }));
  expect(mockOnSaveSession).toHaveBeenCalled();
  ```

### 4. Password Security
- Don't expose actual passwords in tests
- Use masked display (••••••) in UI
- Test visibility toggle functionality
- Validate password requirements before submission

### 5. PropTypes to Extract

**SessionPersistenceControl:**
- `onSaveSession` callback
- `onLoadSession` callback
- Possibly `sessionName`, `lastSaved` metadata

**RoomPasswordControl:**
- `roomPassword` (current password)
- `onSetRoomPassword` callback
- Password validation rules

---

## 🚀 Quick Start Prompt for Next Orchestrator

Use this prompt to start Phase 5:

```
I'm continuing the DMMenu.tsx Phase 5 refactoring. Read the handoff document at /home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE5_HANDOFF.md to understand the current state.

Current status:
- DMMenu.tsx is at 548 LOC (down from 1,588)
- Phases 2-4 complete (entity editors, simple controls, complex controls extracted)
- Phase 4 just completed: GridAlignmentWizard extraction (commit 049a61e)
- Branch: refactor/dm-menu/stateful-tabs
- 1,040 LOC reduced so far (65.5%)

Phase 5 goal: Extract 2 session control components (~140 LOC reduction)
1. SessionPersistenceControl (Priority 13, ~60 LOC)
2. RoomPasswordControl (Priority 14, ~80 LOC)

CRITICAL: Work agentically to minimize your context usage!
- Use Explore agent to find session control code in DMMenu.tsx
- Use general-purpose agents to write tests (follow NPCEditor.test.tsx pattern)
- Use general-purpose agents to extract components
- Launch agents in PARALLEL when possible (single message, multiple Task calls)

Follow the proven 4-step extraction pattern from Phases 2-4:
1. Write characterization tests (use agent)
2. Extract component file (use agent)
3. Update tests to import extracted component
4. Integrate into DMMenu.tsx and commit

Start by using an Explore agent to locate the session persistence code in DMMenu.tsx. Look for "Save Session", "Load Session", session file handling. Then write tests and extract the component.

Remember: Use fireEvent (NOT userEvent), use accessible queries (getByRole, getByText), and preserve all logic exactly as-is.
```

---

## 📊 Phase 5 Success Metrics

### Quantitative
- [ ] SessionPersistenceControl extracted (~60 LOC)
- [ ] RoomPasswordControl extracted (~80 LOC)
- [ ] Total reduction: ~140 LOC
- [ ] DMMenu.tsx target: ~408 LOC (down from 548)
- [ ] All tests passing (current 192 + new tests)
- [ ] Zero linting errors
- [ ] TypeScript compilation clean

### Qualitative
- [ ] No behavioral changes to DMMenu
- [ ] Each control independently testable
- [ ] File I/O logic preserved exactly
- [ ] Password handling secure
- [ ] Components follow established patterns
- [ ] Clear separation of concerns
- [ ] Props interfaces are minimal and focused

---

## 🎯 Phase 5 Expected Outcome

**After completing Phase 5:**
- DMMenu.tsx: 548 → ~408 LOC (26% reduction in Phase 5)
- Cumulative: 1,588 → ~408 LOC (74% total reduction)
- New components: 8 total (2 entity editors + 4 simple/complex controls + 2 session controls)
- Test coverage: 192 → ~230+ tests
- Ready for Phase 6: Tab Views (composition)

**Remaining after Phase 5:**
- Phase 6: Tab Views (Priorities 15-18)
  - MapTab, NPCsTab, PropsTab, SessionTab
  - Composition layer, doesn't reduce LOC but improves organization
- Optional Phase 7: State Hook (Priority 19)
  - useDMMenuState hook extraction
  - Final target: ~350 LOC

---

## 💡 Pro Tips from Phases 2-4

1. **Trust the agents** - They wrote 192 tests flawlessly across 3 phases
2. **Parallel is faster** - Launch 2 test-writing agents simultaneously for Phase 5
3. **Reference files work** - Always point agents to NPCEditor.test.tsx
4. **Accessible queries win** - No testid setup needed, just works
5. **Commit frequently** - One commit per component keeps history clean
6. **Logic is sacred** - Don't "improve" during extraction, just extract
7. **Tests first, always** - Characterization tests catch everything
8. **Agents + human review** - Best combo for speed and quality
9. **Explore before extract** - Use Explore agent to find exact code locations
10. **Mock file operations** - Don't write actual files in tests

---

## 🌟 Agentic Workflow Emphasis

**This is the most important section.** Phase 5 orchestrators should maximize agent usage to minimize context consumption.

### Agentic Principles

1. **You Are the Conductor, Not the Musician**
   - Your job: orchestrate agents to do the work
   - Not your job: read files, write tests, extract components yourself

2. **Launch Agents in Parallel**
   ```
   # Instead of:
   Task(agent1) → wait → Task(agent2) → wait

   # Do this:
   Task(agent1, agent2) → wait once → review both
   ```

3. **Minimize Your Context Usage**
   - Don't read DMMenu.tsx yourself - use Explore agent
   - Don't write tests yourself - use general-purpose agent
   - Don't extract components yourself - use general-purpose agent
   - Your context is for orchestration and review, not implementation

4. **Agent Task Patterns**

   **Discovery:**
   ```
   Explore: "Find all session persistence code in DMMenu.tsx"
   → Returns exact line numbers and code excerpts
   → You use this to brief extraction agent
   ```

   **Test Writing:**
   ```
   General-Purpose: "Write SessionPersistenceControl tests following NPCEditor.test.tsx pattern"
   → Returns complete test file
   → You review and accept (don't rewrite)
   ```

   **Extraction:**
   ```
   General-Purpose: "Extract SessionPersistenceControl from DMMenu.tsx lines X-Y to session-controls/SessionPersistenceControl.tsx"
   → Returns new component file
   → You verify imports and integration
   ```

5. **Review, Don't Rewrite**
   - Agent outputs are usually correct
   - Your review should catch logic errors, not style issues
   - If something is wrong, re-prompt the agent with corrections
   - Don't manually fix agent outputs (wastes your context)

### Parallel Agent Launch Example

```typescript
// ONE MESSAGE with MULTIPLE agent calls:

// Step 1: Discovery (parallel)
Explore("Find SessionPersistenceControl code in DMMenu.tsx")
Explore("Find RoomPasswordControl code in DMMenu.tsx")

// Step 2: Test Writing (parallel, after discovery)
Task(general-purpose, "Write SessionPersistenceControl tests at lines X-Y")
Task(general-purpose, "Write RoomPasswordControl tests at lines A-B")

// Step 3: Extraction (parallel, after tests)
Task(general-purpose, "Extract SessionPersistenceControl component")
Task(general-purpose, "Extract RoomPasswordControl component")
```

### Context Budget

Assume you have limited context. Spend it on:
- ✅ Orchestration (launching agents)
- ✅ Review (verifying agent outputs)
- ✅ Integration (final DMMenu.tsx updates, commits)
- ❌ Reading files (use Explore agent)
- ❌ Writing tests (use general-purpose agent)
- ❌ Extracting components (use general-purpose agent)

**Target:** Complete Phase 5 in <30% of your context budget by delegating 70%+ of work to agents.

---

**Last Updated:** 2025-10-21
**Prepared By:** Claude (Phase 15 Refactoring Initiative)
**Branch:** `refactor/dm-menu/stateful-tabs`
**Next Phase:** Phase 5 - Session Controls
**Ready to Begin:** Yes ✅
