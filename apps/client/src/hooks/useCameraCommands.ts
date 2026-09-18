/**
 * useCameraCommands - Camera Command Management Hook
 *
 * Manages camera positioning commands in a fire-and-forget pattern.
 * Commands are issued to trigger camera movements, then cleared once handled.
 *
 * ## Command Pattern
 * This hook implements a fire-and-forget command pattern:
 * 1. User triggers an action (focus self, reset camera)
 * 2. Hook sets a camera command
 * 3. MapBoard reads and executes the command
 * 4. MapBoard calls onCameraCommandHandled to clear the command
 *
 * ## Dependencies
 * - **snapshot**: RoomSnapshot containing tokens array, used to find user's token
 * - **uid**: User ID string, used to identify which token belongs to the user
 *
 * ## Usage
 * ```tsx
 * const { cameraCommand, handleFocusSelf, handleResetCamera, handleCameraCommandHandled } =
 *   useCameraCommands({ snapshot, uid });
 *
 * // Pass to Header for toolbar buttons
 * <Header onFocusSelf={handleFocusSelf} onResetCamera={handleResetCamera} />
 *
 * // Pass to MapBoard for command execution
 * <MapBoard cameraCommand={cameraCommand} onCameraCommandHandled={handleCameraCommandHandled} />
 * ```
 *
 * @module useCameraCommands
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  transformScenePoint,
  type RoomSnapshot,
  type SceneObjectTransform,
} from "@herobyte/shared";
import { ownTokenFallback } from "../features/movement/keyboardMovement";
import type { CameraCommand } from "../ui/MapBoard";

const IDENTITY_TRANSFORM: SceneObjectTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

/**
 * Where a camera with nothing better to look at should point: the party's
 * staging zone if the table names one, else the middle of the scene.
 *
 * The zone is a cell rect on the WORLD lattice; the scene's midpoint is in
 * DOCUMENT px and must go through the map object's transform (the scene renders
 * under it) or a moved or scaled raster sends the camera into the void.
 *
 * Returns null when there is no scene yet — there is nothing to aim at, and
 * guessing a point on a table that has no map is worse than leaving the camera
 * where it is.
 */
function sceneArrivalPoint(snapshot: RoomSnapshot | null): { x: number; y: number } | null {
  const scene = snapshot?.compiledScene;
  if (!scene) return null;
  const zone = snapshot?.playerStagingZone;
  const gridSize = snapshot?.gridSize ?? 50;
  const mapTransform = snapshot?.sceneObjects?.find((object) => object.type === "map")?.transform;
  return zone
    ? { x: (zone.x + 0.5) * gridSize, y: (zone.y + 0.5) * gridSize }
    : transformScenePoint(mapTransform ?? IDENTITY_TRANSFORM, {
        x: scene.width / 2,
        y: scene.height / 2,
      });
}

interface UseCameraCommandsParams {
  /** Current room snapshot, contains tokens array */
  snapshot: RoomSnapshot | null;
  /** Current user's unique identifier */
  uid: string;
}

interface UseCameraCommandsReturn {
  /** Current camera command to be executed (null when no command pending) */
  cameraCommand: CameraCommand | null;
  /** Focus camera on user's token (shows alert if no token exists) */
  handleFocusSelf: () => void;
  /** Focus camera on a specific token by ID */
  handleFocusToken: (tokenId: string) => void;
  /** Reset camera to default position/zoom */
  handleResetCamera: () => void;
  /** Clear the current camera command after it has been handled */
  handleCameraCommandHandled: () => void;
}

/**
 * Hook for managing camera positioning commands.
 *
 * Provides handlers for common camera operations:
 * - Focus on user's own token
 * - Reset camera to default view
 * - Clear commands after execution
 *
 * @param params - Hook parameters
 * @returns Camera command state and handler functions
 */
