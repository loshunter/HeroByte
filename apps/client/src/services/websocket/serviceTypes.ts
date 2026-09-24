import type { RoomSnapshot, MeasureEvent, ServerMessage } from "@herobyte/shared";
import type { SignalData } from "simple-peer";
import type { AuthEvent } from "./AuthenticationManager";
import type { ConnectionState } from "./ConnectionLifecycleManager";

type MessageHandler = (snapshot: RoomSnapshot) => void;
type RtcSignalHandler = (from: string, signal: SignalData) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;

// Auth response and control message types extracted to MessageRouter
export type AuthResponseMessage =
  | Extract<ServerMessage, { t: "auth-ok" }>
  | Extract<ServerMessage, { t: "auth-failed" }>;

export type ConnectionClosingMessage = Extract<ServerMessage, { t: "connection-closing" }>;

type ControlMessage =
  | Extract<ServerMessage, { t: "room-password-updated" }>
  | Extract<ServerMessage, { t: "room-password-update-failed" }>
  | Extract<ServerMessage, { t: "dm-status" }>
  | Extract<ServerMessage, { t: "dm-elevation-failed" }>
  | Extract<ServerMessage, { t: "dm-password-updated" }>
  | Extract<ServerMessage, { t: "dm-password-update-failed" }>
  | Extract<ServerMessage, { t: "map-studio-documents" }>
  | Extract<ServerMessage, { t: "map-studio-document" }>
  | Extract<ServerMessage, { t: "map-studio-deleted" }>
  | Extract<ServerMessage, { t: "map-studio-error" }>
  // THREE hand-lists must agree on a new server message: this config copy,
  // MessageRouter's type union, and MessageRouter's runtime isControlMessage
  // guard — and only the guard changes behavior. tsc catches this copy
  // drifting (the two unions meet at the config boundary); nothing but a test
  // catches the guard.
  | Extract<ServerMessage, { t: "atlas-error" }>
  | Extract<ServerMessage, { t: "remove-player-refused" }>
  | Extract<ServerMessage, { t: "room-created" }>
  | Extract<ServerMessage, { t: "room-create-failed" }>
  | Extract<ServerMessage, { t: "session-file" }>
  | Extract<ServerMessage, { t: "table-forked" }>
  | Extract<ServerMessage, { t: "table-fork-failed" }>;

export interface WebSocketServiceConfig {
  url: string;
  uid: string;
  onMessage: MessageHandler;
  onRtcSignal?: RtcSignalHandler;
  onStateChange?: ConnectionStateHandler;
  onAuthEvent?: (event: AuthEvent) => void;
  onControlMessage?: (message: ControlMessage) => void;
  /** Someone's live measurement (S6). Ephemeral — never part of a snapshot. */
  onMeasure?: (measure: MeasureEvent) => void;
  /** A RELIABLE command (one carrying a commandId) was dropped for good —
   * retries exhausted or the offline queue overflowed. The user's change did
   * NOT reach the server; surface it (toast) instead of losing it to the
   * console. Fire-and-forget traffic (previews, heartbeats) never fires this. */
  onCommandDropped?: (messageType: string, reason: string) => void;
  /**
   * Where the session token from `auth-ok` is kept between page loads and
   * shared between this browser's tabs. Injected rather than imported so the
   * service stays storage-agnostic; the hook binds it to per-table, per-uid
   * localStorage keys. Without one, the token lives only for this page load.
   */
  sessionTokenStore?: SessionTokenStore;
  reconnectInterval?: number; // ms between reconnect attempts
  maxReconnectAttempts?: number; // 0 = infinite
  heartbeatInterval?: number; // ms between heartbeats
}

/** Read/write the session token for a table (`undefined` roomId = the default table). */
export interface SessionTokenStore {
  read: (roomId: string | undefined) => string | undefined;
  write: (roomId: string | undefined, token: string) => void;
}
