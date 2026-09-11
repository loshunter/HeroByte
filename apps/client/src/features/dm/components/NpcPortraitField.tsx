/**
 * The NPC editor's portrait: the URL field and its preview. Lifted out of
 * NPCEditor, which sat three lines under the 350-line guard when the
 * movement-budget reset joined its stats row (F2).
 */

import { ImageField } from "../../../components/ui/ImageField";

interface NpcPortraitFieldProps {
  /** The field's live text (per keystroke). */
  portrait: string;
  /** The URL on file — the preview remounts when THIS changes, not per key. */
  committedPortrait: string;
  name: string;
  disabled: boolean;
  onChange: (url: string) => void;
  onCommit: (url: string) => void;
}

export function NpcPortraitField({
  portrait,
  committedPortrait,
  name,
  disabled,
  onChange,
  onCommit,
}: NpcPortraitFieldProps): JSX.Element {
  return (
    <>
      <ImageField
        label="Portrait URL"
        value={portrait}
        onChange={onChange}
        onCommit={onCommit}
        disabled={disabled}
        compact
      />
      {portrait && (
        // Keyed on the COMMITTED URL: the onError hide below is imperative, and
        // without a remount a fixed URL would stay hidden until the editor
        // re-mounted. Not the live text — that changes per keystroke, and a
        // remount per key would blank a loaded preview while the DM types.
        <img
          key={committedPortrait}
          src={portrait}
          alt={`${name} portrait`}
          style={{
            width: "100%",
            maxHeight: "100px",
            objectFit: "cover",
            borderRadius: "4px",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </>
  );
}
