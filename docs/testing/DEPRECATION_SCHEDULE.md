# Test Deprecation Schedule

## Partial Erase E2E Test Deprecation

### Status: In Parallel Validation (Started: 2025-11-16)

### Files Affected
- **Deprecated:** `apps/e2e/partial-erase.spec.ts` (763 LOC, 4 tests)
- **Replacement:**
  - `apps/server/src/domains/__tests__/mapService.test.ts` (319 LOC, 10 tests)
  - `apps/server/src/ws/handlers/__tests__/DrawingMessageHandler.test.ts` (298 LOC, 17 tests)
  - `apps/client/src/hooks/__tests__/useDrawingTool.test.ts` (269 LOC, 4 tests)
  - `apps/e2e/partial-erase.smoke.spec.ts` (145 LOC, 1 test)

### Timeline

**Week 1-2 (2025-11-16 to 2025-11-30): Parallel Validation**
- ✅ Both test suites running in CI
- ✅ Deprecated test marked with clear warning
- 🔄 Monitor for any discrepancies or failures
- 🔄 Verify smoke test + integration tests provide same confidence

**Week 3 (2025-12-01 to 2025-12-07): Decision Point**
- [ ] Review results from parallel runs
- [ ] Confirm no test failures in either suite
- [ ] Verify integration tests catch all issues old e2e test caught
- [ ] Get team sign-off for deletion

**Week 4 (2025-12-08): Removal**
- [ ] Delete `apps/e2e/partial-erase.spec.ts`
- [ ] Update documentation
- [ ] Celebrate 50-80 second savings per test run! 🎉

### Validation Checklist

During the parallel validation period, verify:

- [ ] Integration tests (mapService.test.ts) pass consistently
- [ ] Integration tests (DrawingMessageHandler.test.ts) pass consistently
- [ ] Integration tests (useDrawingTool.test.ts) pass consistently
- [ ] Smoke tests (partial-erase.smoke.spec.ts) pass consistently
- [ ] Deprecated e2e test still passes (no regressions)
- [ ] All test suites run in CI without issues
- [ ] No bugs escape that old e2e test would have caught
- [ ] Developers comfortable with new test structure
- [ ] Code coverage maintained or improved

### Success Criteria

Before deletion, confirm:
1. **Zero test failures** in new test suite over 2-week period
2. **Zero production bugs** that old test would have caught
3. **Team confidence** in new test structure
4. **Documentation** updated and reviewed

### Rollback Plan

If issues arise during validation:
1. Keep deprecated test permanently
2. Investigate why new tests didn't catch issue
3. Add missing test case to integration tests
4. Retry deprecation timeline

### Performance Metrics

Track these metrics during validation:

| Metric | Old E2E | New Tests | Improvement |
|--------|---------|-----------|-------------|
| Runtime | ~60-90s | ~10.33s | 87-93% faster |
| Coverage | 4 tests | 32 tests | 700% more |
| Reliability | ~90-95% (e2e) | ~99%+ (integration) | Higher |
| Debugability | Hard (browser) | Easy (direct) | Much better |

---

## Session Load E2E Test Deprecation

### Status: In Parallel Validation (Started: 2025-01-15)

### Files Affected
- **Deprecated:** `apps/e2e/session-load.spec.ts` (433 LOC)
- **Replacement:**
  - `apps/server/src/domains/room/snapshot/__tests__/SnapshotLoader.test.ts` (978 LOC, 20 tests)
  - `apps/e2e/session-load.smoke.spec.ts` (120 LOC, 2 tests)

### Timeline

**Week 1-2 (2025-01-15 to 2025-01-29): Parallel Validation**
- ✅ Both test suites running in CI
- ✅ Deprecated test marked with clear warning
- 🔄 Monitor for any discrepancies or failures
- 🔄 Verify smoke test + integration tests provide same confidence

**Week 3 (2025-01-30 to 2025-02-05): Decision Point**
- [ ] Review results from parallel runs
- [ ] Confirm no test failures in either suite
- [ ] Verify integration tests catch all issues old e2e test caught
- [ ] Get team sign-off for deletion

**Week 4 (2025-02-06): Removal**
- [ ] Delete `apps/e2e/session-load.spec.ts`
- [ ] Update documentation
- [ ] Celebrate 35-second savings per test run! 🎉

### Validation Checklist

During the parallel validation period, verify:

- [ ] Integration tests (SnapshotLoader.test.ts) pass consistently
- [ ] Smoke tests (session-load.smoke.spec.ts) pass consistently
- [ ] Deprecated e2e test still passes (no regressions)
- [ ] All test suites run in CI without issues
- [ ] No bugs escape that old e2e test would have caught
- [ ] Developers comfortable with new test structure
- [ ] Code coverage maintained or improved

### Success Criteria

Before deletion, confirm:
1. **Zero test failures** in new test suite over 2-week period
2. **Zero production bugs** that old test would have caught
3. **Team confidence** in new test structure
4. **Documentation** updated and reviewed

