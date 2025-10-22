# Refactor Playbook Template

**Purpose:** Standardized process for extracting modules from god files
**Audience:** Engineers performing Phase 15 refactoring
**Status:** Active Template

---

## Overview

This playbook provides a step-by-step checklist for safely extracting a module from an oversized file. Follow this process for each extraction to ensure:

- ✅ Behavior preservation
- ✅ Test coverage maintenance
- ✅ Clean interfaces
- ✅ Documentation completeness
- ✅ Team review readiness

---

## Playbook Checklist

### Pre-Extraction Phase

#### 1. Select Target Module

- [ ] Identify module from REFACTOR_ROADMAP.md
- [ ] Verify extraction order (dependencies extracted first)
- [ ] Review complexity score and estimated effort
- [ ] Check if similar extractions have been completed (learn from them)

**Document:**
```markdown
## Target Module: [Module Name]
- **Source File:** [path/to/god-file.tsx]
- **Line Range:** [start-end]
- **Target Path:** [path/to/new-module.tsx]
- **Dependencies:** [list]
- **Estimated Effort:** [X days]
- **Complexity:** [1-5]
```

#### 2. Understand Current Behavior

- [ ] Read the code section to be extracted (line range from roadmap)
- [ ] Identify all inputs (props, state, context)
- [ ] Identify all outputs (return values, side effects, renders)
- [ ] Map dependencies (imports, hooks, utilities)
- [ ] Document side effects (network calls, DOM manipulation, window APIs)
- [ ] Note any TypeScript `any` types or suppressed errors

**Document:**
```markdown
## Current Behavior
### Inputs
- [List all inputs with types]

### Outputs
- [List all outputs with types]

### Side Effects
- [List all side effects]

### Known Issues
- [Any bugs or technical debt in this code]
```

#### 3. Create Characterization Tests

- [ ] Write tests that capture current behavior **BEFORE extraction**
- [ ] Test happy paths (primary use cases)
- [ ] Test edge cases (nulls, empty arrays, invalid inputs)
- [ ] Test error cases (failures, timeouts)
- [ ] Test integration points (parent component interactions)
- [ ] Achieve baseline coverage (>60% minimum)
- [ ] All tests GREEN before proceeding

**Test Location:** `__tests__/characterization/[module-name].test.ts`

```typescript
/**
 * Characterization tests for [Module Name]
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: [path/to/god-file.tsx:line-range]
 * Target: [path/to/new-module.tsx]
 */

describe('[Module Name] - Characterization', () => {
  describe('happy paths', () => {
    it('should [behavior]', () => {
      // Test current behavior
    });
  });

  describe('edge cases', () => {
    it('should [behavior]', () => {
      // Test edge case
    });
  });

  describe('error cases', () => {
    it('should [behavior]', () => {
      // Test error handling
    });
  });
});
```

**Commit:** `test: add characterization tests for [Module Name]`

---

### Extraction Phase

#### 4. Create New Module File

- [ ] Create file at target path from roadmap
- [ ] Add file header with JSDoc
- [ ] Set up basic structure (imports, types, exports)
- [ ] Copy code from source file (exact copy first)
- [ ] DO NOT modify logic yet

**File Header Template:**
```typescript
/**
 * [Module Name]
 *
 * [Brief description of responsibility]
 *
 * Extracted from: [path/to/god-file.tsx] (lines [start-end])
 * Extraction date: [YYYY-MM-DD]
 *
 * @module [module-path]
 */
```

**Commit:** `refactor: create [Module Name] stub`

#### 5. Define Clean Interface

- [ ] Identify minimum required props/parameters
- [ ] Remove unnecessary props (prefer explicit over implicit)
- [ ] Use TypeScript interfaces (no inline types)
- [ ] Document each prop with JSDoc
- [ ] Consider default values for optional props
- [ ] Validate prop types match usage

**Interface Template:**
```typescript
/**
 * Props for [Component/Hook Name]
 */
export interface [Name]Props {
  /**
   * [Description]
   * @example [usage example]
   */
  [propName]: [Type];

  /**
   * [Description]
   * @default [default value if applicable]
   */
  [optionalProp]?: [Type];
}
```

**Commit:** `refactor: define [Module Name] interface`

#### 6. Extract and Isolate Logic

