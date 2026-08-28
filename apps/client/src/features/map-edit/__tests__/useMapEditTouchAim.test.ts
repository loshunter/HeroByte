/**
 * Aiming a click tool with a finger.
 *
 * The e2e (`mobile/mobile-map-edit-place.spec.ts`) proves the gesture end to
 * end — press aims, release drops, a second finger abandons. What it CANNOT
 * see is the ghost, and it turns out it cannot see `cancel` either: the gesture
 * router stops calling `commit` the moment a second finger lands, so a `cancel`
 * that forgot to clear the aimed point still passed every e2e assertion.
 * Measured, by sabotaging exactly that and watching the suite stay green.
 *
 * So the ghost's lifecycle is pinned here, where it is visible: the aim is what
 * decides whether a translucent footprint is left sitting on the map after the
 * finger has gone.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMapEditTouchAim } from "../useMapEditTouchAim";

const setup = (active = true) => {
  const updateCursor = vi.fn();
  const commit = vi.fn();
  const { result } = renderHook(() => useMapEditTouchAim({ active, updateCursor, commit }));
  return { result, updateCursor, commit };
};

describe("useMapEditTouchAim", () => {
  it("aims on press without dropping, and drops on release", () => {
    const { result, updateCursor, commit } = setup();

    result.current.start({ x: 10, y: 20 });
    expect(updateCursor).toHaveBeenCalledWith({ x: 10, y: 20 });
    // The whole design decision, in one assertion: a press is not a drop.
    expect(commit).not.toHaveBeenCalled();

    result.current.commit();
    expect(commit).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("drops at the LAST point slid to, not the first pressed", () => {
    const { result, commit } = setup();

    result.current.start({ x: 1, y: 1 });
    result.current.move({ x: 5, y: 5 });
    result.current.move({ x: 9, y: 9 });
    result.current.commit();

    expect(commit).toHaveBeenCalledWith({ x: 9, y: 9 });
    // Once, not once per point — sliding is aiming, not a stream.
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("keeps the last good point when a move lands off the document", () => {
    // A finger sliding past the edge and back is ONE gesture. Forgetting
    // mid-slide would make the release do nothing, for a reason the DM never
    // saw — the class of silent failure this mode is worst at.
    const { result, commit } = setup();

    result.current.start({ x: 4, y: 4 });
    result.current.move(null);
    result.current.commit();

    expect(commit).toHaveBeenCalledWith({ x: 4, y: 4 });
  });

  it("cancel clears the ghost AND the aim, so a later release drops nothing", () => {
    const { result, updateCursor, commit } = setup();

    result.current.start({ x: 7, y: 7 });
    updateCursor.mockClear();
    result.current.cancel();

    // The ghost goes: there is no finger to follow.
    expect(updateCursor).toHaveBeenCalledWith(null);
    // And the aim goes with it. Without this the pinch that abandoned the drop
    // would leave a live point behind, and the next release would fire it.
    result.current.commit();
    expect(commit).not.toHaveBeenCalled();
  });

  it("a release with nothing aimed drops nothing and still clears the ghost", () => {
    const { result, updateCursor, commit } = setup();

    result.current.commit();

    expect(commit).not.toHaveBeenCalled();
    expect(updateCursor).toHaveBeenCalledWith(null);
  });

  it("does nothing at all while the tool is not armed", () => {
    // `active` is map-edit AND a click sub-tool. A press that arrives with a
    // drag tool armed must not leave an aim behind for the click tool the DM
    // arms next.
    const { result, updateCursor, commit } = setup(false);

    result.current.start({ x: 3, y: 3 });
    expect(updateCursor).not.toHaveBeenCalled();

    result.current.commit();
    expect(commit).not.toHaveBeenCalled();
  });
});
