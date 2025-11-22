/**
 * Basic tests for MapBoard component
 *
 * Tests the main VTT canvas component, focusing on:
 * - Basic rendering with minimal props
 * - Rendering with snapshot data
 * - Tool mode prop handling
 *
 * Source: apps/client/src/ui/MapBoard.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { forwardRef } from "react";
import type { ReactNode, Ref } from "react";
import MapBoard from "../MapBoard";
import type { RoomSnapshot } from "@shared";
import type { MapBoardProps } from "../MapBoard.types";

interface MockComponentProps {
  children?: ReactNode;
  [key: string]: unknown;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref && typeof ref === "object") {
    (ref as { current: T | null }).current = value;
  }
}

function createKonvaMock(
  testId: string,
  options: { omitProps?: string[] } = {},
) {
  return forwardRef<HTMLDivElement, MockComponentProps>(({ children, ...props }, ref) => {
    const safeProps = { ...props };
    for (const key of options.omitProps ?? []) {
      delete safeProps[key];
    }

    return (
      <div
        data-testid={testId}
        ref={(node) => assignRef(ref, node)}
        {...safeProps}
      >
        {children}
      </div>
    );
  });
}

// Mock Konva components
vi.mock("react-konva", () => ({
  Stage: createKonvaMock("konva-stage"),
  Layer: createKonvaMock("konva-layer", { omitProps: ["listening"] }),
}));

// Mock all the layer components
vi.mock("../../features/map/components", () => ({
  GridLayer: () => <div data-testid="grid-layer" />,
  MapImageLayer: () => <div data-testid="map-image-layer" />,
  TokensLayer: () => <div data-testid="tokens-layer" />,
  PointersLayer: () => <div data-testid="pointers-layer" />,
  DrawingsLayer: () => <div data-testid="drawings-layer" />,
  MeasureLayer: () => <div data-testid="measure-layer" />,
  TransformGizmo: () => <div data-testid="transform-gizmo" />,
  PropsLayer: () => <div data-testid="props-layer" />,
  StagingZoneLayer: () => <div data-testid="staging-zone-layer" />,
  AlignmentOverlay: () => <div data-testid="alignment-overlay" />,
  AlignmentInstructionOverlay: () => <div data-testid="alignment-instruction-overlay" />,
  MarqueeOverlay: () => <div data-testid="marquee-overlay" />,
}));

// Mock all the hooks
vi.mock("../hooks/usePointerTool", () => ({
  usePointerTool: () => ({}),
}));

vi.mock("../hooks/useDrawingTool", () => ({
  useDrawingTool: () => ({}),
}));

vi.mock("../hooks/useDrawingSelection", () => ({
  useDrawingSelection: () => ({ selectedDrawingId: null }),
}));

vi.mock("../hooks/useElementSize", () => ({
  useElementSize: () => ({ width: 800, height: 600 }),
}));

vi.mock("../hooks/useGridConfig", () => ({
  useGridConfig: () => ({ gridSize: 50, snapToGrid: true }),
}));

vi.mock("../hooks/useCursorStyle", () => ({
  useCursorStyle: () => "default",
}));

vi.mock("../hooks/useSceneObjectsData", () => ({
  useSceneObjectsData: () => ({
    tokens: [],
    drawings: [],
    props: [],
    sceneObjects: [],
    pointers: [],
  }),
}));

vi.mock("../hooks/useKonvaNodeRefs", () => ({
  useKonvaNodeRefs: () => ({
    stageRef: { current: null },
    tokenRefs: { current: {} },
    drawingRefs: { current: {} },
    propRefs: { current: {} },
  }),
}));

vi.mock("../hooks/useMarqueeSelection", () => ({
  useMarqueeSelection: () => ({
    marqueeBox: null,
  }),
}));

vi.mock("../hooks/useKeyboardNavigation", () => ({
  useKeyboardNavigation: () => ({}),
}));

vi.mock("../hooks/useAlignmentVisualization", () => ({
  useAlignmentVisualization: () => ({
    overlayVisible: false,
    instructionOverlayVisible: false,
  }),
}));

vi.mock("../hooks/useObjectTransformHandlers", () => ({
  useObjectTransformHandlers: () => ({
    handleTransformEnd: vi.fn(),
  }),
}));

vi.mock("../hooks/useCameraControl", () => ({
  useCameraControl: () => ({
    camera: { x: 0, y: 0, scale: 1 },
  }),
}));

vi.mock("../hooks/useTransformGizmoIntegration", () => ({
  useTransformGizmoIntegration: () => ({
    transformerProps: {},
  }),
}));

vi.mock("../hooks/useStageEventRouter", () => ({
  useStageEventRouter: () => ({
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleMouseUp: vi.fn(),
    handleWheel: vi.fn(),
  }),
}));

vi.mock("../utils/useE2ETestingSupport", () => ({
  useE2ETestingSupport: () => ({}),
}));

describe("MapBoard", () => {
  const mockSendMessage = vi.fn();
  const mockOnRecolorToken = vi.fn();
  const mockOnTransformObject = vi.fn();
  const mockOnCameraCommandHandled = vi.fn();
  const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

  const getDefaultProps = (overrides?: Partial<MapBoardProps>): MapBoardProps => ({
    snapshot: null,
    sendMessage: mockSendMessage,
    uid: "test-user",
    gridSize: 50,
    snapToGrid: true,
    pointerMode: false,
    measureMode: false,
    drawMode: false,
    transformMode: false,
    selectMode: false,
    isDM: false,
    alignmentMode: false,
    drawTool: "freehand",
    drawColor: "#000000",
    drawWidth: 3,
    drawOpacity: 1,
    drawFilled: false,
    onRecolorToken: mockOnRecolorToken,
    onTransformObject: mockOnTransformObject,
    cameraCommand: null,
    onCameraCommandHandled: mockOnCameraCommandHandled,
    ...overrides,
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  describe("Basic Rendering", () => {
    it("should render without crashing with minimal props", () => {
      const props = getDefaultProps();
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render Konva Stage", () => {
      const props = getDefaultProps();
      const { getByTestId } = render(<MapBoard {...props} />);

      expect(getByTestId("konva-stage")).toBeInTheDocument();
    });

    it("should render with null snapshot", () => {
      const props = getDefaultProps({ snapshot: null });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render with empty snapshot", () => {
      const emptySnapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "",
        players: [],
        characters: [],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      const props = getDefaultProps({ snapshot: emptySnapshot });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });
  });

  describe("Tool Modes", () => {
    it("should render in pointer mode", () => {
      const props = getDefaultProps({ pointerMode: true });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render in measure mode", () => {
      const props = getDefaultProps({ measureMode: true });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render in draw mode", () => {
      const props = getDefaultProps({ drawMode: true });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render in transform mode", () => {
      const props = getDefaultProps({ transformMode: true });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render in select mode", () => {
      const props = getDefaultProps({ selectMode: true });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render in alignment mode", () => {
      const props = getDefaultProps({ alignmentMode: true });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });
  });

  describe("DM Mode", () => {
    it("should render in DM mode", () => {
      const props = getDefaultProps({ isDM: true });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render in player mode", () => {
      const props = getDefaultProps({ isDM: false });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });
  });

  describe("Drawing Tools", () => {
    const drawingTools = ["freehand", "line", "rect", "circle", "eraser"] as const;

    drawingTools.forEach((tool) => {
      it(`should render with ${tool} drawing tool`, () => {
        const props = getDefaultProps({ drawTool: tool, drawMode: true });
        const { container } = render(<MapBoard {...props} />);

        expect(container).toBeTruthy();
      });
    });
  });

  describe("Grid Configuration", () => {
    it("should render with custom grid size", () => {
      const props = getDefaultProps({ gridSize: 100 });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render with snap to grid enabled", () => {
      const props = getDefaultProps({ snapToGrid: true });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render with snap to grid disabled", () => {
      const props = getDefaultProps({ snapToGrid: false });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });
  });

  describe("Selection Handling", () => {
    it("should render with selectedObjectId", () => {
      const props = getDefaultProps({ selectedObjectId: "token-1" });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render with multiple selectedObjectIds", () => {
      const props = getDefaultProps({ selectedObjectIds: ["token-1", "token-2"] });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render with empty selection", () => {
      const props = getDefaultProps({ selectedObjectId: null, selectedObjectIds: [] });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });
  });

  describe("Camera Commands", () => {
    it("should render with focus-token camera command", () => {
      const props = getDefaultProps({
        cameraCommand: { type: "focus-token", tokenId: "token-1" },
      });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render with reset camera command", () => {
      const props = getDefaultProps({
        cameraCommand: { type: "reset" },
      });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });

    it("should render with no camera command", () => {
      const props = getDefaultProps({ cameraCommand: null });
      const { container } = render(<MapBoard {...props} />);

      expect(container).toBeTruthy();
    });
  });
});
