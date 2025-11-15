# CI Validation Checkpoints

**Phase 15 SOLID Refactor Initiative**

## Overview

This document defines the Continuous Integration (CI) validation checkpoints that protect code quality and structural integrity during the HeroByte Phase 15 SOLID refactoring initiative. These automated checks serve as guardrails to ensure refactoring work maintains system stability, test coverage, and adherence to architectural constraints.

### Purpose of CI Checkpoints During Refactoring

1. **Prevent Regressions**: Ensure all existing functionality continues to work after structural changes
2. **Enforce Structural Constraints**: Block code that violates the 350 LOC limit (with baseline exceptions)
3. **Maintain Type Safety**: Catch TypeScript compilation errors before merge
4. **Preserve Code Quality**: Enforce consistent linting and formatting standards
5. **Enable Confidence**: Allow engineers to refactor boldly knowing CI will catch breaking changes
6. **Track Progress**: Monitor structural improvements over time through artifacts

---

## Validation Stages

### 1. Pre-Commit Hooks

**Status**: Not currently configured

**Recommended Setup** (Optional):
- Install `husky` for Git hook management
- Run `pnpm format:check` before commit
- Run `pnpm lint` on staged files
- Consider `lint-staged` for incremental validation

**When to Use**:
- For teams wanting early validation feedback
- To catch formatting issues before pushing
- When you want to enforce local quality gates

**Implementation Example**:
```bash
# .husky/pre-commit (if implemented)
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm format:check
pnpm lint
```

### 2. PR Creation Checks

**Automated on**: Every push to PR branches targeting `dev`

**Checks Triggered**:
- Full CI pipeline runs automatically
- All jobs must pass before merge allowed
- Structural reports generated as artifacts
- Coverage uploaded to Codecov

**Engineer Responsibilities**:
1. Review CI status before requesting review
2. Address failures promptly
3. Check structural report artifacts for violations
4. Ensure all checks are green before merge

### 3. Automated CI Pipeline Checks

**Trigger Events**:
- Pull requests to `dev` branch
- Direct pushes to `dev` or `main` branches

**Pipeline Configuration**: `.github/workflows/ci.yml`

**Matrix Strategy**: Tests across Node.js 18.x and 20.x

### 4. Pre-Merge Validation

**GitHub Branch Protection** (Recommended Settings):
- Require status checks to pass before merging
- Require `build-and-test` job success on both Node versions
- Require up-to-date branches
- No force pushes to `dev` or `main`

**Human Validation**:
- Code review from at least one team member
- Review structural report artifacts for new violations
- Verify test coverage hasn't decreased
- Check that refactoring aligns with roadmap phases

### 5. Post-Merge Monitoring

**Immediate**:
- CI runs on `dev` branch post-merge
- Verify green build status
- Check Codecov for coverage trends

**Ongoing**:
- Monitor CI build times (should not increase significantly)
- Track structural violations in baseline file
- Review test pass rates over time
- Watch for flaky tests introduced by refactoring

---

## Specific Checks for Refactoring Safety

### 1. Structural Guardrails (350 LOC Limit Enforcement)

**Command**: `pnpm lint:structure:enforce`

**Purpose**: Block new files exceeding 350 lines of code (LOC)

**How It Works**:
```bash
node scripts/structure-report.mjs --threshold 350 --fail-on-new
```

**Baseline Protection**:
- Existing violations are tracked in `scripts/structure-baseline.json`
- Only **new** files exceeding threshold cause CI failure
- Allows incremental improvement without blocking all work

**What Triggers Failure**:
- Creating a new file with 350+ LOC
- Expanding an existing compliant file to 350+ LOC
- Renaming a file and exceeding threshold

**Example Failure Output**:
```
❌ STRUCTURAL GUARDRAIL VIOLATION
Found 2 new file(s) exceeding 350 LOC threshold:

  ⚠️  apps/client/src/features/new-feature/Component.tsx (478 LOC, +128 over threshold)
      Hint: Extract UI components from business logic. Separate state management into custom hooks.

  ⚠️  apps/server/src/services/NewService.ts (401 LOC, +51 over threshold)
      Hint: Split domain orchestration vs persistence vs validation. Follow DDD boundaries.

To fix this, either refactor the file(s) to be under the threshold,
or update the baseline if this is intentional: pnpm baseline:update
```

**Resolution**:
1. **Preferred**: Refactor the file to be under 350 LOC
2. **If Intentional**: Update baseline with `pnpm baseline:update` (requires justification in PR)

**CI Implementation**:
```yaml
- name: Enforce structural guardrails
  run: pnpm lint:structure:enforce
```

### 2. Test Coverage Requirements

**Command**: `pnpm test:coverage`

