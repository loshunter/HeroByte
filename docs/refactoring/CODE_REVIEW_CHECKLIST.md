# Code Review Checklist - Phase 15 SOLID Refactor

**Purpose:** Ensure domain invariants are preserved during refactoring PRs
**Audience:** Code reviewers for Phase 15 SOLID refactor initiative
**Status:** Active - Required for all refactoring PRs

---

## 1. Purpose

This checklist exists to maintain behavioral correctness while improving code structure during the Phase 15 SOLID refactor initiative. The goal is NOT to block refactoring, but to ensure:

1. **Domain Invariants Preserved** - Business rules remain unchanged
2. **Test Coverage Maintained** - No regression in safety net
3. **SOLID Principles Applied** - Refactored code follows best practices
4. **No Behavioral Changes** - Extraction only, no feature work
5. **Documentation Complete** - Future maintainers understand changes

Use this checklist for every PR that extracts or refactors code from the three god files (App.tsx, DMMenu.tsx, MapBoard.tsx) or any domain service.

---

## 2. Quick Reference Checklist

Copy/paste this into PR reviews for fast validation:

```markdown
## Phase 15 Refactor Review

### SOLID Principles
- [ ] **SRP**: Extracted module has single, clear responsibility
- [ ] **OCP**: Open for extension, closed for modification
- [ ] **LSP**: Can substitute original without breaking
- [ ] **ISP**: Interfaces are minimal and focused
- [ ] **DIP**: Depends on abstractions, not concretions

### Test Coverage
- [ ] **Characterization tests exist** and pass (written BEFORE extraction)
- [ ] **All existing tests pass** (no new failures)
- [ ] **Coverage maintained or improved** (>80% for new modules)
- [ ] **New tests added** for extracted code

### No Behavioral Changes
- [ ] **Exact behavior preserved** (characterization tests verify this)
- [ ] **No feature additions** (pure extraction only)
- [ ] **No bug fixes** (unless documented separately)
- [ ] **Manual testing complete** (verification checklist in PR)

### Documentation Complete
- [ ] **JSDoc on all exports** (interfaces, functions, components)
- [ ] **Usage examples provided** (@example tags)
- [ ] **Roadmap updated** (module marked complete)
- [ ] **Import/export changes correct** (no broken references)

### Domain Invariants Preserved
- [ ] **Ownership rules** (Character/Player/Token)
- [ ] **State consistency** (no orphaned data)
- [ ] **Coordinate systems** (Map/Token/Drawing)
- [ ] **Message ordering** (WebSocket/Room)
- [ ] **Session completeness** (Save/Load)

### Refactoring Quality
- [ ] **LOC reduction documented** (before/after metrics)
- [ ] **No new structural violations** (`pnpm lint:structure:enforce` passes)
- [ ] **Type safety maintained** (no new `any` types)
- [ ] **Error handling preserved** (all error paths tested)
- [ ] **No circular dependencies** (ESLint passes)

**Approval Criteria:**
- ✅ All checkboxes checked
- ✅ All tests GREEN
- ✅ CI passing
- ✅ Manual verification documented
```

---

## 3. Domain Invariants to Verify

### 3.1 Character/Player Domain

**Core Invariants:**

1. **Ownership Rules**
   - Every character has exactly one owner (Player uid)
   - Characters cannot be claimed by multiple players
   - Unclaimed characters have owner === null or owner === ""
   - Character deletion must cascade to tokens (update or delete)

2. **State Consistency**
   - HP must be ≤ maxHp (or null if unset)
   - HP cannot be negative
   - Dead characters (hp === 0) should trigger death state
   - Status effects must be valid array (can be empty)
   - isDM flag is immutable once set in session

3. **Portrait/Image Management**
   - Portrait URLs must be valid or undefined
   - Portrait changes must propagate to all clients
   - Missing portraits should have graceful fallback

**Verification Questions:**
- [ ] Does extracted code modify character ownership?
- [ ] Are HP validation rules preserved?
- [ ] Does character deletion clean up related data?
- [ ] Are status effects properly cloned/immutable?

**Example Invariant Violation:**
```typescript
// ❌ BAD: Allows negative HP
function damageCharacter(char: Character, damage: number) {
  return { ...char, hp: char.hp - damage };
}

// ✅ GOOD: Preserves HP >= 0 invariant
function damageCharacter(char: Character, damage: number) {
  return { ...char, hp: Math.max(0, char.hp - damage) };
}
```

---

### 3.2 Map/Token Domain

**Core Invariants:**

1. **Coordinate Systems**
   - Tokens use grid coordinates (integer-based, aligned to grid)
   - Props use world coordinates (can be fractional, relative to map)
   - Staging zone tokens use separate coordinate space (not on main map)
   - Drawing uses canvas coordinates (pixel-based)
   - All coordinate transformations must be reversible

2. **Layer Ordering**
   - Background layer (z-index: 0)
   - Map layer (z-index: 1)
   - Drawing layer (z-index: 2)
   - Token layer (z-index: 3)
   - Staging zone layer (z-index: 4)
   - UI/Selection layer (z-index: 5)
   - Layer order must never change during rendering

3. **Grid Snapping**
   - Token movement respects grid snapping when enabled
   - Props can move freely (no snapping)
   - Grid alignment wizard must preserve existing token positions
   - Grid size changes must scale coordinates proportionally

**Verification Questions:**
- [ ] Are coordinate transforms tested for reversibility?
- [ ] Does extracted code maintain layer ordering?
- [ ] Are grid snapping rules consistent?
- [ ] Do prop vs token coordinates remain separate?

**Example Invariant Violation:**
```typescript
// ❌ BAD: Mixes token and prop coordinate systems
function moveObject(obj: Token | Prop, x: number, y: number) {
  return { ...obj, x, y }; // No grid snapping for tokens!
}

// ✅ GOOD: Respects coordinate system differences
function moveToken(token: Token, x: number, y: number, gridSize: number) {
  const snappedX = Math.round(x / gridSize) * gridSize;
  const snappedY = Math.round(y / gridSize) * gridSize;
  return { ...token, x: snappedX, y: snappedY };
}

function moveProp(prop: Prop, x: number, y: number) {
  return { ...prop, x, y }; // No snapping for props
}
```

---

### 3.3 Drawing Domain

**Core Invariants:**

1. **Line Ownership**
   - Every line has owner uid (creator)
   - Lines owned by DM are visible to all
   - Lines owned by players are visible only to that player and DM
   - Line deletion requires ownership or DM privilege

2. **Undo/Redo State**
   - Drawing history stack maintains order (LIFO)
   - Undo reverts last drawing action
   - Redo re-applies undone action
   - New drawing clears redo stack
   - History must survive page refresh if persisted

3. **Drawing Tools**
   - Freehand: continuous path with point sampling
   - Rectangle: two points (start, end)
   - Circle: center + radius
   - Eraser: removes intersecting lines
   - Tool switching must not lose in-progress drawing

**Verification Questions:**
- [ ] Are ownership rules enforced on extracted code?
- [ ] Does undo/redo history remain consistent?
- [ ] Are drawing tool algorithms preserved?
- [ ] Is eraser intersection logic correct?

