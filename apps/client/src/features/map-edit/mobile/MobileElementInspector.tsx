// Editing the element you just picked, with a finger.
//
// The desktop MapEditInspectorPopover is five numeric spinners, a select and a
// checkbox in a 1fr 1fr grid at 9px type. Every one of those is a legitimate
// control at a mouse and a bad one on glass: a `type="number"` field on a phone
// summons the keyboard over the map, and the DM is typing an absolute pixel
// coordinate for a thing they can see.
//
// So this is the same COMMANDS through relative controls. Turn by 15°, resize
// by 10%, both aimed at "that crate is facing the wrong way", which is what a
// DM actually wants mid-session. It batches into ONE update-element on APPLY,
// exactly as the desktop does — the controller queues commands one-in-flight,
// so per-tap commands would each round-trip, re-parse the document, and land
// as an undo entry of their own on a phone's latency.
//
// DELIBERATELY ABSENT: X/Y and non-uniform scale. Nudging by an arbitrary
// number of pixels is not a control anyone wants, a cell-sized nudge would need
// the document grid this bag does not carry, and the phone already has an exact
// answer for "it is in the wrong place" — delete it and place it again, which
// is two taps. Door WIDTH is absent for the same reason; door STATE is here
// because it is a live-play control, not an authoring one.
//
// It is a DISCLOSURE, closed by default. The Select panel is open while the DM
// taps the map, and the sheet is bottom-anchored — every row it grows is map
// they can no longer reach (see mobile-map-edit-panels.spec.ts). Picking a
// thing to delete it is the common case and costs one row; editing costs a tap.

import React, { useEffect, useRef, useState } from "react";
import type { MapDoorState, MapElement, MapLayer } from "@herobyte/shared";
import { STAMP_ROTATION_STEP } from "../usePlacementDials";
import { MobileSwatchRow } from "./MobileSwatchRow";

/** One notch of resize. Coarser than the desktop's 0.05 on purpose: a finger
 * taps a step at a time, and 5% is invisible until you have done it four
 * times. */
const SCALE_STEP = 0.1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

const DOOR_STATES: { id: MapDoorState; label: string }[] = [
  { id: "closed", label: "Closed" },
  { id: "open", label: "Open" },
  { id: "locked", label: "Locked" },
  { id: "secret", label: "Secret" },
];

interface MobileElementInspectorProps {
  element: MapElement;
  layers: MapLayer[];
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
  onUpdate: (
    elementId: string,
    update: { transform: MapElement["transform"]; layerId: string; hidden: boolean },
  ) => void;
  onUpdateDoor: (elementId: string, update: { state: MapDoorState; width: number }) => void;
}

