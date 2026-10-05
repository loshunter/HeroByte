// Deleting your last character hands you a "New Character" — but not when the
// character's token is locked: the server refuses that delete (a locked piece is
// deleted by no one until the DM unlocks it), the character stays, and a
// replacement would leave the seat with two.

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { usePlayerActions } from "../usePlayerActions";

const snapshotWith = (locked: boolean) =>
  ({
    users: ["me"],
    players: [],
    tokens: [{ id: "t-1", owner: "me", x: 0, y: 0, color: "#fff" }],
    characters: [{ id: "c-1", name: "Aria", ownedByPlayerUID: "me", tokenId: "t-1", type: "pc" }],
    sceneObjects: [{ id: "token:t-1", type: "token", locked }],
    drawings: [],
  }) as unknown as RoomSnapshot;

const sentTypes = (send: ReturnType<typeof vi.fn>) =>
  send.mock.calls.map(([m]) => (m as ClientMessage).t);

describe("usePlayerActions.deleteCharacter and a locked token", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the delete alone (no confirm, no replacement) when the token is locked", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      usePlayerActions({ sendMessage, snapshot: snapshotWith(true), uid: "me" }),
    );
    result.current.deleteCharacter("c-1");
    expect(confirm).not.toHaveBeenCalled();
    expect(sentTypes(sendMessage)).toEqual(["delete-player-character"]);
  });

  it("control: unlocked, the last character is replaced after the confirm", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      usePlayerActions({ sendMessage, snapshot: snapshotWith(false), uid: "me" }),
    );
    result.current.deleteCharacter("c-1");
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(sentTypes(sendMessage)).toEqual(["delete-player-character", "add-player-character"]);
  });
});
