# Syncing HeroByte Changes Locally

This guide helps you pull the latest automated testing updates (token movement, dice coverage, and the supporting E2E hooks) into your workstation. Follow the checklist below to make sure your local `dev` branch has the same commits that landed in the container environment.

## 1. Prerequisites

- **Git** 2.40+
- **Node.js** 20.19 or newer
- **pnpm** 8.x or 9.x (`corepack enable` will install pnpm automatically on Node 20.10+)
- **Playwright browsers** (Chromium) — installed automatically by the sync script, or run `pnpm exec playwright install --with-deps chromium`

> ℹ️  If you do not have pnpm yet, install Node 20 and run `corepack enable pnpm` before continuing.

## 2. Fetch the Latest Branch

The container kept the changes on a working branch named `work`. To keep local workflows aligned with our docs, we sync them into `dev`.

```bash
# From inside your HeroByte clone
git fetch origin
# Create/fast-forward dev from origin/dev when it exists, otherwise use origin/work
git checkout -B dev origin/dev || git checkout -B dev origin/work
```

If neither `origin/dev` nor `origin/work` exists, ask the original author to push the branch first.

## 3. Install Dependencies

```bash
pnpm install
pnpm exec playwright install --with-deps chromium
```

These commands bring down workspace packages and ensure the Chromium runtime that our Playwright specs rely on is present.

## 4. Verify the E2E Suite

```bash
pnpm test:e2e
```

The suite covers:

- **Lobby smoke test** — joins the default room using password `Fun1`
- **Dice roller** — rolls a d20 and validates the roll log
- **Token movement** — drags the player token one grid square and confirms the snapshot update telemetry

Traces, screenshots, and logs appear in `playwright-report/` on failure. If the browsers are missing, rerun the install command from Step 3.

## 5. One-Command Sync (Optional)

You can automate the steps above with the helper script added in this change set:

```bash
scripts/sync-dev.sh            # defaults to origin -> dev (falls back to work)
RUN_E2E_TESTS=1 scripts/sync-dev.sh  # also runs pnpm test:e2e after syncing
```

The script will:

1. Fetch the latest remote refs
2. Check out `dev` (or a fallback branch you specify via `SYNC_FALLBACK_BRANCH`)
3. Run `pnpm install`
4. Install Playwright's Chromium browser if available
5. Optionally execute the E2E suite when `RUN_E2E_TESTS=1`

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `fatal: not a git repository` | Run the commands from the root of your clone (where `.git/` lives). |
| `error: pathspec 'origin/dev' did not match any` | Use the fallback `origin/work` branch or confirm the remote push finished. |
| `pnpm: command not found` | Install Node 20+ and run `corepack enable pnpm`. |
| Playwright install fails on Linux | Install system dependencies (`sudo npx playwright install-deps chromium`) or use WSL/WSA. |
| E2E tests fail with connection refused | Start the dev server manually (`pnpm --filter herobyte-client dev` and `pnpm --filter vtt-server start`) or let the Playwright webServer config boot them for you. |

With these steps you can mirror the container's Playwright-enabled workflow on your local development environment.
