import type { ClientMessage, SignalData } from "@shared";
import type { HeartbeatHandler } from "../handlers/HeartbeatHandler.js";
import type { RTCSignalHandler } from "../handlers/RTCSignalHandler.js";
import type { RoomMessageHandler } from "../handlers/RoomMessageHandler.js";
import type { TokenMessageHandler } from "../handlers/TokenMessageHandler.js";
import type { TransformMessageHandler } from "../handlers/TransformMessageHandler.js";
import type { AuthorizationCheckWrapper } from "../services/AuthorizationCheckWrapper.js";
import type { MessageRoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";
import type { RoomService } from "../../domains/room/service.js";

export class RoomDispatcher {
  constructor(
    private roomHandler: RoomMessageHandler,
    private heartbeatHandler: HeartbeatHandler,
    private rtcSignalHandler: RTCSignalHandler,
    private transformHandler: TransformMessageHandler,
    private tokenHandler: TokenMessageHandler,
    private roomService: RoomService,
    private authWrapper: AuthorizationCheckWrapper,
    private sendControlMessage: (targetUid: string, message: any) => void
  ) {}

  dispatch(
    message: ClientMessage,
    context: MessageRoutingContext,
    senderUid: string
  ): RouteHandlerResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    switch (message.t) {
      case "set-room-password":
        this.roomHandler.handleSetRoomPassword(state, senderUid, message.secret);
        return { broadcast: false, save: false }; // Handled internally

      case "heartbeat":
        const result = this.heartbeatHandler.handleHeartbeat(state, senderUid);
        this.sendControlMessage(senderUid, {
          t: "heartbeat-ack",
          timestamp: Date.now(),
        });
        return result;

      case "request-room-resync":
        const snapshot = this.roomService.createSnapshotForPlayer(senderUid);
        this.sendControlMessage(senderUid, snapshot);
        return { broadcast: false, save: false };

      case "load-session":
        return this.roomHandler.handleLoadSession(
          state,
          senderUid,
          message.snapshot,
          isDM
        );

      case "transform-object":
        return this.transformHandler.handleTransformObject(
          state,
          senderUid,
          message.id,
          {
            position: message.position,
            scale: message.scale,
            rotation: message.rotation,
            locked: message.locked,
          }
        );

      case "rtc-signal":
        this.rtcSignalHandler.forwardSignal(
          message.target,
          senderUid,
          message.signal as SignalData
        );
        return { broadcast: false, save: false };

      case "clear-all-tokens":
        // Moved from TokenDispatcher because it was under Room Management in router
        // Actually TokenDispatcher handles it now. So RoomDispatcher shouldn't?
        // Let's check router. It had clear-all-tokens.
        // But I moved it to TokenDispatcher in Step 26.
        // So I don't need it here.
        return null;

      default:
        return null;
    }
  }
}
