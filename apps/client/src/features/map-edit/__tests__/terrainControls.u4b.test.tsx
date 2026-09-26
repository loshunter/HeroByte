import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { boundPalette } from "./characterization/palette.fixtures";
import { MapEditActiveSettings } from "../MapEditActiveSettings";
import { MapEditToolbar } from "../MapEditToolbar";
import { MobileMapEditToolPanels } from "../mobile/MobileMapEditToolPanels";
import { MobileMapEditDock } from "../../../components/layout/MobileMapEditDock";

vi.mock("../brushThumbnails", () => ({
  peekBrushThumbnail: () => null,
  requestBrushThumbnails: vi.fn(),
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));
afterEach(cleanup);

describe("U4b shared controls", () => {
  it("routes a terrain-prefixed nonmaterial to Place without stealing the brush family", () => {
    const h = boundPalette();
    act(() => h.result.current.state.onSampleAsset("terrain:unknown-art", "tool"));
    expect(h.result.current.state).toMatchObject({
      activeSubTool: "place",
      floorFamily: "grass",
      selectedAssetId: "terrain:unknown-art",
    });
    expect(h.props().activeGroup).toBe("objects");
  });
  it.each([false, true])("changes the same brush size from the %s mobile surface", (mobile) => {
    const h = boundPalette();
    act(() => h.result.current.state.toolbarProps.onSelectSubTool("terrain"));
    const Surface = mobile ? MobileMapEditToolPanels : MapEditActiveSettings;
    const view = render(<Surface {...h.props()} />);
    expect(screen.getByRole("button", { name: "1 × 1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "3 × 3" }));
    expect(h.result.current.state).toMatchObject({ terrainBrushSize: 3 });
    act(() => h.result.current.state.toolbarProps.onSelectSubTool("erase"));
    view.rerender(<Surface {...h.props()} />);
    expect(screen.getByRole("button", { name: "3 × 3" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "5 × 5" }));
    const Other = mobile ? MapEditActiveSettings : MobileMapEditToolPanels;
    view.rerender(<Other {...h.props()} />);
    expect(screen.getByRole("button", { name: "5 × 5" })).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["terrain:grass", "terrain:stone-floor"])(
    "explicit Sample of %s resumes Paint and shows the material",
    (assetId) => {
      const h = boundPalette();
      act(() => h.result.current.state.toolbarProps.onSelectFloorFamily("dirt"));
      act(() => h.result.current.state.toolbarProps.onSelectSubTool("eyedropper"));
      h.send.mockClear();
      act(() => h.result.current.state.onSampleAsset(assetId, "tool"));
      expect(h.result.current.state).toMatchObject({
        activeSubTool: "terrain",
        floorFamily: assetId.slice(8),
        selectedAssetId: assetId,
      });
      expect(h.props().activeGroup).toBe("terrain");
      expect(h.send).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "shows the resulting tool and selection without scrolling (phone=%s)",
    (mobile) => {
      const h = boundPalette();
      act(() => h.result.current.state.onSampleAsset("objects:crate", "tool"));
      const onToggleTools = vi.fn();
      const surface = () =>
        mobile ? (
          <MobileMapEditDock toolbar={h.props()} toolsOpen={false} onToggleTools={onToggleTools} />
        ) : (
          <MapEditToolbar {...h.props()} />
        );
      const view = render(surface());
      expect(screen.getByTestId("map-edit-armed")).toHaveTextContent(/Place object.*Crate/);
      act(() => h.result.current.state.onSampleAsset("terrain:grass", "tool"));
      view.rerender(surface());
      expect(screen.getByTestId("map-edit-armed")).toHaveTextContent(/Paint terrain.*Grass.*1 × 1/);
      if (mobile) expect(screen.getAllByRole("button")).toHaveLength(5);
      expect(onToggleTools).not.toHaveBeenCalled();
    },
  );
});
