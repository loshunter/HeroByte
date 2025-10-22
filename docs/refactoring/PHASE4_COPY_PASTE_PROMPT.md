# Phase 4 Final Task - Copy-Paste Prompt

Use this prompt after context clearing to complete Phase 4:

---

I'm continuing the DMMenu.tsx Phase 4 refactoring. Read the handoff document at /home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE4_FINAL_HANDOFF.md to understand the current state.

Current status:
- DMMenu.tsx is at 622 LOC (down from 1,588)
- 2 of 3 Phase 4 components extracted (MapTransformControl, StagingZoneControl)
- Branch: refactor/dm-menu/stateful-tabs
- 966 LOC reduced so far (61%)

Phase 4 final task: Extract GridAlignmentWizard (Priority 12, ~90-120 LOC)

CRITICAL: Use agents effectively to minimize your context usage:
- Use Explore agent to find the GridAlignmentWizard code in DMMenu.tsx
- Use general-purpose agents to write tests (follow NPCEditor.test.tsx pattern)
- Use general-purpose agents to extract component
- Launch agents in PARALLEL when possible (single message, multiple Task calls)

Follow the proven 4-step extraction pattern from the handoff document:
1. Write characterization tests (use agent)
2. Extract component file (use agent)
3. Update tests to import extracted component (use agent)
4. Integrate into DMMenu.tsx and commit

Start by using an Explore agent to locate the GridAlignmentWizard code in DMMenu.tsx. Search for "Grid Alignment", "gridAlignment", "gridSize", or related terms. Once found, proceed with the 4-step pattern.

Remember: Use fireEvent (NOT userEvent), use accessible queries (getByLabelText, getByRole), and preserve all logic exactly as-is.
