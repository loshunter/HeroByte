// The table-default half of sight: the ONE resolver both halves of the app
// call, and the coercer that stands between an on-disk file and the geometry.
// The feet->document conversion (`tokenVisionRadius`) is covered in
// visibility.test.ts, which is where S7 put it.

import { describe, it, expect } from "vitest";
import { coerceDefaultVisionRadius, effectiveVisionRadiusFeet } from "../visionRadius.js";

describe("effectiveVisionRadiusFeet", () => {
  it("uses the token's own radius when it has one", () => {
    expect(effectiveVisionRadiusFeet(30, 60)).toBe(30);
  });

  it("falls back to the table default when the token has none", () => {
    expect(effectiveVisionRadiusFeet(undefined, 60)).toBe(60);
  });

  it("is unlimited when neither the token nor the table sets one", () => {
    expect(effectiveVisionRadiusFeet(undefined, null)).toBeUndefined();
    expect(effectiveVisionRadiusFeet(undefined, undefined)).toBeUndefined();
  });

  // The `??`-not-`||` case. A DM who blinds one token must not have the table
  // default silently give its sight back.
  it("lets an explicit 0 beat the default, because blind is a real setting", () => {
    expect(effectiveVisionRadiusFeet(0, 60)).toBe(0);
  });

  it("applies a default of 0, so a table can start blind", () => {
    expect(effectiveVisionRadiusFeet(undefined, 0)).toBe(0);
  });
});

describe("coerceDefaultVisionRadius", () => {
  it("keeps a finite in-range number", () => {
    expect(coerceDefaultVisionRadius(60)).toBe(60);
  });

  it("keeps 0 rather than treating it as absent", () => {
    expect(coerceDefaultVisionRadius(0)).toBe(0);
  });

  it("clamps rather than rejects, at both ends", () => {
    expect(coerceDefaultVisionRadius(5000)).toBe(1000);
    expect(coerceDefaultVisionRadius(-20)).toBe(0);
  });

  // The path every state file on the production disk takes on the first boot
  // after this ships: no key at all.
  it("reads an absent value as no default", () => {
    expect(coerceDefaultVisionRadius(undefined)).toBeNull();
    expect(coerceDefaultVisionRadius(null)).toBeNull();
  });

  it("reads junk as no default rather than as blind", () => {
    expect(coerceDefaultVisionRadius("60")).toBeNull();
    expect(coerceDefaultVisionRadius(Number.NaN)).toBeNull();
    expect(coerceDefaultVisionRadius(Number.POSITIVE_INFINITY)).toBeNull();
    expect(coerceDefaultVisionRadius({})).toBeNull();
    expect(coerceDefaultVisionRadius([])).toBeNull();
    expect(coerceDefaultVisionRadius(true)).toBeNull();
  });
});
