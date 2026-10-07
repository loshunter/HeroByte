// VoiceMesh: who this browser holds a voice connection with. The pair rule (only the
// LOWER uid places the call), answering any offer, calling again after a lost
// connection, keeping an early answer, hanging up on leave and stop, ignoring a
// replaced connection, the per-person link states, the hello that asks a caller to call
// again, a browser that cannot create a connection, the grace before someone who left
// the roster is dropped, and resync after a reconnect. No WebRTC: fake peers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Instance as Peer, SignalData } from "simple-peer";
import { VoiceMesh, type VoiceLink, type VoiceMeshOptions } from "../VoiceMesh";

type Handler = (...args: unknown[]) => void;

class FakePeer {
  handlers = new Map<string, Handler[]>();
  signals: SignalData[] = [];
  destroyed = false;
  constructor(
    readonly initiator: boolean,
    readonly owner: string,
  ) {}
  on(event: string, handler: Handler) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }
  signal(data: SignalData) {
    this.signals.push(data);
  }
  destroy() {
    this.destroyed = true;
  }
  emit(event: string, ...args: unknown[]) {
    (this.handlers.get(event) ?? []).forEach((handler) => handler(...args));
  }
}

const STREAM = { id: "local" } as unknown as MediaStream;
const OFFER = { type: "offer", sdp: "o" } as SignalData;
const ANSWER = { type: "answer", sdp: "a" } as SignalData;

interface Harness {
  mesh: VoiceMesh;
  peers: FakePeer[];
  sendSignal: ReturnType<typeof vi.fn>;
  onStream: ReturnType<typeof vi.fn>;
  onStreamGone: ReturnType<typeof vi.fn>;
  onLinksChange: ReturnType<typeof vi.fn>;
  links: () => Record<string, VoiceLink>;
  live: () => FakePeer[];
}

function harness(selfUid: string, extra: Partial<VoiceMeshOptions> = {}): Harness {
  const peers: FakePeer[] = [];
  const sendSignal = vi.fn();
  const onStream = vi.fn();
  const onStreamGone = vi.fn();
  const onLinksChange = vi.fn();
  const mesh = new VoiceMesh({
    selfUid,
    createPeer: (initiator) => {
      const peer = new FakePeer(initiator, selfUid);
      peers.push(peer);
      return peer as unknown as Peer;
    },
    sendSignal,
    onStream,
    onStreamGone,
    onLinksChange,
    retryMs: 1000,
    connectTimeoutMs: 15000,
    failingAfterMs: 10000,
    // Off by default so the tests about something else see a hang-up at once;
    // the grace has its own describe below.
    leaveGraceMs: 0,
    ...extra,
  });
  return {
    mesh,
    peers,
    sendSignal,
    onStream,
    onStreamGone,
    onLinksChange,
    links: () => onLinksChange.mock.calls.at(-1)?.[0] ?? {},
    live: () => peers.filter((peer) => !peer.destroyed),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the pair rule", () => {
  it("the LOWER uid places the call to someone in the roster", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a", "b"]);
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].initiator).toBe(true);
  });

  it("the HIGHER uid places no call and waits for the offer", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a", "b"]);
    expect(h.peers).toHaveLength(0);
  });

  it("never calls itself (its own uid in the roster is ignored)", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a"]);
    expect(h.peers).toHaveLength(0);
    expect(h.links()).toEqual({});
  });

  it("places no call before start, then calls the roster on start", () => {
    const h = harness("a");
    h.mesh.setRoster(["b"]);
    expect(h.peers).toHaveLength(0);
    h.mesh.start(STREAM);
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].initiator).toBe(true);
  });
});

