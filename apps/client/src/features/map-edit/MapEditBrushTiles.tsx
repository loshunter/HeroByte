import type { PaintFamilyEntry } from "./mapEditFamilies";
import { peekBrushThumbnail } from "./brushThumbnails";

export interface HoverState {
  entry: PaintFamilyEntry;
  x: number;
  y: number;
}

interface BrushTileProps {
  entry: PaintFamilyEntry;
  selected: boolean;
  pinned: boolean;
  onPick: (family: string) => void;
  onTogglePin: (family: string) => void;
  onHover: (hover: HoverState | null) => void;
}

export function BrushTile({
  entry,
  selected,
  pinned,
  onPick,
  onTogglePin,
  onHover,
}: BrushTileProps) {
  const baked = peekBrushThumbnail(entry.assetId);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={entry.name}
      title={entry.name}
      className="collection-tile"
      onClick={() => onPick(entry.family)}
      onContextMenu={(event) => {
        event.preventDefault();
        onTogglePin(entry.family);
      }}
      onMouseEnter={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onHover({ entry, x: rect.right, y: rect.top });
      }}
      onMouseLeave={() => onHover(null)}
      style={{
        position: "relative",
        width: "100%",
        background: "var(--jrpg-panel, #232638)",
        border: selected ? "2px solid var(--jrpg-gold)" : `2px solid ${entry.stroke}`,
        borderRadius: "2px",
        cursor: "pointer",
        padding: 4,
        overflow: "hidden",
      }}
    >
      {baked ? (
        <img src={baked.thumb} alt="" draggable={false} style={tileImageStyle} />
      ) : (
        <span aria-hidden="true" style={{ ...tileImageStyle, background: entry.fill }} />
      )}
      <span className="collection-tile__name">{entry.name}</span>
      {pinned && (
        <span aria-hidden="true" style={pinBadgeStyle}>
          ★
        </span>
      )}
    </button>
  );
}

export function BrushHoverCard({ hover, pinned }: { hover: HoverState; pinned: boolean }) {
  const { entry } = hover;
  const baked = peekBrushThumbnail(entry.assetId);
  const left = Math.max(4, Math.min(hover.x + 10, window.innerWidth - 168));
  const top = Math.max(4, Math.min(hover.y, window.innerHeight - 220));
  return (
    <div style={{ ...hoverCardStyle, left, top }}>
      {baked ? (
        <img src={baked.preview} alt="" draggable={false} style={hoverPreviewStyle} />
      ) : (
        <div style={{ ...hoverPreviewStyle, background: entry.fill }} />
      )}
      <p className="jrpg-text-small" style={{ margin: "6px 0 0", color: "var(--jrpg-gold)" }}>
        {pinned ? "★ " : ""}
        {entry.name}
      </p>
      {entry.note && (
        <p className="jrpg-text-small" style={{ margin: "4px 0 0", color: "var(--jrpg-white)" }}>
          {entry.note}
        </p>
      )}
      <p className="jrpg-text-small" style={{ margin: "4px 0 0", ...hintStyle }}>
        right-click {pinned ? "unpins" : "pins"}
      </p>
    </div>
  );
}

const tileImageStyle = {
  width: "44px",
  height: "44px",
  objectFit: "cover",
} as const;

const pinBadgeStyle = {
  position: "absolute",
  top: "-1px",
  right: "1px",
  color: "var(--jrpg-gold)",
  fontSize: "9px",
  textShadow: "0 1px 2px #000",
  pointerEvents: "none",
} as const;

const hintStyle = { color: "var(--jrpg-white)", opacity: 0.55 } as const;

const hoverCardStyle = {
  position: "fixed",
  // Above every DraggableWindow (they default to z 1000).
  zIndex: 1200,
  width: "152px",
  padding: "6px",
  background: "var(--jrpg-panel-dark, #1a1d29)",
  border: "2px solid var(--jrpg-gold)",
  borderRadius: "4px",
  pointerEvents: "none",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.6)",
} as const;

const hoverPreviewStyle = {
  width: "120px",
  height: "120px",
  display: "block",
  margin: "0 auto",
  borderRadius: "2px",
  imageRendering: "auto",
} as const;
