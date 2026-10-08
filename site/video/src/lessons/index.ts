import type { LessonScript } from "../script";
import { dmQuickStart } from "./dmQuickStart";

/** Composition id -> lesson. Add a lesson here once its narration and capture exist. */
export const LESSONS: Record<string, LessonScript> = {
  DmQuickStart: dmQuickStart,
};