**Coverage Targets**:
- All tests must pass (0 failures)
- No test regressions from refactoring
- Coverage reports uploaded to Codecov

**What Gets Tested**:
```bash
# Shared package tests
pnpm --filter @shared test:coverage

# Server tests
pnpm --filter vtt-server test:coverage

# Client tests
pnpm --filter herobyte-client test:coverage
```

**Coverage Artifacts**:
- `packages/shared/coverage/coverage-final.json`
- `apps/server/coverage/coverage-final.json`
- Uploaded to Codecov (Node 20.x only)

**Failure Scenarios**:
- Any test fails
- Test suite doesn't complete
- Coverage generation fails

**CI Implementation**:
```yaml
- name: Run tests with coverage
  run: pnpm test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  if: matrix.node-version == '20.x'
  with:
    files: |
      packages/shared/coverage/coverage-final.json
      apps/server/coverage/coverage-final.json
    token: ${{ secrets.CODECOV_TOKEN }}
    flags: unit
    fail_ci_if_error: false
```

**Best Practices**:
- When refactoring, ensure moved tests still pass
- Update test imports when moving files
- Add tests for new abstractions
- Maintain or improve coverage percentage

### 3. Type Safety (TypeScript Compilation)

**Command**: `pnpm build`

**Purpose**: Ensure all TypeScript compiles without errors

**Build Targets**:
```bash
# Server build
pnpm build:server  # Uses apps/server/tsconfig.json

# Client build
pnpm build:client  # Uses apps/client/tsconfig.json
```

**Configuration**:
- Base: `tsconfig.base.json`
- Client: `apps/client/tsconfig.json`
- Server: `apps/server/tsconfig.json`
- Shared: `packages/shared/tsconfig.json`

**Common Refactoring Type Errors**:
- Broken imports after moving files
- Missing type definitions for extracted modules
- Incompatible interface changes
- Generic type parameter mismatches

**Example Failure**:
```
apps/client/src/ui/App.tsx:15:23 - error TS2307:
Cannot find module './hooks/useLayoutMeasurement' or its corresponding type declarations.
```

**Resolution Checklist**:
- [ ] Update import paths after moving files
- [ ] Export types from new module files
- [ ] Update barrel exports (index.ts files)
- [ ] Check for circular dependencies
- [ ] Verify shared package references

**CI Implementation**:
```yaml
- name: Build packages
  run: pnpm build
```

### 4. Linting and Formatting

#### ESLint

**Command**: `pnpm lint`

**Scope**:
```bash
pnpm lint:client  # apps/client
pnpm lint:server  # apps/server
pnpm lint:shared  # packages/shared
```

**Configuration**: `eslint.config.js`

**Key Rules for Refactoring**:
- `@typescript-eslint/no-unused-vars`: Catches orphaned code after extraction
- `@typescript-eslint/no-explicit-any`: Enforces type safety (warn level)
- `react-hooks/rules-of-hooks`: Validates custom hook patterns
- `react-hooks/exhaustive-deps`: Catches missing dependencies

**Common Lint Errors During Refactoring**:
```javascript
// Unused import after extraction
import { oldFunction } from './deprecated'; // ❌ 'oldFunction' is defined but never used

// Missing dependency in extracted hook
useEffect(() => {
  doSomething(prop);
}, []); // ❌ React Hook useEffect has a missing dependency: 'prop'

// Improper hook usage
const MyComponent = () => {
  if (condition) {
    const data = useData(); // ❌ React Hook "useData" is called conditionally
  }
};
```

**Resolution**:
- Remove unused imports after refactoring
- Update useEffect dependencies when extracting hooks
- Follow Rules of Hooks when creating custom hooks
- Use underscore prefix for intentionally unused variables: `_unusedParam`

#### Prettier

**Command**: `pnpm format:check`

**Configuration**: `.prettierrc`
```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "singleQuote": false,
  "trailingComma": "all",
  "semi": true
}
```

**Auto-Fix**: `pnpm format`

**CI Implementation**:
```yaml
- name: Run lint checks
  run: pnpm lint
```

**Note**: Prettier is integrated into ESLint via `eslint-plugin-prettier`, so `pnpm lint` includes formatting checks.

### 5. Build Verification

**Commands**:
- `pnpm build:server` - Server build
- `pnpm build:client` - Client build
- `pnpm build` - Both (sequential)

**Build Tools**:
- **Server**: TypeScript compiler (`tsc`)
- **Client**: Vite bundler

**What Gets Verified**:
- All TypeScript compiles successfully
- No module resolution errors
- Build artifacts are generated
- No circular dependencies
- Proper tree-shaking (client)

**Build Artifacts** (not committed):
- `apps/server/dist/` - Server compiled JS
- `apps/client/dist/` - Client production bundle

