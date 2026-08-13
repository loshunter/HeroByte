/**
 * The live palette's in-flight indicator.
 *
 * One assertion here is load-bearing and it is an ABSENCE: while `busy` is true
 * and `saving` is false, "saving…" must NOT be on screen.
 *
 * From M1 to M5 the header span rendered "saving…" off `busy`, which is the
 * create/open/BIND round trip. So the app's only in-flight label appeared while
 * a live map was being bound, and was absent during a map command — the window
 * in which useMapEditTool silently skips a finished drag. A present-only
 * assertion ("saving… shows when busy") passes happily against that bug, which
 * is why the negative is written out here rather than assumed.
 *
 * Source: apps/client/src/features/map-edit/MapEditToolbar.tsx
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MapEditToolbar } from "../MapEditToolbar";
import type { MapEditToolbarProps } from "../mapEditTypes";

afterEach(() => cleanup());

// The whole bag, cast — the idiom the other four MapEditToolbarProps suites
// already use. "wall" is deliberate: it arms no brush deck and no asset picker,
// so the header is the only moving part.
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

describe("the live palette's in-flight indicator", () => {
  it("says loading… while BINDING, and does not claim to be saving", () => {
    render(<MapEditToolbar {...toolbar({ busy: true })} />);

    expect(screen.getByText("● LIVE")).toBeVisible();
    expect(screen.getByText("loading…")).toBeVisible();
    // The bug, stated: this is what "saving…" off `busy` looked like.
    expect(screen.queryByText("saving…")).toBeNull();
  });

  it("says saving… while a map COMMAND is in flight — the window that eats gestures", () => {
    render(<MapEditToolbar {...toolbar({ saving: true })} />);

    expect(screen.getByText("saving…")).toBeVisible();
    expect(screen.queryByText("loading…")).toBeNull();
  });

  it("says neither when the controller is idle", () => {
    render(<MapEditToolbar {...toolbar()} />);

    expect(screen.getByText("● LIVE")).toBeVisible();
    expect(screen.queryByText("saving…")).toBeNull();
    expect(screen.queryByText("loading…")).toBeNull();
  });

  it("shows both when a command lands mid-bind, rather than picking one", () => {
    render(<MapEditToolbar {...toolbar({ busy: true, saving: true })} />);

    expect(screen.getByText("loading…")).toBeVisible();
    expect(screen.getByText("saving…")).toBeVisible();
  });
});
