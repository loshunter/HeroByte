# ARCHIVED: Fire-and-Forget Pattern Handoff (Phases 4-7)

**Status**: ✅ COMPLETED - January 11, 2025  
**Archive Reason**: All phases (4-7) successfully implemented  
**See**: `CURRENT_WORK.md` and `DONE.md` for complete documentation

---

This document was the original handoff guide for implementing Phases 4-7 of the fire-and-forget pattern fixes. All work has been completed successfully.

**Completed Phases**:

- ✅ Phase 4: NPC Deletion (`useNpcDeletion`)
- ✅ Phase 5: NPC Creation (`useNpcCreation`)
- ✅ Phase 6: Prop Creation (`usePropCreation`)
- ✅ Phase 7: Prop Deletion (`usePropDeletion`)

**For Current Documentation**:

- See `CURRENT_WORK.md` for detailed phase documentation
- See `DONE.md` for achievement summary
- See individual hook files for implementation examples

---

# Original Document Follows

# Fire-and-Forget Pattern Fixes - Handoff Guide

## Context

You're continuing the state synchronization fix project for HeroByte VTT. **Phases 1-3 are complete** and have established a proven pattern for fixing fire-and-forget issues.

### What's Been Fixed ✓

1. **Phase 1**: Character creation - `useCharacterCreation` hook
2. **Phase 2**: DM elevation - `useDMElevation` hook
3. **Phase 3**: Initiative setting - `useInitiativeSetting` hook

All three fixes follow the same pattern: create a dedicated hook that monitors the snapshot for changes, provides loading/error states, and only updates UI after server confirmation.

### Working Directory

`/home/loshunter/HeroByte`

### Reference Implementation

The completed phases provide templates to follow:

- **Hook pattern**: `apps/client/src/hooks/useCharacterCreation.ts`
- **Modal pattern**: `apps/client/src/features/players/components/CharacterCreationModal.tsx`
- **Integration pattern**: See how `useInitiativeSetting` flows through MainLayout → BottomPanelLayout → EntitiesPanel

---

## Remaining Work: Priority Levels

### HIGH PRIORITY (Fix These Next)

Critical user-facing actions where lack of confirmation causes poor UX:

1. **NPC Deletion** - Modal stays open after delete
2. **NPC Creation** - No loading feedback
3. **Prop Creation** - No loading feedback
4. **Prop Deletion** - No confirmation or loading

### MEDIUM PRIORITY (Fix If Time Permits)

Non-critical but would improve UX:

1. **NPC/Prop Updates** - Could race with snapshot
2. **NPC Token Placement** - No visual feedback
3. **Token Deletion** - Direct calls lack confirmation

### LOW PRIORITY (Acceptable As-Is)

These are intentionally fire-and-forget or have proper error handling:

- Character HP/name updates (frequent, non-critical)
- Status effects (UI decoration)
- Pointer tool (ephemeral)
- Dice rolling (client-side computation)
- Voice chat (WebRTC signaling)
- Session loading (has toast notifications)

---

## Safe Implementation Strategy

### Phase 4: NPC Deletion (Start Here)

**Why First?** Most critical - modal stays open after delete, causing user confusion.

**Location**: `apps/client/src/hooks/useNpcManagement.ts:143-147`

**Current Code**:

```typescript
const handleDeleteNPC = useCallback(
  (id: string) => {
    sendMessage({ t: "delete-npc", id });
    // ❌ No loading state, no confirmation
  },
  [sendMessage],
);
```

**Called From**: `apps/client/src/features/players/components/NpcSettingsMenu.tsx:216`

**Implementation Steps**:

1. **Create Hook**: `apps/client/src/hooks/useNpcDeletion.ts`

   ```typescript
   export function useNpcDeletion({
     snapshot,
     sendMessage,
   }: {
     snapshot: RoomSnapshot | null;
     sendMessage: (msg: ClientMessage) => void;
   }) {
     const [isDeleting, setIsDeleting] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const [targetNpcId, setTargetNpcId] = useState<string | null>(null);

     // Track previous NPC count
     const prevNpcCountRef = useRef<number>(0);

     // Monitor snapshot.characters for NPC deletion
     useEffect(() => {
       if (!isDeleting || !targetNpcId) return;

       const currentNpcs = snapshot?.characters?.filter((c) => c.type === "npc") || [];
       const npcExists = currentNpcs.some((c) => c.id === targetNpcId);

       if (!npcExists) {
         // NPC successfully deleted
         setIsDeleting(false);
         setError(null);
         setTargetNpcId(null);
       }
     }, [snapshot?.characters, isDeleting, targetNpcId]);

     const deleteNpc = useCallback(
       (id: string) => {
         setIsDeleting(true);
         setError(null);
         setTargetNpcId(id);
         sendMessage({ t: "delete-npc", id });

         // Timeout fallback
         setTimeout(() => {
           setIsDeleting((prev) => {
             if (prev) {
               setError("NPC deletion timed out. Please try again.");
               return false;
             }
             return prev;
           });
         }, 5000);
       },
       [sendMessage],
     );

     return { isDeleting, deleteNpc, error };
   }
   ```

