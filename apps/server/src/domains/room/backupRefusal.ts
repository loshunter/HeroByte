// ============================================================================
// BACKUP REFUSAL — a table backup that would not restore is not handed over
// ============================================================================
// A backup is only a backup if Restore takes it. Play can grow a table past
// what a restore accepts: more than SNAPSHOT_LIMITS of a collection (the load
// check refuses the file whole), a load-session frame past what one message
// carries (ws drops it before any handler sees it), or a suspended scene the
// file's envelope would reject (buildSessionFile leaves it out, so the file
// would restore without that map's scene). The owner's rule (2026-10-13):
// refuse the save and say why, so the DM can clear NPCs, absent seats or
// drawings first and then save safely.
//
// The test is the restore's OWN: the same frame builder and byte counter the
// client sends with, and the same validators the server loads with. A
// friendlier second copy of the limits would drift from the real ones and pass
// a file the load then refuses.

import {
  SESSION_RESTORE_MAX_BYTES,
  loadSessionFrame,
  loadSessionFrameBytes,
  utf8ByteLength,
  type MapDocument,
  type SessionFile,
} from "@herobyte/shared";
import type { RoomState } from "./model.js";
import {
  SNAPSHOT_LIMITS,
  parseSceneState,
  validateLoadSessionEnvelope,
  validateLoadSessionMessage,
} from "../../middleware/validators/sessionValidators.js";

type LimitedCollection = keyof typeof SNAPSHOT_LIMITS;

const TABLE_PATH = "DM Menu → Table → Players at this table (on a phone: ♛ DM → Table)";
const MAPS_PATH = "DM Menu → Maps (on a phone: ♛ DM → Maps)";

/**
 * What each collection is called at the table, and how the DM clears `n` of it.
 * Only seats, tokens and drawings can outgrow a backup in live play: the others
 * are held to their limits as they are made (characters, props, Library tokens,
 * the Atlas) or trimmed as they grow (chat, rolls). They stay listed so a table
 * from an older server, past one of them, is still told something true.
 */
const COLLECTION_ADVICE: Record<LimitedCollection, { name: string; fix: (n: number) => string }> = {
  players: { name: "seats", fix: (n) => `remove ${n} or more absent players (${TABLE_PATH})` },
  tokens: { name: "tokens", fix: (n) => `delete ${n} or more tokens or NPCs` },
  characters: { name: "characters", fix: (n) => `delete ${n} or more NPCs or characters` },
  drawings: {
    name: "drawings",
    fix: (n) => `erase ${n} or more drawings (Clear All Drawings in ${MAPS_PATH}, or the eraser)`,
  },
  props: { name: "props", fix: (n) => `delete ${n} or more props` },
  customTokens: {
    name: "Library tokens",
    fix: (n) => `delete ${n} or more from the Token Library's own shelf`,
  },
  diceRolls: { name: "dice rolls in the log", fix: () => "clear the roll log" },
  // Every token, drawing and prop is also one of these: named only when none of
  // those three is over on its own.
  sceneObjects: {
    name: "tokens, drawings and props together",
    fix: (n) => `erase drawings or delete tokens or props, ${n} or more in all`,
  },
  chatLog: { name: "chat messages", fix: () => "clear the chat" },
  atlasNodes: { name: "Atlas places", fix: (n) => `delete ${n} or more places from the Atlas` },
  atlasLinks: { name: "Atlas links", fix: (n) => `delete ${n} or more links from the Atlas` },
};

function kilobytes(bytes: number): string {
  return `${Math.ceil(bytes / 1024).toLocaleString("en-US")} KB`;
}

function weigh(value: unknown): number {
  return value === undefined ? 0 : utf8ByteLength(JSON.stringify(value));
}

