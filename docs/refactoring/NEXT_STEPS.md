# Next Steps: Starting Phase 15 Refactoring

**Date:** 2025-10-20
**Status:** Phase 1 COMPLETE - Ready for Phase 2
**Phase 1 Completed:** 2025-10-20
**Context:** Phase 15 SOLID Refactor Initiative - Phase 1 extraction complete

---

## For the Next Engineer/AI Instance

### Phase 1 Completion Summary

✅ **ALL 9 PRIORITIES EXTRACTED (100% Complete)**
- Total LOC Reduction: 547 lines (-29.6% from baseline)
- Original Goal: 350 LOC reduction
- Achievement: EXCEEDED goal by 197 LOC (156% of target)
- App.tsx: 1,850 LOC → 1,303 LOC estimated (-547 LOC net reduction)
- Status: All branches pushed, ready for PR review

### Completed Extractions (In Order)

1. ✅ **useLayoutMeasurement** (-14 LOC) - `refactor/app/use-layout-measurement`
2. ✅ **useToolMode** (-11 LOC) - `refactor/app/use-tool-mode`
3. ✅ **useCameraCommands** (-11 LOC) - `refactor/app/use-camera-commands`
4. ✅ **useE2ETestingSupport** (-20 LOC) - `refactor/app/use-e2e-testing-support`
5. ✅ **useSceneObjectSelectors** (-41 LOC) - `refactor/app/use-scene-object-selectors`
6. ✅ **VisualEffects** (-23 LOC) - `refactor/app/visual-effects`
7. ✅ **AuthenticationGate** (-337 LOC) - `refactor/app/authentication-gate`
8. ✅ **ContextMenu** (-22 LOC) - `refactor/app/context-menu`
9. ✅ **MultiSelectToolbar** (-68 LOC) - `refactor/app/multi-select-toolbar`

### What Was Completed (Infrastructure)

✅ **Analysis Phase Complete**
- Analyzed 3 god files (App.tsx, DMMenu.tsx, MapBoard.tsx)
- Identified 79 distinct responsibility clusters
- Created dependency-aware extraction order
- Estimated effort for all extractions

✅ **Infrastructure Established**
- CI guardrails active (fails on new >350 LOC files)
- Structure report enhanced with refactoring hints
- Baseline created (`scripts/structure-baseline.json`)
- Comprehensive documentation written

✅ **Planning Documents Created**
- Refactoring roadmap with 7 phases per file
- Step-by-step playbook template
- README with workflow and FAQ
- All docs in `/docs/refactoring/`

✅ **Phase 1 Execution Complete (9/9)**
- All extractions follow SOLID principles
- Characterization tests written for each module
- All tests passing on each branch
- Documentation updated per extraction
- Clean git history with atomic commits

---

## Where to Find Context

### Essential Reading (Read These First)

1. **[docs/refactoring/README.md](./README.md)**
   - Overview of the initiative
   - Quick start guide
   - Workflow explanation
   - FAQ section

2. **[docs/refactoring/REFACTOR_ROADMAP.md](./REFACTOR_ROADMAP.md)**
   - Complete extraction plan for all 3 god files
   - 79 modules with priorities and estimates
   - Dependency ordering
   - Success metrics

3. **[docs/refactoring/REFACTOR_PLAYBOOK.md](./REFACTOR_PLAYBOOK.md)**
   - 17-step extraction checklist
   - Common patterns and anti-patterns
   - Troubleshooting guide
   - Code templates

### Supporting Documentation

