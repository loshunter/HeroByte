// ============================================================================
// LIVE MAP ENTRY — how Build gets onto the table's map (extracted, U6)
// ============================================================================
// Start a table map, resume the table's map, or follow the table when it
// moves — and never swap an explicitly opened library map by itself. Split
// out of useMapEditState for the 350-LOC guard when U6 added what Build must
// know first: the library list (for names), and whether starting would erase
// a scene that has no saved map.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage } from "@herobyte/shared";
import type { MapStudioController } from "../map-studio/types";
import { describeBuildEntry } from "./buildEntry";
import { useFollowLiveDocument } from "./useFollowLiveDocument";

const LIVE_MAP_SIZE = 8192;

interface LiveMapEntryOptions {
  controller: MapStudioController;
  sendMessage: (message: ClientMessage) => void;
  mapEditMode: boolean;
  liveMapDocumentId: string | undefined;
  /** The compiled scene's own map (what the server would save on a switch). */
  sceneSourceDocumentId: string | undefined;
  hasBackground: boolean;
  roomGridSize: number;
}

/** What the Start/Resume button is waiting on: an open, or a create-then-bind. */
type Waiting = "open" | "bind" | null;

export function useLiveMapEntry({
  controller,
  sendMessage,
  mapEditMode,
  liveMapDocumentId,
  sceneSourceDocumentId,
  hasBackground,
  roomGridSize,
}: LiveMapEntryOptions) {
  // Stable controller methods (useCallback-memoized inside useMapStudio); the
  // controller OBJECT is recreated each render, so depend on these, not it.
  const {
    activeDocument,
    documents,
    loading,
    error,
    missingDocumentId,
    bindRefusal,
    listed,
    createDocument,
    openDocument,
    updateGrid,
    listQuietly,
  } = controller;
  const activeId = activeDocument?.id;
  // The id of a document we just created and are waiting to activate before
  // binding it live (createDocument returns synchronously, but the controller
  // no-ops every action until the server's map-studio-document reply lands).
  const [pendingLiveId, setPendingLiveId] = useState<string | null>(null);
  // Set from the click until the room snapshot confirms the binding (isLive),
  // so the button cannot re-enable between "set-live sent" and "snapshot
  // confirms" and a double-click cannot create a second orphan "Live Map".
  const [waiting, setWaiting] = useState<Waiting>(null);
  const bindTarget = useRef<string | null>(null);

  // The room's binding points at a document the server no longer has (the
  // maps store reset under the room — e.g. an ephemeral-disk restart). The
  // binding is DANGLING: never auto-open it again, and let START LIVE MAP
  // create a fresh document whose set-live repairs the room's binding.
  const bindingDangling = Boolean(liveMapDocumentId) && missingDocumentId === liveMapDocumentId;
  const isLive = Boolean(liveMapDocumentId) && activeId === liveMapDocumentId;

  // Build names maps and weighs what a start would replace, so it needs the
  // list. QUIETLY: a loud refresh would release `loading` under an open still
  // in flight (a second open) and hold up the follow-the-table effect.
  useEffect(() => {
    if (mapEditMode) listQuietly();
  }, [mapEditMode, listQuietly]);

  const startLiveMap = useCallback(() => {
    if (waiting) return; // an open or a create/bind is already in flight
    if (activeId && activeId === liveMapDocumentId) return; // already live
    if (liveMapDocumentId && !bindingDangling) {
      setWaiting("open");
      openDocument(liveMapDocumentId);
      return;
    }
    setWaiting("bind");
    // Forget the last attempt's target: the controller still holds its refusal,
    // which would otherwise release this new attempt's latch at once.
    bindTarget.current = null;
    // Date-stamped so repeated backup imports or binding-clearing session loads
    // do not produce a shelf of documents all reading "Live Map", which nothing
    // in the UI can then tell apart (there is no rename on the wire).
    const stamp = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    setPendingLiveId(createDocument(`Live Map ${stamp}`, LIVE_MAP_SIZE, LIVE_MAP_SIZE));
  }, [waiting, activeId, liveMapDocumentId, bindingDangling, openDocument, createDocument]);

  // Released once the binding is confirmed live by the room snapshot…
  useEffect(() => {
    if (isLive) setWaiting(null);
  }, [isLive]);

  // …or once it cannot land, or the button sat on Opening…/STARTING… for good.
  // A Resume: the table's map turned out to be gone, or the open failed.
  useEffect(() => {
    if (waiting === "open" && !loading && (bindingDangling || error)) setWaiting(null);
  }, [waiting, loading, bindingDangling, error]);
  // A create the server refused (a full library, the campaign ceiling): the
  // refusal releases `loading` and names the reason, and the id never lands.
  useEffect(() => {
    if (pendingLiveId && !loading && error && activeId !== pendingLiveId) {
      setPendingLiveId(null);
      setWaiting(null);
    }
  }, [pendingLiveId, loading, error, activeId]);
  // A bind the server refused. Not the dangling flag: that stays true until the
  // snapshot moves, and releasing on it reopened the double-click window.
  useEffect(() => {
    if (waiting === "bind" && bindRefusal && bindRefusal.documentId === bindTarget.current) {
      setWaiting(null);
    }
  }, [waiting, bindRefusal]);

  // Create → bind: once the freshly created document activates, bind it live and
  // sync its grid to the room. set-live FIRST so the grid command rides the S1
  // live-recompile hook and the table lattice self-corrects (§3).
  useEffect(() => {
    if (!pendingLiveId || activeId !== pendingLiveId) return;
    bindTarget.current = pendingLiveId;
    sendMessage({ t: "map-studio-set-live", documentId: pendingLiveId });
    updateGrid({ size: roomGridSize });
    setPendingLiveId(null);
  }, [pendingLiveId, activeId, sendMessage, updateGrid, roomGridSize]);

  // Rebind after a reload: entering map-edit with a live binding but NO active
  // document (fresh controller) auto-opens it. Bail whenever ANY document is
  // already active — including one the DM deliberately opened to view in the
  // library — so this never force-reverts an explicit open (Build offers
  // Resume editing instead). The loading guard prevents re-firing while the
  // fetch is in flight, and a DANGLING binding is never re-opened — without
  // that guard this looped open → not-found → open forever after a
  // server-side maps-store reset.
  useFollowLiveDocument({ liveMapDocumentId, loading, activeId, openDocument });

  useEffect(() => {
    if (!mapEditMode || !liveMapDocumentId || pendingLiveId || loading) return;
    if (activeId || bindingDangling) return;
    openDocument(liveMapDocumentId);
  }, [
    mapEditMode,
    liveMapDocumentId,
    bindingDangling,
    pendingLiveId,
    loading,
    activeId,
    openDocument,
  ]);

  return {
    isLive,
    busy: waiting !== null || pendingLiveId !== null || loading,
    startLiveMap,
    buildEntry: describeBuildEntry({
      isLive,
      liveMapDocumentId,
      bindingDangling,
      activeDocument,
      documents,
      sceneSourceDocumentId,
      missingDocumentId,
      listed,
      hasBackground,
    }),
  };
}
