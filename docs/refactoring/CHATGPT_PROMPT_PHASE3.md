# ChatGPT Phase 3 Prompt

> **Status (2025-10-22):** Phase 3 is complete. `useKonvaNodeRefs` now lives at `apps/client/src/hooks/useKonvaNodeRefs.ts`, MapBoard integration shipped in commit `b1674b8`, and CI is green. Keep this prompt for historical reference or future retrospectives—no additional extraction work remains for this phase.

**Copy and paste this entire message to ChatGPT:**

---

# MapBoard.tsx Phase 3 Refactoring Task

I need you to help me refactor MapBoard.tsx by extracting the Konva node reference management system. This is Phase 3 of our systematic refactoring effort.

## Your Role

You are a senior TypeScript/React engineer working on the HeroByte VTT codebase. You successfully completed Phase 2 (extracting 3 simple state hooks). Now you're tackling Phase 3, which is more complex - it involves extracting a node reference management system with multiple callbacks and performance-critical code.

## Task Overview

Extract **ONE complex hook** from `apps/client/src/ui/MapBoard.tsx`:

**useKonvaNodeRefs** - Centralized Konva node reference management (80 LOC reduction)

**Challenge Level:** HIGH - This is more complex than Phase 2 because:
- Uses Refs and Map (not simple useState)
- 5+ callbacks to replace
- Performance-critical code paths
- Selected node tracking logic
- Must maintain backward compatibility

**Goal:** Reduce MapBoard.tsx from 864 → 784 LOC (80 LOC reduction)

## Critical Instructions

1. **Read the handoff document:** I've attached `HANDOFF_CHATGPT_PHASE3.md` which contains:
   - Complete system architecture explanation
   - Detailed code locations (10+ scattered pieces)
   - Hook API design specification
   - 15+ test requirements
   - Integration guide with before/after examples
   - Performance considerations
   - Common pitfalls to avoid

2. **Understand the complexity FIRST:**
   - This is NOT like Phase 2 (simple state)
   - The node refs system is scattered across MapBoard.tsx
   - Multiple callbacks need careful handling
   - Performance matters (marquee selection uses this in hot path)
   - Selected node tracking has tricky lifecycle

3. **Follow the modified playbook:**
   - **Step 1-3:** Deep research (understand ALL nodeRefsMap usages)
   - **Step 4-6:** Design the hook API (think through return values)
   - **Step 7-9:** Write 15+ tests FIRST (TDD approach)
   - **Step 10-12:** Implement hook (refs + callbacks + effects)
   - **Step 13-15:** Integrate carefully (update all 5+ callbacks)
   - **Step 16-18:** Verify thoroughly (transform gizmo, marquee selection)
   - **Step 19-20:** Commit with detailed message

4. **Code quality requirements:**
   - ✅ Comprehensive JSDoc with examples
   - ✅ 15+ tests minimum (cover all edge cases)
   - ✅ All callbacks properly memoized
   - ✅ Performance maintained (no regressions)
   - ✅ Backward compatible API
   - ✅ Zero behavior changes

5. **Testing requirements:**
   - Test node registration/unregistration
   - Test selected node tracking
   - Test map object handling
   - Test all edge cases (null, undefined, changes)
   - Test node lifecycle properly
   - Minimum 15 tests

6. **Integration requirements:**
   - Update all 5+ node-ready callbacks
   - Update getSelectedNodeRef
   - Update marquee selection code
   - Remove old refs and useEffect
   - Maintain performance

## Non-Negotiable Guardrails

- **No coding yet:** Do not write hook or integration code until we agree on understanding + tests.
- **Plan in the open:** Walk me through the extraction plan, including how you'll keep callbacks stable and performant.
- **Performance mindset:** Assume marquee selection is a hot path; avoid any approach that clones Maps or rebuilds callbacks per render.
- **Verification cadence:** Pause after each milestone (understanding → tests → hook → integration) and wait for my explicit approval.
- **Zero behavior drift:** This is an extraction only; if you think any behavior should change, flag it before touching code.

## Your Workflow

This is a single complex extraction:

1. **Show me your understanding:**
   - Explain the node reference system in your own words
   - Identify all 10+ code locations that need extraction
   - Propose the hook API design
   - Wait for my confirmation

