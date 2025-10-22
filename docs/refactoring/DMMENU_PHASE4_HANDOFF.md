# DMMenu Phase 4 Handoff Document

**Date:** 2025-10-21
**Phase:** DMMenu.tsx Phase 4 - Complex Map Controls
**Branch:** `refactor/dm-menu/stateful-tabs`
**Status:** Ready to begin Phase 4

---

## 🎯 Current Objective

Extract **Complex Map Controls** from DMMenu.tsx as part of Phase 4.

**Goal:** Reduce DMMenu.tsx by ~430 LOC through extraction of mathematically complex controls.

**Current State:** 1,022 LOC → Target: ~592 LOC after Phase 4

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
- **Reduction:** 153 LOC (19 + 134)
- **Commits:** `979e10e`, `d439ba5`

### Cumulative Progress
- **Original:** 1,588 LOC
- **Current:** 1,022 LOC
- **Reduction:** 566 LOC (36%)
- **Test Suite:** 55 passing tests (53 entity editors + 2 DMMenu)

---

## 📋 Phase 4 Targets

Extract three complex map controls with mathematical logic:

### Priority 10: MapTransformControl (~160 LOC)
**Source Location:** Lines 355-511 in DMMenu.tsx
**Complexity:** Medium-High (transform state management, rotation)
**Features:**
- Scale slider (0.1x to 3.0x)
- X/Y position inputs
- Rotation slider (0° to 360°)
- Lock/unlock toggle with collapsible UI
- Real-time transform updates

**Dependencies:**
- `mapTransform` prop (object with scaleX, scaleY, x, y, rotation)
- `mapLocked` prop (boolean)
- `onMapTransformChange` callback
- `onMapLockToggle` callback
- `CollapsibleSection` component

### Priority 11: StagingZoneControl (~180 LOC)
**Source Location:** Lines 732-787 in DMMenu.tsx
**Complexity:** High (viewport calculations, coordinate conversion)
**Features:**
- X/Y/Width/Height/Rotation inputs
- "Apply Zone" button (calculates zone from viewport center)
- "Clear Zone" button
- Uses camera state for viewport-to-world coordinate conversion
- Grid size calculations

**Dependencies:**
- `playerStagingZone` prop (object or undefined)
- `camera` prop (object with x, y, scale)
- `gridSize` prop (number)
- `onSetPlayerStagingZone` callback
- `stagingInputs` local state
- `handleStagingInputChange`, `handleStagingZoneApply`, `handleStagingZoneClear` handlers

**Mathematical Logic:**
```typescript
// Viewport center to world coordinates
const centerWorldX = (centerScreenX - camera.x) / camera.scale;
const centerWorldY = (centerScreenY - camera.y) / camera.scale;

// Size calculations based on viewport
const viewportWidthInWorld = viewportWidth / camera.scale;
const sizeWidthInPixels = viewportWidthInWorld * 0.4;
const calculatedWidth = Math.max(1, sizeWidthInPixels / gridSize);
```

### Priority 12: GridAlignmentWizard (~90 LOC)
**Source Location:** Lines 522-650 in DMMenu.tsx
**Complexity:** Medium (multi-step workflow, point capture)
**Features:**
- "Start Alignment" / "Cancel" / "Reset Points" buttons
- Point capture UI (click two corners of a map square)
- Auto-suggestion display when two points captured
- Collapsible when grid is locked

**Dependencies:**
- `alignmentModeActive` prop (boolean)
- `alignmentPoints` prop (array of AlignmentPoint)
- `alignmentSuggestion` prop (AlignmentSuggestion or null)
- `gridLocked` prop (boolean)
- `onAlignmentStart`, `onAlignmentCancel`, `onAlignmentReset` callbacks
- `onAlignmentApply` callback (when suggestion exists)
- `CollapsibleSection` component

---

## 🎼 Agent Orchestration Strategy

