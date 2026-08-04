// ============================================================================
// TOKEN NAMEPLATE TESTS (S4)
// ============================================================================
// The plate renders exactly what the server allowed through: numbers → bar,
// badge → dot, neither → name only. Zoom-invariance is the other contract:
// the group counter-scales by 1/cam.scale so the text holds its screen size.

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { forwardRef } from "react";
import type { ReactNode } from "react";
import { TokenNameplate } from "../TokenNameplate";

interface MockProps {
  children?: ReactNode;
  [key: string]: unknown;
}

const captured: Record<string, MockProps[]> = { Group: [], Rect: [], Text: [], Circle: [] };

function mockComponent(name: keyof typeof captured, withChildren = false) {
  const Component = forwardRef<HTMLElement, MockProps>(({ children, ...props }, _ref) => {
    captured[name].push(props);
    return withChildren ? (
      <div data-testid={`konva-${name.toLowerCase()}`}>{children as ReactNode}</div>
    ) : (
      <div data-testid={`konva-${name.toLowerCase()}`} />
    );
  });
  Component.displayName = `Mock${name}`;
  return Component;
}

vi.mock("react-konva", () => ({
  Group: mockComponent("Group", true),
  Rect: mockComponent("Rect"),
  Text: mockComponent("Text"),
  Circle: mockComponent("Circle"),
}));

import { vi } from "vitest";

function renderPlate(plate: Parameters<typeof TokenNameplate>[0]["plate"], camScale = 1) {
  for (const key of Object.keys(captured)) captured[key as keyof typeof captured] = [];
  return render(
    <TokenNameplate plate={plate} x={100} y={200} tokenSize={37.5} camScale={camScale} />,
  );
}

describe("TokenNameplate", () => {
  it("renders the name zoom-invariantly: group counter-scales, text stays 11px+", () => {
    renderPlate({ name: "Goblin 3" }, 0.5);

    const group = captured.Group[0]!;
    expect(group.scaleX).toBe(2); // 1 / 0.5
    expect(group.scaleY).toBe(2);
    expect(group.listening).toBe(false);

    const text = captured.Text[0]!;
    expect(text.text).toBe("Goblin 3");
    expect(text.fontSize).toBe(11);
    expect(text.ellipsis).toBe(true);
    expect(text.wrap).toBe("none");
    expect(text.name).toBe("token-nameplate");
  });

  it("draws a ratio bar from exact numbers — low HP reads red", () => {
    renderPlate({ name: "Aria", hp: 30, maxHp: 100 });

    const [track, fill] = captured.Rect;
    expect(track).toBeDefined();
    expect(fill!.width).toBeCloseTo((track!.width as number) * 0.3);
    expect(fill!.fill).toBe("#d63c53"); // ≤33%
    expect(captured.Circle).toHaveLength(0);
  });

  it("healthy HP reads green, full-width", () => {
    renderPlate({ name: "Aria", hp: 100, maxHp: 100 });
    const [track, fill] = captured.Rect;
    expect(fill!.width).toBe(track!.width);
    expect(fill!.fill).toBe("#3fbf5a"); // >66%
  });

  it("bloodied badge mode: a dot, never a bar", () => {
    renderPlate({ name: "Goblin 3", hpBadge: "bloodied" });

    expect(captured.Rect).toHaveLength(0);
    const dot = captured.Circle[0]!;
    expect(dot.fill).toBe("#d63c53");
  });

  it("hidden mode: name only — no bar, no dot, nothing to infer from", () => {
    renderPlate({ name: "Goblin 3" });

    expect(captured.Rect).toHaveLength(0);
    expect(captured.Circle).toHaveLength(0);
    expect(captured.Text[0]!.text).toBe("Goblin 3");
  });
});
