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

---

## Coding Standards

- TypeScript everywhere (strict mode enabled).
- Prefer `unknown` over `any`; add runtime validation if needed (e.g. zod).
- Avoid business logic in React components—encapsulate in hooks/services.
- Follow Domain-Driven Design structure already in place (domains, middleware, ws, etc.).
- Use named exports (no default exports) unless a React component.
- Keep files small and cohesive. When in doubt, create a new module.

### Formatting & Linting

- ESLint + Prettier enforce consistent style. Run `pnpm lint` and `pnpm format:check` before committing.
- Zero lint warnings policy (CI fails on warnings). Fix issues before pushing.
- Configure your editor to use workspace TypeScript and format on save.

---

## Testing Expectations

- Unit tests: use Vitest. Place files alongside source (`*.test.ts` / `*.test.tsx`).
- Shared package: aim for >80% coverage on domain models/types.
- Server package: add tests for middleware, domain services, and websocket logic when touched.
- End-to-end (Playwright/Cypress) tests are optional today but welcome.
- Include coverage if your change touches critical code paths (`pnpm test:coverage`).

When submitting your PR, document the exact commands you ran (e.g. `pnpm lint && pnpm test`).

---

## Documentation Updates

If you modify behavior, configs, or workflows, update relevant docs:

- `README.md` – high-level overview, commands, screenshots, badges
- `DEVELOPMENT.md` – workflow/process adjustments
- `TESTING_SETUP.md` – changes to testing approach or tooling
- `TODO.md` / `CHATGPT_NEXT_TASKS.md` – keep task board in sync

Screenshots or GIFs are encouraged for UI changes.

---

## Need Help?

- Open an issue with the `question` label
- Reach out via PR comments
- Mention maintainers if you need a quick review

Thanks again for contributing—your improvements help make HeroByte better for everyone! 🚀
