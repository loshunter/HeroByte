import { JRPGButton } from "../../components/ui/JRPGPanel";
import { decorateLabel } from "./populateTarget";
import type { MapEditToolbarProps } from "./mapEditTypes";
import { POPULATE_CATEGORIES, POPULATE_DENSITIES } from "./populateLabels";

export function MapEditPopulatePanel(props: MapEditToolbarProps) {
  return (
    <section aria-label="Decorate the last placed area" className="map-edit-decoration">
      <p className="jrpg-text-small">{props.populateHint}</p>
      {props.populateTarget && (
        <>
          <div className="map-edit-tool-grid" role="group" aria-label="Decorate from">
            {POPULATE_CATEGORIES.map(({ id, label }) => (
              <JRPGButton
                key={id}
                variant={props.populateCategory === id ? "primary" : "default"}
                aria-pressed={props.populateCategory === id}
                onClick={() => props.onSelectPopulateCategory(id)}
              >
                {label}
              </JRPGButton>
            ))}
          </div>
          <div className="map-edit-density" role="group" aria-label="How much">
            {POPULATE_DENSITIES.map(({ id, label }) => (
              <JRPGButton
                key={id}
                variant={props.populateDensity === id ? "primary" : "default"}
                aria-pressed={props.populateDensity === id}
                onClick={() => props.onSelectPopulateDensity(id)}
              >
                {label}
              </JRPGButton>
            ))}
          </div>
        </>
      )}
      <JRPGButton
        onClick={props.onPopulate}
        disabled={!props.canPopulate}
        variant="success"
        className="map-edit-decoration__fire"
      >
        ✨ {decorateLabel(props.populateTarget)}
      </JRPGButton>
    </section>
  );
}
