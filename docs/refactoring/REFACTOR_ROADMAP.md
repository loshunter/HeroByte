# God File Refactoring Roadmap

**Generated:** 2025-10-20
**Phase:** 15 (SOLID Refactor Initiative)
**Goal:** Decompose 3 critical god files (5,479 LOC → target <1,050 LOC, 80% reduction)

---

## Executive Summary

This roadmap provides a systematic plan to refactor the three largest files in the HeroByte codebase:

| File | Current LOC | Target LOC | Reduction | Complexity Clusters | Est. Effort | Status |
|------|-------------|------------|-----------|---------------------|-------------|--------|
| **App.tsx** | 1,850 → 1,303 | 300 | 84% | 27 clusters | 8-10 weeks | Phase 1: ✅ COMPLETE (9/9) |
| **DMMenu.tsx** | 1,588 | 350 | 78% | 20 clusters | 6-8 weeks | Not started |
| **MapBoard.tsx** | 1,041 | 400 | 62% | 32 clusters | 6-8 weeks | Not started |
| **Total** | **4,479** → **3,932** | **1,050** | **77%** | **79 clusters** | **20-26 weeks** | **547 LOC reduced** |

**Phase 1 Milestone Achieved:** 2025-10-20
- 9 extractions completed from App.tsx
- 547 LOC reduction (156% of 350 LOC goal)
- All branches pushed and ready for PR review

---

## Guiding Principles

### SOLID Alignment

1. **Single Responsibility Principle (SRP)**
   - Each extracted module has ONE clearly defined purpose
   - Files under 350 LOC (enforced by CI guardrails)
   - Components render UI OR orchestrate logic, not both

2. **Open/Closed Principle (OCP)**
   - Use composition over configuration
   - Extract extensible hooks and component patterns
   - Enable feature additions without modifying existing code

3. **Liskov Substitution Principle (LSP)**
   - Maintain consistent prop interfaces
   - Extracted components are drop-in replacements
   - Preserve existing behavior during refactoring

4. **Interface Segregation Principle (ISP)**
   - Props interfaces tailored to component needs
   - No "god objects" passed through component trees
   - Explicit dependencies over implicit coupling

5. **Dependency Inversion Principle (DIP)**
   - Extract hooks with dependency injection
   - Components depend on abstractions (hooks/contexts)
   - Business logic decoupled from UI rendering

### Refactoring Safety

- **Test-Driven Decomposition (TDD)**
  - Write characterization tests BEFORE extraction
  - Maintain or improve test coverage
  - Verify behavior preservation after each extraction

- **Incremental Refactoring**
  - Extract one cluster at a time
  - Commit and test after each extraction
  - Keep main branch deployable at all times

- **Dependency Management**
  - Extract low-dependency modules first
  - Build momentum with quick wins
  - Tackle complex orchestration last

---

## File 1: App.tsx (1,850 LOC → 300 LOC)

### Current Status
- **Starting LOC:** 1,850
- **Current LOC:** ~1,303 (estimated after Phase 1)
- **Reduction So Far:** 547 LOC (29.6%)
- **Phase 1 Status:** ✅ COMPLETE (9/9 priorities) - Completed 2025-10-20
- **Next Phase:** Phase 2 (Action Creators)

### Complexity Profile

**Highest Complexity (5):**
- Keyboard Shortcuts (complex permission logic, multi-object handling)

**High Complexity (4):**
- Authentication State Management
- Map Alignment Mode
- Player State Sync
- Main Layout Rendering

**Total Clusters:** 27
**Cross-Cutting Concerns:** 9 (sendMessage, snapshot, isDM, uid, useToast, window APIs, memoization, error handling)

### Extraction Strategy

#### Phase 1: Quick Wins ✅ COMPLETE (2025-10-20)
**Goal:** Extract simple, low-dependency modules to build momentum