**Failure Scenarios**:
- TypeScript compilation errors
- Missing dependencies
- Import path errors
- Vite build failures

**CI Implementation**:
```yaml
- name: Build packages
  run: pnpm build
```

### 6. E2E Smoke Tests (Optional but Recommended)

**Status**: Configured but not in CI pipeline

**Configuration**: `playwright.config.ts`

**Test Location**: `apps/e2e/`

**How to Run**:
```bash
pnpm test:e2e        # Headless mode
pnpm test:e2e:ui     # Interactive mode
```

**Smoke Test Scope** (Recommended for Refactoring):
- [ ] User can create a room
- [ ] User can join a room
- [ ] DM can add a token to the map
- [ ] Player can move a token
- [ ] Drawing tools work
- [ ] WebSocket connection establishes

**When to Add to CI**:
- When refactoring high-risk areas (WebSocket, core features)
- Before major releases
- When you need end-to-end confidence

**Future CI Integration** (Example):
```yaml
- name: Run E2E smoke tests
  run: pnpm test:e2e
  env:
    CI: true
```

**Benefits**:
- Catches integration issues not visible in unit tests
- Validates WebSocket refactoring end-to-end
- Provides confidence for UI component extraction

---

## GitHub Actions Workflow

### Workflow File: `.github/workflows/ci.yml`

### Trigger Configuration

```yaml
on:
  push:
    branches:
      - dev
      - main
  pull_request:
    branches:
      - dev
```

**When CI Runs**:
- On every push to `dev` or `main` branches
- On every pull request targeting `dev`
- Manual workflow dispatch (if needed)

### Jobs Overview

#### Job: `build-and-test`

**Purpose**: Validates code quality, builds, and tests across multiple Node versions

**Runs On**: `ubuntu-latest`

**Strategy**: Matrix testing
```yaml
matrix:
  node-version: [18.x, 20.x]
```

**Why Matrix?**
- Ensures compatibility with Node 18 LTS and Node 20 LTS
- Catches version-specific issues
- Aligns with production deployment targets

### Step-by-Step Breakdown

#### 1. Checkout Repository
```yaml
- name: Checkout repository
  uses: actions/checkout@v4
```
- Clones the repository
- Uses latest stable checkout action
- Includes full git history

#### 2. Setup pnpm
```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v3
  with:
    version: 10.17.1
```
- Installs pnpm package manager
- Pinned to version 10.17.1 (matches `package.json` packageManager)
- Ensures consistent dependency resolution

#### 3. Setup Node.js
```yaml
- name: Setup Node.js ${{ matrix.node-version }}
  uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    cache: pnpm
```
- Installs Node.js (18.x and 20.x)
- Enables pnpm cache for faster builds
- Cache key based on `pnpm-lock.yaml`

#### 4. Install Dependencies
```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
```
- Installs all dependencies
- `--frozen-lockfile`: Fails if lockfile is out of sync
- Ensures reproducible builds

#### 5. Run Lint Checks
```yaml
- name: Run lint checks
  run: pnpm lint
```
- Runs ESLint across all packages
- Includes TypeScript type checking
- Enforces code style via Prettier integration
- **Refactor Impact**: Catches unused imports, broken hooks, type errors

#### 6. Enforce Structural Guardrails
```yaml
- name: Enforce structural guardrails
  run: pnpm lint:structure:enforce
```
- **CRITICAL FOR REFACTORING**
- Runs `structure-report.mjs --threshold 350 --fail-on-new`
- Blocks new files exceeding 350 LOC
- Allows baseline violations (existing god files)
- **Exit Code**: 1 if new violations detected, 0 otherwise

#### 7. Generate Structural Report
```yaml
- name: Generate structural report
  if: always()
  run: pnpm lint:structure | tee structure-report.txt
```
- **Runs even if previous step fails** (`if: always()`)
- Generates human-readable structure report
- Displays top 50 largest files
- Provides refactoring hints
- Output saved to `structure-report.txt`

#### 8. Generate Structural Report Artifact (JSON)
```yaml
- name: Generate structural report artifact
  run: node scripts/structure-report.mjs --limit 200 --threshold 350 --json > structure-report.json
```
- Generates machine-readable JSON report
- Includes top 200 files
- Used for tracking trends over time
- Schema:
  ```json
  {
    "generatedAt": "2025-11-15T12:00:00.000Z",
    "threshold": 350,
    "includeTests": false,
    "files": [
      {
        "path": "apps/client/src/ui/App.tsx",
        "loc": 1247,
        "category": "client:ui",
        "flagged": true,
        "hint": "See docs/refactoring/REFACTOR_ROADMAP.md...",
        "roadmapRef": "App.tsx Phases 1-7",
        "sizeBytes": 45123
      }
    ]
  }
  ```

