import {
  MapDocumentRevisionConflictError,
  authoredDoorIdsOf,
  compileScene,
  preserveDoorRuntimeStates,
  toLiveGridSize,
  type ClientMessage,
  type MapDocument,
  type MapDocumentSummary,
  type MapPublishBackgroundMode,
  type MapTerrainSnapshot,
  type ServerMessage,
} from "@herobyte/shared";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RoomState } from "../../domains/room/model.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

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
      case "map-studio-list":
        this.sendMessage(senderUid, {
          t: "map-studio-documents",
          documents: this.service.list(roomId).map(toSummary),
        });
        break;
      case "map-studio-create": {
        const document = this.service.create(roomId, {
          ...message.document,
          timestamp: this.now(),
        });
        this.broadcastDocument(roomId, document);
        break;
      }
      case "map-studio-get":
        this.sendMessage(senderUid, {
          t: "map-studio-document",
          document: this.service.get(roomId, message.documentId),
          history: this.service.historyStatus(roomId, message.documentId),
        });
        break;
      case "map-studio-command": {
        try {
          const result = this.service.apply(roomId, message.command, this.now());
          this.broadcastDocument(roomId, result.document, result.commandId);
          // When the edited document is the room's live-bound one, recompile it
          // straight onto the table and broadcast the room snapshot — the same
          // full broadcast the publish case gets, no publish message required.
          if (this.getRoomState(roomId).liveMapDocumentId === message.command.documentId) {
            this.recompileLiveScene(
              roomId,
              result.document,
              authoredDoorIdsOf(message.command, result.document),
            );
            return { broadcast: true, save: true };
          }
        } catch (error) {
          this.sendCommandError(senderUid, message.command, error);
        }
        break;
      }
      case "map-studio-set-live":
        return this.setLiveDocument(senderUid, roomId, message.documentId);
      case "map-studio-delete":
        this.service.delete(roomId, message.documentId);
        this.broadcastToDMs(roomId, {
          t: "map-studio-deleted",
          documentId: message.documentId,
        });
        break;
      case "map-studio-import": {
        const document = this.service.import(roomId, message.document, this.now());
        this.broadcastDocument(roomId, document);
        break;
      }
      case "map-studio-publish": {
        // Publish compiles, never flattens: the background is cosmetic while
        // the compiled walls/doors/lights become server-enforced live state.
        const document = this.service.get(roomId, message.documentId);
        const state = this.getRoomState(roomId);
        state.mapBackground = message.background;
        state.mapTerrain = deriveMapTerrain(document, message.backgroundMode);
        state.gridSize = toLiveGridSize(document.grid.size);
        state.gridSquareSize = document.grid.squareSize;
        state.compiledScene = compileScene(document, this.now());
        return { broadcast: true, save: true };
      }
    }

    return { broadcast: false, save: false };
  }

  private setLiveDocument(
    senderUid: string,
    roomId: string,
    documentId: string | null,
  ): RouteHandlerResult {
    const state = this.getRoomState(roomId);
    if (documentId === null) {
      // Unbind: the table keeps its last compiled scene, but future edits stop
      // auto-compiling. Clearing a raster background is a separate DM action.
      state.liveMapDocumentId = undefined;
      return { broadcast: true, save: true };
    }
    let document: MapDocument;
    try {
      document = this.service.get(roomId, documentId);
    } catch (error) {
      this.sendMessage(senderUid, {
        t: "map-studio-error",
        commandId: `set-live:${documentId}`,
        documentId,
        code: "command-rejected",
        reason: error instanceof Error ? error.message : "Map document not found",
      });
      return { broadcast: false, save: false };
    }
    state.liveMapDocumentId = documentId;
    // A fresh bind authors no doors, so every compiled door keeps whatever
    // runtime state the prior scene held (none, for a fresh document).
    this.recompileLiveScene(roomId, document, new Set());
    return { broadcast: true, save: true };
  }

  /**
   * Recompile the live-bound document onto the room's play surface: rebuild the
   * compiled scene (carrying door runtime states across the edit), re-derive
   * the elements-only terrain, and sync the live grid to the document's
   * lattice. Deliberately never touches mapBackground — a bound room keeps any
   * raster it already published (see the plan's binding decision).
   */
  private recompileLiveScene(
    roomId: string,
    document: MapDocument,
    authoredDoorIds: ReadonlySet<string>,
  ): void {
    const state = this.getRoomState(roomId);
    const compiled = compileScene(document, this.now());
    state.compiledScene = preserveDoorRuntimeStates(state.compiledScene, compiled, authoredDoorIds);
    state.mapTerrain = deriveMapTerrain(document, "elements-only");
    state.gridSize = toLiveGridSize(document.grid.size);
    state.gridSquareSize = document.grid.squareSize;
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
    command: Extract<ClientMessage, { t: "map-studio-command" }>["command"],
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

/**
 * Terrain rides the snapshot as data only when the client shipped an
 * elements-only background — attaching it under a legacy full-render
 * background would draw the terrain twice at the table. Always derived from
 * the SERVER's stored document (never from a client payload), point-in-time
 * cloned so later document edits can't mutate the published scene through a
 * shared reference. Mirrors the export's visibility rule: a hidden
 * terrain-kind layer publishes no terrain. The grid rides along because the
 * background SVG and the terrain share the DOCUMENT's lattice, independent
 * of the table's live grid setting.
 */
function deriveMapTerrain(
  document: MapDocument,
  backgroundMode: MapPublishBackgroundMode | undefined,
): MapTerrainSnapshot | undefined {
  if (backgroundMode !== "elements-only") return undefined;
  const terrain = document.terrain;
  if (!terrain || Object.keys(terrain.chunks).length === 0) return undefined;
  const terrainLayer = document.layers.find((layer) => layer.kind === "terrain");
  if (terrainLayer && (!terrainLayer.visible || terrainLayer.opacity <= 0)) return undefined;
  return {
    terrain: structuredClone(terrain),
    grid: {
      size: document.grid.size,
      offsetX: document.grid.offsetX,
      offsetY: document.grid.offsetY,
    },
    // Matches renderTerrain's baked opacity so full and elements-only
    // publishes render identically.
    opacity: terrainLayer?.opacity ?? 1,
  };
}

function isMapStudioMessage(
  message: ClientMessage,
): message is Extract<ClientMessage, { t: `map-studio-${string}` }> {
  return message.t.startsWith("map-studio-");
}

function toSummary(document: MapDocument): MapDocumentSummary {
  const { id, name, width, height, revision, createdAt, updatedAt } = document;
  return { id, name, width, height, revision, createdAt, updatedAt };
}
