// Painter's-deck UI behaviour: shelves render for every derived group, click
// arms the family (and records a recent), search narrows the deck, and
// right-click pins. Thumbnails are mocked inert — the bake pipeline has its
// own test — so every tile renders its flat-fill fallback here.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("../brushThumbnails", () => ({
  peekBrushThumbnail: () => null,
  requestBrushThumbnails: vi.fn(),
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));

import { MapEditBrushDeck } from "../MapEditBrushDeck";

/** This jsdom's window.localStorage is an inert stub — install a functional
 * in-memory one so pins/recents behave (the session.test.ts pattern). */
function installMemoryStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
}

describe("MapEditBrushDeck", () => {
  beforeEach(installMemoryStorage);

  it("renders every material shelf with its tiles", () => {
    render(<MapEditBrushDeck selected="grass" onSelect={vi.fn()} />);
    for (const shelf of ["Ground", "Water", "Stone", "Wood", "Roofs", "Canopy"]) {
      expect(screen.getByText(shelf)).toBeTruthy();
    }
    expect(screen.getByTitle("Grass")).toBeTruthy();
    expect(screen.getByTitle("Stone Wall")).toBeTruthy();
    expect(screen.getByTitle("Blossom Canopy")).toBeTruthy();
  });

  it("marks the armed family selected and names it in the readout", () => {
    render(<MapEditBrushDeck selected="dirt" onSelect={vi.fn()} />);
    expect(screen.getByTitle("Dirt").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTitle("Grass").getAttribute("aria-pressed")).toBe("false");
    // The armed family stays readable even when search/scroll hides its tile.
    expect(screen.getByText("Dirt", { selector: "span" })).toBeTruthy();
  });

  it("arms the clicked family and records it as a recent", () => {
    const onSelect = vi.fn();
    render(<MapEditBrushDeck selected="dirt" onSelect={onSelect} />);
    fireEvent.click(screen.getByTitle("Grass"));
    expect(onSelect).toHaveBeenCalledWith("grass");
    // The Recent shelf appears and the pick persists across reloads.
    expect(screen.getByText("Recent")).toBeTruthy();
    expect(window.localStorage.getItem("herobyte:brush-deck:recents")).toContain("grass");
  });

  it("search narrows the deck to matching brushes", () => {
    render(<MapEditBrushDeck selected="grass" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search brushes"), { target: { value: "oak" } });
    expect(screen.getByTitle("Oak Floor")).toBeTruthy();
    expect(screen.queryByTitle("Grass")).toBeNull();
    expect(screen.queryByText("Ground")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search brushes"), { target: { value: "zzz" } });
    expect(screen.getByText(/No brush matches/)).toBeTruthy();
  });

  it("right-click pins and unpins a brush", () => {
    render(<MapEditBrushDeck selected="grass" onSelect={vi.fn()} />);
    fireEvent.contextMenu(screen.getByTitle("Grass"));
    expect(screen.getByText("★ Pinned")).toBeTruthy();
    // Pinned row + Ground shelf both show the family now.
    expect(screen.getAllByTitle("Grass")).toHaveLength(2);
    fireEvent.contextMenu(screen.getAllByTitle("Grass")[0]!);
    expect(screen.queryByText("★ Pinned")).toBeNull();
  });

  it("hover reveals the family's grammar note", () => {
    render(<MapEditBrushDeck selected="grass" onSelect={vi.fn()} />);
    fireEvent.mouseEnter(screen.getByTitle("Dirt"));
    expect(screen.getByText("Bare earth with pebble key clusters")).toBeTruthy();
    fireEvent.mouseLeave(screen.getByTitle("Dirt"));
    expect(screen.queryByText("Bare earth with pebble key clusters")).toBeNull();
  });

  it("drops the hover card when a search filters the hovered tile away", () => {
    // The tile unmounts without a mouseleave — the card must not linger.
    render(<MapEditBrushDeck selected="grass" onSelect={vi.fn()} />);
    fireEvent.mouseEnter(screen.getByTitle("Dirt"));
    expect(screen.getByText("Bare earth with pebble key clusters")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search brushes"), { target: { value: "oak" } });
    expect(screen.queryByText("Bare earth with pebble key clusters")).toBeNull();
  });

  it("contains every keystroke in the search box away from global shortcuts", () => {
    // Escape closes the whole tool via a window keydown listener
    // (useToolMode), Ctrl+Z undoes the LIVE map (useMapEditHotkeys), and
    // Backspace fires delete-selected (useKeyboardShortcuts) — none of them
    // may see keys typed into the deck search. Escape clears the query only.
    const onWindowKeyDown = vi.fn();
    window.addEventListener("keydown", onWindowKeyDown);
    try {
      render(<MapEditBrushDeck selected="grass" onSelect={vi.fn()} />);
      const search = screen.getByLabelText("Search brushes");
      fireEvent.change(search, { target: { value: "oak" } });
      fireEvent.keyDown(search, { key: "Backspace" });
      fireEvent.keyDown(search, { key: "z", ctrlKey: true });
      fireEvent.keyDown(search, { key: "Escape" });
      expect(onWindowKeyDown).not.toHaveBeenCalled();
      // Escape cleared the query, so the full deck is back.
      expect(screen.getByTitle("Grass")).toBeTruthy();
    } finally {
      window.removeEventListener("keydown", onWindowKeyDown);
    }
  });
});
