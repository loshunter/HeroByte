// ============================================================================
// POINTER TOOL HOOK
// ============================================================================
// Manages pointer and measure tool state
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ClientMessage, MeasurePoint } from "@herobyte/shared";

interface UsePointerToolOptions {
  pointerMode: boolean;
  measureMode: boolean;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  sendMessage: (msg: ClientMessage) => void;
}

interface UsePointerToolReturn {
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  pointerPreview: { x: number; y: number } | null;
  onStageClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
}

type MeasurePayload = { start: MeasurePoint; end: MeasurePoint } | null;

/**
 * Ceiling on how often a dragged measurement hits the socket. The rubber band
 * updates on every mouse move — at 60 Hz that is most of the per-uid rate
 * budget (100 messages/second) spent on one gesture. ~16/s is smooth enough
 * that the remote line tracks the local one and leaves the budget for the rest
 * of the table.
 */
const MEASURE_BROADCAST_MS = 60;

/**
 * Hook to manage pointer and measure tool interactions
 */
export function usePointerTool(options: UsePointerToolOptions): UsePointerToolReturn {
  const { pointerMode, measureMode, toWorld, sendMessage } = options;

  // Measure tool state
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  /**
   * True once the second click has FROZEN the measurement.
   *
   * This flag is the fix for a defect that predates the broadcast: the click
   * cycle keyed on `measureEnd`, but `onMouseMove` sets `measureEnd` on every
   * mouse move — so by the time the second click arrived the "start over"
   * branch was always the one taken, and the measurement was wiped instead of
   * committed. With a mouse the tool could therefore never hold a reading;
   * `docs/user-guide/img/measure-tool.jpg` is a recording of exactly that,
   * showing a measure-mode screenshot with no measurement in it.
   */
  const [measureCommitted, setMeasureCommitted] = useState(false);
  const [pointerPreview, setPointerPreview] = useState<{ x: number; y: number } | null>(null);

  // Broadcast bookkeeping. Refs, not state: a throttle that re-rendered on
  // every tick would defeat the point of throttling.
  const lastSentAtRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<MeasurePayload>(null);
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const flushMeasure = useCallback(() => {
    trailingTimerRef.current = null;
    lastSentAtRef.current = Date.now();
    sendMessageRef.current({ t: "measure", measure: latestRef.current });
  }, []);

  /**
   * Publish the measurement so the rest of the table sees the same line.
   *
   * Leading-edge throttle with a trailing flush: the first move goes out at
   * once (so a remote viewer sees the line appear immediately) and the LAST
   * position always follows, because a dropped final frame would leave
   * everyone else looking at a line that ends somewhere the measurer isn't.
   *
   * A clear (`null`) when nothing was published is skipped entirely — leaving
   * a tool nobody measured with must not cost a message.
   */
  const broadcastMeasure = useCallback(
    (measure: MeasurePayload, immediate = false) => {
      if (measure === null && latestRef.current === null) return;
      latestRef.current = measure;
      const elapsed = Date.now() - lastSentAtRef.current;
      if (immediate || elapsed >= MEASURE_BROADCAST_MS) {
        if (trailingTimerRef.current !== null) {
          clearTimeout(trailingTimerRef.current);
        }
        flushMeasure();
        return;
      }
      if (trailingTimerRef.current === null) {
        trailingTimerRef.current = setTimeout(flushMeasure, MEASURE_BROADCAST_MS - elapsed);
      }
    },
    [flushMeasure],
  );

  // Clear measure tool when mode changes
  useEffect(() => {
    if (!measureMode) {
      setMeasureStart(null);
      setMeasureEnd(null);
      setMeasureCommitted(false);
      // Putting the tool away retires your line on everyone else's screen too.
      broadcastMeasure(null, true);
    }
  }, [measureMode, broadcastMeasure]);

  // Leaving the table mid-measurement must not strand a line on the others'
  // screens either. (They also prune on disconnect, but only once the server
  // notices; this is the instant path.)
  useEffect(() => {
    return () => {
      if (trailingTimerRef.current !== null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
      if (latestRef.current !== null) {
        latestRef.current = null;
        sendMessageRef.current({ t: "measure", measure: null });
      }
    };
  }, []);

  useEffect(() => {
    if (!pointerMode) {
      setPointerPreview(null);
    }
  }, [pointerMode]);

  /**
   * Handle stage clicks for pointer and measure tools
   */
  const onStageClick = (event: KonvaEventObject<MouseEvent | PointerEvent>) => {
    if (!pointerMode && !measureMode) return;

    const stage = event.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const world = toWorld(pointer.x, pointer.y);

    if (pointerMode) {
      sendMessage({ t: "point", x: world.x, y: world.y });
      setPointerPreview(world);
    } else if (measureMode) {
      if (!measureStart || measureCommitted) {
        // Third click (or the first): drop the frozen reading and re-anchor.
        setMeasureStart(world);
        setMeasureEnd(null);
        setMeasureCommitted(false);
        // A fresh anchor retires the finished line rather than leaving the old
        // one hanging on every other screen until the next drag.
        broadcastMeasure(null, true);
      } else if (world.x === measureStart.x && world.y === measureStart.y) {
        // A zero-length reading is not a reading, and this is REACHABLE on
        // touch: a tap fires Konva's `tap` AND the browser's compatibility
        // click, so one finger would otherwise anchor and immediately freeze
        // 0 ft — and broadcast it to the table. Ignore it; the next tap
        // elsewhere commits properly.
      } else {
        // Second click: FREEZE the reading where it is, so the table can look
        // at it and argue about it.
        setMeasureEnd(world);
        setMeasureCommitted(true);
        // Never throttled: this is the number everyone is about to read.
        broadcastMeasure({ start: measureStart, end: world }, true);
      }
    }
  };

  /**
   * Update measure tool end point as mouse moves
   */
  const onMouseMove = (stageRef: RefObject<Konva.Stage | null>) => {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const world = toWorld(pointer.x, pointer.y);

    if (pointerMode) {
      setPointerPreview(world);
    }

    // A frozen measurement stays put until the next click re-anchors it.
    if (measureMode && measureStart && !measureCommitted) {
      setMeasureEnd(world);
      broadcastMeasure({ start: measureStart, end: world });
    }
  };

  return {
    measureStart,
    measureEnd,
    pointerPreview,
    onStageClick,
    onMouseMove,
  };
}