| Priority | Module | Est. LOC | Actual LOC | Target Path | Branch | Status |
|----------|--------|----------|------------|-------------|--------|--------|
| 1 | `useLayoutMeasurement` | 20 | -14 | `/hooks/useLayoutMeasurement.ts` | `refactor/app/use-layout-measurement` | ✅ COMPLETE |
| 2 | `useToolMode` | 25 | -11 | `/hooks/useToolMode.ts` | `refactor/app/use-tool-mode` | ✅ COMPLETE |
| 3 | `useCameraCommands` | 30 | -11 | `/hooks/useCameraCommands.ts` | `refactor/app/use-camera-commands` | ✅ COMPLETE |
| 4 | `useE2ETestingSupport` | 15 | -20 | `/utils/useE2ETestingSupport.ts` | `refactor/app/use-e2e-testing-support` | ✅ COMPLETE |
| 5 | `useSceneObjectSelectors` | 20 | -41 | `/hooks/useSceneObjectSelectors.ts` | `refactor/app/use-scene-object-selectors` | ✅ COMPLETE |
| 6 | `VisualEffects` | 40 | -23 | `/components/effects/VisualEffects.tsx` | `refactor/app/visual-effects` | ✅ COMPLETE |
| 7 | `AuthenticationGate` | 120 | -337 | `/features/auth/AuthenticationGate.tsx` | `refactor/app/authentication-gate` | ✅ COMPLETE |
| 8 | `ContextMenu` | 30 | -22 | `/components/ui/ContextMenu.tsx` | `refactor/app/context-menu` | ✅ COMPLETE |
| 9 | `MultiSelectToolbar` | 50 | -68 | `/components/layout/MultiSelectToolbar.tsx` | `refactor/app/multi-select-toolbar` | ✅ COMPLETE |

**Phase 1 Results:**
- **Estimated Reduction:** ~350 LOC
- **Actual Reduction:** 547 LOC (156% of goal)
- **App.tsx:** 1,850 LOC → ~1,303 LOC
- **All tests passing, no regressions**
- **All branches pushed and ready for PR review**

#### Phase 2: Action Creators (2 weeks)
**Goal:** Extract simple message-sending action hooks

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 10 | `useTokenActions` | 50 | `/hooks/useTokenActions.ts` | sendMessage | 3 days |
| 11 | `usePlayerActions` | 30 | `/hooks/usePlayerActions.ts` | sendMessage | 2 days |
| 12 | `useMapActions` | 35 | `/hooks/useMapActions.ts` | sendMessage, snapshot | 2 days |
| 13 | `useStatusEffects` | 25 | `/hooks/useStatusEffects.ts` | sendMessage | 2 days |

**Phase 2 Reduction:** ~140 LOC → App.tsx down to ~1,360 LOC

#### Phase 3: Feature Managers (3 weeks)
**Goal:** Extract self-contained features with UI

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 14 | `VoiceChatManager` | 60 | `/features/voice/VoiceChatManager.tsx` | useVoiceChat, useMicrophone | 4 days |
| 15 | `DrawingStateManager` | 80 | `/features/drawing/DrawingStateManager.ts` | useDrawingState | 4 days |
| 16 | `DiceRollingManager` | 120 | `/features/dice/DiceRollingManager.tsx` | DiceRoller, RollLog | 5 days |

**Phase 3 Reduction:** ~260 LOC → App.tsx down to ~1,100 LOC

#### Phase 4: Complex Business Logic (4 weeks)
**Goal:** Extract complex state machines and workflows

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 17 | `useAuthenticationFlow` | 90 | `/hooks/useAuthenticationFlow.ts` | useWebSocket, sessionStorage | 5 days |
| 18 | `useServerEventHandlers` | 50 | `/hooks/useServerEventHandlers.ts` | registerHandler, useToast | 3 days |
| 19 | `useNPCManagement` | 70 | `/features/npc/useNPCManagement.ts` | sendMessage, snapshot | 4 days |
| 20 | `usePropManagement` | 80 | `/features/props/usePropManagement.ts` | sendMessage, camera | 4 days |
| 21 | `useCharacterManagement` | 90 | `/features/characters/useCharacterManagement.ts` | sendMessage, validation | 5 days |
| 22 | `useRoomPasswordManagement` | 70 | `/features/room/useRoomPasswordManagement.ts` | sendMessage, events | 4 days |
| 23 | `useDMManagement` | 80 | `/features/dm/useDMManagement.ts` | useDMRole, useToast | 4 days |

**Phase 4 Reduction:** ~530 LOC → App.tsx down to ~570 LOC