describe("signals", () => {
  it("an incoming offer opens a fresh ANSWERING peer and hands it the offer", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a"]);
    h.mesh.handleSignal("a", OFFER);
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].initiator).toBe(false);
    expect(h.peers[0].signals).toEqual([OFFER]);
  });

  it("a second offer replaces the first answering peer (the old one is destroyed)", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a"]);
    h.mesh.handleSignal("a", OFFER);
    h.mesh.handleSignal("a", OFFER);
    expect(h.peers).toHaveLength(2);
    expect(h.peers[0].destroyed).toBe(true);
    expect(h.peers[1].destroyed).toBe(false);
    expect(h.peers[1].signals).toEqual([OFFER]);
  });

  it("an offer from a HIGHER uid (an old client) is answered too, replacing this side's own call", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    expect(h.peers[0].initiator).toBe(true);
    h.mesh.handleSignal("b", OFFER);
    expect(h.peers[0].destroyed).toBe(true);
    expect(h.peers[1].initiator).toBe(false);
    expect(h.peers[1].signals).toEqual([OFFER]);
  });

  it("a non-offer signal goes to the existing peer; with no peer it is ignored", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.handleSignal("b", ANSWER);
    expect(h.peers).toHaveLength(0);
    h.mesh.setRoster(["b"]);
    h.mesh.handleSignal("b", ANSWER);
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].signals).toEqual([ANSWER]);
  });

  it("a peer's own signals are relayed to the other player; its stream is reported", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    h.peers[0].emit("signal", OFFER);
    expect(h.sendSignal).toHaveBeenCalledWith("b", OFFER);
    const remote = { id: "remote" } as unknown as MediaStream;
    h.peers[0].emit("stream", remote);
    expect(h.onStream).toHaveBeenCalledWith("b", remote);
  });
});

describe("calling again", () => {
  it.each(["error", "close"])(
    "after a connection %s, the caller calls again after retryMs",
    (event) => {
      const h = harness("a");
      h.mesh.start(STREAM);
      h.mesh.setRoster(["b"]);
      h.peers[0].emit(event, new Error("x"));
      expect(h.peers[0].destroyed).toBe(true);
      expect(h.onStreamGone).toHaveBeenCalledWith("b");
      vi.advanceTimersByTime(999);
      expect(h.peers).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(h.peers).toHaveLength(2);
      expect(h.peers[1].initiator).toBe(true);
    },
  );

  it("a call not connected within connectTimeoutMs is abandoned and placed again", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    vi.advanceTimersByTime(14999);
    expect(h.peers[0].destroyed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(h.peers[0].destroyed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(h.peers).toHaveLength(2);
    expect(h.peers[1].destroyed).toBe(false);
  });

  it("a connected call is not timed out", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    h.peers[0].emit("connect");
    vi.advanceTimersByTime(60000);
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].destroyed).toBe(false);
  });

  it("does not call again once the other player has left the call", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    h.peers[0].emit("close");
    h.mesh.setRoster([]);
    vi.advanceTimersByTime(5000);
    expect(h.peers).toHaveLength(1);
  });

  it("the answering side never places a call after its connection drops", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a"]);
    h.mesh.handleSignal("a", OFFER);
    h.peers[0].emit("close");
    vi.advanceTimersByTime(5000);
    expect(h.peers).toHaveLength(1);
  });
});

describe("an offer that outruns the roster", () => {
  it("keeps the answering peer for a caller not yet in the roster", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.setRoster([]);
    h.mesh.handleSignal("a", OFFER);
    h.mesh.setRoster(["c"]);
    expect(h.peers[0].destroyed).toBe(false);
    h.mesh.setRoster(["a", "c"]);
    expect(h.peers[0].destroyed).toBe(false);
  });

  it("drops it at the connect timeout if the caller never appears", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.handleSignal("a", OFFER);
    vi.advanceTimersByTime(14999);
    expect(h.peers[0].destroyed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(h.peers[0].destroyed).toBe(true);
  });

  it("drops it, once connected, at the next roster that still lacks the caller", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.handleSignal("a", OFFER);
    h.peers[0].emit("connect");
    h.mesh.setRoster([]);
    expect(h.peers[0].destroyed).toBe(true);
  });
});

