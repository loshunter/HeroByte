import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapStampElement } from "@herobyte/shared";
import { AmbientLightControl } from "../AmbientLightControl";
import { MapEditActiveSettings } from "../MapEditActiveSettings";
import { MobileMapEditToolPanels } from "../mobile/MobileMapEditToolPanels";
import { ElementPropertiesSummary } from "../ElementPropertiesForm";
import { useMyStuffAssets } from "../../map-studio/uploads/useMyStuffAssets";
import { propertyDocument, propertyDoor, propertyHarness } from "./properties.u5.fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("U5 interrupted-review regressions", () => {
  it("submits only the final pointer-drag ambient value", () => {
    const update = vi.fn();
    const view = render(
      <AmbientLightControl
        layers={propertyDocument().layers}
        saving={false}
        onUpdateLayer={update}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Ambient light" });
    fireEvent.pointerDown(slider, { pointerId: 1 });
    for (const value of ["0.95", "0.6", "0.2"]) {
      fireEvent.change(slider, { target: { value } });
      expect(slider).toBeEnabled();
      expect(update).not.toHaveBeenCalled();
    }
    expect(screen.getByText(/Ambient light.*20%/)).toBeVisible();
    fireEvent.pointerUp(slider, { pointerId: 1 });
    fireEvent.blur(slider);
    expect(update).toHaveBeenCalledExactlyOnceWith("lighting", { opacity: 0.2 });
    view.rerender(
      <AmbientLightControl layers={propertyDocument().layers} saving onUpdateLayer={update} />,
    );
    expect(slider).toBeDisabled();
    expect(slider).toHaveValue("0.2");
  });

  it("commits a repeated keyboard adjustment once on release, and cancels a pointer draft", () => {
    const update = vi.fn();
    render(
      <AmbientLightControl
        layers={propertyDocument().layers}
        saving={false}
        onUpdateLayer={update}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Ambient light" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.change(slider, { target: { value: "0.95" } });
    fireEvent.keyDown(slider, { key: "ArrowLeft", repeat: true });
    fireEvent.change(slider, { target: { value: "0.9" } });
    expect(update).not.toHaveBeenCalled();
    fireEvent.keyUp(slider, { key: "ArrowLeft" });
    expect(update).toHaveBeenCalledExactlyOnceWith("lighting", { opacity: 0.9 });
    fireEvent.pointerDown(slider, { pointerId: 2 });
    fireEvent.change(slider, { target: { value: "0.4" } });
    fireEvent.pointerCancel(slider, { pointerId: 2 });
    fireEvent.blur(slider);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("restores the authoritative slider and shows a refused update without retrying", () => {
    const update = vi.fn();
    const props = { layers: propertyDocument().layers, onUpdateLayer: update };
    const view = render(<AmbientLightControl {...props} saving={false} />);
    const slider = screen.getByRole("slider", { name: "Ambient light" });
    fireEvent.pointerDown(slider, { pointerId: 1 });
    fireEvent.change(slider, { target: { value: "0.2" } });
    fireEvent.pointerUp(slider, { pointerId: 1 });
    view.rerender(<AmbientLightControl {...props} saving />);
    expect(slider).toHaveValue("0.2");
    view.rerender(<AmbientLightControl {...props} saving={false} error="Authoritative refusal" />);
    expect(slider).toHaveValue("1");
    expect(screen.getByRole("alert")).toHaveTextContent("Authoritative refusal");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "drops an ambient gesture when the inspected document changes (phone=%s)",
    async (phone) => {
      const h = propertyHarness();
      await h.start();
      const panel = () =>
        phone ? (
          <MobileMapEditToolPanels {...h.current().state.toolbarProps} activeSubTool="light" />
        ) : (
          <MapEditActiveSettings {...h.current().state.toolbarProps} activeSubTool="light" />
        );
      const view = render(panel());
      const original = screen.getByRole("slider", { name: "Ambient light" });
      fireEvent.pointerDown(original, { pointerId: 1 });
      fireEvent.change(original, { target: { value: "0.2" } });
      await h.open(propertyDocument("another-map"));
      view.rerender(panel());
      const replacement = screen.getByRole("slider", { name: "Ambient light" });
      expect(replacement).not.toBe(original);
      expect(replacement).toHaveValue("1");
      fireEvent.pointerUp(original, { pointerId: 1 });
      expect(h.commands()).toHaveLength(0);
    },
  );

  it.each([false, true])(
    "retains draft escape controls after a phone selection locks (open=%s)",
    async (open) => {
      const h = propertyHarness(true);
      await h.start();
      act(() => h.current().state.toolbarProps.properties!.change("x", 220));
      if (open) fireEvent.click(screen.getByTestId("mobile-inspector-toggle"));
      await h.receive({
        t: "map-studio-document",
        document: {
          ...h.initial,
          revision: 1,
          elements: [{ ...propertyDoor, locked: true }, h.initial.elements[1]!],
        },
      });
      h.select("door-b");
      expect(h.current().state.toolbarProps.selectedElement?.id).toBe("door-a");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Keep editing" })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
      expect(h.current().state.toolbarProps.selectedElement?.id).toBe("door-b");
      expect(h.commands()).toHaveLength(0);
    },
  );

  it("preserves an incomplete numeric draft without turning it into a saveable zero", async () => {
    const h = propertyHarness(true);
    await h.start();
    fireEvent.click(screen.getByTestId("mobile-inspector-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Position and scale" }));
    const x = screen.getByLabelText("X (px)");
    fireEvent.change(x, { target: { value: "" } });
    expect(x).toHaveValue(null);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/finite numbers/);
    fireEvent.change(x, { target: { value: "-25.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(h.command()).toMatchObject({
      type: "update-element",
      update: { transform: { x: -25.5 } },
    });
  });

  it("names uploaded selections from the local shelf and distinguishes unknown uploads", () => {
    const a = "a".repeat(64),
      b = "b".repeat(64),
      c = "c".repeat(64);
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([{ hash: a, name: "Amber torch", mime: "image/png", size: 1, addedAt: 1 }]),
    });
    const stamp = (hash: string): MapStampElement => ({
      id: hash,
      type: "stamp",
      layerId: "objects",
      hidden: false,
      locked: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { assetId: `upload:${hash}`, width: 50, height: 50 },
    });
    const view = render(
      <ElementPropertiesSummary element={stamp(a)} layers={propertyDocument().layers} />,
    );
    expect(view.container).toHaveTextContent("Amber torch");
    view.rerender(
      <ElementPropertiesSummary element={stamp(b)} layers={propertyDocument().layers} />,
    );
    const first = view.container.textContent;
    expect(first).toContain("Uploaded image");
    view.rerender(
      <ElementPropertiesSummary element={stamp(c)} layers={propertyDocument().layers} />,
    );
    expect(view.container.textContent).toContain("Uploaded image");
    expect(view.container.textContent).not.toBe(first);
  });

  it("keeps session-only upload names through selection, replacement and removal", async () => {
    const hash = "d".repeat(64);
    const stored = { hash, name: "Old torch", mime: "image/png", size: 1, addedAt: 1 };
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify([stored]),
      setItem: () => {
        throw new Error("Storage blocked");
      },
    });
    vi.stubGlobal("URL", { createObjectURL: undefined });
    const upload = vi.fn().mockResolvedValue({
      hash,
      url: `/assets/${hash}`,
      mime: "image/png",
      size: 1,
      deduplicated: false,
    });
    const shelf = renderHook(() => useMyStuffAssets(upload));
    await act(() => shelf.result.current.uploadFiles([new File(["art"], "Amber torch.png")]));
    expect(shelf.result.current.assets[0]?.name).toBe("Amber torch");
    const stamp: MapStampElement = {
      id: "session-upload",
      type: "stamp",
      layerId: "objects",
      hidden: false,
      locked: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { assetId: `upload:${hash}`, width: 50, height: 50 },
    };
    const summary = () => (
      <ElementPropertiesSummary element={stamp} layers={propertyDocument().layers} />
    );
    const view = render(summary());
    expect(view.container).toHaveTextContent(`Amber torch · ${hash.slice(0, 12)}`);
    await act(() => shelf.result.current.uploadFiles([new File(["art"], "Copper torch.png")]));
    view.rerender(summary());
    expect(view.container).toHaveTextContent("Copper torch");
    act(() => shelf.result.current.removeAsset(hash));
    view.rerender(summary());
    expect(view.container).toHaveTextContent(`Uploaded image · ${hash.slice(0, 12)}`);
    expect(view.container).not.toHaveTextContent("Old torch");
  });

  it("grows a phone scale above ten without shrinking either axis", async () => {
    const h = propertyHarness(true);
    await h.start();
    fireEvent.click(screen.getByTestId("mobile-inspector-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Position and scale" }));
    fireEvent.change(screen.getByLabelText("Scale X (×)"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Grow element" }));
    expect(screen.getByLabelText("Scale X (×)")).toHaveValue(20.1);
    expect(screen.getByLabelText("Scale Y (×)")).toHaveValue(1.1);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(h.command()).toMatchObject({
      type: "update-element",
      update: { transform: { scaleX: 20.1, scaleY: 1.1 } },
    });
  });

  it("disables phone shrinking below the step floor while keeping numeric scales saveable", async () => {
    const h = propertyHarness(true);
    await h.start();
    fireEvent.click(screen.getByTestId("mobile-inspector-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Position and scale" }));
    fireEvent.change(screen.getByLabelText("Scale X (×)"), { target: { value: "0.05" } });
    const shrink = screen.getByRole("button", { name: "Shrink element" });
    expect(shrink).toBeDisabled();
    fireEvent.click(shrink);
    expect(screen.getByLabelText("Scale X (×)")).toHaveValue(0.05);
    expect(screen.getByLabelText("Scale Y (×)")).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(h.command()).toMatchObject({
      type: "update-element",
      update: { transform: { scaleX: 0.05, scaleY: 1 } },
    });
  });
});
