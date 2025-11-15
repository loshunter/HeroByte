# Room Service Refactoring Plan

**Date Created:** 2025-11-14
**Status:** ✅ COMPLETED (2025-11-14)
**Target:** `apps/server/src/domains/room/service.ts`
**Original LOC:** 688
**Final LOC:** 181 (74% reduction - exceeded target!)

> **Note:** This plan has been successfully executed. See [ROOM_SERVICE_REFACTOR_COMPLETE.md](./ROOM_SERVICE_REFACTOR_COMPLETE.md) for the complete summary, metrics, and lessons learned.

---

## Executive Summary

The RoomService class is a god object handling 9 distinct responsibilities. This plan decomposes it into 6 focused modules following SOLID principles, matching the successful pattern used for validation.ts decomposition.

---

## Current State Analysis

### File: `apps/server/src/domains/room/service.ts` (688 LOC)

**Responsibilities:**
1. **State Management** (~20 LOC) - getState, setState
2. **File Persistence** (~80 LOC) - loadState, saveState, STATE_FILE
3. **Snapshot Loading** (~135 LOC) - loadSnapshot (complex player/token/character merging)
4. **Broadcasting** (~25 LOC) - broadcast, createSnapshot
5. **Scene Graph Building** (~155 LOC) - rebuildSceneGraph (map → tokens → drawings → props → staging → pointers)
6. **Transform Handling** (~165 LOC) - applySceneObjectTransform (type-specific position/scale/rotation logic)
7. **Object Locking** (~45 LOC) - lockSelectedObjects, unlockSelectedObjects
8. **Staging Zone** (~55 LOC) - sanitizeStagingZone, setPlayerStagingZone, getPlayerSpawnPosition
9. **Pointer Cleanup** (~8 LOC) - cleanupPointers

**Complexity Breakdown:**
- **High Complexity (4-5):**
  - `rebuildSceneGraph` (155 LOC) - Builds scene objects from 6 different entity types
  - `applySceneObjectTransform` (165 LOC) - 6-way switch with permission checks
  - `loadSnapshot` (135 LOC) - Complex merge logic for players/tokens/characters

- **Medium Complexity (3):**
  - `loadState` (45 LOC) - File I/O + data normalization
  - `saveState` (19 LOC) - Async file write
  - Staging zone methods (55 LOC) - Geometric calculations

- **Low Complexity (1-2):**
  - State accessors (10 LOC)
  - Locking methods (45 LOC)
  - Broadcasting (25 LOC)
  - Cleanup (8 LOC)

---

## Proposed Decomposition

### Module 1: `persistence/StatePersistence.ts` (~100 LOC)
**Purpose:** Handle file I/O for game state

**Exports:**
```typescript
export class StatePersistence {
  private stateFile: string;

  constructor(stateFile = "./herobyte-state.json");
  loadFromDisk(): RoomState | null;
  saveToDisk(state: RoomState): Promise<void>;
}
```

**Responsibilities:**
- Read JSON from disk
- Write JSON to disk (async)
- Data normalization (ensure proper types/defaults)
- Error handling for I/O operations

**Extraction Source:**
- `loadState()` method (lines 73-114)
- `saveState()` method (lines 120-139)
- `STATE_FILE` constant (line 13)

**Benefits:**
- Testable without WebSocket dependencies
- Easy to swap file backend (e.g., database)
- Clear separation of I/O from business logic

---

### Module 2: `snapshot/SnapshotLoader.ts` (~150 LOC)
**Purpose:** Load and merge snapshots from client

**Exports:**
```typescript
export class SnapshotLoader {
  loadSnapshot(
    currentState: RoomState,
    snapshot: RoomSnapshot
  ): RoomState;

  private mergePlayerData(
    current: Player[],
    loaded: Player[]
  ): Player[];

  private mergeCharacters(
    current: Character[],
    loaded: Character[],
    connectedPlayerUIDs: Set<string>
  ): Character[];

  private mergeTokens(
    current: Token[],
    loaded: Token[],
    connectedPlayerUIDs: Set<string>
  ): Token[];
}
```

