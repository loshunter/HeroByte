import type {
  DragPreviewEvent,
  RoomSnapshot,
  ServerMessage,
  SnapshotAssetType,
  Token,
  Pointer,
} from "@shared";

type DeltaMessage = Extract<ServerMessage, { t: "token-updated" }>;

export type SnapshotResyncReason = "no-base-snapshot" | "version-gap";

interface SnapshotReconcilerConfig {
  onSnapshot: (snapshot: RoomSnapshot) => void;
  requestResync: (details: {
    lastSeenVersion: number;
    receivedVersion?: number;
    reason: SnapshotResyncReason;
  }) => void;
}

/**
 * SnapshotReconciler maintains the last applied snapshot and incrementally
 * applies delta messages. When a gap is detected it requests a targeted
 * resync from the server so clients recover automatically.
 */
export class SnapshotReconciler {
  private readonly onSnapshot: (snapshot: RoomSnapshot) => void;
  private readonly requestResync: SnapshotReconcilerConfig["requestResync"];
  private currentSnapshot: RoomSnapshot | null = null;
  private lastVersion: number = 0;
  private pendingResync = false;
  private assetCache = new Map<string, unknown>();

  constructor(config: SnapshotReconcilerConfig) {
    this.onSnapshot = config.onSnapshot;
    this.requestResync = config.requestResync;
  }

  /**
   * Reset internal state (used when disconnecting/reconnecting).
   */
  reset(): void {
    this.currentSnapshot = null;
    this.lastVersion = 0;
    this.pendingResync = false;
    this.assetCache.clear();
  }

  /**
   * Apply a full snapshot from the server.
   */
  applySnapshot(snapshot: RoomSnapshot): void {
    const hydrated = this.hydrateSnapshot(snapshot);
    this.currentSnapshot = hydrated;
    this.lastVersion = hydrated.stateVersion ?? 0;
    this.pendingResync = false;
    this.onSnapshot(hydrated);
  }

  /**
   * Apply an incremental delta when state versions align; otherwise trigger a resync.
   */
  applyDelta(delta: DeltaMessage): void {
    if (!this.currentSnapshot) {
      this.requestResyncOnce("no-base-snapshot", delta.stateVersion);
      return;
    }

    if (delta.stateVersion <= this.lastVersion) {
      console.warn(
        `[SnapshotReconciler] Ignoring stale delta version=${delta.stateVersion}, last=${this.lastVersion}`,
      );
      return;
    }

    const expectedVersion = this.lastVersion + 1;
    if (delta.stateVersion !== expectedVersion) {
      this.requestResyncOnce("version-gap", delta.stateVersion);
      return;
    }

    const nextSnapshot = this.applyTokenDelta(this.currentSnapshot, delta.token);
    nextSnapshot.stateVersion = delta.stateVersion;
    this.currentSnapshot = nextSnapshot;
    this.lastVersion = delta.stateVersion;
    this.onSnapshot(nextSnapshot);
  }

  applyPointerPreview(pointer: Pointer): void {
    if (!this.currentSnapshot) {
      return;
    }
    const nextSnapshot = this.applyPointerDelta(this.currentSnapshot, pointer);
    this.currentSnapshot = nextSnapshot;
    this.onSnapshot(nextSnapshot);
  }

  applyDragPreview(preview: DragPreviewEvent): void {
    if (!this.currentSnapshot || !preview.objects || preview.objects.length === 0) {
      return;
    }
    const nextSnapshot = this.applyDragPreviewDelta(this.currentSnapshot, preview);
    this.currentSnapshot = nextSnapshot;
    this.onSnapshot(nextSnapshot);
  }

  private requestResyncOnce(reason: SnapshotResyncReason, receivedVersion?: number): void {
    if (this.pendingResync) {
      return;
    }
    this.pendingResync = true;
    this.requestResync({
      lastSeenVersion: this.lastVersion,
      receivedVersion,
      reason,
    });
  }

  private applyTokenDelta(snapshot: RoomSnapshot, token: Token): RoomSnapshot {
    const tokens = [...snapshot.tokens];
    const index = tokens.findIndex((existing) => existing.id === token.id);
    if (index >= 0) {
      tokens[index] = token;
    } else {
      tokens.push(token);
    }
    return { ...snapshot, tokens };
  }

  private applyPointerDelta(snapshot: RoomSnapshot, pointer: Pointer): RoomSnapshot {
    const pointers = [...snapshot.pointers];
    const index = pointers.findIndex((existing) => existing.id === pointer.id);
    if (index >= 0) {
      pointers[index] = pointer;
    } else {
      pointers.push(pointer);
    }
    return { ...snapshot, pointers };
  }

  private applyDragPreviewDelta(snapshot: RoomSnapshot, preview: DragPreviewEvent): RoomSnapshot {
    const tokens = snapshot.tokens.map((existing) => {
      const match = preview.objects.find((candidate) => candidate.tokenId === existing.id);
      if (!match) {
        return existing;
      }
      return { ...existing, x: match.x, y: match.y };
    });

    let sceneObjects = snapshot.sceneObjects;
    if (sceneObjects && sceneObjects.length > 0) {
      sceneObjects = sceneObjects.map((object) => {
        if (object.type !== "token") {
          return object;
        }
        const match = preview.objects.find((candidate) => candidate.id === object.id);
        if (!match) {
          return object;
        }
        return {
          ...object,
          transform: {
            ...object.transform,
            x: match.x,
            y: match.y,
          },
        };
      });
    }

    return { ...snapshot, tokens, sceneObjects };
  }

  private hydrateSnapshot(snapshot: RoomSnapshot): RoomSnapshot {
    this.ingestAssets(snapshot.assets);
    const mapBackground = this.resolveAsset("map-background", snapshot);
    const drawings = this.resolveAsset("drawings", snapshot);
    return {
      ...snapshot,
      assets: undefined,
      mapBackground:
        typeof mapBackground === "string"
          ? mapBackground
          : typeof snapshot.mapBackground === "string"
            ? snapshot.mapBackground
            : undefined,
      drawings: Array.isArray(drawings)
        ? (drawings as RoomSnapshot["drawings"])
        : Array.isArray(snapshot.drawings)
          ? snapshot.drawings
          : [],
    };
  }

  private ingestAssets(assets?: RoomSnapshot["assets"]): void {
    if (!assets) {
      return;
    }
    assets.forEach((asset) => {
      if (!asset || asset.payload === undefined) {
        return;
      }
      this.assetCache.set(asset.id, asset.payload);
    });
  }

  private resolveAsset(type: SnapshotAssetType, snapshot: RoomSnapshot): unknown {
    const assetId = snapshot.assetRefs?.[type];
    if (!assetId) {
      return undefined;
    }
    return this.assetCache.get(assetId);
  }
}
