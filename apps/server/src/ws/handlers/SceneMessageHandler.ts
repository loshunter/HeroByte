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
    if (message.t === "set-monster-hp-display") {
      if (!isDM) {
        throw new Error("Monster HP display changes require DM permission");
      }
      // The setting only STORES here; enforcement is the recipient filter's,
      // so a player socket in "hidden" mode never receives the numbers at all.
      this.getRoomState(roomId).monsterHpDisplay = message.mode;
      return { broadcast: true, save: true };
    }
    if (message.t === "set-diagonal-rule") {
      if (!isDM) {
        throw new Error("Diagonal rule changes require DM permission");
      }
      // Per-room on purpose: a table agrees on one way to count diagonals, and
      // the snapshot carries it to every client so the measure overlay and any
      // future range check read the same number.
      this.getRoomState(roomId).diagonalRule = message.rule;
      return { broadcast: true, save: true };
    }
    if (message.t === "set-player-props-enabled") {
      if (!isDM) {
        throw new Error("Player prop permission changes require DM permission");
      }
      // The setting only STORES here; enforcement is PropDispatcher's, which
      // re-reads room state on every create/update/delete rather than
      // trusting the client that its toolbar was visible.
      this.getRoomState(roomId).playerPropsEnabled = message.enabled;
      return { broadcast: true, save: true };
    }
    if (message.t === "set-default-vision-radius") {
      if (!isDM) {
        throw new Error("Default vision radius changes require DM permission");
      }
      // Stored only. The fallback is applied at READ time by the vision filter,
      // so clearing this loosens every token with no radius of its own without
      // touching a single token record.
      this.getRoomState(roomId).defaultVisionRadius = message.radius;
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
