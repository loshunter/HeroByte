import type { LessonScript } from "../script";
import { dmQuickStart } from "./dmQuickStart";
import { playerPath1 } from "./playerPath1";
import { playerPath2 } from "./playerPath2";
import { playerPath3 } from "./playerPath3";
import { playerPath4 } from "./playerPath4";
import { playerQuickStart } from "./playerQuickStart";

/** Composition id -> lesson. Add a lesson here once its narration and capture exist. */
export const LESSONS: Record<string, LessonScript> = {
  DmQuickStart: dmQuickStart,
  PlayerQuickStart: playerQuickStart,
  PlayerPath1: playerPath1,
  PlayerPath2: playerPath2,
  PlayerPath3: playerPath3,
  PlayerPath4: playerPath4,
};