describe("leaving and stopping", () => {
  it("someone leaving the roster is hung up on (peer destroyed, stream gone)", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b", "c"]);
    h.peers.forEach((peer) => peer.emit("connect"));
    h.mesh.setRoster(["c"]);
    expect(h.peers[0].destroyed).toBe(true);
    expect(h.peers[1].destroyed).toBe(false);
    expect(h.onStreamGone).toHaveBeenCalledWith("b");
    expect(h.links()).toEqual({ c: "connected" });
  });

  it("stop destroys every peer, reports no links, and ignores later signals", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b", "c"]);
    h.mesh.stop();
    expect(h.peers.every((peer) => peer.destroyed)).toBe(true);
    expect(h.links()).toEqual({});
    h.mesh.handleSignal("b", OFFER);
    h.mesh.setRoster(["b", "c", "d"]);
    vi.advanceTimersByTime(60000);
    expect(h.peers).toHaveLength(2);
  });

  it("stop cancels a pending call-again", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    h.peers[0].emit("close");
    h.mesh.stop();
    vi.advanceTimersByTime(5000);
    expect(h.peers).toHaveLength(1);
  });

  it("signals arriving before start are ignored", () => {
    const h = harness("b");
    h.mesh.handleSignal("a", OFFER);
    expect(h.peers).toHaveLength(0);
  });
});

