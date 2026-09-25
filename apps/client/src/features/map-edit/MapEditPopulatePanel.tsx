import { JRPGButton } from "../../components/ui/JRPGPanel";
import { decorateLabel } from "./populateTarget";
import type { MapEditToolbarProps, PopulateCategory, PopulateDensity } from "./mapEditTypes";

const categories: PopulateCategory[] = ["objects", "structures", "terrain", "decals"];
const densities: PopulateDensity[] = ["low", "medium", "high"];

export function MapEditPopulatePanel(props: MapEditToolbarProps) {
  return (
    <section aria-label="Decorate the last placed area" className="map-edit-decoration">
      <p className="jrpg-text-small">{props.populateHint}</p>
      {props.populateTarget && (
        <>
          <div className="map-edit-tool-grid">
            {categories.map((category) => (
              <JRPGButton
                key={category}
                variant={props.populateCategory === category ? "primary" : "default"}
                onClick={() => props.onSelectPopulateCategory(category)}
              >
                {category}
              </JRPGButton>
            ))}
          </div>
          <div className="map-edit-density">
            {densities.map((density) => (
              <JRPGButton
                key={density}
                variant={props.populateDensity === density ? "primary" : "default"}
                onClick={() => props.onSelectPopulateDensity(density)}
              >
                {density}
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
