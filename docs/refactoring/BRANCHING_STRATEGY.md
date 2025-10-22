# Refactoring Branching Strategy

**Purpose:** Define branching workflow for Phase 15 refactoring
**Status:** Active
**Last Updated:** 2025-10-20

---

## Overview

Phase 15 refactoring involves 79 separate extractions across multiple weeks. To maintain code quality and enable parallel work, we use a structured branching strategy.

---

## Branch Naming Convention

### Pattern

```
refactor/<scope>/<module-name>
```

### Examples

```bash
# App.tsx extractions
refactor/app/use-layout-measurement
refactor/app/use-tool-mode
refactor/app/authentication-gate

# DMMenu.tsx extractions
refactor/dm-menu/collapsible-section
refactor/dm-menu/npc-editor
refactor/dm-menu/map-tab

# MapBoard.tsx extractions
refactor/map-board/coordinate-transforms
refactor/map-board/use-marquee-selection
refactor/map-board/staging-zone-layer
```

### Scope Options

- `app` - Extractions from App.tsx
- `dm-menu` - Extractions from DMMenu.tsx
- `map-board` - Extractions from MapBoard.tsx
- `server` - Server-side refactors (validation.ts, messageRouter.ts, etc.)
- `shared` - Shared package refactors (models.ts)
- `infrastructure` - Infrastructure improvements (this commit)

---

## Workflow

### 1. Create Feature Branch

**Before starting extraction:**

```bash
# Ensure dev is up to date
git checkout dev
git pull origin dev

# Create extraction branch
git checkout -b refactor/app/use-layout-measurement
```

### 2. Work on Extraction

Follow the playbook checklist:

```bash
# Make changes following REFACTOR_PLAYBOOK.md

# Commit frequently (after each playbook phase)
git add <files>
git commit -m "test: add characterization tests for useLayoutMeasurement"

git add <files>
git commit -m "refactor: extract useLayoutMeasurement hook"

git add <files>
git commit -m "refactor: integrate useLayoutMeasurement into App.tsx"

git add <files>
git commit -m "docs: document useLayoutMeasurement"
```

### 3. Push and Create PR

```bash
# Push branch
git push origin refactor/app/use-layout-measurement

# Create PR via GitHub CLI
gh pr create \
  --base dev \
  --title "refactor: extract useLayoutMeasurement from App.tsx" \
  --body "$(cat <<'EOF'
## Refactor: useLayoutMeasurement

**Part of:** Phase 15 SOLID Refactor Initiative
**Roadmap:** App.tsx Phase 1, Priority 1
**Tracking Issue:** #XXX

### Changes
- **New Module:** `apps/client/src/hooks/useLayoutMeasurement.ts` (20 LOC)
- **Source File:** `apps/client/src/ui/App.tsx` (1,850 → 1,830 LOC)
- **Reduction:** 20 LOC

### Testing
- [X] Characterization tests GREEN
- [X] Unit tests added (coverage: 95%)
- [X] E2E smoke tests passing
- [X] Manual verification complete

### Checklist
- [X] All playbook steps completed
- [X] Tests passing
- [X] Documentation updated
- [X] No behavior changes
- [X] No new structural violations
EOF
  )"
```

### 4. Address Review Feedback

```bash
# Make changes based on feedback
git add <files>
git commit -m "refactor: address review feedback"

# Push updates
git push origin refactor/app/use-layout-measurement
```

### 5. Merge and Cleanup

**After PR approval:**

```bash
# Merge via GitHub UI (squash and merge recommended)

# Clean up local branch
git checkout dev
git pull origin dev
git branch -d refactor/app/use-layout-measurement
```

---

## Parallel Work Strategy

### Scenario 1: Same File, Different Modules

**Problem:** Two engineers want to extract from App.tsx simultaneously

**Solution:** Extract low-dependency modules that don't touch the same lines

**Safe Combinations:**
- `useLayoutMeasurement` (lines 494-497, 565-578)
- `useToolMode` (lines 462-469, 1209-1222)
- `useCameraCommands` (lines 471-476, 508-511, 925-936)

**Unsafe Combinations:**
- `useLayoutMeasurement` + `MultiSelectToolbar` (both use topHeight/bottomHeight)
- `AuthenticationGate` + `useAuthenticationFlow` (both touch auth logic)

**Coordination:**
1. Announce extraction in team chat
2. Check for line overlap in roadmap
3. Choose non-overlapping modules
4. Merge frequently to reduce conflicts

### Scenario 2: Different Files

**Problem:** Multiple engineers working on different god files

**Solution:** Work in parallel - no conflicts expected

**Examples:**
- Engineer A: `refactor/app/use-layout-measurement`
- Engineer B: `refactor/dm-menu/collapsible-section`
- Engineer C: `refactor/map-board/coordinate-transforms`

