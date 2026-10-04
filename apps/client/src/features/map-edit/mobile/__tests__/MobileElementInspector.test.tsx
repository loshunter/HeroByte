import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { propertyDoor, propertyHarness } from "../../__tests__/properties.u5.fixtures";
afterEach(cleanup);
async function opened() {
  const h = propertyHarness(true);
  await h.start();
  fireEvent.click(screen.getByTestId("mobile-inspector-toggle"));
  fireEvent.click(screen.getByRole("button", { name: "Position and scale" }));
  return h;
}
const readout = () => screen.getByText(/Rotation — /).textContent ?? "";

describe("MobileElementInspector draft ownership", () => {
  it("staged edits survive the same element returning as a new object", async () => {
    const h = await opened();
    fireEvent.click(screen.getByRole("button", { name: "Turn element clockwise" }));
    await h.receive({ t: "map-studio-document", document: structuredClone(h.initial) });
    expect(readout()).toContain("15°");
    fireEvent.click(screen.getByTestId("mobile-inspector-apply"));
    expect(h.command()).toMatchObject({
      type: "update-element",
      elementId: "door-a",
      update: { transform: { rotation: 15 } },
    });
  });
  it("changing selection offers Keep editing or Discard changes instead of dropping the draft", async () => {
    const h = await opened();
    fireEvent.click(screen.getByRole("button", { name: "Turn element clockwise" }));
    h.select("door-b");
    expect(h.current().state.selectedElementId).toBe("door-a");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(readout()).toContain("15°");
    expect(h.commands()).toHaveLength(0);
    h.select("door-b");
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(h.current().state.selectedElementId).toBe("door-b");
    expect(readout()).toContain("0°");
    expect(h.commands()).toHaveLength(0);
  });
  it("with nothing staged, another DM's changed element refreshes the form", async () => {
    const h = await opened();
    await h.receive({
      t: "map-studio-document",
      document: {
        ...h.initial,
        revision: 1,
        elements: [{ ...propertyDoor, transform: { ...propertyDoor.transform, rotation: 30 } }],
      },
    });
    expect(readout()).toContain("30°");
  });
  it("only the matching saved result returns staged values to server ownership", async () => {
    const h = await opened();
    fireEvent.click(screen.getByRole("button", { name: "Turn element clockwise" }));
    fireEvent.click(screen.getByTestId("mobile-inspector-apply"));
    await h.receive({
      t: "map-studio-document",
      document: {
        ...h.initial,
        revision: 1,
        elements: [{ ...propertyDoor, transform: { ...propertyDoor.transform, rotation: 90 } }],
      },
      appliedCommandId: "other-command",
    });
    expect(readout()).toContain("15°");
    await h.ack(0, {
      ...h.initial,
      revision: 2,
      elements: [{ ...propertyDoor, transform: { ...propertyDoor.transform, rotation: 90 } }],
    });
    expect(readout()).toContain("90°");
    expect(screen.getByRole("status")).toHaveTextContent("Changes saved.");
    expect(h.commands()).toHaveLength(1);
  });
});
