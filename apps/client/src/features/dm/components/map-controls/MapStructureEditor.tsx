import { useEffect, useState } from "react";
import type { MapDocument } from "@herobyte/shared";
import { JRPGButton } from "../../../../components/ui/JRPGPanel";
import type { MapDoorDraft, MapWallDraft } from "../../../map-studio";

interface MapStructureEditorProps {
  document: MapDocument;
  disabled: boolean;
  onAddWall: (draft: MapWallDraft) => string | null;
  onAddDoor: (draft: MapDoorDraft) => string | null;
}

type StructureKind = "wall" | "door";
type DoorState = MapDoorDraft["state"];

export function MapStructureEditor({
  document,
  disabled,
  onAddWall,
  onAddDoor,
}: MapStructureEditorProps) {
  const editableLayers = document.layers.filter((layer) => !layer.locked);
  const preferredLayerId =
    editableLayers.find((layer) => layer.kind === "walls")?.id ?? editableLayers[0]?.id ?? "";
  const [layerId, setLayerId] = useState(preferredLayerId);
  const [kind, setKind] = useState<StructureKind>("wall");
  const [x1, setX1] = useState(document.grid.size);
  const [y1, setY1] = useState(document.grid.size);
  const [x2, setX2] = useState(document.grid.size * 5);
  const [y2, setY2] = useState(document.grid.size);
  const [doorWidth, setDoorWidth] = useState(document.grid.size);
  const [doorRotation, setDoorRotation] = useState(0);
  const [doorState, setDoorState] = useState<DoorState>("closed");
  const [blocksMovement, setBlocksMovement] = useState(true);
  const [blocksVision, setBlocksVision] = useState(true);

  useEffect(() => {
    if (!editableLayers.some((layer) => layer.id === layerId)) {
      setLayerId(preferredLayerId);
    }
  }, [editableLayers, layerId, preferredLayerId]);

  const add = () => {
    if (!layerId) return;
    if (kind === "wall") {
      if (x1 === x2 && y1 === y2) return;
      onAddWall({ layerId, x1, y1, x2, y2, blocksMovement, blocksVision });
      return;
    }
    if (doorWidth <= 0) return;
    onAddDoor({
      layerId,
      x: x1,
      y: y1,
      width: doorWidth,
      rotation: doorRotation,
      state: doorState,
      blocksMovement,
      blocksVision,
    });
  };

  const canAdd = Boolean(layerId) && (kind === "wall" ? x1 !== x2 || y1 !== y2 : doorWidth > 0);

  return (
    <fieldset
      disabled={disabled}
      style={{ border: "1px solid rgba(255,255,255,0.18)", padding: "8px" }}
    >
      <legend className="jrpg-text-small">Add walls and doors</legend>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        <label className="jrpg-text-small">
          Structure
          <select
            aria-label="Structure type"
            value={kind}
            onChange={(event) => setKind(event.target.value as StructureKind)}
          >
            <option value="wall">Wall segment</option>
            <option value="door">Door</option>
          </select>
        </label>
        <label className="jrpg-text-small">
          Layer
          <select
            aria-label="Structure layer"
            value={layerId}
            onChange={(event) => setLayerId(event.target.value)}
          >
            {editableLayers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </label>
        <NumberInput
          label={kind === "wall" ? "Wall start X" : "Door X"}
          value={x1}
          onChange={setX1}
        />
        <NumberInput
          label={kind === "wall" ? "Wall start Y" : "Door Y"}
          value={y1}
          onChange={setY1}
        />
        {kind === "wall" ? (
          <>
            <NumberInput label="Wall end X" value={x2} onChange={setX2} />
            <NumberInput label="Wall end Y" value={y2} onChange={setY2} />
          </>
        ) : (
          <>
            <NumberInput label="Door width" value={doorWidth} minimum={1} onChange={setDoorWidth} />
            <NumberInput label="Door rotation" value={doorRotation} onChange={setDoorRotation} />
            <label className="jrpg-text-small">
              Door state
              <select
                aria-label="Door state"
                value={doorState}
                onChange={(event) => setDoorState(event.target.value as DoorState)}
              >
                <option value="closed">Closed</option>
                <option value="open">Open</option>
                <option value="locked">Locked</option>
                <option value="secret">Secret</option>
              </select>
            </label>
          </>
        )}
        <label className="jrpg-text-small">
          <input
            aria-label="Blocks movement"
            type="checkbox"
            checked={blocksMovement}
            onChange={(event) => setBlocksMovement(event.target.checked)}
          />{" "}
          Blocks movement
        </label>
        <label className="jrpg-text-small">
          <input
            aria-label="Blocks vision"
            type="checkbox"
            checked={blocksVision}
            onChange={(event) => setBlocksVision(event.target.checked)}
          />{" "}
          Blocks vision
        </label>
      </div>
      <JRPGButton
        style={{ width: "100%", marginTop: "8px", fontSize: "10px" }}
        disabled={!canAdd}
        onClick={add}
      >
        {kind === "wall" ? "ADD WALL" : "ADD DOOR"}
      </JRPGButton>
    </fieldset>
  );
}

function NumberInput({
  label,
  value,
  minimum,
  onChange,
}: {
  label: string;
  value: number;
  minimum?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="jrpg-text-small">
      {label}
      <input
        aria-label={label}
        type="number"
        min={minimum}
        value={value}
        onChange={(event) => setFinite(event.target.value, onChange)}
        style={{ width: "100%" }}
      />
    </label>
  );
}

function setFinite(raw: string, onChange: (value: number) => void): void {
  const value = Number(raw);
  if (Number.isFinite(value)) onChange(value);
}
