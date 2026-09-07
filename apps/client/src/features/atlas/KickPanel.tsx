// ============================================================================
// KICK PANEL — "🚪 Kick in a door"
// ============================================================================
// The fields of plan §1.1: a prefilled name, the recipe's dials, a seed with
// ⟳, the door type, and ROLL. Rendered by BOTH layouts (a floating JRPG panel
// on desktop, a full screen on a phone) from the same KickControls; the panel
// owns its form state only — the pending kick is the hook's, App-level, and
// survives a layout crossing. Enter rolls, Escape closes.

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type {
  AtlasNodeSnapshot,
  DungeonRecipeParams,
  GenerateSize,
  MapLink,
} from "@herobyte/shared";
import { JRPGButton, JRPGPanel } from "../../components/ui/JRPGPanel";
import { defaultName, freshSeed } from "./kickDefaults";
import type { KickControls } from "./useKickedInDoor";

export const KICK_NEEDS_LIVE_MAP = "Start a live map first (🏗️ MAP → START LIVE MAP)";

export interface KickPanelProps {
  kick: KickControls;
  atlasNodes: readonly Pick<AtlasNodeSnapshot, "name">[];
  /** "panel" floats (desktop); "content" is bare for a phone screen. */
  presentation?: "panel" | "content";
}

// No inline min-height, deliberately: the mobile touch floor is ONE
// `(pointer: coarse)` rule giving every control inside a mobile surface a
// 44px min-height, and an inline min-* beats a stylesheet rule — which is the
// whole reason that floor uses min-* rather than padding. A 28px inline height
// here put all five of this panel's dials under the floor on a phone.
const selectStyle = { fontSize: "11px" } as const;
const labelStyle = {
  fontSize: "9px",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
} as const;

export function KickPanel({ kick, atlasNodes, presentation = "panel" }: KickPanelProps) {
  const { settings, pending, canKick } = kick;
  const [name, setName] = useState(() => defaultName(atlasNodes, settings.recipe));
  const [theme, setTheme] = useState<DungeonRecipeParams["theme"]>(settings.recipe.theme);
  const [density, setDensity] = useState<DungeonRecipeParams["density"]>(settings.recipe.density);
  const [size, setSize] = useState<GenerateSize>(settings.recipe.size);
  const [seed, setSeed] = useState<number>(freshSeed);
  const [linkType, setLinkType] = useState<MapLink["linkType"]>(settings.linkType);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  const kicking = Boolean(pending && !pending.expired);
  const rollDisabled = !canKick || kicking || !name.trim();

  const roll = (event?: FormEvent) => {
    event?.preventDefault();
    if (rollDisabled) return;
    kick.kick({
      name,
      seed,
      recipe: { recipeId: "dungeon", theme, density, size },
      linkType,
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      kick.closeKick();
    }
  };

  const form = (
    <form
      // The host owns the dialog when the panel is embedded: a MobileScreen is
      // already role="dialog" with this very title, and nesting a second one
      // inside it is two dialogs deep to a screen reader for one form.
      role={presentation === "panel" ? "dialog" : undefined}
      aria-label={presentation === "panel" ? "Kick in a door" : undefined}
      data-testid="kick-panel"
      onSubmit={roll}
      onKeyDown={onKeyDown}
      style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "260px" }}
    >
      <label style={labelStyle}>
        Name
        <input
          ref={nameRef}
          aria-label="Name"
          value={name}
          maxLength={64}
          onChange={(event) => setName(event.target.value)}
          style={{ fontSize: "11px" }}
        />
      </label>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <label style={labelStyle}>
          Recipe
          <select
            aria-label="Recipe"
            value="dungeon"
            onChange={() => undefined}
            style={selectStyle}
          >
            <option value="dungeon">dungeon</option>
          </select>
        </label>
        <label style={labelStyle}>
          Theme
          <select
            aria-label="Theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value as DungeonRecipeParams["theme"])}
            style={selectStyle}
          >
            <option value="stone">stone</option>
            <option value="wood">wood</option>
          </select>
        </label>
        <label style={labelStyle}>
          Density
          <select
            aria-label="Density"
            value={density}
            onChange={(event) => setDensity(event.target.value as DungeonRecipeParams["density"])}
            style={selectStyle}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label style={labelStyle}>
          Size
          <select
            aria-label="Size"
            value={size}
            onChange={(event) => setSize(event.target.value as GenerateSize)}
            style={selectStyle}
          >
            <option value="small">small</option>
            <option value="medium">medium</option>
            <option value="large">large</option>
          </select>
        </label>
        <label style={labelStyle}>
          Door
          <select
            aria-label="Door type"
            value={linkType}
            onChange={(event) => setLinkType(event.target.value as MapLink["linkType"])}
            style={selectStyle}
          >
            <option value="door">door</option>
            <option value="stair">stair</option>
            <option value="signpost">signpost</option>
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
        <label style={labelStyle}>
          Seed
          <input
            aria-label="Seed"
            data-testid="kick-seed"
            inputMode="numeric"
            value={seed}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isInteger(next)) setSeed(next);
            }}
            style={{ fontSize: "11px", width: "110px" }}
          />
        </label>
        <JRPGButton
          type="button"
          onClick={() => setSeed(freshSeed())}
          style={{ fontSize: "9px", padding: "6px 8px" }}
        >
          ⟳ Reroll
        </JRPGButton>
      </div>
      {!canKick && (
        <div data-testid="kick-needs-live-map" style={{ fontSize: "9px", opacity: 0.85 }}>
          {KICK_NEEDS_LIVE_MAP}
        </div>
      )}
      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
        <JRPGButton type="button" onClick={kick.closeKick} style={{ fontSize: "9px" }}>
          CANCEL
        </JRPGButton>
        <JRPGButton
          type="submit"
          variant="primary"
          disabled={rollDisabled}
          data-testid="kick-roll"
          style={{ fontSize: "10px" }}
        >
          {kicking ? "⏳ Kicking…" : "🚪 ROLL"}
        </JRPGButton>
      </div>
    </form>
  );

  if (presentation === "content") {
    return form;
  }

  return (
    // Fixed and OUTSIDE the header (the S8 stacking-context lesson): a panel
    // inside the fixed header paints under the entities panel.
    <div
      style={{
        position: "fixed",
        top: "72px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 260,
      }}
    >
      <JRPGPanel title="🚪 Kick in a door" style={{ padding: "12px" }}>
        {form}
      </JRPGPanel>
    </div>
  );
}
