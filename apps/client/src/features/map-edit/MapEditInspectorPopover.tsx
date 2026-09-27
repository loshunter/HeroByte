import type { MapElement, MapLayer } from "@herobyte/shared";
import { ElementPropertiesForm } from "./ElementPropertiesForm";
import type { PropertyView } from "./elementProperties";

export function MapEditInspectorPopover({
  element,
  layers,
  disabled,
  properties,
  onRemove,
}: {
  element: MapElement;
  layers: MapLayer[];
  disabled: boolean;
  properties: PropertyView;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="properties-form">
      <ElementPropertiesForm
        element={element}
        layers={layers}
        properties={properties}
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled || element.locked || properties.pending || properties.uncertain}
        onClick={() => onRemove(element.id)}
      >
        Delete
      </button>
    </div>
  );
}
