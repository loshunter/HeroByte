# MainLayout Decomposition - Decision Log

**Project:** MainLayout.tsx Decomposition
**Branch:** `refactor/main-layout/decompose`
**Manager:** Claude Code (Orchestrator Role)
**Started:** 2025-10-21

---

## Overview

This log tracks key decisions, rationale, and findings during the decomposition of MainLayout.tsx from a 795 LOC god file into a clean <200 LOC orchestration component with 4 sub-layout components.

**Target State:**
- MainLayout.tsx: <200 LOC (orchestration only)
- 4 sub-components: TopPanelLayout, CenterCanvasLayout, FloatingPanelsLayout, BottomPanelLayout
- All sub-components: <350 LOC each
- Props interfaces: <80 LOC each
- Removed from structure-baseline.json

---

## Setup Phase

### 2025-10-21: Project Initialization

**Decision:** Create feature branch `refactor/main-layout/decompose`
**Rationale:** Follows branching strategy from BRANCHING_STRATEGY.md for Phase 15 refactoring work
**Status:** ✅ Complete

**Decision:** Create comprehensive 30-item todo list covering all phases
**Rationale:**
- Manage complex multi-week refactoring
- Track progress across 4 extractions
- Ensure no steps are missed
- Provide visibility to user
**Status:** ✅ Complete

---

## Extraction 1: TopPanelLayout (Target: ~120 LOC, ~15-20 props)

### Analysis Phase (Completed 2025-10-21)

**Source:** MainLayout.tsx lines 544-574
**Components:** ServerStatus, DrawingToolbar (conditional), Header, MultiSelectToolbar

**Agent:** Explore (medium thoroughness)
**Status:** ✅ Complete

**Key Findings:**
- **Props Required:** 22 props across 8 logical categories
- **Components Rendered:** 4 (ServerStatus, DrawingToolbar, Header, MultiSelectToolbar)
- **Conditional Rendering:** DrawingToolbar only shows when `drawMode === true`
- **No Local State:** Pure presentation component
- **No Inline Functions:** All callbacks passed from parent
- **Estimated Extracted LOC:** 100-120 lines

**Props Breakdown:**
1. Connection & Status (1 prop): `isConnected`
2. Tool State (2 props): `drawMode`, `drawingToolbarProps`
3. Header & Controls (3 props): `uid`, `activeTool`, `setActiveTool`
4. UI State & Toggles (6 props): snap/crt/dice toggles
5. UI Handlers (4 props): toggle/focus/reset handlers
6. Layout (2 props): `topPanelRef`, `topHeight`
7. Selection & Multi-Select (4 props): `selectedObjectIds`, `isDM`, lock handlers

**Decision:** Use flat prop interface with semantic grouping comments (recommended Option B)
**Rationale:**
- More explicit and self-documenting than object grouping
- Easier to debug prop passing
- Follows existing codebase conventions
- Better TypeScript autocomplete experience

### Interface Design Phase (Completed 2025-10-21)

**Status:** ✅ Complete

**Final Interface Structure:**
```typescript
export interface TopPanelLayoutProps {
  // Connection & Status (1 prop)
  isConnected: boolean;

  // Tool State (2 props)
  drawMode: boolean;
  drawingToolbarProps: DrawingToolbarProps;

  // Header & Controls (3 props)
  uid: string;
  activeTool: ToolMode;
  setActiveTool: (mode: ToolMode) => void;

  // UI State & Toggles (6 props)
  snapToGrid: boolean;
  setSnapToGrid: (value: boolean) => void;
  crtFilter: boolean;
  setCrtFilter: (value: boolean) => void;
  diceRollerOpen: boolean;
  rollLogOpen: boolean;

  // UI Handlers (4 props)
  toggleDiceRoller: (value: boolean) => void;
  toggleRollLog: (value: boolean) => void;
  handleFocusSelf: () => void;
  handleResetCamera: () => void;

  // Layout (2 props)
  topPanelRef: React.RefObject<HTMLDivElement>;
  topHeight: number;

  // Selection & Multi-Select (4 props)
  selectedObjectIds: string[];
  isDM: boolean;
  lockSelected: () => void;
  unlockSelected: () => void;
}
```

**Total:** 22 props (slightly above target of 15-20, but well-organized)
**Estimated Interface LOC:** ~60-65 lines with JSDoc comments

**Decision:** Approved for implementation
**Next:** Write characterization tests before extraction

### Characterization Tests Phase (Completed 2025-10-21)

