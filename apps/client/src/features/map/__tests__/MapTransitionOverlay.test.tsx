import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapTransitionOverlay } from "../MapTransitionOverlay";

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MapTransitionOverlay", () => {
  it("fires ONLY on a defined→different-defined scene change (the full trigger matrix)", () => {
    mockReducedMotion(false);
    // undefined → A: first bind / reload — no wipe.
    const { rerender } = render(<MapTransitionOverlay sourceDocumentId={undefined} />);
    rerender(<MapTransitionOverlay sourceDocumentId="doc-a" />);
    expect(screen.queryByTestId("map-transition-overlay")).toBeNull();

    // A → A: live edits, undo, publish of the live doc — no wipe.
    rerender(<MapTransitionOverlay sourceDocumentId="doc-a" />);
    expect(screen.queryByTestId("map-transition-overlay")).toBeNull();

    // A → B: travel/rebind/publish-of-another/session-load — WIPE.
    rerender(<MapTransitionOverlay sourceDocumentId="doc-b" />);
    expect(screen.getByTestId("map-transition-overlay")).toBeInTheDocument();
  });

  it("skips entirely under prefers-reduced-motion — the information IS the new map", () => {
    mockReducedMotion(true);
    const { rerender } = render(<MapTransitionOverlay sourceDocumentId="doc-a" />);
    rerender(<MapTransitionOverlay sourceDocumentId="doc-b" />);
    expect(screen.queryByTestId("map-transition-overlay")).toBeNull();
  });

  it("never intercepts input and clears itself when the animation ends", () => {
    mockReducedMotion(false);
    const { rerender } = render(<MapTransitionOverlay sourceDocumentId="doc-a" />);
    rerender(<MapTransitionOverlay sourceDocumentId="doc-b" />);
    const overlay = screen.getByTestId("map-transition-overlay");
    expect(overlay).toHaveStyle({ pointerEvents: "none" });

    // jsdom runs no animations; fire the end event through React's system.
    fireEvent.animationEnd(overlay);
    expect(screen.queryByTestId("map-transition-overlay")).toBeNull();
  });
});
