// ============================================================================
// TOKEN LIBRARY
// ============================================================================
// The bundled token pack as a picker: a Monsters/Townsfolk switch, a family
// select, a search box, and a grid of thumbnails. It knows nothing about NPCs
// — the NPCs tab adds a picked token as a new NPC, the NPC editor swaps an
// existing one's art — so one panel serves both, and the caller's `hint` says
// which it is doing.

import { useId, useMemo, useState } from "react";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import {
  LIBRARY_ASSETS,
  LIBRARY_CATEGORIES,
  LIBRARY_FAMILIES,
  libraryThumbUrl,
  searchLibrary,
  type LibraryAsset,
  type LibraryCategory,
} from "./tokenCatalog";

interface TokenLibraryProps {
  /** Called with the picked token; the caller decides what a pick means. */
  onPick: (asset: LibraryAsset) => void;
  /** One line above the grid saying what a pick will do. */
  hint: string;
  disabled?: boolean;
}

type CategoryChoice = LibraryCategory | "";

export function TokenLibrary({ onPick, hint, disabled = false }: TokenLibraryProps) {
  const [category, setCategory] = useState<CategoryChoice>("");
  const [family, setFamily] = useState("");
  const [query, setQuery] = useState("");
  const familyId = useId();
  const searchId = useId();
  const families = useMemo(
    () => LIBRARY_FAMILIES.filter((entry) => !category || entry.category === category),
    [category],
  );
  const results = useMemo(
    () => searchLibrary({ category, family, query }),
    [category, family, query],
  );

  // A family belongs to one category, so switching category drops a family
  // that is no longer listed rather than filtering to nothing.
  const chooseCategory = (next: CategoryChoice) => {
    setCategory(next);
    if (family && next && LIBRARY_FAMILIES.find((f) => f.id === family)?.category !== next) {
      setFamily("");
    }
  };

  return (
    <div data-testid="token-library" style={panelStyle}>
      <div style={chipRowStyle} role="group" aria-label="Token category">
        {[{ id: "" as const, label: "All" }, ...LIBRARY_CATEGORIES].map((choice) => (
          <JRPGButton
            key={choice.id || "all"}
            variant={category === choice.id ? "primary" : "default"}
            aria-pressed={category === choice.id}
            onClick={() => chooseCategory(choice.id)}
            style={chipStyle}
          >
            {choice.label}
          </JRPGButton>
        ))}
      </div>
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
            {families.map((entry) => (
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
            placeholder="goblin archer, drunk dwarf, kid…"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            style={fieldStyle}
          />
        </div>
      </div>

      <p className="jrpg-text-small" style={hintStyle} aria-live="polite">
        {hint} · {results.length} of {LIBRARY_ASSETS.length} tokens
      </p>

      {results.length === 0 ? (
        <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
          No tokens match. Try a shorter word, another family, or the other category.
        </p>
      ) : (
        <div style={gridStyle}>
          {results.map((asset) => (
            <button
              key={asset.id}
              type="button"
              title={[asset.name, asset.size, asset.description].filter(Boolean).join(" · ")}
              disabled={disabled}
              onClick={() => onPick(asset)}
              style={cellStyle}
            >
              {/* The 84px thumb at its natural size — one pixel per pixel-15
                  cell, so nothing is resampled — and lazy, so only the visible
                  rows decode. The caption is the accessible name; the picture
                  adds nothing a screen reader could use. */}
              <img
                src={libraryThumbUrl(asset)}
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

const chipRowStyle = { display: "flex", gap: "6px", flexWrap: "wrap" } as const;

const chipStyle = { fontSize: "9px", padding: "5px 10px" } as const;

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
  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
  gap: "6px",
  maxHeight: "300px",
  overflowY: "auto",
  padding: "2px",
} as const;

// 84px picture plus caption: comfortably over the 44px touch floor without
// leaning on the coarse-pointer rule, which only reaches .jrpg-button.
const cellStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3px",
  minWidth: "84px",
  minHeight: "84px",
  padding: "4px",
  background: "var(--jrpg-panel, #232638)",
  border: "1px solid var(--jrpg-border-gold, #8a7445)",
  borderRadius: "4px",
  color: "var(--jrpg-white)",
  cursor: "pointer",
} as const;

const thumbStyle = {
  width: "84px",
  height: "84px",
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
