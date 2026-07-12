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
import type {
  MapDocument,
  MapElement,
  MapElementsSnapshot,
  RenderableMapElement,
} from "./mapStudioTypes.js";

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

/**
 * Derive the player-safe scenery (tiles/stamps/shapes/visible text) from a
 * live-bound document, ready to attach to EVERY recipient's snapshot. This is a
 * hard privacy contract — nothing a player must not see may survive it — and it
 * is the OPPOSITE of the compiler's visibility rule (which ignores layer
 * visibility for blocking geometry): here an invisible layer renders NOTHING.
 *
 * Excluded, each with an adversarial test:
 * - `element.hidden`
 * - every element on a layer with `visible === false`
 * - every element on a layer of kind `"notes"` (GM-only)
 * - `text` with `data.visibleToPlayers === false`
 * - `wall` / `door` / `light` kinds (walls are DM-overlay + blocking; doors ride
 *   compiledScene; lights don't render at the table yet)
 *
 * Emits only non-empty layers, in `zIndex` order, each carrying its `opacity`;
 * deep-cloned so a later document edit can't mutate a broadcast payload through
 * a shared reference. Returns undefined when nothing is visible.
 */
export function deriveMapElements(document: MapDocument): MapElementsSnapshot | undefined {
  const layersById = new Map(document.layers.map((layer) => [layer.id, layer]));
  const byLayer = new Map<string, RenderableMapElement[]>();
  for (const element of document.elements) {
    if (element.hidden) continue;
    const layer = layersById.get(element.layerId);
    if (!layer || !layer.visible || layer.kind === "notes") continue;
    const renderable = toRenderable(element);
    if (!renderable) continue; // wall/door/light, or player-private text
    const bucket = byLayer.get(layer.id);
    if (bucket) bucket.push(renderable);
    else byLayer.set(layer.id, [renderable]);
  }

  const layers = document.layers
    .filter((layer) => byLayer.has(layer.id))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((layer) => ({ opacity: layer.opacity, elements: byLayer.get(layer.id)! }));
  if (layers.length === 0) return undefined;

  return structuredClone({
    grid: {
      size: document.grid.size,
      offsetX: document.grid.offsetX,
      offsetY: document.grid.offsetY,
    },
    layers,
  });
}

/** Narrow one authored element to its player-safe render form, or null when the
 * kind never renders at the table (wall/door/light) or the text is GM-private.
 * The `data` reference is shared here; deriveMapElements deep-clones the result. */
function toRenderable(element: MapElement): RenderableMapElement | null {
  switch (element.type) {
    case "tile":
      return { id: element.id, type: "tile", transform: element.transform, data: element.data };
    case "stamp":
      return { id: element.id, type: "stamp", transform: element.transform, data: element.data };
    case "shape":
      return { id: element.id, type: "shape", transform: element.transform, data: element.data };
    case "text":
      if (!element.data.visibleToPlayers) return null;
      return {
        id: element.id,
        type: "text",
        transform: element.transform,
        data: {
          text: element.data.text,
          color: element.data.color,
          fontSize: element.data.fontSize,
        },
      };
    default:
      return null; // wall / door / light — never scenery at the table
  }
}
