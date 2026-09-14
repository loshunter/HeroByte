// ============================================================================
// KEYBOARD MOVEMENT — the hook
// ============================================================================
// WASD / arrows / QEZC / numpad move the SELECTED objects one grid cell per
// press. The wire is RELATIVE: `step-object` carries a direction, never a
// cell, and the server resolves the target from its own authoritative
// position (TransformMessageHandler.handleStepObject) over the same road a
// drag release takes — ownership, lock, wall check, the player-props switch
// and the movement charge all apply unchanged, and the fog cone redraws from
// the next snapshot square by square. Because the client never guesses a
// cell, latency, a refused step or a turn can never send a token anywhere it
// is not next to: N presses are N one-cell steps, applied in order.
//
// Guard, per invariant 4.17 (the G precedent) MINUS its DM-only clause — a
// player moving their own token is the point: not from a typing surface, no
// modifier, not while a full-screen modal is up (`[data-modal-overlay]` —
// the initiative panel has no focus trap, and an arrow pressed "into" it
// stepped the token underneath and charged its budget), and inert in
// map-edit mode, where the DM is authoring the map, not moving pieces on it
// (a held key is THROTTLED, not dropped — below).
//
// NOTHING SELECTED → the actor's own token (F4, `ownTokenFallback`): the plain
// cursor never holds a selection, so without this a player had to arm Select
// first. The fallback is keyboard-only in effect: the phone's d-pad lives in
// the selection sheet, which mounts only with a selection (MobileLayout), so
// a `movableCount` of 1 with nothing selected lights nothing there. A
// selection the actor may not move is NOT "nothing" — it stays inert, and the
// key is left alone so arrows still scroll a focused panel.
//
// The fallback speaks for the BOARD, and the board is always there — so it
// answers a bare key only while the board has the conversation (round 1 of
// F4's review: the listener had gone from "a piece is selected" to always-on,
// and arrows meant to page the roll log walked the token and charged its
// budget). Three yields, for the fallback road only — a selected piece was a
// deliberate click and keeps its reach: (1) the key's target must be bare
// (the window, the document or its body — a focused button, tab or field
// keeps its arrows); (2) the last pointer must have landed on the stage
// (`.konvajs-content` / a canvas) — a click in the log, a panel or a toolbar
// hands the keys to that surface until the map is clicked again; the witness
// starts armed, and a click anywhere else (the login button included) takes
// it down; (3) a tool composing on the stage (draw, align, atlas-link —
// `toolOwnsKeys`) owns the keys outright and the fallback registers nothing.
//
// ONE message per step for the whole selection, chunked at MAX_STEP_OBJECTS:
// a message per object was 6.7 × N a second under a held key, past the
// limiter's 100/s at ~15 objects, and the dropped steps broke formation.
//
// REPEAT MODEL: a held key WALKS, at a bounded cadence. The OS repeat rate
// (~30/s) would be 30 messages a second, each a broadcast and a fog
// re-filter per recipient; instead a repeat event steps only when
// HOLD_STEP_INTERVAL_MS has passed since the last step, so a hold is at most
// ~6 cells a second. The first, non-repeat press is always immediate.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { MAX_STEP_OBJECTS, type ClientMessage, type RoomSnapshot } from "@herobyte/shared";
import { isEditableTarget } from "../../utils/isEditableTarget";
import {
  deltaForKey,
  movableSelection,
  ownTokenFallback,
  type CellDelta,
} from "./keyboardMovement";

/** Minimum gap between steps while a key is HELD (a hold walks ~6 cells/s). */
export const HOLD_STEP_INTERVAL_MS = 150;

export interface UseKeyboardMovementOptions {
  selectedObjectIds: readonly string[];
  snapshot: RoomSnapshot | null;
  uid: string;
  isDM: boolean;
  mapEditMode: boolean;
  /**
   * A tool that composes on the stage (draw, align, atlas-link) keeps a bare
   * key: the own-token fallback yields entirely while one is armed. A
   * selection cannot exist under those tools (it auto-clears), so only the
   * fallback road is affected.
   */
  toolOwnsKeys: boolean;
  sendMessage: (message: ClientMessage) => void;
}

