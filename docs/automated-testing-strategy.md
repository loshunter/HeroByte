# Automated Testing Strategy

## Overview

This document outlines our strategy for replacing manual two-browser testing with automated E2E tests using Playwright.

## Test Coverage

### 1. Authentication Testing
- **Manual Test**: Open two browsers, test room password and DM password
- **Automated**: `comprehensive-mvp.spec.ts` - Test 1
  - Validates incorrect password rejection
  - Validates correct password acceptance
  - Validates DM elevation with DM password
  - Verifies DM UI appears after elevation

### 2. Drawing Tools
- **Manual Test**: Click drawing tools, draw on canvas, verify persistence
- **Automated**: `comprehensive-mvp.spec.ts` - Tests 2-3
  - Test 2: Freehand drawing creation and persistence
  - Test 3: Partial erase functionality

### 3. Multi-Select Operations
- **Manual Test**: Select multiple objects, perform group operations
- **Automated**: `comprehensive-mvp.spec.ts` - Test 4
  - Marquee selection (drag rectangle)
  - Group manipulation
  - Lock/unlock operations

### 4. Session Save/Load
- **Manual Test**: Save session, reload, verify state restored
- **Automated**: `comprehensive-mvp.spec.ts` - Test 6
  - Save session to file
  - Verify download
  - Load session and verify state

### 5. Dice Rolling
- **Manual Test**: Roll dice, check log for results
- **Automated**: `comprehensive-mvp.spec.ts` - Test 5
  - Open dice roller
  - Perform roll
  - Verify result appears in log

### 6. Two-Browser Synchronization
- **Manual Test**: Open two browsers, perform action in one, verify other sees it
- **Automated**: `comprehensive-mvp.spec.ts` - Test 7
  - Creates two browser contexts
  - Player 1 draws something
  - Player 2 should see the drawing
  - Validates real-time WebSocket sync

### 7. Voice Chat
- **Manual Test**: Enable mic, verify indicator appears
- **Automated**: `comprehensive-mvp.spec.ts` - Test 8
  - Checks for mic controls presence
  - Validates UI elements exist

### 8. Reconnection Handling
- **Manual Test**: Disconnect and reconnect
- **Automated**: `comprehensive-mvp.spec.ts` - Test 9
  - Simulates disconnect via page reload
  - Reconnects with password
  - Verifies state restoration

### 9. Player State Persistence
- **Manual Test**: Make changes, reload, verify persisted
- **Automated**: `comprehensive-mvp.spec.ts` - Test 10
  - Modifies player state (HP, etc.)
  - Reloads page
  - Verifies state persists

## Running Automated Tests

### Prerequisites
```bash
# Ensure servers are running
pnpm dev:server  # Terminal 1
pnpm dev:client  # Terminal 2
```

### Run All Tests
```bash
pnpm test:e2e
```

### Run Specific Test Suite
```bash
npx playwright test comprehensive-mvp.spec.ts
```

### Run Single Test
```bash
npx playwright test comprehensive-mvp.spec.ts -g "Authentication Flow"
```

### Debug Mode (with browser visible)
```bash
npx playwright test comprehensive-mvp.spec.ts --headed
```

### Debug with Playwright Inspector
```bash
PWDEBUG=1 npx playwright test comprehensive-mvp.spec.ts
```

## Test Architecture

### Helper Functions
- `connectAsPlayer()`: Handles authentication flow
- `elevateToDM()`: Handles DM elevation
- Reusable across all tests

### Test Isolation
- Each test starts with fresh state
- `beforeEach` hook ensures clean slate
- Tests don't depend on each other

### Timeouts
- Default: 30 seconds per test
- Configurable via `test.setTimeout()`
- Includes network wait times

## CI Integration

The tests run in GitHub Actions CI:

```yaml
- name: Run E2E tests
  run: |
    pnpm dev:server &
    pnpm dev:client &
    sleep 5
    pnpm test:e2e
```

## Benefits Over Manual Testing

1. **Consistency**: Same tests every time
2. **Speed**: 10 tests run in ~2-3 minutes vs 30-60 minutes manual
3. **Repeatability**: No human error
4. **CI-Ready**: Runs on every PR
5. **Multi-Browser**: Easily test Chrome, Firefox, Safari
6. **Regression Prevention**: Catches breakages automatically

## Future Enhancements

### Planned Test Additions
- [ ] Map upload and manipulation
- [ ] NPC creation and management
- [ ] Initiative tracker
- [ ] Fog of war
- [ ] Grid alignment wizard
- [ ] Portrait upload flow

### Performance Testing
- [ ] Load testing with 10+ concurrent players
- [ ] Measure WebSocket latency
- [ ] Canvas rendering performance

See [TESTING.md - Test Performance](./TESTING.md#test-performance) for current optimization status (CI runtime reduced 19% to 3m 53s).

### Visual Regression Testing
- [ ] Screenshot comparisons
- [ ] UI consistency checks
- [ ] Responsive design validation

## Troubleshooting

### Tests Timeout
- Verify dev servers are running
- Check server logs: `/tmp/server.log`
- Check client logs: `/tmp/client.log`
- Increase timeout if network is slow

### WebSocket Connection Fails
- Ensure port 8787 (server) is accessible
- Check firewall settings
- Verify CORS configuration

### Flaky Tests
- Add explicit wait times
- Use `waitForSelector()` instead of `waitForTimeout()`
- Check for race conditions in app code

### Browser Not Found
```bash
npx playwright install
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [E2E Testing Guide](https://martinfowler.com/articles/practical-test-pyramid.html)
