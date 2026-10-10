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

  it("keeps the same map across new snapshots while the colours are the same", () => {
    // Every broadcast brings new arrays.
    const snap = () => ({ players: [seated("bo")], characters: [pc("bo", "#8a2be2")], tokens: [] });
    const { result, rerender } = renderHook(({ s }) => usePlayerColors(s), {
      initialProps: { s: snap() },
    });
    const first = result.current;
    rerender({ s: snap() });
    expect(result.current).toBe(first);
    expect(renderHook(() => usePlayerColors(null)).result.current.size).toBe(0);
  });

  it("follows a recolour on the next snapshot", () => {
    // Only the party records change (the colour rides them); players and tokens stay put.
    const players = [seated("bo")];
    const tokens: [] = [];
    const { result, rerender } = renderHook(
      ({ color }) => usePlayerColors({ players, characters: [pc("bo", color)], tokens }),
      { initialProps: { color: "#8a2be2" } },
    );
    rerender({ color: "#ffc2d3" });
    expect([...result.current]).toEqual([["bo", "#ffc2d3"]]);
  });
});
