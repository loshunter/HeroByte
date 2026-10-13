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
// a file the load then refuses. The words are one sentence per reason, read in
// a toast: say what is over, by how much, and the one control that clears it.

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
  parseSceneStateShape,
  validateLoadSessionEnvelope,
  validateLoadSessionMessage,
} from "../../middleware/validators/sessionValidators.js";

type LimitedCollection = keyof typeof SNAPSHOT_LIMITS;

const TABLE_PATH = "DM Menu → Table → Players at this table, or on a phone ♛ DM → Table";
const MAPS_PATH = "DM Menu → Maps, or on a phone ♛ DM → Maps";

/**
 * What each collection is called at the table, and the sentence that clears `n`
 * of it. Only seats, tokens and drawings can outgrow a backup in live play: the
 * others are held to their limits as they are made (characters, props, Library
 * tokens, the Atlas) or trimmed as they grow (chat, rolls). They stay listed so
 * a table from an older server, past one of them, is still told something true.
 */
const COLLECTION_ADVICE: Record<LimitedCollection, { name: string; fix: (n: number) => string }> = {
  players: { name: "seats", fix: (n) => `Remove ${n} or more absent players (${TABLE_PATH}).` },
  tokens: { name: "tokens", fix: (n) => `Delete ${n} or more tokens or NPCs.` },
  characters: { name: "characters", fix: (n) => `Delete ${n} or more NPCs or characters.` },
  drawings: {
    name: "drawings",
    fix: (n) => `Erase ${n} or more: Clear All Drawings (${MAPS_PATH}) removes every unlocked one.`,
  },
  props: { name: "props", fix: (n) => `Delete ${n} or more props.` },
  customTokens: {
    name: "Library tokens",
    fix: (n) => `Delete ${n} or more from the Token Library's own shelf.`,
  },
  diceRolls: { name: "dice rolls in the log", fix: () => "Clear the roll log." },
  // Every token, drawing and prop is one of these, and so are the map itself and its
  // staging zone: the name says so, so the count is true.
  sceneObjects: {
    name: "objects on the map (tokens, drawings, props, the map and its staging zone)",
    fix: (n) => `Erase drawings or delete tokens or props, ${n} or more in all.`,
  },
  chatLog: { name: "chat messages", fix: () => "Clear the chat." },
  atlasNodes: { name: "Atlas places", fix: (n) => `Delete ${n} or more places from the Atlas.` },
  atlasLinks: { name: "Atlas links", fix: (n) => `Delete ${n} or more links from the Atlas.` },
};

/** Each token, drawing and prop is also a scene object, so their excess counts toward its. */
const PARTS_OF_SCENE_OBJECTS = ["tokens", "drawings", "props"] as const;

const count = (n: number) => n.toLocaleString("en-US");
const kilobytes = (bytes: number) => `${count(Math.ceil(bytes / 1024))} KB`;
const weigh = (value: unknown) => (value === undefined ? 0 : utf8ByteLength(JSON.stringify(value)));
const length = (record: Record<string, unknown>, key: string) => {
  const list = record[key];
  return Array.isArray(list) ? list.length : 0;
};

/**
 * The collections over their limit in `record`, as [key, length]. Scene objects are
 * left out when what is over among tokens, drawings and props already brings them
 * back under: one cause, said once.
 */
function overLimits(record: Record<string, unknown>, keys: readonly LimitedCollection[]) {
  const over = keys.filter((key) => length(record, key) > SNAPSHOT_LIMITS[key]);
  const cleared = PARTS_OF_SCENE_OBJECTS.reduce(
    (sum, key) => sum + Math.max(0, length(record, key) - SNAPSHOT_LIMITS[key]),
    0,
  );
  const sceneObjectsStillOver =
    length(record, "sceneObjects") - cleared > SNAPSHOT_LIMITS.sceneObjects;
  return over
    .filter((key) => key !== "sceneObjects" || sceneObjectsStillOver)
    .map((key) => [key, length(record, key)] as const);
}

interface WeighedPart {
  name: string;
  bytes: number;
  fix: string;
}

