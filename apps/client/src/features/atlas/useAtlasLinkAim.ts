// ============================================================================
// ATLAS LINK AIM — one-shot canvas capture for placing a MapLink
// ============================================================================
// An ATLAS action, deliberately not a map-edit sub-tool (plan §2.3: links are
// room state, not document elements). Rides the ToolMode axis exactly the way
// alignment does: the DM arms it from the Atlas tab, the next stage click is
// converted to DOCUMENT px by MapBoard and handed here, and the send disarms.
//
// The pending payload lives in a REF so the capture is one-shot even when a
// tap's compat click arrives as a second event in the same frame — the ref is
// cleared before the send, and the duplicate finds nothing to fire.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, MapLink } from "@herobyte/shared";
import type { ToolMode } from "../../components/layout/Header";
import { generateUUID } from "../../utils/uuid";
import { escapeRegistry, useEscapeOwner } from "../interaction/useEscapeOwner";

/** Everything but the anchor, which the canvas click supplies. */
export interface PendingLink {
  fromNodeId: string;
  toNodeId: string;
  linkType: MapLink["linkType"];
  visibleToPlayers: boolean;
}

export interface AtlasLinkAim {
  /** True while the next stage click belongs to link placement. */
  linkAimActive: boolean;
  armLinkAim: (pending: PendingLink) => void;
  cancelLinkAim: () => void;
  /** MapBoard calls this with the clicked point in DOCUMENT px. */
  captureLinkAnchor: (point: { x: number; y: number }) => void;
}

interface UseAtlasLinkAimOptions {
  activeTool: ToolMode;
  setActiveTool: (tool: ToolMode) => void;
  sendMessage: (message: ClientMessage) => void;
  /**
   * The scene on the table (`compiledScene.sourceDocumentId`). The pending
   * payload froze `fromNodeId` at arm time, so a travel or rebind underneath
   * an armed aim would measure the click on the WRONG map and pin the link
   * on the old one — the same document-swap hazard useGenerate/usePopulate
   * disarm on (A5); this aim was left out of that fix.
   */
  sceneId: string | undefined;
}

export function useAtlasLinkAim({
  activeTool,
  setActiveTool,
  sendMessage,
  sceneId,
}: UseAtlasLinkAimOptions): AtlasLinkAim {
  const pendingRef = useRef<PendingLink | null>(null);
  const armedSceneRef = useRef<string | undefined>(undefined);
  const [armed, setArmed] = useState(false);
  const linkAimActive = armed && activeTool === "atlas-link";

  const armLinkAim = useCallback(
    (pending: PendingLink) => {
      // Transition cancellation must finish before the new one-shot payload exists.
      setActiveTool("atlas-link");
      pendingRef.current = pending;
      armedSceneRef.current = sceneId;
      setArmed(true);
      escapeRegistry.refresh();
    },
    [setActiveTool, sceneId],
  );

  const cancelLinkAim = useCallback(() => {
    pendingRef.current = null;
    setArmed(false);
    setActiveTool(null);
    escapeRegistry.refresh();
  }, [setActiveTool]);

  useEscapeOwner(() => ({
    kind: "gesture",
    name: "Atlas link aim",
    // The ref is authoritative during arm/cancel/capture in the same event.
    active: pendingRef.current !== null,
    order: 10,
    label: "Cancel link placement",
    // This one-shot action already returns to Move; it is not a reusable brush.
    handle: cancelLinkAim,
  }));

  const captureLinkAnchor = useCallback(
    (point: { x: number; y: number }) => {
      const pending = pendingRef.current;
      if (!pending) return; // disarmed, or the duplicate compat click
      pendingRef.current = null;
      setArmed(false);
      sendMessage({
        t: "atlas-create-link",
        link: { id: generateUUID(), ...pending, anchor: { x: point.x, y: point.y } },
      });
      setActiveTool(null);
      escapeRegistry.refresh();
    },
    [sendMessage, setActiveTool],
  );

  // Another tool taking the axis is a cancel — the alignment cleanup idiom.
  // Only after the axis was actually OURS: arming and the tool change land in
  // separate renders, and a cleanup that fires on the gap disarms every arm
  // the instant it happens.
  const sawToolRef = useRef(false);
  useEffect(() => {
    if (!armed) {
      sawToolRef.current = false;
      return;
    }
    if (activeTool === "atlas-link") {
      sawToolRef.current = true;
      return;
    }
    if (sawToolRef.current) {
      pendingRef.current = null;
      setArmed(false);
      sawToolRef.current = false;
      escapeRegistry.refresh();
    }
  }, [armed, activeTool]);

  // The scene moved under the aim (travel, rebind, publish of another map):
  // the anchor would be measured on a map the pending fromNodeId is not on.
  useEffect(() => {
    if (armed && sceneId !== armedSceneRef.current) cancelLinkAim();
  }, [armed, sceneId, cancelLinkAim]);

  return { linkAimActive, armLinkAim, cancelLinkAim, captureLinkAnchor };
}
