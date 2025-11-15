# Preventing God Objects - Developer Guide

**Last Updated:** 2025-11-14
**Status:** Active
**Applies To:** All HeroByte developers and AI assistants

---

## What is a God Object?

A **god object** is a file that:
- Has too many responsibilities (violates Single Responsibility Principle)
- Exceeds reasonable size limits (typically >350 LOC for non-test files)
- Becomes a bottleneck for changes (every feature touches it)
- Is difficult to test in isolation
- Creates merge conflicts frequently

**Real example from this project:**
- RoomService was **688 LOC** with 9 responsibilities
- After refactoring: **181 LOC** with clear delegation (74% reduction)

---

## Automated Guardrails (Already in Place!)

### 1. Structure Linting

**Command:**
```bash
pnpm lint:structure        # Report files over threshold
pnpm lint:structure:enforce # Fail CI on new violations
```

**Current threshold:** 350 LOC (non-test files)

**How it works:**
- Scans all TypeScript/TSX files
- Compares against baseline (`scripts/structure-baseline.json`)
- Flags any file >350 LOC that wasn't already flagged
- CI fails if new god objects are introduced

**Example output:**
```
LOC     Size      Category            Path  Flag  Hint
------------------------------------------------------
922     30.8KB    server:websocket    apps/server/src/ws/messageRouter.ts  ⚠️  Modularize handlers per message type
181     5.6KB     server:domains      apps/server/src/domains/room/service.ts  ✓  Well-sized!
```

### 2. CI Integration (GitHub Actions)

The structural guardrail runs on every PR:

**File:** `.github/workflows/ci.yml`
```yaml
- name: Structural Guardrails
  run: pnpm lint:structure:enforce
```

**Result:** PRs cannot merge if they introduce new god objects!

---

## Manual Prevention Strategies

### Strategy 1: The 350 LOC Rule

**Rule:** No production file should exceed 350 LOC (tests excluded)

**Why 350?**
- Fits on ~2 screens with typical font sizes
- Indicates a single, focused responsibility
- Easy to review in a PR
- Proven limit from industry research

**Exceptions:** (require explicit approval)
- Generated code
- Large type definition files (split if possible)
- Truly atomic algorithms (but rare!)

### Strategy 2: Early Detection

**Watch for these warning signs:**

1. **File is growing fast**
   ```bash
   git log --oneline --numstat -- path/to/file.ts | wc -l
   # If >20 commits touching same file in a month, investigate
   ```

2. **Multiple developers editing simultaneously**
   - Frequent merge conflicts
   - Many pending PRs touching the same file

3. **Vague file names**
   - `utils.ts` - What kind of utils?
   - `helpers.ts` - Helping with what?
   - `common.ts` - Common to what?
   - `manager.ts` - Managing everything?

4. **Long import lists**
   - If file imports >15 modules, it's doing too much

5. **Multiple responsibilities in comments**
   ```typescript
   // This file handles:
   // - User authentication  ← Responsibility 1
   // - Session management   ← Responsibility 2
   // - Token validation     ← Responsibility 3
   // - Password hashing     ← Responsibility 4
   // ⚠️ This is a god object waiting to happen!
   ```

### Strategy 3: Proactive Refactoring

**When to refactor:**

| LOC Range | Action Required |
|-----------|----------------|
| 0-250 | ✅ Healthy - no action needed |
| 251-350 | ⚠️ Monitor - consider refactoring if adding features |
| 351-500 | 🚨 Refactor soon - file is getting unwieldy |
| 500+ | 🛑 Refactor NOW - god object formed |

**Quick refactoring checklist:**
- [ ] Can you identify 2+ distinct responsibilities?
- [ ] Are there natural boundaries (e.g., auth vs business logic)?
- [ ] Would extraction make testing easier?
- [ ] Would it prevent merge conflicts?

**If yes to 2+, extract immediately!**

---

## Code Review Guidelines

### For Reviewers

**Before approving a PR, check:**

1. **Run structure check:**
   ```bash
   pnpm lint:structure:enforce
   ```
   - If it fails, require extraction before merge

