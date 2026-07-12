import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { MapEditAssetPicker } from "../MapEditAssetPicker";

const uploadAsset = vi.fn();

describe("MapEditAssetPicker", () => {
  it("renders the category tabs and the objects assets by default", () => {
    render(
      <MapEditAssetPicker
        selectedAssetId="objects:crate"
        onSelectAsset={vi.fn()}
        uploadAsset={uploadAsset}
      />,
    );
    for (const tab of ["Objects", "Structures", "Terrain", "My Stuff"]) {
      expect(screen.getByRole("button", { name: tab })).toBeTruthy();
    }
    // Objects is the default category.
    expect(screen.getByTitle("Crate")).toBeTruthy();
    expect(screen.getByTitle("Table")).toBeTruthy();
  });

  it("fires onSelectAsset with the clicked asset id", () => {
    const onSelectAsset = vi.fn();
    render(
      <MapEditAssetPicker
        selectedAssetId="objects:crate"
        onSelectAsset={onSelectAsset}
        uploadAsset={uploadAsset}
      />,
    );
    fireEvent.click(screen.getByTitle("Table"));
    expect(onSelectAsset).toHaveBeenCalledWith("objects:table");
  });

  it("switches categories to reveal a different asset set", () => {
    render(
      <MapEditAssetPicker
        selectedAssetId="objects:crate"
        onSelectAsset={vi.fn()}
        uploadAsset={uploadAsset}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Structures" }));
    expect(screen.getByTitle("Stone Wall")).toBeTruthy();
    expect(screen.queryByTitle("Crate")).toBeNull();
  });

  it("offers an upload control on the My Stuff tab", () => {
    render(
      <MapEditAssetPicker
        selectedAssetId="objects:crate"
        onSelectAsset={vi.fn()}
        uploadAsset={uploadAsset}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "My Stuff" }));
    expect(screen.getByRole("button", { name: /Upload image/ })).toBeTruthy();
  });
});
