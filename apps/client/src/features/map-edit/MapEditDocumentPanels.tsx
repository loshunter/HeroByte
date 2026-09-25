import { MapEditLayersPopover } from "./MapEditLayersPopover";
import { MapEditInspectorPopover } from "./MapEditInspectorPopover";
import type { MapEditToolbarProps } from "./mapEditTypes";
import { useRevealMapPanel } from "./useRevealMapPanel";

/** Document panels are independent of which authoring tool is active. */
export function MapEditDocumentPanels(props: MapEditToolbarProps) {
  const layersRef = useRevealMapPanel(props.layersOpen);
  const inspectorRef = useRevealMapPanel(props.inspectorOpen);
  return (
    <>
      {props.layersOpen && (
        <div ref={layersRef}>
          <MapEditLayersPopover
            layers={props.layers}
            saving={props.saving}
            onUpdateLayer={props.onUpdateLayer}
            onMoveLayer={props.onMoveLayer}
          />
        </div>
      )}
      {props.inspectorOpen && (
        <div ref={inspectorRef}>
          {props.selectedElement ? (
            <MapEditInspectorPopover
              element={props.selectedElement}
              layers={props.layers}
              disabled={props.saving}
              onUpdate={props.onUpdateElement}
              onUpdateDoor={props.onUpdateDoor}
              onRemove={props.onRemoveElement}
            />
          ) : (
            <p className="jrpg-text-small">Choose Select, then click an element to inspect it.</p>
          )}
        </div>
      )}
    </>
  );
}
