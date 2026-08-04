import { describe, it, expect, vi } from "vitest";
import { ChatMessageHandler } from "../ChatMessageHandler.js";
import { ChatService } from "../../../domains/chat/service.js";
import { PlayerService } from "../../../domains/player/service.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";

function setup() {
  const state = createEmptyRoomState();
  state.players.push({ uid: "uid-alice", name: "Alice", isDM: false });
  state.players.push({ uid: "uid-dm", name: "The DM", isDM: true });
  return { state, handler: new ChatMessageHandler(new ChatService(), new PlayerService()) };
}

describe("ChatMessageHandler.handleChat", () => {
  it("stamps the author from senderUid, ignoring anything the payload claims", () => {
    const { state, handler } = setup();

    handler.handleChat(state, "uid-alice", "hello");

    expect(state.chatLog).toHaveLength(1);
    expect(state.chatLog[0]?.authorUid).toBe("uid-alice");
    expect(state.chatLog[0]?.authorName).toBe("Alice");
  });

  it("drops a message from a uid with no player record rather than inventing an author", () => {
    const { state, handler } = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = handler.handleChat(state, "uid-ghost", "hello");

    expect(state.chatLog).toHaveLength(0);
    expect(result).toEqual({ broadcast: false, save: false });
    warn.mockRestore();
  });

  it("records a whisper target", () => {
    const { state, handler } = setup();
    handler.handleChat(state, "uid-alice", "psst", "uid-dm");
    expect(state.chatLog[0]?.to).toBe("uid-dm");
  });
});

describe("ChatMessageHandler.handleClearChatLog", () => {
  // Chat is shared history. Without this gate any player could erase what the
  // whole table said — and the guard is one `if` that a refactor could drop
  // silently, so it gets its own test.
  it("refuses a non-DM and leaves the log intact", () => {
    const { state, handler } = setup();
    handler.handleChat(state, "uid-alice", "keep me");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = handler.handleClearChatLog(state, "uid-alice", false);

    expect(result).toEqual({ broadcast: false, save: false });
    expect(state.chatLog).toHaveLength(1);
    warn.mockRestore();
  });

  it("clears for a DM", () => {
    const { state, handler } = setup();
    handler.handleChat(state, "uid-alice", "goodbye");

    const result = handler.handleClearChatLog(state, "uid-dm", true);

    expect(result).toEqual({ broadcast: true, save: true });
    expect(state.chatLog).toEqual([]);
  });
});
