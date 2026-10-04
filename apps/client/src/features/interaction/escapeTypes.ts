export type CancelReason = "escape" | "foreground-modal" | "transition" | "cancel-control";

/** A known containing paint band, NOT the z-index of an arbitrary descendant.
 * Share this exact object with nested frames/portals belonging to the same root.
 * Merely creating/providing it does not declare visible content-frame presence.
 */
export interface EscapeRoot {
  node: () => HTMLElement | null;
  band: () => number;
}

interface BaseOwner {
  active: boolean;
  /** Diagnostic identity only; never used to choose a winner. */
  name: string;
}

export interface LayerOwner extends BaseOwner {
  kind: "modal" | "popover" | "panel";
  /** Only desktop floating panels may coexist with a genuinely focused map. */
  allowFocusedCanvasHistory?: boolean;
  root: EscapeRoot;
  /** Actual layer node, including a portalled nested popover. */
  anchor: HTMLElement | null;
  /** Within the same root only. Its DOM order resolves equal local bands. */
  localBand?: number;
  /** Absent for a loading/blocked layer: consume without closing. */
  handle?: (reason: "escape") => void;
}

export interface GestureOwner extends BaseOwner {
  kind: "gesture";
  /** Explicit arbitration if several kinds can be armed; never mount order. */
  order: number;
  label?: string;
  handle: (reason: CancelReason) => void;
}

export interface FallbackOwner extends BaseOwner {
  kind: "tool" | "selection";
  order: number;
  handle: (reason: "escape") => void;
}

export type EscapeOwner = LayerOwner | GestureOwner | FallbackOwner;
export type ReadOwner = () => EscapeOwner;
export interface Entry {
  id: symbol;
  owner: EscapeOwner;
}
export type Pick<T> = { state: "none" } | { state: "ambiguous" } | { state: "one"; value: T };
export interface LocalSite {
  root: EscapeRoot | null;
  /** The local input/editor, not the enclosing whole window. */
  anchor: HTMLElement | null;
}