/** What a layout needs to offer the same move without a keyboard (the phone d-pad). */
export interface MovementControls {
  /**
   * How many objects a step would move; 0 hides every affordance. With
   * nothing selected this is the own-token fallback (1 or 0) — the phone's
   * pad still needs a selection to mount, so the fallback is the keys' alone.
   */
  movableCount: number;
  /** Move every movable selected object by one cell. */
  move: (delta: CellDelta) => void;
}

export function useKeyboardMovement({
  selectedObjectIds,
  snapshot,
  uid,
  isDM,
  mapEditMode,
  toolOwnsKeys,
  sendMessage,
}: UseKeyboardMovementOptions): MovementControls {
  // Map-edit mode zeroes the selection for BOTH surfaces (the keys and the
  // phone d-pad), so a DM authoring the map never shoves a token from either.
  // An EMPTY selection stands in for the actor's own token, which then takes
  // the same road (lock, ownership) as a clicked one — unless a composing
  // tool owns the keys.
  const viaFallback = !mapEditMode && selectedObjectIds.length === 0;
  const movable = useMemo(() => {
    if (mapEditMode) return [];
    if (selectedObjectIds.length === 0) {
      if (toolOwnsKeys) return [];
      const own = ownTokenFallback({ snapshot, uid });
      return own ? movableSelection({ selectedObjectIds: [own], snapshot, uid, isDM }) : [];
    }
    return movableSelection({ selectedObjectIds, snapshot, uid, isDM });
  }, [mapEditMode, toolOwnsKeys, selectedObjectIds, snapshot, uid, isDM]);
  const viaFallbackRef = useRef(viaFallback);
  viaFallbackRef.current = viaFallback;
  // The board witness: did the last pointer land on the stage? Capture phase,
  // so a surface that stops propagation still reports.
  const boardArmedRef = useRef(true);
  useEffect(() => {
    const onPointerDown = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      boardArmedRef.current =
        target !== null && target.closest(".konvajs-content, canvas") !== null;
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  // The listener reads the movable set through a ref, and re-registers only
  // when the set of IDS changes — not on every snapshot (one per step during
  // a walk, plus every heartbeat).
  const movableRef = useRef(movable);
  movableRef.current = movable;
  const movableKey = useMemo(() => movable.join("|"), [movable]);
  const lastStepAtRef = useRef(0);

  const move = useCallback(
    ({ dx, dy }: CellDelta) => {
      lastStepAtRef.current = Date.now();
      const ids = movableRef.current;
      for (let start = 0; start < ids.length; start += MAX_STEP_OBJECTS) {
        sendMessage({ t: "step-object", ids: ids.slice(start, start + MAX_STEP_OBJECTS), dx, dy });
      }
    },
    [sendMessage],
  );

  useEffect(() => {
    if (movableKey === "") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const delta = deltaForKey(event);
      if (!delta) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      if (document.querySelector("[data-modal-overlay]")) return;
      // The listener can outlive an emptied set by one paint (the ref is
      // written in render, the cleanup runs in the effect): swallow nothing.
      if (movableRef.current.length === 0) return;
      if (viaFallbackRef.current && !(isBareTarget(event.target) && boardArmedRef.current)) return;
      event.preventDefault();
      if (event.repeat && Date.now() - lastStepAtRef.current < HOLD_STEP_INTERVAL_MS) return;
      move(delta);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [movableKey, move]);

  return useMemo(() => ({ movableCount: movable.length, move }), [movable.length, move]);
}

/**
 * Nothing holds focus: the key reached the window, the document or its body.
 * Instance checks, not identity — a test runner's window proxy is not `===`
 * the window an event reports as its target.
 */
function isBareTarget(target: EventTarget | null): boolean {
  if (target === null) return true;
  if (typeof Window !== "undefined" && target instanceof Window) return true;
  if (typeof Document !== "undefined" && target instanceof Document) return true;
  return target === document.body || target === document.documentElement;
}
