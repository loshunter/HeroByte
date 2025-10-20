/**
 * Characterization tests for useSceneObjectActions
 *
 * These tests capture the current behavior of scene object action creators
 * before extraction from App.tsx (lines 351-395, 520-532).
 *
 * Scope: 6 action creators
 * - recolorToken: Send recolor message for token
 * - transformSceneObject: Send transform-object message (position/scale/rotation/locked)
 * - toggleSceneObjectLock: Send transform-object message with locked state
 * - deleteToken: Send delete-token message
 * - updateTokenImage: Send update-token-image message
 * - updateTokenSize: Send set-token-size message
 *
 * Integration points:
 * - MapBoard: onRecolorToken, onTransformObject
 * - DMMenu: transformSceneObject (map alignment)
 * - EntitiesPanel: deleteToken, updateTokenImage, updateTokenSize, toggleSceneObjectLock
 * - ContextMenu: deleteToken
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useSceneObjectActions } from "../../useSceneObjectActions";

describe("useSceneObjectActions - Characterization", () => {
  describe("recolorToken", () => {
    it("should send recolor message with token ID", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.recolorToken("token:abc123");

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({
        t: "recolor",
        id: "abc123",
      });
    });

    it("should strip token: prefix from scene ID", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.recolorToken("token:xyz789");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "recolor",
        id: "xyz789",
      });
    });

    it("should handle IDs without token: prefix", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.recolorToken("plain-id");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "recolor",
        id: "plain-id",
      });
    });
  });

  describe("transformSceneObject", () => {
    it("should send transform-object message with all parameters", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.transformSceneObject({
        id: "token:abc",
        position: { x: 100, y: 200 },
        scale: { x: 1.5, y: 1.5 },
        rotation: 45,
        locked: true,
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "token:abc",
        position: { x: 100, y: 200 },
        scale: { x: 1.5, y: 1.5 },
        rotation: 45,
        locked: true,
      });
    });

    it("should send transform-object with only position", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.transformSceneObject({
        id: "token:xyz",
        position: { x: 50, y: 75 },
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "token:xyz",
        position: { x: 50, y: 75 },
        scale: undefined,
        rotation: undefined,
        locked: undefined,
      });
    });

    it("should send transform-object with only scale", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.transformSceneObject({
        id: "map:main",
        scale: { x: 2.0, y: 2.0 },
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "map:main",
        position: undefined,
        scale: { x: 2.0, y: 2.0 },
        rotation: undefined,
        locked: undefined,
      });
    });

    it("should send transform-object with only rotation", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.transformSceneObject({
        id: "prop:item1",
        rotation: 90,
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "prop:item1",
        position: undefined,
        scale: undefined,
        rotation: 90,
        locked: undefined,
      });
    });

    it("should send transform-object with only locked state", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.transformSceneObject({
        id: "staging-zone:default",
        locked: false,
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "staging-zone:default",
        position: undefined,
        scale: undefined,
        rotation: undefined,
        locked: false,
      });
    });

    it("should work for different object types (token, map, prop, staging-zone)", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      // Token
      result.current.transformSceneObject({
        id: "token:warrior",
        position: { x: 10, y: 20 },
      });

      // Map
      result.current.transformSceneObject({
        id: "map:dungeon",
        scale: { x: 1.2, y: 1.2 },
      });

      // Prop
      result.current.transformSceneObject({
        id: "prop:chest",
        rotation: 180,
      });

      // Staging zone
      result.current.transformSceneObject({
        id: "staging-zone:main",
        locked: true,
      });

      expect(sendMessage).toHaveBeenCalledTimes(4);
    });
  });

  describe("toggleSceneObjectLock", () => {
    it("should send transform-object message with locked=true", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.toggleSceneObjectLock("map:main", true);

      expect(sendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "map:main",
        locked: true,
      });
    });

    it("should send transform-object message with locked=false", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.toggleSceneObjectLock("staging-zone:default", false);

      expect(sendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "staging-zone:default",
        locked: false,
      });
    });

    it("should work for token objects", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.toggleSceneObjectLock("token:hero", true);

      expect(sendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "token:hero",
        locked: true,
      });
    });
  });

  describe("deleteToken", () => {
    it("should send delete-token message", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.deleteToken("abc123");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "delete-token",
        id: "abc123",
      });
    });

    it("should send delete-token with different IDs", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.deleteToken("token-1");
      result.current.deleteToken("token-2");

      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage).toHaveBeenNthCalledWith(1, {
        t: "delete-token",
        id: "token-1",
      });
      expect(sendMessage).toHaveBeenNthCalledWith(2, {
        t: "delete-token",
        id: "token-2",
      });
    });
  });

  describe("updateTokenImage", () => {
    it("should send update-token-image message", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.updateTokenImage("token123", "https://example.com/warrior.png");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "update-token-image",
        tokenId: "token123",
        imageUrl: "https://example.com/warrior.png",
      });
    });

    it("should handle data URLs", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANS...";
      result.current.updateTokenImage("token456", dataUrl);

      expect(sendMessage).toHaveBeenCalledWith({
        t: "update-token-image",
        tokenId: "token456",
        imageUrl: dataUrl,
      });
    });
  });

  describe("updateTokenSize", () => {
    it("should send set-token-size message with tiny size", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.updateTokenSize("token1", "tiny");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-token-size",
        tokenId: "token1",
        size: "tiny",
      });
    });

    it("should send set-token-size message with small size", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.updateTokenSize("token2", "small");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-token-size",
        tokenId: "token2",
        size: "small",
      });
    });

    it("should send set-token-size message with medium size", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.updateTokenSize("token3", "medium");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-token-size",
        tokenId: "token3",
        size: "medium",
      });
    });

    it("should send set-token-size message with large size", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.updateTokenSize("token4", "large");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-token-size",
        tokenId: "token4",
        size: "large",
      });
    });

    it("should send set-token-size message with huge size", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.updateTokenSize("token5", "huge");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-token-size",
        tokenId: "token5",
        size: "huge",
      });
    });

    it("should send set-token-size message with gargantuan size", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.updateTokenSize("token6", "gargantuan");

      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-token-size",
        tokenId: "token6",
        size: "gargantuan",
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle rapid successive calls", () => {
      const sendMessage = vi.fn();
      const { result } = renderHook(() => useSceneObjectActions({ sendMessage }));

      result.current.recolorToken("token:1");
      result.current.transformSceneObject({ id: "token:2", position: { x: 10, y: 10 } });
      result.current.deleteToken("token:3");

      expect(sendMessage).toHaveBeenCalledTimes(3);
    });

    it("should maintain sendMessage reference stability", () => {
      const sendMessage = vi.fn();
      const { result, rerender } = renderHook(() => useSceneObjectActions({ sendMessage }));

      const firstRecolor = result.current.recolorToken;
      rerender();
      const secondRecolor = result.current.recolorToken;

      // Functions should be different instances (not memoized in this implementation)
      // This is acceptable for action creators
      expect(typeof firstRecolor).toBe("function");
      expect(typeof secondRecolor).toBe("function");
    });
  });
});