**Status:** ✅ Complete

**Agent:** General-purpose
**Test File:** `/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/TopPanelLayout.characterization.test.tsx`

**Results:**
- **Test Cases:** 46 tests created
- **LOC:** ~1,000 lines
- **Execution Time:** ~205ms
- **Status:** ✅ All tests passing

**Coverage:**
1. ServerStatus rendering (3 tests)
2. DrawingToolbar conditional rendering (4 tests)
3. Header rendering with all 14 props (15 tests)
4. MultiSelectToolbar rendering with all 5 props (11 tests)
5. Component hierarchy and order (2 tests)
6. Edge cases and integration (11 tests)

**Key Testing Strategies:**
- Component mocking for isolation
- Data-attribute based prop verification
- Comprehensive edge case coverage (null, extreme values, empty arrays)
- State transition tests (drawMode toggling, prop updates)

**Next:** Create TopPanelLayout component file

### Component Creation Phase (Completed 2025-10-21)

**Status:** ✅ Complete

**Agent:** General-purpose
**Component File:** `/home/loshunter/HeroByte/apps/client/src/layouts/TopPanelLayout.tsx`

**Results:**
- **Total LOC:** 171 lines (under 200 LOC target ✅)
- **Props Interface LOC:** 59 lines (under 80 LOC target ✅)
- **Component Implementation LOC:** 64 lines
- **TypeScript Compilation:** ✅ No errors
- **Characterization Tests:** ✅ All 46 tests passing

**Component Features:**
- Uses `React.memo` for performance optimization
- Comprehensive JSDoc documentation (file and component level)
- Pure presentation component (no internal state)
- Exact JSX extraction from MainLayout.tsx lines 544-574
- All 22 props properly typed and documented

**JSX Structure:**
1. ServerStatus component (connection status banner)
2. DrawingToolbar (conditional on `drawMode`)
3. Header component (main header with tools and controls)
4. MultiSelectToolbar (multi-select actions)

**Next:** Integrate TopPanelLayout into MainLayout and verify

### Integration Phase (Completed 2025-10-21)

**Status:** ✅ Complete

**Changes Made:**
1. **MainLayout.tsx imports:**
   - Removed: ServerStatus, DrawingToolbar, Header, MultiSelectToolbar
   - Added: TopPanelLayout
   - Kept: DrawingToolbarProps type alias (still used in MainLayoutProps)

2. **MainLayout.tsx JSX:**
   - Replaced lines 543-574 (31 lines) with TopPanelLayout component
   - Passed all 22 required props to TopPanelLayout
   - Added comment explaining what TopPanelLayout contains

**Results:**
- **MainLayout.tsx LOC:** 795 → 785 (10 LOC reduction, 1.3%)
- **TopPanelLayout.tsx LOC:** 171 (new file)
- **Characterization Tests:** ✅ All 46 tests passing
- **TypeScript Compilation:** ✅ No errors detected

**LOC Accounting:**
- Lines removed: ~31 (old JSX + removed imports)
- Lines added: ~21 (TopPanelLayout import + component call with props)
- Net reduction: 10 LOC in MainLayout
- New component: 171 LOC in TopPanelLayout

**Verification:**
- ✅ All characterization tests pass
- ✅ Component renders correctly
- ✅ All props passed correctly
- ✅ No behavioral changes

**Key Learnings:**
1. Import cleanup is important - removed 4 component imports no longer used
2. Prop spreading with 22 individual props takes significant space but is explicit
3. Tests caught integration correctly - characterization tests validated behavior preservation

**Next:** Begin Extraction 2 - CenterCanvasLayout

---

## Extraction 2: CenterCanvasLayout (Target: ~50 LOC, ~25 props)

### Analysis Phase (Completed 2025-10-21)

**Source:** MainLayout.tsx lines 566-605 (after TopPanelLayout extraction)
**Components:** MapBoard (single component with dynamic container)

**Agent:** Explore (medium thoroughness)
**Status:** ✅ Complete

**Key Findings:**
- **Props Required:** 25 props (not counting drawingProps spread contents)
- **Components Rendered:** 1 (MapBoard) + wrapper div with dynamic positioning
- **Conditional Rendering:** None - MapBoard always rendered
- **No Local State:** Pure presentation component
- **No Inline Functions:** All callbacks passed directly
- **Estimated Extracted LOC:** ~35-40 lines