**CRITICAL:** Use agents as your orchestra. You are the conductor, not the musician.

### When to Use Agents

1. **Code Search & Analysis** → Use `Explore` agent (thoroughness: "quick" or "medium")
   ```
   Task: "Find all usages of mapTransform in DMMenu.tsx and related components"
   Agent: Explore (quick)
   Why: Faster than manual Grep, finds context you might miss
   ```

2. **Test Writing** → Use `general-purpose` agent
   ```
   Task: "Write characterization tests for MapTransformControl component at lines 355-511 of DMMenu.tsx. Follow the pattern in NPCEditor.test.tsx. Use fireEvent, not userEvent."
   Agent: general-purpose
   Why: Tests are repetitive, agents excel at patterns
   ```

3. **Component Extraction** → Use `general-purpose` agent (after tests exist)
   ```
   Task: "Extract MapTransformControl component from DMMenu.tsx lines 355-511 to new file apps/client/src/features/dm/components/map-controls/MapTransformControl.tsx"
   Agent: general-purpose
   Why: Mechanical copy-paste with import updates
   ```

4. **Parallel Work** → Launch multiple agents in SINGLE message
   ```typescript
   // ONE message with THREE tool calls:
   Task("Write MapTransformControl tests", ...)
   Task("Write StagingZoneControl tests", ...)
   Task("Write GridAlignmentWizard tests", ...)
   ```

### Agent Best Practices

