/**
 * Characterization Tests for usePropManagement Hook
 *
 * These tests capture the current behavior of prop management
 * in App.tsx before extraction. They verify:
 * - handleCreateProp creates props with viewport-based placement
 * - handleUpdateProp sends correct update messages
 * - handleDeleteProp sends delete messages
 *
 * Source: apps/client/src/ui/App.tsx:420-454
 * Target: apps/client/src/hooks/usePropManagement.ts
 *
 * Part of Phase 4 SOLID Refactor Initiative - Priority 20
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePropManagement } from "../../../hooks/usePropManagement";
import type { CameraState } from "@shared";

describe("usePropManagement", () => {
  describe("handleCreateProp", () => {
    it("should create a prop with viewport-based placement", () => {
      const sendMessage = vi.fn();
      const cameraState: CameraState = {
        x: 100,
        y: 200,
        scale: 1.5,
      };

      const { result } = renderHook(() => usePropManagement({ sendMessage, cameraState }));

      result.current.handleCreateProp();

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({
        t: "create-prop",
        label: "New Prop",
        imageUrl: "",
        owner: null,
        size: "medium",
        viewport: cameraState,
      });
    });

    it("should use current camera state at time of call", () => {
      const sendMessage = vi.fn();
      let cameraState: CameraState = { x: 0, y: 0, scale: 1 };

      const { result, rerender } = renderHook(() =>
        usePropManagement({ sendMessage, cameraState }),
      );

      // Update camera state
      cameraState = { x: 500, y: 600, scale: 2 };
      rerender();

      result.current.handleCreateProp();

      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { x: 500, y: 600, scale: 2 },
        }),
      );
    });
  });

  describe("handleUpdateProp", () => {
    it("should update a prop with all fields", () => {
      const sendMessage = vi.fn();
      const cameraState: CameraState = { x: 0, y: 0, scale: 1 };

      const { result } = renderHook(() => usePropManagement({ sendMessage, cameraState }));

      result.current.handleUpdateProp("prop-123", {
        label: "Updated Prop",
        imageUrl: "https://example.com/image.png",
        owner: "player-456",
        size: "large",
      });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({
        t: "update-prop",
        id: "prop-123",
        label: "Updated Prop",
        imageUrl: "https://example.com/image.png",
        owner: "player-456",
        size: "large",
      });
    });

    it("should handle null owner", () => {
      const sendMessage = vi.fn();
      const cameraState: CameraState = { x: 0, y: 0, scale: 1 };

      const { result } = renderHook(() => usePropManagement({ sendMessage, cameraState }));

      result.current.handleUpdateProp("prop-789", {
        label: "Unowned Prop",
        imageUrl: "",
        owner: null,
        size: "small",
      });

      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: null,
        }),
      );
    });

    it("should handle all token sizes", () => {
      const sendMessage = vi.fn();
      const cameraState: CameraState = { x: 0, y: 0, scale: 1 };

      const { result } = renderHook(() => usePropManagement({ sendMessage, cameraState }));

      const sizes = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;

      sizes.forEach((size) => {
        sendMessage.mockClear();
        result.current.handleUpdateProp("prop-test", {
          label: "Test",
          imageUrl: "",
          owner: null,
          size,
        });

        expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ size }));
      });
    });
  });

  describe("handleDeleteProp", () => {
    it("should delete a prop by ID", () => {
      const sendMessage = vi.fn();
      const cameraState: CameraState = { x: 0, y: 0, scale: 1 };

      const { result } = renderHook(() => usePropManagement({ sendMessage, cameraState }));

      result.current.handleDeleteProp("prop-to-delete");

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({
        t: "delete-prop",
        id: "prop-to-delete",
      });
    });

    it("should handle multiple deletes", () => {
      const sendMessage = vi.fn();
      const cameraState: CameraState = { x: 0, y: 0, scale: 1 };

      const { result } = renderHook(() => usePropManagement({ sendMessage, cameraState }));

      result.current.handleDeleteProp("prop-1");
      result.current.handleDeleteProp("prop-2");
      result.current.handleDeleteProp("prop-3");

      expect(sendMessage).toHaveBeenCalledTimes(3);
      expect(sendMessage).toHaveBeenNthCalledWith(1, { t: "delete-prop", id: "prop-1" });
      expect(sendMessage).toHaveBeenNthCalledWith(2, { t: "delete-prop", id: "prop-2" });
      expect(sendMessage).toHaveBeenNthCalledWith(3, { t: "delete-prop", id: "prop-3" });
    });
  });

  describe("integration behavior", () => {
    it("should return stable functions across rerenders", () => {
      const sendMessage = vi.fn();
      const cameraState: CameraState = { x: 0, y: 0, scale: 1 };

      const { result, rerender } = renderHook(() =>
        usePropManagement({ sendMessage, cameraState }),
      );

      const firstRender = result.current;
      rerender();
      const secondRender = result.current;

      expect(firstRender.handleCreateProp).toBe(secondRender.handleCreateProp);
      expect(firstRender.handleUpdateProp).toBe(secondRender.handleUpdateProp);
      expect(firstRender.handleDeleteProp).toBe(secondRender.handleDeleteProp);
    });

    it("should recreate handleCreateProp when cameraState changes", () => {
      const sendMessage = vi.fn();
      let cameraState: CameraState = { x: 0, y: 0, scale: 1 };

      const { result, rerender } = renderHook(() =>
        usePropManagement({ sendMessage, cameraState }),
      );

      const firstCreate = result.current.handleCreateProp;

      cameraState = { x: 100, y: 200, scale: 2 };
      rerender();

      const secondCreate = result.current.handleCreateProp;

      // Should be different function reference due to dependency change
      expect(firstCreate).not.toBe(secondCreate);
    });
  });
});