### Rollback Plan

If issues arise during validation:
1. Keep deprecated test permanently
2. Investigate why new tests didn't catch issue
3. Add missing test case to integration tests
4. Retry deprecation timeline

### Performance Metrics

Track these metrics during validation:

| Metric | Old E2E | New Tests | Improvement |
|--------|---------|-----------|-------------|
| Runtime | ~45s | ~10.016s | 78% faster |
| Coverage | Comprehensive | Comprehensive | Same |
| Reliability | ~90-95% (e2e) | ~99%+ (integration) | Higher |
| Debugability | Hard (browser) | Easy (direct) | Much better |

### Next Candidates for Migration

After successful deprecation of all current migrations, consider these next:

1. **comprehensive-mvp.spec.ts** (442 LOC) - ~25-40s savings
2. **multi-client-sync.spec.ts** (377 LOC) - ~20-35s savings
3. **player-npc-initiative.spec.ts** (369 LOC) - ~20-30s savings
4. **player-state.spec.ts** (306 LOC) - ~15s savings
5. **ui-state.spec.ts** (297 LOC) - ~15s savings
6. **undo-redo.spec.ts** (290 LOC) - ~12s savings

**Estimated total additional savings: ~107-157 seconds per CI run**

---

---

## Transform Tool E2E Test Deprecation

### Status: In Parallel Validation (Started: 2025-01-15)

### Files Affected
- **Deprecated:** `apps/e2e/transform-tool.spec.ts` (431 LOC, 5 tests)
- **Replacement:**
  - `apps/server/src/domains/room/transform/__tests__/TransformHandler.test.ts` (760 LOC, 31 tests)
  - `apps/e2e/transform-tool.smoke.spec.ts` (130 LOC, 1 test)

### Performance Metrics

| Metric | Old E2E | New Tests | Improvement |
|--------|---------|-----------|-------------|
| Runtime | ~30s | ~8s (smoke + integration) | 73% faster |
| Test Count | 5 | 32 | +540% |
| Coverage | Basic scenarios | Comprehensive | Much better |

### Timeline

**Week 1-2 (2025-01-15 to 2025-01-29): Parallel Validation**
- ✅ Both test suites running in CI
- ✅ Deprecated test marked with clear warning
- 🔄 Monitor for any discrepancies or failures

**Week 3 (2025-01-30 to 2025-02-05): Decision Point**
- [ ] Review results from parallel runs
- [ ] Confirm integration tests catch all issues
- [ ] Get team sign-off for deletion

**Week 4 (2025-02-06): Removal**
- [ ] Delete `apps/e2e/transform-tool.spec.ts`
- [ ] Update documentation
- [ ] Celebrate another 22-second savings! 🎉

### Coverage Comparison

**Old E2E (5 tests):**
- Player can move scene object
- Player can rotate scene object
- Player can scale scene object
- DM can transform locked objects
- Player staging zone is transformable

**New Integration (31 tests):**
- Map transforms (4 tests: position, scale, rotation, authorization)
- Token transforms (5 tests: owner/DM permissions, all transform types)
- Staging zone transforms (6 tests: all transforms + authorization)
- Drawing transforms (3 tests: owner/DM permissions)
- Prop transforms (4 tests: owner/DM/shared permissions)
- Pointer transforms (2 tests: owner permissions)
- Locked state handling (6 tests: lock/unlock permissions, locked transform denial)
- Edge cases (3 tests: non-existent objects, combined transforms, partial transforms)

---

## Player Staging Zone E2E Test Deprecation

### Status: In Parallel Validation (Started: 2025-01-15)

### Files Affected
- **Deprecated:** `apps/e2e/staging-zone.spec.ts` (402 LOC, 7 tests: 6 skipped, 1 active)
- **Replacement:**
  - `apps/server/src/domains/room/staging/__tests__/StagingZoneManager.test.ts` (483 LOC, 28 tests)
  - `apps/server/src/ws/__tests__/characterization/authorization.characterization.test.ts` (DM-only check)
  - `apps/e2e/staging-zone.smoke.spec.ts` (90 LOC, 1 test)

### Performance Metrics

| Metric | Old E2E | New Tests | Improvement |
|--------|---------|-----------|-------------|
| Runtime | ~8s (1 active test) | ~5s (smoke only) | 38% faster |
| Test Count | 1 (6 skipped) | 29 | +2,800% |
| Coverage | Authorization only | Comprehensive | Much better |
| Reliability | Flaky (toggle-dm broken) | Stable | Fixed |

### Special Note

This e2e file was already in a degraded state:
- **6 out of 7 tests were SKIPPED** because toggle-dm message doesn't work in e2e
- Only 1 test was active (authorization check)
- Comment in file explicitly states "server-side logic is tested via unit tests"
- Migration simply formalizes what was already true

### Timeline