// Someone missing from the roster is hung up on only after leaveGraceMs, so a player
// flicking out and back in (a reconnect) costs no connection torn down and rebuilt.
describe("the leave grace", () => {
  const connectedPair = (extra: Partial<VoiceMeshOptions> = { leaveGraceMs: 1000 }) => {
    const h = harness("a", extra);
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    h.peers[0].emit("connect");
    return h;
  };

  it("defaults to five seconds", () => {
    const h = connectedPair({ leaveGraceMs: undefined });
    h.mesh.setRoster([]);
    vi.advanceTimersByTime(4999);
    expect(h.peers[0].destroyed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(h.peers[0].destroyed).toBe(true);
  });

  it("drops the peer only after the grace: kept at 999 ms, gone at 1000 ms (stream gone, link gone)", () => {
    const h = connectedPair();
    h.mesh.setRoster([]);
    vi.advanceTimersByTime(999);
    expect(h.peers[0].destroyed).toBe(false);
    expect(h.onStreamGone).not.toHaveBeenCalled();
    expect(h.links()).toEqual({});
    vi.advanceTimersByTime(1);
    expect(h.peers[0].destroyed).toBe(true);
    expect(h.onStreamGone).toHaveBeenCalledWith("b");
    expect(h.links()).toEqual({});
  });

  it("a grace of 0 hangs up at once", () => {
    const h = connectedPair({ leaveGraceMs: 0 });
    h.mesh.setRoster([]);
    expect(h.peers[0].destroyed).toBe(true);
  });

  it("someone back at 999 ms keeps the SAME connection: no new peer, nothing destroyed", () => {
    const h = connectedPair();
    const first = h.peers[0];
    h.mesh.setRoster([]);
    vi.advanceTimersByTime(999);
    h.mesh.setRoster(["b"]);
    vi.advanceTimersByTime(10000);
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0]).toBe(first);
    expect(first.destroyed).toBe(false);
    expect(h.onStreamGone).not.toHaveBeenCalled();
    expect(h.links()).toEqual({ b: "connected" });
  });

  it("coming back restarts the grace in full the next time they leave (no stale timer)", () => {
    const h = connectedPair();
    h.mesh.setRoster([]);
    vi.advanceTimersByTime(999);
    h.mesh.setRoster(["b"]);
    h.mesh.setRoster([]);
    vi.advanceTimersByTime(999);
    expect(h.peers[0].destroyed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(h.peers[0].destroyed).toBe(true);
  });

  it("a roster that still lacks them does not push the drop back", () => {
    const h = connectedPair();
    h.mesh.setRoster([]);
    vi.advanceTimersByTime(600);
    const timers = vi.getTimerCount();
    h.mesh.setRoster(["c"]);
    // c is called (one connect timeout) but b is not given a second grace timer.
    expect(vi.getTimerCount()).toBe(timers + 1);
    vi.advanceTimersByTime(400);
    expect(h.peers[0].destroyed).toBe(true);
  });

  it("a uid flapping out and in every 17 ms causes no new peer and no destroy", () => {
    const h = connectedPair();
    // Three seconds, so a timer that was never cleared on a return would have fired.
    for (let tick = 0; tick < 176; tick += 1) {
      h.mesh.setRoster(tick % 2 === 0 ? [] : ["b"]);
      vi.advanceTimersByTime(17);
    }
    h.mesh.setRoster(["b"]);
    vi.advanceTimersByTime(500);
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].destroyed).toBe(false);
    expect(h.onStreamGone).not.toHaveBeenCalled();
  });

  it("an unconnected answering peer for someone not listed gets no grace timer", () => {
    const h = harness("b", { leaveGraceMs: 1000 });
    h.mesh.start(STREAM);
    h.mesh.handleSignal("a", OFFER);
    h.mesh.setRoster([]);
    vi.advanceTimersByTime(5000);
    // Still answering, unconnected: only the connect timeout settles it.
    expect(h.peers[0].destroyed).toBe(false);
  });

  it("stop clears a pending grace timer", () => {
    const h = connectedPair();
    h.mesh.setRoster([]);
    h.mesh.stop();
    expect(h.peers[0].destroyed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a connection that closes during the grace clears its timer", () => {
    const h = connectedPair();
    h.mesh.setRoster([]);
    const withGrace = vi.getTimerCount();
    h.peers[0].emit("close");
    // The grace timer and the connect timeout are gone; the links interval stays.
    expect(vi.getTimerCount()).toBeLessThan(withGrace);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("a connection replaced during the grace (a hello) is not dropped by the old timer", () => {
    const h = connectedPair();
    h.mesh.setRoster([]);
    h.mesh.handleSignal("b", { type: "hello" } as unknown as SignalData);
    expect(h.peers).toHaveLength(2);
    expect(h.peers[0].destroyed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(h.peers[1].destroyed).toBe(false);
  });
});

// Back after a reconnect: calls made while offline lost their signals, so they start over.
describe("resync", () => {
  it("drops the peers that are not connected, keeps the connected, and calls again at once", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b", "c", "d"]);
    const [b, , d] = h.peers;
    b.emit("connect");
    h.onStreamGone.mockClear();
    h.mesh.resync();
    expect(b.destroyed).toBe(false);
    expect(d.destroyed).toBe(true);
    expect(h.onStreamGone).not.toHaveBeenCalledWith("b");
    expect(h.onStreamGone).toHaveBeenCalledWith("d");
    // c and d were still connecting: each is called again now, as an initiator.
    expect(h.peers).toHaveLength(5);
    expect(h.peers.slice(3).every((peer) => peer.initiator && !peer.destroyed)).toBe(true);
    expect(h.live()).toHaveLength(3);
    expect(h.links()).toEqual({ b: "connected", c: "connecting", d: "connecting" });
  });

  it("clears a pending call-again, so that person is called at once, not after retryMs", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    h.peers[0].emit("close");
    expect(h.peers).toHaveLength(1);
    h.mesh.resync();
    expect(h.peers).toHaveLength(2);
    expect(h.peers[1].initiator).toBe(true);
    // The old retry must not fire a second call later.
    vi.advanceTimersByTime(5000);
    expect(h.peers).toHaveLength(2);
    expect(h.peers[1].destroyed).toBe(false);
  });

  it("drops an unconnected answering peer too; the caller calls again on a hello or offer", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a"]);
    h.mesh.handleSignal("a", OFFER);
    h.mesh.resync();
    expect(h.peers[0].destroyed).toBe(true);
    expect(h.live()).toHaveLength(0);
  });

  it("is a no-op when stopped: nothing is called, announced or reported", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    h.mesh.stop();
    const reports = h.onLinksChange.mock.calls.length;
    h.mesh.resync();
    vi.advanceTimersByTime(5000);
    expect(h.peers).toHaveLength(1);
    expect(h.sendSignal).not.toHaveBeenCalled();
    expect(h.onLinksChange.mock.calls.length).toBe(reports);
    const fresh = harness("a");
    fresh.mesh.setRoster(["b"]);
    fresh.mesh.resync();
    expect(fresh.peers).toHaveLength(0);
  });
});