**Example Invariant Violation:**
```typescript
// ❌ BAD: Loses ownership on line edit
function editLine(line: Line, newPoints: Point[]) {
  return { points: newPoints }; // Lost owner, color, width!
}

// ✅ GOOD: Preserves all line properties
function editLine(line: Line, newPoints: Point[]) {
  return { ...line, points: newPoints };
}
```

---

### 3.4 Initiative Domain

**Core Invariants:**

1. **Turn Order Consistency**
   - Initiative list sorted by initiative score (descending)
   - Ties broken by dexterity, then name
   - Current turn index must point to valid combatant
   - Next turn wraps around to index 0 after last combatant

2. **Combatant State**
   - Every combatant has unique ID
   - Combatant HP must match linked character/token
   - Dead combatants (HP = 0) skip turn but remain in list
   - Combatant removal mid-combat must adjust current index

3. **Round Tracking**
   - Round increments on turn wraparound
   - Round resets when combat ends
   - Status effects with duration track rounds remaining

**Verification Questions:**
- [ ] Is turn order algorithm preserved?
- [ ] Does combatant removal handle index correctly?
- [ ] Are HP updates synchronized with characters?
- [ ] Is round tracking consistent?

**Example Invariant Violation:**
```typescript
// ❌ BAD: Doesn't handle index after removal
function removeCombatant(list: Combatant[], id: string) {
  return list.filter(c => c.id !== id);
  // Current turn index is now invalid!
}

// ✅ GOOD: Adjusts index after removal
function removeCombatant(
  list: Combatant[],
  id: string,
  currentIndex: number
): { list: Combatant[], newIndex: number } {
  const removedIndex = list.findIndex(c => c.id === id);
  const newList = list.filter(c => c.id !== id);
  const newIndex = removedIndex < currentIndex
    ? currentIndex - 1
    : currentIndex;
  return { list: newList, newIndex };
}
```

---

### 3.5 WebSocket/Room Domain

**Core Invariants:**

1. **Message Ordering**
   - Messages processed in FIFO order (per client)
   - Server broadcasts maintain causal order
   - Heartbeat messages cannot interrupt state updates
   - Reconnection must replay missed messages

2. **Auth State**
   - Every WebSocket has associated auth token
   - Token validation before ANY message processing
   - Token expiration disconnects client
   - Room membership verified on every action
   - DM privilege checked for admin actions

3. **Connection Lifecycle**
   - Connect → Authenticate → Join Room → Active
   - Disconnect cleans up player state
   - Reconnect restores player state from snapshot
   - Room closes when last player leaves (optional)

**Verification Questions:**
- [ ] Is message ordering preserved in extracted code?
- [ ] Are auth checks present for all actions?
- [ ] Does reconnection logic maintain state?
- [ ] Are disconnection cleanups complete?

**Example Invariant Violation:**
```typescript
// ❌ BAD: No auth check on sensitive action
async function handleDeleteCharacter(ws: WebSocket, charId: string) {
  await deleteCharacter(charId); // Anyone can delete!
}

// ✅ GOOD: Auth and permission checks
async function handleDeleteCharacter(
  ws: WebSocket,
  charId: string,
  session: Session
) {
  if (!session.user) {
    throw new Error('Unauthorized');
  }

  const character = await getCharacter(charId);
  if (character.owner !== session.user.uid && !session.user.isDM) {
    throw new Error('Forbidden: not owner or DM');
  }

  await deleteCharacter(charId);
}
```

---

### 3.6 Session/Persistence Domain

**Core Invariants:**

1. **Save/Load Completeness**
   - All domain state must be serializable
   - Save must capture: map, characters, tokens, props, drawings, initiative
   - Load must restore ALL saved state
   - Partial saves/loads are NOT allowed (atomic operation)
   - Save version must be tracked (migration support)

2. **File Format Stability**
   - JSON structure must be backward compatible
   - New fields added as optional
   - Removed fields logged as warnings (not errors)
   - Version field enables migration

3. **Password Protection**
   - Password hash stored (never plaintext)
   - Password required for room join if set
   - Password can be cleared by DM
   - Password changes log out non-DM players

**Verification Questions:**
- [ ] Does extracted code maintain save/load completeness?
- [ ] Are new fields added as optional?
- [ ] Is password hashing preserved?
- [ ] Does state restoration include all domains?

**Example Invariant Violation:**
```typescript
// ❌ BAD: Incomplete save (missing drawings)
function saveSession(room: Room): SessionData {
  return {
    map: room.map,
    characters: room.characters,
    tokens: room.tokens,
    // Missing: drawings, props, initiative!
  };
}

// ✅ GOOD: Complete save
function saveSession(room: Room): SessionData {
  return {
    version: '2.0',
    map: room.map,
    characters: room.characters,
    tokens: room.tokens,
    props: room.props,
    drawings: room.drawings,
    initiative: room.initiative,
    timestamp: Date.now(),
  };
}
```

---

## 4. SOLID Principles Verification

### 4.1 Single Responsibility Principle (SRP)

**Definition:** A module should have one, and only one, reason to change.

**Verification Questions:**
- [ ] Can you describe the module's purpose in one sentence?
- [ ] Does the module name clearly indicate its responsibility?
- [ ] Are there multiple "and" clauses in the description?
- [ ] Would different business requirements change this module?

**Good Examples:**
- ✅ `useTokenActions` - Wraps token-related sendMessage calls
- ✅ `GridAlignmentWizard` - Handles grid alignment workflow
- ✅ `useKeyboardShortcuts` - Manages keyboard event handlers

**Bad Examples:**
- ❌ `useMapManager` - Too vague, multiple responsibilities
- ❌ `UtilityFunctions` - Catch-all module
- ❌ `GameLogic` - Encompasses entire domain

**Code Example:**
```typescript
// ❌ BAD: Multiple responsibilities
function usePlayerManagement() {
  // Player state management
  const [players, setPlayers] = useState([]);

  // Network communication
  const sendPlayerUpdate = (player) => ws.send(...);

  // UI state
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Validation
  const validatePlayer = (player) => { ... };

  return { players, sendPlayerUpdate, selectedPlayer, validatePlayer };
}

// ✅ GOOD: Separated responsibilities
function usePlayerState() {
  const [players, setPlayers] = useState([]);
  return { players, setPlayers };
}

function usePlayerActions({ sendMessage }) {
  const updatePlayer = useCallback((player) => {
    sendMessage({ t: 'updatePlayer', player });
  }, [sendMessage]);
  return { updatePlayer };
}

function usePlayerSelection() {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  return { selectedPlayer, setSelectedPlayer };
}

function validatePlayer(player: Player): ValidationResult {
  // Pure validation function
}
```

**Approval Criteria:**
- [ ] Module has ONE clear responsibility
- [ ] File size < 350 LOC (enforced by structure lint)
- [ ] Module name is specific (not "utils", "helpers", "common")
- [ ] Single axis of change identified

---

### 4.2 Open/Closed Principle (OCP)

**Definition:** Modules should be open for extension, closed for modification.