**Props Breakdown:**
1. Layout Positioning (2 props): `topHeight`, `bottomHeight`
2. Core MapBoard Data (5 props): `snapshot`, `uid`, `gridSize`, `snapToGrid`, `isDM`
3. Tool Modes (6 props): `pointerMode`, `measureMode`, `drawMode`, `transformMode`, `selectMode`, `alignmentMode`
4. Selection State (4 props): `selectedObjectId`, `selectedObjectIds`, `onSelectObject`, `onSelectObjects`
5. Camera Control (3 props): `cameraCommand`, `onCameraCommandHandled`, `onCameraChange`
6. Alignment Mode (3 props): `alignmentPoints`, `alignmentSuggestion`, `onAlignmentPointCapture`
7. Scene Object Actions (2 props): `onRecolorToken`, `onTransformObject`
8. WebSocket Communication (1 prop): `sendMessage`
9. Drawing Props (spread): `drawingProps` (spread operator)

**Decision:** Keep `drawingProps` as spread operator (not unpacked)
**Rationale:**
- Already well-encapsulated by UseDrawingStateManagerReturn type
- Reduces prop interface complexity
- Follows existing pattern in current code
- Easier to maintain if drawing manager adds/removes props

**Complexity Assessment:**
- **Simplicity:** HIGH (simpler than TopPanelLayout)
- **Logic:** Minimal - just dynamic positioning wrapper
- **Extraction Readiness:** Excellent

### Interface Design Phase (Completed 2025-10-21)

**Status:** ✅ Complete

**Final Interface Structure:**
```typescript
export interface CenterCanvasLayoutProps {
  // Layout Positioning (2 props)
  topHeight: number;
  bottomHeight: number;

  // Core MapBoard Data (5 props)
  snapshot: RoomSnapshot | null;
  uid: string;
  gridSize: number;
  snapToGrid: boolean;
  isDM: boolean;

  // Tool Modes (6 props)
  pointerMode: boolean;
  measureMode: boolean;
  drawMode: boolean;
  transformMode: boolean;
  selectMode: boolean;
  alignmentMode: boolean;

  // Selection State (4 props)
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  onSelectObject: (id: string | null) => void;
  onSelectObjects: (ids: string[]) => void;

  // Camera Control (3 props)
  cameraCommand: CameraCommand | null;
  onCameraCommandHandled: () => void;
  onCameraChange: (state: { x: number; y: number; scale: number }) => void;

  // Alignment Mode (3 props)
  alignmentPoints: AlignmentPoint[];
  alignmentSuggestion: AlignmentSuggestion | null;
  onAlignmentPointCapture: (point: AlignmentPoint) => void;

  // Scene Object Actions (2 props)
  onRecolorToken: (sceneId: string, owner?: string | null) => void;
  onTransformObject: (input: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;

  // Drawing Props (spread)
  drawingProps: DrawingBoardProps;

  // WebSocket Communication (1 prop)
  sendMessage: (message: ClientMessage) => void;
}
```

**Total:** 26 props (25 + drawingProps object)
**Estimated Interface LOC:** ~55-60 lines with JSDoc comments

**Decision:** Approved for implementation
**Next:** Write characterization tests before extraction

### Characterization Tests Phase (Completed 2025-10-21)

**Status:** ✅ Complete

**Agent:** General-purpose
**Test File:** `/home/loshunter/HeroByte/apps/client/src/layouts/__tests__/CenterCanvasLayout.characterization.test.tsx`

