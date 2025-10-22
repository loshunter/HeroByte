# DMMenu Phase 2 Handoff Document

**Date:** 2025-10-21
**Phase:** DMMenu.tsx Phase 2 - Entity Editors (NPCEditor in progress)
**Branch:** `refactor/dm-menu/stateful-tabs`
**Status:** NPCEditor tests complete, ready for extraction

---

## 🎯 Current Objective

Extract **NPCEditor** and **PropEditor** components from DMMenu.tsx as part of Phase 2: Entity Editors.

**Goal:** Reduce DMMenu.tsx by ~390 LOC through extraction of self-contained CRUD components.

---

## ✅ What's Complete

### 1. Branch Setup
- **Branch:** `refactor/dm-menu/stateful-tabs`
- **Base:** `dev` (up to date)
- **Status:** Clean working directory

### 2. NPCEditor Characterization Tests
- **Location:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx`
- **Test Count:** 29 comprehensive tests
- **Status:** ✅ All passing (verified)
- **Coverage:**
  - Initial rendering (3 tests)
  - Name editing (5 tests)
  - HP editing (5 tests)
  - Max HP editing (4 tests)
  - Portrait editing (4 tests)
  - Token image editing (4 tests)
  - Action buttons (3 tests)
  - Props updates (1 test)

**Key Testing Pattern:**
- Uses `fireEvent` (NOT `userEvent` - not available in this codebase)
- Tests inline component extracted from DMMenu.tsx lines 298-509
- Captures all edge cases: validation, clamping, trimming, Enter key handling

---

## 📋 Next Steps (Immediate)

### Step 1: Create NPCEditor Component File ⏭️ START HERE

**Action:** Extract NPCEditor from DMMenu.tsx into standalone component

**Source Location:**
```
File: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx
Lines: 298-509 (NPCEditor component + interface at 96-107)
```

**Target Location:**
```
/home/loshunter/HeroByte/apps/client/src/features/dm/components/NPCEditor.tsx
```

**What to Extract:**
1. Interface `NPCEditorProps` (lines 96-107)
2. Component `NPCEditor` (lines 298-509)
3. All imports needed by the component:
   - `React` hooks (useState, useEffect)
   - `Character` type from `@shared`
   - `JRPGPanel`, `JRPGButton` from UI components

**Component Structure:**
```typescript
// NPCEditor.tsx
import { useState, useEffect } from "react";
import type { Character } from "@shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";

interface NPCEditorProps {
  npc: Character;
  onUpdate: (updates: {
    name: string;
    hp: number;
    maxHp: number;
    portrait?: string;
    tokenImage?: string;
  }) => void;
  onPlace: () => void;
  onDelete: () => void;
}

export function NPCEditor({ npc, onUpdate, onPlace, onDelete }: NPCEditorProps) {
  // ... copy lines 299-508 from DMMenu.tsx
}
```

### Step 2: Update NPCEditor Tests

**Action:** Update test imports to use extracted component

**File:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx`

**Changes:**
1. Remove inline NPCEditor component (lines 16-218)
2. Add import: `import { NPCEditor } from "../NPCEditor";`
3. Run tests to verify: `pnpm test:client -- NPCEditor.test.tsx`

### Step 3: Integrate into DMMenu.tsx

**Action:** Replace inline component with import

**File:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx`

**Changes:**
1. Add import at top: `import { NPCEditor } from "./NPCEditor";`
2. Remove `NPCEditorProps` interface (lines 96-107)
3. Remove `NPCEditor` component (lines 298-509)
4. NPCEditor usage (lines 1392-1398) remains unchanged - already using imported component

**Verification:**
```bash
pnpm test:client     # All tests should pass
pnpm typecheck       # TypeScript should compile
```

### Step 4: Commit NPCEditor Extraction

**Commit Message Template:**
```
refactor: extract NPCEditor from DMMenu.tsx

Extract NPCEditor component into standalone file.

