/**
 * Who does `applyPlayerState` actually write to?
 *
 * The player-scoped messages (`rename`, `set-hp`, `portrait`,
 * `set-status-effects`) carry no uid, so the server applies them to the SENDER
 * (PlayerDispatcher -> senderUid). Sending those while restoring somebody
 * else's card overwrote the DM's OWN name/HP/portrait and left the target
 * untouched — a silent, unrecoverable corruption with no confirm and no undo.
 *
 * These tests pin the targeting rule, not the formatting:
 * - with a characterId -> character-scoped messages ONLY (server authorises
 *   owner-or-DM and applies to that character)
 * - without one -> the player-scoped fallback, whose only target is the sender
 *   itself, which is correct for a self-restore
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ClientMessage, PlayerState, RoomSnapshot } from "@herobyte/shared";
import { usePlayerActions } from "../usePlayerActions";

const mockSendMessage = vi.fn();

const snapshot = {
  users: [],
  gridSize: 50,
  gridSquareSize: 5,
  mapBackground: "",
  players: [],
  characters: [],
  tokens: [],
  drawings: [],
  rolls: [],
} as unknown as RoomSnapshot;

const state: PlayerState = {
  name: "Gandalf",
  hp: 80,
  maxHp: 120,
  portrait: "https://example.com/gandalf.png",
  statusEffects: ["blessed"],
};

/** Message types that the server resolves against the SENDER, not a target. */
const SENDER_SCOPED = ["rename", "set-hp", "portrait", "set-status-effects"];

function sentTypes(): string[] {
  return mockSendMessage.mock.calls.map((c) => (c[0] as ClientMessage).t);
}

function renderActions() {
  return renderHook(() =>
    usePlayerActions({ sendMessage: mockSendMessage, snapshot, uid: "dm-uid" }),
  );
}

describe("applyPlayerState targeting", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  it("sends NO sender-scoped message when a characterId is supplied", () => {
    const { result } = renderActions();

    act(() => {
      result.current.applyPlayerState(state, undefined, "char-alice");
    });

    // The bug: any of these reaching the wire rewrites the DM's own record.
    for (const t of SENDER_SCOPED) {
      expect(sentTypes()).not.toContain(t);
    }
  });

  it("routes name, HP, portrait and status effects to the character", () => {
    const { result } = renderActions();

    act(() => {
      result.current.applyPlayerState(state, undefined, "char-alice");
    });

    expect(mockSendMessage).toHaveBeenCalledWith({
      t: "update-character-name",
      characterId: "char-alice",
      name: "Gandalf",
    });
    expect(mockSendMessage).toHaveBeenCalledWith({
      t: "update-character-hp",
      characterId: "char-alice",
      hp: 80,
      maxHp: 120,
      tempHp: undefined,
    });
    expect(mockSendMessage).toHaveBeenCalledWith({
      t: "set-character-portrait",
      characterId: "char-alice",
      portrait: "https://example.com/gandalf.png",
    });
    expect(mockSendMessage).toHaveBeenCalledWith({
      t: "set-character-status-effects",
      characterId: "char-alice",
      effects: ["blessed"],
    });
  });

  it("clears a portrait through the character message rather than the player one", () => {
    const { result } = renderActions();

    act(() => {
      result.current.applyPlayerState({ ...state, portrait: null }, undefined, "char-alice");
    });

    expect(mockSendMessage).toHaveBeenCalledWith({
      t: "set-character-portrait",
      characterId: "char-alice",
      portrait: undefined,
    });
    expect(sentTypes()).not.toContain("portrait");
  });

  it("still uses the player-scoped fallback for a self-restore with no character", () => {
    const { result } = renderActions();

    act(() => {
      result.current.applyPlayerState(state);
    });

    expect(mockSendMessage).toHaveBeenCalledWith({ t: "rename", name: "Gandalf" });
    expect(mockSendMessage).toHaveBeenCalledWith({
      t: "set-hp",
      hp: 80,
      maxHp: 120,
      tempHp: undefined,
    });
    expect(sentTypes()).not.toContain("update-character-name");
  });

  it("keeps targeting token state by tokenId in both branches", () => {
    const withToken: PlayerState = { ...state, token: { size: "large" } as PlayerState["token"] };

    const { result } = renderActions();
    act(() => {
      result.current.applyPlayerState(withToken, "token-9", "char-alice");
    });
    expect(mockSendMessage).toHaveBeenCalledWith({
      t: "set-token-size",
      tokenId: "token-9",
      size: "large",
    });

    mockSendMessage.mockClear();
    act(() => {
      result.current.applyPlayerState(withToken, "token-9");
    });
    expect(mockSendMessage).toHaveBeenCalledWith({
      t: "set-token-size",
      tokenId: "token-9",
      size: "large",
    });
  });
});
