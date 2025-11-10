import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useObjectTransformHandlers } from "../../../hooks/useObjectTransformHandlers";
import type { SceneObject } from "@shared";

describe("useObjectTransformHandlers", () => {
  const gridSize = 50;

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
      id: "staging-zone-1",
      type: "staging-zone",
      data: {},
      transform: { x: 400, y: 400, scale: { x: 1, y: 1 }, rotation: 0 },
    },
    {
      id: "map-1",
      type: "map",
      data: { imageUrl: "map.png" },
      transform: { x: 0, y: 0, scale: { x: 1, y: 1 }, rotation: 0 },
    },
  ] as SceneObject[];

  describe("handleTransformToken", () => {
    it("should call onTransformObject with token position", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleTransformToken("token-1", { x: 5, y: 10 });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "token-1",
        position: { x: 5, y: 10 },
      });
    });
  });

  describe("handleTransformProp", () => {
    it("should call onTransformObject with prop position", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleTransformProp("prop-1", { x: 8, y: 12 });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "prop-1",
        position: { x: 8, y: 12 },
      });
    });
  });

  describe("handleTransformDrawing", () => {
    it("should call onTransformObject with drawing transform", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleTransformDrawing("drawing-1", { position: { x: 15, y: 20 } });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "drawing-1",
        position: { x: 15, y: 20 },
      });
    });
  });

  describe("handleGizmoTransform", () => {
    it("should handle token transform (scale and rotation only, no position)", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleGizmoTransform({
        id: "token-1",
        position: { x: 150, y: 200 }, // Should be ignored
        scale: { x: 1.5, y: 1.5 },
        rotation: 45,
      });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "token-1",
        scale: { x: 1.5, y: 1.5 },
        rotation: 45,
        // No position included
      });
    });

    it("should handle staging-zone transform (position converted to grid units)", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleGizmoTransform({
        id: "staging-zone-1",
        position: { x: 100, y: 150 }, // pixels -> grid units (100/50=2, 150/50=3)
        scale: { x: 2, y: 2 },
        rotation: 90,
      });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "staging-zone-1",
        position: { x: 2, y: 3 },
        scale: { x: 2, y: 2 },
        rotation: 90,
      });
    });

    it("should handle prop transform (position converted to grid units)", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleGizmoTransform({
        id: "prop-1",
        position: { x: 200, y: 250 }, // pixels -> grid units (200/50=4, 250/50=5)
        scale: { x: 1.2, y: 1.2 },
        rotation: 30,
      });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "prop-1",
        position: { x: 4, y: 5 },
        scale: { x: 1.2, y: 1.2 },
        rotation: 30,
      });
    });

    it("should handle map transform (full transform)", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleGizmoTransform({
        id: "map-1",
        position: { x: 50, y: 75 },
        scale: { x: 1.1, y: 1.1 },
        rotation: 15,
      });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "map-1",
        position: { x: 50, y: 75 },
        scale: { x: 1.1, y: 1.1 },
        rotation: 15,
      });
    });

    it("should handle drawing transform (full transform)", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleGizmoTransform({
        id: "drawing-1",
        position: { x: 300, y: 350 },
        scale: { x: 0.8, y: 0.8 },
        rotation: 60,
      });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "drawing-1",
        position: { x: 300, y: 350 },
        scale: { x: 0.8, y: 0.8 },
        rotation: 60,
      });
    });

    it("should warn if object is not found", () => {
      const onTransformObject = vi.fn();
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleGizmoTransform({
        id: "nonexistent-object",
        position: { x: 100, y: 100 },
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith("Object nonexistent-object not found");
      expect(onTransformObject).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("should handle transform without position", () => {
      const onTransformObject = vi.fn();
      const { result } = renderHook(() =>
        useObjectTransformHandlers({
          onTransformObject,
          sceneObjects: mockSceneObjects,
          gridSize,
        }),
      );

      result.current.handleGizmoTransform({
        id: "token-1",
        scale: { x: 2, y: 2 },
      });

      expect(onTransformObject).toHaveBeenCalledWith({
        id: "token-1",
        scale: { x: 2, y: 2 },
        rotation: undefined,
      });
    });
  });
});