✅ **DO:**
- Launch agents in parallel when tasks are independent
- Give agents complete context (file paths, line numbers, examples)
- Trust agent outputs (they're usually correct)
- Use agents for repetitive work (tests, extractions, refactors)
- Specify exact patterns to follow (reference files)

❌ **DON'T:**
- Read files yourself when agents can do it
- Write tests yourself when agents can write them
- Do manual search when Explore agent is available
- Launch agents sequentially when parallel is possible
- Micromanage agent outputs (review, don't rewrite)

---

## 📖 Extraction Pattern (Proven from Phases 2-3)

Follow this 4-step pattern for each component:

### Step 1: Write Characterization Tests
**File:** `apps/client/src/features/dm/components/__tests__/characterization/[ComponentName].test.tsx`

**Pattern to Follow:** See `NPCEditor.test.tsx` or `PropEditor.test.tsx`

**Key Requirements:**
- Use `fireEvent`, NOT `userEvent` (not available in codebase)
- Use accessible queries: `getByLabelText`, `getByRole`, `getByText`
- NO `data-testid` attributes needed
- Cover all user interactions (input changes, button clicks, prop updates)
- Capture edge cases (validation, clamping, trimming)

**Agent Prompt Example:**
```
Write comprehensive characterization tests for MapTransformControl component.

SOURCE: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx lines 355-511

PATTERN: Follow the testing style in /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx

REQUIREMENTS:
- Use fireEvent (NOT userEvent)
- Use accessible queries (getByLabelText, getByRole)
- Test all sliders, inputs, buttons, and state changes
- Test lock/unlock toggle behavior
- Test prop updates when mapTransform changes

SAVE TO: /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/MapTransformControl.test.tsx
```

### Step 2: Extract Component File
**Agent Prompt Example:**
```
Extract MapTransformControl component from DMMenu.tsx to a new file.

SOURCE: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx lines 355-511
TARGET: /home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/MapTransformControl.tsx

INTERFACE: Extract MapTransformControlProps from DMMenuProps
IMPORTS: Ensure JRPGPanel, JRPGButton, CollapsibleSection are imported

Add comprehensive JSDoc comments documenting the component's purpose and props.
```

### Step 3: Update Tests
**Changes:**
1. Remove inline component from test file
2. Add import: `import { MapTransformControl } from "../../map-controls/MapTransformControl";`
3. Run tests: `pnpm test:client -- MapTransformControl.test.tsx`

### Step 4: Integrate into DMMenu.tsx
**Changes:**
1. Add import: `import { MapTransformControl } from "./map-controls/MapTransformControl";`
2. Remove inline component code (lines 355-511)
3. Replace with: `<MapTransformControl mapTransform={mapTransform} mapLocked={mapLocked} ... />`
4. Run full test suite: `pnpm test:client -- DMMenu`
5. Run linting: `pnpm lint` and `pnpm format` if needed

### Step 5: Commit
**Commit Message Template:**
```
refactor: extract MapTransformControl from DMMenu.tsx

Extract map transform controls into standalone component.

**Component Created:**
- apps/client/src/features/dm/components/map-controls/MapTransformControl.tsx (XXX LOC)
  - Interface: MapTransformControlProps
  - Features: scale, position, rotation controls with lock toggle

**Tests Created:**
- XX comprehensive tests covering all interactions
- Uses accessible queries (getByLabelText, getByRole)

**DMMenu.tsx Changes:**
- Added MapTransformControl import
- Removed inline component (lines 355-511, ~160 LOC)

**Impact:**
- DMMenu.tsx reduced by ~160 LOC
- All tests passing

Part of Phase 4: Complex Map Controls
See: docs/refactoring/REFACTOR_ROADMAP.md DMMenu Phase 4

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🗺️ File Locations Reference

### Current DMMenu.tsx
- **Path:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx`
- **Current LOC:** 1,022
- **Target LOC (after Phase 4):** ~592

### Phase 4 Target Files
- **MapTransformControl:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/MapTransformControl.tsx`
- **StagingZoneControl:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/StagingZoneControl.tsx`
- **GridAlignmentWizard:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/GridAlignmentWizard.tsx`

### Test Files
- **MapTransformControl Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/MapTransformControl.test.tsx`
- **StagingZoneControl Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/StagingZoneControl.test.tsx`
- **GridAlignmentWizard Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/GridAlignmentWizard.test.tsx`

### Reference Files (Patterns to Follow)
- **NPCEditor:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/NPCEditor.tsx`
- **NPCEditor Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx`
- **GridControl:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/GridControl.tsx`

### Documentation
- **Roadmap:** `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_ROADMAP.md`
- **Playbook:** `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_PLAYBOOK.md`
- **Phase 2 Handoff:** `/home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE2_HANDOFF.md`
- **Phase 3 Completion:** `/home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE2_COMPLETION.md`

---

## 🛠️ Commands Reference

### Testing
```bash
# Run specific component tests
pnpm test:client -- MapTransformControl.test.tsx

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
- Pattern: `fireEvent.change()`, `fireEvent.blur()`, `fireEvent.click()`
- Example from NPCEditor.test.tsx:
  ```typescript
  fireEvent.change(getByLabelText("Name"), { target: { value: "Goblin King" } });
  fireEvent.blur(getByLabelText("Name"));
  ```

### 2. Accessible Queries Only
- Use `getByLabelText("Label Text")` for inputs
- Use `getByRole("button", { name: /button text/i })` for buttons
- Use `getByText()` for text content
- **NO `data-testid` attributes needed** - components use JRPGPanel which provides semantic HTML

### 3. Mathematical Logic Preservation
- **StagingZoneControl** has complex viewport calculations
- **DO NOT modify the math** - copy exactly as-is
- The calculations are already tested in production
- Focus on extraction, not improvement

### 4. State Management
- **MapTransformControl:** Local state for real-time updates, commits on blur/change
- **StagingZoneControl:** Local state `stagingInputs` for form fields
- **GridAlignmentWizard:** Read-only, all state managed by parent

### 5. PropTypes to Extract
Review DMMenuProps interface to identify which props belong to each control:

**MapTransformControl:**
- `mapTransform`, `mapLocked`, `onMapTransformChange`, `onMapLockToggle`

**StagingZoneControl:**
- `playerStagingZone`, `camera`, `gridSize`, `onSetPlayerStagingZone`

**GridAlignmentWizard:**
- `alignmentModeActive`, `alignmentPoints`, `alignmentSuggestion`, `gridLocked`
- `onAlignmentStart`, `onAlignmentCancel`, `onAlignmentReset`, `onAlignmentApply`

---

## 🚀 Quick Start Prompt for Next Orchestrator

Use this prompt to start Phase 4:

```
I'm continuing the DMMenu.tsx Phase 4 refactoring. Read the handoff document at /home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE4_HANDOFF.md to understand the current state.

Current status:
- DMMenu.tsx is at 1,022 LOC (down from 1,588)
- Phases 2-3 complete (entity editors and simple controls extracted)
- Branch: refactor/dm-menu/stateful-tabs

Phase 4 goal: Extract 3 complex map controls (~430 LOC reduction)
1. MapTransformControl (Priority 10, ~160 LOC)
2. StagingZoneControl (Priority 11, ~180 LOC)
3. GridAlignmentWizard (Priority 12, ~90 LOC)

IMPORTANT: Use agents effectively to minimize your context usage:
- Use Explore agent for code searches
- Use general-purpose agents to write tests (follow NPCEditor.test.tsx pattern)
- Use general-purpose agents to extract components
- Launch agents in parallel when possible

Follow the proven 4-step extraction pattern from Phases 2-3:
1. Write characterization tests (use agent)
2. Extract component file (use agent)
3. Update tests to import extracted component
4. Integrate into DMMenu.tsx and commit

Start with MapTransformControl (Priority 10). Use agents to write comprehensive characterization tests following the NPCEditor.test.tsx pattern, then extract the component.
```

---

## 📊 Phase 4 Success Metrics

### Quantitative
- [ ] MapTransformControl extracted (~160 LOC)
- [ ] StagingZoneControl extracted (~180 LOC)
- [ ] GridAlignmentWizard extracted (~90 LOC)
- [ ] Total reduction: ~430 LOC
- [ ] DMMenu.tsx target: ~592 LOC (down from 1,022)
- [ ] All tests passing (current 55 + new tests)
- [ ] Zero linting errors
- [ ] TypeScript compilation clean

### Qualitative
- [ ] No behavioral changes to DMMenu
- [ ] Each control independently testable
- [ ] Mathematical logic preserved exactly
- [ ] Components follow established patterns
- [ ] Clear separation of concerns
- [ ] Props interfaces are minimal and focused

---

## 🎯 Phase 4 Expected Outcome

**After completing Phase 4:**
- DMMenu.tsx: 1,022 → ~592 LOC (42% reduction in Phase 4)
- Cumulative: 1,588 → ~592 LOC (63% total reduction)
- New components: 6 total (NPCEditor, PropEditor, 3 simple controls, 3 complex controls)
- Test coverage: 55+ → 100+ tests
- Ready for Phase 5: Session Controls

**Remaining after Phase 4:**
- Phase 5: Session Controls (~140 LOC)
- Phase 6: Tab Views (composition)
- Final target: 350 LOC

---

## 💡 Pro Tips from Phases 2-3

1. **Trust the agents** - They wrote all Phase 2-3 tests flawlessly
2. **Parallel is faster** - Launch 3 test-writing agents simultaneously
3. **Reference files work** - Always point agents to NPCEditor.test.tsx
4. **Accessible queries win** - No testid setup needed, just works
5. **Commit frequently** - One commit per component keeps history clean
6. **Math is sacred** - Don't "improve" calculations during extraction
7. **Tests first, always** - Characterization tests catch everything
8. **Agents + human review** - Best combo for speed and quality

---

**Last Updated:** 2025-10-21
**Prepared By:** Claude (Phase 15 Refactoring Initiative)
**Branch:** `refactor/dm-menu/stateful-tabs`
**Next Phase:** Phase 4 - Complex Map Controls
**Ready to Begin:** Yes ✅
