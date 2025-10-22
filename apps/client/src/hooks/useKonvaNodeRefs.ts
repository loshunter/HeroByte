import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import type Konva from "konva";
import type { SceneObject } from "@shared";

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

  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (!id) {
      return;
    }

    if (node) {
      nodeRefsMap.current.set(id, node);

      if (selectedIdRef.current === id) {
        selectedNodeRef.current = node;
      }

      return;
    }

    const existing = nodeRefsMap.current.get(id);
    nodeRefsMap.current.delete(id);

    if (existing && existing === selectedNodeRef.current) {
      selectedNodeRef.current = null;
    }
  }, []);

  const getNode = useCallback((id: string) => nodeRefsMap.current.get(id), []);

  const getAllNodes = useCallback(() => nodeRefsMap.current, []);

  const getSelectedNode = useCallback(() => selectedNodeRef.current, []);

  useEffect(() => {
    selectedIdRef.current = selectedObjectId;

    if (!selectedObjectId) {
      selectedNodeRef.current = null;
      return;
    }

    const node = nodeRefsMap.current.get(selectedObjectId) ?? null;
    selectedNodeRef.current = node;
  }, [selectedObjectId]);

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