**Verification Questions:**
- [ ] Can new behavior be added without changing existing code?
- [ ] Are there plugin points (callbacks, interfaces)?
- [ ] Is the module extensible through composition?
- [ ] Would adding a feature require modifying this module's code?

**Good Examples:**
- ✅ Hook with dependency injection: `useSomething({ onEvent, getData })`
- ✅ Component with render props: `<List renderItem={item => ...} />`
- ✅ Strategy pattern: `DrawingTool` interface with multiple implementations

**Bad Examples:**
- ❌ Long switch statements on type strings
- ❌ Hardcoded list of handlers
- ❌ Direct dependency on concrete implementations

**Code Example:**
```typescript
// ❌ BAD: Must modify for new drawing tools
function handleDrawingTool(tool: string, point: Point) {
  switch (tool) {
    case 'freehand':
      return drawFreehand(point);
    case 'rectangle':
      return drawRectangle(point);
    // Must add new case for every new tool!
  }
}

// ✅ GOOD: Open for extension via interface
interface DrawingTool {
  handlePoint(point: Point): void;
  complete(): Line;
}

class FreehandTool implements DrawingTool {
  handlePoint(point: Point) { /* ... */ }
  complete(): Line { /* ... */ }
}

class RectangleTool implements DrawingTool {
  handlePoint(point: Point) { /* ... */ }
  complete(): Line { /* ... */ }
}

function useDrawingTool(tool: DrawingTool) {
  const handlePoint = (point: Point) => tool.handlePoint(point);
  const complete = () => tool.complete();
  return { handlePoint, complete };
}

// New tools added without modifying useDrawingTool!
```

**Approval Criteria:**
- [ ] New features don't require modifying existing code
- [ ] Extension points are documented
- [ ] Composition preferred over configuration
- [ ] No long switch/if-else chains on types

---

### 4.3 Liskov Substitution Principle (LSP)

**Definition:** Subtypes must be substitutable for their base types without breaking correctness.

**Verification Questions:**
- [ ] Can extracted module replace the original inline code?
- [ ] Are all inputs/outputs compatible with original?
- [ ] Does the module honor the same contracts?
- [ ] Would swapping implementations break tests?

**Good Examples:**
- ✅ Extracted hook has identical return signature
- ✅ Extracted component accepts same props
- ✅ Extracted function preserves input/output types

**Bad Examples:**
- ❌ New module requires additional props not in original
- ❌ Return type changed (e.g., added error states)
- ❌ Side effects added or removed

**Code Example:**
```typescript
// Original inline code
const handleClick = () => {
  sendMessage({ t: 'tokenMove', tokenId, x, y });
};

// ❌ BAD: Not substitutable (changed signature)
function useTokenActions({ sendMessage, logger }) {
  const moveToken = (tokenId, x, y, timestamp) => {
    logger.log('Moving token'); // New side effect!
    sendMessage({ t: 'tokenMove', tokenId, x, y, timestamp }); // New param!
  };
  return { moveToken };
}

// ✅ GOOD: Direct substitution
function useTokenActions({ sendMessage }) {
  const moveToken = useCallback((tokenId, x, y) => {
    sendMessage({ t: 'tokenMove', tokenId, x, y });
  }, [sendMessage]);
  return { moveToken };
}
```

**Approval Criteria:**
- [ ] Extracted code is drop-in replacement
- [ ] No new required dependencies
- [ ] Behavior identical to original (characterization tests verify)
- [ ] Type signatures match or are more general

---

### 4.4 Interface Segregation Principle (ISP)

**Definition:** Clients should not depend on interfaces they don't use.

**Verification Questions:**
- [ ] Are all props/parameters used by the module?
- [ ] Can you remove any dependencies without breaking?
- [ ] Is the entire snapshot object passed when only 2 fields needed?
- [ ] Are there optional props that are rarely used?

**Good Examples:**
- ✅ `useTokenActions({ sendMessage })` - Only needs sendMessage
- ✅ `TokenCard({ id, color, imageUrl })` - Minimal props
- ✅ Hook returns only what's needed: `{ moveToken, deleteToken }`

**Bad Examples:**
- ❌ Passing entire room snapshot when only need tokens array
- ❌ Component requires 15 props but only uses 3
- ❌ Hook returns 20 functions when consumer uses 2

**Code Example:**
```typescript
// ❌ BAD: God object passed through
interface MapBoardProps {
  snapshot: RoomSnapshot; // Entire snapshot!
  isDM: boolean;
  sendMessage: Function;
  // ... 20 more props
}

function MapBoard({ snapshot, isDM, sendMessage, ... }: MapBoardProps) {
  // Only uses snapshot.tokens and snapshot.map
}

// ✅ GOOD: Minimal, focused interface
interface MapBoardProps {
  tokens: Token[];
  mapUrl: string;
  gridSize: number;
  onTokenMove: (tokenId: string, x: number, y: number) => void;
}

function MapBoard({ tokens, mapUrl, gridSize, onTokenMove }: MapBoardProps) {
  // Only receives what it needs
}
```

**Approval Criteria:**
- [ ] All props/params are used
- [ ] No god objects passed through
- [ ] Interface is minimal for module's needs
- [ ] Optional props are truly optional (<10% usage)

---

### 4.5 Dependency Inversion Principle (DIP)

**Definition:** Depend on abstractions, not concretions.

**Verification Questions:**
- [ ] Does the module depend on interfaces, not implementations?
- [ ] Are external dependencies injected, not imported directly?
- [ ] Can dependencies be swapped without changing module code?
- [ ] Is the module testable in isolation?

**Good Examples:**
- ✅ `useSomething({ sendMessage })` - sendMessage is injected
- ✅ `Component({ onAction })` - callback abstraction
- ✅ Service depends on repository interface, not DB directly

**Bad Examples:**
- ❌ Direct import of WebSocket instance
- ❌ Hardcoded dependency on specific implementation
- ❌ Cannot mock dependencies in tests

**Code Example:**
```typescript
// ❌ BAD: Depends on concrete WebSocket
import { globalWebSocket } from '../ws';

function usePlayerActions() {
  const updatePlayer = (player) => {
    globalWebSocket.send(JSON.stringify({ t: 'updatePlayer', player }));
  };
  return { updatePlayer };
}

// ✅ GOOD: Depends on abstraction
interface MessageSender {
  (message: ClientMessage): void;
}

function usePlayerActions({ sendMessage }: { sendMessage: MessageSender }) {
  const updatePlayer = useCallback((player: Player) => {
    sendMessage({ t: 'updatePlayer', player });
  }, [sendMessage]);
  return { updatePlayer };
}

// Now testable with mock sendMessage!
```

**Approval Criteria:**
- [ ] Dependencies are injected (not imported)
- [ ] Module depends on interfaces/types
- [ ] Implementation can be swapped (e.g., for testing)
- [ ] No direct references to singletons or globals

---

## 5. Refactoring-Specific Checks

### 5.1 Characterization Tests

**Required Before Extraction:**

Every extraction MUST have characterization tests written BEFORE code is moved. These tests capture current behavior and serve as regression protection.

