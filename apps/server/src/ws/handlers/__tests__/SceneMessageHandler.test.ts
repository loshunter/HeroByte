import { beforeEach, describe, expect, it } from "vitest";
import type { CompiledDoor } from "@herobyte/shared";
import { createEmptyRoomState, type RoomState } from "../../../domains/room/model.js";
import { SceneMessageHandler } from "../SceneMessageHandler.js";

function door(id: string, state: CompiledDoor["state"]): CompiledDoor {
  return {
    id,
    x1: 0,
    y1: 0,
    x2: 50,
    y2: 0,
    state,
    blocksMovement: true,
    blocksVision: true,
  };
}

describe("SceneMessageHandler", () => {
  let roomState: RoomState;
  let handler: SceneMessageHandler;

  beforeEach(() => {
    roomState = createEmptyRoomState();
    roomState.compiledScene = {
      schemaVersion: 1,
      sourceDocumentId: "map",
      sourceRevision: 1,
      compiledAt: 1,
      width: 2048,
      height: 2048,
      walls: [],
      doors: [
        door("door-closed", "closed"),
        door("door-open", "open"),
        door("door-locked", "locked"),
        door("door-secret", "secret"),
      ],
      lights: [],
    };
    handler = new SceneMessageHandler(() => roomState);
  });

  function doorState(id: string): string | undefined {
    return roomState.compiledScene?.doors.find((candidate) => candidate.id === id)?.state;
  }

  it("ignores messages outside the door namespace", () => {
    expect(handler.handle({ t: "heartbeat" }, "room", false)).toBeNull();
  });

  it("lets anyone toggle a closed door open and back", () => {
    expect(handler.handle({ t: "toggle-door", doorId: "door-closed" }, "room", false)).toEqual({
      broadcast: true,
      save: true,
    });
    expect(doorState("door-closed")).toBe("open");

    handler.handle({ t: "toggle-door", doorId: "door-closed" }, "room", false);
    expect(doorState("door-closed")).toBe("closed");
  });

  it("refuses to toggle a locked door for players but lets the DM force it open", () => {
    expect(() =>
      handler.handle({ t: "toggle-door", doorId: "door-locked" }, "room", false),
    ).toThrow("Door is locked");
    expect(doorState("door-locked")).toBe("locked");

    handler.handle({ t: "toggle-door", doorId: "door-locked" }, "room", true);
    expect(doorState("door-locked")).toBe("open");
  });

  it("does not reveal secret doors to players, even in error messages", () => {
    expect(() =>
      handler.handle({ t: "toggle-door", doorId: "door-secret" }, "room", false),
    ).toThrow("Unknown door: door-secret");
    expect(doorState("door-secret")).toBe("secret");

    handler.handle({ t: "toggle-door", doorId: "door-secret" }, "room", true);
    expect(doorState("door-secret")).toBe("open");
  });

  it("rejects toggles for doors that do not exist", () => {
    expect(() => handler.handle({ t: "toggle-door", doorId: "ghost" }, "room", false)).toThrow(
      "Unknown door: ghost",
    );
  });

  it("rejects toggles when no scene has been published", () => {
    roomState.compiledScene = undefined;
    expect(() =>
      handler.handle({ t: "toggle-door", doorId: "door-closed" }, "room", false),
    ).toThrow("Unknown door: door-closed");
  });

  it("lets the DM set any door state, including reveal and lock", () => {
    handler.handle({ t: "set-door-state", doorId: "door-secret", state: "closed" }, "room", true);
    expect(doorState("door-secret")).toBe("closed");

    handler.handle({ t: "set-door-state", doorId: "door-open", state: "locked" }, "room", true);
    expect(doorState("door-open")).toBe("locked");
  });

  it("rejects set-door-state from players", () => {
    expect(() =>
      handler.handle({ t: "set-door-state", doorId: "door-closed", state: "open" }, "room", false),
    ).toThrow("require DM permission");
    expect(doorState("door-closed")).toBe("closed");
  });

  it("lets the DM toggle fog of war on and off", () => {
    expect(handler.handle({ t: "set-fog-enabled", enabled: true }, "room", true)).toEqual({
      broadcast: true,
      save: true,
    });
    expect(roomState.fogEnabled).toBe(true);

    handler.handle({ t: "set-fog-enabled", enabled: false }, "room", true);
    expect(roomState.fogEnabled).toBe(false);
  });

  it("rejects fog changes from players", () => {
    expect(() => handler.handle({ t: "set-fog-enabled", enabled: true }, "room", false)).toThrow(
      "require DM permission",
    );
    expect(roomState.fogEnabled).toBe(false);
  });
});
