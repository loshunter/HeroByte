// Generate's dials and target region are local drafts. Only its own acknowledged
// operation records a successful recipe; queue-wide saving cannot establish that.
import { useCallback, useEffect, useRef, useState } from "react";
import type { MapStudioController } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import type { GenerateParams, MapEditSubTool } from "./mapEditTypes";
import {
  describeGenerateRegion,
  toGenerateCellBounds,
  type GenerateCellBounds,
  type GenerateRegionDescriptor,
} from "./generateRegion";
import { useGenerateOutcome, type GenerateFeedback } from "./useGenerateOutcome";

const ALREADY_BUILT = "Built here already — reroll the seed or change a dial to build again.";
interface Target {
  documentId: string;
  cells: GenerateCellBounds;
}
export interface UseGenerateReturn {
  params: GenerateParams;
  setParams: (params: GenerateParams) => void;
  rerollSeed: () => void;
  onRegionDragged: (bounds: RoomBounds) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  hint: string | null;
  region: { cols: number; rows: number } | null;
  preview: GenerateRegionDescriptor | null;
  feedback: GenerateFeedback;
}

export function useGenerate(
  controller: MapStudioController,
  isLive: boolean,
  subTool: MapEditSubTool,
  mapEditMode: boolean,
  notifyError?: (message: string) => void,
): UseGenerateReturn {
  const armed = mapEditMode && subTool === "generate";
  const [params, setParams] = useState<GenerateParams>({
    theme: "stone",
    density: "medium",
    seed: freshSeed(),
  });
  const [target, setTarget] = useState<Target | null>(null);
  const document = controller.activeDocument;
  const documentId = document?.id;
  useEffect(() => {
    setTarget(null);
  }, [documentId]);
  useEffect(() => {
    if (!armed) setTarget(null);
  }, [armed]);
  // Guard during render too: a document change must never briefly expose A's aim on B.
  const bounds = armed && target?.documentId === documentId ? (target?.cells ?? null) : null;
  const preview = document && bounds ? describeGenerateRegion(document, bounds) : null;
  const problem = preview?.problem?.reason ?? null;
  const outcome = useGenerateOutcome(controller);
  const recipeKey = bounds ? JSON.stringify([documentId, bounds, params]) : null;
  const currentScope = useRef({ recipeKey, armed, isLive });
  currentScope.current = { recipeKey, armed, isLive };
  const alreadyBuilt = outcome.alreadyBuilt(recipeKey);
  const onRegionDragged = useCallback(
    (dragged: RoomBounds) => {
      if (document)
        setTarget({ documentId: document.id, cells: toGenerateCellBounds(dragged, document.grid) });
    },
    [document],
  );
  const rerollSeed = useCallback(
    () => setParams((current) => ({ ...current, seed: freshSeed() })),
    [],
  );
  const onGenerate = () => {
    if (
      currentScope.current.recipeKey !== recipeKey ||
      !currentScope.current.armed ||
      !currentScope.current.isLive ||
      !armed ||
      !bounds ||
      !recipeKey ||
      !isLive ||
      controller.saving ||
      outcome.pending ||
      outcome.uncertain
    )
      return;
    if (problem || alreadyBuilt) {
      notifyError?.(problem ?? ALREADY_BUILT);
      return;
    }
    outcome.submit(recipeKey, {
      recipe: "dungeon",
      seed: params.seed,
      bounds: { ...bounds },
      params: { theme: params.theme, density: params.density },
    });
  };
  return {
    params,
    setParams,
    rerollSeed,
    onRegionDragged,
    onGenerate,
    canGenerate:
      Boolean(bounds) &&
      isLive &&
      !controller.saving &&
      !outcome.pending &&
      !outcome.uncertain &&
      !problem &&
      !alreadyBuilt,
    hint:
      problem ??
      (alreadyBuilt ? ALREADY_BUILT : outcome.reason) ??
      (controller.saving ? "Waiting for the current map edit to finish." : null),
    region: bounds ? { cols: bounds.cols, rows: bounds.rows } : null,
    preview: armed && isLive ? preview : null,
    feedback: outcome.feedback,
  };
}

function freshSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0]! | 0;
}
