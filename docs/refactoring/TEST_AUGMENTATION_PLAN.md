# Test Augmentation Plan - Phase 7 Safety Net

**Created:** 2025-11-15
**Status:** In Progress
**Initiative:** Phase 15 SOLID Refactor - Cross-cutting Safety Practices

---

## Executive Summary

Based on comprehensive test catalogue analysis of **2,346 existing tests**, we've identified **critical gaps** requiring immediate attention to establish a robust refactor safety net. This plan prioritizes server-side domain services and client-side drawing/initiative systems.

### Current State
- **Client Tests:** 1,605 (68.4%)
- **Server Tests:** 677 (28.9%)
- **E2E Tests:** 64 (2.7%)
- **Overall Coverage:** 75% (GOOD, target: 90%)

---

## Priority 1: Server Domain Services (Critical - Week 1)

### 1.1 CharacterService (4 → 15 tests)
**Current Coverage:** 4 tests
**Target:** 15 tests (+11 tests)
**Effort:** 2-3 hours
**File:** `apps/server/src/domains/character/__tests__/CharacterService.test.ts`

**Missing Coverage:**
- [ ] Unclaimed character queries
- [ ] Character deletion cascade effects
- [ ] Death scenario handling
- [ ] Character-to-player binding edge cases
- [ ] Multiple character ownership scenarios
- [ ] Character state persistence
- [ ] Character claiming race conditions
- [ ] Invalid character ID handling
- [ ] Character portrait validation
- [ ] Character stat boundary validation
- [ ] Character update permissions

### 1.2 PlayerService (4 → 12 tests)
**Current Coverage:** 4 tests
**Target:** 12 tests (+8 tests)
**Effort:** 2 hours
**File:** `apps/server/src/domains/player/__tests__/PlayerService.test.ts`

**Missing Coverage:**
- [ ] Status effects lifecycle (application, expiration, removal)
- [ ] DM role transitions and permissions
- [ ] Portrait edge cases (missing, malformed URLs)
- [ ] Player disconnection cleanup
- [ ] Player reconnection state restoration
- [ ] Multiple player sessions edge cases
- [ ] Player HP/stat validation
- [ ] Player voice status management

### 1.3 DiceService (2 → 8 tests)
**Current Coverage:** 2 tests
**Target:** 8 tests (+6 tests)
**Effort:** 2-3 hours
**File:** `apps/server/src/domains/dice/__tests__/DiceService.test.ts`

**Missing Coverage:**
- [ ] Complex dice formula parsing (e.g., "2d6+3d8+5")
- [ ] Roll calculation accuracy verification
- [ ] History persistence and retrieval
- [ ] Invalid formula rejection
- [ ] Roll result edge cases (min/max values)
- [ ] Concurrent roll handling

### 1.4 HeartbeatHandler (4 → 10 tests)
**Current Coverage:** 4 tests
**Target:** 10 tests (+6 tests)
**Effort:** 2 hours
**File:** `apps/server/src/ws/handlers/__tests__/HeartbeatHandler.test.ts`

**Missing Coverage:**
- [ ] Timeout escalation scenarios
- [ ] Recovery after timeout
- [ ] Heartbeat timing edge cases
- [ ] Multiple consecutive timeouts
- [ ] Heartbeat during reconnection
- [ ] Heartbeat auth state coordination

**Priority 1 Total:** +31 tests, 8-10 hours effort

---

## Priority 2: Client Drawing & Initiative (Important - Week 2)

### 2.1 Drawing Tools (14 → 50 tests)
**Current Coverage:** 14 tests (partial erasing only)
**Target:** 50 tests (+36 tests)
**Effort:** 1-2 days
**Files:**
- `apps/client/src/hooks/__tests__/useDrawingTool.test.ts`
- `apps/client/src/features/drawing/__tests__/` (new files)

**Missing Coverage:**
- [ ] Freehand drawing algorithm tests (15 tests)
  - Smooth path generation
  - Point sampling rates
  - Pressure sensitivity (if applicable)
  - Stroke optimization
