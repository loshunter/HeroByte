/**
 * Characterization tests for LockingHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/domains/room/service.ts
 * - lockSelectedObjects() method (lines 135-153)
 * - unlockSelectedObjects() method (lines 159-177)
 *
 * Target: apps/server/src/domains/room/locking/LockingHandler.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoomService } from "../../service.js";
import type { Token, Prop } from "@shared";

describe("LockingHandler - Characterization Tests", () => {
  let roomService: RoomService;
  const dmUid = "dm-player";
  const playerUid = "regular-player";

  beforeEach(() => {
    roomService = new RoomService();

    // Setup players: one DM, one regular player
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
      ],
    });
  });

  describe("lockSelectedObjects", () => {
    beforeEach(() => {
      // Setup some objects to lock
      roomService.setState({
        mapBackground: "test-map.png",
        tokens: [
          {
            id: "token-1",
            owner: playerUid,
            x: 0,
            y: 0,
            color: "hsl(0, 70%, 50%)",
            size: "medium",
          } as Token,
          {
            id: "token-2",
            owner: playerUid,
            x: 100,
            y: 100,
            color: "hsl(120, 70%, 50%)",
            size: "medium",
          } as Token,
        ],
        props: [
          {
            id: "prop-1",
            owner: dmUid,
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            imageUrl: "prop.png",
          } as Prop,
        ],
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph
    });

    it("should allow DM to lock single object", () => {
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(tokenObject).toBeDefined();
      expect(tokenObject?.locked).toBe(false);

      const count = roomService.lockSelectedObjects(dmUid, ["token:token-1"]);

      expect(count).toBe(1);
      const updatedToken = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(updatedToken?.locked).toBe(true);
    });

    it("should allow DM to lock multiple objects", () => {
      const count = roomService.lockSelectedObjects(dmUid, [
        "token:token-1",
        "token:token-2",
        "prop:prop-1",
      ]);

      expect(count).toBe(3);

      const state = roomService.getState();
      const token1 = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      const token2 = state.sceneObjects.find((obj) => obj.id === "token:token-2");
      const prop1 = state.sceneObjects.find((obj) => obj.id === "prop:prop-1");

      expect(token1?.locked).toBe(true);
      expect(token2?.locked).toBe(true);
      expect(prop1?.locked).toBe(true);
    });

    it("should handle empty object ID array", () => {
      const count = roomService.lockSelectedObjects(dmUid, []);

      expect(count).toBe(0);
    });

    it("should handle non-existent object IDs", () => {
      const count = roomService.lockSelectedObjects(dmUid, ["non-existent-1", "non-existent-2"]);

      expect(count).toBe(0);
    });

    it("should handle mix of valid and invalid object IDs", () => {
      const count = roomService.lockSelectedObjects(dmUid, [
        "token:token-1",
        "non-existent",
        "token:token-2",
      ]);

      expect(count).toBe(2);

      const state = roomService.getState();
      const token1 = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      const token2 = state.sceneObjects.find((obj) => obj.id === "token:token-2");

      expect(token1?.locked).toBe(true);
      expect(token2?.locked).toBe(true);
    });

    it("should deny non-DM from locking objects", () => {
      const count = roomService.lockSelectedObjects(playerUid, ["token:token-1"]);

      expect(count).toBe(0);

      const state = roomService.getState();
      const token = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(token?.locked).toBe(false);
    });

    it("should return 0 for non-existent actor", () => {
      const count = roomService.lockSelectedObjects("non-existent-uid", ["token:token-1"]);

      expect(count).toBe(0);

      const state = roomService.getState();
      const token = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(token?.locked).toBe(false);
    });

    it("should allow locking already locked object", () => {
      // Lock once
      roomService.lockSelectedObjects(dmUid, ["token:token-1"]);

      // Lock again
      const count = roomService.lockSelectedObjects(dmUid, ["token:token-1"]);

      expect(count).toBe(1);

      const state = roomService.getState();
      const token = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(token?.locked).toBe(true);
    });
  });

  describe("unlockSelectedObjects", () => {
    beforeEach(() => {
      // Setup some objects and lock them
      roomService.setState({
        mapBackground: "test-map.png",
        tokens: [
          {
            id: "token-1",
            owner: playerUid,
            x: 0,
            y: 0,
            color: "hsl(0, 70%, 50%)",
            size: "medium",
          } as Token,
          {
            id: "token-2",
            owner: playerUid,
            x: 100,
            y: 100,
            color: "hsl(120, 70%, 50%)",
            size: "medium",
          } as Token,
        ],
        props: [
          {
            id: "prop-1",
            owner: dmUid,
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            imageUrl: "prop.png",
          } as Prop,
        ],
      });
      roomService.createSnapshot(); // Triggers rebuildSceneGraph

      // Lock all objects
      roomService.lockSelectedObjects(dmUid, ["token:token-1", "token:token-2", "prop:prop-1"]);
    });

    it("should allow DM to unlock single object", () => {
      const state = roomService.getState();
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(tokenObject?.locked).toBe(true);

      const count = roomService.unlockSelectedObjects(dmUid, ["token:token-1"]);

      expect(count).toBe(1);
      const updatedToken = roomService
        .getState()
        .sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(updatedToken?.locked).toBe(false);
    });

    it("should allow DM to unlock multiple objects", () => {
      const count = roomService.unlockSelectedObjects(dmUid, [
        "token:token-1",
        "token:token-2",
        "prop:prop-1",
      ]);

      expect(count).toBe(3);

      const state = roomService.getState();
      const token1 = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      const token2 = state.sceneObjects.find((obj) => obj.id === "token:token-2");
      const prop1 = state.sceneObjects.find((obj) => obj.id === "prop:prop-1");

      expect(token1?.locked).toBe(false);
      expect(token2?.locked).toBe(false);
      expect(prop1?.locked).toBe(false);
    });

    it("should handle empty object ID array", () => {
      const count = roomService.unlockSelectedObjects(dmUid, []);

      expect(count).toBe(0);
    });

    it("should handle non-existent object IDs", () => {
      const count = roomService.unlockSelectedObjects(dmUid, ["non-existent-1", "non-existent-2"]);

      expect(count).toBe(0);
    });

    it("should handle mix of valid and invalid object IDs", () => {
      const count = roomService.unlockSelectedObjects(dmUid, [
        "token:token-1",
        "non-existent",
        "token:token-2",
      ]);

      expect(count).toBe(2);

      const state = roomService.getState();
      const token1 = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      const token2 = state.sceneObjects.find((obj) => obj.id === "token:token-2");

      expect(token1?.locked).toBe(false);
      expect(token2?.locked).toBe(false);
    });

    it("should deny non-DM from unlocking objects", () => {
      const count = roomService.unlockSelectedObjects(playerUid, ["token:token-1"]);

      expect(count).toBe(0);

      const state = roomService.getState();
      const token = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(token?.locked).toBe(true);
    });

    it("should return 0 for non-existent actor", () => {
      const count = roomService.unlockSelectedObjects("non-existent-uid", ["token:token-1"]);

      expect(count).toBe(0);

      const state = roomService.getState();
      const token = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(token?.locked).toBe(true);
    });

    it("should allow unlocking already unlocked object", () => {
      // Unlock once
      roomService.unlockSelectedObjects(dmUid, ["token:token-1"]);

      // Unlock again
      const count = roomService.unlockSelectedObjects(dmUid, ["token:token-1"]);

      expect(count).toBe(1);

      const state = roomService.getState();
      const token = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(token?.locked).toBe(false);
    });
  });

  describe("Lock/Unlock workflow", () => {
    beforeEach(() => {
      roomService.setState({
        tokens: [
          {
            id: "token-1",
            owner: playerUid,
            x: 0,
            y: 0,
            color: "hsl(0, 70%, 50%)",
            size: "medium",
          } as Token,
        ],
      });
      roomService.createSnapshot();
    });

    it("should allow lock then unlock workflow", () => {
      // Initial state
      const initialState = roomService.getState();
      const initialToken = initialState.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(initialToken?.locked).toBe(false);

      // Lock
      const lockCount = roomService.lockSelectedObjects(dmUid, ["token:token-1"]);
      expect(lockCount).toBe(1);

      const lockedState = roomService.getState();
      const lockedToken = lockedState.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(lockedToken?.locked).toBe(true);

      // Unlock
      const unlockCount = roomService.unlockSelectedObjects(dmUid, ["token:token-1"]);
      expect(unlockCount).toBe(1);

      const unlockedState = roomService.getState();
      const unlockedToken = unlockedState.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(unlockedToken?.locked).toBe(false);
    });
  });
});
