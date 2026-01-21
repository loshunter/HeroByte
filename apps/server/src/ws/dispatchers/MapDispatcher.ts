import type { ClientMessage, Pointer } from "@shared";
import type { DrawingMessageHandler } from "../handlers/DrawingMessageHandler.js";
import type { MapMessageHandler } from "../handlers/MapMessageHandler.js";
import type { PointerHandler } from "../handlers/PointerHandler.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export interface MapDispatcherResult extends RouteHandlerResult {
  pointerPreview?: Pointer;
}

export class MapDispatcher {
  constructor(
    private mapHandler: MapMessageHandler,
    private pointerHandler: PointerHandler,
    private drawingHandler: DrawingMessageHandler,
  ) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
  ): MapDispatcherResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    switch (message.t) {
      // Map Handler
      case "map-background":
        return this.mapHandler.handleMapBackground(state, message.data);

      case "grid-size":
        return this.mapHandler.handleGridSize(state, message.size);

      case "grid-square-size":
        return this.mapHandler.handleGridSquareSize(state, message.size);

      case "set-player-staging-zone":
        return this.mapHandler.handleSetPlayerStagingZone(state, senderUid, message.zone, isDM);

      // Pointer Handler
      case "point": {
        const result = this.pointerHandler.handlePointer(state, senderUid, message.x, message.y);
        return {
          ...result,
          pointerPreview: result.preview,
        };
      }

      // Drawing Handler
      case "draw":
        return this.drawingHandler.handleDraw(state, message.drawing, senderUid);

      case "sync-player-drawings":
        return this.drawingHandler.handleSyncPlayerDrawings(state, senderUid, message.drawings);

      case "undo-drawing":
        return this.drawingHandler.handleUndoDrawing(state, senderUid);

      case "redo-drawing":
        return this.drawingHandler.handleRedoDrawing(state, senderUid);

      case "clear-drawings":
        return this.drawingHandler.handleClearDrawings(state, senderUid, isDM);

      case "select-drawing":
        return this.drawingHandler.handleSelectDrawing(state, message.id, senderUid);

      case "deselect-drawing":
        return this.drawingHandler.handleDeselectDrawing(state, senderUid);

      case "move-drawing":
        return this.drawingHandler.handleMoveDrawing(
          state,
          message.id,
          message.dx,
          message.dy,
          senderUid,
        );

      case "delete-drawing":
        return this.drawingHandler.handleDeleteDrawing(state, message.id);

      case "erase-partial":
        return this.drawingHandler.handleErasePartial(
          state,
          message.deleteId,
          message.segments,
          senderUid,
        );

      default:
        return null;
    }
  }
}