describe("a replaced connection", () => {
  it("ignores every event from the peer an offer replaced", () => {
    const h = harness("b");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a"]);
    h.mesh.handleSignal("a", OFFER);
    h.mesh.handleSignal("a", OFFER);
    const [old, current] = h.peers;
    h.sendSignal.mockClear();
    h.onStream.mockClear();
    h.onStreamGone.mockClear();
    old.emit("signal", ANSWER);
    old.emit("stream", { id: "stale" });
    old.emit("connect");
    expect(h.sendSignal).not.toHaveBeenCalled();
    expect(h.onStream).not.toHaveBeenCalled();
    expect(h.links()).toEqual({ a: "connecting" });
    old.emit("error", new Error("late"));
    old.emit("close");
    expect(current.destroyed).toBe(false);
    expect(h.onStreamGone).not.toHaveBeenCalled();
    current.emit("signal", ANSWER);
    expect(h.sendSignal).toHaveBeenCalledWith("a", ANSWER);
  });
});

describe("link states", () => {
  it("connecting, then failing after failingAfterMs, then connected", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    expect(h.links()).toEqual({ b: "connecting" });
    vi.advanceTimersByTime(9000);
    expect(h.links()).toEqual({ b: "connecting" });
    vi.advanceTimersByTime(1000);
    expect(h.links()).toEqual({ b: "failing" });
    h.peers[0].emit("connect");
    expect(h.links()).toEqual({ b: "connected" });
  });

  it("a drop restarts the clock: connecting again, failing only failingAfterMs after the drop", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    h.peers[0].emit("connect");
    vi.advanceTimersByTime(20000);
    h.peers[0].emit("close");
    expect(h.links()).toEqual({ b: "connecting" });
    vi.advanceTimersByTime(9000);
    expect(h.links()).toEqual({ b: "connecting" });
    vi.advanceTimersByTime(1000);
    expect(h.links()).toEqual({ b: "failing" });
  });

  it("reports only when the map changes", () => {
    const h = harness("a");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["b"]);
    const calls = h.onLinksChange.mock.calls.length;
    h.mesh.setRoster(["b"]);
    vi.advanceTimersByTime(5000);
    expect(h.onLinksChange.mock.calls.length).toBe(calls);
    vi.advanceTimersByTime(5000);
    expect(h.onLinksChange.mock.calls.length).toBe(calls + 1);
    vi.advanceTimersByTime(4000);
    expect(h.onLinksChange.mock.calls.length).toBe(calls + 1);
  });
});