**Coordination:**
- Minimal needed
- Coordinate in team chat
- Share learnings in daily standups

### Scenario 3: Dependent Modules

**Problem:** Module B depends on Module A (not yet extracted)

**Solution:** Wait or work sequentially on same branch

**Option 1: Wait for Dependency**
```bash
# Wait for Module A to merge, then start Module B
git checkout dev
git pull origin dev
git checkout -b refactor/app/module-b
```

**Option 2: Sequential on Same Branch**
```bash
# Extract both modules on one branch
git checkout -b refactor/app/module-a-and-b

# Commit A
git add <files>
git commit -m "refactor: extract Module A"

# Commit B
git add <files>
git commit -m "refactor: extract Module B"

# Create PR with both extractions
gh pr create --title "refactor: extract Module A and Module B from App.tsx"
```

**Recommendation:** Use Option 1 (wait) unless modules are tightly coupled

---

## Handling Conflicts

### Merge Conflicts During Rebase

```bash
# Rebase on latest dev
git checkout refactor/app/use-layout-measurement
git fetch origin
git rebase origin/dev

# If conflicts occur
# 1. Resolve conflicts in files
# 2. Add resolved files
git add <files>
git rebase --continue

# Force push (safe because it's your feature branch)
git push origin refactor/app/use-layout-measurement --force-with-lease
```

### Conflicts Between Extractions

**If two PRs conflict:**

1. First PR merges normally
2. Second PR rebases on updated dev
3. Second PR resolves conflicts
4. Second PR re-requests review

**Prevention:**
- Merge PRs quickly (within 24-48 hours)
- Keep PRs small (one extraction per PR)
- Communicate in team chat

---

## Commit Message Guidelines

### Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `test:` - Adding or modifying tests
- `refactor:` - Extracting modules (behavior-preserving)
- `docs:` - Documentation updates
- `fix:` - Bug fixes (separate from refactors)
- `feat:` - New features (separate from refactors)

### Examples

**Good:**
```
test: add characterization tests for useLayoutMeasurement

Add tests that capture current behavior before extraction:
- Test height measurement on resize
- Test height update on player list change
- Test ref initialization

Covers lines 494-497 and 565-578 of App.tsx
```

```
refactor: extract useLayoutMeasurement hook

Extract layout measurement logic from App.tsx into reusable hook.

Changes:
- New hook: apps/client/src/hooks/useLayoutMeasurement.ts (20 LOC)
- App.tsx reduced: 1,850 → 1,830 LOC
- All tests passing, no behavior changes

Part of Phase 15 SOLID Refactor Initiative
See: docs/refactoring/REFACTOR_ROADMAP.md App.tsx Phase 1
```

```
docs: mark useLayoutMeasurement extraction complete

Update roadmap to reflect completed extraction.
Update progress tracking: App.tsx Phase 1 - 1/9 complete.
```

**Bad:**
```
fix stuff
```

```
WIP
```

```
refactor: lots of changes to App.tsx
```

---

## PR Guidelines

### Size

**Target:** <300 LOC changed per PR

**Why:**
- Easier to review
- Faster to merge
- Lower conflict risk
- Simpler to revert if needed

**If extraction exceeds 300 LOC:**
- Split into multiple smaller extractions
- Example: Extract NPCEditor (210 LOC) and PropEditor (180 LOC) as separate PRs

### Review Requirements

**Before requesting review:**
- [ ] All playbook steps completed
- [ ] All tests passing locally
- [ ] CI checks passing
- [ ] Self-review completed
- [ ] Documentation updated

**Reviewers should check:**
- [ ] Playbook compliance (characterization tests exist)
- [ ] Tests GREEN
- [ ] No behavior changes
- [ ] Clean interface (ISP)
- [ ] Single responsibility (SRP)
- [ ] Documentation complete

### Approval Criteria

**Required:**
- ✅ At least 1 approval from team member
- ✅ All CI checks passing
- ✅ No merge conflicts
- ✅ Playbook checklist complete

**Nice to have:**
- ✅ 2+ approvals for complex extractions
- ✅ Visual verification screenshots/video
- ✅ Performance benchmarks (if applicable)

---

## Emergency Procedures

### Reverting a Merged Extraction

**If production issues occur after merge:**

```bash
# Create revert branch
git checkout dev
git pull origin dev
git checkout -b revert/use-layout-measurement

# Revert the merge commit
git revert <merge-commit-sha>

# Push and create PR
git push origin revert/use-layout-measurement
gh pr create --title "revert: useLayoutMeasurement extraction" --body "Reverting due to production issue: <description>"
```

### Hotfix During Refactoring

**If critical bug in god file being refactored:**

1. **Pause extractions** - Don't merge new refactor PRs
2. **Create hotfix branch** from dev
3. **Fix bug** in original file (not extracted module)
4. **Merge hotfix** to dev and main
5. **Resume extractions** - Rebase open PRs on updated dev

