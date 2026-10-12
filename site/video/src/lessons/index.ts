import type { LessonScript } from "../script";
import { dmQuickStart } from "./dmQuickStart";
import { playerPath3 } from "./playerPath3";
import { playerQuickStart } from "./playerQuickStart";

/** Composition id -> lesson. Add a lesson here once its narration and capture exist. */
export const LESSONS: Record<string, LessonScript> = {
  DmQuickStart: dmQuickStart,
  PlayerQuickStart: playerQuickStart,
  PlayerPath3: playerPath3,
};
