import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ClientMessage } from "@shared";
import { CommandAckManager } from "../../websocket/CommandAckManager";

describe("CommandAckManager", () => {
  const baseMessage: ClientMessage = { t: "move", id: "token-1", x: 1, y: 2 };
  let manager: CommandAckManager;

  beforeEach(() => {
    manager = new CommandAckManager();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds commandId to mutating messages and tracks pending state", () => {
    const decorated = manager.attachCommandId(baseMessage);
    expect(decorated.commandId).toBeDefined();

    manager.handleAck(decorated.commandId!);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Command acknowledged"));
  });

  it("skips attaching commandId for non-mutating messages", () => {
    const heartbeat: ClientMessage = { t: "heartbeat" };
    const decorated = manager.attachCommandId(heartbeat);
    expect(decorated.commandId).toBeUndefined();
  });

  it("does not track drag-preview high-frequency messages", () => {
    const preview: ClientMessage = {
      t: "drag-preview",
      objects: [{ id: "token:1", x: 1, y: 2 }],
    } as unknown as ClientMessage;
    const decorated = manager.attachCommandId(preview);
    expect(decorated.commandId).toBeUndefined();
  });

  it("logs nack reasons and clears pending entries", () => {
    const decorated = manager.attachCommandId(baseMessage);
    manager.handleNack(decorated.commandId!, "invalid");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Command rejected"));
  });

  it("warns when pending command is dropped", () => {
    const decorated = manager.attachCommandId(baseMessage);
    manager.handleDrop(decorated, "queue-overflow");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("queue-overflow"));
  });

  it("warns when ack received for unknown command", () => {
    manager.handleAck("missing");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("unknown commandId"));
  });
});