2. **Update NpcSettingsMenu**:
   - Accept `isDeleting` and `error` props
   - Show "Deleting..." state on delete button
   - Auto-close menu when `isDeleting` becomes false (similar to CharacterCreationModal)
   - Display error message if deletion fails

3. **Integrate in Parent**:
   - Where NpcSettingsMenu is used, add the `useNpcDeletion` hook
   - Pass loading/error state down through props
   - Remove immediate modal close after delete

4. **Test**:

   ```bash
   pnpm --filter herobyte-client exec tsc --noEmit
   pnpm format
   # Manually test: Create NPC → Delete NPC → Verify modal closes only after snapshot updates
   ```

5. **Safety Check**:
   - Verify NPC disappears from entities panel
   - Verify modal closes automatically
   - Verify error message shows if server fails
   - Verify timeout works (disconnect network before delete)

---

### Phase 5: NPC Creation

**Location**: `apps/client/src/hooks/useNpcManagement.ts:104-106`

**Current Code**:

```typescript
const handleCreateNPC = useCallback(() => {
  sendMessage({ t: "create-npc", name: "New NPC", hp: 10, maxHp: 10 });
  // ❌ No loading state
}, [sendMessage]);
```

**Called From**: DM Menu → NPCs Tab → "Add NPC" button

**Implementation Steps**:

1. **Create Hook**: `apps/client/src/hooks/useNpcCreation.ts`
   - Monitor `snapshot.characters` for new NPC (type === 'npc')
   - Track previous NPC count
   - Detect when count increases
   - Pattern: Similar to `useCharacterCreation`

2. **Update DM Menu**:
   - Add loading state to "Add NPC" button
   - Show "Creating..." text
   - Disable button while creating
   - No modal needed (button in list view)

3. **Test**:
   - Click "Add NPC" → See "Creating..." → See NPC appear → Button re-enables

---

### Phase 6: Prop Creation

**Location**: `apps/client/src/hooks/usePropManagement.ts:132-141`

**Pattern**: Same as NPC creation

- Monitor `snapshot.props` array for new prop
- Provide loading state
- Button shows "Creating..." feedback

---

### Phase 7: Prop Deletion

**Location**: `apps/client/src/hooks/usePropManagement.ts:161-166`

**Pattern**: Same as NPC deletion

- Monitor `snapshot.props` array
- Detect when prop removed
- Close prop editor after confirmation

---

## Medium Priority Phases (Optional)

### Phase 8-10: Updates & Token Placement

These are less critical but follow the same pattern:

- Create dedicated hooks
- Monitor specific snapshot fields
- Provide visual feedback

**Only implement if**:

1. Users report issues
2. HIGH priority items are complete
3. You have time and resources

---

## Implementation Checklist (For Each Phase)

### Pre-Implementation

- [ ] Read reference implementations (useCharacterCreation, useDMElevation, useInitiativeSetting)
- [ ] Identify the exact location of fire-and-forget pattern
- [ ] Identify what snapshot field to monitor
- [ ] Identify which UI components need updating

### Implementation

- [ ] Create new hook file in `apps/client/src/hooks/`
- [ ] Monitor correct snapshot field with `useEffect`
- [ ] Track loading state with `useState`
- [ ] Implement 5-second timeout fallback
- [ ] Update UI component to accept loading/error props
- [ ] Integrate hook in parent component
- [ ] Pass loading/error state through component tree

### Testing

- [ ] Run `pnpm --filter herobyte-client exec tsc --noEmit`
- [ ] Run `pnpm format`
- [ ] Manual test: Happy path (success)
- [ ] Manual test: Error path (disconnect network)
- [ ] Manual test: Timeout path (server delay)
- [ ] Verify loading UI shows correctly
- [ ] Verify error messages display
- [ ] Verify modal/UI closes only after confirmation

### Documentation

