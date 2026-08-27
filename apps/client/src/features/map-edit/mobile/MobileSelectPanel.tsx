// SELECT on a phone: pick a placed element and delete it.
//
// This is the phone's only route to removing a single element. Before it, a Row
// or Spline laid down on a phone could be created and never taken back — dock
// Undo is a document-wide map-studio undo, not a targeted delete — and the user
// guide had to warn about it.
//
// It needs no new touch machinery, and that is the whole reason this panel is
// small. A tap (unlike a drag) makes the browser synthesize compat mouse
// events; useStageEventRouter binds mousedown UNCONDITIONALLY and every handler
// self-gates on its own mode, so useMapEditTool's select branch already runs on
// a phone the moment activeSubTool is "select". Select is also the one non-drag
// tool that is SAFE that way: the click tools (place/scatter/light) drop two
// stamps per tap because the native-touch path fires too, but for "select" that
// path is inert (useArmedTouchTool arms only when mapEditDragMode, false here),
// so it resolves once — and re-selecting the same element is idempotent anyway.
//
// So this file is a readout and a button. The selection, the hit test, the wire
// command and the server's checks are all the desktop ones, untouched.

import React from "react";
import type { MapElement } from "@herobyte/shared";
import type { MapEditToolbarProps } from "../mapEditTypes";

/** Short, phone-width names for the eight element kinds. The union is closed in
 * shared, so a new kind is a compile error here rather than a blank readout. */
const ELEMENT_LABELS: Record<MapElement["type"], string> = {
  tile: "Floor tile",
  stamp: "Object",
  shape: "Shape",
  wall: "Wall",
  door: "Door",
  light: "Light",
  text: "Text",
  spline: "Curve",
};

export function MobileSelectPanel({
  selectedElement,
  onRemoveElement,
}: MapEditToolbarProps): JSX.Element {
  // Falsy, not `=== null`: selectedElement is absent from partial toolbar bags
  // in tests, and an undefined element must read as "nothing picked" rather
  // than crash the readout.
  const element = selectedElement ?? null;

  // Locked is refused SERVER-side (removeMapElement throws before the filter),
  // so desktop's always-enabled DELETE round-trips a locked element to an error
  // toast. Saying so up front is cheaper than a toast the DM has to read.
  const locked = element?.locked === true;

  return (
    <div className="mobile-tool-sheet__section" data-testid="mobile-select">
      <span className="mobile-tool-sheet__label">👆 Select</span>
      <p className="mobile-tool-sheet__note" data-testid="mobile-select-status">
        {!element
          ? "Tap an element on the map to pick it."
          : locked
            ? `${ELEMENT_LABELS[element.type]} — locked, unlock it on a desktop to delete.`
            : `${ELEMENT_LABELS[element.type]} picked.`}
      </p>

      <button
        type="button"
        className="mobile-tool-sheet__button mobile-tool-sheet__button--wide mobile-tool-sheet__button--danger"
        onClick={() => element && onRemoveElement(element.id)}
        disabled={!element || locked}
        data-testid="mobile-select-delete"
      >
        🗑 Delete
      </button>
    </div>
  );
}
