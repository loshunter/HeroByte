# MainLayout Refactoring - Team Manager Brief

**Role:** Refactoring Team Manager (Orchestrator)
**Mission:** Decompose MainLayout.tsx from 795 LOC god file → <200 LOC orchestration component
**Duration:** 3-4 weeks
**Priority:** HIGH - This is a NEW god file created during App.tsx refactoring that bypassed guardrails

---

## Quick Context (Read This First)

You are the **Refactoring Team Manager** for the MainLayout.tsx decomposition project. Your role is to **orchestrate** the refactoring by delegating work to specialized agents while maintaining overall coherence and quality.

**Current State:**
- `apps/client/src/layouts/MainLayout.tsx`: **795 LOC** (227% over 350 LOC threshold)
- Listed in `scripts/structure-baseline.json` as an approved violation (THIS SHOULD NOT HAVE HAPPENED)
- Created during Phase 7 of App.tsx refactoring
- Root cause: **312 LOC props interface** (80+ props across 20 categories) - a "god interface"

**Target State:**
- MainLayout.tsx: **<200 LOC** (orchestration only)
- 4 sub-layout components: each <350 LOC
- Removed from structure-baseline.json
- All tests passing, zero regressions

---

## Your Role as Orchestrator

### Core Responsibilities

1. **Strategic Planning**
   - Break work into manageable tasks for agents
   - Sequence tasks based on dependencies
   - Manage context window by delegating research/coding to agents

2. **Agent Coordination**
   - Launch specialized agents for focused work
   - Synthesize agent outputs into cohesive plan
   - Maintain architectural coherence across extractions

3. **Quality Assurance**
   - Verify each extraction meets standards
   - Ensure tests pass at each checkpoint
   - Maintain behavior preservation throughout

4. **Progress Tracking**
   - Update todo lists after each milestone
   - Document decisions and rationale
   - Track LOC reductions and metrics

### DO NOT Do Everything Yourself

❌ **Anti-Pattern:** Reading entire files, writing all code directly, holding all context
✅ **Best Practice:** Delegate to agents, synthesize results, maintain high-level coordination

---

## The Approved Plan (Your Roadmap)

### Phase 1: Extract Layout Sub-Components (3 weeks)

**Extraction 1: TopPanelLayout.tsx** (Week 1, Days 1-2)
- **Source:** Lines 544-574 of MainLayout.tsx
- **Target LOC:** ~120 LOC
- **Props:** ~15-20 (layout, connection, tool, UI state)
- **Components:** Header, ServerStatus, DrawingToolbar, MultiSelectToolbar
- **Effort:** 2 days

**Extraction 2: CenterCanvasLayout.tsx** (Week 1, Day 3)
- **Source:** Lines 577-614 of MainLayout.tsx
- **Target LOC:** ~50 LOC
- **Props:** ~25 (map, drawing, camera, alignment, selection)
- **Components:** MapBoard container with dynamic sizing
- **Effort:** 1 day

**Extraction 3: FloatingPanelsLayout.tsx** (Week 2, Days 1-2)
- **Source:** Lines 681-792 of MainLayout.tsx
- **Target LOC:** ~120 LOC
- **Props:** ~25-30 (DM management, dice, room password, toast, context menu)
- **Components:** DMMenu, ContextMenu, DiceRoller, RollLog, VisualEffects, Toast
- **Effort:** 2 days

**Extraction 4: BottomPanelLayout.tsx** (Week 2, Days 3-5)
- **Source:** Lines 616-679 of MainLayout.tsx
- **Target LOC:** ~180 LOC
- **Props:** ~30-35 (editing state, player actions, NPC/token management)
- **Components:** EntitiesPanel with complex editing logic
- **Effort:** 3 days
- **Note:** MOST COMPLEX - has inline HP editing callbacks (lines 646-663)

**Integration:** (Week 3, Day 1)
- Update MainLayout to use new sub-components
- Verify all tests pass
- Measure LOC reduction

### Phase 2: Process Improvements (Week 3, Days 2-5)

**Guardrail Enhancements:**
1. Add baseline modification warnings to CI
2. Update CONTRIBUTING.md with baseline policy
3. Remove MainLayout from structure-baseline.json
4. Document lessons learned

---

## Orchestration Strategy (HOW to Manage This)

