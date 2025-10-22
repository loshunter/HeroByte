# DMMenu.tsx Phase 4 Final Handoff - GridAlignmentWizard Extraction

**Status:** 2 of 3 Phase 4 components complete. One component remaining.

**Branch:** `refactor/dm-menu/stateful-tabs`

**Current State:** DMMenu.tsx is at **622 LOC** (down from 1,588 LOC originally)

---

## What's Been Done (Phase 4 Progress)

### ✅ Completed Extractions:

1. **MapTransformControl** (Priority 10)
   - Component: `/apps/client/src/features/dm/components/map-controls/MapTransformControl.tsx` (216 LOC)
   - Tests: 47 comprehensive tests
   - Commit: `df0da26`
   - Reduction: 148 LOC

2. **StagingZoneControl** (Priority 11)
   - Component: `/apps/client/src/features/dm/components/map-controls/StagingZoneControl.tsx` (350 LOC)
   - Tests: 36 comprehensive tests
   - Commit: `0fd6dc0`
   - Reduction: 252 LOC

**Total Phase 4 Progress:** 400 LOC reduced, 83 tests created

---

## What Remains: GridAlignmentWizard (Priority 12)

### Component Overview

**Source Location:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx`

**Approximate Lines:** Search for "Grid Alignment" or "gridAlignment" - estimated ~90-120 LOC

**Target Location:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/GridAlignmentWizard.tsx`

**Component Purpose:** Manages grid alignment controls for the map, allowing the DM to adjust grid size and positioning to align with map backgrounds.

### Expected Features to Extract:

Based on the pattern, GridAlignmentWizard likely includes:
- Grid size input controls
- Grid offset X/Y controls
- Possibly alignment helper buttons/tools
- State management for grid settings
- Integration with map display

**IMPORTANT:** Before starting extraction, search DMMenu.tsx to locate the exact code. Look for:
- "Grid Alignment" in JSX/UI
- `gridAlignment`, `gridSize`, `gridOffset` state or props
- Grid-related handlers or functions

---

## Proven 4-Step Extraction Pattern

Follow this exact pattern used for MapTransformControl and StagingZoneControl:

### Step 1: Write Characterization Tests
- **Use a general-purpose agent** to write comprehensive tests
- **Pattern to follow:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx`
- **Output location:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/GridAlignmentWizard.test.tsx`

**Critical Requirements:**
- Use `fireEvent` (NOT `userEvent` - not available in codebase)
- Use accessible queries: `getByLabelText`, `getByRole`, `getByText`
- NO `data-testid` attributes needed
- Create inline stub component initially (will be replaced in Step 3)
- Test all interactions, edge cases, and prop updates

### Step 2: Extract Component
- **Use a general-purpose agent** to extract the component
- **Patterns to follow:**
  - `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/MapTransformControl.tsx`
  - `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/StagingZoneControl.tsx`
- **Output location:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/GridAlignmentWizard.tsx`

**Critical Requirements:**
- Comprehensive JSDoc comments
- Named export: `export function GridAlignmentWizard(...)`
- Preserve ALL logic exactly as-is
- Extract any local state and handlers the component needs
- Use proper TypeScript types for all props
- Import UI components from correct paths

### Step 3: Update Tests to Import Extracted Component
- **Use a general-purpose agent** to update tests
- Remove all inline stub components
- Add import: `import { GridAlignmentWizard } from "../../map-controls/GridAlignmentWizard";`
- Run tests to verify all pass

### Step 4: Integrate and Commit
- Verify DMMenu.tsx imports and uses the new component
- Run all tests: `pnpm test:client -- GridAlignmentWizard`
- Run all DMMenu tests: `pnpm test:client -- DMMenu`
- Format: `pnpm format`
- Lint: `pnpm lint`
- Commit with detailed message following the pattern

---

## Key Files and Patterns Reference

### Test Pattern Examples:
- `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx`
- `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/MapTransformControl.test.tsx`
- `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/StagingZoneControl.test.tsx`

### Component Pattern Examples:
- `/home/loshunter/HeroByte/apps/client/src/features/dm/components/NPCEditor.tsx`
- `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/MapTransformControl.tsx`
- `/home/loshunter/HeroByte/apps/client/src/features/dm/components/map-controls/StagingZoneControl.tsx`

### Source File:
- `/home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx` (currently 622 LOC)

### Previous Handoff Document (for context):
- `/home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE4_HANDOFF.md`

---

## Critical Instructions for Efficient Execution

### Use Agents Effectively (Minimize Context Usage!)

**IMPORTANT:** Launch agents in PARALLEL when possible. Use a single message with multiple Task calls.

#### Step 1 & 2 in Parallel:
```
# Launch BOTH agents at once:
1. Task(general-purpose, "Write GridAlignmentWizard characterization tests")
2. Task(general-purpose, "Extract GridAlignmentWizard component")