// Not a WebRTC signal: "I am (back) in the call, call me". Sent to the lower uids (who
// are the callers of the pair) and never handed to simple-peer, which would destroy
// itself on data it does not know.
describe("hello", () => {
  const HELLO = { type: "hello" } as unknown as SignalData;

  describe("announce", () => {
    it("says hello to roster members with a LOWER uid only (the ones who call this player)", () => {
      const h = harness("m");
      h.mesh.start(STREAM);
      h.mesh.setRoster(["a", "c", "z", "m"]);
      h.mesh.announce();
      expect(h.sendSignal.mock.calls).toEqual([
        ["a", HELLO],
        ["c", HELLO],
      ]);
    });

    it("says nothing to a roster of higher uids only", () => {
      const h = harness("a");
      h.mesh.start(STREAM);
      h.mesh.setRoster(["b", "c"]);
      h.mesh.announce();
      expect(h.sendSignal).not.toHaveBeenCalled();
    });

    it("says nothing before start or after stop", () => {
      const h = harness("m");
      h.mesh.setRoster(["a"]);
      h.mesh.announce();
      expect(h.sendSignal).not.toHaveBeenCalled();
      h.mesh.start(STREAM);
      h.mesh.announce();
      expect(h.sendSignal).toHaveBeenCalledTimes(1);
      h.mesh.stop();
      h.mesh.announce();
      expect(h.sendSignal).toHaveBeenCalledTimes(1);
    });
  });

  describe("receiving one", () => {
    it("from someone this player calls, with no connection yet: opens an initiator peer", () => {
      const h = harness("a");
      h.mesh.start(STREAM);
      h.mesh.handleSignal("b", HELLO);
      expect(h.peers).toHaveLength(1);
      expect(h.peers[0].initiator).toBe(true);
    });

    it("from someone this player calls, with a CONNECTED peer (maybe a dead tab): replaces it", () => {
      const h = harness("a");
      h.mesh.start(STREAM);
      h.mesh.setRoster(["b"]);
      h.peers[0].emit("connect");
      h.mesh.handleSignal("b", HELLO);
      expect(h.peers).toHaveLength(2);
      expect(h.peers[0].destroyed).toBe(true);
      expect(h.onStreamGone).toHaveBeenCalledWith("b");
      expect(h.peers[1].initiator).toBe(true);
      expect(h.peers[1].destroyed).toBe(false);
      expect(h.links()).toEqual({ b: "connecting" });
    });

    it("from someone this player calls, with a call still CONNECTING: leaves it alone", () => {
      const h = harness("a");
      h.mesh.start(STREAM);
      h.mesh.setRoster(["b"]);
      const first = h.peers[0];
      h.mesh.handleSignal("b", HELLO);
      expect(h.peers).toHaveLength(1);
      expect(h.peers[0]).toBe(first);
      expect(first.destroyed).toBe(false);
    });

    describe("against a call placed moments ago", () => {
      const placedAtZero = () => {
        const h = harness("a");
        h.mesh.start(STREAM);
        h.mesh.setRoster(["b"]);
        return h;
      };

      it("a NOT-connected call opened under 2000 ms ago is kept", () => {
        const h = placedAtZero();
        const first = h.peers[0];
        vi.advanceTimersByTime(1999);
        h.mesh.handleSignal("b", HELLO);
        expect(h.peers).toHaveLength(1);
        expect(first.destroyed).toBe(false);
        expect(h.onStreamGone).not.toHaveBeenCalled();
      });

      it("a NOT-connected call opened 2000 ms ago or more is replaced", () => {
        const h = placedAtZero();
        const first = h.peers[0];
        vi.advanceTimersByTime(2000);
        h.mesh.handleSignal("b", HELLO);
        expect(h.peers).toHaveLength(2);
        expect(first.destroyed).toBe(true);
        expect(h.peers[1].initiator).toBe(true);
        expect(h.peers[1].destroyed).toBe(false);
      });

      it("a half-made call that is much older is replaced too", () => {
        const h = placedAtZero();
        vi.advanceTimersByTime(9000);
        h.mesh.handleSignal("b", HELLO);
        expect(h.peers).toHaveLength(2);
        expect(h.peers[0].destroyed).toBe(true);
      });

      it("a CONNECTED call is replaced even when it was opened a moment ago", () => {
        const h = placedAtZero();
        const first = h.peers[0];
        vi.advanceTimersByTime(100);
        first.emit("connect");
        h.mesh.handleSignal("b", HELLO);
        expect(h.peers).toHaveLength(2);
        expect(first.destroyed).toBe(true);
        expect(h.peers[1].destroyed).toBe(false);
      });

      it("the age counts from when the call was opened, not from the roster", () => {
        const h = placedAtZero();
        vi.advanceTimersByTime(2500);
        h.mesh.handleSignal("b", HELLO); // replaced: opened again at 2500
        vi.advanceTimersByTime(1000);
        h.mesh.handleSignal("b", HELLO); // the new call is 1000 ms old: kept
        expect(h.peers).toHaveLength(2);
        expect(h.peers[1].destroyed).toBe(false);
      });
    });

    it("from someone who calls THIS player (a lower uid): ignored, nothing opens", () => {
      const h = harness("b");
      h.mesh.start(STREAM);
      h.mesh.setRoster(["a"]);
      h.mesh.handleSignal("a", HELLO);
      expect(h.peers).toHaveLength(0);
      expect(h.sendSignal).not.toHaveBeenCalled();
    });

    it("from a lower uid with an answering peer already up: that peer is untouched", () => {
      const h = harness("b");
      h.mesh.start(STREAM);
      h.mesh.setRoster(["a"]);
      h.mesh.handleSignal("a", OFFER);
      h.peers[0].emit("connect");
      h.mesh.handleSignal("a", HELLO);
      expect(h.peers).toHaveLength(1);
      expect(h.peers[0].destroyed).toBe(false);
    });

    it("never reaches simple-peer, whichever way it is handled", () => {
      const h = harness("a");
      h.mesh.start(STREAM);
      h.mesh.handleSignal("b", HELLO); // opens
      h.mesh.handleSignal("b", HELLO); // connecting: left alone
      h.peers[h.peers.length - 1].emit("connect");
      h.mesh.handleSignal("b", HELLO); // connected: replaced
      h.mesh.handleSignal("c", HELLO);
      expect(h.peers.length).toBeGreaterThan(2);
      expect(h.peers.every((peer) => peer.signals.length === 0)).toBe(true);
      const answerer = harness("b");
      answerer.mesh.start(STREAM);
      answerer.mesh.handleSignal("a", OFFER);
      answerer.mesh.handleSignal("a", HELLO);
      expect(answerer.peers[0].signals).toEqual([OFFER]);
    });

    it("before start: ignored", () => {
      const h = harness("a");
      h.mesh.handleSignal("b", HELLO);
      expect(h.peers).toHaveLength(0);
    });
  });
});

