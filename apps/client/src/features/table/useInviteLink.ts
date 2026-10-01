// ============================================================================
// INVITE LINK
// ============================================================================
// The link to this table and the act of copying it, for the two places that
// offer it: the DM menu's Table tab, and the next steps a host sees right after
// creating a table. Client-only — the link is the page URL pointed at this
// table's `?room=` code, and it never carries a password.
//
// `navigator.clipboard` is undefined on non-secure origins, which is exactly the
// "share my LAN IP with my players" case (http://192.168.x.x). A refused copy
// shows the link itself, to copy by hand, rather than failing silently.

import { useCallback, useEffect, useRef, useState } from "react";
import { currentRoomId, roomUrl } from "../rooms/roomDirectory";
import { SESSION_UID_OVERRIDE_PARAM } from "../../utils/session";

const COPIED_MS = 2000;

/**
 * The page URL pointed at this table, minus everything that is this tab's own: `roomUrl`
 * keeps every query parameter (the server address a LAN table needs among them), and a
 * pinned `?sessionUid=` would hand every invitee the host's identity.
 */
function inviteUrl(roomId: string | undefined): string {
  const url = new URL(roomUrl(roomId));
  url.searchParams.delete(SESSION_UID_OVERRIDE_PARAM);
  return url.toString();
}

export interface InviteLink {
  /** The `?room=` code of this table; undefined on the default table. */
  roomId: string | undefined;
  link: string;
  /** True for a moment after a successful copy. */
  copied: boolean;
  /** The link, when the clipboard was refused and the person has to copy it by hand. */
  manual: string | null;
  copy: () => Promise<void>;
}

export function useInviteLink(): InviteLink {
  const roomId = currentRoomId();
  const link = inviteUrl(roomId);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setManual(null);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      setCopied(false);
      setManual(link);
    }
  }, [link]);

  return { roomId, link, copied, manual, copy };
}