# This saves time and context!
```

#### Step 3:
```
# After Step 1 & 2 complete:
Task(general-purpose, "Update GridAlignmentWizard tests to import extracted component")
```

### Agent Prompt Structure

When launching agents, provide:
1. **Clear task description**
2. **Source file location and line numbers** (if known)
3. **Pattern files to follow** (NPCEditor.test.tsx, MapTransformControl.tsx, etc.)
4. **Output file path**
5. **Critical requirements** (fireEvent, accessible queries, JSDoc, etc.)
6. **Any component-specific behavior** discovered from reading DMMenu.tsx

### Example Agent Prompt Template

```
Write comprehensive characterization tests for the GridAlignmentWizard component.

**SOURCE CODE:** /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx lines [FIND_THESE]

**PATTERN TO FOLLOW:** /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx

**CRITICAL REQUIREMENTS:**
1. Use `fireEvent` (NOT `userEvent`)
2. Use accessible queries: `getByLabelText`, `getByRole`, `getByText`
3. NO `data-testid` attributes
4. Follow exact NPCEditor.test.tsx structure

**COMPONENT BEHAVIOR TO TEST:**
[Describe the component features after reading DMMenu.tsx]

**OUTPUT FILE:** /home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/GridAlignmentWizard.test.tsx

Write comprehensive tests covering all interactions and edge cases.
```

---

## Testing Requirements

### Test Coverage Needed:
- Initial rendering with various prop states
- All input field interactions
- Button click handlers
- Props update synchronization
- Edge cases (invalid values, boundaries)
- Component-specific logic

### Test Commands:
```bash
# Run GridAlignmentWizard tests
pnpm test:client -- GridAlignmentWizard

# Run all DMMenu tests
pnpm test:client -- DMMenu

# Format code
pnpm format

# Lint
pnpm lint

# Typecheck (if available)
pnpm --filter herobyte-client typecheck
```

---

## Commit Message Pattern

Follow this pattern (from previous commits):

```
refactor: extract GridAlignmentWizard from DMMenu.tsx

Extract grid alignment controls into standalone component.

**Component Created:**
- apps/client/src/features/dm/components/map-controls/GridAlignmentWizard.tsx ([X] LOC)
  - Interface: GridAlignmentWizardProps
  - Features: [list key features]
  - [Any special logic notes]

**Tests Created:**
- [N] comprehensive tests covering all interactions
- Uses fireEvent and accessible queries (getByLabelText, getByRole)
- Tests [list key test areas]

**DMMenu.tsx Changes:**
- Added GridAlignmentWizard import
- Removed [describe removed code]
- Replaced with <GridAlignmentWizard> component usage

**Impact:**
- DMMenu.tsx reduced: 622 → ~[X] LOC (~[Y] LOC reduction)
- Cumulative: 1,588 → ~[X] LOC ([Z] LOC / [%] reduction)
- All [N] tests passing
- All linting passing
- TypeScript compilation clean

Part of Phase 4: Complex Map Controls (Priority 12 - FINAL)
See: docs/refactoring/DMMENU_PHASE4_FINAL_HANDOFF.md

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Expected Final Results

### After GridAlignmentWizard Extraction:

