// Live interactions against the compiled scene: publish compiles the
// geometry, this handler makes it playable — doors flip, fog toggles — and
// the snapshot broadcast animates every client.

import type { ClientMessage, CompiledDoor } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

type GetRoomState = (roomId: string) => RoomState;

export class SceneMessageHandler {
  constructor(private readonly getRoomState: GetRoomState) {}

  handle(message: ClientMessage, roomId: string, isDM: boolean): RouteHandlerResult | null {
    if (message.t === "toggle-door") {
      this.toggleDoor(roomId, message.doorId, isDM);
      return { broadcast: true, save: true };
    }
    if (message.t === "set-door-state") {
      if (!isDM) {
        throw new Error("Door state changes require DM permission");
      }
      this.requireDoor(roomId, message.doorId, true).state = message.state;
      return { broadcast: true, save: true };
    }
    if (message.t === "set-fog-enabled") {
      if (!isDM) {
        throw new Error("Fog of war changes require DM permission");
      }
      this.getRoomState(roomId).fogEnabled = message.enabled;
      return { broadcast: true, save: true };
    }
    return null;
  }

  private toggleDoor(roomId: string, doorId: string, isDM: boolean): void {
    const door = this.requireDoor(roomId, doorId, isDM);
    if (door.state === "locked" && !isDM) {
      throw new Error("Door is locked");
    }
    // DM toggles force any door open; players flip only open/closed.
    door.state = door.state === "open" ? "closed" : "open";
  }

  private requireDoor(roomId: string, doorId: string, isDM: boolean): CompiledDoor {
    const door = this.getRoomState(roomId).compiledScene?.doors.find(
      (candidate) => candidate.id === doorId,
    );
    // A secret door must be indistinguishable from no door for players, so
    // both cases share the same error message.
    if (!door || (door.state === "secret" && !isDM)) {
      throw new Error(`Unknown door: ${doorId}`);
    }
    return door;
  }
}
