/**
 * The NPC editor's token image: the URL/upload field, its preview, and the
 * two library controls — pick a bundled token, and for a mimic, flip between
 * its disguise and its reveal. Lifted out of NPCEditor, which had four lines
 * of headroom under the 350-line guard.
 */

import { useState } from "react";
import { ImageField } from "../../../components/ui/ImageField";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { TokenLibrary } from "../token-library/TokenLibrary";
import {
  libraryAssetByImageUrl,
  libraryCounterpart,
  libraryThumbUrl,
  packItem,
  type LibraryItem,
} from "../token-library/tokenCatalog";

interface NpcTokenImageFieldProps {
  /** The field's live text (per keystroke). */
  tokenImage: string;
  /** The URL on file — the preview remounts when THIS changes, not per key. */
  committedTokenImage: string;
  name: string;
  disabled: boolean;
  onChange: (url: string) => void;
  onCommit: (url: string) => void;
  /** A library pick, or a mimic flip. The editor decides what else follows it. */
  onPickAsset: (item: LibraryItem) => void;
}

export function NpcTokenImageField({
  tokenImage,
  committedTokenImage,
  name,
  disabled,
  onChange,
  onCommit,
  onPickAsset,
}: NpcTokenImageFieldProps): JSX.Element {
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Keyed on what is on file, not on the live text: a half-typed URL is not a
  // mimic, and the flip must not appear and vanish under the DM's cursor.
  const current = libraryAssetByImageUrl(committedTokenImage);
  const counterpart = libraryCounterpart(current);
  // A 48px preview needs the 84px thumb, not the 1254px master.
  const live = libraryAssetByImageUrl(tokenImage);
  const previewSrc = live ? libraryThumbUrl(live) : tokenImage;

  return (
    <>
      <ImageField
        label="Token Image URL"
        value={tokenImage}
        onChange={onChange}
        onCommit={onCommit}
        disabled={disabled}
        compact
      />
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        {tokenImage && (
          <img
            key={committedTokenImage}
            src={previewSrc}
            alt={`${name} token preview`}
            style={{
              width: "48px",
              height: "48px",
              objectFit: "cover",
              borderRadius: "4px",
              border: "1px solid var(--jrpg-border-gold)",
              alignSelf: "flex-start",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <JRPGButton
          onClick={() => setLibraryOpen((open) => !open)}
          disabled={disabled}
          aria-expanded={libraryOpen}
          title="Pick this NPC's token from the bundled library"
          style={buttonStyle}
        >
          📖 Library
        </JRPGButton>
        {counterpart && (
          <JRPGButton
            variant="primary"
            onClick={() => onPickAsset(packItem(counterpart))}
            disabled={disabled}
            title={
              current?.mimic === "disguised"
                ? "Swap the token to the revealed mimic — same cell, same size"
                : "Swap the token back to its disguise"
            }
            style={buttonStyle}
          >
            {current?.mimic === "disguised" ? "🎭 Reveal mimic" : "🎭 Disguise"}
          </JRPGButton>
        )}
      </div>
      {libraryOpen && (
        <TokenLibrary
          hint={`Pick a token image for ${name}`}
          disabled={disabled}
          onPick={(item) => {
            onPickAsset(item);
            setLibraryOpen(false);
          }}
        />
      )}
    </>
  );
}

const buttonStyle = { fontSize: "10px", padding: "6px 10px" } as const;
