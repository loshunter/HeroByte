// ============================================================================
// IDLE ROOM UNLOAD MANAGER
// ============================================================================
// Periodically unloads rooms that have no connected players and no recent
// activity. Their state is flushed to durable storage first and restored
// transparently on the next join, so a dormant table costs no memory.

import type { Container } from "../../container.js";
import { getDefaultRoomClearMs } from "../../config/auth.js";

export interface IdleRoomUnloadOptions {
  /** How long a room may sit idle before unloading (default 30 minutes). */
  idleMs?: number;
  /** Sweep interval (default 5 minutes). */
  checkIntervalMs?: number;
  /**
   * How long the default table may sit empty before its contents are wiped
   * (default 6 hours, via HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS). Much longer than
   * the unload window on purpose: unloading a private table is lossless, but
   * this one destroys content, so it should only fire when a session is
   * unambiguously over. 0 disables clearing entirely.
   */
  defaultRoomClearMs?: number;
}

export class IdleRoomUnloadManager {
  private readonly container: Container;
  private readonly idleMs: number;
  private readonly checkIntervalMs: number;
  private readonly defaultRoomClearMs: number;
  private interval: NodeJS.Timeout | null = null;

  constructor(container: Container, options: IdleRoomUnloadOptions = {}) {
    this.container = container;
    this.idleMs = options.idleMs ?? 30 * 60 * 1000;
    this.checkIntervalMs = options.checkIntervalMs ?? 5 * 60 * 1000;
    this.defaultRoomClearMs = options.defaultRoomClearMs ?? getDefaultRoomClearMs();
  }

  start(): void {
    this.interval = setInterval(() => {
      // Reclaim before unload, so a room leaving memory this tick has just
      // been reconciled with fresh state (unload also sweeps on the way out).
      // Its own catch: a reclaim failure must not take down the unload sweep.
      this.container.reclaimUnreferencedAssets().catch((error) => {
        console.error("[IdleRoomUnload] Asset reclaim failed", error);
      });
      this.container.unloadIdleRooms(this.idleMs).catch((error) => {
        console.error("[IdleRoomUnload] Sweep failed", error);
      });
      // Independent of the unload sweep: the default table is never unloaded,
      // so it is emptied in place instead. Failures here must not take down
      // the unload sweep, hence the separate catch. A window of 0 means an
      // operator turned clearing off (their default table is a real table).
      if (this.defaultRoomClearMs > 0) {
        this.container.clearIdleDefaultRoom(this.defaultRoomClearMs).catch((error) => {
          console.error("[IdleRoomUnload] Default table clear failed", error);
        });
      }
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