#### 9. Upload Structural Report
```yaml
- name: Upload structural report
  uses: actions/upload-artifact@v4
  with:
    name: structure-report-${{ matrix.node-version }}
    path: |
      structure-report.txt
      structure-report.json
    if-no-files-found: ignore
```
- Uploads both text and JSON reports as artifacts
- Available for 90 days (GitHub default)
- Named per Node version: `structure-report-18.x`, `structure-report-20.x`
- **How to Access**: GitHub Actions run summary > Artifacts section

#### 10. Build Packages
```yaml
- name: Build packages
  run: pnpm build
```
- Builds server: `pnpm build:server`
- Builds client: `pnpm build:client`
- **Refactor Impact**: Catches TypeScript errors, module resolution issues
- Verifies production bundle generation

#### 11. Run Tests with Coverage
```yaml
- name: Run tests with coverage
  run: pnpm test:coverage
```
- Runs all unit tests:
  - `pnpm test:shared:coverage`
  - `pnpm test:server:coverage`
  - `pnpm test:client:coverage`
- Generates coverage reports
- **Refactor Impact**: Validates behavior preservation, catches regressions

#### 12. Upload Coverage to Codecov
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  if: matrix.node-version == '20.x'
  with:
    files: |
      packages/shared/coverage/coverage-final.json
      apps/server/coverage/coverage-final.json
    token: ${{ secrets.CODECOV_TOKEN }}
    flags: unit
    fail_ci_if_error: false
```
- Uploads coverage only from Node 20.x run (avoids duplicates)
- Sends to Codecov for tracking
- `fail_ci_if_error: false`: Upload failure doesn't block CI
- **Flags**: `unit` (distinguishes from future e2e coverage)

### Refactor-Specific Validations

**Highlighted in CI**:

1. **Structural Guardrails** (Step 6)
   - Primary refactoring safety net
   - Enforces 350 LOC limit on new code
   - Tracks baseline violations

2. **Structural Reports** (Steps 7-9)
   - Visibility into code structure
   - Identifies refactoring targets
   - Provides actionable hints
   - Artifact history shows progress

3. **Test Coverage** (Steps 11-12)
   - Ensures no behavioral regressions
   - Tracks coverage trends
   - Validates test migrations

### Workflow Duration

**Typical Times** (varies by changes):
- Checkout & Setup: ~30s
- Install Dependencies: ~1-2min (with cache)
- Lint: ~30-60s
- Structure Analysis: ~10-20s
- Build: ~1-2min
- Tests: ~2-5min
- **Total**: ~5-10min per Node version

**Parallel Execution**: Both Node 18.x and 20.x run simultaneously

---

## Failure Handling

### General Approach

When CI fails, follow this decision tree:

```
CI Failed
├─ Structural Guardrail Violation?
│  ├─ Yes → Refactor file under 350 LOC OR update baseline with justification
│  └─ No → Continue
├─ Test Failures?
│  ├─ Yes → Fix tests or revert breaking change
│  └─ No → Continue
├─ Lint/Type Errors?
│  ├─ Yes → Fix errors or revert
│  └─ No → Continue
├─ Build Failures?
│  ├─ Yes → Fix build or revert
│  └─ No → Investigate other cause
└─ Intermittent/Infrastructure?
   └─ Yes → Re-run workflow
```

### How to Investigate Failures

#### 1. Access the Failed Workflow

**Via GitHub UI**:
1. Navigate to PR or commit on GitHub
2. Click "Details" next to failed check
3. Expand failed step in workflow log

**Via GitHub CLI**:
```bash
gh run list --limit 5
gh run view <run-id>
gh run view <run-id> --log-failed
```

#### 2. Identify the Failed Step

Look for red X in workflow logs:
- `Run lint checks` - Linting/formatting error
- `Enforce structural guardrails` - LOC violation
- `Build packages` - TypeScript/build error
- `Run tests with coverage` - Test failure

#### 3. Download Artifacts (if available)

```bash
# List artifacts
gh run view <run-id> --json artifacts

# Download structural report
gh run download <run-id> -n structure-report-20.x
```

Or via UI: Actions > Workflow Run > Artifacts section

#### 4. Reproduce Locally

**Before investigating remotely, always try to reproduce locally:**

```bash
# Full CI simulation
pnpm install --frozen-lockfile
pnpm lint
pnpm lint:structure:enforce
pnpm build
pnpm test:coverage

# Or run individually
pnpm lint:client
pnpm build:server
pnpm test:shared
```

**Benefits**:
- Faster iteration
- Better debugging tools
- No CI queue wait

#### 5. Check Diff for Root Cause

```bash
# What changed in this PR?
git diff dev...HEAD

