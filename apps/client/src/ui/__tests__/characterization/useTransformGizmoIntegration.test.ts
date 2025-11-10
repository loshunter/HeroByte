import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTransformGizmoIntegration } from "../../../hooks/useTransformGizmoIntegration";
import type { SceneObject } from "@shared";

describe("useTransformGizmoIntegration", () => {
  const mockGetSelectedNode = vi.fn();

  const mockSceneObjects: SceneObject[] = [
    {
      id: "token-1",
      type: "token",
      data: { owner: "player-1", name: "Hero" },
      transform: { x: 100, y: 100, scale: { x: 1, y: 1 }, rotation: 0 },
    },
    {
      id: "prop-1",
      type: "prop",
      data: { imageUrl: "prop.png" },
      transform: { x: 200, y: 200, scale: { x: 1, y: 1 }, rotation: 0 },
    },
    {
      id: "drawing-1",
      type: "drawing",
      data: { tool: "pen", points: [0, 0, 10, 10] },
      transform: { x: 300, y: 300, scale: { x: 1, y: 1 }, rotation: 0 },
    },
    {
      id: "map-1",
      type: "map",
      data: { imageUrl: "map.png" },
      transform: { x: 0, y: 0, scale: { x: 1, y: 1 }, rotation: 0 },
    },
  ] as SceneObject[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("selectedObject", () => {
    it("should return null when no object is selected", () => {
      const { result } = renderHook(() =>
        useTransformGizmoIntegration({
          sceneObjects: mockSceneObjects,
          selectedObjectId: null,
          getSelectedNode: mockGetSelectedNode,
        }),
      );

      expect(result.current.selectedObject).toBeNull();
    });

    it("should return the selected object when selectedObjectId matches", () => {
      const { result } = renderHook(() =>
        useTransformGizmoIntegration({
          sceneObjects: mockSceneObjects,
          selectedObjectId: "token-1",
          getSelectedNode: mockGetSelectedNode,
        }),
      );

      expect(result.current.selectedObject).toEqual({
        id: "token-1",
        type: "token",
        data: { owner: "player-1", name: "Hero" },
        transform: { x: 100, y: 100, scale: { x: 1, y: 1 }, rotation: 0 },
      });
    });

    it("should return different object when selectedObjectId changes", () => {
      const { result, rerender } = renderHook(
        ({ selectedObjectId }) =>
          useTransformGizmoIntegration({
            sceneObjects: mockSceneObjects,
            selectedObjectId,
            getSelectedNode: mockGetSelectedNode,
          }),
        { initialProps: { selectedObjectId: "token-1" } },
      );

      expect(result.current.selectedObject?.id).toBe("token-1");

      rerender({ selectedObjectId: "prop-1" });

      expect(result.current.selectedObject?.id).toBe("prop-1");
      expect(result.current.selectedObject?.type).toBe("prop");
    });

    it("should return null when selectedObjectId does not match any object", () => {
      const { result } = renderHook(() =>
        useTransformGizmoIntegration({
          sceneObjects: mockSceneObjects,
          selectedObjectId: "nonexistent-id",
          getSelectedNode: mockGetSelectedNode,
        }),
      );

      expect(result.current.selectedObject).toBeNull();
    });

    it("should handle empty sceneObjects array", () => {
      const { result } = renderHook(() =>
        useTransformGizmoIntegration({
          sceneObjects: [],
          selectedObjectId: "token-1",
          getSelectedNode: mockGetSelectedNode,
        }),
      );

      expect(result.current.selectedObject).toBeNull();
    });

    it("should memoize selectedObject and not recompute unnecessarily", () => {
      const { result, rerender } = renderHook(
        ({ sceneObjects, selectedObjectId }) =>
          useTransformGizmoIntegration({
            sceneObjects,
            selectedObjectId,
            getSelectedNode: mockGetSelectedNode,
          }),
        {
          initialProps: {
            sceneObjects: mockSceneObjects,
            selectedObjectId: "token-1",
          },
        },
      );

      const firstSelectedObject = result.current.selectedObject;

      // Rerender with same props
      rerender({
        sceneObjects: mockSceneObjects,
        selectedObjectId: "token-1",
      });

      // Should be the same reference (memoized)
      expect(result.current.selectedObject).toBe(firstSelectedObject);
    });
  });

  describe("getSelectedNodeRef", () => {
    it("should return a callback function", () => {
      const { result } = renderHook(() =>
        useTransformGizmoIntegration({
          sceneObjects: mockSceneObjects,
          selectedObjectId: "token-1",
          getSelectedNode: mockGetSelectedNode,
        }),
      );

      expect(typeof result.current.getSelectedNodeRef).toBe("function");
    });

    it("should call getSelectedNode when invoked", () => {
      const mockNode = { id: "mock-node" };
      mockGetSelectedNode.mockReturnValue(mockNode);

      const { result } = renderHook(() =>
        useTransformGizmoIntegration({
          sceneObjects: mockSceneObjects,
          selectedObjectId: "token-1",
          getSelectedNode: mockGetSelectedNode,
        }),
      );

      const node = result.current.getSelectedNodeRef();

      expect(mockGetSelectedNode).toHaveBeenCalledTimes(1);
      expect(node).toBe(mockNode);
    });

    it("should return null when getSelectedNode returns null", () => {
      mockGetSelectedNode.mockReturnValue(null);

      const { result } = renderHook(() =>
        useTransformGizmoIntegration({
          sceneObjects: mockSceneObjects,
          selectedObjectId: "token-1",
          getSelectedNode: mockGetSelectedNode,
        }),
      );

      const node = result.current.getSelectedNodeRef();

      expect(node).toBeNull();
    });

    it("should memoize getSelectedNodeRef callback", () => {
      const { result, rerender } = renderHook(
        ({ getSelectedNode }) =>
          useTransformGizmoIntegration({
            sceneObjects: mockSceneObjects,
            selectedObjectId: "token-1",
            getSelectedNode,
          }),
        { initialProps: { getSelectedNode: mockGetSelectedNode } },
      );

      const firstCallback = result.current.getSelectedNodeRef;

      // Rerender with same getSelectedNode
      rerender({ getSelectedNode: mockGetSelectedNode });

      // Should be the same reference (memoized)
      expect(result.current.getSelectedNodeRef).toBe(firstCallback);
    });

    it("should update callback when getSelectedNode changes", () => {
      const mockGetSelectedNode2 = vi.fn().mockReturnValue({ id: "node-2" });

      const { result, rerender } = renderHook(
        ({ getSelectedNode }) =>
          useTransformGizmoIntegration({
            sceneObjects: mockSceneObjects,
            selectedObjectId: "token-1",
            getSelectedNode,
          }),
        { initialProps: { getSelectedNode: mockGetSelectedNode } },
      );

      const firstCallback = result.current.getSelectedNodeRef;

      // Rerender with different getSelectedNode
      rerender({ getSelectedNode: mockGetSelectedNode2 });

      // Should be a different reference
      expect(result.current.getSelectedNodeRef).not.toBe(firstCallback);

      // Should call new function
      result.current.getSelectedNodeRef();
      expect(mockGetSelectedNode2).toHaveBeenCalledTimes(1);
      expect(mockGetSelectedNode).toHaveBeenCalledTimes(0);
    });
  });
});
