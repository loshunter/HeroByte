# Testing Architecture

How HeroByte keeps 6,700+ tests fast, and the patterns that keep suites lean. For what is tested and how to run it, see [TESTING.md](TESTING.md).

HeroByte implements a **3-tier test optimization strategy** that preserves coverage while cutting runtime through intelligent batching, suite optimizations, and parallel execution.

## Tier 1: CI Matrix Batching

Parallel test execution with intelligent workload distribution:

- **CPU-aware chunking** via `run-vitest-coverage.mjs`
- **Heavy file separation** for characterization tests
- **Dynamic batch sizing** controlled by environment variables:
  - `CLIENT_COVERAGE_CHUNK_SIZE` - Tests per batch (default: CPU-aware)
  - `CLIENT_COVERAGE_CONCURRENCY` - Parallel batch limit
  - `VITEST_SILENT` - Suppress console noise in CI
- **Coverage merging** via Istanbul for unified reports

Used in CI to distribute tests across matrix jobs efficiently.

## Tier 2: Suite-Level Optimizations

Test suite patterns that reduce execution time while maintaining coverage:

**Pattern: Data-Driven Tests with describe.each**

```typescript
describe.each([
  { modifier: 3, display: "+3", color: "var(--jrpg-green)" },
  { modifier: -2, display: "-2", color: "var(--jrpg-red)" },
  { modifier: 0, display: "+0", color: "var(--jrpg-green)" },
])("Modifier display - $modifier", ({ modifier, display, color }) => {
  it(`should display ${display} with correct color`, () => {
    const character = createMockCharacter({ initiativeModifier: modifier });
    renderModal({ character });

    const modifierDisplay = screen.getByText(display);
    expect(modifierDisplay).toHaveStyle({ color });
  });
});
```

**Pattern: Factory Builders**

```typescript
// Reusable factory pattern for test data
function createMockCharacter(overrides = {}) {
  return {
    id: "char-1",
    name: "Test Character",
    maxHp: 10,
    currentHp: 10,
    initiativeModifier: 2,
    ...overrides,
  };
}

// Shared render helper reduces boilerplate
function renderModal(overrides = {}) {
  const props = createDefaultProps(overrides);
  const result = render(<InitiativeModal {...props} />);
  return { ...result, props };
}
```

**Pattern: Fake Timers for Time-Dependent Tests**

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

it("should auto-dismiss after 3000ms", () => {
  renderToast();
  vi.advanceTimersByTime(3000);
  expect(onDismiss).toHaveBeenCalled();
});
```

**Results:** Reduced test count from ~150 to ~40 in the optimized suites without losing coverage of the behaviour under test.

## Tier 3: Parallel Opt-In

Fork-based parallelism for local development:

- **Config:** `pool: "forks"` in `vitest.config.ts`
- **Isolation:** Each test file runs in separate process
- **Safety:** Works when the host has adequate RAM available

Enable via `pnpm test:parallel` from a bash-compatible shell (requires ~4GB+ RAM). On native Windows PowerShell or Command Prompt, use `pnpm test`.

## Test Utilities

**SnapshotBuilder** (`/apps/client/src/test-utils/SnapshotBuilder.ts`)

Fluent API for building test room snapshots:

```typescript
const snapshot = new SnapshotBuilder()
  .withGridSize(60)
  .withCharacter({ id: "char-1", name: "Gandalf" })
  .withToken({ id: "token-1", characterId: "char-1", x: 10, y: 10 })
  .build();
```

## Local Testing Notes

- **Default mode** (`pnpm test`): Cross-platform and safe for normal local development
- **Parallel mode** (`pnpm test:parallel`): Requires a bash-compatible shell and enough RAM
- **CI mode**: Automatically adjusts concurrency based on available CPU cores
- **Console output**: Silenced in CI via `VITEST_SILENT=true`

If you do use WSL for development, allocate enough memory before running parallel tests:

```ini
[wsl2]
memory=8GB
processors=4
```

## Documentation Screenshot Harness

Not a test suite, but it rides the same rails: `pnpm docs:screenshots` boots the isolated E2E stack (ports `5175`/`8788`) and drives real player and DM sessions with Playwright, capturing every image in `docs/user-guide/img/`. The capture files (`apps/e2e/docs-screenshots.*.ts`) are deliberately **not** `*.spec.ts`, so `pnpm test:e2e` and CI never run them.

## Related Documentation

- [TESTING.md](TESTING.md) - Comprehensive testing guide
- [TEST_QUALITY_GUIDELINES.md](TEST_QUALITY_GUIDELINES.md) - Test quality standards and optimization patterns
- [e2e-testing-success.md](e2e-testing-success.md) - Complete E2E automation success story
- [automated-testing-strategy.md](automated-testing-strategy.md) - Testing architecture guide
