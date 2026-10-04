import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument, type ClientMessage, type MapDoorElement } from "@herobyte/shared";
import { useMapStudio } from "../../../map-studio/useMapStudio";
import { propertyHarness } from "../properties.u5.fixtures";
import { MapEditLayersPopover } from "../../MapEditLayersPopover";
import { MobileLayersPanel } from "../../mobile/MobileLayersPanel";

afterEach(cleanup);
const document = createMapDocument({ id: "properties-map", name: "Keep", timestamp: 1 });
const door: MapDoorElement = {
  id: "door-1",
  type: "door",
  layerId: "walls",
  hidden: false,
  locked: false,
  transform: { x: 100, y: 150, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
};

describe("properties and lighting contracts before U5", () => {
  it("staging desktop transform, layer and door values sends nothing until Save changes", async () => {
    const h = propertyHarness();
    await h.start();
    fireEvent.click(screen.getByRole("button", { name: "Position and scale" }));
    fireEvent.change(screen.getByLabelText("X (px)"), { target: { value: "220" } });
    fireEvent.change(screen.getByLabelText("Element layer"), { target: { value: "objects" } });
    fireEvent.change(screen.getByLabelText("Door state"), { target: { value: "locked" } });
    expect(h.commands()).toHaveLength(0);
    expect(h.initial.elements[0]!.transform.x).toBe(100);
  });

  it("a phone draft retains transform/layer/visibility across unrelated same-element snapshots", async () => {
    const h = propertyHarness(true);
    await h.start();
    fireEvent.click(screen.getByTestId("mobile-inspector-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Position and scale" }));
    fireEvent.click(screen.getByRole("button", { name: "Turn element clockwise" }));
    fireEvent.click(screen.getByRole("button", { name: "Grow element" }));
    fireEvent.change(screen.getByLabelText("Element layer"), { target: { value: "objects" } });
    fireEvent.click(screen.getByLabelText("Hide element"));
    await h.receive({ t: "map-studio-document", document: structuredClone(h.initial) });
    fireEvent.click(screen.getByTestId("mobile-inspector-apply"));
    expect(h.commands()).toHaveLength(1);
    expect(h.command()).toMatchObject({
      type: "update-element",
      elementId: "door-a",
      update: {
        transform: { x: 100, y: 150, scaleX: 1.1, scaleY: 1.1, rotation: 15 },
        layerId: "objects",
        hidden: true,
      },
    });
  });

  it.each(["desktop", "phone"])(
    "%s ambient control updates only the existing lighting layer opacity",
    (mode) => {
      const onUpdateLayer = vi.fn();
      render(
        mode === "desktop" ? (
          <MapEditLayersPopover
            layers={document.layers}
            saving={false}
            onUpdateLayer={onUpdateLayer}
            onMoveLayer={vi.fn()}
          />
        ) : (
          <MobileLayersPanel
            layers={document.layers}
            open
            saving={false}
            onUpdateLayer={onUpdateLayer}
          />
        ),
      );
      fireEvent.change(screen.getByRole("slider", { name: "Ambient light" }), {
        target: { value: "0.35" },
      });
      expect(onUpdateLayer).toHaveBeenCalledExactlyOnceWith("lighting", { opacity: 0.35 });
      expect(document.layers.find((layer) => layer.id === "lighting")?.opacity).toBe(1);
    },
  );

  it("the single controller serializes transform and door commands with distinct authoritative receipts", () => {
    const send = vi.fn<(message: ClientMessage) => void>();
    const { result } = renderHook(() => useMapStudio(send));
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-document",
        document: { ...document, elements: [door] },
      }),
    );
    act(() => {
      result.current.updateElement(door.id, { transform: { ...door.transform, x: 220 } });
      result.current.updateDoor(door.id, { state: "locked", width: 75 });
    });
    expect(send).toHaveBeenCalledTimes(1);
    const first = send.mock.calls[0]![0];
    if (first.t !== "map-studio-command") throw new Error("Expected first map command");
    expect(first.command).toMatchObject({
      type: "update-element",
      documentId: document.id,
      baseRevision: 0,
      elementId: door.id,
    });
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-document",
        document: { ...document, revision: 1, elements: [door] },
        appliedCommandId: "unrelated",
      }),
    );
    expect(send).toHaveBeenCalledTimes(1);
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-document",
        document: { ...document, revision: 1, elements: [door] },
        appliedCommandId: first.command.commandId,
      }),
    );
    expect(send).toHaveBeenCalledTimes(2);
    const second = send.mock.calls[1]![0];
    if (second.t !== "map-studio-command") throw new Error("Expected second map command");
    expect(second.command).toMatchObject({
      type: "update-door",
      documentId: document.id,
      baseRevision: 1,
      elementId: door.id,
      state: "locked",
      width: 75,
    });
    expect(second.command.commandId).not.toBe(first.command.commandId);
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-document",
        document: { ...document, revision: 2, elements: [door] },
        appliedCommandId: second.command.commandId,
      }),
    );
    expect(result.current.saving).toBe(false);
  });
});
