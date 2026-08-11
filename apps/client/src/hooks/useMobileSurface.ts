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
export type MobileSurface = "none" | "party" | "tools" | "dice" | "log" | "help" | "dm" | "props";

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
  // Alignment is not a Mode — it keeps the ordinary dock, because its controls
  // live in the DM menu you come back to. But it shares the one property that
  // matters here: capturing a point needs the MAP, and it is armed from a
  // full-height screen. So it joins the same edge.
  alignmentMode: boolean;
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
  // The two modes that need the canvas, as one fact. They are separate props
  // because only map-edit re-purposes the dock.
  const needsTheMap = mapEditMode || options.alignmentMode;
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

  // WHEN THE SURFACE IS CLEARED, and it is not one edge and its inverse.
  //
  // ANY CHANGE TO MAP-EDIT clears. Entering, because the mode is defined by
  // the map being fully visible and it is armed FROM the DM screen — a
  // full-height opaque cover, so without this the mode arms behind the menu
  // the DM is still looking at. Leaving, because the only sheet reachable in
  // the mode is the mode's own, and its contents (Room, Wall, Start live map)
  // are meaningless outside it — left open, Exit would swap in the ordinary
  // tool grid nobody asked for.
  //
  // ARMING ALIGNMENT clears too. It is not a Mode — it keeps the ordinary
  // dock, because its controls live in the DM menu you come back to — but
  // capturing a point needs the map just as much.
  //
  // DISARMING ALIGNMENT deliberately does not: its Cancel lives inside the DM
  // menu, and closing the menu out from under the DM who just pressed it would
  // be the machine picking a fight.
  //
  // The two conditions are separate because `needsTheMap` alone cannot see
  // map-edit arming while alignment is ALREADY armed — the OR is true both
  // before and after, so there is no rising edge, and the DM screen would sit
  // over the canvas with the palette live underneath it.
  //
  // Latched through refs so the effect depends on the modes alone. Depending
  // on closeSurface would re-fire whenever its identity changed — which it
  // does whenever the dice/log props move — and close a sheet just opened.
  const closeRef = useRef(closeSurface);
  closeRef.current = closeSurface;
  const previousNeed = useRef(needsTheMap);
  const previousMapEdit = useRef(mapEditMode);
  useEffect(() => {
    const armedSomething = needsTheMap && !previousNeed.current;
    const modeChanged = mapEditMode !== previousMapEdit.current;
    previousNeed.current = needsTheMap;
    previousMapEdit.current = mapEditMode;
    if (armedSomething || modeChanged) closeRef.current();
  }, [needsTheMap, mapEditMode]);

  return { surface, mode: mapEditMode, openSurface, toggleSurface, closeSurface };
}
