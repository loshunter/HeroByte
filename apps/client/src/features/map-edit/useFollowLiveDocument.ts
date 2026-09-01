// ============================================================================
// TRAVEL FOLLOWS THE PALETTE (A5)
// ============================================================================
// When the room's live pointer MOVES (travel, rebind, publish of another map)
// while the DM's active document WAS the previous live one, follow it —
// otherwise NotesOverlayLayer and the preview grid keep rendering the OLD
// map's notes and lattice over the NEW map until the DM notices. A document
// the DM deliberately opened (a draft, a backup) is never force-reverted: the
// follow fires only when the palette was ON the live document.

import { useEffect, useRef } from "react";

interface FollowLiveDocumentOptions {
  mapEditMode: boolean;
  liveMapDocumentId: string | undefined;
  loading: boolean;
  /** The palette's currently open document id, if any. */
  activeId: string | undefined;
  openDocument: (documentId: string) => void;
}

export function useFollowLiveDocument({
  mapEditMode,
  liveMapDocumentId,
  loading,
  activeId,
  openDocument,
}: FollowLiveDocumentOptions): void {
  const previousLiveId = useRef<string | undefined>(liveMapDocumentId);
  useEffect(() => {
    const before = previousLiveId.current;
    previousLiveId.current = liveMapDocumentId;
    if (!mapEditMode || !liveMapDocumentId || loading) return;
    if (!before || before === liveMapDocumentId) return;
    if (activeId !== before) return; // an explicit open stays put
    openDocument(liveMapDocumentId);
  }, [mapEditMode, liveMapDocumentId, loading, activeId, openDocument]);
}
