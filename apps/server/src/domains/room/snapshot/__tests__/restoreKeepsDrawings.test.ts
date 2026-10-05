/**
 * Restoring a table backup must bring its drawings back.
 *
 * A backup (buildSessionFile) carries BOTH the room's scene objects and its flat
 * `drawings` array. The loader cleared `drawings` whenever the file had scene objects,
 * on the theory that the scene graph would rebuild them from those objects - but
 * SceneGraphBuilder builds drawing objects only FROM `state.drawings`, so every
 * drawing on the table vanished on Restore table backup (and on a table fork, which
 * takes the same loadSnapshot road).
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Drawing } from "@herobyte/shared";
import { RoomService } from "../../service.js";
import { buildSessionFile } from "../../sessionExport.js";

const STATE_FILE = path.join(process.cwd(), ".tmp", "restoreKeepsDrawings-state.json");

const line: Drawing = {
  id: "drawing-1",
  owner: "dm-1",
  type: "freehand",
  points: [
    { x: 10, y: 10 },
    { x: 60, y: 40 },
  ],
  color: "#ff0000",
  width: 3,
  opacity: 1,
};

describe("Restore table backup keeps the table's drawings", () => {
  it("a backup's drawings come back, scene objects and all", () => {
    const source = new RoomService({ stateFile: STATE_FILE });
    source.getState().drawings.push(line);
    source.createSnapshot(); // rebuilds the scene graph, as every broadcast does
    expect(source.getState().sceneObjects.some((o) => o.id === "drawing:drawing-1")).toBe(true);

    const file = buildSessionFile(source.getState(), [], "dm-1", Date.now());
    expect(file.snapshot.drawings).toHaveLength(1);
    expect(file.snapshot.sceneObjects?.length ?? 0).toBeGreaterThan(0);

    const target = new RoomService({ stateFile: STATE_FILE });
    target.loadSnapshot(file.snapshot);

    expect(target.getState().drawings.map((d) => d.id)).toEqual(["drawing-1"]);
    expect(target.getState().sceneObjects.some((o) => o.id === "drawing:drawing-1")).toBe(true);
  });

  it("a drawing's lock and position offset survive the restore", () => {
    const source = new RoomService({ stateFile: STATE_FILE });
    source.getState().drawings.push(line);
    source.createSnapshot();
    const object = source.getState().sceneObjects.find((o) => o.id === "drawing:drawing-1")!;
    object.locked = true;
    object.transform = { ...object.transform, x: 25, y: 5 };

    const file = buildSessionFile(source.getState(), [], "dm-1", Date.now());
    const target = new RoomService({ stateFile: STATE_FILE });
    target.loadSnapshot(file.snapshot);

    const restored = target.getState().sceneObjects.find((o) => o.id === "drawing:drawing-1");
    expect(restored?.locked).toBe(true);
    expect(restored?.transform).toMatchObject({ x: 25, y: 5 });
  });
});
