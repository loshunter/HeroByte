# ChatGPT Phase 2 Prompt

**Copy and paste this entire message to ChatGPT:**

---

# MapBoard.tsx Phase 2 Refactoring Task

I need you to help me refactor MapBoard.tsx by extracting 3 state management hooks. This is Phase 2 of a systematic refactoring effort.

## Your Role

You are a senior TypeScript/React engineer working on the HeroByte VTT codebase. You have successfully completed similar refactorings (App.tsx and DMMenu.tsx) and now you're handling MapBoard.tsx Phase 2.

## Task Overview

Extract 3 hooks from `apps/client/src/ui/MapBoard.tsx`:
1. **useGridConfig** - Grid configuration state (25 LOC reduction)
2. **useCursorStyle** - Cursor style based on modes (30 LOC reduction)
3. **useSceneObjectsData** - Scene object filtering and staging zone calculations (40 LOC reduction)

**Goal:** Reduce MapBoard.tsx from 959 → 864 LOC (95 LOC reduction)

## Critical Instructions

1. **Read the handoff document:** I've attached a comprehensive handoff document (`HANDOFF_CHATGPT_PHASE2.md`) that contains:
   - Complete context and background
   - 17-step extraction playbook
   - Detailed specifications for each hook
   - Test examples and patterns
   - Commit message format
   - Quality gates

2. **Follow the playbook EXACTLY:** For each hook:
   - Write tests FIRST (TDD approach)
   - Extract the hook with comprehensive JSDoc
   - Integrate into MapBoard.tsx
   - Run tests and verify
   - Commit with proper message format
   - ONE hook per commit (3 total commits)

3. **Code quality requirements:**
   - ✅ All tests must pass
   - ✅ Comprehensive JSDoc on every hook
   - ✅ No TypeScript errors
   - ✅ Follow existing code patterns from Phase 1
   - ✅ Maintain 100% test coverage
   - ✅ No behavior changes (extract, don't refactor)

4. **Testing requirements:**
   - Use Vitest + React Testing Library
   - Test happy path + edge cases
   - Follow examples from `useElementSize.test.ts`
   - Minimum 3-5 tests per hook

5. **Commit requirements:**
   - Follow conventional commit format
   - Include detailed commit body
   - Reference Phase 15 initiative
   - Add co-author attribution

## Your Workflow

For **each of the 3 hooks**, you should:

1. Show me the test file first
2. Show me the hook implementation
3. Show me the MapBoard.tsx integration changes
4. Show me the commit command
5. Wait for my confirmation before moving to the next hook

## Deliverables

After completing all 3 tasks, provide:
1. All 6 new files (3 hooks + 3 test files)
2. Updated MapBoard.tsx
3. 3 git commit commands
4. Summary of LOC reduction achieved
5. Confirmation that all tests pass

## Important Context

- **Project:** HeroByte VTT (virtual tabletop)
- **Stack:** React, TypeScript, Vitest, Konva (canvas library)
- **Current branch:** dev
- **MapBoard.tsx current size:** 959 LOC
- **Phase 1 completed:** useElementSize, coordinateTransforms, MapBoard.types extracted
- **Test command:** `pnpm test:client -- [hookName]`
- **Build command:** `pnpm --filter herobyte-client build`

## Questions to Ask Me

Before you start, ask if:
1. You need me to provide the current MapBoard.tsx content
2. You need to see any Phase 1 examples for reference
3. You need clarification on any part of the handoff document
4. You have questions about the codebase structure

## Success Criteria

Phase 2 is complete when:
- ✅ 3 hooks extracted with tests
- ✅ MapBoard.tsx ≈ 864 LOC (target: -95 LOC)
- ✅ All tests pass (expect ~1619+ tests total)
- ✅ Zero TypeScript errors
- ✅ 3 commits with proper messages
- ✅ No behavioral changes

## Start Here

Please confirm you understand the task by:
1. Summarizing the 3 hooks you'll extract
2. Explaining the 17-step playbook in your own words
3. Asking for any files or clarifications you need

Then we'll proceed with Task 1 (useGridConfig).

---

**Attached Document:** Please read `HANDOFF_CHATGPT_PHASE2.md` in full before starting.

Ready? Let's build! 🚀
