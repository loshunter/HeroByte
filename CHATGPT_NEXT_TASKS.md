# ChatGPT Next Tasks

You've completed **Phase 1-3: Testing Infrastructure & CI/CD**. Excellent work! 🎉

Here are your next options. **Choose ONE lane to focus on:**

---

## Option 1: Contributor Polish (RECOMMENDED NEXT)

**Goal**: Finish the CRITICAL contributor-readiness items to make the repo welcoming for newcomers.

### Tasks

1. **Create CONTRIBUTING.md**
   - Location: `/home/loshunter/HeroByte/CONTRIBUTING.md`
   - Contents:
     - Getting Started (fork, clone, install)
     - Development Workflow (branch from `dev`, naming conventions)
     - Code Style Guide (ESLint, Prettier, TypeScript strict mode)
     - Testing Requirements (run `pnpm test`, add tests for new features)
     - PR Process (create PR, link issues, wait for CI, code review)
     - Commit Message Guidelines (concise, descriptive)
   - Reference: See DEVELOPMENT.md and TESTING_SETUP.md for context

2. **Create GitHub Issue Templates**

   **Bug Report** - `.github/ISSUE_TEMPLATE/bug_report.md`:
   ```markdown
   ---
   name: Bug Report
   about: Report a bug or unexpected behavior
   title: '[BUG] '
   labels: bug
   ---

   ## Description
   A clear description of the bug.

   ## Steps to Reproduce
   1. Go to '...'
   2. Click on '...'
   3. See error

   ## Expected Behavior
   What you expected to happen.

   ## Actual Behavior
   What actually happened.

   ## Environment
   - OS: [e.g., Windows 11, macOS 13, Ubuntu 22.04]
   - Browser: [e.g., Chrome 120, Firefox 121]
   - Node version: [e.g., 18.19.0]

   ## Additional Context
   Screenshots, logs, or other relevant info.
   ```

   **Feature Request** - `.github/ISSUE_TEMPLATE/feature_request.md`:
   ```markdown
   ---
   name: Feature Request
   about: Suggest a new feature or enhancement
   title: '[FEATURE] '
   labels: enhancement
   ---

   ## Feature Description
   A clear description of the feature you'd like to see.

   ## Use Case
   Why is this feature valuable? What problem does it solve?

   ## Proposed Solution
   How should this feature work?

   ## Alternatives Considered
   Other approaches you've thought about.

   ## Additional Context
   Mockups, examples, or related features.
   ```

3. **Create Pull Request Template**

   **Location**: `.github/pull_request_template.md`
   ```markdown
   ## Description
   Brief description of what this PR does.

   ## Related Issues
   Closes #[issue number]

   ## Changes Made
   - [ ] Added/Updated feature X
   - [ ] Fixed bug Y
   - [ ] Added tests for Z

   ## Testing
   - [ ] All tests pass (`pnpm test`)
   - [ ] Linting passes (`pnpm lint`)
   - [ ] Tested locally

   ## Screenshots (if applicable)
   Add screenshots or GIFs showing the changes.

   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Tests added/updated for new functionality
   - [ ] Documentation updated (README, TODO, etc.)
   - [ ] No breaking changes (or documented if unavoidable)
   ```

4. **Update TODO.md**
   - Mark completed items in CRITICAL section:
     - [x] Issue Templates
     - [x] Pull request template
     - [x] Contributing guidelines

### Success Criteria
- ✅ CONTRIBUTING.md exists and is comprehensive
- ✅ 3 GitHub templates created (.github/ISSUE_TEMPLATE/*, .github/pull_request_template.md)
- ✅ TODO.md updated with completed items
- ✅ Ready for external contributors

---

## Option 2: Feature Roadmap (Phase 9 Work)

**Goal**: Implement Phase 9 features (Core State & Persistence).

### Tasks (Pick ONE to start)

#### 2A: Undo/Redo System for Drawings
- Add redo support (Ctrl+Y) to complement existing Ctrl+Z undo
- Location: `apps/client/src/hooks/useDrawingState.ts`
- Add `redoStack` state and `redo()` function
- Update keyboard handlers in `MapBoard.tsx`

#### 2B: Player State Persistence
- Create `playerPersistence.ts` utility in `apps/client/src/utils/`
- Implement `savePlayerState()` and `loadPlayerState()` functions using JSON download/upload
- Add Save/Load buttons to `PlayerCard.tsx`
- Test: Save player → reload tab → Load file → state restored

#### 2C: Session Save/Load
- Create `sessionPersistence.ts` in `apps/client/src/utils/`
- Implement `saveSession()` and `loadSession()` for full RoomSnapshot
- Add Save/Load buttons to `Header.tsx`
- Test: Save session → clear → load → full state restored

### Reference
- See TODO.md "Phase 9: Core State & Persistence" for full roadmap
- Follow SOLID principles (SRP, DIP, OCP)
- Add tests for new utilities

---

## Option 3: Code Hygiene

**Goal**: Clean up linting warnings to maintain code quality.

### Tasks (In Order)

1. **Fix Browser Globals in Client** (59 errors)
   - Add missing globals to `eslint.config.js`:
     - `WebSocket`, `HTMLElement`, `HTMLDivElement`, `KeyboardEvent`, `ResizeObserver`, `prompt`
   - Location: `eslint.config.js` → React configuration → globals section

2. **Replace `any` with `unknown`** (20 warnings in server)
   - Files to fix:
     - `apps/server/src/container.ts` (2 warnings)
     - `apps/server/src/domains/room/service.ts` (2 warnings)
     - `apps/server/src/middleware/validation.ts` (2 warnings)
     - `apps/server/src/ws/**/*.ts` (multiple warnings)
   - Use type guards or assertions after replacing `any` with `unknown`

3. **Remove Unused Imports** (multiple files)
   - Run `npx eslint --fix` to auto-remove unused imports
   - Manually review and fix remaining cases

4. **Lower Linting Thresholds**
   - After fixes, reduce `--max-warnings` in:
     - `apps/server/package.json` (currently 50 → target 0)
     - `apps/client/package.json` (currently 200 → target 50 → target 0)

### Success Criteria
- ✅ All lint errors fixed
- ✅ Warnings reduced to <10 total
- ✅ CI lint check passes without `|| true` fallback

---

## Recommendation

**Start with Option 1: Contributor Polish**

This is the quickest win and completes the CRITICAL contributor-readiness work. It should take 30-45 minutes and makes the repo immediately ready for external contributors.

After that, you can choose between:
- **Feature work** (Option 2) for new functionality
- **Code hygiene** (Option 3) for technical debt

---

## How to Proceed

1. Choose ONE option above
2. Work through the tasks in order
3. Commit changes incrementally (one task per commit)
4. Push to `dev` branch when complete
5. Report back with summary of completed work

Let me know which option you want to tackle!
