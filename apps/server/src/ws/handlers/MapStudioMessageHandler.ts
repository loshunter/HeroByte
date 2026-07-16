import {
  MapDocumentRevisionConflictError,
  authoredDoorStatesOf,
  compileScene,
  deriveMapElements,
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
import { dungeonRecipe } from "../../domains/generation/dungeonRecipe.js";
import {
  assertGenerateRequest,
  assertRecipeBudget,
  resolveRecipeContext,
} from "../../domains/generation/recipeContext.js";
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
      case "map-studio-generate": {
        // A recipe runs server-side and lands as ONE place-room command, so
        // undo, retry-dedupe, revision conflicts, and (when the target is the
        // live-bound document) the recompile all ride the existing rails. The
        // message's commandId doubles as the element idPrefix — retries hit
        // the dedupe cache, so generated ids can never collide with themselves.
        try {
          // A replay (the client queue re-sends the in-flight message after a
          // reconnect) must ack from the dedupe cache BEFORE any validation:
          // re-running the resolver would reject a generate that already landed
          // if the document changed since (a layer locked, the grid moved).
          const replay = this.service.cachedResult(roomId, message.documentId, message.commandId);
          if (replay) {
            this.broadcastDocument(roomId, replay.document, replay.commandId);
            break;
          }
          const document = this.service.get(roomId, message.documentId);
          const ctx = resolveRecipeContext(document, message.bounds, message.commandId);
          assertGenerateRequest(message.seed, message.params);
          const output = dungeonRecipe(message.seed, message.bounds, message.params, ctx);
          assertRecipeBudget(output);
          const isLive = this.getRoomState(roomId).liveMapDocumentId === message.documentId;
          const result = this.service.apply(
            roomId,
            {
              type: "place-room",
              commandId: message.commandId,
              documentId: message.documentId,
              baseRevision: document.revision,
              cells: output.cells,
              elements: output.elements,
            },
            this.now(),
          );
          this.broadcastDocument(roomId, result.document, result.commandId);
          if (isLive) {
            // `document` is the pre-apply clone — exactly the "previous" the
            // door-state preservation wants.
            this.recompileLiveScene(roomId, document, result.document);
            return { broadcast: true, save: true };
          }
        } catch (error) {
          // A replay whose dedupe entry has been evicted (the cache is global and
          // bounded) re-runs the recipe, deterministically re-mints the same ids,
          // and trips the duplicate-id guard. Nothing half-applies — the batch
          // validates before it commits — but "Map element already exists:
          // <uuid>:e17" is a lie dressed as an error: the dungeon IS on the map.
          this.sendCommandError(senderUid, message, alreadyApplied(error) ? REPLAY_LANDED : error);
        }
        break;
      }
      case "map-studio-delete": {
        this.service.delete(roomId, message.documentId);
        this.broadcastToDMs(roomId, {
          t: "map-studio-deleted",
          documentId: message.documentId,
        });
        // Deleting the live-bound document must not leave a dangling binding: a
        // later document that reuses the same id (import round-trips ids) would
        // otherwise auto-broadcast to players on the DM's first edit, with no
        // explicit bind.
        const state = this.getRoomState(roomId);
        if (state.liveMapDocumentId === message.documentId) {
          state.liveMapDocumentId = undefined;
          return { broadcast: true, save: true };
        }
        break;
      }
      case "map-studio-import": {
        const document = this.service.import(roomId, message.document, this.now());
        this.broadcastDocument(roomId, document);
        break;
      }
      case "map-studio-publish": {
        // Publish compiles, never flattens: the background is cosmetic while
        // the compiled walls/doors/lights become server-enforced live state.
        //
        // KNOWN BOUNDARY: `message.background` is a DM-client-rendered raster
        // (a PNG asset URL or SVG data URL) stored verbatim — the server has no
        // rasterizer, so the notes-layer/hidden-element privacy rules for this
        // ONE field are enforced in the DM's client (rasterVisibility.ts,
        // pinned by its own test suite), unlike mapTerrain/mapElements/
        // compiledScene which are derived server-side from the stored document.
        // This is not player-exploitable — only DMs publish, and a DM can set
        // arbitrary background art via the sibling background control anyway —
        // but it means a buggy DM client can leak GM notes into player art.
        const document = this.service.get(roomId, message.documentId);
        const state = this.getRoomState(roomId);
        state.mapBackground = message.background;
        state.mapTerrain = deriveMapTerrain(document, message.backgroundMode);
        // A publish bakes elements into the background (raster or SVG), so the
        // data-element channel must be cleared — otherwise a room that was live-
        // bound would keep rendering its stale mapElements OVER the new raster.
        state.mapElements = undefined;
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
    // Binding is an explicit (re)start of the live scene: compile fresh from
    // authored state (no previous document, so no runtime carry-over).
    this.recompileLiveScene(roomId, undefined, document);
    return { broadcast: true, save: true };
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

/** The duplicate-id abort a re-run generate produces once its dedupe entry ages out. */
const REPLAY_LANDED = new Error(
  "That dungeon already generated — it is already on the map. Undo it if you want a different one.",
);

function alreadyApplied(error: unknown): boolean {
  return error instanceof Error && /^Map element already exists:/.test(error.message);
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
