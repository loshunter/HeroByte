import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TableMenu } from "../TableMenu";
import type { TableMenuProps } from "../tableMenuProps";
import { __resetDMMenuRequestsForTests, takeDMMenuTabRequest } from "../menuRequest";
import { __resetJuiceSettingsForTests } from "../../juice/juiceSettings";
import { installMemoryStorage } from "../../../test-utils/memoryStorage";

vi.mock("../../juice/sfxEngine", () => ({ sfxEngine: { play: vi.fn(), resume: vi.fn() } }));

const menuProps = (overrides: Partial<TableMenuProps> = {}): TableMenuProps => ({
  uid: "0123456789abcdef",
  tableName: "Sunday Game",
  isPublicTable: false,
  isConnected: true,
  isDM: false,
  roleKnown: true,
  onToggleDM: vi.fn(),
  crtFilter: false,
  onCrtFilterChange: vi.fn(),
  ...overrides,
});

const button = () => screen.getByRole("button", { name: /^Table menu:/ });
const popover = () => screen.getByRole("dialog", { name: "Table menu" });
const open = () => fireEvent.click(button());

beforeEach(() => {
  installMemoryStorage();
  __resetDMMenuRequestsForTests();
  __resetJuiceSettingsForTests({ motion: "full", muted: false, volume: 0.6 });
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  document.documentElement.removeAttribute("data-motion");
});

