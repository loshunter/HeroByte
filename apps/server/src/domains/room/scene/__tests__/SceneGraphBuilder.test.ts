/**
 * Characterization tests for SceneGraphBuilder
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/domains/room/service.ts
 * - rebuildSceneGraph() method (lines 418-573)
 *
 * Target: apps/server/src/domains/room/scene/SceneGraphBuilder.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoomService } from "../../service.js";
import type { Token, Drawing, Prop, Pointer, PlayerStagingZone } from "@shared";

describe("SceneGraphBuilder - Characterization Tests", () => {
  let roomService: RoomService;

  beforeEach(() => {
    roomService = new RoomService();
  });

  describe("Empty state", () => {
    it("should create empty scene objects array when state is empty", () => {
      const state = roomService.getState();

      expect(state.sceneObjects).toEqual([]);
      expect(state.tokens).toEqual([]);
      expect(state.drawings).toEqual([]);
      expect(state.props).toEqual([]);
      expect(state.pointers).toEqual([]);
      expect(state.mapBackground).toBeUndefined();
      expect(state.playerStagingZone).toBeUndefined();
    });
  });

  describe("Map background", () => {
    it("should create map scene object when mapBackground is set", () => {
      roomService.setState({ mapBackground: "https://example.com/map.jpg" });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;
      const mapObject = sceneObjects.find((obj) => obj.type === "map");

      expect(mapObject).toBeDefined();
      expect(mapObject?.id).toBe("map");
      expect(mapObject?.type).toBe("map");
      expect(mapObject?.owner).toBeNull();
      expect(mapObject?.locked).toBe(true);
      expect(mapObject?.zIndex).toBe(-100);
      expect(mapObject?.transform).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
      expect(mapObject?.data.imageUrl).toBe("https://example.com/map.jpg");
      expect(mapObject?.data.width).toBeUndefined();
      expect(mapObject?.data.height).toBeUndefined();
    });

    it("should not create map scene object when mapBackground is undefined", () => {
      roomService.setState({ mapBackground: undefined });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;
      const mapObject = sceneObjects.find((obj) => obj.type === "map");

      expect(mapObject).toBeUndefined();
    });

    it("should preserve transform when map background changes", () => {
      // First, set a map background
      roomService.setState({ mapBackground: "https://example.com/map1.jpg" });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      // Manually update the scene object's transform (simulating user interaction)
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");
      if (mapObject) {
        mapObject.transform = { x: 100, y: 200, scaleX: 2, scaleY: 2, rotation: 45 };
        mapObject.data.width = 1000;
        mapObject.data.height = 800;
      }

      // Change the map background
      roomService.setState({ mapBackground: "https://example.com/map2.jpg" });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const newSceneObjects = roomService.getState().sceneObjects;
      const newMapObject = newSceneObjects.find((obj) => obj.type === "map");

      expect(newMapObject?.transform).toEqual({
        x: 100,
        y: 200,
        scaleX: 2,
        scaleY: 2,
        rotation: 45,
      });
      expect(newMapObject?.data.imageUrl).toBe("https://example.com/map2.jpg");
      expect(newMapObject?.data.width).toBe(1000);
      expect(newMapObject?.data.height).toBe(800);
    });
  });

  describe("Tokens", () => {
    it("should create scene objects for all tokens", () => {
      const tokens: Token[] = [
        {
          id: "token-1",
          owner: "player-1",
          x: 10,
          y: 20,
          color: "red",
          imageUrl: "https://example.com/token1.png",
          size: "medium",
        },
        {
          id: "token-2",
          owner: "player-2",
          x: 30,
          y: 40,
          color: "blue",
          imageUrl: undefined,
          size: "large",
        },
      ];

      roomService.setState({ tokens });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;
      const tokenObjects = sceneObjects.filter((obj) => obj.type === "token");

      expect(tokenObjects).toHaveLength(2);

      const token1Obj = tokenObjects.find((obj) => obj.id === "token:token-1");
      expect(token1Obj).toBeDefined();
      expect(token1Obj?.type).toBe("token");
      expect(token1Obj?.owner).toBe("player-1");
      expect(token1Obj?.locked).toBe(false);
      expect(token1Obj?.zIndex).toBe(10);
      expect(token1Obj?.transform).toEqual({ x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 });
      expect(token1Obj?.data.color).toBe("red");
      expect(token1Obj?.data.imageUrl).toBe("https://example.com/token1.png");
      expect(token1Obj?.data.size).toBe("medium");
      expect(token1Obj?.data.characterId).toBeUndefined();

      const token2Obj = tokenObjects.find((obj) => obj.id === "token:token-2");
      expect(token2Obj?.data.size).toBe("large");
    });

    it("should preserve scale and rotation but update x/y from token", () => {
      // Create initial token
      const initialTokens: Token[] = [
        {
          id: "token-1",
          owner: "player-1",
          x: 10,
          y: 20,
          color: "red",
          imageUrl: undefined,
          size: "medium",
        },
      ];

      roomService.setState({ tokens: initialTokens });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      // Manually update scene object transform (simulating user scaling/rotating)
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      if (tokenObject?.type === "token") {
        tokenObject.transform = { x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 90 };
        tokenObject.data.characterId = "char-123";
      }

      // Update token position
      const updatedTokens: Token[] = [
        {
          id: "token-1",
          owner: "player-1",
          x: 100,
          y: 200,
          color: "red",
          imageUrl: undefined,
          size: "medium",
        },
      ];

      roomService.setState({ tokens: updatedTokens });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const newSceneObjects = roomService.getState().sceneObjects;
      const newTokenObject = newSceneObjects.find((obj) => obj.id === "token:token-1");

      // Position updated, scale and rotation preserved
      expect(newTokenObject?.transform).toEqual({
        x: 100,
        y: 200,
        scaleX: 2,
        scaleY: 2,
        rotation: 90,
      });
      if (newTokenObject?.type === "token") {
        expect(newTokenObject.data.characterId).toBe("char-123");
      } else {
        throw new Error("Expected token scene object to exist");
      }
    });

    it("should preserve locked state and zIndex from previous scene object", () => {
      const tokens: Token[] = [
        {
          id: "token-1",
          owner: "player-1",
          x: 10,
          y: 20,
          color: "red",
          imageUrl: undefined,
          size: "medium",
        },
      ];

      roomService.setState({ tokens });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      // Manually lock and change zIndex
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      if (tokenObject) {
        tokenObject.locked = true;
        tokenObject.zIndex = 15;
      }

      // Rebuild (by setting state again)
      roomService.setState({ tokens });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const newSceneObjects = roomService.getState().sceneObjects;
      const newTokenObject = newSceneObjects.find((obj) => obj.id === "token:token-1");

      expect(newTokenObject?.locked).toBe(true);
      expect(newTokenObject?.zIndex).toBe(15);
    });
  });

  describe("Drawings", () => {
    it("should create scene objects for all drawings", () => {
      const drawings: Drawing[] = [
        {
          id: "drawing-1",
          owner: "player-1",
          type: "line",
          points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
          color: "red",
          width: 800,
          opacity: 1,
        },










        {
          id: "drawing-2",
          type: "line",
          points: [],
          color: "blue",
          width: 800,
          opacity: 1,
        },
      ];

      roomService.setState({ drawings });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;
      const drawingObjects = sceneObjects.filter((obj) => obj.type === "drawing");

      expect(drawingObjects).toHaveLength(2);

      const drawing1Obj = drawingObjects.find((obj) => obj.id === "drawing:drawing-1");
      expect(drawing1Obj).toBeDefined();
      expect(drawing1Obj?.type).toBe("drawing");
      expect(drawing1Obj?.owner).toBe("player-1");
      expect(drawing1Obj?.locked).toBe(false);
      expect(drawing1Obj?.zIndex).toBe(5);
      expect(drawing1Obj?.transform).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
      expect(drawing1Obj?.data.drawing).toEqual(drawings[0]);

      const drawing2Obj = drawingObjects.find((obj) => obj.id === "drawing:drawing-2");
      expect(drawing2Obj?.owner).toBeNull();
    });

    it("should preserve transform from previous scene object", () => {
      const drawings: Drawing[] = [
        {
          id: "drawing-1",
          owner: "player-1",
          type: "line",
          points: [],
          color: "red",
          width: 800,
          opacity: 1,
        },
      ];

      roomService.setState({ drawings });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      // Manually update transform
      const state = roomService.getState();
      const drawingObject = state.sceneObjects.find((obj) => obj.id === "drawing:drawing-1");
      if (drawingObject) {
        drawingObject.transform = { x: 50, y: 60, scaleX: 1.5, scaleY: 1.5, rotation: 30 };
      }

      // Rebuild
      roomService.setState({ drawings });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const newSceneObjects = roomService.getState().sceneObjects;
      const newDrawingObject = newSceneObjects.find((obj) => obj.id === "drawing:drawing-1");

      expect(newDrawingObject?.transform).toEqual({
        x: 50,
        y: 60,
        scaleX: 1.5,
        scaleY: 1.5,
        rotation: 30,
      });
    });
  });

  describe("Props", () => {
    it("should create scene objects for all props", () => {
      const props: Prop[] = [
        {
          id: "prop-1",
          owner: "player-1",
          x: 100,
          y: 200,
          scaleX: 2,
          scaleY: 2,
          rotation: 45,
          imageUrl: "https://example.com/prop1.png",
          label: "Chest",
          size: "medium",
        },
        {
          id: "prop-2",
          owner: null,
          x: 300,
          y: 400,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          imageUrl: "https://example.com/prop2.png",
          label: "Table",
          size: "large",
        },
      ];

      roomService.setState({ props });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;
      const propObjects = sceneObjects.filter((obj) => obj.type === "prop");

      expect(propObjects).toHaveLength(2);

      const prop1Obj = propObjects.find((obj) => obj.id === "prop:prop-1");
      expect(prop1Obj).toBeDefined();
      expect(prop1Obj?.type).toBe("prop");
      expect(prop1Obj?.owner).toBe("player-1");
      expect(prop1Obj?.locked).toBe(false);
      expect(prop1Obj?.zIndex).toBe(7);
      expect(prop1Obj?.transform).toEqual({ x: 100, y: 200, scaleX: 2, scaleY: 2, rotation: 45 });
      expect(prop1Obj?.data.imageUrl).toBe("https://example.com/prop1.png");
      expect(prop1Obj?.data.label).toBe("Chest");
      expect(prop1Obj?.data.size).toBe("medium");

      const prop2Obj = propObjects.find((obj) => obj.id === "prop:prop-2");
      expect(prop2Obj?.owner).toBeNull();
      expect(prop2Obj?.transform).toEqual({ x: 300, y: 400, scaleX: 1, scaleY: 1, rotation: 0 });
    });

    it("should preserve locked state and zIndex from previous scene object", () => {
      const props: Prop[] = [
        {
          id: "prop-1",
          owner: "player-1",
          x: 100,
          y: 200,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          imageUrl: "https://example.com/prop.png",
          label: "Prop",
          size: "medium",
        },
      ];

      roomService.setState({ props });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      // Manually lock and change zIndex
      const state = roomService.getState();
      const propObject = state.sceneObjects.find((obj) => obj.id === "prop:prop-1");
      if (propObject) {
        propObject.locked = true;
        propObject.zIndex = 20;
      }

      // Rebuild
      roomService.setState({ props });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const newSceneObjects = roomService.getState().sceneObjects;
      const newPropObject = newSceneObjects.find((obj) => obj.id === "prop:prop-1");

      expect(newPropObject?.locked).toBe(true);
      expect(newPropObject?.zIndex).toBe(20);
    });
  });

  describe("Staging zone", () => {
    it("should create scene object when playerStagingZone is set", () => {
      const stagingZone: PlayerStagingZone = {
        x: 500,
        y: 600,
        width: 200,
        height: 100,
        rotation: 30,
        scaleX: 1.5,
        scaleY: 1.5,
      };

      roomService.setState({ playerStagingZone: stagingZone });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;
      const stagingObject = sceneObjects.find((obj) => obj.type === "staging-zone");

      expect(stagingObject).toBeDefined();
      expect(stagingObject?.id).toBe("staging-zone");
      expect(stagingObject?.type).toBe("staging-zone");
      expect(stagingObject?.owner).toBeNull();
      expect(stagingObject?.locked).toBe(false);
      expect(stagingObject?.zIndex).toBe(1);
      expect(stagingObject?.transform).toEqual({
        x: 500,
        y: 600,
        scaleX: 1.5,
        scaleY: 1.5,
        rotation: 30,
      });
      expect(stagingObject?.data.width).toBe(200);
      expect(stagingObject?.data.height).toBe(100);
      expect(stagingObject?.data.rotation).toBe(30);
      expect(stagingObject?.data.label).toBe("Player Staging Zone");
    });

    it("should handle staging zone without rotation and scale", () => {
      const stagingZone = {
        x: 100,
        y: 200,
        width: 150,
        height: 150,
      } as PlayerStagingZone;

      roomService.setPlayerStagingZone(stagingZone);

      const sceneObjects = roomService.getState().sceneObjects;
      const stagingObject = sceneObjects.find((obj) => obj.type === "staging-zone");

      expect(stagingObject?.transform).toEqual({
        x: 100,
        y: 200,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      });
      expect(stagingObject?.data.rotation).toBe(0);
    });

    it("should preserve label from previous scene object", () => {
      const stagingZone: PlayerStagingZone = {
        x: 100,
        y: 200,
        width: 150,
        height: 150,
      };

      roomService.setPlayerStagingZone(stagingZone);

      // Manually update label
      const state = roomService.getState();
      const stagingObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");
      if (stagingObject && stagingObject.type === "staging-zone") {
        stagingObject.data.label = "Custom Spawn Area";
      }

      // Rebuild
      roomService.setPlayerStagingZone(stagingZone);

      const newSceneObjects = roomService.getState().sceneObjects;
      const newStagingObject = newSceneObjects.find((obj) => obj.type === "staging-zone");

      if (newStagingObject && newStagingObject.type === "staging-zone") {
        expect(newStagingObject.data.label).toBe("Custom Spawn Area");
      }
    });

    it("should not create scene object when playerStagingZone is undefined", () => {
      roomService.setState({ playerStagingZone: undefined });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;
      const stagingObject = sceneObjects.find((obj) => obj.type === "staging-zone");

      expect(stagingObject).toBeUndefined();
    });
  });

  describe("Pointers", () => {
    it("should create scene objects for all pointers", () => {
      const pointers: Pointer[] = [
        {
          id: "player-1",
          uid: "player-1",
          name: "Player One",
          x: 50,
          y: 60,
          timestamp: Date.now(),
        },
        {
          id: "custom-pointer-1",
          uid: "player-2",
          name: "Player Two",
          x: 70,
          y: 80,
          timestamp: Date.now(),
        },
      ];

      roomService.setState({ pointers });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;
      const pointerObjects = sceneObjects.filter((obj) => obj.type === "pointer");

      expect(pointerObjects).toHaveLength(2);

      const pointer1Obj = pointerObjects.find((obj) => obj.id === "pointer:player-1");
      expect(pointer1Obj).toBeDefined();
      expect(pointer1Obj?.type).toBe("pointer");
      expect(pointer1Obj?.owner).toBe("player-1");
      expect(pointer1Obj?.locked).toBe(true);
      expect(pointer1Obj?.zIndex).toBe(20);
      expect(pointer1Obj?.transform).toEqual({ x: 50, y: 60, scaleX: 1, scaleY: 1, rotation: 0 });
      expect(pointer1Obj?.data.uid).toBe("player-1");
      expect(pointer1Obj?.data.pointerId).toBe("player-1");
      expect(pointer1Obj?.data.name).toBe("Player One");

      const pointer2Obj = pointerObjects.find((obj) => obj.id === "pointer:custom-pointer-1");
      expect(pointer2Obj).toBeDefined();
      expect(pointer2Obj?.data.pointerId).toBe("custom-pointer-1");
    });

    it("should preserve transform from previous scene object for pointers", () => {
      const pointers: Pointer[] = [
        {
          id: "player-1",
          uid: "player-1",
          name: "Player One",
          x: 50,
          y: 60,
          timestamp: Date.now(),
        },
      ];

      roomService.setState({ pointers });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      // Manually update transform
      const state = roomService.getState();
      const pointerObject = state.sceneObjects.find((obj) => obj.id === "pointer:player-1");
      if (pointerObject) {
        pointerObject.transform = { x: 100, y: 200, scaleX: 2, scaleY: 2, rotation: 45 };
      }

      // Rebuild (pointers still in state)
      roomService.setState({});
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const newSceneObjects = roomService.getState().sceneObjects;
      const newPointerObject = newSceneObjects.find((obj) => obj.id === "pointer:player-1");

      // Transform should be preserved for pointers
      expect(newPointerObject?.transform).toEqual({
        x: 100,
        y: 200,
        scaleX: 2,
        scaleY: 2,
        rotation: 45,
      });
    });
  });

  describe("Mixed entities", () => {
    it("should create scene objects for all entity types in correct order", () => {
      const mapBackground = "https://example.com/map.jpg";
      const tokens: Token[] = [
        { id: "t1", owner: "p1", x: 10, y: 20, color: "red", imageUrl: undefined, size: "medium" },
      ];
      const drawings: Drawing[] = [
        { id: "d1", owner: "p1", type: "line", points: [], color: "red", width: 800, opacity: 1 },
      ];
      const props: Prop[] = [
        {
          id: "pr1",
          owner: "p1",
          x: 30,
          y: 40,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          imageUrl: "prop.png",
          label: "Prop",
          size: "medium",
        },
      ];
      const stagingZone: PlayerStagingZone = { x: 50, y: 60, width: 100, height: 100 };
      const pointers: Pointer[] = [
        { id: `pointer-${"p1"}`, uid: "p1", name: "Player", x: 70, y: 80, timestamp: Date.now() },
      ];

      roomService.setState({
        mapBackground,
        tokens,
        drawings,
        props,
        playerStagingZone: stagingZone,
        pointers,
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const sceneObjects = roomService.getState().sceneObjects;

      // All types should be present
      expect(sceneObjects.find((obj) => obj.type === "map")).toBeDefined();
      expect(sceneObjects.find((obj) => obj.type === "token")).toBeDefined();
      expect(sceneObjects.find((obj) => obj.type === "drawing")).toBeDefined();
      expect(sceneObjects.find((obj) => obj.type === "prop")).toBeDefined();
      expect(sceneObjects.find((obj) => obj.type === "staging-zone")).toBeDefined();
      expect(sceneObjects.find((obj) => obj.type === "pointer")).toBeDefined();

      expect(sceneObjects).toHaveLength(6);
    });
  });

  describe("Duplicate ID detection", () => {
    it("should not throw error for duplicate IDs but log to console", () => {
      // This test verifies that duplicate detection doesn't crash
      // In the actual implementation, it logs to console.error

      const tokens: Token[] = [
        {
          id: "token-1",
          owner: "p1",
          x: 10,
          y: 20,
          color: "red",
          imageUrl: undefined,
          size: "medium",
        },
        {
          id: "token-1",
          owner: "p2",
          x: 30,
          y: 40,
          color: "blue",
          imageUrl: undefined,
          size: "medium",
        }, // Duplicate ID
      ];

      // Should not throw
      expect(() => {
        roomService.setState({ tokens });
        roomService.createSnapshot(); // Triggers rebuildSceneGraph
      }).not.toThrow();

      const sceneObjects = roomService.getState().sceneObjects;
      const tokenObjects = sceneObjects.filter((obj) => obj.type === "token");

      // Both tokens should be in scene graph (duplicates allowed, just logged)
      expect(tokenObjects).toHaveLength(2);
    });
  });
});
