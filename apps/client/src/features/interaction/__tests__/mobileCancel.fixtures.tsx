import React from "react";
import { render, screen, within } from "@testing-library/react";
import { vi, expect } from "vitest";
import { MobileMapEditDock } from "../../../components/layout/MobileMapEditDock";
import type { MapEditSubTool, MapEditToolbarProps } from "../../map-edit/mapEditTypes";
import {
  at,
  renderMapOwners,
} from "../../map-edit/__tests__/characterization/mapLifecycle.fixtures";

export { at };
export const kinds = ["wall", "terrain", "erase", "place"] as const;
export type Kind = (typeof kinds)[number];
export function label(kind: Kind) {
  return kind === "terrain" || kind === "erase" ? "Cancel stroke" : "Cancel placement";
}
export function mountDock(kind: Kind, dockTool: MapEditSubTool = kind) {
  const map = renderMapOwners(kind);
  const toolbar = {
    isLive: true,
    busy: false,
    saving: false,
    activeSubTool: dockTool,
    canUndo: true,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onClose: vi.fn(),
  } as unknown as MapEditToolbarProps;
  const toggleTools = vi.fn();
  const view = render(
    <MobileMapEditDock toolbar={toolbar} toolsOpen={false} onToggleTools={toggleTools} />,
  );
  const dock = screen.getByRole("navigation", { name: "Map edit actions" });
  const button = within(dock).getAllByRole("button")[4];
  return { ...map, view, dock, button, toolbar, toggleTools };
}
export type MountedDock = ReturnType<typeof mountDock>;
export function expectNoCommands({ controller, toolbar, toggleTools }: MountedDock) {
  for (const command of [
    controller.addWall,
    controller.addDoor,
    controller.addTile,
    controller.addStamp,
    controller.addStamps,
    controller.placeRoom,
    controller.paintTerrain,
  ])
    expect(command).not.toHaveBeenCalled();
  expect(toolbar.onClose).not.toHaveBeenCalled();
  expect(toolbar.onUndo).not.toHaveBeenCalled();
  expect(toolbar.onRedo).not.toHaveBeenCalled();
  expect(toggleTools).not.toHaveBeenCalled();
}
export function expectPreviewCleared({ result }: MountedDock) {
  expect(result.current.map.previewDrag).toBeNull();
  expect(result.current.map.strokeCells).toEqual([]);
  expect(result.current.map.placementGhost).toBeNull();
}
export function expectCommit(mounted: MountedDock, kind: Kind) {
  const { controller } = mounted;
  const expected =
    kind === "wall"
      ? controller.addWall
      : kind === "place"
        ? controller.addTile
        : controller.paintTerrain;
  expect(expected).toHaveBeenCalledTimes(1);
  if (kind === "wall")
    expect(controller.addWall).toHaveBeenCalledWith(
      expect.objectContaining({ x1: 300, y1: 300, x2: 400, y2: 300 }),
    );
  if (kind === "terrain" || kind === "erase")
    expect(controller.paintTerrain).toHaveBeenCalledWith([
      { x: 6, y: 6, assetId: kind === "terrain" ? "terrain:grass" : null },
      // U4b fills the crossed cell while preserving one commit after cancellation.
      { x: 7, y: 6, assetId: kind === "terrain" ? "terrain:grass" : null },
      { x: 8, y: 6, assetId: kind === "terrain" ? "terrain:grass" : null },
    ]);
}