**Checklist:**
- [ ] Tests exist in `__tests__/characterization/` directory
- [ ] Tests cover happy paths (80%+ of usage)
- [ ] Tests cover edge cases (nulls, empty arrays, boundaries)
- [ ] Tests cover error cases (invalid inputs, failures)
- [ ] All tests GREEN before extraction begins
- [ ] Tests still GREEN after extraction completes

**Example Test Structure:**
```typescript
/**
 * Characterization tests for useTokenActions
 *
 * These tests lock in the behavior of token actions BEFORE extraction
 * from App.tsx (lines 450-520). They serve as regression tests.
 *
 * @see REFACTOR_ROADMAP.md - Priority 10
 */
describe('useTokenActions - Characterization', () => {
  describe('happy paths', () => {
    it('should send tokenMove message with correct payload', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useTokenActions({ sendMessage }));

      act(() => {
        result.current.moveToken('token-1', 100, 200);
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: 'tokenMove',
        tokenId: 'token-1',
        x: 100,
        y: 200,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle zero coordinates', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useTokenActions({ sendMessage }));

      act(() => {
        result.current.moveToken('token-1', 0, 0);
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: 'tokenMove',
        tokenId: 'token-1',
        x: 0,
        y: 0,
      });
    });
  });
});
```

**Red Flags:**
- ❌ PR says "I'll add tests later"
- ❌ Tests only cover happy path
- ❌ Tests were written after extraction
- ❌ Tests are skipped/commented out

---

### 5.2 LOC Reduction Documentation

**Required Metrics:**

Every refactoring PR must document LOC reduction with before/after metrics.

**Checklist:**
- [ ] Before LOC count documented
- [ ] After LOC count documented
- [ ] Net reduction calculated
- [ ] Reduction as % of target included
- [ ] Metrics verified with `wc -l` or structure lint

**Template for PR:**
```markdown
## LOC Metrics

**Source File:** `apps/client/src/App.tsx`
- **Before:** 1,850 LOC
- **After:** 1,800 LOC
- **Reduction:** 50 LOC

**New Module:** `hooks/useTokenActions.ts`
- **LOC:** 35 LOC

**Net Reduction:** 15 LOC (50 - 35 = 15)
**Progress:** 15 / 1,550 target (1%)

**Verification:**
```bash
# Before
wc -l apps/client/src/App.tsx
# 1850 apps/client/src/App.tsx

# After extraction
wc -l apps/client/src/App.tsx
# 1800 apps/client/src/App.tsx

wc -l apps/client/src/hooks/useTokenActions.ts
# 35 apps/client/src/hooks/useTokenActions.ts
```
```

**Red Flags:**
- ❌ No LOC metrics in PR
- ❌ Metrics not verified with actual count
- ❌ LOC increased instead of decreased
- ❌ "Net reduction" doesn't account for new file size

---

### 5.3 No New Structural Violations

**Required CI Checks:**

All structural lint rules must pass. No new violations introduced.

**Checklist:**
- [ ] `pnpm lint:structure:enforce` passes
- [ ] No new files over 350 LOC
- [ ] No new god objects created
- [ ] Baseline updated if necessary (with justification)

**Commands to Run:**
```bash
# Check structure violations
pnpm lint:structure:enforce

# List current violations (should not increase)
pnpm lint:structure

# If violations exist, ensure they're in baseline
cat scripts/structure-baseline.json
```

**Approval Criteria:**
- ✅ CI structure check is GREEN
- ✅ No new files in violation list
- ✅ If baseline updated, PR description explains why

**Red Flags:**
- ❌ Structure lint failing
- ❌ New 500+ LOC file created
- ❌ Baseline updated without justification
- ❌ Extracted module is larger than original

---

### 5.4 Import/Export Correctness

**Common Issues:**

Extractions often break imports. Verify all references are updated.

**Checklist:**
- [ ] All imports in source file updated
- [ ] All imports in new module correct
- [ ] No circular dependencies introduced
- [ ] TypeScript compiles with no errors
- [ ] No runtime import errors (test in dev mode)

**Verification Steps:**
```bash
# TypeScript compilation
pnpm build

# Check for circular dependencies (if ESLint rule enabled)
pnpm lint

# Runtime verification
pnpm dev
# Navigate to feature, check browser console for import errors
```

**Example Fix:**
```typescript
// Before extraction (App.tsx)
function moveToken(tokenId: string, x: number, y: number) {
  sendMessage({ t: 'tokenMove', tokenId, x, y });
}

// After extraction - NEW FILE (hooks/useTokenActions.ts)
export function useTokenActions({ sendMessage }: UseTokenActionsProps) {
  const moveToken = useCallback((tokenId: string, x: number, y: number) => {
    sendMessage({ t: 'tokenMove', tokenId, x, y });
  }, [sendMessage]);
  return { moveToken };
}

// After extraction - SOURCE FILE (App.tsx)
import { useTokenActions } from './hooks/useTokenActions';

function App() {
  const { moveToken } = useTokenActions({ sendMessage });
  // Use moveToken as before
}
```

**Red Flags:**
- ❌ TypeScript compilation errors
- ❌ Import paths are relative when should be absolute
- ❌ Circular dependency warnings
- ❌ Module not found errors at runtime

---

### 5.5 Type Safety Maintained

**Zero Tolerance for `any`:**

Refactoring must maintain or improve type safety. No `any` types introduced.

**Checklist:**
- [ ] No new `any` types in extracted module
- [ ] All function signatures have explicit types
- [ ] All props interfaces defined
- [ ] No `@ts-ignore` or `@ts-expect-error` comments
- [ ] Generic types are constrained appropriately

**Good Examples:**
```typescript
// ✅ Explicit types everywhere
interface UseTokenActionsProps {
  sendMessage: (message: ClientMessage) => void;
}

interface UseTokenActionsReturn {
  moveToken: (tokenId: string, x: number, y: number) => void;
  deleteToken: (tokenId: string) => void;
}

export function useTokenActions({
  sendMessage,
}: UseTokenActionsProps): UseTokenActionsReturn {
  // Implementation
}
```

**Bad Examples:**
```typescript
// ❌ Any types introduced
export function useTokenActions(props: any): any {
  // Lost type safety!
}

// ❌ Implicit any
export function useTokenActions({ sendMessage }) {
  // sendMessage has implicit any type
}

// ❌ Suppressing errors
export function useTokenActions({ sendMessage }: UseTokenActionsProps) {
  // @ts-ignore - NEVER acceptable in refactoring!
  sendMessage(invalidMessage);
}
```

**Approval Criteria:**
- ✅ All types are explicit
- ✅ No `any`, `unknown` should be used instead if truly needed
- ✅ No type suppressions
- ✅ Strict mode TypeScript passing

---

### 5.6 Error Handling Preserved

**No Regressions in Error Paths:**

All error handling from original code must be preserved.

**Checklist:**
- [ ] Try/catch blocks preserved
- [ ] Error messages unchanged
- [ ] Error logging/reporting maintained
- [ ] Null checks preserved
- [ ] Boundary conditions handled

