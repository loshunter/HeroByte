# Contributing to HeroByte

Thanks for your interest in improving HeroByte! This guide explains how we work, what we expect in pull requests, and how to get your changes merged quickly.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Project Workflow](#project-workflow)
- [Set Up the Project](#set-up-the-project)
- [Branching & Commit Style](#branching--commit-style)
- [Development Checklist](#development-checklist)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Expectations](#testing-expectations)
- [Documentation Updates](#documentation-updates)
- [Need Help?](#need-help)

---

## Code of Conduct

Please act respectfully and professionally. Assume good intent, offer constructive feedback, and keep discussions focused on solving problems. If conflicts arise, reach out to the maintainers.

---

## Project Workflow

- `main`: production-ready branch (auto-deployed)
- `dev`: integration branch for all new work
- Feature branches: `feature/<scope>-<short-description>` (e.g. `feature/map-undo`)

We use PNPM workspaces. Scripts run from the repo root unless otherwise noted.

---

## Set Up the Project

```bash
# clone and move into repo
git clone https://github.com/loshunter/HeroByte.git
cd HeroByte

# enable pnpm (Node 18+ recommended)
corepack enable pnpm

# install dependencies
pnpm install

# run the dev servers (in separate terminals)
pnpm dev:server
pnpm dev:client
```

Useful scripts:

- `pnpm dev` – run server and client concurrently
- `pnpm lint` – lint entire workspace
- `pnpm lint:structure` – analyze file sizes and show refactoring hints
- `pnpm lint:structure:enforce` – enforce 350 LOC limit (fails on new violations)
- `pnpm test` – run unit/integration tests (shared + server)
- `pnpm test:coverage` – run tests with coverage output
- `pnpm format:check` – ensure prettier formatting (use `pnpm format` to auto-fix)

---

## Branching & Commit Style

- Branch off `dev`: `git checkout -b feature/<scope>-<short-description>`
- Keep commits small and focused. Use present tense (e.g. `Add map undo stack`).
- Rebase locally if your branch falls behind `dev`.

---

## Development Checklist

1. Update / create tests for new behavior.
2. Run `pnpm lint` and ensure no warnings/errors.
3. Run `pnpm test` (or `pnpm test:server`, `pnpm test:shared` as needed).
4. If the Update affects behavior or workflows, adjust docs (README, DEVELOPMENT, TESTING_SETUP, etc.).
5. Double-check the TODO board for related CRITICAL items.

---

## Pull Request Process

1. Push your branch and open a PR targeting `dev`.
2. Fill out the PR template, including:
   - Summary of changes
   - Testing performed (commands + results)
   - Links to related issues/tasks
3. CI must pass (lint, build, tests, coverage upload).
4. Address reviewer feedback promptly; keep the conversation respectful and focused.
5. A maintainer will squash/merge once approvals and checks are green.

### Monitoring CI After Push

After pushing your branch, **monitor the CI run** to catch failures early:

**Using Claude Code**: The `/ci-check` command automatically:

- Monitors the latest GitHub Actions CI run
- Auto-fixes common issues (Prettier formatting, ESLint warnings)
- Reports final status with detailed logs if failures occur

**Manual monitoring**:

```bash
# View latest CI run
gh run list --workflow=ci.yml --limit=1

# Watch a specific run in real-time
gh run watch <run-id>

# View failed logs
gh run view <run-id> --log-failed
```

**Common auto-fixable issues**:

- **Prettier errors**: Run `pnpm format` to auto-format all files
- **ESLint warnings**: Add `eslint-disable-next-line` comments for intentional violations
- **TypeScript errors**: Review and fix type issues manually

The CI enforces zero warnings (`--max-warnings=0`), so all lint warnings must be addressed before merging.

---

## Coding Standards

- TypeScript everywhere (strict mode enabled).
- Prefer `unknown` over `any`; add runtime validation if needed (e.g. zod).
- Avoid business logic in React components—encapsulate in hooks/services.
- Follow Domain-Driven Design structure already in place (domains, middleware, ws, etc.).
- Use named exports (no default exports) unless a React component.
- **Keep files small and cohesive. Maximum 350 lines of code per file (enforced by CI).**
  - The structural guardrail prevents new files from exceeding the 350 LOC threshold.
  - Files already over the threshold are tracked in `scripts/structure-baseline.json`.
  - Run `pnpm lint:structure` to see current file sizes and refactoring hints.
  - When in doubt, create a new module.

### Formatting & Linting

- ESLint + Prettier enforce consistent style. Run `pnpm lint` and `pnpm format:check` before committing.
- Zero lint warnings policy (CI fails on warnings). Fix issues before pushing.
- Configure your editor to use workspace TypeScript and format on save.

### Structural Guardrails

The project enforces a **350 lines of code (LOC) limit per file** to maintain SOLID principles and prevent "god files":

1. **CI Enforcement**: The `lint:structure:enforce` step in CI will **fail the build** if you introduce a new file exceeding 350 LOC.

2. **Existing Violations**: Files that already exceed the threshold are tracked in `scripts/structure-baseline.json`. These are allowed but should be refactored over time (see TODO.md Phase 15).

3. **Checking File Sizes**: Run `pnpm lint:structure` locally to see:
   - The largest files in the codebase
   - Which files exceed the threshold (marked with ⚠️)
   - Refactoring hints specific to each category

4. **What to Do If Your File Exceeds 350 LOC**:
   - Break it into smaller, focused modules following Single Responsibility Principle
   - Extract components, hooks, services, or utilities into separate files
   - Use the refactoring hints provided by `pnpm lint:structure` for guidance
   - See TODO.md Phase 15 for detailed refactoring strategies

5. **Updating the Baseline** (maintainers only):
   ```bash
   # Only do this if absolutely necessary and with approval
   pnpm lint:structure --json --limit 200 > scripts/structure-baseline.json
   ```

This guardrail ensures the codebase remains maintainable and prevents technical debt from accumulating.

---

## Testing Expectations

HeroByte uses a **3-tier optimization strategy** to maintain 100% coverage while keeping test execution fast and efficient, especially on resource-constrained environments like WSL.

### Quick Commands

```bash
# Run all tests sequentially (safe for WSL/low-memory systems)
pnpm test

# Run tests in parallel across workspaces (2x faster, requires ~4GB+ RAM)
pnpm test:parallel

# Run tests with coverage reports
pnpm test:coverage
```

### WSL Considerations

If running on Windows Subsystem for Linux (WSL):

- **Recommended:** Use `pnpm test` for stability
- **Parallel mode:** Available via `pnpm test:parallel` but requires adequate RAM
- **CI environment:** Tests automatically optimize for available CPU cores

### Writing Tests

- **Location:** Place test files alongside source code (`*.test.ts`, `*.test.tsx`)
- **Coverage target:** Aim for >80% coverage on critical paths (domain models, business logic)
- **Test utilities:** Use helpers from `/apps/client/src/test-utils/` (see Testing Architecture in README)
- **Optimization patterns:** Follow describe.each patterns for data-driven tests (reduces test count by 70-80%)

### Before Submitting PRs

1. Run `pnpm test` locally to verify all tests pass
2. Run `pnpm lint` to check code style
3. Document test commands used in your PR description
4. Include coverage reports if touching critical code paths

For detailed testing patterns and architecture, see the [Testing Architecture](README.md#testing-architecture) section in README.md.

**Test Quality Standards:** Follow the [Test Quality Guidelines](docs/TEST_QUALITY_GUIDELINES.md) to maintain test performance and prevent regression.

---

## Documentation Updates

If you modify behavior, configs, or workflows, update relevant docs:

- `README.md` – high-level overview, commands, screenshots, badges
- `DEVELOPMENT.md` – workflow/process adjustments
- `docs/TEST_QUALITY_GUIDELINES.md` – changes to testing patterns or standards
- `TODO.md` / `CHATGPT_NEXT_TASKS.md` – keep task board in sync

Screenshots or GIFs are encouraged for UI changes.

---

## Need Help?

- Open an issue with the `question` label
- Reach out via PR comments
- Mention maintainers if you need a quick review

Thanks again for contributing—your improvements help make HeroByte better for everyone! 🚀