# What files were added/modified?
git diff --name-status dev...HEAD

# What changed in a specific file?
git diff dev...HEAD apps/client/src/ui/App.tsx
```

### When to Fix vs When to Revert

#### Fix Immediately (Same PR)

**Scenarios**:
- Trivial fix (missing import, typo)
- Test update for intentional behavior change
- Formatting issue (run `pnpm format`)
- Small type error from refactoring

**Time Limit**: Fix within 1-2 commits

**Example**:
```bash
# Quick fix for broken import
git add apps/client/src/ui/App.tsx
git commit -m "fix: update import path after refactoring"
git push
```

#### Fix in Follow-Up Commit (Same Branch)

**Scenarios**:
- Structural violation requires small refactoring
- Multiple test failures need investigation
- Build error requires dependency update
- Linting errors require code restructuring

**Time Limit**: Fix within 24 hours

**Checklist**:
- [ ] Add comment in PR explaining the fix
- [ ] Keep fix commits separate from refactoring commits
- [ ] Run full CI locally before pushing
- [ ] Update PR description if scope changes

#### Revert Immediately

**Scenarios**:
- Blocker for other team members
- Fix is unclear or will take >24 hours
- Multiple unrelated failures
- Suspected infrastructure issue but can't confirm
- Tests are flaky and root cause unknown
- Breaking production deployment

**How to Revert**:
```bash
# Revert the problematic commit
git revert <commit-sha>
git push

# Or reset branch (if no one else is working on it)
git reset --hard origin/dev
git push --force
```

**After Reverting**:
1. Fix in separate branch
2. Re-run full CI locally
3. Open fresh PR
4. Reference original PR in description

### Emergency Procedures

#### Scenario 1: CI Blocked on Main/Dev

**Symptom**: Merge to `dev` or `main` resulted in broken CI

**Impact**: Blocks all downstream PRs

**Response**:
1. **Immediate**: Revert the breaking commit
   ```bash
   git revert <bad-commit-sha>
   git push origin dev
   ```
2. **Notify**: Alert team in Slack/Discord
3. **Investigate**: Determine root cause offline
4. **Fix**: Create PR with fix + additional tests
5. **Postmortem**: Document what happened and prevention steps

#### Scenario 2: Flaky Tests

**Symptom**: Tests pass locally but fail in CI (or vice versa)

**Common Causes**:
- Race conditions in async code
- Hardcoded timing (setTimeout)
- Environment-specific behavior
- Test interdependence

**Response**:
1. **Immediate**: Re-run CI to confirm flakiness
2. **Short-term**: Use `retries: 1` in Playwright config (already set)
3. **Long-term**: Fix the flaky test
   - Add proper waits
   - Mock time-dependent behavior
   - Isolate test state
   - Use Playwright auto-waiting

#### Scenario 3: Infrastructure Failure

**Symptom**: Errors unrelated to code (GitHub Actions down, npm registry timeout, etc.)

**Examples**:
- `Error: connect ETIMEDOUT`
- `Unable to locate executable file: pnpm`
- `The hosted runner lost communication`

**Response**:
1. Check [GitHub Status](https://www.githubstatus.com/)
2. Re-run failed jobs (GitHub UI: "Re-run failed jobs")
3. If persistent, use workflow dispatch with cache disabled:
   ```yaml
   cache: false
   ```
4. Escalate to GitHub support if needed

#### Scenario 4: Structural Guardrail Blocking Urgent Fix

**Symptom**: Critical bugfix blocked by 350 LOC violation

**Response** (RARE - requires justification):
1. Fix the bug in a minimal way
2. If still over 350 LOC, update baseline:
   ```bash
   pnpm baseline:update
   git add scripts/structure-baseline.json
   git commit -m "chore: update baseline for critical fix [REASON]"
   ```
3. **Required**: Add comment in PR explaining:
   - Why this is urgent
   - Why it couldn't be under 350 LOC
   - Plan to refactor it later (create issue)
4. Get approval from tech lead
5. Create follow-up ticket for refactoring

---

## Metrics and Monitoring

### What to Track

#### 1. Test Pass Rate Over Time

**Source**: CI workflow results

**Metrics**:
- Total tests run
- Pass rate (%)
- Failure rate (%)
- Flaky test occurrences

**Tools**:
- GitHub Actions insights
- Codecov trends
- Manual tracking in spreadsheet/dashboard

**Target**:
- 100% pass rate on `dev` branch
- < 1% flaky test rate

**How to Track**:
```bash
# List recent workflow runs
gh run list --workflow=ci.yml --limit 20 --json conclusion,createdAt,headBranch

