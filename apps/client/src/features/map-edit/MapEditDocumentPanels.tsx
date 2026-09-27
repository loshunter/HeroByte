import { MapEditLayersPopover } from "./MapEditLayersPopover";
import { MapEditInspectorPopover } from "./MapEditInspectorPopover";
import type { MapEditToolbarProps } from "./mapEditTypes";
import { useRevealMapPanel } from "./useRevealMapPanel";
import { ElementPropertiesSummary, PropertySaveActions } from "./ElementPropertiesForm";

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
      {props.selectedElement && (
        <ElementPropertiesSummary element={props.selectedElement} layers={props.layers} />
      )}
      {!props.inspectorOpen && props.properties?.navigation && (
        <PropertySaveActions properties={props.properties} />
      )}
      {props.inspectorOpen && (
        <div ref={inspectorRef}>
          {props.selectedElement && props.properties ? (
            <MapEditInspectorPopover
              element={props.selectedElement}
              layers={props.layers}
              disabled={props.saving}
              properties={props.properties}
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
