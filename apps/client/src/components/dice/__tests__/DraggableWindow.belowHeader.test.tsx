import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DraggableWindow } from "../DraggableWindow";

// Node 25's global localStorage shadows jsdom's and lacks its methods: a plain store.
function plainStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

// The header's height is not fixed — its tools wrap, it carries the public-table warning
// row, a DM has more of them — so a window with no remembered place opens under the
// header's LOWEST CONTROL rather than at a flat 100px, where on a tall header it would sit
// ON the tools (and cover the button that closes it). It measures the controls, not the
// frame: the frame keeps its own padding, and a palette that was never in the way stays put.

const box = (bottom: number, height = 26) =>
  ({
    top: bottom - height,
    bottom,
    left: 0,
    right: 80,
    width: 80,
    height,
    x: 0,
    y: bottom - height,
  }) as DOMRect;

const control = (bottom: number, height = 26) => {
  const button = document.createElement("button");
  button.getBoundingClientRect = () => box(bottom, height);
  return button;
};

/** A header whose controls end at each of `bottoms` and whose frame ends at `frameBottom`. */
function header(bottoms: number[], frameBottom = Math.max(...bottoms) + 12) {
  const root = document.createElement("div");
  root.setAttribute("data-header-root", "");
  root.getBoundingClientRect = () => box(frameBottom, frameBottom);
  for (const bottom of bottoms) root.appendChild(control(bottom));
  document.body.appendChild(root);
  return root;
}

const windowOf = (container: HTMLElement) =>
  container.querySelector("div[style*='position: fixed']") as HTMLElement;

describe("DraggableWindow — opens below the header's controls", () => {
  const added: HTMLElement[] = [];
  const mount = (root: HTMLElement) => {
    added.push(root);
    return root;
  };

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: plainStorage(),
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    while (added.length) added.pop()!.remove();
  });

  it("starts 4px under a header whose controls end below its own default y", () => {
    mount(header([60, 180]));
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("184px");
  });

  it("rounds a fractional control edge up, so the window never overlaps its last pixel", () => {
    mount(header([139.4]));
    const { container } = render(
      <DraggableWindow title="Dice Roller">
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("144px");
  });

  it("keeps its own y when the controls end above it — a palette that was never in the way stays put", () => {
    mount(header([60]));
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("100px");
  });

  it("does not move for the header's own padding: it is the controls that matter, not the frame", () => {
    // Controls end at 96; the frame (with its padding and warning row) ends at 300.
    mount(header([96], 300));
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("100px");
  });

  it("keeps a y that is already lower than every control", () => {
    mount(header([180]));
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={300}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("300px");
  });

  it("ignores a control that is not rendered (a zero box) and one outside the header", () => {
    const root = mount(header([96]));
    // Hidden inside the header: a zero-height box far below.
    root.appendChild(control(500, 0));
    // Outside the header entirely.
    const elsewhere = mount(document.createElement("div"));
    elsewhere.appendChild(control(700));
    document.body.appendChild(elsewhere);
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("100px");
  });

  it("is bounded by the space left below it, so a lower window still fits the screen", () => {
    mount(header([180]));
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.maxHeight).toContain("184px");
  });

  it("never moves a window the player has already placed", () => {
    mount(header([180]));
    window.localStorage.setItem("herobyte-window-position-test", JSON.stringify({ x: 40, y: 20 }));
    const { container } = render(
      <DraggableWindow title="Dice Roller" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("20px");
  });
});
