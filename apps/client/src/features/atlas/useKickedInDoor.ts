// ============================================================================
// KICKED-IN DOOR — the DM's one keystroke, App-level
// ============================================================================
// G opens the panel, ROLL sends ONE atlas-kick, and the hook then watches
// for the arrival (the snapshot's current node becoming the child), a matching
// atlas-error, or a timeout. Lives beside useAtlasLinkAim at App level so it
// survives the desktop/mobile layout swap: the pending state is the DM's, not
// a layout's.
//
// The ids are minted ONCE per panel session and kept through a timeout, so a
// ROLL after "the door didn't budge" REUSES them and lands on the server's
// replay guard (plan §4.4) instead of kicking twice. They are dropped on an
// arrival (the next kick is a new door) and on a failure (nothing landed, and
// a colliding id was the one failure a fresh set cures).

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type {
  ClientMessage,
  GenerateRequest,
  MapLink,
  RoomSnapshot,
  ServerMessage,
} from "@herobyte/shared";
import type { ToolMode } from "../../components/layout/Header";
import { generateUUID } from "../../utils/uuid";
import { isEditableTarget } from "../../utils/isEditableTarget";
import { loadKickSettings, saveKickSettings, type KickSettings } from "./kickDefaults";

export const KICK_PENDING_TIMEOUT_MS = 20_000;

export type AtlasErrorMessage = Extract<ServerMessage, { t: "atlas-error" }>;

export interface KickRequest {
  name: string;
  seed: number;
  recipe: GenerateRequest;
  linkType: MapLink["linkType"];
}

export interface KickPending {
  nodeId: string;
  name: string;
  startedAt: number;
  /** The timeout fired; the ids are kept so a re-ROLL is a safe replay. */
  expired: boolean;
}

export interface KickControls {
  open: boolean;
  openKick: () => void;
  closeKick: () => void;
  kick: (request: KickRequest) => void;
  pending: KickPending | null;
  /** The dials the DM last rolled with (remembered per browser). */
  settings: KickSettings;
  /** False while nothing is compiled on the table — nothing to kick out of. */
  canKick: boolean;
}

/** The slice of useToast the hook needs; `info` must hand back the id it minted. */
export interface KickToasts {
  info: (message: string, duration?: number) => string;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

interface UseKickedInDoorOptions {
  isDM: boolean;
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  activeTool: ToolMode;
  toast: KickToasts;
  /**
   * Filled by the hook, called by useServerEventHandlers' atlas-error branch.
   * A ref, because registerServerEventHandler is single-subscriber and that
   * hook already owns the subscription.
   */
  atlasErrorRef: MutableRefObject<((message: AtlasErrorMessage) => void) | null>;
  /** The sticky "Kicking in the door…" toast; a phone shows a dock chip instead. */
  pendingToast?: boolean;
  now?: () => number;
  pendingTimeoutMs?: number;
}

interface MintedIds {
  commandId: string;
  nodeId: string;
  originNodeId: string;
  linkId: string;
  returnLinkId: string;
}

function mintIds(): MintedIds {
  return {
    commandId: generateUUID(),
    nodeId: generateUUID(),
    originNodeId: generateUUID(),
    linkId: generateUUID(),
    returnLinkId: generateUUID(),
  };
}

export function useKickedInDoor({
  isDM,
  snapshot,
  sendMessage,
  activeTool,
  toast,
  atlasErrorRef,
  pendingToast = true,
  now = Date.now,
  pendingTimeoutMs = KICK_PENDING_TIMEOUT_MS,
}: UseKickedInDoorOptions): KickControls {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<KickPending | null>(null);
  const [settings, setSettings] = useState<KickSettings>(() => loadKickSettings());
  const idsRef = useRef<MintedIds | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef<string | null>(null);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const canKick = Boolean(snapshot?.compiledScene);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissStickyToast = useCallback(() => {
    if (toastIdRef.current !== null) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, [toast]);

  const openKick = useCallback(() => {
    if (!isDM) return;
    setOpen(true);
  }, [isDM]);

  const closeKick = useCallback(() => setOpen(false), []);

  const kick = useCallback(
    (request: KickRequest) => {
      if (!isDM) return;
      const ids = idsRef.current ?? mintIds();
      idsRef.current = ids;
      const name = request.name.trim();
      sendMessage({
        t: "atlas-kick",
        ...ids,
        name,
        seed: request.seed,
        recipe: request.recipe,
        linkType: request.linkType,
      });
      const next: KickSettings = { recipe: request.recipe, linkType: request.linkType };
      setSettings(next);
      saveKickSettings(next);
      setOpen(false);
      dismissStickyToast();
      if (pendingToast) {
        toastIdRef.current = toast.info("🚪 Kicking in the door…", 0);
      }
      setPending({ nodeId: ids.nodeId, name, startedAt: now(), expired: false });
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // Non-destructive: the kick may still land (a late arrival toasts as
        // one); the ids are kept so a re-ROLL is a replay, never a second door.
        setPending((current) =>
          current && current.nodeId === ids.nodeId ? { ...current, expired: true } : current,
        );
        dismissStickyToast();
        toast.error("The door didn't budge — ROLL again (same ids)");
      }, pendingTimeoutMs);
    },
    [isDM, sendMessage, dismissStickyToast, pendingToast, toast, now, clearTimer, pendingTimeoutMs],
  );