**Example:**
```typescript
// Original code (App.tsx)
function handleTokenMove(tokenId: string, x: number, y: number) {
  try {
    if (!tokenId) {
      console.error('Token ID is required');
      return;
    }

    sendMessage({ t: 'tokenMove', tokenId, x, y });
  } catch (error) {
    console.error('Failed to move token:', error);
    showToast('Failed to move token', 'error');
  }
}

// ✅ GOOD: Error handling preserved
export function useTokenActions({ sendMessage, showToast }: Props) {
  const moveToken = useCallback((tokenId: string, x: number, y: number) => {
    try {
      if (!tokenId) {
        console.error('Token ID is required');
        return;
      }

      sendMessage({ t: 'tokenMove', tokenId, x, y });
    } catch (error) {
      console.error('Failed to move token:', error);
      showToast('Failed to move token', 'error');
    }
  }, [sendMessage, showToast]);

  return { moveToken };
}

// ❌ BAD: Error handling removed
export function useTokenActions({ sendMessage }: Props) {
  const moveToken = useCallback((tokenId: string, x: number, y: number) => {
    sendMessage({ t: 'tokenMove', tokenId, x, y }); // No validation! No error handling!
  }, [sendMessage]);

  return { moveToken };
}
```

**Verification:**
- [ ] Characterization tests cover error cases
- [ ] Error boundaries unchanged
- [ ] Logging output identical

---

## 6. Code Quality Checks

### 6.1 Clear Naming

**Specific, Descriptive Names:**

Modules, functions, variables should be self-documenting.

**Good Examples:**
- ✅ `useTokenActions` - Clear what it does
- ✅ `GridAlignmentWizard` - Specific purpose
- ✅ `validatePlayerHP` - Explicit behavior

**Bad Examples:**
- ❌ `useUtils` - Too vague
- ❌ `Manager` - Doesn't describe behavior
- ❌ `handle` - What does it handle?

**Naming Conventions:**
- Hooks: `use[DomainConcept][Action/State]` (e.g., `useTokenActions`, `usePlayerState`)
- Components: `[DomainConcept][Type]` (e.g., `TokenCard`, `PlayerList`, `GridAlignmentWizard`)
- Services: `[DomainConcept]Service` (e.g., `TokenService`, `CharacterService`)
- Utilities: `[verb][DomainConcept]` (e.g., `validatePlayer`, `transformCoordinates`)

**Checklist:**
- [ ] Module name indicates responsibility
- [ ] Function names are verbs (actions) or nouns (getters)
- [ ] Boolean variables start with `is`, `has`, `should`
- [ ] No single-letter variables (except loop indices)
- [ ] No abbreviations unless industry-standard

---

### 6.2 Proper TypeScript Types

**Explicit Over Implicit:**

All types should be explicitly defined, not inferred.

**Checklist:**
- [ ] All function parameters have types
- [ ] All function return types declared
- [ ] All exported interfaces/types documented
- [ ] Union types preferred over `any`
- [ ] Type guards used for narrowing

**Good Examples:**
```typescript
// ✅ Explicit types
interface UseTokenActionsProps {
  sendMessage: (message: ClientMessage) => void;
}

export function useTokenActions({
  sendMessage,
}: UseTokenActionsProps): {
  moveToken: (tokenId: string, x: number, y: number) => void;
  deleteToken: (tokenId: string) => void;
} {
  // Implementation
}

// ✅ Type guards
function isToken(obj: Token | Prop): obj is Token {
  return 'owner' in obj && 'color' in obj;
}
```

**Bad Examples:**
```typescript
// ❌ Implicit types
export function useTokenActions(props) {
  // TypeScript infers types, but not explicit
}

// ❌ Any types
export function useTokenActions(props: any): any {
  // Lost all type safety
}
```

---

### 6.3 JSDoc Documentation

**Required for All Exports:**

Every exported module, function, component, interface must have JSDoc.

**Checklist:**
- [ ] Module-level JSDoc with description and @module tag
- [ ] All exported functions have JSDoc
- [ ] All interface properties documented
- [ ] Usage examples provided (@example tag)
- [ ] Related modules linked (@see tag)

**Template:**
```typescript
/**
 * Token action hooks
 *
 * Provides functions for token manipulation (move, delete, recolor).
 * Wraps sendMessage calls with proper message formatting.
 *
 * @example
 * ```tsx
 * function MyComponent({ sendMessage }) {
 *   const { moveToken } = useTokenActions({ sendMessage });
 *
 *   const handleDrag = (tokenId, x, y) => {
 *     moveToken(tokenId, x, y);
 *   };
 * }
 * ```
 *
 * @see {@link usePlayerActions} for player-related actions
 * @module hooks/useTokenActions
 */

/**
 * Props for useTokenActions hook
 */
export interface UseTokenActionsProps {
  /**
   * Function to send messages to server
   * @param message - Client message to send
   */
  sendMessage: (message: ClientMessage) => void;
}

/**
 * Hook for token action creators
 *
 * @param props - Hook configuration
 * @returns Object containing token action functions
 */
export function useTokenActions({
  sendMessage,
}: UseTokenActionsProps): UseTokenActionsReturn {
  // Implementation
}
```

**Red Flags:**
- ❌ No JSDoc on exports
- ❌ JSDoc says "TODO: document this"
- ❌ No usage examples
- ❌ Copy-pasted JSDoc from another file

---

### 6.4 No Debug Code

**Clean Production Code:**

No debug artifacts should remain in extracted code.

**Checklist:**
- [ ] No `console.log` statements (use logging utility)
- [ ] No `debugger` statements
- [ ] No commented-out code blocks
- [ ] No `// TODO: fix this` comments (create issues instead)
- [ ] No development-only feature flags

**Example:**
```typescript
// ❌ BAD: Debug artifacts
export function useTokenActions({ sendMessage }: Props) {
  const moveToken = useCallback((tokenId, x, y) => {
    console.log('Moving token', tokenId, x, y); // Remove!
    // debugger; // Remove!

    // Old implementation:
    // sendMessage({ type: 'move', id: tokenId }); // Remove!

    sendMessage({ t: 'tokenMove', tokenId, x, y });

    // TODO: add validation // Create issue instead!
  }, [sendMessage]);

  return { moveToken };
}

// ✅ GOOD: Clean code
export function useTokenActions({ sendMessage }: Props) {
  const moveToken = useCallback((tokenId: string, x: number, y: number) => {
    sendMessage({ t: 'tokenMove', tokenId, x, y });
  }, [sendMessage]);

  return { moveToken };
}
```

---

### 6.5 Proper Error Handling

**All Error Paths Covered:**

Every function that can fail must handle errors gracefully.

**Checklist:**
- [ ] Try/catch around async operations
- [ ] Input validation before processing
- [ ] Null checks for optional parameters
- [ ] Error messages are user-friendly
- [ ] Errors logged for debugging
- [ ] Failed operations don't crash app

