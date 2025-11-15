/**
 * Characterization tests for TransformHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/domains/room/service.ts
 * - applySceneObjectTransform() method (lines 176-350)
 *
 * Target: apps/server/src/domains/room/transform/TransformHandler.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoomService } from "../../service.js";
import type { Token, Prop, Drawing, PlayerStagingZone } from "@shared";

describe("TransformHandler - Characterization Tests", () => {
  let roomService: RoomService;
  const dmUid = "dm-player";
  const playerUid = "regular-player";
  const otherPlayerUid = "other-player";

  beforeEach(() => {
    roomService = new RoomService();

    // Setup players: one DM, one regular player, one other player
    roomService.setState({
      players: [
        {
          uid: dmUid,
          name: "DM",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: Date.now(),
          hp: 10,
          maxHp: 10,
          isDM: true,
          statusEffects: [],
        },
        {
          uid: playerUid,
          name: "Player",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: Date.now(),
          hp: 10,
          maxHp: 10,
          isDM: false,
          statusEffects: [],
        },
        {
          uid: otherPlayerUid,
          name: "Other Player",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: Date.now(),
          hp: 10,
          maxHp: 10,
          isDM: false,
          statusEffects: [],
        },
      ],
    });
  });

  describe("Map transforms", () => {
    beforeEach(() => {
      roomService.setState({
        mapBackground: "test-map.png",
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph
    });

    it("should allow DM to transform map position", () => {
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");
      expect(mapObject).toBeDefined();

      const success = roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        position: { x: 100, y: 200 },
      });

      expect(success).toBe(true);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.transform.x).toBe(100);
      expect(updatedMap?.transform.y).toBe(200);
    });

    it("should allow DM to transform map scale", () => {
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");

      const success = roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        scale: { x: 2.0, y: 1.5 },
      });

      expect(success).toBe(true);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.transform.scaleX).toBe(2.0);
      expect(updatedMap?.transform.scaleY).toBe(1.5);
    });

    it("should allow DM to transform map rotation", () => {
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");

      const success = roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        rotation: 45,
      });

      expect(success).toBe(true);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.transform.rotation).toBe(45);
    });

    it("should deny non-DM from transforming map", () => {
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");

      const success = roomService.applySceneObjectTransform(mapObject!.id, playerUid, {
        position: { x: 100, y: 200 },
      });

      expect(success).toBe(false);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.transform.x).toBe(0);
      expect(updatedMap?.transform.y).toBe(0);
    });
  });

  describe("Token transforms", () => {
    beforeEach(() => {
      const token: Token = {
        id: "token-1",
        owner: playerUid,
        x: 0,
        y: 0,
        color: "hsl(0, 70%, 50%)",
        size: "medium",
      };
      roomService.setState({
        tokens: [token],
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph
    });

    it("should allow owner to transform their token position", () => {
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(tokenObject).toBeDefined();

      const success = roomService.applySceneObjectTransform(tokenObject!.id, playerUid, {
        position: { x: 150, y: 250 },
      });

      expect(success).toBe(true);

      // Check SceneObject transform
      const updatedTokenObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(updatedTokenObject?.transform.x).toBe(150);
      expect(updatedTokenObject?.transform.y).toBe(250);

      // Check backing Token entity
      const updatedToken = roomService.getState().tokens.find((t) => t.id === "token-1");
      expect(updatedToken?.x).toBe(150);
      expect(updatedToken?.y).toBe(250);
    });

    it("should allow owner to transform their token scale", () => {
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");

      const success = roomService.applySceneObjectTransform(tokenObject!.id, playerUid, {
        scale: { x: 1.5, y: 1.5 },
      });

      expect(success).toBe(true);
      const updatedTokenObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(updatedTokenObject?.transform.scaleX).toBe(1.5);
      expect(updatedTokenObject?.transform.scaleY).toBe(1.5);
    });

    it("should allow owner to transform their token rotation", () => {
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");

      const success = roomService.applySceneObjectTransform(tokenObject!.id, playerUid, {
        rotation: 90,
      });

      expect(success).toBe(true);
      const updatedTokenObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(updatedTokenObject?.transform.rotation).toBe(90);
    });

    it("should allow DM to transform any token", () => {
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");

      const success = roomService.applySceneObjectTransform(tokenObject!.id, dmUid, {
        position: { x: 300, y: 400 },
      });

      expect(success).toBe(true);
      const updatedToken = roomService.getState().tokens.find((t) => t.id === "token-1");
      expect(updatedToken?.x).toBe(300);
      expect(updatedToken?.y).toBe(400);
    });

    it("should deny non-owner from transforming token", () => {
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");

      const success = roomService.applySceneObjectTransform(tokenObject!.id, otherPlayerUid, {
        position: { x: 300, y: 400 },
      });

      expect(success).toBe(false);
      const updatedToken = roomService.getState().tokens.find((t) => t.id === "token-1");
      expect(updatedToken?.x).toBe(0);
      expect(updatedToken?.y).toBe(0);
    });
  });

  describe("Staging zone transforms", () => {
    beforeEach(() => {
      const zone: PlayerStagingZone = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      roomService.setState({ playerStagingZone: zone });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph
    });

    it("should allow DM to transform staging zone position", () => {
      const state = roomService.getState();
      const zoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(zoneObject).toBeDefined();

      const success = roomService.applySceneObjectTransform(zoneObject!.id, dmUid, {
        position: { x: 50, y: 75 },
      });

      expect(success).toBe(true);

      // Check SceneObject
      const updatedZoneObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(updatedZoneObject?.transform.x).toBe(50);
      expect(updatedZoneObject?.transform.y).toBe(75);

      // Check backing state
      const updatedZone = roomService.getState().playerStagingZone;
      expect(updatedZone?.x).toBe(50);
      expect(updatedZone?.y).toBe(75);
    });

    it("should allow DM to transform staging zone scale", () => {
      const state = roomService.getState();
      const zoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");

      const success = roomService.applySceneObjectTransform(zoneObject!.id, dmUid, {
        scale: { x: 2.0, y: 1.5 },
      });

      expect(success).toBe(true);

      // Check SceneObject
      const updatedZoneObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(updatedZoneObject?.transform.scaleX).toBe(2.0);
      expect(updatedZoneObject?.transform.scaleY).toBe(1.5);

      // Check backing state (preserves base width/height, applies scale)
      const updatedZone = roomService.getState().playerStagingZone;
      expect(updatedZone?.scaleX).toBe(2.0);
      expect(updatedZone?.scaleY).toBe(1.5);
      expect(updatedZone?.width).toBe(100); // Base value unchanged
      expect(updatedZone?.height).toBe(100); // Base value unchanged
    });

    it("should allow DM to transform staging zone rotation", () => {
      const state = roomService.getState();
      const zoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");

      const success = roomService.applySceneObjectTransform(zoneObject!.id, dmUid, {
        rotation: 45,
      });

      expect(success).toBe(true);

      // Check SceneObject
      const updatedZoneObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(updatedZoneObject?.transform.rotation).toBe(45);

      // Check backing state
      const updatedZone = roomService.getState().playerStagingZone;
      expect(updatedZone?.rotation).toBe(45);

      // Check object.data.rotation sync
      if (updatedZoneObject?.type === "staging-zone") {
        expect(updatedZoneObject.data.rotation).toBe(45);
      }
    });

    it("should deny non-DM from transforming staging zone", () => {
      const state = roomService.getState();
      const zoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");

      const success = roomService.applySceneObjectTransform(zoneObject!.id, playerUid, {
        position: { x: 100, y: 200 },
      });

      expect(success).toBe(false);
      const updatedZone = roomService.getState().playerStagingZone;
      expect(updatedZone?.x).toBe(0);
      expect(updatedZone?.y).toBe(0);
    });

    it("should return false if staging zone does not exist", () => {
      // Clear the staging zone
      roomService.setState({ playerStagingZone: undefined });

      // Try to transform non-existent zone (need to manually add scene object for this edge case)
      const success = roomService.applySceneObjectTransform("staging-zone:test", dmUid, {
        position: { x: 100, y: 200 },
      });

      expect(success).toBe(false);
    });
  });

  describe("Drawing transforms", () => {
    beforeEach(() => {
      const drawing: Drawing = {
        id: "drawing-1",
        owner: playerUid,
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        color: "black",
        width: 800,
        opacity: 1,
      };
      roomService.setState({
        drawings: [drawing],
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph
    });

    it("should allow owner to transform their drawing", () => {
      const state = roomService.getState();
      const drawingObject = state.sceneObjects.find((obj) => obj.id === "drawing:drawing-1");
      expect(drawingObject).toBeDefined();

      const success = roomService.applySceneObjectTransform(drawingObject!.id, playerUid, {
        position: { x: 200, y: 300 },
        scale: { x: 1.2, y: 1.2 },
        rotation: 30,
      });

      expect(success).toBe(true);
      const updatedDrawingObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "drawing:drawing-1");
      expect(updatedDrawingObject?.transform.x).toBe(200);
      expect(updatedDrawingObject?.transform.y).toBe(300);
      expect(updatedDrawingObject?.transform.scaleX).toBe(1.2);
      expect(updatedDrawingObject?.transform.scaleY).toBe(1.2);
      expect(updatedDrawingObject?.transform.rotation).toBe(30);
    });

    it("should allow DM to transform any drawing", () => {
      const state = roomService.getState();
      const drawingObject = state.sceneObjects.find((obj) => obj.id === "drawing:drawing-1");

      const success = roomService.applySceneObjectTransform(drawingObject!.id, dmUid, {
        position: { x: 500, y: 600 },
      });

      expect(success).toBe(true);
      const updatedDrawingObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "drawing:drawing-1");
      expect(updatedDrawingObject?.transform.x).toBe(500);
      expect(updatedDrawingObject?.transform.y).toBe(600);
    });

    it("should deny non-owner from transforming drawing", () => {
      const state = roomService.getState();
      const drawingObject = state.sceneObjects.find((obj) => obj.id === "drawing:drawing-1");

      const success = roomService.applySceneObjectTransform(drawingObject!.id, otherPlayerUid, {
        position: { x: 500, y: 600 },
      });

      expect(success).toBe(false);
      const updatedDrawingObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "drawing:drawing-1");
      expect(updatedDrawingObject?.transform.x).toBe(0);
      expect(updatedDrawingObject?.transform.y).toBe(0);
    });
  });

  describe("Prop transforms", () => {
    beforeEach(() => {
      const prop: Prop = {
        id: "prop-1",
        owner: playerUid,
        label: "Test Prop",
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        imageUrl: "prop.png",
        size: "medium",
      };
      roomService.setState({
        props: [prop],
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph
    });

    it("should allow owner to transform their prop", () => {
      const state = roomService.getState();
      const propObject = state.sceneObjects.find((obj) => obj.id === "prop:prop-1");
      expect(propObject).toBeDefined();

      const success = roomService.applySceneObjectTransform(propObject!.id, playerUid, {
        position: { x: 100, y: 200 },
        scale: { x: 2.0, y: 2.0 },
        rotation: 180,
      });

      expect(success).toBe(true);

      // Check SceneObject
      const updatedPropObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "prop:prop-1");
      expect(updatedPropObject?.transform.x).toBe(100);
      expect(updatedPropObject?.transform.y).toBe(200);
      expect(updatedPropObject?.transform.scaleX).toBe(2.0);
      expect(updatedPropObject?.transform.scaleY).toBe(2.0);
      expect(updatedPropObject?.transform.rotation).toBe(180);

      // Check backing Prop entity
      const updatedProp = roomService.getState().props.find((p) => p.id === "prop-1");
      expect(updatedProp?.x).toBe(100);
      expect(updatedProp?.y).toBe(200);
      expect(updatedProp?.scaleX).toBe(2.0);
      expect(updatedProp?.scaleY).toBe(2.0);
      expect(updatedProp?.rotation).toBe(180);
    });

    it("should allow DM to transform any prop", () => {
      const state = roomService.getState();
      const propObject = state.sceneObjects.find((obj) => obj.id === "prop:prop-1");

      const success = roomService.applySceneObjectTransform(propObject!.id, dmUid, {
        position: { x: 300, y: 400 },
      });

      expect(success).toBe(true);
      const updatedProp = roomService.getState().props.find((p) => p.id === "prop-1");
      expect(updatedProp?.x).toBe(300);
      expect(updatedProp?.y).toBe(400);
    });

    it("should allow anyone to transform prop with owner='*'", () => {
      // Create a shared prop
      const sharedProp: Prop = {
        id: "prop-shared",
        owner: "*",
        label: "Shared Prop",
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        imageUrl: "shared.png",
        size: "medium",
      };
      roomService.setState({
        props: [sharedProp],
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const state = roomService.getState();
      const propObject = state.sceneObjects.find((obj) => obj.id === "prop:prop-shared");
      expect(propObject).toBeDefined();

      const success = roomService.applySceneObjectTransform(propObject!.id, otherPlayerUid, {
        position: { x: 500, y: 600 },
      });

      expect(success).toBe(true);
      const updatedProp = roomService.getState().props.find((p) => p.id === "prop-shared");
      expect(updatedProp?.x).toBe(500);
      expect(updatedProp?.y).toBe(600);
    });

    it("should deny non-owner from transforming prop", () => {
      const state = roomService.getState();
      const propObject = state.sceneObjects.find((obj) => obj.id === "prop:prop-1");

      const success = roomService.applySceneObjectTransform(propObject!.id, otherPlayerUid, {
        position: { x: 300, y: 400 },
      });

      expect(success).toBe(false);
      const updatedProp = roomService.getState().props.find((p) => p.id === "prop-1");
      expect(updatedProp?.x).toBe(0);
      expect(updatedProp?.y).toBe(0);
    });
  });

  describe("Pointer transforms", () => {
    beforeEach(() => {
      roomService.setState({
        pointers: [
          {
            id: `pointer-${playerUid}`,
            uid: playerUid,
            name: "Player",
            x: 0,
            y: 0,
            timestamp: Date.now(),
          },
        ],
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph
    });

    it("should allow owner to transform their pointer position", () => {
      const state = roomService.getState();
      const pointerObject = state.sceneObjects.find(
        (obj) => obj.type === "pointer" && obj.owner === playerUid,
      );
      expect(pointerObject).toBeDefined();

      // Pointers are locked by default, so unlock first
      roomService.applySceneObjectTransform(pointerObject!.id, dmUid, {
        locked: false,
      });

      const success = roomService.applySceneObjectTransform(pointerObject!.id, playerUid, {
        position: { x: 150, y: 250 },
      });

      expect(success).toBe(true);
      const updatedPointerObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === pointerObject!.id);
      expect(updatedPointerObject?.transform.x).toBe(150);
      expect(updatedPointerObject?.transform.y).toBe(250);
    });

    it("should deny non-owner from transforming pointer", () => {
      const state = roomService.getState();
      const pointerObject = state.sceneObjects.find(
        (obj) => obj.type === "pointer" && obj.owner === playerUid,
      );

      const success = roomService.applySceneObjectTransform(pointerObject!.id, otherPlayerUid, {
        position: { x: 150, y: 250 },
      });

      expect(success).toBe(false);
      const updatedPointerObject = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === pointerObject!.id);
      expect(updatedPointerObject?.transform.x).toBe(0);
      expect(updatedPointerObject?.transform.y).toBe(0);
    });
  });

  describe("Locked state handling", () => {
    beforeEach(() => {
      roomService.setState({
        mapBackground: "test-map.png",
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph
    });

    it("should allow DM to lock an object", () => {
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");

      const success = roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        locked: true,
      });

      expect(success).toBe(true);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.locked).toBe(true);
    });

    it("should allow DM to unlock an object", () => {
      // First lock it
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");
      roomService.applySceneObjectTransform(mapObject!.id, dmUid, { locked: true });

      // Now unlock it
      const success = roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        locked: false,
      });

      expect(success).toBe(true);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.locked).toBe(false);
    });

    it("should deny non-DM from locking an object", () => {
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");

      // Map starts locked by default, so unlock it first as DM
      roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        locked: false,
      });

      // Try to lock it as non-DM (should fail)
      const success = roomService.applySceneObjectTransform(mapObject!.id, playerUid, {
        locked: true,
      });

      expect(success).toBe(false);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.locked).toBe(false); // Should remain unlocked
    });

    it("should deny non-DM from transforming locked object", () => {
      // Setup: Create a token and lock it
      const token: Token = {
        id: "token-locked",
        owner: playerUid,
        x: 0,
        y: 0,
        color: "hsl(0, 70%, 50%)",
        size: "medium",
      };
      roomService.setState({ tokens: [token] });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-locked");

      // Lock it as DM
      roomService.applySceneObjectTransform(tokenObject!.id, dmUid, { locked: true });

      // Try to transform as owner
      const success = roomService.applySceneObjectTransform(tokenObject!.id, playerUid, {
        position: { x: 100, y: 200 },
      });

      expect(success).toBe(false);
      const updatedToken = roomService.getState().tokens.find((t) => t.id === "token-locked");
      expect(updatedToken?.x).toBe(0);
      expect(updatedToken?.y).toBe(0);
    });

    it("should allow DM to transform locked object", () => {
      // Setup: Create a map and lock it
      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");

      // Lock it
      roomService.applySceneObjectTransform(mapObject!.id, dmUid, { locked: true });

      // Transform as DM
      const success = roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        position: { x: 100, y: 200 },
      });

      expect(success).toBe(true);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.transform.x).toBe(100);
      expect(updatedMap?.transform.y).toBe(200);
    });
  });

  describe("Edge cases", () => {
    it("should return false for non-existent object", () => {
      const success = roomService.applySceneObjectTransform("non-existent-id", dmUid, {
        position: { x: 100, y: 200 },
      });

      expect(success).toBe(false);
    });

    it("should handle combined transforms (position + scale + rotation)", () => {
      roomService.setState({
        mapBackground: "test-map.png",
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");

      const success = roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        position: { x: 100, y: 200 },
        scale: { x: 2.0, y: 1.5 },
        rotation: 45,
      });

      expect(success).toBe(true);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.transform.x).toBe(100);
      expect(updatedMap?.transform.y).toBe(200);
      expect(updatedMap?.transform.scaleX).toBe(2.0);
      expect(updatedMap?.transform.scaleY).toBe(1.5);
      expect(updatedMap?.transform.rotation).toBe(45);
    });

    it("should handle partial transforms (only position)", () => {
      roomService.setState({
        mapBackground: "test-map.png",
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      const state = roomService.getState();
      const mapObject = state.sceneObjects.find((obj) => obj.type === "map");

      const success = roomService.applySceneObjectTransform(mapObject!.id, dmUid, {
        position: { x: 100, y: 200 },
      });

      expect(success).toBe(true);
      const updatedMap = roomService.getState().sceneObjects.find((obj) => obj.type === "map");
      expect(updatedMap?.transform.x).toBe(100);
      expect(updatedMap?.transform.y).toBe(200);
      // Scale and rotation should remain at defaults
      expect(updatedMap?.transform.scaleX).toBe(1);
      expect(updatedMap?.transform.scaleY).toBe(1);
      expect(updatedMap?.transform.rotation).toBe(0);
    });
  });
});
