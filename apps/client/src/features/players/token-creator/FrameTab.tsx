// ============================================================================
// TOKEN CREATOR — THE FRAME TAB (C5a, simple mode)
// ============================================================================
// A preset shelf by theme (Plain, Stone, Metal, Wood), the weight slider with
// its four named stops, grow in or out, the frame's colour (yours, or one you
// pick), and glow colour and strength for presets that glow, over a live
// preview on the dark map, the light map and fog at card and token size.
// Everything here edits a draft; the window's "Use this frame" sends it.
// Picking a preset copies its stack and keeps the weight, growth and colour
// chosen so far. Buttons, not radios, so the phone's 44px floor reaches them.

import { useId } from "react";
import {
  FRAME_LIMITS,
  FRAME_PRESETS,
  FRAME_WEIGHTS,
  frameHasGlow,
  frameSizeScale,
  frameUsesAccent,
  normalizeColor,
  frameWeight,
  presetFrame,
  withFrameWeight,
  type FramePresetTheme,
  type TokenFrame,
} from "@herobyte/shared";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { FramePreview, type PendingPicture, type PreviewFloor } from "./FramePreview";
import type { TokenFrameControl } from "./frameControl";

const THEMES: { theme: FramePresetTheme; label: string }[] = [
  { theme: "plain", label: "Plain" },
  { theme: "stone", label: "Stone" },
  { theme: "metal", label: "Metal" },
  { theme: "wood", label: "Wood" },
];
const WEIGHT_STOPS = Object.entries(FRAME_WEIGHTS) as [keyof typeof FRAME_WEIGHTS, number][];
const FLOORS: { floor: PreviewFloor; label: string }[] = [
  { floor: "dark", label: "dark map" },
  { floor: "light", label: "light map" },
  { floor: "fog", label: "fog" },
];
const small = { fontSize: "10px", padding: "6px 8px" } as const;
const label = { color: "var(--jrpg-gold)" } as const;
const row = { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } as const;
const capitalised = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export interface FrameTabProps {
  control: TokenFrameControl;
  /** False while the tab is hidden: its previews neither draw nor bake. */
  active?: boolean;
  /** A picture loaded on the Picture tab and not yet saved: the previews show it as cropped. */
  pending?: PendingPicture;
  draft: TokenFrame | null;
  onDraft: (frame: TokenFrame | null) => void;
}

/** The custom colour a picker should start from: the frame's own, else the token's. */
function pickerColor(value: string | undefined, fallback: string): string {
  // An older table's hsl() colour still starts the picker at that colour.
  return value && value.startsWith("#") ? value : (normalizeColor(fallback) ?? "#808080");
}

