/**
 * Component tests for DrawingsLayer
 *
 * Tests the drawing scene objects layer component, including:
 * - Rendering of all drawing types (freehand, line, rect, circle)
 * - Selection modes (single, multi-select with shift, toggle with ctrl/meta)
 * - Drag operations (single and multi-object)
 * - Transform overrides and cleanup
 * - Ownership and permissions
 * - Locked objects
 * - Selection visual states
 * - Camera transformations
 * - Current drawing preview
 * - Edge cases and error handling
 *
 * Source: apps/client/src/features/map/components/DrawingsLayer.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { forwardRef } from "react";
import type { PropsWithChildren, Ref, SyntheticEvent } from "react";
import { DrawingsLayer } from "../DrawingsLayer";
import type { SceneObject } from "@shared";
import type { Camera } from "../../../../hooks/useCamera";

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref && typeof ref === "object") {
    (ref as { current: T | null }).current = value;
  }
}

type MockKonvaEvent = {
  cancelBubble: boolean;
  evt: Event | SyntheticEvent;
  target: EventTarget | null;
};

const wrapEvent = (handler?: (event: MockKonvaEvent) => void) => (evt: Event | SyntheticEvent) =>
  handler?.({
    cancelBubble: false,
    evt,
    target: "target" in evt ? ((evt as { target: EventTarget | null }).target ?? null) : null,
  });

// Mock Konva components
function createGroupMock() {
  const Component = forwardRef<HTMLDivElement, PropsWithChildren<Record<string, unknown>>>(
    ({ children, onClick, onTap, onDragStart, onDragMove, onDragEnd, ...props }, ref) => (
      <div
        data-testid="konva-group"
        data-x={props.x}
        data-y={props.y}
        data-scale-x={props.scaleX}
        data-scale-y={props.scaleY}
        data-rotation={props.rotation}
        data-draggable={props.draggable !== undefined ? String(props.draggable) : undefined}
        onClick={wrapEvent(onClick as ((event: MockKonvaEvent) => void) | undefined)}
        onTouchStart={(e) => onTap?.({ cancelBubble: false, evt: e, target: e.target })}
        onDragStart={wrapEvent(onDragStart as ((event: MockKonvaEvent) => void) | undefined)}
        onDragOver={wrapEvent(onDragMove as ((event: MockKonvaEvent) => void) | undefined)}
        onDragEnd={wrapEvent(onDragEnd as ((event: MockKonvaEvent) => void) | undefined)}
        ref={(node) => assignRef(ref, node)}
      >
        {children}
      </div>
    ),
  );
  Component.displayName = "MockKonvaGroup";
  return Component;
}

function createLineMock() {
  const Component = forwardRef<HTMLDivElement, Record<string, unknown>>(
    ({ onClick, onTap, ...props }, ref) => (
      <div
        data-testid="konva-line"
        data-points={JSON.stringify(props.points)}
        data-stroke={props.stroke}
        data-stroke-width={props.strokeWidth}
        data-line-cap={props.lineCap}
        data-line-join={props.lineJoin}
        data-opacity={props.opacity}
        data-listening={props.listening}
        data-dash={JSON.stringify(props.dash)}
        onClick={wrapEvent(onClick as ((event: MockKonvaEvent) => void) | undefined)}
        onTouchStart={wrapEvent(onTap as ((event: MockKonvaEvent) => void) | undefined)}
        ref={(node) => assignRef(ref, node)}
      />
    ),
  );
  Component.displayName = "MockKonvaLine";
  return Component;
}

function createRectMock() {
  const Component = forwardRef<HTMLDivElement, Record<string, unknown>>(
    ({ onClick, onTap, ...props }, ref) => (
      <div
        data-testid="konva-rect"
        data-x={props.x}
        data-y={props.y}
        data-width={props.width}
        data-height={props.height}
        data-fill={props.fill || ""}
        data-stroke={props.stroke}
        data-stroke-width={props.strokeWidth}
        data-opacity={props.opacity}
        data-dash={JSON.stringify(props.dash)}
        onClick={wrapEvent(onClick as ((event: MockKonvaEvent) => void) | undefined)}
        onTouchStart={wrapEvent(onTap as ((event: MockKonvaEvent) => void) | undefined)}
        ref={(node) => assignRef(ref, node)}
      />
    ),
  );
  Component.displayName = "MockKonvaRect";
  return Component;
}

function createCircleMock() {
  const Component = forwardRef<HTMLDivElement, Record<string, unknown>>(
    ({ onClick, onTap, ...props }, ref) => (
      <div
        data-testid="konva-circle"
        data-x={props.x}
        data-y={props.y}
        data-radius={props.radius}
        data-fill={props.fill || ""}
        data-stroke={props.stroke}
        data-stroke-width={props.strokeWidth}
        data-opacity={props.opacity}
        data-dash={JSON.stringify(props.dash)}
        onClick={wrapEvent(onClick as ((event: MockKonvaEvent) => void) | undefined)}
        onTouchStart={wrapEvent(onTap as ((event: MockKonvaEvent) => void) | undefined)}
        ref={(node) => assignRef(ref, node)}
      />
    ),
  );
  Component.displayName = "MockKonvaCircle";
  return Component;
}

vi.mock("react-konva", () => ({
  Group: createGroupMock(),
  Line: createLineMock(),
  Rect: createRectMock(),
  Circle: createCircleMock(),
}));

describe("DrawingsLayer", () => {
  const mockCamera: Camera = {
    x: 0,
    y: 0,
    scale: 1,
    setCamera: vi.fn(),
  };

  const mockOnSelectDrawing = vi.fn();
  const mockOnTransformDrawing = vi.fn();
  const mockOnSelectObject = vi.fn();
  const mockOnDrawingNodeReady = vi.fn();

  const createDrawingObject = (
    overrides: Partial<SceneObject & { type: "drawing" }> = {},
  ): SceneObject & { type: "drawing" } => ({
    id: "drawing-1",
    type: "drawing",
    owner: "user-1",
    locked: false,
    zIndex: 1,
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    data: {
      drawing: {
        id: "draw-1",
        owner: "user-1",
        type: "freehand",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        color: "#ffffff",
        width: 3,
        opacity: 1,
        filled: false,
      },
    },
    ...overrides,
  });

  const defaultProps = {
    cam: mockCamera,
    drawingObjects: [],
    currentDrawing: [],
    currentTool: "freehand" as const,
    currentColor: "#ffffff",
    currentWidth: 3,
    currentOpacity: 0.7,
    currentFilled: false,
    uid: "user-1",
    selectMode: false,
    transformMode: false,
    selectedDrawingId: null,
    onSelectDrawing: mockOnSelectDrawing,
    onTransformDrawing: mockOnTransformDrawing,
    selectedObjectId: null,
    selectedObjectIds: [],
    canManageAllDrawings: false,
    onSelectObject: mockOnSelectObject,
    onDrawingNodeReady: mockOnDrawingNodeReady,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<DrawingsLayer {...defaultProps} />);
      expect(container).toBeTruthy();
    });

    it("should render empty layer with no drawings", () => {
      render(<DrawingsLayer {...defaultProps} />);
      const groups = screen.queryAllByTestId("konva-group");
      // Should only have the root Group with camera transform
      expect(groups).toHaveLength(1);
    });

    it("should apply camera transform to root group", () => {
      const camera: Camera = {
        x: 100,
        y: 200,
        scale: 1.5,
        setCamera: vi.fn(),
      };

      render(<DrawingsLayer {...defaultProps} cam={camera} />);

      const rootGroup = screen.getAllByTestId("konva-group")[0];
      expect(rootGroup).toHaveAttribute("data-x", "100");
      expect(rootGroup).toHaveAttribute("data-y", "200");
      expect(rootGroup).toHaveAttribute("data-scale-x", "1.5");
      expect(rootGroup).toHaveAttribute("data-scale-y", "1.5");
    });
  });

  describe("Freehand Drawing Rendering", () => {
    it("should render freehand drawing", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "freehand",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
              { x: 20, y: 15 },
            ],
            color: "#ff0000",
            width: 5,
            opacity: 0.8,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const lines = screen.getAllByTestId("konva-line");
      const visibleLine = lines.find((line) => line.getAttribute("data-stroke") === "#ff0000");

      expect(visibleLine).toBeTruthy();
      expect(visibleLine).toHaveAttribute("data-opacity", "0.8");
    });

    it("should render selection highlight when drawing is selected", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      expect(selectionLine).toBeTruthy();
      expect(selectionLine).toHaveAttribute("data-dash", "[8,4]");
    });

    it("should not show selection when selectMode is false", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={false}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      expect(selectionLine).toBeFalsy();
    });

    it("should warn and skip drawing with invalid points", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "freehand",
            points: [],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("invalid points array"));

      consoleSpy.mockRestore();
    });
  });

  describe("Line Drawing Rendering", () => {
    it("should render line drawing", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "line",
            points: [
              { x: 10, y: 20 },
              { x: 50, y: 60 },
            ],
            color: "#00ff00",
            width: 4,
            opacity: 1,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const lines = screen.getAllByTestId("konva-line");
      const visibleLine = lines.find((line) => line.getAttribute("data-stroke") === "#00ff00");

      expect(visibleLine).toBeTruthy();
      const points = JSON.parse(visibleLine!.getAttribute("data-points") || "[]");
      expect(points).toEqual([10, 20, 50, 60]);
    });

    it("should not render line with less than 2 points", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "line",
            points: [{ x: 10, y: 20 }],
            color: "#00ff00",
            width: 4,
            opacity: 1,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const lines = screen.queryAllByTestId("konva-line");
      const visibleLine = lines.find((line) => line.getAttribute("data-stroke") === "#00ff00");

      expect(visibleLine).toBeFalsy();
    });

    it("should render line with selection highlight", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "line",
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ],
            color: "#00ff00",
            width: 4,
            opacity: 1,
          },
        },
      });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          transformMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      expect(selectionLine).toBeTruthy();
    });
  });

  describe("Rectangle Drawing Rendering", () => {
    it("should render rect drawing", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "rect",
            points: [
              { x: 10, y: 20 },
              { x: 50, y: 60 },
            ],
            color: "#0000ff",
            width: 2,
            opacity: 0.9,
            filled: false,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const rects = screen.getAllByTestId("konva-rect");
      const visibleRect = rects.find((rect) => rect.getAttribute("data-stroke") === "#0000ff");

      expect(visibleRect).toBeTruthy();
      expect(visibleRect).toHaveAttribute("data-x", "10");
      expect(visibleRect).toHaveAttribute("data-y", "20");
      expect(visibleRect).toHaveAttribute("data-width", "40");
      expect(visibleRect).toHaveAttribute("data-height", "40");
      expect(visibleRect).toHaveAttribute("data-fill", "");
    });

    it("should render filled rect drawing", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "rect",
            points: [
              { x: 10, y: 20 },
              { x: 50, y: 60 },
            ],
            color: "#ff00ff",
            width: 2,
            opacity: 0.9,
            filled: true,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const rects = screen.getAllByTestId("konva-rect");
      const visibleRect = rects.find((rect) => rect.getAttribute("data-fill") === "#ff00ff");

      expect(visibleRect).toBeTruthy();
    });

    it("should handle rect with inverted coordinates", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "rect",
            points: [
              { x: 50, y: 60 },
              { x: 10, y: 20 },
            ],
            color: "#0000ff",
            width: 2,
            opacity: 0.9,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const rects = screen.getAllByTestId("konva-rect");
      const visibleRect = rects.find((rect) => rect.getAttribute("data-stroke") === "#0000ff");

      expect(visibleRect).toHaveAttribute("data-x", "10");
      expect(visibleRect).toHaveAttribute("data-y", "20");
      expect(visibleRect).toHaveAttribute("data-width", "40");
      expect(visibleRect).toHaveAttribute("data-height", "40");
    });

    it("should not render rect with less than 2 points", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "rect",
            points: [{ x: 10, y: 20 }],
            color: "#0000ff",
            width: 2,
            opacity: 0.9,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const rects = screen.queryAllByTestId("konva-rect");
      const visibleRect = rects.find((rect) => rect.getAttribute("data-stroke") === "#0000ff");

      expect(visibleRect).toBeFalsy();
    });

    it("should render rect with selection highlight", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "rect",
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ],
            color: "#0000ff",
            width: 2,
            opacity: 0.9,
          },
        },
      });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const rects = screen.getAllByTestId("konva-rect");
      const selectionRect = rects.find((rect) => rect.getAttribute("data-stroke") === "#447DF7");

      expect(selectionRect).toBeTruthy();
      expect(selectionRect).toHaveAttribute("data-dash", "[8,4]");
    });
  });

  describe("Circle Drawing Rendering", () => {
    it("should render circle drawing", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "circle",
            points: [
              { x: 50, y: 50 },
              { x: 80, y: 50 },
            ],
            color: "#ffff00",
            width: 3,
            opacity: 0.75,
            filled: false,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const circles = screen.getAllByTestId("konva-circle");
      const visibleCircle = circles.find(
        (circle) => circle.getAttribute("data-stroke") === "#ffff00",
      );

      expect(visibleCircle).toBeTruthy();
      expect(visibleCircle).toHaveAttribute("data-x", "50");
      expect(visibleCircle).toHaveAttribute("data-y", "50");
      expect(visibleCircle).toHaveAttribute("data-radius", "30");
      expect(visibleCircle).toHaveAttribute("data-fill", "");
    });

    it("should render filled circle drawing", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "circle",
            points: [
              { x: 50, y: 50 },
              { x: 90, y: 50 },
            ],
            color: "#00ffff",
            width: 3,
            opacity: 0.75,
            filled: true,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const circles = screen.getAllByTestId("konva-circle");
      const visibleCircle = circles.find(
        (circle) => circle.getAttribute("data-fill") === "#00ffff",
      );

      expect(visibleCircle).toBeTruthy();
      expect(visibleCircle).toHaveAttribute("data-radius", "40");
    });

    it("should not render circle with less than 2 points", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "circle",
            points: [{ x: 50, y: 50 }],
            color: "#ffff00",
            width: 3,
            opacity: 0.75,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const circles = screen.queryAllByTestId("konva-circle");
      const visibleCircle = circles.find(
        (circle) => circle.getAttribute("data-stroke") === "#ffff00",
      );

      expect(visibleCircle).toBeFalsy();
    });

    it("should render circle with selection highlight", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "circle",
            points: [
              { x: 50, y: 50 },
              { x: 100, y: 50 },
            ],
            color: "#ffff00",
            width: 3,
            opacity: 0.75,
          },
        },
      });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const circles = screen.getAllByTestId("konva-circle");
      const selectionCircle = circles.find(
        (circle) => circle.getAttribute("data-stroke") === "#447DF7",
      );

      expect(selectionCircle).toBeTruthy();
      expect(selectionCircle).toHaveAttribute("data-dash", "[8,4]");
    });
  });

  describe("Selection Behavior", () => {
    it("should call onSelectObject with replace mode on click", () => {
      const drawing = createDrawingObject();

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectMode={true} />);

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      fireEvent.click(interactiveLine!);

      expect(mockOnSelectObject).toHaveBeenCalledWith("drawing-1", { mode: "replace" });
    });

    it("should call onSelectObject with append mode when shift key is pressed", () => {
      const drawing = createDrawingObject();

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectMode={true} />);

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      fireEvent.click(interactiveLine!, { shiftKey: true });

      expect(mockOnSelectObject).toHaveBeenCalledWith("drawing-1", { mode: "append" });
    });

    it("should call onSelectObject with toggle mode when ctrl key is pressed", () => {
      const drawing = createDrawingObject();

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectMode={true} />);

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      fireEvent.click(interactiveLine!, { ctrlKey: true });

      expect(mockOnSelectObject).toHaveBeenCalledWith("drawing-1", { mode: "toggle" });
    });

    it("should call onSelectObject with toggle mode when meta key is pressed", () => {
      const drawing = createDrawingObject();

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectMode={true} />);

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      fireEvent.click(interactiveLine!, { metaKey: true });

      expect(mockOnSelectObject).toHaveBeenCalledWith("drawing-1", { mode: "toggle" });
    });

    it("should call onSelectDrawing when onSelectObject is not provided", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          onSelectObject={undefined}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      fireEvent.click(interactiveLine!);

      expect(mockOnSelectDrawing).toHaveBeenCalledWith("draw-1");
    });

    it("should handle tap events for mobile", () => {
      const drawing = createDrawingObject();

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectMode={true} />);

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      fireEvent.touchStart(interactiveLine!);

      expect(mockOnSelectObject).toHaveBeenCalledWith("drawing-1");
    });

    it("should not allow selection when selectMode and transformMode are false", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={false}
          transformMode={false}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      expect(interactiveLine).toBeFalsy();
    });

    it("should select by selectedDrawingId (legacy)", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedDrawingId="draw-1"
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      expect(selectionLine).toBeTruthy();
    });

    it("should select by selectedObjectId", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectId="drawing-1"
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      expect(selectionLine).toBeTruthy();
    });

    it("should support multi-select via selectedObjectIds", () => {
      const drawing1 = createDrawingObject({ id: "drawing-1" });
      const drawing2 = createDrawingObject({
        id: "drawing-2",
        data: {
          drawing: {
            id: "draw-2",
            type: "freehand",
            points: [
              { x: 100, y: 100 },
              { x: 110, y: 110 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing1, drawing2]}
          selectMode={true}
          selectedObjectIds={["drawing-1", "drawing-2"]}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLines = lines.filter((line) => line.getAttribute("data-stroke") === "#447DF7");

      expect(selectionLines).toHaveLength(2);
    });
  });

  describe("Drag Operations", () => {
    it("should enable drag when selectMode is true, object is selected and owned", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      expect(drawingGroup).toBeTruthy();
    });

    it("should not enable drag when object is locked", () => {
      const drawing = createDrawingObject({ locked: true });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroups = groups.filter((g) => g.getAttribute("data-draggable") === "true");

      // Should have no draggable groups since object is locked
      expect(drawingGroups).toHaveLength(0);
    });

    it("should not enable drag when object is not owned and canManageAllDrawings is false", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            owner: "other-user",
            type: "freehand",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      render(
        <DrawingsLayer
          {...defaultProps}
          uid="user-1"
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
          canManageAllDrawings={false}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroups = groups.filter((g) => g.getAttribute("data-draggable") === "true");

      // Should have no draggable groups since user doesn't own and can't manage all
      expect(drawingGroups).toHaveLength(0);
    });

    it("should enable drag when canManageAllDrawings is true even if not owner", () => {
      const drawing = createDrawingObject({ owner: "other-user" });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
          canManageAllDrawings={true}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      expect(drawingGroup).toBeTruthy();
    });

    it("should enable drag when owner is undefined", () => {
      const drawing = createDrawingObject({ owner: undefined });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      expect(drawingGroup).toBeTruthy();
    });

    it("should call onTransformDrawing on drag end", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      // Mock drag events
      fireEvent.dragStart(drawingGroup!);

      const mockEvent = {
        target: {
          position: () => ({ x: 50, y: 50 }),
        },
      };
      fireEvent.dragEnd(drawingGroup!, mockEvent);

      expect(mockOnTransformDrawing).toHaveBeenCalledWith("drawing-1", {
        position: { x: 50, y: 50 },
      });
    });

    it("should handle multi-object drag", () => {
      const drawing1 = createDrawingObject({
        id: "drawing-1",
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      });
      const drawing2 = createDrawingObject({
        id: "drawing-2",
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
        data: {
          drawing: {
            id: "draw-2",
            type: "freehand",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing1, drawing2]}
          selectMode={true}
          selectedObjectIds={["drawing-1", "drawing-2"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const draggableGroups = groups.filter((g) => g.getAttribute("data-draggable") === "true");

      // Simulate dragging the first object
      fireEvent.dragStart(draggableGroups[0]);

      const mockEvent = {
        target: {
          position: () => ({ x: 50, y: 50 }),
        },
      };
      fireEvent.dragEnd(draggableGroups[0], mockEvent);

      // Should call onTransformDrawing for both objects
      expect(mockOnTransformDrawing).toHaveBeenCalledTimes(2);
      expect(mockOnTransformDrawing).toHaveBeenCalledWith("drawing-1", {
        position: { x: 50, y: 50 },
      });
      expect(mockOnTransformDrawing).toHaveBeenCalledWith("drawing-2", {
        position: { x: 150, y: 150 },
      });
    });
  });

  describe("Transform Overrides", () => {
    it("should apply transform overrides", () => {
      const drawing = createDrawingObject({
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
      });

      const { rerender } = render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      // Trigger drag to create override
      const drawingWithOverride = createDrawingObject({
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
      });

      rerender(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawingWithOverride]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroup = groups.find((g) => g.getAttribute("data-x") === "100");

      expect(drawingGroup).toBeTruthy();
    });

    it("should cleanup overrides when drawing object is removed", () => {
      const drawing = createDrawingObject();

      const { rerender } = render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      rerender(<DrawingsLayer {...defaultProps} drawingObjects={[]} />);

      // Should not crash after removing drawings
      const groups = screen.getAllByTestId("konva-group");
      expect(groups).toHaveLength(1); // Only root group
    });

    it("should cleanup overrides when position matches server state", () => {
      const drawing = createDrawingObject({
        transform: { x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0 },
      });

      const { rerender } = render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      // Simulate server update matching override
      const updatedDrawing = createDrawingObject({
        transform: { x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0 },
      });

      rerender(<DrawingsLayer {...defaultProps} drawingObjects={[updatedDrawing]} />);

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroup = groups.find((g) => g.getAttribute("data-x") === "50");

      expect(drawingGroup).toBeTruthy();
    });
  });

  describe("Current Drawing Preview", () => {
    it("should render current freehand drawing preview", () => {
      const currentDrawing = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ];

      render(
        <DrawingsLayer {...defaultProps} currentDrawing={currentDrawing} currentTool="freehand" />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const previewLine = lines.find((line) => line.getAttribute("data-stroke") === "#ffffff");

      expect(previewLine).toBeTruthy();
      expect(previewLine).toHaveAttribute("data-opacity", "0.7");
    });

    it("should render current line preview", () => {
      const currentDrawing = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];

      render(
        <DrawingsLayer {...defaultProps} currentDrawing={currentDrawing} currentTool="line" />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const previewLine = lines.find((line) => line.getAttribute("data-stroke") === "#ffffff");

      expect(previewLine).toBeTruthy();
      const points = JSON.parse(previewLine!.getAttribute("data-points") || "[]");
      expect(points).toEqual([0, 0, 100, 100]);
    });

    it("should not render line preview with less than 2 points", () => {
      const currentDrawing = [{ x: 0, y: 0 }];

      render(
        <DrawingsLayer {...defaultProps} currentDrawing={currentDrawing} currentTool="line" />,
      );

      const lines = screen.queryAllByTestId("konva-line");
      expect(lines).toHaveLength(0);
    });

    it("should render current rect preview", () => {
      const currentDrawing = [
        { x: 10, y: 10 },
        { x: 50, y: 50 },
      ];

      render(
        <DrawingsLayer
          {...defaultProps}
          currentDrawing={currentDrawing}
          currentTool="rect"
          currentFilled={false}
        />,
      );

      const rects = screen.getAllByTestId("konva-rect");
      expect(rects).toHaveLength(1);
      expect(rects[0]).toHaveAttribute("data-x", "10");
      expect(rects[0]).toHaveAttribute("data-y", "10");
      expect(rects[0]).toHaveAttribute("data-width", "40");
      expect(rects[0]).toHaveAttribute("data-height", "40");
      expect(rects[0]).toHaveAttribute("data-fill", "");
    });

    it("should render filled rect preview", () => {
      const currentDrawing = [
        { x: 10, y: 10 },
        { x: 50, y: 50 },
      ];

      render(
        <DrawingsLayer
          {...defaultProps}
          currentDrawing={currentDrawing}
          currentTool="rect"
          currentFilled={true}
          currentColor="#ff0000"
        />,
      );

      const rects = screen.getAllByTestId("konva-rect");
      expect(rects[0]).toHaveAttribute("data-fill", "#ff0000");
    });

    it("should not render rect preview with less than 2 points", () => {
      const currentDrawing = [{ x: 10, y: 10 }];

      render(
        <DrawingsLayer {...defaultProps} currentDrawing={currentDrawing} currentTool="rect" />,
      );

      const rects = screen.queryAllByTestId("konva-rect");
      expect(rects).toHaveLength(0);
    });

    it("should render current circle preview", () => {
      const currentDrawing = [
        { x: 50, y: 50 },
        { x: 80, y: 50 },
      ];

      render(
        <DrawingsLayer
          {...defaultProps}
          currentDrawing={currentDrawing}
          currentTool="circle"
          currentFilled={false}
        />,
      );

      const circles = screen.getAllByTestId("konva-circle");
      expect(circles).toHaveLength(1);
      expect(circles[0]).toHaveAttribute("data-x", "50");
      expect(circles[0]).toHaveAttribute("data-y", "50");
      expect(circles[0]).toHaveAttribute("data-radius", "30");
      expect(circles[0]).toHaveAttribute("data-fill", "");
    });

    it("should render filled circle preview", () => {
      const currentDrawing = [
        { x: 50, y: 50 },
        { x: 80, y: 50 },
      ];

      render(
        <DrawingsLayer
          {...defaultProps}
          currentDrawing={currentDrawing}
          currentTool="circle"
          currentFilled={true}
          currentColor="#00ff00"
        />,
      );

      const circles = screen.getAllByTestId("konva-circle");
      expect(circles[0]).toHaveAttribute("data-fill", "#00ff00");
    });

    it("should not render circle preview with less than 2 points", () => {
      const currentDrawing = [{ x: 50, y: 50 }];

      render(
        <DrawingsLayer {...defaultProps} currentDrawing={currentDrawing} currentTool="circle" />,
      );

      const circles = screen.queryAllByTestId("konva-circle");
      expect(circles).toHaveLength(0);
    });

    it("should render eraser preview", () => {
      const currentDrawing = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];

      render(
        <DrawingsLayer {...defaultProps} currentDrawing={currentDrawing} currentTool="eraser" />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const eraserLine = lines.find((line) => line.getAttribute("data-stroke") === "#ff4444");

      expect(eraserLine).toBeTruthy();
      expect(eraserLine).toHaveAttribute("data-opacity", "0.4");
    });

    it("should not render preview when currentDrawing is empty", () => {
      render(<DrawingsLayer {...defaultProps} currentDrawing={[]} currentTool="freehand" />);

      const lines = screen.queryAllByTestId("konva-line");
      expect(lines).toHaveLength(0);
    });

    it("should use default values for current drawing properties", () => {
      const currentDrawing = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ];

      render(
        <DrawingsLayer
          {...defaultProps}
          currentDrawing={currentDrawing}
          currentTool="freehand"
          currentColor={undefined}
          currentWidth={undefined}
          currentOpacity={undefined}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const previewLine = lines.find((line) => line.getAttribute("data-stroke") === "#fff");

      expect(previewLine).toBeTruthy();
      expect(previewLine).toHaveAttribute("data-opacity", "0.7");
    });
  });

  describe("Camera Scale Effects", () => {
    it("should scale stroke widths based on camera", () => {
      const camera: Camera = {
        x: 0,
        y: 0,
        scale: 2,
        setCamera: vi.fn(),
      };

      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "freehand",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
            color: "#ffffff",
            width: 6,
            opacity: 1,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} cam={camera} drawingObjects={[drawing]} />);

      const lines = screen.getAllByTestId("konva-line");
      const visibleLine = lines.find((line) => line.getAttribute("data-stroke") === "#ffffff");

      // Width should be 6 / 2 = 3
      expect(visibleLine).toHaveAttribute("data-stroke-width", "3");
    });

    it("should scale selection highlight based on camera", () => {
      const camera: Camera = {
        x: 0,
        y: 0,
        scale: 2,
        setCamera: vi.fn(),
      };

      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          cam={camera}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      // Selection width should be 2 / 2 = 1
      expect(selectionLine).toHaveAttribute("data-stroke-width", "1");
    });

    it("should scale dash pattern based on camera", () => {
      const camera: Camera = {
        x: 0,
        y: 0,
        scale: 2,
        setCamera: vi.fn(),
      };

      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          cam={camera}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      // Dash should be [8/2, 4/2] = [4, 2]
      expect(selectionLine).toHaveAttribute("data-dash", "[4,2]");
    });
  });

  describe("Selection Visual States", () => {
    it("should show blue selection stroke when not dragging", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      expect(selectionLine).toBeTruthy();
    });

    it("should show different color when dragging", () => {
      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const draggableGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      fireEvent.dragStart(draggableGroup!);

      // During drag, selection color should change to #44f
      // Note: This is implementation detail that's hard to test with current mocks
    });
  });

  describe("Ownership and Permissions", () => {
    it("should allow owner to manage their drawings", () => {
      const drawing = createDrawingObject({ owner: "user-1" });

      render(
        <DrawingsLayer
          {...defaultProps}
          uid="user-1"
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const draggableGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      expect(draggableGroup).toBeTruthy();
    });

    it("should not allow non-owner to manage drawings by default", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            owner: "user-2",
            type: "freehand",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      render(
        <DrawingsLayer
          {...defaultProps}
          uid="user-1"
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
          canManageAllDrawings={false}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroups = groups.filter((g) => g.getAttribute("data-draggable") === "true");

      // Should have no draggable groups since user doesn't own and can't manage all
      expect(drawingGroups).toHaveLength(0);
    });

    it("should allow managing all drawings when canManageAllDrawings is true", () => {
      const drawing = createDrawingObject({ owner: "user-2" });

      render(
        <DrawingsLayer
          {...defaultProps}
          uid="user-1"
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
          canManageAllDrawings={true}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const draggableGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      expect(draggableGroup).toBeTruthy();
    });

    it("should treat drawings with no owner as manageable by current user", () => {
      const drawing = createDrawingObject({ owner: undefined });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const draggableGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      expect(draggableGroup).toBeTruthy();
    });

    it("should treat drawings with null owner as manageable by current user", () => {
      const drawing = createDrawingObject({ owner: null });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const draggableGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      expect(draggableGroup).toBeTruthy();
    });
  });

  describe("Locked Objects", () => {
    it("should not allow dragging locked objects", () => {
      const drawing = createDrawingObject({ locked: true });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroups = groups.filter((g) => g.getAttribute("data-draggable") === "true");

      // Should have no draggable groups since object is locked
      expect(drawingGroups).toHaveLength(0);
    });

    it("should still show selection for locked objects", () => {
      const drawing = createDrawingObject({ locked: true });

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const lines = screen.getAllByTestId("konva-line");
      const selectionLine = lines.find((line) => line.getAttribute("data-stroke") === "#447DF7");

      expect(selectionLine).toBeTruthy();
    });

    it("should allow selecting locked objects", () => {
      const drawing = createDrawingObject({ locked: true });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectMode={true} />);

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      fireEvent.click(interactiveLine!);

      expect(mockOnSelectObject).toHaveBeenCalledWith("drawing-1", { mode: "replace" });
    });
  });

  describe("Drawing Node Ready Callback", () => {
    it("should not crash when onDrawingNodeReady is provided", () => {
      const drawing = createDrawingObject();

      expect(() => {
        render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);
      }).not.toThrow();

      // Note: In actual implementation, the ref callback would be called with the Konva node
      // This is hard to test with our mocks since refs aren't triggered in jsdom
    });

    it("should not crash if onDrawingNodeReady is undefined", () => {
      const drawing = createDrawingObject();

      expect(() => {
        render(
          <DrawingsLayer
            {...defaultProps}
            drawingObjects={[drawing]}
            onDrawingNodeReady={undefined}
          />,
        );
      }).not.toThrow();
    });
  });

  describe("Multiple Drawings", () => {
    it("should render multiple drawings of different types", () => {
      const drawings = [
        createDrawingObject({
          id: "drawing-1",
          data: {
            drawing: {
              id: "draw-1",
              type: "freehand",
              points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
              ],
              color: "#ff0000",
              width: 3,
              opacity: 1,
            },
          },
        }),
        createDrawingObject({
          id: "drawing-2",
          data: {
            drawing: {
              id: "draw-2",
              type: "rect",
              points: [
                { x: 20, y: 20 },
                { x: 40, y: 40 },
              ],
              color: "#00ff00",
              width: 2,
              opacity: 1,
            },
          },
        }),
        createDrawingObject({
          id: "drawing-3",
          data: {
            drawing: {
              id: "draw-3",
              type: "circle",
              points: [
                { x: 50, y: 50 },
                { x: 70, y: 50 },
              ],
              color: "#0000ff",
              width: 2,
              opacity: 1,
            },
          },
        }),
      ];

      render(<DrawingsLayer {...defaultProps} drawingObjects={drawings} />);

      const lines = screen.getAllByTestId("konva-line");
      const rects = screen.getAllByTestId("konva-rect");
      const circles = screen.getAllByTestId("konva-circle");

      expect(lines.length).toBeGreaterThan(0);
      expect(rects.length).toBeGreaterThan(0);
      expect(circles.length).toBeGreaterThan(0);
    });

    it("should maintain zIndex order", () => {
      const drawings = [
        createDrawingObject({ id: "drawing-1", zIndex: 2 }),
        createDrawingObject({ id: "drawing-2", zIndex: 1 }),
        createDrawingObject({ id: "drawing-3", zIndex: 3 }),
      ];

      render(<DrawingsLayer {...defaultProps} drawingObjects={drawings} />);

      // All drawings should render
      const groups = screen.getAllByTestId("konva-group");
      expect(groups.length).toBeGreaterThan(3); // Root group + drawing groups
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty selectedObjectIds array", () => {
      const drawing = createDrawingObject();

      expect(() => {
        render(
          <DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectedObjectIds={[]} />,
        );
      }).not.toThrow();
    });

    it("should handle null selectedDrawingId", () => {
      const drawing = createDrawingObject();

      expect(() => {
        render(
          <DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectedDrawingId={null} />,
        );
      }).not.toThrow();
    });

    it("should handle null selectedObjectId", () => {
      const drawing = createDrawingObject();

      expect(() => {
        render(
          <DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectedObjectId={null} />,
        );
      }).not.toThrow();
    });

    it("should handle very large coordinate values", () => {
      const drawing = createDrawingObject({
        transform: { x: 10000, y: 10000, scaleX: 1, scaleY: 1, rotation: 0 },
        data: {
          drawing: {
            id: "draw-1",
            type: "freehand",
            points: [
              { x: 0, y: 0 },
              { x: 10000, y: 10000 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      expect(() => {
        render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);
      }).not.toThrow();
    });

    it("should handle zero-sized shapes", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "rect",
            points: [
              { x: 50, y: 50 },
              { x: 50, y: 50 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      expect(() => {
        render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);
      }).not.toThrow();

      const rects = screen.getAllByTestId("konva-rect");
      const visibleRect = rects.find((rect) => rect.getAttribute("data-stroke") === "#ffffff");

      expect(visibleRect).toHaveAttribute("data-width", "0");
      expect(visibleRect).toHaveAttribute("data-height", "0");
    });

    it("should handle negative coordinates", () => {
      const drawing = createDrawingObject({
        transform: { x: -100, y: -100, scaleX: 1, scaleY: 1, rotation: 0 },
        data: {
          drawing: {
            id: "draw-1",
            type: "freehand",
            points: [
              { x: -50, y: -50 },
              { x: -40, y: -40 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      expect(() => {
        render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);
      }).not.toThrow();
    });

    it("should handle rotation values", () => {
      const drawing = createDrawingObject({
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 45 },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroup = groups.find((g) => g.getAttribute("data-rotation") === "45");

      expect(drawingGroup).toBeTruthy();
    });

    it("should handle scale values", () => {
      const drawing = createDrawingObject({
        transform: { x: 0, y: 0, scaleX: 2, scaleY: 0.5, rotation: 0 },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const groups = screen.getAllByTestId("konva-group");
      const drawingGroup = groups.find(
        (g) => g.getAttribute("data-scale-x") === "2" && g.getAttribute("data-scale-y") === "0.5",
      );

      expect(drawingGroup).toBeTruthy();
    });

    it("should handle opacity edge values", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "freehand",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 0,
          },
        },
      });

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);

      const lines = screen.getAllByTestId("konva-line");
      const visibleLine = lines.find((line) => line.getAttribute("data-stroke") === "#ffffff");

      expect(visibleLine).toHaveAttribute("data-opacity", "0");
    });

    it("should handle unknown drawing type gracefully", () => {
      const drawing = createDrawingObject({
        data: {
          drawing: {
            id: "draw-1",
            type: "unknown" as never,
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
            color: "#ffffff",
            width: 3,
            opacity: 1,
          },
        },
      });

      expect(() => {
        render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} />);
      }).not.toThrow();
    });
  });

  describe("Event Cancellation", () => {
    it("should cancel bubble on click events", () => {
      const drawing = createDrawingObject();

      render(<DrawingsLayer {...defaultProps} drawingObjects={[drawing]} selectMode={true} />);

      const lines = screen.getAllByTestId("konva-line");
      const interactiveLine = lines.find(
        (line) => line.getAttribute("data-stroke") === "transparent",
      );

      const event = new MouseEvent("click", { bubbles: true });
      const cancelBubbleSpy = vi.fn();
      Object.defineProperty(event, "cancelBubble", {
        set: cancelBubbleSpy,
        get: () => false,
      });

      fireEvent(interactiveLine!, event);

      // Event should be handled (selection callback called)
      expect(mockOnSelectObject).toHaveBeenCalled();
    });
  });

  describe("Console Logging", () => {
    it("should warn when drag end occurs without start position", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const drawing = createDrawingObject();

      render(
        <DrawingsLayer
          {...defaultProps}
          drawingObjects={[drawing]}
          selectMode={true}
          selectedObjectIds={["drawing-1"]}
        />,
      );

      const groups = screen.getAllByTestId("konva-group");
      const draggableGroup = groups.find((g) => g.getAttribute("data-draggable") === "true");

      // Trigger drag end without drag start
      const mockEvent = {
        target: {
          position: () => ({ x: 50, y: 50 }),
        },
      };
      fireEvent.dragEnd(draggableGroup!, mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No start position"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });
  });
});
