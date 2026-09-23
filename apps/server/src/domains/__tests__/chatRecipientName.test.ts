import { describe, expect, it } from "vitest";
import { ChatService } from "../chat/service.js";
import { PlayerService } from "../player/service.js";
import { createEmptyRoomState, toSnapshot } from "../room/model.js";
import { buildSessionFile } from "../room/sessionExport.js";

function setup() {
  const state = createEmptyRoomState();
  state.players.push(
    { uid: "alice", name: "Alice", isDM: false },
    { uid: "bob", name: "Bob", isDM: false },
    { uid: "dm", name: "DM", isDM: true },
  );
  return { state, chat: new ChatService(), players: new PlayerService() };
}

describe("whisper recipient display history", () => {
  it("stamps the current server roster name using the normalized target UID", () => {
    const { state, chat } = setup();

    const message = chat.addMessage(state, "alice", "Alice", "hello", " bob ", 123);

    expect(message).toMatchObject({ to: "bob", toName: "Bob", timestamp: 123 });
  });

  it("keeps each send-time name after the recipient is renamed and removed", () => {
    const { state, chat, players } = setup();
    const first = chat.addMessage(state, "alice", "Alice", "first", "bob");

    players.rename(state, "bob", "Robert");
    const second = chat.addMessage(state, "alice", "Alice", "second", "bob");
    players.removePlayer(state, "bob");

    expect(first).toHaveProperty("toName", "Bob");
    expect(second).toHaveProperty("toName", "Robert");
    expect(toSnapshot(state, false, "alice").chatLog).toEqual([first, second]);
  });

  it.each([undefined, "", "   "])("omits recipient metadata for public target %s", (to) => {
    const { state, chat } = setup();

    const message = chat.addMessage(state, "alice", "Alice", "public", to);

    expect(message).not.toHaveProperty("to");
    expect(message).not.toHaveProperty("toName");
  });

  it("keeps an unknown target private and accepted without inventing a name", () => {
    const { state, chat } = setup();

    const message = chat.addMessage(state, "alice", "Alice", "unknown target", "missing");

    expect(message.to).toBe("missing");
    expect(message).not.toHaveProperty("toName");
    expect(toSnapshot(state, false, "alice").chatLog).toEqual([message]);
    expect(toSnapshot(state, false, "bob").chatLog).toEqual([]);
    expect(toSnapshot(state, true, "dm").chatLog).toEqual([]);
  });

  it("carries recipient metadata only to the author and target, with no DM exception", () => {
    const { state, chat } = setup();
    const message = chat.addMessage(state, "alice", "Alice", "private", "bob");

    for (const uid of ["alice", "bob"]) {
      expect(toSnapshot(state, false, uid).chatLog).toEqual([
        expect.objectContaining({ id: message.id, toName: "Bob" }),
      ]);
    }
    expect(toSnapshot(state, true, "dm").chatLog).toEqual([]);
    expect(toSnapshot(state).chatLog).toEqual([]);
  });

  it("strips named and legacy whispers from shared session exports", () => {
    const { state, chat, players } = setup();
    players.rename(state, "bob", "PRIVATE-RECIPIENT-LABEL");
    chat.addMessage(state, "dm", "DM", "NAMED-WHISPER", "bob");
    const publicMessage = chat.addMessage(state, "alice", "Alice", "public");
    state.chatLog.push({
      id: "legacy",
      authorUid: "bob",
      authorName: "Bob",
      text: "LEGACY-WHISPER",
      to: "dm",
      timestamp: 1,
    });
    players.removePlayer(state, "bob");

    const file = buildSessionFile(state, [], "dm", 123);

    expect(file.snapshot.chatLog).toEqual([publicMessage]);
    expect(JSON.stringify(file)).not.toMatch(
      /PRIVATE-RECIPIENT-LABEL|NAMED-WHISPER|LEGACY-WHISPER/,
    );
  });
});