**Responsibilities:**
- Merge loaded players with currently connected ones
- Preserve characters belonging to connected players
- Preserve tokens belonging to connected players
- Handle sceneObjects vs legacy drawings
- Sanitize staging zone data

**Extraction Source:**
- `loadSnapshot()` method (lines 145-236)
- `sanitizeStagingZone()` method (lines 26-54)

**Benefits:**
- Complex merge logic isolated and testable
- Clear input/output contracts
- Easy to add more merge strategies

---

### Module 3: `scene/SceneGraphBuilder.ts` (~170 LOC)
**Purpose:** Build scene objects from room entities

**Exports:**
```typescript
export class SceneGraphBuilder {
  rebuildSceneGraph(state: RoomState): SceneObject[];

  private buildMapObject(mapBackground: string, existing: Map<string, SceneObject>): SceneObject | null;
  private buildTokenObjects(tokens: Token[], existing: Map<string, SceneObject>): SceneObject[];
  private buildDrawingObjects(drawings: Drawing[], existing: Map<string, SceneObject>): SceneObject[];
  private buildPropObjects(props: Prop[], existing: Map<string, SceneObject>): SceneObject[];
  private buildStagingZoneObject(zone: PlayerStagingZone | undefined, existing: Map<string, SceneObject>): SceneObject | null;
  private buildPointerObjects(pointers: Pointer[], existing: Map<string, SceneObject>): SceneObject[];
  private detectDuplicateIds(sceneObjects: SceneObject[]): void;
}
```

**Responsibilities:**
- Convert map background → scene object
- Convert tokens → scene objects (preserve transforms)
- Convert drawings → scene objects
- Convert props → scene objects
- Convert staging zone → scene object
- Convert pointers → scene objects
- Detect duplicate IDs (debugging)

**Extraction Source:**
- `rebuildSceneGraph()` method (lines 496-651)

**Benefits:**
- Each entity type has dedicated builder method
- Easy to add new scene object types
- Transform preservation logic centralized
- Duplicate detection isolated

---

### Module 4: `transform/TransformHandler.ts` (~180 LOC)
**Purpose:** Handle scene object transformations

**Exports:**
```typescript
export class TransformHandler {
  applyTransform(
    sceneObjects: SceneObject[],
    state: RoomState,
    id: string,
    actorUid: string,
    changes: TransformChanges
  ): boolean;

  private applyMapTransform(...): boolean;
  private applyTokenTransform(...): boolean;
  private applyStagingZoneTransform(...): boolean;
  private applyDrawingTransform(...): boolean;
  private applyPropTransform(...): boolean;
  private applyPointerTransform(...): boolean;

  private checkPermission(object: SceneObject, actorUid: string, isDM: boolean): boolean;
}

interface TransformChanges {
  position?: { x: number; y: number };
  scale?: { x: number; y: number };
  rotation?: number;
  locked?: boolean;
}
```

**Responsibilities:**
- Route transform by object type
- Check permissions (DM, owner, locked state)
- Apply position changes
- Apply scale changes
- Apply rotation changes
- Update source entities (tokens, props, staging zone)

**Extraction Source:**
- `applySceneObjectTransform()` method (lines 320-494)

**Benefits:**
- Type-specific logic isolated
- Permission checks centralized
- Easy to add new transform types
- Clear separation from scene graph

---

### Module 5: `staging/StagingZoneManager.ts` (~80 LOC)
**Purpose:** Manage player staging zone

**Exports:**
```typescript
export class StagingZoneManager {
  sanitize(zone: unknown): PlayerStagingZone | undefined;
  setZone(state: RoomState, zone: PlayerStagingZone | undefined): boolean;
  getSpawnPosition(zone: PlayerStagingZone | undefined): { x: number; y: number };

  private rotatePoint(x: number, y: number, angle: number): { x: number; y: number };
}
```

