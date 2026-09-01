// ============================================================================
// ATLAS GENERATE PANEL — cash a promise into a dungeon
// ============================================================================
// Mounted per promise-node row behind a toggle. Seed prefills random and ⟳
// reroll re-mints — UI-side nondeterminism is fine, only the recipe is pure
// (the GeneratePanel precedent). Failure surfaces through the atlas-error
// toast; success arrives as the node flipping to ▣ on the next snapshot.

import { useState } from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import type { AtlasActions, AtlasGenerateParams } from "./useAtlasActions";

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

interface AtlasGeneratePanelProps {
  nodeId: string;
  nodeName: string;
  actions: AtlasActions;
}

export function AtlasGeneratePanel({ nodeId, nodeName, actions }: AtlasGeneratePanelProps) {
  const [theme, setTheme] = useState<AtlasGenerateParams["theme"]>("stone");
  const [density, setDensity] = useState<AtlasGenerateParams["density"]>("medium");
  const [size, setSize] = useState<AtlasGenerateParams["size"]>("medium");
  const [seed, setSeed] = useState(randomSeed);

  return (
    <div
      data-testid="atlas-generate-panel"
      style={{
        display: "flex",
        gap: "6px",
        marginTop: "4px",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <select
        aria-label={`Theme for ${nodeName}`}
        value={theme}
        onChange={(event) => setTheme(event.target.value as AtlasGenerateParams["theme"])}
        style={{ fontSize: "10px" }}
      >
        <option value="stone">stone</option>
        <option value="wood">wood</option>
      </select>
      <select
        aria-label={`Density for ${nodeName}`}
        value={density}
        onChange={(event) => setDensity(event.target.value as AtlasGenerateParams["density"])}
        style={{ fontSize: "10px" }}
      >
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
      <select
        aria-label={`Size for ${nodeName}`}
        value={size}
        onChange={(event) => setSize(event.target.value as AtlasGenerateParams["size"])}
        style={{ fontSize: "10px" }}
      >
        <option value="small">small</option>
        <option value="medium">medium</option>
        <option value="large">large</option>
      </select>
      <input
        aria-label={`Seed for ${nodeName}`}
        data-testid="atlas-generate-seed"
        value={seed}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (Number.isInteger(next)) setSeed(next);
        }}
        style={{ fontSize: "10px", width: "90px" }}
      />
      <JRPGButton
        onClick={() => setSeed(randomSeed())}
        style={{ fontSize: "9px", padding: "2px 6px" }}
      >
        ⟳ Reroll
      </JRPGButton>
      <JRPGButton
        variant="primary"
        onClick={() => actions.generateNode(nodeId, seed, { theme, density, size })}
        style={{ fontSize: "9px", padding: "2px 6px" }}
      >
        🎲 GENERATE
      </JRPGButton>
    </div>
  );
}
