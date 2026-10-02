// What a person is told when the microphone will not start (U10b). The message names
// the FAILURE and what to do, not the raw browser error; Safari's own route is added
// only for Safari; and a page with no navigator.mediaDevices (plain http:// on a LAN
// address) is told it needs https:// or localhost.
import { expect, it } from "vitest";
import { afterEach, vi } from "vitest";
import { describeMicFailure, readMicEnvironment } from "../micFailure";

const chrome = { hasMediaDevices: true, isSafari: false };
const safari = { hasMediaDevices: true, isSafari: true };
const named = (name: string, message = "raw browser text") => {
  const error = new Error(message);
  error.name = name;
  return error;
};

it.each(["NotAllowedError", "PermissionDeniedError", "SecurityError"])(
  "%s: says it is blocked and how to allow it for this site",
  (name) => {
    const text = describeMicFailure(named(name), chrome);
    expect(text).toMatch(/blocked/i);
    expect(text).toMatch(/settings/i);
    expect(text).toMatch(/address bar/i);
    expect(text).toMatch(/try again/i);
  },
);

it.each(["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"])(
  "%s: says no microphone was found",
  (name) => {
    expect(describeMicFailure(named(name), chrome)).toMatch(/no microphone found/i);
  },
);

it.each(["NotReadableError", "TrackStartError"])(
  "%s: says it would not start, and if another app has it to close that app",
  (name) => {
    const text = describeMicFailure(named(name), chrome);
    expect(text).toMatch(/would not start/i);
    expect(text).toMatch(/another app/i);
    expect(text).toMatch(/close it/i);
    // It is a hardware/OS/browser fault as often as a busy device: never stated as fact.
    expect(text).toMatch(/If another app is using it/);
  },
);

it("AbortError is not blamed on another app (it is not a busy-device error)", () => {
  expect(describeMicFailure(named("AbortError"), chrome)).toMatch(/could not start/i);
  expect(describeMicFailure(named("AbortError"), chrome)).not.toMatch(/another app/i);
});

it("blocked: names the browser's site setting AND the computer's own privacy settings", () => {
  const text = describeMicFailure(named("NotAllowedError"), chrome);
  expect(text).toMatch(/privacy settings/i);
});

it("says voice needs https:// or localhost when the page has no media devices at all", () => {
  const text = describeMicFailure(new TypeError("Cannot read properties of undefined"), {
    hasMediaDevices: false,
    isSafari: false,
  });
  expect(text).toMatch(/https:\/\//);
  expect(text).toMatch(/localhost/);
});

it("falls back to a generic line for an unknown failure", () => {
  const text = describeMicFailure(named("WeirdError"), chrome);
  expect(text).toMatch(/could not start/i);
  expect(text).toMatch(/try again/i);
});

it("never shows the raw error text", () => {
  for (const name of ["NotAllowedError", "NotFoundError", "NotReadableError", "WeirdError"]) {
    expect(describeMicFailure(named(name, "RAW-ERROR-TEXT"), chrome)).not.toContain("RAW-ERROR");
  }
  expect(describeMicFailure("a string, not an Error", chrome)).not.toContain("a string");
});

it("gives Safari its own route (it has no address-bar icon), only for Safari, only for a blocked mic", () => {
  const safariText = describeMicFailure(named("NotAllowedError"), safari);
  expect(safariText).toMatch(/Safari > Settings > Websites > Microphone/);
  expect(safariText).not.toMatch(/address bar/i);
  expect(describeMicFailure(named("NotAllowedError"), chrome)).not.toMatch(/Safari/);
  expect(describeMicFailure(named("NotFoundError"), safari)).not.toMatch(/Safari/);
});

// Chrome's user agent contains "Safari", and an iPad reports a Mac: the detection is what keeps
// the Mac-Safari menu path off both.
const originalUserAgent = Object.getOwnPropertyDescriptor(navigator, "userAgent");
const originalTouch = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
afterEach(() => {
  vi.restoreAllMocks();
  if (originalUserAgent) Object.defineProperty(navigator, "userAgent", originalUserAgent);
  if (originalTouch) Object.defineProperty(navigator, "maxTouchPoints", originalTouch);
});
const withAgent = (agent: string, touchPoints: number | undefined = 0) => {
  Object.defineProperty(navigator, "userAgent", { value: agent, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: touchPoints, configurable: true });
  return readMicEnvironment().isSafari;
};
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

it.each([
  ["Safari on a Mac", SAFARI_MAC, 0, true],
  [
    "Chrome (its agent also says Safari)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    0,
    false,
  ],
  [
    "Edge",
    "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/124.0 Safari/537.36 Edg/124.0",
    0,
    false,
  ],
  [
    "Chrome on iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 CriOS/124.0 Mobile/15E148 Safari/604.1",
    5,
    false,
  ],
  [
    "Firefox on iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 FxiOS/124.0 Mobile/15E148 Safari/605.1.15",
    5,
    false,
  ],
  [
    "Safari on an iPhone",
    SAFARI_MAC.replace("Macintosh; Intel Mac OS X 10_15_7", "iPhone"),
    5,
    false,
  ],
  ["Safari on an iPad (reports a Mac)", SAFARI_MAC, 5, false],
  [
    "Safari on an iPhone where maxTouchPoints is unavailable (only the agent can say)",
    SAFARI_MAC.replace("Macintosh; Intel Mac OS X 10_15_7", "iPhone"),
    undefined,
    false,
  ],
])("detects %s", (_name, agent, touchPoints, expected) => {
  expect(withAgent(agent, touchPoints)).toBe(expected);
});
