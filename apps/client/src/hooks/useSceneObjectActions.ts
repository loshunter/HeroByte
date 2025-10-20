/**
 * useSceneObjectActions Hook
 *
 * Encapsulates all scene object-related action creators for managing tokens,
 * maps, props, and staging zones. Extracted from App.tsx as part of Phase 2
 * refactoring.
 *
 * This hook handles:
 * - Token recoloring
 * - Universal scene object transformations (position, scale, rotation, lock state)
 * - Scene object lock/unlock toggles
 * - Token deletion
 * - Token image updates
 * - Token size changes
 *
 * @module hooks/useSceneObjectActions
 */

import { useCallback } from "react";
import type { ClientMessage, TokenSize } from "@shared";

/**
 * Dependencies required by the useSceneObjectActions hook.
 */
export interface UseSceneObjectActionsOptions {
  /**
   * WebSocket message sender for client-server communication.
   */
  sendMessage: (msg: ClientMessage) => void;
}

/**
 * Parameters for transforming a scene object.
 */
export interface TransformSceneObjectParams {
  /**
   * Scene object ID (e.g., "token:abc123", "map:main", "prop:chest").
   */
  id: string;

  /**
   * New position for the object.
   */
  position?: { x: number; y: number };

  /**
   * New scale for the object.
   */
  scale?: { x: number; y: number };

  /**
   * New rotation angle in degrees.
   */
  rotation?: number;

  /**
   * Whether the object should be locked (prevents editing).
   */
  locked?: boolean;
}

/**
 * Scene object action functions returned by the hook.
 */
export interface UseSceneObjectActionsReturn {
  /**
   * Send a recolor message for a token.
   * Automatically strips the "token:" prefix from scene IDs.
   *
   * @param sceneId - Scene object ID (e.g., "token:abc123")
   */
  recolorToken: (sceneId: string) => void;

  /**
   * Send a transform-object message with position, scale, rotation, and/or locked state.
   * This is a universal transform method that can update any combination of properties.
   *
   * @param params - Transform parameters (at least one optional field should be provided)
   */
  transformSceneObject: (params: TransformSceneObjectParams) => void;

  /**
   * Toggle the locked state of a scene object.
   * Sends a transform-object message with only the locked property.
   *
   * @param sceneObjectId - Scene object ID (e.g., "token:hero", "map:main")
   * @param locked - Whether the object should be locked
   */
  toggleSceneObjectLock: (sceneObjectId: string, locked: boolean) => void;

  /**
   * Delete a token from the scene.
   *
   * @param id - Token ID (without "token:" prefix)
   */
  deleteToken: (id: string) => void;

  /**
   * Update a token's image URL.
   *
   * @param tokenId - Token ID (without "token:" prefix)
   * @param imageUrl - New image URL (can be HTTP URL or data URL)
   */
  updateTokenImage: (tokenId: string, imageUrl: string) => void;

  /**
   * Update a token's size.
   *
   * @param tokenId - Token ID (without "token:" prefix)
   * @param size - New token size (tiny, small, medium, large, huge, gargantuan)
   */
  updateTokenSize: (tokenId: string, size: TokenSize) => void;
}

/**
 * Hook providing all scene object-related action creators.
 *
 * @param options - Hook dependencies
 * @returns Scene object action functions
 *
 * @example
 * ```tsx
 * const sceneObjectActions = useSceneObjectActions({ sendMessage });
 *
 * // Recolor token
 * sceneObjectActions.recolorToken("token:abc123");
 *
 * // Transform object (move and rotate)
 * sceneObjectActions.transformSceneObject({
 *   id: "token:hero",
 *   position: { x: 100, y: 200 },
 *   rotation: 45
 * });
 *
 * // Lock/unlock object
 * sceneObjectActions.toggleSceneObjectLock("map:main", true);
 *
 * // Token management
 * sceneObjectActions.deleteToken("abc123");
 * sceneObjectActions.updateTokenImage("abc123", "https://example.com/warrior.png");
 * sceneObjectActions.updateTokenSize("abc123", "large");
 * ```
 */
export function useSceneObjectActions({
  sendMessage,
}: UseSceneObjectActionsOptions): UseSceneObjectActionsReturn {
  /**
   * Send a recolor message for a token.
   * Strips "token:" prefix if present.
   */
  const recolorToken = useCallback(
    (sceneId: string) => {
      const id = sceneId.replace(/^token:/, "");
      sendMessage({ t: "recolor", id });
    },
    [sendMessage],
  );

  /**
   * Send a transform-object message with the provided parameters.
   * All transform properties are optional, allowing partial updates.
   */
  const transformSceneObject = useCallback(
    ({ id, position, scale, rotation, locked }: TransformSceneObjectParams) => {
      sendMessage({
        t: "transform-object",
        id,
        position,
        scale,
        rotation,
        locked,
      });
    },
    [sendMessage],
  );

  /**
   * Toggle the locked state of a scene object.
   */
  const toggleSceneObjectLock = useCallback(
    (sceneObjectId: string, locked: boolean) => {
      sendMessage({
        t: "transform-object",
        id: sceneObjectId,
        locked,
      });
    },
    [sendMessage],
  );

  /**
   * Delete a token from the scene.
   */
  const deleteToken = useCallback(
    (id: string) => {
      sendMessage({ t: "delete-token", id });
    },
    [sendMessage],
  );

  /**
   * Update a token's image URL.
   */
  const updateTokenImage = useCallback(
    (tokenId: string, imageUrl: string) => {
      sendMessage({
        t: "update-token-image",
        tokenId,
        imageUrl,
      });
    },
    [sendMessage],
  );

  /**
   * Update a token's size.
   */
  const updateTokenSize = useCallback(
    (tokenId: string, size: TokenSize) => {
      sendMessage({
        t: "set-token-size",
        tokenId,
        size,
      });
    },
    [sendMessage],
  );

  return {
    recolorToken,
    transformSceneObject,
    toggleSceneObjectLock,
    deleteToken,
    updateTokenImage,
    updateTokenSize,
  };
}
