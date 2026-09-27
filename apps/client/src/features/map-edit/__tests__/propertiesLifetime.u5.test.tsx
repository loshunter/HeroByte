import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { propertyDocument, propertyDoor, propertyHarness } from "./properties.u5.fixtures";

afterEach(cleanup);
type Harness = ReturnType<typeof propertyHarness>;
const properties = (h: Harness) => {
  const view = h.current().state.toolbarProps.properties;
  if (!view) throw new Error("Expected selected properties");
  return view;
};
const stage = (h: Harness, x = 220) => act(() => properties(h).change("x", x));
const save = (h: Harness) => act(() => properties(h).save());
const moved = { ...propertyDoor, transform: { ...propertyDoor.transform, x: 220 } };

describe("U5 property draft lifetime", () => {
  it("keeps drafts across panel close and desktop/phone remount without expanding the phone", async () => {
    const h = propertyHarness();
    await h.start();
    stage(h);
    h.presentation({ shown: false });
    h.presentation({ phone: true });
    expect(screen.getByTestId("mobile-inspector-toggle")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByTestId("mobile-inspector-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Position and scale" }));
    expect(screen.getByLabelText("X (px)")).toHaveValue(220);
    expect(h.commands()).toHaveLength(0);
  });

  it("waits for every member before following a Save changes selection choice", async () => {
    const h = propertyHarness();
    await h.start();
    stage(h);
    act(() => properties(h).change("doorWidth", 75));
    h.select("door-b");
    expect(h.current().state.toolbarProps.selectedElement?.id).toBe("door-a");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await h.ack(0, { ...h.initial, revision: 1, elements: [moved, h.initial.elements[1]!] });
    expect(h.current().state.toolbarProps.selectedElement?.id).toBe("door-a");
    await h.ack(1, {
      ...h.initial,
      revision: 2,
      elements: [{ ...moved, data: { ...moved.data, width: 75 } }, h.initial.elements[1]!],
    });
    expect(h.current().state.toolbarProps.selectedElement?.id).toBe("door-b");
    expect(properties(h).message).toBe("No staged changes.");
  });

  it("merges untouched server fields without replacing a dirty field", async () => {
    const h = propertyHarness();
    await h.start();
    stage(h);
    await h.receive({
      t: "map-studio-document",
      document: {
        ...h.initial,
        revision: 1,
        elements: [
          {
            ...propertyDoor,
            hidden: true,
            transform: { ...propertyDoor.transform, x: 90, y: 350, rotation: 60 },
          },
        ],
      },
    });
    save(h);
    expect(h.command()).toMatchObject({
      type: "update-element",
      update: { transform: { x: 220, y: 350, rotation: 60 } },
    });
    if (h.command().type !== "update-element") throw new Error("Expected element command");
    expect(h.command()).not.toHaveProperty("update.hidden");
  });

  it("invalidates deleted drafts and uses authoritative values if Undo restores the element", async () => {
    const h = propertyHarness();
    await h.start();
    stage(h);
    const staleSave = properties(h).save;
    await h.receive({
      t: "map-studio-document",
      document: { ...h.initial, revision: 1, elements: [] },
    });
    act(staleSave);
    expect(h.commands()).toHaveLength(0);
    await h.receive({ t: "map-studio-document", document: { ...h.initial, revision: 2 } });
    h.select("door-a");
    expect(properties(h).values.x).toBe(100);
    expect(properties(h).dirty).toBe(false);
  });

  it("does not let retained navigation actions change a different document's selection", async () => {
    const h = propertyHarness();
    await h.start();
    stage(h);
    h.select("door-b");
    const staleDiscard = properties(h).navigation!.discard;
    await h.open(propertyDocument("properties-b"));
    h.select("door-a");
    act(staleDiscard);
    expect(h.current().state.toolbarProps.selectedElement?.id).toBe("door-a");
    expect(h.commands()).toHaveLength(0);
  });

  it("retains drafts across reconnect but discards them on confirmed DM revocation", async () => {
    const h = propertyHarness();
    await h.start();
    stage(h);
    const stale = properties(h);
    h.presentation({ dm: false, loaded: false });
    expect(properties(h).values.x).toBe(220);
    h.presentation({ dm: false, loaded: true });
    act(() => {
      stale.change("x", 400);
      stale.save();
    });
    expect(h.current().state.toolbarProps.properties).toBeNull();
    expect(h.commands()).toHaveLength(0);
    h.presentation({ dm: true });
    expect(properties(h).dirty).toBe(false);
  });

  it("explains invalid numeric values instead of silently disabling Save changes", async () => {
    const h = propertyHarness();
    await h.start();
    fireEvent.change(screen.getByLabelText("Door width (px)"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/width.*1.*1000/i);
    expect(h.commands()).toHaveLength(0);
  });
});
