// What one compact Party row shows, pinned without a DOM. The roster is the
// Party's default view, so its attribution rules are the cards' rules and
// must hold here on their own: a character's conditions, temp HP and art are
// its own, and the seat's legacy values belong only to a sole character.

import { describe, expect, it } from "vitest";
import type { Player, SnapshotCharacter, Token } from "@herobyte/shared";
import type { EntityInfo } from "../../../../hooks/useCombatOrdering";
import { rosterEntryView } from "../rosterEntryView";

const seat = (extra: Partial<Player> = {}) =>
  ({ uid: "alice", name: "Alice", isDM: false, ...extra }) as unknown as Player;

function entity(
  character: Partial<SnapshotCharacter>,
  extra: Partial<EntityInfo> = {},
): EntityInfo {
  return {
    kind: "character",
    id: `alice-${character.id ?? "c"}`,
    character: { id: "c", name: "Ranger", type: "pc", hp: 7, maxHp: 10, ...character },
    player: seat(),
    isMe: false,
    isFirstDM: false,
    isCurrentTurn: false,
    ownsSoleCharacter: true,
    ...extra,
  } as EntityInfo;
}

const legacySeat = seat({
  statusEffects: ["poisoned"],
  tempHp: 4,
  portrait: "seat.png",
} as Partial<Player>);

describe("rosterEntryView — a player character", () => {
  it("rings a party member in their colour while fog keeps their token out of the payload", () => {
    const view = rosterEntryView(entity({ tokenId: "t-far", color: "#8A2BE2" }));
    expect(view.ring).toBe("#8a2be2");
  });

  it("falls back on the token's colour, then the default ring", () => {
    const withToken = entity({ tokenId: "t" }, { token: { id: "t", color: "#123456" } as Token });
    expect(rosterEntryView(withToken).ring).toBe("#123456");
    expect(rosterEntryView(entity({})).ring).toBe("#5AFFAD");
  });

  it("a sole character falls back to the seat's legacy conditions, temp HP and art", () => {
    const view = rosterEntryView(entity({}, { player: legacySeat }));

    expect(view.conditions.map((c) => c.label)).toEqual(["Poisoned"]);
    expect(view.hp).toEqual({ kind: "exact", current: 7, max: 10, temp: 4 });
    expect(view.portrait).toBe("seat.png");
  });

  it("a character with a sibling never wears the seat's legacy values", () => {
    const view = rosterEntryView(entity({}, { player: legacySeat, ownsSoleCharacter: false }));

    expect(view.conditions).toEqual([]);
    expect(view.hp).toEqual({ kind: "exact", current: 7, max: 10, temp: undefined });
    expect(view.portrait).toBeUndefined();
  });

  it("its own values win, an explicitly empty condition list included", () => {
    const view = rosterEntryView(
      entity({ statusEffects: [], tempHp: 2, portrait: "own.png" }, { player: legacySeat }),
    );

    expect(view.conditions).toEqual([]);
    expect(view.hp).toMatchObject({ temp: 2 });
    expect(view.portrait).toBe("own.png");
  });

  it("names the conditions it does not know as they are", () => {
    const view = rosterEntryView(entity({ statusEffects: ["prone", "cursed"] }));

    expect(view.conditions).toEqual([
      { emoji: "🧎", label: "Prone" },
      { emoji: "", label: "cursed" },
    ]);
  });

  it("tags: You, then DM, then another seat's name when the character is named otherwise", () => {
    expect(rosterEntryView(entity({}, { isMe: true })).tag).toBe("You");
    expect(rosterEntryView(entity({}, { player: seat({ isDM: true }) })).tag).toBe("DM");
    expect(rosterEntryView(entity({ name: "Companion" })).tag).toBe("Alice");
    expect(rosterEntryView(entity({ name: "Alice" })).tag).toBeNull();
  });

  it("focuses its own token, and carries its turn and initiative", () => {
    const token = { id: "t-ranger", color: "#123456" } as Token;
    const view = rosterEntryView(entity({ initiative: 14 }, { token, isCurrentTurn: true }));

    expect(view).toMatchObject({
      focusTokenId: "t-ranger",
      ring: "#123456",
      initiative: 14,
      isCurrentTurn: true,
      hiddenFromPlayers: false,
    });
    expect(rosterEntryView(entity({})).focusTokenId).toBeUndefined();
  });
});

describe("rosterEntryView — an NPC", () => {
  const goblin = (extra: Partial<SnapshotCharacter> = {}, token?: Token) =>
    ({
      token,
      kind: "npc",
      id: "npc-goblin",
      character: { id: "npc-goblin", name: "Goblin", type: "npc", hp: 3, maxHp: 7, ...extra },
      isMe: false,
      isFirstDM: false,
      isCurrentTurn: false,
      ownsSoleCharacter: false,
    }) as EntityInfo;

  it("shows exact numbers only when the server sent both", () => {
    expect(rosterEntryView(goblin({ tempHp: 2 })).hp).toEqual({
      kind: "exact",
      current: 3,
      max: 7,
      temp: 2,
    });
    expect(
      rosterEntryView(goblin({ hp: undefined, maxHp: undefined, hpBadge: "bloodied" })).hp,
    ).toEqual({ kind: "redacted", badge: "bloodied" });
    expect(rosterEntryView(goblin({ maxHp: undefined })).hp).toEqual({
      kind: "redacted",
      badge: undefined,
    });
  });

  it("wears its stance as its tag (absent is hostile), and says when it is hidden", () => {
    expect(rosterEntryView(goblin()).tag).toBe("Enemy");
    expect(rosterEntryView(goblin({ disposition: "friendly" })).tag).toBe("Ally");
    expect(rosterEntryView(goblin({ disposition: "neutral" })).tag).toBe("Neutral");
    expect(rosterEntryView(goblin({ visibleToPlayers: false })).hiddenFromPlayers).toBe(true);
    expect(rosterEntryView(goblin()).hiddenFromPlayers).toBe(false);
  });

  it("focuses its token only while it is on the map", () => {
    const onMap = { id: "t-goblin", color: "#123456" } as Token;
    expect(rosterEntryView(goblin({ tokenId: "t-goblin" }, onMap)).focusTokenId).toBe("t-goblin");
    // Its token waits on another scene: the link survives, the token is not here.
    expect(rosterEntryView(goblin({ tokenId: "t-goblin" })).focusTokenId).toBeUndefined();
    expect(rosterEntryView(goblin()).focusTokenId).toBeUndefined();
  });
});
