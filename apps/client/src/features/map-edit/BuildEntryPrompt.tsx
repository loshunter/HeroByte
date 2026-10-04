import { JRPGButton } from "../../components/ui/JRPGPanel";
import { LOST_SCENE_WARNING, UNKNOWN_SCENE_WARNING } from "../map-studio/tableMapIdentity";
import type { BuildEntry } from "./buildEntry";

interface BuildEntryPromptProps {
  entry: BuildEntry;
  busy: boolean;
  onStartLiveMap: () => void;
  /** The phone sheet's classes and sentence-case labels. */
  mobile?: boolean;
}

/**
 * What Build shows before the table's map is open. With a map on the table it
 * names that map and the one being viewed, and RESUMES the table's map; only a
 * table with no editable map is offered a new one. Both layouts render this.
 */
export function BuildEntryPrompt({
  entry,
  busy,
  onStartLiveMap,
  mobile = false,
}: BuildEntryPromptProps) {
  const note = mobile ? "mobile-tool-sheet__note" : "jrpg-text-small";
  let label: string;
  if (entry.kind === "resume") label = busy ? "Opening…" : `▶ Resume editing ${entry.onTableName}`;
  else if (busy) label = mobile ? "Starting…" : "STARTING…";
  else label = mobile ? "▶ Start live map" : "▶ START LIVE MAP";
  const erases = entry.kind === "start" && entry.replacesUnsavedScene === true;
  const warning =
    entry.kind === "start" && entry.sceneFateUnknown ? UNKNOWN_SCENE_WARNING : LOST_SCENE_WARNING;
  // A start that would erase a scene with no saved map asks first: that loss
  // cannot be undone, and nothing else on the way says it happens.
  const activate = () => {
    if (
      erases &&
      !window.confirm(`Start a new map on the table for everyone?

${warning}`)
    ) {
      return;
    }
    onStartLiveMap();
  };

  return (
    <>
      {entry.kind === "resume" ? (
        <>
          <p className={note}>
            On table: <strong>{entry.onTableName}</strong>
          </p>
          {entry.viewingName && (
            <p className={note}>
              Viewing in library: <strong>{entry.viewingName}</strong>
            </p>
          )}
          <p className={note}>
            Build edits the map on the table. Resuming opens it here; the party does not move.
          </p>
        </>
      ) : entry.kind === "start" ? (
        <>
          {entry.onTableName && (
            <p className={note}>
              On table: <strong>{entry.onTableName}</strong>
            </p>
          )}
          {entry.viewingName && (
            <p className={note}>
              Viewing in library: <strong>{entry.viewingName}</strong>
            </p>
          )}
          {entry.sceneMapSaved ? (
            <p className={note}>
              The table&apos;s map is not open for editing: Use at table (DM Menu → Maps) puts it
              back. Starting a new map puts this scene away under its own map instead.
            </p>
          ) : (
            <p className={note}>
              No editable map is on the table. Starting one creates a new map and puts it on the
              table: rooms, walls and doors you build appear for every player.
            </p>
          )}
          {erases && <p className={note}>{warning}</p>}
        </>
      ) : null}
      {mobile ? (
        <button
          type="button"
          className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
          onClick={activate}
          disabled={busy}
        >
          {label}
        </button>
      ) : (
        <JRPGButton onClick={activate} disabled={busy} variant="primary">
          {label}
        </JRPGButton>
      )}
    </>
  );
}
