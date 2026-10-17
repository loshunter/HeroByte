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

/** Each tab's button and its title; a frame is named only when it would change. */
export function acceptLabels({ phase, hasPicture, hasFrame, frameChanged }: AcceptState) {
  const withFrame = hasFrame ? ", and set the frame picked" : ", and take the frame off";
  const pictureTitle = hasPicture
    ? `Bake, upload and set the picture loaded on the Picture tab${frameChanged ? withFrame : ""}`
    : "Choose a picture first";
  const frameTitle = hasPicture
    ? pictureTitle
    : hasFrame
      ? "Set this frame on the token"
      : "Take the frame off the token";
  const titles = { pictureTitle, frameTitle };
  if (phase !== "idle")
    return { picture: PHASE_LABEL[phase], frame: PHASE_LABEL[phase], ...titles };
  const noFrame = "Use picture, no frame";
  const picture = !frameChanged ? PHASE_LABEL.idle : hasFrame ? "Use picture + frame" : noFrame;
  const withPicture = !frameChanged ? PHASE_LABEL.idle : hasFrame ? "Use frame + picture" : noFrame;
  const frameOnly = hasFrame ? "Use this frame" : "Use no frame";
  return { picture, frame: hasPicture ? withPicture : frameOnly, ...titles };
}
