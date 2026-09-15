import {
  MapDocumentRevisionConflictError,
  authoredDoorStatesOf,
  compileScene,
  createMapDocument,
  deriveMapElements,
  importMapDocument,
  preserveDoorRuntimeStates,
  toLiveGridSize,
  type ClientMessage,
  type MapDocument,
  type ServerMessage,
} from "@herobyte/shared";
import { MapDocumentNotFoundError } from "../../domains/mapStudio/service.js";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import { deriveMapTerrain, isMapStudioMessage, toSummary } from "./mapStudioHandlerUtils.js";
import { handleMapStudioGenerate } from "./mapStudioGenerate.js";
import { exportBytes } from "../../domains/room/sessionExport.js";
import type { RoomState } from "../../domains/room/model.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";
import { bindLiveDocument } from "./sceneTravel.js";
import { assertMintCeiling, mintOverflowWith, type MapStudioMintDeps } from "./mapStudioMint.js";
import { publishDocument } from "./mapStudioPublish.js";

type SendMessage = (targetUid: string, message: ServerMessage) => void;
type BroadcastToDMs = (roomId: string, message: ServerMessage) => void;
type GetRoomState = (roomId: string) => RoomState;

export class MapStudioMessageHandler {
  constructor(
    private readonly service: MapStudioService,
    private readonly sendMessage: SendMessage,
    private readonly broadcastToDMs: BroadcastToDMs,
    private readonly getRoomState: GetRoomState,
    private readonly now: () => number = Date.now,
  ) {}

