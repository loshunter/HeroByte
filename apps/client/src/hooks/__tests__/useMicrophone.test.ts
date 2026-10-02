// useMicrophone: what the hook does when starting the microphone goes wrong.
// A stream the browser handed over must never be left running when the setup after
// it fails: the browser's "mic in use" indicator would stay lit with no control in
// the app able to turn it off.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMicrophone } from "../useMicrophone";

function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream, stop };
}

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
const originalAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext;

function stubMediaDevices(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  (globalThis as { AudioContext?: unknown }).AudioContext = originalAudioContext;
});

it("starts the mic once when it is pressed twice before the first start settles", async () => {
  // Two clicks before getUserMedia resolves used to start it twice: two streams, two level loops,
  // and a mute that stopped only the second (the other stayed live and kept reporting levels).
  let resolve: (stream: MediaStream) => void = () => {};
  const getUserMedia = vi.fn(() => new Promise<MediaStream>((r) => (resolve = r)));
  stubMediaDevices(getUserMedia);
  const { stream } = fakeStream();
  (globalThis as { AudioContext?: unknown }).AudioContext = function () {
    return {
      createAnalyser: () => ({ fftSize: 0, frequencyBinCount: 4, getByteFrequencyData: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {} }),
      close: () => Promise.resolve(),
    };
  };
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
  const { result } = renderHook(() => useMicrophone({ sendMessage: vi.fn() }));

  let first: Promise<void> = Promise.resolve();
  let second: Promise<void> = Promise.resolve();
  act(() => {
    first = result.current.toggleMic();
    second = result.current.toggleMic();
  });
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  resolve(stream);
  await act(async () => {
    await Promise.all([first, second]);
  });
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  expect(result.current.micEnabled).toBe(true);
});

it("a mute stops the stream, the level loop and the audio context, and a restart uses a new stream", async () => {
  const a = fakeStream();
  const b = fakeStream();
  const getUserMedia = vi
    .fn<() => Promise<MediaStream>>()
    .mockResolvedValueOnce(a.stream)
    .mockResolvedValueOnce(b.stream);
  stubMediaDevices(getUserMedia);
  const close = vi.fn(() => Promise.resolve());
  (globalThis as { AudioContext?: unknown }).AudioContext = function () {
    return {
      createAnalyser: () => ({ fftSize: 0, frequencyBinCount: 4, getByteFrequencyData: () => {} }),
      createMediaStreamSource: () => ({ connect: () => {} }),
      close,
    };
  };
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
  const cancel = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  const sendMessage = vi.fn();
  const { result } = renderHook(() => useMicrophone({ sendMessage }));
  const press = () =>
    act(async () => {
      await result.current.toggleMic();
    });
  await press();
  expect(result.current.micEnabled).toBe(true);
  await press();
  expect(result.current.micEnabled).toBe(false);
  // The browser's mic light goes out only when every track is stopped.
  expect(a.stop).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalledWith(1);
  expect(sendMessage).toHaveBeenLastCalledWith({ t: "mic-level", level: 0 });
  await press();
  expect(getUserMedia).toHaveBeenCalledTimes(2);
  expect(result.current.micEnabled).toBe(true);
  expect(result.current.micStream).toBe(b.stream);
  expect(b.stop).not.toHaveBeenCalled();
});

it("allows another try after a failed start (the guard is released)", async () => {
  const error = Object.assign(new Error("denied"), { name: "NotAllowedError" });
  const getUserMedia = vi.fn(() => Promise.reject(error));
  stubMediaDevices(getUserMedia);
  const { result } = renderHook(() => useMicrophone({ sendMessage: vi.fn() }));
  await act(async () => {
    await result.current.toggleMic();
  });
  await act(async () => {
    await result.current.toggleMic();
  });
  expect(getUserMedia).toHaveBeenCalledTimes(2);
});

it("closes the audio context it created when the setup after it throws", async () => {
  const { stream, stop } = fakeStream();
  stubMediaDevices(() => Promise.resolve(stream));
  const close = vi.fn(() => Promise.resolve());
  (globalThis as { AudioContext?: unknown }).AudioContext = function () {
    return {
      createAnalyser: () => {
        throw new Error("analyser failed");
      },
      close,
    };
  };
  const { result } = renderHook(() => useMicrophone({ sendMessage: vi.fn() }));
  await act(async () => {
    await result.current.toggleMic();
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(stop).toHaveBeenCalledTimes(2);
  expect(result.current.micEnabled).toBe(false);
});

it("stops the stream it was handed when the audio setup after it throws, and reads off", async () => {
  const { stream, stop } = fakeStream();
  stubMediaDevices(() => Promise.resolve(stream));
  (globalThis as { AudioContext?: unknown }).AudioContext = function () {
    throw new Error("AudioContext is not allowed to start");
  };
  const sendMessage = vi.fn();
  const { result } = renderHook(() => useMicrophone({ sendMessage }));

  await act(async () => {
    await result.current.toggleMic();
  });

  expect(stop).toHaveBeenCalledTimes(2);
  expect(result.current.micEnabled).toBe(false);
  expect(result.current.micStream).toBeNull();
});

it("does not keep the stopped stream in state when the first level read throws", async () => {
  const { stream, stop } = fakeStream();
  stubMediaDevices(() => Promise.resolve(stream));
  (globalThis as { AudioContext?: unknown }).AudioContext = function () {
    return {
      createAnalyser: () => ({
        fftSize: 0,
        frequencyBinCount: 4,
        getByteFrequencyData: () => {
          throw new Error("read failed");
        },
      }),
      createMediaStreamSource: () => ({ connect: () => {} }),
      close: () => Promise.resolve(),
    };
  };
  const { result } = renderHook(() => useMicrophone({ sendMessage: vi.fn() }));
  await act(async () => {
    await result.current.toggleMic();
  });
  expect(stop).toHaveBeenCalledTimes(2);
  expect(result.current.micEnabled).toBe(false);
  expect(result.current.micStream).toBeNull();
});
