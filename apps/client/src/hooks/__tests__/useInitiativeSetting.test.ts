import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

/**
 * The manual path's confirmation. The value-CHANGED road alone reported a
 * timeout for a hand entry equal to the number already stored — the server
 * applied it, logged it "by hand", and the modal sat five seconds then said
 * "timed out" over a table that had already moved on (one d20 face in twenty;
 * the e2e suite hit it three times in two days).
 */
describe("useInitiativeSetting - setInitiative confirmation", () => {
  const sendMessage = vi.fn();

  const frame = (
    stateVersion: number | undefined,
    initiative: number | undefined,
    initiativeModifier: number,
  ): RoomSnapshot =>
    ({
      ...(stateVersion !== undefined ? { stateVersion } : {}),
      characters: [
        {
          id: "char-1",
          name: "Fighter",
          type: "pc",
          hp: 10,
          maxHp: 10,
          ...(initiative !== undefined ? { initiative } : {}),
          initiativeModifier,
        },
      ],
    }) as unknown as RoomSnapshot;

  const mount = (snapshot: RoomSnapshot) =>
    renderHook(
      ({ snapshot }: { snapshot: RoomSnapshot }) => useInitiativeSetting({ snapshot, sendMessage }),
      { initialProps: { snapshot } },
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("confirms an entry EQUAL to the stored value once a newer frame carries it", () => {
    const { result, rerender } = mount(frame(5, 17, 0));

    act(() => result.current.setInitiative("char-1", 17, 0));
    expect(result.current.isSetting).toBe(true);

    rerender({ snapshot: frame(6, 17, 0) });

    expect(result.current.isSetting).toBe(false);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current.error).toBeNull();
  });

  it("does not take the frame it was sent from as the answer", () => {
    // Same version, same value: the server has not spoken yet. Confirming here
    // would close the modal before the request even left the socket.
    const { result, rerender } = mount(frame(5, 17, 0));

    act(() => result.current.setInitiative("char-1", 17, 0));
    rerender({ snapshot: frame(5, 17, 0) });

    expect(result.current.isSetting).toBe(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.error).toBe("Initiative update timed out. Please try again.");
  });

  it("a newer frame carrying a DIFFERENT number than asked is not the answer either", () => {
    // Another seat's write landing first must not be mistaken for ours. The
    // change road still confirms a clamped value, but only through the value
    // moving, which this frame's 17 → 17 does not.
    const { result, rerender } = mount(frame(5, 17, 0));

    act(() => result.current.setInitiative("char-1", 12, 0));
    rerender({ snapshot: frame(6, 17, 0) });

    expect(result.current.isSetting).toBe(true);
  });

  it("still confirms through a value change on an unversioned frame", () => {
    const { result, rerender } = mount(frame(undefined, 12, 0));

    act(() => result.current.setInitiative("char-1", 15, 2));
    rerender({ snapshot: frame(undefined, 15, 2) });

    expect(result.current.isSetting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("a second entry inside the first's five-second window is not reported as a timeout", () => {
    // The first entry's watchdog was never cleared: it fired during the
    // second's wait, saw `isSetting`, and reported a timeout over a save the
    // server applied (one pair in ~100 within the window).
    const { result, rerender } = mount(frame(5, 10, 0));
    act(() => result.current.setInitiative("char-1", 12, 0));
    rerender({ snapshot: frame(6, 12, 0) }); // confirmed at once
    expect(result.current.isSetting).toBe(false);
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    act(() => result.current.setInitiative("char-1", 14, 0));
    act(() => {
      vi.advanceTimersByTime(200); // the FIRST watchdog's moment passes
    });
    expect(result.current.isSetting).toBe(true);
    expect(result.current.error).toBeNull();
    rerender({ snapshot: frame(7, 14, 0) });
    expect(result.current.isSetting).toBe(false);
  });

  it("a new entry inside an UNANSWERED entry's window restarts the watchdog rather than inheriting it", () => {
    // The first request never got its frame (dropped, refused); the second
    // must get its own five seconds, not the tail of the first's.
    const { result } = mount(frame(5, 10, 0));
    act(() => result.current.setInitiative("char-1", 12, 0));
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    act(() => result.current.setInitiative("char-1", 14, 0));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.isSetting).toBe(true);
    expect(result.current.error).toBeNull();
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(result.current.isSetting).toBe(false);
    expect(result.current.error).toBe("Initiative update timed out. Please try again.");
  });

  it("confirms a clear of an already-clear initiative on a newer frame", () => {
    const { result, rerender } = mount(frame(5, undefined, 0));

    act(() => result.current.clearInitiative("char-1"));
    rerender({ snapshot: frame(6, undefined, 0) });

    expect(result.current.isSetting).toBe(false);
  });
});
