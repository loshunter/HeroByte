import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapEditToolbar } from "../MapEditToolbar";
import { MobileMapEditSheet } from "../mobile/MobileMapEditSheet";
import { boundPalette } from "./characterization/palette.fixtures";

afterEach(cleanup);

describe("U3b persistent controls", () => {
  it.each(["generate", "spline"] as const)(
    "retains Layers and Inspect with %s",
    (activeSubTool) => {
      const h = boundPalette();
      render(<MapEditToolbar {...h.props({ activeSubTool })} />);
      expect(screen.getByRole("button", { name: /Layers/ })).toBeVisible();
      expect(screen.getByRole("button", { name: /Inspect/ })).toBeVisible();
      expect(screen.getByRole("button", { name: /Undo map/ })).toBeVisible();
      expect(screen.getByRole("button", { name: /Done building/ })).toBeVisible();
    },
  );

  it.each(["terrain", "erase", "light"] as const)(
    "does not offer Populate under %s",
    (activeSubTool) => {
      const h = boundPalette();
      render(<MapEditToolbar {...h.props({ activeSubTool })} />);
      expect(screen.queryByRole("button", { name: /POPULATE|Decorate last/ })).toBeNull();
    },
  );

  it("names the current map and its live relationship beside persistent controls", () => {
    const h = boundPalette();
    render(<MapEditToolbar {...h.props()} />);
    expect(screen.getByText("Lantern courtyard")).toBeVisible();
    expect(screen.getByText(/Edits appear on the table/)).toBeVisible();
  });

  it.each([false, true])(
    "groups the bound palette without showing unrelated tools (phone=%s)",
    (mobile) => {
      const h = boundPalette();
      render(
        mobile ? (
          <MobileMapEditSheet toolbar={h.props()} onToggleTools={vi.fn()} onResetCamera={vi.fn()} />
        ) : (
          <MapEditToolbar {...h.props()} />
        ),
      );
      const groups = screen.getByRole("combobox", { name: "Tool group" });
      expect(groups).toHaveValue("structures");
      expect(screen.getByRole("button", { name: /Room/ })).toBeVisible();
      expect(screen.queryByRole("button", { name: /Paint terrain/ })).toBeNull();
      fireEvent.change(groups, { target: { value: "terrain" } });
      expect(h.result.current.state.activeSubTool).toBe("terrain");
    },
  );
});
