import { afterEach, describe, expect, it } from "vitest";
import { getDefaultRoomClearMs } from "../auth.js";

/**
 * The escape hatch that matters: a self-hoster whose server is private may run
 * their whole campaign in the default table, where an auto-wipe is data loss.
 */
describe("getDefaultRoomClearMs", () => {
  const original = process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS;

  afterEach(() => {
    if (original === undefined) delete process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS;
    else process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS = original;
  });

  it("defaults to 1 hour", () => {
    delete process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS;
    expect(getDefaultRoomClearMs()).toBe(60 * 60 * 1000);
  });

  it("honours a custom window", () => {
    process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS = "12";
    expect(getDefaultRoomClearMs()).toBe(12 * 60 * 60 * 1000);
  });

  it("accepts a fractional window", () => {
    process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS = "0.5";
    expect(getDefaultRoomClearMs()).toBe(30 * 60 * 1000);
  });

  it("treats 0 as 'never clear' rather than 'clear immediately'", () => {
    // The whole point of the knob: 0 must disable the sweep, not make it
    // fire on every pass and destroy the table continuously.
    process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS = "0";
    expect(getDefaultRoomClearMs()).toBe(0);
  });

  it("falls back to the default for junk or negative values", () => {
    for (const value of ["", "   ", "abc", "-3"]) {
      process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS = value;
      expect(getDefaultRoomClearMs()).toBe(60 * 60 * 1000);
    }
  });
});
