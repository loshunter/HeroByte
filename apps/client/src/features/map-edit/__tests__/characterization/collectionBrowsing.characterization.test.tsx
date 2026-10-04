import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapEditAssetPicker } from "../../MapEditAssetPicker";
import { MobileAssetPicker } from "../../mobile/MobileAssetPicker";
import { TokenLibrary } from "../../../dm/token-library/TokenLibrary";
import { CustomTokensProvider } from "../../../dm/token-library/customTokensContext";

afterEach(cleanup);

describe("collection callback and authority contracts before U4c", () => {
  it.each(["desktop", "phone"])("%s category browsing never changes the armed object", (mode) => {
    const onSelect = vi.fn();
    render(
      mode === "desktop" ? (
        <MapEditAssetPicker
          selectedAssetId="objects:crate"
          onSelectAsset={onSelect}
          uploadAsset={vi.fn()}
        />
      ) : (
        <MobileAssetPicker
          label="Place"
          selected="objects:crate"
          onSelect={onSelect}
          uploadAsset={vi.fn()}
        />
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Structures" }));
    fireEvent.click(screen.getByRole("button", { name: "Objects" }));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(
      mode === "desktop"
        ? screen.getByTitle("Table")
        : screen.getByRole("button", { name: "Table" }),
    );
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("objects:table");
  });

  it("token search and category browsing do not add NPCs; activating a token calls once immediately", () => {
    const onPick = vi.fn();
    render(<TokenLibrary onPick={onPick} hint="Pick a token to add it as an NPC" />);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "club brute" } });
    fireEvent.click(screen.getByRole("button", { name: "Monsters" }));
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Goblin club brute" }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "goblinClub", custom: false }),
    );
  });

  it("read-only table tokens cannot gain upload/remove actions through browsing", () => {
    const onPick = vi.fn();
    render(
      <CustomTokensProvider
        value={{
          tokens: [
            {
              id: "own",
              name: "Table dragon",
              imageUrl: "/dragon.png",
              size: "large",
              tags: [],
              addedBy: "dm",
              addedAt: 1,
            },
          ],
        }}
      >
        <TokenLibrary onPick={onPick} hint="Choose art" disabled />
      </CustomTokensProvider>,
    );
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Table dragon" } });
    const dragon = screen.getByRole("button", { name: "Table dragon" });
    expect(dragon).toBeDisabled();
    fireEvent.click(dragon);
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
    expect(screen.queryByTestId("custom-token-form")).toBeNull();
  });
});