export function FrameTab({ control, active = true, pending, draft, onDraft }: FrameTabProps) {
  const ids = { weight: useId(), glow: useId() };
  const weight = draft ? frameWeight(draft) : FRAME_WEIGHTS.regular;
  const glowBand = draft?.bands.find((band) => band.glow);

  const choosePreset = (id: string) => {
    const next = presetFrame(id, weight);
    if (!next) return;
    onDraft({
      ...next,
      ...(draft?.growth ? { growth: draft.growth } : {}),
      accent: draft?.accent ?? "personal",
    });
  };
  const edit = (change: (frame: TokenFrame) => TokenFrame) => {
    if (draft) onDraft(change(draft));
  };
  const setGlow = (glow: { color?: string; strength?: number }) =>
    edit((frame) => ({
      ...frame,
      bands: frame.bands.map((band) =>
        band.glow ? { ...band, glow: { ...band.glow, ...glow } } : band,
      ),
    }));

  const preview = (edge: number, floor: PreviewFloor, where: string) => (
    <FramePreview
      key={`${floor}-${edge}`}
      frame={draft}
      tokenId={control.tokenId}
      color={control.color}
      size={control.size}
      imageUrl={control.imageUrl}
      pending={pending}
      active={active}
      edge={edge}
      floor={floor}
      label={`Preview at ${edge > 60 ? "card" : "token"} size on the ${where}`}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ ...row, justifyContent: "center" }} role="group" aria-label="Frame preview">
        {FLOORS.map(({ floor, label: where }) => (
          <div
            key={floor}
            style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}
          >
            {preview(88, floor, where)}
            {preview(40, floor, where)}
          </div>
        ))}
      </div>

      {THEMES.map(({ theme, label: name }) => (
        <div
          key={theme}
          role="group"
          aria-label={`${name} frames`}
          style={{ display: "flex", flexDirection: "column", gap: "4px" }}
        >
          <span className="jrpg-text-small" style={label}>
            {name}
          </span>
          <div style={row}>
            {FRAME_PRESETS.filter((preset) => preset.theme === theme).map((preset) => (
              <JRPGButton
                key={preset.id}
                onClick={() => choosePreset(preset.id)}
                aria-pressed={draft?.preset === preset.id}
                variant={draft?.preset === preset.id ? "primary" : "default"}
                style={small}
              >
                {preset.name}
              </JRPGButton>
            ))}
          </div>
        </div>
      ))}
      <JRPGButton
        onClick={() => onDraft(null)}
        aria-pressed={draft === null}
        variant={draft === null ? "primary" : "default"}
        title="No frame: the token as it was before frames, a rounded square"
        style={small}
      >
        No frame
      </JRPGButton>

      {draft && (
        <>
          <label htmlFor={ids.weight} className="jrpg-text-small" style={label}>
            Weight
          </label>
          <input
            id={ids.weight}
            type="range"
            min={FRAME_LIMITS.MIN_WEIGHT}
            max={FRAME_LIMITS.MAX_WEIGHT}
            step={0.01}
            value={weight}
            aria-valuetext={`${Math.round(weight * frameSizeScale(control.size) * 100)}% of the token's edge`}
            onChange={(event) =>
              edit((frame) => withFrameWeight(frame, Number(event.target.value)))
            }
          />
          <div style={row} role="group" aria-label="Weight presets">
            {WEIGHT_STOPS.map(([name, value]) => (
              <JRPGButton
                key={name}
                onClick={() => edit((frame) => withFrameWeight(frame, value))}
                aria-pressed={Math.abs(weight - value) < 0.005}
                variant={Math.abs(weight - value) < 0.005 ? "primary" : "default"}
                style={small}
              >
                {capitalised(name)}
              </JRPGButton>
            ))}
          </div>

          <div style={row} role="group" aria-label="Growth">
            {(["in", "out"] as const).map((growth) => (
              <JRPGButton
                key={growth}
                onClick={() => edit((frame) => ({ ...frame, growth }))}
                aria-pressed={(draft.growth ?? "in") === growth}
                variant={(draft.growth ?? "in") === growth ? "primary" : "default"}
                title={
                  growth === "in"
                    ? "The frame sits inside the token's square"
                    : "The frame grows outside the token's square"
                }
                style={small}
              >
                Grow {growth}
              </JRPGButton>
            ))}
          </div>

          {!frameUsesAccent(draft) && (
            <span className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
              This material has its own colours.
            </span>
          )}
          {frameUsesAccent(draft) && (
            <div style={row} role="group" aria-label="Frame colour">
              <JRPGButton
                onClick={() => edit((frame) => ({ ...frame, accent: "personal" }))}
                aria-pressed={(draft.accent ?? "personal") === "personal"}
                variant={(draft.accent ?? "personal") === "personal" ? "primary" : "default"}
                style={small}
              >
                Your colour
              </JRPGButton>
              <input
                type="color"
                aria-label="Custom frame colour"
                value={pickerColor(draft.accent, control.color)}
                onChange={(event) =>
                  edit((frame) => ({ ...frame, accent: event.target.value.toLowerCase() }))
                }
              />
            </div>
          )}

          {frameHasGlow(draft) && glowBand?.glow && (
            <>
              <div style={row} role="group" aria-label="Glow colour">
                <JRPGButton
                  onClick={() => setGlow({ color: "personal" })}
                  aria-pressed={glowBand.glow.color === "personal"}
                  variant={glowBand.glow.color === "personal" ? "primary" : "default"}
                  style={small}
                >
                  Glow: your colour
                </JRPGButton>
                <input
                  type="color"
                  aria-label="Custom glow colour"
                  value={pickerColor(glowBand.glow.color, control.color)}
                  onChange={(event) => setGlow({ color: event.target.value.toLowerCase() })}
                />
              </div>
              <label htmlFor={ids.glow} className="jrpg-text-small" style={label}>
                Glow strength
              </label>
              <input
                id={ids.glow}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={glowBand.glow.strength}
                aria-valuetext={`${Math.round(glowBand.glow.strength * 100)}%`}
                onChange={(event) => setGlow({ strength: Number(event.target.value) })}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
