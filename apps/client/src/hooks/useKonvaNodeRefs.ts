import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type Konva from "konva";
import type { SceneObject } from "@herobyte/shared";

export interface UseKonvaNodeRefsReturn {
  registerNode: (id: string, node: Konva.Node | null) => void;
  getNode: (id: string) => Konva.Node | undefined;
  getSelectedNode: () => Konva.Node | null;
  getAllNodes: () => Map<string, Konva.Node>;
  nodeRefsMap: MutableRefObject<Map<string, Konva.Node>>;
}

/**
 * Centralizes Konva node registration for MapBoard.
 *
 * Tracks all canvas nodes by their scene object id, keeps the currently selected node
 * in sync for the transform gizmo, and exposes performant access to the shared node map
 * for hot paths such as marquee selection.
 *
 * @example
 * ```tsx
 * const { registerNode, getAllNodes, getSelectedNode } = useKonvaNodeRefs(
 *   selectedObjectId,
 *   mapObject,
 * );
 *
 * const handleTokenNodeReady = useCallback((id: string, node: Konva.Node | null) => {
 *   registerNode(id, node);
 * }, [registerNode]);
 *
 * const marqueeSelect = () => {
 *   getAllNodes().forEach((node, id) => {
 *     // intersection logic here
 *   });
 * };
 *
 * const gizmoNode = getSelectedNode(); // Konva.Node | null
 * ```
 */
export function useKonvaNodeRefs(
  selectedObjectId: string | null | undefined,
  mapObject: SceneObject | undefined,
): UseKonvaNodeRefsReturn {
  const nodeRefsMap = useRef<Map<string, Konva.Node>>(new Map());
  const selectedNodeRef = useRef<Konva.Node | null>(null);
  const selectedIdRef = useRef<string | null | undefined>(selectedObjectId);
  // The selected node in state as well: a picture loading swaps a token's node for
  // a new one, and the transform gizmo (which reads getSelectedNode) must re-attach
  // to it instead of driving the destroyed placeholder.
  const [selectedNode, setSelectedNode] = useState<Konva.Node | null>(null);
  const select = useCallback((node: Konva.Node | null) => {
    selectedNodeRef.current = node;
    setSelectedNode(node);
  }, []);

  const registerNode = useCallback(
    (id: string, node: Konva.Node | null) => {
      if (!id) {
        return;
      }

      if (node) {
        nodeRefsMap.current.set(id, node);

        if (selectedIdRef.current === id) {
          select(node);
        }

        return;
      }

      const existing = nodeRefsMap.current.get(id);
      nodeRefsMap.current.delete(id);

      if (existing && existing === selectedNodeRef.current) {
        select(null);
      }
    },
    [select],
  );

  const getNode = useCallback((id: string) => nodeRefsMap.current.get(id), []);

  const getAllNodes = useCallback(() => nodeRefsMap.current, []);

  const getSelectedNode = useCallback(() => selectedNode, [selectedNode]);

  useEffect(() => {
    selectedIdRef.current = selectedObjectId;

    if (!selectedObjectId) {
      select(null);
      return;
    }

    select(nodeRefsMap.current.get(selectedObjectId) ?? null);
  }, [selectedObjectId, select]);

  useEffect(() => {
    if (!mapObject?.id) {
      return;
    }

    if (nodeRefsMap.current.has(mapObject.id)) {
      return;
    }

    for (const id of nodeRefsMap.current.keys()) {
      if (id.startsWith("map:") && id !== mapObject.id) {
        nodeRefsMap.current.delete(id);
      }
    }
  }, [mapObject?.id]);

  return useMemo(
    () => ({
      registerNode,
      getNode,
      getSelectedNode,
      getAllNodes,
      nodeRefsMap,
    }),
    [registerNode, getNode, getSelectedNode, getAllNodes],
  );
}