Changes:
- Create NPCEditor.tsx with component and interface
- Update characterization tests to import extracted component
- Remove inline component from DMMenu.tsx (210 LOC reduction)

Part of Phase 2: Entity Editors
See: docs/refactoring/REFACTOR_ROADMAP.md DMMenu Phase 2
```

---

## 📋 Next Steps (After NPCEditor)

### Step 5: Extract PropEditor (Priority 6)

**Source Location:**
```
File: /home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx
Lines: 125-292 (PropEditor component + interface at 113-123)
```

**Process:** Follow same 4-step pattern as NPCEditor:
1. Write characterization tests
2. Extract component file
3. Update test imports
4. Integrate into DMMenu.tsx

**Estimated LOC Reduction:** ~180 LOC

---

## 🗺️ Roadmap Context

**Current Phase:** DMMenu.tsx Phase 2 - Entity Editors
**Overall Goal:** DMMenu.tsx 1,588 LOC → 350 LOC (78% reduction)

**Phase 2 Breakdown:**
| Priority | Component | LOC | Target Path | Status |
|----------|-----------|-----|-------------|--------|
| 5 | NPCEditor | 210 | `/features/dm/components/NPCEditor.tsx` | 🔄 Tests done |
| 6 | PropEditor | 180 | `/features/dm/components/PropEditor.tsx` | ⏳ Pending |

**Phase 2 Goal:** ~390 LOC reduction → DMMenu.tsx down to ~1,198 LOC

**Related Documents:**
- Master Roadmap: `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_ROADMAP.md`
- Refactoring Playbook: `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_PLAYBOOK.md`
- Branching Strategy: `/home/loshunter/HeroByte/docs/refactoring/BRANCHING_STRATEGY.md`

---

## 🛠️ Tools & Commands

### Testing
```bash
# Run NPCEditor tests only
pnpm test:client -- NPCEditor.test.tsx

# Run all tests
pnpm test:client

# Run typecheck
pnpm typecheck

# Run linting
pnpm lint
```

### Git Workflow
```bash
# Check current status
git status

# Stage files
git add <files>

# Commit with message
git commit -m "refactor: <description>"

# Push to remote
git push origin refactor/dm-menu/stateful-tabs

# Create PR when phase complete
gh pr create --title "Phase 2: Extract NPCEditor and PropEditor" --body "..."
```

### Agents & Task Orchestration

**IMPORTANT:** You can orchestrate agents to work in parallel for efficiency.

**Available Agents:**
- `general-purpose`: Multi-step tasks, complex searches
- `Explore`: Fast codebase exploration (use for finding patterns, understanding structure)

**When to Use Agents:**
1. **Parallel Extraction:** If extracting multiple components, launch agents in parallel
2. **Complex Searches:** Use Explore agent for "quick" searches when looking for usage patterns
3. **Multi-Step Tasks:** Delegate entire extraction workflows to general-purpose agents

**Example: Parallel Extraction**
```typescript
// Launch two agents in parallel for NPCEditor and PropEditor
Task(
  description: "Extract NPCEditor component",
  prompt: "Follow steps 1-4 in DMMENU_PHASE2_HANDOFF.md for NPCEditor",
  subagent_type: "general-purpose"
)
Task(
  description: "Extract PropEditor component",
  prompt: "Follow steps 1-4 in DMMENU_PHASE2_HANDOFF.md for PropEditor",
  subagent_type: "general-purpose"
)
```

---

## 📁 Key File Locations

### Source Files
- **DMMenu.tsx:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/DMMenu.tsx` (1,588 LOC)
- **NPCEditor (inline):** Lines 298-509 (210 LOC)
- **PropEditor (inline):** Lines 125-292 (180 LOC)

### Test Files
- **NPCEditor Tests:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/__tests__/characterization/NPCEditor.test.tsx` (✅ Complete)
- **PropEditor Tests:** Not yet created (⏳ Next task)

### Target Extraction Locations
- **NPCEditor.tsx:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/NPCEditor.tsx`
- **PropEditor.tsx:** `/home/loshunter/HeroByte/apps/client/src/features/dm/components/PropEditor.tsx`

