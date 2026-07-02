// ============================================================================
// IDLE ROOM UNLOAD MANAGER
// ============================================================================
// Periodically unloads rooms that have no connected players and no recent
// activity. Their state is flushed to durable storage first and restored
// transparently on the next join, so a dormant table costs no memory.

import type { Container } from "../../container.js";

export interface IdleRoomUnloadOptions {
  /** How long a room may sit idle before unloading (default 30 minutes). */
  idleMs?: number;
  /** Sweep interval (default 5 minutes). */
  checkIntervalMs?: number;
}

export class IdleRoomUnloadManager {
  private readonly container: Container;
  private readonly idleMs: number;
  private readonly checkIntervalMs: number;
  private interval: NodeJS.Timeout | null = null;

  constructor(container: Container, options: IdleRoomUnloadOptions = {}) {
    this.container = container;
    this.idleMs = options.idleMs ?? 30 * 60 * 1000;
    this.checkIntervalMs = options.checkIntervalMs ?? 5 * 60 * 1000;
  }

  start(): void {
    this.interval = setInterval(() => {
      this.container.unloadIdleRooms(this.idleMs).catch((error) => {
        console.error("[IdleRoomUnload] Sweep failed", error);
      });
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