### Blocked by Failing Tests

**If baseline tests start failing:**

1. **Stop all extractions** - Don't create new branches
2. **Fix baseline** on dev branch
3. **Merge fix**
4. **Resume extractions** - All open branches rebase on fixed dev

---

## Branching Best Practices

### DO

✅ **Create one branch per extraction**
✅ **Branch from latest dev**
✅ **Rebase frequently** (at least daily)
✅ **Commit after each playbook phase**
✅ **Push frequently** (backup your work)
✅ **Delete branch after merge**
✅ **Keep branches short-lived** (<3 days)

### DON'T

❌ **Don't create long-lived refactor branches**
❌ **Don't extract multiple unrelated modules on one branch**
❌ **Don't modify behavior while refactoring**
❌ **Don't merge to main directly** (always dev first)
❌ **Don't skip characterization tests**
❌ **Don't force push to dev**
❌ **Don't work on feature branches during refactor**

---

## Progress Tracking

### Update Roadmap

After each merge:

```bash
# Edit roadmap
vim docs/refactoring/REFACTOR_ROADMAP.md

# Mark module complete
- [X] useLayoutMeasurement (COMPLETE - 2025-10-20)

# Update progress
Phase 1 Reduction: ~20 LOC → App.tsx down to ~1,830 LOC (1/9 complete)

# Commit
git add docs/refactoring/REFACTOR_ROADMAP.md
git commit -m "docs: mark useLayoutMeasurement extraction complete"
git push origin dev
```

### Update Baseline

**Only update baseline when:**
- Extraction reduces god file below threshold (rare)
- Multiple extractions complete (batch update)
- Maintainer approval obtained

```bash
# Regenerate baseline
pnpm lint:structure --json --limit 200 > scripts/structure-baseline.json

# Commit
git add scripts/structure-baseline.json
git commit -m "chore: update structural baseline after extractions"
git push origin dev
```

---

## Examples

### Example 1: Simple Extraction

```bash
# Start
git checkout dev
git pull origin dev
git checkout -b refactor/app/use-tool-mode

# Work (follow playbook)
git add apps/client/src/ui/__tests__/characterization/useToolMode.test.ts
git commit -m "test: add characterization tests for useToolMode"

git add apps/client/src/hooks/useToolMode.ts apps/client/src/ui/App.tsx
git commit -m "refactor: extract useToolMode hook"

git add docs/refactoring/REFACTOR_ROADMAP.md
git commit -m "docs: mark useToolMode extraction complete"

# Push and PR
git push origin refactor/app/use-tool-mode
gh pr create --base dev --title "refactor: extract useToolMode from App.tsx"

# After merge
git checkout dev
git pull origin dev
git branch -d refactor/app/use-tool-mode
```

### Example 2: Extraction with Dependency

```bash
# Wait for SelectionManager to merge first
# Then extract useKeyboardShortcuts (which depends on it)

git checkout dev
git pull origin dev
git checkout -b refactor/app/use-keyboard-shortcuts

# Work (follow playbook)
# ... commits ...

git push origin refactor/app/use-keyboard-shortcuts
gh pr create --base dev --title "refactor: extract useKeyboardShortcuts from App.tsx"
```

### Example 3: Parallel Work (Different Files)

**Engineer A:**
```bash
git checkout -b refactor/app/use-layout-measurement
# ... work on App.tsx ...
```

**Engineer B:**
```bash
git checkout -b refactor/dm-menu/collapsible-section
# ... work on DMMenu.tsx ...
```

No coordination needed - different files, no conflicts.

---

## FAQ

**Q: Can I work on multiple extractions simultaneously?**

A: Yes, but use separate branches and keep them independent. Don't mix extractions on one branch.

**Q: Should I squash commits before merging?**

A: Yes, use GitHub's "Squash and merge" option for cleaner history.

**Q: What if my extraction takes longer than 3 days?**

A: Either:
1. Split into smaller extractions
2. Continue but rebase daily on dev
3. Ask for help if blocked

**Q: Can I add features while refactoring?**

A: No. Refactoring PRs should be behavior-preserving only. Add features in separate PRs after refactor.

**Q: What if CI fails after my extraction?**

A: Fix immediately or revert. Don't let failing CI block other extractions.

---

## Related Documents

- [REFACTOR_ROADMAP.md](./REFACTOR_ROADMAP.md) - Extraction plan
- [REFACTOR_PLAYBOOK.md](./REFACTOR_PLAYBOOK.md) - Step-by-step process
- [NEXT_STEPS.md](./NEXT_STEPS.md) - Getting started
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - General guidelines

---

**Last Updated:** 2025-10-20
**Version:** 1.0.0
**Maintained By:** Engineering Team
