// ============================================================================
// TOKEN HP FEEDBACK (Konva)
// ============================================================================
// Mirrors the player-card combat feedback onto a map token: a rising damage/
// heal number and a coloured flash over the token. Rendered inside the Konva
// tokens layer (scene coordinates). Sound is intentionally suppressed here —
// the entity cards own the SFX so a hit only plays once.

import { useEffect, useRef } from "react";
import { Group, Rect, Text } from "react-konva";
import Konva from "konva";
import { useHpFeedback } from "./useHpFeedback";

interface TokenHpFeedbackProps {
  /** Current HP of the entity this token represents. */
  hp: number | undefined;
  /** Token centre X in scene coordinates. */
  x: number;
  /** Token centre Y in scene coordinates. */
  y: number;
  /** Token render size in scene units. */
  size: number;
}

const DAMAGE_COLOR = "#ff5555";
const HEAL_COLOR = "#7cff6b";

export function TokenHpFeedback({ hp, x, y, size }: TokenHpFeedbackProps) {
  const { feedback } = useHpFeedback(hp, { sound: false });
  const textRef = useRef<Konva.Text>(null);
  const flashRef = useRef<Konva.Rect>(null);
  const key = feedback?.animationKey;

  useEffect(() => {
    if (!feedback) return;

    const tweens: Konva.Tween[] = [];
    const text = textRef.current;
    if (text && typeof text.to === "function") {
      text.opacity(1);
      text.y(y - size * 0.4);
      tweens.push(
        new Konva.Tween({
          node: text,
          duration: 0.6,
          y: y - size * 1.15,
          opacity: 0,
          easing: Konva.Easings.EaseOut,
        }),
      );
    }

    const flash = flashRef.current;
    if (flash && typeof flash.to === "function") {
      flash.opacity(0.5);
      tweens.push(new Konva.Tween({ node: flash, duration: 0.5, opacity: 0 }));
    }

    tweens.forEach((tween) => tween.play());
    return () => tweens.forEach((tween) => tween.destroy());
    // Re-run for each distinct hit; position deps keep the target in sync.
  }, [key, x, y, size]);

  if (!feedback) return null;

  const color = feedback.kind === "damage" ? DAMAGE_COLOR : HEAL_COLOR;
  const label = feedback.amount > 0 ? `+${feedback.amount}` : `${feedback.amount}`;

  return (
    <Group listening={false}>
      <Rect
        ref={flashRef}
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        cornerRadius={size / 8}
        fill={color}
        opacity={0.5}
      />
      <Text
        ref={textRef}
        text={label}
        x={x}
        y={y - size * 0.4}
        width={size * 2}
        offsetX={size}
        align="center"
        fontSize={Math.max(12, size * 0.5)}
        fontStyle="bold"
        fill={color}
        stroke="#000000"
        strokeWidth={Math.max(1, size * 0.03)}
        fillAfterStrokeEnabled
      />
    </Group>
  );
}
