import { describe, it, expect } from "vitest";
import {
  validateRollInitiativeMessage,
  validateRollInitiativeAllMessage,
  validateSetInitiativeManualOverrideMessage,
} from "../initiativeValidators.js";
import { validateMessage } from "../../validation.js";

describe("validateRollInitiativeMessage", () => {
  it("accepts a message carrying only a target", () => {
    expect(validateRollInitiativeMessage({ t: "roll-initiative", characterId: "char-1" })).toEqual({
      valid: true,
    });
  });

  it("rejects a missing, empty, or non-string characterId", () => {
    expect(validateRollInitiativeMessage({ t: "roll-initiative" }).valid).toBe(false);
    expect(validateRollInitiativeMessage({ t: "roll-initiative", characterId: "" }).valid).toBe(
      false,
    );
    expect(validateRollInitiativeMessage({ t: "roll-initiative", characterId: 7 }).valid).toBe(
      false,
    );
    expect(validateRollInitiativeMessage({ t: "roll-initiative", characterId: null }).valid).toBe(
      false,
    );
  });

  it("ignores any result a client tries to smuggle alongside the target", () => {
    // The whole point of this message: the server rolls. A client that sends
    // an initiative or a total is not rejected — those fields are simply not
    // read — but the validator must not start depending on them either, or the
    // shape drifts back toward the forgeable one dice had to be rescued from.
    const withJunk = {
      t: "roll-initiative",
      characterId: "char-1",
      initiative: 20,
      total: 20,
      formula: "1d20",
    };
    expect(validateRollInitiativeMessage(withJunk)).toEqual({ valid: true });
  });

  it("accepts an optional modifier, including a negative one and zero", () => {
    // A modifier is a character stat, not a result — the exception the message
    // carries so that dragging the dial and rolling can be one gesture.
    for (const modifier of [5, -3, 0]) {
      expect(
        validateRollInitiativeMessage({ t: "roll-initiative", characterId: "char-1", modifier }),
      ).toEqual({ valid: true });
    }
  });

  it("rejects a non-finite or non-numeric modifier", () => {
    for (const modifier of ["3", NaN, Infinity, null, {}]) {
      expect(
        validateRollInitiativeMessage({ t: "roll-initiative", characterId: "char-1", modifier })
          .valid,
      ).toBe(false);
    }
  });

  it("rejects a modifier outside the range both client editors clamp to", () => {
    // The hole this closed: `{ modifier: 9999 }` on a hand-crafted socket
    // message stored an initiative of ~10000 and made every later roll 9999+,
    // at a table whose DM had turned hand-entry OFF precisely to stop players
    // choosing their own number.
    for (const modifier of [21, -21, 9999, 1e308]) {
      expect(
        validateRollInitiativeMessage({ t: "roll-initiative", characterId: "char-1", modifier })
          .valid,
      ).toBe(false);
    }
  });

  it("accepts the exact endpoints, so the dial's own extremes still work", () => {
    for (const modifier of [20, -20]) {
      expect(
        validateRollInitiativeMessage({ t: "roll-initiative", characterId: "char-1", modifier }),
      ).toEqual({ valid: true });
    }
  });

  it("rejects a fractional modifier", () => {
    // A d20 bonus is a whole number, and a fraction would render as one in the
    // formula ("d20 + 2.5") while summing as another.
    expect(
      validateRollInitiativeMessage({ t: "roll-initiative", characterId: "char-1", modifier: 2.5 })
        .valid,
    ).toBe(false);
  });

  it("still accepts a message with no modifier at all, meaning 'use the stored one'", () => {
    expect(
      validateRollInitiativeMessage({
        t: "roll-initiative",
        characterId: "char-1",
        modifier: undefined,
      }),
    ).toEqual({ valid: true });
  });
});

describe("validateRollInitiativeAllMessage", () => {
  it("accepts a message with no fields at all", () => {
    expect(validateRollInitiativeAllMessage()).toEqual({ valid: true });
  });
});

describe("validateSetInitiativeManualOverrideMessage", () => {
  it("accepts both booleans", () => {
    expect(
      validateSetInitiativeManualOverrideMessage({
        t: "set-initiative-manual-override",
        enabled: true,
      }),
    ).toEqual({ valid: true });
    expect(
      validateSetInitiativeManualOverrideMessage({
        t: "set-initiative-manual-override",
        enabled: false,
      }),
    ).toEqual({ valid: true });
  });

  it("rejects anything that is not a boolean, including the strings that look like one", () => {
    const bad = ["true", "false", 1, 0, null, undefined];
    for (const enabled of bad) {
      expect(
        validateSetInitiativeManualOverrideMessage({ t: "set-initiative-manual-override", enabled })
          .valid,
      ).toBe(false);
    }
  });
});

// Registering a validator is what the type system forces; registering the RIGHT
// one is not. These go through the dispatcher's own entry point, so a swapped
// or misspelled registry key fails here rather than in production.
describe("the registry routes each rolling message to its own validator", () => {
  it("routes roll-initiative", () => {
    expect(validateMessage({ t: "roll-initiative", characterId: "char-1" }).valid).toBe(true);
    expect(validateMessage({ t: "roll-initiative" }).valid).toBe(false);
  });

  it("routes roll-initiative-all", () => {
    expect(validateMessage({ t: "roll-initiative-all" }).valid).toBe(true);
  });

  it("routes set-initiative-manual-override", () => {
    expect(validateMessage({ t: "set-initiative-manual-override", enabled: false }).valid).toBe(
      true,
    );
    expect(validateMessage({ t: "set-initiative-manual-override", enabled: "yes" }).valid).toBe(
      false,
    );
  });
});
