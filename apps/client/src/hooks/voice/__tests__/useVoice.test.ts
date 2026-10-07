// useVoice: Join / Mute / Leave as the server sees it (voice-state), the mic tracks
// behind it, a failed mic prompt, a leave while the prompt is open, coming back after
// a blip (re-auth) and after a reload (the remembered state, honoured for a minute), Leave
// hanging everything up, who is in the call (whatever characters a name holds), a socket blip
// that is not an empty call, a mic that stops by itself, a table that no longer lists the
// player, and a meter that cannot start (the call goes on without it).
// jsdom has no getUserMedia, WebRTC or AudioContext: all three are stubbed.
// (RTCPeerConnection only has to EXIST: useVoice refuses to join without it, and
// simple-peer itself is faked below.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { useVoice } from "../useVoice";
import { RELOAD_WINDOW_MS } from "../voiceMemory";
import {
  __resetMicNoticeForTests,
  claimMicNotice,
  getMicNotice,
  useMicNotice,
} from "../../micNotice";

const peerMock = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  class FakeSimplePeer {
    handlers = new Map<string, Handler[]>();
    signals: unknown[] = [];
    destroyed = false;
    initiator: boolean;
    constructor(options: { initiator: boolean }) {
      this.initiator = options.initiator;
      created.push(this);
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }
    signal(data: unknown) {
      this.signals.push(data);
    }
    destroy() {
      this.destroyed = true;
    }
    emit(event: string, ...args: unknown[]) {
      (this.handlers.get(event) ?? []).forEach((handler) => handler(...args));
    }
  }
  const created: FakeSimplePeer[] = [];
  return { FakeSimplePeer, created };
});

vi.mock("simple-peer", () => ({ default: peerMock.FakeSimplePeer }));

interface FakeTrack {
  kind: "audio";
  enabled: boolean;
  stop: ReturnType<typeof vi.fn>;
  addEventListener: (event: string, listener: () => void) => void;
  /** Fire a track event (e.g. "ended", as a browser does when the mic is unplugged). */
  fire: (event: string) => void;
}

function fakeTrack(): FakeTrack {
  const listeners = new Map<string, (() => void)[]>();
  return {
    kind: "audio",
    enabled: true,
    stop: vi.fn(),
    addEventListener: (event, listener) =>
      listeners.set(event, [...(listeners.get(event) ?? []), listener]),
    fire: (event) => (listeners.get(event) ?? []).forEach((listener) => listener()),
  };
}

function fakeStream(): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = [fakeTrack()];
  const stream = {
    id: "local",
    getTracks: () => tracks,
    getAudioTracks: () => tracks,
  } as unknown as MediaStream;
  return { stream, tracks };
}

// What the analyser reads: 0 is silence, 255 is as loud as it gets.
const analyser = { loudness: 0 };

