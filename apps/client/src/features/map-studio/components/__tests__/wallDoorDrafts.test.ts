import { describe, expect, it, vi } from "vitest";
import type { MapLayer } from "@herobyte/shared";
import { commitSegmentDrag, doorDraftFromDrag, wallDraftFromDrag } from "../wallDoorDrafts";

describe("wallDraftFromDrag", () => {
  it("maps a two-point drag to a wall's endpoint pair, blocking by default", () => {
    expect(wallDraftFromDrag("walls", { start: { x: 0, y: 0 }, end: { x: 150, y: 0 } })).toEqual({
      layerId: "walls",
      x1: 0,
      y1: 0,
      x2: 150,
      y2: 0,
      blocksMovement: true,
      blocksVision: true,
    });
  });

  it("returns null for a zero-length drag (no segment to draw)", () => {
    expect(
      wallDraftFromDrag("walls", { start: { x: 40, y: 40 }, end: { x: 40, y: 40 } }),
    ).toBeNull();
  });
});

describe("doorDraftFromDrag", () => {
  it("places a horizontal door at the drag start: width = length, rotation 0, closed", () => {
    expect(doorDraftFromDrag("walls", { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } })).toEqual({
      layerId: "walls",
      x: 0,
      y: 0,
      width: 100,
      rotation: 0,
      state: "closed",
      blocksMovement: true,
      blocksVision: true,
    });
  });

  it("captures the drag angle so a door drawn along a wall lands correctly angled", () => {
    const vertical = doorDraftFromDrag("walls", { start: { x: 10, y: 10 }, end: { x: 10, y: 60 } });
    expect(vertical?.width).toBeCloseTo(50, 6);
    expect(vertical?.rotation).toBeCloseTo(90, 6);

    // 3-4-5 triangle: length 50, angle atan2(40, 30) ≈ 53.13°.
    const diagonal = doorDraftFromDrag("walls", { start: { x: 0, y: 0 }, end: { x: 30, y: 40 } });
    expect(diagonal?.width).toBeCloseTo(50, 6);
    expect(diagonal?.rotation).toBeCloseTo(53.130102, 4);

    // Dragging leftward yields a 180° door, never a negative width.
    const reversed = doorDraftFromDrag("walls", { start: { x: 100, y: 0 }, end: { x: 0, y: 0 } });
    expect(reversed?.width).toBeCloseTo(100, 6);
    expect(reversed?.rotation).toBeCloseTo(180, 6);
  });

  it("defaults to closed (an open door blocks nothing) and blocks movement + vision", () => {
    expect(
      doorDraftFromDrag("walls", { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } }),
    ).toMatchObject({ state: "closed", blocksMovement: true, blocksVision: true });
  });

  it("returns null for a zero-length drag", () => {
    expect(doorDraftFromDrag("walls", { start: { x: 5, y: 5 }, end: { x: 5, y: 5 } })).toBeNull();
  });
});

describe("commitSegmentDrag", () => {
  function wallsLayers(): Map<string, MapLayer> {
    return new Map([["walls", { id: "walls", name: "Walls & Doors", kind: "walls" } as MapLayer]]);
  }

  it("routes a wall drag to addWall and a door drag to addDoor, resolving the walls layer by kind", () => {
    const addWall = vi.fn();
    const addDoor = vi.fn();

    commitSegmentDrag(
      "wall",
      wallsLayers(),
      { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
      addWall,
      addDoor,
    );
    expect(addWall).toHaveBeenCalledWith(expect.objectContaining({ layerId: "walls", x2: 50 }));
    expect(addDoor).not.toHaveBeenCalled();

    commitSegmentDrag(
      "door",
      wallsLayers(),
      { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
      addWall,
      addDoor,
    );
    expect(addDoor).toHaveBeenCalledWith(
      expect.objectContaining({ layerId: "walls", width: 50, state: "closed" }),
    );
  });

  it("commits nothing for a zero-length drag or when no walls-kind layer exists", () => {
    const addWall = vi.fn();
    const addDoor = vi.fn();

    // Zero-length: no segment.
    commitSegmentDrag(
      "wall",
      wallsLayers(),
      { start: { x: 5, y: 5 }, end: { x: 5, y: 5 } },
      addWall,
      addDoor,
    );
    // No walls-kind layer in the map.
    const noWalls = new Map<string, MapLayer>([
      ["terrain", { id: "terrain", name: "Terrain", kind: "terrain" } as MapLayer],
    ]);
    commitSegmentDrag(
      "door",
      noWalls,
      { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
      addWall,
      addDoor,
    );

    expect(addWall).not.toHaveBeenCalled();
    expect(addDoor).not.toHaveBeenCalled();
  });
});
