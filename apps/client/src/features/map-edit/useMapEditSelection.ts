// ============================================================================
// MAP-EDIT SELECTION + EYEDROPPER
// ============================================================================
// The "select" sub-tool and the eyedropper, composed by useMapEditTool.
// handleClick consumes a pointer-down when it is a selection (select tool) or a
// sample — returning true so the tool skips its normal placement/paint.
// selectionShape is the highlight footprint the preview draws around the
// current selection.
//
// The eyedropper has TWO ways in since M7. Ctrl/Cmd held over place, scatter or
// terrain is the desktop shortcut and is staying: it samples without giving up
// the tool you are holding, which is the whole point at a mouse. It is also a
// sub-tool of its own now, because a phone has no Ctrl and the shortcut left
// sampling unreachable on the surface this arc exists for. Both land on the
// same branch, so they cannot drift.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapDocument } from "@herobyte/shared";
import { sampleAssetAtPoint } from "../map-studio/components/mapStudioWorkspaceUtils";
import { elementSelectionShape, selectElementAtPoint, type SelectionShape } from "./elementHitTest";
import type { MapEditSubTool } from "./mapEditTypes";

const SAMPLEABLE: MapEditSubTool[] = ["place", "scatter", "terrain"];

interface UseMapEditSelectionOptions {
  /** map-edit mode is on (tracks Ctrl only while authoring). */
  active: boolean;
  /** The live-bound active document, or null. */
  document: MapDocument | null;
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
  /** Re-arm the place tool with an eyedropper-sampled asset id. */
  onSampleAsset: (assetId: string, source: "tool" | "shortcut") => void;
}

interface UseMapEditSelectionReturn {
  selectionShape: SelectionShape | null;
  /** Consume a pointer-down as a select/sample; returns true when it did. */
  handleClick: (point: { x: number; y: number }, subTool: MapEditSubTool) => boolean;
}

export function useMapEditSelection({
  active,
  document,
  selectedElementId,
  onSelectElement,
  onSampleAsset,
}: UseMapEditSelectionOptions): UseMapEditSelectionReturn {
  const [ctrlHeld, setCtrlHeld] = useState(false);

  useEffect(() => {
    if (!active) {
      setCtrlHeld(false);
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Control" || event.key === "Meta") setCtrlHeld(event.type === "keydown");
    };
    const onBlur = () => setCtrlHeld(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [active]);

  const layers = useMemo(
    () => new Map((document?.layers ?? []).map((layer) => [layer.id, layer])),
    [document?.layers],
  );

  const handleClick = useCallback(
    (point: { x: number; y: number }, subTool: MapEditSubTool): boolean => {
      if (!document) return false;
      const sampling = subTool === "eyedropper" || (ctrlHeld && SAMPLEABLE.includes(subTool));
      if (sampling) {
        const sampled = sampleAssetAtPoint(document, layers, point);
        // Same branch, different hand-back: the TOOL re-arms Place, the Ctrl
        // shortcut keeps whatever the DM is holding.
        if (sampled) onSampleAsset(sampled, subTool === "eyedropper" ? "tool" : "shortcut");
        // True either way. A miss must still CONSUME the press: falling through
        // would place a crate where the DM was pointing at empty floor, which
        // is the opposite of what they asked for.
        return true;
      }
      if (subTool === "select") {
        const element = selectElementAtPoint(document, layers, point);
        onSelectElement(element?.id ?? null);
        return true;
      }
      return false;
    },
    [document, layers, ctrlHeld, onSampleAsset, onSelectElement],
  );

  const selectionShape = useMemo(() => {
    if (!document || !selectedElementId) return null;
    const element = document.elements.find((candidate) => candidate.id === selectedElementId);
    return element ? elementSelectionShape(element, document.grid.size) : null;
  }, [document, selectedElementId]);

  return { selectionShape, handleClick };
}
