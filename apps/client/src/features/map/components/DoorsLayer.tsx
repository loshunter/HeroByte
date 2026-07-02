// ============================================================================
// DOORS LAYER COMPONENT
// ============================================================================
// Renders the compiled scene's doors as clickable sprites on the live map.
// Doors live in map-document coordinates, so the layer nests the same two
// transform groups as MapImageLayer (camera, then map transform) to stay
// pixel-aligned with the published background.

import { Fragment } from "react";
import { Group, Line, Rect } from "react-konva";
import type Konva from "konva";
import type { CompiledDoor, CompiledDoorState, SceneObjectTransform } from "@herobyte/shared";
import type { Camera } from "../types";

interface DoorsLayerProps {
  cam: Camera;
  doors: CompiledDoor[];
  mapTransform?: SceneObjectTransform;
  isDM: boolean;
  /** Click: flip open/closed (server enforces lock/secret rules). */
  onToggleDoor: (doorId: string) => void;
  /** DM alt-click: lock cycle (closed/open -> locked -> closed, secret -> revealed). */
  onSetDoorState: (doorId: string, state: CompiledDoorState) => void;
}

const FRAME_COLOR = "#4a3b28";
const DOOR_COLOR = "#c99b55";
const LOCK_COLOR = "#ffd75e";
const SECRET_COLOR = "#7ce0d3";

export function DoorsLayer({
  cam,
  doors,
  mapTransform,
  isDM,
  onToggleDoor,
  onSetDoorState,
}: DoorsLayerProps) {
  if (!doors.length) return null;

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation}>
        {doors.map((door) => (
          <DoorSprite
            key={door.id}
            door={door}
            isDM={isDM}
            onToggleDoor={onToggleDoor}
            onSetDoorState={onSetDoorState}
          />
        ))}
      </Group>
    </Group>
  );
}

interface DoorSpriteProps {
  door: CompiledDoor;
  isDM: boolean;
  onToggleDoor: (doorId: string) => void;
  onSetDoorState: (doorId: string, state: CompiledDoorState) => void;
}

function DoorSprite({ door, isDM, onToggleDoor, onSetDoorState }: DoorSpriteProps) {
  const midX = (door.x1 + door.x2) / 2;
  const midY = (door.y1 + door.y2) / 2;

  const handleActivate = (event: Konva.KonvaEventObject<MouseEvent | Event>) => {
    event.cancelBubble = true;
    const altPressed = "altKey" in event.evt && Boolean(event.evt.altKey);
    if (isDM && altPressed) {
      onSetDoorState(door.id, lockCycle(door.state));
      return;
    }
    onToggleDoor(door.id);
  };

  return (
    <Fragment>
      {door.state === "secret" ? (
        // Secret doors reach DM clients only; the server strips them from
        // player snapshots. Rendered as a dashed seam.
        <Line
          points={[door.x1, door.y1, door.x2, door.y2]}
          stroke={SECRET_COLOR}
          strokeWidth={4}
          dash={[6, 4]}
          opacity={0.85}
          listening={false}
        />
      ) : (
        <Fragment>
          <Line
            points={[door.x1, door.y1, door.x2, door.y2]}
            stroke={FRAME_COLOR}
            strokeWidth={10}
            opacity={door.state === "open" ? 0.35 : 1}
            lineCap="butt"
            listening={false}
          />
          {door.state === "open" ? (
            <Fragment>
              <Line points={stub(door, 0)} stroke={DOOR_COLOR} strokeWidth={6} listening={false} />
              <Line points={stub(door, 1)} stroke={DOOR_COLOR} strokeWidth={6} listening={false} />
            </Fragment>
          ) : (
            <Line
              points={[door.x1, door.y1, door.x2, door.y2]}
              stroke={DOOR_COLOR}
              strokeWidth={6}
              listening={false}
            />
          )}
          {door.state === "locked" && (
            <Rect
              x={midX - 5}
              y={midY - 5}
              width={10}
              height={10}
              fill={LOCK_COLOR}
              stroke={FRAME_COLOR}
              strokeWidth={1.5}
              listening={false}
            />
          )}
        </Fragment>
      )}
      <Line
        name={`door-hit:${door.id}`}
        points={[door.x1, door.y1, door.x2, door.y2]}
        stroke="transparent"
        strokeWidth={18}
        hitStrokeWidth={18}
        onClick={handleActivate}
        onTap={handleActivate}
      />
    </Fragment>
  );
}

// A door swung open renders as two stubs anchored at its hinges.
function stub(door: CompiledDoor, end: 0 | 1): number[] {
  const t = 0.28;
  if (end === 0) {
    return [door.x1, door.y1, lerp(door.x1, door.x2, t), lerp(door.y1, door.y2, t)];
  }
  return [door.x2, door.y2, lerp(door.x2, door.x1, t), lerp(door.y2, door.y1, t)];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lockCycle(state: CompiledDoorState): CompiledDoorState {
  if (state === "locked") return "closed";
  if (state === "secret") return "closed";
  return "locked";
}
