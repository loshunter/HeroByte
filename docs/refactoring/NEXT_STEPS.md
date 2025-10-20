# Next Steps: Starting Phase 15 Refactoring

**Date:** 2025-10-20
**Status:** Ready to begin extractions
**Context:** Phase 15 SOLID Refactor Initiative infrastructure complete

---

## For the Next Engineer/AI Instance

### What Was Completed

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

## Immediate Next Step: First Extraction

### Recommended Starting Point

**Extract `useLayoutMeasurement` from App.tsx**

**Why this module?**
- ✅ Simple (complexity: 2)
- ✅ No dependencies on other extractions
- ✅ Quick win (2 day estimate)
- ✅ Builds team confidence
- ✅ Sets pattern for future extractions

**Module Details:**
- **Source:** `apps/client/src/ui/App.tsx` (lines 494-497, 565-578)
- **Target:** `apps/client/src/hooks/useLayoutMeasurement.ts`
- **Purpose:** Measures and tracks height of fixed top/bottom panels
- **Dependencies:** React refs, window resize event
- **Effort:** 2 days

### Step-by-Step Instructions

#### 1. Set Up Your Environment

```bash
cd /home/loshunter/HeroByte
pnpm install

# Verify tests pass
pnpm test

# Check current file sizes
pnpm lint:structure

# Create feature branch (IMPORTANT!)
git checkout dev
git pull origin dev
git checkout -b refactor/app/use-layout-measurement
```

#### 2. Review Documentation

Read in this order:
1. `docs/refactoring/README.md` (10 min)
2. `docs/refactoring/REFACTOR_ROADMAP.md` - App.tsx Phase 1 section (15 min)
3. `docs/refactoring/REFACTOR_PLAYBOOK.md` - Full checklist (20 min)

#### 3. Create Tracking Issue

Create GitHub issue:

```markdown
## Extract useLayoutMeasurement from App.tsx

**Part of:** Phase 15 SOLID Refactor Initiative
**Roadmap:** App.tsx Phase 1, Priority 1
**File:** docs/refactoring/REFACTOR_ROADMAP.md

### Details
- **Source:** apps/client/src/ui/App.tsx (lines 494-497, 565-578)
- **Target:** apps/client/src/hooks/useLayoutMeasurement.ts
- **Complexity:** 2/5
- **Estimated Effort:** 2 days

### Description
Extract layout measurement logic that tracks top/bottom panel heights.
Currently ~20 LOC spread across state declarations and useEffect.

### Dependencies
- ✅ None (first extraction in Phase 1)

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
- [ ] Step 1: Select target module (DONE - useLayoutMeasurement)
- [ ] Step 2: Understand current behavior
  - Read lines 494-497 (state declarations)
  - Read lines 565-578 (useEffect with measurement logic)
  - Map inputs: topPanelRef, bottomPanelRef, snapshot.players
  - Map outputs: topHeight, bottomHeight state
- [ ] Step 3: Create characterization tests
  - Test location: `apps/client/src/ui/__tests__/characterization/useLayoutMeasurement.test.ts`
  - Test that heights update on resize
  - Test that heights update when players change

**Extraction Phase:**
- [ ] Step 4: Create new file `apps/client/src/hooks/useLayoutMeasurement.ts`
- [ ] Step 5: Define interface
  ```typescript
  export interface UseLayoutMeasurementOptions {
    topPanelRef: React.RefObject<HTMLDivElement>;
    bottomPanelRef: React.RefObject<HTMLDivElement>;
    dependencies?: unknown[];
  }

  export interface UseLayoutMeasurementReturn {
    topHeight: number;
    bottomHeight: number;
  }
  ```
- [ ] Step 6: Extract logic from App.tsx
- [ ] Step 7: Update App.tsx to use new hook

**Verification Phase:**
- [ ] Step 8: Run tests (characterization + new unit tests)
- [ ] Step 9: Manual verification (start dev server, test UI)
- [ ] Step 10: Add comprehensive unit tests

**Documentation Phase:**
- [ ] Step 11: Add JSDoc to module
- [ ] Step 12: Update roadmap (mark useLayoutMeasurement complete)

**Review Phase:**
- [ ] Step 13: Self-review
- [ ] Step 14: Create PR
- [ ] Step 15: Address feedback

**Post-Merge Phase:**
- [ ] Step 16: Verify in production
- [ ] Step 17: Update tracking

#### 5. Verify Success

After merge:

```bash
# Check that App.tsx LOC decreased
pnpm lint:structure | grep "App.tsx"
# Should show: 1830 LOC (reduced from 1850)

# Verify CI still passes
pnpm lint:structure:enforce
# Should show: ✅ No new structural violations detected

# Verify tests pass
pnpm test
```

---

## After First Extraction

### Momentum Building (Week 1-2)

Complete remaining Phase 1 extractions from App.tsx:
- [ ] useToolMode (25 LOC, 2 days)
- [ ] useCameraCommands (30 LOC, 2 days)
- [ ] useE2ETestingSupport (15 LOC, 1 day)
- [ ] useSceneObjectSelectors (20 LOC, 2 days)
- [ ] VisualEffects (40 LOC, 3 days)
- [ ] AuthenticationGate (120 LOC, 4 days)
- [ ] ContextMenu (30 LOC, 2 days)
- [ ] MultiSelectToolbar (50 LOC, 3 days)

**Target:** ~350 LOC reduction in 2 weeks

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

## Success Criteria for First Extraction

You'll know you're successful when:

✅ **App.tsx reduced:** 1,850 → 1,830 LOC (20 LOC reduction)
✅ **New file created:** `apps/client/src/hooks/useLayoutMeasurement.ts` (<50 LOC)
✅ **Tests passing:** All existing tests + new characterization tests + new unit tests
✅ **CI passing:** No new structural violations
✅ **Behavior preserved:** Manual verification shows no UI changes
✅ **Documentation complete:** JSDoc, roadmap updated
✅ **PR merged:** Approved by team, merged to dev branch

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

## Estimated Timeline

**First extraction:** 1-2 days (learning curve)
**Subsequent Phase 1 extractions:** 1-3 days each
**Phase 1 complete:** 2-3 weeks
**Phase 2-3 complete:** 4-6 weeks
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

**Last Updated:** 2025-10-20
**Next Review:** After first extraction complete
**Questions?** See docs/refactoring/README.md FAQ section
