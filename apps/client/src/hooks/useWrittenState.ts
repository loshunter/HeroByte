import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * React state whose LAST WRITTEN value can be read at once.
 *
 * `value` is the state as last rendered; `latest.current` is the state the
 * next render will show. They differ whenever a handler runs before React
 * renders its predecessor's write, and on a Konva board that is routine: Konva
 * calls the handlers the last render bound, and in a heavy scene several
 * pointer frames run before the next render, so a handler reading `value`
 * reads one or more of its own writes behind. Every write goes through `set`,
 * which applies an updater to `latest` (never to a render's value), so the two
 * always agree on order and a reader of `latest` never loses a write.
 *
 * `flush()` writes the latest value again at the CURRENT event's priority.
 * React renders continuous input (a pointer move) after a discrete event (a
 * release), and the release's render leaves out a move still waiting: calling
 * `flush()` from the release puts that move in the release's own render.
 */
export function useWrittenState<T>(initial: T) {
  const [value, setRendered] = useState(initial);
  const latest = useRef(value);
  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    latest.current = typeof next === "function" ? (next as (prev: T) => T)(latest.current) : next;
    setRendered(latest.current);
  }, []);
  const flush = useCallback(() => setRendered(latest.current), []);
  return { value, latest, set, flush };
}
