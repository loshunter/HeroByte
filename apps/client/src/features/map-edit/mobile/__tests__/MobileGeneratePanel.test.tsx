/**
 * GENERATE on a phone.
 *
 * The thing under test is not the dials — theme, density and the seed were
 * already touch-shaped on desktop. It is the REFUSAL. canGenerate is false for
 * four distinct reasons, and until this slice a DM got a dead button for all
 * four with nothing on screen saying why, because the one place the reason was
 * spoken was a toast inside a handler the disabled button could never call.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MobileGeneratePanel } from "../MobileGeneratePanel";
import type { MapEditToolbarProps } from "../../mapEditTypes";

afterEach(() => cleanup());

const TOO_SMALL = "Drag at least 20×20 cells — a dungeon needs room for rooms AND the halls.";
const TOO_BIG = "That area is too big (max 16384 cells) — drag a smaller region.";

const bag = (overrides: Record<string, unknown> = {}) =>
  ({
    activeSubTool: "generate",
    busy: false,
    saving: false,
    generateParams: { theme: "stone", density: "medium", seed: 4242 },
    onGenerateParamsChange: vi.fn(),
    onRerollSeed: vi.fn(),
    onGenerate: vi.fn(),
    canGenerate: true,
    generateRegion: { cols: 24, rows: 30 },
    generateHint: null,
    ...overrides,
  }) as unknown as MapEditToolbarProps;

// By testid, not by name: the label legitimately changes to "⏳ Working…" while
// a command is in flight, and a name-based locator would silently stop finding
// the button in exactly the state this file exists to assert on.
const generateButton = () => screen.getByTestId("mobile-generate-fire");

describe("GENERATE on a phone", () => {
  it("never refuses silently — every disabled state says why on screen", () => {
    // Each case pairs a refusal with the text that explains it. A dead button
    // with nothing beside it is the failure this panel exists to prevent.
    const cases: { props: Record<string, unknown>; explains: RegExp }[] = [
      { props: { canGenerate: false, generateRegion: null }, explains: /Drag a region/i },
      {
        props: { canGenerate: false, generateHint: TOO_SMALL },
        explains: /at least 20/i,
      },
      // `saving`, NOT `busy`. busy means the create/open/bind round-trip and is
      // false by the time this panel can render at all, so the old wiring was
      // dead code and this case passed only because the fixture forced it.
      { props: { canGenerate: false, saving: true }, explains: /Working/i },
    ];

    for (const { props, explains } of cases) {
      const { unmount } = render(<MobileGeneratePanel {...bag(props)} />);
      expect(generateButton()).toBeDisabled();
      expect(screen.getByText(explains)).toBeInTheDocument();
      unmount();
    }
  });

  it("gives a DIFFERENT reason for a region too small and one too big", () => {
    // Without this, a hint hard-coded to a single sentence passes the case
    // above for every refusal and tells the DM the wrong thing twice.
    const { unmount } = render(
      <MobileGeneratePanel {...bag({ canGenerate: false, generateHint: TOO_SMALL })} />,
    );
    const small = screen.getByTestId("mobile-generate-hint").textContent;
    unmount();

    render(<MobileGeneratePanel {...bag({ canGenerate: false, generateHint: TOO_BIG })} />);
    const big = screen.getByTestId("mobile-generate-hint").textContent;

    expect(small).toBeTruthy();
    expect(big).toBeTruthy();
    expect(big).not.toBe(small);
  });

  it("says nothing when there is nothing to say", () => {
    render(<MobileGeneratePanel {...bag()} />);

    expect(generateButton()).toBeEnabled();
    expect(screen.queryByTestId("mobile-generate-hint")).not.toBeInTheDocument();
    expect(screen.getByText(/Region: 24 × 30 cells/)).toBeInTheDocument();
  });

  it("wires the dials, the reroll and the fire button to the bag", () => {
    const props = bag();
    render(<MobileGeneratePanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Wood/i }));
    expect(props.onGenerateParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "wood", density: "medium", seed: 4242 }),
    );

    fireEvent.click(screen.getByRole("button", { name: /High/i }));
    expect(props.onGenerateParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ density: "high", theme: "stone" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Roll a new seed/i }));
    expect(props.onRerollSeed).toHaveBeenCalledTimes(1);

    fireEvent.click(generateButton());
    expect(props.onGenerate).toHaveBeenCalledTimes(1);
  });

  it("shows the seed, because the same seed rebuilds the same dungeon", () => {
    render(<MobileGeneratePanel {...bag()} />);
    expect(screen.getByTestId("mobile-generate-seed")).toHaveTextContent("4242");
  });

  it("warns that generated doors are not secret — the recipe cannot make one", () => {
    render(<MobileGeneratePanel {...bag()} />);
    expect(screen.getByText(/No secret doors/i)).toBeInTheDocument();
  });
});
