/**
 * The "Add your own" form: an image and a name are the minimum; tags come
 * from the box (comma or Enter), from the suggestion chips, or both, and a
 * tag still sitting in the box when Add is pressed counts.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CustomTokenForm } from "../CustomTokenForm";

function fillImage(url: string) {
  const field = screen.getByLabelText("Image");
  fireEvent.change(field, { target: { value: url } });
  fireEvent.keyDown(field, { key: "Enter" });
}

describe("CustomTokenForm", () => {
  it("stays disabled until it has an image and a name, then hands up the draft", async () => {
    const onAdd = vi.fn();
    render(<CustomTokenForm onAdd={onAdd} />);
    const add = screen.getByRole("button", { name: "＋ Add to library" });
    expect(add).toBeDisabled();

    fillImage("https://i.imgur.com/x.png");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Old Marta " } });
    await screen.findByDisplayValue("https://i.imgur.com/x.png");
    expect(add).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Runs the Gilded Tankard." },
    });
    fireEvent.change(screen.getByLabelText("Size"), { target: { value: "small" } });
    // Comma-separated in the box, a chip, and one left in the box at submit.
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "NPC, villager" } });
    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "halfling" }));
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "innkeeper" } });
    fireEvent.click(add);

    expect(onAdd).toHaveBeenCalledWith({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      description: "Runs the Gilded Tankard.",
      tags: ["npc", "villager", "halfling", "innkeeper"],
      size: "small",
    });
    // Cleared for the next one.
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByRole("button", { name: "＋ Add to library" })).toBeDisabled();
  });

  it("a chip toggles its tag on and off, and a chosen tag has its own remover", () => {
    render(<CustomTokenForm onAdd={vi.fn()} />);
    const monster = screen.getByRole("button", { name: "monster" });
    fireEvent.click(monster);
    expect(monster).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "monster ✕" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "monster ✕" }));
    expect(monster).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(monster);
    fireEvent.click(monster);
    expect(screen.queryByRole("button", { name: "monster ✕" })).toBeNull();
  });
});
