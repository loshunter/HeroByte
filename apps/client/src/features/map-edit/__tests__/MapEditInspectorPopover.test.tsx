import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { propertyHarness } from "./properties.u5.fixtures";
afterEach(cleanup);

describe("MapEditInspectorPopover", () => {
  it("Save changes emits the edited transform without overwriting untouched layer or visibility", async () => {
    const h = propertyHarness();
    await h.start();
    fireEvent.click(screen.getByRole("button", { name: "Position and scale" }));
    fireEvent.change(screen.getByLabelText("Rotation (°)"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(h.command()).toMatchObject({
      type: "update-element",
      elementId: "door-a",
      update: { transform: { x: 100, y: 150, scaleX: 1, scaleY: 1, rotation: 45 } },
    });
    if (h.command().type !== "update-element") throw new Error("Expected property update");
    const command = h.command();
    if (command.type === "update-element")
      expect(Object.keys(command.update)).toEqual(["transform"]);
  });
  it("Delete removes exactly the selected element", async () => {
    const h = propertyHarness();
    await h.start();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(h.commands()).toHaveLength(1);
    expect(h.command()).toMatchObject({ type: "remove-element", elementId: "door-a" });
  });
  it("stages the door form and sends its dedicated data command on Save changes", async () => {
    const h = propertyHarness();
    await h.start();
    fireEvent.change(screen.getByLabelText("Door state"), { target: { value: "secret" } });
    expect(h.commands()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(h.commands()).toHaveLength(1);
    expect(h.command()).toMatchObject({
      type: "update-door",
      elementId: "door-a",
      state: "secret",
      width: 50,
    });
  });
  it("keeps every transform control behind a collapsed, labelled disclosure with units", async () => {
    const h = propertyHarness();
    await h.start();
    expect(screen.queryByLabelText("X (px)")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Position and scale" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    for (const label of ["X (px)", "Y (px)", "Scale X (×)", "Scale Y (×)", "Rotation (°)"])
      expect(screen.getByLabelText(label)).toBeVisible();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(6);
    expect(screen.getByLabelText("Element layer")).toBeInTheDocument();
    expect(screen.getByLabelText("Door state")).toBeInTheDocument();
    expect(h.commands()).toHaveLength(0);
  });
});