**Example:**
```typescript
// ✅ GOOD: Comprehensive error handling
export function useTokenActions({ sendMessage, showToast }: Props) {
  const moveToken = useCallback(async (
    tokenId: string,
    x: number,
    y: number
  ) => {
    // Input validation
    if (!tokenId || !tokenId.trim()) {
      showToast('Invalid token ID', 'error');
      return;
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      showToast('Invalid coordinates', 'error');
      return;
    }

    try {
      await sendMessage({ t: 'tokenMove', tokenId, x, y });
    } catch (error) {
      console.error('Failed to move token:', error);
      showToast('Failed to move token. Please try again.', 'error');
    }
  }, [sendMessage, showToast]);

  return { moveToken };
}
```

---

## 7. Testing Requirements

### 7.1 All Existing Tests Pass

**Zero New Failures:**

Refactoring must not break any existing tests.

**Checklist:**
- [ ] All unit tests pass (`pnpm test`)
- [ ] All integration tests pass
- [ ] All E2E tests pass (`pnpm test:e2e`)
- [ ] No new test failures
- [ ] No skipped/disabled tests

**Commands:**
```bash
# Run all tests
pnpm test

# Run specific domain tests
pnpm test:server
pnpm test:client

# E2E tests
pnpm test:e2e
```

**Red Flags:**
- ❌ "Tests pass on my machine" (CI failing)
- ❌ "This test was already broken" (should fix or document separately)
- ❌ "I'll fix the tests in a follow-up PR" (NO - fix now)

---

### 7.2 New Tests for Extracted Code

**Test Coverage for New Modules:**

Every extracted module needs its own test file.

**Checklist:**
- [ ] Test file created in `__tests__/` directory
- [ ] Tests cover happy paths
- [ ] Tests cover edge cases
- [ ] Tests cover error cases
- [ ] Test coverage >80% for new module
- [ ] Tests use appropriate testing patterns (RTL for React, Vitest for hooks)

**Example Test File:**
```typescript
// hooks/__tests__/useTokenActions.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { useTokenActions } from '../useTokenActions';

describe('useTokenActions', () => {
  describe('moveToken', () => {
    it('should send tokenMove message', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() =>
        useTokenActions({ sendMessage })
      );

      act(() => {
        result.current.moveToken('token-1', 100, 200);
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: 'tokenMove',
        tokenId: 'token-1',
        x: 100,
        y: 200,
      });
    });

    it('should handle zero coordinates', () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() =>
        useTokenActions({ sendMessage })
      );

      act(() => {
        result.current.moveToken('token-1', 0, 0);
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: 'tokenMove',
        tokenId: 'token-1',
        x: 0,
        y: 0,
      });
    });
  });
});
```

---

### 7.3 Edge Cases Covered

**Beyond Happy Path:**

Tests must cover boundary conditions and unusual inputs.

**Checklist:**
- [ ] Null/undefined inputs tested
- [ ] Empty arrays/objects tested
- [ ] Boundary values tested (0, -1, max values)
- [ ] Invalid type handling tested
- [ ] Concurrent operations tested (if applicable)

**Example:**
```typescript
describe('useTokenActions - Edge Cases', () => {
  it('should handle empty string tokenId', () => {
    const sendMessage = vi.fn();
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useTokenActions({ sendMessage, showToast })
    );

    act(() => {
      result.current.moveToken('', 100, 200);
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Invalid token ID', 'error');
  });

  it('should handle NaN coordinates', () => {
    const sendMessage = vi.fn();
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useTokenActions({ sendMessage, showToast })
    );

    act(() => {
      result.current.moveToken('token-1', NaN, 200);
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Invalid coordinates', 'error');
  });

  it('should handle negative coordinates', () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useTokenActions({ sendMessage })
    );

    act(() => {
      result.current.moveToken('token-1', -100, -200);
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: 'tokenMove',
      tokenId: 'token-1',
      x: -100,
      y: -200,
    });
  });
});
```

---

### 7.4 Integration Tests If Needed

**Multi-Module Interactions:**

If extraction involves multiple modules, integration tests are required.

**When Required:**
- Module coordinates with other modules
- Module depends on context/providers
- Module has side effects across boundaries

**Example:**
```typescript
// __tests__/integration/tokenManagement.test.ts
describe('Token Management Integration', () => {
  it('should update token on map when moved', async () => {
    const { result: tokenActions } = renderHook(() =>
      useTokenActions({ sendMessage })
    );

    const { result: mapState } = renderHook(() =>
      useMapState()
    );

    act(() => {
      tokenActions.current.moveToken('token-1', 100, 200);
    });

    await waitFor(() => {
      const token = mapState.current.tokens.find(t => t.id === 'token-1');
      expect(token).toMatchObject({ x: 100, y: 200 });
    });
  });
});
```

---

## 8. Red Flags - What Should Block a PR

### 8.1 Failing Tests

**Immediate Block:**

No PR should be merged with failing tests.

**Red Flags:**
- ❌ Any test failures in CI
- ❌ Tests skipped with `it.skip` or `describe.skip`
- ❌ Tests commented out
- ❌ "Tests pass locally but fail in CI"

**Resolution:**
- Fix all failing tests
- Re-enable skipped tests or document why they're skipped
- Investigate CI-specific failures
- Do NOT merge until all GREEN

---

### 8.2 Behavior Changes Without Discussion

**Scope Creep:**

Refactoring PRs should ONLY extract code, not change behavior.

**Red Flags:**
- ❌ "I also fixed bug X while refactoring" - Separate PR!
- ❌ "I improved the algorithm" - Not refactoring!
- ❌ "I added validation that was missing" - Separate PR!
- ❌ Characterization tests were modified to pass

**Resolution:**
- Revert behavior changes
- Create separate PR for bug fixes/features
- Link related PRs in description
- Refactoring = extraction only

**Exception:**
If critical bug is discovered during refactoring:
1. Document it in PR description
2. Get explicit approval from reviewer
3. Add tests for both old and new behavior
4. Consider reverting and fixing in separate PR first

---

### 8.3 Missing Characterization Tests

**No Safety Net:**

Characterization tests MUST exist before extraction.

**Red Flags:**
- ❌ No tests in `__tests__/characterization/` directory
- ❌ "Tests are coming in next PR"
- ❌ Characterization tests written after extraction
- ❌ Only happy path tested

**Resolution:**
- Write characterization tests first
- Verify tests GREEN with original code
- Then perform extraction
- Verify tests still GREEN

---

### 8.4 New God Files Created

**Shifting the Problem:**

Extraction should reduce complexity, not move it.

**Red Flags:**
- ❌ New file is >350 LOC
- ❌ New file has multiple responsibilities
- ❌ New file is named "utils" or "helpers"
- ❌ Structure lint failing with new violations

**Resolution:**
- Split new module further
- Create multiple focused modules
- Follow SRP strictly
- Ensure `pnpm lint:structure:enforce` passes

---

### 8.5 Circular Dependencies Introduced

**Architecture Violation:**

Circular imports indicate poor separation.

**Red Flags:**
- ❌ ESLint circular dependency warnings
- ❌ Modules import each other
- ❌ "It works but import order matters"

**Resolution:**
- Extract shared types to separate file
- Use dependency injection
- Reorder extractions (extract shared code first)
- Consider if modules should be merged

---

### 8.6 Breaking Changes to Shared Types

**API Stability:**

Shared types/interfaces used across modules must remain stable.

