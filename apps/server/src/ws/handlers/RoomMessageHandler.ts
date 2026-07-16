/**
 * RoomMessageHandler
 *
 * Handles room management messages from clients.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - load-session (lines 812-822)
 * - set-room-password (lines 751-792)
 *
 * Note: clear-all-tokens is handled by TokenMessageHandler
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/RoomMessageHandler
 */

import type { RoomState } from "../../domains/room/model.js";
import type { RoomService } from "../../domains/room/service.js";
import type { AuthService } from "../../domains/auth/service.js";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { MapDocument, RoomSnapshot, ServerMessage } from "@herobyte/shared";
import { toSnapshot } from "../../domains/room/model.js";
import { getRoomSecret } from "../../config/auth.js";

/**
 * Result of handling a room message
 */
export interface RoomMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Callback to send a control message to a specific client
 */
export type SendControlMessage = (targetUid: string, message: ServerMessage) => void;

/**
 * Handler for room management messages
 */
export class RoomMessageHandler {
  private roomService: RoomService;
  private authService: AuthService;
  private sendControlMessage: SendControlMessage;
  private getRoomIdForUid?: (uid: string) => string;
  private mapStudioService?: MapStudioService;

  constructor(
    roomService: RoomService,
    authService: AuthService,
    sendControlMessage: SendControlMessage,
    getRoomIdForUid?: (uid: string) => string,
    mapStudioService?: MapStudioService,
  ) {
    this.roomService = roomService;
    this.authService = authService;
    this.sendControlMessage = sendControlMessage;
    this.getRoomIdForUid = getRoomIdForUid;
    this.mapStudioService = mapStudioService;
  }

  /**
   * Handle load-session message
   *
   * Loads a session snapshot.
   * Only DMs can load sessions.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param snapshot - Session snapshot data
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleLoadSession(
    state: RoomState,
    senderUid: string,
    snapshot: RoomSnapshot,
    isDM: boolean,
    mapDocuments?: MapDocument[],
    liveMapDocumentId?: string,
  ): RoomMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to load session`);
      return { broadcast: false, save: false };
    }

    // Documents FIRST: the snapshot's liveMapDocumentId is only safe to restore
    // once the document it names is actually present.
    const roomId = this.getRoomIdForUid?.(senderUid);
    const restored = this.restoreMapDocuments(roomId, mapDocuments);

    this.roomService.loadSnapshot({
      ...snapshot,
      liveMapDocumentId: liveMapDocumentId ?? snapshot.liveMapDocumentId,
    });

    // A binding to a document we do not have is NOT inert: the DM's client
    // auto-opens the bound doc, map-studio-get throws MapDocumentNotFoundError,
    // and (that case having no try/catch) nothing replies — the DM watches a
    // spinner for 12s and gets "server didn't respond". A legacy save file has
    // no documents at all, so this is the normal path for one, not an edge case.
    const bound = state.liveMapDocumentId;
    if (bound && !this.hasDocument(roomId, bound)) {
      state.liveMapDocumentId = undefined;
      console.warn(
        `load-session: cleared live binding ${bound} — the session file carried no such map document`,
      );
    }

    console.log(
      `Loaded session for room ${roomId ?? "(default)"}: restored ${restored} map document(s)`,
    );
    return { broadcast: true, save: true };
  }

  /**
   * Handle session-export: bundle a COMPLETE, restorable session file.
   *
   * The server does the bundling because it is the only side holding both the
   * room state and the authored MapDocuments — the client's snapshot has the
   * map only as derived output plus a pointer, and its single-slot server-event
   * channel makes gathering documents over the wire fragile.
   *
   * DM-only, and deliberately so: this is built from the DM's own view, so it
   * contains secret doors, hidden NPCs and GM notes verbatim.
   */
  handleSessionExport(state: RoomState, senderUid: string, isDM: boolean): RoomMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to export a session`);
      return { broadcast: false, save: false };
    }
    const roomId = this.getRoomIdForUid?.(senderUid);
    const mapDocuments = roomId && this.mapStudioService ? this.mapStudioService.list(roomId) : [];

    this.sendControlMessage(senderUid, {
      t: "session-file",
      file: {
        schemaVersion: 1,
        savedAt: Date.now(),
        // The DM's view on purpose — a session file must round-trip the secrets
        // a player snapshot strips, or reloading one would quietly disarm the map.
        snapshot: toSnapshot(state, true, senderUid),
        mapDocuments,
        liveMapDocumentId: state.liveMapDocumentId,
      },
    });
    return { broadcast: false, save: false };
  }

  /** Upsert each document, skipping (not failing) any single bad one. */
  private restoreMapDocuments(roomId: string | undefined, documents?: MapDocument[]): number {
    if (!roomId || !this.mapStudioService || !documents?.length) return 0;
    let restored = 0;
    for (const document of documents) {
      try {
        this.mapStudioService.restore(roomId, document);
        restored++;
      } catch (error) {
        // One unreadable document must not abort the whole restore — the rest of
        // the table is still worth recovering, and the binding check below turns
        // a missing map into a cleared binding rather than a broken one.
        console.warn(`load-session: skipped map document ${document?.id}: ${String(error)}`);
      }
    }
    return restored;
  }

  private hasDocument(roomId: string | undefined, documentId: string): boolean {
    if (!roomId || !this.mapStudioService) return false;
    try {
      this.mapStudioService.get(roomId, documentId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle set-room-password message
   *
   * Updates the room password.
   * Only DMs can update the room password.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param secret - New password (will be trimmed)
   * @returns Result indicating if broadcast/save is needed (always false for password updates)
   */
  handleSetRoomPassword(
    state: RoomState,
    senderUid: string,
    secret: string | undefined,
  ): RoomMessageResult {
    const sender = state.players.find((p) => p.uid === senderUid);
    const isDM = sender?.isDM ?? false;

    if (!isDM) {
      this.sendControlMessage(senderUid, {
        t: "room-password-update-failed",
        reason: "Only Dungeon Masters can update the room password.",
      });
      return { broadcast: false, save: false };
    }

    const nextSecret = secret?.trim() ?? "";
    const defaultSecret = getRoomSecret();
    const isDefaultPassword = nextSecret === defaultSecret;

    // Allow default password to bypass length validation
    if (!isDefaultPassword && (nextSecret.length < 6 || nextSecret.length > 128)) {
      this.sendControlMessage(senderUid, {
        t: "room-password-update-failed",
        reason: "Password must be between 6 and 128 characters.",
      });
      return { broadcast: false, save: false };
    }

    try {
      // Scope the change to the sender's room; the default room updates the
      // server-wide password exactly as before.
      const summary = this.authService.update(nextSecret, this.getRoomIdForUid?.(senderUid));
      this.sendControlMessage(senderUid, {
        t: "room-password-updated",
        updatedAt: summary.updatedAt,
        source: summary.source,
      });
      console.log(`DM ${senderUid} updated the room password.`);
    } catch (error) {
      console.error("Failed to update room password:", error);
      this.sendControlMessage(senderUid, {
        t: "room-password-update-failed",
        reason: "Unable to update password. Check server logs.",
      });
    }

    return { broadcast: false, save: false };
  }
}