export function MobileElementInspector({
  element,
  layers,
  open,
  onToggle,
  disabled,
  onUpdate,
  onUpdateDoor,
}: MobileElementInspectorProps): JSX.Element {
  const [transform, setTransform] = useState(element.transform);
  const [layerId, setLayerId] = useState(element.layerId);
  const [hidden, setHidden] = useState(element.hidden);
  const [doorState, setDoorState] = useState<MapDoorState>(
    element.type === "door" ? element.data.state : "closed",
  );

  // True while the DM has staged edits that Apply has not sent. A REF, not
  // state: the draft setters already re-render, and making it state would put
  // it in the effect's deps, where clearing it re-seeds from the PRE-ack prop
  // and flashes the server's old numbers for a round trip.
  const dirtyRef = useRef(false);
  const seededId = useRef(element.id);

  // Re-seed whenever a DIFFERENT element is picked, or the one in hand comes
  // back changed from the server AND nothing is staged. Every applied command
  // re-parses the whole document, so the SAME element returns as a NEW object
  // on every ack — re-seeding on identity alone wiped un-applied edits, and
  // the Door row's own on-the-spot command was enough to trigger it.
  useEffect(() => {
    if (element.id === seededId.current && dirtyRef.current) return;
    seededId.current = element.id;
    dirtyRef.current = false;
    setTransform(element.transform);
    setLayerId(element.layerId);
    setHidden(element.hidden);
    if (element.type === "door") setDoorState(element.data.state);
  }, [element]);

  const rotate = (steps: number) => {
    dirtyRef.current = true;
    setTransform((current) => ({
      ...current,
      rotation: (current.rotation + steps * STAMP_ROTATION_STEP + 360) % 360,
    }));
  };

  // Uniform, and the clamp is per-axis so an element that arrived stretched
  // stays stretched rather than being silently squared up by the first tap.
  const resize = (steps: number) => {
    dirtyRef.current = true;
    setTransform((current) => ({
      ...current,
      scaleX: clampScale(current.scaleX + steps * SCALE_STEP),
      scaleY: clampScale(current.scaleY + steps * SCALE_STEP),
    }));
  };

  const percent = Math.round(transform.scaleX * 100);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
        onClick={onToggle}
        data-testid="mobile-inspector-toggle"
      >
        {open ? "▾" : "▸"} ✎ Edit
      </button>

      {open && (
        <div className="mobile-tool-sheet__section" data-testid="mobile-inspector">
          <span className="mobile-tool-sheet__label">
            Rotation — {Math.round(transform.rotation)}° · Size — {percent}%
          </span>
          <div className="mobile-tool-sheet__grid">
            <button
              type="button"
              className="mobile-tool-sheet__button"
              onClick={() => rotate(-1)}
              aria-label="Turn element counter-clockwise"
            >
              <span aria-hidden="true">↺</span>-15°
            </button>
            <button
              type="button"
              className="mobile-tool-sheet__button"
              onClick={() => rotate(1)}
              aria-label="Turn element clockwise"
            >
              <span aria-hidden="true">↻</span>+15°
            </button>
            <button
              type="button"
              className="mobile-tool-sheet__button"
              onClick={() => resize(-1)}
              aria-label="Shrink element"
            >
              <span aria-hidden="true">−</span>Smaller
            </button>
            <button
              type="button"
              className="mobile-tool-sheet__button"
              onClick={() => resize(1)}
              aria-label="Grow element"
            >
              <span aria-hidden="true">+</span>Bigger
            </button>
          </div>

          <span className="mobile-tool-sheet__label">Layer</span>
          <select
            aria-label="Element layer"
            className="mobile-tool-sheet__select"
            value={layerId}
            onChange={(event) => {
              dirtyRef.current = true;
              setLayerId(event.target.value);
            }}
          >
            {layers
              .filter((layer) => !layer.locked || layer.id === element.layerId)
              .map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
          </select>

          <button
            type="button"
            aria-pressed={hidden}
            className={`mobile-tool-sheet__button mobile-tool-sheet__button--wide${
              hidden ? " mobile-tool-sheet__button--active" : ""
            }`}
            onClick={() => {
              dirtyRef.current = true;
              setHidden((current) => !current);
            }}
          >
            {hidden ? "🙈 Hidden from players" : "👁 Visible to players"}
          </button>

          {element.type === "door" && (
            <MobileSwatchRow
              label="Door"
              options={DOOR_STATES}
              selected={doorState}
              onSelect={(state) => {
                setDoorState(state);
                // Doors apply on the spot rather than waiting for APPLY: a door
                // is opened DURING play, and making the DM press a second
                // button to swing it is a beat of table time for nothing. It is
                // also its own command on the desktop, so this changes no
                // contract — only how many presses it takes.
                onUpdateDoor(element.id, { state, width: element.data.width });
              }}
            />
          )}

          <button
            type="button"
            className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
            disabled={disabled}
            onClick={() => {
              // Applied means the server owns the values again: the ack's
              // fresh object may re-seed the panel from then on.
              dirtyRef.current = false;
              onUpdate(element.id, { transform, layerId, hidden });
            }}
            data-testid="mobile-inspector-apply"
          >
            ✓ Apply
          </button>
        </div>
      )}
    </>
  );
}

function clampScale(value: number): number {
  // Rounded because 0.1 steps accumulate float dust (1.0000000000000002), and
  // the readout would start showing 100% for a value that is not 1.
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(value * 100) / 100));
}
