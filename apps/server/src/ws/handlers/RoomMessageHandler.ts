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
import { getDefaultRoomId, getRoomSecret } from "../../config/auth.js";

/**
 * Inline the asset channel back into plain fields for a session FILE.
 *
 * toSnapshot diverts `mapBackground` and `drawings` into `assets`/`assetRefs`
 * (SnapshotAssetBuilder) — an indirection that earns its keep on a repeated
 * broadcast, where the payload is content-addressed and deduped. A file is
 * written once and read once, so the indirection buys nothing and costs
 * everything: the id-keyed asset list is a second thing to keep consistent, and
 * BOTH loaders were written for the client's hydrated (flat) snapshot.
 *
 * Shipping the raw wire shape into a file broke it three ways at once — the
 * client parser demanded a `drawings` key toSnapshot never emits, it dropped a
 * `mapBackground` that lived in assetRefs, and the server's own load validator
 * rejected any room with zero drawings (no key AND no assetRef). Flattening here
 * fixes all three at the source rather than teaching two parsers a shape they
 * should never have had to know.
 *
 * `drawings` is always an array — that is the invariant both loaders rely on.
 */
function flattenForFile(snapshot: RoomSnapshot, state: RoomState): RoomSnapshot {
  const { assets: _assets, assetRefs: _assetRefs, ...rest } = snapshot;
  return {
    ...rest,
    drawings: state.drawings,
    // Public chat only. The snapshot handed to this function was built with
    // toSnapshot(state, true, senderUid) — a REAL recipient uid — so the
    // exporting DM's own whispers passed visibleChatFor and would otherwise
    // be written into a file whose entire purpose is to be handed to other
    // people. A table fork avoids this by using createSnapshot() (no uid);
    // export cannot, because it must round-trip the DM's secrets. So the one
    // secret that is not the DM's to share gets stripped here.
    chatLog: (rest.chatLog ?? []).filter((message) => !message.to),
    // Public rolls only, for exactly the reason above: the real recipient uid
    // let the exporting DM's own `self` rolls, and every `dm` roll the table
    // sent them, through visibleRollsFor. Neither belongs in a file handed to
    // other people.
    diceRolls: (rest.diceRolls ?? []).filter(
      (roll) => roll.visibility === undefined || roll.visibility === "public",
    ),
    ...(state.mapBackground === undefined ? {} : { mapBackground: state.mapBackground }),
  };
}

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
        snapshot: flattenForFile(toSnapshot(state, true, senderUid), state),
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

    // The test table's password is FIXED. It is the one table whose credentials
    // every server publishes, so letting anyone change it means a single visitor
    // can padlock the public demo and the host loses their own test bed with no
    // way back in. Keeping a real game here was never the right shape anyway —
    // the table is wiped hourly — so this points at the operation that is.
    const senderRoomId = this.getRoomIdForUid?.(senderUid);
    if ((senderRoomId ?? getDefaultRoomId()) === getDefaultRoomId()) {
      this.sendControlMessage(senderUid, {
        t: "room-password-update-failed",
        reason:
          "The test table's password is fixed so it stays open for everyone. Save it as a private table instead — you keep everything on it.",
      });
      return { broadcast: false, save: false };
    }

    // An omitted secret is a reset request: fall back to the server's own
    // configured default. (The client used to send a hard-coded "Fun1", which
    // failed the length check on any server with a custom HEROBYTE_ROOM_SECRET.)
    const defaultSecret = getRoomSecret();
    const nextSecret = secret?.trim() ?? defaultSecret;
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
      // Only ever a custom room by this point — the default table returned above.
      const summary = this.authService.update(nextSecret, senderRoomId);
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
      return { broadcast: false, save: false };
    }

    return { broadcast: false, save: false };
  }
}
