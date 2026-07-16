import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTurnChime } from "../useTurnChime";
import { sfxEngine } from "../sfxEngine";

beforeEach(() => {
  vi.spyOn(sfxEngine, "play").mockImplementation(() => {});
});

/** A snapshot naming this turn. `null` snapshot = not connected / socket dropped. */
type Props = { snap: { currentTurnCharacterId?: string } | null };
const at = (id?: string): Props => ({ snap: { currentTurnCharacterId: id } });
const NO_SNAPSHOT: Props = { snap: null };

function mount(initialProps: Props) {
  return renderHook(({ snap }) => useTurnChime(snap), { initialProps });
}

describe("useTurnChime", () => {
  it("does not chime on the first observation", () => {
    mount(at("char-1"));
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("chimes when the active combatant changes", () => {
    const { rerender } = mount(at("char-1"));
    rerender(at("char-2"));
    expect(sfxEngine.play).toHaveBeenCalledWith("turnAdvance");
  });

  it("does not chime when the turn is unchanged", () => {
    const { rerender } = mount(at("char-1"));
    rerender(at("char-1"));
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("stays silent when there is no active turn", () => {
    // Covers BOTH causes — combat ended, and a hidden/fogged NPC's turn that the
    // server withholds (toSnapshot). One case here on purpose: the hook cannot
    // tell them apart and must not try, since the point of withholding is that
    // the player learns nothing either way.
    const { rerender } = mount(at("char-1"));
    rerender(at(undefined));
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("still chimes for the next visible turn after an unresolvable one", () => {
    // THE LEAK'S AUDIBLE HALF, from the other side. The server withholds a
    // hidden NPC's turn, so "no turn" now arrives MID-combat. Swallowing the
    // chime for whoever acts next would itself be a tell — silence would mean
    // something unseen had just moved.
    const { rerender } = mount(at("char-1"));
    rerender(at(undefined)); // a hidden NPC's turn, withheld by the server
    rerender(at("char-2")); // the next player really is up

    expect(sfxEngine.play).toHaveBeenCalledOnce();
    expect(sfxEngine.play).toHaveBeenCalledWith("turnAdvance");
  });

  it("chimes when combat begins for an already-mounted client", () => {
    // Mounted with a snapshot in hand and no combat → the DM starts it. A real
    // turn change, so it sounds.
    const { rerender } = mount(at(undefined));
    rerender(at("char-1"));

    expect(sfxEngine.play).toHaveBeenCalledWith("turnAdvance");
  });

  it("stays silent joining a combat already in progress", () => {
    // REGRESSION GUARD. App mounts before the first snapshot lands, so the hook
    // sees a null snapshot first. If that armed the baseline, the first real
    // snapshot would chime for a turn that never advanced — you'd hear a chime
    // just for walking in on someone else's turn.
    const { rerender } = mount(NO_SNAPSHOT);
    rerender(at("char-1")); // first snapshot: the goblin was already acting

    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("stays silent across a reconnect that did not change the turn", () => {
    // REGRESSION GUARD, and the one that bites hardest: useWebSocket nulls the
    // snapshot on every socket drop while the app stays mounted (the gate keeps
    // children rendered behind a "Reconnecting…" banner). Recording that gap
    // fires a phantom "your turn" on every network blip.
    const { rerender } = mount(at("char-1"));
    rerender(NO_SNAPSHOT); // socket dropped, snapshot cleared
    rerender(at("char-1")); // re-authed; the goblin is still acting

    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("chimes across a reconnect if the turn really did advance", () => {
    // The other side of that guard: skipping the gap must not make us miss a
    // genuine change that happened while the socket was down.
    const { rerender } = mount(at("char-1"));
    rerender(NO_SNAPSHOT);
    rerender(at("char-2"));

    expect(sfxEngine.play).toHaveBeenCalledOnce();
  });

  it("takes the snapshot, so a null one cannot be confused with an empty turn", () => {
    // Guards the API SHAPE, which is the actual fix. The bug was a call site
    // passing `snapshot?.currentTurnCharacterId`, collapsing "no snapshot" and
    // "no turn" into one undefined. Owning the mapping means no caller can
    // reintroduce that — these two must not be the same observation.
    const { rerender } = mount(at("char-1"));
    rerender(NO_SNAPSHOT); // no information
    rerender(at(undefined)); // a real "nobody is acting"
    rerender(at("char-1")); // char-1 acts again

    // From the hook's view the turn went char-1 → (gap) → none → char-1, so the
    // last transition is a genuine change and sounds exactly once.
    expect(sfxEngine.play).toHaveBeenCalledOnce();
  });
});