**Red Flags:**
- ❌ Changed interface used by other modules
- ❌ Removed required fields
- ❌ Changed field types
- ❌ "I updated all consumers" - massive scope!

**Resolution:**
- Add new fields as optional
- Deprecate old fields (don't remove)
- Create new interface version if breaking change needed
- Consider if change should be separate PR

**Exception:**
If breaking change is intentional and approved:
1. Document all affected modules
2. Update ALL consumers in same PR
3. Add migration guide to PR description
4. Get explicit approval from team

---

## 9. Good vs Bad Extractions

### 9.1 Good Extraction Example

**Context:** Extracting token action creators from App.tsx

**Before (App.tsx - 50 LOC):**
```typescript
function App() {
  const sendMessage = useWebSocket();

  // Token actions (inline)
  const moveToken = useCallback((tokenId: string, x: number, y: number) => {
    sendMessage({ t: 'tokenMove', tokenId, x, y });
  }, [sendMessage]);

  const deleteToken = useCallback((tokenId: string) => {
    sendMessage({ t: 'tokenDelete', tokenId });
  }, [sendMessage]);

  const recolorToken = useCallback((tokenId: string, color: string) => {
    sendMessage({ t: 'tokenRecolor', tokenId, color });
  }, [sendMessage]);

  // ... 500 more lines
}
```

**After - New Module (hooks/useTokenActions.ts - 35 LOC):**
```typescript
/**
 * Token action hooks
 *
 * Provides functions for token manipulation (move, delete, recolor).
 * Wraps sendMessage calls with proper message formatting.
 *
 * @example
 * ```tsx
 * const { moveToken, deleteToken } = useTokenActions({ sendMessage });
 * ```
 *
 * @module hooks/useTokenActions
 */

export interface UseTokenActionsProps {
  sendMessage: (message: ClientMessage) => void;
}

export interface UseTokenActionsReturn {
  moveToken: (tokenId: string, x: number, y: number) => void;
  deleteToken: (tokenId: string) => void;
  recolorToken: (tokenId: string, color: string) => void;
}

export function useTokenActions({
  sendMessage,
}: UseTokenActionsProps): UseTokenActionsReturn {
  const moveToken = useCallback((tokenId: string, x: number, y: number) => {
    sendMessage({ t: 'tokenMove', tokenId, x, y });
  }, [sendMessage]);

  const deleteToken = useCallback((tokenId: string) => {
    sendMessage({ t: 'tokenDelete', tokenId });
  }, [sendMessage]);

  const recolorToken = useCallback((tokenId: string, color: string) => {
    sendMessage({ t: 'tokenRecolor', tokenId, color });
  }, [sendMessage]);

  return { moveToken, deleteToken, recolorToken };
}
```

**After - Source File (App.tsx - 15 LOC):**
```typescript
import { useTokenActions } from './hooks/useTokenActions';

function App() {
  const sendMessage = useWebSocket();
  const { moveToken, deleteToken, recolorToken } = useTokenActions({ sendMessage });

  // ... rest of App
}
```

**Why This is Good:**
✅ Single responsibility (token actions)
✅ Clear interface (minimal props)
✅ Fully documented (JSDoc)
✅ Reusable (can be used elsewhere)
✅ Testable in isolation
✅ Exact behavior preserved
✅ Net reduction: 35 LOC (50 - 15 = 35)

---

### 9.2 Bad Extraction Example

**Context:** "Extracting" utilities from MapBoard.tsx

**Before (MapBoard.tsx - 200 LOC):**
```typescript
function MapBoard() {
  const tokens = useSnapshot(s => s.tokens);
  const players = useSnapshot(s => s.players);

  const moveToken = (tokenId, x, y) => {
    sendMessage({ t: 'tokenMove', tokenId, x, y });
  };

  const deleteToken = (tokenId) => {
    sendMessage({ t: 'tokenDelete', tokenId });
  };

  const validateHP = (hp) => hp >= 0 && hp <= 999;

  const updatePlayer = (uid, updates) => {
    sendMessage({ t: 'updatePlayer', uid, ...updates });
  };

  // ... more code
}
```

**After - New Module (utils/gameUtils.ts - 180 LOC) ❌:**
```typescript
// ❌ BAD: God object extracted into god utility file
export function GameUtils(sendMessage, snapshot) {
  this.sendMessage = sendMessage;
  this.snapshot = snapshot;
}

GameUtils.prototype.moveToken = function(tokenId, x, y) {
  this.sendMessage({ t: 'tokenMove', tokenId, x, y });
};

GameUtils.prototype.deleteToken = function(tokenId) {
  this.sendMessage({ t: 'tokenDelete', tokenId });
};

GameUtils.prototype.validateHP = function(hp) {
  return hp >= 0 && hp <= 999;
};

GameUtils.prototype.updatePlayer = function(uid, updates) {
  this.sendMessage({ t: 'updatePlayer', uid, ...updates });
};

GameUtils.prototype.getTokenPosition = function(tokenId) {
  return this.snapshot.tokens.find(t => t.id === tokenId);
};

// ... 20 more utility methods
```

**Why This is Bad:**
❌ Multiple responsibilities (tokens, players, validation)
❌ God object pattern (class with many methods)
❌ Unclear interface (entire snapshot passed)
❌ Not reusable (coupled to specific context)
❌ Hard to test (requires full snapshot)
❌ No documentation
❌ Violates SRP, ISP, DIP

**Correct Approach:**
Split into focused modules:
- `hooks/useTokenActions.ts` - Token-specific actions
- `hooks/usePlayerActions.ts` - Player-specific actions
- `utils/validation.ts` - Pure validation functions
- `hooks/useTokenPosition.ts` - Token position queries

---

## 10. Approval Criteria

A refactoring PR is ready to merge when ALL of the following are true:

### 10.1 Core Requirements
- [ ] ✅ All tests passing (unit, integration, E2E)
- [ ] ✅ CI checks GREEN (`pnpm lint:structure:enforce`)
- [ ] ✅ TypeScript compiles with no errors
- [ ] ✅ No new `any` types introduced

### 10.2 SOLID Compliance
- [ ] ✅ SRP: Module has single, clear responsibility
- [ ] ✅ OCP: Open for extension, closed for modification
- [ ] ✅ LSP: Drop-in replacement for original code
- [ ] ✅ ISP: Minimal, focused interface
- [ ] ✅ DIP: Depends on abstractions, not concretions

### 10.3 Testing
- [ ] ✅ Characterization tests exist and pass
- [ ] ✅ New tests added for extracted module
- [ ] ✅ Coverage >80% for new module
- [ ] ✅ Edge cases and error cases tested
- [ ] ✅ Manual verification documented

### 10.4 Documentation
- [ ] ✅ JSDoc on all exports
- [ ] ✅ Usage examples provided
- [ ] ✅ Roadmap updated (module marked complete)
- [ ] ✅ PR description includes LOC metrics

### 10.5 Domain Invariants
- [ ] ✅ Ownership rules preserved
- [ ] ✅ State consistency maintained
- [ ] ✅ Coordinate systems correct
- [ ] ✅ Message ordering preserved
- [ ] ✅ No data loss in save/load

### 10.6 Code Quality
- [ ] ✅ Clear, descriptive naming
- [ ] ✅ No debug code (console.log, debugger)
- [ ] ✅ No commented-out code
- [ ] ✅ Error handling preserved
- [ ] ✅ No circular dependencies

### 10.7 Refactoring Specific
- [ ] ✅ LOC reduction documented
- [ ] ✅ No new structural violations
- [ ] ✅ Import/export changes correct
- [ ] ✅ No behavior changes (unless approved)
- [ ] ✅ No new god files created

---

## 11. Reviewer Comments Templates

### 11.1 Requesting Missing Tests

```markdown
**Missing Characterization Tests**

This PR extracts code without characterization tests. Per our refactoring playbook, we need tests BEFORE extraction to ensure behavior preservation.

**Action Required:**
- [ ] Add characterization tests in `__tests__/characterization/[module-name].test.ts`
- [ ] Cover happy paths, edge cases, and error cases
- [ ] Verify all tests GREEN with original code
- [ ] Re-run tests after extraction

**Reference:** [REFACTOR_PLAYBOOK.md - Section 3](./REFACTOR_PLAYBOOK.md#3-create-characterization-tests)
```

### 11.2 Requesting SRP Compliance

```markdown
**SRP Violation**

This extracted module appears to have multiple responsibilities:
1. [Responsibility 1]
2. [Responsibility 2]
3. [Responsibility 3]

**Suggestion:**
Split into separate modules:
- `[module-1].ts` - [Responsibility 1]
- `[module-2].ts` - [Responsibility 2]
- `[module-3].ts` - [Responsibility 3]

**Benefits:**
- Easier to test
- More reusable
- Clearer separation of concerns

**Reference:** [SOLID Principles - SRP](#41-single-responsibility-principle-srp)
```

### 11.3 Requesting Interface Improvement

```markdown
**ISP Violation - God Object Props**

This module accepts the entire snapshot but only uses 2 fields:
```typescript
// Current
interface Props {
  snapshot: RoomSnapshot; // 50+ fields
}

// Suggested
interface Props {
  tokens: Token[];
  mapUrl: string;
}
```

**Action Required:**
- [ ] Update interface to accept only needed fields
- [ ] Update call sites to pass specific fields
- [ ] Update tests

**Benefits:**
- Clearer dependencies
- Easier to test (no need to mock entire snapshot)
- More reusable

**Reference:** [SOLID Principles - ISP](#44-interface-segregation-principle-isp)
```

### 11.4 Requesting LOC Metrics

```markdown
**Missing LOC Metrics**

Please add before/after LOC metrics to the PR description.

**Template:**
```markdown
## LOC Metrics

**Source File:** `[path]`
- **Before:** X LOC
- **After:** Y LOC
- **Reduction:** Z LOC

**New Module:** `[path]`
- **LOC:** A LOC

**Net Reduction:** Z - A LOC

**Progress:** [reduction] / [target] ([percentage]%)
```

**Verification:**
```bash
wc -l [source-file]
wc -l [new-module]
```
```

### 11.5 Approving with Follow-Up

```markdown
**Approved** ✅

Excellent refactoring work! All criteria met:
- ✅ SOLID principles followed
- ✅ Tests comprehensive and passing
- ✅ Domain invariants preserved
- ✅ Documentation complete

**Minor follow-up suggestion:**
Consider extracting `[specific block]` in a future PR to further reduce `[file]` size. Not a blocker for this PR.

**Metrics:**
- LOC reduced: [X] LOC
- Coverage: [Y]%
- All CI checks: GREEN
```

### 11.6 Blocking for Behavior Change

```markdown
**Requesting Changes** 🛑

This PR includes behavior changes that should be in a separate PR:

**Changes Detected:**
1. [Line X]: Added validation that wasn't in original
2. [Line Y]: Changed error message
3. [Line Z]: Modified algorithm

**Action Required:**
1. Revert behavior changes in this PR (pure extraction only)
2. Create separate PR for improvements with:
   - Updated characterization tests
   - Discussion of behavior change rationale
   - Approval from product owner

**Rationale:**
Mixing refactoring and behavior changes makes it hard to verify correctness and increases risk of regressions.

**Reference:** [Red Flags - Behavior Changes](#82-behavior-changes-without-discussion)
```

---

## 12. Quick Decision Tree

Use this flowchart for fast PR evaluation:

```
START: Review Phase 15 Refactoring PR
│
├─ Are all CI checks GREEN?
│  ├─ NO → Request fixes, BLOCK merge
│  └─ YES → Continue
│
├─ Do characterization tests exist and pass?
│  ├─ NO → Request tests, BLOCK merge
│  └─ YES → Continue
│
├─ Does extracted module follow SRP?
│  ├─ NO → Request split, BLOCK merge
│  └─ YES → Continue
│
├─ Are domain invariants preserved?
│  ├─ UNSURE → Request manual verification, BLOCK merge
│  ├─ NO → Request fixes, BLOCK merge
│  └─ YES → Continue
│
├─ Is behavior identical to original?
│  ├─ NO → Request revert or separate PR, BLOCK merge
│  └─ YES → Continue
│
├─ Is documentation complete?
│  ├─ NO → Request JSDoc/examples, REQUEST CHANGES
│  └─ YES → Continue
│
├─ Are LOC metrics documented?
│  ├─ NO → Request metrics, REQUEST CHANGES
│  └─ YES → Continue
│
└─ APPROVE ✅
```

---

## 13. Resources

### 13.1 Related Documentation
- [REFACTOR_ROADMAP.md](./REFACTOR_ROADMAP.md) - Phase 15 extraction plan
- [REFACTOR_PLAYBOOK.md](./REFACTOR_PLAYBOOK.md) - Step-by-step extraction guide
- [PREVENTING_GOD_OBJECTS.md](/docs/guides/PREVENTING_GOD_OBJECTS.md) - Prevention strategies
- [TEST_AUGMENTATION_PLAN.md](./TEST_AUGMENTATION_PLAN.md) - Testing priorities

### 13.2 CI Commands
```bash
# Run all checks
pnpm lint:structure:enforce  # Structure violations
pnpm test                    # All tests
pnpm build                   # TypeScript compilation
pnpm lint                    # ESLint

# Specific test suites
pnpm test:server            # Server tests only
pnpm test:client            # Client tests only
pnpm test:e2e               # E2E tests only

# Coverage
pnpm test:coverage          # Generate coverage report
```

### 13.3 Useful Tools
- **VS Code Extension:** Better Comments (highlight TODOs)
- **VS Code Extension:** Error Lens (inline TypeScript errors)
- **Chrome DevTools:** React Developer Tools (component inspection)
- **CLI:** `wc -l` (line count verification)
- **CLI:** `git diff --stat` (quick LOC metrics)

---

**Last Updated:** 2025-11-15
**Version:** 1.0.0
**Status:** Active - Required for all Phase 15 refactoring PRs
**Maintained By:** Engineering Team

**Questions?** See [REFACTOR_PLAYBOOK.md](./REFACTOR_PLAYBOOK.md) or ask in #engineering channel.
