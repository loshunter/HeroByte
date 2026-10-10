// The colour picker's input constants and its pointer and notice shapes, kept
// apart from ColorPicker.tsx so the state machine stays under the size guard.

import type { WindowCell } from "@herobyte/shared";

export const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Arrow-key steps commit once the keys have been quiet this long (one message, not ten). */
export const KEY_COMMIT_MS = 400;
/** A commit the server answers without changing the colour stops showing after this. */
export const PENDING_TIMEOUT_MS = 1500;
/** A press that moves less than this is a tap, not a drag: a finger jitters more than a mouse. */
export const TAP_SLOP_PX: Record<string, number> = { mouse: 3, pen: 6, touch: 10 };
/** A bump notice stays this long after the pointer lifts (on a phone, that is the label). */
export const NOTICE_HOLD_MS = 3000;
/** The window's drawn aspect (colorPicker.css), for the edge-stop before it is measured. */
export const DRAWN_ASPECT = 2.6;

/** The line under the window: a bump or tap notice is announced, a hover label is not. */
export interface Notice {
  text: string;
  live: boolean;
}

export interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  /** How far it must move to be a drag rather than a tap, for this kind of pointer. */
  slop: number;
  /** Pressed on the handle itself: moves keep the grab offset, and a tap is no pick. */
  onHandle: boolean;
  /**
   * The cell a press off the handle showed (its own cell, or a zone's nearest free
   * edge): a tap commits it, wherever the finger lifts.
   */
  pressed: WindowCell | null;
  /** Arrow-key steps still waiting when the press began: a cancelled press sends them. */
  keys: WindowCell | null;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}
