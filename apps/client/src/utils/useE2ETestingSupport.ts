import { useEffect } from "react";
import type { RoomSnapshot } from "@shared";

/**
 * Interface for E2E testing support hook parameters
 *
 * This hook exposes application state to E2E tests via window.__HERO_BYTE_E2E__
 * in development mode only. It's used for test automation and debugging.
 */
interface E2ETestingSupportProps {
  /**
   * Current room snapshot containing all scene objects and game state
   * Can be null during initial load or disconnection
   */
  snapshot: RoomSnapshot | null;

  /**
   * Unique identifier for the current user/player
   * Used to identify the player in E2E test scenarios
   */
  uid: string;

  /**
   * Grid size in pixels for the game map
   * Used for coordinate calculations in tests
   */
  gridSize: number;

  /**
   * Camera state (position and zoom scale)
   * Optional - enriched by MapBoard component when camera is available
   */
  cam?: { x: number; y: number; scale: number };

  /**
   * Viewport dimensions in pixels
   * Optional - enriched by MapBoard component when viewport is rendered
   */
  viewport?: { width: number; height: number };
}

/**
 * Exposes application state to E2E tests via window.__HERO_BYTE_E2E__
 *
 * **Purpose:**
 * - Enables E2E tests to inspect game state without DOM queries
 * - Provides camera and viewport information for coordinate calculations
 * - Supports test automation by exposing internal state
 *
 * **Guards:**
 * - SSR Safety: Does nothing when window is undefined (server-side rendering)
 * - Production Safety: Only runs in development/test mode (not production)
 *
 * **Usage:**
 * - Called from App.tsx (AuthenticatedApp) with base state (snapshot, uid, gridSize)
 * - Called from MapBoard.tsx with enriched state (adds cam, viewport)
 * - Multiple calls merge non-destructively (spread operator preserves existing properties)
 *
 * **Dependencies:**
 * - Updates when snapshot, uid, gridSize, cam, or viewport change
 * - Each parameter triggers re-execution of the effect
 *
 * **Type Definition:**
 * - See apps/client/src/types/e2e.d.ts for window.__HERO_BYTE_E2E__ type
 *
 * @param props - E2E testing support parameters
 * @returns void - Side effect only (mutates window.__HERO_BYTE_E2E__)
 *
 * @example
 * // Basic usage in App.tsx
 * useE2ETestingSupport({
 *   snapshot,
 *   uid,
 *   gridSize,
 * });
 *
 * @example
 * // Enriched usage in MapBoard.tsx
 * useE2ETestingSupport({
 *   snapshot,
 *   uid,
 *   gridSize,
 *   cam,
 *   viewport: { width: w, height: h },
 * });
 */
export function useE2ETestingSupport(props: E2ETestingSupportProps): void {
  const { snapshot, uid, gridSize, cam, viewport } = props;

  useEffect(() => {
    // SSR safety: Do nothing when window is undefined
    if (typeof window === "undefined") {
      return;
    }

    // Production safety: Only run in development/test mode
    if (import.meta.env.MODE === "production") {
      return;
    }

    // Type assertion to access __HERO_BYTE_E2E__ property
    const globalWindow = window as typeof window & {
      __HERO_BYTE_E2E__?: {
        snapshot?: RoomSnapshot | null;
        uid?: string;
        gridSize?: number;
        cam?: { x: number; y: number; scale: number };
        viewport?: { width: number; height: number };
      };
    };

    // Non-destructive merge: Preserve existing properties
    const previous = globalWindow.__HERO_BYTE_E2E__ ?? {};
    globalWindow.__HERO_BYTE_E2E__ = {
      ...previous,
      snapshot,
      uid,
      gridSize,
      // Conditionally add cam and viewport if provided
      ...(cam && { cam }),
      ...(viewport && { viewport }),
    };
  }, [snapshot, uid, gridSize, cam, viewport]);
}