#### Phase 5: High-Complexity Orchestration (3 weeks)
**Goal:** Extract complex multi-step workflows

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 24 | `SelectionManager` | 90 | `/features/selection/SelectionManager.ts` | useObjectSelection, toolMode | 5 days |
| 25 | `useSessionManagement` | 100 | `/features/session/useSessionManagement.ts` | save/load utils, useToast | 5 days |
| 26 | `useMapAlignment` | 120 | `/features/map/useMapAlignment.ts` | alignment utils, snapshot | 6 days |
| 27 | `usePlayerStateSync` | 140 | `/features/player/usePlayerStateSync.ts` | sendMessage, complex coord | 6 days |

**Phase 5 Reduction:** ~450 LOC → App.tsx down to ~120 LOC

#### Phase 6: Critical Complexity (2 weeks)
**Goal:** Isolate and test the most complex logic

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 28 | `useKeyboardShortcuts` | 180 | `/hooks/useKeyboardShortcuts.ts` | All permissions, complex logic | 7 days |

**Phase 6 Reduction:** ~180 LOC → App.tsx down to ~300 LOC (DONE!)

#### Phase 7: Layout Extraction (1 week)
**Goal:** Separate presentation from orchestration

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 29 | `MainLayout` | 400 | `/layouts/MainLayout.tsx` | All UI components | 5 days |

**Phase 7:** This doesn't reduce App.tsx LOC further, but makes it pure orchestration

### App.tsx Final State

After all extractions, App.tsx will be ~300 LOC:
- Authentication routing (50 LOC)
- Hook composition (150 LOC)
- State providers (50 LOC)
- Layout rendering (50 LOC)

---

## File 2: DMMenu.tsx (1,588 LOC → 350 LOC)

### Complexity Profile

**Highest Complexity (4):**
- Staging Zone Management (viewport calculations, coordinate conversion)
- Grid Alignment Wizard (multi-step workflow with transforms)
- Map Tab UI (orchestrates multiple complex controls)

**Total Clusters:** 20
**Cross-Cutting Concerns:** 7 (form input styling, collapsible panels, validation, image previews, empty states)

### Extraction Strategy

#### Phase 1: UI Primitives (1 week)
**Goal:** Extract reusable UI components

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 1 | `CollapsibleSection` | 20 | `/components/ui/CollapsibleSection.tsx` | React | 1 day |
| 2 | `FormInput` (new) | 30 | `/components/ui/FormInput.tsx` | Styling standards | 2 days |
| 3 | `ImagePreview` (new) | 40 | `/components/ui/ImagePreview.tsx` | Error handling | 2 days |
| 4 | `EmptyState` (new) | 25 | `/components/ui/EmptyState.tsx` | Icons | 1 day |

**Phase 1 Reduction:** ~115 LOC of duplication → DMMenu.tsx down to ~1,473 LOC

#### Phase 2: Entity Editors (1 week)
**Goal:** Extract self-contained CRUD components

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 5 | `NPCEditor` | 210 | `/features/dm/components/NPCEditor.tsx` | JRPGPanel, validation | 4 days |
| 6 | `PropEditor` | 180 | `/features/dm/components/PropEditor.tsx` | JRPGPanel | 3 days |

**Phase 2 Reduction:** ~390 LOC → DMMenu.tsx down to ~1,083 LOC

#### Phase 3: Simple Map Controls (1 week)
**Goal:** Extract basic configuration panels

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 7 | `MapBackgroundControl` | 40 | `/features/dm/components/map-controls/MapBackgroundControl.tsx` | ImagePreview | 2 days |
| 8 | `DrawingControls` | 30 | `/features/dm/components/map-controls/DrawingControls.tsx` | window.confirm | 1 day |
| 9 | `GridControl` | 90 | `/features/dm/components/map-controls/GridControl.tsx` | CollapsibleSection | 3 days |

**Phase 3 Reduction:** ~160 LOC → DMMenu.tsx down to ~923 LOC

#### Phase 4: Complex Map Controls (2 weeks)
**Goal:** Extract controls with mathematical logic

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 10 | `MapTransformControl` | 160 | `/features/dm/components/map-controls/MapTransformControl.tsx` | Transform types | 5 days |
| 11 | `StagingZoneControl` | 180 | `/features/dm/components/map-controls/StagingZoneControl.tsx` | Camera, grid math | 6 days |
| 12 | `GridAlignmentWizard` | 90 | `/features/dm/components/map-controls/GridAlignmentWizard.tsx` | Alignment utils | 4 days |

