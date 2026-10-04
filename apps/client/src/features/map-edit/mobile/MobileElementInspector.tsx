import type { MapElement, MapLayer } from "@herobyte/shared";
import { ElementPropertiesForm, PropertySaveActions } from "../ElementPropertiesForm";
import type { PropertyView } from "../elementProperties";
import { useRevealMapPanel } from "../useRevealMapPanel";

export function MobileElementInspector({
  element,
  layers,
  open,
  onToggle,
  disabled,
  properties,
}: {
  element: MapElement;
  layers: MapLayer[];
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
  properties: PropertyView;
}) {
  const panelRef = useRevealMapPanel(open);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
        onClick={onToggle}
        data-testid="mobile-inspector-toggle"
      >
        {open ? "▾" : "▸"} Properties{properties.dirty ? " · Unsaved" : ""}
      </button>
      {open ? (
        <div ref={panelRef} className="mobile-tool-sheet__section" data-testid="mobile-inspector">
          <ElementPropertiesForm
            element={element}
            layers={layers}
            properties={properties}
            disabled={disabled}
            mobile
          />
        </div>
      ) : (
        properties.navigation && (
          <PropertySaveActions
            properties={properties}
            disabled={disabled || element.locked}
            mobile
          />
        )
      )}
    </>
  );
}
