import { JRPGButton } from "../../components/ui/JRPGPanel";
import { GeneratePanel } from "./GeneratePanel";
import { MapEditPopulatePanel } from "./MapEditPopulatePanel";
import type { MapEditSplineKind, MapEditToolbarProps } from "./mapEditTypes";

const kinds: MapEditSplineKind[] = ["rope", "chain", "ribbon", "filigree"];

/** Only active-tool settings. Persistent document controls live outside this switch. */
export function MapEditToolPanels(props: MapEditToolbarProps) {
  if (props.activeSubTool === "spline")
    return (
      <div>
        <label className="jrpg-text-small">Curve ({props.splineKind})</label>
        <div className="map-edit-tool-grid">
          {kinds.map((kind) => (
            <JRPGButton
              key={kind}
              variant={props.splineKind === kind ? "primary" : "default"}
              onClick={() => props.onSelectSplineKind(kind)}
            >
              {kind[0].toUpperCase() + kind.slice(1)}
            </JRPGButton>
          ))}
        </div>
      </div>
    );
  if (props.activeSubTool === "generate")
    return (
      <GeneratePanel
        params={props.generateParams}
        onChange={props.onGenerateParamsChange}
        onRerollSeed={props.onRerollSeed}
        onGenerate={props.onGenerate}
        canGenerate={props.canGenerate}
        busy={props.generateFeedback?.status === "pending"}
        feedback={props.generateFeedback}
        region={props.generateRegion}
        hint={props.generateHint}
      />
    );
  if (props.activeSubTool === "room" || props.activeSubTool === "hallway")
    return <MapEditPopulatePanel {...props} />;
  return null;
}
