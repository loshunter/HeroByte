# ARCHIVED: Phase 8 Handoff (NPC/Prop Updates)

**Status**: ✅ COMPLETED - January 11, 2025  
**Archive Reason**: Phase 8 successfully implemented  
**See**: `CURRENT_WORK.md` and `DONE.md` for complete documentation

---

This document was the handoff guide for implementing Phase 8 of the fire-and-forget pattern fixes. The work has been completed successfully.

**Completed Work**:

- ✅ Phase 8: NPC/Prop Updates (`useNpcUpdate`, `usePropUpdate`)

**For Current Documentation**:

- See `CURRENT_WORK.md` for detailed phase documentation
- See `DONE.md` for achievement summary
- See `apps/client/src/hooks/useNpcUpdate.ts` for implementation
- See `apps/client/src/hooks/usePropUpdate.ts` for implementation

---

# Original Document Follows

# Phase 8+ Handoff: MEDIUM Priority Fire-and-Forget Fixes

## Your Role

You are continuing the fire-and-forget pattern fixes for HeroByte VTT. **Phases 1-7 (all HIGH PRIORITY items) are complete.** You will be implementing MEDIUM priority improvements following the exact same pattern that has been successfully applied 7 times.

## Quick Orientation

### What is HeroByte VTT?

A virtual tabletop application built with:

- **Frontend**: React + TypeScript + Konva (canvas)
- **Backend**: Node.js + WebSocket
- **State Management**: Server-authoritative snapshot pattern
- **Working Directory**: `/home/loshunter/HeroByte`

### What's a Fire-and-Forget Pattern?

Code that sends a message to the server without waiting for confirmation:

```typescript
// ❌ BAD: Fire-and-forget
sendMessage({ t: "update-npc", id, updates });
// User sees nothing, might need to refresh to see changes

// ✅ GOOD: Server-confirmed with loading state
const { isUpdating, updateNpc, error } = useNpcUpdate({ snapshot, sendMessage });
// User sees "Updating..." → sees change → gets error if it fails
```

## Essential Documentation (Read First)

### 1. **CURRENT_WORK.md** - Your Primary Reference

Location: `/home/loshunter/HeroByte/CURRENT_WORK.md`

This documents ALL completed phases (1-7):

- Phase 1: Character creation
- Phase 2: DM elevation
- Phase 3: Initiative setting
- Phase 4: NPC deletion
- Phase 5: NPC creation
- Phase 6: Prop creation
- Phase 7: Prop deletion (just completed)

**Read the "Pattern Applied" section** - it shows the exact pattern used 7 times.

### 2. **FIRE_AND_FORGET_HANDOFF.md** - Implementation Guide

Location: `/home/loshunter/HeroByte/FIRE_AND_FORGET_HANDOFF.md`

Contains:

- Detailed step-by-step instructions
- Safety guidelines
- Common pitfalls and solutions
- Implementation checklist
- Testing strategies

