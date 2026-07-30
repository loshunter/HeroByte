// ============================================================================
// MAP-EDIT QUICK WHEEL (P5 — the delighter)
// ============================================================================
// Right-click on the canvas in map-edit mode → a radial menu at the cursor:
// the four everyday tools plus four brushes (pins → recents → shelf order),
// dispatching through the SAME setters the palette uses. Brush picks feed
// the deck's Recent shelf. Escape and outside-click close it — the Escape
// listener runs in the CAPTURE phase so the tool-closing window listener
// never sees the keystroke. Desktop right-click only; the long-press touch
// variant is a recorded deferral.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { pushBrushRecent } from "./brushDeck";
import {
  getBrushThumbnailVersion,
  peekBrushThumbnail,
  requestBrushThumbnails,
  subscribeBrushThumbnails,
} from "./brushThumbnails";
import { buildWheelSlots, toolAfterBrushPick, type WheelSlot } from "./mapEditWheel";
import type { MapEditFloorFamily, MapEditSubTool } from "./mapEditTypes";

interface MapEditQuickWheelProps {
  /** Cursor position, viewport px (clamped so the wheel stays on-screen). */
  x: number;
  y: number;
  activeSubTool: MapEditSubTool;
  floorFamily: MapEditFloorFamily;
  onSelectSubTool: (tool: MapEditSubTool) => void;
  onSelectFloorFamily: (family: MapEditFloorFamily) => void;
  onClose: () => void;
}

const RADIUS = 68;
const SLOT = 46;
/** Wheel footprint half-size — the clamp margin that keeps it on-screen. */
const HALF = RADIUS + SLOT / 2 + 6;

export function MapEditQuickWheel({
  x,
  y,
  activeSubTool,
  floorFamily,
  onSelectSubTool,
  onSelectFloorFamily,
  onClose,
}: MapEditQuickWheelProps) {
  const slots = useMemo(() => buildWheelSlots(), []);
  const [hovered, setHovered] = useState<string | null>(null);
  useSyncExternalStore(subscribeBrushThumbnails, getBrushThumbnailVersion, () => 0);

  useEffect(() => {
    requestBrushThumbnails(
      slots.flatMap((slot) => (slot.kind === "brush" ? [slot.entry.assetId] : [])),
    );
  }, [slots]);

  // Escape closes the WHEEL only: capture phase beats the window-level
  // tool-closing listener (useToolMode), which listens in the bubble phase.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        // Belt and braces: a synthetic Escape dispatched ON window collapses
        // the phases into at-target order — stop same-node listeners too.
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [onClose]);

  const cx = Math.max(HALF, Math.min(x, window.innerWidth - HALF));
  const cy = Math.max(HALF, Math.min(y, window.innerHeight - HALF));

  const pick = (slot: WheelSlot): void => {
    if (slot.kind === "tool") {
      onSelectSubTool(slot.tool);
    } else {
      onSelectFloorFamily(slot.entry.family);
      onSelectSubTool(toolAfterBrushPick(activeSubTool));
      pushBrushRecent(slot.entry.family); // feeds the deck's Recent shelf
    }
    onClose();
  };

  return (
    <>
      <div
        style={backdropStyle}
        onPointerDown={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div role="menu" aria-label="Quick wheel" style={{ ...wheelStyle, left: cx, top: cy }}>
        {slots.map((slot, index) => {
          const angle = ((-90 + index * 45) * Math.PI) / 180;
          const left = Math.cos(angle) * RADIUS - SLOT / 2;
          const top = Math.sin(angle) * RADIUS - SLOT / 2;
          const key = slot.kind === "tool" ? slot.tool : slot.entry.family;
          const name = slot.kind === "tool" ? slot.label : slot.entry.name;
          const active =
            slot.kind === "tool" ? activeSubTool === slot.tool : floorFamily === slot.entry.family;
          return (
            <button
              key={key}
              type="button"
              role="menuitem"
              title={name}
              onClick={() => pick(slot)}
              onMouseEnter={() => setHovered(name)}
              onMouseLeave={() => setHovered(null)}
              style={{
                ...slotStyle,
                left,
                top,
                border: active ? "2px solid var(--jrpg-gold)" : "2px solid #4a4636",
                background:
                  slot.kind === "brush" ? slot.entry.fill : "var(--jrpg-panel-dark, #1a1d29)",
              }}
            >
              {slot.kind === "tool" ? (
                <span style={{ fontSize: "16px" }}>{slot.icon}</span>
              ) : (
                <BrushFace assetId={slot.entry.assetId} pinned={slot.pinned} />
              )}
            </button>
          );
        })}
        <div className="jrpg-text-small" style={hubStyle}>
          {hovered ?? "⚡"}
        </div>
      </div>
    </>
  );
}

function BrushFace({ assetId, pinned }: { assetId: string; pinned: boolean }) {
  const baked = peekBrushThumbnail(assetId);
  return (
    <>
      {baked && <img src={baked.thumb} alt="" draggable={false} style={faceImageStyle} />}
      {pinned && <span style={pinBadgeStyle}>★</span>}
    </>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1190,
  background: "transparent",
} as const;

const wheelStyle = {
  position: "fixed",
  zIndex: 1200,
  width: 0,
  height: 0,
} as const;

const slotStyle = {
  position: "absolute",
  width: `${SLOT}px`,
  height: `${SLOT}px`,
  borderRadius: "50%",
  cursor: "pointer",
  padding: 0,
  overflow: "hidden",
  boxShadow: "0 3px 8px rgba(0, 0, 0, 0.6)",
} as const;

const hubStyle = {
  position: "absolute",
  left: "-44px",
  top: "-12px",
  width: "88px",
  textAlign: "center",
  color: "var(--jrpg-gold)",
  background: "var(--jrpg-panel-dark, #1a1d29)",
  border: "1px solid var(--jrpg-gold)",
  borderRadius: "4px",
  padding: "3px 2px",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

const faceImageStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
} as const;

const pinBadgeStyle = {
  position: "absolute",
  top: "1px",
  right: "5px",
  color: "var(--jrpg-gold)",
  fontSize: "10px",
  textShadow: "0 1px 2px #000",
  pointerEvents: "none",
} as const;
