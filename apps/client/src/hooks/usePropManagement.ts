/**
 * usePropManagement Hook
 *
 * Encapsulates prop (scene object) management actions. Props are non-player
 * scene objects that can be placed, updated, and deleted by players and DMs.
 *
 * Extracted from App.tsx as part of Phase 4 refactoring (Priority 20).
 *
 * This hook handles:
 * - Creating props with viewport-based placement
 * - Updating prop properties (label, image, owner, size)
 * - Deleting props
 *
 * @module hooks/usePropManagement
 */

import { useCallback } from "react";
import type { ClientMessage, TokenSize } from "@shared";

/**
 * Camera state for viewport-based positioning.
 */
export interface CameraState {
  /** X position of the camera */
  x: number;
  /** Y position of the camera */
  y: number;
  /** Zoom scale of the camera */
  scale: number;
}

/**
 * Dependencies required by the usePropManagement hook.
 */
export interface UsePropManagementOptions {
  /**
   * WebSocket message sender for client-server communication.
   */
  sendMessage: (msg: ClientMessage) => void;

  /**
   * Current camera state for viewport-based prop placement.
   * When a prop is created, it will be positioned relative to the
   * current camera viewport.
   */
  cameraState: CameraState;
}

/**
 * Prop update fields. All fields are required as the server
 * expects a complete update.
 */
export interface PropUpdateFields {
  /** Display label for the prop */
  label: string;

  /** Image URL for the prop's appearance */
  imageUrl: string;

  /** Player UID who owns this prop, or null for unowned */
  owner: string | null;

  /** Size of the prop on the map */
  size: TokenSize;
}

/**
 * Prop management action functions returned by the hook.
 */
export interface UsePropManagementReturn {
  /**
   * Create a new prop with viewport-based placement.
   * The prop will be created at the current camera viewport location.
   */
  handleCreateProp: () => void;

  /**
   * Update an existing prop's properties.
   *
   * @param id - Unique identifier of the prop to update
   * @param updates - New property values
   */
  handleUpdateProp: (id: string, updates: PropUpdateFields) => void;

  /**
   * Delete a prop from the scene.
   *
   * @param id - Unique identifier of the prop to delete
   */
  handleDeleteProp: (id: string) => void;
}

/**
 * Hook providing prop management action creators.
 *
 * Props are scene objects that can be placed on the map. Unlike tokens,
 * props don't represent characters and can have various ownership models.
 *
 * @param options - Hook dependencies
 * @returns Prop management action functions
 *
 * @example
 * ```tsx
 * const propActions = usePropManagement({
 *   sendMessage,
 *   cameraState
 * });
 *
 * // Create a prop at current viewport
 * propActions.handleCreateProp();
 *
 * // Update a prop
 * propActions.handleUpdateProp("prop-123", {
 *   label: "Treasure Chest",
 *   imageUrl: "https://example.com/chest.png",
 *   owner: null,
 *   size: "medium"
 * });
 *
 * // Delete a prop
 * propActions.handleDeleteProp("prop-123");
 * ```
 */
export function usePropManagement({
  sendMessage,
  cameraState,
}: UsePropManagementOptions): UsePropManagementReturn {
  /**
   * Create a new prop with default properties.
   * The prop is created at the current camera viewport position.
   */
  const handleCreateProp = useCallback(() => {
    sendMessage({
      t: "create-prop",
      label: "New Prop",
      imageUrl: "",
      owner: null,
      size: "medium",
      viewport: cameraState,
    });
  }, [sendMessage, cameraState]);

  /**
   * Update an existing prop's properties.
   * Spreads update fields into the message for a complete update.
   */
  const handleUpdateProp = useCallback(
    (id: string, updates: PropUpdateFields) => {
      sendMessage({
        t: "update-prop",
        id,
        ...updates,
      });
    },
    [sendMessage],
  );

  /**
   * Delete a prop by its ID.
   */
  const handleDeleteProp = useCallback(
    (id: string) => {
      sendMessage({ t: "delete-prop", id });
    },
    [sendMessage],
  );

  return {
    handleCreateProp,
    handleUpdateProp,
    handleDeleteProp,
  };
}