// A browser without WebRTC: simple-peer throws when asked to build a connection.
describe("a connection that cannot be created", () => {
  function throwing(selfUid: string) {
    const createPeer = vi.fn(() => {
      throw new Error("ERR_WEBRTC_SUPPORT");
    });
    const h = harness(selfUid, { createPeer });
    return { h, createPeer };
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does not throw out of setRoster, schedules no retry, and reads connecting then failing", () => {
    const { h, createPeer } = throwing("a");
    h.mesh.start(STREAM);
    expect(() => h.mesh.setRoster(["b"])).not.toThrow();
    expect(createPeer).toHaveBeenCalledTimes(1);
    expect(h.peers).toHaveLength(0);
    expect(h.links()).toEqual({ b: "connecting" });
    vi.advanceTimersByTime(10000);
    expect(h.links()).toEqual({ b: "failing" });
    vi.advanceTimersByTime(60000);
    expect(createPeer).toHaveBeenCalledTimes(1);
    expect(h.links()).toEqual({ b: "failing" });
  });

  it("does not throw out of handleSignal (an offer, or a hello) and never reads as connected", () => {
    const { h, createPeer } = throwing("b");
    h.mesh.start(STREAM);
    h.mesh.setRoster(["a"]);
    expect(() => h.mesh.handleSignal("a", OFFER)).not.toThrow();
    expect(createPeer).toHaveBeenCalledTimes(1);
    expect(h.links()).toEqual({ a: "connecting" });
    vi.advanceTimersByTime(60000);
    expect(createPeer).toHaveBeenCalledTimes(1);
    expect(h.links().a).not.toBe("connected");

    const caller = throwing("a");
    caller.h.mesh.start(STREAM);
    expect(() =>
      caller.h.mesh.handleSignal("b", { type: "hello" } as unknown as SignalData),
    ).not.toThrow();
    expect(caller.createPeer).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60000);
    expect(caller.createPeer).toHaveBeenCalledTimes(1);
  });
});

