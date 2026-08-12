/**
 * POPULATE on a phone.
 *
 * The message is three-state and that is the load-bearing part. canPopulate is
 * `regionIsLive && !saving`, so a two-state message spends the ~300ms after
 * every placement telling the DM to draw a room they just drew. The three
 * states must be three DIFFERENT strings, which is why this asserts inequality
 * rather than three literals — a literal set passes just as well when two of
 * them are accidentally the same sentence.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MobilePopulateBlock } from "../MobilePopulateBlock";
import type { MapEditToolbarProps } from "../../mapEditTypes";

afterEach(() => cleanup());

const bag = (overrides: Record<string, unknown> = {}) =>
  ({
    saving: false,
    canPopulate: true,
    populateCategory: "objects",
    onSelectPopulateCategory: vi.fn(),
    populateDensity: "medium",
    onSelectPopulateDensity: vi.fn(),
    onPopulate: vi.fn(),
    ...overrides,
  }) as unknown as MapEditToolbarProps;

const statusOf = (props: Record<string, unknown>): string => {
  const { unmount } = render(<MobilePopulateBlock {...bag(props)} />);
  const text = screen.getByTestId("mobile-populate-status").textContent ?? "";
  unmount();
  return text;
};

describe("POPULATE on a phone", () => {
  it("distinguishes saving from armed from nothing-to-fill", () => {
    const saving = statusOf({ saving: true, canPopulate: false });
    const armed = statusOf({ saving: false, canPopulate: true });
    const idle = statusOf({ saving: false, canPopulate: false });

    expect(new Set([saving, armed, idle]).size).toBe(3);
    // The armed one is the sentence that names the adjacency rule — the whole
    // reason this block exists, since the rule is otherwise only implied by
    // ghosts on the canvas.
    expect(armed).toMatch(/just drew/i);
    expect(idle).toMatch(/draw a room or hallway first/i);
  });

  it("offers the dials only once there is a region to fill", () => {
    const { unmount } = render(<MobilePopulateBlock {...bag({ canPopulate: false })} />);
    expect(screen.queryByText("From")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Populate/i })).toBeDisabled();
    unmount();

    render(<MobilePopulateBlock {...bag({ canPopulate: true })} />);
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("How much")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Populate/i })).toBeEnabled();
  });

  it("wires the category, the density and the fill to the bag", () => {
    const props = bag();
    render(<MobilePopulateBlock {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Terrain/i }));
    expect(props.onSelectPopulateCategory).toHaveBeenCalledWith("terrain");

    fireEvent.click(screen.getByRole("button", { name: /Low/i }));
    expect(props.onSelectPopulateDensity).toHaveBeenCalledWith("low");

    fireEvent.click(screen.getByRole("button", { name: /✨ Populate/i }));
    expect(props.onPopulate).toHaveBeenCalledTimes(1);
  });

  it("cannot be fired while a placement is still in flight", () => {
    const props = bag({ saving: true, canPopulate: false });
    render(<MobilePopulateBlock {...props} />);

    expect(screen.getByRole("button", { name: /Populate/i })).toBeDisabled();
    expect(screen.getByTestId("mobile-populate-status")).toHaveTextContent(/saving/i);
  });
});
