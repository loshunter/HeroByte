// ============================================================================
// TOKENS LAYER COMPONENT (SCENE OBJECT VERSION)
// ============================================================================
// Renders tokens from the unified scene graph with drag support.

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Group, Rect, Image as KonvaImage, Circle, Text } from "react-konva";
import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { DragPreviewUpdate, SceneObject } from "@herobyte/shared";
import useImage from "use-image";
import type { Camera } from "../types";
import { LockIndicator } from "./LockIndicator";
import type { StatusOption } from "../../players/constants/statusOptions";
import { TokenHpFeedback } from "../../juice/TokenHpFeedback";
import { motionDisabled, useSfx } from "../../juice";

interface TokenSpriteProps {
  object: SceneObject & { type: "token" };
  gridSize: number;
  stroke: string;
  strokeWidth: number;
  interactive: boolean;
  draggable?: boolean;
  onDragEnd?: (event: KonvaEventObject<DragEvent>) => void;
  onDragStart?: (event: KonvaEventObject<DragEvent>) => void;
  onDragMove?: (event: KonvaEventObject<DragEvent>) => void;
  onHover: (id: string | null) => void;
  onDoubleClick?: () => void;
  onClick?: (event: KonvaEventObject<MouseEvent>) => void;
  onTap?: (event: KonvaEventObject<TouchEvent>) => void;
  onNodeReady?: (node: Konva.Node | null) => void;
  /** Play a scale "pop" when the token first appears. */
  popIn?: boolean;
  /** Glide to new positions (used for remote moves; off during local drag). */
  glide?: boolean;
  /** Pulse a selection glow. */
  selected?: boolean;
}

// Guards against non-Konva refs (e.g. mocked nodes in tests / no-canvas envs)
// so animation calls never throw where the DSP/canvas isn't available.
function isKonvaNode(node: Konva.Node | null): node is Konva.Node {
  return !!node && typeof node.getLayer === "function" && typeof node.to === "function";
}

// Size multiplier per token size category (module scope: stable identity,
// not re-created on every render)
const SIZE_MULTIPLIERS: Record<string, number> = {
  tiny: 0.5,
  small: 0.75,
  medium: 1.0,
  large: 1.5,
  huge: 2.0,
  gargantuan: 3.0,
};

