// ============================================================================
// POINTERS LAYER COMPONENT
// ============================================================================
// Renders temporary pointer indicators from other players

import { memo, useEffect, useMemo, useState } from "react";
import { Group, Circle, Text } from "react-konva";
import type { Pointer, Player, Token } from "@shared";
import type { Camera } from "../types";

const POINTER_LIFESPAN_MS = 3000;
const PULSE_DURATION_MS = 550;
const PULSE_COUNT = 3;
const TOTAL_PULSE_WINDOW = PULSE_DURATION_MS * PULSE_COUNT;
const FADE_WINDOW_MS = 850;
const BASE_RADIUS = 28;
const CORE_RADIUS = 12;
const RING_RADIUS = BASE_RADIUS + 6;

interface PointersLayerProps {
  cam: Camera;
  pointers: Pointer[];
  players: Player[];
  tokens: Token[];
  preview?: { x: number; y: number } | null;
  previewUid?: string | null;
  pointerMode?: boolean;
}

/**
 * PointersLayer: Renders temporary pointer indicators with pulse-fade animation
 * Shows player name and uses their token color
 * Pointers automatically expire after 3 seconds
 *
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const PointersLayer = memo(function PointersLayer({
  cam,
  pointers,
  players,
  tokens,
  preview = null,
  previewUid = null,
  pointerMode = false,
}: PointersLayerProps) {
  const [visiblePointers, setVisiblePointers] = useState<Pointer[]>([]);
  const [, setAnimationTick] = useState(0);

  const now = Date.now();
  
  // Apply incoming pointer updates, filtering out any already-expired data
  useEffect(() => {
    const nowSnapshot = Date.now();
    const freshPointers = pointers.filter(
      (pointer) => nowSnapshot - pointer.timestamp < POINTER_LIFESPAN_MS,
    );
    setVisiblePointers(freshPointers);
  }, [pointers]);

  // Schedule pointer removals to ensure consistent 3-second lifespan
  useEffect(() => {
    if (visiblePointers.length === 0) {
      return;
    }

    const timers = visiblePointers.map((pointer) => {
      const elapsed = Date.now() - pointer.timestamp;
      const remaining = Math.max(0, POINTER_LIFESPAN_MS - elapsed);

      return window.setTimeout(() => {
        setVisiblePointers((prev) => prev.filter((p) => p.id !== pointer.id));
      }, remaining);
    });

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [visiblePointers]);

  // Drive animation by triggering re-render while pointers are visible
  useEffect(() => {
    if (visiblePointers.length === 0) {
      return;
    }

    let frameId: number;
    const step = () => {
      setAnimationTick((tick) => (tick + 1) % 1_000);
      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [visiblePointers.length]);

  const pointerColors = useMemo(() => {
    const map = new Map<string, string>();
    tokens.forEach((token) => {
      map.set(token.owner, token.color);
    });
    return map;
  }, [tokens]);

  const previewColor = useMemo(() => {
    if (!previewUid) {
      return "#FFD700";
    }
    const fromToken = pointerColors.get(previewUid);
    if (fromToken) {
      return fromToken;
    }
    const player = players.find((p) => p.uid === previewUid);
    return player?.isDM ? "#FFD700" : "#61dafb";
  }, [pointerColors, players, previewUid]);

  const inverseCamScale = 1 / cam.scale;
  const previewPulse = 1 + 0.2 * Math.sin(((now % 800) / 800) * Math.PI * 2);

  // Calculate visual properties based on age for animation effect
  const getAnimationProps = (pointer: Pointer) => {
    const now = Date.now();
    const age = Math.max(0, now - pointer.timestamp);
    const clampedAge = Math.min(age, POINTER_LIFESPAN_MS);

    // Core opacity eases in for first ~150ms and fades during the last 900ms
    let coreOpacity = 1;
    const fadeStart = POINTER_LIFESPAN_MS - FADE_WINDOW_MS;
    if (clampedAge < 150) {
      coreOpacity = clampedAge / 150;
    } else if (clampedAge > fadeStart) {
      coreOpacity = Math.max(0, 1 - (clampedAge - fadeStart) / FADE_WINDOW_MS);
    }

    // Core scale pulses during the early phase
    let pointerScale = 1.05;
    if (clampedAge < TOTAL_PULSE_WINDOW) {
      const pulseProgress = (clampedAge % PULSE_DURATION_MS) / PULSE_DURATION_MS;
      pointerScale = 1.05 + 0.35 * Math.sin(pulseProgress * Math.PI);
    } else if (clampedAge < fadeStart) {
      pointerScale = 1.05;
    } else {
      const remaining = Math.max(0, POINTER_LIFESPAN_MS - clampedAge);
      pointerScale = 1 + 0.08 * (remaining / FADE_WINDOW_MS);
    }

    // Ring pulse (expanding outline) for the first two pulses
    let ringScale = 1;
    let ringOpacity = 0;
    if (clampedAge < TOTAL_PULSE_WINDOW) {
      const pulseIndex = Math.floor(clampedAge / PULSE_DURATION_MS);
      const localProgress = (clampedAge % PULSE_DURATION_MS) / PULSE_DURATION_MS;
      ringScale = 1 + localProgress * 1.4;
      const strength = 1 - pulseIndex / PULSE_COUNT;
      ringOpacity = 0.65 * (1 - localProgress) * strength;
    }

    return { coreOpacity, pointerScale, ringScale, ringOpacity };
  };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {pointerMode && preview ? (
        <Group x={preview.x} y={preview.y} scaleX={inverseCamScale * previewPulse} scaleY={inverseCamScale * previewPulse}>
          <Circle
            radius={BASE_RADIUS + 4}
            stroke={previewColor}
            strokeWidth={4}
            opacity={0.6}
            dash={[12, 10]}
            shadowColor={previewColor}
            shadowBlur={10}
            shadowOpacity={0.35}
          />
          <Circle radius={CORE_RADIUS + 2} fill={previewColor} opacity={0.2} />
        </Group>
      ) : null}
      {visiblePointers.map((pointer) => {
        const player = players.find((p) => p.uid === pointer.uid);
        const tokenColor = pointerColors.get(pointer.uid);
        const { coreOpacity, pointerScale, ringScale, ringOpacity } = getAnimationProps(pointer);
        const label = pointer.name || player?.name || "???";
        const color = tokenColor || (player?.isDM ? "#FFD700" : "#fff");
        const inverseCamScale = 1 / cam.scale;
        const groupScale = pointerScale * inverseCamScale;
        const textYOffset = BASE_RADIUS + 16;

        return (
          <Group key={pointer.id} x={pointer.x} y={pointer.y} scaleX={groupScale} scaleY={groupScale}>
            {ringOpacity > 0 ? (
              <Circle
                x={0}
                y={0}
                radius={RING_RADIUS}
                stroke={color}
                strokeWidth={4}
                opacity={ringOpacity}
                scaleX={ringScale}
                scaleY={ringScale}
              />
            ) : null}
            <Circle
              x={0}
              y={0}
              radius={BASE_RADIUS}
              fill={color}
              opacity={coreOpacity * 0.75}
              shadowColor={color}
              shadowBlur={16}
              shadowOpacity={0.35}
              shadowOffset={{ x: 0, y: 0 }}
            />
            <Circle x={0} y={0} radius={CORE_RADIUS} fill="#05060d" opacity={coreOpacity * 0.35} />
            <Text
              x={0}
              y={textYOffset}
              text={label}
              fill="#0b0d1f"
              fontSize={14}
              fontStyle="bold"
              align="center"
              width={120}
              offsetX={60}
              shadowColor="rgba(11,13,31,0.65)"
              shadowBlur={1}
              shadowOpacity={1}
              opacity={coreOpacity}
            />
          </Group>
        );
      })}
    </Group>
  );
});
