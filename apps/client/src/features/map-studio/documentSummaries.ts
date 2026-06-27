import type { MapDocument, MapDocumentSummary } from "@herobyte/shared";

export function upsertMapDocumentSummary(
  documents: MapDocumentSummary[],
  document: MapDocument,
): MapDocumentSummary[] {
  const summary: MapDocumentSummary = {
    id: document.id,
    name: document.name,
    width: document.width,
    height: document.height,
    revision: document.revision,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
  return [summary, ...documents.filter((candidate) => candidate.id !== document.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}
