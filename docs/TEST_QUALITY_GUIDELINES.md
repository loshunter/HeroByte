# Test Quality Guidelines

**Purpose:** Maintain the speed and quality gains from the 3-tier test optimization strategy.

**Audience:** All contributors writing or reviewing tests.

---

## Quick Reference Checklist

When writing or reviewing test PRs, verify:

- ✅ Test file < 1000 LOC (ideally < 600 LOC)
- ✅ No single test suite > 150 individual tests
- ✅ Uses `describe.each` for data-driven test cases
- ✅ Uses factory builders instead of inline object creation
- ✅ Uses fake timers (`vi.useFakeTimers()`) for time-dependent tests
- ✅ No `setTimeout` or `setInterval` in tests (use `vi.advanceTimersByTime()`)
- ✅ Shared render functions reduce boilerplate

---

## Red Flags: When to Refactor

### 🚨 **File Size**
**Trigger:** Test file exceeds 1000 LOC

**Action:**
1. Look for repetitive test patterns
2. Extract to `describe.each` with test case data
3. Create factory builders if creating many similar objects

**Example from InitiativeModal.test.tsx:**
- Before: 150 tests, 1850 LOC
- After: 40 tests, ~600 LOC (73% reduction)
- Method: `describe.each` for modifier display, drag interactions, roll values

---

### 🚨 **Test Count**
**Trigger:** Single test file has > 150 tests

**Action:**
Check if multiple tests differ only in input/output values:

```typescript
// ❌ BAD: 3 separate tests
it("should display +3 with green color", () => { ... });
it("should display -2 with red color", () => { ... });
it("should display +0 with green color", () => { ... });

// ✅ GOOD: 1 parameterized test
describe.each([
  { modifier: 3, display: "+3", color: "var(--jrpg-green)" },
  { modifier: -2, display: "-2", color: "var(--jrpg-red)" },
  { modifier: 0, display: "+0", color: "var(--jrpg-green)" },
])("Modifier $modifier", ({ modifier, display, color }) => {
  it(`displays ${display} with correct color`, () => { ... });
});
```

---

### 🚨 **Repeated Setup**
**Trigger:** Same object creation appears in 5+ tests

**Action:** Extract to factory builder

```typescript
// ❌ BAD: Repeated object creation
it("test 1", () => {
  const player = { id: "1", name: "Test", hp: 10, maxHp: 10, ... };
});
it("test 2", () => {
  const player = { id: "1", name: "Test", hp: 10, maxHp: 10, ... };
});

// ✅ GOOD: Factory builder
function createMockPlayer(overrides = {}) {
  return {
    id: "1",
    name: "Test",
    hp: 10,
    maxHp: 10,
    ...overrides,
  };
}

it("test 1", () => {
  const player = createMockPlayer();
});
it("test 2", () => {
  const player = createMockPlayer({ hp: 5 });
});
```

---

### 🚨 **Real Timers**
**Trigger:** Tests using `setTimeout`, `setInterval`, or `await new Promise(resolve => setTimeout(resolve, 1000))`

**Action:** Use fake timers

```typescript
// ❌ BAD: Real timers make tests slow and flaky
it("should auto-dismiss after 3 seconds", async () => {
  renderToast();
  await new Promise(resolve => setTimeout(resolve, 3000));
  expect(onDismiss).toHaveBeenCalled();
}); // Takes 3+ seconds!

// ✅ GOOD: Fake timers are instant and deterministic
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("should auto-dismiss after 3 seconds", () => {
  renderToast();
  vi.advanceTimersByTime(3000);
  expect(onDismiss).toHaveBeenCalled();
}); // Takes ~10ms
```

---

## Code Review Focus Areas

### For Test Authors

1. **Run tests locally** before pushing:
   ```bash
   pnpm test:client  # Run all client tests
   pnpm test         # Run full suite
   ```

2. **Check test runtime** - if a single test file takes >2s, investigate optimization opportunities

3. **Use existing patterns** - review recently optimized test files:
   - `/apps/client/src/features/initiative/components/__tests__/InitiativeModal.test.tsx`
   - `/apps/client/src/features/players/components/__tests__/NpcSettingsMenu.test.tsx`
   - `/apps/client/src/features/players/components/__tests__/PlayerCard.test.tsx`

### For Code Reviewers

1. **Check for repetition** - if you see 3+ similar tests, suggest `describe.each`

2. **Verify fake timers** - any time-based logic should use `vi.useFakeTimers()`

3. **Factory builders** - large inline objects should be extracted to helpers

4. **Test count** - if a PR adds 20+ tests to a single file, ask if parameterization would help

---

## Future Optimization Candidates

The following test files have been identified as strong candidates for future optimization when time permits:

| File | LOC | Tests | Opportunity |
|------|-----|-------|-------------|
| TransformGizmo.test.tsx | 1,235 | 65 | Boundary validation via describe.each |
| Toast.test.tsx | 1,053 | 51 | Toast type variants consolidation |
| RollButton.test.tsx | 921 | 79 | State-variant styling via describe.each |
| HPBar.test.tsx | 805 | 55 | HP state classes parameterization |
| FormInput.test.tsx | 1,015 | 88 | Input type matrix testing |
| CharacterCreationModal.test.tsx | 1,111 | 74 | Form field validation matrix |

These are **not urgent** but represent opportunities to further reduce test runtime and LOC while maintaining coverage.

---

## Resources

- **Test Performance:** [TESTING.md - Test Performance](./TESTING.md#test-performance) - Batching, V8 coverage, parallel execution
- **Testing Architecture Overview:** [README.md - Testing Architecture](../README.md#testing-architecture)
- **Contributing Guide:** [CONTRIBUTING.md - Testing Expectations](../CONTRIBUTING.md#testing-expectations)
- **Example Optimized Tests:**
  - `/apps/client/src/features/initiative/components/__tests__/InitiativeModal.test.tsx`
  - `/apps/client/src/features/players/components/__tests__/PlayerCard.test.tsx`
- **Test Utilities:** `/apps/client/src/test-utils/`

---

## Monitoring Regression

### Weekly Check (Automated in CI)

CI already enforces test quality through:
- Build failure on test failures
- Coverage tracking via Codecov
- Linting and formatting checks

### Monthly Review (Manual)

Once per month, run:

```bash
# Check for large test files
find apps/client/src -name "*.test.tsx" -o -name "*.test.ts" | xargs wc -l | sort -n | tail -20

# Identify slow test files (requires manual timing observation during test run)
pnpm test:client --reporter=verbose
```

Look for files exceeding 1000 LOC or suites taking >2s - these are optimization candidates.

---

## Questions?

If you're unsure whether a test pattern needs optimization:
1. Check if it follows examples in recently optimized files
2. Ask in PR review comments
3. Reference this guide during code review discussions

**Remember:** The goal is maintainable, fast tests - not perfect tests. Use judgment and prioritize readability.
