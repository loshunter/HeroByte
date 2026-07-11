// Live-authoring recompile helpers.
//
// Under live authoring, every document edit recompiles the whole scene from
// the document (compileScene rebuilds walls/doors/lights from authored state).
// That would slam every open door shut, because a door's OPEN/CLOSED/LOCKED
// runtime state lives on the compiled door (mutated in place by the scene
// handler when a player clicks it) and never on the authored document.
//
// preserveDoorRuntimeStates carries each surviving door's runtime state across
// a recompile by element id — EXCEPT the doors the triggering command just
// authored (a newly-added door, or one whose state update-door just changed),
// whose freshly-compiled state must win.

import type { CompiledScene } from "./sceneCompiler.js";
import type { MapDocument } from "./mapStudioTypes.js";
import type { MapStudioCommand } from "./mapStudioCommands.js";

/**
 * Rebuild `next` (a freshly compiled scene) so each door keeps the runtime
 * state it had in `previous`, matched by element id. Doors whose id is in
 * `authoredDoorIds` keep `next`'s authored state instead — that command just
 * set it. Doors absent from `previous` (newly added) keep `next` as-is.
 */
export function preserveDoorRuntimeStates(
  previous: CompiledScene | undefined,
  next: CompiledScene,
  authoredDoorIds: ReadonlySet<string>,
): CompiledScene {
  if (!previous || previous.doors.length === 0) {
    return next;
  }
  const previousById = new Map(previous.doors.map((door) => [door.id, door]));
  return {
    ...next,
    doors: next.doors.map((door) => {
      if (authoredDoorIds.has(door.id)) {
        return door;
      }
      const prior = previousById.get(door.id);
      return prior ? { ...door, state: prior.state } : door;
    }),
  };
}

/**
 * The set of door element ids whose AUTHORED state the given command just
 * established — so preserveDoorRuntimeStates does not overwrite them with a
 * stale runtime state. `update-door` authors one door; `add-element` /
 * `add-elements` author every door among their new elements; every other
 * command (including undo/redo, which restore whole document snapshots) authors
 * no doors and returns an empty set.
 *
 * `document` is the post-apply document; the update-door case confirms the
 * referenced element is genuinely a door before marking it authored.
 */
export function authoredDoorIdsOf(command: MapStudioCommand, document: MapDocument): Set<string> {
  const ids = new Set<string>();
  switch (command.type) {
    case "add-element":
      if (command.element.type === "door") {
        ids.add(command.element.id);
      }
      break;
    case "add-elements":
      for (const element of command.elements) {
        if (element.type === "door") {
          ids.add(element.id);
        }
      }
      break;
    case "update-door": {
      const element = document.elements.find((candidate) => candidate.id === command.elementId);
      if (element?.type === "door") {
        ids.add(command.elementId);
      }
      break;
    }
    default:
      break;
  }
  return ids;
}