class FakeAudioContext {
  state = "running";
  createAnalyser() {
    return {
      fftSize: 0,
      frequencyBinCount: 4,
      getByteFrequencyData: (data: Uint8Array) => data.fill(analyser.loudness),
    };
  }
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

const SELF = "aa";

function snapshot(
  players: { uid: string; name: string; voice?: "live" | "muted" }[],
  users: string[],
): RoomSnapshot {
  return { players, users } as unknown as RoomSnapshot;
}

// A table that lists this player alone, in the call (what the server sends once joined).
const SELF_ONLY = () => snapshot([{ uid: SELF, name: "Me", voice: "live" }], [SELF]);

// Two others in the call: "a0" sorts below SELF ("aa"), so it is the caller of this pair and
// is told hello; "zz" sorts above, so this player calls it and says nothing first.
const ROOM_WITH_BOTH = () =>
  snapshot(
    [
      { uid: SELF, name: "Me", voice: "live" },
      { uid: "a0", name: "Low", voice: "live" },
      { uid: "zz", name: "Zed", voice: "live" },
    ],
    [SELF, "a0", "zz"],
  );

const HELLO = { type: "hello" };

let getUserMedia: ReturnType<typeof vi.fn>;
let current: ReturnType<typeof fakeStream>;
const originalAudioContext = (window as { AudioContext?: unknown }).AudioContext;
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

beforeEach(() => {
  __resetMicNoticeForTests();
  window.sessionStorage.clear();
  peerMock.created.length = 0;
  current = fakeStream();
  getUserMedia = vi.fn(() => Promise.resolve(current.stream));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  (window as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
  vi.stubGlobal("RTCPeerConnection", class {});
  analyser.loudness = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // The one test that makes simple-peer fail to load must not leak that to the next.
  vi.doMock("simple-peer", () => ({ default: peerMock.FakeSimplePeer }));
  vi.resetModules();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  (window as { AudioContext?: unknown }).AudioContext = originalAudioContext;
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  window.sessionStorage.clear();
  __resetMicNoticeForTests();
});

interface Props {
  snapshot: RoomSnapshot | null;
  authenticated: boolean;
}

function setup(initial: Partial<Props> = {}) {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  let rtcHandler: ((from: string, signal: unknown) => void) | null = null;
  const registerRtcHandler = vi.fn((handler: (from: string, signal: unknown) => void) => {
    rtcHandler = handler;
  });
  const hook = renderHook(
    (props: Props) => useVoice({ uid: SELF, sendMessage, registerRtcHandler, ...props }),
    {
      initialProps: { snapshot: snapshot([], []), authenticated: true, ...initial },
    },
  );
  const voiceStates = () =>
    sendMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.t === "voice-state")
      .map((message) => (message as { state: string }).state);
  const sent = () => sendMessage.mock.calls.map(([message]) => message);
  // Every hello (and any other signal) as [target, signal], in the order sent.
  const signals = () =>
    sent()
      .filter((message) => message.t === "rtc-signal")
      .map((message) => message as { target: string; signal: unknown });
  return { ...hook, sendMessage, voiceStates, sent, signals, rtc: () => rtcHandler! };
}

const KEY = "herobyte.voice:default";

// What the tab remembers: the state and when it was last true (a reload honours it for a minute).
const memory = () =>
  JSON.parse(window.sessionStorage.getItem(KEY) ?? "null") as {
    state: string;
    at: number;
  } | null;
const remember = (state: "live" | "muted", at = Date.now()) =>
  window.sessionStorage.setItem(KEY, JSON.stringify({ state, at }));
// What the browser says this page load was. jsdom's is no reload, so a test of the reload
// memory stubs one (after any vi.useFakeTimers(), which replaces window.performance).
const loadedBy = (...types: string[]) =>
  vi
    .spyOn(window.performance, "getEntriesByType")
    .mockReturnValue(types.map((type) => ({ type })) as never);

// Every peer that was ever created is hung up (and at least one was created).
const expectAllPeersDestroyed = () => {
  expect(peerMock.created.length).toBeGreaterThan(0);
  expect(peerMock.created.map((peer) => peer.destroyed)).toEqual(peerMock.created.map(() => true));
};
const voiceAudio = () => document.querySelectorAll("audio[data-voice-peer]");

// A browser's DOMException is an Error; jsdom's is not, so micFailure (which reads
// error.name off an Error) would see a nameless failure. Build what a browser throws.
const denied = () => Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });

describe("join, mute, leave", () => {
  it("join asks for the mic, goes live, tells the server and remembers it", async () => {
    const { result, voiceStates } = setup();
    await act(async () => {
      await result.current.join();
    });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    expect(result.current.state).toBe("live");
    expect(voiceStates()).toEqual(["live"]);
    expect(current.tracks[0].enabled).toBe(true);
    expect(memory()).toEqual({ state: "live", at: expect.any(Number) });
    expect(Math.abs(Date.now() - memory()!.at)).toBeLessThan(5000);
  });

  it("toggleMute flips the track and tells the server muted, then live", async () => {
    const { result, voiceStates } = setup();
    await act(async () => {
      await result.current.join();
    });
    act(() => result.current.toggleMute());
    expect(result.current.state).toBe("muted");
    expect(current.tracks[0].enabled).toBe(false);
    expect(memory()?.state).toBe("muted");
    act(() => result.current.toggleMute());
    expect(result.current.state).toBe("live");
    expect(current.tracks[0].enabled).toBe(true);
    expect(voiceStates()).toEqual(["live", "muted", "live"]);
  });

  it("toggleMute does nothing while off", () => {
    const { result, sendMessage } = setup();
    act(() => result.current.toggleMute());
    expect(result.current.state).toBe("off");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("leave stops the mic tracks, tells the server off and forgets the call", async () => {
    const { result, voiceStates } = setup();
    await act(async () => {
      await result.current.join();
    });
    act(() => result.current.leave());
    expect(result.current.state).toBe("off");
    expect(current.tracks[0].stop).toHaveBeenCalled();
    expect(voiceStates()).toEqual(["live", "off"]);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("leave hangs up: every peer destroyed, every voice removed, links cleared, nothing sent afterwards", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.useFakeTimers();
    const { result, rtc, sendMessage, sent } = setup({ snapshot: ROOM_WITH_BOTH() });
    await act(async () => {
      await result.current.join();
    });
    // zz was called by this player; "bb" called this player (an answering peer).
    act(() => rtc()("bb", { type: "offer", sdp: "y" }));
    expect(peerMock.created).toHaveLength(2);
    act(() => {
      peerMock.created[0].emit("connect");
      peerMock.created[0].emit("stream", { id: "zz-voice" });
      peerMock.created[1].emit("stream", { id: "bb-voice" });
    });
    expect(voiceAudio()).toHaveLength(2);
    expect(document.querySelector('[data-testid="voice-audio"]')).not.toBeNull();
    expect(Object.keys(result.current.links).length).toBeGreaterThan(0);
    act(() => result.current.leave());
    expect(result.current.state).toBe("off");
    expect(peerMock.created.map((peer) => peer.destroyed)).toEqual([true, true]);
    expect(voiceAudio()).toHaveLength(0);
    // The holder the voices were played in goes with them.
    expect(document.querySelector('[data-testid="voice-audio"]')).toBeNull();
    expect(result.current.links).toEqual({});
    // Whatever the old connections or the clock do now, nothing more goes out.
    sendMessage.mockClear();
    act(() => {
      peerMock.created.forEach((peer) => {
        peer.emit("signal", { type: "candidate" });
        peer.emit("close");
      });
      vi.advanceTimersByTime(6000);
    });
    expect(sent()).toEqual([]);
    expect(peerMock.created).toHaveLength(2);
    expect(result.current.links).toEqual({});
  });

  it("unmounting while in the call releases the mic and hangs up every peer", async () => {
    const { result, unmount } = setup({ snapshot: ROOM_WITH_BOTH() });
    await act(async () => {
      await result.current.join();
    });
    expect(peerMock.created.length).toBeGreaterThan(0);
    unmount();
    expect(current.tracks[0].stop).toHaveBeenCalled();
    expectAllPeersDestroyed();
  });
});

describe("a mic that will not start", () => {
  it("NotAllowedError: back to off, the mic notice says why, nothing is sent", async () => {
    getUserMedia.mockImplementation(() => Promise.reject(denied()));
    const { result, sendMessage } = setup();
    await act(async () => {
      await result.current.join();
    });
    expect(result.current.state).toBe("off");
    expect(getMicNotice()).toBe(
      "Mic blocked. Allow it for this site (address bar icon) and in system privacy settings, then try again.",
    );
    expect(sendMessage).not.toHaveBeenCalled();
    expect(peerMock.created).toHaveLength(0);
  });

  it("a later successful join clears the notice", async () => {
    getUserMedia.mockImplementationOnce(() => Promise.reject(denied()));
    const { result } = setup();
    await act(async () => {
      await result.current.join();
    });
    expect(getMicNotice()).not.toBeNull();
    await act(async () => {
      await result.current.join();
    });
    expect(result.current.state).toBe("live");
    expect(getMicNotice()).toBeNull();
  });
});

describe("leaving while the mic prompt is open", () => {
  it("releases the stream when the prompt resolves and sends nothing", async () => {
    let grant: (stream: MediaStream) => void = () => {};
    getUserMedia.mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve;
        }),
    );
    const { result, sendMessage } = setup();
    let joining: Promise<void> = Promise.resolve();
    act(() => {
      joining = result.current.join();
    });
    expect(result.current.state).toBe("joining");
    act(() => result.current.leave());
    expect(result.current.state).toBe("off");
    await act(async () => {
      grant(current.stream);
      await joining;
    });
    expect(current.tracks[0].stop).toHaveBeenCalled();
    expect(result.current.state).toBe("off");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(peerMock.created).toHaveLength(0);
  });
});