- [ ] Cut code from source file
- [ ] Paste into new module
- [ ] Import dependencies
- [ ] Fix import paths
- [ ] Rename internal variables for clarity
- [ ] Remove unused code
- [ ] Extract magic numbers to constants
- [ ] Fix TypeScript errors
- [ ] Ensure no `any` types introduced

**Checklist:**
- [ ] All imports resolved
- [ ] No unused variables
- [ ] No linting errors
- [ ] TypeScript strict mode passing
- [ ] Constants extracted and named

**Commit:** `refactor: extract [Module Name] logic`

#### 7. Update Source File

- [ ] Import new module
- [ ] Replace extracted code with module usage
- [ ] Pass required props/arguments
- [ ] Verify integration compiles
- [ ] Remove unused imports from source
- [ ] Verify source file still functions

**Commit:** `refactor: integrate [Module Name] into [Source File]`

---

### Verification Phase

#### 8. Run Tests

- [ ] Run characterization tests → **Must be GREEN**
- [ ] Run unit tests for new module → **Must be GREEN**
- [ ] Run full test suite → **No new failures**
- [ ] Check test coverage → **Maintain or improve >80%**
- [ ] Run E2E smoke tests → **All passing**

**If tests fail:**
1. Do NOT proceed
2. Debug issue in new module
3. Compare with original code
4. Fix and re-run tests
5. Only proceed when ALL tests GREEN

**Commit:** `test: verify [Module Name] extraction`

#### 9. Manual Verification

- [ ] Start dev server (`pnpm dev`)
- [ ] Navigate to feature using extracted module
- [ ] Test happy paths manually
- [ ] Test edge cases manually
- [ ] Test error cases manually
- [ ] Check browser console for errors
- [ ] Verify network calls unchanged
- [ ] Check for visual regressions

**Verification Checklist:**
- [ ] UI renders correctly
- [ ] Interactions work as expected
- [ ] No console errors
- [ ] No network errors
- [ ] Performance unchanged (no lag)

**If issues found:**
- [ ] Document issue
- [ ] Fix in new module
- [ ] Re-run tests
- [ ] Re-verify manually

**Commit:** `refactor: manual verification complete for [Module Name]`

#### 10. Enhance Testing

- [ ] Add unit tests for new module (if not covered)
- [ ] Test new module in isolation
- [ ] Test props validation
- [ ] Test error boundaries
- [ ] Achieve >80% coverage for new module
- [ ] Update characterization tests if behavior improved

**Test File Location:** `[module-dir]/__tests__/[module-name].test.ts`

**Commit:** `test: add comprehensive tests for [Module Name]`

---

### Documentation Phase

#### 11. Document Module

- [ ] Add module-level JSDoc
- [ ] Document all exported functions/components
- [ ] Document all props/parameters
- [ ] Add usage examples
- [ ] Document edge cases
- [ ] Document error handling
- [ ] Add `@see` links to related modules

**Documentation Template:**
```typescript
/**
 * [Module Name]
 *
 * [Detailed description of what this module does and why it exists]
 *
 * @example
 * ```tsx
 * const [result] = useMyHook({
 *   prop1: 'value',
 *   prop2: 123
 * });
 * ```
 *
 * @see {@link RelatedModule} for [relationship]
 * @module [module-path]
 */
```

**Commit:** `docs: document [Module Name]`

#### 12. Update Related Documentation

- [ ] Update REFACTOR_ROADMAP.md (mark module as complete)
- [ ] Update CONTRIBUTING.md (if new patterns introduced)
- [ ] Update README.md (if public API changed)
- [ ] Update architecture diagrams (if applicable)
- [ ] Add module to feature index (if applicable)

**Commit:** `docs: update project docs for [Module Name]`

---

### Review Phase

#### 13. Self Review

- [ ] Re-read extracted code with fresh eyes
- [ ] Check for code smells (long functions, deep nesting, etc.)
- [ ] Verify SRP (module has ONE responsibility)
- [ ] Check for hardcoded values
- [ ] Verify error handling
- [ ] Check for proper logging
- [ ] Ensure accessibility (for UI components)
- [ ] Verify mobile responsiveness (for UI components)

**Code Quality Checklist:**
- [ ] Functions under 50 lines
- [ ] Nesting under 3 levels
- [ ] Clear variable names
- [ ] No magic numbers
- [ ] Error handling present
- [ ] No console.log statements
- [ ] No commented-out code

