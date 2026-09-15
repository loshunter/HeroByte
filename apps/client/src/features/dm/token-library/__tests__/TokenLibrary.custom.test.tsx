/**
 * The table's own tokens in the picker: they arrive through the context, lead
 * the grid, wear the MINE badge, search by their tags, and can be removed —
 * and without the DM plumbing the shelf is read-only and the form is absent.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { CustomToken } from "@herobyte/shared";
import { TokenLibrary } from "../TokenLibrary";
import { CustomTokensProvider, type CustomTokensApi } from "../customTokensContext";

const marta: CustomToken = {
  id: "ct-marta",
  name: "Old Marta",
  imageUrl: "https://i.imgur.com/marta.png",
  description: "Runs the Gilded Tankard.",
  tags: ["npc", "villager", "halfling"],
  size: "small",
  addedBy: "dm",
  addedAt: 1,
};
const wagon: CustomToken = {
  id: "ct-wagon",
  name: "Merchant wagon",
  imageUrl: "https://i.imgur.com/wagon.png",
  tags: ["prop"],
  size: "large",
  addedBy: "dm",
  addedAt: 2,
};

function renderWith(api: Partial<CustomTokensApi>, onPick = vi.fn()) {
  render(
    <CustomTokensProvider value={{ tokens: [marta, wagon], ...api }}>
      <TokenLibrary onPick={onPick} hint="Pick" />
    </CustomTokensProvider>,
  );
  return onPick;
}

const cells = () =>
  within(screen.getByTestId("token-library")).queryAllByRole("button", {
    name: (name) =>
      !["All", "Monsters", "Townsfolk", "Custom"].includes(name) && !/^Remove /.test(name),
  });

afterEach(() => vi.restoreAllMocks());

describe("TokenLibrary — the table's own tokens", () => {
  it("leads the grid with them, counts them, badges them, and draws their own image", () => {
    renderWith({});
    expect(screen.getByText(/Pick · 246 of 246 tokens/)).toBeInTheDocument();
    const names = cells().map((b) => b.textContent);
    expect(names.slice(0, 2)).toEqual(["Old Marta", "Merchant wagon"]);
    expect(names).toContain("Goblin club brute");
    const martaCell = screen.getByRole("button", { name: "Old Marta" });
    expect(martaCell.querySelector("img")).toHaveAttribute("src", marta.imageUrl);
    expect(martaCell.parentElement?.textContent).toContain("MINE");
    expect(screen.getAllByText("MINE")).toHaveLength(2);
  });

  it("the Custom chip shows only them, hides the family select, and searches their tags", () => {
    renderWith({});
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(cells().map((b) => b.textContent)).toEqual(["Old Marta", "Merchant wagon"]);
    expect(screen.queryByLabelText("Family")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "prop" } });
    expect(cells().map((b) => b.textContent)).toEqual(["Merchant wagon"]);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "halfling tankard" } });
    expect(cells().map((b) => b.textContent)).toEqual(["Old Marta"]);
  });

  it("a pick hands up the custom item with its own image for every tier and its size", () => {
    const onPick = renderWith({});
    fireEvent.click(screen.getByRole("button", { name: "Merchant wagon" }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ct-wagon",
        custom: true,
        imageUrl: wagon.imageUrl,
        portraitUrl: wagon.imageUrl,
        size: "large",
      }),
    );
  });

  it("remove asks first, then calls removeToken; the form shows only under Custom", () => {
    const removeToken = vi.fn();
    const addToken = vi.fn();
    renderWith({ removeToken, addToken });
    expect(screen.queryByTestId("custom-token-form")).toBeNull();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const remove = screen.getByRole("button", { name: "Remove Old Marta from the library" });
    fireEvent.click(remove);
    expect(removeToken).not.toHaveBeenCalled();
    fireEvent.click(remove);
    expect(removeToken).toHaveBeenCalledWith("ct-marta");
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByTestId("custom-token-form")).toBeInTheDocument();
  });

  it("without the DM plumbing the shelf is read-only: no remover, no form", () => {
    renderWith({ removeToken: undefined, addToken: undefined });
    expect(screen.queryByRole("button", { name: /^Remove /i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.queryByTestId("custom-token-form")).toBeNull();
    expect(cells()).toHaveLength(2);
  });

  it("with no shelf at all, Custom explains itself", () => {
    render(<TokenLibrary onPick={vi.fn()} hint="Pick" />);
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByText(/Nothing of your own yet/)).toBeInTheDocument();
  });
});
