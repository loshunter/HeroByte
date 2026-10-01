/**
 * useDMElevation — how it learns that a request to become, or stop being, the DM has landed.
 *
 * The answer is the roster: the viewer's seat in the snapshot, and whether it carries the DM
 * flag. A socket close nulls the snapshot while the app stays mounted, and with no roster the
 * flag reads false — which is "not known", not "no longer the DM". Anything that reads a
 * request's outcome from that flag has to wait for the roster.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { useDMElevation } from "../useDMElevation.js";

const roster = (isDM: boolean) =>
  ({ players: [{ uid: "uid-1", isDM }] }) as unknown as RoomSnapshot;
const someoneElse = { players: [{ uid: "uid-2", isDM: true }] } as unknown as RoomSnapshot;

type Props = { snapshot: RoomSnapshot | null };

function start(initial: RoomSnapshot | null = roster(true)) {
  const send = vi.fn();
  const onRevoked = vi.fn();
  const view = renderHook(
    ({ snapshot }: Props) => useDMElevation({ snapshot, uid: "uid-1", send, onRevoked }),
    { initialProps: { snapshot: initial } as Props },
  );
  return { send, onRevoked, ...view };
}

describe("useDMElevation — the seat", () => {
  it("is known once the roster lists it, and not before: no snapshot, or someone else's roster", () => {
    const { result, rerender } = start(null);
    expect(result.current.seatKnown).toBe(false);
    rerender({ snapshot: someoneElse });
    expect(result.current.seatKnown).toBe(false);
    rerender({ snapshot: roster(false) });
    expect(result.current.seatKnown).toBe(true);
  });
});

describe("useDMElevation — leaving DM mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is confirmed by the roster listing the seat as no DM, and says so once", () => {
    const { result, rerender, send, onRevoked } = start();
    act(() => result.current.revoke());
    expect(send).toHaveBeenCalledExactlyOnceWith({ t: "revoke-dm" });
    expect(result.current.isRevoking).toBe(true);

    rerender({ snapshot: roster(false) });

    expect(result.current.isRevoking).toBe(false);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it("is not confirmed by a reconnect blip: no roster is not 'no longer the DM'", () => {
    const { result, rerender, onRevoked } = start();
    act(() => result.current.revoke());

    rerender({ snapshot: null });

    expect(result.current.isRevoking).toBe(true);
    expect(onRevoked).not.toHaveBeenCalled();
  });

  it("is confirmed by the roster that comes back after the blip, when the server did hear it", () => {
    // Only the server's answer was lost with the socket.
    const { result, rerender, onRevoked } = start();
    act(() => result.current.revoke());
    rerender({ snapshot: null });

    rerender({ snapshot: roster(false) });

    expect(result.current.isRevoking).toBe(false);
    expect(onRevoked).toHaveBeenCalledTimes(1);
  });

  it("times out, still the DM, when the server never heard it", () => {
    // The socket died under the confirm: the roster that returns still lists the seat as the DM.
    const { result, rerender, onRevoked } = start();
    act(() => result.current.revoke());
    rerender({ snapshot: null });
    rerender({ snapshot: roster(true) });
    expect(result.current.isRevoking).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isRevoking).toBe(false);
    expect(result.current.error).toBe("Revocation request timed out. Please try again.");
    expect(result.current.currentIsDM).toBe(true);
    expect(onRevoked).not.toHaveBeenCalled();
  });

  // A leave the dying socket queued is sent when it reconnects: the server hears it long after the
  // five seconds, and the roster says so then. The person asked to leave, and is told they have.
  describe("answered after its five seconds", () => {
    const timedOut = () => {
      const view = start();
      act(() => view.result.current.revoke());
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(view.result.current.error).toBe("Revocation request timed out. Please try again.");
      return view;
    };

    it("is still confirmed by the roster, once, and the stale timeout goes", () => {
      const { result, rerender, onRevoked } = timedOut();
      act(() => {
        vi.advanceTimersByTime(20_000);
      });

      rerender({ snapshot: roster(false) });

      expect(onRevoked).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
    });

    it("is not waited for beyond a minute: a demotion an hour later is something else", () => {
      const { rerender, onRevoked } = timedOut();
      act(() => {
        vi.advanceTimersByTime(56_001);
      });

      rerender({ snapshot: roster(false) });

      expect(onRevoked).not.toHaveBeenCalled();
    });

    it.each([
      ["Enter DM mode", (hook: ReturnType<typeof useDMElevation>) => hook.elevate("a password")],
      [
        "setting the DM password",
        (hook: ReturnType<typeof useDMElevation>) => hook.bootstrap("a long enough password"),
      ],
    ])("is withdrawn by %s", (_what, ask) => {
      const { result, rerender, onRevoked } = timedOut();
      act(() => ask(result.current));

      // The server never demoted the seat; a restart does, a while later.
      rerender({ snapshot: roster(true) });
      rerender({ snapshot: roster(false) });

      expect(onRevoked).not.toHaveBeenCalled();
    });

    it("is answered once: a restart that demotes the seat later says nothing", () => {
      const { result, rerender, onRevoked } = start();
      act(() => result.current.revoke());
      rerender({ snapshot: roster(false) });
      expect(onRevoked).toHaveBeenCalledTimes(1);

      // Elected again, then a restart clears the elevation: nobody asked to leave this time.
      rerender({ snapshot: roster(true) });
      rerender({ snapshot: roster(false) });

      expect(onRevoked).toHaveBeenCalledTimes(1);
    });
  });
});

describe("useDMElevation — becoming the DM", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is confirmed by the roster, including one that first arrives after a mount during a blip", () => {
    const { result, rerender } = start(null);
    act(() => result.current.elevate("a password"));
    expect(result.current.isElevating).toBe(true);

    rerender({ snapshot: roster(false) });
    expect(result.current.isElevating).toBe(true);

    rerender({ snapshot: roster(true) });
    expect(result.current.isElevating).toBe(false);
  });
});

describe("useDMElevation — one request, one timer", () => {
  // A request that is not answered ends, with an error, five seconds on. That timer must belong
  // to its request: an earlier one's must not end a later request early (a DM who left, came back
  // and left again was told the second leave "timed out" at the first one's mark), and one that has
  // been answered must leave nothing running.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves no timer running once the roster has answered", () => {
    const { result, rerender } = start();
    act(() => result.current.revoke());
    expect(vi.getTimerCount()).toBe(1);

    rerender({ snapshot: roster(false) });

    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves none running after an elevation is answered either", () => {
    const { result, rerender } = start(roster(false));
    act(() => result.current.elevate("a password"));
    expect(vi.getTimerCount()).toBe(1);

    rerender({ snapshot: roster(true) });

    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not let an earlier request's timer end a later one early", () => {
    const { result, rerender } = start();
    act(() => result.current.revoke());
    rerender({ snapshot: roster(false) }); // answered at once...
    rerender({ snapshot: roster(true) }); // ...and the person is the DM again
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.revoke()); // a second leave, at t = 1 s

    act(() => {
      vi.advanceTimersByTime(4000); // t = 5 s: where the FIRST request's timer would have fired
    });
    expect(result.current.isRevoking).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000); // t = 6 s: the second one's own
    });
    expect(result.current.isRevoking).toBe(false);
    expect(result.current.error).toBe("Revocation request timed out. Please try again.");
  });

  it("gives a second request, made while the first is still unanswered, its own full window", () => {
    const { result } = start();
    act(() => result.current.revoke());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.revoke()); // a double confirm, or a retry on an impatient click

    act(() => {
      vi.advanceTimersByTime(4500); // t = 5.5 s: past the first request's mark, inside the second's
    });
    expect(result.current.isRevoking).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000); // t = 6.5 s: past the second's
    });
    expect(result.current.isRevoking).toBe(false);
    expect(result.current.error).toBe("Revocation request timed out. Please try again.");
  });

  it("leaves none running when the server refuses an elevation", () => {
    const { result } = start(roster(false));
    act(() => result.current.elevate("a password"));
    expect(vi.getTimerCount()).toBe(1);

    act(() => result.current.notifyElevationFailed("Invalid DM password"));

    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.error).toBe("Invalid DM password");
    expect(result.current.isElevating).toBe(false);
  });

  it("leaves none running when the person goes away", () => {
    const { result, unmount } = start();
    act(() => result.current.revoke());
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the error on request, so a new dialog does not open already showing the last one's", () => {
    const { result, rerender } = start();
    act(() => result.current.revoke());
    rerender({ snapshot: roster(true) });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.error).toBe("Revocation request timed out. Please try again.");

    act(() => result.current.clearError());

    expect(result.current.error).toBeNull();
  });
});
