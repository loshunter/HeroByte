import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// The header's height can change while a window is open: a player who enters DM mode
// gains Build map and Player View, the tools wrap a row lower, and a window opened a
// moment ago would lie over the buttons that moved (covering the one that closes it).
// It follows the header until the player places it — by dragging it, or by having a
// remembered position.
describe("DraggableWindow — follows the header until the player places it", () => {
  let callbacks: Array<() => void>;
  let disconnects: number;
  const added: HTMLElement[] = [];

  beforeEach(() => {
    callbacks = [];
    disconnects = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          callbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {
          disconnects += 1;
        }
      },
    );
    Object.defineProperty(window, "localStorage", {
      value: plainStorage(),
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    while (added.length) added.pop()!.remove();
  });

  /** A header with one control whose bottom edge can move after the window has opened. */
  function growableHeader(initialBottom: number) {
    let bottom = initialBottom;
    const root = document.createElement("div");
    root.setAttribute("data-header-root", "");
    const button = document.createElement("button");
    button.getBoundingClientRect = () => box(bottom);
    root.appendChild(button);
    document.body.appendChild(root);
    added.push(root);
    return {
      grow(to: number) {
        bottom = to;
        act(() => callbacks.forEach((callback) => callback()));
      },
    };
  }

  it("moves under the controls when the header grows after it opened", () => {
    const header = growableHeader(60);
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("100px");
    header.grow(180);
    expect(windowOf(container).style.top).toBe("184px");
  });

  it("goes back up when the header shrinks again, while it is still unplaced", () => {
    const header = growableHeader(180);
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("184px");
    header.grow(60);
    expect(windowOf(container).style.top).toBe("100px");
  });

  it("stops following once the player has taken hold of it", () => {
    const header = growableHeader(60);
    const { container, getByText } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    fireEvent.mouseDown(getByText("Dice Roller"), { clientX: 150, clientY: 110 });
    fireEvent.mouseUp(document);
    header.grow(180);
    expect(windowOf(container).style.top).toBe("100px");
  });

  it("does not follow a position the player already placed in an earlier visit", () => {
    window.localStorage.setItem("herobyte-window-position-test", JSON.stringify({ x: 40, y: 20 }));
    const header = growableHeader(60);
    const { container } = render(
      <DraggableWindow title="Dice Roller" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    header.grow(180);
    expect(windowOf(container).style.top).toBe("20px");
  });

  it("stops watching the header when the window closes", () => {
    growableHeader(60);
    const { unmount } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(disconnects).toBe(0);
    unmount();
    expect(disconnects).toBeGreaterThan(0);
  });
});
