// ============================================================================
// TOKEN CREATOR — WHAT EACH ACCEPT SAYS (C5a)
// ============================================================================
// Each tab's Accept takes the other tab's unsaved work along (a frame picked
// goes with a picture once the picture is on the token), so each label names
// everything it will set. While a picture loads, bakes or uploads, both say so.

import type { CreatorPhase } from "./useTokenCreator";

export const PHASE_LABEL: Record<CreatorPhase, string> = {
  idle: "Use this picture",
  loading: "Loading…",
  baking: "Baking…",
  uploading: "Uploading…",
};

export interface AcceptState {
  phase: CreatorPhase;
  /** A picture is loaded and not yet saved. */
  hasPicture: boolean;
  /** The frame picked on the Frame tab (null: none). */
  hasFrame: boolean;
  /** The frame picked differs from the one the token wears. */
  frameChanged: boolean;
}

export function acceptLabels({ phase, hasPicture, hasFrame, frameChanged }: AcceptState) {
  if (phase !== "idle") return { picture: PHASE_LABEL[phase], frame: PHASE_LABEL[phase] };
  const both = hasFrame ? "Use picture + frame" : "Use picture, no frame";
  return {
    picture: frameChanged ? both : PHASE_LABEL.idle,
    frame: hasPicture
      ? hasFrame
        ? "Use frame + picture"
        : "Use picture, no frame"
      : hasFrame
        ? "Use this frame"
        : "Use no frame",
  };
}
