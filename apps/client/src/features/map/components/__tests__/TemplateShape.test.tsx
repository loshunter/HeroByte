/**
 * Component tests for TemplateShape (S6)
 *
 * "Is Grak in it?" is answered by LOOKING, so the two things that matter are
 * that the polygon reaches the canvas unaltered and that the interior is
 * washed rather than painted over — a fully opaque area of effect hides the
 * very token the question is about.
 *
 * Source: apps/client/src/features/map/components/TemplateShape.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplateShape } from "../TemplateShape";

vi.mock("react-konva", () => ({
  Line: (props: Record<string, unknown>) => (
    <div
      data-testid="konva-line"
      data-points={JSON.stringify(props.points)}
      data-closed={String(props.closed)}
      data-fill={props.fill ?? ""}
      data-stroke={props.stroke ?? ""}
      data-opacity={props.opacity}
      data-dash={JSON.stringify(props.dash ?? null)}
      onClick={props.onClick as () => void}
    />
  ),
  Text: (props: Record<string, unknown>) => (
    <div data-testid="konva-text">{String(props.text)}</div>
  ),
}));

const TRIANGLE = [
  { x: 0, y: 0 },
  { x: 100, y: 50 },
  { x: 100, y: -50 },
];

function renderShape(overrides: Partial<Parameters<typeof TemplateShape>[0]> = {}) {
  return render(
    <TemplateShape
      points={TRIANGLE}
      color="#ff8800"
      width={3}
      opacity={0.8}
      scale={1}
      {...overrides}
    />,
  );
}

function lines() {
  return screen.queryAllByTestId("konva-line");
}

describe("TemplateShape", () => {
  it("renders nothing for a degenerate polygon", () => {
    const { container } = renderShape({ points: [{ x: 0, y: 0 }] });
    expect(container.firstChild).toBeNull();
  });

  it("draws the polygon it was handed, closed, without touching the points", () => {
    renderShape();
    const flat = [0, 0, 100, 50, 100, -50];
    for (const line of lines()) {
      expect(JSON.parse(line.getAttribute("data-points") ?? "[]")).toEqual(flat);
      expect(line.getAttribute("data-closed")).toBe("true");
    }
  });

  it("washes the interior rather than painting over it", () => {
    renderShape({ opacity: 0.8 });
    const filled = lines().filter((line) => line.getAttribute("data-fill") === "#ff8800");
    expect(filled).toHaveLength(1);
    // A quarter of the chosen opacity — enough to read the area, not enough to
    // hide a token standing in it.
    expect(Number(filled[0].getAttribute("data-opacity"))).toBeCloseTo(0.2, 5);

    // The outline keeps the full opacity, so the edge stays legible.
    const outlined = lines().filter((line) => line.getAttribute("data-stroke") === "#ff8800");
    expect(Number(outlined[0].getAttribute("data-opacity"))).toBeCloseTo(0.8, 5);
  });

  it("names the area when it carries template metadata", () => {
    renderShape({ template: { kind: "cone", sizeFeet: 15 } });
    expect(screen.getByTestId("konva-text").textContent).toBe("15 ft cone");
  });

  it("shows no label on a shape with no metadata", () => {
    renderShape();
    expect(screen.queryByTestId("konva-text")).toBeNull();
  });

  it("adds a dashed outline only when selected", () => {
    renderShape();
    expect(lines().some((line) => line.getAttribute("data-dash") !== "null")).toBe(false);

    renderShape({ selected: true });
    expect(lines().some((line) => line.getAttribute("data-dash") !== "null")).toBe(true);
  });

  it("attaches the click handler to the filled body, so the area is what you click", () => {
    const onClick = vi.fn();
    renderShape({ handlers: { onClick } });

    const filled = lines().find((line) => line.getAttribute("data-fill") === "#ff8800");
    filled?.click();
    expect(onClick).toHaveBeenCalled();
  });
});
