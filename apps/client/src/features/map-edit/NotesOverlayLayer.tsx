// ============================================================================
// GM NOTES OVERLAY LAYER (DM-only)
// ============================================================================
// Draws the live document's GM Notes text at the table so a DM can actually SEE
// what a generated dungeon was stocked with. Notes are invisible everywhere
// else by design: `deriveMapElements` strips notes-kind layers from EVERY
// recipient's snapshot (players AND the DM), so the only place this text exists
// on the DM's client is the authoring document the controller already holds.
//
// Reads `activeDocument` — NEVER `snapshot.mapElements`. That snapshot field has
// exactly one producer (`deriveMapElements`), and keeping it that way is the
// secrecy invariant; a second producer is how notes leak to players.
//
// Players never mount this: the MapBoard site gates on isDM. listening={false}
// so it never intercepts a click.

import { Group, Text } from "react-konva";
import type { MapDocument, SceneObjectTransform } from "@herobyte/shared";
import type { Camera } from "../map/types";

interface NotesOverlayLayerProps {
  cam: Camera;
  mapTransform?: SceneObjectTransform;
  document: MapDocument | null;
}

const NOTE_COLOR = "#ffd479";

export function NotesOverlayLayer({ cam, mapTransform, document }: NotesOverlayLayerProps) {
  const notes = notesOf(document);
  if (!notes.length) return null;

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
      <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation} listening={false}>
        {notes.map((note) => (
          <Text
            key={note.id}
            x={note.transform.x}
            y={note.transform.y}
            text={note.data.text}
            fill={NOTE_COLOR}
            fontSize={note.data.fontSize}
            fontStyle="bold"
            shadowColor="#000000"
            shadowBlur={4}
            listening={false}
          />
        ))}
      </Group>
    </Group>
  );
}

/** Visible text on a notes-kind layer. `hidden` still hides it from the DM. */
function notesOf(document: MapDocument | null) {
  if (!document) return [];
  const noteLayers = new Set(
    document.layers.filter((layer) => layer.kind === "notes" && layer.visible).map((l) => l.id),
  );
  if (!noteLayers.size) return [];
  return document.elements.filter(
    (element) => element.type === "text" && !element.hidden && noteLayers.has(element.layerId),
  ) as Array<Extract<MapDocument["elements"][number], { type: "text" }>>;
}