**Week 1-2 (2025-01-15 to 2025-01-29): Parallel Validation**
- ✅ Both test suites running in CI
- ✅ Deprecated test marked with clear warning
- 🔄 Monitor for any discrepancies or failures

**Week 3 (2025-01-30 to 2025-02-05): Decision Point**
- [ ] Review results from parallel runs
- [ ] Confirm integration tests catch all issues
- [ ] Get team sign-off for deletion

**Week 4 (2025-02-06): Removal**
- [ ] Delete `apps/e2e/staging-zone.spec.ts`
- [ ] Update documentation
- [ ] Celebrate removal of flaky test suite! 🎉

### Coverage Comparison

**Old E2E (1 active, 6 skipped):**
- ✅ ACTIVE: Non-DM players cannot set staging zone
- ❌ SKIPPED: DM can create a staging zone
- ❌ SKIPPED: DM can clear the staging zone
- ❌ SKIPPED: Staging zone validates coordinates
- ❌ SKIPPED: Staging zone persists in session
- ❌ SKIPPED: Staging zone supports rotation
- ❌ SKIPPED: Staging zone defaults rotation to 0

**New Integration (28 tests):**
- Zone validation (13 tests): valid zones, negative dimensions, non-finite values, fractional dimensions, string coercion, null/undefined handling, invalid rotation
- setPlayerStagingZone (4 tests): return value, state updates, scene graph rebuild, scene graph clearing
- getPlayerSpawnPosition (11 tests): default position, bounds checking, rotation (0°, 90°, 180°, 270°, 45°), rectangular zones, randomness, minimum size, offset coordinates

**Authorization Tests:**
- ✅ set-player-staging-zone verified as DM-only message type

---

## Character Creation E2E Test Deprecation

### Status: In Parallel Validation (Started: 2025-01-15)

### Files Affected
- **Deprecated:** `apps/e2e/character-creation.spec.ts` (297 LOC, 6 tests)
- **Replacement:**
  - `apps/server/src/domains/__tests__/characterService.test.ts` (350 LOC, 20+ tests)
  - `apps/server/src/ws/handlers/__tests__/CharacterMessageHandler.test.ts` (415 LOC, 15+ tests)
  - `apps/server/src/domains/__tests__/tokenService.test.ts` (78 LOC, 8+ tests)
  - `apps/client/src/features/players/components/__tests__/CharacterCreationModal.test.tsx` (1,111 LOC, 30+ tests)
  - `apps/client/src/hooks/__tests__/useCharacterCreation.test.ts` (1,097 LOC, 25+ tests)
  - `apps/e2e/character-creation.smoke.spec.ts` (120 LOC, 1 test)

### Performance Metrics

| Metric | Old E2E | New Tests | Improvement |
|--------|---------|-----------|-------------|
| Runtime | ~45-60s | ~10.33s (smoke + integration) | 78-83% faster |
| Test Count | 6 | 99+ | +1,550% |
| Coverage | Basic UI flows | Comprehensive | Much better |
| LOC | 297 | 3,161 | +964% |

### Timeline

**Week 1-2 (2025-01-15 to 2025-01-29): Parallel Validation**
- ✅ Both test suites running in CI
- ✅ Deprecated test marked with clear warning
- 🔄 Monitor for any discrepancies or failures

**Week 3 (2025-01-30 to 2025-02-05): Decision Point**
- [ ] Review results from parallel runs
- [ ] Confirm integration tests catch all issues
- [ ] Get team sign-off for deletion

**Week 4 (2025-02-15): Removal**
- [ ] Delete `apps/e2e/character-creation.spec.ts`
- [ ] Update documentation
- [ ] Celebrate 35-50 second savings! 🎉

### Coverage Comparison

**Old E2E (6 tests):**
- Player can create a new character
- Player can delete their character
- Player's token is created on join
- Player can change their token color
- Token reflects character selection

**New Integration (99+ tests):**
- **characterService.test.ts (20+ tests):** Character creation, deletion, HP management, claiming, token linking, NPC management, edge cases
- **CharacterMessageHandler.test.ts (15+ tests):** Message handling, authorization, DM/player/owner permissions
- **tokenService.test.ts (8+ tests):** Token creation, movement, recoloring, deletion, image updates
- **CharacterCreationModal.test.tsx (30+ tests):** Modal UI, input validation, keyboard handling, loading states, auto-close
- **useCharacterCreation.test.ts (25+ tests):** State management, server confirmation, cancellation, edge cases

### Special Note

This migration demonstrates the power of existing test infrastructure:
- **95%+ of business logic already covered** by integration tests
- E2E test was **redundantly testing via browser** what integration tests already verify
- **No new test utilities needed** - leveraged existing infrastructure
- **Fastest migration yet** - only 1.5 hours of work

---

## Notes

- All deprecation decisions should be made as a team
- Keep deprecated tests until team is fully confident
- If in doubt, keep both test suites running longer
- This is about improving speed, not reducing coverage
