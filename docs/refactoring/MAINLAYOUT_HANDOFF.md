# MainLayout Decomposition - Handoff to Next Orchestrator

**Date:** 2025-10-21
**From:** Refactoring Team Manager (Orchestrator Instance #2)
**To:** Next Refactoring Team Manager (Orchestrator Instance #3)
**Branch:** `refactor/main-layout/decompose`
**Status:** 3 of 4 Extractions Complete ✅

---

## Executive Summary

**What's Done:**
- ✅ **Extraction 1: TopPanelLayout** - 171 LOC component, 46 tests passing
- ✅ **Extraction 2: CenterCanvasLayout** - 241 LOC component, 70 tests passing
- ✅ **Extraction 3: FloatingPanelsLayout** - 299 LOC component, 113 tests passing
- ✅ MainLayout.tsx reduced: 795 → 715 LOC (-80 LOC, 10.1%)
- ✅ Decision log updated in real-time throughout all 3 extractions
- ✅ All commits clean with clear messages

**What's Next:**
- ⏳ **Extraction 4: BottomPanelLayout** (~40-50 LOC target, MOST COMPLEX)
- ⏳ Final integration and cleanup to reach <200 LOC target
- ⏳ Process improvements (CI, baseline, documentation)

**Target:** Reduce MainLayout from 795 → <200 LOC (need 515 more LOC reduction, 72%)

**Current Progress:** 80 LOC reduced (10.1% of total, 14% of goal)

---

## What Was Completed

### Extraction 1: TopPanelLayout (✅ Complete)

**Extracted From:** MainLayout.tsx lines 544-574
**Components:** ServerStatus, DrawingToolbar, Header, MultiSelectToolbar

**Results:**
- **Component File:** `/home/loshunter/HeroByte/apps/client/src/layouts/TopPanelLayout.tsx`
  - Total LOC: 171 (under 350 target ✅)
  - Props interface: 59 LOC (under 80 target ✅)
  - Props count: 22 across 8 semantic groups
- **Test File:** `/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/TopPanelLayout.characterization.test.tsx`
  - Test count: 46 tests, all passing ✅
  - Test LOC: ~1,000 lines
  - Execution time: ~205ms
- **MainLayout Reduction:** 795 → 785 LOC (-10 LOC)

### Extraction 2: CenterCanvasLayout (✅ Complete)

**Extracted From:** MainLayout.tsx lines 566-605
**Components:** MapBoard (with dynamic positioning wrapper)

**Results:**
- **Component File:** `/home/loshunter/HeroByte/apps/client/src/layouts/CenterCanvasLayout.tsx`
  - Total LOC: 241 (under 350 target ✅)
  - Props interface: 78 LOC (under 80 target ✅)
  - Props count: 26 across 9 semantic groups
- **Test File:** `/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/CenterCanvasLayout.characterization.test.tsx`
  - Test count: 70 tests, all passing ✅
  - Test LOC: ~1,357 lines
  - Coverage: Wrapper positioning, MapBoard props, spread operator, edge cases
- **MainLayout Reduction:** 785 → 777 LOC (-8 LOC)

### Extraction 3: FloatingPanelsLayout (✅ Complete)

**Extracted From:** MainLayout.tsx lines 663-774
**Components:** DMMenu, ContextMenu, VisualEffects, DiceRoller (x2), RollLog, ToastContainer

**Results:**
- **Component File:** `/home/loshunter/HeroByte/apps/client/src/layouts/FloatingPanelsLayout.tsx`
  - Total LOC: 299 (under 350 target ✅)
  - Props interface: 72 LOC (under 80 target ✅)
  - Props count: 52 across 13 semantic groups
- **Test File:** `/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/FloatingPanelsLayout.characterization.test.tsx`
  - Test count: 113 tests, all passing ✅
  - Test LOC: ~2,376 lines
  - Execution time: ~1,628ms
  - Coverage: DMMenu (43), ContextMenu (5), VisualEffects (4), DiceRoller (8), RollLog (11), DiceRoller viewing (12), ToastContainer (4), Hierarchy (2), Edge cases (24)
- **MainLayout Reduction:** 777 → 715 LOC (-62 LOC)

**Key Decisions:**
- Used flat props interface with semantic grouping (NOT nested objects)
- Kept complex pre-existing types as objects (toast, camera, snapshot)
- Made type corrections for several handler signatures
- Preserved inline handlers and passed as props
- Maintained conditional rendering patterns (diceRollerOpen, rollLogOpen, viewingRoll)
- Extracted wrapper divs with fixed positioning styling

**Cumulative Progress:**
- Total reduction: 795 → 715 LOC (-80 LOC, 10.1%)
- Total tests created: 229 (46 + 70 + 113), all passing
- Extractions complete: 3 of 4
- Remaining target: 515 LOC reduction needed (72%)

---

## Current State of MainLayout.tsx

**Current LOC:** 715 (after 3 extractions)
**Target LOC:** <200
**Remaining Reduction Needed:** 515 LOC (72%)

**Current Structure (lines approximate after 3 extractions):**

```typescript
export const MainLayout = React.memo(function MainLayout(props: MainLayoutProps) {
  // ... state declarations, hooks, handlers (lines 1-540) ...

  return (
    <div onClick={() => setContextMenu(null)} style={{ height: "100vh", overflow: "hidden" }}>

      {/* ✅ EXTRACTED: TopPanelLayout (Extraction 1) */}
      <TopPanelLayout
        isConnected={isConnected}
        drawMode={drawMode}
        // ... 22 props
      />

      {/* ✅ EXTRACTED: CenterCanvasLayout (Extraction 2) */}
      <CenterCanvasLayout
        topHeight={topHeight}
        bottomHeight={bottomHeight}
        // ... 26 props
      />

      {/* ⏳ TO EXTRACT: BottomPanelLayout (Extraction 4) - Lines ~616-679 */}
      <div
        ref={bottomPanelRef}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <EntitiesPanel
          // ... 30+ props including inline HP editing callbacks
        />
      </div>

      {/* ✅ EXTRACTED: FloatingPanelsLayout (Extraction 3) */}
      <FloatingPanelsLayout
        isDM={isDM}
        contextMenu={contextMenu}
        // ... 52 props
      />
    </div>
  );
});
```

---

## Next Task: Extraction 4 - BottomPanelLayout (MOST COMPLEX)

### Overview

**Source Lines:** MainLayout.tsx ~616-679 (current numbering)
**Target Component LOC:** ~40-50 lines (small extraction - just wrapper + EntitiesPanel)
**Target Props:** ~30-35 props
**Complexity:** **HIGHEST** - Inline HP editing callbacks
**Estimated Time:** 1-2 days

### Components to Extract

1. **Fixed-position wrapper div** with bottomPanelRef (lines ~616-623)
2. **EntitiesPanel** component (lines ~624-678)

### Expected Props Breakdown

Analyze these prop categories:
1. **Layout & Ref** (~2 props): `bottomPanelRef`, `bottomHeight`
2. **Core Data** (~5 props): `snapshot`, `isDM`, `uid`, player/character data
3. **Selection** (~3 props): `selectedObjectIds`, selection handlers
4. **HP Editing Callbacks** (~8-10 props): Character/NPC HP editing (INLINE FUNCTIONS - complex!)
5. **Entity Actions** (~8-10 props): Delete, lock, unlock, recolor handlers
6. **UI State** (~3-5 props): Panel state, toggles

**Total Estimated:** 29-35 props

### Special Considerations - CRITICAL

⚠️ **HP Editing Callbacks (Lines 646-663 in original):**
- **Inline character HP editing:** `onHpEdit={(characterId, newHp) => { ... }}`
- **Inline NPC HP editing:** `onNpcHpEdit={(npcId, newHp) => { ... }}`
- These are complex inline functions that dispatch WebSocket messages
- **Decision Required:** Extract these to named handlers in MainLayout or keep inline?
- **Pattern:** Likely need to create `handleCharacterHpEdit` and `handleNpcHpEdit` in MainLayout

⚠️ **BottomPanelRef:**
- Used for layout measurement (bottomHeight calculation)
- Must be passed through to wrapper div
- Don't break the ref chain

⚠️ **Fixed Positioning:**
- Wrapper div has inline styles for fixed positioning
- Must preserve exact styling in extracted component

---

## The Proven Workflow (Follow This Pattern for Extraction 4)

You must follow this exact 4-step pattern:

### Step 1: Analysis Phase (Explore Agent)

**Launch Explore agent with this prompt:**

```
Analyze MainLayout.tsx lines ~616-679 to identify all props needed for BottomPanelLayout extraction.

This section contains:
- Fixed-position wrapper div with bottomPanelRef
- EntitiesPanel component

For EntitiesPanel, identify:
1. All props passed to it
2. Any inline functions (especially HP editing callbacks on lines ~646-663)
3. Any conditional rendering logic
4. Layout wrapper props (ref, styling)

Focus special attention on:
- HP editing callbacks for characters and NPCs
- Whether these should be extracted to MainLayout handlers
- bottomPanelRef usage

Organize findings by prop category.
Report estimated:
- Total prop count
- Inline function count and complexity
- Recommended approach for HP editing handlers
- Estimated extracted LOC
```

**Expected Output:**
- Comprehensive prop list (29-35 props)
- Organized by semantic category
- HP editing callback analysis with recommendation
- No missed props or inline functions

### Step 2: Interface Design Phase (Manager - YOU)

After receiving Explore agent findings, YOU (the manager) design the props interface:

**Decision to make:**
1. **HP Editing Handlers:** Should they be extracted to named functions in MainLayout or kept inline?
   - **Recommendation:** Extract to `handleCharacterHpEdit` and `handleNpcHpEdit` in MainLayout
   - **Rationale:** Cleaner interface, easier to test, follows pattern from other extractions

2. **Props Interface:**
   - Use flat props interface with semantic grouping (established pattern)
   - Group props by: Layout, Core Data, Selection, HP Editing, Entity Actions, UI State
   - Document each prop with JSDoc comments
   - Verify total props <40, interface LOC <80

**Update Decision Log:**
- Document props breakdown
- Explain HP editing handler decision
- Record interface design decisions

### Step 3: Characterization Tests Phase (General-Purpose Agent)

**Launch General-purpose agent with this prompt:**

```
Create comprehensive characterization tests for BottomPanelLayout extraction.

Component to test: BottomPanelLayout
Props interface: [paste the designed interface]

The component renders:
1. Fixed-position wrapper div with bottomPanelRef (verify ref, positioning styles)
2. EntitiesPanel with 30+ props

Create tests covering:
1. Wrapper div renders with correct ref and fixed positioning styles
2. EntitiesPanel renders with all props passed correctly
3. HP editing callbacks work correctly (character and NPC)
4. Selection handlers (onSelectObject, onSelectObjects)
5. Entity action handlers (delete, lock, unlock, recolor)
6. Edge cases (null snapshot, empty arrays, extreme numbers)
7. All props passed to EntitiesPanel

Mock EntitiesPanel for isolation.
Use data-attributes for prop verification.
Target: 40-60 tests with comprehensive coverage.

File: /home/loshunter/HeroByte/apps/client/src/layouts/__tests__/BottomPanelLayout.characterization.test.tsx
```

**Verify:**
- All tests passing ✅
- Coverage includes HP editing callbacks
- Edge cases tested
- Execution time reasonable (<500ms)

### Step 4: Component Creation & Integration Phase (General-Purpose Agent)

**Launch General-purpose agent with this prompt:**

```
Create the BottomPanelLayout component and integrate it into MainLayout.

Props interface: [paste the designed interface]
Target file: /home/loshunter/HeroByte/apps/client/src/layouts/BottomPanelLayout.tsx

Requirements:
1. Extract JSX from MainLayout.tsx lines ~616-679 (bottom panel section)
2. Create component with:
   - File-level JSDoc documentation
   - Props interface with JSDoc for each prop
   - React.memo for performance
   - displayName set
3. Extract wrapper div with:
   - bottomPanelRef prop
   - Fixed positioning styles (position: fixed, bottom: 0, left: 0, right: 0, zIndex: 10)
4. Extract EntitiesPanel with all props
5. Verify component LOC <350, props interface LOC <80
6. Run characterization tests - must all pass
7. Integrate into MainLayout:
   - Add BottomPanelLayout import
   - Remove EntitiesPanel import
   - Replace extracted JSX with <BottomPanelLayout {...props} />
   - If HP editing handlers extracted, add them to MainLayout before JSX
8. Verify TypeScript compilation passes
9. Verify all characterization tests pass after integration
```

**Verify:**
- Component created successfully
- All tests passing after integration
- TypeScript compilation successful
- MainLayout LOC reduced by ~40-50 lines

---

## Critical Files Reference

### Documentation Files (Read These First)

1. **`/home/loshunter/HeroByte/docs/refactoring/MAINLAYOUT_REFACTOR_BRIEF.md`**
   - Original comprehensive refactoring brief (698 lines)
   - Contains overall strategy, best practices, emergency procedures

2. **`/home/loshunter/HeroByte/docs/refactoring/MAINLAYOUT_DECISIONS.md`**
   - Real-time decision log with all rationale
   - Updated after each phase of Extractions 1-3
   - Contains findings and patterns (reference these!)
   - **Read Extraction 3 section** to understand FloatingPanelsLayout patterns

3. **`/home/loshunter/HeroByte/docs/refactoring/BRANCHING_STRATEGY.md`**
   - Git workflow for refactoring branches
   - Commit message conventions

### Source Files

1. **`/home/loshunter/HeroByte/apps/client/src/layouts/MainLayout.tsx`**
   - Current state: 715 LOC
   - DO NOT hold full file in context - use Explore agents to analyze sections

2. **`/home/loshunter/HeroByte/apps/client/src/layouts/TopPanelLayout.tsx`**
   - Reference for established patterns (React.memo, JSDoc, flat props interface)

3. **`/home/loshunter/HeroByte/apps/client/src/layouts/CenterCanvasLayout.tsx`**
   - Reference for spread operator pattern, dynamic positioning

4. **`/home/loshunter/HeroByte/apps/client/src/layouts/FloatingPanelsLayout.tsx`**
   - Reference for high prop count (52 props), semantic grouping
   - Reference for type corrections and inline handler preservation

### Test Files (Reference for Patterns)

1. **`/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/TopPanelLayout.characterization.test.tsx`**
   - 46 tests, component mocking patterns, data-attribute verification

2. **`/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/CenterCanvasLayout.characterization.test.tsx`**
   - 70 tests, spread operator testing, edge case patterns

3. **`/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/FloatingPanelsLayout.characterization.test.tsx`**
   - 113 tests, high prop count testing, conditional rendering, wrapper divs

---

## Key Decisions Made (Don't Change These)

These patterns were established in Extractions 1-3. **Continue using them:**

1. **Props Interface Style:**
   - ✅ Flat interface with semantic grouping comments
   - ❌ NOT nested objects or grouped props
   - **Rationale:** More explicit, better TypeScript autocomplete, easier debugging
   - **Exception:** Keep pre-existing complex types as objects (toast, camera, snapshot)

2. **Component Pattern:**
   - ✅ React.memo for all components
   - ✅ Comprehensive JSDoc (file, interface, component)
   - ✅ displayName set
   - ✅ Pure presentation (no internal state)

3. **Testing Strategy:**
   - ✅ Characterization tests BEFORE extraction
   - ✅ Mock all child components
   - ✅ Data-attribute based prop verification
   - ✅ Comprehensive edge case coverage
   - ✅ Tests must pass AFTER integration

4. **Agent Delegation:**
   - ✅ Explore agent (medium thoroughness) for analysis
   - ✅ General-purpose agent for tests and component creation
   - ✅ Manager for integration, verification, decision log updates

5. **Complex Props:**
   - ✅ Use spread operator for complex prop objects (e.g., drawingProps)
   - ✅ Extract inline handlers to named functions when complex
   - **Rationale:** Encapsulation, maintainability, follows existing patterns

6. **Type Corrections:**
   - ✅ Correct handler signatures based on actual usage in MainLayout
   - ✅ Make props optional if conditionally used
   - ✅ Update types to match MainLayout implementation

---

## Common Pitfalls to Avoid

Based on Extractions 1-3 experience:

1. **Don't Hold Full MainLayout in Context**
   - File is 715 LOC - too large
   - Use Explore agents to analyze specific line ranges
   - Synthesize findings without loading full file

2. **Don't Skip Characterization Tests**
   - Tests MUST be written before extraction
   - Tests MUST pass before and after integration
   - Tests are your safety net for behavior preservation

3. **Don't Guess at Prop Requirements**
   - Use Explore agent to identify ALL props
   - Cross-reference with component source files if needed
   - Missing props will cause TypeScript errors

4. **Don't Create Nested Prop Objects**
   - Flat interface is the established pattern
   - Semantic grouping via comments, not objects
   - Exception: spread operator for pre-existing complex types

5. **Don't Forget to Update Decision Log**
   - Update `/home/loshunter/HeroByte/docs/refactoring/MAINLAYOUT_DECISIONS.md` after each phase
   - Document analysis findings, design decisions, test results, integration steps

6. **Don't Skip TypeScript Verification**
   - Run typecheck after component creation: `cd apps/client && pnpm exec tsc --noEmit`
   - Run typecheck after integration
   - Catch type errors early

7. **Don't Overlook Inline Functions**
   - HP editing callbacks are complex inline functions
   - Decide whether to extract or keep inline
   - Document decision in decision log

---

## Success Criteria for Extraction 4

Before marking complete, verify:

- ✅ BottomPanelLayout component created
- ✅ Component total LOC <350
- ✅ Props interface LOC <80
- ✅ Props count 29-40 (reasonable range)
- ✅ All characterization tests passing (40-60 tests expected)
- ✅ TypeScript compilation passes
- ✅ MainLayout LOC reduced by ~40-50 lines
- ✅ Decision log updated with all findings and decisions
- ✅ Git commit with clear message following convention

**After Extraction 4, expected state:**
- MainLayout: ~665-675 LOC (from 715)
- 4 of 4 extractions complete
- ~120-130 LOC reduction total (15-16%)
- **Still ~465-475 LOC away from <200 target**

**IMPORTANT REALIZATION:**
After Extraction 4, MainLayout will still be ~665-675 LOC. The <200 LOC target requires **ADDITIONAL WORK** beyond the 4 planned extractions:
- State management extraction
- Hook consolidation
- Handler extraction
- Import cleanup

---

## After Extraction 4: Additional Work Required

**Extraction 4 will NOT achieve the <200 LOC target.** Here's what remains:

### Phase 2: Deep Refactoring (Estimated ~465-475 LOC reduction needed)

1. **State Management Extraction** (~100-150 LOC)
   - Extract state declarations to custom hooks
   - Group related state (UI state, entity state, tool state)
   - Create `useMainLayoutState` hook

2. **Handler Extraction** (~150-200 LOC)
   - Extract handler functions to custom hooks
   - Create `useEntityActions`, `useToolActions`, `useLayoutActions` hooks
   - Reduce MainLayout to orchestration only

3. **Hook Consolidation** (~50-100 LOC)
   - Review all useEffect, useMemo, useCallback hooks
   - Extract to custom hooks where appropriate
   - Reduce cognitive load in MainLayout

4. **Import Cleanup** (~20-30 LOC)
   - Remove unused imports after extractions
   - Consolidate type imports
   - Clean up dependencies

5. **Props Interface Simplification** (~20-30 LOC)
   - Review MainLayoutProps after all extractions
   - Group related props into objects where appropriate
   - Reduce prop spreading

**Estimated Timeline:**
- Extraction 4: 1-2 days
- Phase 2 Deep Refactoring: 3-5 days
- Total remaining: 4-7 days to <200 LOC target

---

## Quick Reference Commands

```bash
# Branch status
git status

# Run client tests
pnpm test -- <test-file-name>

# Run specific test file
pnpm test -- BottomPanelLayout.characterization.test.tsx

# TypeScript compilation check
cd apps/client && pnpm exec tsc --noEmit

# Measure LOC (use wc -l)
wc -l apps/client/src/layouts/MainLayout.tsx

# View decision log
cat docs/refactoring/MAINLAYOUT_DECISIONS.md

# Commit progress (after Extraction 4)
git add apps/client/src/layouts/BottomPanelLayout.tsx \
        apps/client/src/layouts/__tests__/BottomPanelLayout.characterization.test.tsx \
        apps/client/src/layouts/MainLayout.tsx \
        docs/refactoring/MAINLAYOUT_DECISIONS.md

git commit -m "refactor: complete Extraction 4 - BottomPanelLayout

Extract bottom panel section from MainLayout (lines ~616-679).

New component: BottomPanelLayout.tsx (XXX LOC)
- XX props across Y semantic groups
- Components: EntitiesPanel with HP editing
- Fixed positioning wrapper with bottomPanelRef

Tests: XX characterization tests, all passing
MainLayout reduced: 715 → XXX LOC (-XX LOC)

Cumulative: 795 → XXX LOC (-XXX LOC)
Extractions complete: 4 of 4

Part of Phase 15 SOLID Refactor Initiative
See: docs/refactoring/MAINLAYOUT_DECISIONS.md Extraction 4

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Environment Info

**Branch:** `refactor/main-layout/decompose`
**Working Directory:** `/home/loshunter/HeroByte`
**Package Manager:** pnpm
**Test Framework:** Vitest
**Current Date:** 2025-10-21

**Key File Locations:**
- Components: `/home/loshunter/HeroByte/apps/client/src/layouts/`
- Tests: `/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/`
- Docs: `/home/loshunter/HeroByte/docs/refactoring/`

**Current MainLayout State:** 715 LOC (after 3 extractions)

---

## Your First Actions

When you receive the orchestrator prompt, you should:

1. **Read this handoff document** (you're reading it now)

2. **Read the decision log** to understand what was done in Extractions 1-3:
   ```
   Read /home/loshunter/HeroByte/docs/refactoring/MAINLAYOUT_DECISIONS.md
   ```

3. **Check current MainLayout state** (use wc -l, don't read full file):
   ```bash
   wc -l /home/loshunter/HeroByte/apps/client/src/layouts/MainLayout.tsx
   ```
   Expected: 715 LOC

4. **Update todo list** with Extraction 4 tasks

5. **Launch Explore agent** for BottomPanelLayout analysis (see Step 1 in workflow above)

6. **Update decision log** with analysis findings

7. **Proceed through steps 2-4** following the proven workflow pattern

---

## Final Notes

**What You're Inheriting:**
- A working, tested codebase with 3 successful extractions complete
- Proven workflow patterns and agent delegation strategies
- Comprehensive documentation and decision rationale
- Clear path forward for Extraction 4
- **Realistic understanding** that <200 LOC requires work beyond the 4 extractions

**What's Expected of You:**
- Follow the established patterns (don't reinvent)
- Update decision log in real-time
- Verify quality at each step (tests, TypeScript, LOC targets)
- Ask for clarification if patterns are unclear
- Complete Extraction 4 using the proven workflow
- **Document findings** about additional work needed after Extraction 4

**Success Looks Like:**
- Extraction 4 complete in 1-2 days
- MainLayout reduced to ~665-675 LOC
- All tests passing (total ~270-290 tests)
- Clear documentation of Phase 2 requirements
- Ready to tackle deep refactoring work

**Critical Success Factor for Extraction 4:**
- **HP Editing Callbacks** must be handled correctly
- These are the most complex inline functions in MainLayout
- Decision to extract or keep inline will set precedent for Phase 2 work
- Document this decision thoroughly in the decision log

---

**Handoff Complete**

**Ready for:** Extraction 4 - BottomPanelLayout (MOST COMPLEX)
**Next Orchestrator:** Follow the workflow in this document
**Questions?** Review MAINLAYOUT_DECISIONS.md for context and patterns

**Good luck! 🚀**

---

**Last Updated:** 2025-10-21
**Prepared By:** Refactoring Team Manager (Orchestrator Instance #2)
**Extractions Complete:** 3 of 4 ✅
**Git Commit:** ea7f2a8 (Extraction 3: FloatingPanelsLayout)