const TokenSprite = memo(function TokenSprite({
  object,
  gridSize,
  stroke,
  strokeWidth,
  draggable = false,
  interactive,
  onDragEnd,
  onDragStart,
  onDragMove,
  onHover,
  onDoubleClick,
  onClick,
  onTap,
  onNodeReady,
  popIn = false,
  glide = false,
  selected = false,
}: TokenSpriteProps) {
  const { data, transform, id } = object;
  const [image, status] = useImage(data.imageUrl ?? "");

  // Calculate size multiplier based on token size category
  const sizeMultiplier = SIZE_MULTIPLIERS[data.size ?? "medium"] ?? 1.0;

  const size = gridSize * 0.75 * sizeMultiplier;
  const halfSize = size / 2;

  const shapeRef = useRef<Konva.Node | null>(null);
  const nodeRef = useCallback(
    (node: Konva.Node | null) => {
      shapeRef.current = node;
      onNodeReady?.(node);
    },
    [onNodeReady],
  );

  const posX = transform.x * gridSize + gridSize / 2;
  const posY = transform.y * gridSize + gridSize / 2;

  // Glide to new positions when moved remotely (never while locally dragging).
  const prevPos = useRef({ x: posX, y: posY });
  useLayoutEffect(() => {
    const node = shapeRef.current;
    const prev = prevPos.current;
    prevPos.current = { x: posX, y: posY };
    if (!isKonvaNode(node) || !glide || motionDisabled()) return;
    if (prev.x === posX && prev.y === posY) return;
    node.position({ x: prev.x, y: prev.y });
    const tween = new Konva.Tween({
      node,
      duration: 0.16,
      x: posX,
      y: posY,
      easing: Konva.Easings.EaseOut,
    });
    tween.play();
    return () => tween.destroy();
  }, [posX, posY, glide]);

  // Scale "pop" when a token first appears on the board.
  useEffect(() => {
    const node = shapeRef.current;
    if (!isKonvaNode(node) || !popIn || motionDisabled()) return;
    const targetX = transform.scaleX;
    const targetY = transform.scaleY;
    node.scale({ x: targetX * 0.3, y: targetY * 0.3 });
    const tween = new Konva.Tween({
      node,
      duration: 0.3,
      scaleX: targetX,
      scaleY: targetY,
      easing: Konva.Easings.BackEaseOut,
    });
    tween.play();
    return () => {
      tween.destroy();
      node.scale({ x: targetX, y: targetY });
    };
  }, [popIn]);

  // Pulsing glow while selected.
  useEffect(() => {
    const node = shapeRef.current;
    if (!isKonvaNode(node) || !selected || motionDisabled()) return;
    const layer = node.getLayer();
    if (!layer) return;
    const shape = node as Konva.Shape;
    const anim = new Konva.Animation((frame) => {
      const seconds = (frame?.time ?? 0) / 1000;
      shape.shadowColor("#447DF7");
      shape.shadowBlur(9 + 6 * Math.sin(seconds * Math.PI * 2 * 1.1));
      shape.shadowOpacity(0.9);
    }, layer);
    anim.start();
    return () => {
      anim.stop();
      shape.shadowBlur(0);
      shape.shadowOpacity(0);
    };
  }, [selected]);

  const baseProps = {
    x: transform.x * gridSize + gridSize / 2,
    y: transform.y * gridSize + gridSize / 2,
    offsetX: halfSize,
    offsetY: halfSize,
    width: size,
    height: size,
    rotation: transform.rotation,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    cornerRadius: gridSize / 8,
    stroke,
    strokeWidth,
    draggable,
    onDragEnd,
    onDragStart,
    onDragMove,
    onMouseEnter: () => onHover(id),
    onMouseLeave: () => onHover(null),
    listening: interactive,
    onDblClick: onDoubleClick,
    onClick,
    onTap,
    id,
    name: id,
    attrs: { "data-token-id": id },
  } as const;
  const shapeProps = { ...baseProps, ref: nodeRef };

  if (data.imageUrl && status === "loaded" && image) {
    return <KonvaImage image={image} {...shapeProps} />;
  }

  return <Rect fill={data.color} {...shapeProps} />;
});

interface MultiSelectBadgeProps {
  x: number;
  y: number;
  size: number;
  count: number;
}

const MultiSelectBadge = memo(function MultiSelectBadge({
  x,
  y,
  size,
  count,
}: MultiSelectBadgeProps) {
  const radius = size / 2;
  const fontSize = size * 0.6;

  return (
    <Group x={x} y={y}>
      <Circle radius={radius} fill="#447DF7" stroke="#FFFFFF" strokeWidth={2} />
      <Text
        text={count.toString()}
        fontSize={fontSize}
        fontFamily="Arial"
        fontStyle="bold"
        fill="#FFFFFF"
        align="center"
        verticalAlign="middle"
        offsetX={fontSize / 2.5}
        offsetY={fontSize / 2.5}
      />
    </Group>
  );
});

interface StatusEffectBadgeProps {
  x: number;
  y: number;
  size: number;
  emoji: string;
  label: string;
  onHover?: (event: KonvaEventObject<MouseEvent>, text: string | null) => void;
}

const StatusEffectBadge = memo(function StatusEffectBadge({
  x,
  y,
  size,
  emoji,
  label,
  onHover,
}: StatusEffectBadgeProps) {
  const fontSize = size * 0.7;
  const bgRadius = size / 2;

  return (
    <Group
      x={x}
      y={y}
      onMouseEnter={(event) => onHover?.(event, label)}
      onMouseLeave={(event) => onHover?.(event, null)}
    >
      <Circle
        radius={bgRadius}
        fill="rgba(0, 0, 0, 0.7)"
        stroke="var(--jrpg-border-gold)"
        strokeWidth={1.5}
      />
      <Text
        text={emoji}
        fontSize={fontSize}
        fontFamily="Arial"
        fill="#FFFFFF"
        align="center"
        verticalAlign="middle"
        width={size}
        height={size}
        x={-size / 2}
        y={-size / 2}
      />
    </Group>
  );
});