/** What clears a heavy waiting scene: whichever of its own parts is heaviest. */
function sceneFix(scene: unknown): string {
  const record = scene as Record<string, unknown>;
  const objects = Array.isArray(record.sceneObjects)
    ? (record.sceneObjects as Array<{ type?: string }>)
    : [];
  const objectsOf = (type: string) => weigh(objects.filter((o) => o.type === type));
  const options = [
    { bytes: weigh(record.drawings) + objectsOf("drawing"), fix: "erase its drawings" },
    { bytes: weigh(record.tokens) + objectsOf("token"), fix: "delete tokens you no longer need" },
    {
      // A pasted background rides twice in a waiting scene too: its own and its map object's.
      bytes: weigh(record.mapBackground) + objectsOf("map"),
      fix: "replace its pasted map background with ⬆ Upload image",
    },
  ].sort((a, b) => b.bytes - a.bytes);
  return options[0]!.fix;
}

/**
 * What makes a frame that is over heavy, heaviest first: the parts that are a tenth
 * of it or more (two at most), or else the single heaviest, so the DM is always
 * told where the weight is and what clears it.
 */
function heaviestParts(
  file: SessionFile,
  frameBytes: number,
  mapName: (id: string) => string | undefined,
): string {
  const snapshot = file.snapshot as unknown as Record<string, unknown>;
  const sceneObjects = Array.isArray(snapshot.sceneObjects)
    ? (snapshot.sceneObjects as Array<{ type?: string }>)
    : [];
  const objectsOf = (type: string) => weigh(sceneObjects.filter((o) => o.type === type));
  const named: WeighedPart[] = [
    {
      name: "maps",
      bytes: weigh(file.mapDocuments),
      fix: `delete maps you no longer need (${MAPS_PATH})`,
    },
    ...(file.sceneStates ?? []).map((scene) => ({
      name: `the scene waiting on "${mapName(scene.mapDocumentId) ?? "a map"}"`,
      bytes: weigh(scene),
      fix: `open that map with Use at table (${MAPS_PATH}; the whole party moves there) and ${sceneFix(scene)}`,
    })),
    {
      name: "the Token Library's own shelf",
      bytes: weigh(snapshot.customTokens),
      fix: "delete tokens you no longer need from the Token Library's own shelf",
    },
    {
      name: "drawings",
      bytes: weigh(snapshot.drawings) + objectsOf("drawing"),
      fix: `erase drawings with Clear All Drawings (${MAPS_PATH})`,
    },
    {
      name: "tokens and characters",
      bytes: weigh(snapshot.tokens) + weigh(snapshot.characters) + objectsOf("token"),
      fix: "delete tokens or NPCs you no longer need",
    },
    {
      name: "props",
      bytes: weigh(snapshot.props) + objectsOf("prop"),
      fix: "delete props you no longer need",
    },
    // A pasted image (a data: link) rides twice: the background and the map object.
    {
      name: "the map background",
      bytes: weigh(snapshot.mapBackground) + objectsOf("map"),
      fix: `replace a pasted map background with ⬆ Upload image (${MAPS_PATH}), which stores it once on the server`,
    },
    {
      name: "the map on the table",
      bytes:
        weigh(snapshot.compiledScene) + weigh(snapshot.mapTerrain) + weigh(snapshot.mapElements),
      fix: `use a smaller map at the table (${MAPS_PATH})`,
    },
  ];
  // What no part above names (seats, portraits, chat, the roll log, the Atlas, settings).
  // Named only when it alone outweighs every part: ordinary tables carry some of it.
  const rest = frameBytes - named.reduce((sum, part) => sum + part.bytes, 0);
  const parts = [...named].sort((a, b) => b.bytes - a.bytes);
  if (rest > (parts[0]?.bytes ?? 0)) {
    return ` The heaviest part is the rest of the table: seats, portraits, chat, the roll log and the Atlas, ${kilobytes(rest)}. This is unusual: please report it.`;
  }
  const big = parts.filter((part) => part.bytes >= frameBytes / 10).slice(0, 2);
  const chosen = big.length > 0 ? big : parts.slice(0, 1);
  const which = chosen.map((part) => `${part.name} (${kilobytes(part.bytes)})`).join(" and ");
  const fixes = chosen.map((part) => part.fix).join(", or ");
  const verb = chosen.length === 1 ? "part is" : "parts are";
  return ` The heaviest ${verb} ${which}. ${fixes.charAt(0).toUpperCase()}${fixes.slice(1)}.`;
}