Lines 227-243 discuss MEDIUM priority phases (what you'll work on).

### 3. **Reference Implementations** - Copy These Patterns

All hooks follow the same pattern. Use these as templates:

**For Updates (Phase 8 - what you'll likely do first):**

- Read: `apps/client/src/hooks/useInitiativeSetting.ts` (monitors field changes)
- Pattern: Tracks before/after state of specific fields

**For Deletions:**

- Read: `apps/client/src/hooks/useNpcDeletion.ts` or `usePropDeletion.ts`
- Pattern: Uses Set to track IDs, detects when ID disappears

**For Creations:**

- Read: `apps/client/src/hooks/useNpcCreation.ts` or `usePropCreation.ts`
- Pattern: Monitors count increase

### 4. **Project Structure Standards**

Location: `docs/refactoring/REFACTOR_PLAYBOOK.md` (if you need to create new files)

Key standards:

- **File size limit**: 350 lines of code (enforced by CI)
- **Hook naming**: `use[Entity][Action].ts` (e.g., `useNpcUpdate.ts`)
- **Type safety**: All hooks must pass `pnpm --filter herobyte-client exec tsc --noEmit`
- **Formatting**: Always run `pnpm format` before committing

## What's Been Completed ✅

### HIGH PRIORITY (All Done)

1. ✅ NPC Deletion - `useNpcDeletion.ts`
2. ✅ NPC Creation - `useNpcCreation.ts`
3. ✅ Prop Creation - `usePropCreation.ts`
4. ✅ Prop Deletion - `usePropDeletion.ts`

All critical user-facing actions now have:

- Loading states ("Creating...", "Deleting...", etc.)
- Error handling with user-visible messages
- Server confirmation before UI updates
- 5-second timeout fallback

## What Remains: MEDIUM Priority ⚠️

From `CURRENT_WORK.md` lines 519-545:

### Phase 8: NPC/Prop Updates

**Location**: `apps/client/src/hooks/useNpcManagement.ts:113-138` and `usePropManagement.ts:147-155`

**Issue**: Updates sent without waiting for confirmation, could race with snapshot updates

**Impact**: Non-critical, but would improve UX

**Hooks to Create**:

- `useNpcUpdate.ts` - Monitor `snapshot.characters[id]` for field changes
- `usePropUpdate.ts` - Monitor `snapshot.props[id]` for field changes

### Phase 9: NPC Token Placement

**Location**: `apps/client/src/hooks/useNpcManagement.ts:153-157`

**Issue**: Places token without visual feedback

**Impact**: User expects confirmation

**Hook to Create**:

- `useNpcTokenPlacement.ts` - Monitor `snapshot.tokens` for new token

### Phase 10: Token Deletion Confirmation

**Location**: `apps/client/src/hooks/useSceneObjectActions.ts:194-199`

**Issue**: Some code paths delete without confirmation

**Impact**: Works via keyboard shortcut with confirmation, but direct calls unprotected

**Hook to Create**:

- Might not need new hook, just ensure all call sites use confirmation

## The Established Pattern (Apply This Exactly)

### 1. Create Hook Structure

```typescript
// apps/client/src/hooks/use[Entity][Action].ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomSnapshot } from "@shared/index";

export interface Use[Entity][Action]Options {
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  // Add other dependencies if needed (e.g., cameraState)
}

export interface Use[Entity][Action]Return {
  is[Action]ing: boolean;
  [action][Entity]: (params) => void;
  error: string | null;
  // Add targetId if tracking specific item
}

export function use[Entity][Action](options: Use[Entity][Action]Options): Use[Entity][Action]Return {
  const { snapshot, sendMessage } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  // Track previous state
  const prevStateRef = useRef<SomeType>(initialValue);

  // Monitor snapshot for changes
  useEffect(() => {
    if (!isLoading || !targetId) return;

    // Check if operation succeeded
    const succeeded = /* check snapshot for expected change */;

    if (succeeded) {
      console.log("[use[Entity][Action]] Operation confirmed");
      setIsLoading(false);
      setError(null);
      setTargetId(null);
    }
  }, [snapshot?.relevantField, isLoading, targetId]);

  const actionMethod = useCallback((params) => {
    if (isLoading) {
      console.warn("[use[Entity][Action]] Operation already in progress");
      return;
    }

    console.log("[use[Entity][Action]] Starting operation:", params);

    setIsLoading(true);
    setError(null);
    setTargetId(params.id);

    sendMessage({ t: "message-type", ...params });

    // 5-second timeout
    setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) {
          setError("Operation timed out. Please try again.");
          setTargetId(null);
          return false;
        }
        return prev;
      });
    }, 5000);
  }, [isLoading, sendMessage]);

  return {
    is[Action]ing: isLoading,
    [action][Entity]: actionMethod,
    error,
    // targetId if needed
  };
}
```

### 2. Update UI Components

**Add props to component**:

```typescript
interface ComponentProps {
  // ... existing props
  isUpdating?: boolean;
  updateError?: string | null;
}
```

**Show loading state**:

```tsx
<button onClick={handleUpdate} disabled={isUpdating}>
  {isUpdating ? "Updating..." : "Save"}
</button>;

{
  updateError && <div style={{ color: "red" }}>{updateError}</div>;
}
```

### 3. Thread Props Through Layers

Pattern used in all 7 phases:

1. **Create hook in App.tsx**:

   ```typescript
   const { isUpdating, update, error } = useNpcUpdate({ snapshot, sendMessage });
   ```

2. **Pass to MainLayout** → **FloatingPanelsLayout** → **DMMenu** → **Tab Component** → **Editor Component**

3. **Update all interfaces along the way**

4. **Use in final component**

## Safety Checklist (DO NOT SKIP)

### Before You Start

- [ ] Read `CURRENT_WORK.md` phases 1-7 to understand the pattern
- [ ] Read at least ONE reference hook completely (`useNpcDeletion.ts` recommended)
- [ ] Read `FIRE_AND_FORGET_HANDOFF.md` safety guidelines (lines 283-306)
- [ ] Identify the exact file and line number of the fire-and-forget pattern
- [ ] Identify what snapshot field to monitor

### During Implementation

- [ ] Use TodoWrite tool to track your implementation steps
- [ ] Follow the exact pattern from reference implementations
- [ ] Add comprehensive JSDoc comments to your hook
- [ ] Console.log at key points (start operation, detect success, timeout)
- [ ] Use 5-second timeout (not more, not less)
- [ ] Handle the case where snapshot might be null

### After Implementation

- [ ] Run: `pnpm --filter herobyte-client exec tsc --noEmit` (must pass)
- [ ] Run: `pnpm format` (formats all code)
- [ ] Verify file is under 350 lines (CI will fail if not)
- [ ] Test manually: Happy path (success)
- [ ] Test manually: Error path (disconnect network, should timeout)
- [ ] Update `CURRENT_WORK.md` with your phase documentation

## Important "DO NOT" List

❌ **DO NOT** skip type checking before committing
❌ **DO NOT** change multiple patterns simultaneously
❌ **DO NOT** proceed to next phase if current phase has issues
❌ **DO NOT** guess snapshot field names - verify in `packages/shared/src/index.ts`
❌ **DO NOT** make hooks longer than 350 lines
❌ **DO NOT** use different timeout values (always 5 seconds)
❌ **DO NOT** skip error handling or timeout logic
❌ **DO NOT** modify existing working hooks unless fixing a bug

## Critical Files Reference

### Shared Types (Verify Your Assumptions Here)

- `packages/shared/src/index.ts` - RoomSnapshot type definition (lines 242-259)
- `packages/shared/src/models.ts` - Entity types (Character, Prop, Token, etc.)

### Existing Hooks (Your Templates)

- `apps/client/src/hooks/useNpcDeletion.ts` - ID-based deletion tracking
- `apps/client/src/hooks/useNpcCreation.ts` - Count-based creation tracking
- `apps/client/src/hooks/usePropDeletion.ts` - Same pattern as NPC deletion
- `apps/client/src/hooks/useInitiativeSetting.ts` - Field update tracking

### Fire-and-Forget Locations (What Needs Fixing)

- `apps/client/src/hooks/useNpcManagement.ts` (lines 113-138) - NPC updates
- `apps/client/src/hooks/usePropManagement.ts` (lines 147-155) - Prop updates
- `apps/client/src/hooks/useNpcManagement.ts` (lines 153-157) - Token placement

### UI Components (Where to Add Loading States)

- `apps/client/src/features/dm/components/NPCEditor.tsx` - NPC editing UI
- `apps/client/src/features/dm/components/PropEditor.tsx` - Prop editing UI

## Recommended Approach for Phase 8

### Start with NPC Updates (Most Impactful)

1. **Read the current code**:

   ```bash
   # See what needs fixing
   cat apps/client/src/hooks/useNpcManagement.ts | grep -A 20 "handleUpdateNPC"
   ```

2. **Create the hook**:
   - File: `apps/client/src/hooks/useNpcUpdate.ts`
   - Pattern: Similar to `useInitiativeSetting.ts` (monitors field changes)
   - Monitor: `snapshot.characters.find(c => c.id === targetId)`
   - Detect success: When fields match what you sent

3. **Update NPCEditor**:
   - Add loading/error props
   - Show "Updating..." on save button
   - Display error if operation fails

4. **Thread props** through:
   - NPCsTab → DMMenu → FloatingPanelsLayout → MainLayout → App.tsx

5. **Test thoroughly**:

   ```bash
   # Type check
   pnpm --filter herobyte-client exec tsc --noEmit

   # Format
   pnpm format

   # Manual test: Update NPC → See "Updating..." → See change
   ```

6. **Document in CURRENT_WORK.md**:
   - Add Phase 8 section following the same format as Phase 7

## When to Ask for Help

If you encounter:

- Type errors you can't resolve → Check `packages/shared/src/index.ts`
- Can't find where UI component is used → Use `grep -r "ComponentName" apps/client/src`
- Unsure which snapshot field to monitor → Check reference implementations
- Timeout not working → Verify you're checking `prev` state in setTimeout
- Props threading is complex → See how Phase 3 did it (BottomPanelLayout pattern)

## Success Criteria

You've successfully completed Phase 8 when:

1. ✅ New hook created following the pattern
2. ✅ Loading state shows in UI ("Updating...")
3. ✅ Error messages display to user
4. ✅ Timeout fallback triggers after 5 seconds
5. ✅ Type checking passes
6. ✅ Code is formatted
7. ✅ Manual testing shows improved UX
8. ✅ No regressions in existing functionality
9. ✅ CURRENT_WORK.md updated with your phase
10. ✅ File size under 350 lines

## Getting Started Command

```bash
# 1. Orient yourself
cd /home/loshunter/HeroByte
cat CURRENT_WORK.md | head -50  # Read overview

# 2. Read a reference implementation
cat apps/client/src/hooks/useNpcDeletion.ts  # Best reference

# 3. See what needs fixing
cat apps/client/src/hooks/useNpcManagement.ts | grep -A 20 "handleUpdateNPC"

# 4. Start with TodoWrite to plan your work
# Use the TodoWrite tool to create tasks:
# - Read reference implementations
# - Create useNpcUpdate hook
# - Update NPCEditor component
# - Thread props through component hierarchy
# - Test and document

# 5. Follow the pattern exactly - don't deviate unless necessary
```

## Final Notes

- **Trust the pattern** - It's been proven 7 times (Phases 1-7)
- **Take it slow** - One phase at a time
- **Test thoroughly** - Disconnect network, verify timeout works
- **Document well** - Future you will thank you
- **MEDIUM priority means optional** - It's okay to stop after Phase 8 if time is limited

The hard work of establishing the pattern is done. You're just methodically applying it. 🚀

Good luck!