interface StatusEffectOverflowBadgeProps {
  x: number;
  y: number;
  size: number;
  count: number;
  labels: string[];
  onHover?: (event: KonvaEventObject<MouseEvent>, text: string | null) => void;
}

const StatusEffectOverflowBadge = memo(function StatusEffectOverflowBadge({
  x,
  y,
  size,
  count,
  labels,
  onHover,
}: StatusEffectOverflowBadgeProps) {
  const fontSize = size * 0.6;
  const bgRadius = size / 2;

  const tooltipText = `+${count} more: ${labels.join(", ")}`;

  return (
    <Group
      x={x}
      y={y}
      onMouseEnter={(event) => onHover?.(event, tooltipText)}
      onMouseLeave={(event) => onHover?.(event, null)}
    >
      <Circle
        radius={bgRadius}
        fill="rgba(0, 0, 0, 0.7)"
        stroke="var(--jrpg-border-gold)"
        strokeWidth={1.5}
      />
      <Text
        text={`+${count}`}
        fontSize={fontSize}
        fontFamily="Arial"
        fill="#FFFFFF"
        align="center"
        verticalAlign="middle"
        width={size}
        height={size}
        x={-size / 2}
        y={-size / 2}
      />
    </Group>
  );
});

interface TokensLayerProps {
  cam: Camera;
  sceneObjects: SceneObject[];
  uid: string;
  gridSize: number;
  hoveredTokenId: string | null;
  onHover: (id: string | null) => void;
  onTransformToken: (sceneId: string, position: { x: number; y: number }) => void;
  onRecolorToken: (sceneId: string, owner: string | null | undefined) => void;
  snapToGrid: boolean;
  selectedObjectId?: string | null;
  selectedObjectIds: string[];
  onSelectObject?: (
    objectId: string | null,
    options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
  ) => void;
  onTokenNodeReady?: (tokenId: string, node: Konva.Node | null) => void;
  interactionsEnabled?: boolean;
  /** Map of token scene ID (e.g., "token:abc123") to status effect metadata */
  statusEffectsByTokenId?: Record<string, StatusOption[] | string>;
  /** Map of token scene ID to the current HP of the entity it represents. */
  hpByTokenId?: Record<string, number>;
  onDragPreview?: (updates: DragPreviewUpdate[]) => void;
  isDM: boolean;
}

