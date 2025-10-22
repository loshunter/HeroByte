import { useCallback } from "react";
import type { ClientMessage } from "@shared";

/**
 * Options for the useMapActions hook
 */
export interface UseMapActionsOptions {
  /** Function to send WebSocket messages to the server */
  sendMessage: (msg: ClientMessage) => void;
}

/**
 * Return type for the useMapActions hook
 */
export interface UseMapActionsReturn {
  /** Set the map background image URL */
  setMapBackground: (url: string) => void;
  /** Set the grid size (cell size in pixels) */
  setGridSize: (size: number) => void;
  /** Set the grid square size (real-world distance per cell in feet) */
  setGridSquareSize: (size: number) => void;
}

/**
 * Hook for managing map-related actions
 *
 * This hook provides stable callback references for map configuration actions:
 * - Setting the map background image
 * - Adjusting the grid size (visual cell size)
 * - Configuring the grid square size (real-world scale)
 *
 * All actions are sent as WebSocket messages to the server for synchronization.
 *
 * @param options - Configuration options including sendMessage function
 * @returns Object containing map action callbacks
 *
 * @example
 * ```tsx
 * const { setMapBackground, setGridSize, setGridSquareSize } = useMapActions({
 *   sendMessage: websocket.send
 * });
 *
 * // Set a new map background
 * setMapBackground("https://example.com/dungeon.png");
 *
 * // Change grid size to 100 pixels per cell
 * setGridSize(100);
 *
 * // Set grid to represent 10 feet per square
 * setGridSquareSize(10);
 * ```
 */
export function useMapActions(options: UseMapActionsOptions): UseMapActionsReturn {
  const { sendMessage } = options;

  /**
   * Set the map background image URL
   * Sends a "map-background" message to the server
   */
  const setMapBackground = useCallback(
    (url: string) => {
      sendMessage({ t: "map-background", data: url });
    },
    [sendMessage],
  );

  /**
   * Set the grid size (cell size in pixels)
   * Sends a "grid-size" message to the server
   */
  const setGridSize = useCallback(
    (size: number) => {
      sendMessage({ t: "grid-size", size });
    },
    [sendMessage],
  );

  /**
   * Set the grid square size (real-world distance per cell in feet)
   * Sends a "grid-square-size" message to the server
   */
  const setGridSquareSize = useCallback(
    (size: number) => {
      sendMessage({ t: "grid-square-size", size });
    },
    [sendMessage],
  );

  return {
    setMapBackground,
    setGridSize,
    setGridSquareSize,
  };
}