export function useCameraCommands({
  snapshot,
  uid,
}: UseCameraCommandsParams): UseCameraCommandsReturn {
  // State: Current camera command (null when no command pending)
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);

  // TRAVEL ARRIVAL (A5): when the scene under the table CHANGES (the
  // player-visible sourceDocumentId moves between two defined values — the
  // same transition the iris wipe keys on), recenter on the destination's
  // staging zone, else the scene's middle. Without this the camera keeps the
  // OLD map's pan, which is usually empty void on the new one. First bind and
  // reload (undefined→A) deliberately do not fire.
  const previousSceneId = useRef<string | undefined>(snapshot?.compiledScene?.sourceDocumentId);
  useEffect(() => {
    const sceneId = snapshot?.compiledScene?.sourceDocumentId;
    const before = previousSceneId.current;
    previousSceneId.current = sceneId;
    if (!before || !sceneId || before === sceneId) return;
    const target = sceneArrivalPoint(snapshot);
    if (!target) return;
    setCameraCommand({ type: "focus-point", x: target.x, y: target.y });
  }, [
    snapshot?.compiledScene,
    snapshot?.playerStagingZone,
    snapshot?.gridSize,
    snapshot?.sceneObjects,
  ]);

  // ARRIVAL ON ENTRY. The travel effect above deliberately skips undefined→A —
  // first bind and reload — and nothing else aimed the camera, so JOINING or
  // RELOADING left it wherever it defaults. On a fogged map that is a black
  // rectangle with your own token somewhere off-screen, which is
  // indistinguishable from a table that failed to load: the audit's player
  // assumed an empty game. The only way back was the ⚔️ portrait icon, whose
  // camera behaviour is not discoverable from looking at it.
  //
  // Fires on the FIRST snapshot this client receives and never again — that
  // snapshot IS entry, for a join and for a reload alike, and it arrives whole.
  // Whatever it offers is the answer: if it offers nothing the camera stays put
  // for good, because a map appearing later is a first bind, and the effect
  // above deliberately does not move the camera for one. So this can neither
  // fight a pan nor overturn that decision.
  //
  // Your own token first — "where am I" is the question being answered. The
  // staging zone, else the scene's middle, for a DM or a player not yet placed.
  //
  // `ownTokenFallback` rather than `tokens.find(owner === uid)`: every NPC
  // token carries the uid of the DM who placed it, so the plain ownership test
  // sends a DM to a goblin (F4 settled this; one helper, three sites).
  const hasArrived = useRef(false);
  useEffect(() => {
    if (hasArrived.current || !snapshot) return;
    hasArrived.current = true;

    // ONLY WHERE THERE IS A MAP TO BE LOST ON. The confusion this answers is a
    // viewport full of fog with your token outside it, and that needs a scene
    // to exist — a table with no map shows no map to anyone, and moving the
    // camera over empty space answers nothing.
    //
    // This bound is load-bearing, not cosmetic. Without it, entry aimed at the
    // token a table hands every new arrival at (0,0), which on a table whose
    // map is created AFTERWARDS parks the view off the document that is about
    // to exist — the mobile map-edit specs caught exactly that, taps landing
    // outside the new map and painting nothing.
    if (!snapshot.compiledScene) return;

    const own = ownTokenFallback({ snapshot, uid });
    if (own?.startsWith("token:")) {
      setCameraCommand({ type: "focus-token", tokenId: own.slice("token:".length) });
      return;
    }

    const target = sceneArrivalPoint(snapshot);
    if (target) setCameraCommand({ type: "focus-point", x: target.x, y: target.y });
  }, [snapshot, uid]);

  /**
   * Focus camera on the user's token.
   * Shows an alert if the user doesn't have a token on the map yet.
   */
  const handleFocusSelf = useCallback(() => {
    const myToken = snapshot?.tokens?.find((t) => t.owner === uid);
    if (!myToken) {
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("You don't have a token on the map yet.");
      }
      return;
    }
    setCameraCommand({ type: "focus-token", tokenId: myToken.id });
  }, [snapshot?.tokens, uid]);

  /**
   * Focus camera on a specific token by ID.
   * Used when clicking portraits to snap to any token.
   */
  const handleFocusToken = useCallback((tokenId: string) => {
    setCameraCommand({ type: "focus-token", tokenId });
  }, []);

  /**
   * Reset camera to default position and zoom level.
   */
  const handleResetCamera = useCallback(() => {
    setCameraCommand({ type: "reset" });
  }, []);

  /**
   * Clear the current camera command.
   * Called by MapBoard after the command has been executed.
   */
  const handleCameraCommandHandled = useCallback(() => {
    setCameraCommand(null);
  }, []);

  return {
    cameraCommand,
    handleFocusSelf,
    handleFocusToken,
    handleResetCamera,
    handleCameraCommandHandled,
  };
}
