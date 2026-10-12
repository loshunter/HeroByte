import type { LessonScript } from "../script";
import { dmPath1 } from "./dmPath1";
import { dmPath2 } from "./dmPath2";
import { dmQuickStart } from "./dmQuickStart";
import { playerPath1 } from "./playerPath1";
import { playerPath2 } from "./playerPath2";
import { playerPath3 } from "./playerPath3";
import { playerPath4 } from "./playerPath4";
import { playerPath5 } from "./playerPath5";
import { playerPath6 } from "./playerPath6";
import { playerQuickStart } from "./playerQuickStart";

/** Composition id -> lesson. Add a lesson here once its narration and capture exist. */
export const LESSONS: Record<string, LessonScript> = {
  DmQuickStart: dmQuickStart,
  DmPath1: dmPath1,
  DmPath2: dmPath2,
  PlayerQuickStart: playerQuickStart,
  PlayerPath1: playerPath1,
  PlayerPath2: playerPath2,
  PlayerPath3: playerPath3,
  PlayerPath4: playerPath4,
  PlayerPath5: playerPath5,
  PlayerPath6: playerPath6,
};