/** The two heaviest parts of a frame that is over, each with the control that shrinks it. */
function heaviestParts(file: SessionFile): string {
  const snapshot = file.snapshot as unknown as Record<string, unknown>;
  const parts = [
    {
      bytes: weigh(file.mapDocuments) + weigh(file.sceneStates),
      what: `maps and their waiting scenes: delete maps you no longer need (${MAPS_PATH})`,
    },
    // Each drawing rides twice: in the drawings and again inside its scene object.
    {
      bytes: weigh(snapshot.drawings) * 2,
      what: `drawings: erase them (Clear All Drawings in ${MAPS_PATH}, or the eraser)`,
    },
    {
      bytes: weigh(snapshot.tokens) + weigh(snapshot.characters),
      what: "tokens and characters: delete tokens or NPCs you no longer need",
    },
  ]
    .filter((part) => part.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 2);
  return `the heaviest parts are ${parts.map((part) => `${kilobytes(part.bytes)} of ${part.what}`).join("; ")}`;
}

/** Waiting scenes the file leaves out because Restore would refuse them, in the DM's words. */
function skippedScenes(state: Pick<RoomState, "sceneStates">, maps: MapDocument[]): string[] {
  return Object.values(state.sceneStates)
    .filter((scene) => parseSceneState(scene) === null)
    .map((scene) => {
      const record = scene as unknown as Record<string, unknown>;
      const name = maps.find((doc) => doc.id === scene.mapDocumentId)?.name ?? "a deleted map";
      const over = (["tokens", "drawings", "props", "sceneObjects"] as const)
        .filter((key) => {
          const list = record[key];
          return Array.isArray(list) && list.length > SNAPSHOT_LIMITS[key];
        })
        .map(
          (key) =>
            `${(record[key] as unknown[]).length.toLocaleString("en-US")} ${COLLECTION_ADVICE[key].name} (a backup holds ${SNAPSHOT_LIMITS[key].toLocaleString("en-US")})`,
        );
      const detail = over.length > 0 ? `: it has ${over.join(" and ")}` : "";
      return `the scene waiting on the map "${name}" would be left out${detail}; travel there and clear it, or delete that map (${MAPS_PATH})`;
    });
}

/**
 * Why this backup would not restore, in the DM's words, or null when it would.
 * `state` and `maps` find the waiting scenes the file had to leave out.
 */
export function backupRefusal(
  file: SessionFile,
  state: Pick<RoomState, "sceneStates">,
  maps: MapDocument[],
): string | null {
  const reasons: string[] = [];

  const snapshot = file.snapshot as unknown as Record<string, unknown>;
  const over = new Set<LimitedCollection>();
  for (const key of Object.keys(SNAPSHOT_LIMITS) as LimitedCollection[]) {
    const collection = snapshot[key];
    const limit = SNAPSHOT_LIMITS[key];
    if (!Array.isArray(collection) || collection.length <= limit) continue;
    const covered = over.has("tokens") || over.has("drawings") || over.has("props");
    if (key === "sceneObjects" && covered) continue;
    over.add(key);
    const { name, fix } = COLLECTION_ADVICE[key];
    const count = collection.length.toLocaleString("en-US");
    reasons.push(
      `the table has ${count} ${name} and a backup holds ${limit.toLocaleString("en-US")}: ${fix(collection.length - limit)}`,
    );
  }

  reasons.push(...skippedScenes(state, maps));

  const bytes = loadSessionFrameBytes(file);
  if (bytes > SESSION_RESTORE_MAX_BYTES) {
    reasons.push(
      `at ${kilobytes(bytes)} it is past the ${kilobytes(SESSION_RESTORE_MAX_BYTES)} one restore carries, and ${heaviestParts(file)}`,
    );
  }

  if (reasons.length > 0) {
    return `This table backup would not restore, so it was not saved: ${reasons.join("; ")}. Then download it again.`;
  }

  // The load's own verdict, for anything the checks above do not name.
  const frame = loadSessionFrame(file) as unknown as Record<string, unknown>;
  const check = validateLoadSessionMessage(frame);
  const verdict = check.valid ? validateLoadSessionEnvelope(frame) : check;
  if (verdict.valid) return null;
  const index = /mapDocuments\.(\d+)/.exec(verdict.error ?? "")?.[1];
  const map = index === undefined ? undefined : file.mapDocuments[Number(index)];
  return map
    ? `This table backup would not restore, so it was not saved: the map "${map.name}" does not pass the restore's check. Delete it or import it again (${MAPS_PATH}), then download the backup again.`
    : `This table backup would not restore, so it was not saved: part of the table does not pass the restore's check (${verdict.error}). This is a fault, not something to clear: please report it.`;
}
