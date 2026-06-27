import type { MapDocument } from "@herobyte/shared";

export interface MapDocumentStore {
  get(roomId: string, documentId: string): MapDocument | undefined;
  set(roomId: string, document: MapDocument): void;
  delete(roomId: string, documentId: string): boolean;
  deleteRoom(roomId: string): void;
  list(roomId: string): MapDocument[];
  flush?(): Promise<void>;
}

export class InMemoryMapDocumentStore implements MapDocumentStore {
  private readonly rooms = new Map<string, Map<string, MapDocument>>();

  get(roomId: string, documentId: string): MapDocument | undefined {
    const document = this.rooms.get(roomId)?.get(documentId);
    return document ? cloneMapDocument(document) : undefined;
  }

  set(roomId: string, document: MapDocument): void {
    const documents = this.rooms.get(roomId) ?? new Map<string, MapDocument>();
    documents.set(document.id, cloneMapDocument(document));
    this.rooms.set(roomId, documents);
  }

  delete(roomId: string, documentId: string): boolean {
    const documents = this.rooms.get(roomId);
    if (!documents) {
      return false;
    }
    const deleted = documents.delete(documentId);
    if (documents.size === 0) {
      this.rooms.delete(roomId);
    }
    return deleted;
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  list(roomId: string): MapDocument[] {
    return Array.from(this.rooms.get(roomId)?.values() ?? [], cloneMapDocument);
  }
}

export function cloneMapDocument(document: MapDocument): MapDocument {
  return {
    ...document,
    grid: { ...document.grid },
    layers: document.layers.map((layer) => ({ ...layer })),
    elements: document.elements.map((element) => cloneMapElement(element)),
  };
}

function cloneMapElement(element: MapDocument["elements"][number]): typeof element {
  const data =
    element.type === "shape" || element.type === "wall"
      ? { ...element.data, points: element.data.points.map((point) => ({ ...point })) }
      : { ...element.data };
  return {
    ...element,
    transform: { ...element.transform },
    data,
  } as typeof element;
}
