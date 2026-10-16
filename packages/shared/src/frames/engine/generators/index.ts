// The generators by id: every id in FRAME_GENERATOR_SPECS has one here.

import type { FrameGenerator } from "./common.js";
import { masonry } from "./masonry.js";
import { plain } from "./plain.js";
import { plank } from "./plank.js";
import { plate } from "./plate.js";

export const FRAME_GENERATORS: Readonly<Record<string, FrameGenerator>> = {
  plain,
  masonry,
  plank,
  plate,
};

export type { FrameGenerator, GeneratorContext } from "./common.js";
