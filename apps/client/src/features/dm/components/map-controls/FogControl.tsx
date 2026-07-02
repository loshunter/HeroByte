// ============================================================================
// FOG CONTROL
// ============================================================================
// DM toggle for fog of war. Fog hides the published scene beyond player
// token sightlines, computed from the compiled walls and doors, so it only
// has an effect once a Map Studio document has been published.

import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";

export interface FogControlProps {
  fogEnabled: boolean;
  /** Fog needs compiled geometry; without it the toggle explains itself. */
  hasCompiledScene: boolean;
  onFogEnabledChange: (enabled: boolean) => void;
}

export function FogControl({ fogEnabled, hasCompiledScene, onFogEnabledChange }: FogControlProps) {
  return (
    <JRPGPanel variant="simple" title="Fog of War" style={{ padding: "12px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <JRPGButton
          onClick={() => onFogEnabledChange(!fogEnabled)}
          variant={fogEnabled ? "primary" : "default"}
          style={{ fontSize: "11px", fontWeight: "bold", padding: "8px" }}
        >
          {fogEnabled ? "🌫 FOG ENABLED" : "☀ FOG DISABLED"}
        </JRPGButton>
        <span style={{ fontSize: "10px", opacity: 0.8, lineHeight: 1.3, display: "block" }}>
          {hasCompiledScene
            ? "Players see only what their tokens can see. Walls and closed doors block sight."
            : "Publish a Map Studio map first — fog uses its compiled walls and doors."}
        </span>
      </div>
    </JRPGPanel>
  );
}
