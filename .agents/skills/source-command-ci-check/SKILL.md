---
name: "source-command-ci-check"
description: "Monitor GitHub Actions CI workflow status and auto-fix common errors"
---

# source-command-ci-check

Use this skill when the user asks to run the migrated source command `ci-check`.

## Command Template

Monitor the latest GitHub Actions CI workflow run for this repository.

Your task:

1. **Get the latest workflow run** using `gh run list --workflow=ci.yml --limit=1 --json status,conclusion,databaseId,headBranch,createdAt,displayTitle`

2. **Check the status**:
   - If status is "completed":
     - conclusion "success" → Report success ✅
     - conclusion "failure" → Get failure details (step 3)
   - If status is "queued" or "in_progress":
     - Wait 10 seconds and check again
     - Poll up to 60 times (10 minutes max)
     - Show progress updates every 30 seconds

3. **On failure, diagnose the issue**:
   - Use `gh run view <run-id> --log-failed` to get failed job logs
   - Parse logs for common error patterns:
     - **Prettier errors**: "Replace ..." or "Insert ..." or "Delete ..."
     - **ESLint errors**: "'X' is defined but never used" or other lint violations
     - **TypeScript errors**: "error TS"
     - **Test failures**: "FAIL" or test error messages

4. **Auto-fix if possible**:
   - **Prettier errors**:
     ```bash
     pnpm format
     git add -A
     git commit -m "fix: auto-format code for CI"
     git push origin <current-branch>
     ```
     Then monitor CI again (max 3 auto-fix iterations)

   - **ESLint unused imports**:
     - Parse error for file path and unused variable
     - Remove the unused import
     - Commit and push
     - Monitor CI again (max 3 auto-fix iterations)

   - **Other errors**: Report details to user and ask for guidance

5. **Report final status**:
   - ✅ CI passed
   - ❌ CI failed with details
   - 🔧 Auto-fixed N times, final result: ...

**Important**:
- Always show the CI run URL: `https://github.com/loshunter/HeroByte/actions/runs/<run-id>`
- If auto-fixing, limit to 3 iterations to avoid infinite loops
- Use `gh run watch <run-id>` to follow the run in real-time if helpful
