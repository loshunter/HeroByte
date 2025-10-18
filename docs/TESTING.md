# HeroByte Testing Guide

## Overview

This guide covers manual and automated testing approaches for HeroByte, including using Chrome DevTools MCP for advanced browser automation.

## Testing Levels

### 1. Unit Tests (Vitest)
- **Location**: `packages/shared/__tests__/`, `apps/server/src/**/__tests__/`
- **Coverage**: 80.99% overall, 99.57% on shared package
- **Run**: `pnpm test` or `pnpm test:coverage`

### 2. Integration Tests (Vitest + WebSocket)
- **Location**: `apps/server/src/**/__tests__/`
- **Coverage**: WebSocket lifecycle, message routing, validation, rate limiting
- **Run**: `pnpm --filter vtt-server test`

### 3. E2E Tests (Chrome DevTools MCP)
- **Status**: Recommended for Phase 14.5
- **Purpose**: Visual validation, multi-client sync, performance testing

---

## Chrome DevTools MCP Setup

### Prerequisites
- Node.js v20.19+
- Chrome browser installed
- Claude Code or compatible MCP client

### Installation

Add to your MCP client configuration (`.claude/mcp.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

### Available Tools

The chrome-devtools MCP server provides 26+ tools across 6 categories:

1. **Input Automation**
   - Click elements
   - Fill forms
   - Drag and drop
   - Handle dialogs
   - Upload files

2. **Navigation**
   - Open/close pages
   - Navigate history
   - Wait for elements/network

3. **Performance**
   - Record traces
   - Analyze metrics
   - Memory profiling

4. **Debugging**
   - Take screenshots
   - Evaluate JavaScript
   - List console messages
   - Inspect elements

5. **Network**
   - Monitor requests
   - Analyze traffic
   - Emulate conditions

6. **Emulation**
   - Set viewport size
   - Emulate devices
   - Configure proxies

---

## Manual Testing Checklist

### Phase 14.5: Transform Gizmo Testing

#### Test 1: Map Transform Visual Validation
**Steps**:
1. Start server: `pnpm --filter herobyte-server start`
2. Start client: `pnpm --filter herobyte-client dev`
3. Open browser to `http://localhost:5174`
4. Join as DM
5. Upload a map image
6. Open DM Menu → Map Controls

**Validation**:
- [ ] Scale slider (0.1x - 3x) visually scales the map
- [ ] Rotation slider (0° - 360°) visually rotates the map
- [ ] Position X/Y inputs move the map
- [ ] Lock toggle prevents all transforms
- [ ] Reset button restores default transform

**Expected Behavior**:
- Map scales/rotates smoothly without flickering
- Transform persists across page refresh
- All clients see the same transform in real-time

---

#### Test 2: Transform Gizmo Visual Handles
**Steps**:
1. Select the map object (click on it)
2. Verify transform gizmo appears

**Validation**:
- [ ] Dashed blue bounding box appears (#447DF7)
- [ ] 8 resize handles visible (4 corners, 4 edges)
- [ ] Rotation handle visible (offset from corners)
- [ ] Handles have JRPG styling (blue fill, white stroke)
- [ ] Locked objects do NOT show gizmo

**Expected Behavior**:
- Gizmo appears immediately on selection
- ESC key deselects and hides gizmo
- Click empty space deselects

---

#### Test 3: Gizmo Drag Operations
**Steps**:
1. Select map object
2. Drag corner handle to resize
3. Drag rotation handle to rotate
4. Release handle

**Validation**:
- [ ] Corner drag scales map proportionally
- [ ] Edge drag scales in one direction only
- [ ] Rotation snaps to 45° increments
- [ ] Visual feedback during drag (cursor changes)
- [ ] Transform persists after release
- [ ] DM Menu values update to match gizmo

**Expected Behavior**:
- Smooth dragging with no lag
- Transform applies in real-time
- Server validates and broadcasts to all clients

---

#### Test 4: Token Transform Integration
**Steps**:
1. Create a player token
2. Click token to select it
3. Observe transform gizmo

**Validation**:
- [ ] Gizmo appears around token
- [ ] Scale handles work (0.1x - 10x limits)
- [ ] Rotation handles work
- [ ] Locked tokens show lock icon, no gizmo
- [ ] Token can still be dragged to move (position)

**Expected Behavior**:
- Gizmo deselects when token drag starts
- Token size setting + gizmo scale combine correctly
- Players can transform their own tokens (if unlocked)
- DM can transform any token

---

#### Test 5: Drawing Transform Integration
**Steps**:
1. Draw a freehand line or shape
2. Click drawing to select it
3. Observe transform gizmo

**Validation**:
- [ ] Gizmo appears around drawing
- [ ] Scale handles resize drawing
- [ ] Rotation handles rotate drawing
- [ ] Line/rect/circle/freehand all work
- [ ] Transform persists in scene graph

**Expected Behavior**:
- Drawings can be scaled and rotated
- Visual quality maintained (no pixelation)
- Undo/redo works with transforms

---

#### Test 6: Multi-Client Synchronization
**Steps**:
1. Open two browser windows (different browsers or incognito)
2. Join as DM in Window 1
3. Join as Player in Window 2
4. In Window 1: Select map, transform with gizmo
5. Observe Window 2

**Validation**:
- [ ] Window 2 sees transform in real-time
- [ ] Gizmo selection state syncs (both see selection)
- [ ] Transform handles sync across clients
- [ ] No visual artifacts or desyncs

**Expected Behavior**:
- <100ms latency for transform updates
- No conflicts when multiple users select objects
- Locked state respected on all clients

---

#### Test 7: Edge Cases
**Steps**:
1. Scale map to 0.1x (minimum)
2. Scale map to 10x (maximum)
3. Rotate 360° and beyond
4. Move map off-screen (negative X/Y)
5. Try to transform locked object

**Validation**:
- [ ] Min scale (0.1x) enforced, no smaller
- [ ] Max scale (10x) enforced, no larger
- [ ] Rotation wraps correctly (0°-360°)
- [ ] Off-screen objects still selectable
- [ ] Locked objects cannot be transformed

**Expected Behavior**:
- Server validation prevents invalid values
- UI shows helpful feedback for limits
- No crashes or corruption

---

#### Test 8: Performance Benchmarks
**Steps**:
1. Create a complex scene (map + 20 tokens + 50 drawings)
2. Select map and transform with gizmo
3. Monitor FPS and network traffic

**Validation**:
- [ ] FPS stays above 30 during transform
- [ ] No visible lag or stuttering
- [ ] Network traffic <10 KB/transform
- [ ] React.memo optimizations working (check DevTools)

**Expected Behavior**:
- Smooth 60 FPS on modern hardware
- Optimistic updates feel instant
- Server broadcasts efficiently

---

## Automated Testing with Chrome DevTools MCP

### Example Test Prompts

Once chrome-devtools MCP is configured, you can use AI-driven test prompts:

#### 1. Performance Test
```
Open http://localhost:5174 and record a performance trace while:
1. Uploading a map
2. Selecting the map
3. Dragging the gizmo handle to scale
4. Report FPS, memory usage, and network latency
```

#### 2. Visual Regression Test
```
Open http://localhost:5174 and:
1. Join as DM
2. Upload a map
3. Select the map
4. Take a screenshot showing the transform gizmo
5. Compare with baseline screenshot at docs/screenshots/transform-gizmo-baseline.png
```

#### 3. Multi-Client Sync Test
```
Open two tabs:
Tab 1: http://localhost:5174?user=dm
Tab 2: http://localhost:5174?user=player

In Tab 1:
1. Select map
2. Scale to 2x using gizmo

In Tab 2:
1. Take screenshot
2. Verify map is scaled to 2x
3. Report any visual differences
```

#### 4. Console Error Detection
```
Open http://localhost:5174 and:
1. Perform all transform gizmo operations
2. List all console errors and warnings
3. Report any React warnings or network errors
```

---

## Manual Test Execution

### Quick Smoke Test (5 minutes)
```bash
# Terminal 1: Start server
pnpm --filter herobyte-server start

# Terminal 2: Start client
pnpm --filter herobyte-client dev

# Browser: Open http://localhost:5174
# 1. Join as DM
# 2. Upload map
# 3. Select map → Verify gizmo appears
# 4. Drag corner → Verify scale works
# 5. ESC → Verify gizmo disappears
```

### Full Regression Test (30 minutes)
- Run all 8 test cases above
- Document results in `docs/test-results/phase-14.5.md`
- Take screenshots of key features
- Record video demo if possible

---

## Test Results Documentation

### Template

```markdown
# Phase 14.5 Test Results

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Environment**:
- OS: [Linux/Windows/Mac]
- Browser: [Chrome 131, Firefox 133, etc.]
- Node: v20.19.0

## Test Results

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| Test 1  | Map Transform Visual | ✅ PASS | All sliders work |
| Test 2  | Gizmo Visual Handles | ✅ PASS | JRPG styling correct |
| Test 3  | Gizmo Drag Operations | ⚠️ PARTIAL | Rotation snap not working |
| Test 4  | Token Transform | ✅ PASS | - |
| Test 5  | Drawing Transform | ✅ PASS | - |
| Test 6  | Multi-Client Sync | ✅ PASS | <50ms latency |
| Test 7  | Edge Cases | ❌ FAIL | Off-screen selection broken |
| Test 8  | Performance | ✅ PASS | 60 FPS maintained |

## Issues Found
1. **Rotation snap inconsistent** - Sometimes snaps to 30° instead of 45°
2. **Off-screen selection** - Objects with negative X/Y cannot be selected

## Recommendations
- Fix rotation snap logic in TransformGizmo.tsx
- Add bounding box check for off-screen selection
```

---

## Continuous Integration

### GitHub Actions (Existing)
```yaml
# .github/workflows/ci.yml already includes:
- Linting (eslint + prettier)
- Unit tests (vitest)
- Build validation
- Coverage reporting
```

### Future Enhancements
- [ ] Add Playwright E2E tests
- [ ] Add visual regression testing (Percy, Chromatic)
- [ ] Add performance budgets (Lighthouse CI)
- [ ] Add chrome-devtools MCP to CI pipeline

---

## Resources

- [Chrome DevTools MCP GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [HeroByte Architecture](./ARCHITECTURE.md) (if exists)

---

## Contributing

When adding new features:
1. Write tests FIRST (TDD methodology)
2. Achieve >80% code coverage
3. Run manual smoke tests
4. Document test cases in this file
5. Update CI if needed

**Test Philosophy**: Write tests that document behavior, catch regressions, and enable confident refactoring.
