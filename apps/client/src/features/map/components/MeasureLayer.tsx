// ============================================================================
// MEASURE LAYER COMPONENT
// ============================================================================
// Renders the distance measurement tool: your own line, plus every other
// player's live measurement relayed by the server, all counted by the room's
// diagonal rule.
//
// The maths is NOT here. `measureGridDistance` lives in @herobyte/shared so
// the number on this screen, the number on everyone else's, and any future
// server-side range check come from one implementation (arc defect D11: this
// file used to do its own Euclidean `Math.sqrt`, so a 2-square diagonal read
// "2.8 Squares (14 ft)" where 5e says 10).

import { Fragment } from "react";
import { Group, Line, Circle, Text } from "react-konva";
import {
  formatMeasurement,
  measureGridDistance,
  type DiagonalRule,
  type MeasureEvent,
} from "@herobyte/shared";
import type { Camera } from "../types";

interface MeasureLayerProps {
  cam: Camera;
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  gridSize: number;
  gridSquareSize?: number; // Feet per square (default: 5)
  diagonalRule?: DiagonalRule; // The room's rule (default: 5e)
  /** Other people's live measurements. The caller drops the viewer's own echo. */
  remoteMeasurements?: MeasureEvent[];
}

/** Your line. Everyone else's is dimmer so it never hides yours. */
const OWN_COLOR = "#ff0";
const REMOTE_COLOR = "#8fd0ff";

/**
 * A fixed label box, centred on the midpoint. `align="center"` needs a width
 * to centre inside; without one Konva anchors at the left edge and a longer
 * readout (a remote line carries the player's name) drifts off the line.
 */
const LABEL_WIDTH = 260;

interface MeasureLineProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
  gridSize: number;
  gridSquareSize: number;
  diagonalRule: DiagonalRule;
  scale: number;
  color: string;
  /** Prefixed to the readout for someone else's line. */
  who?: string;
}

function MeasureLine({
  start,
  end,
  gridSize,
  gridSquareSize,
  diagonalRule,
  scale,
  color,
  who,
}: MeasureLineProps) {
  const distance = measureGridDistance({
    start,
    end,
    gridSize,
    gridSquareSize,
    rule: diagonalRule,
  });
  // Draw between the endpoints the rule actually counted: under a grid rule
  // those are cell centres, so the line and the number describe the same two
  // squares instead of the number quietly rounding a line nobody drew.
  const { from, to } = distance;
  const readout = formatMeasurement(distance);

  return (
    <>
      <Line
        points={[from.x, from.y, to.x, to.y]}
        stroke={color}
        strokeWidth={2 / scale}
        dash={[5 / scale, 5 / scale]}
      />
      <Circle x={from.x} y={from.y} radius={4 / scale} fill={color} />
      <Circle x={to.x} y={to.y} radius={4 / scale} fill={color} />
      <Text
        x={(from.x + to.x) / 2}
        y={(from.y + to.y) / 2 - 10}
        text={who ? `${who}: ${readout}` : readout}
        fill={color}
        fontSize={14 / scale}
        fontStyle="bold"
        align="center"
        width={LABEL_WIDTH / scale}
        offsetX={LABEL_WIDTH / scale / 2}
      />
    </>
  );
}

/**
 * MeasureLayer: Renders distance measurement tool
 * Shows line between two points with distance in grid squares and feet
 */
export function MeasureLayer({
  cam,
  measureStart,
  measureEnd,
  gridSize,
  gridSquareSize = 5,
  diagonalRule = "5e",
  remoteMeasurements = [],
}: MeasureLayerProps) {
  // A remote entry without both endpoints IS the "I stopped measuring" signal;
  // it exists so the sender's line clears, and there is nothing to draw for it.
  const remote = remoteMeasurements.filter((entry) => entry.start && entry.end);
  const own = measureStart && measureEnd;
  if (!own && remote.length === 0) return null;

  const shared = { gridSize, gridSquareSize, diagonalRule, scale: cam.scale };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {remote.map((entry) => (
        <Fragment key={entry.uid}>
          <MeasureLine
            {...shared}
            start={entry.start!}
            end={entry.end!}
            color={REMOTE_COLOR}
            who={entry.name}
          />
        </Fragment>
      ))}
      {own && <MeasureLine {...shared} start={measureStart} end={measureEnd} color={OWN_COLOR} />}
    </Group>
  );
}
