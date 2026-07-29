// ============================================================================
// MAP-EDIT BRUSH DECK (the painter's deck)
// ============================================================================
// The browsable brush palette that replaced the flat floor/wall/roof swatch
// grids: live-baked thumbnails (the real painter output) grouped by material
// shelf, with search, pinned favourites, recents, and a hover card carrying a
// large preview plus the family's one-line grammar note. Derived entirely
// from starterTiles ∩ VILLAGE_TERRAIN (mapEditFamilies) — no hardcoded lists.
// Right-click a tile to pin it. Deck state (pins/recents) is deck-internal,
// so MapEditToolbarProps is untouched.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PAINT_FAMILIES, type PaintFamilyEntry } from "./mapEditFamilies";
import {
  buildBrushDeckGroups,
  filterBrushEntries,
  loadBrushPins,
  loadBrushRecents,
  pushBrushRecent,
  toggleBrushPin,
} from "./brushDeck";
import {
  getBrushThumbnailVersion,
  peekBrushThumbnail,
  requestBrushThumbnails,
  subscribeBrushThumbnails,
} from "./brushThumbnails";

interface MapEditBrushDeckProps {
  /** The armed paint family (shared floor/wall/roof swatch state). */
  selected: string;
  onSelect: (family: string) => void;
}

interface HoverState {
  entry: PaintFamilyEntry;
  x: number;
  y: number;
}

export function MapEditBrushDeck({ selected, onSelect }: MapEditBrushDeckProps) {
  const [query, setQuery] = useState("");
  const [pins, setPins] = useState<string[]>(loadBrushPins);
  const [recents, setRecents] = useState<string[]>(loadBrushRecents);
  const [hover, setHover] = useState<HoverState | null>(null);
  useSyncExternalStore(subscribeBrushThumbnails, getBrushThumbnailVersion, () => 0);

  useEffect(() => {
    requestBrushThumbnails(PAINT_FAMILIES.map((entry) => entry.assetId));
  }, []);

  // A tile that unmounts or reflows under a stationary pointer fires no
  // mouseleave — drop the card whenever the rendered tile set can change
  // (search narrows, pin toggles, the Recent shelf inserts on a pick).
  useEffect(() => setHover(null), [query, pins, recents]);

  const groups = useMemo(() => buildBrushDeckGroups(), []);
  const byFamily = useMemo(() => new Map(PAINT_FAMILIES.map((entry) => [entry.family, entry])), []);
  const filtered = query.trim() ? filterBrushEntries(PAINT_FAMILIES, query) : null;
  const pinnedEntries = pins
    .map((family) => byFamily.get(family))
    .filter((entry): entry is PaintFamilyEntry => entry !== undefined);
  const recentEntries = recents
    .map((family) => byFamily.get(family))
    .filter((entry): entry is PaintFamilyEntry => entry !== undefined);

  const pick = (family: string) => {
    onSelect(family);
    setRecents(pushBrushRecent(family));
  };
  const togglePin = (family: string) => setPins(toggleBrushPin(family));

  const renderTiles = (entries: PaintFamilyEntry[]) => (
    <div style={tileGridStyle}>
      {entries.map((entry) => (
        <BrushTile
          key={entry.family}
          entry={entry}
          selected={entry.family === selected}
          pinned={pins.includes(entry.family)}
          onPick={pick}
          onTogglePin={togglePin}
          onHover={setHover}
        />
      ))}
    </div>
  );

  // The armed family must ALWAYS be readable, even when a search query or
  // scroll position hides its tile (the old flat grids never hid a swatch).
  const armed = byFamily.get(selected);

  return (
    <div>
      <p className="jrpg-text-small" style={{ margin: "0 0 4px", color: "var(--jrpg-gold)" }}>
        Brush: <span style={{ color: "var(--jrpg-white)" }}>{armed ? armed.name : selected}</span>
      </p>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Typing context: no global shortcut may see these keys (Escape
          // closes the whole tool, Ctrl+Z undoes the LIVE map, Backspace
          // fires delete-selected). Escape clears the query instead.
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            setQuery("");
          }
        }}
        placeholder="Search…"
        aria-label="Search brushes"
        className="jrpg-text-small"
        style={searchStyle}
      />

      <div
        role="group"
        aria-label="Brushes"
        style={deckScrollStyle}
        onScroll={() => setHover(null)}
      >
        {filtered ? (
          filtered.length > 0 ? (
            renderTiles(filtered)
          ) : (
            <p className="jrpg-text-small" style={emptyStyle}>
              No brush matches “{query.trim()}”.
            </p>
          )
        ) : (
          <>
            {pinnedEntries.length > 0 && (
              <section aria-label="Pinned brushes">
                <p className="jrpg-text-small" style={shelfLabelStyle}>
                  ★ Pinned
                </p>
                {renderTiles(pinnedEntries)}
              </section>
            )}
            {recentEntries.length > 0 && (
              <section aria-label="Recent brushes">
                <p className="jrpg-text-small" style={shelfLabelStyle}>
                  Recent
                </p>
                {renderTiles(recentEntries)}
              </section>
            )}
            {groups.map((group) => (
              <section key={group.material} aria-label={`${group.label} brushes`}>
                <p className="jrpg-text-small" style={shelfLabelStyle}>
                  {group.label}
                </p>
                {renderTiles(group.entries)}
              </section>
            ))}
          </>
        )}
      </div>

      {hover &&
        // Portalled: the toolbar's DraggableWindow is its own stacking
        // context (z 200) BELOW the other floating windows (z 1000) — a card
        // rendered inside it would slide under any dice/log panel to the
        // right. It is pointer-events:none, so the portal has no event cost.
        createPortal(
          <BrushHoverCard hover={hover} pinned={pins.includes(hover.entry.family)} />,
          document.body,
        )}
    </div>
  );
}

interface BrushTileProps {
  entry: PaintFamilyEntry;
  selected: boolean;
  pinned: boolean;
  onPick: (family: string) => void;
  onTogglePin: (family: string) => void;
  onHover: (hover: HoverState | null) => void;
}

function BrushTile({ entry, selected, pinned, onPick, onTogglePin, onHover }: BrushTileProps) {
  const baked = peekBrushThumbnail(entry.assetId);
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={entry.name}
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
        aspectRatio: "1 / 1",
        background: entry.fill,
        border: selected ? "2px solid var(--jrpg-gold)" : `2px solid ${entry.stroke}`,
        borderRadius: "2px",
        cursor: "pointer",
        padding: 0,
        overflow: "hidden",
      }}
    >
      {baked && <img src={baked.thumb} alt="" draggable={false} style={tileImageStyle} />}
      {pinned && <span style={pinBadgeStyle}>★</span>}
    </button>
  );
}

function BrushHoverCard({ hover, pinned }: { hover: HoverState; pinned: boolean }) {
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

const searchStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginBottom: "4px",
  background: "var(--jrpg-panel-dark, #1a1d29)",
  border: "1px solid var(--jrpg-gold)",
  borderRadius: "2px",
  color: "var(--jrpg-white)",
  fontSize: "9px",
  padding: "3px 4px",
  outline: "none",
} as const;

const deckScrollStyle = {
  maxHeight: "236px",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  paddingRight: "2px",
} as const;

const shelfLabelStyle = {
  margin: "0 0 3px",
  color: "var(--jrpg-gold)",
  opacity: 0.85,
} as const;

const tileGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "4px",
} as const;

const tileImageStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
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

const emptyStyle = { margin: 0, color: "var(--jrpg-white)", opacity: 0.7 } as const;

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
