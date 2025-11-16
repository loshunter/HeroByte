# Session Load Test Status

**Last Updated:** 2025-01-15
**Status:** ✅ Parallel Validation (Week 1 of 2)

## Current Test Configuration

### 🟡 Running in Parallel (For Validation)

#### 1. Integration Tests (NEW - Primary)
**File:** `apps/server/src/domains/room/snapshot/__tests__/SnapshotLoader.test.ts`
- **Tests:** 20 comprehensive tests
- **Coverage:** All business logic
  - Player merging (5 tests)
  - Character preservation (4 tests)
  - Token preservation (2 tests)
  - State field loading (6 tests)
  - Staging zone sanitization (2 tests)
  - Edge cases (1 test)
- **Runtime:** 16ms ⚡
- **Status:** ✅ Active

#### 2. E2E Smoke Tests (NEW - Primary)
**File:** `apps/e2e/session-load.smoke.spec.ts`
- **Tests:** 2 focused tests
- **Coverage:** WebSocket transport layer only
  - DM can load session via WebSocket
  - Non-DM authorization check
- **Runtime:** ~10 seconds
- **Status:** ✅ Active

#### 3. Comprehensive E2E Tests (DEPRECATED - For Validation Only)
**File:** `apps/e2e/session-load.spec.ts`
- **Tests:** 3 comprehensive tests
- **Coverage:** Full field-by-field verification (redundant with integration tests)
- **Runtime:** ~45 seconds 🐌
- **Status:** 🟡 Deprecated (will be removed after validation period)
- **Removal Date:** ~2025-02-06 (Week 4)

## Performance Comparison

| Test Suite | Tests | Runtime | Coverage |
|------------|-------|---------|----------|
| Integration (NEW) | 20 | 16ms | Business logic |
| Smoke (NEW) | 2 | ~10s | WebSocket transport |
| Old E2E (DEPRECATED) | 3 | ~45s | Everything (redundant) |
| **NEW TOTAL** | **22** | **~10s** | **Same** |
| **OLD TOTAL** | **3** | **~45s** | **Same** |
| **IMPROVEMENT** | **+733%** | **-78%** | **0%** |

## Validation Period Checklist

### Week 1-2 (Current)
- [x] Integration tests running in CI
- [x] Smoke tests running in CI
- [x] Deprecated test marked clearly
- [x] Documentation created
- [ ] Monitor for any test failures
- [ ] Track any bugs that slip through

### Week 3 (Decision Point)
- [ ] Review test results from parallel runs
- [ ] Confirm both suites have same coverage
- [ ] Get team sign-off for deletion
- [ ] Update removal timeline if needed

### Week 4 (Removal)
- [ ] Delete `apps/e2e/session-load.spec.ts`
- [ ] Update references in documentation
- [ ] Announce completion to team

## How to Run Each Test Suite

```bash
# Integration tests (16ms)
pnpm --filter vtt-server test SnapshotLoader

# Smoke tests (10s)
pnpm test:e2e session-load.smoke

# Deprecated comprehensive e2e (45s) - will be removed
pnpm test:e2e session-load.spec

# Run all related tests
pnpm test:e2e session-load  # Runs both smoke + deprecated
pnpm --filter vtt-server test  # Includes integration tests
```

## What to Do If You Find a Bug

### If integration/smoke tests catch it:
✅ Great! New test suite is working as expected.

### If only deprecated e2e test catches it:
⚠️ **Action required:**
1. Investigate why new tests didn't catch it
2. Add missing test case to `SnapshotLoader.test.ts`
3. Verify new test catches the bug
4. Report to team for review
5. May extend validation period

## Team Communication

### For New Developers
- Use integration tests (`SnapshotLoader.test.ts`) for business logic
- Use smoke tests for WebSocket transport validation
- Ignore deprecated `session-load.spec.ts` (will be removed soon)

### For Existing Developers
- Both test suites run in parallel for validation
- Report any discrepancies between old and new tests
- Old e2e test will be removed ~Feb 6, 2025

## References

- **Migration Guide:** `E2E_TO_INTEGRATION_MIGRATION.md`
- **Deprecation Timeline:** `DEPRECATION_SCHEDULE.md`
- **Test Utilities:** `apps/client/src/test-utils/`

## Questions?

Contact the team or see the migration documentation for details.