### Context Window Management

**Problem:** You have limited context window and complex refactoring
**Solution:** Intelligent agent delegation and focused context loading

### Agent Types and When to Use Them

**1. Explore Agent** (`subagent_type: "Explore"`)
- **Use for:** Finding all references to props, understanding component structure
- **Example:** "Find all places where `editingHpUID` prop is used in MainLayout and child components"
- **When:** Before each extraction to understand dependencies

**2. General-Purpose Agent** (`subagent_type: "general-purpose"`)
- **Use for:** Multi-step tasks like full component extraction
- **Example:** "Extract TopPanelLayout component per the specification in MAINLAYOUT_REFACTOR_BRIEF.md"
- **When:** For complete extractions that require multiple file operations

**3. Direct Tool Execution** (Your own tools: Read, Edit, Write)
- **Use for:** Small, focused changes after agent research
- **Example:** Updating import statements, running tests
- **When:** Final integration steps, quick fixes

### Recommended Workflow Pattern

For each extraction, follow this pattern:

```
┌─────────────────────────────────────────────────┐
│ MANAGER: Review extraction specification       │
│ MANAGER: Create todo list for this extraction  │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ AGENT (Explore): Analyze source lines          │
│ Task: "Analyze MainLayout.tsx lines X-Y and    │
│        identify all props used, components      │
│        rendered, and dependencies"              │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ MANAGER: Review agent findings                 │
│ MANAGER: Design props interface                │
│ MANAGER: Define extraction boundaries          │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ AGENT (General): Write characterization tests  │
│ Task: "Write tests for current behavior of     │
│        TopPanelLayout rendering in MainLayout"  │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ AGENT (General): Create new component file     │
│ Task: "Create TopPanelLayout.tsx with          │
│        interface and component implementation"  │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ MANAGER: Read new component (verify quality)   │
│ MANAGER: Edit MainLayout to use new component  │
│ MANAGER: Run tests and verify                  │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ MANAGER: Update todo list (mark completed)     │
│ MANAGER: Document decisions made               │
│ MANAGER: Move to next extraction               │
└─────────────────────────────────────────────────┘
```

### Example Agent Delegation

**Good Delegation:**
```
"Launch an Explore agent to analyze MainLayout.tsx lines 544-574 (TopPanelLayout section)
and provide:
1. List of all props used in this section
2. Components rendered and their dependencies
3. Any inline logic or callbacks
4. Suggested props interface design"
```

**Poor Delegation (too vague):**
```
"Analyze MainLayout.tsx"  // Too broad, will use too much context
```

**Good Delegation:**
```
"Launch a general-purpose agent to:
1. Create apps/client/src/layouts/TopPanelLayout.tsx
2. Extract lines 544-574 from MainLayout.tsx
3. Define TopPanelLayoutProps interface with props: [list]
4. Write component with proper TypeScript types
5. Add JSDoc documentation"
```

---

## Critical Files Reference

### Must Read Before Starting

1. **This brief:** `/home/loshunter/HeroByte/docs/refactoring/MAINLAYOUT_REFACTOR_BRIEF.md`
2. **Source file:** `/home/loshunter/HeroByte/apps/client/src/layouts/MainLayout.tsx`
3. **Baseline:** `/home/loshunter/HeroByte/scripts/structure-baseline.json`
4. **Roadmap:** `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_ROADMAP.md`
5. **Playbook:** `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_PLAYBOOK.md`

### Reference During Work

- **Structure script:** `/home/loshunter/HeroByte/scripts/structure-report.mjs`
- **Package.json:** For available test commands
- **Phase 7 summary:** Check if exists for MainLayout extraction context

### Create During Work

- **Decision log:** Document why you made certain choices
- **Test results:** Track test passes/failures
- **LOC tracking:** Measure progress toward target

---

## Root Cause Analysis (Why This Happened)

### The God Interface Problem

MainLayout.tsx has an **interface-level god file**:
- **Lines 72-384:** Props interface (312 LOC = 89% of 350 LOC threshold!)
- **80+ props** organized into 20 categories
- Violates Interface Segregation Principle (ISP)

### Why Guardrails Failed

