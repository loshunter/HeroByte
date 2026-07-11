// Live-authoring recompile helpers.
//
// Under live authoring, every document edit recompiles the whole scene from
// the document (compileScene rebuilds walls/doors/lights from authored state).
// That would slam every open door shut, because a door's OPEN/CLOSED/LOCKED
// runtime state lives on the compiled door (mutated in place by the scene
// handler when a player clicks it) and never on the authored document.
//
// preserveDoorRuntimeStates carries each surviving door's runtime state across
// a recompile, keyed on element id — but ONLY while that door's AUTHORED state
// is unchanged by the edit. If the triggering edit re-authored the door's state
// (a DM update-door, or an undo/redo that reverted an earlier state change), the
// freshly compiled authored state must win. Comparing authored-before against
// authored-after is what distinguishes "the DM changed this door" from "a player
// toggled it at runtime and an unrelated edit must not undo that". It is also
// leak-safe: undoing a door back to "secret" restores the disguise, because the
// authored state changed and the stale non-secret runtime state is discarded.

import type { CompiledDoorState, CompiledScene } from "./sceneCompiler.js";
import type { MapDocument } from "./mapStudioTypes.js";

/**
 * Rebuild `next` (a freshly compiled scene, whose door states are the authored
 * states) so each door keeps the runtime state it held in `previous` — but only
 * when this door's authored state is unchanged. `previousAuthoredDoorStates`
 * maps door element id -> the authored state in the document BEFORE the edit;
 * when it differs from `next`'s (post-edit authored) state, the edit re-authored
 * the door and the new authored state wins. New doors and doors absent from
 * `previous` keep `next` as-is.
 */
export function preserveDoorRuntimeStates(
  previous: CompiledScene | undefined,
  next: CompiledScene,
  previousAuthoredDoorStates: ReadonlyMap<string, CompiledDoorState>,
): CompiledScene {
  // Cross-document guard: door element ids are only unique WITHIN a document
  // (import/duplicate round-trips them). Only carry runtime states when the
  // previous scene was compiled from the SAME document — a scene left behind by
  // a stray publish of another document must never graft its door states (which
  // could resurrect a secret door as a visible one) onto this one.
  if (
    !previous ||
    previous.doors.length === 0 ||
    previous.sourceDocumentId !== next.sourceDocumentId
  ) {
    return next;
  }
  const previousRuntimeById = new Map(previous.doors.map((door) => [door.id, door.state]));
  return {
    ...next,
    doors: next.doors.map((door) => {
      const priorRuntime = previousRuntimeById.get(door.id);
      const priorAuthored = previousAuthoredDoorStates.get(door.id);
      // door.state is the freshly compiled AUTHORED state. Preserve the runtime
      // deviation only if the authored state did not change across the edit.
      if (priorRuntime !== undefined && priorAuthored === door.state) {
        return { ...door, state: priorRuntime };
      }
      return door;
    }),
  };
}

/**
 * The authored state of every door element in a document, keyed by element id.
 * Captured from the pre-edit document so preserveDoorRuntimeStates can tell
 * whether an edit re-authored a door's state. Hidden doors are included (they
 * are simply never looked up, since a hidden door is not compiled into a scene).
 */
export function authoredDoorStatesOf(document: MapDocument): Map<string, CompiledDoorState> {
  const states = new Map<string, CompiledDoorState>();
  for (const element of document.elements) {
    if (element.type === "door") {
      states.set(element.id, element.data.state);
    }
  }
  return states;
}
