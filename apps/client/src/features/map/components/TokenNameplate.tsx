// ============================================================================
// TOKEN NAMEPLATE + HP BAR (S4)
// ============================================================================
// The "which goblin is Goblin 3" fix: a name under every token, and a thin HP
// bar when the viewer is allowed numbers. Redaction happened SERVER-side (the
// recipient filter strips NPC hp per the room's monsterHpDisplay); this
// component just renders what arrived — numbers → bar, hpBadge → dot, neither
// → name only.
//
// Zoom-invariant on purpose (the PointersLayer label pattern): the group sits
// at a world point but counter-scales by 1/cam.scale, so everything inside is
// laid out in SCREEN pixels — the name is as readable at 0.1× zoom on a phone
// as at 1× on a desktop. Font floor 11px matches the CSS mobile floor in
// herobyte.css. Colors are literal hex: Konva cannot resolve CSS variables
// (the var() strings elsewhere in TokensLayer silently fall back).

import { Group, Rect, Text, Circle } from "react-konva";
import type { HpBadge } from "@herobyte/shared";

/** What one token's plate shows. Built per token in MapBoard (platesByTokenId). */
export interface TokenPlateData {
  name: string;
  hp?: number;
  maxHp?: number;
  hpBadge?: HpBadge;
}

interface TokenNameplateProps {
  plate: TokenPlateData;
  /** Token CENTER in world pixels (the same maths TokenSprite uses). */
  x: number;
  y: number;
  /** Token edge length in world pixels (gridSize * 0.75 * sizeMultiplier). */
  tokenSize: number;
  camScale: number;
}

const FONT_SIZE = 11; // screen px; ≥11px is the repo's mobile readability floor
const NAME_WIDTH = 96; // screen px box, ellipsized
const BAR_HEIGHT = 4;
const GAP = 4;

const BAR_COLORS = {
  high: "#3fbf5a", // >66% — matches HPBar.tsx's thresholds
  medium: "#e0a83c", // >33%
  low: "#d63c53",
} as const;

const BADGE_COLORS: Record<HpBadge, string> = {
  healthy: BAR_COLORS.high,
  bloodied: BAR_COLORS.low,
};

function barColor(hp: number, maxHp: number): string {
  const percent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
  return percent > 66 ? BAR_COLORS.high : percent > 33 ? BAR_COLORS.medium : BAR_COLORS.low;
}

export function TokenNameplate({ plate, x, y, tokenSize, camScale }: TokenNameplateProps) {
  // Inside the counter-scaled group, child coordinates are screen pixels — so
  // the token's on-screen half-height is its world half-size times the zoom.
  const tokenHalfScreen = (tokenSize / 2) * camScale;
  const hasBar = plate.hp !== undefined && plate.maxHp !== undefined;
  // Bar width tracks the token's on-screen size so big monsters read as big,
  // clamped so it never vanishes at far zoom or dwarfs the name up close.
  const barWidth = Math.min(72, Math.max(28, tokenSize * camScale));
  const barY = tokenHalfScreen + GAP;
  const nameY = barY + (hasBar || plate.hpBadge ? BAR_HEIGHT + GAP : 0);

  return (
    <Group x={x} y={y} scaleX={1 / camScale} scaleY={1 / camScale} listening={false}>
      {hasBar && (
        <>
          <Rect
            x={-barWidth / 2}
            y={barY}
            width={barWidth}
            height={BAR_HEIGHT}
            fill="#0b0d1f"
            opacity={0.85}
            cornerRadius={BAR_HEIGHT / 2}
          />
          <Rect
            x={-barWidth / 2}
            y={barY}
            width={barWidth * Math.max(0, Math.min(1, plate.hp! / Math.max(1, plate.maxHp!)))}
            height={BAR_HEIGHT}
            fill={barColor(plate.hp!, plate.maxHp!)}
            cornerRadius={BAR_HEIGHT / 2}
          />
        </>
      )}
      {!hasBar && plate.hpBadge && (
        // Bloodied-mode badge: the coarse signal the server allowed through.
        <Circle
          x={0}
          y={barY + BAR_HEIGHT / 2}
          radius={3.5}
          fill={BADGE_COLORS[plate.hpBadge]}
          stroke="#0b0d1f"
          strokeWidth={1}
        />
      )}
      <Text
        x={-NAME_WIDTH / 2}
        y={nameY}
        width={NAME_WIDTH}
        text={plate.name}
        align="center"
        fontSize={FONT_SIZE}
        fontStyle="bold"
        fill="#f7f8ff"
        // Dark halo so the white name reads over bright and dark terrain
        // alike — the opposite mistake of the pointer label's dark-on-dark.
        shadowColor="#0b0d1f"
        shadowBlur={3}
        shadowOpacity={0.9}
        wrap="none"
        ellipsis
        name="token-nameplate"
      />
    </Group>
  );
}
