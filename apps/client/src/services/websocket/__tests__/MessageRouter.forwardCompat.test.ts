// ============================================================================
// MESSAGE ROUTER — forward compatibility with a newer server
// ============================================================================
// A tab keeps running its old JS until the player reloads, so after every
// deploy there is a window where an OLD client talks to a NEW server. The
// router's fallthrough used to assume anything it did not recognise was a room
// snapshot and apply it as one — so the first new message type the server
// learned to send blanked the whole table.
//
// That is not hypothetical: it happened with `state-sync`. A stale client
// applied the contentless `{t:"state-sync", stateVersion:N}` AS the room, every
// token/player/character became undefined, and nothing recovered — applySnapshot
// recorded the version, so the stream looked gapless and no resync fired.
//
// The invariant that makes the fix safe: a room snapshot is a BARE object (the
// server sends JSON.stringify(snapshot), no discriminator), while every
// ServerMessage carries `t`. So `t` present => not a snapshot, always.

import { describe, it, expect, vi } from "vitest";
import { MessageRouter } from "../MessageRouter";

function routerWith(onMessage = vi.fn()) {
  return { onMessage, router: new MessageRouter({ onMessage }) };
}

const SNAPSHOT = {
  users: [],
  tokens: [{ id: "t1", owner: "p1", x: 0, y: 0, color: "red" }],
  players: [{ uid: "p1", name: "P", isDM: false }],
  characters: [],
  pointers: [],
  drawings: [],
  gridSize: 50,
  diceRolls: [],
};

describe("MessageRouter — a message type this build predates", () => {
  it("ignores it instead of blanking the table", () => {
    // THE REGRESSION. Applying this as a snapshot is what emptied the map.
    const { onMessage, router } = routerWith();

    router.route(JSON.stringify({ t: "some-future-message", payload: 1 }));

    expect(onMessage).not.toHaveBeenCalled();
  });

  // NOTE: there is deliberately no `state-sync` test here, though state-sync is
  // what exposed the bug. This build handles it via the delta path, so routing
  // one exercises that branch and returns before the fallthrough — it would pass
  // with the guard removed and prove nothing. The bug belonged to builds that
  // PREDATE state-sync, and the only honest way to test that shape is with a
  // type this build genuinely does not know, which is what the tests here use.

  it("still delivers a real snapshot, which carries no `t`", () => {
    // A control: it passes with or without the guard, and exists to prove the
    // guard rejects by the presence of `t` rather than rejecting everything.
    const { onMessage, router } = routerWith();

    router.route(JSON.stringify(SNAPSHOT));

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0]![0].tokens).toHaveLength(1);
  });

  it("does not mistake a snapshot field for a message type", () => {
    // Also a control. `t` must be a STRING to count as a discriminator — a
    // snapshot that somehow carried a non-string `t` is still a snapshot.
    const { onMessage, router } = routerWith();

    router.route(JSON.stringify({ ...SNAPSHOT, t: 42 }));

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps ignoring unknown types without wedging the socket", () => {
    // An unknown message must not poison the connection: the next real snapshot
    // still lands. The original bug's worst property was that it never healed.
    const { onMessage, router } = routerWith();

    router.route(JSON.stringify({ t: "future-a" }));
    router.route(JSON.stringify({ t: "future-b" }));
    router.route(JSON.stringify(SNAPSHOT));

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0]![0].gridSize).toBe(50);
  });
});