- [ ] Shape drawing tests (12 tests)
  - Rectangle (creation, drag constraints)
  - Circle (center-radius, drag)
  - Polygon (multi-point, completion)
  - Line (endpoints, snapping)
- [ ] Eraser behavior tests (9 tests)
  - Non-freehand shape erasing
  - Partial vs complete erase
  - Eraser size effects
  - Multi-object erasing

### 2.2 Initiative System (7 → 30 tests)
**Current Coverage:** 7 tests (UI only)
**Target:** 30 tests (+23 tests)
**Effort:** 1 day
**Files:**
- `apps/client/src/hooks/__tests__/useInitiativeModal.test.ts` (expand)
- `apps/client/src/hooks/__tests__/useCombatOrdering.test.ts` (expand)
- `apps/server/src/domains/initiative/__tests__/InitiativeService.test.ts` (new)

**Missing Coverage:**
- [ ] Turn ordering algorithm tests (8 tests)
  - Initiative score sorting
  - Tie-breaking rules
  - Turn advancement logic
  - Round wraparound
- [ ] Initiative state management (8 tests)
  - Add/remove combatant
  - Update initiative scores
  - Death/KO handling
  - Persistence across sessions
- [ ] Server-side initiative logic (7 tests)
  - Initiative broadcast to clients
  - Turn synchronization
  - Concurrent turn updates
  - Initiative reset scenarios

**Priority 2 Total:** +59 tests, 2-3 days effort

---

## Priority 3: Integration & E2E (Enhancement - Week 3-4)

### 3.1 Cross-Domain Integration Tests (+30 tests)
**Effort:** 4-5 days
**Files:** `apps/server/src/__tests__/integration/` (new directory)

**Coverage Needed:**
- [ ] Character → Token → Player lifecycle (10 tests)
  - Create character, spawn token, assign to player
  - Character death updates token
  - Token movement updates character location
- [ ] Combat system integration (10 tests)
  - Initiative → turn order → action resolution
  - Damage → HP update → death state
  - Status effects → initiative modifiers
- [ ] Drawing → Map interaction (10 tests)
  - Drawing on staging zone
  - Drawing selection with tokens
  - Drawing persistence with map transforms

### 3.2 E2E Multi-Client Scenarios (+40 tests)
**Effort:** 3-4 days
**Files:** `apps/e2e/multi-client/` (new directory)

**Coverage Needed:**
- [ ] Multi-client synchronization (15 tests)
  - Concurrent token movement
  - Conflicting drawing operations
  - Initiative updates from multiple clients
- [ ] Network failure recovery (10 tests)
  - Client disconnection/reconnection
  - Message queue flush on reconnect
  - State synchronization after reconnect
- [ ] Concurrent state updates (15 tests)
  - Optimistic updates
  - Server conflict resolution
  - Last-write-wins scenarios

### 3.3 Error Recovery Tests (+10 tests)
**Effort:** 2 hours
**Files:** Various handler tests

**Coverage Needed:**
- [ ] Network timeout handling
- [ ] Partial message handling
- [ ] Out-of-order message delivery
- [ ] Malformed message rejection
- [ ] State corruption recovery

**Priority 3 Total:** +80 tests, 7-9 days effort

---

## Implementation Strategy

### Week 1: Critical Server Services
**Goal:** Establish foundational safety net for core domain services

Day 1-2:
- CharacterService: 4 → 15 tests
- PlayerService: 4 → 12 tests

Day 3-4:
- DiceService: 2 → 8 tests
- HeartbeatHandler: 4 → 10 tests

Day 5: Review & CI verification

### Week 2: Client Features
**Goal:** Cover drawing and initiative system gaps

Day 1-2:
- Drawing tools: 14 → 50 tests (freehand, shapes, eraser)

Day 3-4:
- Initiative system: 7 → 30 tests (client + server)

Day 5: Review & CI verification

### Week 3-4: Integration & E2E (Optional Enhancement)
**Goal:** Establish cross-domain and multi-client safety

