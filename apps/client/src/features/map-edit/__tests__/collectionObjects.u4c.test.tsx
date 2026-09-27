import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MapEditAssetPicker } from "../MapEditAssetPicker";
import { MobileAssetPicker } from "../mobile/MobileAssetPicker";

afterEach(cleanup);

function picker(phone: boolean, selected: string, onSelect = vi.fn()) {
  return phone ? (
    <MobileAssetPicker
      label="Place"
      selected={selected}
      onSelect={onSelect}
      uploadAsset={vi.fn()}
    />
  ) : (
    <MapEditAssetPicker selectedAssetId={selected} onSelectAsset={onSelect} uploadAsset={vi.fn()} />
  );
}

describe.each([false, true])("named object collection (phone=%s)", (phone) => {
  it("searches visible names and retains the armed preview when browsing hides its tile", () => {
    const onSelect = vi.fn();
    const view = render(picker(phone, "objects:crate", onSelect));
    const search = screen.getByRole("searchbox", { name: "Search objects" });
    fireEvent.change(search, { target: { value: " TABLE " } });
    const table = screen.getByRole("button", { name: "Table" });
    expect(table).toHaveTextContent("Table");
    expect(screen.queryByRole("button", { name: "Crate" })).toBeNull();
    expect(
      within(screen.getByRole("group", { name: "Selected object" })).getByText("Crate"),
    ).toBeVisible();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(table);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("objects:table");
    view.rerender(picker(phone, "objects:table", onSelect));
    fireEvent.click(screen.getByRole("button", { name: "Structures" }));
    expect(
      within(screen.getByRole("group", { name: "Selected object" })).getByText("Table"),
    ).toBeVisible();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows an empty search honestly and clears it with Escape without changing the selection", () => {
    const onSelect = vi.fn();
    render(picker(phone, "objects:crate", onSelect));
    const search = screen.getByRole("searchbox", { name: "Search objects" });
    fireEvent.change(search, { target: { value: "not-an-asset" } });
    expect(screen.getByText(/No objects match/)).toBeVisible();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(screen.getByRole("button", { name: "Crate" })).toHaveAttribute("aria-pressed", "true");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("offers My uploads with a named preview for content-addressed art outside local storage", () => {
    render(picker(phone, `upload:${"b".repeat(64)}`));
    expect(screen.getByRole("button", { name: "My uploads" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const preview = screen.getByRole("group", { name: "Selected object" });
    expect(preview).toHaveTextContent("Uploaded image");
    expect(within(preview).getByRole("img", { name: "Uploaded image" })).toHaveAttribute(
      "src",
      expect.stringContaining("b".repeat(64)),
    );
  });
});
