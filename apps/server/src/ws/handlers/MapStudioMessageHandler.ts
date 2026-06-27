import {
  MapDocumentRevisionConflictError,
  type ClientMessage,
  type MapDocument,
  type MapDocumentSummary,
  type ServerMessage,
} from "@herobyte/shared";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

type SendMessage = (targetUid: string, message: ServerMessage) => void;
type BroadcastToDMs = (roomId: string, message: ServerMessage) => void;

export class MapStudioMessageHandler {
  constructor(
    private readonly service: MapStudioService,
    private readonly sendMessage: SendMessage,
    private readonly broadcastToDMs: BroadcastToDMs,
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
        } catch (error) {
          this.sendCommandError(senderUid, message.command, error);
        }
        break;
      }
      case "map-studio-delete":
        this.service.delete(roomId, message.documentId);
        this.broadcastToDMs(roomId, {
          t: "map-studio-deleted",
          documentId: message.documentId,
        });
        break;
    }

    return { broadcast: false, save: false };
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

function isMapStudioMessage(
  message: ClientMessage,
): message is Extract<ClientMessage, { t: `map-studio-${string}` }> {
  return message.t.startsWith("map-studio-");
}

function toSummary(document: MapDocument): MapDocumentSummary {
  const { id, name, width, height, revision, createdAt, updatedAt } = document;
  return { id, name, width, height, revision, createdAt, updatedAt };
}
