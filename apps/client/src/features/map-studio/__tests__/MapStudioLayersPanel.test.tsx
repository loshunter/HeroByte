import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { MapStudioLayersPanel } from "../components/MapStudioLayersPanel";

function renderPanel(overrides: { saving?: boolean } = {}) {
  const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
  const updateLayer = vi.fn();
  const moveLayer = vi.fn();
  render(
    <MapStudioLayersPanel
      layers={document.layers}
      saving={overrides.saving ?? false}
      onUpdateLayer={updateLayer}
      onMoveLayer={moveLayer}
    />,
  );
  return { document, updateLayer, moveLayer };
}

describe("MapStudioLayersPanel", () => {
  it("lists layers top-most first", () => {
    renderPanel();

    const names = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(names[0]).toContain("GM Notes");
    expect(names[names.length - 1]).toContain("Background");
  });

  it("toggles visibility and lock through updateLayer", () => {
    const { updateLayer } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Hide Terrain" }));
    expect(updateLayer).toHaveBeenCalledWith("terrain", { visible: false });

    fireEvent.click(screen.getByRole("button", { name: "Lock Terrain" }));
    expect(updateLayer).toHaveBeenCalledWith("terrain", { locked: true });
  });

  it("adjusts opacity through updateLayer", () => {
    const { updateLayer } = renderPanel();

    fireEvent.change(screen.getByLabelText("Terrain opacity"), { target: { value: "0.4" } });

    expect(updateLayer).toHaveBeenCalledWith("terrain", { opacity: 0.4 });
  });

  it("reorders layers with move up meaning toward the top", () => {
    const { document, moveLayer } = renderPanel();
    const terrainIndex = document.layers.findIndex((layer) => layer.id === "terrain");

    fireEvent.click(screen.getByRole("button", { name: "Move Terrain up" }));
    expect(moveLayer).toHaveBeenCalledWith("terrain", terrainIndex + 1);

    fireEvent.click(screen.getByRole("button", { name: "Move Terrain down" }));
    expect(moveLayer).toHaveBeenCalledWith("terrain", terrainIndex - 1);
  });

  it("disables reorder at the ends and everything while saving", () => {
    const { updateLayer, moveLayer } = renderPanel({ saving: true });

    // Top-most layer cannot move further up; bottom cannot move down.
    expect(screen.getByRole("button", { name: "Move GM Notes up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Background down" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Hide Terrain" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Terrain up" }));
    expect(updateLayer).not.toHaveBeenCalled();
    expect(moveLayer).not.toHaveBeenCalled();
  });
});
