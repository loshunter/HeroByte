/**
 * The phone's brush deck — the two shelves that make it a deck rather than a
 * browser.
 *
 * The load-bearing claim is not "a shelf appears". It is that the shelf is the
 * SAME memory the desktop deck keeps: `brushDeck.ts` writes pins and recents to
 * two localStorage keys, and if the phone kept its own the two surfaces would
 * be separate memories that quietly disagreed — a DM would pin Flagstone at the
 * desk, pick up the tablet, and find the star row empty.
 *
 * So the seeding tests write the RAW keys, the way a desktop session would have
 * left them, rather than calling the loader. A test that seeded through
 * `toggleBrushPin` would pass just as happily against a phone-only key.
 */

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MobileFloorPicker } from "../MobileFloorPicker";
import { PAINT_FAMILIES } from "../../mapEditFamilies";
import { BRUSH_GROUP_LABELS } from "../../brushDeck";

const PINS_KEY = "herobyte:brush-deck:pins";
const RECENTS_KEY = "herobyte:brush-deck:recents";

/** This jsdom's window.localStorage is an inert stub with no methods at all, so
 * storage tests install a functional in-memory one — the brushDeck.test.ts
 * pattern, kept identical on purpose so the two files describe the same world. */
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

/** Two real families off different shelves — the ★ row's whole point is that it
 * crosses materials, so a pair from one shelf would not exercise it. */
const first = PAINT_FAMILIES[0]!;
const other = PAINT_FAMILIES.find((entry) => entry.material !== first.material)!;

const picker = (selected = first.family, onSelect = vi.fn()) => {
  render(<MobileFloorPicker label="Paint" selected={selected} onSelect={onSelect} />);
  return onSelect;
};

/** The chip row, which is the shelves — the pin button is a sheet BUTTON and
 * deliberately not a chip, so this selector cannot pick it up by accident. */
const shelfNames = () =>
  [...document.querySelectorAll(".mobile-chip")].map((chip) => chip.textContent);

/** The families on the open shelf live in the nested swatch grid. */
const openShelfFamilies = () =>
  within(document.querySelector(".mobile-tool-sheet__grid") as HTMLElement)
    .getAllByRole("button")
    .map((button) => button.textContent);

beforeEach(() => {
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
});

describe("the phone's brush deck memory", () => {
  it("shows neither memory shelf when there is nothing remembered", () => {
    picker();
    expect(shelfNames()).not.toContain("★");
    expect(shelfNames()).not.toContain("Recent");
  });

  it("surfaces pins a DESKTOP session left behind, under their own shelf", () => {
    window.localStorage.setItem(PINS_KEY, JSON.stringify([other.family]));
    picker();

    fireEvent.click(screen.getByRole("button", { name: "★" }));
    expect(openShelfFamilies()).toEqual([other.name]);
  });

  it("surfaces recents a desktop session left behind, newest first", () => {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify([other.family, first.family]));
    picker();

    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    expect(openShelfFamilies()).toEqual([other.name, first.name]);
  });

  it("records a pick as a recent, in the key the desktop reads", () => {
    const onSelect = picker(first.family);

    // Open the MATERIAL shelf the armed family is not on, so the pick is a real
    // change and there is no Recent shelf yet to lean on.
    fireEvent.click(screen.getByRole("button", { name: BRUSH_GROUP_LABELS[other.material] }));
    fireEvent.click(screen.getByRole("button", { name: other.name }));

    expect(onSelect).toHaveBeenCalledWith(other.family);
    expect(JSON.parse(window.localStorage.getItem(RECENTS_KEY)!)).toEqual([other.family]);
  });

  it("pins and unpins the ARMED family, and writes the key the desktop reads", () => {
    picker(first.family);

    // Named, not "Pin": the armed family can be off the open shelf entirely.
    const pin = screen.getByRole("button", { name: `☆ Pin ${first.name}` });
    expect(pin).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(pin);

    expect(JSON.parse(window.localStorage.getItem(PINS_KEY)!)).toEqual([first.family]);
    expect(shelfNames()).toContain("★");
    const unpin = screen.getByRole("button", { name: `★ Unpin ${first.name}` });
    expect(unpin).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(unpin);
    expect(JSON.parse(window.localStorage.getItem(PINS_KEY)!)).toEqual([]);
    // The shelf goes with the last pin — an empty ★ row would read as broken.
    expect(shelfNames()).not.toContain("★");
  });

  it("falls back off a memory shelf the moment it empties, rather than showing nothing", () => {
    window.localStorage.setItem(PINS_KEY, JSON.stringify([first.family]));
    picker(first.family);

    fireEvent.click(screen.getByRole("button", { name: "★" }));
    expect(openShelfFamilies()).toEqual([first.name]);

    fireEvent.click(screen.getByRole("button", { name: `★ Unpin ${first.name}` }));
    // Not an empty grid: the open shelf falls back to the armed family's own
    // material, which is the only shelf guaranteed to contain something.
    expect(openShelfFamilies().length).toBeGreaterThan(0);
    expect(openShelfFamilies()).toContain(first.name);
  });

  it("survives junk in storage instead of taking the sheet down with it", () => {
    // readFamilyList already drops non-arrays and unknown families; this pins
    // that the picker renders at all, because the sheet has no error boundary
    // and a throw here would blank the whole tool.
    window.localStorage.setItem(PINS_KEY, "{not json");
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(["terrain:not-a-real-family", 7]));
    picker();

    expect(shelfNames()).not.toContain("★");
    expect(shelfNames()).not.toContain("Recent");
    expect(openShelfFamilies().length).toBeGreaterThan(0);
  });
});
