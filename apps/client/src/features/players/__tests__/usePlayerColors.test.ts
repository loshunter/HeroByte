import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { usePlayerColors } from "../usePlayerColors";

const seated = (uid: string) => ({ uid, name: uid, isDM: false }) as Player;
const pc = (owner: string, color: string) =>
  ({ id: owner, name: owner, type: "pc", ownedByPlayerUID: owner, color }) as SnapshotCharacter;

describe("usePlayerColors", () => {
  it("maps seated players only: a player who left keeps today's colours", () => {
    const snapshot = {
      players: [seated("bo")],
      characters: [pc("bo", "#8a2be2"), pc("ann", "#112233")],
      tokens: [],
    };
    const { result } = renderHook(() => usePlayerColors(snapshot));
    expect([...result.current]).toEqual([["bo", "#8a2be2"]]);
  });

  it("keeps the same map while the snapshot's lists are unchanged, and is empty without one", () => {
    const snapshot = { players: [seated("bo")], characters: [pc("bo", "#8a2be2")], tokens: [] };
    const { result, rerender } = renderHook(({ snap }) => usePlayerColors(snap), {
      initialProps: { snap: snapshot },
    });
    const first = result.current;
    rerender({ snap: { ...snapshot } });
    expect(result.current).toBe(first);
    expect(renderHook(() => usePlayerColors(null)).result.current.size).toBe(0);
  });
});
