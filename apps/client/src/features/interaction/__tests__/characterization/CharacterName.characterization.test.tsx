import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlayerSettingsMenu } from "../../../players/components/PlayerSettingsMenu";
afterEach(cleanup);
it.each(["Enter", "blur"])("Character name %s retains the existing submit boundary", (path) => {
  const submit = vi.fn();
  const change = vi.fn();
  render(
    <PlayerSettingsMenu
      isOpen
      onClose={vi.fn()}
      selectedEffects={[]}
      onStatusEffectsChange={vi.fn()}
      nameInput="Alice"
      onNameInputChange={change}
      onNameSubmit={submit}
    />,
  );
  const input = screen.getByPlaceholderText("Enter Name");
  fireEvent.change(input, { target: { value: "Bob" } });
  expect(change).toHaveBeenCalledExactlyOnceWith("Bob");
  expect(submit).not.toHaveBeenCalled();
  if (path === "Enter") fireEvent.keyDown(input, { key: "Enter" });
  else fireEvent.blur(input);
  expect(submit).toHaveBeenCalledTimes(1);
});
