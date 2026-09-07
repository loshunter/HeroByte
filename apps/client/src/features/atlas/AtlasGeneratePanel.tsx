// ============================================================================
// ATLAS GENERATE PANEL — cash a promise into a real place
// ============================================================================
// Mounted per promise-node row behind a toggle. Seed prefills random and ⟳
// reroll re-mints — UI-side nondeterminism is fine, only the recipe is pure
// (the GeneratePanel precedent). Failure surfaces through the atlas-error
// toast; success arrives as the node flipping to ▣ on the next snapshot.
//
// The recipe picker is RecipeDials, shared with the kick panel: the two
// surfaces offer the same choice, and two copies of it would drift the moment
// a third recipe lands.

import { useState } from "react";
import type { GenerateRequest } from "@herobyte/shared";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { RecipeDials } from "./RecipeDials";
import type { AtlasActions } from "./useAtlasActions";

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

const DEFAULT_RECIPE: GenerateRequest = {
  recipeId: "dungeon",
  theme: "stone",
  density: "medium",
  size: "medium",
};

interface AtlasGeneratePanelProps {
  nodeId: string;
  nodeName: string;
  actions: AtlasActions;
}

export function AtlasGeneratePanel({ nodeId, nodeName, actions }: AtlasGeneratePanelProps) {
  const [recipe, setRecipe] = useState<GenerateRequest>(DEFAULT_RECIPE);
  const [seed, setSeed] = useState(randomSeed);

  return (
    <div
      data-testid="atlas-generate-panel"
      style={{
        display: "flex",
        gap: "6px",
        marginTop: "4px",
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <RecipeDials recipe={recipe} onChange={setRecipe} labelSuffix={nodeName} />
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
        onClick={() => actions.generateNode(nodeId, seed, recipe)}
        style={{ fontSize: "9px", padding: "2px 6px" }}
      >
        🎲 GENERATE
      </JRPGButton>
    </div>
  );
}
