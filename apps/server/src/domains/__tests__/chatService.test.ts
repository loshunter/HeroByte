import { describe, it, expect } from "vitest";
import { ChatService } from "../chat/service.js";
import { createEmptyRoomState } from "../room/model.js";
import { ARRAY_LIMITS } from "../../middleware/validators/constants.js";

describe("ChatService", () => {
  it("stamps the author from its arguments, not from anything caller-supplied in the text", () => {
    const service = new ChatService();
    const state = createEmptyRoomState();

    const message = service.addMessage(state, "uid-1", "Alice", "hello", undefined, 1000);

    expect(message.authorUid).toBe("uid-1");
    expect(message.authorName).toBe("Alice");
    expect(message.text).toBe("hello");
    expect(message.timestamp).toBe(1000);
    expect(message.id).toBeTruthy();
    expect(message.to).toBeUndefined();
  });

  it("snapshots the author name so a later rename does not rewrite history", () => {
    const service = new ChatService();
    const state = createEmptyRoomState();

    service.addMessage(state, "uid-1", "Alice", "first");
    service.addMessage(state, "uid-1", "Alice the Renamed", "second");

    expect(state.chatLog.map((m) => m.authorName)).toEqual(["Alice", "Alice the Renamed"]);
  });

  it("trims the stored body", () => {
    const service = new ChatService();
    const state = createEmptyRoomState();

    const message = service.addMessage(state, "uid-1", "Alice", "  padded  ");

    expect(message.text).toBe("padded");
  });

  it("records a whisper target, but never an empty one", () => {
    const service = new ChatService();
    const state = createEmptyRoomState();

    expect(service.addMessage(state, "uid-1", "Alice", "hi", "uid-2").to).toBe("uid-2");
    // A blank target would read as "a whisper to nobody" and be filtered away
    // from everyone including its author — so it must become a public message.
    expect(service.addMessage(state, "uid-1", "Alice", "hi", "   ").to).toBeUndefined();
    expect(service.addMessage(state, "uid-1", "Alice", "hi", "").to).toBeUndefined();
  });

  it("bounds history to the configured ring size, keeping the newest", () => {
    const service = new ChatService();
    const state = createEmptyRoomState();
    const cap = ARRAY_LIMITS.CHAT_HISTORY;

    for (let i = 0; i < cap + 5; i += 1) {
      service.addMessage(state, "uid-1", "Alice", `message-${i}`);
    }

    expect(state.chatLog).toHaveLength(cap);
    expect(state.chatLog[0]?.text).toBe("message-5");
    expect(state.chatLog.at(-1)?.text).toBe(`message-${cap + 4}`);
  });

  it("clears history", () => {
    const service = new ChatService();
    const state = createEmptyRoomState();
    service.addMessage(state, "uid-1", "Alice", "hi");

    service.clearHistory(state);

    expect(state.chatLog).toEqual([]);
  });

  it("gives every message a distinct id", () => {
    const service = new ChatService();
    const state = createEmptyRoomState();
    for (let i = 0; i < 20; i += 1) service.addMessage(state, "uid-1", "Alice", "same text");

    expect(new Set(state.chatLog.map((m) => m.id)).size).toBe(20);
  });
});
