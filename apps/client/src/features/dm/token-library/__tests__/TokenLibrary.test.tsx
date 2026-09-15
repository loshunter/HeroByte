/**
 * The library picker: a Monsters/Townsfolk switch, a family select and a
 * search box over the bundled pack, and a pick that hands the caller the
 * asset — nothing more, so the NPCs tab and the NPC editor can each decide
 * what a pick means.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TokenLibrary } from "../TokenLibrary";
import { LIBRARY_ASSETS } from "../tokenCatalog";

/** The thumbnail buttons — every button in the panel but the category chips. */
const cells = () =>
  within(screen.getByTestId("token-library")).queryAllByRole("button", {
    name: (name) => !["All", "Monsters", "Townsfolk"].includes(name),
  });

describe("TokenLibrary", () => {
  it("lists the whole pack with the caller's hint and a running count", () => {
    render(<TokenLibrary onPick={vi.fn()} hint="Pick a token" />);
    expect(screen.getByText(/Pick a token · 244 of 244 tokens/)).toBeInTheDocument();
    expect(cells()).toHaveLength(LIBRARY_ASSETS.length);
    expect(screen.getByRole("button", { name: "Goblin club brute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dwarf blacksmith" })).toBeInTheDocument();
  });

  it("the category switch narrows the grid AND the family select", () => {
    render(<TokenLibrary onPick={vi.fn()} hint="Pick" />);
    fireEvent.click(screen.getByRole("button", { name: "Townsfolk" }));
    expect(screen.getByRole("button", { name: "Townsfolk" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(cells()).toHaveLength(60);
    const options = within(screen.getByLabelText("Family"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toContain("Tavern & inn");
    expect(options).not.toContain("Goblins");
  });

  it("switching category drops a family that is not in it", () => {
    render(<TokenLibrary onPick={vi.fn()} hint="Pick" />);
    fireEvent.change(screen.getByLabelText("Family"), { target: { value: "Mimics" } });
    expect(cells()).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Townsfolk" }));
    expect(screen.getByLabelText("Family")).toHaveValue("");
    expect(cells()).toHaveLength(60);
  });

  it("search matches every word, across families, tags included", () => {
    render(<TokenLibrary onPick={vi.fn()} hint="Pick" />);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "club brute" } });
    const names = cells().map((b) => b.textContent);
    expect(names).toContain("Goblin club brute");
    expect(names).toContain("Bandit club brute");
    expect(names).not.toContain("Goblin mage");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "kid kite" } });
    expect(cells().map((b) => b.textContent)).toEqual(["Half-orc kite flyer"]);
  });

  it("a pick hands back the asset", () => {
    const onPick = vi.fn();
    render(<TokenLibrary onPick={onPick} hint="Pick" />);
    fireEvent.click(screen.getByRole("button", { name: "Goblin club brute" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "goblinClub" }));
  });

  it("disabled disables every pick; no match says so", () => {
    const onPick = vi.fn();
    render(<TokenLibrary onPick={onPick} hint="Pick" disabled />);
    const club = screen.getByRole("button", { name: "Goblin club brute" });
    expect(club).toBeDisabled();
    fireEvent.click(club);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzzz" } });
    expect(cells()).toHaveLength(0);
    expect(screen.getByText(/No tokens match/)).toBeInTheDocument();
  });
});
