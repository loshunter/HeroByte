/**
 * A boundary that guards ONE panel, not the app.
 *
 * The DM menu is a lazy chunk on both layouts, and the realistic failure is
 * not a bug: a deploy invalidates the hashed chunk names while a session is
 * open, so the first elevation after it 404s and throws during render. Without
 * a local boundary that throw reaches the app root, whose fallback replaces
 * the entire table with a full-page "Application Error" — and a table is a
 * live shared thing, not a page you casually reload.
 */
import React from "react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";
import { DMMenuLoadFailure } from "../../features/dm/DMMenuLoadFailure";

afterEach(() => cleanup());

// The boundary logs through console.error by design; React also logs the
// caught error itself. Silence both so a passing run stays readable.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function Boom({ throws }: { throws: boolean }): JSX.Element {
  if (throws) throw new Error("Failed to fetch dynamically imported module");
  return <div data-testid="the-panel">the DM menu</div>;
}

describe("ErrorBoundary with a scoped fallback", () => {
  it("shows the scoped fallback INSTEAD of the full-page error", () => {
    render(
      <ErrorBoundary fallback={(retry) => <DMMenuLoadFailure retry={retry} />}>
        <Boom throws />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/DM tools could not be loaded/i);
    // The full-page treatment is what this exists to avoid.
    expect(screen.queryByText(/Application Error/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Reload Page/ })).toBeNull();
  });

  it("still shows the full-page error when no fallback is given", () => {
    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Application Error/i)).toBeVisible();
  });

  it("retry clears the boundary, so a transient failure costs no session", () => {
    // A chunk that 404s once and resolves on a second attempt, which is what
    // a mid-session deploy looks like after the client picks up new hashes.
    let failing = true;
    function Flaky(): JSX.Element {
      if (failing) throw new Error("Failed to fetch dynamically imported module");
      return <div data-testid="the-panel">the DM menu</div>;
    }

    render(
      <ErrorBoundary fallback={(retry) => <DMMenuLoadFailure retry={retry} />}>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeVisible();

    failing = false;
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));

    expect(screen.getByTestId("the-panel")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("passes children through untouched when nothing throws", () => {
    render(
      <ErrorBoundary fallback={() => <div>never</div>}>
        <Boom throws={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("the-panel")).toBeVisible();
    expect(screen.queryByText("never")).toBeNull();
  });
});
