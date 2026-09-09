// ============================================================================
// TRAVEL FOLLOWS THE STUDIO (A5; widened 2026-09-08)
// ============================================================================
// When the room's live pointer MOVES (travel, rebind, publish of another map)
// while the DM's active document WAS the previous live one, follow it. Two
// consumers hang off that active document: the palette's overlays (notes,
// preview grid), and the DM menu's Map Studio panel — whose PUBLISH TO LIVE
// MAP acts on whatever is active. This used to fire only while the palette
// was OPEN, so a DM who closed it, kicked in a door and opened Map Setup was
// shown the map they had LEFT as active, and publish published that: the
// table went blank on 2026-09-08. A document the DM deliberately opened (a
// draft, a backup) is never force-reverted: the follow fires only when the
// active document was the live one.

import { useEffect, useRef } from "react";

interface FollowLiveDocumentOptions {
  liveMapDocumentId: string | undefined;
  loading: boolean;
  /** The controller's currently open document id, if any. */
  activeId: string | undefined;
  openDocument: (documentId: string) => void;
}

export function useFollowLiveDocument({
  liveMapDocumentId,
  loading,
  activeId,
  openDocument,
}: FollowLiveDocumentOptions): void {
  const previousLiveId = useRef<string | undefined>(liveMapDocumentId);
  useEffect(() => {
    const before = previousLiveId.current;
    previousLiveId.current = liveMapDocumentId;
    if (!liveMapDocumentId || loading) return;
    if (!before || before === liveMapDocumentId) return;
    if (activeId !== before) return; // an explicit open stays put
    openDocument(liveMapDocumentId);
  }, [liveMapDocumentId, loading, activeId, openDocument]);
}
