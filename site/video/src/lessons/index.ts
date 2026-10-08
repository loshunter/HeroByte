import type { LessonScript } from "../script";
import { dmQuickStart } from "./dmQuickStart";
import { playerQuickStart } from "./playerQuickStart";

/** Composition id -> lesson. Add a lesson here once its narration and capture exist. */
export const LESSONS: Record<string, LessonScript> = {
  DmQuickStart: dmQuickStart,
  PlayerQuickStart: playerQuickStart,
};
