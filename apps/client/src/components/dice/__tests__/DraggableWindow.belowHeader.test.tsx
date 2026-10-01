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

/** Press the title bar at (150, 110), move by (dx, dy), and let go — a click when both are 0. */
function drag(title: HTMLElement, dx: number, dy: number) {
  fireEvent.mouseDown(title, { clientX: 150, clientY: 110 });
  if (dx !== 0 || dy !== 0) fireEvent.mouseMove(document, { clientX: 150 + dx, clientY: 110 + dy });
  fireEvent.mouseUp(document);
}

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

  it("never moves a window the player has already placed below the header's controls", () => {
    mount(header([180]));
    window.localStorage.setItem("herobyte-window-position-test", JSON.stringify({ x: 40, y: 300 }));
    const { container } = render(
      <DraggableWindow title="Dice Roller" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("300px");
  });

  // A remembered place is not a licence to lie over the header: the Dice and Chat buttons are
  // the way to close the window, and a window over them cannot be closed by them. And a place
  // over the controls was often never chosen: until a click on a title bar stopped saving, any
  // click did — at the window's default y, which a DM's taller header has since grown past.
  it("lifts a remembered place that lies over the header's controls, to just under them", () => {
    mount(header([180]));
    window.localStorage.setItem("herobyte-window-position-test", JSON.stringify({ x: 40, y: 20 }));
    const { container } = render(
      <DraggableWindow title="Dice Roller" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("184px");
    expect(windowOf(container).style.left).toBe("40px");
  });

  it("lifts the default y an old title-bar click saved, over a DM's three-row header", () => {
    mount(header([60, 90, 117]));
    window.localStorage.setItem(
      "herobyte-window-position-test",
      JSON.stringify({ x: 860, y: 100 }),
    );
    const { container } = render(
      <DraggableWindow title="Chat & Rolls" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("121px");
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

  // It follows the header DOWN and never back up. A reconnect takes a DM's Build map and
  // Player View out of the header (a role the page cannot know is not a DM) and brings them
  // back, so a header that shrinks usually grows again in a moment; a window that went up and
  // down with it would be a moving target for the whole outage. A window left one row low
  // when the tools really are gone costs a gap; one that bobs costs the player the click.
  it("stays where it is when the header shrinks again", () => {
    const header = growableHeader(180);
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("184px");
    header.grow(60);
    expect(windowOf(container).style.top).toBe("184px");
  });

  it("holds still through a shrink and a regrow, as a reconnect blip makes the header do", () => {
    const header = growableHeader(180);
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    const tops: string[] = [];
    for (const bottom of [60, 180, 60, 180]) {
      header.grow(bottom);
      tops.push(windowOf(container).style.top);
    }
    expect(tops).toEqual(["184px", "184px", "184px", "184px"]);
  });

  it("still goes lower when the header outgrows where it stopped", () => {
    const header = growableHeader(180);
    const { container } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    header.grow(60);
    header.grow(240);
    expect(windowOf(container).style.top).toBe("244px");
  });

  it("stops following once the player has dragged it", () => {
    const header = growableHeader(60);
    const { container, getByText } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    drag(getByText("Dice Roller"), 40, 30);
    expect(windowOf(container).style.top).toBe("30px");
    header.grow(180);
    expect(windowOf(container).style.top).toBe("30px");
  });

  // A click on the title bar is how a drag starts, and also just a click. Only a drag is the
  // player placing the window; a click that stopped it following (and saved its place, so no
  // later visit followed either) would leave it under the header row a DM gains on entering.
  it("keeps following after a plain click on the title bar", () => {
    const header = growableHeader(60);
    const { container, getByText } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    drag(getByText("Dice Roller"), 0, 0);
    header.grow(180);
    expect(windowOf(container).style.top).toBe("184px");
  });

  it("treats a nudge of a pixel or two as a click, not a drag", () => {
    const header = growableHeader(60);
    const { container, getByText } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    drag(getByText("Dice Roller"), 2, 1);
    expect(windowOf(container).style.top).toBe("100px");
    header.grow(180);
    expect(windowOf(container).style.top).toBe("184px");
  });

  it("remembers a dragged place, and nothing for a click", () => {
    growableHeader(60);
    const key = "herobyte-window-position-test";
    const { getByText, rerender } = render(
      <DraggableWindow title="Dice Roller" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    drag(getByText("Dice Roller"), 0, 0);
    expect(window.localStorage.getItem(key)).toBeNull();

    drag(getByText("Dice Roller"), 40, 30);
    rerender(
      <DraggableWindow title="Dice Roller" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(JSON.parse(window.localStorage.getItem(key) ?? "null")).toEqual({ x: 40, y: 30 });
  });

  it("does not follow a position placed below the controls in an earlier visit", () => {
    window.localStorage.setItem("herobyte-window-position-test", JSON.stringify({ x: 40, y: 100 }));
    const header = growableHeader(60);
    const { container } = render(
      <DraggableWindow title="Dice Roller" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("100px");
    header.grow(180);
    expect(windowOf(container).style.top).toBe("100px");
  });

  it("follows the header like a fresh window when its remembered place was over the controls", () => {
    // Lifted at the start, it was never a place worth keeping: it goes on down with the header,
    // and (like every window) never back up.
    window.localStorage.setItem("herobyte-window-position-test", JSON.stringify({ x: 40, y: 20 }));
    const header = growableHeader(120);
    const { container } = render(
      <DraggableWindow title="Dice Roller" storageKey="test" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    expect(windowOf(container).style.top).toBe("124px");
    header.grow(200);
    expect(windowOf(container).style.top).toBe("204px");
    header.grow(120);
    expect(windowOf(container).style.top).toBe("204px");
  });

  // A browser resize clamps a window that has ended up off the screen, and used to SAVE the
  // clamped place whether or not the player had ever placed it. A saved place is read back as
  // placed, so a window the player never touched would never follow the header again.
  describe("a browser resize", () => {
    const resizeTo = (width: number) => {
      Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });
    };
    let originalWidth: number;
    beforeEach(() => {
      originalWidth = window.innerWidth;
    });
    afterEach(() => {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
    });
    const KEY = "herobyte-window-position-t";

    it("clamps a window that is off the screen, but remembers nothing for one the player never placed", () => {
      const header = growableHeader(60);
      Object.defineProperty(window, "innerWidth", { value: 1920, configurable: true });
      const { container, unmount } = render(
        <DraggableWindow title="Dice Roller" storageKey="t" initialX={1500} initialY={100}>
          <div>Content</div>
        </DraggableWindow>,
      );

      resizeTo(960);
      expect(windowOf(container).style.left).toBe("760px");
      expect(window.localStorage.getItem(KEY)).toBeNull();

      // So it is still unplaced when it next opens, and still follows the header.
      unmount();
      const again = render(
        <DraggableWindow title="Dice Roller" storageKey="t" initialX={760} initialY={100}>
          <div>Content</div>
        </DraggableWindow>,
      );
      header.grow(180);
      expect(windowOf(again.container).style.top).toBe("184px");
    });

    it("remembers the clamped place of a window the player HAS placed", () => {
      growableHeader(60);
      Object.defineProperty(window, "innerWidth", { value: 1920, configurable: true });
      const { container, getByText } = render(
        <DraggableWindow title="Dice Roller" storageKey="t" initialX={100} initialY={100}>
          <div>Content</div>
        </DraggableWindow>,
      );
      // Dragged out to x = 1500 (jsdom has no layout, so the grab offset is the press point and
      // the window lands where the move takes it).
      drag(getByText("Dice Roller"), 1500, 0);
      expect(windowOf(container).style.left).toBe("1500px");

      resizeTo(960);

      expect(windowOf(container).style.left).toBe("760px");
      expect(JSON.parse(window.localStorage.getItem(KEY) ?? "null").x).toBe(760);
    });
  });

  // The slop is three pixels: a move of exactly three is a drag, a bit under is a click.
  it("counts a move of exactly three pixels as a drag, and 2.8 as a click", () => {
    const header = growableHeader(60);
    const { container, getByText, unmount } = render(
      <DraggableWindow title="Dice Roller" initialY={100}>
        <div>Content</div>
      </DraggableWindow>,
    );
    drag(getByText("Dice Roller"), 2, 2);
    header.grow(180);
    expect(windowOf(container).style.top).toBe("184px");
    unmount();

    for (const [dx, dy] of [
      [3, 0],
      [0, 3],
      [4, 0],
    ] as const) {
      const fresh = growableHeader(60);
      const view = render(
        <DraggableWindow title="Dice Roller" initialY={100}>
          <div>Content</div>
        </DraggableWindow>,
      );
      drag(view.getByText("Dice Roller"), dx, dy);
      fresh.grow(180);
      expect(windowOf(view.container).style.top, `a ${dx},${dy} move`).not.toBe("184px");
      view.unmount();
    }
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
