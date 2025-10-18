# Asset Library & Scene Grouping Research

## Goals

- Provide a reusable library for maps, tokens, props, status effects, and DM-linked external assets.
- Support pinning/grouping of scene objects for coordinated transforms.
- Persist library state locally (initially) with future support for shared syncing.
- Maintain SOLID separation: catalog management, storage adapters, rendering integration, and sync logic remain distinct.
- Implement features via TDD: define contracts and failing tests prior to implementation.

## Inspiration & Industry Practices

- **Foundry VTT**: Compendium packs for actors/items/tiles; separate “Tile Assets” sidebar; grouping via “Tile Controls”.
- **Roll20**: Art library with personal, marketplace, recent uploads; “Multi-select” + “Group” commands.
- **DungeonDraft / Wonderdraft**: Asset bins with tagging, search, and variant previews; drag-and-drop onto canvas.
- **Design tools (Figma, Photoshop)**: Asset panels with quick filter, favorites, and symbol/group linking.

## Architecture Overview

| Responsibility | Module | Notes |
|----------------|--------|-------|
| Asset metadata model & catalog operations | `AssetCatalogService` | SRP: CRUD, search/filter, tags; no knowledge of storage or rendering. |
| Storage adapter (local) | `LocalAssetStore` | Handles persistence to `indexedDB` (preferred) or fallback to `localStorage`; hides serialization details. |
| External asset ingestion | `LinkedAssetAdapter` | Wraps external URLs (CDN, Drive, etc.); validates MIME/type; optionally downloads thumbnails. |
| Scene pinning/grouping | `GroupingService` | Maintains group relationships, transforms, hierarchy metadata; decoupled from rendering engine. |
| Sync/export logic | `AssetSyncService` | Serializes catalog to JSON bundles; manages import/export and DM->player sync toggles. |

## Data Contracts

### Asset Entry

```ts
interface AssetEntry {
  id: string;
  type: "map" | "token" | "prop" | "status-effect" | "audio" | "other";
  name: string;
  description?: string;
  tags: string[];
  source: {
    kind: "upload" | "external-url" | "generated";
    uri: string;              // Blob URI, data URL, or remote HTTP(S)
    checksum?: string;        // SHA-256 for deduplication
    sizeBytes?: number;
  };
  preview?: { uri: string; width: number; height: number };
  createdAt: ISODateString;
  updatedAt: ISODateString;
  owner: "dm" | "player";
  version: number;
}
```

### Grouping Relationship

```ts
interface SceneGroup {
  id: string;
  name?: string;
  memberIds: string[];        // scene object IDs (tokens, props, drawings)
  pivot?: { x: number; y: number };
  locked: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

### Export Bundle

```ts
interface AssetBundle {
  version: number;
  exportedAt: ISODateString;
  assets: AssetEntry[];
  groups?: SceneGroup[];
  notes?: string;
}
```

## Storage Strategy

- **IndexedDB** preferred for binary payloads and metadata; fallback to `localStorage` with size constraints.
- Implement storage adapter with strategy pattern; TDD: start with failing tests for generic adapter interface.
- Provide migration path (version field) so future backend sync or encryption can be added without data loss.
- Avoid cookies for binary data (size & perf); only use cookies for lightweight flags (e.g., last sync timestamp).
- For DM-managed assets, store within room snapshot (Phase 18 alignment) so campaign exports include references.

## Grouping/Pinning Behavior

- Use parent-child transform calculations akin to scene graph nodes.
- Allow dynamic pin/unpin: maintain adjacency list so operations remain SRP (Group service updates, renderer listens).
- Support nested groups cautiously; start with flat groups (no nesting) to reduce complexity.
- When group transforms apply, broadcast aggregated transform to members to keep clients in sync.
- Provide UI affordances: outline around grouped items, handles for group movement, quick “Ungroup” button.

## UX Recommendations

- Library panel with tabs (Maps, Tokens, Props, Status Effects, Favorites).
- Search bar + tag filters; include “Recently Used” section.
- Drag/drop from library onto canvas; on drop, create scene object referencing asset ID.
- Asset details drawer: preview, metadata, buttons (pin, favorite, link to players).
- For external URLs, require HTTPS and provide MIME validation (HEAD request or metadata fetch).
- Allow DM to pin assets to tokens (e.g., attach torch to character) using context menu.
- Provide keybind for “Group” / “Ungroup” (e.g., Ctrl+G / Ctrl+Shift+G).

## Security & Privacy

- Sanitize asset metadata to avoid script injection (escape HTML).
- For external URLs, warn if cross-origin or missing HTTPS; consider proxying through safe loader.
- Limit total storage (quota alerts). Provide “Purge unused assets” tool.
- When syncing assets to players, prompt DM to confirm content size to prevent unintentional large transfers.

## Testing Strategy (TDD)

1. **Unit Tests**
   - `AssetCatalogService`: add/remove/search/tag filtering.
   - `LocalAssetStore`: serialization, upgrade, quota handling.
   - `GroupingService`: add/remove members, apply transforms, concurrency.
2. **Integration Tests**
   - Drag-drop asset from catalog onto scene; verify scene object references asset ID.
   - Pin token + prop; move token; ensure prop follows.
3. **E2E / Manual**
   - Import/export bundle across sessions.
   - DM sync assets to player; player receives limited set.
   - Group of three tokens moves as unit; ungroup returns independent control.

Write failing tests first for each service hook before implementing features.

## Dependencies & Sequencing

- Builds on Phase 17 keyboard movement (group movement may reuse logic).
- Works with Phase 18 snapshot (groups & asset references included).
- For remote sync, likely needs future backend or CDN support; start local-first.

