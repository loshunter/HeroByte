import { describe, it, expect } from "vitest";
import { PROP_CREATE_LIMITS } from "@herobyte/shared";
import {
  validateCreatePropMessage,
  validateSetPlayerPropsEnabledMessage,
} from "../propValidators.js";

const baseCreate = {
  t: "create-prop",
  label: "Chest",
  imageUrl: "chest.png",
  owner: null,
  size: "medium",
  viewport: { x: 0, y: 0, scale: 1 },
};

describe("validateCreatePropMessage — count (scatter)", () => {
  it("accepts an absent count and both range ends", () => {
    expect(validateCreatePropMessage(baseCreate).valid).toBe(true);
    expect(
      validateCreatePropMessage({ ...baseCreate, count: PROP_CREATE_LIMITS.COUNT_MIN }).valid,
    ).toBe(true);
    expect(
      validateCreatePropMessage({ ...baseCreate, count: PROP_CREATE_LIMITS.COUNT_MAX }).valid,
    ).toBe(true);
  });

  it("rejects out-of-range, fractional, and non-numeric counts", () => {
    // The handler LOOPS on this value, and route() runs AFTER validation, so
    // this suite is the only gate a hostile count ever meets.
    expect(validateCreatePropMessage({ ...baseCreate, count: 0 }).valid).toBe(false);
    expect(
      validateCreatePropMessage({ ...baseCreate, count: PROP_CREATE_LIMITS.COUNT_MAX + 1 }).valid,
    ).toBe(false);
    expect(validateCreatePropMessage({ ...baseCreate, count: 2.5 }).valid).toBe(false);
    expect(validateCreatePropMessage({ ...baseCreate, count: "6" }).valid).toBe(false);
    expect(validateCreatePropMessage({ ...baseCreate, count: Number.NaN }).valid).toBe(false);
    // Number.isInteger(1e308) is true — the RANGE is what does the bounding.
    expect(validateCreatePropMessage({ ...baseCreate, count: 1e308 }).valid).toBe(false);
  });
});

describe("validateSetPlayerPropsEnabledMessage", () => {
  it("accepts exactly a boolean", () => {
    expect(
      validateSetPlayerPropsEnabledMessage({ t: "set-player-props-enabled", enabled: true }).valid,
    ).toBe(true);
    expect(
      validateSetPlayerPropsEnabledMessage({ t: "set-player-props-enabled", enabled: false }).valid,
    ).toBe(true);
  });

  it('rejects truthiness impostors — "true", 1, and absence', () => {
    // This flag ADMITS writes; a validator that let "true" through would make
    // the capability settable by any client that can spell a string.
    expect(
      validateSetPlayerPropsEnabledMessage({ t: "set-player-props-enabled", enabled: "true" })
        .valid,
    ).toBe(false);
    expect(
      validateSetPlayerPropsEnabledMessage({ t: "set-player-props-enabled", enabled: 1 }).valid,
    ).toBe(false);
    expect(validateSetPlayerPropsEnabledMessage({ t: "set-player-props-enabled" }).valid).toBe(
      false,
    );
  });
});
