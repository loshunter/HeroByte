#!/usr/bin/env bash
set -euo pipefail

REMOTE_NAME="${1:-origin}"
TARGET_BRANCH="${2:-dev}"
FALLBACK_BRANCH="${SYNC_FALLBACK_BRANCH:-work}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run this script from inside the HeroByte repository." >&2
  exit 1
fi

if [[ -z "$FALLBACK_BRANCH" ]]; then
  FALLBACK_BRANCH="work"
fi

printf "➡️  Fetching latest refs from '%s'...\n" "$REMOTE_NAME"
git fetch "$REMOTE_NAME"

SELECTED_UPSTREAM=""
if git show-ref --verify --quiet "refs/remotes/${REMOTE_NAME}/${TARGET_BRANCH}"; then
  SELECTED_UPSTREAM="$TARGET_BRANCH"
elif git show-ref --verify --quiet "refs/remotes/${REMOTE_NAME}/${FALLBACK_BRANCH}"; then
  SELECTED_UPSTREAM="$FALLBACK_BRANCH"
  printf "⚠️  Remote branch '%s/%s' missing; syncing from '%s/%s' instead.\n" \
    "$REMOTE_NAME" "$TARGET_BRANCH" "$REMOTE_NAME" "$FALLBACK_BRANCH"
else
  cat <<ERR >&2
Error: Neither '${REMOTE_NAME}/${TARGET_BRANCH}' nor fallback '${REMOTE_NAME}/${FALLBACK_BRANCH}' exist.
Set SYNC_FALLBACK_BRANCH to a remote branch that contains the desired changes.
ERR
  exit 1
fi

printf "➡️  Checking out local branch '%s' tracking '%s/%s'...\n" \
  "$TARGET_BRANCH" "$REMOTE_NAME" "$SELECTED_UPSTREAM"
git checkout -B "$TARGET_BRANCH" "${REMOTE_NAME}/${SELECTED_UPSTREAM}"

if command -v pnpm >/dev/null 2>&1; then
  printf "➡️  Installing workspace dependencies with pnpm...\n"
  pnpm install

  if pnpm exec playwright --version >/dev/null 2>&1; then
    printf "➡️  Ensuring Chromium browser dependencies for Playwright...\n"
    pnpm exec playwright install --with-deps chromium
  else
    printf "ℹ️  Playwright not found in workspace; skipping browser install.\n"
  fi

  if [[ "${RUN_E2E_TESTS:-0}" == "1" ]]; then
    printf "➡️  Running Playwright end-to-end suite...\n"
    pnpm test:e2e
  else
    printf "ℹ️  Skipping Playwright run (set RUN_E2E_TESTS=1 to enable).\n"
  fi
else
  cat <<'WARN'
⚠️  pnpm is not installed. Install Node.js 20+ and pnpm 8+ to finish syncing dependencies.
WARN
fi

printf "✅  Sync complete. Current branch: %s\n" "$(git rev-parse --abbrev-ref HEAD)"