2. **Show me the tests:**
   - Show the test file with 15+ tests
   - Cover all functionality and edge cases
   - Wait for my review

3. **Show me the hook:**
   - Show the implementation with JSDoc
   - Explain key design decisions
   - Wait for my review

4. **Show me the integration:**
   - Show MapBoard.tsx changes
   - Highlight all callback updates
   - Show before/after LOC count
   - Wait for my confirmation

5. **Provide commit command:**
   - Detailed commit message
   - Include all changes
   - Confirm manual verification steps for transform gizmo + marquee selection plan

## Deliverables

After completion, provide:
1. `useKonvaNodeRefs.ts` with comprehensive JSDoc
2. `useKonvaNodeRefs.test.ts` with 15+ tests
3. Updated `MapBoard.tsx` with all callbacks replaced
4. Git commit command with detailed message
5. LOC reduction summary (target: -80 LOC)
6. Verification that transform gizmo and marquee selection work (describe manual checks you will perform)

## Important Context

- **Project:** HeroByte VTT (virtual tabletop)
- **Stack:** React, TypeScript, Vitest, Konva (canvas library)
- **Current branch:** dev
- **MapBoard.tsx current size (post-phase):** 880 LOC (down from 895 pre-extraction)
- **Phase 2 completed:** useGridConfig, useCursorStyle, useSceneObjectsData extracted
- **Node reference system is scattered across:**
  - Line ~624: nodeRefsMap declaration
  - Line ~226: selectedObjectNodeRef declaration
  - Lines ~627-635: Selected node update useEffect
  - Lines ~595-606: handleMapNodeReady callback
  - Lines ~637-643: handleTokenNodeReady callback
  - Lines ~646-652: handleDrawingNodeReady callback
  - Lines ~655-661: handlePropNodeReady callback
  - Lines ~590-592: getSelectedNodeRef callback
  - Line ~842: Staging zone inline ref
  - Lines ~679-698: Marquee selection usage

## Key Challenges to Address

1. **Performance:** Marquee selection iterates all nodes on mousemove - must stay fast
2. **Callbacks:** 5+ callbacks passed to children - must be stable (useCallback)
3. **Selection:** Selected node must update when selectedObjectId changes
4. **Map object:** Must handle map object changes gracefully
5. **Lifecycle:** Nodes must be properly unregistered

## Questions to Ask Me

Before you start, confirm:
1. You understand this is MORE complex than Phase 2
2. You've read the locations of all 10+ code pieces
3. You understand the hook needs to return callbacks + getters
4. You understand performance is critical
5. You need the current MapBoard.tsx content
6. You need any clarifications on the architecture

## Success Criteria

Phase 3 is complete when:
- ✅ useKonvaNodeRefs hook created (comprehensive JSDoc)
- ✅ 15+ tests written and passing
- ✅ MapBoard.tsx ≈ 784 LOC (target: -80 LOC)
- ✅ All existing tests pass (no regressions)
- ✅ Zero TypeScript errors
- ✅ Transform gizmo works (manual verification)
- ✅ Marquee selection works (manual verification)
- ✅ No performance regressions
- ✅ All callbacks properly replaced
- ✅ Commit with detailed message

## Differences from Phase 2

| Aspect | Phase 2 | Phase 3 |
|--------|---------|---------|
| Hooks | 3 simple hooks | 1 complex hook |
| LOC each | 25-40 | 80 |
| State | useState | Refs + Map |
| Callbacks | 0-1 | 5+ callbacks |
| Complexity | Low-Medium | High |
| Performance | Not critical | Very critical |

**Important:** Take your time. This is harder than Phase 2. Ask questions. Test thoroughly.

## Start Here

Please confirm you understand by:
1. Explaining what the node reference system does
2. Listing the 10+ code locations you'll extract
3. Proposing the hook's return type
4. Asking for the current MapBoard.tsx content
5. Asking for any clarifications

Then we'll proceed step by step.

---

**Attached Document:** Please read `HANDOFF_CHATGPT_PHASE3.md` in full before starting. It contains detailed specifications and examples.

**Remember:** Phase 3 is complex but follows proven patterns. Write tests first, implement carefully, verify thoroughly.

Ready? Let's tackle this! 🚀
