import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { createEscapeRegistry, type EscapeRegistry } from "./escapeRegistry";
import type { EscapeRoot, ReadOwner } from "./escapeTypes";

// No browser listener until an owner/frame registers. One shared production instance.
export const escapeRegistry = createEscapeRegistry();
const RootContext = createContext<EscapeRoot | null>(null);
export const EscapeRootProvider = RootContext.Provider;

export function useEscapeRootContext(): EscapeRoot | null {
  return useContext(RootContext);
}

export function useEscapeOwner(
  read: ReadOwner,
  registry: EscapeRegistry = escapeRegistry,
): () => void {
  const committedRead = useRef(read);
  // Do not publish an abandoned concurrent render's props through the registry.
  useLayoutEffect(() => {
    committedRead.current = read;
    registry.refresh();
  });
  useLayoutEffect(() => registry.register(() => committedRead.current()), [registry]);
  // Drivers call this immediately after mutating pending refs (start/cancel/release).
  // Dispatch reads refs even without notification; the scalar label needs notification.
  return registry.refresh;
}

/** Identity/context only. Persistent canvas and tool palettes must remain unobserved. */
export function useEscapeRoot(
  ref: RefObject<HTMLElement>,
  band: number,
  registry: EscapeRegistry = escapeRegistry,
): EscapeRoot {
  const committed = useRef({ ref, band });
  const stable = useRef<EscapeRoot | null>(null);
  if (!stable.current) {
    stable.current = {
      node: () => committed.current.ref.current,
      band: () => committed.current.band,
    };
  }
  useLayoutEffect(() => {
    committed.current = { ref, band };
    // Also reconciles child-owner registration if its ancestor ref attached later.
    registry.refresh();
  });
  return stable.current;
}

/** Explicit opt-in for visible content frames, including non-dismissable Dice/Result. */
export function useEscapeFramePresence(
  root: EscapeRoot | null,
  visible: boolean,
  registry: EscapeRegistry = escapeRegistry,
): void {
  const committed = useRef({ root, visible });
  useLayoutEffect(() => {
    committed.current = { root, visible };
    registry.refresh();
  });
  useLayoutEffect(
    () => registry.observeFrame(() => (committed.current.visible ? committed.current.root : null)),
    [registry],
  );
}

export function useLocalEscape(registry: EscapeRegistry = escapeRegistry) {
  const root = useEscapeRootContext();
  return useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, cancel: () => void): boolean => {
      if (
        !registry.canHandleLocalEscape(event.nativeEvent, { root, anchor: event.currentTarget })
      ) {
        return false;
      }
      // Both synthetic and native propagation stop; a lower React ancestor must not act.
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      cancel();
      registry.refresh();
      return true;
    },
    [registry, root],
  );
}

/** Optional accessibility view. This is derived state, not another gesture owner. */
export function usePendingGestureLabel(registry: EscapeRegistry = escapeRegistry): string | null {
  return useSyncExternalStore(registry.subscribe, registry.getPendingLabel, () => null);
}
