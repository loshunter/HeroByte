/**
 * A boundary that guards ONE panel, not the app.
 *
 * The DM menu is a lazy chunk on both layouts, and the realistic failure is
 * not a bug: a deploy invalidates the hashed chunk names while a session is
 * open, so the first elevation after it 404s and throws during render. Without
 * a local boundary that throw reaches the app root, whose fallback replaces
 * the entire table with a full-page "Application Error" — and a table is a
 * live shared thing, not a page you casually reload.
 *
 * The fallback is a plain node and offers no retry. That is the correction to
 * how this shipped: React caches a lazy payload's REJECTION permanently, so a
 * retry could only ever re-render the same dead lazy. The last test here pins
 * that mechanic against the installed React, because it is the entire reason
 * the affordance is absent — and a future reader who "fixes" the missing
 * button deserves to be told by a failing test rather than by a user.
 */
import React, { Suspense, lazy } from "react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
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
      <ErrorBoundary fallback={<DMMenuLoadFailure />}>
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

  it("offers a reload and NOT a retry, because only one of them can work", () => {
    render(
      <ErrorBoundary fallback={<DMMenuLoadFailure />}>
        <Boom throws />
      </ErrorBoundary>,
    );

    expect(screen.queryByRole("button", { name: /Try again/i })).toBeNull();

    // And the one button on offer does the one thing that recovers this.
    // Asserting it is VISIBLE is not enough — measured: wiring its onClick to
    // a no-op left this test green.
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    try {
      fireEvent.click(screen.getByRole("button", { name: /Reload the page/i }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("passes children through untouched when nothing throws", () => {
    render(
      <ErrorBoundary fallback={<div>never</div>}>
        <Boom throws={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("the-panel")).toBeVisible();
    expect(screen.queryByText("never")).toBeNull();
  });

  it("React re-throws a rejected lazy FOREVER — the reason no retry is offered", async () => {
    // Measured against the installed React rather than asserted from docs.
    // The importer counts its calls: a lazy payload that has rejected never
    // re-runs it, so "try again" would re-render the same stored rejection.
    let imports = 0;
    const Chunk = lazy(() => {
      imports += 1;
      return Promise.reject(new Error("Failed to fetch dynamically imported module"));
    });

    const tree = (
      <ErrorBoundary fallback={<DMMenuLoadFailure />}>
        <Suspense fallback={<div>loading</div>}>
          <Chunk />
        </Suspense>
      </ErrorBoundary>
    );

    const { unmount } = render(tree);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toBeVisible();
    expect(imports).toBe(1);

    // MORE than a retry would do: a retry only clears the boundary, and this
    // remounts the whole subtree. Even so the payload is Rejected forever.
    unmount();
    cleanup();
    render(tree);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toBeVisible();
    expect(imports).toBe(1);
  });
});
