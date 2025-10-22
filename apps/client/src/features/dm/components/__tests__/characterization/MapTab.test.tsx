/**
 * Characterization tests for MapTab component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:219-272
 * Target: apps/client/src/features/dm/components/map-controls/MapTab.tsx
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock the imports with inline factory functions (must be defined before import)
vi.mock("../../map-controls/MapBackgroundControl", () => ({
  MapBackgroundControl: vi.fn(({ mapBackground, onSetMapBackground }) => (
    <div data-component="MapBackgroundControl">
      <span>MapBackground: {mapBackground ?? "none"}</span>
      <button onClick={() => onSetMapBackground("test-url")}>Set Background</button>
    </div>
  )),
}));

vi.mock("../../map-controls/MapTransformControl", () => ({
  MapTransformControl: vi.fn(
    ({ mapTransform, mapLocked, onMapTransformChange, onMapLockToggle }) => (
      <div data-component="MapTransformControl">
        <span>MapLocked: {String(mapLocked)}</span>
        <span>Transform: {JSON.stringify(mapTransform)}</span>
        <button
          onClick={() =>
            onMapTransformChange({
              scaleX: 1,
              scaleY: 1,
              x: 0,
              y: 0,
              rotation: 0,
            })
          }
        >
          Change Transform
        </button>
        <button onClick={onMapLockToggle}>Toggle Lock</button>
      </div>
    ),
  ),
}));

vi.mock("../../map-controls/GridControl", () => ({
  GridControl: vi.fn(
    ({
      gridSize,
      gridSquareSize,
      gridLocked,
      onGridSizeChange,
      onGridSquareSizeChange,
      onGridLockToggle,
    }) => (
      <div data-component="GridControl">
        <span>GridSize: {gridSize}</span>
        <span>GridSquareSize: {gridSquareSize ?? "default"}</span>
        <span>GridLocked: {String(gridLocked)}</span>
        <button onClick={() => onGridSizeChange(100)}>Change Grid Size</button>
        <button onClick={() => onGridSquareSizeChange?.(10)}>Change Square Size</button>
        <button onClick={onGridLockToggle}>Toggle Grid Lock</button>
      </div>
    ),
  ),
}));

vi.mock("../../map-controls/GridAlignmentWizard", () => ({
  GridAlignmentWizard: vi.fn(
    ({
      alignmentModeActive,
      alignmentPoints,
      alignmentSuggestion,
      alignmentError,
      gridLocked,
      mapLocked,
      onAlignmentStart,
      onAlignmentReset,
      onAlignmentCancel,
      onAlignmentApply,
    }) => (
      <div data-component="GridAlignmentWizard">
        <span>AlignmentActive: {String(alignmentModeActive)}</span>
        <span>AlignmentPoints: {alignmentPoints.length}</span>
        <span>AlignmentSuggestion: {alignmentSuggestion ? "yes" : "no"}</span>
        <span>AlignmentError: {alignmentError ?? "none"}</span>
        <span>GridLocked: {String(gridLocked)}</span>
        <span>MapLocked: {String(mapLocked)}</span>
        <button onClick={onAlignmentStart}>Start Alignment</button>
        <button onClick={onAlignmentReset}>Reset Alignment</button>
        <button onClick={onAlignmentCancel}>Cancel Alignment</button>
        <button onClick={onAlignmentApply}>Apply Alignment</button>
      </div>
    ),
  ),
}));

vi.mock("../../map-controls/StagingZoneControl", () => ({
  StagingZoneControl: vi.fn(
    ({
      playerStagingZone,
      camera,
      gridSize,
      stagingZoneLocked,
      onStagingZoneLockToggle,
      onSetPlayerStagingZone,
    }) => (
      <div data-component="StagingZoneControl">
        <span>StagingZone: {playerStagingZone ? "defined" : "undefined"}</span>
        <span>Camera: {JSON.stringify(camera)}</span>
        <span>GridSize: {gridSize}</span>
        <span>StagingZoneLocked: {String(stagingZoneLocked)}</span>
        <button onClick={onStagingZoneLockToggle}>Toggle Staging Lock</button>
        <button
          onClick={() =>
            onSetPlayerStagingZone({
              x: 0,
              y: 0,
              width: 100,
              height: 100,
            })
          }
        >
          Set Staging Zone
        </button>
      </div>
    ),
  ),
}));

vi.mock("../../map-controls/DrawingControls", () => ({
  DrawingControls: vi.fn(({ onClearDrawings }) => (
    <div data-component="DrawingControls">
      <button onClick={onClearDrawings}>Clear All Drawings</button>
    </div>
  )),
}));

import MapTab from "../../tab-views/MapTab";
import type { MapTabProps } from "../../tab-views/MapTab";
import { MapBackgroundControl } from "../../map-controls/MapBackgroundControl";
import { MapTransformControl } from "../../map-controls/MapTransformControl";
import { GridControl } from "../../map-controls/GridControl";
import { GridAlignmentWizard } from "../../map-controls/GridAlignmentWizard";
import { StagingZoneControl } from "../../map-controls/StagingZoneControl";
import { DrawingControls } from "../../map-controls/DrawingControls";

// ============================================================================
// TESTS
// ============================================================================

describe("MapTab - Characterization Tests", () => {
  const createMockProps = (): MapTabProps => ({
    mapBackground: undefined,
    onSetMapBackground: vi.fn(),
    onMapLockToggle: vi.fn(),
    onMapTransformChange: vi.fn(),
    mapTransform: {
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
      rotation: 0,
    },
    mapLocked: false,
    gridSize: 50,
    gridSquareSize: 5,
    gridLocked: false,
    onGridSizeChange: vi.fn(),
    onGridSquareSizeChange: vi.fn(),
    onGridLockToggle: vi.fn(),
    alignmentModeActive: false,
    alignmentPoints: [],
    alignmentSuggestion: null,
    alignmentError: null,
    onAlignmentStart: vi.fn(),
    onAlignmentReset: vi.fn(),
    onAlignmentCancel: vi.fn(),
    onAlignmentApply: vi.fn(),
    playerStagingZone: undefined,
    camera: {
      x: 0,
      y: 0,
      scale: 1,
    },
    stagingZoneLocked: false,
    onStagingZoneLockToggle: vi.fn(),
    onSetPlayerStagingZone: vi.fn(),
    onClearDrawings: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Rendering", () => {
    it("should render all child components in correct order", () => {
      const props = createMockProps();
      const { container } = render(<MapTab {...props} />);

      const components = Array.from(container.querySelectorAll("[data-component]")).map((el) =>
        el.getAttribute("data-component"),
      );

      expect(components).toEqual([
        "MapBackgroundControl",
        "MapTransformControl",
        "GridControl",
        "GridAlignmentWizard",
        "StagingZoneControl",
        "DrawingControls",
      ]);
    });

    it("should render MapBackgroundControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(screen.getByText(/MapBackground:/)).toBeInTheDocument();
      expect(MapBackgroundControl).toHaveBeenCalledTimes(1);
    });

    it("should render MapTransformControl when all required props are provided", () => {
      const props = createMockProps();
      const { container } = render(<MapTab {...props} />);

      const mapTransformControl = container.querySelector('[data-component="MapTransformControl"]');
      expect(mapTransformControl).toBeInTheDocument();
      expect(MapTransformControl).toHaveBeenCalledTimes(1);
    });

    it("should render GridControl", () => {
      const props = createMockProps();
      const { container } = render(<MapTab {...props} />);

      const gridControl = container.querySelector('[data-component="GridControl"]');
      expect(gridControl).toBeInTheDocument();
      expect(GridControl).toHaveBeenCalledTimes(1);
    });

    it("should render GridAlignmentWizard", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(screen.getByText(/AlignmentActive:/)).toBeInTheDocument();
      expect(GridAlignmentWizard).toHaveBeenCalledTimes(1);
    });

    it("should render StagingZoneControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(screen.getByText(/StagingZone:/)).toBeInTheDocument();
      expect(StagingZoneControl).toHaveBeenCalledTimes(1);
    });

    it("should render DrawingControls", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(screen.getByRole("button", { name: "Clear All Drawings" })).toBeInTheDocument();
      expect(DrawingControls).toHaveBeenCalledTimes(1);
    });

    it("should render with flexbox container styling", () => {
      const props = createMockProps();
      const { container } = render(<MapTab {...props} />);

      const wrapper = container.querySelector("div");
      expect(wrapper).toHaveStyle({
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      });
    });
  });

  describe("MapBackgroundControl Props", () => {
    it("should pass mapBackground prop to MapBackgroundControl", () => {
      const props = createMockProps();
      props.mapBackground = "https://example.com/map.jpg";
      render(<MapTab {...props} />);

      expect(MapBackgroundControl).toHaveBeenCalledWith(
        expect.objectContaining({
          mapBackground: "https://example.com/map.jpg",
        }),
        expect.anything(),
      );
    });

    it("should pass undefined mapBackground to MapBackgroundControl", () => {
      const props = createMockProps();
      props.mapBackground = undefined;
      render(<MapTab {...props} />);

      expect(MapBackgroundControl).toHaveBeenCalledWith(
        expect.objectContaining({
          mapBackground: undefined,
        }),
        expect.anything(),
      );
    });

    it("should pass onSetMapBackground handler to MapBackgroundControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(MapBackgroundControl).toHaveBeenCalledWith(
        expect.objectContaining({
          onSetMapBackground: props.onSetMapBackground,
        }),
        expect.anything(),
      );
    });
  });

  describe("MapTransformControl Conditional Rendering", () => {
    it("should render MapTransformControl when all required props are present", () => {
      const props = createMockProps();
      const { container } = render(<MapTab {...props} />);

      const mapTransformControl = container.querySelector('[data-component="MapTransformControl"]');
      expect(mapTransformControl).toBeInTheDocument();
      expect(MapTransformControl).toHaveBeenCalledTimes(1);
    });

    it("should not render MapTransformControl when onMapLockToggle is undefined", () => {
      const props = createMockProps();
      props.onMapLockToggle = undefined;
      const { container } = render(<MapTab {...props} />);

      const mapTransformControl = container.querySelector('[data-component="MapTransformControl"]');
      expect(mapTransformControl).not.toBeInTheDocument();
      expect(MapTransformControl).not.toHaveBeenCalled();
    });

    it("should not render MapTransformControl when onMapTransformChange is undefined", () => {
      const props = createMockProps();
      props.onMapTransformChange = undefined;
      const { container } = render(<MapTab {...props} />);

      const mapTransformControl = container.querySelector('[data-component="MapTransformControl"]');
      expect(mapTransformControl).not.toBeInTheDocument();
      expect(MapTransformControl).not.toHaveBeenCalled();
    });

    it("should not render MapTransformControl when mapTransform is undefined", () => {
      const props = createMockProps();
      props.mapTransform = undefined;
      const { container } = render(<MapTab {...props} />);

      const mapTransformControl = container.querySelector('[data-component="MapTransformControl"]');
      expect(mapTransformControl).not.toBeInTheDocument();
      expect(MapTransformControl).not.toHaveBeenCalled();
    });

    it("should not render MapTransformControl when multiple required props are undefined", () => {
      const props = createMockProps();
      props.onMapLockToggle = undefined;
      props.onMapTransformChange = undefined;
      const { container } = render(<MapTab {...props} />);

      const mapTransformControl = container.querySelector('[data-component="MapTransformControl"]');
      expect(mapTransformControl).not.toBeInTheDocument();
      expect(MapTransformControl).not.toHaveBeenCalled();
    });
  });

  describe("MapTransformControl Props", () => {
    it("should pass mapTransform prop to MapTransformControl", () => {
      const props = createMockProps();
      props.mapTransform = {
        scaleX: 2,
        scaleY: 2,
        x: 100,
        y: 200,
        rotation: 45,
      };
      render(<MapTab {...props} />);

      expect(MapTransformControl).toHaveBeenCalledWith(
        expect.objectContaining({
          mapTransform: {
            scaleX: 2,
            scaleY: 2,
            x: 100,
            y: 200,
            rotation: 45,
          },
        }),
        expect.anything(),
      );
    });

    it("should pass mapLocked prop to MapTransformControl", () => {
      const props = createMockProps();
      props.mapLocked = true;
      render(<MapTab {...props} />);

      expect(MapTransformControl).toHaveBeenCalledWith(
        expect.objectContaining({
          mapLocked: true,
        }),
        expect.anything(),
      );
    });

    it("should default mapLocked to false when undefined", () => {
      const props = createMockProps();
      props.mapLocked = undefined;
      render(<MapTab {...props} />);

      expect(MapTransformControl).toHaveBeenCalledWith(
        expect.objectContaining({
          mapLocked: false,
        }),
        expect.anything(),
      );
    });

    it("should pass onMapTransformChange handler to MapTransformControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(MapTransformControl).toHaveBeenCalledWith(
        expect.objectContaining({
          onMapTransformChange: props.onMapTransformChange,
        }),
        expect.anything(),
      );
    });

    it("should pass onMapLockToggle handler to MapTransformControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(MapTransformControl).toHaveBeenCalledWith(
        expect.objectContaining({
          onMapLockToggle: props.onMapLockToggle,
        }),
        expect.anything(),
      );
    });
  });

  describe("GridControl Props", () => {
    it("should pass gridSize prop to GridControl", () => {
      const props = createMockProps();
      props.gridSize = 100;
      render(<MapTab {...props} />);

      expect(GridControl).toHaveBeenCalledWith(
        expect.objectContaining({
          gridSize: 100,
        }),
        expect.anything(),
      );
    });

    it("should pass gridSquareSize prop to GridControl", () => {
      const props = createMockProps();
      props.gridSquareSize = 10;
      render(<MapTab {...props} />);

      expect(GridControl).toHaveBeenCalledWith(
        expect.objectContaining({
          gridSquareSize: 10,
        }),
        expect.anything(),
      );
    });

    it("should pass gridLocked prop to GridControl", () => {
      const props = createMockProps();
      props.gridLocked = true;
      render(<MapTab {...props} />);

      expect(GridControl).toHaveBeenCalledWith(
        expect.objectContaining({
          gridLocked: true,
        }),
        expect.anything(),
      );
    });

    it("should pass onGridSizeChange handler to GridControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(GridControl).toHaveBeenCalledWith(
        expect.objectContaining({
          onGridSizeChange: props.onGridSizeChange,
        }),
        expect.anything(),
      );
    });

    it("should pass onGridSquareSizeChange handler to GridControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(GridControl).toHaveBeenCalledWith(
        expect.objectContaining({
          onGridSquareSizeChange: props.onGridSquareSizeChange,
        }),
        expect.anything(),
      );
    });

    it("should pass onGridLockToggle handler to GridControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(GridControl).toHaveBeenCalledWith(
        expect.objectContaining({
          onGridLockToggle: props.onGridLockToggle,
        }),
        expect.anything(),
      );
    });
  });

  describe("GridAlignmentWizard Props", () => {
    it("should pass alignmentModeActive prop to GridAlignmentWizard", () => {
      const props = createMockProps();
      props.alignmentModeActive = true;
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          alignmentModeActive: true,
        }),
        expect.anything(),
      );
    });

    it("should pass alignmentPoints prop to GridAlignmentWizard", () => {
      const props = createMockProps();
      props.alignmentPoints = [
        { index: 0, cellX: 0, cellY: 0, canvasX: 100, canvasY: 100 },
        { index: 1, cellX: 5, cellY: 5, canvasX: 350, canvasY: 350 },
      ];
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          alignmentPoints: [
            { index: 0, cellX: 0, cellY: 0, canvasX: 100, canvasY: 100 },
            { index: 1, cellX: 5, cellY: 5, canvasX: 350, canvasY: 350 },
          ],
        }),
        expect.anything(),
      );
    });

    it("should pass alignmentSuggestion prop to GridAlignmentWizard", () => {
      const props = createMockProps();
      props.alignmentSuggestion = {
        gridSize: 50,
        gridOffsetX: 10,
        gridOffsetY: 20,
      };
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          alignmentSuggestion: {
            gridSize: 50,
            gridOffsetX: 10,
            gridOffsetY: 20,
          },
        }),
        expect.anything(),
      );
    });

    it("should pass null alignmentSuggestion to GridAlignmentWizard", () => {
      const props = createMockProps();
      props.alignmentSuggestion = null;
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          alignmentSuggestion: null,
        }),
        expect.anything(),
      );
    });

    it("should pass alignmentError prop to GridAlignmentWizard", () => {
      const props = createMockProps();
      props.alignmentError = "Not enough points";
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          alignmentError: "Not enough points",
        }),
        expect.anything(),
      );
    });

    it("should pass gridLocked prop to GridAlignmentWizard", () => {
      const props = createMockProps();
      props.gridLocked = true;
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          gridLocked: true,
        }),
        expect.anything(),
      );
    });

    it("should pass mapLocked prop to GridAlignmentWizard", () => {
      const props = createMockProps();
      props.mapLocked = true;
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          mapLocked: true,
        }),
        expect.anything(),
      );
    });

    it("should pass onAlignmentStart handler to GridAlignmentWizard", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          onAlignmentStart: props.onAlignmentStart,
        }),
        expect.anything(),
      );
    });

    it("should pass onAlignmentReset handler to GridAlignmentWizard", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          onAlignmentReset: props.onAlignmentReset,
        }),
        expect.anything(),
      );
    });

    it("should pass onAlignmentCancel handler to GridAlignmentWizard", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          onAlignmentCancel: props.onAlignmentCancel,
        }),
        expect.anything(),
      );
    });

    it("should pass onAlignmentApply handler to GridAlignmentWizard", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          onAlignmentApply: props.onAlignmentApply,
        }),
        expect.anything(),
      );
    });
  });

  describe("StagingZoneControl Props", () => {
    it("should pass playerStagingZone prop to StagingZoneControl", () => {
      const props = createMockProps();
      props.playerStagingZone = {
        x: 100,
        y: 200,
        width: 300,
        height: 400,
        rotation: 45,
      };
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          playerStagingZone: {
            x: 100,
            y: 200,
            width: 300,
            height: 400,
            rotation: 45,
          },
        }),
        expect.anything(),
      );
    });

    it("should pass undefined playerStagingZone to StagingZoneControl", () => {
      const props = createMockProps();
      props.playerStagingZone = undefined;
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          playerStagingZone: undefined,
        }),
        expect.anything(),
      );
    });

    it("should pass camera prop to StagingZoneControl", () => {
      const props = createMockProps();
      props.camera = {
        x: 100,
        y: 200,
        scale: 1.5,
      };
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          camera: {
            x: 100,
            y: 200,
            scale: 1.5,
          },
        }),
        expect.anything(),
      );
    });

    it("should pass gridSize prop to StagingZoneControl", () => {
      const props = createMockProps();
      props.gridSize = 75;
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          gridSize: 75,
        }),
        expect.anything(),
      );
    });

    it("should pass stagingZoneLocked prop to StagingZoneControl", () => {
      const props = createMockProps();
      props.stagingZoneLocked = true;
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          stagingZoneLocked: true,
        }),
        expect.anything(),
      );
    });

    it("should default stagingZoneLocked to false when undefined", () => {
      const props = createMockProps();
      props.stagingZoneLocked = undefined;
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          stagingZoneLocked: false,
        }),
        expect.anything(),
      );
    });

    it("should pass onStagingZoneLockToggle handler to StagingZoneControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          onStagingZoneLockToggle: props.onStagingZoneLockToggle,
        }),
        expect.anything(),
      );
    });

    it("should pass onSetPlayerStagingZone handler to StagingZoneControl", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          onSetPlayerStagingZone: props.onSetPlayerStagingZone,
        }),
        expect.anything(),
      );
    });
  });

  describe("DrawingControls Props", () => {
    it("should pass onClearDrawings handler to DrawingControls", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(DrawingControls).toHaveBeenCalledWith(
        expect.objectContaining({
          onClearDrawings: props.onClearDrawings,
        }),
        expect.anything(),
      );
    });
  });

  describe("Component Composition", () => {
    it("should render exactly 6 child components with all required props", () => {
      const props = createMockProps();
      render(<MapTab {...props} />);

      expect(MapBackgroundControl).toHaveBeenCalledTimes(1);
      expect(MapTransformControl).toHaveBeenCalledTimes(1);
      expect(GridControl).toHaveBeenCalledTimes(1);
      expect(GridAlignmentWizard).toHaveBeenCalledTimes(1);
      expect(StagingZoneControl).toHaveBeenCalledTimes(1);
      expect(DrawingControls).toHaveBeenCalledTimes(1);
    });

    it("should render exactly 5 child components when MapTransformControl is not rendered", () => {
      const props = createMockProps();
      props.onMapLockToggle = undefined;
      render(<MapTab {...props} />);

      expect(MapBackgroundControl).toHaveBeenCalledTimes(1);
      expect(MapTransformControl).not.toHaveBeenCalled();
      expect(GridControl).toHaveBeenCalledTimes(1);
      expect(GridAlignmentWizard).toHaveBeenCalledTimes(1);
      expect(StagingZoneControl).toHaveBeenCalledTimes(1);
      expect(DrawingControls).toHaveBeenCalledTimes(1);
    });
  });

  describe("Props Updates", () => {
    it("should update MapBackgroundControl when mapBackground prop changes", () => {
      const props = createMockProps();
      const { rerender } = render(<MapTab {...props} />);

      expect(MapBackgroundControl).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mapBackground: undefined,
        }),
        expect.anything(),
      );

      rerender(<MapTab {...props} mapBackground="https://example.com/new-map.jpg" />);

      expect(MapBackgroundControl).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mapBackground: "https://example.com/new-map.jpg",
        }),
        expect.anything(),
      );
    });

    it("should update GridControl when gridSize prop changes", () => {
      const props = createMockProps();
      const { rerender } = render(<MapTab {...props} />);

      expect(GridControl).toHaveBeenLastCalledWith(
        expect.objectContaining({
          gridSize: 50,
        }),
        expect.anything(),
      );

      rerender(<MapTab {...props} gridSize={100} />);

      expect(GridControl).toHaveBeenLastCalledWith(
        expect.objectContaining({
          gridSize: 100,
        }),
        expect.anything(),
      );
    });

    it("should show MapTransformControl when required props become available", () => {
      const props = createMockProps();
      props.onMapLockToggle = undefined;
      const { rerender, container } = render(<MapTab {...props} />);

      expect(MapTransformControl).not.toHaveBeenCalled();

      rerender(<MapTab {...props} onMapLockToggle={vi.fn()} />);

      expect(MapTransformControl).toHaveBeenCalledTimes(1);
      const mapTransformControl = container.querySelector('[data-component="MapTransformControl"]');
      expect(mapTransformControl).toBeInTheDocument();
    });

    it("should hide MapTransformControl when required props become unavailable", () => {
      const props = createMockProps();
      const { rerender, container } = render(<MapTab {...props} />);

      expect(MapTransformControl).toHaveBeenCalledTimes(1);

      rerender(<MapTab {...props} onMapLockToggle={undefined} />);

      // Still only called once (from initial render)
      expect(MapTransformControl).toHaveBeenCalledTimes(1);
      const mapTransformControl = container.querySelector('[data-component="MapTransformControl"]');
      expect(mapTransformControl).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty alignmentPoints array", () => {
      const props = createMockProps();
      props.alignmentPoints = [];
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          alignmentPoints: [],
        }),
        expect.anything(),
      );
    });

    it("should handle multiple alignmentPoints", () => {
      const props = createMockProps();
      props.alignmentPoints = [
        { index: 0, cellX: 0, cellY: 0, canvasX: 100, canvasY: 100 },
        { index: 1, cellX: 5, cellY: 5, canvasX: 350, canvasY: 350 },
        { index: 2, cellX: 10, cellY: 10, canvasX: 600, canvasY: 600 },
      ];
      render(<MapTab {...props} />);

      expect(GridAlignmentWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          alignmentPoints: expect.arrayContaining([
            expect.objectContaining({ index: 0 }),
            expect.objectContaining({ index: 1 }),
            expect.objectContaining({ index: 2 }),
          ]),
        }),
        expect.anything(),
      );
    });

    it("should handle zero gridSize", () => {
      const props = createMockProps();
      props.gridSize = 0;
      render(<MapTab {...props} />);

      expect(GridControl).toHaveBeenCalledWith(
        expect.objectContaining({
          gridSize: 0,
        }),
        expect.anything(),
      );
    });

    it("should handle negative camera coordinates", () => {
      const props = createMockProps();
      props.camera = {
        x: -100,
        y: -200,
        scale: 0.5,
      };
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          camera: {
            x: -100,
            y: -200,
            scale: 0.5,
          },
        }),
        expect.anything(),
      );
    });

    it("should handle playerStagingZone without rotation", () => {
      const props = createMockProps();
      props.playerStagingZone = {
        x: 100,
        y: 200,
        width: 300,
        height: 400,
      };
      render(<MapTab {...props} />);

      expect(StagingZoneControl).toHaveBeenCalledWith(
        expect.objectContaining({
          playerStagingZone: {
            x: 100,
            y: 200,
            width: 300,
            height: 400,
          },
        }),
        expect.anything(),
      );
    });

    it("should handle all optional handlers being undefined", () => {
      const props = createMockProps();
      props.onMapLockToggle = undefined;
      props.onMapTransformChange = undefined;
      props.onGridSquareSizeChange = undefined;
      props.onStagingZoneLockToggle = undefined;

      render(<MapTab {...props} />);

      // Should still render without MapTransformControl
      expect(MapBackgroundControl).toHaveBeenCalledTimes(1);
      expect(MapTransformControl).not.toHaveBeenCalled();
      expect(GridControl).toHaveBeenCalledTimes(1);
      expect(GridAlignmentWizard).toHaveBeenCalledTimes(1);
      expect(StagingZoneControl).toHaveBeenCalledTimes(1);
      expect(DrawingControls).toHaveBeenCalledTimes(1);
    });
  });
});