**Phase 4 Reduction:** ~430 LOC → DMMenu.tsx down to ~493 LOC

#### Phase 5: Session Controls (1 week)
**Goal:** Extract session management features

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 13 | `SessionPersistenceControl` | 60 | `/features/dm/components/session-controls/SessionPersistenceControl.tsx` | File refs | 3 days |
| 14 | `RoomPasswordControl` | 80 | `/features/dm/components/session-controls/RoomPasswordControl.tsx` | Validation | 3 days |

**Phase 5 Reduction:** ~140 LOC → DMMenu.tsx down to ~353 LOC

#### Phase 6: Tab Views (1 week)
**Goal:** Compose extracted controls into tab views

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 15 | `MapTab` | 100 | `/features/dm/components/tabs/MapTab.tsx` | All map controls | 2 days |
| 16 | `NPCsTab` | 50 | `/features/dm/components/tabs/NPCsTab.tsx` | NPCEditor | 1 day |
| 17 | `PropsTab` | 50 | `/features/dm/components/tabs/PropsTab.tsx` | PropEditor | 1 day |
| 18 | `SessionTab` | 60 | `/features/dm/components/tabs/SessionTab.tsx` | Session controls | 2 days |

**Phase 6:** Doesn't reduce LOC but creates clean composition layer

#### Optional Phase 7: State Hook (3 days)
**Goal:** Extract state management logic

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 19 | `useDMMenuState` | 60 | `/features/dm/hooks/useDMMenuState.ts` | All state dependencies | 3 days |

### DMMenu.tsx Final State

After all extractions, DMMenu.tsx will be ~350 LOC:
- Component state (50 LOC if not extracted to hook)
- Tab navigation (40 LOC)
- Window container (60 LOC)
- Tab rendering (200 LOC - just composition)

---

## File 3: MapBoard.tsx (1,041 LOC → 400 LOC)

### Complexity Profile

**Highest Complexity (5):**
- Event Router System (unified click/mouse handlers)
- Transform Handlers (coordinate conversions)
- Marquee Selection (complex intersection logic)
- Inline Rendering (staging zone, alignment viz)
- Node Reference Management (ref tracking)

**Total Clusters:** 32
**Cross-Cutting Concerns:** 5 (camera state, tool mode conditionals, selection fragmentation, node refs, event composition)

### Extraction Strategy

#### Phase 1: Pure Utilities (3 days)
**Goal:** Extract zero-dependency utilities

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 1 | `MapBoardTypes` | 40 | `/ui/MapBoard.types.ts` | @shared types | 1 day |
| 2 | `coordinateTransforms` | 20 | `/utils/coordinateTransforms.ts` | Math | 1 day |
| 3 | `useElementSize` | 15 | `/hooks/useElementSize.ts` | ResizeObserver | 1 day |

**Phase 1 Reduction:** ~75 LOC → MapBoard.tsx down to ~966 LOC

#### Phase 2: Simple State Hooks (1 week)
**Goal:** Extract basic state management

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 4 | `useGridConfig` | 25 | `/hooks/useGridConfig.ts` | snapshot | 2 days |
| 5 | `useCursorStyle` | 30 | `/hooks/useCursorStyle.ts` | tool mode | 2 days |
| 6 | `useSceneObjectsData` | 40 | `/hooks/useSceneObjectsData.ts` | snapshot, transforms | 2 days |

**Phase 2 Reduction:** ~95 LOC → MapBoard.tsx down to ~871 LOC

#### Phase 3: Node Reference System (1 week)
**Goal:** Centralize ref tracking

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 7 | `useKonvaNodeRefs` | 80 | `/hooks/useKonvaNodeRefs.ts` | Konva types | 5 days |

**Phase 3 Reduction:** ~80 LOC → MapBoard.tsx down to ~791 LOC

#### Phase 4: Feature Hooks (2 weeks)
**Goal:** Extract complex feature logic

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 8 | `useMarqueeSelection` | 110 | `/features/selection/useMarqueeSelection.ts` | Intersection logic | 5 days |
| 9 | `useKeyboardNavigation` | 40 | `/hooks/useKeyboardNavigation.ts` | keyboard events | 2 days |
| 10 | `useAlignmentVisualization` | 60 | `/features/map/useAlignmentVisualization.ts` | alignment state | 3 days |

