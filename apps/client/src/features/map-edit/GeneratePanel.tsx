// ============================================================================
// GENERATE PANEL (the dungeon recipe's dials)
// ============================================================================
// Shown while the Generate sub-tool is active: drag a region on the canvas, set
// theme / density / secret-door odds / seed, hit GENERATE. The recipe runs on
// the server and the whole dungeon lands as ONE undo step.
//
// Same seed + same dials = the same dungeon, forever — that contract is why the
// seed is shown rather than hidden, and why ⟳ is an explicit act.

import { JRPGButton } from "../../components/ui/JRPGPanel";
import type { GenerateParams, PopulateDensity } from "./mapEditTypes";

interface GeneratePanelProps {
  params: GenerateParams;
  onChange: (params: GenerateParams) => void;
  onRerollSeed: () => void;
  onGenerate: () => void;
  canGenerate: boolean;
  busy: boolean;
  /** The dragged region in cells, or null before the first drag. */
  region: { cols: number; rows: number } | null;
}

const THEMES: { id: GenerateParams["theme"]; label: string }[] = [
  { id: "stone", label: "🪨 Stone" },
  { id: "wood", label: "🪵 Wood" },
];
const DENSITIES: PopulateDensity[] = ["low", "medium", "high"];
const SECRET_STEPS = [
  { value: 0, label: "None" },
  { value: 0.15, label: "Few" },
  { value: 0.35, label: "Many" },
];

const labelStyle = { display: "block", marginBottom: "4px", color: "var(--jrpg-gold)" } as const;
const cell = { fontSize: "8px", padding: "6px 2px" } as const;

export function GeneratePanel({
  params,
  onChange,
  onRerollSeed,
  onGenerate,
  canGenerate,
  busy,
  region,
}: GeneratePanelProps) {
  return (
    <div data-testid="generate-panel">
      <label className="jrpg-text-small" style={labelStyle}>
        {region ? `Region: ${region.cols} × ${region.rows} cells` : "Drag a region on the map…"}
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
        {THEMES.map((theme) => (
          <JRPGButton
            key={theme.id}
            onClick={() => onChange({ ...params, theme: theme.id })}
            variant={params.theme === theme.id ? "primary" : "default"}
            style={cell}
          >
            {theme.label}
          </JRPGButton>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "4px",
          marginTop: "4px",
        }}
      >
        {DENSITIES.map((density) => (
          <JRPGButton
            key={density}
            onClick={() => onChange({ ...params, density })}
            variant={params.density === density ? "primary" : "default"}
            style={cell}
          >
            {density}
          </JRPGButton>
        ))}
      </div>

      <label className="jrpg-text-small" style={{ ...labelStyle, marginTop: "6px" }}>
        Secret doors:
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
        {SECRET_STEPS.map((step) => (
          <JRPGButton
            key={step.label}
            onClick={() => onChange({ ...params, secretDoorChance: step.value })}
            variant={params.secretDoorChance === step.value ? "primary" : "default"}
            style={cell}
          >
            {step.label}
          </JRPGButton>
        ))}
      </div>

      <label className="jrpg-text-small" style={{ ...labelStyle, marginTop: "6px" }}>
        Seed:
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px" }}>
        <span
          className="jrpg-text-small"
          data-testid="generate-seed"
          title="The same seed and dials always build the same dungeon"
          style={{
            padding: "6px 4px",
            border: "1px solid var(--jrpg-border-outer)",
            color: "var(--jrpg-white)",
            fontSize: "9px",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {params.seed}
        </span>
        <JRPGButton onClick={onRerollSeed} title="Roll a new seed" style={cell}>
          ⟳
        </JRPGButton>
      </div>

      <JRPGButton
        onClick={onGenerate}
        variant="success"
        disabled={!canGenerate}
        title="Build a dungeon in the dragged region — one undo removes all of it"
        style={{ fontSize: "8px", padding: "7px", width: "100%", marginTop: "6px" }}
      >
        {busy ? "⏳ GENERATING…" : "🎲 GENERATE"}
      </JRPGButton>
    </div>
  );
}