1. CI guardrails use `structure-baseline.json` for approved violations
2. MainLayout.tsx was added to baseline at 769 LOC
3. Once in baseline, CI no longer fails for this file
4. Someone ran `pnpm lint:structure --json > scripts/structure-baseline.json` after creating the god file
5. This "grandfathered in" the violation

### Lesson Learned

**Baseline updates should require:**
- PR review and approval
- Documented justification
- Temporary exemption with remediation plan

---

## Success Criteria (How You Know You're Done)

### Quantitative Metrics

- [ ] MainLayout.tsx: 795 → <200 LOC (✅ 75% reduction minimum)
- [ ] TopPanelLayout.tsx: <350 LOC
- [ ] CenterCanvasLayout.tsx: <350 LOC
- [ ] FloatingPanelsLayout.tsx: <350 LOC
- [ ] BottomPanelLayout.tsx: <350 LOC
- [ ] All props interfaces: <80 LOC each
- [ ] MainLayout.tsx removed from structure-baseline.json

### Qualitative Metrics

- [ ] All existing tests passing
- [ ] New characterization tests added (4 files minimum)
- [ ] No behavioral changes (manual verification)
- [ ] Clean separation of concerns
- [ ] Each component has single, clear responsibility
- [ ] Props interfaces follow ISP

### Process Metrics

- [ ] CI guardrails enhanced (baseline warnings)
- [ ] CONTRIBUTING.md updated with baseline policy
- [ ] Decision log created and maintained
- [ ] Lessons learned documented

---

## Step-by-Step Execution Guide

### Before You Start

**Step 1: Environment Setup (15 minutes)**
```bash
cd /home/loshunter/HeroByte
git checkout dev
git pull origin dev
git checkout -b refactor/main-layout/decompose
pnpm install
pnpm test  # Verify baseline
```

