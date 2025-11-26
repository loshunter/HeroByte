import type { ClientMessage } from "@shared";

type AckEligibleType = ClientMessage["t"];

const NON_TRACKED_TYPES: AckEligibleType[] = [
  "authenticate",
  "heartbeat",
  "rtc-signal",
  "request-room-resync",
  "drag-preview",
];

interface PendingCommand {
  type: AckEligibleType;
  timestamp: number;
}

export class CommandAckManager {
  private readonly nonTracked = new Set<AckEligibleType>(NON_TRACKED_TYPES);
  private pending = new Map<string, PendingCommand>();
  private counter = 0;

  reset(): void {
    this.pending.clear();
    this.counter = 0;
  }

  attachCommandId<T extends ClientMessage>(message: T): T {
    if (!this.shouldTrack(message)) {
      return message;
    }

    const commandId = message.commandId ?? this.generateCommandId();
    const decorated = { ...message, commandId } as T;
    this.pending.set(commandId, { type: decorated.t, timestamp: Date.now() });
    return decorated;
  }

  handleAck(commandId: string): void {
    const pending = this.pending.get(commandId);
    if (!pending) {
      console.warn(`[WebSocket] Received ack for unknown commandId=${commandId}`);
      return;
    }
    this.pending.delete(commandId);
    console.log(
      `[WebSocket] Command acknowledged id=${commandId} type=${pending.type} latency=${Date.now() - pending.timestamp}ms`,
    );
  }

  handleNack(commandId: string, reason?: string): void {
    const pending = this.pending.get(commandId);
    if (!pending) {
      console.warn(`[WebSocket] Received nack for unknown commandId=${commandId}`);
      return;
    }
    this.pending.delete(commandId);
    console.error(
      `[WebSocket] Command rejected id=${commandId} type=${pending.type} reason=${reason ?? "unspecified"}`,
    );
  }

  handleDrop(message: ClientMessage, reason: string): void {
    if (!message.commandId) {
      return;
    }
    if (!this.pending.delete(message.commandId)) {
      return;
    }
    console.warn(
      `[WebSocket] Dropped pending command id=${message.commandId} type=${message.t} due to ${reason}`,
    );
  }

  private shouldTrack(message: ClientMessage): boolean {
    return Boolean(message.commandId || !this.nonTracked.has(message.t));
  }

  private generateCommandId(): string {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    this.counter += 1;
    return `cmd-${this.counter}`;
  }
}