**Phase 4 Reduction:** ~210 LOC → MapBoard.tsx down to ~581 LOC

#### Phase 5: Presentational Components (1 week)
**Goal:** Extract inline rendering

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 11 | `StagingZoneLayer` | 60 | `/components/map/StagingZoneLayer.tsx` | Konva | 3 days |
| 12 | `AlignmentOverlay` | 50 | `/components/map/AlignmentOverlay.tsx` | Konva | 2 days |
| 13 | `BackgroundLayer` | 40 | `/components/map/BackgroundLayer.tsx` | Konva | 2 days |

**Phase 5 Reduction:** ~150 LOC → MapBoard.tsx down to ~431 LOC

#### Phase 6: Complex Orchestration (3 weeks)
**Goal:** Extract high-complexity coordination

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 14 | `useObjectTransformHandlers` | 80 | `/hooks/useObjectTransformHandlers.ts` | Transforms, msgs | 4 days |
| 15 | `useCameraControl` | 90 | `/hooks/useCameraControl.ts` | useCamera hook | 5 days |
| 16 | `useTransformGizmoIntegration` | 100 | `/hooks/useTransformGizmoIntegration.ts` | Selection, transforms | 6 days |

**Phase 6 Reduction:** ~270 LOC → MapBoard.tsx down to ~161 LOC

#### Phase 7: Event Router (2 weeks)
**Goal:** Centralize event delegation (highest complexity)

| Priority | Module | LOC | Target Path | Dependencies | Effort |
|----------|--------|-----|-------------|--------------|--------|
| 17 | `useStageEventRouter` | 200 | `/hooks/useStageEventRouter.ts` | All tool handlers | 10 days |

**Phase 7 Reduction:** ~200 LOC → MapBoard.tsx down to ~400 LOC (DONE!)

### MapBoard.tsx Final State

After all extractions, MapBoard.tsx will be ~400 LOC:
- Hook composition (100 LOC)
- Layer assembly (200 LOC)
- Stage configuration (100 LOC)

---

## Cross-File Architecture Improvements

### Shared Patterns to Extract

1. **Action Creator Pattern**
   - `useActions` factory hook
   - Wraps sendMessage with type safety
   - Location: `/hooks/useActions.ts`

2. **Server Event Registration**
   - `useServerEvents` hook
   - Centralized event handling
   - Location: `/hooks/useServerEvents.ts`

3. **Coordinate Conversion Utilities**
   - Screen ↔ World transformations
   - Grid snapping logic
   - Location: `/utils/coordinates.ts`

4. **Permission System**
   - `usePermissions` hook
   - Centralized isDM + ownership checks
   - Location: `/hooks/usePermissions.ts`

5. **Validation Utilities**
   - Number clamping
   - HP validation
   - Required field checks
   - Location: `/utils/validation.ts`

### New Architectural Layers

```
apps/client/src/
├── components/          # Presentational components
│   ├── ui/              # Reusable UI primitives
│   ├── layout/          # Layout components
│   ├── effects/         # Visual effects
│   └── map/             # Map-specific visuals
├── features/            # Feature modules
│   ├── auth/            # Authentication
│   ├── dice/            # Dice rolling
│   ├── drawing/         # Drawing tools
│   ├── dm/              # DM controls
│   │   ├── components/  # DM UI components
│   │   │   ├── tabs/    # Tab views
│   │   │   ├── map-controls/    # Map controls
│   │   │   └── session-controls/ # Session controls
│   │   └── hooks/       # DM-specific hooks
│   ├── map/             # Map management
│   ├── npc/             # NPC management
│   ├── player/          # Player management
│   ├── props/           # Props management
│   ├── selection/       # Selection system
│   ├── session/         # Session management
│   └── voice/           # Voice chat
├── hooks/               # Shared hooks
├── layouts/             # Layout components
└── utils/               # Utilities
```

---

## Testing Strategy

### Characterization Tests (Before Extraction)

**Goal:** Lock in current behavior before refactoring

1. **Snapshot current behavior** using React Testing Library
2. **Record integration paths** for critical workflows
3. **Capture edge cases** with focused unit tests
4. **Document side effects** (network calls, window APIs)

**Test Locations:**
- `__tests__/characterization/` - Pre-extraction behavior tests
- Keep alongside refactored modules after extraction