**Step 2: Context Gathering (30 minutes)**
- Read this brief completely
- Skim MainLayout.tsx (don't try to hold it all in context!)
- Review structure-baseline.json entry for MainLayout
- Check recent git history for MainLayout changes

**Step 3: Create Tracking Infrastructure (15 minutes)**
- Create todo list with all 4 extractions
- Create decision log file: `docs/refactoring/MAINLAYOUT_DECISIONS.md`
- Create test results tracker

### Extraction 1: TopPanelLayout (Days 1-2)

**Day 1, Morning: Analysis Phase**

```
MANAGER TODO:
1. Create todo list for TopPanelLayout extraction
2. Launch Explore agent to analyze lines 544-574
3. Review agent findings
4. Design TopPanelLayoutProps interface
```

**Agent Task 1:**
```
"Launch an Explore agent with thoroughness 'medium' to analyze MainLayout.tsx lines 544-574.

Instructions for agent:
1. Identify all props used in this section
2. List all components rendered: Header, ServerStatus, DrawingToolbar, MultiSelectToolbar
3. Note any conditional rendering logic
4. Find all callbacks or inline functions
5. Determine if any state is managed locally
6. Suggest props interface structure

Return findings in structured format."
```

**Day 1, Afternoon: Test Creation**

```
MANAGER TODO:
1. Review agent findings
2. Launch general-purpose agent to write characterization tests
3. Verify tests pass
```

**Agent Task 2:**
```
"Launch a general-purpose agent to create characterization tests.

Task:
1. Create file: apps/client/src/layouts/__tests__/TopPanelLayout.characterization.test.tsx
2. Write tests that verify current rendering behavior:
   - Header renders with correct props
   - ServerStatus shows when connected/disconnected
   - DrawingToolbar renders conditionally when drawMode is true
   - MultiSelectToolbar renders when multiple objects selected and user is DM
3. Use React Testing Library
4. Follow existing test patterns in codebase
5. Ensure all tests pass

Reference: apps/client/src/ui/__tests__/characterization/ for examples"
```

**Day 2, Morning: Component Creation**

```
MANAGER TODO:
1. Review test results
2. Launch general-purpose agent to create TopPanelLayout component
3. Review generated code for quality
```

**Agent Task 3:**
```
"Launch a general-purpose agent to create TopPanelLayout component.

Task:
1. Create file: apps/client/src/layouts/TopPanelLayout.tsx
2. Define TopPanelLayoutProps interface based on analysis:
   - Layout state props (topPanelRef)
   - Connection state (isConnected)
   - Tool state (activeTool, drawMode, etc.)
   - UI state (snapToGrid, crtFilter, etc.)
   - Handlers (setActiveTool, toggleDiceRoller, etc.)
3. Implement component that renders:
   - ServerStatus
   - DrawingToolbar (conditional on drawMode)
   - Header
   - MultiSelectToolbar
4. Extract JSX from MainLayout.tsx lines 544-574
5. Add comprehensive JSDoc
6. Use React.memo for performance

Requirements:
- TypeScript strict mode
- No inline logic - all logic via props
- Props interface <80 LOC
- Component code <120 LOC total"
```

**Day 2, Afternoon: Integration**

```
MANAGER TODO:
1. Read TopPanelLayout.tsx (verify quality)
2. Edit MainLayout.tsx to import and use TopPanelLayout
3. Update MainLayout.tsx props to include topPanelProps
4. Run tests
5. Manual verification in browser
6. Update todo list
7. Document decisions
```

**Manual Steps:**
1. Read new TopPanelLayout.tsx - check quality
2. Edit MainLayout.tsx:
   - Add import for TopPanelLayout
   - Add topPanelProps to MainLayoutProps interface
   - Replace lines 544-574 with `<TopPanelLayout {...topPanelProps} />`
3. Edit App.tsx to construct topPanelProps object
4. Run: `pnpm test` - verify passing
5. Run: `pnpm dev` - manual verification
6. Update todo: Mark TopPanelLayout as complete
7. Document in decision log: Why certain props were grouped

### Extraction 2: CenterCanvasLayout (Day 3)

**Follow same pattern:**
1. Analysis via Explore agent (lines 577-614)
2. Characterization tests via general-purpose agent
3. Component creation via general-purpose agent
4. Integration by manager
5. Verification and documentation

**Faster timeline:** Simpler component, less complex props

### Extraction 3: FloatingPanelsLayout (Days 4-5)

**Follow same pattern**
**Note:** Multiple child components but relatively independent

### Extraction 4: BottomPanelLayout (Days 6-8)

**Follow same pattern**
**Note:** MOST COMPLEX - has inline HP editing callbacks (lines 646-663)

**Special attention needed:**
- HP editing logic is inline (lines 646-663) - needs careful extraction
- Many callbacks that need proper typing
- Complex prop relationships

**Consider:** Launch dedicated agent just for analyzing HP editing logic

### Integration Week (Days 9-10)

**Final MainLayout Update:**
1. Verify all 4 sub-components working
2. Update MainLayout to simple orchestration
3. Measure LOC: Should be <200
4. Run full test suite
5. Manual E2E verification

**Process Improvements (Days 11-15):**
1. Update CI to warn on baseline changes
2. Update CONTRIBUTING.md
3. Remove MainLayout from baseline
4. Document lessons learned

---

## Agent Management Best Practices

### When to Launch Multiple Agents in Parallel

✅ **Good parallelization:**
```
"I'm going to launch 3 agents in parallel:
1. Explore agent: Analyze TopPanelLayout section
2. Explore agent: Analyze CenterCanvasLayout section
3. General-purpose agent: Research existing test patterns"
```

Then launch all 3 in a single message with multiple Task tool calls.

### When to Run Sequentially

❌ **Bad parallelization:**
```
"Launch agent to create component AND launch agent to write tests for that component"
```

Tests depend on component existing - must be sequential.

### Agent Prompt Quality

**Good Agent Prompt:**
- Specific scope and boundaries
- Clear deliverables
- Success criteria
- Reference files
- Expected output format

**Poor Agent Prompt:**
- Vague scope ("analyze the code")
- No deliverables specified
- No context provided

---

## Common Pitfalls to Avoid

### Pitfall 1: Trying to Hold Everything in Context

❌ **Wrong:** Read entire MainLayout.tsx, all child components, all tests, all related files
✅ **Right:** Use agents to analyze specific sections, synthesize findings

### Pitfall 2: Not Writing Tests First

❌ **Wrong:** Extract component, hope it works, write tests later
✅ **Right:** Characterization tests BEFORE extraction, verify behavior preserved

### Pitfall 3: Massive Props Interfaces

❌ **Wrong:** Create TopPanelLayoutProps with 50+ props
✅ **Right:** Group related props, use nested objects, keep interfaces <30 props

### Pitfall 4: Inline Logic

❌ **Wrong:** Add logic to new components (e.g., HP calculation in BottomPanelLayout)
✅ **Right:** All logic stays in App.tsx hooks, components are pure presentation

### Pitfall 5: Skipping Documentation

❌ **Wrong:** Extract all 4 components, skip decision log, forget why
✅ **Right:** Document decisions as you go, update todo list, maintain context

---

## Emergency Procedures

### If Tests Fail After Extraction

1. **Don't panic** - this is expected occasionally
2. Review the diff carefully
3. Check for:
   - Missing props
   - Incorrect prop names
   - Changed prop types
   - Missing conditional logic
4. Use Explore agent to compare original vs extracted sections
5. Fix and re-test
6. Document what went wrong in decision log

### If You Run Out of Context Window

1. **Save progress** - commit work-in-progress
2. Create handoff document:
   - What you completed
   - What's next
   - Key decisions made
   - Blockers encountered
3. Create new context with fresh agent
4. Load only essential files
5. Use decision log to regain context

### If Extraction Reveals Deeper Issues

Example: During extraction you discover circular dependencies or unclear ownership

1. **Pause extraction**
2. Document the issue in decision log
3. Create GitHub issue for deeper refactoring
4. Consider workaround for current extraction
5. Discuss with user/team before proceeding

---

## Communication & Checkpoints

### Daily Checkpoints

At end of each day:
1. Update todo list
2. Run `pnpm lint:structure` - track LOC changes
3. Commit progress to branch
4. Document in decision log

### Checkpoint Questions

Ask yourself:
- ✅ Are tests still passing?
- ✅ Is each extracted component <350 LOC?
- ✅ Are props interfaces <80 LOC?
- ✅ Is behavior preserved?
- ✅ Am I using agents effectively?

### When to Ask User for Help

🚨 **Ask user if:**
- You encounter architectural decision not covered in plan
- Tests reveal unexpected behavior that may be a bug
- You find security or performance concerns
- Timeline is slipping beyond 4 weeks
- You discover missing requirements

---

## Final Checklist (Before Marking Complete)

### Code Quality

- [ ] All 4 sub-components created and working
- [ ] MainLayout.tsx <200 LOC
- [ ] All props interfaces <80 LOC
- [ ] No inline logic in layout components
- [ ] Proper TypeScript types throughout
- [ ] JSDoc on all exported components

### Testing

- [ ] All existing tests passing
- [ ] 4 new characterization test files created
- [ ] Manual browser testing completed
- [ ] No console errors or warnings

### Documentation

- [ ] Decision log completed
- [ ] REFACTOR_ROADMAP.md updated (mark MainLayout complete)
- [ ] Lessons learned documented
- [ ] Commit messages follow conventions

### Process

- [ ] CI warnings for baseline changes added
- [ ] CONTRIBUTING.md updated with baseline policy
- [ ] MainLayout.tsx removed from structure-baseline.json
- [ ] Branch pushed to origin
- [ ] Ready for PR creation

---

## Quick Reference Commands

```bash
# Check current structure
pnpm lint:structure | grep MainLayout

# Run all tests
pnpm test

# Run specific test file
pnpm test apps/client/src/layouts/__tests__/TopPanelLayout.characterization.test.tsx

# Type check
pnpm typecheck

# Start dev server for manual testing
pnpm dev

# Check structure violations
pnpm lint:structure:enforce

# Format code
pnpm format

# Update baseline (ONLY after approval)
pnpm lint:structure --json --limit 200 > scripts/structure-baseline.json
```

---

## Your First Actions

When you start, immediately:

1. ✅ Read this brief completely (you are here)
2. ✅ Create todo list with all 4 extractions
3. ✅ Verify environment setup (git branch, dependencies)
4. ✅ Launch Explore agent for TopPanelLayout analysis
5. ✅ Begin Extraction 1 following the pattern above

---

**Remember:** You are the conductor, not the entire orchestra. Use your agents effectively, maintain high-level coherence, and create a symphony of well-decomposed components.

**Good luck! 🎯**

---

**Document Version:** 1.0
**Created:** 2025-10-21
**Author:** Previous Claude Instance (Code Analysis)
**For:** Refactoring Team Manager (Orchestrator Role)
