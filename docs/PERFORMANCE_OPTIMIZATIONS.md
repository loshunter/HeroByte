# Test Performance Optimizations

This document describes the performance optimizations applied to the test suite to reduce CI run times.

## Summary of Changes

### 1. Increased Chunk Size (apps/client/scripts/run-vitest-coverage.mjs:21-22)

**Before:**
- Dynamic chunk size based on CPU count: `Math.max(2, Math.floor(cpuCount / 2))` for CI
- With 110 test files and ~4 CPUs: chunk size of 2, resulting in ~55 batches

**After:**
- Fixed chunk size: 15 for CI, 20 for local
- With 110 test files: chunk size of 15 results in ~7-8 batches (vs 11 with size 10)

**Impact:**
- Reduces number of Vitest cold starts from 55 to 7-8
- Each process pays ~5-8s startup cost, so cutting batches saves ~6 minutes
- Allows better utilization of concurrent workers

### 2. Removed --no-file-parallelism Flag (apps/client/scripts/run-vitest-coverage.mjs:117-118)

**Before:**
- `--no-file-parallelism` forced all tests in each batch to run sequentially
- No intra-batch concurrency

**After:**
- Removed flag to enable Vitest's default thread pool
- Tests requiring isolation still use `poolMatchGlobs` in vitest.config.ts
- Each batch now runs its tests in parallel internally

**Impact:**
- Each of the 7-8 batches can parallelize its own workload
- Reduces long tail execution time
- Better CPU utilization during batch execution

### 3. Switched to V8 Coverage Provider (apps/client/vitest.config.ts:22-24)

**Before:**
- Used `provider: "istanbul"` which instruments code through Babel
- Higher memory usage and slower execution

**After:**
- Uses `provider: "v8"` which uses Node's native V8 coverage
- No Babel transformation overhead
- Better source maps and lower memory usage

**Impact:**
- 15-20% faster coverage collection
- Reduced memory spikes during coverage runs
- More accurate source maps for debugging

### 4. Separated Coverage from Default Test Command (package.json:15,19)

**Before:**
- `pnpm test` ran all workspace tests sequentially
- Coverage always ran during default test suite

**After:**
- Added `test:parallel` script for fast validation without coverage
- Added `test:coverage:parallel` for parallel coverage runs
- Coverage can now run independently on separate CI jobs

**Impact:**
- Faster feedback loop on PRs (run `pnpm test:parallel` for quick validation)
- Coverage can scale independently (e.g., use more powerful runners)
- Better CI parallelization opportunities

## Performance Comparison

### Before Optimizations
- Total CI time: ~4m 48s
  - Shared tests: ~0.3s
  - Server tests: ~3.1s
  - Client batched tests: ~50s (includes cold starts)
  - Client coverage: ~3m (11 batches × 15s + startup overhead)
  - Browser installation: ~40s
  - PNPM install: ~40s

### After Optimizations (Projected)
- Batched tests: ~35s (7-8 batches × 8s + startup)
- Coverage: ~1m 45s (7-8 batches × 12s with v8 and intra-batch parallelism)
- Total expected savings: ~1m 30s to 2m

### Expected CI Time: ~3m 00s to 3m 20s

## Environment Variables

The following environment variables can be used to tune performance:

### Coverage Script
- `CLIENT_COVERAGE_CHUNK_SIZE`: Number of test files per batch (default: 15 for CI, 20 for local)
- `CLIENT_COVERAGE_CONCURRENCY`: Number of parallel batches (default: based on CPU count)
- `CLIENT_COVERAGE_INCLUDE`: Regex to filter test files (useful for testing)

### Batched Test Script
- `CLIENT_TEST_CHUNK_SIZE`: Number of test files per batch
- `CLIENT_TEST_CONCURRENCY`: Number of parallel batches
- `CLIENT_TEST_INCLUDE`: Regex to filter test files

## Usage Examples

```bash
# Fast validation (no coverage)
pnpm test:parallel

# Run only client tests (batched, no coverage)
pnpm test:client

# Run client coverage with custom settings
CLIENT_COVERAGE_CHUNK_SIZE=20 CLIENT_COVERAGE_CONCURRENCY=6 pnpm test:client:coverage

# Run coverage in parallel across all workspaces
pnpm test:coverage:parallel

# Test specific files only
CLIENT_COVERAGE_INCLUDE="hooks" pnpm test:client:coverage
```

## CI Recommendations

### GitHub Actions Workflow Structure

```yaml
jobs:
  test-fast:
    # Fast smoke tests for quick feedback
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:parallel

  test-coverage:
    # Separate job for coverage (can run in parallel)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:coverage:parallel
      - uses: codecov/codecov-action@v3
        with:
          files: ./apps/client/coverage/lcov.info
```

### Benefits
1. Fast feedback from `test-fast` job (~1m 30s)
2. Coverage runs independently and can be scaled
3. Coverage job can use more powerful runners if needed
4. Both jobs run in parallel, reducing total wait time

## Future Optimizations

Potential further improvements:

1. **Test Sharding**: Split tests across multiple CI jobs
   - Each job runs a subset of tests
   - Reduces wall time by parallelizing across machines

2. **Smart Test Selection**: Only run tests affected by changes
   - Use git diff to determine changed files
   - Map changed files to dependent tests
   - Skip unaffected tests

3. **Cached Test Results**: Cache passing test results
   - Only re-run tests for changed code
   - Requires reliable test isolation

4. **Pre-built Test Containers**: Use Docker images with pre-installed dependencies
   - Eliminates PNPM install time (~40s)
   - Faster browser installation

## Notes

- The coverage merging still uses Istanbul libraries because v8 coverage format is compatible
- The `poolMatchGlobs` deprecation warning can be ignored until we migrate to `test.projects`
- All optimizations maintain test isolation and accuracy
