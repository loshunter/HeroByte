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

// The player-level conditions list is a legacy mirror, read back only for a
// player's SOLE character. So it may only ever hold that character's list:
// - not a sibling's: with two characters the mirror wrote whichever was edited
//   last, and once the other was deleted the survivor showed (and on its next
//   toggle saved) the deleted one's conditions;
// - not an NPC's: an NPC the DM placed can carry the DM's uid as its owner,
//   and since U7 the DM sets NPC conditions from the NPC's window.
describe("setCharacterStatusEffects mirror", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  function actionsWith(characters: unknown[]) {
    const withCharacters = { ...snapshot, characters } as unknown as RoomSnapshot;
    return renderHook(() =>
      usePlayerActions({
        sendMessage: mockSendMessage,
        snapshot: withCharacters,
        uid: "dm-uid",
      }),
    );
  }

  it("mirrors the sender's own player character onto the player-level list", () => {
    const { result } = actionsWith([
      { id: "char-mine", name: "Mine", type: "pc", ownedByPlayerUID: "dm-uid" },
    ]);
    act(() => result.current.setCharacterStatusEffects("char-mine", ["prone"]));

    expect(sentTypes()).toEqual(["set-character-status-effects", "set-status-effects"]);
  });

  it("never mirrors when the sender has two player characters", () => {
    const { result } = actionsWith([
      { id: "char-mine", name: "Mine", type: "pc", ownedByPlayerUID: "dm-uid" },
      { id: "char-also", name: "Also mine", type: "pc", ownedByPlayerUID: "dm-uid" },
    ]);
    act(() => result.current.setCharacterStatusEffects("char-also", ["poisoned"]));

    expect(sentTypes()).toEqual(["set-character-status-effects"]);
  });

  it("an NPC the sender owns does not stop their sole character mirroring", () => {
    const { result } = actionsWith([
      { id: "char-mine", name: "Mine", type: "pc", ownedByPlayerUID: "dm-uid" },
      { id: "npc-goblin", name: "Goblin", type: "npc", ownedByPlayerUID: "dm-uid" },
    ]);
    act(() => result.current.setCharacterStatusEffects("char-mine", ["prone"]));
    expect(sentTypes()).toEqual(["set-character-status-effects", "set-status-effects"]);

    // …and that sole character's mirror is not the NPC's to write.
    mockSendMessage.mockClear();
    act(() => result.current.setCharacterStatusEffects("npc-goblin", ["poisoned"]));
    expect(sentTypes()).toEqual(["set-character-status-effects"]);
  });

  it("never mirrors an NPC, even one the sender owns", () => {
    const { result } = actionsWith([
      { id: "npc-goblin", name: "Goblin", type: "npc", ownedByPlayerUID: "dm-uid" },
    ]);
    act(() => result.current.setCharacterStatusEffects("npc-goblin", ["poisoned"]));

    expect(sentTypes()).toEqual(["set-character-status-effects"]);
  });
});

// `sync-player-drawings` carries no owner: the server replaces the SENDER's
// drawings with the file's. So a DM restoring a player's file onto the
// player's card deleted the DM's own drawings and re-created the player's as
// the DM's. Drawings are restored only onto the sender's own card.
describe("applyPlayerState drawings", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  const withDrawings = { ...state, drawings: [] } as PlayerState;
  function actionsWith(characters: unknown[]) {
    const withCharacters = { ...snapshot, characters } as unknown as RoomSnapshot;
    return renderHook(() =>
      usePlayerActions({ sendMessage: mockSendMessage, snapshot: withCharacters, uid: "dm-uid" }),
    );
  }

  it("a file loaded onto someone else's card leaves the loader's drawings alone", () => {
    const { result } = actionsWith([
      { id: "char-alice", name: "Alice", type: "pc", ownedByPlayerUID: "alice-uid" },
    ]);
    act(() => result.current.applyPlayerState(withDrawings, undefined, "char-alice"));

    expect(sentTypes()).not.toContain("sync-player-drawings");
  });

  it("a file loaded onto your own card restores your drawings", () => {
    const { result } = actionsWith([
      { id: "char-mine", name: "Mine", type: "pc", ownedByPlayerUID: "dm-uid" },
    ]);
    act(() => result.current.applyPlayerState(withDrawings, undefined, "char-mine"));

    expect(sentTypes()).toContain("sync-player-drawings");
  });

  it("a legacy self-restore (no character) still restores drawings", () => {
    const { result } = actionsWith([]);
    act(() => result.current.applyPlayerState(withDrawings));

    expect(sentTypes()).toContain("sync-player-drawings");
  });
});

// `set-initiative` has no modifier-only form: with no value it CLEARS
// initiative, and with one it enters the order. Loading a file that carried a
// modifier sent `initiative: current ?? 0`, which put a character with no
// initiative into the order at 0 (a combatant, in combat), and was refused
// outright from a player while the table has manual entry off.
describe("applyPlayerState initiative modifier", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  const withModifier = { ...state, initiativeModifier: 3 } as PlayerState;
  function actionsAs(
    uid: string,
    character: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ) {
    const table = {
      ...snapshot,
      ...extra,
      players: [
        { uid: "dm-uid", name: "DM", isDM: true },
        { uid: "alice-uid", name: "Alice", isDM: false },
      ],
      characters: [
        {
          id: "char-alice",
          name: "Alice",
          type: "pc",
          ownedByPlayerUID: "alice-uid",
          ...character,
        },
      ],
    } as unknown as RoomSnapshot;
    return renderHook(() =>
      usePlayerActions({ sendMessage: mockSendMessage, snapshot: table, uid }),
    );
  }
  const initiativeSends = () =>
    mockSendMessage.mock.calls
      .map((c) => c[0] as ClientMessage)
      .filter((m) => m.t === "set-initiative");

  it("never puts a character with no initiative into the order", () => {
    const { result } = actionsAs("alice-uid", {});
    act(() => result.current.applyPlayerState(withModifier, undefined, "char-alice"));

    expect(initiativeSends()).toEqual([]);
  });

  it("restores the modifier alongside an initiative the character already has", () => {
    const { result } = actionsAs("alice-uid", { initiative: 12 });
    act(() => result.current.applyPlayerState(withModifier, undefined, "char-alice"));

    expect(initiativeSends()).toEqual([
      { t: "set-initiative", characterId: "char-alice", initiative: 12, initiativeModifier: 3 },
    ]);
  });

  it("sends nothing the server would refuse: a player, while manual entry is off", () => {
    const { result } = actionsAs(
      "alice-uid",
      { initiative: 12 },
      { initiativeManualOverride: false },
    );
    act(() => result.current.applyPlayerState(withModifier, undefined, "char-alice"));

    expect(initiativeSends()).toEqual([]);
  });

  it("the DM is never blocked by the manual-entry setting", () => {
    const { result } = actionsAs("dm-uid", { initiative: 12 }, { initiativeManualOverride: false });
    act(() => result.current.applyPlayerState(withModifier, undefined, "char-alice"));

    expect(initiativeSends()).toHaveLength(1);
  });
});
