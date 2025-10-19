# Default Room Password Smoke Test

**Date:** 2025-10-18

## Goal
Validate that the demo room password `Fun1` still signs users into the default room after the chrome-devtools MCP documentation changes.

## Environment
- Node.js v20.19 (container image)
- Chromium 141.0.7390.37 via Playwright
- `pnpm` v10.17.1

> **Note:** The sandboxed container does not expose a GUI session, so the `chrome-devtools-mcp` server cannot be exercised interactively. Instead, the existing Chromium automation stack (Playwright) was used to emulate the same browser flow that would be triggered through MCP tooling.

## Steps
1. Install Playwright Chromium dependencies: `pnpm exec playwright install chromium` and `pnpm exec playwright install-deps chromium`.
2. Run the smoke E2E scenario: `pnpm test:e2e`.

## Result
- ✅ `apps/e2e/smoke.spec.ts` → “user can join default room” passed, confirming that entering `Fun1` authenticates and renders the tabletop UI.

## Logs
- Playwright output: see `pnpm test:e2e` run in container log `e4ccfd`.

## Follow-up
- If an interactive MCP session is required, run the same smoke scenario through `chrome-devtools-mcp` on a host with a graphical Chromium installation and forward credentials via Claude Code or Codex CLI.
