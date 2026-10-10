// ============================================================================
// POINTERS LAYER COMPONENT
// ============================================================================
// Renders temporary pointer indicators from other players

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Group, Circle, Text } from "react-konva";
import {
  keylineFor,
  type Pointer,
  type Player,
  type SnapshotCharacter,
  type Token,
} from "@herobyte/shared";
import type { Camera } from "../types";
import { useSfx } from "../../juice";
import { playerColorMap } from "../../players/playerColors";

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
  /** Party records: a ping's colour is its player's (C3), fog-proof (playerColors). */
  characters?: SnapshotCharacter[];
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
  characters,
  preview = null,
  previewUid = null,
  pointerMode = false,
}: PointersLayerProps) {
  const [visiblePointers, setVisiblePointers] = useState<Pointer[]>([]);
  const [, setAnimationTick] = useState(0);
  const { play } = useSfx();
  const seenPointerIds = useRef<Set<string>>(new Set());

  const now = Date.now();

  // Blip whenever a fresh ping arrives (the pulse/ring visual already exists).
  useEffect(() => {
    for (const pointer of pointers) {
      if (seenPointerIds.current.has(pointer.id)) continue;
      seenPointerIds.current.add(pointer.id);
      if (Date.now() - pointer.timestamp < POINTER_LIFESPAN_MS) {
        play("ping");
      }
    }
    // Keep the seen-set from growing without bound.
    if (seenPointerIds.current.size > 200) {
      seenPointerIds.current = new Set(pointers.map((pointer) => pointer.id));
    }
  }, [pointers, play]);

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

  // Each player's colour, from their first PC (never the DM's last NPC token), read
  // off the party records so fog never turns a ping white on some screens.
  const pointerColors = useMemo(
    () =>
      playerColorMap(
        players.map((player) => player.uid),
        characters,
        tokens,
      ),
    [players, characters, tokens],
  );

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
        <Group
          x={preview.x}
          y={preview.y}
          scaleX={inverseCamScale * previewPulse}
          scaleY={inverseCamScale * previewPulse}
        >
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
          <Group
            key={pointer.id}
            x={pointer.x}
            y={pointer.y}
            scaleX={groupScale}
            scaleY={groupScale}
          >
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
            {/* The name in the ping's colour, outlined in its keyline (dark or light,
                whichever contrasts more), so it reads on any map. */}
            <Text
              x={0}
              y={textYOffset}
              text={label}
              fill={color}
              stroke={keylineFor(color)}
              strokeWidth={3}
              fillAfterStrokeEnabled
              fontSize={14}
              fontStyle="bold"
              align="center"
              width={120}
              offsetX={60}
              opacity={coreOpacity}
            />
          </Group>
        );
      })}
    </Group>
  );
});
