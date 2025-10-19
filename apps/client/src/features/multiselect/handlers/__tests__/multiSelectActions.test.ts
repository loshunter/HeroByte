import { describe, expect, it } from "vitest";
import type { SceneObject } from "@shared";
import {
  analyzeObjectsForDeletion,
  shouldBlockDelete,
  buildDeleteConfirmationMessage,
  buildPartialDeleteWarning,
  buildDeleteBlockedMessage,
  separateObjectsByType,
} from "../multiSelectActions.js";

function createSceneObject(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: "token:1",
    type: "token",
    owner: "player-1",
    locked: false,
    zIndex: 0,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    data: { color: "#fff", size: "medium" },
    ...overrides,
  } as SceneObject;
}

describe("multiSelectActions handlers", () => {
  describe("analyzeObjectsForDeletion", () => {
    it("allows DM to delete unlocked objects", () => {
      const objects = [createSceneObject({ id: "token:1", locked: false })];
      const result = analyzeObjectsForDeletion(["token:1"], objects, "player-1", true);
      expect(result.allowed).toEqual(["token:1"]);
      expect(result.blocked.size).toBe(0);
    });

    it("blocks locked objects even for DM", () => {
      const objects = [createSceneObject({ id: "token:1", locked: true })];
      const result = analyzeObjectsForDeletion(["token:1"], objects, "player-1", true);
      expect(result.allowed).toEqual([]);
      expect(result.blocked.get("token:1")).toBe("locked");
    });

    it("allows owner to delete their own objects", () => {
      const objects = [createSceneObject({ id: "token:1", owner: "player-1" })];
      const result = analyzeObjectsForDeletion(["token:1"], objects, "player-1", false);
      expect(result.allowed).toEqual(["token:1"]);
      expect(result.blocked.size).toBe(0);
    });

    it("blocks non-owner from deleting others' objects", () => {
      const objects = [createSceneObject({ id: "token:1", owner: "player-2" })];
      const result = analyzeObjectsForDeletion(["token:1"], objects, "player-1", false);
      expect(result.allowed).toEqual([]);
      expect(result.blocked.get("token:1")).toBe("not-owner");
    });

    it("allows deletion of objects with no owner", () => {
      const objects = [createSceneObject({ id: "token:1", owner: undefined })];
      const result = analyzeObjectsForDeletion(["token:1"], objects, "player-1", false);
      expect(result.allowed).toEqual(["token:1"]);
      expect(result.blocked.size).toBe(0);
    });

    it("blocks map objects from deletion", () => {
      const objects = [createSceneObject({ id: "map:background", type: "map" })];
      const result = analyzeObjectsForDeletion(["map:background"], objects, "player-1", true);
      expect(result.allowed).toEqual([]);
      expect(result.blocked.get("map:background")).toBe("no-permission");
    });

    it("handles mixed allowed and blocked objects", () => {
      const objects = [
        createSceneObject({ id: "token:1", owner: "player-1", locked: false }),
        createSceneObject({ id: "token:2", owner: "player-1", locked: true }),
        createSceneObject({ id: "token:3", owner: "player-2", locked: false }),
      ];
      const result = analyzeObjectsForDeletion(
        ["token:1", "token:2", "token:3"],
        objects,
        "player-1",
        false,
      );
      expect(result.allowed).toEqual(["token:1"]);
      expect(result.blocked.get("token:2")).toBe("locked");
      expect(result.blocked.get("token:3")).toBe("not-owner");
    });
  });

  describe("shouldBlockDelete", () => {
    it("blocks map objects", () => {
      const obj = createSceneObject({ id: "map:bg", type: "map" });
      expect(shouldBlockDelete(obj, "player-1", true)).toBe(true);
    });

    it("blocks locked objects", () => {
      const obj = createSceneObject({ locked: true });
      expect(shouldBlockDelete(obj, "player-1", false)).toBe(true);
    });

    it("allows DM to delete unlocked objects", () => {
      const obj = createSceneObject({ owner: "player-2", locked: false });
      expect(shouldBlockDelete(obj, "player-1", true)).toBe(false);
    });

    it("blocks non-owner from deleting others' objects", () => {
      const obj = createSceneObject({ owner: "player-2", locked: false });
      expect(shouldBlockDelete(obj, "player-1", false)).toBe(true);
    });
  });

  describe("buildDeleteConfirmationMessage", () => {
    it("builds message for tokens only", () => {
      const msg = buildDeleteConfirmationMessage(3, 0);
      expect(msg).toBe("Delete 3 tokens? This cannot be undone.");
    });

    it("builds message for drawings only", () => {
      const msg = buildDeleteConfirmationMessage(0, 2);
      expect(msg).toBe("Delete 2 drawings? This cannot be undone.");
    });

    it("builds message for both tokens and drawings", () => {
      const msg = buildDeleteConfirmationMessage(2, 3);
      expect(msg).toBe("Delete 2 tokens and 3 drawings? This cannot be undone.");
    });

    it("uses singular form for single object", () => {
      const msg = buildDeleteConfirmationMessage(1, 1);
      expect(msg).toBe("Delete 1 token and 1 drawing? This cannot be undone.");
    });
  });

  describe("buildPartialDeleteWarning", () => {
    it("builds warning for locked objects", () => {
      const msg = buildPartialDeleteWarning(2, 3, 3);
      expect(msg).toContain("Cannot delete 3 locked objects");
      expect(msg).toContain("Delete the 2 unlocked objects?");
    });

    it("builds warning for ownership issues", () => {
      const msg = buildPartialDeleteWarning(2, 3, 0);
      expect(msg).toContain("You can only delete 2 of 5 selected objects");
      expect(msg).toContain("3 owned by others");
    });

    it("uses singular form", () => {
      const msg = buildPartialDeleteWarning(1, 1, 1);
      expect(msg).toContain("1 locked object");
      expect(msg).toContain("1 unlocked object");
    });
  });

  describe("buildDeleteBlockedMessage", () => {
    it("builds message for locked objects", () => {
      const msg = buildDeleteBlockedMessage(true);
      expect(msg).toBe("Cannot delete locked objects. Unlock them first using the lock icon.");
    });

    it("builds message for ownership", () => {
      const msg = buildDeleteBlockedMessage(false);
      expect(msg).toBe("You can only delete objects you own.");
    });
  });

  describe("separateObjectsByType", () => {
    it("separates token and drawing IDs", () => {
      const ids = ["token:1", "token:2", "drawing:3", "drawing:4"];
      const result = separateObjectsByType(ids);
      expect(result.tokenIds).toEqual(["1", "2"]);
      expect(result.drawingIds).toEqual(["3", "4"]);
    });

    it("handles token IDs only", () => {
      const ids = ["token:1", "token:2"];
      const result = separateObjectsByType(ids);
      expect(result.tokenIds).toEqual(["1", "2"]);
      expect(result.drawingIds).toEqual([]);
    });

    it("handles drawing IDs only", () => {
      const ids = ["drawing:3", "drawing:4"];
      const result = separateObjectsByType(ids);
      expect(result.tokenIds).toEqual([]);
      expect(result.drawingIds).toEqual(["3", "4"]);
    });

    it("ignores other object types", () => {
      const ids = ["token:1", "map:bg", "prop:item", "drawing:2"];
      const result = separateObjectsByType(ids);
      expect(result.tokenIds).toEqual(["1"]);
      expect(result.drawingIds).toEqual(["2"]);
    });

    it("handles empty array", () => {
      const result = separateObjectsByType([]);
      expect(result.tokenIds).toEqual([]);
      expect(result.drawingIds).toEqual([]);
    });

    it("filters out invalid IDs", () => {
      const ids = ["token:", "drawing:", "token:abc", "drawing:xyz"];
      const result = separateObjectsByType(ids);
      expect(result.tokenIds).toEqual(["abc"]);
      expect(result.drawingIds).toEqual(["xyz"]);
    });
  });
});
