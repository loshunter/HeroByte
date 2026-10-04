import { vi } from "vitest";
import type { ClientMessage, ServerMessage } from "@herobyte/shared";

export const generation: Extract<ClientMessage, { t: "map-studio-generate" }> = {
  t: "map-studio-generate",
  documentId: "transport-doc-a",
  commandId: "transport-generate-a",
  recipe: "dungeon",
  seed: 42,
  bounds: { x: 0, y: 0, cols: 24, rows: 20 },
  params: { theme: "stone", density: "medium" },
};

export const refusal: Extract<ServerMessage, { t: "map-studio-error" }> = {
  t: "map-studio-error",
  documentId: generation.documentId,
  commandId: generation.commandId,
  code: "command-rejected",
  reason: "Baseline server refusal",
};

export class TransportSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: TransportSocket[] = [];

  readyState = TransportSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];
  beforeSend?: (raw: string) => void;

  constructor(public url: string) {
    TransportSocket.instances.push(this);
  }

  open(): void {
    this.readyState = TransportSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  send(raw: string): void {
    this.beforeSend?.(raw);
    this.sent.push(raw);
  }

  close(code = 1000, reason = ""): void {
    this.readyState = TransportSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code, reason }));
  }

  receive(frame: ServerMessage): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(frame) }));
  }

  generationFrames(): string[] {
    return this.sent.filter(
      (raw) => (JSON.parse(raw) as { t: string }).t === "map-studio-generate",
    );
  }

  // Only the browser-socket boundary is simulated; all managers remain real.
  asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}

export function installTransportEnvironment(): void {
  vi.useFakeTimers();
  TransportSocket.instances = [];
  vi.stubGlobal("WebSocket", TransportSocket);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(undefined));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
}

export function restoreTransportEnvironment(): void {
  vi.clearAllTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
}
