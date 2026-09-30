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
