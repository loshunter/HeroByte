// A selected drawing's or template's outline in the viewer's colour (C3): the
// same shape drawn twice, a solid keyline (dark or light, whichever contrasts
// more with the colour) and the dashed colour on it, so the outline reads on any
// map. In the default blue (no colour) it is the one dashed outline, as before.

import type { ElementType } from "react";

interface SelectionOutlineProps {
  /** The Konva shape to outline with: Line, Rect or Circle. */
  shape: ElementType;
  /** The keyline, or null for the plain default outline. */
  keyline: string | null;
  /** The camera scale, so the keyline is 1 px wider each side on screen. */
  scale: number;
  stroke: string;
  strokeWidth: number;
  [prop: string]: unknown;
}

export function SelectionOutline({
  shape: Shape,
  keyline,
  scale,
  ...props
}: SelectionOutlineProps): JSX.Element {
  return (
    <>
      {keyline && (
        <Shape
          {...props}
          stroke={keyline}
          strokeWidth={props.strokeWidth + 2 / scale}
          dash={undefined}
          listening={false}
        />
      )}
      <Shape {...props} />
    </>
  );
}
