import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MapDocument, MapElement, MapLayer } from "@herobyte/shared";
import { NotesOverlayLayer } from "../NotesOverlayLayer";
import type { Camera } from "../../map/types";

type MockProps = Record<string, unknown> & { children?: ReactNode };

const textProps: MockProps[] = [];

vi.mock("react-konva", () => ({
  Group: ({ children }: MockProps) => <div data-testid="konva-group">{children}</div>,
  Text: (props: MockProps) => {
    textProps.push(props);
    return <div data-testid="konva-text" />;
  },
}));

const cam: Camera = { x: 10, y: 20, scale: 2 };

function layer(id: string, kind: MapLayer["kind"], visible = true): MapLayer {
  return { id, name: id, kind, visible, locked: false, opacity: 1, zIndex: 0 };
}

function note(id: string, text: string, layerId = "notes", hidden = false): MapElement {
  return {
    id,
    layerId,
    type: "text",
    locked: false,
    hidden,
    transform: { x: 100, y: 200, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { text, color: "#ffd479", fontSize: 14, visibleToPlayers: false },
  };
}

function doc(elements: MapElement[], layers: MapLayer[] = [layer("notes", "notes")]): MapDocument {
  return {
    schemaVersion: 1,
    id: "doc",
    name: "doc",
    width: 2048,
    height: 2048,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers,
    elements,
    revision: 1,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("NotesOverlayLayer", () => {
  beforeEach(() => {
    textProps.length = 0;
  });

  it("renders nothing without a document", () => {
    const { container } = render(<NotesOverlayLayer cam={cam} document={null} />);
    expect(container.querySelector('[data-testid="konva-text"]')).toBeNull();
  });

  it("draws GM notes so the DM can see what a generated dungeon holds", () => {
    render(<NotesOverlayLayer cam={cam} document={doc([note("n1", "SPAWN: 2d4 skeletons")])} />);

    expect(textProps).toHaveLength(1);
    expect(textProps[0]!.text).toBe("SPAWN: 2d4 skeletons");
    expect(textProps[0]!.x).toBe(100);
    expect(textProps[0]!.y).toBe(200);
    // Scenery, never interactive.
    expect(textProps[0]!.listening).toBe(false);
  });

  it("ignores text on non-notes layers (that is the scenery layer's job)", () => {
    render(
      <NotesOverlayLayer
        cam={cam}
        document={doc(
          [note("n1", "Welcome to the Keep", "objects")],
          [layer("objects", "objects"), layer("notes", "notes")],
        )}
      />,
    );

    expect(textProps).toHaveLength(0);
  });

  it("respects a hidden element and an invisible notes layer", () => {
    render(<NotesOverlayLayer cam={cam} document={doc([note("n1", "hidden", "notes", true)])} />);
    expect(textProps).toHaveLength(0);

    render(
      <NotesOverlayLayer
        cam={cam}
        document={doc([note("n1", "layer off")], [layer("notes", "notes", false)])}
      />,
    );
    expect(textProps).toHaveLength(0);
  });
});
