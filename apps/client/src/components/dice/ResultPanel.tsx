import type { EscapeRoot } from "../../features/interaction/escapeTypes";
// ============================================================================
// RESULT PANEL - SNES-style breakdown window
// ============================================================================

import React from "react";
import type { RollResult } from "./types";
import { DraggableWindow } from "./DraggableWindow";
import { RollResultContent } from "./RollResultContent";

interface ResultPanelProps {
  result: RollResult | null;
  containingRoot?: EscapeRoot;
  onClose: () => void;
  /** Rewrite this roll with what was actually thrown. Absent hides the control. */
  onEnterRoll?: (total: number) => void;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({
  result,
  onClose,
  onEnterRoll,
  containingRoot,
}) => {
  if (!result) return null;

  return (
    <DraggableWindow
      title="⚂ ROLL RESULT ⚂"
      onClose={onClose}
      interaction={{ behavior: "block", containingRoot }}
      initialX={200}
      initialY={150}
      width={500}
      minWidth={400}
      maxWidth={600}
      zIndex={1001}
    >
      <RollResultContent result={result} onEnterRoll={onEnterRoll} />
    </DraggableWindow>
  );
};
