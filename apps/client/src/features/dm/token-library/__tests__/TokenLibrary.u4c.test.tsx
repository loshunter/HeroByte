import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TokenLibrary } from "../TokenLibrary";
import { CustomTokensProvider } from "../customTokensContext";
import type { CustomToken } from "@herobyte/shared";

afterEach(cleanup);

describe("token selection preview", () => {
  it("focus previews without adding; activation adds exactly once; filters preserve that preview", () => {
    const onPick = vi.fn();
    render(<TokenLibrary onPick={onPick} hint="Pick a token to add it as an NPC" />);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Goblin club brute" } });
    const token = screen.getByRole("button", { name: "Goblin club brute" });
    expect(token).toHaveTextContent("Goblin club brute");
    fireEvent.focus(token);
    expect(screen.getByRole("group", { name: "Token preview" })).toHaveTextContent(
      "Goblin club brute",
    );
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(token);
    expect(onPick).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "goblinClub" }));
    fireEvent.click(screen.getByRole("button", { name: "Townsfolk" }));
    expect(screen.getByRole("group", { name: "Token preview" })).toHaveTextContent(
      "Goblin club brute",
    );
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("updates or clears a selected custom token from the live table catalog", () => {
    const token: CustomToken = {
      id: "one",
      name: "Old name",
      imageUrl: "/old.png",
      tags: [],
      size: "small",
      addedAt: 1,
      addedBy: "dm",
    };
    const onPick = vi.fn();
    const content = (tokens: CustomToken[]) => (
      <CustomTokensProvider value={{ tokens }}>
        <TokenLibrary onPick={onPick} hint="Choose art" />
      </CustomTokensProvider>
    );
    const view = render(content([token]));
    fireEvent.click(screen.getByRole("button", { name: "Old name" }));
    expect(screen.getByRole("group", { name: "Token preview" })).toHaveTextContent("Old name");
    view.rerender(content([{ ...token, name: "New name", imageUrl: "/new.png" }]));
    expect(screen.getByRole("group", { name: "Token preview" })).toHaveTextContent("New name");
    view.rerender(content([]));
    expect(screen.queryByRole("group", { name: "Token preview" })).toBeNull();
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
