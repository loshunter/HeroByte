import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import type { MobileSurface } from "./useMobileSurface";
import { dismissalFocus, type FocusResolver } from "../features/interaction/dismissalFocus";
import { createMobileWorldReturn } from "../features/interaction/mobileWorldReturn";

export interface MobileWorldReturnControls {
  toolsRootRef: RefObject<HTMLDivElement>;
  toolsDockButtonRef: RefObject<HTMLButtonElement>;
  closeExplicitly: () => void;
  resolveTarget: FocusResolver;
  /** Raw role/layout/context transitions call this; it never changes the surface. */
  invalidate: () => void;
}

export function useMobileWorldReturn({
  surface,
  isDM,
  needsTheMap,
  changeSurface,
}: {
  surface: MobileSurface;
  isDM?: boolean;
  needsTheMap: boolean;
  changeSurface: (next: MobileSurface) => void;
}) {
  const toolsRootRef = useRef<HTMLDivElement>(null);
  const toolsDockButtonRef = useRef<HTMLButtonElement>(null);
  const fromTools = useRef(false);
  const committed = useRef({ surface, isDM, needsTheMap, changeSurface });
  const previous = useRef({ isDM, needsTheMap });
  const invalidate = useCallback(() => {
    fromTools.current = false;
    dismissalFocus.invalidate();
  }, []);

  useLayoutEffect(() => {
    committed.current = { surface, isDM, needsTheMap, changeSurface };
    if (
      previous.current.isDM !== isDM ||
      previous.current.needsTheMap !== needsTheMap ||
      (fromTools.current && surface !== "atlas" && surface !== "tools")
    )
      invalidate();
    previous.current = { isDM, needsTheMap };
  }, [surface, isDM, needsTheMap, changeSurface, invalidate]);
  // This hook survives World/Tools swaps. Its removal is the mobile host leaving.
  useLayoutEffect(() => invalidate, [invalidate]);

  // Called by an already explicit frame dismissal: never invalidate its own ticket.
  const closeExplicitSurface = useCallback(() => {
    fromTools.current = false;
    committed.current.changeSurface("none");
  }, []);
  const adapter = useRef<ReturnType<typeof createMobileWorldReturn> | null>(null);
  if (!adapter.current) {
    adapter.current = createMobileWorldReturn(() => ({
      canRestoreTools: () =>
        fromTools.current && committed.current.isDM === false && !committed.current.needsTheMap,
      // Explicit return bypasses raw navigation's ticket/origin invalidation.
      showTools: () => committed.current.changeSurface("tools"),
      closeRaw: closeExplicitSurface,
      toolsRoot: () => toolsRootRef.current,
      toolsDockButton: () => toolsDockButtonRef.current,
    }));
  }

  const openSurface = useCallback(
    (next: MobileSurface) => {
      invalidate();
      const current = committed.current;
      fromTools.current =
        next === "atlas" &&
        current.surface === "tools" &&
        current.isDM === false &&
        !current.needsTheMap;
      current.changeSurface(next);
    },
    [invalidate],
  );

  const worldReturn: MobileWorldReturnControls = {
    toolsRootRef,
    toolsDockButtonRef,
    closeExplicitly: adapter.current.closeExplicitly,
    resolveTarget: adapter.current.resolveTarget,
    invalidate,
  };
  return { openSurface, worldReturn, closeExplicitSurface };
}
