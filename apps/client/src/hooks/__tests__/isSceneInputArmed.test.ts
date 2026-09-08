// The ONE statement of "a tool owns the press" — the camera pans on its
// negation and the atlas badges go deaf on it. Each term alone must arm it:
// the mobile lens's L1 shipped a hand-copied four-term subset that left the
// badge listening under alignment, ping and measure.

import { describe, expect, it } from "vitest";
import { isSceneInputArmed, type SceneInputModes } from "../useStageEventRouter";

const NONE: SceneInputModes = {
  alignmentMode: false,
  linkAimMode: false,
  pointerMode: false,
  measureMode: false,
  drawMode: false,
  selectMode: false,
  mapEditMode: false,
};

describe("isSceneInputArmed", () => {
  it("is false when nothing is armed — the camera pans and the badges listen", () => {
    expect(isSceneInputArmed(NONE)).toBe(false);
  });

  it.each(Object.keys(NONE) as (keyof SceneInputModes)[])(
    "is true when %s alone is armed",
    (mode) => {
      expect(isSceneInputArmed({ ...NONE, [mode]: true })).toBe(true);
    },
  );
});
