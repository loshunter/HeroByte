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
// yields a key only to a surface that would actually USE it (round 1 of F4's
// review: the listener had gone from "a piece is selected" to always-on, and
// arrows meant to page the roll log walked the token and charged its budget;
// round 2: a "last click on the stage" witness over-corrected — the ⚔️ button
// that finds your token, or any button, took the keys away; round 3: leaving
// the arrows to the browser paged NOTHING — the panels are unfocusable divs
// under an overflow-hidden root — and ⚔️ sits INSIDE the scrolling party
// panel, so a click on it armed the panel). Three yields, for the fallback
// road only — a selected piece was a deliberate click and keeps its reach:
// (1) a typing surface (`isEditableTarget`) or a focused ARROW WIDGET
// (`KEY_CONSUMER_ROLES` — the element or any ancestor) keeps every movement
// key; a focused button keeps none unless it sits in such a widget — buttons
// do nothing with them; (2) ↑/↓ page the scrolling panel the
// player last clicked INTO or wheeled over — the hook pages it itself, one
// line per press, measured at the press (a panel that no longer overflows, or
// is gone, takes nothing) — while ←/→, the letters and the numpad, which mean
// nothing to a panel, stay the board's; a click on a CONTROL (⚔️, NEXT, a
// card's gear) is a click on the control, not into the panel around it, and a
// click on the stage clears the witness; (3) a tool that composes on the
// stage (`composingTool`: draw, align, atlas-link) owns the keys outright,
// selection or not — a deselect is optimistic but a switch away from Select
// clears the selection only when the snapshot returns — and in Select or
// Transform (`selectionTool`) an empty selection means NOTHING selected, not
// "my token". Nothing yields on a fresh join: the keys work before the first
// click, and no invisible state has to be learned.
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
   * Select or Transform is armed: an empty selection means nothing selected,
   * so the own-token fallback registers nothing; a piece selected there still
   * steps.
   */
  selectionTool: boolean;
  /**
   * A tool that composes on the stage (draw, align, atlas-link) owns every
   * movement key, selection or not: switching away from Select keeps the old
   * selection until the `deselect-object` round trip lands, and a key in that
   * window must not step the piece the DM stopped selecting.
   */
  composingTool: boolean;
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
  selectionTool,
  composingTool,
  sendMessage,
}: UseKeyboardMovementOptions): MovementControls {
  // Map-edit mode and a composing tool zero the set for BOTH surfaces (the
  // keys and the phone d-pad), so a DM authoring or drawing never shoves a
  // token from either. An EMPTY selection stands in for the actor's own
  // token, which then takes the same road (lock, ownership) as a clicked one
  // — unless Select or Transform is armed, where empty means empty.
  const viaFallback = !mapEditMode && !composingTool && selectedObjectIds.length === 0;
  const movable = useMemo(() => {
    if (mapEditMode || composingTool) return [];
    if (selectedObjectIds.length === 0) {
      if (selectionTool) return [];
      const own = ownTokenFallback({ snapshot, uid });
      return own ? movableSelection({ selectedObjectIds: [own], snapshot, uid, isDM }) : [];
    }
    return movableSelection({ selectedObjectIds, snapshot, uid, isDM });
  }, [mapEditMode, composingTool, selectionTool, selectedObjectIds, snapshot, uid, isDM]);
  const viaFallbackRef = useRef(viaFallback);
  viaFallbackRef.current = viaFallback;
  // The scroller witness: the scrolling panel the player last clicked INTO or
  // wheeled over, or null. A click on a control inside a panel is a click on
  // the control. Capture phase, so a surface that stops propagation still
  // reports; the witness is re-measured at the press, so a stale one takes
  // nothing.
  const scrollerRef = useRef<Element | null>(null);
  useEffect(() => {
    const onPointerDown = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest(CONTROL_SELECTOR) ?? null;
      scrollerRef.current = target && !control ? scrollableAncestor(target) : null;
    };
    const onWheel = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const scroller = target ? scrollableAncestor(target) : null;
      if (scroller) scrollerRef.current = scroller;
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("wheel", onWheel, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("wheel", onWheel, true);
    };
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
      if (viaFallbackRef.current) {
        if (keptByWidget(event.target)) return;
        if (pageScroller(event, scrollerRef.current)) return;
      }
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
 * Widgets whose keyboard contract includes the movement keys; a focused one
 * keeps them all. Declared ahead of the client's own markup: today the only
 * such roles it renders live on map-edit surfaces (where the hook is inert)
 * and the mobile drawing strip's toolbar; the DM menu's tab strip is plain
 * buttons. The list is what keeps a future tablist's arrows its own.
 */
const KEY_CONSUMER_ROLES = [
  "tab",
  "tablist",
  "listbox",
  "option",
  "tree",
  "treeitem",
  "menu",
  "menuitem",
  "slider",
  "radio",
  "radiogroup",
  "spinbutton",
  "grid",
  "gridcell",
  "toolbar",
]
  .map((role) => `[role="${role}"]`)
  .join(", ");

/** A click on one of these is a click on the control, never "into" the panel around it. */
const CONTROL_SELECTOR =
  'button, [role="button"], a[href], summary, label, input, select, textarea';

/** One arrow press pages a panel by a browser line step (Blink's 40px). */
const LINE_STEP_PX = 40;
/** A classic horizontal scrollbar eats ~17px of clientHeight; that is not overflow. */
const SCROLLBAR_SLACK_PX = 20;

/** A focused arrow widget — the element or any ancestor — keeps every movement key. */
function keptByWidget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(KEY_CONSUMER_ROLES) !== null;
}

/**
 * ↑/↓ page the witnessed panel — the hook does the paging, because the
 * browser pages only from a FOCUSED node and the panels are unfocusable divs
 * under an overflow-hidden root. Measured at the press: a witness that no
 * longer overflows, or is gone, takes nothing. ←/→, the letters and the numpad
 * (whose `key` reads "ArrowDown" with NumLock off — hence `code`) never page.
 */
function pageScroller(event: KeyboardEvent, scroller: Element | null): boolean {
  if (event.code !== "ArrowUp" && event.code !== "ArrowDown") return false;
  if (!scroller || !scroller.isConnected || !overflows(scroller)) return false;
  event.preventDefault();
  scroller.scrollTop += event.code === "ArrowDown" ? LINE_STEP_PX : -LINE_STEP_PX;
  return true;
}

function overflows(el: Element): boolean {
  return el.scrollHeight - el.clientHeight > SCROLLBAR_SLACK_PX;
}

/**
 * The nearest self-or-ancestor that scrolls VERTICALLY and has something to
 * scroll, or null. `overflow-x: auto` alone computes `overflow-y` to `auto`
 * too, so the slack is what keeps a sideways strip out. The stage never
 * counts, whatever wraps it.
 */
function scrollableAncestor(start: Element): Element | null {
  for (let el: Element | null = start; el && el !== document.body; el = el.parentElement) {
    if (el.classList.contains("konvajs-content")) return null;
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && overflows(el)) return el;
  }
  return null;
}
