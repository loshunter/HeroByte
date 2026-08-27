import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { useInitiativeSetting } from "../useInitiativeSetting";

/**
 * These cover the ROLL path specifically. `setInitiative` — the manual path —
 * predates this file and is exercised through InitiativeModal's suite; what is
 * pinned here is the pair of decisions that make rolling different from
 * setting, because both are easy to "tidy up" into a bug later.
 */
describe("useInitiativeSetting - rollInitiative", () => {
  const sendMessage = vi.fn();

  const snapshotWith = (initiative?: number, initiativeModifier?: number): RoomSnapshot =>
    ({
      characters: [
        {
          id: "char-1",
          name: "Fighter",
          type: "pc",
          hp: 10,
          maxHp: 10,
          ...(initiative !== undefined ? { initiative } : {}),
          ...(initiativeModifier !== undefined ? { initiativeModifier } : {}),
        },
      ],
    }) as unknown as RoomSnapshot;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends roll-initiative carrying the target and the supplied modifier", () => {
    const { result } = renderHook(() =>
      useInitiativeSetting({ snapshot: snapshotWith(), sendMessage }),
    );

    act(() => result.current.rollInitiative("char-1", 5));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      t: "roll-initiative",
      characterId: "char-1",
      modifier: 5,
    });
  });

  it("carries no result of any kind — the server rolls", () => {
    const { result } = renderHook(() =>
      useInitiativeSetting({ snapshot: snapshotWith(), sendMessage }),
    );

    act(() => result.current.rollInitiative("char-1", 3));

    const sent = sendMessage.mock.calls[0][0] as ClientMessage & Record<string, unknown>;
    // A forgeable field creeping onto this message is the exact regression the
    // server-side roll exists to prevent, so assert on the whole key set rather
    // than on the absence of any one name.
    expect(Object.keys(sent).sort()).toEqual(["characterId", "modifier", "t"]);
  });

  it("omits the modifier entirely when none is supplied, meaning 'use the stored one'", () => {
    const { result } = renderHook(() =>
      useInitiativeSetting({ snapshot: snapshotWith(), sendMessage }),
    );

    act(() => result.current.rollInitiative("char-1"));

    expect(sendMessage).toHaveBeenCalledWith({ t: "roll-initiative", characterId: "char-1" });
  });

  it("sends a modifier of zero rather than dropping it", () => {
    // `0` is falsy, so a `&&` spread would silently turn "my bonus is nothing"
    // into "use whatever you have on file" — which is a different instruction.
    const { result } = renderHook(() =>
      useInitiativeSetting({ snapshot: snapshotWith(), sendMessage }),
    );

    act(() => result.current.rollInitiative("char-1", 0));

    expect(sendMessage).toHaveBeenCalledWith({
      t: "roll-initiative",
      characterId: "char-1",
      modifier: 0,
    });
  });

  it("arms no confirmation timeout, so a roll cannot fail on an unchanged value", () => {
    // The manual path arms a five-second timer and resolves by noticing that
    // the character's initiative CHANGED. A roll that lands on the number
    // already stored changes nothing, so adopting that machinery here would
    // report a timeout for a roll the whole table just watched succeed.
    //
    // The armed TIMER is what this asserts on, deliberately. Asserting only
    // that `isSetting` stays false does not distinguish the two paths: setting
    // it also sets targetCharacterId, at which point the confirmation effect
    // compares a freshly-found initiative against an `undefined` baseline,
    // decides it changed, and clears the flag inside the same act() — so the
    // regression would slip through green. Verified by sabotage.
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useInitiativeSetting({ snapshot: snapshotWith(12, 2), sendMessage }),
      );

      act(() => result.current.rollInitiative("char-1", 2));

      expect(vi.getTimerCount()).toBe(0);

      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(result.current.error).toBeNull();
      expect(result.current.isSetting).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the manual path DOES arm that timer — the contrast the roll path is defined against", () => {
    // Without this, the assertion above could pass because nothing in the hook
    // ever arms a timer, and it would keep passing if the manual path's
    // confirmation machinery were deleted outright.
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useInitiativeSetting({ snapshot: snapshotWith(12, 2), sendMessage }),
      );

      act(() => result.current.setInitiative("char-1", 15, 2));

      expect(vi.getTimerCount()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
