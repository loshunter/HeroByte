// ============================================================================
// TOKEN LIBRARY
// ============================================================================
// The bundled token pack, and the table's own tokens beside it, as a picker:
// a Monsters/Townsfolk/Custom switch, a family select, a search box, and a
// grid of thumbnails. It knows nothing about NPCs — the NPCs tab adds a picked
// token as a new NPC, the NPC editor swaps an existing one's art — so one
// panel serves both, and the caller's `hint` says which it is doing. The
// table's own tokens arrive through CustomTokensContext, marked apart from
// pack art by colour and a badge.

import { useId, useMemo, useState } from "react";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { CustomTokenForm } from "./CustomTokenForm";
import { useCustomTokensApi } from "./customTokensContext";
import {
  LIBRARY_ASSETS,
  LIBRARY_CATEGORIES,
  LIBRARY_FAMILIES,
  customItem,
  packItem,
  searchCustomTokens,
  searchLibrary,
  type LibraryCategory,
  type LibraryItem,
} from "./tokenCatalog";

interface TokenLibraryProps {
  /** Called with the picked token; the caller decides what a pick means. */
  onPick: (item: LibraryItem) => void;
  /** One line above the grid saying what a pick will do. */
  hint: string;
  disabled?: boolean;
}

type CategoryChoice = LibraryCategory | "custom" | "";

const CHOICES: readonly { id: CategoryChoice; label: string }[] = [
  { id: "", label: "All" },
  ...LIBRARY_CATEGORIES,
  { id: "custom", label: "Custom" },
];

export function TokenLibrary({ onPick, hint, disabled = false }: TokenLibraryProps) {
  const { tokens: customTokens, addToken, removeToken } = useCustomTokensApi();
  const [category, setCategory] = useState<CategoryChoice>("");
  const [family, setFamily] = useState("");
  const [query, setQuery] = useState("");
  const familyId = useId();
  const searchId = useId();
  const families = useMemo(
    () => LIBRARY_FAMILIES.filter((entry) => !category || entry.category === category),
    [category],
  );
  // The table's own tokens lead when they show: they are few, and they are
  // the ones this DM made. A family narrows pack art only.
  const results = useMemo<LibraryItem[]>(() => {
    const own =
      (category === "" || category === "custom") && !family
        ? searchCustomTokens(customTokens, query).map(customItem)
        : [];
    const pack =
      category === "custom" ? [] : searchLibrary({ category, family, query }).map(packItem);
    return [...own, ...pack];
  }, [category, family, query, customTokens]);
  const total = LIBRARY_ASSETS.length + customTokens.length;

  // A family belongs to one category, so switching category drops a family
  // that is no longer listed rather than filtering to nothing.
  const chooseCategory = (next: CategoryChoice) => {
    setCategory(next);
    if (family && next && LIBRARY_FAMILIES.find((f) => f.id === family)?.category !== next) {
      setFamily("");
    }
  };

  const remove = (item: LibraryItem) => {
    if (!removeToken) return;
    if (window.confirm(`Remove "${item.name}" from this table's library?`)) removeToken(item.id);
  };

  return (
    <div data-testid="token-library" style={panelStyle}>
      <div style={chipRowStyle} role="group" aria-label="Token category">
        {CHOICES.map((choice) => (
          <JRPGButton
            key={choice.id || "all"}
            variant={category === choice.id ? "primary" : "default"}
            aria-pressed={category === choice.id}
            onClick={() => chooseCategory(choice.id)}
            style={choice.id === "custom" ? customChipStyle : chipStyle}
          >
            {choice.label}
          </JRPGButton>
        ))}
      </div>
      <div style={controlsStyle}>
        {category !== "custom" && (
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
        )}
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
        {hint} · {results.length} of {total} tokens
      </p>

      {results.length === 0 ? (
        <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
          {category === "custom" && customTokens.length === 0
            ? "Nothing of your own yet. Add an image below and it joins the shelf."
            : "No tokens match. Try a shorter word, another family, or the other category."}
        </p>
      ) : (
        <div style={gridStyle}>
          {results.map((item) => (
            <div key={`${item.category}:${item.id}`} style={cellWrapStyle}>
              <button
                type="button"
                title={[item.name, item.size, item.description].filter(Boolean).join(" · ")}
                disabled={disabled}
                onClick={() => onPick(item)}
                style={item.custom ? customCellStyle : cellStyle}
              >
                {/* A pack thumb is 84px at its natural size — one pixel per
                    pixel-15 cell, nothing resampled — and lazy, so only the
                    visible rows decode. The caption is the accessible name;
                    the picture adds nothing a screen reader could use. */}
                <img
                  src={item.thumbUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={thumbStyle}
                />
                <span style={captionStyle}>{item.name}</span>
              </button>
              {item.custom && <span style={badgeStyle}>MINE</span>}
              {item.custom && removeToken && (
                <button
                  type="button"
                  aria-label={`Remove ${item.name} from the library`}
                  title="Remove from this table's library"
                  disabled={disabled}
                  onClick={() => remove(item)}
                  style={removeStyle}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {category === "custom" && addToken && (
        <CustomTokenForm onAdd={addToken} disabled={disabled} />
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

// The custom chip and the custom cells share one colour — cyan, the palette's
// highlight — so "this is yours, not the pack's" reads the same everywhere.
const customChipStyle = { ...chipStyle, borderColor: "var(--jrpg-cyan, #00e0d1)" } as const;

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

const cellWrapStyle = { position: "relative", display: "flex" } as const;

// 84px picture plus caption: comfortably over the 44px touch floor without
// leaning on the coarse-pointer rule, which only reaches .jrpg-button.
const cellStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3px",
  flex: 1,
  minWidth: "84px",
  minHeight: "84px",
  padding: "4px",
  background: "var(--jrpg-panel, #232638)",
  border: "1px solid var(--jrpg-border-gold, #8a7445)",
  borderRadius: "4px",
  color: "var(--jrpg-white)",
  cursor: "pointer",
} as const;

const customCellStyle = {
  ...cellStyle,
  border: "2px solid var(--jrpg-cyan, #00e0d1)",
  boxShadow: "inset 0 0 0 1px rgba(0, 224, 209, 0.25)",
} as const;

const badgeStyle = {
  position: "absolute",
  top: "4px",
  left: "4px",
  padding: "1px 4px",
  fontFamily: "var(--font-body)",
  fontSize: "8px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  color: "var(--jrpg-navy, #0f0e1e)",
  background: "var(--jrpg-cyan, #00e0d1)",
  borderRadius: "3px",
  pointerEvents: "none",
} as const;

const removeStyle = {
  position: "absolute",
  top: "2px",
  right: "2px",
  width: "22px",
  height: "22px",
  padding: 0,
  fontSize: "11px",
  lineHeight: "20px",
  color: "var(--jrpg-white)",
  background: "var(--jrpg-navy, #0f0e1e)",
  border: "1px solid var(--jrpg-cyan, #00e0d1)",
  borderRadius: "3px",
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
