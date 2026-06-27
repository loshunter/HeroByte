import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MapDocument } from "@herobyte/shared";
import { cloneMapDocument, type MapDocumentStore } from "./store.js";

const FILE_SCHEMA_VERSION = 1;

interface PersistedMapDocuments {
  schemaVersion: typeof FILE_SCHEMA_VERSION;
  rooms: Record<string, MapDocument[]>;
}

export interface FileMapDocumentStoreOptions {
  filePath?: string;
  onError?: (message: string, error: unknown) => void;
}

export class FileMapDocumentStore implements MapDocumentStore {
  private readonly rooms = new Map<string, Map<string, MapDocument>>();
  private readonly filePath: string;
  private readonly onError: (message: string, error: unknown) => void;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: FileMapDocumentStoreOptions = {}) {
    this.filePath =
      options.filePath ?? process.env.HEROBYTE_MAP_STORE_FILE ?? "./herobyte-maps.json";
    this.onError = options.onError ?? ((message, error) => console.error(message, error));
    this.load();
  }

  get(roomId: string, documentId: string): MapDocument | undefined {
    const document = this.rooms.get(roomId)?.get(documentId);
    return document ? cloneMapDocument(document) : undefined;
  }

  set(roomId: string, document: MapDocument): void {
    const documents = this.rooms.get(roomId) ?? new Map<string, MapDocument>();
    documents.set(document.id, cloneMapDocument(document));
    this.rooms.set(roomId, documents);
    this.persist();
  }

  delete(roomId: string, documentId: string): boolean {
    const documents = this.rooms.get(roomId);
    if (!documents || !documents.delete(documentId)) {
      return false;
    }
    if (documents.size === 0) {
      this.rooms.delete(roomId);
    }
    this.persist();
    return true;
  }

  deleteRoom(roomId: string): void {
    if (this.rooms.delete(roomId)) {
      this.persist();
    }
  }

  list(roomId: string): MapDocument[] {
    return Array.from(this.rooms.get(roomId)?.values() ?? [], cloneMapDocument);
  }

  flush(): Promise<void> {
    return this.writeQueue;
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    try {
      const parsed = JSON.parse(
        readFileSync(this.filePath, "utf8"),
      ) as Partial<PersistedMapDocuments>;
      if (parsed.schemaVersion !== FILE_SCHEMA_VERSION || !isRecord(parsed.rooms)) {
        throw new Error("Unsupported or invalid Map Studio store schema");
      }
      Object.entries(parsed.rooms).forEach(([roomId, documents]) => {
        if (!Array.isArray(documents)) {
          return;
        }
        const room = new Map<string, MapDocument>();
        documents.forEach((document) => {
          if (isMapDocument(document)) {
            room.set(document.id, cloneMapDocument(document));
          }
        });
        if (room.size > 0) {
          this.rooms.set(roomId, room);
        }
      });
    } catch (error) {
      this.onError("[MapStudio] Failed to load map documents", error);
    }
  }

  private persist(): void {
    const serialized = JSON.stringify(this.serialize(), null, 2);
    const temporaryPath = `${this.filePath}.tmp`;
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(temporaryPath, serialized, "utf8");
        await rename(temporaryPath, this.filePath);
      })
      .catch((error) => this.onError("[MapStudio] Failed to persist map documents", error));
  }

  private serialize(): PersistedMapDocuments {
    const rooms: Record<string, MapDocument[]> = {};
    this.rooms.forEach((documents, roomId) => {
      rooms[roomId] = Array.from(documents.values(), cloneMapDocument);
    });
    return { schemaVersion: FILE_SCHEMA_VERSION, rooms };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMapDocument(value: unknown): value is MapDocument {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    isRecord(value.grid) &&
    Array.isArray(value.layers) &&
    Array.isArray(value.elements) &&
    typeof value.revision === "number" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number"
  );
}