describe("coming back", () => {
  it("re-sends the current state when authentication returns while in the call", async () => {
    const { result, rerender, voiceStates } = setup({ snapshot: SELF_ONLY() });
    await act(async () => {
      await result.current.join();
    });
    act(() => result.current.toggleMute());
    // A blip as production has it: the socket drops (no snapshot, not authenticated).
    rerender({ snapshot: null, authenticated: false });
    expect(voiceStates()).toEqual(["live", "muted"]);
    rerender({ snapshot: null, authenticated: true });
    expect(voiceStates()).toEqual(["live", "muted", "muted"]);
    rerender({ snapshot: SELF_ONLY(), authenticated: true });
    expect(voiceStates()).toEqual(["live", "muted", "muted"]);
    expect(result.current.state).toBe("muted");
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("a remembered 'muted' rejoins muted on first authentication", async () => {
    loadedBy("reload");
    remember("muted");
    const { result, rerender, voiceStates } = setup({ authenticated: false });
    expect(getUserMedia).not.toHaveBeenCalled();
    await act(async () => {
      rerender({ snapshot: snapshot([], []), authenticated: true });
    });
    // The join finishes after the lazy simple-peer import, which can take a while under load.
    await waitFor(() => expect(result.current.state).toBe("muted"));
    expect(current.tracks[0].enabled).toBe(false);
    expect(voiceStates()).toEqual(["muted"]);
  });

  it("nothing remembered: authentication joins nothing", async () => {
    const { result, rerender } = setup({ authenticated: false });
    await act(async () => {
      rerender({ snapshot: snapshot([], []), authenticated: true });
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.state).toBe("off");
  });
});

describe("who is in the call", () => {
  it("lists players with voice set who are connected (in snapshot.users) only", () => {
    const { result } = setup({
      snapshot: snapshot(
        [
          { uid: "u1", name: "Ann", voice: "live" },
          { uid: "u2", name: "Bo", voice: "muted" },
          { uid: "u3", name: "Cy", voice: "live" },
          { uid: "u4", name: "Di" },
        ],
        ["u1", "u2", "u4"],
      ),
    });
    expect(result.current.inCall).toEqual([
      { uid: "u1", name: "Ann", muted: false },
      { uid: "u2", name: "Bo", muted: true },
    ]);
  });

  it("calls a higher uid in the call and relays its signals; answers an offer through the registered handler", async () => {
    const { result, sendMessage, rtc } = setup({
      snapshot: snapshot(
        [
          { uid: SELF, name: "Me", voice: "live" },
          { uid: "zz", name: "Zed", voice: "live" },
        ],
        [SELF, "zz"],
      ),
    });
    await act(async () => {
      await result.current.join();
    });
    expect(peerMock.created).toHaveLength(1);
    expect(peerMock.created[0].initiator).toBe(true);
    act(() => peerMock.created[0].emit("signal", { type: "offer", sdp: "x" }));
    expect(sendMessage).toHaveBeenCalledWith({
      t: "rtc-signal",
      target: "zz",
      signal: { type: "offer", sdp: "x" },
    });
    act(() => rtc()("bb", { type: "offer", sdp: "y" }));
    expect(peerMock.created).toHaveLength(2);
    expect(peerMock.created[1].initiator).toBe(false);
    expect(peerMock.created[1].signals).toEqual([{ type: "offer", sdp: "y" }]);
  });
});

describe("a browser that cannot do voice", () => {
  it("no RTCPeerConnection: stays off, says why, never asks for the mic, sends nothing", async () => {
    vi.stubGlobal("RTCPeerConnection", undefined);
    const { result, sendMessage } = setup();
    await act(async () => {
      await result.current.join();
    });
    expect(result.current.state).toBe("off");
    expect(getMicNotice()).toContain("This browser cannot do voice calls");
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("the voice code failing to load: off, 'could not load' notice, the mic released, nothing sent", async () => {
    // A tab left open across a deploy can no longer fetch the old voice chunk: the
    // dynamic import itself rejects. (doMock replaces the file's mock for later imports.)
    vi.doMock("simple-peer", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    vi.resetModules();
    const { result, sendMessage } = setup();
    await act(async () => {
      await result.current.join();
    });
    expect(result.current.state).toBe("off");
    expect(getMicNotice()).toContain("Voice could not load. Reload the page");
    expect(current.tracks[0].stop).toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(peerMock.created).toHaveLength(0);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });
});

describe("joining muted", () => {
  it("join(true): the track is off from the start and the server hears muted, never live", async () => {
    const { result, voiceStates } = setup();
    await act(async () => {
      await result.current.join(true);
    });
    expect(result.current.state).toBe("muted");
    expect(current.tracks[0].enabled).toBe(false);
    expect(voiceStates()).toEqual(["muted"]);
    expect(memory()?.state).toBe("muted");
  });
});

describe("presence before signals", () => {
  it("sends voice-state BEFORE any rtc-signal, then says hello to the lower uid only", async () => {
    const { result, sent, signals } = setup({ snapshot: ROOM_WITH_BOTH() });
    await act(async () => {
      await result.current.join();
    });
    const types = sent().map((message) => message.t);
    expect(types[0]).toBe("voice-state");
    expect(types.indexOf("voice-state")).toBeLessThan(types.indexOf("rtc-signal"));
    expect(signals()).toEqual([{ t: "rtc-signal", target: "a0", signal: HELLO }]);
    // The higher uid is called the normal way: an initiator peer, no hello.
    expect(peerMock.created.map((peer) => peer.initiator)).toEqual([true]);
  });

  it("re-authentication while in the call re-sends the state, and says hello only once the snapshot is back", async () => {
    const room = ROOM_WITH_BOTH();
    const { result, rerender, sendMessage, sent, signals, voiceStates } = setup({
      snapshot: room,
    });
    await act(async () => {
      await result.current.join();
    });
    sendMessage.mockClear();
    // Production: the connection drops and the snapshot goes with it.
    rerender({ snapshot: null, authenticated: false });
    expect(sendMessage).not.toHaveBeenCalled();
    rerender({ snapshot: null, authenticated: true });
    expect(voiceStates()).toEqual(["live"]);
    // Authenticated again, but nobody is known to be in the call yet: no hello.
    expect(signals()).toEqual([]);
    rerender({ snapshot: ROOM_WITH_BOTH(), authenticated: true });
    expect(signals()).toEqual([{ t: "rtc-signal", target: "a0", signal: HELLO }]);
    expect(sent().map((message) => message.t)).toEqual(["voice-state", "rtc-signal"]);
    // And only once: a later snapshot, even one that adds another lower uid, says nothing more.
    rerender({
      snapshot: snapshot(
        [
          { uid: SELF, name: "Me", voice: "live" },
          { uid: "a0", name: "Low", voice: "live" },
          { uid: "a1", name: "Lower", voice: "live" },
          { uid: "zz", name: "Zed", voice: "live" },
        ],
        [SELF, "a0", "a1", "zz"],
      ),
      authenticated: true,
    });
    expect(signals()).toHaveLength(1);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("re-authentication and the table's answer in the SAME render still say hello", async () => {
    const { result, rerender, sendMessage, signals, voiceStates } = setup({
      snapshot: ROOM_WITH_BOTH(),
    });
    await act(async () => {
      await result.current.join();
    });
    sendMessage.mockClear();
    rerender({ snapshot: null, authenticated: false });
    // React batched the auth-ok and the snapshot into one commit.
    rerender({ snapshot: ROOM_WITH_BOTH(), authenticated: true });
    expect(voiceStates()).toEqual(["live"]);
    expect(signals()).toEqual([{ t: "rtc-signal", target: "a0", signal: HELLO }]);
  });

  it("re-authentication starts half-made calls over: the unconnected call is dropped and placed again", async () => {
    const { result, rerender } = setup({ snapshot: ROOM_WITH_BOTH() });
    await act(async () => {
      await result.current.join();
    });
    expect(peerMock.created).toHaveLength(1);
    const first = peerMock.created[0];
    rerender({ snapshot: null, authenticated: false });
    rerender({ snapshot: null, authenticated: true });
    expect(first.destroyed).toBe(true);
    rerender({ snapshot: ROOM_WITH_BOTH(), authenticated: true });
    expect(peerMock.created).toHaveLength(2);
    expect(peerMock.created[1].initiator).toBe(true);
    expect(peerMock.created[1].destroyed).toBe(false);
  });

  it("re-authentication keeps a connection that is up", async () => {
    const { result, rerender } = setup({ snapshot: ROOM_WITH_BOTH() });
    await act(async () => {
      await result.current.join();
    });
    act(() => peerMock.created[0].emit("connect"));
    rerender({ snapshot: null, authenticated: false });
    rerender({ snapshot: null, authenticated: true });
    rerender({ snapshot: ROOM_WITH_BOTH(), authenticated: true });
    expect(peerMock.created).toHaveLength(1);
    expect(peerMock.created[0].destroyed).toBe(false);
  });
});

describe("a mic that stops by itself", () => {
  it("the track ending leaves the call: off, the server hears off, the notice says the mic stopped", async () => {
    const { result, voiceStates } = setup({ snapshot: ROOM_WITH_BOTH() });
    await act(async () => {
      await result.current.join();
    });
    act(() => current.tracks[0].fire("ended"));
    expect(result.current.state).toBe("off");
    expect(voiceStates()).toEqual(["live", "off"]);
    expect(getMicNotice()).toMatch(/^Your mic stopped/);
    expect(current.tracks[0].stop).toHaveBeenCalled();
    expectAllPeersDestroyed();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("the ended notice reaches the header control even after a card control claimed the notice", async () => {
    const { result } = setup();
    const header = renderHook(() => useMicNotice("voice-control:header"));
    await act(async () => {
      await result.current.join();
    });
    // The last press was on a player card, whose mic button is gone once out of the call.
    act(() => claimMicNotice("card-x"));
    expect(header.result.current).toBeNull();
    act(() => current.tracks[0].fire("ended"));
    expect(header.result.current).toMatch(/^Your mic stopped/);
  });

  it("a track that ends after the player already left changes nothing", async () => {
    const { result, voiceStates } = setup();
    await act(async () => {
      await result.current.join();
    });
    act(() => result.current.leave());
    act(() => current.tracks[0].fire("ended"));
    expect(voiceStates()).toEqual(["live", "off"]);
    expect(getMicNotice()).toBeNull();
  });
});

describe("unmounting in the call", () => {
  it("forgets the call: whatever unmounted the table must not rejoin it unasked", async () => {
    const { result, unmount } = setup({ snapshot: SELF_ONLY() });
    await act(async () => {
      await result.current.join();
    });
    expect(memory()?.state).toBe("live");
    unmount();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(current.tracks[0].stop).toHaveBeenCalled();
  });
});

describe("unmounting while the mic prompt is open", () => {
  it("releases the stream when the prompt resolves and sends nothing at all", async () => {
    let grant: (stream: MediaStream) => void = () => {};
    getUserMedia.mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve;
        }),
    );
    const { result, sendMessage, unmount } = setup({ snapshot: ROOM_WITH_BOTH() });
    let joining: Promise<void> = Promise.resolve();
    act(() => {
      joining = result.current.join();
    });
    expect(result.current.state).toBe("joining");
    unmount();
    await act(async () => {
      grant(current.stream);
      await joining;
    });
    expect(current.tracks[0].stop).toHaveBeenCalled();
    // Not even a mic-level: nothing was sent (no voice-state, no signal, no meter sample).
    expect(sendMessage).not.toHaveBeenCalled();
    expect(peerMock.created).toHaveLength(0);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });
});

describe("the speaking meter", () => {
  const levels = (sent: () => ClientMessage[]) =>
    sent()
      .filter((message) => message.t === "mic-level")
      .map((message) => (message as { level: number }).level);

  it("sends a loud level after 100 ms, and a level of 0 the moment the mic is muted", async () => {
    vi.useFakeTimers();
    analyser.loudness = 255;
    const { result, sent } = setup();
    await act(async () => {
      await result.current.join();
    });
    expect(levels(sent)).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(levels(sent)).toHaveLength(1);
    expect(levels(sent)[0]).toBeGreaterThan(0.1);
    act(() => result.current.toggleMute());
    expect(levels(sent).at(-1)).toBe(0);
    // Muted, the meter reads silence however loud the room is: no loud sample follows.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(levels(sent)).toHaveLength(2);
  });

  it("joining muted never reports a level, however loud the room is", async () => {
    vi.useFakeTimers();
    analyser.loudness = 255;
    const { result, sent } = setup();
    await act(async () => {
      await result.current.join(true);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(levels(sent)).toEqual([]);
  });
});

describe("removed from the table while in the call", () => {
  const OTHERS_ONLY = () => snapshot([{ uid: "zz", name: "Zed", voice: "live" }], [SELF, "zz"]);

  it("leaves: off, the server hears off, the mic is released and the notice says why", async () => {
    const { result, rerender, voiceStates } = setup({ snapshot: ROOM_WITH_BOTH() });
    const header = renderHook(() => useMicNotice("voice-control:header"));
    await act(async () => {
      await result.current.join();
    });
    act(() => claimMicNotice("card-x"));
    rerender({ snapshot: OTHERS_ONLY(), authenticated: true });
    expect(result.current.state).toBe("off");
    expect(voiceStates()).toEqual(["live", "off"]);
    expect(current.tracks[0].stop).toHaveBeenCalled();
    expectAllPeersDestroyed();
    expect(getMicNotice()).toBe("The table no longer lists you, so you left the voice call.");
    // Visible to the header control although a card control had claimed the notice.
    expect(header.result.current).toBe(getMicNotice());
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("a snapshot that is not there yet is not a removal", async () => {
    const { result, rerender, voiceStates } = setup({ snapshot: SELF_ONLY() });
    await act(async () => {
      await result.current.join();
    });
    rerender({ snapshot: null, authenticated: true });
    expect(result.current.state).toBe("live");
    expect(voiceStates()).toEqual(["live"]);
    expect(getMicNotice()).toBeNull();
  });

  it("a stale snapshot during a blip (not authenticated) does not leave; authenticating with it does", async () => {
    const { result, rerender, voiceStates } = setup({ snapshot: SELF_ONLY() });
    await act(async () => {
      await result.current.join();
    });
    rerender({ snapshot: OTHERS_ONLY(), authenticated: false });
    expect(result.current.state).toBe("live");
    expect(voiceStates()).toEqual(["live"]);
    rerender({ snapshot: OTHERS_ONLY(), authenticated: true });
    expect(result.current.state).toBe("off");
  });

  it("someone who is not in the call is not told anything when the table drops them", () => {
    const { result, rerender, sendMessage } = setup({ snapshot: SELF_ONLY() });
    rerender({ snapshot: OTHERS_ONLY(), authenticated: true });
    expect(result.current.state).toBe("off");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(getMicNotice()).toBeNull();
  });
});

describe("joining twice at once", () => {
  it("two join() calls before the first settles ask for the mic once and join once", async () => {
    let grant: (stream: MediaStream) => void = () => {};
    getUserMedia.mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve;
        }),
    );
    const { result, voiceStates } = setup();
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.join();
      second = result.current.join();
    });
    expect(result.current.state).toBe("joining");
    await act(async () => {
      grant(current.stream);
      await Promise.all([first, second]);
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("live");
    expect(voiceStates()).toEqual(["live"]);
  });
});

describe("a meter that cannot start", () => {
  it("the join still succeeds: live, tracks kept, the server hears live, context closed once, no level ever", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const close = vi.fn(() => Promise.resolve());
    class BrokenContext extends FakeAudioContext {
      createAnalyser(): never {
        throw new Error("no analyser");
      }
      close() {
        return close();
      }
    }
    (window as { AudioContext?: unknown }).AudioContext = BrokenContext;
    analyser.loudness = 255;
    const { result, sent, voiceStates } = setup({ snapshot: SELF_ONLY() });
    await act(async () => {
      await result.current.join();
    });
    expect(result.current.state).toBe("live");
    expect(current.tracks[0].stop).not.toHaveBeenCalled();
    expect(current.tracks[0].enabled).toBe(true);
    expect(voiceStates()).toEqual(["live"]);
    expect(close).toHaveBeenCalledTimes(1);
    expect(getMicNotice()).toBeNull();
    expect(memory()?.state).toBe("live");
    expect(warn).toHaveBeenCalledWith("Voice meter unavailable:", expect.any(Error));
    // No meter, so no speaking level, however loud the room is.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(sent().filter((message) => message.t === "mic-level")).toEqual([]);
    // The rest of the call works without it.
    act(() => result.current.toggleMute());
    expect(result.current.state).toBe("muted");
    expect(current.tracks[0].enabled).toBe(false);
    expect(voiceStates()).toEqual(["live", "muted"]);
    act(() => result.current.leave());
    expect(current.tracks[0].stop).toHaveBeenCalled();
    expect(voiceStates()).toEqual(["live", "muted", "off"]);
    expect(sent().filter((message) => message.t === "mic-level")).toEqual([]);
  });
});

describe("the list of who is in the call", () => {
  const room = (muted: boolean) =>
    snapshot(
      [
        { uid: SELF, name: "Me", voice: "live" },
        { uid: "zz", name: "Zed", voice: muted ? "muted" : "live" },
        { uid: "yy", name: "Yan" },
      ],
      [SELF, "zz", "yy"],
    );

  it("keeps the SAME array across snapshots whose in-call content is equal", () => {
    const { result, rerender } = setup({ snapshot: room(false) });
    const first = result.current.inCall;
    expect(first).toHaveLength(2);
    rerender({ snapshot: room(false), authenticated: true });
    expect(result.current.inCall).toBe(first);
    // A change outside the call (someone connects, someone not in the call) is not a change.
    const wider = room(false);
    (wider as unknown as { users: string[] }).users.push("xx");
    rerender({ snapshot: wider, authenticated: true });
    expect(result.current.inCall).toBe(first);
  });

  it("changes when someone mutes", () => {
    const { result, rerender } = setup({ snapshot: room(false) });
    const first = result.current.inCall;
    rerender({ snapshot: room(true), authenticated: true });
    expect(result.current.inCall).not.toBe(first);
    expect(result.current.inCall.find((person) => person.uid === "zz")?.muted).toBe(true);
  });
});

describe("the reload memory is only for a reload", () => {
  // Each of these is a fresh, valid memory but for the one thing under test.
  const authenticateAfterLoad = async () => {
    const { result, rerender } = setup({ authenticated: false });
    await act(async () => {
      rerender({ snapshot: snapshot([], []), authenticated: true });
    });
    return result;
  };

  it.each([
    ["a new page load", ["navigate"]],
    ["Back or Forward", ["back_forward"]],
    ["no navigation entry", []],
  ])("%s (no reload) does not rejoin, even with a fresh memory", async (_label, types) => {
    loadedBy(...types);
    remember("live");
    const result = await authenticateAfterLoad();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.state).toBe("off");
  });

  it("a memory dated in the future does not rejoin", async () => {
    loadedBy("reload");
    remember("live", Date.now() + 5_000);
    const result = await authenticateAfterLoad();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.state).toBe("off");
  });

  it("a remembered state older than the window does not rejoin on authentication", async () => {
    loadedBy("reload");
    remember("live", Date.now() - (RELOAD_WINDOW_MS + 1));
    const { result, rerender } = setup({ authenticated: false });
    await act(async () => {
      rerender({ snapshot: snapshot([], []), authenticated: true });
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.state).toBe("off");
  });

  it("an old plain-string memory does not rejoin either", async () => {
    loadedBy("reload");
    window.sessionStorage.setItem(KEY, "live");
    const { result, rerender } = setup({ authenticated: false });
    await act(async () => {
      rerender({ snapshot: snapshot([], []), authenticated: true });
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.state).toBe("off");
  });

  it("pagehide while in the call refreshes the time, keeping the state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { result } = setup({ snapshot: SELF_ONLY() });
    await act(async () => {
      await result.current.join(true);
    });
    expect(memory()).toEqual({ state: "muted", at: 1_000_000 });
    vi.setSystemTime(1_000_000 + 45_000);
    window.dispatchEvent(new Event("pagehide"));
    expect(memory()).toEqual({ state: "muted", at: 1_045_000 });
    // A long call: a later page hide refreshes again, so it still survives a reload.
    vi.setSystemTime(1_045_000 + 3_600_000);
    window.dispatchEvent(new Event("pagehide"));
    expect(memory()).toEqual({ state: "muted", at: 4_645_000 });
  });

  it("pagehide while off writes nothing, before joining or after leaving", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { result } = setup({ snapshot: SELF_ONLY() });
    window.dispatchEvent(new Event("pagehide"));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    await act(async () => {
      await result.current.join();
    });
    act(() => result.current.leave());
    vi.setSystemTime(1_000_000 + 10_000);
    window.dispatchEvent(new Event("pagehide"));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });
});

describe("a socket blip is not an empty call", () => {
  it("keeps its peers (even past the grace) while there is no snapshot; drops them after the grace once a snapshot lacks them", async () => {
    vi.useFakeTimers();
    const { result, rerender } = setup({ snapshot: ROOM_WITH_BOTH() });
    await act(async () => {
      await result.current.join();
    });
    const zed = peerMock.created[0];
    act(() => zed.emit("connect"));
    rerender({ snapshot: null, authenticated: false });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(zed.destroyed).toBe(false);
    rerender({ snapshot: null, authenticated: true });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(zed.destroyed).toBe(false);
    expect(peerMock.created).toHaveLength(1);
    // The table answers, and Zed is no longer in the call: hung up after the grace.
    rerender({ snapshot: SELF_ONLY(), authenticated: true });
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(zed.destroyed).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(zed.destroyed).toBe(true);
  });
});

describe("names can hold any character", () => {
  it("a name with the old separator characters and a fake uid adds nobody to inCall or the roster", async () => {
    const name = "Bo\u0000ghost\u0001live\u0001Ghost";
    const room = snapshot(
      [
        { uid: SELF, name: "Me", voice: "live" },
        { uid: "u1", name: "Ann", voice: "live" },
        { uid: "u2", name, voice: "live" },
        { uid: "u3", name: "Cy" },
      ],
      [SELF, "u1", "u2", "u3"],
    );
    const { result } = setup({ snapshot: room });
    expect(result.current.inCall).toEqual([
      { uid: SELF, name: "Me", muted: false },
      { uid: "u1", name: "Ann", muted: false },
      { uid: "u2", name, muted: false },
    ]);
    await act(async () => {
      await result.current.join();
    });
    // The roster is exactly the real in-call players: a peer (link) for each, none for "ghost".
    expect(Object.keys(result.current.links).sort()).toEqual(["u1", "u2"]);
    expect(result.current.inCall.map((person) => person.uid)).toEqual([SELF, "u1", "u2"]);
  });

  it("a renamed player (the same uid, a hostile name) changes the list, not who is in it", () => {
    const room = (name: string) =>
      snapshot(
        [
          { uid: SELF, name: "Me", voice: "live" },
          { uid: "u1", name, voice: "live" },
        ],
        [SELF, "u1"],
      );
    const { result, rerender } = setup({ snapshot: room("Ann") });
    const hostile = "Ann\u0001live\u0000zz\u0001live\u0001Zed";
    rerender({ snapshot: room(hostile), authenticated: true });
    expect(result.current.inCall.map((person) => person.uid)).toEqual([SELF, "u1"]);
    expect(result.current.inCall[1].name).toBe(hostile);
  });
});