describe("meshes wired to each other", () => {
  // A relay standing in for the server: a signal sent to `target` arrives at the
  // target's mesh on the next tick. Fake peers do the handshake: an initiator offers,
  // an answerer answers an offer and connects, an initiator connects on the answer.
  function network(uids: string[]) {
    const nodes = new Map<string, Harness>();
    const wire = (uid: string) => {
      const h = harness(uid, {
        sendSignal: (target, signal) => {
          setTimeout(() => nodes.get(target)?.mesh.handleSignal(uid, signal), 0);
        },
        createPeer: (initiator) => {
          const peer = new FakePeer(initiator, uid);
          const realSignal = peer.signal.bind(peer);
          peer.signal = (data: SignalData) => {
            realSignal(data);
            if (data.type === "offer" && !peer.initiator) {
              setTimeout(() => {
                peer.emit("signal", ANSWER);
                peer.emit("connect");
              }, 0);
            }
            if (data.type === "answer" && peer.initiator) {
              setTimeout(() => peer.emit("connect"), 0);
            }
          };
          if (initiator) setTimeout(() => peer.emit("signal", OFFER), 0);
          nodes.get(uid)!.peers.push(peer);
          return peer as unknown as Peer;
        },
      });
      nodes.set(uid, h);
      return h;
    };
    uids.forEach(wire);
    return { nodes, wire };
  }

  it("two joining at the same moment: one initiator for the pair, both connected", () => {
    const { nodes } = network(["u1", "u2"]);
    const a = nodes.get("u1")!;
    const b = nodes.get("u2")!;
    a.mesh.start(STREAM);
    b.mesh.start(STREAM);
    a.mesh.setRoster(["u1", "u2"]);
    b.mesh.setRoster(["u1", "u2"]);
    vi.advanceTimersByTime(10);
    const initiators = [...a.peers, ...b.peers].filter((peer) => peer.initiator);
    expect(initiators).toHaveLength(1);
    expect(initiators[0].owner).toBe("u1");
    expect(a.live()).toHaveLength(1);
    expect(b.live()).toHaveLength(1);
    expect(b.live()[0].initiator).toBe(false);
    expect(a.links()).toEqual({ u2: "connected" });
    expect(b.links()).toEqual({ u1: "connected" });
  });

  it("a third joining later connects to both", () => {
    const { nodes, wire } = network(["u1", "u2"]);
    const a = nodes.get("u1")!;
    const b = nodes.get("u2")!;
    a.mesh.start(STREAM);
    b.mesh.start(STREAM);
    a.mesh.setRoster(["u1", "u2"]);
    b.mesh.setRoster(["u1", "u2"]);
    vi.advanceTimersByTime(10);
    const c = wire("u3");
    c.mesh.start(STREAM);
    [a, b, c].forEach((h) => h.mesh.setRoster(["u1", "u2", "u3"]));
    vi.advanceTimersByTime(10);
    expect(c.live()).toHaveLength(2);
    expect(c.peers.every((peer) => !peer.initiator)).toBe(true);
    expect(a.live()).toHaveLength(2);
    expect(b.live()).toHaveLength(2);
    expect(a.links()).toEqual({ u2: "connected", u3: "connected" });
    expect(b.links()).toEqual({ u1: "connected", u3: "connected" });
    expect(c.links()).toEqual({ u1: "connected", u2: "connected" });
    const initiators = [a, b, c].flatMap((h) => h.peers).filter((peer) => peer.initiator);
    expect(initiators).toHaveLength(3);
  });
});
