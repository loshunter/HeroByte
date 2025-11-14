/**
 * StagingZoneManager
 *
 * Manages the player staging zone - a designated area on the game map where
 * player tokens spawn. Handles validation, normalization, and spawn position
 * generation with support for rotated zones.
 *
 * Extracted from: apps/server/src/domains/room/service.ts (lines 26-54, 656-661, 667-687)
 * Extraction date: 2025-11-14
 *
 * @module domains/room/staging/StagingZoneManager
 */

import type { PlayerStagingZone, RoomState } from "@shared";

/**
 * Manages player staging zone operations including validation, persistence,
 * and spawn position generation.
 */
export class StagingZoneManager {
  /**
   * Creates a new StagingZoneManager instance.
   *
   * @param state - Reference to the room state (will be modified)
   * @param onStateChange - Optional callback to invoke when state changes (e.g., to rebuild scene graph)
   */
  constructor(
    private state: RoomState,
    private onStateChange?: () => void,
  ) {}

  /**
   * Validates and sanitizes a staging zone from untrusted input.
   *
   * Ensures all required fields are present, finite numbers, and applies normalization:
   * - Width and height are forced positive with minimum value of 1
   * - Rotation defaults to 0 if missing or invalid
   * - All values are coerced to numbers
   *
   * @param zone - Untrusted zone data (from JSON, client, etc.)
   * @returns Validated staging zone or undefined if validation fails
   *
   * @example
   * ```typescript
   * const manager = new StagingZoneManager(state);
   * const zone = manager.sanitize({ x: 10, y: 20, width: 5, height: 3, rotation: 45 });
   * // Returns: { x: 10, y: 20, width: 5, height: 3, rotation: 45 }
   * ```
   */
  sanitize(zone: unknown): PlayerStagingZone | undefined {
    if (!zone || typeof zone !== "object") {
      return undefined;
    }
    const candidate = zone as Partial<PlayerStagingZone>;
    const x = Number(candidate.x);
    const y = Number(candidate.y);
    const width = Number(candidate.width);
    const height = Number(candidate.height);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return undefined;
    }
    const normalized: PlayerStagingZone = {
      x,
      y,
      width: Math.max(1, Math.abs(width)),
      height: Math.max(1, Math.abs(height)),
      rotation:
        candidate.rotation !== undefined && Number.isFinite(Number(candidate.rotation))
          ? Number(candidate.rotation)
          : 0,
    };
    return normalized;
  }

  /**
   * Sets or clears the player staging zone.
   *
   * Validates the input, updates state, and triggers scene graph rebuild.
   *
   * @param zone - The staging zone to set, or undefined to clear it
   * @returns Always returns true (indicates operation was processed)
   *
   * @example
   * ```typescript
   * const manager = new StagingZoneManager(state, () => rebuildSceneGraph());
   * manager.setZone({ x: 10, y: 10, width: 5, height: 5, rotation: 0 });
   * // State updated, scene graph rebuilt
   * ```
   */
  setZone(zone: PlayerStagingZone | undefined): boolean {
    const sanitized = this.sanitize(zone);
    this.state.playerStagingZone = sanitized;
    this.onStateChange?.();
    return true;
  }

  /**
   * Generates a random spawn position within the staging zone.
   *
   * If no staging zone is set, returns (0, 0) as a fallback.
   * Handles rotation by applying 2D rotation transformation.
   *
   * The algorithm:
   * 1. Generate random point within zone's local bounds (centered at origin)
   * 2. Apply rotation transformation using rotation matrix
   * 3. Translate to zone's global position
   *
   * @returns A random spawn position {x, y} in map coordinates
   *
   * @example
   * ```typescript
   * const manager = new StagingZoneManager(state);
   * manager.setZone({ x: 100, y: 100, width: 10, height: 10, rotation: 45 });
   * const position = manager.getSpawnPosition();
   * // Returns: { x: ~100, y: ~100 } (within rotated zone bounds)
   * ```
   */
  getSpawnPosition(): { x: number; y: number } {
    const zone = this.state.playerStagingZone;
    if (!zone) {
      return { x: 0, y: 0 };
    }

    // Convert rotation from degrees to radians
    const angle = ((zone.rotation ?? 0) * Math.PI) / 180;
    const halfWidth = zone.width / 2;
    const halfHeight = zone.height / 2;

    // Generate random point within local bounds (centered at origin)
    const randomX = Math.random() * zone.width - halfWidth;
    const randomY = Math.random() * zone.height - halfHeight;

    // Apply rotation transformation (2D rotation matrix)
    const rotatedX = randomX * Math.cos(angle) - randomY * Math.sin(angle);
    const rotatedY = randomX * Math.sin(angle) + randomY * Math.cos(angle);

    // Translate to global position
    return {
      x: zone.x + rotatedX,
      y: zone.y + rotatedY,
    };
  }
}