2. **Look at the diff:**
   - Is one file getting most of the changes?
   - Are multiple responsibilities being added?

3. **Ask these questions:**
   - "Could this feature be in its own module?"
   - "Does this file do too many things now?"
   - "Would extraction make this easier to test?"

4. **Suggest extraction patterns:**
   - "Consider extracting authentication logic to `auth/AuthService.ts`"
   - "This validation could be in `validators/UserValidator.ts`"
   - "These transforms could be in `transforms/UserTransform.ts`"

### For Authors

**Before submitting a PR:**

1. **Check your changes:**
   ```bash
   git diff --stat
   ```
   - If one file has >100 lines changed, consider splitting

2. **Run structure check:**
   ```bash
   pnpm lint:structure:enforce
   ```
   - Fix any violations before submitting

3. **Ask yourself:**
   - "Am I adding to an already large file?"
   - "Could this be its own module?"
   - "Will reviewers struggle to understand this in one file?"

4. **Proactive extraction:**
   - Extract before review, not after feedback
   - Makes reviews faster
   - Shows architectural awareness

---

## Refactoring Playbook

**When a god object is identified, follow this process:**

### Step 1: Analysis (30 minutes)

1. Read the file and identify responsibilities
2. Document them (e.g., "auth, validation, persistence, business logic")
3. Check what's already extracted (avoid duplication)
4. Estimate effort (use `git log` to see change frequency)

### Step 2: Plan (1 hour)

1. Choose extraction order (utilities first, then complex logic)
2. Create tracking issue/task
3. Decide on module boundaries
4. Review with team if >500 LOC

**Resources:**
- [REFACTOR_PLAYBOOK.md](../refactoring/REFACTOR_PLAYBOOK.md) - 17-step process
- [ROOM_SERVICE_REFACTOR_PLAN.md](../refactoring/ROOM_SERVICE_REFACTOR_PLAN.md) - Real example

### Step 3: Execute (varies)

1. **Create feature branch:** `refactor/scope/module-name`
2. **Write characterization tests** (capture current behavior)
3. **Extract module** (exact copy, no changes)
4. **Update source file** (delegate to module)
5. **Run all tests** (must be green)
6. **Commit and push**
7. **Merge to dev**

**Time estimates by file size:**
- 350-500 LOC: 2-4 hours
- 500-700 LOC: 1-2 days
- 700+ LOC: 3-5 days (split into phases)

### Step 4: Verify (30 minutes)

1. Run full test suite
2. Manual smoke testing
3. Check TypeScript compilation
4. Update baseline: `pnpm lint:structure:enforce --update-baseline`

---

## Real Examples from This Project

### ✅ Success Story: RoomService Refactoring

**Before:**
```
RoomService.ts - 688 LOC
- State management
- File persistence
- Snapshot loading
- Broadcasting
- Scene graph building
- Transform handling
- Object locking
- Staging zone logic
- Pointer cleanup
```

**After (6 modules created):**
```
RoomService.ts - 181 LOC (orchestrator only)
├── StatePersistence.ts - 175 LOC
├── SnapshotLoader.ts - 126 LOC
├── SceneGraphBuilder.ts - 298 LOC
├── TransformHandler.ts - 292 LOC
├── LockingHandler.ts - 77 LOC
└── StagingZoneManager.ts - 148 LOC
```

**Results:**
- 74% LOC reduction in main file
- 48 new tests added
- Zero behavioral changes
- Zero test failures
- Much easier to maintain

**Key takeaways:**
1. Extract utilities first (low risk)
2. Write tests before extraction (safety net)
3. One module per branch (small PRs)
4. Delegate, don't duplicate (DRY)

---

## Tools & Automation

### Available Commands

```bash
# Check structure (report only)
pnpm lint:structure

# Enforce structure (fail on violations)
pnpm lint:structure:enforce

# Update baseline after refactoring
pnpm lint:structure:enforce --update-baseline

# Generate refactoring hints
pnpm lint:structure | grep "⚠️"

# Check specific directory
pnpm lint:structure | grep "client:ui"
```

### IDE Integration

