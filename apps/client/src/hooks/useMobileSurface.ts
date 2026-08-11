// ============================================================================
// MOBILE SURFACE STATE MACHINE
// ============================================================================
// The one owner of "which mobile surface is open" (M4a, mobile-shell-redesign
// §2). Before this hook that state was split across two components with two
// arbitration mechanisms, which is how S8's help sheet ended up mounting
// underneath the tool sheet: a third surface joined a split that only two
// parties knew about.

import { useCallback, useEffect, useRef, useState } from "react";

/** Every surface the mobile shell can present. At most one is open at a time. */
export type MobileSurface = "none" | "party" | "tools" | "dice" | "log" | "help" | "dm";

/** The surfaces whose open state has no App-level home and so lives here. */
type LocalSurface = Exclude<MobileSurface, "dice" | "log">;

export interface UseMobileSurfaceOptions {
  // Dice and Log are prop-controlled at the App level (desktop shares that
  // state), so the machine drives them through their toggles and reads the
  // props back rather than keeping a second copy that could disagree.
  diceRollerOpen: boolean;
  rollLogOpen: boolean;
  toggleDiceRoller: (open: boolean) => void;
  toggleRollLog: (open: boolean) => void;
  // Map-edit is the ORTHOGONAL axis (redesign §1): a Mode re-purposes the dock
  // and never occupies the surface slot. It is already App-level state, so it
  // is passed through, not duplicated.
  mapEditMode: boolean;
}

export interface MobileSurfaceMachine {
  surface: MobileSurface;
  /** Map-edit mode, carried alongside the surface as the orthogonal axis. */
  mode: boolean;
  openSurface: (next: MobileSurface) => void;
  toggleSurface: (next: Exclude<MobileSurface, "none">) => void;
  closeSurface: () => void;
}

export function useMobileSurface(options: UseMobileSurfaceOptions): MobileSurfaceMachine {
  const { diceRollerOpen, rollLogOpen, toggleDiceRoller, toggleRollLog, mapEditMode } = options;
  const [local, setLocal] = useState<LocalSurface>("none");

  // DERIVED, not stored: the prop-controlled panels win, and rendering exactly
  // this value is what makes "at most one surface" true by construction rather
  // than by callbacks remembering to close each other.
  const surface: MobileSurface = rollLogOpen ? "log" : diceRollerOpen ? "dice" : local;

  const openSurface = useCallback(
    (next: MobileSurface) => {
      if (rollLogOpen && next !== "log") toggleRollLog(false);
      if (diceRollerOpen && next !== "dice") toggleDiceRoller(false);
      if (next === "log") {
        if (!rollLogOpen) toggleRollLog(true);
        setLocal("none");
      } else if (next === "dice") {
        if (!diceRollerOpen) toggleDiceRoller(true);
        setLocal("none");
      } else {
        setLocal(next);
      }
    },
    [diceRollerOpen, rollLogOpen, toggleDiceRoller, toggleRollLog],
  );

  const toggleSurface = useCallback(
    (next: Exclude<MobileSurface, "none">) => openSurface(surface === next ? "none" : next),
    [openSurface, surface],
  );

  const closeSurface = useCallback(() => openSurface("none"), [openSurface]);

  // CROSSING THE MODE BOUNDARY CLEARS THE SURFACE.
  //
  // A Mode is defined by the map being fully visible, and the DM arms map-edit
  // FROM the DM screen — a full-height opaque cover. Without this, the mode
  // would arm behind it and the first thing the DM saw would be the menu they
  // were already looking at. Leaving clears too, so Exit never drops you back
  // into a sheet you opened three taps ago.
  //
  // Latched on the EDGE through refs so the effect depends on the mode alone.
  // Depending on closeSurface would re-fire whenever its identity changed —
  // which it does whenever the dice/log props move — and close a sheet the DM
  // had just opened.
  const closeRef = useRef(closeSurface);
  closeRef.current = closeSurface;
  const previousMode = useRef(mapEditMode);
  useEffect(() => {
    if (previousMode.current === mapEditMode) return;
    previousMode.current = mapEditMode;
    closeRef.current();
  }, [mapEditMode]);

  return { surface, mode: mapEditMode, openSurface, toggleSurface, closeSurface };
}
