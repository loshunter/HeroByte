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

import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import type { ReactNode, Ref } from "react";
import MapBoard from "../MapBoard";
import type { RoomSnapshot } from "@herobyte/shared";
import type { MapBoardProps } from "../MapBoard.types";
import { useSelectionPalette } from "../../features/map/selectionPalette";

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

function createKonvaMock(testId: string, options: { omitProps?: string[] } = {}) {
  const Component = forwardRef<HTMLDivElement, MockComponentProps>((props, ref) => {
    const { children, ...rest } = props;
    const safeProps = { ...rest };
    for (const key of options.omitProps ?? []) {
      delete safeProps[key];
    }

    return (
      <div data-testid={testId} ref={(node) => assignRef(ref, node)} {...safeProps}>
        {children as ReactNode}
      </div>
    );
  });

  Component.displayName = `Mock${testId}`;
  return Component;
}

// Mock Konva components
vi.mock("react-konva", () => ({
  Stage: createKonvaMock("konva-stage", { omitProps: ["onDblTap", "onDblClick", "onTap"] }),
  Layer: createKonvaMock("konva-layer", { omitProps: ["listening"] }),
}));

// Mock all the layer components
vi.mock("../../features/map/components", () => ({
  GridLayer: () => <div data-testid="grid-layer" />,
  MapImageLayer: () => <div data-testid="map-image-layer" />,
  TerrainLayer: () => <div data-testid="terrain-layer" />,
  // Surfaces the selection palette the stage supplies (C3: your selection, your colour).
  TokensLayer: () => (
    <div data-testid="tokens-layer" data-selection={useSelectionPalette().stroke} />
  ),
  // Surfaces the party records it is given: pings take each player's colour from them.
  PointersLayer: (props: { characters?: { id: string }[] }) => (
    <div
      data-testid="pointers-layer"
      data-characters={(props.characters ?? []).map((character) => character.id).join(",")}
    />
  ),
  DrawingsLayer: () => <div data-testid="drawings-layer" />,
  // Surfaces the props MapBoard hands it, so the S6 wiring is assertable: the
  // diagonal rule and the relayed measurements reach the overlay from the
  // snapshot, and deleting either line has somewhere to fail.
  MeasureLayer: (props: { diagonalRule?: string; remoteMeasurements?: unknown[] }) => (
    <div
      data-testid="measure-layer"
      data-diagonal-rule={props.diagonalRule ?? ""}
      data-remote-count={props.remoteMeasurements?.length ?? -1}
    />
  ),
  // Same idea for the fog wiring: MapBoard's fogViewers call is the ONE place
  // the client resolves the table default, and the slice review flagged it as
  // untested. The required 5th parameter makes DROPPING the argument a compile
  // error; this surfaces the VALUE, so passing undefined has somewhere to fail.
  FogLayer: (props: { viewers: { radiusFeet?: number }[] }) => (
    <div
      data-testid="fog-layer"
      data-viewer-radii={props.viewers.map((viewer) => viewer.radiusFeet ?? "unlimited").join("|")}
    />
  ),
  TransformGizmo: () => <div data-testid="transform-gizmo" />,
  PropsLayer: () => <div data-testid="props-layer" />,
  StagingZoneLayer: () => <div data-testid="staging-zone-layer" />,
  AlignmentOverlay: () => <div data-testid="alignment-overlay" />,
  AlignmentInstructionOverlay: () => <div data-testid="alignment-instruction-overlay" />,
  MarqueeOverlay: () => <div data-testid="marquee-overlay" />,
  withEmissiveLights: (mapElements?: { lighting?: unknown }) => mapElements?.lighting,
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
    onStageClick: vi.fn(),
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
    onTap: vi.fn(),
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

    it("supplies the viewer's colour to the layers it draws, and today's blue without one", () => {
      const snapshot = (characters: RoomSnapshot["characters"]): RoomSnapshot => ({
        users: [],
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "",
        players: [],
        characters,
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      });
      const mine = {
        id: "c1",
        name: "Mine",
        type: "pc",
        ownedByPlayerUID: "test-user",
        tokenId: "t1",
        color: "#390076",
      } as RoomSnapshot["characters"][number];

      // Someone else's PC first: the palette must be the VIEWER's colour, not the first one.
      const theirs = {
        ...mine,
        id: "c0",
        ownedByPlayerUID: "other-user",
        tokenId: "t0",
        color: "#ffc2d3",
      } as RoomSnapshot["characters"][number];
      render(<MapBoard {...getDefaultProps({ snapshot: snapshot([theirs, mine]) })} />);
      expect(screen.getByTestId("tokens-layer").getAttribute("data-selection")).toBe("#390076");
      // ...and the pings get the party records, which carry every colour through fog.
      expect(screen.getByTestId("pointers-layer").getAttribute("data-characters")).toBe("c0,c1");
      cleanup();

      render(<MapBoard {...getDefaultProps({ snapshot: snapshot([]) })} />);
      expect(screen.getByTestId("tokens-layer").getAttribute("data-selection")).toBe("#447DF7");
      cleanup();

      // A recolour reaches the palette on the next snapshot.
      const { rerender } = render(
        <MapBoard {...getDefaultProps({ snapshot: snapshot([theirs, mine]) })} />,
      );
      rerender(
        <MapBoard
          {...getDefaultProps({ snapshot: snapshot([theirs, { ...mine, color: "#00a4f9" }]) })}
        />,
      );
      expect(screen.getByTestId("tokens-layer").getAttribute("data-selection")).toBe("#00a4f9");
    });

    it("should render with empty snapshot", () => {
      const emptySnapshot: RoomSnapshot = {
        users: [],
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

  describe("Published Terrain", () => {
    const snapshotWith = (mapTerrain?: RoomSnapshot["mapTerrain"]): RoomSnapshot => ({
      users: [],
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
      mapTerrain,
    });

    const terrain: RoomSnapshot["mapTerrain"] = {
      terrain: { schemaVersion: 1, palette: ["terrain:water"], chunks: { "0,0": [1, 1, 255, 0] } },
      grid: { size: 50, offsetX: 0, offsetY: 0 },
      opacity: 1,
    };

    it("renders a TerrainLayer under the map image when the snapshot carries terrain", () => {
      const props = getDefaultProps({ snapshot: snapshotWith(terrain) });
      const { container } = render(<MapBoard {...props} />);

      const terrainLayer = container.querySelector('[data-testid="terrain-layer"]');
      const imageLayer = container.querySelector('[data-testid="map-image-layer"]');
      expect(terrainLayer).not.toBeNull();
      expect(imageLayer).not.toBeNull();
      // Terrain must draw BEFORE (under) the elements-only background image.
      expect(
        terrainLayer!.compareDocumentPosition(imageLayer!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("renders no TerrainLayer for a legacy snapshot without terrain (back-compat)", () => {
      const props = getDefaultProps({ snapshot: snapshotWith(undefined) });
      const { container } = render(<MapBoard {...props} />);

      expect(container.querySelector('[data-testid="terrain-layer"]')).toBeNull();
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
  describe("S6 measurement wiring", () => {
    it("hands MeasureLayer the room's diagonal rule from the snapshot", () => {
      // The headline D11 fix is only as good as this one line: without it the
      // overlay silently falls back to its own default and the DM's setting does
      // nothing.
      const props = getDefaultProps({
        snapshot: {
          users: [],
          gridSize: 50,
          gridSquareSize: 5,
          players: [],
          characters: [],
          tokens: [],
          drawings: [],
          diceRolls: [],
          pointers: [],
          sceneObjects: [],
          props: [],
          diagonalRule: "pathfinder",
        },
      });
      render(<MapBoard {...props} />);

      expect(screen.getByTestId("measure-layer")).toHaveAttribute(
        "data-diagonal-rule",
        "pathfinder",
      );
    });

    it("hands MeasureLayer the relayed measurements", () => {
      const props = getDefaultProps({
        remoteMeasurements: [
          { uid: "bob", name: "Bob", start: { x: 0, y: 0 }, end: { x: 50, y: 50 } },
        ],
      });
      render(<MapBoard {...props} />);

      expect(screen.getByTestId("measure-layer")).toHaveAttribute("data-remote-count", "1");
    });
  });

  // The review's last surviving finding: nothing exercised the fogViewers call
  // site itself, and `undefined` in its 5th slot compiles while quietly
  // splitting client fog from server filtering.
  describe("fog wiring", () => {
    const fogSnapshot = (defaultVisionRadius?: number): RoomSnapshot => ({
      users: [],
      gridSize: 50,
      gridSquareSize: 5,
      players: [],
      characters: [],
      // Owned by the default props' uid, with NO radius of its own — the exact
      // shape the table default exists for.
      tokens: [{ id: "mine", owner: "test-user", x: 1, y: 1, color: "red" }],
      drawings: [],
      diceRolls: [],
      pointers: [],
      sceneObjects: [],
      props: [],
      fogEnabled: true,
      compiledScene: {
        schemaVersion: 1,
        sourceDocumentId: "map",
        sourceRevision: 1,
        compiledAt: 1,
        width: 400,
        height: 400,
        walls: [],
        doors: [],
        lights: [],
      },
      ...(defaultVisionRadius !== undefined ? { defaultVisionRadius } : {}),
    });

    it("hands FogLayer a viewer resolved through the snapshot's table default", () => {
      const props = getDefaultProps({ snapshot: fogSnapshot(30) });
      render(<MapBoard {...props} />);

      expect(screen.getByTestId("fog-layer")).toHaveAttribute("data-viewer-radii", "30");
    });

    // NON-VACUITY: the same render with no default stays unlimited, so the
    // test above cannot be satisfied by a hardcoded radius.
    it("leaves the viewer unlimited when the snapshot carries no default", () => {
      const props = getDefaultProps({ snapshot: fogSnapshot() });
      render(<MapBoard {...props} />);

      expect(screen.getByTestId("fog-layer")).toHaveAttribute("data-viewer-radii", "unlimited");
    });
  });

  // Outside map edit too: the map's keys (Delete, undo, G) reach it beside an
  // open floating window only while it holds focus (features/interaction/mapShortcut).
  it("takes keyboard focus when its canvas is pressed, outside map edit", () => {
    render(<MapBoard {...getDefaultProps({ mapEditMode: false })} />);
    const board = screen.getByTestId("map-board");
    expect(board).toHaveAttribute("data-map-history-surface", "true");
    const canvas = document.createElement("canvas");
    board.append(canvas);
    fireEvent.pointerDown(canvas);
    expect(document.activeElement).toBe(board);
  });

  // Focus follows the LAYOUT, not the pointer type. In the phone layout the map has no
  // keys to take outside map edit, and a tap (or its compat mousedown) that focused it
  // would blur — and so submit — an open field; there it is not even focusable. In the
  // desktop layout it takes focus from a finger too (a touchscreen laptop's Ctrl+Z).
  describe("keyboard focus by layout", () => {
    const tap = (target: Element, pointerType: string) => {
      const event = createEvent.pointerDown(target);
      Object.defineProperty(event, "pointerType", { value: pointerType });
      fireEvent(target, event);
    };
    const pressedBoard = (phoneLayout: boolean, mapEditMode: boolean, pointerType: string) => {
      render(<MapBoard {...getDefaultProps({ mapEditMode, phoneLayout })} />);
      const board = screen.getByTestId("map-board");
      const field = document.createElement("input");
      document.body.append(field);
      field.focus();
      const canvas = document.createElement("canvas");
      board.append(canvas);
      tap(canvas, pointerType);
      return { board, field };
    };
    afterEach(() => {
      document.querySelectorAll("body > input").forEach((input) => input.remove());
    });

    it("phone layout, outside map edit: not focusable, and a tap leaves the field focused", () => {
      for (const pointerType of ["touch", "pen", "mouse"]) {
        const { board, field } = pressedBoard(true, false, pointerType);
        expect(board).not.toHaveAttribute("tabindex");
        expect(document.activeElement).toBe(field);
        cleanup();
      }
    });

    // jsdom never moves focus on a press, so the test above cannot see a browser's
    // mousedown blurring the field (focus falls to the body even off an unfocusable
    // element). What stops that is the cancelled default, pinned here — and kept off
    // wherever the map takes keys, where the press must focus it.
    it("phone layout, outside map edit: the press's mousedown cannot take focus", () => {
      const pressDefaultPrevented = (phoneLayout: boolean, mapEditMode: boolean) => {
        render(<MapBoard {...getDefaultProps({ mapEditMode, phoneLayout })} />);
        const canvas = document.createElement("canvas");
        screen.getByTestId("map-board").append(canvas);
        const event = createEvent.mouseDown(canvas);
        fireEvent(canvas, event);
        cleanup();
        return event.defaultPrevented;
      };
      expect(pressDefaultPrevented(true, false)).toBe(true);
      expect(pressDefaultPrevented(true, true)).toBe(false);
      expect(pressDefaultPrevented(false, false)).toBe(false);
    });

    // Canvas presses only: a control inside the wrapper must still take focus when pressed.
    it("phone layout, outside map edit: a press on a control inside the map keeps its default", () => {
      render(<MapBoard {...getDefaultProps({ mapEditMode: false, phoneLayout: true })} />);
      const button = document.createElement("button");
      screen.getByTestId("map-board").append(button);
      const event = createEvent.mouseDown(button);
      fireEvent(button, event);
      expect(event.defaultPrevented).toBe(false);
    });

    it("phone layout, in map edit: a tap gives the map its history keys", () => {
      const { board } = pressedBoard(true, true, "touch");
      expect(document.activeElement).toBe(board);
    });

    it("desktop layout: a finger on a touchscreen laptop gives the map focus too", () => {
      const { board } = pressedBoard(false, false, "touch");
      expect(document.activeElement).toBe(board);
    });

    // The layout says which it is, not the window: a phone-sized window hosting the
    // desktop layout (a render before App swaps it) still gets a focusable map.
    it("follows the layout prop, not the window's size or ?mobile=", () => {
      window.history.replaceState({}, "", "/?mobile=true");
      try {
        const { board } = pressedBoard(false, false, "touch");
        expect(board).toHaveAttribute("tabindex", "-1");
        expect(document.activeElement).toBe(board);
      } finally {
        window.history.replaceState({}, "", "/");
      }
    });
  });
});