**DMMenu.tsx:**
- Estimated: ~530 LOC
- Total reduction: ~1,058 LOC (67% from original 1,588)

**Phase 4 Complete:**
- 3 components extracted (MapTransformControl, StagingZoneControl, GridAlignmentWizard)
- ~500 LOC total reduction in Phase 4
- ~100+ tests created
- All functionality preserved

### Directory Structure After Completion:
```
apps/client/src/features/dm/components/map-controls/
├── DrawingControls.tsx
├── GridControl.tsx
├── MapBackgroundControl.tsx
├── MapTransformControl.tsx        ← Phase 4, Priority 10
├── StagingZoneControl.tsx         ← Phase 4, Priority 11
└── GridAlignmentWizard.tsx        ← Phase 4, Priority 12 (TO BE CREATED)
```

---

## Troubleshooting

### If GridAlignmentWizard Code is Hard to Find:
```bash
# Search for grid-related code
cd /home/loshunter/HeroByte
grep -n "Grid Alignment" apps/client/src/features/dm/components/DMMenu.tsx
grep -n "gridAlignment" apps/client/src/features/dm/components/DMMenu.tsx
grep -n "gridSize" apps/client/src/features/dm/components/DMMenu.tsx
grep -n "gridOffset" apps/client/src/features/dm/components/DMMenu.tsx
```

Use the Grep tool or Explore agent to find the relevant code sections.

### If Tests Fail After Extraction:
1. Check that all props are correctly typed
2. Verify all handlers are passed correctly
3. Ensure state management is properly extracted
4. Compare against MapTransformControl.tsx and StagingZoneControl.tsx patterns
5. Check that aria-label attributes match test queries

### If Linting Fails:
```bash
# Auto-fix formatting
pnpm format

# Then check linting again
pnpm lint
```

---

## Copy-Paste Starting Prompt

Use this to start the extraction after context clearing:

```
I'm continuing the DMMenu.tsx Phase 4 refactoring. Read the handoff document at /home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE4_FINAL_HANDOFF.md to understand the current state.

Current status:
- DMMenu.tsx is at 622 LOC (down from 1,588)
- 2 of 3 Phase 4 components extracted (MapTransformControl, StagingZoneControl)
- Branch: refactor/dm-menu/stateful-tabs
- 966 LOC reduced so far (61%)

Phase 4 final task: Extract GridAlignmentWizard (Priority 12, ~90-120 LOC)

CRITICAL: Use agents effectively to minimize your context usage:
- Use Explore agent to find the GridAlignmentWizard code in DMMenu.tsx
- Use general-purpose agents to write tests (follow NPCEditor.test.tsx pattern)
- Use general-purpose agents to extract component
- Launch agents in PARALLEL when possible (single message, multiple Task calls)

Follow the proven 4-step extraction pattern from the handoff document:
1. Write characterization tests (use agent)
2. Extract component file (use agent)
3. Update tests to import extracted component (use agent)
4. Integrate into DMMenu.tsx and commit

Start by using an Explore agent to locate the GridAlignmentWizard code in DMMenu.tsx. Search for "Grid Alignment", "gridAlignment", "gridSize", or related terms. Once found, proceed with the 4-step pattern.

Remember: Use fireEvent (NOT userEvent), use accessible queries (getByLabelText, getByRole), and preserve all logic exactly as-is.
```

---

## Success Criteria

Phase 4 is complete when:

✅ GridAlignmentWizard component created in `map-controls/` directory
✅ Comprehensive tests written and passing
✅ DMMenu.tsx imports and uses the new component
✅ All tests passing (`pnpm test:client -- DMMenu` and `pnpm test:client -- GridAlignmentWizard`)
✅ Linting passing (`pnpm lint`)
✅ Code formatted (`pnpm format`)
✅ Changes committed with detailed message
✅ DMMenu.tsx reduced to ~530 LOC

---

**Next Phase After Completion:** Phase 5 (priorities 13-20) will continue with additional DMMenu decomposition. See the original DMMENU_PHASE4_HANDOFF.md for the full roadmap.

Good luck! 🚀