**VS Code recommended extensions:**
1. **Code Metrics** - Shows LOC in explorer
2. **SonarLint** - Detects code smells
3. **Better Comments** - Highlights TODOs

**VS Code settings:**
```json
{
  "files.maxFileSize": 350000,  // ~350 LOC warning
  "sonarlint.rules": {
    "typescript:S138": "on"  // Function LOC limit
  }
}
```

### Pre-commit Hook (Optional)

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Prevent committing new god objects
pnpm lint:structure:enforce
```

---

## FAQ

### Q: What if I need to add a feature to a 340 LOC file?

**A:** You have two options:

1. **Extract first, then add** (recommended)
   - Extract a responsibility to get below 300 LOC
   - Add your feature
   - File stays manageable

2. **Add with justification**
   - Document why extraction isn't feasible
   - Get approval from lead/team
   - Create follow-up refactoring task

### Q: What about test files? They're often >350 LOC.

**A:** Test files are excluded from the 350 LOC limit because:
- They're often data-heavy (fixtures, test cases)
- Each test is independent
- They don't violate SRP (single responsibility: testing X)

**However,** if a test file exceeds 1000 LOC:
- Consider splitting by feature area
- Extract test utilities/helpers
- Use `describe` blocks for organization

### Q: Can I update the baseline to allow my god object?

**A:** Only in these cases:
1. You're actively refactoring it (add to baseline temporarily)
2. It's a legacy file with refactoring plan in place
3. It's generated code (rare!)

**Never** update baseline just to bypass the check!

### Q: What if the entire team disagrees with 350 LOC?

**A:** The threshold is configurable:

```bash
# Change to 500 LOC threshold
pnpm lint:structure:enforce --threshold 500

# Update package.json
"lint:structure:enforce": "node scripts/structure-report.mjs --threshold 500 --fail-on-new"
```

**But:** Research shows 350 is optimal. Adjust with caution.

### Q: How do I handle generated files (e.g., Prisma, GraphQL)?

**A:** Add to exclusion list in `scripts/structure-report.mjs`:

```javascript
const excludePatterns = [
  /generated\//,
  /\.generated\.ts$/,
  /__generated__\//,
];
```

---

## Success Metrics

### How to measure effectiveness:

1. **File size distribution:**
   ```bash
   pnpm lint:structure | awk '{print $1}' | sort -n | uniq -c
   ```
   Goal: Most files under 300 LOC

2. **Merge conflict frequency:**
   - Track conflicts per file over time
   - Goal: <1 conflict per file per month

3. **PR review time:**
   - Smaller files = faster reviews
   - Goal: Average PR review <2 hours

4. **Test coverage:**
   - Modular code is easier to test
   - Goal: >80% coverage

5. **Developer satisfaction:**
   - Survey: "Is the codebase easy to navigate?"
   - Goal: >70% positive responses

---

## Resources

**Documentation:**
- [REFACTOR_PLAYBOOK.md](../refactoring/REFACTOR_PLAYBOOK.md) - Step-by-step extraction guide
- [REFACTOR_ROADMAP.md](../refactoring/REFACTOR_ROADMAP.md) - Client refactoring plans
- [ROOM_SERVICE_REFACTOR_PLAN.md](../refactoring/ROOM_SERVICE_REFACTOR_PLAN.md) - Server example

**External Reading:**
- [Object Calisthenics](https://williamdurand.fr/2013/06/03/object-calisthenics/) - 9 rules for better OOP
- [Clean Code](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882) - Chapter 3 (Functions)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID) - Single Responsibility Principle

**Tools:**
- [SonarQube](https://www.sonarqube.org/) - Code quality platform
- [Code Climate](https://codeclimate.com/) - Automated code review
- [Better Code Hub](https://bettercodehub.com/) - 10 guidelines for maintainability

---

## Maintenance

**This document should be updated when:**
- LOC threshold changes
- New patterns emerge
- Team feedback suggests improvements
- Major refactorings are completed

**Owner:** Tech Lead / Senior Engineers
**Review Frequency:** Quarterly

---

**Remember:** Prevention is easier than cure. Keep files small from the start! 🎯
