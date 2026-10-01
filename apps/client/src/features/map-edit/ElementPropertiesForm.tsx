import { useState } from "react";
import type { MapElement, MapLayer } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../map-studio/starterTiles";
import { uploadHashFromAssetId } from "../map-studio/uploads/assetUpload";
import { myStuffAssetName } from "../map-studio/uploads/myStuffStore";
import type { PropertyView } from "./elementProperties";
import "./elementProperties.css";

const LABELS: Record<MapElement["type"], string> = {
  tile: "Floor tile",
  stamp: "Object",
  shape: "Shape",
  wall: "Wall",
  door: "Door",
  light: "Light",
  text: "Text",
  spline: "Rope / curve",
};
function assetName(assetId: string) {
  const hash = uploadHashFromAssetId(assetId);
  if (!hash) return getMapStudioTileAsset(assetId).name;
  const name = myStuffAssetName(hash)?.trim();
  return `${name || "Uploaded image"} · ${hash.slice(0, 12)}`;
}
export function ElementPropertiesSummary({
  element,
  layers,
}: {
  element: MapElement;
  layers: MapLayer[];
}) {
  const name =
    element.type === "tile" || element.type === "stamp"
      ? assetName(element.data.assetId)
      : element.type === "text"
        ? element.data.text
        : LABELS[element.type];
  const layer = layers.find((item) => item.id === element.layerId)?.name ?? "Unknown layer";
  return (
    <p className="properties-summary">
      <strong>Properties · {LABELS[element.type]}</strong>
      <span>
        {name} · {layer}
      </span>
      {element.locked && <span>Locked element</span>}
    </p>
  );
}

