import { Group, Rect, Text } from "react-konva";
import { decorateLabel, type PopulateTarget } from "./populateTarget";

export function PopulateTargetPreview({
  target,
  scale,
}: {
  target: PopulateTarget;
  scale: number;
}) {
  return (
    <Group listening={false} name="populate-target-preview">
      <Rect
        {...target.bounds}
        stroke="#ffe59a"
        strokeWidth={2 / scale}
        dash={[6 / scale, 4 / scale]}
        listening={false}
      />
      <Text
        x={target.bounds.x}
        y={target.bounds.y - 22 / scale}
        text={decorateLabel(target)}
        fontSize={14 / scale}
        fill="#ffe59a"
        listening={false}
      />
    </Group>
  );
}
