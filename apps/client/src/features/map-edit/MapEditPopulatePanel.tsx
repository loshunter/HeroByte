import { useId } from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { decorateLabel } from "./populateTarget";
import type { MapEditToolbarProps } from "./mapEditTypes";
import { POPULATE_CATEGORIES, POPULATE_DENSITIES } from "./populateLabels";

export function MapEditPopulatePanel(props: MapEditToolbarProps) {
  const fromId = useId();
  const amountId = useId();
  return (
    <section aria-label="Decorate the last placed area" className="map-edit-decoration">
      <p className="jrpg-text-small">{props.populateHint}</p>
      {props.populateTarget && (
        <>
          <span id={fromId} className="map-edit-group-label">
            Decorate from
          </span>
          <div className="map-edit-tool-grid" role="group" aria-labelledby={fromId}>
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
          <span id={amountId} className="map-edit-group-label" style={{ marginTop: "4px" }}>
            How much
          </span>
          <div className="map-edit-density" role="group" aria-labelledby={amountId}>
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