describe("TableMenu — the popover follows the HEADER", () => {
  it("re-anchors under the header when the header changes size, not only the button", () => {
    // The popover hangs from the header's bottom edge. A DM's elevation wraps the tools a
    // row lower without touching the button's own box (it is capped at 200px), so the
    // header itself is what has to be watched.
    const callbacks: Array<() => void> = [];
    const observed: Element[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          callbacks.push(callback);
        }
        observe(element: Element) {
          observed.push(element);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      let headerBottom = 100;
      const { container } = render(
        <div data-header-root>
          <div>
            <TableMenu menu={menuProps()} />
          </div>
        </div>,
      );
      const header = container.querySelector("[data-header-root]") as HTMLElement;
      header.getBoundingClientRect = () => ({ bottom: headerBottom }) as DOMRect;
      open();
      expect(popover().style.top).toBe("106px");
      expect(observed).toContain(header);

      headerBottom = 140;
      act(() => callbacks.forEach((callback) => callback()));
      expect(popover().style.top).toBe("146px");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("TableMenu — the header's Table button", () => {
  it("names the table, your role and the connection on the button", () => {
    render(<TableMenu menu={menuProps()} />);
    expect(button()).toHaveAccessibleName("Table menu: Sunday Game, Player, online");
    expect(button()).toHaveTextContent("Sunday Game");
    expect(button()).toHaveTextContent("Player");
  });

  it("says Dungeon Master for a DM and OFFLINE when the server is lost", () => {
    const { rerender } = render(<TableMenu menu={menuProps({ isDM: true })} />);
    expect(button()).toHaveAccessibleName("Table menu: Sunday Game, Dungeon Master, online");
    expect(button()).toHaveTextContent("DM");

    rerender(<TableMenu menu={menuProps({ isConnected: false })} />);
    expect(button()).toHaveAccessibleName("Table menu: Sunday Game, Player, offline");
    expect(button()).toHaveTextContent("OFFLINE");
  });

  it("does not name a role it cannot know during a reconnect", () => {
    render(<TableMenu menu={menuProps({ isDM: true, roleKnown: false })} />);
    expect(button()).not.toHaveAccessibleName(/Dungeon Master/);
    expect(button()).toHaveTextContent("…");
  });

  it("falls back to the name this browser remembered, then the code, before the snapshot arrives", () => {
    window.history.replaceState(null, "", "/?room=table-abc123");
    localStorage.setItem(
      "herobyte-room-directory",
      JSON.stringify([{ roomId: "table-abc123", lastJoined: 1, name: "Remembered Name" }]),
    );
    const { unmount } = render(<TableMenu menu={menuProps({ tableName: undefined })} />);
    expect(button()).toHaveTextContent("Remembered Name");
    unmount();

    localStorage.clear();
    render(<TableMenu menu={menuProps({ tableName: undefined })} />);
    expect(button()).toHaveTextContent("table-abc123");
  });

  it("opens a dialog portalled out of the header, and closes on Escape or an outside press", () => {
    const { container } = render(<TableMenu menu={menuProps()} />);
    expect(screen.queryByRole("dialog", { name: "Table menu" })).toBeNull();
    open();
    expect(button()).toHaveAttribute("aria-expanded", "true");
    // Portalled: the header is a fixed stacking context at z-index 100.
    expect(container.contains(popover())).toBe(false);
    expect(document.body.contains(popover())).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(screen.queryByRole("dialog", { name: "Table menu" })).toBeNull();

    open();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Table menu" })).toBeNull();
  });
});

describe("TableMenu — the window's own resize", () => {
  it("re-anchors on a resize too: the edge follows the header, the cap follows the screen", () => {
    // jsdom has no ResizeObserver, so the window's resize event is the only way this can hear.
    let headerBottom = 100;
    const before = Object.getOwnPropertyDescriptor(window, "innerHeight")!;
    Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });
    try {
      const { container } = render(
        <div data-header-root>
          <div>
            <TableMenu menu={menuProps()} />
          </div>
        </div>,
      );
      const header = container.querySelector("[data-header-root]") as HTMLElement;
      header.getBoundingClientRect = () => ({ bottom: headerBottom }) as DOMRect;
      open();
      expect(popover().style.top).toBe("106px");
      expect(popover().style.maxHeight).toBe("482px");

      headerBottom = 140;
      Object.defineProperty(window, "innerHeight", { value: 500, configurable: true });
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(popover().style.top).toBe("146px");
      expect(popover().style.maxHeight).toBe("342px");
    } finally {
      Object.defineProperty(window, "innerHeight", before);
    }
  });
});

describe("TableMenu — where it hangs, and how tall it may be", () => {
  // jsdom has no layout: a header whose frame ends at y=100, and a window of a chosen height.
  const inShortWindow = (windowHeight: number, run: () => void) => {
    const header = document.createElement("div");
    header.setAttribute("data-header-root", "");
    header.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 100,
        left: 0,
        right: 1280,
        width: 1280,
        height: 100,
        x: 0,
        y: 0,
      }) as DOMRect;
    document.body.appendChild(header);
    const before = Object.getOwnPropertyDescriptor(window, "innerHeight")!;
    Object.defineProperty(window, "innerHeight", { value: windowHeight, configurable: true });
    try {
      render(<TableMenu menu={menuProps()} />, { container: header });
      open();
      run();
    } finally {
      Object.defineProperty(window, "innerHeight", before);
      header.remove();
    }
  };

  it("hangs 6px under the header's bottom edge and is capped to the screen left below it", () => {
    inShortWindow(480, () => {
      // 100 + 6 from the top; 480 - 106 - 12 = 362 of height.
      expect(popover().style.top).toBe("106px");
      expect(popover().style.maxHeight).toBe("362px");
      // The panel inside scrolls: without that the cap would clip Preferences and Your ID.
      expect(popover().firstElementChild).toHaveStyle({ overflowY: "auto" });
    });
  });

  it("never leaves less than 160px of it, however short the window", () => {
    inShortWindow(200, () => {
      expect(popover().style.maxHeight).toBe("160px");
    });
  });
});

describe("TableMenu — what is inside", () => {
  it("shows the table, the connection, your role, Preferences and your ID", () => {
    render(<TableMenu menu={menuProps()} />);
    open();
    const dialog = within(popover());
    expect(dialog.getByRole("heading", { name: "Sunday Game" })).toBeInTheDocument();
    expect(dialog.getByRole("status")).toHaveTextContent("ONLINE");
    expect(dialog.getByText("You are a player.")).toBeInTheDocument();
    expect(dialog.getByRole("group", { name: "Display" })).toBeInTheDocument();
    expect(dialog.getByRole("group", { name: "Sound & motion" })).toBeInTheDocument();
    const id = dialog.getByText("Your ID 01234567…");
    expect(id).toBeInTheDocument();
    // Only the start of the ID: the rest would claim a seat, so it is in no tooltip, and on no page.
    expect(id).not.toHaveAttribute("title");
    expect(document.body.innerHTML).not.toContain("89abcdef");
  });

  it("Enter DM mode closes the menu first, so nothing is left behind the password dialog", () => {
    const onToggleDM = vi.fn();
    render(<TableMenu menu={menuProps({ onToggleDM })} />);
    open();
    fireEvent.click(within(popover()).getByRole("button", { name: "Enter DM mode" }));
    expect(onToggleDM).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole("dialog", { name: "Table menu" })).toBeNull();
  });

  it("offers a player no Table settings: those are the DM menu's", () => {
    render(<TableMenu menu={menuProps()} />);
    open();
    expect(screen.queryByRole("button", { name: /Table settings/ })).toBeNull();
  });

  it("gives a DM Leave DM mode and Table settings, which asks the DM menu for its Table tab", () => {
    const onToggleDM = vi.fn();
    render(<TableMenu menu={menuProps({ isDM: true, onToggleDM })} />);
    open();
    fireEvent.click(within(popover()).getByRole("button", { name: /Table settings/ }));
    expect(takeDMMenuTabRequest()).toBe("table");
    expect(screen.queryByRole("dialog", { name: "Table menu" })).toBeNull();

    open();
    fireEvent.click(within(popover()).getByRole("button", { name: "Leave DM mode" }));
    expect(onToggleDM).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("holds back Table settings while the role is unknown, even if isDM reads true", () => {
    render(<TableMenu menu={menuProps({ isDM: true, roleKnown: false })} />);
    open();
    expect(screen.queryByRole("button", { name: /Table settings/ })).toBeNull();
    expect(within(popover()).getByText("Reconnecting…")).toBeInTheDocument();
  });

  it("carries the CRT preference through to the same handler the layouts draw from", () => {
    const onCrtFilterChange = vi.fn();
    render(<TableMenu menu={menuProps({ onCrtFilterChange })} />);
    open();
    fireEvent.click(within(popover()).getByRole("button", { name: "📺 CRT" }));
    expect(onCrtFilterChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});
