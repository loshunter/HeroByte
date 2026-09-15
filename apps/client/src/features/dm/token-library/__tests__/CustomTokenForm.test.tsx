/**
 * The "Add your own" form: an image and a name are the minimum; tags come
 * from the box (comma or Enter), from the suggestion chips, or both, and a
 * tag still sitting in the box when Add is pressed counts.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CustomTokenForm } from "../CustomTokenForm";

/** The default add: succeeds, nothing to report. */
const ok = () => vi.fn().mockResolvedValue({});

function fillImage(url: string) {
  const field = screen.getByLabelText("Image");
  fireEvent.change(field, { target: { value: url } });
  fireEvent.keyDown(field, { key: "Enter" });
}

describe("CustomTokenForm", () => {
  it("stays disabled until it has an image and a name, then hands up the draft", async () => {
    const onAdd = ok();
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
      // The kind chips said townsfolk, so the card will read Neutral.
      disposition: "neutral",
    });
    // Cleared for the next one, and the button says the add is in flight —
    // it renders and uploads a thumbnail before the message goes out.
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    expect(await screen.findByRole("button", { name: "＋ Add to library" })).toBeDisabled();
  });

  it("shows the add's note, and nothing when there is none", async () => {
    const onAdd = vi.fn().mockResolvedValue({ note: "No thumbnail — the storage is full." });
    const { rerender } = render(<CustomTokenForm onAdd={onAdd} />);
    fillImage("https://i.imgur.com/x.png");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ogre" } });
    await screen.findByDisplayValue("https://i.imgur.com/x.png");
    fireEvent.click(screen.getByRole("button", { name: "＋ Add to library" }));

    expect(await screen.findByRole("status")).toHaveTextContent("the storage is full");

    // A clean second add clears the first one's line rather than leaving a
    // stale complaint under a token that is perfectly fine.
    onAdd.mockResolvedValue({});
    rerender(<CustomTokenForm onAdd={onAdd} />);
    fillImage("https://i.imgur.com/y.png");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ogre 2" } });
    await screen.findByDisplayValue("https://i.imgur.com/y.png");
    fireEvent.click(screen.getByRole("button", { name: "＋ Add to library" }));
    await screen.findByRole("button", { name: "＋ Add to library" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a kind chip chooses the stance, until the DM chooses one themselves", async () => {
    const onAdd = ok();
    render(<CustomTokenForm onAdd={onAdd} />);
    const stance = screen.getByLabelText("Stance") as HTMLSelectElement;
    // Neutral to start: what a DM adds by hand is usually townsfolk.
    expect(stance.value).toBe("neutral");

    fireEvent.click(screen.getByRole("button", { name: "monster" }));
    expect(stance.value).toBe("hostile");
    fireEvent.click(screen.getByRole("button", { name: "ally" }));
    expect(stance.value).toBe("friendly");
    // An ancestry says nothing about whose side anyone is on.
    fireEvent.click(screen.getByRole("button", { name: "elf" }));
    expect(stance.value).toBe("friendly");

    // Once set by hand it sticks, whatever gets clicked afterwards.
    fireEvent.change(stance, { target: { value: "neutral" } });
    fireEvent.click(screen.getByRole("button", { name: "boss" }));
    expect(stance.value).toBe("neutral");

    fillImage("https://i.imgur.com/x.png");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Old Marta" } });
    await screen.findByDisplayValue("https://i.imgur.com/x.png");
    fireEvent.click(screen.getByRole("button", { name: "＋ Add to library" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ disposition: "neutral" }));

    // Hostile is what absent already means, so it is not sent at all.
    await screen.findByRole("button", { name: "＋ Add to library" });
    fillImage("https://i.imgur.com/y.png");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Wolf" } });
    await screen.findByDisplayValue("https://i.imgur.com/y.png");
    fireEvent.change(screen.getByLabelText("Stance"), { target: { value: "hostile" } });
    fireEvent.click(screen.getByRole("button", { name: "＋ Add to library" }));
    expect(Object.keys(onAdd.mock.lastCall![0])).not.toContain("disposition");
  });

  it("a chip toggles its tag on and off, and a chosen tag has its own remover", () => {
    render(<CustomTokenForm onAdd={ok()} />);
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
