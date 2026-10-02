import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapEditActiveSettings } from "../MapEditActiveSettings";
import { MapEditLayersPopover } from "../MapEditLayersPopover";
import { MobileMapEditToolPanels, PANEL_TOOLS } from "../mobile/MobileMapEditToolPanels";
import { MobileLayersPanel } from "../mobile/MobileLayersPanel";
import { propertyDocument, propertyHarness } from "./properties.u5.fixtures";
import { AmbientLightControl } from "../AmbientLightControl";

afterEach(cleanup);
describe("U5 ambient light lives in Lighting", () => {
  it.each([0.2, 0, 1])("exposes %s ambient as a percentage in every slider", (opacity) => {
    const layers = propertyDocument().layers.map((layer) => ({ ...layer, opacity }));
    render(
      <>
        <AmbientLightControl layers={layers} saving={false} onUpdateLayer={vi.fn()} />
        <MapEditLayersPopover
          layers={layers}
          saving={false}
          onUpdateLayer={vi.fn()}
          onMoveLayer={vi.fn()}
        />
        <MobileLayersPanel layers={layers} open saving={false} onUpdateLayer={vi.fn()} />
      </>,
    );
    const sliders = screen.getAllByRole("slider", { name: "Ambient light" });
    expect(sliders).toHaveLength(3);
    for (const slider of sliders) {
      expect(slider).toHaveAttribute("aria-valuetext", `${Math.round(opacity * 100)}%`);
    }
  });

  it("keeps the phone Layers sliders focusable while saving (a disabled control loses keyboard focus)", () => {
    const onUpdateLayer = vi.fn();
    render(
      <MobileLayersPanel
        layers={propertyDocument().layers}
        open
        saving
        onUpdateLayer={onUpdateLayer}
      />,
    );
    for (const slider of screen.getAllByRole("slider")) {
      expect(slider).toBeEnabled();
      expect(slider).toHaveAttribute("aria-disabled", "true");
      fireEvent.change(slider, { target: { value: "0.5" } });
    }
    expect(onUpdateLayer).not.toHaveBeenCalled();
  });

  it("associates endpoint help uniquely and exposes a gesture's draft percentage", () => {
    const props = { layers: propertyDocument().layers, saving: false, onUpdateLayer: vi.fn() };
    render(
      <>
        <AmbientLightControl {...props} />
        <AmbientLightControl {...props} />
      </>,
    );
    const sliders = screen.getAllByRole("slider", { name: "Ambient light" });
    for (const slider of sliders) expect(slider).toHaveAccessibleDescription("Dark → Daylight");
    expect(sliders[0]?.getAttribute("aria-describedby")).not.toBe(
      sliders[1]?.getAttribute("aria-describedby"),
    );
    fireEvent.pointerDown(sliders[0]!, { pointerId: 1 });
    fireEvent.change(sliders[0]!, { target: { value: "0.2" } });
    expect(sliders[0]).toHaveAttribute("aria-valuetext", "20%");
    expect(props.onUpdateLayer).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "controls the same authoritative layer without opening Layers (phone=%s)",
    async (phone) => {
      const h = propertyHarness(phone);
      await h.start();
      const panel = () =>
        phone ? (
          <MobileMapEditToolPanels {...h.current().state.toolbarProps} activeSubTool="light" />
        ) : (
          <MapEditActiveSettings {...h.current().state.toolbarProps} activeSubTool="light" />
        );
      const view = render(panel());
      expect(h.current().state.toolbarProps.layersOpen).toBe(false);
      const slider = screen.getByRole("slider", { name: "Ambient light" });
      expect(screen.getByText(/Ambient light.*100%/)).toBeVisible();
      expect(screen.getByText(/Dark.*Daylight/)).toBeVisible();
      fireEvent.change(slider, { target: { value: "0.35" } });
      expect(h.commands()).toHaveLength(1);
      expect(h.command()).toMatchObject({
        type: "update-layer",
        layerId: "lighting",
        update: { opacity: 0.35 },
      });
      if (h.command().type !== "update-layer") throw new Error("Expected lighting update");
      await h.ack(0, {
        ...h.initial,
        revision: 1,
        layers: h.initial.layers.map((layer) =>
          layer.kind === "lighting" ? { ...layer, opacity: 0.35 } : layer,
        ),
      });
      view.rerender(panel());
      expect(screen.getByRole("slider", { name: "Ambient light" })).toHaveValue("0.35");
      expect(screen.getByText(/Ambient light.*35%/)).toBeVisible();
      view.unmount();
      render(panel());
      expect(screen.getByRole("slider", { name: "Ambient light" })).toHaveValue("0.35");
      expect(h.commands()).toHaveLength(1);
    },
  );

  it("keeps Lighting's phone sheet open to expose its ambient control", () => {
    expect(PANEL_TOOLS.has("light")).toBe(true);
  });

  it.each([false, true])(
    "labels other layer sliders with Opacity and a percentage (phone=%s)",
    async (phone) => {
      const h = propertyHarness();
      await h.start();
      const layers = h.initial.layers.map((layer) => ({ ...layer, opacity: 0.65 }));
      render(
        phone ? (
          <MobileLayersPanel layers={layers} open saving={false} onUpdateLayer={vi.fn()} />
        ) : (
          <MapEditLayersPopover
            layers={layers}
            saving={false}
            onUpdateLayer={vi.fn()}
            onMoveLayer={vi.fn()}
          />
        ),
      );
      const slider = screen.getByRole("slider", { name: "Objects opacity" });
      const row = slider.closest(phone ? "label" : "li");
      expect(row).toHaveTextContent(/Opacity.*65%/);
      expect(screen.getByRole("slider", { name: "Ambient light" })).toHaveValue("0.65");
    },
  );
});
