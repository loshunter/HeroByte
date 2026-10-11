// ============================================================================
// TRANSFORM GIZMO COMPONENT
// ============================================================================
// Provides visual handles for rotating and scaling scene objects using Konva Transformer.
// Respects the `locked` flag on scene objects.

import { useEffect, useRef, useState } from "react";
import { Transformer, Group, Rect, Line } from "react-konva";
import type Konva from "konva";
import type { SceneObject } from "@herobyte/shared";
import { useSelectionPalette } from "../selectionPalette";
import { GIZMO_PADDING, GizmoKeyline } from "./GizmoKeyline";

// One array for every render: a new one each render made react-konva re-apply the
// snaps on every transform event, undoing Ctrl's free rotation mid-drag. The other
// array and function props are constants for the same reason: the gizmo re-renders
// on every pointer move (updateHandle), and a new one made Konva redo its layout.
const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const ENABLED_ANCHORS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "top-center",
  "bottom-center",
  "middle-left",
  "middle-right",
];
const BORDER_DASH = [5, 5];

/** Refuses a box under 5 px or over ten times the last one. */
const boundBox: NonNullable<Konva.TransformerConfig["boundBoxFunc"]> = (oldBox, newBox) => {
  if (newBox.width < 5 || newBox.height < 5) return oldBox;
  if (newBox.width > oldBox.width * 10 || newBox.height > oldBox.height * 10) return oldBox;
  return newBox;
};

