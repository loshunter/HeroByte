// ============================================================================
// ATLAS LINKS LAYER
// ============================================================================
// Travel sprites (door/stair/signpost) on the live map. Anchors are DOCUMENT
// px on the from-node's map, so only links FROM the current atlas node belong
// on this scene — and the layer nests the same two transform groups as
// DoorsLayer to stay pixel-aligned with it.
//
// PRIVACY POSTURE (recorded in the plan's A6 capsule): the list arrives
// per-recipient filtered from atlasProjection.ts. The layer renders what it is
// given and never re-derives visibility — a second implementation of the
// privacy rules could silently disagree with the real one. What players lack
// is capability, not paint: only the DM's sprites LISTEN (click → travel);
// a player's sprite is scenery, and one whose target is undiscovered does not
// even know where it leads (`toNodeId` absent).

import { Fragment } from "react";
import { Circle, Group, Text } from "react-konva";
import type Konva from "konva";
import type { MapLinkSnapshot, SceneObjectTransform } from "@herobyte/shared";
import type { Camera } from "../types";

interface AtlasLinksLayerProps {
  cam: Camera;
  /** Server-filtered links for this recipient (DM: all; player: projected). */
  links: MapLinkSnapshot[];
  /** Links render only when their from-node IS the current node. */
  currentNodeId: string | undefined;
  mapTransform?: SceneObjectTransform;
  dmView: boolean;
  /** DM sprite-click travel; players get no handler and no hit shape. */
  onTravel?: (toNodeId: string) => void;
}

const BADGE_RADIUS = 16;
const BADGE_FILL: Record<MapLinkSnapshot["linkType"], string> = {
  door: "#c99b55",
  stair: "#8fb3ff",
  signpost: "#7ce0d3",
};
const GLYPH: Record<MapLinkSnapshot["linkType"], string> = {
  door: "🚪",
  stair: "🪜",
  signpost: "🪧",
};

export function AtlasLinksLayer({
  cam,
  links,
  currentNodeId,
  mapTransform,
  dmView,
  onTravel,
}: AtlasLinksLayerProps) {
  const onThisMap = currentNodeId ? links.filter((link) => link.fromNodeId === currentNodeId) : [];
  if (!onThisMap.length) return null;

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation}>
        {onThisMap.map((link) => (
          <LinkSprite key={link.id} link={link} dmView={dmView} onTravel={onTravel} />
        ))}
      </Group>
    </Group>
  );
}

interface LinkSpriteProps {
  link: MapLinkSnapshot;
  dmView: boolean;
  onTravel?: (toNodeId: string) => void;
}

function LinkSprite({ link, dmView, onTravel }: LinkSpriteProps) {
  // A player snapshot never carries visibleToPlayers; the DM's false means a
  // link the players cannot see, marked so the DM knows they are looking at
  // secret geography.
  const hiddenFromPlayers = dmView && link.visibleToPlayers === false;
  const canTravel = dmView && Boolean(onTravel) && Boolean(link.toNodeId);

  const handleActivate = (event: Konva.KonvaEventObject<MouseEvent | Event>) => {
    event.cancelBubble = true;
    if (link.toNodeId) onTravel?.(link.toNodeId);
  };

  return (
    <Fragment>
      <Circle
        x={link.anchor.x}
        y={link.anchor.y}
        radius={BADGE_RADIUS}
        fill={BADGE_FILL[link.linkType]}
        stroke="#1c1633"
        strokeWidth={2}
        opacity={hiddenFromPlayers ? 0.65 : 0.95}
        // fill+stroke+opacity<1 takes Konva's buffer-canvas path, and that
        // buffer is STAGE-sized — a 0-size first frame (mobile viewport
        // emulation) makes its drawImage throw and the boundary eats the
        // whole table. The imperfect blend is invisible at 2px.
        perfectDrawEnabled={false}
        listening={false}
      />
      {hiddenFromPlayers && (
        <Circle
          x={link.anchor.x}
          y={link.anchor.y}
          radius={BADGE_RADIUS + 5}
          stroke="#7ce0d3"
          strokeWidth={2}
          dash={[5, 4]}
          listening={false}
        />
      )}
      <Text
        x={link.anchor.x - BADGE_RADIUS}
        y={link.anchor.y - BADGE_RADIUS + 3}
        width={BADGE_RADIUS * 2}
        height={BADGE_RADIUS * 2}
        text={GLYPH[link.linkType]}
        fontSize={20}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
      {/* The hit shape exists ONLY for a DM with somewhere to go — a player's
          map input must never snag on scenery (plan A6 trap). */}
      {canTravel && (
        <Circle
          name={`atlas-link-hit:${link.id}`}
          x={link.anchor.x}
          y={link.anchor.y}
          radius={BADGE_RADIUS + 4}
          fill="transparent"
          listening={true}
          onClick={handleActivate}
          onTap={handleActivate}
        />
      )}
    </Fragment>
  );
}
