import {
  applyMapDocumentCommand,
  createMapDocument,
  MapDocumentRevisionConflictError,
  type AppliedMapDocumentCommand,
  type CreateMapDocumentInput,
  type MapDocument,
  type MapHistoryCommand,
  type MapStudioCommand,
} from "@herobyte/shared";
import { InMemoryMapDocumentStore, cloneMapDocument, type MapDocumentStore } from "./store.js";

const COMMAND_CACHE_LIMIT = 500;
const HISTORY_LIMIT = 100;

interface DocumentHistory {
  undo: MapDocument[];
  redo: MapDocument[];
}

export class MapDocumentNotFoundError extends Error {
  constructor(documentId: string) {
    super(`Map document not found: ${documentId}`);
    this.name = "MapDocumentNotFoundError";
  }
}

export class MapDocumentAlreadyExistsError extends Error {
  constructor(documentId: string) {
    super(`Map document already exists: ${documentId}`);
    this.name = "MapDocumentAlreadyExistsError";
  }
}

export class MapStudioService {
  private readonly commandResults = new Map<string, AppliedMapDocumentCommand>();
  private readonly histories = new Map<string, DocumentHistory>();

  constructor(private readonly store: MapDocumentStore = new InMemoryMapDocumentStore()) {}

  create(roomId: string, input: CreateMapDocumentInput): MapDocument {
    requireRoomId(roomId);
    if (this.store.get(roomId, input.id.trim())) {
      throw new MapDocumentAlreadyExistsError(input.id.trim());
    }
    const document = createMapDocument(input);
    this.store.set(roomId, document);
    return cloneMapDocument(document);
  }

  get(roomId: string, documentId: string): MapDocument {
    requireRoomId(roomId);
    const document = this.store.get(roomId, documentId);
    if (!document) {
      throw new MapDocumentNotFoundError(documentId);
    }
    return document;
  }

  list(roomId: string): MapDocument[] {
    requireRoomId(roomId);
    return this.store.list(roomId).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  apply(
    roomId: string,
    command: MapStudioCommand,
    timestamp: number = Date.now(),
  ): AppliedMapDocumentCommand {
    requireRoomId(roomId);
    const cacheKey = `${roomId}:${command.documentId}:${command.commandId.trim()}`;
    const cached = this.commandResults.get(cacheKey);
    if (cached) {
      const latest = this.store.get(roomId, command.documentId);
      return latest
        ? { ...cloneAppliedCommand(cached), revision: latest.revision, document: latest }
        : cloneAppliedCommand(cached);
    }

    const document = this.get(roomId, command.documentId);
    const historyCommand = isHistoryCommand(command);
    const result = historyCommand
      ? this.applyHistory(roomId, document, command, timestamp)
      : applyMapDocumentCommand(document, command, timestamp);
    this.store.set(roomId, result.document);
    if (command.type !== "undo" && command.type !== "redo") {
      const history = this.history(roomId, document.id);
      history.undo.push(cloneMapDocument(document));
      trimHistory(history.undo);
      history.redo = [];
    }
    this.remember(cacheKey, result);
    return cloneAppliedCommand(result);
  }

  delete(roomId: string, documentId: string): void {
    requireRoomId(roomId);
    if (!this.store.delete(roomId, documentId)) {
      throw new MapDocumentNotFoundError(documentId);
    }
    const prefix = `${roomId}:${documentId}:`;
    for (const key of this.commandResults.keys()) {
      if (key.startsWith(prefix)) {
        this.commandResults.delete(key);
      }
    }
    this.histories.delete(historyKey(roomId, documentId));
  }

  resetRoom(roomId: string): void {
    requireRoomId(roomId);
    this.store.deleteRoom(roomId);
    const prefix = `${roomId}:`;
    for (const key of this.commandResults.keys()) {
      if (key.startsWith(prefix)) {
        this.commandResults.delete(key);
      }
    }
    for (const key of this.histories.keys()) {
      if (key.startsWith(prefix)) this.histories.delete(key);
    }
  }

  historyStatus(roomId: string, documentId: string): { canUndo: boolean; canRedo: boolean } {
    const history = this.histories.get(historyKey(roomId, documentId));
    return { canUndo: Boolean(history?.undo.length), canRedo: Boolean(history?.redo.length) };
  }

  flush(): Promise<void> {
    return this.store.flush?.() ?? Promise.resolve();
  }

  private remember(cacheKey: string, result: AppliedMapDocumentCommand): void {
    this.commandResults.set(cacheKey, cloneAppliedCommand(result));
    while (this.commandResults.size > COMMAND_CACHE_LIMIT) {
      const oldest = this.commandResults.keys().next().value as string | undefined;
      if (!oldest) {
        break;
      }
      this.commandResults.delete(oldest);
    }
  }

  private applyHistory(
    roomId: string,
    current: MapDocument,
    command: Extract<MapStudioCommand, { type: "undo" | "redo" }>,
    timestamp: number,
  ): AppliedMapDocumentCommand {
    validateHistoryCommand(current, command);
    if (!Number.isFinite(timestamp)) throw new Error("Map document timestamp must be finite");
    const history = this.history(roomId, current.id);
    const source = command.type === "undo" ? history.undo : history.redo;
    const target = command.type === "undo" ? history.redo : history.undo;
    const snapshot = source.pop();
    if (!snapshot) throw new Error(`Nothing to ${command.type} for map document`);
    target.push(cloneMapDocument(current));
    trimHistory(target);
    const document = {
      ...cloneMapDocument(snapshot),
      revision: current.revision + 1,
      updatedAt: timestamp,
    };
    return {
      commandId: command.commandId.trim(),
      documentId: current.id,
      previousRevision: current.revision,
      revision: document.revision,
      document,
    };
  }

  private history(roomId: string, documentId: string): DocumentHistory {
    const key = historyKey(roomId, documentId);
    let history = this.histories.get(key);
    if (!history) {
      history = { undo: [], redo: [] };
      this.histories.set(key, history);
    }
    return history;
  }
}

function isHistoryCommand(command: MapStudioCommand): command is MapHistoryCommand {
  return command.type === "undo" || command.type === "redo";
}

function validateHistoryCommand(
  document: MapDocument,
  command: Extract<MapStudioCommand, { type: "undo" | "redo" }>,
): void {
  if (!command.commandId.trim()) throw new Error("Map command id is required");
  if (!Number.isInteger(command.baseRevision) || command.baseRevision < 0) {
    throw new Error("Map command base revision must be a non-negative integer");
  }
  if (command.baseRevision !== document.revision) {
    throw new MapDocumentRevisionConflictError(command.baseRevision, document.revision);
  }
}

function historyKey(roomId: string, documentId: string): string {
  return `${roomId}:${documentId}`;
}

function trimHistory(history: MapDocument[]): void {
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
}

function cloneAppliedCommand(result: AppliedMapDocumentCommand): AppliedMapDocumentCommand {
  return { ...result, document: cloneMapDocument(result.document) };
}

function requireRoomId(roomId: string): void {
  if (!roomId.trim()) {
    throw new Error("Room id is required for map documents");
  }
}