  handle(
    message: ClientMessage,
    senderUid: string,
    roomId: string,
    isDM: boolean,
  ): RouteHandlerResult | null {
    if (!isMapStudioMessage(message)) {
      return null;
    }
    if (!isDM) {
      throw new Error("Map Studio actions require DM permission");
    }

    switch (message.t) {
      case "map-studio-list": {
        const documents = this.service.list(roomId);
        // The DM's readout: what the campaign's export weighs right now. A
        // weigh that throws costs the readout (the field is optional and the
        // client renders nothing), never the map list — this message carries
        // no commandId, so a throw here would reach no screen at all.
        let weight: number | undefined;
        try {
          weight = exportBytes(this.getRoomState(roomId), documents, senderUid);
        } catch (error) {
          console.error("map-studio-list: the campaign weigh failed", error);
        }
        this.sendMessage(senderUid, {
          t: "map-studio-documents",
          documents: documents.map(toSummary),
          ...(weight === undefined ? {} : { exportBytes: weight }),
        });
        break;
      }
      case "map-studio-create": {
        const input = { ...message.document, timestamp: this.now() };
        let document: MapDocument;
        try {
          assertMintCeiling(this.mintDeps, roomId, senderUid, () => createMapDocument(input));
          document = this.service.create(roomId, input);
        } catch (error) {
          this.refuseMint(senderUid, input.id, error);
          break;
        }
        // Outside the refusal's reach: a broadcast failure is not a refusal.
        this.broadcastDocument(roomId, document);
        break;
      }
      case "map-studio-get":
        // A missing document is an expected state, not a protocol fault: the
        // maps store can reset (ephemeral disk) while the room snapshot keeps
        // its live binding. Reply with a typed error so the client can drop
        // the dangling binding and offer a fresh start — throwing here would
        // only nack the wire envelope, which the client retries and then
        // drops silently (the stuck-STARTING bug).
        try {
          this.sendMessage(senderUid, {
            t: "map-studio-document",
            document: this.service.get(roomId, message.documentId),
            history: this.service.historyStatus(roomId, message.documentId),
          });
        } catch (error) {
          if (!(error instanceof MapDocumentNotFoundError)) throw error;
          this.sendMessage(senderUid, {
            t: "map-studio-error",
            commandId: `get:${message.documentId}`,
            documentId: message.documentId,
            code: "not-found",
            reason: error.message,
          });
        }
        break;
      case "map-studio-command": {
        try {
          const isLive = this.getRoomState(roomId).liveMapDocumentId === message.command.documentId;
          // Snapshot the document's authored door states BEFORE the edit so the
          // recompile can tell a re-authored door from a runtime-toggled one.
          const previous = isLive
            ? this.service.get(roomId, message.command.documentId)
            : undefined;
          const result = this.service.apply(roomId, message.command, this.now());
          this.broadcastDocument(roomId, result.document, result.commandId);
          // When the edited document is the room's live-bound one, recompile it
          // straight onto the table and broadcast the room snapshot — the same
          // full broadcast the publish case gets, no publish message required.
          if (isLive) {
            this.recompileLiveScene(roomId, previous, result.document);
            return { broadcast: true, save: true };
          }
        } catch (error) {
          this.sendCommandError(senderUid, message.command, error);
        }
        break;
      }
      case "map-studio-set-live":
        return this.setLiveDocument(senderUid, roomId, message.documentId);
      case "map-studio-generate":
        // Extracted for the 350-LOC cap: the recipe, the byte ceiling and the
        // recompile live in mapStudioGenerate.ts.
        return handleMapStudioGenerate(
          {
            service: this.service,
            getRoomState: this.getRoomState,
            now: this.now,
            broadcastDocument: (room, document, appliedCommandId) =>
              this.broadcastDocument(room, document, appliedCommandId),
            recompileLiveScene: (room, previous, document) =>
              this.recompileLiveScene(room, previous, document),
            sendCommandError: (uid, command, error) => this.sendCommandError(uid, command, error),
            weighMint: (room, uid, candidate) =>
              mintOverflowWith(this.mintDeps, room, uid, candidate),
          },
          senderUid,
          roomId,
          message,
        );
      case "map-studio-delete": {
        this.service.delete(roomId, message.documentId);
        this.broadcastToDMs(roomId, {
          t: "map-studio-deleted",
          documentId: message.documentId,
        });
        // Deleting a document must not leave DANGLING atlas state, for the
        // same id-reuse reason the binding is cleared below (import
        // round-trips ids): a suspended scene keyed to the dead id would
        // silently re-attach to whatever document reuses it, and a "mapped"
        // node would open onto a 12s timeout. The node survives — its name
        // and place in the tree are real work — degraded back to a promise,
        // exactly as the session loader already does for a missing document.
        const state = this.getRoomState(roomId);
        let atlasMutated = false;
        if (state.sceneStates[message.documentId]) {
          delete state.sceneStates[message.documentId];
          atlasMutated = true;
        }
        const degraded = new Set<string>();
        for (const node of state.atlasNodes) {
          if (node.mapDocumentId === message.documentId) {
            node.mapDocumentId = undefined;
            node.updatedAt = this.now();
            degraded.add(node.id);
            atlasMutated = true;
          }
        }
        // A link's anchor is DOCUMENT px on its from-node's map: with that map
        // gone the sprite has nowhere to be, and it would resurface at a
        // meaningless spot on whatever map the node is given next. Links TO
        // the node stay — the node itself survives as a promise.
        const linksBefore = state.atlasLinks.length;
        state.atlasLinks = state.atlasLinks.filter((link) => !degraded.has(link.fromNodeId));
        if (state.atlasLinks.length !== linksBefore) atlasMutated = true;
        // Deleting the live-bound document must not leave a dangling binding
        // either: same hazard, older rule.
        if (state.liveMapDocumentId === message.documentId) {
          state.liveMapDocumentId = undefined;
          return { broadcast: true, save: true };
        }
        if (atlasMutated) {
          return { broadcast: true, save: true };
        }
        break;
      }
      case "map-studio-import": {
        // Import MINTS (it rejects duplicate ids, so every success adds one) —
        // the third create path the arc's review found outside the ceiling.
        const timestamp = this.now();
        let document: MapDocument;
        try {
          assertMintCeiling(this.mintDeps, roomId, senderUid, () =>
            importMapDocument(message.document, timestamp),
          );
          document = this.service.import(roomId, message.document, timestamp);
        } catch (error) {
          this.refuseMint(senderUid, message.document.id, error);
          break;
        }
        this.broadcastDocument(roomId, document);
        break;
      }
      case "map-studio-publish": {
        // A publish is a travel with a raster on top — the physics, the
        // capture and the binding all live in mapStudioPublish.ts, which rides
        // sceneTravel's one composition (the 350-LOC cap put it there).
        return publishDocument(
          { mapStudioService: this.service, now: this.now },
          this.getRoomState(roomId),
          roomId,
          message,
        );
      }
    }

    return { broadcast: false, save: false };
  }

