import type { RoomSnapshot, ClientMessage, MeasureEvent, ServerMessage } from "@herobyte/shared";
import type { AuthState } from "../services/websocket";

export interface AuthenticatedAppProps {
  uid: string;
  snapshot: RoomSnapshot | null;
  /** Everyone else's live measurement (S6); relayed, never in the snapshot. */
  remoteMeasurements: MeasureEvent[];
  sendMessage: (message: ClientMessage) => void;
  getAuthCredentials: () => { secret: string; roomId?: string } | null;
  registerRtcHandler: (handler: (from: string, signal: unknown) => void) => void;
  registerServerEventHandler: (handler: (message: ServerMessage) => void) => void;
  registerCommandDropHandler: (handler: (messageType: string, reason: string) => void) => void;
  isConnected: boolean;
  authState: AuthState;
}
