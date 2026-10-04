import { useCallback, useRef } from "react";

export interface UseMapEditTouchAimOptions {
  active: boolean;
  updateCursor: (point: { x: number; y: number } | null) => void;
  commit: (point: { x: number; y: number }) => void;
}

export interface MapEditTouchAim {
  start: (point: { x: number; y: number } | null) => void;
  move: (point: { x: number; y: number } | null) => void;
  commit: () => void;
  cancel: () => void;
  /** Live pointer lifetime, distinct from whether an on-document point exists. */
  current: () => boolean;
}

export function useMapEditTouchAim({
  active,
  updateCursor,
  commit,
}: UseMapEditTouchAimOptions): MapEditTouchAim {
  const armed = useRef(false);
  const aimed = useRef<{ x: number; y: number } | null>(null);
  const aim = useCallback(
    (point: { x: number; y: number } | null) => {
      if (!active || !armed.current) return;
      // An off-document move retains the last valid point of this same gesture.
      if (point) aimed.current = point;
      updateCursor(point ?? aimed.current);
    },
    [active, updateCursor],
  );

  const start = useCallback(
    (point: { x: number; y: number } | null) => {
      if (!active) return;
      armed.current = true;
      aimed.current = null;
      aim(point);
    },
    [active, aim],
  );
  const cancel = useCallback(() => {
    armed.current = false;
    aimed.current = null;
    updateCursor(null);
  }, [updateCursor]);
  const release = useCallback(() => {
    const point = armed.current ? aimed.current : null;
    // Disarm before calling any command callback (including a synchronous rerender).
    armed.current = false;
    aimed.current = null;
    updateCursor(null);
    if (active && point) commit(point);
  }, [active, updateCursor, commit]);
  const current = useCallback(() => armed.current, []);
  return { start, move: aim, commit: release, cancel, current };
}
