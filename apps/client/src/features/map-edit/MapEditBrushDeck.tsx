// ============================================================================
// MAP-EDIT BRUSH DECK (the painter's deck)
// ============================================================================
// The browsable brush palette that replaced the flat floor/wall/roof swatch
// grids: live-baked thumbnails (the real painter output) grouped by material
// shelf, with visible names, category/search, selection preview, pins/recents
// and an optional hover card. Derived entirely
// from starterTiles ∩ VILLAGE_TERRAIN (mapEditFamilies) — no hardcoded lists.
// Right-click a tile to pin it. Deck state (pins/recents) is deck-internal,
// so MapEditToolbarProps is untouched.

import { CollectionPreview, CollectionSearch } from "../../components/ui/CollectionBrowser";
import { BrushTile, BrushHoverCard, type HoverState } from "./MapEditBrushTiles";
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

export function MapEditBrushDeck({ selected, onSelect }: MapEditBrushDeckProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
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
  useEffect(() => setHover(null), [query, category, pins, recents]);

  const groups = useMemo(() => buildBrushDeckGroups(), []);
  const byFamily = useMemo(() => new Map(PAINT_FAMILIES.map((entry) => [entry.family, entry])), []);
  const filtered =
    query.trim() || category
      ? filterBrushEntries(
          PAINT_FAMILIES.filter((entry) => !category || entry.material === category),
          query,
        )
      : null;
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
    <div className="collection-browser">
      <p className="jrpg-text-small" style={{ margin: "0 0 4px", color: "var(--jrpg-gold)" }}>
        Brush: <span style={{ color: "var(--jrpg-white)" }}>{armed ? armed.name : selected}</span>
      </p>
      {armed && (
        <CollectionPreview
          label="Selected material"
          name={armed.name}
          imageUrl={peekBrushThumbnail(armed.assetId)?.preview}
          fill={armed.fill}
          detail={armed.note}
        />
      )}
      {armed && (
        <button
          type="button"
          className="terrain-brush-pin"
          aria-pressed={pins.includes(selected)}
          onClick={() => togglePin(selected)}
        >
          {pins.includes(selected) ? "Unpin" : "Pin"} {armed.name}
        </button>
      )}
      <label className="collection-search">
        Material category
        <select
          className="collection-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All materials</option>
          {groups.map((group) => (
            <option key={group.material} value={group.material}>
              {group.label}
            </option>
          ))}
        </select>
      </label>
      <CollectionSearch
        label="Search brushes"
        value={query}
        onChange={setQuery}
        placeholder="Search this category"
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
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "4px",
} as const;

const emptyStyle = { margin: 0, color: "var(--jrpg-white)", opacity: 0.7 } as const;