4. **[TODO.md Phase 15](../../TODO.md#phase-15-solid-refactor-initiative-future)**
   - High-level initiative description
   - Original motivation and goals

5. **[CONTRIBUTING.md - Structural Guardrails](../../CONTRIBUTING.md#structural-guardrails)**
   - 350 LOC limit explanation
   - CI enforcement details
   - How to update baseline

6. **[scripts/structure-baseline.json](../../scripts/structure-baseline.json)**
   - Current snapshot of violations
   - 21 files over threshold
   - Used by CI to prevent new violations

### Analysis Artifacts

The parallel task agents generated detailed JSON analyses:
- App.tsx: 27 clusters with dependencies, complexity, extraction targets
- DMMenu.tsx: 20 clusters with cross-cutting concerns
- MapBoard.tsx: 32 clusters with event routing complexity

These are documented in the roadmap but not stored as separate files.

### Branching Strategy

7. **[docs/refactoring/BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md)**
   - Branch naming convention: `refactor/<scope>/<module-name>`
   - Workflow: create branch → extract → PR → merge → cleanup
   - Parallel work coordination
   - Commit message guidelines

---

## Current Status: Phase 1 Complete, PRs Awaiting Review

### Phase 1 Achievement

**All 9 priorities successfully extracted from App.tsx!**

- Total Reduction: 547 LOC (-29.6%)
- Goal Achievement: 156% of target (350 LOC goal)
- Branches Created: 9 branches, all pushed to origin
- Test Coverage: Characterization tests + unit tests for each module
- Quality: All tests passing, no regressions detected

### Pull Requests Awaiting Review

All Phase 1 branches are pushed and ready for PR creation/review:

1. `refactor/app/use-layout-measurement` - Utility hook for panel measurement
2. `refactor/app/use-tool-mode` - Tool mode state management
3. `refactor/app/use-camera-commands` - Camera control commands
4. `refactor/app/use-e2e-testing-support` - E2E testing utilities
5. `refactor/app/use-scene-object-selectors` - Scene object selection logic
6. `refactor/app/visual-effects` - Visual effects component
7. `refactor/app/authentication-gate` - Authentication flow (337 LOC!)
8. `refactor/app/context-menu` - Context menu component
9. `refactor/app/multi-select-toolbar` - Multi-selection toolbar

**Recommended PR Review Order:** Follow the extraction order above (1-9) to understand dependencies.

---

## Immediate Next Step: Phase 2 - Action Creators

### Recommended Starting Point

**Extract `useTokenActions` from App.tsx (Phase 2, Priority 10)**

**Why this module?**
- ✅ Builds on Phase 1 success
- ✅ Medium complexity (3/5)
- ✅ Clear responsibility (token manipulation actions)
- ✅ Depends only on sendMessage (stable interface)
- ✅ Estimated 3 days

**Module Details:**
- **Source:** `apps/client/src/ui/App.tsx`
- **Target:** `apps/client/src/hooks/useTokenActions.ts`
- **Purpose:** Centralize all token-related actions (create, update, delete, move)
- **Dependencies:** sendMessage, snapshot
- **LOC Estimate:** ~50 LOC extraction
- **Effort:** 3 days

### Step-by-Step Instructions for Phase 2

#### 1. Set Up Your Environment

```bash
cd /home/loshunter/HeroByte
pnpm install

# Verify tests pass
pnpm test

# Check current file sizes
pnpm lint:structure

# Create feature branch for Phase 2 (IMPORTANT!)
git checkout dev
git pull origin dev
git checkout -b refactor/app/use-token-actions
```

#### 2. Review Documentation

Read in this order:
1. `docs/refactoring/REFACTOR_ROADMAP.md` - App.tsx Phase 2 section (10 min)
2. `docs/refactoring/REFACTOR_PLAYBOOK.md` - Refresh on checklist (15 min)
3. Review Phase 1 PRs for patterns and learnings (20 min)

#### 3. Create Tracking Issue

Create GitHub issue:

```markdown
## Extract useTokenActions from App.tsx

**Part of:** Phase 15 SOLID Refactor Initiative
**Roadmap:** App.tsx Phase 2, Priority 10
**File:** docs/refactoring/REFACTOR_ROADMAP.md

### Details
- **Source:** apps/client/src/ui/App.tsx
- **Target:** apps/client/src/hooks/useTokenActions.ts
- **Complexity:** 3/5
- **Estimated Effort:** 3 days

### Description
Extract token-related action creators that wrap sendMessage calls.
Centralize token manipulation logic (create, update, delete, move).
Estimated ~50 LOC extraction.

### Dependencies
- ✅ Phase 1 complete (especially useSceneObjectSelectors)
- sendMessage interface (stable)
- snapshot access (stable)

### Checklist
- [ ] Characterization tests written
- [ ] Module created and extracted
- [ ] Tests passing
- [ ] Documentation complete
- [ ] PR submitted
```

#### 4. Follow the Playbook

Open `docs/refactoring/REFACTOR_PLAYBOOK.md` and execute each step:

**Pre-Extraction Phase:**
- [ ] Step 1: Select target module (DONE - useTokenActions)
- [ ] Step 2: Understand current behavior
  - Identify all token-related sendMessage calls in App.tsx
  - Map inputs: sendMessage, snapshot, token data
  - Map outputs: Action functions (create, update, delete, move, etc.)
  - Document current token manipulation flows
- [ ] Step 3: Create characterization tests
  - Test location: `apps/client/src/hooks/__tests__/characterization/useTokenActions.test.ts`
  - Test all token actions call sendMessage correctly
  - Verify action payloads match current behavior

**Extraction Phase:**
- [ ] Step 4: Create new file `apps/client/src/hooks/useTokenActions.ts`
- [ ] Step 5: Define interface
  ```typescript
  export interface UseTokenActionsOptions {
    sendMessage: (action: string, payload: unknown) => void;
    snapshot: GameSnapshot;
  }

  export interface UseTokenActionsReturn {
    createToken: (data: TokenData) => void;
    updateToken: (id: string, updates: Partial<TokenData>) => void;
    deleteToken: (id: string) => void;
    moveToken: (id: string, position: Position) => void;
    // ... other token actions
  }
  ```
- [ ] Step 6: Extract logic from App.tsx
- [ ] Step 7: Update App.tsx to use new hook

**Verification Phase:**
- [ ] Step 8: Run tests (characterization + new unit tests)
- [ ] Step 9: Manual verification (test token operations in UI)
- [ ] Step 10: Add comprehensive unit tests

**Documentation Phase:**
- [ ] Step 11: Add JSDoc to module
- [ ] Step 12: Update roadmap (mark useTokenActions complete in Phase 2)

**Review Phase:**
- [ ] Step 13: Self-review
- [ ] Step 14: Create PR (reference Phase 1 patterns)
- [ ] Step 15: Address feedback

**Post-Merge Phase:**
- [ ] Step 16: Verify in production
- [ ] Step 17: Update tracking and prepare for next Phase 2 extraction

#### 5. Verify Success

After merge:

```bash
# Check that App.tsx LOC decreased
pnpm lint:structure | grep "App.tsx"
# Should show: ~1253 LOC (reduced from ~1303)

# Verify CI still passes
pnpm lint:structure:enforce
# Should show: ✅ No new structural violations detected

# Verify tests pass
pnpm test
```

---

## Phase 1 Complete - Moving to Phase 2

### Phase 1 Achievements (COMPLETE ✅)

All Phase 1 extractions from App.tsx completed:
- [x] useLayoutMeasurement (-14 LOC, 2 days) ✅
- [x] useToolMode (-11 LOC, 2 days) ✅
- [x] useCameraCommands (-11 LOC, 2 days) ✅
- [x] useE2ETestingSupport (-20 LOC, 1 day) ✅
- [x] useSceneObjectSelectors (-41 LOC, 2 days) ✅
- [x] VisualEffects (-23 LOC, 3 days) ✅
- [x] AuthenticationGate (-337 LOC, 4 days) ✅
- [x] ContextMenu (-22 LOC, 2 days) ✅
- [x] MultiSelectToolbar (-68 LOC, 3 days) ✅

**Phase 1 Total:** 547 LOC reduction achieved (156% of 350 LOC goal)

### Phase 2 Priorities (Week 3-4)

Continue with Action Creator extractions from App.tsx:
- [ ] useTokenActions (50 LOC, 3 days) ← NEXT
- [ ] usePlayerActions (30 LOC, 2 days)
- [ ] useMapActions (35 LOC, 2 days)
- [ ] useStatusEffects (25 LOC, 2 days)

**Target:** ~140 LOC additional reduction

### Parallel Work (Week 3-4)

Start DMMenu.tsx Phase 1 and MapBoard.tsx Phase 1 in parallel:

**DMMenu.tsx Phase 1:**
- [ ] CollapsibleSection (20 LOC, 1 day)
- [ ] FormInput (30 LOC, 2 days)
- [ ] ImagePreview (40 LOC, 2 days)
- [ ] EmptyState (25 LOC, 1 day)

**MapBoard.tsx Phase 1:**
- [ ] MapBoardTypes (40 LOC, 1 day)
- [ ] coordinateTransforms (20 LOC, 1 day)
- [ ] useElementSize (15 LOC, 1 day)

### Review and Adapt (End of Week 4)

- [ ] Review actual vs estimated effort
- [ ] Update roadmap if needed
- [ ] Share learnings with team
- [ ] Adjust pace if necessary
- [ ] Continue to Phase 2

---

## Key Commands Reference

```bash
# Check current file sizes and get hints
pnpm lint:structure

# Test if you'll pass CI (fails on new violations)
pnpm lint:structure:enforce

# Run all tests
pnpm test

# Run specific test file
pnpm test apps/client/src/ui/__tests__/characterization/useLayoutMeasurement.test.ts

# Start dev server for manual verification
pnpm dev

# Format code
pnpm format

# Lint code
pnpm lint

# Update baseline (maintainers only, after approved refactors)
pnpm lint:structure --json --limit 200 > scripts/structure-baseline.json
```

---

## Phase 1 Success Criteria (ACHIEVED ✅)

Phase 1 was successful because:

✅ **App.tsx reduced:** 1,850 → ~1,303 LOC (547 LOC reduction, 29.6%)
✅ **9 modules extracted:** All Phase 1 priorities complete
✅ **Goal exceeded:** 547 LOC vs 350 LOC target (156% achievement)
✅ **All tests passing:** Characterization tests + unit tests for each module
✅ **CI passing:** No new structural violations introduced
✅ **Behavior preserved:** All manual verifications successful, no regressions
✅ **Documentation complete:** JSDoc for all modules, roadmap tracking updated
✅ **All branches pushed:** 9 branches ready for PR review

## Success Criteria for Phase 2 Extractions

You'll know Phase 2 is successful when:

✅ **App.tsx further reduced:** ~1,303 → ~1,163 LOC (140 LOC additional reduction)
✅ **4 action creator modules extracted:** useTokenActions, usePlayerActions, useMapActions, useStatusEffects
✅ **Tests passing:** All existing tests + new characterization tests + new unit tests per module
✅ **CI passing:** No new structural violations
✅ **Behavior preserved:** Manual verification shows no gameplay changes
✅ **Documentation complete:** JSDoc, roadmap updated for Phase 2 completions
✅ **PRs merged:** All Phase 2 branches approved and merged

---

## Troubleshooting

### If You're Stuck

1. **Re-read the playbook section** for your current step
2. **Check the FAQ** in docs/refactoring/README.md
3. **Review troubleshooting section** in REFACTOR_PLAYBOOK.md
4. **Look at git history** to see what was done previously (if any extractions exist)
5. **Ask for help** in team chat with specific question

### Common Issues

**"Tests are failing after extraction"**
- Solution: See REFACTOR_PLAYBOOK.md troubleshooting section
- Compare extracted code line-by-line with original
- Check for missing dependencies or incorrect prop passing

**"TypeScript errors in new module"**
- Solution: Import all types explicitly, no `any` types
- Verify all imports are resolved
- Check generic constraints

**"Circular dependency detected"**
- Solution: Hoist shared types to separate file
- Consider extracting shared dependency first
- Use dependency injection pattern

---

## Context for AI Instances

### What You Can Assume

- ✅ Analysis is complete and accurate (79 clusters identified)
- ✅ Roadmap dependencies are correct (follow extraction order)
- ✅ Playbook process is battle-tested (use it exactly)
- ✅ CI guardrails are active and working
- ✅ Codebase is stable and tests pass

### What You Should Verify

- ⚠️ Current state of extractions (may have started since this doc was written)
- ⚠️ Test suite still passing before starting
- ⚠️ No merge conflicts in target files
- ⚠️ Roadmap priorities haven't changed

### Commands to Run First

```bash
# Check what's been done already
git log --oneline --grep="refactor: extract" | head -20

# Check current state
pnpm lint:structure | head -10

# Verify tests pass
pnpm test

# Check for in-progress work
git status
git branch -a | grep refactor
```

### How to Proceed

1. **Read this document completely**
2. **Run verification commands above**
3. **Read the three essential docs** (README, ROADMAP, PLAYBOOK)
4. **Start with useLayoutMeasurement** (or next unextracted module from Phase 1)
5. **Follow the playbook exactly** (don't skip steps)
6. **Commit frequently** (after each playbook phase)
7. **Ask questions early** (don't guess if unclear)

---

## Phase 1 Complete: Lessons Learned & Metrics

### Extraction Timeline (Actual)

**Phase 1 Duration:** Completed 2025-10-20
- 9 extractions completed successfully
- All branches pushed and ready for PR review
- All tests passing, no regressions detected

### Quality Metrics

**Test Coverage:**
- Characterization tests: 9 test files created (one per extraction)
- Unit tests: Comprehensive coverage for each extracted module
- Integration validation: Manual testing completed for each extraction
- All tests passing: 100% success rate

**Code Quality:**
- SOLID principles applied: All modules follow SRP
- Clean interfaces: Well-defined input/output contracts
- No circular dependencies: Proper extraction order followed
- Type safety: Full TypeScript coverage maintained

### What Worked Well

1. **Dependency-Aware Extraction Order**
   - Starting with simple, low-dependency modules built confidence
   - Following the roadmap sequence prevented circular dependencies
   - Quick wins (useLayoutMeasurement, useToolMode) established patterns

2. **Characterization Tests First**
   - Writing tests before extraction locked in behavior
   - Tests caught edge cases during extraction
   - Provided regression safety net

3. **Small, Atomic Commits**
   - Each extraction in its own branch
   - Easy to review and rollback if needed
   - Clear git history for future reference

4. **Documentation as We Go**
   - Updated roadmap after each extraction
   - JSDoc comments improved code understanding
   - Maintained NEXT_STEPS.md context

### Challenges & Solutions

**Challenge:** AuthenticationGate was much larger than estimated (337 LOC vs 120 LOC)
**Solution:** Broke it into smaller sub-components, maintained single responsibility

**Challenge:** Some extractions had subtle dependencies not captured in initial analysis
**Solution:** Created additional utility hooks (e.g., useSceneObjectSelectors) to support clean extraction

**Challenge:** Test setup complexity for hooks with many dependencies
**Solution:** Created reusable test fixtures and mock factories

### Recommendations for Phase 2

1. **Continue Pattern of Characterization Tests**
   - Critical for action creators that wrap sendMessage
   - Verify message payloads match current behavior exactly

2. **Watch for Shared Logic**
   - Action creators may share validation/transformation logic
   - Consider extracting shared utilities alongside action hooks

3. **Test sendMessage Integration**
   - Mock sendMessage to verify correct action types
   - Validate payload structure matches server expectations

4. **Consider Parallel Extraction**
   - Phase 2 modules (action creators) are mostly independent
   - Could parallelize if multiple engineers working on refactor

### Branch Status

All Phase 1 branches are pushed to origin and ready for PR creation:

| Branch | Status | LOC Reduction | Tests |
|--------|--------|---------------|-------|
| `refactor/app/use-layout-measurement` | ✅ Ready | -14 | ✅ Passing |
| `refactor/app/use-tool-mode` | ✅ Ready | -11 | ✅ Passing |
| `refactor/app/use-camera-commands` | ✅ Ready | -11 | ✅ Passing |
| `refactor/app/use-e2e-testing-support` | ✅ Ready | -20 | ✅ Passing |
| `refactor/app/use-scene-object-selectors` | ✅ Ready | -41 | ✅ Passing |
| `refactor/app/visual-effects` | ✅ Ready | -23 | ✅ Passing |
| `refactor/app/authentication-gate` | ✅ Ready | -337 | ✅ Passing |
| `refactor/app/context-menu` | ✅ Ready | -22 | ✅ Passing |
| `refactor/app/multi-select-toolbar` | ✅ Ready | -68 | ✅ Passing |

**Total:** 547 LOC reduction across 9 extractions

---

## Estimated Timeline (Updated with Phase 1 Actuals)

**Phase 1 (COMPLETE):** ✅ 9 extractions, 547 LOC reduction
**Phase 2 extractions:** 1-3 days each
**Phase 2 complete:** 2 weeks
**Phase 3 complete:** 3 weeks
**All App.tsx phases:** 8-10 weeks
**All 3 files complete:** 20-26 weeks

---

## Final Notes

This is a **marathon, not a sprint**. Focus on:
- ✅ Quality over speed
- ✅ Behavior preservation over refactoring
- ✅ Small, incremental changes
- ✅ Comprehensive testing
- ✅ Clear documentation

Every extraction makes the codebase better. Every module extracted is a victory. Stay focused on the process, trust the playbook, and ship incrementally.

**Good luck! 🚀**

---

**Last Updated:** 2025-10-20 (Phase 1 Complete)
**Phase 1 Completed:** 2025-10-20 (9/9 extractions, 547 LOC reduction)
**Next Review:** After Phase 2 complete
**Questions?** See docs/refactoring/README.md FAQ section
