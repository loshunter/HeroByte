// ============================================================================
// BACKUP REFUSAL — a table backup that would not load back is not handed over
// ============================================================================
// A backup is only a backup if Restore takes it. Play can grow a table past
// what a restore accepts: more than SNAPSHOT_LIMITS of a collection (the load
// check refuses the file whole), or a load-session frame past
// WS_MAX_MESSAGE_BYTES (ws drops it before any handler sees it). The owner's
// rule (2026-10-13): refuse the save and say why, so the DM can clear NPCs,
// absent seats or old maps first and then save safely.
//
// The test is the restore's OWN: the same frame builder and byte counter the
// client sends with, and the same two validators the server loads with. A
// friendlier second copy of the limits would drift from the real ones and pass
// a file the load then refuses.

import {
  WS_MAX_MESSAGE_BYTES,
  loadSessionFrame,
  loadSessionFrameBytes,
  type SessionFile,
} from "@herobyte/shared";
import {
  SNAPSHOT_LIMITS,
  validateLoadSessionEnvelope,
  validateLoadSessionMessage,
} from "../../middleware/validators/sessionValidators.js";

type LimitedCollection = keyof typeof SNAPSHOT_LIMITS;

/** What each collection is called at the table, and how the DM clears `n` of it. */
const COLLECTION_ADVICE: Record<LimitedCollection, { name: string; fix: (n: number) => string }> = {
  players: {
    name: "seats",
    fix: (n) => `remove ${n} or more absent players (DM Menu → Table → Players at this table)`,
  },
  tokens: { name: "tokens", fix: (n) => `delete ${n} or more tokens or NPCs` },
  characters: { name: "characters", fix: (n) => `delete ${n} or more NPCs or characters` },
  drawings: { name: "drawings", fix: (n) => `erase ${n} or more drawings` },
  props: { name: "props", fix: (n) => `delete ${n} or more props` },
  customTokens: {
    name: "Library tokens",
    fix: (n) => `delete ${n} or more from the Token Library's own shelf`,
  },
  diceRolls: { name: "dice rolls in the log", fix: () => "clear the roll log" },
  sceneObjects: { name: "map pieces", fix: (n) => `remove ${n} or more map elements` },
  chatLog: { name: "chat messages", fix: () => "clear the chat" },
  atlasNodes: { name: "Atlas places", fix: (n) => `delete ${n} or more places from the Atlas` },
  atlasLinks: { name: "Atlas links", fix: (n) => `delete ${n} or more links from the Atlas` },
};

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why this backup would not load back, in the DM's words, or null when it would. */
export function backupRefusal(file: SessionFile): string | null {
  const frame = loadSessionFrame(file) as unknown as Record<string, unknown>;
  const reasons: string[] = [];

  const snapshot = file.snapshot as unknown as Record<string, unknown>;
  for (const key of Object.keys(SNAPSHOT_LIMITS) as LimitedCollection[]) {
    const collection = snapshot[key];
    const limit = SNAPSHOT_LIMITS[key];
    if (Array.isArray(collection) && collection.length > limit) {
      const { name, fix } = COLLECTION_ADVICE[key];
      reasons.push(
        `the table has ${collection.length} ${name} and a backup holds ${limit}: ${fix(collection.length - limit)}`,
      );
    }
  }

  const bytes = loadSessionFrameBytes(file);
  if (bytes > WS_MAX_MESSAGE_BYTES) {
    reasons.push(
      `at ${megabytes(bytes)} it is past the ${megabytes(WS_MAX_MESSAGE_BYTES)} one restore carries: delete maps you no longer need (DM Menu → Maps)`,
    );
  }

  // The load's own verdict, for anything the counts above do not name.
  if (reasons.length === 0) {
    const check = validateLoadSessionMessage(frame);
    const envelope = check.valid ? validateLoadSessionEnvelope(frame) : check;
    if (!envelope.valid) reasons.push(`it fails the restore's check (${envelope.error})`);
  }

  if (reasons.length === 0) return null;
  return `This table backup would not restore, so it was not saved: ${reasons.join("; ")}. Then download it again.`;
}