**If issues found:**
- [ ] Refactor as needed
- [ ] Re-run tests
- [ ] Update documentation

**Commit:** `refactor: address self-review feedback for [Module Name]`

#### 14. Prepare PR

- [ ] Squash WIP commits if needed
- [ ] Write clear commit messages
- [ ] Update PR template
- [ ] Reference roadmap in PR description
- [ ] Add before/after LOC metrics
- [ ] Add screenshots/videos (if UI changed)
- [ ] Tag relevant reviewers

**PR Title:** `refactor: extract [Module Name] from [Source File]`

**PR Description Template:**
```markdown
## Refactor: [Module Name]

**Part of:** Phase 15 SOLID Refactor Initiative
**Roadmap Reference:** [REFACTOR_ROADMAP.md section]

### Summary
Extracted [Module Name] from [Source File] to improve maintainability and adhere to SRP.

### Changes
- **New Module:** `[path/to/new-module.tsx]` ([X] LOC)
- **Source File:** `[path/to/god-file.tsx]` (reduced from [X] LOC to [Y] LOC)
- **Net Reduction:** [Z] LOC

### Testing
- [X] Characterization tests GREEN
- [X] Unit tests added (coverage: [X]%)
- [X] E2E smoke tests passing
- [X] Manual verification complete

### Checklist
- [X] All tests passing
- [X] No new linting errors
- [X] Documentation updated
- [X] Self-review complete
- [X] No behavior changes

### Related Issues
Closes #[issue-number]
Part of #[epic-number]
```

#### 15. Address Review Feedback

- [ ] Respond to all comments
- [ ] Make requested changes
- [ ] Re-run tests after changes
- [ ] Push updates
- [ ] Request re-review

**Commit:** `refactor: address review feedback for [Module Name]`

---

### Post-Merge Phase

#### 16. Verify in Production

- [ ] Monitor CI after merge
- [ ] Check deployed environment
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Verify feature still works in prod

**If issues detected:**
- [ ] Create hotfix branch
- [ ] Fix issue
- [ ] Deploy hotfix
- [ ] Document lesson learned

#### 17. Update Tracking

- [ ] Mark module complete in roadmap
- [ ] Update project board
- [ ] Update baseline if LOC threshold changed
- [ ] Share learnings with team
- [ ] Update playbook if new patterns discovered

**Commit:** `docs: mark [Module Name] extraction complete`

---

## Common Patterns

### Pattern 1: Extracting a Hook

**Use When:** Logic can be reused, has complex state management

**Structure:**
```typescript
// hooks/useSomething.ts
export interface UseSomethingOptions {
  // Options
}

export interface UseSomethingReturn {
  // Return values
}

export function useSomething(options: UseSomethingOptions): UseSomethingReturn {
  // Implementation
  return {
    // Return object
  };
}
```

**Testing:**
```typescript
// Use @testing-library/react-hooks
import { renderHook } from '@testing-library/react-hooks';
import { useSomething } from './useSomething';

describe('useSomething', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSomething({}));
    expect(result.current).toMatchObject({
      // Expected state
    });
  });
});
```

### Pattern 2: Extracting a Component

**Use When:** UI can be reused, has complex rendering logic

**Structure:**
```typescript
// components/Something.tsx
export interface SomethingProps {
  // Props
}

export function Something({ ...props }: SomethingProps): JSX.Element {
  // Implementation
  return (
    // JSX
  );
}
```

**Testing:**
```typescript
// Use @testing-library/react
import { render, screen } from '@testing-library/react';
import { Something } from './Something';

describe('Something', () => {
  it('should render correctly', () => {
    render(<Something prop="value" />);
    expect(screen.getByText('value')).toBeInTheDocument();
  });
});
```

### Pattern 3: Extracting Action Creators

**Use When:** Multiple functions wrap sendMessage

**Structure:**
```typescript
// hooks/useSomethingActions.ts
export interface UseSomethingActionsOptions {
  sendMessage: (msg: ClientMessage) => void;
}

export function useSomethingActions({ sendMessage }: UseSomethingActionsOptions) {
  const doSomething = useCallback((id: string) => {
    sendMessage({ t: 'something', id });
  }, [sendMessage]);

  return {
    doSomething,
  };
}
```

### Pattern 4: Extracting Event Handlers

**Use When:** Complex event delegation logic