**Responsibilities:**
- Validate/sanitize staging zone data
- Set staging zone on state
- Calculate random spawn positions within zone
- Handle rotation geometry

**Extraction Source:**
- `sanitizeStagingZone()` method (lines 26-54)
- `setPlayerStagingZone()` method (lines 656-661)
- `getPlayerSpawnPosition()` method (lines 667-687)

**Benefits:**
- Geometric calculations isolated
- Easy to test spawn distribution
- Clear validation logic
- Reusable rotation utilities

---

### Module 6: `RoomService.ts` (Orchestrator, ~300 LOC)
**Purpose:** Coordinate all room operations

**Responsibilities:**
- Hold RoomState
- Delegate to specialized modules
- Expose public API
- Coordinate broadcast → save workflow

**Methods:**
```typescript
class RoomService {
  // State accessors
  getState(): RoomState
  setState(newState: Partial<RoomState>): void

  // Delegated operations
  loadState(): void                     → StatePersistence
  saveState(): void                     → StatePersistence
  loadSnapshot(snapshot): void          → SnapshotLoader
  broadcast(clients): void              → createSnapshot + saveState
  createSnapshot(): RoomSnapshot        → SceneGraphBuilder + cleanupPointers

  // Locking (keep in orchestrator - simple)
  lockSelectedObjects(actorUid, ids): number
  unlockSelectedObjects(actorUid, ids): number

  // Transforms (delegate)
  applySceneObjectTransform(...)        → TransformHandler

  // Staging zone (delegate)
  setPlayerStagingZone(zone)            → StagingZoneManager
  getPlayerSpawnPosition()              → StagingZoneManager

  // Utilities (keep in orchestrator - trivial)
  cleanupPointers(): void
  private rebuildSceneGraph(): void     → SceneGraphBuilder
}
```

**What Stays:**
- Simple state accessors (getState, setState)
- Locking methods (45 LOC, simple loops)
- cleanupPointers (8 LOC, trivial)
- broadcast coordination (delegates to modules)

**What Gets Delegated:**
- File I/O → StatePersistence
- Snapshot loading → SnapshotLoader
- Scene graph building → SceneGraphBuilder
- Transform handling → TransformHandler
- Staging zone logic → StagingZoneManager

---

## Extraction Order (Dependency-Aware)

### Phase 1: Extract Utilities (Low Dependencies)
**Duration:** 2 days

1. **StagingZoneManager** (Day 1)
   - No external dependencies
   - Pure geometric calculations
   - Easy to test in isolation
   - Branch: `refactor/server/staging-zone-manager`

2. **StatePersistence** (Day 2)
   - Only depends on fs modules
   - Easy to mock file I/O
   - Clear input/output
   - Branch: `refactor/server/state-persistence`

### Phase 2: Extract Builders (Medium Dependencies)
**Duration:** 3 days

3. **SceneGraphBuilder** (Day 3-4)
   - Depends on RoomState type
   - No circular dependencies
   - Builder pattern is testable
   - Branch: `refactor/server/scene-graph-builder`

4. **SnapshotLoader** (Day 5)
   - Depends on StagingZoneManager
   - Complex but pure logic
   - Testable with fixtures
   - Branch: `refactor/server/snapshot-loader`

### Phase 3: Extract Handlers (High Dependencies)
**Duration:** 2 days

5. **TransformHandler** (Day 6-7)
   - Depends on SceneGraphBuilder concepts
   - Type-specific logic requires testing
   - Permission checks need isolation
   - Branch: `refactor/server/transform-handler`

### Phase 4: Refactor Orchestrator
**Duration:** 1 day

6. **Update RoomService** (Day 8)
   - Inject extracted modules
   - Update all delegation points
   - Verify all tests pass
   - Branch: `refactor/server/room-service-orchestrator`

---

## Testing Strategy

### Characterization Tests (Before Extraction)

For each module, write tests that capture current behavior:

