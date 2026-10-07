// The other players' voices: one <audio data-voice-peer> per person in a hidden
// holder; a play() the browser refuses (NotAllowedError) turns `blocked` on and the
// next press or key anywhere starts every voice again; detach and clear let go.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RemoteAudio } from "../remoteAudio";

const stream = (id: string) => ({ id }) as unknown as MediaStream;
const notAllowed = () => new DOMException("play() needs a gesture", "NotAllowedError");

let play: ReturnType<typeof vi.spyOn>;
let made: RemoteAudio[] = [];
// Every instance is cleared after its test, or a blocked one keeps its document
// listener and plays its elements on the next test's press.
const make = (onBlocked: (blocked: boolean) => void) => {
  const remote = new RemoteAudio(onBlocked);
  made.push(remote);
  return remote;
};
let pause: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  made.forEach((remote) => remote.clear());
  made = [];
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const audioFor = (uid: string) =>
  document.querySelectorAll<HTMLAudioElement>(`audio[data-voice-peer="${uid}"]`);
const press = () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
const key = () =>
  document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));

describe("attach / detach", () => {
  it("plays each peer in its own autoplay <audio> inside one hidden holder", () => {
    const remote = make(vi.fn());
    remote.attach("p1", stream("s1"));
    remote.attach("p2", stream("s2"));
    const holder = document.querySelector<HTMLElement>('[data-testid="voice-audio"]');
    expect(holder).not.toBeNull();
    expect(holder!.hidden).toBe(true);
    const [one] = audioFor("p1");
    expect(one.parentElement).toBe(holder);
    expect(one.autoplay).toBe(true);
    expect(one.srcObject).toEqual(stream("s1"));
    expect(audioFor("p2")).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="voice-audio"]')).toHaveLength(1);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("a new stream for the same peer replaces the element (never two)", () => {
    const remote = make(vi.fn());
    remote.attach("p1", stream("s1"));
    const first = audioFor("p1")[0];
    remote.attach("p1", stream("s2"));
    expect(audioFor("p1")).toHaveLength(1);
    expect(first.isConnected).toBe(false);
    expect(audioFor("p1")[0].srcObject).toEqual(stream("s2"));
  });

  it("detach stops and removes that peer's element only", () => {
    const remote = make(vi.fn());
    remote.attach("p1", stream("s1"));
    remote.attach("p2", stream("s2"));
    const gone = audioFor("p1")[0];
    remote.detach("p1");
    expect(pause).toHaveBeenCalled();
    expect(gone.isConnected).toBe(false);
    expect(gone.srcObject).toBeNull();
    expect(audioFor("p2")).toHaveLength(1);
  });

  it("clear removes every element and the holder", () => {
    const remote = make(vi.fn());
    remote.attach("p1", stream("s1"));
    remote.attach("p2", stream("s2"));
    remote.clear();
    expect(document.querySelectorAll("audio")).toHaveLength(0);
    expect(document.querySelector('[data-testid="voice-audio"]')).toBeNull();
  });
});

describe("blocked playback", () => {
  it("a play() refused with NotAllowedError reports blocked once", async () => {
    play.mockImplementation(() => Promise.reject(notAllowed()));
    const onBlocked = vi.fn();
    const remote = make(onBlocked);
    remote.attach("p1", stream("s1"));
    remote.attach("p2", stream("s2"));
    await flush();
    expect(onBlocked.mock.calls).toEqual([[true]]);
  });

  it("another play() failure (AbortError) is not 'blocked'", async () => {
    play.mockImplementation(() => Promise.reject(new DOMException("aborted", "AbortError")));
    const onBlocked = vi.fn();
    const remote = make(onBlocked);
    remote.attach("p1", stream("s1"));
    await flush();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("the next press anywhere unblocks and plays every voice again", async () => {
    play.mockImplementation(() => Promise.reject(notAllowed()));
    const onBlocked = vi.fn();
    const remote = make(onBlocked);
    remote.attach("p1", stream("s1"));
    remote.attach("p2", stream("s2"));
    await flush();
    play.mockClear();
    play.mockImplementation(() => Promise.resolve());
    press();
    expect(onBlocked.mock.calls).toEqual([[true], [false]]);
    expect(play).toHaveBeenCalledTimes(2);
    // The listener is gone once resumed: another press plays nothing.
    press();
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("a key press unblocks too", async () => {
    play.mockImplementation(() => Promise.reject(notAllowed()));
    const onBlocked = vi.fn();
    const remote = make(onBlocked);
    remote.attach("p1", stream("s1"));
    await flush();
    play.mockImplementation(() => Promise.resolve());
    key();
    expect(onBlocked.mock.calls).toEqual([[true], [false]]);
  });

  it("resume() (the tap-to-hear control) plays again; it does nothing when not blocked", async () => {
    const onBlocked = vi.fn();
    const remote = make(onBlocked);
    remote.attach("p1", stream("s1"));
    await flush();
    play.mockClear();
    remote.resume();
    expect(play).not.toHaveBeenCalled();
    play.mockImplementation(() => Promise.reject(notAllowed()));
    remote.attach("p2", stream("s2"));
    await flush();
    play.mockClear();
    play.mockImplementation(() => Promise.resolve());
    remote.resume();
    expect(play).toHaveBeenCalledTimes(2);
    expect(onBlocked.mock.calls).toEqual([[true], [false]]);
  });

  it("detaching the last voice clears blocked", async () => {
    play.mockImplementation(() => Promise.reject(notAllowed()));
    const onBlocked = vi.fn();
    const remote = make(onBlocked);
    remote.attach("p1", stream("s1"));
    await flush();
    remote.detach("p1");
    expect(onBlocked.mock.calls).toEqual([[true], [false]]);
  });

  it("clear clears blocked and removes the gesture listener", async () => {
    play.mockImplementation(() => Promise.reject(notAllowed()));
    const onBlocked = vi.fn();
    const remote = make(onBlocked);
    remote.attach("p1", stream("s1"));
    await flush();
    remote.clear();
    expect(onBlocked.mock.calls).toEqual([[true], [false]]);
    press();
    expect(onBlocked.mock.calls).toEqual([[true], [false]]);
  });
});