Week 3:
- Cross-domain integration tests

Week 4:
- E2E multi-client scenarios
- Error recovery tests

---

## Success Metrics

### Quantitative
- [x] Catalogue complete: 2,346 tests documented
- [ ] Priority 1 complete: +31 tests (677 → 708 server tests)
- [ ] Priority 2 complete: +59 tests (1,605 → 1,664 client tests)
- [ ] Priority 3 complete: +80 tests (64 → 144 E2E tests)
- [ ] Overall coverage: 75% → 90%+

### Qualitative
- [ ] All critical domain services have >80% coverage
- [ ] Drawing tool algorithms are regression-protected
- [ ] Initiative system state machine is verified
- [ ] Multi-client scenarios are tested
- [ ] Error recovery paths are validated

---

## Test Patterns to Follow

### Characterization Tests (Before Changes)
```typescript
describe('CharacterService - Characterization', () => {
  it('should handle character claiming with existing behavior', () => {
    // Lock in current behavior before refactoring
  });
});
```

### Unit Tests (Isolated)
```typescript
describe('CharacterService.claimCharacter', () => {
  it('should assign character to player', () => {
    // Test single responsibility
  });

  it('should reject claiming already-claimed character', () => {
    // Test edge cases
  });
});
```

### Integration Tests (Cross-Service)
```typescript
describe('Character-Token-Player Integration', () => {
  it('should update token when character dies', () => {
    // Test service coordination
  });
});
```

---

## Files to Create/Modify

### New Test Files
- `apps/server/src/domains/initiative/__tests__/InitiativeService.test.ts`
- `apps/client/src/features/drawing/__tests__/freehandDrawing.test.ts`
- `apps/client/src/features/drawing/__tests__/shapeDrawing.test.ts`
- `apps/client/src/features/drawing/__tests__/eraserBehavior.test.ts`
- `apps/server/src/__tests__/integration/characterTokenPlayer.test.ts`
- `apps/server/src/__tests__/integration/combatSystem.test.ts`
- `apps/e2e/multi-client/synchronization.spec.ts`
- `apps/e2e/multi-client/recovery.spec.ts`

### Files to Expand
- `apps/server/src/domains/character/__tests__/CharacterService.test.ts`
- `apps/server/src/domains/player/__tests__/PlayerService.test.ts`
- `apps/server/src/domains/dice/__tests__/DiceService.test.ts`
- `apps/server/src/ws/handlers/__tests__/HeartbeatHandler.test.ts`
- `apps/client/src/hooks/__tests__/useDrawingTool.test.ts`
- `apps/client/src/hooks/__tests__/useInitiativeModal.test.ts`
- `apps/client/src/hooks/__tests__/useCombatOrdering.test.ts`

---

## Risks & Mitigation

### Risk: Test Suite Becomes Too Slow
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Use `test.concurrent` for independent tests
- Mock expensive operations (WebSocket, file I/O)
- Run integration/E2E tests separately in CI

### Risk: Tests Become Brittle
**Probability:** Low
**Impact:** High
**Mitigation:**
- Focus on behavior, not implementation
- Use testing-library best practices ("user-centric")
- Avoid over-mocking; test realistic scenarios

### Risk: Coverage Without Quality
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Code review all new tests
- Require mutation testing for critical paths
- Measure test effectiveness (catch real bugs)

---

## Next Steps

1. ✅ Complete test catalogue
2. 🔄 Begin Priority 1: CharacterService tests
3. ⏳ Continue with PlayerService tests
4. ⏳ Expand DiceService tests
5. ⏳ Augment HeartbeatHandler tests
6. ⏳ Move to Priority 2: Drawing and Initiative
7. ⏳ Optional Priority 3: Integration & E2E

---

**Last Updated:** 2025-11-15
**Status:** In Progress - Starting Priority 1
**Owner:** Engineering Team
**Related:** REFACTOR_ROADMAP.md, REFACTOR_PLAYBOOK.md
