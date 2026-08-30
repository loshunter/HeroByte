/**
 * My Stuff on the phone.
 *
 * The desktop has had an upload tab in its asset popover since S3; the phone
 * shipped every BUNDLED asset and nothing of the DM's own, so their art needed
 * a desktop. This closes that, through ImageField — the one upload surface the
 * phone already uses everywhere else — rather than a port of the popover.
 *
 * Four things here are load-bearing rather than cosmetic:
 *   - the My Stuff CHIP is offered even when the shelf is empty, because
 *     hiding it until it has something makes the only way to put something in
 *     it unreachable;
 *   - an empty My Stuff must NOT fall through to the Objects swatches, which
 *     is what the bundled-category fallback would otherwise do — a heading
 *     over someone else's assets;
 *   - a successful upload ARMS what was uploaded (a DM uploads in order to
 *     place) and the armed id is `upload:<hash>`, the content-addressed form
 *     the document stores;
 *   - a URL that is not one of this table's assets is REFUSED with a reason.
 *     It cannot be placed: an element stores `upload:<hash>`, so art outside
 *     the content-addressed store has no id to be placed under.
 */

import React from "react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MobileAssetPicker } from "../MobileAssetPicker";

afterEach(() => cleanup());

/** This jsdom's window.localStorage is an inert stub with no methods at all —
 * the brushDeck.test.ts pattern. The My Stuff shelf IS localStorage, so these
 * tests need a functional one. */
beforeEach(() => {
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

  // jsdom fetches no subresources, so a real Image would neither load nor
  // error and the footprint measurement would sit on its 5s bound. Stubbing it
  // keeps these tests fast AND exercises the measured path rather than the
  // timeout's fallback.
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 100;
    naturalHeight = 50;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", FakeImage);
});

const HASH = "a".repeat(64);

function renderPicker(overrides: { selected?: string; onSelect?: (id: string) => void } = {}) {
  const onSelect = overrides.onSelect ?? vi.fn();
  render(
    <MobileAssetPicker
      label="Place"
      selected={overrides.selected ?? "objects:crate"}
      onSelect={onSelect}
      uploadAsset={vi.fn()}
    />,
  );
  return { onSelect };
}

const myStuffChip = () => screen.getByRole("button", { name: /my stuff/i });

describe("MobileAssetPicker — My Stuff", () => {
  it("offers the My Stuff shelf even while it is empty", () => {
    renderPicker();
    expect(myStuffChip()).toBeInTheDocument();
  });

  it("shows the upload field and NOT the bundled fallback when empty", () => {
    renderPicker();
    fireEvent.click(myStuffChip());

    expect(screen.getByLabelText("Upload art")).toBeInTheDocument();
    expect(screen.getByText(/Upload an image to place it/i)).toBeInTheDocument();
    // The empty-category fallback is for BUNDLED shelves. Falling through here
    // would put the Objects swatches under a My Stuff heading.
    expect(screen.queryByRole("button", { name: "Crate" })).toBeNull();
  });

  it("arms the uploaded image, as upload:<hash>", async () => {
    const { onSelect } = renderPicker();
    fireEvent.click(myStuffChip());

    const input = screen.getByLabelText("Upload art");
    fireEvent.change(input, { target: { value: `https://table.example/assets/${HASH}` } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(`upload:${HASH}`));
  });

  it("refuses a URL that is not one of this table's assets, with a reason", async () => {
    const { onSelect } = renderPicker();
    fireEvent.click(myStuffChip());

    const input = screen.getByLabelText("Upload art");
    fireEvent.change(input, { target: { value: "https://example.com/cat.png" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shelves across surfaces: a stored upload appears as a swatch", () => {
    localStorage.setItem(
      "herobyte-my-stuff",
      JSON.stringify([
        {
          hash: HASH,
          name: "Dragon",
          mime: "image/png",
          size: 10,
          addedAt: 1,
          width: 100,
          height: 50,
        },
      ]),
    );
    renderPicker();
    fireEvent.click(myStuffChip());

    expect(screen.getByRole("button", { name: "Dragon" })).toBeInTheDocument();
    expect(screen.queryByText(/Upload an image to place it/i)).toBeNull();
  });

  it("still shows every bundled shelf", () => {
    renderPicker();
    for (const label of [/objects/i, /structures|structs/i, /terrain/i]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