**Structure:**
```typescript
// hooks/useSomethingEvents.ts
export interface UseSomethingEventsOptions {
  onEvent: (data: EventData) => void;
  enabled: boolean;
}

export function useSomethingEvents({ onEvent, enabled }: UseSomethingEventsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: Event) => {
      // Handle event
      onEvent(data);
    };

    window.addEventListener('event', handler);
    return () => window.removeEventListener('event', handler);
  }, [onEvent, enabled]);
}
```

### Pattern 5: Extracting Layout Components

**Use When:** Large JSX blocks that orchestrate other components

**Structure:**
```typescript
// layouts/SomethingLayout.tsx
export interface SomethingLayoutProps {
  // All state needed for rendering
  children?: React.ReactNode;
}

export function SomethingLayout({ ...props }: SomethingLayoutProps): JSX.Element {
  // Pure rendering logic only
  return (
    <div>
      {/* Compose other components */}
    </div>
  );
}
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Modifying Logic During Extraction

**Problem:** Changing behavior while extracting makes it hard to verify correctness

**Solution:** Extract first, refactor second (two separate commits)

### ❌ Anti-Pattern 2: Creating God Hooks

**Problem:** Extracting too much into one hook creates new god file

**Solution:** Follow SRP, create multiple focused hooks

### ❌ Anti-Pattern 3: Skipping Tests

**Problem:** No safety net for regressions

**Solution:** Always write characterization tests BEFORE extraction

### ❌ Anti-Pattern 4: Unclear Interfaces

**Problem:** Passing entire snapshot or too many props

**Solution:** Pass only what's needed, use ISP

### ❌ Anti-Pattern 5: Incomplete Documentation

**Problem:** Future developers don't understand module purpose

**Solution:** Document "why" not just "what"

### ❌ Anti-Pattern 6: Premature Abstraction

**Problem:** Creating reusable patterns too early

**Solution:** Extract 2-3 similar patterns, then abstract

### ❌ Anti-Pattern 7: Breaking Changes

**Problem:** Changing public API during refactor

**Solution:** Preserve interfaces, make breaking changes separately

---

## Troubleshooting

### Issue: Tests Failing After Extraction

**Symptoms:** Characterization tests fail after extraction

**Diagnosis:**
1. Check if behavior actually changed
2. Verify all props passed correctly
3. Check for missing dependencies
4. Verify state initialization
5. Check for side effect ordering

**Solution:**
- Compare original code line-by-line
- Use debugger to trace execution
- Check for missing useCallback/useMemo
- Verify effect dependency arrays

### Issue: TypeScript Errors

**Symptoms:** Type errors in new module

**Diagnosis:**
1. Check for missing imports
2. Verify type definitions
3. Check for any types
4. Verify generic constraints

**Solution:**
- Import all types explicitly
- Use strict mode
- Add proper type annotations
- No `any` types allowed

### Issue: Circular Dependencies

**Symptoms:** Import errors, webpack warnings

**Diagnosis:**
1. Check import chains
2. Verify dependency graph
3. Check for bidirectional imports

**Solution:**
- Hoist shared types to separate file
- Use dependency injection
- Reorder extractions
- Consider extracting shared dependencies first

### Issue: Performance Regression

**Symptoms:** UI lag, slow rendering

**Diagnosis:**
1. Profile before/after with React DevTools
2. Check for missing memoization
3. Verify effect dependencies
4. Check for unnecessary re-renders

**Solution:**
- Add useCallback where needed
- Add useMemo for expensive calculations
- Verify React.memo usage
- Check effect dependency arrays

---

## Success Criteria

### Module Extraction is Complete When:

- ✅ All checklist items completed
- ✅ All tests passing (including characterization tests)
- ✅ Manual verification successful
- ✅ Documentation complete
- ✅ PR approved and merged
- ✅ No production issues
- ✅ Roadmap updated
- ✅ Baseline updated (if applicable)

---

## Template Usage Example

See [EXAMPLE_EXTRACTION.md](./EXAMPLE_EXTRACTION.md) for a completed playbook example.

---

**Last Updated:** 2025-10-20
**Version:** 1.0.0
**Related Documents:**
- [REFACTOR_ROADMAP.md](./REFACTOR_ROADMAP.md)
- [TODO.md Phase 15](/TODO.md#phase-15-solid-refactor-initiative-future)
- [CONTRIBUTING.md](/CONTRIBUTING.md#structural-guardrails)