  private setLiveDocument(
    senderUid: string,
    roomId: string,
    documentId: string | null,
  ): RouteHandlerResult {
    // Extracted for the 350-LOC cap; the suspend/resume physics live in
    // sceneTravel.ts, SHARED with atlas-travel (plan §4.8).
    return bindLiveDocument(
      { mapStudioService: this.service, now: this.now },
      this.getRoomState(roomId),
      senderUid,
      roomId,
      documentId,
      (uid, message) => this.sendMessage(uid, message),
    );
  }

  /**
   * Recompile the live-bound document onto the room's play surface: rebuild the
   * compiled scene (carrying door runtime states across the edit when the
   * document is unchanged for that door), re-derive the elements-only terrain,
   * and sync the live grid to the document's lattice. Deliberately never
   * touches mapBackground — a bound room keeps any raster it already published
   * (see the plan's binding decision). `previous` is the pre-edit document, or
   * undefined on a fresh bind (compile straight from authored state).
   */
  private recompileLiveScene(
    roomId: string,
    previous: MapDocument | undefined,
    document: MapDocument,
  ): void {
    const state = this.getRoomState(roomId);
    const compiled = compileScene(document, this.now());
    state.compiledScene = previous
      ? preserveDoorRuntimeStates(state.compiledScene, compiled, authoredDoorStatesOf(previous))
      : compiled;
    state.mapTerrain = deriveMapTerrain(document, "elements-only");
    // Player-safe scenery (tiles/stamps/shapes/visible text) as data — privacy
    // rules applied in deriveMapElements, so it ships to every recipient.
    state.mapElements = deriveMapElements(document);
    state.gridSize = toLiveGridSize(document.grid.size);
    state.gridSquareSize = document.grid.squareSize;
  }

  /**
   * A refused create or import REACHES the DM. Neither message carries a
   * commandId, so the router's nack never fires — a thrown error here was a
   * silent NEW MAP button: the panel spun until its watchdog blamed the
   * server. The client matches this frame by the document id it asked for
   * (an empty commandId says "not a queued command").
   */
  private refuseMint(senderUid: string, documentId: string, error: unknown): void {
    this.sendCommandError(senderUid, { commandId: "", documentId }, error);
  }

  /** What the studio's mints answer to (mapStudioMint.ts). */
  private get mintDeps(): MapStudioMintDeps {
    return { service: this.service, getRoomState: this.getRoomState, now: this.now };
  }

  private broadcastDocument(
    roomId: string,
    document: MapDocument,
    appliedCommandId?: string,
  ): void {
    this.broadcastToDMs(roomId, {
      t: "map-studio-document",
      document,
      appliedCommandId,
      history: this.service.historyStatus(roomId, document.id),
    });
  }

  private sendCommandError(
    senderUid: string,
    command: { commandId: string; documentId: string },
    error: unknown,
  ): void {
    const conflict = error instanceof MapDocumentRevisionConflictError;
    this.sendMessage(senderUid, {
      t: "map-studio-error",
      commandId: command.commandId,
      documentId: command.documentId,
      code: conflict ? "revision-conflict" : "command-rejected",
      reason: error instanceof Error ? error.message : "Map command was rejected",
      actualRevision: conflict ? error.actualRevision : undefined,
    });
  }
}