  // A LAYOUT CROSSING mid-kick must not leave the DM with no indicator at all.
  // `pendingToast` is decided by the platform (`!isMobile`) and was read only
  // once, at ROLL: a kick rolled on a phone mints no toast because the dock
  // chip is its indicator, but the chip lives in MobileFloatingControls — so
  // crossing to the desktop layout while the door is still swinging took the
  // chip away and left nothing behind it, including when it later timed out.
  // Minting here instead of only at ROLL makes the indicator follow the
  // layout. Idempotent: the ref is the one that exists, and the arrival and
  // timeout paths below dismiss it however it was minted.
  useEffect(() => {
    if (!pendingToast || !pending || pending.expired || toastIdRef.current) return;
    toastIdRef.current = toast.info("🚪 Kicking in the door…", 0);
  }, [pendingToast, pending, toast]);

  // ARRIVAL: the snapshot's current node is the child — the kick landed. A
  // late arrival after the timeout still counts.
  const currentAtlasNodeId = snapshot?.currentAtlasNodeId;
  useEffect(() => {
    if (!pending || currentAtlasNodeId !== pending.nodeId) return;
    clearTimer();
    dismissStickyToast();
    toast.success(`🚪 ${pending.name} — kicked in`);
    idsRef.current = null;
    setPending(null);
  }, [currentAtlasNodeId, pending, clearTimer, dismissStickyToast, toast]);

  // FAILURE: the server's atlas-error for OUR node (the existing chain toasts
  // the reason); a foreign error is someone else's business.
  useEffect(() => {
    atlasErrorRef.current = (message) => {
      if (!pending || message.nodeId !== pending.nodeId) return;
      clearTimer();
      dismissStickyToast();
      idsRef.current = null;
      setPending(null);
    };
    return () => {
      atlasErrorRef.current = null;
    };
  }, [atlasErrorRef, pending, clearTimer, dismissStickyToast]);

  // G — the keystroke. Bubble phase on window, like every other single-key
  // shortcut; a typing surface, a player, a tool on the axis, any modifier or
  // a held key all mean "not for me".
  useEffect(() => {
    if (!isDM) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "g") return;
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target) || activeToolRef.current !== null) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDM]);

  // Escape closes the panel from anywhere — the panel handles its own Escape
  // (and stops it) when focus is inside; this catches a DM who clicked away.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isEditableTarget(event.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // A player never holds a panel or a pending kick — but a DROPPED SNAPSHOT is
  // not a de-elevation. Every socket close nulls the snapshot while the app
  // stays mounted behind the Reconnecting banner (K0's `52d83e50`), and `isDM`
  // is derived from that snapshot, so a one-second wifi hiccup used to read as
  // "this DM is now a player": the panel closed mid-typing and never came back,
  // taking the name, the dials and the seed with it. Wait for a snapshot that
  // actually says they are not the DM.
  useEffect(() => {
    if (isDM || !snapshot) return;
    setOpen(false);
  }, [isDM, snapshot]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return useMemo(
    () => ({ open, openKick, closeKick, kick, pending, settings, canKick }),
    [open, openKick, closeKick, kick, pending, settings, canKick],
  );
}
