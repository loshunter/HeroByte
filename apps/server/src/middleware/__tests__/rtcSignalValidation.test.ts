import { describe, expect, it } from "vitest";
import { validateMessage } from "../validation.js";

describe("rtc-signal validation", () => {
  const rtc = (signal: unknown) => validateMessage({ t: "rtc-signal", target: "uid-2", signal });

  it("accepts a normal object signal", () => {
    expect(rtc({ type: "offer", sdp: "v=0\r\n".repeat(200) })).toEqual({ valid: true });
    expect(
      rtc({ candidate: { candidate: "candidate:1 1 udp 2122 10.0.0.1 5000 typ host" } }),
    ).toEqual({ valid: true });
  });

  it("keeps the missing-signal error for an absent signal", () => {
    expect(validateMessage({ t: "rtc-signal", target: "uid-2" })).toEqual({
      valid: false,
      error: "rtc-signal: missing signal data",
    });
  });

  it("rejects a signal that is a string, a number or null", () => {
    for (const signal of ["offer", 7, null, true]) {
      expect(rtc(signal).valid).toBe(false);
    }
  });

  it("rejects an over-size object, at the exact boundary", () => {
    // {"s":"..."} is 8 characters of JSON around the payload.
    const sized = (chars: number) => ({ s: "x".repeat(chars - 8) });
    expect(JSON.stringify(sized(16384)).length).toBe(16384);
    expect(rtc(sized(16384))).toEqual({ valid: true });
    expect(rtc(sized(16385))).toEqual({ valid: false, error: "rtc-signal: signal too large" });
    expect(rtc({ s: "x".repeat(500_000) }).valid).toBe(false);
  });
});