### Documentation
- **This Handoff:** `/home/loshunter/HeroByte/docs/refactoring/DMMENU_PHASE2_HANDOFF.md`
- **Roadmap:** `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_ROADMAP.md`
- **Playbook:** `/home/loshunter/HeroByte/docs/refactoring/REFACTOR_PLAYBOOK.md`

---

## ⚠️ Important Notes

### Testing Pattern
- **Use `fireEvent`, NOT `userEvent`:** This codebase doesn't have `@testing-library/user-event` installed
- **Pattern:** `fireEvent.change()`, `fireEvent.blur()`, `fireEvent.click()`, `fireEvent.keyDown()`
- **Reference:** See NPCEditor.test.tsx for examples

### Component Dependencies
- **UI Components:** Both editors use `JRPGPanel` and `JRPGButton`
- **Type Imports:** Need `Character`, `Prop`, `Player`, `TokenSize` from `@shared`
- **Validation Logic:** HP clamping, name trimming, URL validation are all preserved

### LOC Tracking
After Phase 2 completion:
- DMMenu.tsx: 1,588 → ~1,198 LOC (-390 LOC, 25% reduction)
- New files created: 2 components (~400 LOC total)
- New tests: ~350 LOC total
- Net effect: Better organization, improved testability

### Success Criteria
- ✅ All 952+ tests passing
- ✅ TypeScript compilation clean
- ✅ No behavioral changes
- ✅ NPCEditor and PropEditor independently testable
- ✅ DMMenu.tsx reduced by ~390 LOC

---

## 🚀 Quick Start for Next Orchestrator

### Option A: Continue NPCEditor Extraction (Recommended)

```bash
# 1. Verify current state
git status
git log --oneline -5

# 2. Run tests to confirm baseline
pnpm test:client -- NPCEditor.test.tsx

# 3. Create NPCEditor.tsx file
# Follow Step 1 above

# 4. Update tests and verify
# Follow Steps 2-4 above
```

### Option B: Use Agents for Parallel Extraction

```typescript
// Launch both extractions in parallel
// Agent 1: NPCEditor (Steps 1-4)
// Agent 2: PropEditor (Steps 1-4)
// Then merge results and commit
```

---

## 📊 Phase 2 Progress Tracker

- [x] Setup branch
- [x] NPCEditor characterization tests (29 tests)
- [ ] NPCEditor component extraction
- [ ] NPCEditor integration
- [ ] NPCEditor commit
- [ ] PropEditor characterization tests
- [ ] PropEditor component extraction
- [ ] PropEditor integration
- [ ] PropEditor commit
- [ ] Phase 2 PR creation

**Estimated Time Remaining:** 3-4 hours for both components

---

## 🆘 Troubleshooting

### If Tests Fail
1. Check imports are correct
2. Verify no `userEvent` usage (use `fireEvent` instead)
3. Run `pnpm typecheck` for TypeScript errors
4. Compare extracted component with inline version

### If TypeScript Errors
1. Ensure all type imports from `@shared` are present
2. Check JRPGPanel/JRPGButton imports
3. Verify prop interfaces match usage

### If Behavior Changes
1. Review characterization tests - they capture expected behavior
2. Check commit history for reference implementations
3. Consult REFACTOR_PLAYBOOK.md for extraction best practices

---

**Ready to proceed!** Start with Step 1: Create NPCEditor Component File.

**Questions?** Reference:
- REFACTOR_ROADMAP.md for overall strategy
- REFACTOR_PLAYBOOK.md for extraction patterns
- NPCEditor.test.tsx for testing examples

---

**Last Updated:** 2025-10-21
**Prepared By:** Claude (Phase 15 Refactoring Initiative)
**Next Checkpoint:** After PropEditor extraction complete
