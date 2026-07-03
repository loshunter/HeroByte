import type { KeyboardEvent } from "react";
import type { MapElement, MapElementUpdate, MapLayer } from "@herobyte/shared";

interface UseStudioHotkeysOptions {
  selectedElement?: MapElement;
  layers: Map<string, MapLayer>;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  removeElement: (elementId: string) => void;
  updateElement: (elementId: string, update: MapElementUpdate) => void;
  clearSelection: () => void;
}

/**
 * Canvas hotkeys: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y redo,
 * Delete/Backspace removes the selection, R rotates footprint elements
 * (15-degree steps for stamps, 90 for tiles, Shift reverses). Every path is
 * guarded exactly like its button equivalent.
 */
export function useStudioHotkeys({
  selectedElement,
  layers,
  saving,
  canUndo,
  canRedo,
  undo,
  redo,
  removeElement,
  updateElement,
  clearSelection,
}: UseStudioHotkeysOptions): (event: KeyboardEvent<SVGSVGElement>) => void {
  return (event) => {
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && key === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        if (canRedo && !saving) redo();
      } else if (canUndo && !saving) {
        undo();
      }
      return;
    }
    if (modifier && key === "y") {
      event.preventDefault();
      if (canRedo && !saving) redo();
      return;
    }
    if (key === "delete" || key === "backspace") {
      if (!selectedElement || selectedElement.locked || saving) return;
      if (layers.get(selectedElement.layerId)?.locked) return;
      event.preventDefault();
      removeElement(selectedElement.id);
      clearSelection();
      return;
    }
    if (key !== "r" || modifier) return; // browser reload stays sacred
    if (!selectedElement || selectedElement.locked || saving) return;
    // Only footprint elements rotate; walls/doors carry absolute geometry
    // that an origin rotation would sling across the document.
    if (selectedElement.type !== "stamp" && selectedElement.type !== "tile") return;
    if (layers.get(selectedElement.layerId)?.locked) return;
    // Vision's Shelf spec: grid-snapped elements turn in quarters, free
    // stamps in fifteens; Shift reverses.
    const step = selectedElement.type === "stamp" ? 15 : 90;
    const delta = event.shiftKey ? -step : step;
    event.preventDefault();
    updateElement(selectedElement.id, {
      transform: {
        ...selectedElement.transform,
        rotation: (selectedElement.transform.rotation + delta + 360) % 360,
      },
    });
  };
}
