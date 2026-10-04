// The name field is NAMED: its visible "Character Name:" label is associated with the
// input (U10b), so a screen reader announces it and a click on the label focuses the
// field. The older suite pins the same text by getByText/getByPlaceholderText, which
// still hold.
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CharacterCreationModal } from "../CharacterCreationModal";

afterEach(() => cleanup());

const open = () =>
  render(
    <CharacterCreationModal
      isOpen
      onCreateCharacter={vi.fn(() => true)}
      isCreating={false}
      onClose={vi.fn()}
    />,
  );

it("names the input by its visible label", () => {
  open();
  const input = screen.getByRole("textbox", { name: "Character Name:" });
  expect(input).toHaveAttribute("placeholder", "Enter character name...");
});

it("associates the label with the input by id, not by position", () => {
  open();
  const label = screen.getByText("Character Name:");
  const input = screen.getByPlaceholderText("Enter character name...");
  expect(label).toHaveAttribute("for", input.id);
  expect(input.id).not.toBe("");
});
