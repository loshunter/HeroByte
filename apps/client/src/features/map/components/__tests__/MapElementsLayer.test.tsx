import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MapElementsSnapshot, RenderableMapElement } from "@herobyte/shared";
import { MapElementsLayer } from "../MapElementsLayer";

type Props = Record<string, unknown> & { children?: ReactNode };

const groups: Props[] = [];
const rects: Props[] = [];
const ellipses: Props[] = [];
const texts: Props[] = [];
const images: Props[] = [];

vi.mock("react-konva", () => ({
  Group: ({ children, ...props }: Props) => {
    groups.push(props);
    return <div data-testid="k-group">{children}</div>;
  },
  Rect: (props: Props) => {
    rects.push(props);
    return <div data-testid="k-rect" />;
  },
  Ellipse: (props: Props) => {
    ellipses.push(props);
    return <div data-testid="k-ellipse" />;
  },
  Text: (props: Props) => {
    texts.push(props);
    return <div data-testid="k-text" />;
  },
  Image: (props: Props) => {
    images.push(props);
    return <div data-testid="k-image" />;
  },
}));

// A loaded image for every url; bundled tiles carry no imageUrl so they flat-fill.
vi.mock("use-image", () => ({ default: () => [{ width: 8 } as HTMLImageElement, "loaded"] }));
vi.mock("../../../map-studio/starterTiles", () => ({
  getMapStudioTileAsset: (assetId: string) =>
    assetId.startsWith("upload:")
      ? { fill: "#111111", stroke: "#222222", imageUrl: `http://img/${assetId}` }
      : { fill: "#7cb04a", stroke: "#4a764e" },
}));

const cam = { x: 0, y: 0, scale: 1 };
const T = { x: 5, y: 7, scaleX: 1, scaleY: 1, rotation: 0 };

function snapshot(
  layers: Array<{ opacity: number; elements: RenderableMapElement[] }>,
): MapElementsSnapshot {
  return { grid: { size: 50, offsetX: 0, offsetY: 0 }, layers };
}

beforeEach(() => {
  groups.length = 0;
  rects.length = 0;
  ellipses.length = 0;
  texts.length = 0;
  images.length = 0;
});

describe("MapElementsLayer", () => {
  it("renders a bundled tile as a cell-sized fill rect", () => {
    render(
      <MapElementsLayer
        cam={cam}
        mapElements={snapshot([
          {
            opacity: 1,
            elements: [
              {
                id: "t1",
                type: "tile",
                transform: T,
                data: { assetId: "terrain:grass", columns: 2, rows: 3 },
              },
            ],
          },
        ])}
      />,
    );
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ width: 100, height: 150, fill: "#7cb04a", listening: false });
  });

  it("renders an upload-backed stamp as a Konva image at its pixel size", () => {
    render(
      <MapElementsLayer
        cam={cam}
        mapElements={snapshot([
          {
            opacity: 1,
            elements: [
              {
                id: "s1",
                type: "stamp",
                transform: T,
                data: { assetId: "upload:crate", width: 64, height: 48 },
              },
            ],
          },
        ])}
      />,
    );
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ width: 64, height: 48, listening: false });
    expect(rects).toHaveLength(0);
  });

  it("washes an image-backed element with its tint (Studio parity)", () => {
    render(
      <MapElementsLayer
        cam={cam}
        mapElements={snapshot([
          {
            opacity: 1,
            elements: [
              {
                id: "s2",
                type: "stamp",
                transform: T,
                data: { assetId: "upload:crate", width: 64, height: 48, tint: "#ff0000" },
              },
            ],
          },
        ])}
      />,
    );
    // The image plus a 35%-opacity tint wash of the same size.
    expect(images).toHaveLength(1);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ width: 64, height: 48, fill: "#ff0000", opacity: 0.35 });
  });

  it("renders a rectangle shape at its bounds and an ellipse by center/radius", () => {
    render(
      <MapElementsLayer
        cam={cam}
        mapElements={snapshot([
          {
            opacity: 1,
            elements: [
              {
                id: "r1",
                type: "shape",
                transform: T,
                data: {
                  shape: "rectangle",
                  points: [
                    { x: 10, y: 20 },
                    { x: 40, y: 60 },
                  ],
                  stroke: "#f00",
                  strokeWidth: 2,
                  opacity: 0.8,
                },
              },
              {
                id: "e1",
                type: "shape",
                transform: T,
                data: {
                  shape: "ellipse",
                  points: [
                    { x: 0, y: 0 },
                    { x: 20, y: 10 },
                  ],
                  stroke: "#00f",
                  strokeWidth: 1,
                  fill: "#abc",
                  opacity: 1,
                },
              },
            ],
          },
        ])}
      />,
    );
    expect(rects[0]).toMatchObject({ x: 10, y: 20, width: 30, height: 40, opacity: 0.8 });
    expect(ellipses[0]).toMatchObject({ x: 10, y: 5, radiusX: 10, radiusY: 5, fill: "#abc" });
  });

  it("renders visible text with its content, color, and size", () => {
    render(
      <MapElementsLayer
        cam={cam}
        mapElements={snapshot([
          {
            opacity: 1,
            elements: [
              {
                id: "x1",
                type: "text",
                transform: T,
                data: { text: "Welcome", color: "#fff", fontSize: 30 },
              },
            ],
          },
        ])}
      />,
    );
    expect(texts[0]).toMatchObject({
      text: "Welcome",
      fill: "#fff",
      fontSize: 30,
      listening: false,
    });
  });

  it("wraps each authored layer in a group carrying its opacity, in server order", () => {
    render(
      <MapElementsLayer
        cam={cam}
        mapElements={snapshot([
          {
            opacity: 0.25,
            elements: [
              {
                id: "a",
                type: "text",
                transform: T,
                data: { text: "A", color: "#fff", fontSize: 12 },
              },
            ],
          },
          {
            opacity: 0.5,
            elements: [
              {
                id: "b",
                type: "text",
                transform: T,
                data: { text: "B", color: "#fff", fontSize: 12 },
              },
            ],
          },
        ])}
      />,
    );
    // The two layer groups (opacity 0.25 then 0.5) appear in emitted order.
    const layerOpacities = groups.map((g) => g.opacity).filter((o) => o !== undefined);
    expect(layerOpacities).toEqual([0.25, 0.5]);
  });
});
