// Starting the microphone and failing, per failure kind (U10b): the person gets a
// persistent notice worded for the failure (not a blocking alert, not the raw error),
// the control reads OFF, the raw error stays in the console, and the next try clears it.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMicrophone } from "../useMicrophone";
import { __resetMicNoticeForTests, getMicNotice, setMicNotice } from "../micNotice";

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

function stubMediaDevices(getUserMedia: (() => Promise<MediaStream>) | null) {
  Object.defineProperty(navigator, "mediaDevices", {
    value: getUserMedia ? { getUserMedia } : undefined,
    configurable: true,
  });
}

const failure = (name: string) => {
  const error = new Error("RAW-ERROR-TEXT");
  error.name = name;
  return error;
};

let consoleError: ReturnType<typeof vi.spyOn>;
let alertSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  __resetMicNoticeForTests();
  setMicNotice(null);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
});

const start = async (result: { current: ReturnType<typeof useMicrophone> }) => {
  await act(async () => {
    await result.current.toggleMic();
  });
};

it.each([
  ["NotAllowedError", /blocked/i],
  ["NotFoundError", /no microphone found/i],
  ["NotReadableError", /another app/i],
])("%s: a notice for that failure, the control off, no alert", async (name, wording) => {
  stubMediaDevices(() => Promise.reject(failure(name)));
  const { result } = renderHook(() => useMicrophone({ sendMessage: vi.fn() }));

  await start(result);

  expect(getMicNotice()).toMatch(wording);
  expect(getMicNotice()).not.toContain("RAW-ERROR");
  expect(result.current.micEnabled).toBe(false);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalledWith("Mic access error:", expect.any(Error));
});

it("a page with no navigator.mediaDevices is told voice needs https:// or localhost", async () => {
  stubMediaDevices(null);
  const { result } = renderHook(() => useMicrophone({ sendMessage: vi.fn() }));

  await start(result);

  expect(getMicNotice()).toMatch(/https:\/\//);
  expect(getMicNotice()).toMatch(/localhost/);
  expect(result.current.micEnabled).toBe(false);
  expect(alertSpy).not.toHaveBeenCalled();
});

it("keeps the notice until the next try, then clears it", async () => {
  stubMediaDevices(() => Promise.reject(failure("NotAllowedError")));
  const { result } = renderHook(() => useMicrophone({ sendMessage: vi.fn() }));
  await start(result);
  expect(getMicNotice()).not.toBeNull();

  // The next try is asking again: the old notice is gone while it waits.
  let resolve: (stream: MediaStream) => void = () => {};
  stubMediaDevices(() => new Promise<MediaStream>((r) => (resolve = r)));
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = result.current.toggleMic();
  });
  expect(getMicNotice()).toBeNull();
  resolve({ getTracks: () => [] } as unknown as MediaStream);
  await act(async () => {
    await pending.catch(() => {});
  });
});
