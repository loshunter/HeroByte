# Code Review Checklist - Preventing God Objects

**Purpose:** Help reviewers spot potential god objects before they're merged
**Use:** Check these items for every PR that modifies or creates files

---

## Quick Checks (30 seconds)

### ✅ Automated Checks Passing

Before even looking at code:

- [ ] **CI is green** - All automated checks must pass
- [ ] **Structure check passed** - `pnpm lint:structure:enforce` succeeded
- [ ] **Tests passing** - No new test failures
- [ ] **TypeScript compiling** - No type errors

**If any fail:** Request fixes before detailed review

---

## File Size Check (1 minute)

### Run Structure Report

```bash
pnpm lint:structure | grep -E "$(git diff --name-only main...HEAD | tr '\n' '|' | sed 's/|$//')"
```

### Review Each Changed File

For each file in the diff:

- [ ] **Under 350 LOC?** ✅ Good to go
- [ ] **350-500 LOC?** ⚠️ Ask: "Can we extract something?"
- [ ] **Over 500 LOC?** 🛑 Require extraction before merge

**Quick size check in GitHub:**
- Look at PR diff stats
- Any file with >100 lines changed? Investigate closely

---

## Responsibility Check (2 minutes)

### Look for Multiple Responsibilities

Read the file. Ask: **"What does this file do?"**

**Red flags:**
- Answer contains "and" more than twice
  - Example: "Handles auth **and** validation **and** persistence **and** broadcasting" ← 4 responsibilities!
- File imports >15 different modules
- File exports >10 different functions/components
- Comments like "Utility functions for..." (too vague)

### Test: The Elevator Pitch

**Can you explain the file's purpose in one sentence?**

- ✅ "Handles user authentication via JWT tokens"
- ✅ "Renders the player card with HP and status effects"
- 🛑 "Manages various room operations and state"
- 🛑 "Helper utilities for different features"

**If you can't:** File likely violates SRP

---

## Code Smell Detection (3 minutes)

### Look for These Patterns

#### 1. Long Switch/If-Else Chains

```typescript
// 🛑 God object warning!
switch (action.type) {
  case "AUTH": /* ... */ break;
  case "VALIDATE": /* ... */ break;
  case "PERSIST": /* ... */ break;
  case "BROADCAST": /* ... */ break;
  // ... 10 more cases
}
```

**Ask:** "Should each case be its own module?"

#### 2. Deep Nesting

```typescript
// 🛑 God object warning!
if (user) {
  if (user.isAuthenticated) {
    if (user.hasPermission) {
      if (!resource.isLocked) {
        // Business logic buried 4 levels deep
      }
    }
  }
}
```

**Ask:** "Can we extract functions to reduce nesting?"

#### 3. God Constructor

```typescript
// 🛑 God object warning!
constructor() {
  this.auth = new AuthService();
  this.validator = new Validator();
  this.db = new Database();
  this.cache = new Cache();
  this.logger = new Logger();
  // ... 10 more dependencies
}
```

**Ask:** "Why does one class need 10+ dependencies?"

#### 4. Catch-All Methods

```typescript
// 🛑 God object warning!
handleMessage(msg: Message) {
  // 200 lines of branching logic
}

processData(data: any) {
  // 150 lines of transformation
}
```

**Ask:** "Should this be multiple specific methods?"

---

## Extraction Opportunities (3 minutes)

### Identify Natural Boundaries

Look for clear groups of related code:

#### Example 1: Authentication Block

```typescript
// This could be extracted
const validateToken = () => { /* ... */ };
const refreshToken = () => { /* ... */ };
const revokeToken = () => { /* ... */ };
```

**Suggestion:** "Consider extracting to `auth/TokenValidator.ts`"

#### Example 2: Validation Block

```typescript
// This could be extracted
function validateEmail(email: string) { /* ... */ }
function validatePassword(pwd: string) { /* ... */ }
function validateUsername(user: string) { /* ... */ }
```

**Suggestion:** "Consider extracting to `validators/UserValidator.ts`"

#### Example 3: State Management Block

```typescript
// This could be extracted
const [users, setUsers] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const fetchUsers = () => { /* ... */ };
const addUser = () => { /* ... */ };
```

**Suggestion:** "Consider extracting to `hooks/useUserManagement.ts`"

---

## PR-Specific Checks

### For New Files

- [ ] **Name is specific** - Not "utils.ts", "helpers.ts", "common.ts"
- [ ] **Single responsibility** - Clear, focused purpose
- [ ] **Under 350 LOC** - If over, request split before merge
- [ ] **Has tests** - New code should be tested

### For Modified Files

- [ ] **Not growing a god object** - Check file's total LOC
- [ ] **Related changes** - All changes belong in this file
- [ ] **No mixed concerns** - Not adding unrelated functionality

### For Large Changes (>500 LOC in PR)

