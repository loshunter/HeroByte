import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { propertyDocument, propertyDoor, propertyHarness } from "./properties.u5.fixtures";

afterEach(cleanup);
type Harness = ReturnType<typeof propertyHarness>;
const props = (h: Harness) => {
  const view = h.current().state.toolbarProps.properties;
  if (!view) throw new Error("Expected properties");
  return view;
};
async function unknown(h: Harness) {
  await h.start();
  act(() => props(h).change("x", 220));
  act(() => props(h).save());
  await h.refuse(0, true);
  expect(props(h).uncertain).toBe(true);
}
function refresh(h: Harness) {
  fireEvent.click(screen.getByRole("button", { name: "Refresh saved values" }));
  const request = h.send.mock.calls.at(-1)?.[0];
  if (request?.t !== "map-studio-get" || !request.requestId)
    throw new Error("Expected identified GET");
  return request.requestId;
}
const inspect = () => screen.getByRole("button", { name: "I've checked the saved values" });

describe("U5 unknown property completion", () => {
  it("finishes the other save member before recovery and names its confirmed result", async () => {
    const h = propertyHarness();
    await h.start();
    act(() => {
      props(h).change("x", 220);
      props(h).change("doorWidth", 75);
    });
    act(() => props(h).save());
    await h.refuse(0, true);
    expect(screen.getByRole("button", { name: "Refresh saved values" })).toBeDisabled();
    expect(h.commands()).toHaveLength(2);
    await h.ack(1, {
      ...h.initial,
      revision: 1,
      elements: [{ ...propertyDoor, data: { ...propertyDoor.data, width: 75 } }],
    });
    expect(screen.getByRole("status")).toHaveTextContent("Door settings saved.");
    expect(screen.getByRole("status")).toHaveTextContent(/Properties.*unconfirmed/);
    expect(props(h).canSave).toBe(false);
  });

  it("shows every saved field needed to inspect an uncertain draft", async () => {
    const h = propertyHarness();
    await unknown(h);
    const id = refresh(h);
    await h.receive({
      t: "map-studio-document",
      requestId: id,
      document: {
        ...h.initial,
        revision: 1,
        elements: [
          {
            ...propertyDoor,
            hidden: true,
            transform: { ...propertyDoor.transform, scaleX: 2, scaleY: 3 },
          },
        ],
      },
    });
    const readout = screen.getByText(/Saved values:/);
    expect(readout).toHaveTextContent(/Scale X 2.*Scale Y 3/);
    expect(readout).toHaveTextContent("Layer Walls & Doors");
    expect(readout).toHaveTextContent("Hidden from players: yes");
    expect(readout).toHaveTextContent("X 100 px");
    expect(props(h).values.x).toBe(220);
  });

  it("requires the matching explicit read and deliberate inspection before retrying", async () => {
    const h = propertyHarness();
    await unknown(h);
    const id = refresh(h);
    await h.receive({
      t: "map-studio-document",
      document: { ...h.initial, revision: 1 },
      requestId: "another-get",
    });
    expect(inspect()).toBeDisabled();
    expect(props(h).canSave).toBe(false);
    await h.receive({
      t: "map-studio-document",
      document: { ...h.initial, revision: 2 },
      requestId: id,
    });
    expect(inspect()).toBeEnabled();
    expect(props(h).canSave).toBe(false);
    expect(h.commands()).toHaveLength(1);
    fireEvent.click(inspect());
    expect(props(h).canSave).toBe(true);
    expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
    act(() => props(h).save());
    expect(h.commands()).toHaveLength(2);
    expect(h.command(1)).toMatchObject({
      type: "update-element",
      update: { transform: { x: 220 } },
    });
  });

  it("drops already-matching fields after inspection without sending a duplicate", async () => {
    const h = propertyHarness();
    await unknown(h);
    const id = refresh(h);
    await h.receive({
      t: "map-studio-document",
      requestId: id,
      document: {
        ...h.initial,
        revision: 1,
        elements: [{ ...propertyDoor, transform: { ...propertyDoor.transform, x: 220 } }],
      },
    });
    fireEvent.click(inspect());
    expect(props(h).dirty).toBe(false);
    expect(props(h).canSave).toBe(false);
    expect(h.commands()).toHaveLength(1);
    expect(screen.queryByText("Changes saved.")).not.toBeInTheDocument();
  });

  it("keeps late acknowledgements and stale recovery receipts scoped through A to B to A", async () => {
    const h = propertyHarness();
    await unknown(h);
    const id = refresh(h);
    await h.open(propertyDocument("properties-b"));
    h.select("door-a");
    act(() => props(h).change("x", 330));
    await h.ack(0, { ...h.initial, revision: 1 });
    expect(h.current().controller.activeDocument?.id).toBe("properties-b");
    expect(props(h).values.x).toBe(330);
    expect(props(h).message).toBe("Unsaved changes.");
    await h.open({ ...h.initial, revision: 2 });
    h.select("door-a");
    await h.receive({
      t: "map-studio-document",
      requestId: id,
      document: { ...h.initial, revision: 3 },
    });
    expect(props(h).values.x).toBe(220);
    expect(props(h).canSave).toBe(false);
    expect(inspect()).toBeDisabled();
    expect(h.commands()).toHaveLength(1);
  });
});