# Count failures
gh run list --workflow=ci.yml --status failure --limit 100
```

**Dashboard Idea** (Advanced):
Create a script to parse CI results and generate trends:
```bash
gh api /repos/:owner/:repo/actions/workflows/ci.yml/runs --paginate | jq '.workflow_runs[] | {date: .created_at, status: .conclusion}'
```

#### 2. Build Times

**Why Monitor**: Slow CI discourages frequent commits

**Baseline** (current):
- ~5-10 minutes per run
- ~1-2 minutes for install (cached)
- ~1-2 minutes for build
- ~2-5 minutes for tests

**Targets**:
- Keep install time < 2min (cache hit rate > 90%)
- Keep build time < 3min
- Keep test time < 5min
- Total time < 12min

**When to Investigate**:
- Build time increases > 50% from baseline
- Cache hit rate drops below 80%
- Test time increases without new tests

**How to Track**:
- GitHub Actions timing logs (per step)
- `gh run view <run-id>` shows step durations

**Optimization Ideas**:
- Parallelize test suites
- Use Vitest sharding
- Optimize TypeScript compilation
- Split large test files

#### 3. Coverage Trends

**Source**: Codecov dashboard

**Metrics**:
- Overall coverage %
- Per-package coverage (shared, server, client)
- Coverage change per PR
- Uncovered lines in refactored files

**Targets**:
- Maintain or improve overall coverage
- No PR reduces coverage by > 2%
- New refactored modules have > 80% coverage

**Codecov Insights**:
- Visit: `https://codecov.io/gh/<org>/<repo>`
- Review: Coverage sunburst, file browser, trends
- Alert: Configure Codecov to comment on PRs with coverage changes

**Local Coverage Check**:
```bash
pnpm test:coverage

# View HTML report
open packages/shared/coverage/index.html
open apps/server/coverage/index.html
```

#### 4. Structural Violations

**Source**: Structural report artifacts

**Metrics**:
- Total files over 350 LOC
- Total LOC in flagged files
- Category breakdown (client:ui, server:websocket, etc.)
- Trend over time (increasing or decreasing?)

**Tracking Method**:

**Option 1: Manual Tracking**
- Download `structure-report.json` from CI artifacts weekly
- Track flagged file count in spreadsheet

**Option 2: Automated Tracking** (Recommended)
- Store historical reports in `docs/refactoring/metrics/`
- Create comparison script:
  ```bash
  # Compare current vs baseline
  node scripts/compare-structure.mjs \
    --baseline docs/refactoring/metrics/2025-01-01.json \
    --current structure-report.json
  ```

**Sample Tracking Table**:
| Date       | Flagged Files | Total LOC (Flagged) | Largest File          | Progress |
|------------|---------------|---------------------|-----------------------|----------|
| 2025-01-15 | 27            | 18,543              | App.tsx (1,247)       | Baseline |
| 2025-02-01 | 24            | 16,892              | App.tsx (987)         | -11.1%   |
| 2025-02-15 | 20            | 14,331              | MapBoard.tsx (856)    | -22.7%   |

**Success Indicators**:
- Decreasing flagged file count
- Decreasing average LOC per flagged file
- Categories with 0 violations (e.g., client:hooks)

### Monitoring Best Practices

#### Weekly Review

**Schedule**: Every Monday, 15-minute review

**Checklist**:
- [ ] Review last 7 days of CI runs
- [ ] Check for new flaky tests
- [ ] Compare build times to baseline
- [ ] Review Codecov coverage trend
- [ ] Download and compare structural reports
- [ ] Identify top 3 refactoring targets

**Output**: Update refactoring roadmap priorities

#### Monthly Review

**Schedule**: First of each month, 30-minute deep dive

**Checklist**:
- [ ] Generate month-over-month metrics report
- [ ] Identify CI bottlenecks
- [ ] Review test suite performance
- [ ] Celebrate structural improvements
- [ ] Adjust LOC threshold if needed
- [ ] Update baseline if major refactoring completed

**Output**: Metrics report shared with team

#### Alert Triggers

**Set up alerts for**:
- CI failure rate > 10% (investigate infrastructure)
- Build time > 15min (investigate slowdown)
- Coverage drop > 5% (investigate missing tests)
- 3+ flaky test occurrences in a week (fix tests)

**Tools**:
- GitHub Actions email notifications
- Slack/Discord webhooks for CI failures
- Codecov status checks

---

## Best Practices

### 1. Run CI Checks Locally Before Pushing

**Why**: Catch issues early, reduce CI queue time, faster iteration

**Pre-Push Checklist**:
```bash
# 1. Install dependencies (if changed)
pnpm install

# 2. Run linters
pnpm lint

# 3. Check structural guardrails
pnpm lint:structure:enforce

# 4. Format code
pnpm format

# 5. Build
pnpm build

# 6. Run tests
pnpm test

# 7. (Optional) Check coverage
pnpm test:coverage
```

