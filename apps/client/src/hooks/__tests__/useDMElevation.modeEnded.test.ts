// DM mode can end without anyone asking: a server restart (every deploy) clears every
// elevation, and the roster comes back listing the seat as a player. The DM's tools simply
// vanished, with no word of why (pre-merge live evaluation). The hook now says it once —
// and only for that: a leave the DM asked for has its own message (onRevoked). The client
// cannot tell a restart from a reconnect whose session token ran out (both demote), so the
// words name both.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { useDMElevation } from "../useDMElevation.js";
import { DM_MODE_ENDED_MESSAGE } from "../useDMManagement.js";

const roster = (isDM: boolean) =>
  ({ players: [{ uid: "uid-1", isDM }] }) as unknown as RoomSnapshot;

type Props = { snapshot: RoomSnapshot | null };

function start(initial: RoomSnapshot | null) {
  const onRevoked = vi.fn();
  const onDMModeEnded = vi.fn();
  const view = renderHook(
    ({ snapshot }: Props) =>
      useDMElevation({ snapshot, uid: "uid-1", send: vi.fn(), onRevoked, onDMModeEnded }),
    { initialProps: { snapshot: initial } as Props },
  );
  return { onRevoked, onDMModeEnded, ...view };
}

describe("useDMElevation — DM mode ended without a request", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("says so once when a restart's roster lists the DM as a player", () => {
    const { rerender, onRevoked, onDMModeEnded } = start(roster(true));
    rerender({ snapshot: null }); // the socket drops with the restart
    rerender({ snapshot: roster(false) }); // and the roster comes back without DM
    expect(onDMModeEnded).toHaveBeenCalledTimes(1);
    expect(onRevoked).not.toHaveBeenCalled();

    rerender({ snapshot: roster(false) });
    expect(onDMModeEnded).toHaveBeenCalledTimes(1);
  });

  it("says nothing extra for a leave the DM asked for", () => {
    const { result, rerender, onRevoked, onDMModeEnded } = start(roster(true));
    act(() => result.current.revoke());
    rerender({ snapshot: roster(false) });
    expect(onRevoked).toHaveBeenCalledTimes(1);
    expect(onDMModeEnded).not.toHaveBeenCalled();
  });

  it("says nothing extra for a leave whose answer arrives late", () => {
    const { result, rerender, onRevoked, onDMModeEnded } = start(roster(true));
    act(() => result.current.revoke());
    act(() => vi.advanceTimersByTime(6_000)); // the request's five seconds run out
    rerender({ snapshot: roster(false) });
    expect(onRevoked).toHaveBeenCalledTimes(1);
    expect(onDMModeEnded).not.toHaveBeenCalled();
  });

  it("says nothing to someone who was never the DM, or for a blip", () => {
    const player = start(roster(false));
    player.rerender({ snapshot: null });
    player.rerender({ snapshot: roster(false) });
    expect(player.onDMModeEnded).not.toHaveBeenCalled();

    const dm = start(roster(true));
    dm.rerender({ snapshot: null });
    dm.rerender({ snapshot: roster(true) });
    expect(dm.onDMModeEnded).not.toHaveBeenCalled();
  });

  it("treats a leave answered more than a minute late as not asked", () => {
    const { result, rerender, onRevoked, onDMModeEnded } = start(roster(true));
    act(() => result.current.revoke());
    act(() => vi.advanceTimersByTime(61_000)); // past LATE_ANSWER_MS
    rerender({ snapshot: roster(false) });
    expect(onRevoked).not.toHaveBeenCalled();
    expect(onDMModeEnded).toHaveBeenCalledTimes(1);
  });

  it("names both causes, never the restart alone", () => {
    expect(DM_MODE_ENDED_MESSAGE).toBe(
      "DM mode ended: the server restarted or your session expired. Enter DM mode again to run the game.",
    );
  });
});
