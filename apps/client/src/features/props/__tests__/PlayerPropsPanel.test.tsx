import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { PlayerPropsPanel } from "../PlayerPropsPanel";

/**
 * The panel's two contracts worth pinning:
 *
 * 1. A scatter is ONE create-prop message carrying `count` — never N sends.
 *    The single-flight guard drops rapid seconds silently (the S8 bulk-NPC
 *    lesson), so a loop here would present as a flaky server.
 * 2. The list shows only the viewer's OWN props — the server refuses a player
 *    managing anyone else's, so listing them would be offering dead buttons.
 */

const baseSnapshot: RoomSnapshot = {
  users: [],
  tokens: [],
  players: [],
  characters: [],
  props: [
    {
      id: "mine-1",
      label: "My Chest",
      imageUrl: "chest.png",
      owner: "me",
      size: "medium",
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    {
      id: "dm-1",
      label: "DM Statue",
      imageUrl: "statue.png",
      owner: null,
      size: "large",
      x: 1,
      y: 1,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
  ],
  pointers: [],
  gridSize: 50,
  diceRolls: [],
  playerPropsEnabled: true,
};

function renderPanel(sendMessage = vi.fn()) {
  render(
    <PlayerPropsPanel
      snapshot={baseSnapshot}
      uid="me"
      sendMessage={sendMessage}
      camera={{ x: 0, y: 0, scale: 1 }}
      presentation="content"
    />,
  );
  return sendMessage;
}

describe("PlayerPropsPanel", () => {
  it("lists only the viewer's own props", () => {
    renderPanel();
    expect(screen.getByDisplayValue("My Chest")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("DM Statue")).not.toBeInTheDocument();
    expect(screen.getByText("Your Props (1)")).toBeInTheDocument();
  });

  it("sends a scatter as ONE create-prop message carrying count", () => {
    const sendMessage = renderPanel();

    fireEvent.change(screen.getByLabelText("How many props to add"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Scatter 6" }));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "create-prop", count: 6, owner: "me" }),
    );
  });

  it("omits count for a single add and refuses a second create while one is in flight", () => {
    const sendMessage = renderPanel();

    const addButton = screen.getByRole("button", { name: "+ Add Prop" });
    fireEvent.click(addButton);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const message = sendMessage.mock.calls[0][0];
    expect(message.t).toBe("create-prop");
    expect(message.count).toBeUndefined();

    // The snapshot has not grown, so the flight is still open: the button is
    // disabled and a second press must not produce a second message.
    fireEvent.click(screen.getByRole("button", { name: "Adding..." }));
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("clamps the count field to the shared limits on blur", () => {
    renderPanel();
    const countField = screen.getByLabelText("How many props to add");

    fireEvent.change(countField, { target: { value: "99" } });
    // The button label is the honest one while the field still reads 99.
    expect(screen.getByRole("button", { name: "+ Scatter 20" })).toBeInTheDocument();

    fireEvent.blur(countField);
    expect(countField).toHaveValue(20);
  });
});
