import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { propertyDoor, propertyHarness } from "./properties.u5.fixtures";

afterEach(cleanup);
function openPosition() {
  const toggle = screen.queryByRole("button", { name: "Position and scale" });
  if (toggle) fireEvent.click(toggle);
}
function stageBoth() {
  openPosition();
  fireEvent.change(screen.getByLabelText(/^X(?: \(px\))?$/), { target: { value: "220" } });
  fireEvent.change(screen.getByLabelText(/^Door width(?: \(px\))?$/), { target: { value: "75" } });
  fireEvent.change(screen.getByLabelText("Door state"), { target: { value: "locked" } });
}
function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("U5 one property save, separately acknowledged members", () => {
  it("stages all door values and reports success only after both matching acknowledgements", async () => {
    const h = propertyHarness();
    await h.start();
    stageBoth();
    expect(h.commands()).toHaveLength(0);
    save();
    expect(h.commands()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Saving changes/ })).toBeDisabled();
    await h.receive({
      t: "map-studio-document",
      document: { ...h.initial, revision: 40 },
      appliedCommandId: "unrelated",
    });
    expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
    expect(h.commands()).toHaveLength(1);
    const moved = { ...propertyDoor, transform: { ...propertyDoor.transform, x: 220 } };
    await h.ack(0, { ...h.initial, revision: 41, elements: [moved] });
    expect(h.commands()).toHaveLength(2);
    expect(h.command(1)).toMatchObject({
      type: "update-door",
      elementId: propertyDoor.id,
      state: "locked",
      width: 75,
    });
    expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
    await h.ack(1, {
      ...h.initial,
      revision: 42,
      elements: [{ ...moved, data: { ...moved.data, state: "locked", width: 75 } }],
    });
    expect(screen.getByText("Changes saved.")).toBeInTheDocument();
    expect(h.commands()).toHaveLength(2);
  });

  it.each([0, 1])(
    "retains the unsaved member after operation %s fails and retries only that member",
    async (failed) => {
      const h = propertyHarness();
      await h.start();
      stageBoth();
      save();
      const moved = { ...propertyDoor, transform: { ...propertyDoor.transform, x: 220 } };
      if (failed === 0) {
        await h.refuse(0);
        await h.ack(1, {
          ...h.initial,
          revision: 1,
          elements: [
            { ...propertyDoor, data: { ...propertyDoor.data, state: "locked", width: 75 } },
          ],
        });
      } else {
        await h.ack(0, { ...h.initial, revision: 1, elements: [moved] });
        await h.refuse(1);
      }
      expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        failed === 0 ? /Door settings saved/ : /Properties saved/,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        failed === 0 ? /Properties not saved/ : /Door settings not saved/,
      );
      save();
      expect(h.commands()).toHaveLength(3);
      expect(h.command(2).type).toBe(failed === 0 ? "update-element" : "update-door");
    },
  );

  it("preserves staged desktop fields when an unrelated document update arrives", async () => {
    const h = propertyHarness();
    await h.start();
    stageBoth();
    await h.receive({
      t: "map-studio-document",
      document: { ...h.initial, revision: 1, elements: structuredClone(h.initial.elements) },
    });
    expect(screen.getByLabelText(/^X(?: \(px\))?$/)).toHaveValue(220);
    expect(screen.getByLabelText(/^Door width(?: \(px\))?$/)).toHaveValue(75);
    expect(screen.getByLabelText("Door state")).toHaveValue("locked");
    expect(h.commands()).toHaveLength(0);
  });

  it("keeps phone door changes staged until Save changes", async () => {
    const h = propertyHarness(true);
    await h.start();
    fireEvent.click(screen.getByTestId("mobile-inspector-toggle"));
    const state = screen.queryByLabelText("Door state");
    if (state) fireEvent.change(state, { target: { value: "locked" } });
    else fireEvent.click(screen.getByRole("button", { name: "Locked" }));
    expect(h.commands()).toHaveLength(0);
    save();
    expect(h.commands()).toHaveLength(1);
    expect(h.command()).toMatchObject({ type: "update-door", state: "locked" });
  });
});