- [ ] Update CURRENT_WORK.md with phase completion
- [ ] Document any issues encountered
- [ ] Update E2E tests if needed

---

## Safety Guidelines

### DO:

✅ Follow the exact pattern from Phases 1-3
✅ Test with network disconnected to verify error handling
✅ Monitor the correct snapshot field (characters, props, players, etc.)
✅ Use 5-second timeout as fallback
✅ Format and type-check before committing
✅ Test manually before moving to next phase
✅ Auto-close modals only when loading completes successfully

### DON'T:

❌ Skip type checking
❌ Change multiple patterns simultaneously
❌ Remove fire-and-forget for LOW priority items
❌ Guess snapshot field names - verify in @shared types
❌ Close modals immediately after sending message
❌ Skip error handling or timeout logic
❌ Proceed to next phase if current phase has issues

---

## Common Pitfalls & Solutions

### Pitfall 1: Hook doesn't detect changes

**Cause**: Monitoring wrong snapshot field
**Solution**:

- Check `packages/shared/src/index.ts` for RoomSnapshot type
- Verify field name in snapshot structure
- Use `console.log(snapshot?.characters)` to inspect

### Pitfall 2: Modal closes too early

**Cause**: Not checking `wasLoading` state properly
**Solution**: See `CharacterCreationModal.tsx:45-52` for pattern:

```typescript
useEffect(() => {
  if (wasLoading && !isLoading && !error) {
    onClose(); // Only close on successful completion
  }
  setWasLoading(isLoading);
}, [isLoading, wasLoading, error, onClose]);
```

### Pitfall 3: Timeout doesn't work

**Cause**: Not checking if still loading before clearing
**Solution**: See `useCharacterCreation.ts:119-124`:

```typescript
setTimeout(() => {
  setIsLoading((prev) => {
    if (prev) {
      // Only clear if STILL loading
      setError("Operation timed out");
      return false;
    }
    return prev;
  });
}, 5000);
```

### Pitfall 4: Props drilling becomes complex

**Cause**: Component hierarchy is deep
**Solution**:

- Pass through intermediate layout components (see BottomPanelLayout pattern)
- Update props interfaces at each level
- Don't skip levels - maintain prop flow

---

## When to Stop

**Stop implementing more phases if**:

- HIGH priority items are complete and working
- Tests are passing
- Users aren't reporting issues with MEDIUM priority items
- Code quality would suffer from over-engineering

**It's OK to leave MEDIUM/LOW priority items as-is** if:

- They don't affect critical user flows
- Error handling exists elsewhere
- The fire-and-forget pattern is intentional for performance

---

## Success Criteria

You've successfully completed a phase when:

1. ✅ Loading state shows correctly in UI
2. ✅ Errors display to user with helpful message
3. ✅ Timeout fallback triggers after 5 seconds
4. ✅ Modals/UI only close after server confirms
5. ✅ Type checking passes
6. ✅ Code is formatted
7. ✅ Manual testing shows improved UX
8. ✅ No regressions in existing functionality

---

## Getting Started

```bash
# 1. Start with Phase 4 (NPC Deletion)
cd /home/loshunter/HeroByte

# 2. Review reference implementations
cat apps/client/src/hooks/useCharacterCreation.ts
cat apps/client/src/features/players/components/CharacterCreationModal.tsx

# 3. Create your hook
# Follow the pattern exactly - don't deviate unless necessary

# 4. Test thoroughly
pnpm --filter herobyte-client exec tsc --noEmit
pnpm format
# Manual testing in browser

# 5. Move to Phase 5 only when Phase 4 is complete and working
```

---

## Questions?

If you encounter issues:

1. **Check CURRENT_WORK.md** - All phases 1-3 are documented with code locations
2. **Read the reference hooks** - useCharacterCreation, useDMElevation, useInitiativeSetting
3. **Check shared types** - `packages/shared/src/index.ts` for RoomSnapshot structure
4. **Grep for patterns** - Search for similar sendMessage calls to understand context

**Key principle**: Each phase should feel like copying a working pattern and adapting it to a specific use case. If it feels complicated, you're probably overthinking it.

---

## Final Notes

- **Phases 1-3 prove the pattern works** - trust it
- **Start small** - One phase at a time
- **Test thoroughly** - Disconnect network, add delays, verify timeouts
- **User experience first** - The goal is preventing "refresh to see changes" issues
- **Document as you go** - Update CURRENT_WORK.md after each phase

Good luck! The hard work of establishing the pattern is done. Now it's just methodical application. 🚀