/**
 * Sentences for the waiting scenes the file leaves out because Restore would refuse
 * them. A scene whose map is gone is not one: Restore drops it anyway (it keeps only
 * scenes whose map came back), so leaving it out loses nothing.
 */
function skippedScenes(state: Pick<RoomState, "sceneStates">, maps: MapDocument[]): string[] {
  // Only a well-shaped scene past the count limits is the DM's to clear. A malformed
  // one is a fault the export skips loudly (a restart drops it too); refusing over it
  // would block every backup with nothing to do.
  return Object.values(state.sceneStates)
    .filter((scene) => parseSceneState(scene) === null && parseSceneStateShape(scene) !== null)
    .flatMap((scene) => {
      const map = maps.find((doc) => doc.id === scene.mapDocumentId);
      if (!map) {
        console.warn(`[Backup] left out a scene waiting on a missing map ${scene.mapDocumentId}`);
        return [];
      }
      const record = scene as unknown as Record<string, unknown>;
      const over = overLimits(record, [...PARTS_OF_SCENE_OBJECTS, "sceneObjects"]).map(
        ([key, n]) =>
          `${count(n)} ${COLLECTION_ADVICE[key].name}, more than the ${count(SNAPSHOT_LIMITS[key])} a backup holds`,
      );
      const detail = over.length > 0 ? `: it has ${over.join("; and ")}` : "";
      return [
        `The scene waiting on the map "${map.name}" would be left out${detail}. Open that map with Use at table (${MAPS_PATH}; the whole party moves there) and clear it, or delete the map.`,
      ];
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
  const snapshot = file.snapshot as unknown as Record<string, unknown>;
  const counted = overLimits(snapshot, Object.keys(SNAPSHOT_LIMITS) as LimitedCollection[]).map(
    ([key, n]) => {
      const { name, fix } = COLLECTION_ADVICE[key];
      const limit = SNAPSHOT_LIMITS[key];
      return `The table has ${count(n)} ${name}, and a backup holds ${count(limit)}. ${fix(n - limit)}`;
    },
  );
  const scenes = skippedScenes(state, maps);

  const bytes = loadSessionFrameBytes(file);
  const weight =
    bytes > SESSION_RESTORE_MAX_BYTES
      ? [
          `At ${kilobytes(bytes)} the backup is past the ${kilobytes(SESSION_RESTORE_MAX_BYTES)} a restore can carry.${heaviestParts(file, bytes, (id) => maps.find((doc) => doc.id === id)?.name)}`,
        ]
      : [];

  const reasons = [...counted, ...scenes, ...weight];
  if (reasons.length > 0) {
    // A file short of only a waiting scene would restore, just not whole.
    const header =
      counted.length === 0 && weight.length === 0
        ? "This table backup would not restore whole, so it was not saved."
        : "This table backup would not restore, so it was not saved.";
    return `${header} ${reasons.join(" ")} Then download it again.`;
  }

  // The load's own verdict, for anything the checks above do not name. Its error
  // reads "... at mapDocuments.3.<field>: ..." when one stored map is malformed.
  const frame = loadSessionFrame(file) as unknown as Record<string, unknown>;
  const check = validateLoadSessionMessage(frame);
  const verdict = check.valid ? validateLoadSessionEnvelope(frame) : check;
  if (verdict.valid) return null;
  const index = /mapDocuments\.(\d+)/.exec(verdict.error ?? "")?.[1];
  const map = index === undefined ? undefined : file.mapDocuments[Number(index)];
  const header = "This table backup would not restore, so it was not saved.";
  return map
    ? `${header} The map "${map.name}" does not pass the restore's check. Delete it (${MAPS_PATH}), then download the backup again.`
    : `${header} Part of the table does not pass the restore's check (${verdict.error}). This is a fault, not something to clear: please report it.`;
}
