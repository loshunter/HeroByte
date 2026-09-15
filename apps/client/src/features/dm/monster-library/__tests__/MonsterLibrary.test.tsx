/**
 * The library picker: a family select and a search box over the bundled
 * pack, and a pick that hands the caller the asset — nothing more, so the
 * NPCs tab and the NPC editor can each decide what a pick means.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonsterLibrary } from "../MonsterLibrary";
import { MONSTER_ASSETS } from "../monsterCatalog";

describe("MonsterLibrary", () => {
  it("lists the whole pack with the caller's hint and a running count", () => {
    render(<MonsterLibrary onPick={vi.fn()} hint="Pick a monster" />);
    expect(screen.getByText(/Pick a monster · 184 of 184 monsters/)).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(MONSTER_ASSETS.length);
    expect(screen.getByRole("button", { name: "Goblin club brute" })).toBeInTheDocument();
  });

  it("the family select narrows to that family", () => {
    render(<MonsterLibrary onPick={vi.fn()} hint="Pick" />);
    fireEvent.change(screen.getByLabelText("Family"), { target: { value: "Mimics" } });
    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Closed chest" })).toBeInTheDocument();
    expect(screen.getByText(/10 of 184 monsters/)).toBeInTheDocument();
  });

  it("search matches every word, across families", () => {
    render(<MonsterLibrary onPick={vi.fn()} hint="Pick" />);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "club brute" } });
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names).toContain("Goblin club brute");
    expect(names).toContain("Bandit club brute");
    expect(names).not.toContain("Goblin mage");
  });

  it("a pick hands back the asset", () => {
    const onPick = vi.fn();
    render(<MonsterLibrary onPick={onPick} hint="Pick" />);
    fireEvent.click(screen.getByRole("button", { name: "Goblin club brute" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "goblinClub" }));
  });

  it("disabled disables every pick; no match says so", () => {
    const onPick = vi.fn();
    render(<MonsterLibrary onPick={onPick} hint="Pick" disabled />);
    const club = screen.getByRole("button", { name: "Goblin club brute" });
    expect(club).toBeDisabled();
    fireEvent.click(club);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzzz" } });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/No monsters match/)).toBeInTheDocument();
  });
});
