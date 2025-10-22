import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { MutableRefObject } from "react";
import type { SelectionRequestOptions } from "../ui/MapBoard.types";

type Point = { x: number; y: number };

export interface UseMarqueeSelectionOptions {
  stageRef: MutableRefObject<Konva.Stage | null>;
  selectMode: boolean;
  pointerMode: boolean;
  measureMode: boolean;
  drawMode: boolean;
  getAllNodes: () => Map<string, Konva.Node>;
  onSelectObject?: (objectId: string | null, options?: SelectionRequestOptions) => void;
  onSelectObjects?: (objectIds: string[]) => void;
  minSelectionSize?: number;
}

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseMarqueeSelectionReturn {
  isActive: boolean;
  marqueeRect: MarqueeRect | null;
  handlePointerDown: (event: KonvaEventObject<PointerEvent>) => void;
  handlePointerMove: () => void;
  handlePointerUp: () => void;
  cancelMarquee: () => void;
}

interface MarqueeState {
  start: Point;
  current: Point;
}

const DEFAULT_MIN_SELECTION_SIZE = 4;

export function useMarqueeSelection({
  stageRef,
  selectMode,
  pointerMode,
  measureMode,
  drawMode,
  getAllNodes,
  onSelectObject,
  onSelectObjects,
  minSelectionSize = DEFAULT_MIN_SELECTION_SIZE,
}: UseMarqueeSelectionOptions): UseMarqueeSelectionReturn {
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);

  const updateMarquee = useCallback(
    (updater: (prev: MarqueeState | null) => MarqueeState | null) => {
      setMarquee((prev) => {
        const next = updater(prev);
        marqueeRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!selectMode) {
      updateMarquee(() => null);
    }
  }, [selectMode, updateMarquee]);

  const marqueeRect = useMemo<MarqueeRect | null>(() => {
    if (!marquee) {
      return null;
    }
    const { start, current } = marquee;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(start.x - current.x);
    const height = Math.abs(start.y - current.y);
    return { x, y, width, height };
  }, [marquee]);

  const handlePointerDown = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      if (
        !selectMode ||
        pointerMode ||
        measureMode ||
        drawMode ||
        event.evt?.button !== 0 ||
        !stageRef.current ||
        event.target !== stageRef.current
      ) {
        return;
      }

      const pointer = stageRef.current.getPointerPosition();
      if (!pointer) {
        return;
      }

      updateMarquee(() => ({ start: pointer, current: pointer }));
    },
    [drawMode, measureMode, pointerMode, selectMode, stageRef, updateMarquee],
  );

  const handlePointerMove = useCallback(() => {
    if (!stageRef.current) {
      return;
    }

    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) {
      return;
    }

    updateMarquee((prev) => (prev ? { ...prev, current: pointer } : prev));
  }, [stageRef, updateMarquee]);

  const applySelection = useCallback(
    (rect: MarqueeRect | null) => {
      if (!rect || !stageRef.current) {
        return;
      }

      const matches: string[] = [];
      getAllNodes().forEach((node, id) => {
        if (
          !node ||
          (!id.startsWith("token:") && !id.startsWith("drawing:") && !id.startsWith("prop:"))
        ) {
          return;
        }

        const nodeRect = node.getClientRect({ relativeTo: stageRef.current! });
        const nodeMinX = nodeRect.x;
        const nodeMinY = nodeRect.y;
        const nodeMaxX = nodeRect.x + nodeRect.width;
        const nodeMaxY = nodeRect.y + nodeRect.height;

        const intersects =
          nodeMinX <= rect.x + rect.width &&
          nodeMaxX >= rect.x &&
          nodeMinY <= rect.y + rect.height &&
          nodeMaxY >= rect.y;

        if (intersects) {
          matches.push(id);
        }
      });

      if (matches.length === 0) {
        if (rect.width < minSelectionSize && rect.height < minSelectionSize) {
          onSelectObject?.(null);
        } else {
          onSelectObject?.(null);
        }
        return;
      }

      if (onSelectObjects) {
        onSelectObjects(matches);
        return;
      }

      matches.forEach((id, index) => {
        const mode: SelectionRequestOptions["mode"] = index === 0 ? "replace" : "append";
        onSelectObject?.(id, { mode });
      });
    },
    [getAllNodes, minSelectionSize, onSelectObject, onSelectObjects, stageRef],
  );

  const handlePointerUp = useCallback(() => {
    const rect = marqueeRef.current
      ? {
          x: Math.min(marqueeRef.current.start.x, marqueeRef.current.current.x),
          y: Math.min(marqueeRef.current.start.y, marqueeRef.current.current.y),
          width: Math.abs(marqueeRef.current.start.x - marqueeRef.current.current.x),
          height: Math.abs(marqueeRef.current.start.y - marqueeRef.current.current.y),
        }
      : null;

    applySelection(rect);
    updateMarquee(() => null);
  }, [applySelection, updateMarquee]);

  const cancelMarquee = useCallback(() => {
    updateMarquee(() => null);
  }, [updateMarquee]);

  return {
    isActive: marquee !== null,
    marqueeRect,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    cancelMarquee,
  };
}