- [ ] **Broken into logical commits** - Easy to review
- [ ] **Has refactoring plan** - If creating debt, document payoff plan
- [ ] **Includes tests** - Proportional test coverage

---

## Review Comments Template

### When Requesting Extraction

```markdown
**Structure Concern:** This file is growing large (XXX LOC).

I noticed [RESPONSIBILITY 1] and [RESPONSIBILITY 2] in the same file.

**Suggestion:** Extract [SPECIFIC CODE BLOCK] to a new module:
- `path/to/ModuleName.ts`
- Benefits: [easier testing / clearer separation / etc.]

Would you be open to this extraction?

**Reference:** [PREVENTING_GOD_OBJECTS.md](../guides/PREVENTING_GOD_OBJECTS.md)
```

### When Approving with Caveat

```markdown
**Approved** with follow-up recommendation:

This file is approaching our 350 LOC threshold (currently XXX LOC).

**Follow-up task:** Consider extracting [SPECIFIC BLOCK] in a future PR.

No blocker for this change, but let's prevent further growth.
```

### When Blocking for Size

```markdown
**Requesting changes:** File exceeds 500 LOC without extraction plan.

This file is now XXX LOC and handles multiple responsibilities:
1. [RESPONSIBILITY 1]
2. [RESPONSIBILITY 2]
3. [RESPONSIBILITY 3]

**Required before merge:**
- [ ] Extract at least one responsibility to separate module
- OR [ ] Provide refactoring plan with timeline

**Helpful resources:**
- [REFACTOR_PLAYBOOK.md](../refactoring/REFACTOR_PLAYBOOK.md)
- [PREVENTING_GOD_OBJECTS.md](../guides/PREVENTING_GOD_OBJECTS.md)
```

---

## Special Cases

### Test Files

**Exempt from 350 LOC limit** but still check:

- [ ] **Organized by feature** - Clear `describe` blocks
- [ ] **Not duplicating logic** - Extract test utilities if needed
- [ ] **Over 1000 LOC?** - Consider splitting by test category

### Generated Files

**Exempt from checks** if:

- [ ] **Clearly marked** - Comment at top: "// AUTO-GENERATED"
- [ ] **In gitignore** or special directory
- [ ] **Not hand-edited** - Pure generated code only

### Legacy Files

**Already in baseline** - allowed temporarily:

- [ ] **Has refactoring issue** - Documented in issue tracker
- [ ] **Not growing worse** - No new responsibilities added
- [ ] **Has timeline** - Planned refactoring date

---

## Time Budget

**Total review time by PR size:**

| PR Size | Quick Checks | Deep Review | Total |
|---------|--------------|-------------|-------|
| Small (<100 LOC) | 1 min | 5 min | **6 min** |
| Medium (100-300 LOC) | 2 min | 15 min | **17 min** |
| Large (300-500 LOC) | 3 min | 30 min | **33 min** |
| XL (500+ LOC) | 5 min | 60 min | **65 min** |

**If taking longer:** PR is too big or complex. Request split.

---

## Automation Tips

### GitHub Saved Replies

Create saved replies for common scenarios:

1. **"Structure check failed"** - Template with link to guide
2. **"File too large"** - Template with extraction suggestion
3. **"Follow-up extraction"** - Template for future refactoring

### Browser Extensions

Consider installing:
- **Refined GitHub** - Adds file size to PR files
- **Octotree** - Tree view for easier navigation
- **GitHub File Icons** - Visual file type indicators

### CLI Helpers

Add to `~/.gitconfig`:

```gitconfig
[alias]
  file-sizes = "!git ls-files | xargs wc -l | sort -rn | head -20"
  pr-files = "!git diff --name-only main...HEAD"
  pr-stats = "!git diff --stat main...HEAD"
```

---

## Quick Reference Card

**Print this and keep visible:**

```
┌─────────────────────────────────────────┐
│  GOD OBJECT CODE REVIEW CHEAT SHEET     │
├─────────────────────────────────────────┤
│                                         │
│  FILE SIZE LIMITS:                      │
│  • 0-350 LOC   →  ✅ Healthy           │
│  • 351-500 LOC →  ⚠️ Watch closely     │
│  • 500+ LOC    →  🛑 Require extraction│
│                                         │
│  RED FLAGS:                             │
│  • File does multiple things ("and")    │
│  • Can't explain in 1 sentence          │
│  • Deep nesting (>3 levels)             │
│  • >15 imports                          │
│  • Long switch statements               │
│  • Catch-all method names               │
│                                         │
│  COMMANDS:                              │
│  pnpm lint:structure:enforce            │
│  pnpm baseline:update  (after refactor) │
│                                         │
│  DOCS:                                  │
│  docs/guides/PREVENTING_GOD_OBJECTS.md  │
│  docs/refactoring/REFACTOR_PLAYBOOK.md  │
└─────────────────────────────────────────┘
```

---

**Remember:** God objects are prevented by constant vigilance, not one-time cleanup! 🔍
