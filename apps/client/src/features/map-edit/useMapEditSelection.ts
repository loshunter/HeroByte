// ============================================================================
// MAP-EDIT SELECTION + EYEDROPPER
// ============================================================================
// The "select" sub-tool and the Ctrl/Cmd-click eyedropper, composed by
// useMapEditTool. handleClick consumes a pointer-down when it is a selection
// (select tool) or a sample (Ctrl held over place/scatter/terrain) — returning
// true so the tool skips its normal placement/paint. selectionRect is the
// highlight footprint the preview draws around the current selection.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapDocument } from "@herobyte/shared";
import { sampleAssetAtPoint } from "../map-studio/components/mapStudioWorkspaceUtils";
import { elementSelectionRect, selectElementAtPoint, type SelectionRect } from "./elementHitTest";
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
  onSampleAsset: (assetId: string) => void;
}

interface UseMapEditSelectionReturn {
  selectionRect: SelectionRect | null;
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
      if (ctrlHeld && SAMPLEABLE.includes(subTool)) {
        const sampled = sampleAssetAtPoint(document, layers, point);
        if (sampled) onSampleAsset(sampled);
        return true; // Ctrl held = intent to sample, never place
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

  const selectionRect = useMemo(() => {
    if (!document || !selectedElementId) return null;
    const element = document.elements.find((candidate) => candidate.id === selectedElementId);
    return element ? elementSelectionRect(element, document.grid.size) : null;
  }, [document, selectedElementId]);

  return { selectionRect, handleClick };
}