**Pro Tip**: Create a pre-push alias
```bash
# Add to ~/.bashrc or ~/.zshrc
alias ci-check="pnpm lint && pnpm lint:structure:enforce && pnpm build && pnpm test"

# Usage
ci-check && git push
```

**Or use a script**: `scripts/ci-check.sh`
```bash
#!/bin/bash
set -e
echo "Running local CI checks..."
pnpm lint
pnpm lint:structure:enforce
pnpm build
pnpm test
echo "✅ All checks passed! Safe to push."
```

### 2. Don't Merge on Red CI

**Rule**: Never merge a PR with failing CI checks

**Exceptions**: NONE (even for "trivial" failures)

**Why**:
- Breaks downstream PRs
- Erodes team confidence in CI
- Creates technical debt
- Violates refactoring safety guarantees

**Enforcement**:
- Enable GitHub branch protection: "Require status checks to pass"
- Make this a team norm (code review checklist)
- Escalate violations to tech lead

**What to Do Instead**:
1. Fix the failure
2. Re-run CI to confirm
3. Then merge

### 3. Fix CI Failures Within 24 Hours

**Policy**: If your PR breaks CI, fix it or revert within 24 hours

**Why 24 Hours**:
- Keeps `dev` branch healthy
- Prevents blocking other team members
- Maintains refactoring momentum
- Context is fresh in your mind

**Response Timeline**:

| Time       | Action                          |
|------------|---------------------------------|
| 0-2 hours  | Investigate and attempt fix     |
| 2-8 hours  | Communicate status to team      |
| 8-24 hours | Fix completed or revert planned |
| 24+ hours  | Escalate to tech lead           |

**Communication Template**:
```
PR #123 failed CI in step: "Run tests with coverage"
Status: Investigating test failure in WebSocket connection tests
ETA: Fix by EOD today
Blocker: No (isolated to this PR)
```

### 4. Monitor CI Health

**Individual Responsibility**:
- Check CI status after every push
- Review artifact reports for your PRs
- Don't ignore warnings (they become errors)

**Team Responsibility**:
- Designate rotating "CI health monitor" role
- Weekly CI health review in standup
- Celebrate structural improvements

**Green Indicators**:
- 95%+ pass rate on `dev`
- Consistent build times
- No backlog of broken PRs
- Decreasing structural violations

**Red Flags**:
- Frequent flaky tests
- Increasing build times
- Multiple PRs failing same check
- Ignored structural warnings

### 5. Understand What Each Check Does

**Before Refactoring a Module**:
1. Review this document
2. Understand which CI checks will validate your changes
3. Run those checks locally first
4. Review structural report to see current state

**For Each CI Failure**:
1. Read the error message completely
2. Understand which check failed and why
3. Look up the check in this document
4. Follow resolution guidance

### 6. Use Structural Reports as a Guide

**How to Use**:
1. Download `structure-report.json` from CI artifacts
2. Find your target file in the report
3. Read the hint and roadmap reference
4. Follow the suggested refactoring approach

**Example**:
```json
{
  "path": "apps/client/src/ui/App.tsx",
  "loc": 1247,
  "hint": "See docs/refactoring/REFACTOR_ROADMAP.md - 27 clusters identified, start with Phase 1",
  "roadmapRef": "App.tsx Phases 1-7"
}
```

**Action**:
- Open `docs/refactoring/REFACTOR_ROADMAP.md`
- Navigate to "App.tsx Phases 1-7"
- Follow phase 1 extraction guidance

### 7. Keep Refactoring PRs Focused

**Anti-Pattern**: "Mega refactoring PR" that touches 30 files and 5 features

**Best Practice**: Small, focused PRs that pass CI quickly

**Recommended PR Scope**:
- Single file refactoring (e.g., extract 3 hooks from App.tsx)
- Single feature extraction (e.g., DMMenu collapsible section)
- Single pattern application (e.g., convert all service functions to classes)

**Benefits**:
- Faster CI runs
- Easier code review
- Simpler rollback if needed
- Clearer git history
- Less merge conflict risk

**Example Good PR Sequence**:
1. PR #1: Extract useLayoutMeasurement from App.tsx
2. PR #2: Extract useToolMode from App.tsx
3. PR #3: Extract CameraControls component from App.tsx

### 8. Document Baseline Updates

**When Updating Baseline**:
```bash
pnpm baseline:update
```

**Required in PR Description**:
- Why is this file exceeding 350 LOC?
- Is this temporary (new feature) or permanent (legacy code)?
- What is the plan to refactor it later?
- Link to follow-up issue or roadmap phase

