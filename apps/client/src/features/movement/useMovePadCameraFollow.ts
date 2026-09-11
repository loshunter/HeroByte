// ============================================================================
// MOVE-PAD CAMERA FOLLOW — the hook
// ============================================================================
// Mobile-local, like the map-edit cancel counter: MobileLayout renders both
// the sheet and the board, so the follow lives there and threads nothing
// through MainLayoutProps (which would put a phone affordance in every
// desktop layout fixture). The layout hands the board the MERGED command —
// the app-level one first (focus self, reset, travel arrival), else the
// follow's own — and one handler that clears whichever is showing. An
// app-level command moves the camera by its own rule, so once it has landed
// the follow evaluates again (its one deliberate read of a camera change)
// and brings the piece back into the band if that rule left it under the
// sheet.
//
// The follow evaluates when the followed piece's box changes — whatever
// moved it: a pad press, a finger drag, a DM dragging your token, a travel
// (the pad is up, so the piece under it is the one you are steering) — when
// the pad mounts over a piece already under the band, and when the band
// itself changes (a rotation, the browser bar collapsing, the sheet gaining
// a row). Never when the camera changes: a finger pan that pushes the piece
// under the sheet is the player's choice, and re-panning against it would
// fight the finger. So the camera is read through a ref and is not a
// dependency.
//
// Drag previews (VITE_ENABLE_DRAG_PREVIEWS, off by default) would move the
// piece's cell under a finger mid-drag and so fire the follow mid-gesture;
// the pan handlers re-base on an outside camera change, but a preview-driven
// jump is still a jump. If previews ever ship on, gate `evaluate` on the
// drag.
//
// The rects are REAL: the sheet's, the combat strip's and the map surface's
// bounding boxes, measured when the decision is made (a sheet's height
// depends on its chips — Lock/Unlock for a DM — and the pad folds in
// landscape). jsdom has no layout, so the unit test stubs them and the e2e
// measures them.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomSnapshot } from "@herobyte/shared";
import type { Camera } from "../../hooks/useCamera";
import type { CameraCommand } from "../../ui/MapBoard.types";
import { movableSelection } from "./keyboardMovement";
import { followDecision, followTarget, type FollowTarget } from "./movePadCameraFollow";

/** The elements the follow measures; the classes are the CSS contract. */
export const MOVE_PAD_SHEET_SELECTOR = ".mobile-selection-sheet";
export const MOVE_PAD_SURFACE_SELECTOR = ".mobile-map-surface";
export const MOVE_PAD_STRIP_SELECTOR = ".mobile-combat-strip";

export interface UseMovePadCameraFollowOptions {
  /** True only while the pad is mounted and nothing covers it. */
  active: boolean;
  snapshot: RoomSnapshot | null;
  gridSize: number;
  camera: Camera;
  selectedObjectIds: readonly string[];
  uid: string;
  isDM: boolean;
  mapEditMode: boolean;
  appCommand: CameraCommand | null;
  onAppCommandHandled: () => void;
}

export interface MovePadCameraFollow {
  cameraCommand: CameraCommand | null;
  onCameraCommandHandled: () => void;
}

const targetKeyOf = (target: FollowTarget | null): string =>
  target ? [target.left, target.top, target.right, target.bottom, target.below].join("|") : "";

export function useMovePadCameraFollow({
  active,
  snapshot,
  gridSize,
  camera,
  selectedObjectIds,
  uid,
  isDM,
  mapEditMode,
  appCommand,
  onAppCommandHandled,
}: UseMovePadCameraFollowOptions): MovePadCameraFollow {
  const target = useMemo(() => {
    if (!active || mapEditMode) return null;
    const movable = movableSelection({ selectedObjectIds, snapshot, uid, isDM });
    return followTarget(snapshot, movable, gridSize);
  }, [active, mapEditMode, selectedObjectIds, snapshot, uid, isDM, gridSize]);
  // The effects key on the piece's BOX, not the snapshot (one per heartbeat)
  // and not the camera (see the header).
  const targetKey = targetKeyOf(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const [local, setLocal] = useState<CameraCommand | null>(null);
  const localRef = useRef(local);
  localRef.current = local;
  const appCommandRef = useRef(appCommand);
  appCommandRef.current = appCommand;
  // The camera as it was when an app-level command was handled: the follow
  // evaluates once the camera is a DIFFERENT one (the command landed), never
  // on a later pan — and a command that moved nothing is forgotten on the
  // next frame rather than banked against the player's next pan.
  const armedAt = useRef<Camera | null>(null);

  const evaluate = useCallback(() => {
    if (!targetRef.current) return;
    const sheet = document.querySelector(MOVE_PAD_SHEET_SELECTOR)?.getBoundingClientRect();
    const surface = document.querySelector(MOVE_PAD_SURFACE_SELECTOR)?.getBoundingClientRect();
    if (!sheet || !surface || surface.width === 0 || surface.height === 0) return;
    const strip = document.querySelector(MOVE_PAD_STRIP_SELECTOR)?.getBoundingClientRect();
    const command = followDecision({
      target: targetRef.current,
      camera: cameraRef.current,
      surface: { width: surface.width, height: surface.height },
      visible: { top: strip ? strip.bottom - surface.top : 0, bottom: sheet.top - surface.top },
    });
    if (command) setLocal(command);
  }, []);

  // A new box, or the combat strip appearing over a still piece.
  const combatActive = snapshot?.combatActive === true;
  useEffect(() => {
    if (targetKey !== "") evaluate();
  }, [targetKey, combatActive, evaluate]);

  // The camera moved because an app-level command landed: evaluate once.
  useEffect(() => {
    if (armedAt.current === null || camera === armedAt.current) return;
    armedAt.current = null;
    if (targetKey !== "") evaluate();
  }, [camera, targetKey, evaluate]);

  // The band moves without the piece moving: a rotation, a browser bar
  // collapsing (100dvh), the sheet gaining a row. Listen while there is a
  // piece to follow — once, not once per step.
  const following = targetKey !== "";
  useEffect(() => {
    if (!following) return;
    window.addEventListener("resize", evaluate);
    window.addEventListener("orientationchange", evaluate);
    const sheetElement = document.querySelector(MOVE_PAD_SHEET_SELECTOR);
    const observer =
      typeof ResizeObserver === "undefined" || !sheetElement ? null : new ResizeObserver(evaluate);
    observer?.observe(sheetElement as Element);
    return () => {
      window.removeEventListener("resize", evaluate);
      window.removeEventListener("orientationchange", evaluate);
      observer?.disconnect();
    };
  }, [following, evaluate]);

  const onCameraCommandHandled = useCallback(() => {
    if (localRef.current && !appCommandRef.current) {
      setLocal(null);
      return;
    }
    onAppCommandHandled();
    if (appCommandRef.current) {
      // Whatever the follow had queued was placed against the old camera.
      if (localRef.current) setLocal(null);
      armedAt.current = cameraRef.current;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          armedAt.current = null;
        });
      }
    }
  }, [onAppCommandHandled]);

  return useMemo(
    () => ({ cameraCommand: appCommand ?? local, onCameraCommandHandled }),
    [local, appCommand, onCameraCommandHandled],
  );
}