export const TokensLayer = memo(function TokensLayer({
  cam,
  sceneObjects,
  uid,
  gridSize,
  hoveredTokenId,
  onHover,
  onTransformToken,
  onRecolorToken,
  snapToGrid,
  selectedObjectId,
  selectedObjectIds = [],
  onSelectObject,
  onTokenNodeReady,
  interactionsEnabled = true,
  statusEffectsByTokenId = {},
  onDragPreview,
  hpByTokenId = {},
  isDM,
}: TokensLayerProps) {
  const localOverrides = useRef<Record<string, { x: number; y: number }>>({});
  const multiDragStartRef = useRef<Record<string, { x: number; y: number }>>({});
  const [, forceRerender] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { play } = useSfx();

  const tokens = sceneObjects.filter((object): object is SceneObject & { type: "token" } => {
    return object.type === "token";
  });

  // Detect newly-placed tokens to pop them in and blip. A ref baseline avoids
  // firing for every token already present on initial load.
  const knownTokenIds = useRef<Set<string> | null>(null);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const tokenIdsKey = tokens.map((token) => token.id).join("|");
  useEffect(() => {
    const ids = tokenIdsKey ? tokenIdsKey.split("|") : [];
    if (knownTokenIds.current === null) {
      knownTokenIds.current = new Set(ids);
      return;
    }
    const added = ids.filter((id) => !knownTokenIds.current!.has(id));
    knownTokenIds.current = new Set(ids);
    if (added.length === 0) return;

    play("tokenPlace");
    setPoppingIds((prev) => {
      const next = new Set(prev);
      added.forEach((id) => next.add(id));
      return next;
    });
    const timer = setTimeout(() => {
      setPoppingIds((prev) => {
        const next = new Set(prev);
        added.forEach((id) => next.delete(id));
        return next;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [tokenIdsKey, play]);

  const myTokens = tokens.filter((object) => object.owner === uid);
  const otherTokens = tokens.filter((object) => object.owner !== uid);

  // Count selected tokens for multi-select badge
  const selectedTokenCount = selectedObjectIds.filter((id) => id.startsWith("token:")).length;

  const snapToGridPosition = useCallback(
    (pos: { x: number; y: number }) => {
      const normalize = (value: number) => (value - gridSize / 2) / gridSize;
      if (snapToGrid) {
        return {
          x: Math.round(normalize(pos.x)),
          y: Math.round(normalize(pos.y)),
        };
      }
      return {
        x: normalize(pos.x),
        y: normalize(pos.y),
      };
    },
    [gridSize, snapToGrid],
  );

  const computeDragPreviewPayload = useCallback(
    (sceneId: string, gridPosition: { x: number; y: number }) => {
      const startPositions = multiDragStartRef.current;
      const overrides: Record<string, { x: number; y: number }> = {};
      const updates: DragPreviewUpdate[] = [];

      if (!startPositions || Object.keys(startPositions).length === 0) {
        overrides[sceneId] = gridPosition;
        updates.push({ id: sceneId, x: gridPosition.x, y: gridPosition.y });
        return { overrides, updates };
      }

      const base = startPositions[sceneId];
      if (!base) {
        overrides[sceneId] = gridPosition;
        updates.push({ id: sceneId, x: gridPosition.x, y: gridPosition.y });
        return { overrides, updates };
      }

      const deltaX = gridPosition.x - base.x;
      const deltaY = gridPosition.y - base.y;
      const entries = Object.entries(startPositions);
      if (entries.length === 0) {
        overrides[sceneId] = gridPosition;
        updates.push({ id: sceneId, x: gridPosition.x, y: gridPosition.y });
        return { overrides, updates };
      }

      for (const [id, start] of entries) {
        const nextX = start.x + deltaX;
        const nextY = start.y + deltaY;
        overrides[id] = { x: nextX, y: nextY };
        updates.push({ id, x: nextX, y: nextY });
      }

      return { overrides, updates };
    },
    [],
  );

  const handleDragMove = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
    try {
      const pos = event.target.position();
      const gridPosition = snapToGridPosition(pos);
      event.target.position({
        x: gridPosition.x * gridSize + gridSize / 2,
        y: gridPosition.y * gridSize + gridSize / 2,
      });
      const { overrides, updates } = computeDragPreviewPayload(sceneId, gridPosition);
      if (updates.length === 0) {
        return;
      }
      localOverrides.current = { ...localOverrides.current, ...overrides };
      forceRerender((value) => value + 1);
      onDragPreview?.(updates);
    } catch (error) {
      console.warn("[TokensLayer] Drag move error:", error);
    }
  };

  const handleDrag = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
    try {
      const pos = event.target.position();
      const gridPosition = snapToGridPosition(pos);
      event.target.position({
        x: gridPosition.x * gridSize + gridSize / 2,
        y: gridPosition.y * gridSize + gridSize / 2,
      });

      const { overrides, updates } = computeDragPreviewPayload(sceneId, gridPosition);
      if (updates.length === 0) {
        setDraggingId(null);
        multiDragStartRef.current = {};
        return;
      }

      localOverrides.current = { ...localOverrides.current, ...overrides };
      for (const update of updates) {
        onTransformToken(update.id, { x: update.x, y: update.y });
      }
      onDragPreview?.(updates);

      forceRerender((value) => value + 1);

      setDraggingId(null);
      multiDragStartRef.current = {};
    } catch (error) {
      console.warn("[TokensLayer] Drag error:", error);
      setDraggingId(null);
      multiDragStartRef.current = {};
    }
  };

  const handleBadgeHover = useCallback(
    (event: KonvaEventObject<MouseEvent>, text: string | null) => {
      const container = event.target?.getStage()?.container();
      if (!container) {
        return;
      }
      if (text) {
        container.setAttribute("title", text);
      } else {
        container.removeAttribute("title");
      }
    },
    [],
  );

  const renderStatusBadges = useCallback(
    (object: SceneObject & { type: "token" }) => {
      const rawEffects = statusEffectsByTokenId[object.id];
      let effects: StatusOption[] = [];
      if (Array.isArray(rawEffects)) {
        effects = rawEffects;
      } else if (typeof rawEffects === "string") {
        effects = [{ value: rawEffects, label: rawEffects, emoji: rawEffects }];
      }

      if (effects.length === 0) {
        return null;
      }

      const badgeSize = gridSize * 0.3;
      const spacing = gridSize * 0.05;
      const baseX = object.transform.x * gridSize + gridSize * 0.1;
      const baseY = object.transform.y * gridSize + gridSize * 0.1;

      const displayEffects = effects.slice(0, 3);
      const overflow = effects.slice(3);

      return (
        <>
          {displayEffects.map((effect, index) => (
            <StatusEffectBadge
              key={`${object.id}-effect-${effect.value}-${index}`}
              x={baseX}
              y={baseY + index * (badgeSize + spacing)}
              size={badgeSize}
              emoji={effect.emoji}
              label={effect.label}
              onHover={handleBadgeHover}
            />
          ))}
          {overflow.length > 0 && (
            <StatusEffectOverflowBadge
              key={`${object.id}-effect-overflow`}
              x={baseX}
              y={baseY + displayEffects.length * (badgeSize + spacing)}
              size={badgeSize}
              count={overflow.length}
              labels={overflow.map((effect) => effect.label)}
              onHover={handleBadgeHover}
            />
          )}
        </>
      );
    },
    [gridSize, handleBadgeHover, statusEffectsByTokenId],
  );

  const handleDragStart = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
    setDraggingId(sceneId);

    const alreadySelected = selectedObjectIds.includes(sceneId);
    if (!alreadySelected && onSelectObject) {
      const native = event?.evt as MouseEvent | PointerEvent | undefined;
      const append = native?.shiftKey ?? false;
      const toggle = native?.ctrlKey || native?.metaKey || false;
      const mode = append ? "append" : toggle ? "toggle" : "replace";
      onSelectObject(sceneId, { mode });
    }

    const idsForDrag = (alreadySelected ? selectedObjectIds : [sceneId]).filter((id) =>
      id.startsWith("token:"),
    );

    const starts: Record<string, { x: number; y: number }> = {};
    for (const object of tokens) {
      if (idsForDrag.includes(object.id) && !object.locked) {
        starts[object.id] = { x: object.transform.x, y: object.transform.y };
      }
    }

    if (!starts[sceneId]) {
      const target = tokens.find((candidate) => candidate.id === sceneId);
      if (target && !target.locked) {
        starts[sceneId] = { x: target.transform.x, y: target.transform.y };
      }
    }

    multiDragStartRef.current = starts;
  };

  useEffect(() => {
    const overrides = localOverrides.current;
    const keys = Object.keys(overrides);
    if (keys.length === 0) return;

    const next = { ...overrides };
    let dirty = false;
    for (const key of keys) {
      const object = tokens.find((candidate) => candidate.id === key);
      const override = overrides[key];
      if (!object) {
        delete next[key];
        dirty = true;
        continue;
      }
      const matches =
        Math.abs(object.transform.x - override.x) < 0.001 &&
        Math.abs(object.transform.y - override.y) < 0.001;
      if (matches) {
        delete next[key];
        dirty = true;
      }
    }

    if (dirty) {
      localOverrides.current = next;
      forceRerender((value) => value + 1);
    }
  }, [tokens]);

  const mapOverrides = (object: SceneObject & { type: "token" }) => {
    const override = localOverrides.current[object.id];
    if (!override) return object;
    return {
      ...object,
      transform: {
        ...object.transform,
        x: override.x,
        y: override.y,
      },
    };
  };

  const renderHpFeedback = (object: SceneObject & { type: "token" }) => {
    const hp = hpByTokenId[object.id];
    if (hp === undefined) return null;
    const sizeMultiplier = SIZE_MULTIPLIERS[object.data.size ?? "medium"] ?? 1.0;
    const tokenSize = gridSize * 0.75 * sizeMultiplier;
    const { x, y } = mapOverrides(object).transform;
    return (
      <TokenHpFeedback
        hp={hp}
        x={x * gridSize + gridSize / 2}
        y={y * gridSize + gridSize / 2}
        size={tokenSize}
      />
    );
  };

  const selectToken = useCallback(
    (objectId: string, event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!onSelectObject) {
        return;
      }
      const native = event?.evt;
      const append = "shiftKey" in native ? native.shiftKey : false;
      const toggle = "ctrlKey" in native ? native.ctrlKey || native.metaKey : false;
      const mode = append ? "append" : toggle ? "toggle" : "replace";
      event.cancelBubble = true;
      onSelectObject(objectId, { mode });
    },
    [onSelectObject],
  );

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {otherTokens.map((object) => {
        const isSelected = selectedObjectIds.includes(object.id) || selectedObjectId === object.id;
        const isFirstSelected = selectedTokenCount > 1 && selectedObjectIds[0] === object.id;
        return (
          <Group key={object.id}>
            <TokenSprite
              object={mapOverrides(object)}
              gridSize={gridSize}
              stroke={
                isSelected ? "#447DF7" : hoveredTokenId === object.id ? "#aaa" : "transparent"
              }
              strokeWidth={isSelected ? 3 / cam.scale : 2 / cam.scale}
              interactive={interactionsEnabled}
              draggable={isDM && !object.locked && interactionsEnabled}
              onDragStart={(event) => handleDragStart(object.id, event)}
              onDragMove={(event) => handleDragMove(object.id, event)}
              onDragEnd={(event) => handleDrag(object.id, event)}
              onHover={onHover}
              onClick={(event) => selectToken(object.id, event)}
              onTap={(event) => selectToken(object.id, event)}
              onNodeReady={
                onTokenNodeReady ? (node) => onTokenNodeReady(object.id, node) : undefined
              }
              popIn={poppingIds.has(object.id)}
              glide={draggingId === null}
              selected={isSelected}
            />
            {object.locked && (
              <LockIndicator
                x={object.transform.x * gridSize + gridSize / 2}
                y={object.transform.y * gridSize + gridSize / 2 - gridSize * 0.45}
                size={gridSize * 0.25}
              />
            )}
            {renderStatusBadges(object)}
            {renderHpFeedback(object)}
            {isFirstSelected && (
              <MultiSelectBadge
                x={object.transform.x * gridSize + gridSize * 0.85}
                y={object.transform.y * gridSize + gridSize * 0.15}
                size={gridSize * 0.3}
                count={selectedTokenCount}
              />
            )}
          </Group>
        );
      })}

      {myTokens.map((object) => {
        const isSelected = selectedObjectIds.includes(object.id) || selectedObjectId === object.id;
        const isFirstSelected = selectedTokenCount > 1 && selectedObjectIds[0] === object.id;
        return (
          <Group key={object.id}>
            <TokenSprite
              object={mapOverrides(object)}
              gridSize={gridSize}
              stroke={isSelected ? "#447DF7" : draggingId === object.id ? "#44f" : "#fff"}
              strokeWidth={isSelected ? 3 / cam.scale : 2 / cam.scale}
              draggable={!object.locked && interactionsEnabled}
              interactive={interactionsEnabled}
              onDragStart={(event) => handleDragStart(object.id, event)}
              onDragMove={(event) => handleDragMove(object.id, event)}
              onDragEnd={(event) => handleDrag(object.id, event)}
              onHover={onHover}
              onDoubleClick={() => onRecolorToken(object.id, object.owner)}
              onClick={(event) => selectToken(object.id, event)}
              onTap={(event) => selectToken(object.id, event)}
              onNodeReady={
                onTokenNodeReady ? (node) => onTokenNodeReady(object.id, node) : undefined
              }
              popIn={poppingIds.has(object.id)}
              glide={draggingId === null}
              selected={isSelected}
            />
            {object.locked && (
              <LockIndicator
                x={object.transform.x * gridSize + gridSize / 2}
                y={object.transform.y * gridSize + gridSize / 2 - gridSize * 0.45}
                size={gridSize * 0.25}
              />
            )}
            {renderStatusBadges(object)}
            {renderHpFeedback(object)}
            {isFirstSelected && (
              <MultiSelectBadge
                x={object.transform.x * gridSize + gridSize * 0.85}
                y={object.transform.y * gridSize + gridSize * 0.15}
                size={gridSize * 0.3}
                count={selectedTokenCount}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
});
