import { useEffect, useId, useRef, useState } from "react";
import type { MapLayer, MapLayerUpdate } from "@herobyte/shared";

const ADJUST_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
/** Lighting and Layers both edit the same authoritative opacity value. */
export function AmbientLightControl({
  layers,
  saving,
  error,
  onUpdateLayer,
}: {
  layers: MapLayer[];
  saving: boolean;
  error?: string | null;
  onUpdateLayer: (id: string, update: MapLayerUpdate) => void;
}) {
  const lighting = layers.find((layer) => layer.kind === "lighting");
  const endpointsId = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const gesture = useRef<"pointer" | "keyboard" | null>(null);
  const cancel = () => {
    gesture.current = null;
    pending.current = null;
    setDraft(null);
  };
  useEffect(() => {
    if (!saving && gesture.current === null) {
      pending.current = null;
      setDraft(null);
    }
  }, [saving, lighting?.opacity, error]);
  const commit = () => {
    const value = pending.current;
    gesture.current = null;
    pending.current = null;
    if (value === null) return;
    if (!lighting || saving || value === lighting.opacity) {
      setDraft(null);
      return;
    }
    onUpdateLayer(lighting.id, { opacity: value });
  };
  const value = draft ?? lighting?.opacity ?? 1;
  return (
    <div
      className="mobile-tool-sheet__section"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        font: "12px/1.4 system-ui, sans-serif",
        color: "var(--jrpg-white)",
      }}
    >
      {lighting ? (
        <label style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span>Ambient light — {Math.round(value * 100)}%</span>
          <input
            aria-label="Ambient light"
            aria-valuetext={`${Math.round(value * 100)}%`}
            aria-describedby={endpointsId}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value}
            // Waiting for the server is said with aria-disabled, never `disabled`: a browser
            // takes focus off a control that becomes disabled, and a keyboard user stepping the
            // slider would be put back at the top of the page after every step.
            aria-disabled={saving || undefined}
            onChange={(event) => {
              if (saving) return;
              pending.current = Number(event.target.value);
              setDraft(pending.current);
              // Assistive changes without a pointer/key gesture commit directly.
              if (gesture.current === null) commit();
            }}
            onPointerDown={(event) => {
              gesture.current = "pointer";
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerUp={commit}
            onPointerCancel={cancel}
            onLostPointerCapture={() => {
              if (gesture.current === "pointer") cancel();
            }}
            onKeyDown={(event) => {
              if (ADJUST_KEYS.has(event.key)) gesture.current = "keyboard";
              if (event.key === "Escape") cancel();
            }}
            onKeyUp={(event) => {
              if (ADJUST_KEYS.has(event.key)) commit();
            }}
            onBlur={commit}
            style={{ width: "100%", minWidth: 44, minHeight: 44, margin: 0, touchAction: "none" }}
          />
          <span id={endpointsId}>Dark → Daylight</span>
        </label>
      ) : (
        <p>Open a map with a Lighting layer to adjust ambient light.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {lighting && !lighting.visible && (
        <p>
          Lighting is hidden. Show the Lighting layer in Layers to see ambient light and light
          pools.
        </p>
      )}
      <p style={{ margin: 0 }}>
        Tap or click the map to place a light pool. Lower ambient light makes pools glow.
      </p>
    </div>
  );
}
