// ============================================================================
// MONSTER LIBRARY
// ============================================================================
// The bundled token pack as a picker: a family select, a search box, and a
// grid of thumbnails. It knows nothing about NPCs — the NPCs tab adds a picked
// monster as a new NPC, the NPC editor swaps an existing one's art — so one
// panel serves both, and the caller's `hint` says which it is doing.

import { useId, useMemo, useState } from "react";
import {
  MONSTER_ASSETS,
  MONSTER_FAMILIES,
  monsterImageUrl,
  searchMonsters,
  type MonsterAsset,
} from "./monsterCatalog";

interface MonsterLibraryProps {
  /** Called with the picked token; the caller decides what a pick means. */
  onPick: (asset: MonsterAsset) => void;
  /** One line above the grid saying what a pick will do. */
  hint: string;
  disabled?: boolean;
}

export function MonsterLibrary({ onPick, hint, disabled = false }: MonsterLibraryProps) {
  const [family, setFamily] = useState("");
  const [query, setQuery] = useState("");
  const familyId = useId();
  const searchId = useId();
  const results = useMemo(() => searchMonsters({ family, query }), [family, query]);

  return (
    <div data-testid="monster-library" style={panelStyle}>
      <div style={controlsStyle}>
        <div style={fieldGroupStyle}>
          <label htmlFor={familyId} className="jrpg-text-small">
            Family
          </label>
          <select
            id={familyId}
            value={family}
            onChange={(event) => setFamily(event.target.value)}
            style={fieldStyle}
          >
            <option value="">All families</option>
            {MONSTER_FAMILIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div style={fieldGroupStyle}>
          <label htmlFor={searchId} className="jrpg-text-small">
            Search
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="goblin, archer, mimic…"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            style={fieldStyle}
          />
        </div>
      </div>

      <p className="jrpg-text-small" style={hintStyle} aria-live="polite">
        {hint} · {results.length} of {MONSTER_ASSETS.length} monsters
      </p>

      {results.length === 0 ? (
        <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
          No monsters match. Try a shorter word or another family.
        </p>
      ) : (
        <div style={gridStyle}>
          {results.map((asset) => (
            <button
              key={asset.id}
              type="button"
              title={asset.name}
              disabled={disabled}
              onClick={() => onPick(asset)}
              style={cellStyle}
            >
              {/* Lazy on purpose: 184 full-size PNGs decode only as they scroll
                  into view. The caption is the accessible name; the picture
                  adds nothing a screen reader could use. */}
              <img
                src={monsterImageUrl(asset)}
                alt=""
                loading="lazy"
                decoding="async"
                style={thumbStyle}
              />
              <span style={captionStyle}>{asset.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const panelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "8px",
  background: "var(--jrpg-panel-dark, #1a1d29)",
  border: "1px solid var(--jrpg-gold)",
  borderRadius: "4px",
} as const;

const controlsStyle = { display: "flex", gap: "8px", flexWrap: "wrap" } as const;

const fieldGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  flex: "1 1 140px",
  fontSize: "10px",
} as const;

const fieldStyle = { fontSize: "11px", padding: "4px 6px", minWidth: 0 } as const;

const hintStyle = { margin: 0, fontSize: "10px", color: "var(--jrpg-white)", opacity: 0.85 };

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
  gap: "6px",
  maxHeight: "300px",
  overflowY: "auto",
  padding: "2px",
} as const;

// 56px picture plus caption: comfortably over the 44px touch floor without
// leaning on the coarse-pointer rule, which only reaches .jrpg-button.
const cellStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3px",
  minWidth: "56px",
  minHeight: "56px",
  padding: "4px",
  background: "var(--jrpg-panel, #232638)",
  border: "1px solid var(--jrpg-border-gold, #8a7445)",
  borderRadius: "4px",
  color: "var(--jrpg-white)",
  cursor: "pointer",
} as const;

const thumbStyle = {
  width: "56px",
  height: "56px",
  objectFit: "contain",
  imageRendering: "pixelated",
} as const;

// The body font, not the pixel heading font: at 8px Press Start 2P fits eight
// characters a line, so "Goblin club brute" clamped to "GOBLIN CLUB…" and the
// role — the one word that tells two goblins apart — was the part cut off.
const captionStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "10px",
  lineHeight: 1.2,
  textAlign: "center",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
} as const;