**Results:**
- **Test Cases:** 70 tests created (more than TopPanelLayout's 46!)
- **LOC:** ~1,357 lines
- **Status:** ✅ All tests passing

**Coverage:**
1. Wrapper div rendering (4 tests)
2. Dynamic positioning with topHeight/bottomHeight (10 tests)
3. MapBoard component rendering (2 tests)
4. Core data props pass-through (8 tests)
5. Tool mode props (8 tests)
6. Selection props (5 tests)
7. Camera props (4 tests)
8. Alignment props (4 tests)
9. Drawing props via spread operator (8 tests)
10. Edge cases (14 tests)
11. Handler props (1 test)
12. Integration tests (2 tests)

**Key Testing Strategies:**
- MapBoard component mocking for isolation
- Data-attribute based prop verification
- Dynamic positioning tests (topHeight: 0-9999px, bottomHeight: 0-9999px)
- Spread operator coverage for drawingProps
- Comprehensive edge case coverage

**Next:** Create CenterCanvasLayout component file

### Component Creation Phase (Completed 2025-10-21)

**Status:** ✅ Complete

**Agent:** General-purpose
**Component File:** `/home/loshunter/HeroByte/apps/client/src/layouts/CenterCanvasLayout.tsx`

**Results:**
- **Total LOC:** 241 lines (well under 350 LOC target ✅)
- **Props Interface LOC:** 78 lines (under 80 LOC target ✅)
- **Component Implementation LOC:** 74 lines
- **TypeScript Compilation:** ✅ No errors
- **Characterization Tests:** ✅ All 70 tests passing

**Component Features:**
- Uses `React.memo` for performance optimization
- Comprehensive JSDoc documentation (file, interface, component levels)
- Pure presentation component (no internal state)
- Exact JSX extraction from MainLayout.tsx lines 566-605
- All 26 props properly typed and documented
- Dynamic positioning wrapper (top/bottom based on panel heights)

**JSX Structure:**
1. Fixed-position wrapper div (dynamic top/bottom spacing)
2. MapBoard component (26+ props via explicit passing and spread)

**Next:** Integrate CenterCanvasLayout into MainLayout and verify

### Integration Phase (Completed 2025-10-21)

**Status:** ✅ Complete

**Changes Made:**
1. **MainLayout.tsx imports:**
   - Added: CenterCanvasLayout
   - Removed: MapBoard import (now imported by CenterCanvasLayout)

2. **MainLayout.tsx JSX:**
   - Replaced lines 566-604 (39 lines) with CenterCanvasLayout component
   - Passed all 26 required props to CenterCanvasLayout
   - Added comment explaining CenterCanvasLayout purpose

**Results:**
- **MainLayout.tsx LOC:** 785 → 777 (8 LOC reduction, 1.0%)
- **CenterCanvasLayout.tsx LOC:** 241 (new file)
- **Characterization Tests:** ✅ All 70 tests passing
- **TypeScript Compilation:** ✅ No errors

**LOC Accounting:**
- Lines removed: ~39 (wrapper div + MapBoard JSX)
- Lines added: ~31 (CenterCanvasLayout import + component call with 26 props)
- Net reduction: 8 LOC in MainLayout
- New component: 241 LOC in CenterCanvasLayout

**Cumulative Progress:**
- **Total Reduction:** 795 → 777 LOC (18 LOC, 2.3%)
- **Target:** <200 LOC (need to reduce by 577 more LOC, 74%)
- **Extractions Complete:** 2 of 4

**Verification:**
- ✅ All characterization tests pass
- ✅ Component renders correctly
- ✅ All props passed correctly (including spread drawingProps)
- ✅ Dynamic positioning working (topHeight/bottomHeight)
- ✅ No behavioral changes

**Next:** Begin Extraction 3 - FloatingPanelsLayout

---

## Extraction 3: FloatingPanelsLayout (Target: ~120 LOC, ~25-30 props)

### Analysis Phase

**Source:** MainLayout.tsx lines 681-792
**Components:** DMMenu, ContextMenu, DiceRoller, RollLog, VisualEffects, Toast

_[Pending]_

---

## Extraction 4: BottomPanelLayout (Target: ~180 LOC, ~30-35 props)

### Analysis Phase

**Source:** MainLayout.tsx lines 616-679
**Components:** EntitiesPanel with complex inline HP editing logic (lines 646-663)

**Note:** Most complex extraction - requires careful handling of HP callbacks

_[Pending]_

---

## Integration Phase

_[Pending]_

---

## Process Improvements

_[Pending]_

---

## Key Learnings

_[Will be updated throughout project]_

---

## Metrics Tracking

| Metric | Baseline | Target | Current | Status |
|--------|----------|--------|---------|--------|
| MainLayout.tsx LOC | 795 | <200 | 795 | 🔴 Not Started |
| TopPanelLayout.tsx LOC | N/A | <350 | N/A | ⚪ Not Started |
| CenterCanvasLayout.tsx LOC | N/A | <350 | N/A | ⚪ Not Started |
| FloatingPanelsLayout.tsx LOC | N/A | <350 | N/A | ⚪ Not Started |
| BottomPanelLayout.tsx LOC | N/A | <350 | N/A | ⚪ Not Started |
| Total LOC Reduction | 0 | 75% | 0% | 🔴 Not Started |
| Tests Passing | ✅ | ✅ | ✅ | 🟢 Baseline |
| Baseline Violations | 1 | 0 | 1 | 🔴 Not Started |

---

**Document Version:** 1.0
**Last Updated:** 2025-10-21
