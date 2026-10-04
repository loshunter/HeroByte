// Undo edit and Redo edit are pressed again and again to walk back through a map's history.
// While a save was in flight they were `disabled`, and a browser takes focus off a control that
// becomes disabled, so every press ended with focus on the page (found in the U10c review).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { propertyDocument } from "../../../../map-edit/__tests__/properties.u5.fixtures";
import { ViewedMapDetails } from "../ViewedMapDetails";

afterEach(cleanup);

const renderDetails = (overrides: Partial<Parameters<typeof ViewedMapDetails>[0]> = {}) => {
  const onUndo = vi.fn();
  const onRedo = vi.fn();
  render(
    <ViewedMapDetails
      document={propertyDocument()}
      name="Cellar"
      onTable={false}
      saving={false}
      canUndo
      canRedo
      onUndo={onUndo}
      onRedo={onRedo}
      canPublish={false}
      onPublish={vi.fn()}
      {...overrides}
    />,
  );
  return { onUndo, onRedo };
};

describe("ViewedMapDetails history buttons while saving", () => {
  it("stay focusable, say they are waiting, and ignore the press", () => {
    const { onUndo, onRedo } = renderDetails({ saving: true });
    for (const name of [/Undo edit/, /Redo edit/]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button);
    }
    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("act when idle", () => {
    const { onUndo, onRedo } = renderDetails();
    fireEvent.click(screen.getByRole("button", { name: /Undo edit/ }));
    fireEvent.click(screen.getByRole("button", { name: /Redo edit/ }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("are still truly disabled when there is nothing to undo or redo", () => {
    renderDetails({ canUndo: false, canRedo: false });
    expect(screen.getByRole("button", { name: /Undo edit/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Redo edit/ })).toBeDisabled();
  });
});