**StatePersistence:**
- Load valid state file
- Load corrupted state file (error handling)
- Save state (verify JSON structure)
- Missing file handling

**SnapshotLoader:**
- Merge with no conflicts
- Merge with player conflicts (preserve connection data)
- Merge with token conflicts (preserve current player tokens)
- Merge with character conflicts
- Handle legacy drawings vs sceneObjects

**SceneGraphBuilder:**
- Build with all entity types
- Build with missing entities
- Preserve transforms from previous graph
- Detect duplicate IDs

**TransformHandler:**
- Apply transform to each object type
- Permission checks (DM, owner, locked)
- Position, scale, rotation changes
- Staging zone special cases

**StagingZoneManager:**
- Sanitize valid zone
- Sanitize invalid zone (missing fields)
- Calculate spawn positions (distribution)
- Handle rotation

### Unit Tests (After Extraction)

Each module gets comprehensive unit tests:
- Happy path scenarios
- Edge cases (empty arrays, null values)
- Permission failures
- Data validation failures

### Integration Tests

Verify orchestrator coordinates modules correctly:
- Load → broadcast → save workflow
- Snapshot load → rebuild → broadcast
- Transform → rebuild → broadcast

---

## Success Metrics

**Quantitative:**
- ✅ RoomService: 688 → ~300 LOC (56% reduction)
- ✅ 6 focused modules created (~580 LOC total)
- ✅ Average file size: ~100 LOC (vs 688)
- ✅ Test coverage maintained (0 test failures)
- ✅ 100+ new characterization tests

**Qualitative:**
- ✅ Each module has single responsibility
- ✅ Clear dependency hierarchy (no cycles)
- ✅ Transform logic is type-specific and testable
- ✅ Scene graph building is modular
- ✅ Persistence is swappable (file → DB later)

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| **Circular dependencies** | Extract in dependency order (utilities → builders → handlers) |
| **State mutation bugs** | Use characterization tests to lock in behavior |
| **Performance degradation** | Keep modules lightweight, avoid unnecessary object creation |
| **Test brittleness** | Test behavior, not implementation details |

### Process Risks

| Risk | Mitigation |
|------|------------|
| **Scope creep** | Stick to extraction only, no feature additions |
| **Merge conflicts** | Small PRs, frequent rebasing |
| **Breaking changes** | Maintain public API of RoomService exactly |

---

## File Structure (After Refactoring)

```
apps/server/src/domains/room/
├── service.ts                    # 300 LOC - Orchestrator
├── model.ts                      # Unchanged - Type definitions
├── persistence/
│   └── StatePersistence.ts       # 100 LOC - File I/O
├── snapshot/
│   └── SnapshotLoader.ts         # 150 LOC - Snapshot merging
├── scene/
│   └── SceneGraphBuilder.ts      # 170 LOC - Scene object building
├── transform/
│   └── TransformHandler.ts       # 180 LOC - Transform handling
└── staging/
    └── StagingZoneManager.ts     # 80 LOC - Staging zone logic
```

---

## Estimated Timeline

**Conservative:** 8 working days (1.5 weeks)
**Optimistic:** 6 working days (1 week with focus)

**Breakdown:**
- Phase 1 (Utilities): 2 days
- Phase 2 (Builders): 3 days
- Phase 3 (Handlers): 2 days
- Phase 4 (Orchestrator): 1 day

**Total:** 8 days → ~1.5 weeks

---

## Next Steps

1. **Create feature branch:** `refactor/server/staging-zone-manager`
2. **Write characterization tests** for StagingZoneManager
3. **Extract StagingZoneManager** module
4. **Verify tests pass**
5. **Commit and push**
6. **Repeat for remaining modules**
7. **Merge all to dev** after Phase 4 complete

---

**Last Updated:** 2025-11-14
**Created By:** Claude Code (Phase 15 Initiative)
**Related:** Phase 15 SOLID Refactor Initiative - Server Track