export function PropertySaveActions({
  properties,
  mobile = false,
  disabled = false,
}: {
  properties: PropertyView;
  mobile?: boolean;
  disabled?: boolean;
}) {
  const { navigation, recovery } = properties;
  return (
    <div className="properties-actions">
      <p role="status">{properties.message}</p>
      {recovery && (
        <div className="properties-recovery">
          <button
            type="button"
            disabled={properties.pending || recovery.refreshing}
            onClick={recovery.refresh}
          >
            {recovery.refreshing ? "Refreshing saved values…" : "Refresh saved values"}
          </button>
          {recovery.canInspect && (
            <p>
              Saved values: X {recovery.saved.x} px · Y {recovery.saved.y} px · Rotation{" "}
              {recovery.saved.rotation}° · Scale X {recovery.saved.scaleX}× · Scale Y{" "}
              {recovery.saved.scaleY}× · Layer {recovery.layerName} · Hidden from players:{" "}
              {recovery.saved.hidden ? "yes" : "no"}
              {recovery.isDoor && (
                <>
                  {" "}
                  · Door {recovery.saved.doorState}, {recovery.saved.doorWidth} px
                </>
              )}
              .
            </p>
          )}
          <button
            type="button"
            disabled={properties.pending || !recovery.canInspect}
            onClick={recovery.inspect}
          >
            I&apos;ve checked the saved values
          </button>
        </div>
      )}
      {navigation && <p>Save or discard this draft before changing selection, or keep editing.</p>}
      <div className="properties-action-row">
        <button
          type="button"
          data-testid={mobile ? "mobile-inspector-apply" : undefined}
          disabled={disabled || !properties.canSave}
          onClick={navigation?.save ?? properties.save}
        >
          {properties.pending ? "Saving changes…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={!properties.dirty || properties.pending || properties.uncertain}
          onClick={navigation?.discard ?? properties.discard}
        >
          Discard changes
        </button>
        {navigation && (
          <button type="button" onClick={navigation.keep}>
            Keep editing
          </button>
        )}
      </div>
    </div>
  );
}

export function ElementPropertiesForm({
  element,
  layers,
  properties,
  disabled,
  mobile = false,
}: {
  element: MapElement;
  layers: MapLayer[];
  properties: PropertyView;
  disabled: boolean;
  mobile?: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  const values = properties.values;
  const numeric = (
    field: "x" | "y" | "scaleX" | "scaleY" | "rotation" | "doorWidth",
    raw: string,
  ) => {
    // Keep incomplete native number input (including a leading minus) empty,
    // not a coerced zero. NaN stays in the draft and blocks Save until valid.
    properties.change(field, raw.trim() === "" ? Number.NaN : Number(raw));
  };
  const rotate = (steps: number) =>
    properties.change("rotation", (values.rotation + steps * 15 + 360) % 360);
  const steppedScale = (value: number, steps: number) =>
    Math.max(0.1, Number((value + steps * 0.1).toFixed(2)));
  const canResize = (steps: number) =>
    [values.scaleX, values.scaleY].every((value) => {
      const next = steppedScale(value, steps);
      return (
        Number.isFinite(value) &&
        value > 0 &&
        Number.isFinite(next) &&
        (steps > 0 ? next > value : next < value)
      );
    });
  const resize = (steps: number) => {
    if (!canResize(steps)) return;
    properties.change("scaleX", steppedScale(values.scaleX, steps));
    properties.change("scaleY", steppedScale(values.scaleY, steps));
  };
  return (
    <div className="properties-form">
      <fieldset disabled={disabled || properties.pending || properties.uncertain || element.locked}>
        <legend>Selected properties</legend>
        <div className="properties-grid">
          <label>
            Layer
            <select
              aria-label="Element layer"
              value={values.layerId}
              onChange={(event) => properties.change("layerId", event.target.value)}
            >
              {layers
                .filter((layer) => !layer.locked || layer.id === element.layerId)
                .map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="properties-checkbox">
            <input
              aria-label="Hide element"
              type="checkbox"
              checked={values.hidden}
              onChange={(event) => properties.change("hidden", event.target.checked)}
            />
            Hidden from players
          </label>
        </div>
        {element.type === "door" && (
          <div className="properties-grid">
            <label>
              Door state
              <select
                aria-label="Door state"
                value={values.doorState}
                onChange={(event) =>
                  properties.change("doorState", event.target.value as typeof values.doorState)
                }
              >
                <option value="closed">Closed</option>
                <option value="open">Open</option>
                <option value="locked">Locked</option>
                <option value="secret">Secret</option>
              </select>
            </label>
            <label>
              Width (px)
              <input
                aria-label="Door width (px)"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={Number.isFinite(values.doorWidth) ? values.doorWidth : ""}
                onChange={(event) => numeric("doorWidth", event.target.value)}
              />
            </label>
          </div>
        )}
        <button type="button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
          Position and scale
        </button>
        {advanced && (
          <div>
            <p>
              Rotation — {Number.isFinite(values.rotation) ? Math.round(values.rotation) : "—"}° ·
              Size — {Number.isFinite(values.scaleX) ? Math.round(values.scaleX * 100) : "—"}%
            </p>
            {mobile && (
              <div className="properties-grid">
                <button
                  type="button"
                  aria-label="Turn element counter-clockwise"
                  onClick={() => rotate(-1)}
                >
                  ↺ −15°
                </button>
                <button type="button" aria-label="Turn element clockwise" onClick={() => rotate(1)}>
                  ↻ +15°
                </button>
                <button
                  type="button"
                  aria-label="Shrink element"
                  disabled={!canResize(-1)}
                  onClick={() => resize(-1)}
                >
                  − Smaller
                </button>
                <button
                  type="button"
                  aria-label="Grow element"
                  disabled={!canResize(1)}
                  onClick={() => resize(1)}
                >
                  + Bigger
                </button>
              </div>
            )}
            <div className="properties-grid">
              {(
                [
                  ["x", "X (px)", 1],
                  ["y", "Y (px)", 1],
                  ["scaleX", "Scale X (×)", 0.05],
                  ["scaleY", "Scale Y (×)", 0.05],
                  ["rotation", "Rotation (°)", 1],
                ] as const
              ).map(([field, label, step]) => (
                <label key={field}>
                  {label}
                  <input
                    aria-label={label}
                    type="number"
                    step={step}
                    value={Number.isFinite(values[field]) ? values[field] : ""}
                    onChange={(event) => numeric(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>
      {element.type === "door" && (
        <p>
          A save with both properties and door settings uses two operations and may need two Undo
          map edit actions.
        </p>
      )}
      <PropertySaveActions
        properties={properties}
        mobile={mobile}
        disabled={disabled || element.locked}
      />
    </div>
  );
}