interface TransformGizmoProps {
  selectedObject: SceneObject | null;
  onTransform: (updates: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
  getNodeRef: () => Konva.Node | null; // Function to get the Konva node to attach to
}

const ORIGINAL_DRAG_KEY = "__herobyte_original_draggable";
/** The scene id the handles were put on, so a restore can ask whether THAT piece is now locked. */
const GIZMO_SCENE_ID_KEY = "__herobyte_gizmo_scene_id";
const HANDLE_SIZE = 18;

/**
 * TransformGizmo: Visual transform handles for scene objects
 *
 * Features:
 * - Rotation handles
 * - Scale handles
 * - Respects locked state (disables when locked)
 * - Attaches to the currently selected scene object
 */
export function TransformGizmo({
  selectedObject,
  onTransform,
  getNodeRef,
}: TransformGizmoProps): JSX.Element | null {
  const transformerRef = useRef<Konva.Transformer>(null);
  const keylineRef = useRef<Konva.Transformer>(null);
  const palette = useSelectionPalette();
  const currentNodeRef = useRef<Konva.Node | null>(null);
  const [handlePosition, setHandlePosition] = useState<{ x: number; y: number } | null>(null);
  // The selection as of THIS render, read by the cleanup below (whose closure holds the
  // previous one): locking a piece under the handles unmounts the transformer after the
  // layer has already set the node undraggable, and restoring the saved `true` then left
  // a locked piece draggable for the rest of the session.
  const latestSelectionRef = useRef<SceneObject | null>(selectedObject);
  latestSelectionRef.current = selectedObject;

  const restoreNodeDraggable = (node: Konva.Node | null) => {
    if (!node) return;
    const original = node.getAttr(ORIGINAL_DRAG_KEY);
    if (typeof original === "boolean") {
      const latest = latestSelectionRef.current;
      const nowLocked = latest?.locked === true && latest.id === node.getAttr(GIZMO_SCENE_ID_KEY);
      node.draggable(nowLocked ? false : original);
    }
    node.setAttr(ORIGINAL_DRAG_KEY, undefined);
  };

  const setCursor = (cursor: string) => {
    const stage = transformerRef.current?.getStage();
    if (stage) {
      stage.container().style.cursor = cursor;
    }
  };

  const handleCenterPointerDown = () => {
    const node = currentNodeRef.current ?? getNodeRef();
    if (!node) return;
    setCursor("grabbing");
    node.startDrag();
  };

  const handleCenterPointerEnter = () => setCursor("move");
  const handleCenterPointerLeave = () => setCursor("default");

  useEffect(() => {
    const transformer = transformerRef.current;
    const node = getNodeRef();
    const previousNode = currentNodeRef.current;

    if (!transformer) return;
    // The gizmo and its keyline (a viewer's colour) always hold the same nodes.
    const attach = (nodes: Konva.Node[]) => {
      transformer.nodes(nodes);
      keylineRef.current?.nodes(nodes);
    };

    // Always detach first to prevent stale references
    attach([]);

    if (previousNode && previousNode !== node) {
      restoreNodeDraggable(previousNode);
      currentNodeRef.current = null;
    }

    if (selectedObject && !selectedObject.locked && node) {
      currentNodeRef.current = node;

      if (typeof node.getAttr(ORIGINAL_DRAG_KEY) !== "boolean") {
        node.setAttr(ORIGINAL_DRAG_KEY, node.draggable());
      }
      node.setAttr(GIZMO_SCENE_ID_KEY, selectedObject.id);
      node.draggable(true);

      try {
        attach([node]);
        transformer.getLayer()?.batchDraw();
      } catch (error) {
        console.warn("[TransformGizmo] Failed to attach node:", error);
        attach([]);
      }
    } else {
      setHandlePosition(null);
      restoreNodeDraggable(node ?? previousNode ?? null);
      transformer.getLayer()?.batchDraw();
      currentNodeRef.current = null;
    }

    return () => {
      restoreNodeDraggable(currentNodeRef.current);
      currentNodeRef.current = null;
      attach([]);
      setHandlePosition(null);
      setCursor("default");
    };
  }, [selectedObject, getNodeRef]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const node = currentNodeRef.current ?? getNodeRef();

    if (!transformer || !node || !selectedObject || selectedObject.locked) {
      setHandlePosition(null);
      return;
    }

    const updateHandle = () => {
      const box = transformer.getClientRect();
      setHandlePosition({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    };

    updateHandle();

    const handleNodeDragMove = () => {
      updateHandle();
    };

    const handleNodeDragEnd = () => {
      updateHandle();
      setCursor("default");
    };

    transformer.on("transform", updateHandle);
    transformer.on("transformend", updateHandle);
    transformer.on("dragmove", updateHandle);
    node.on("dragmove", handleNodeDragMove);
    node.on("dragend", handleNodeDragEnd);

    return () => {
      transformer.off("transform", updateHandle);
      transformer.off("transformend", updateHandle);
      transformer.off("dragmove", updateHandle);
      node.off("dragmove", handleNodeDragMove);
      node.off("dragend", handleNodeDragEnd);
    };
  }, [selectedObject, getNodeRef]);

  const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
    if (!selectedObject) return;
    const node = getNodeRef();
    const transformer = transformerRef.current;
    if (!node || !transformer) return;

    try {
      // Ctrl (Cmd) rotates freely; otherwise 45° snaps. Read from the pointer event
      // itself: a window key flag stuck "on" when the key-up went elsewhere (Ctrl+T,
      // Cmd+Tab), and snapping stayed off until Ctrl was tapped again.
      const pointer = e.evt as MouseEvent | undefined;
      const free = Boolean(pointer?.ctrlKey || pointer?.metaKey);
      transformer.rotationSnaps(free ? [] : ROTATION_SNAPS);
    } catch (error) {
      // Ignore errors during transform (node might be destroyed)
      console.warn("[TransformGizmo] Transform error:", error);
    }
  };

  const handleTransformEnd = () => {
    if (!selectedObject) return;
    const node = getNodeRef();
    if (!node) return;

    try {
      // The node's current transform values ARE the final values
      // (no longer working with deltas since we don't reset the node)
      const finalScaleX = node.scaleX();
      const finalScaleY = node.scaleY();
      let finalRotation = node.rotation();
      const finalX = node.x();
      const finalY = node.y();

      // Normalize rotation to 0-360 range
      finalRotation = finalRotation % 360;
      if (finalRotation < 0) {
        finalRotation += 360;
      }

      onTransform({
        id: selectedObject.id,
        position: { x: finalX, y: finalY },
        scale: { x: finalScaleX, y: finalScaleY },
        rotation: finalRotation,
      });
    } catch (error) {
      // Ignore errors (node might have been destroyed during drag)
      console.warn("[TransformGizmo] Transform end error:", error);
    }
  };

  // Don't render if no object is selected or if locked
  if (!selectedObject || selectedObject.locked) {
    return null;
  }

  return (
    <>
      <GizmoKeyline ref={keylineRef} keyline={palette.keyline} />
      <Transformer
        ref={transformerRef}
        rotateEnabled={true}
        enabledAnchors={ENABLED_ANCHORS}
        // In a viewer's colour the dashed border (and the rotate line Konva draws with
        // it) is the colour over GizmoKeyline's solid keyline, just outside the ring.
        padding={palette.keyline ? GIZMO_PADDING : 0}
        borderStroke={palette.stroke}
        borderStrokeWidth={2}
        borderDash={BORDER_DASH}
        anchorFill={palette.stroke}
        anchorStroke={palette.keyline ?? "#FFFFFF"}
        anchorStrokeWidth={2}
        anchorSize={10}
        anchorCornerRadius={2}
        rotateAnchorOffset={30}
        rotationSnaps={ROTATION_SNAPS}
        rotationSnapTolerance={10}
        keepRatio={false}
        boundBoxFunc={boundBox}
        // At the press too: Konva reads the snaps before it fires `transform`, so a
        // choice made only there applied one move late (the last Ctrl drag's, at first).
        onTransformStart={handleTransform}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
      />
      {handlePosition && (
        <Group
          x={handlePosition.x}
          y={handlePosition.y}
          offsetX={HANDLE_SIZE / 2}
          offsetY={HANDLE_SIZE / 2}
          onMouseDown={handleCenterPointerDown}
          onTouchStart={handleCenterPointerDown}
          onMouseEnter={handleCenterPointerEnter}
          onMouseLeave={handleCenterPointerLeave}
        >
          {/* In a viewer's colour: a keyline edge, the colour inside it, the cross in the keyline. */}
          <Rect
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            cornerRadius={4}
            fill={palette.handleFill}
            stroke={palette.keyline ?? palette.stroke}
            // 3.5 under the 1.5 colour stroke: 1 px of keyline each side.
            strokeWidth={palette.keyline ? 3.5 : 1.5}
          />
          {palette.keyline && (
            <Rect
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              cornerRadius={4}
              stroke={palette.stroke}
              strokeWidth={1.5}
              listening={false}
            />
          )}
          <Line
            points={[HANDLE_SIZE / 2, 4, HANDLE_SIZE / 2, HANDLE_SIZE - 4]}
            stroke={palette.keyline ?? "#FFFFFF"}
            strokeWidth={2}
            lineCap="round"
          />
          <Line
            points={[4, HANDLE_SIZE / 2, HANDLE_SIZE - 4, HANDLE_SIZE / 2]}
            stroke={palette.keyline ?? "#FFFFFF"}
            strokeWidth={2}
            lineCap="round"
          />
        </Group>
      )}
    </>
  );
}
