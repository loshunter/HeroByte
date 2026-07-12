// ============================================================================
// MAP ELEMENTS LAYER
// ============================================================================
// Renders live-authored scenery (tiles / stamps / shapes / visible text) that a
// live-bound map document compiles onto the play surface for EVERY player — the
// data channel that replaces the baked raster once the Studio is gone. The
// server already applied the privacy contract in deriveMapElements, so whatever
// arrives here is player-safe by construction; this layer only draws it.
//
// Scenery is inert: listening={false} throughout so token clicks and drags pass
// straight through. Sits between TerrainLayer and GridLayer, inside the same
// nested camera + map-object transform groups as the terrain, so it moves and
// scales with the map.

import { Group, Rect, Ellipse, Text, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import type {
  MapElementsSnapshot,
  RenderableMapElement,
  SceneObjectTransform,
} from "@herobyte/shared";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import type { Camera } from "../types";

interface MapElementsLayerProps {
  cam: Camera;
  mapElements: MapElementsSnapshot;
  /** The map object's transform — scenery must move/scale WITH the background. */
  mapTransform?: SceneObjectTransform;
}

export function MapElementsLayer({ cam, mapElements, mapTransform }: MapElementsLayerProps) {
  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};
  const gridSize = mapElements.grid.size;
  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
      <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation}>
        {mapElements.layers.map((layer, index) => (
          // One buffered group per authored layer applies its opacity ONCE; the
          // server already emitted layers in zIndex (paint) order.
          <Group key={index} opacity={layer.opacity} listening={false}>
            {layer.elements.map((element) => (
              <MapElementNode key={element.id} element={element} gridSize={gridSize} />
            ))}
          </Group>
        ))}
      </Group>
    </Group>
  );
}

/**
 * One scenery element in its own transform group (translate/rotate/scale), with
 * the drawable placed in local coords — the same nesting the Studio SVG uses.
 * useImage is called unconditionally (empty url for the vector kinds) so hook
 * order is stable regardless of element type.
 */
function MapElementNode({
  element,
  gridSize,
}: {
  element: RenderableMapElement;
  gridSize: number;
}) {
  const assetUrl =
    element.type === "tile" || element.type === "stamp"
      ? getMapStudioTileAsset(element.data.assetId).imageUrl
      : undefined;
  const [image] = useImage(assetUrl ?? "");

  const { x, y, scaleX, scaleY, rotation } = element.transform;
  return (
    <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation} listening={false}>
      {renderDrawable(element, gridSize, image)}
    </Group>
  );
}

function renderDrawable(
  element: RenderableMapElement,
  gridSize: number,
  image: HTMLImageElement | undefined,
) {
  if (element.type === "tile" || element.type === "stamp") {
    const asset = getMapStudioTileAsset(element.data.assetId);
    const width = element.type === "tile" ? element.data.columns * gridSize : element.data.width;
    const height = element.type === "tile" ? element.data.rows * gridSize : element.data.height;
    // Image-backed (uploaded) assets draw the picture; bundled tiles flat-fill.
    if (asset.imageUrl && image) {
      return <KonvaImage image={image} width={width} height={height} listening={false} />;
    }
    return (
      <Rect
        width={width}
        height={height}
        fill={element.data.tint ?? asset.fill}
        stroke={asset.stroke}
        strokeWidth={1}
        listening={false}
      />
    );
  }

  if (element.type === "shape") {
    const [start, end] = element.data.points;
    if (!start || !end) return null;
    const bx = Math.min(start.x, end.x);
    const by = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    const paint = {
      fill: element.data.fill,
      stroke: element.data.stroke,
      strokeWidth: element.data.strokeWidth,
      opacity: element.data.opacity,
      listening: false as const,
    };
    return element.data.shape === "ellipse" ? (
      <Ellipse x={bx + w / 2} y={by + h / 2} radiusX={w / 2} radiusY={h / 2} {...paint} />
    ) : (
      <Rect x={bx} y={by} width={w} height={h} {...paint} />
    );
  }

  // text
  return (
    <Text
      text={element.data.text}
      fill={element.data.color}
      fontSize={element.data.fontSize}
      listening={false}
    />
  );
}