**Example PR Description**:
```markdown
## Summary
Adds new feature: AI-powered NPC generator

## Structural Baseline Update
- Added `apps/client/src/features/ai/NPCGenerator.tsx` (412 LOC) to baseline
- **Reason**: New feature implementation, will refactor in Phase 16
- **Plan**: Extract AI service logic to separate module, split UI into smaller components
- **Follow-up**: Issue #456
```

### 9. Treat Warnings as Errors

**Philosophy**: Warnings eventually become errors

**Examples**:
- `@typescript-eslint/no-explicit-any`: Currently "warn", should be "error"
- Structural report flagged files: Address proactively

**Action Items**:
- Don't introduce new `any` types
- Don't add to flagged files (refactor instead)
- Create issues to fix existing warnings

### 10. Celebrate CI Improvements

**Track Wins**:
- File count reduced from 27 to 24 violations
- Build time improved from 8min to 6min
- Coverage increased from 75% to 82%
- 0 CI failures this week

**Recognition**:
- Shout out in team chat
- Add to weekly metrics report
- Include in sprint retrospectives

**Motivation**: CI is a team asset, improving it benefits everyone

---

## Quick Reference

### Commands Cheat Sheet

```bash
# Local CI simulation
pnpm install --frozen-lockfile  # Install deps (frozen)
pnpm lint                       # Lint all packages
pnpm lint:structure:enforce     # Check 350 LOC limit
pnpm build                      # Build server + client
pnpm test                       # Run all tests
pnpm test:coverage              # Run tests with coverage

# Individual package linting
pnpm lint:client
pnpm lint:server
pnpm lint:shared

# Individual package testing
pnpm test:client
pnpm test:server
pnpm test:shared

# Formatting
pnpm format:check               # Check formatting
pnpm format                     # Auto-fix formatting

# Structural reports
pnpm lint:structure             # Human-readable report (top 50)
pnpm lint:structure:enforce     # Enforce 350 LOC (fail on new)
pnpm baseline:update            # Update baseline file

# E2E tests (optional)
pnpm test:e2e                   # Run E2E tests
pnpm test:e2e:ui                # Run E2E tests (UI mode)

# GitHub CLI
gh run list --workflow=ci.yml   # List CI runs
gh run view <run-id>            # View run details
gh run download <run-id>        # Download artifacts
```

### CI Failure Quick Diagnosis

| Error Message                          | Check Failed          | Fix                          |
|----------------------------------------|-----------------------|------------------------------|
| `❌ STRUCTURAL GUARDRAIL VIOLATION`    | Structural guardrail  | Refactor or update baseline  |
| `error TS2307: Cannot find module`     | Build                 | Fix import path              |
| `FAIL apps/client/src/...test.tsx`     | Tests                 | Fix test or code             |
| `'variable' is defined but never used` | Lint                  | Remove unused code           |
| `error TS2345: Argument of type...`    | Build (type error)    | Fix type mismatch            |
| `Expected linebreaks to be 'LF'`       | Lint (formatting)     | Run `pnpm format`            |
| `React Hook useEffect has missing...`  | Lint (React hooks)    | Add dependency or disable    |

### Resource Links

- **CI Workflow**: `.github/workflows/ci.yml`
- **Structure Script**: `scripts/structure-report.mjs`
- **ESLint Config**: `eslint.config.js`
- **Prettier Config**: `.prettierrc`
- **Playwright Config**: `playwright.config.ts`
- **Refactor Roadmap**: `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_ROADMAP.md`
- **Refactor Playbook**: `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_PLAYBOOK.md`
- **Codecov**: `https://codecov.io/gh/<org>/<repo>`
- **GitHub Actions**: `https://github.com/<org>/<repo>/actions`

---

## Appendix: CI Configuration Files

### A. Workflow File Location

```
/home/loshunter/HeroByte/.github/workflows/ci.yml
```

### B. Structural Baseline Location

```
/home/loshunter/HeroByte/scripts/structure-baseline.json
```

### C. Coverage Output Locations

```
/home/loshunter/HeroByte/packages/shared/coverage/
/home/loshunter/HeroByte/apps/server/coverage/
/home/loshunter/HeroByte/apps/client/coverage/ (future)
```

### D. Build Output Locations (not committed)

```
/home/loshunter/HeroByte/apps/server/dist/
/home/loshunter/HeroByte/apps/client/dist/
```

---

## Version History

| Date       | Version | Changes                          |
|------------|---------|----------------------------------|
| 2025-11-15 | 1.0     | Initial comprehensive document   |

---

**Document Owner**: Engineering Team
**Last Updated**: 2025-11-15
**Next Review**: 2025-12-15
