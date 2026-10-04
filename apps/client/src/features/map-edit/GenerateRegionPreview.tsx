import { Group, Rect, Text } from "react-konva";
import type { GenerateRegionDescriptor } from "./generateRegion";

export function GenerateRegionPreview({
  region,
  scale,
}: {
  region: GenerateRegionDescriptor;
  scale: number;
}) {
  if (!region.rectangle) return null;
  const color = region.problem ? "#ff6978" : "#57d6ff";
  const label = region.outsideEdges.length
    ? `Outside map: ${region.outsideEdges.join(", ")}`
    : `${region.cells.cols} × ${region.cells.rows} cells${region.problem ? " — invalid region" : ""}`;
  return (
    <Group listening={false} name="generate-region-preview">
      <Rect
        {...region.rectangle}
        stroke={color}
        strokeWidth={2 / scale}
        dash={[8 / scale, 5 / scale]}
        fill="#57d6ff"
        opacity={0.25}
        listening={false}
      />
      {region.outside.map((rect, index) => (
        <Rect
          key={index}
          {...rect}
          fill="#ff344f"
          opacity={0.5}
          listening={false}
          name="generate-region-outside"
        />
      ))}
      <Text
        x={region.rectangle.x}
        y={region.rectangle.y - 22 / scale}
        text={label}
        fontSize={14 / scale}
        fill={color}
        listening={false}
      />
    </Group>
  );
}
