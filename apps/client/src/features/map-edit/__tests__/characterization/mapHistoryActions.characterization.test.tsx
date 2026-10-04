import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapEditToolbar } from "../../MapEditToolbar";
import type { MapEditToolbarProps } from "../../mapEditTypes";
afterEach(cleanup);
const toolbar = (overrides: Record<string, unknown> = {}) =>
  ({
    isLive: true,
    busy: false,
    saving: false,
    activeSubTool: "wall",
    onSelectSubTool: vi.fn(),
    floorFamily: "stone-floor",
    onSelectFloorFamily: vi.fn(),
    roomWallFamily: "none",
    onSelectRoomWallFamily: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onStartLiveMap: vi.fn(),
    onClose: vi.fn(),
    hasRasterBackground: false,
    error: null,
    wallsOverlayPinned: false,
    onToggleWallsOverlay: vi.fn(),
    selectedAssetId: "objects:crate",
    onSelectAsset: vi.fn(),
    uploadAsset: vi.fn(),
    assetPickerOpen: false,
    onToggleAssetPicker: vi.fn(),
    hallwayWidth: 2,
    onSelectHallwayWidth: vi.fn(),
    terrainBrushSize: 1 as const,
    onSelectTerrainBrushSize: vi.fn(),
    splineKind: "rope",
    onSelectSplineKind: vi.fn(),
    populateDensity: "medium",
    onSelectPopulateDensity: vi.fn(),
    populateCategory: "objects",
    onSelectPopulateCategory: vi.fn(),
    onPopulate: vi.fn(),
    canPopulate: false,
    generateParams: { theme: "stone", density: "medium", seed: 1 },
    onGenerateParamsChange: vi.fn(),
    onRerollSeed: vi.fn(),
    onGenerate: vi.fn(),
    canGenerate: false,
    generateRegion: null,
    generateHint: null,
    layers: [],
    selectedElement: null,
    onUpdateLayer: vi.fn(),
    onMoveLayer: vi.fn(),
    onUpdateElement: vi.fn(),
    onUpdateDoor: vi.fn(),
    onRemoveElement: vi.fn(),
    layersOpen: false,
    onToggleLayers: vi.fn(),
    inspectorOpen: false,
    onToggleInspector: vi.fn(),
    ...overrides,
  }) as unknown as MapEditToolbarProps;

describe("map history action extraction", () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])("preserves availability and forwards exactly one action (%s/%s)", (canUndo, canRedo) => {
    const props = toolbar({ canUndo, canRedo });
    render(<MapEditToolbar {...props} />);
    const undo = screen.getByRole("button", { name: /Undo/ });
    const redo = screen.getByRole("button", { name: /Redo/ });
    expect(undo.hasAttribute("disabled")).toBe(!canUndo);
    expect(redo.hasAttribute("disabled")).toBe(!canRedo);
    fireEvent.click(undo);
    fireEvent.click(redo);
    expect(props.onUndo).toHaveBeenCalledTimes(canUndo ? 1 : 0);
    expect(props.onRedo).toHaveBeenCalledTimes(canRedo ? 1 : 0);
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
