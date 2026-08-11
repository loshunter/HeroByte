/**
 * Tests for duplicateNpc (S8).
 *
 * There is no "duplicate-npc" message and deliberately so: the server already
 * numbers a colliding name, so a copy is just a create whose base name is the
 * original's. What is worth pinning is that the copy actually carries the
 * original's stats and art — a duplicate that silently drops the token image
 * looks like it worked.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useDMContext } from "../useDMContext";

afterEach(() => vi.useRealTimers());

const snapshot = {
  characters: [
    {
      id: "npc-1",
      type: "npc",
      name: "Goblin 3",
      hp: 4,
      maxHp: 7,
      portrait: "goblin.png",
      tokenImage: "goblin-token.png",
    },
    { id: "npc-2", type: "npc", name: "Orc", hp: 12, maxHp: 12 },
    // Knocked to 0 mid-fight — the case that used to be rejected server-side.
    { id: "npc-3", type: "npc", name: "Downed Goblin", hp: 0, maxHp: 7 },
    // Hidden from players: an ambush the DM has not sprung yet.
    { id: "npc-4", type: "npc", name: "Assassin", hp: 20, maxHp: 20, visibleToPlayers: false },
    // A PLAYER character sharing the same collection — never duplicable.
    { id: "pc-1", type: "pc", name: "Seraphina", hp: 30, maxHp: 30, portrait: "hero.png" },
  ],
} as unknown as RoomSnapshot;

function setup(snap: RoomSnapshot | null = snapshot) {
  const sendMessage = vi.fn();
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  const { result } = renderHook(() =>
    useDMContext({
      snapshot: snap,
      sendMessage,
      cameraState: { x: 0, y: 0, scale: 1 },
      // The session hook only needs the shape; nothing here exercises toasts.
      toast: toast as never,
    }),
  );
  return { result, sendMessage };
}

describe("useDMContext.duplicateNpc", () => {
  it("replays the source NPC's fields through create-npc", () => {
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-1"));

    expect(sendMessage).toHaveBeenCalledWith({
      t: "create-npc",
      // The SERVER renumbers this; sending the original's name is what tells
      // it which series the copy belongs to.
      name: "Goblin 3",
      hp: 4,
      maxHp: 7,
      portrait: "goblin.png",
      tokenImage: "goblin-token.png",
    });
  });

  it("does not invent art the original did not have", () => {
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-2"));

    const sent = sendMessage.mock.calls[0][0];
    expect(sent).toMatchObject({ t: "create-npc", name: "Orc", hp: 12, maxHp: 12 });
    expect(sent.portrait).toBeUndefined();
    expect(sent.tokenImage).toBeUndefined();
  });

  it("copies a downed NPC at 0 hp rather than inventing a healthy one", () => {
    // The pair to validation.test.ts's "accepts create-npc with zero hp": this
    // side has always sent 0, and the server rejected it, so Duplicate on a
    // downed NPC failed with a bogus "creation timed out". Pinned on both sides
    // because either half reverting alone puts the silent failure back.
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-3"));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "create-npc", name: "Downed Goblin", hp: 0, maxHp: 7 }),
    );
  });

  it("copies a hidden NPC as hidden", () => {
    // Duplicate's promise is "another one of these", and hidden-ness is the
    // property a DM prepping an ambush most needs kept. Without this the copy
    // defaults to visible while the original stays hidden — so the prep leaks
    // and nothing on screen suggests it has.
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-4"));

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "create-npc", name: "Assassin", visibleToPlayers: false }),
    );
  });

  it("does not send a visibility flag for an ordinary NPC", () => {
    // Absent, not `true`: everywhere else "not false" means visible, and an
    // explicit true would be a second way to say the default.
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-2"));

    expect(sendMessage.mock.calls[0][0].visibleToPlayers).toBeUndefined();
  });

  it("refuses to clone a player character into an NPC", () => {
    // create-npc always builds an NPC, and snapshot.characters holds both
    // kinds. Without a type guard a PC's id would turn that player's name,
    // portrait and token art into a DM-owned monster. NPCsTab's list is already
    // filtered, so this guards the hook's public shape, not today's UI.
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("pc-1"));

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends nothing for an id that is not at the table", () => {
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("does-not-exist"));

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends nothing when there is no snapshot yet", () => {
    const { result, sendMessage } = setup(null);

    act(() => result.current.npcManagement.duplicateNpc("npc-1"));

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("never asks for more than one copy", () => {
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-1"));

    expect(sendMessage.mock.calls[0][0].count).toBeUndefined();
  });
});