### Post-Extraction Tests

**Goal:** Maintain coverage and improve testability

1. **Unit Tests** for extracted hooks (>80% coverage)
2. **Component Tests** for UI components (Vitest + RTL)
3. **Integration Tests** for multi-hook workflows
4. **Visual Regression** tests (optional, Storybook)

### Continuous Validation

- Run full test suite after each extraction
- Visual inspection in dev environment
- E2E smoke tests for critical paths
- Monitor CI for regression

---

## Success Metrics

### Quantitative

**Progress So Far:**
- [x] ✅ **App.tsx Phase 1:** 1,850 LOC → ~1,303 LOC (29.6% reduction, 547 LOC)
- [ ] App.tsx Phases 2-7: ~1,303 LOC → 300 LOC (remaining 54.4% reduction)
- [ ] DMMenu.tsx: 1,588 LOC → 350 LOC (78% reduction)
- [ ] MapBoard.tsx: 1,041 LOC → 400 LOC (62% reduction)
- [x] ✅ **Current Total:** 4,479 LOC → 3,932 LOC (547 LOC reduced, 12.2% of overall goal)
- [ ] **Final Goal:** 4,479 LOC → 1,050 LOC (77% reduction)

**Quality Metrics (Phase 1):**
- [x] ✅ Test coverage maintained (>80% per module)
- [x] ✅ Zero new violations of 350 LOC limit
- [x] ✅ All CI checks passing after each extraction
- [x] ✅ All characterization tests written and passing
- [x] ✅ No behavioral regressions detected

### Qualitative

- [ ] Each file has single, clear responsibility
- [ ] Module boundaries align with domain concepts
- [ ] Components are independently testable
- [ ] Hooks are reusable across features
- [ ] New contributors can find code easily
- [ ] Reduced cognitive load for code reviews

---

## Risk Mitigation

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Behavior regression | Medium | High | Characterization tests, incremental commits |
| Performance degradation | Low | Medium | Benchmark critical paths, profile after refactor |
| Circular dependencies | Medium | Medium | Enforce dependency rules with ESLint |
| Incomplete extraction | Low | Low | Use refactor playbook checklist |
| Test suite brittleness | Medium | Low | Focus on behavior over implementation |

### Process Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Merge conflicts | High | Low | Frequent rebasing, communicate with team |
| Scope creep | Medium | Medium | Stick to extraction order, no feature additions |
| Review fatigue | Medium | Medium | Small PRs (<300 LOC), clear descriptions |
| Documentation lag | High | Low | Update docs in same PR as refactor |

---

## Timeline

### Conservative Estimate (26 weeks)

- **Weeks 1-10:** App.tsx refactoring (7 phases)
- **Weeks 11-17:** DMMenu.tsx refactoring (6 phases)
- **Weeks 18-26:** MapBoard.tsx refactoring (7 phases)

### Optimistic Estimate (20 weeks)

- Parallel extraction of independent modules
- Team collaboration on separate files
- Faster iteration with established patterns

### Phased Delivery

**Milestone 1 (Week 8):** App.tsx Phase 1-3 complete (750 LOC reduction)
**Milestone 2 (Week 16):** App.tsx complete, DMMenu.tsx Phase 1-3 complete
**Milestone 3 (Week 26):** All god files refactored, CI guardrails validated

---

## Next Steps

1. **Review this roadmap** with the team
2. **Create GitHub Project** for tracking extractions
3. **Set up characterization tests** for App.tsx
4. **Begin Phase 1 extractions** (quick wins)
5. **Establish refactor playbook** (see REFACTOR_PLAYBOOK.md)
6. **Document learnings** for future refactors

---

**Last Updated:** 2025-10-20 (Phase 1 Complete)
**Phase 1 Completed:** 2025-10-20 - App.tsx 9/9 extractions, 547 LOC reduction
**Maintained By:** Engineering Team
**Related Documents:**
- [TODO.md Phase 15](/TODO.md#phase-15-solid-refactor-initiative-future)
- [REFACTOR_PLAYBOOK.md](./REFACTOR_PLAYBOOK.md)
- [NEXT_STEPS.md](./NEXT_STEPS.md) - Phase 1 lessons learned and Phase 2 guidance
- [CONTRIBUTING.md](/CONTRIBUTING.md#structural-guardrails)
