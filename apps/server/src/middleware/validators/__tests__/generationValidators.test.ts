// ============================================================================
// GENERATION VALIDATOR TESTS (map-studio-generate WS edge)
// ============================================================================

import { describe, it, expect } from "vitest";
import { validateMapStudioGenerateMessage } from "../generationValidators.js";

function message(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    t: "map-studio-generate",
    documentId: "doc-1",
    commandId: "cmd-1",
    recipe: "dungeon",
    seed: 42,
    bounds: { x: 0, y: 0, cols: 16, rows: 12 },
    params: { theme: "stone", density: "medium", secretDoorChance: 0.15 },
    ...overrides,
  };
}

describe("validateMapStudioGenerateMessage", () => {
  it("accepts a well-formed generate message", () => {
    expect(validateMapStudioGenerateMessage(message())).toEqual({ valid: true });
  });

  it("rejects an unknown recipe", () => {
    const result = validateMapStudioGenerateMessage(message({ recipe: "castle" }));
    expect(result.valid).toBe(false);
  });

  it("rejects a non-integer seed", () => {
    expect(validateMapStudioGenerateMessage(message({ seed: 1.5 })).valid).toBe(false);
  });

  it("rejects non-integer bounds", () => {
    const result = validateMapStudioGenerateMessage(
      message({ bounds: { x: 0.5, y: 0, cols: 16, rows: 12 } }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects bounds below the 8×8 floor", () => {
    const result = validateMapStudioGenerateMessage(
      message({ bounds: { x: 0, y: 0, cols: 7, rows: 12 } }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a cell-area product over 16384 even when each side is legal", () => {
    // 200 × 100 = 20000 cells; both sides individually under the 16384 cap.
    const result = validateMapStudioGenerateMessage(
      message({ bounds: { x: 0, y: 0, cols: 200, rows: 100 } }),
    );
    expect(result.valid).toBe(false);
    expect(!result.valid && result.error).toMatch(/16384/);
  });

  it("rejects an out-of-range secretDoorChance", () => {
    const result = validateMapStudioGenerateMessage(
      message({ params: { theme: "stone", density: "medium", secretDoorChance: 1.2 } }),
    );
    expect(result.valid).toBe(false);
  });

  it("caps commandId at 120 so generated element ids stay under the 128-char cap", () => {
    expect(validateMapStudioGenerateMessage(message({ commandId: "x".repeat(120) })).valid).toBe(
      true,
    );
    expect(validateMapStudioGenerateMessage(message({ commandId: "x".repeat(121) })).valid).toBe(
      false,
    );
  });

  it("rejects an unknown density", () => {
    const result = validateMapStudioGenerateMessage(
      message({ params: { theme: "stone", density: "extreme", secretDoorChance: 0.1 } }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects extra fields inside bounds/params but tolerates a stamped top-level field", () => {
    // Nested objects are strict...
    expect(
      validateMapStudioGenerateMessage(
        message({ bounds: { x: 0, y: 0, cols: 16, rows: 12, extra: 1 } }),
      ).valid,
    ).toBe(false);
    // ...the top level is not (the client ack layer stamps fields onto messages).
    expect(validateMapStudioGenerateMessage(message({ stamped: true })).valid).toBe(true);
  });
});
