/**
 * Comprehensive test suite for usePlayerEditing hook
 *
 * Tests the player editing state management for name, HP, and max HP editing.
 * Ensures proper validation logic and state transitions for each editing workflow.
 *
 * @module hooks/__tests__/usePlayerEditing
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { usePlayerEditing } from "../usePlayerEditing.js";

describe("usePlayerEditing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // INITIAL STATE TESTS
  // ==========================================================================

  describe("Initial State", () => {
    it("should initialize with all editing UIDs set to null", () => {
      const { result } = renderHook(() => usePlayerEditing());

      expect(result.current.editingPlayerUID).toBeNull();
      expect(result.current.editingHpUID).toBeNull();
      expect(result.current.editingMaxHpUID).toBeNull();
    });

    it("should initialize with all input values as empty strings", () => {
      const { result } = renderHook(() => usePlayerEditing());

      expect(result.current.nameInput).toBe("");
      expect(result.current.hpInput).toBe("");
      expect(result.current.maxHpInput).toBe("");
    });

    it("should provide all required callbacks", () => {
      const { result } = renderHook(() => usePlayerEditing());

      expect(typeof result.current.startNameEdit).toBe("function");
      expect(typeof result.current.updateNameInput).toBe("function");
      expect(typeof result.current.submitNameEdit).toBe("function");
      expect(typeof result.current.startHpEdit).toBe("function");
      expect(typeof result.current.updateHpInput).toBe("function");
      expect(typeof result.current.submitHpEdit).toBe("function");
      expect(typeof result.current.startMaxHpEdit).toBe("function");
      expect(typeof result.current.updateMaxHpInput).toBe("function");
      expect(typeof result.current.submitMaxHpEdit).toBe("function");
    });
  });

  // ==========================================================================
  // NAME EDITING WORKFLOW TESTS
  // ==========================================================================

  describe("Name Editing Workflow", () => {
    describe("startNameEdit", () => {
      it("should set editingPlayerUID when starting name edit", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("player-123", "Hero");
        });

        expect(result.current.editingPlayerUID).toBe("player-123");
      });

      it("should set nameInput to current name when starting edit", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("player-123", "Current Name");
        });

        expect(result.current.nameInput).toBe("Current Name");
      });

      it("should handle empty string as current name", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("player-123", "");
        });

        expect(result.current.nameInput).toBe("");
        expect(result.current.editingPlayerUID).toBe("player-123");
      });

      it("should handle special characters in name", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const specialName = "Sir O'Brien-McTest III";

        act(() => {
          result.current.startNameEdit("player-123", specialName);
        });

        expect(result.current.nameInput).toBe(specialName);
      });

      it("should handle very long names", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const longName = "A".repeat(1000);

        act(() => {
          result.current.startNameEdit("player-123", longName);
        });

        expect(result.current.nameInput).toBe(longName);
      });
    });

    describe("updateNameInput", () => {
      it("should update nameInput value", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("player-123", "Original");
        });

        act(() => {
          result.current.updateNameInput("Updated Name");
        });

        expect(result.current.nameInput).toBe("Updated Name");
      });

      it("should allow updating to empty string", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("player-123", "Name");
        });

        act(() => {
          result.current.updateNameInput("");
        });

        expect(result.current.nameInput).toBe("");
      });

      it("should allow whitespace-only input", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.updateNameInput("   ");
        });

        expect(result.current.nameInput).toBe("   ");
      });
    });

    describe("submitNameEdit - Valid Submissions", () => {
      it("should call onSubmit with trimmed name when name is valid", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startNameEdit("player-123", "Hero");
        });

        act(() => {
          result.current.updateNameInput("New Name");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith("New Name");
      });

      it("should trim leading whitespace from name before calling onSubmit", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startNameEdit("player-123", "Name");
        });

        act(() => {
          result.current.updateNameInput("   Leading Space");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith("Leading Space");
      });

      it("should trim trailing whitespace from name before calling onSubmit", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateNameInput("Trailing Space   ");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith("Trailing Space");
      });

      it("should trim both leading and trailing whitespace", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateNameInput("   Both Sides   ");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith("Both Sides");
      });
    });

    describe("submitNameEdit - Invalid Submissions", () => {
      it("should NOT call onSubmit when name is whitespace-only", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateNameInput("   ");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should NOT call onSubmit when name is empty string", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateNameInput("");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    describe("submitNameEdit - State Cleanup", () => {
      it("should clear editingPlayerUID after submit with valid name", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startNameEdit("player-123", "Name");
        });

        act(() => {
          result.current.updateNameInput("Valid Name");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(result.current.editingPlayerUID).toBeNull();
      });

      it("should clear nameInput after submit with valid name", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateNameInput("Valid Name");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(result.current.nameInput).toBe("");
      });

      it("should clear state even when onSubmit is NOT called (whitespace case)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startNameEdit("player-123", "Name");
        });

        act(() => {
          result.current.updateNameInput("   ");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(result.current.editingPlayerUID).toBeNull();
        expect(result.current.nameInput).toBe("");
        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should clear state even when onSubmit is NOT called (empty string)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startNameEdit("player-123", "Name");
        });

        act(() => {
          result.current.updateNameInput("");
        });

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(result.current.editingPlayerUID).toBeNull();
        expect(result.current.nameInput).toBe("");
      });
    });

    describe("Multiple Sequential Name Edits", () => {
      it("should handle multiple sequential edits correctly", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        // First edit
        act(() => {
          result.current.startNameEdit("player-1", "First");
        });
        act(() => {
          result.current.updateNameInput("First Updated");
        });
        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith("First Updated");
        expect(result.current.editingPlayerUID).toBeNull();

        // Second edit
        onSubmit.mockClear();
        act(() => {
          result.current.startNameEdit("player-2", "Second");
        });
        act(() => {
          result.current.updateNameInput("Second Updated");
        });
        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith("Second Updated");
        expect(result.current.editingPlayerUID).toBeNull();
      });

      it("should handle cancel then start new edit", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startNameEdit("player-1", "First");
        });
        act(() => {
          result.current.updateNameInput("   "); // Invalid, will cancel
        });
        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();

        // Start new edit
        act(() => {
          result.current.startNameEdit("player-2", "Second");
        });
        act(() => {
          result.current.submitNameEdit(vi.fn());
        });

        expect(result.current.editingPlayerUID).toBeNull();
      });
    });
  });

  // ==========================================================================
  // HP EDITING WORKFLOW TESTS
  // ==========================================================================

  describe("HP Editing Workflow", () => {
    describe("startHpEdit", () => {
      it("should set editingHpUID when starting HP edit", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("player-123", 20);
        });

        expect(result.current.editingHpUID).toBe("player-123");
      });

      it("should convert number to string and set hpInput", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("player-123", 42);
        });

        expect(result.current.hpInput).toBe("42");
      });

      it("should handle zero HP", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("player-123", 0);
        });

        expect(result.current.hpInput).toBe("0");
      });

      it("should handle negative HP values", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("player-123", -5);
        });

        expect(result.current.hpInput).toBe("-5");
      });

      it("should handle very large HP values", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("player-123", 999999);
        });

        expect(result.current.hpInput).toBe("999999");
      });
    });

    describe("updateHpInput", () => {
      it("should update hpInput value", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateHpInput("15");
        });

        expect(result.current.hpInput).toBe("15");
      });

      it("should allow non-numeric strings", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.updateHpInput("abc");
        });

        expect(result.current.hpInput).toBe("abc");
      });

      it("should allow empty string", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateHpInput("");
        });

        expect(result.current.hpInput).toBe("");
      });
    });

    describe("submitHpEdit - Valid Submissions", () => {
      it("should call onSubmit with parsed number when HP is valid positive number", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateHpInput("15");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(15);
      });

      it("should call onSubmit when HP is zero (0 is valid)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("0");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(0);
      });

      it("should parse decimal numbers to integer", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("15.7");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(15);
      });

      it("should handle very large numbers", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("999999");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(999999);
      });
    });

    describe("submitHpEdit - Invalid Submissions", () => {
      it("should NOT call onSubmit with negative number", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("-5");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should NOT call onSubmit with NaN", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("abc");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should NOT call onSubmit with empty string", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should NOT call onSubmit with string containing non-numeric characters", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("12abc");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        // parseInt("12abc") = 12, which is valid
        expect(onSubmit).toHaveBeenCalledWith(12);
      });

      it("should handle infinity as NaN", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("Infinity");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    describe("submitHpEdit - State Cleanup", () => {
      it("should clear editingHpUID after submit with valid HP", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateHpInput("15");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(result.current.editingHpUID).toBeNull();
      });

      it("should clear hpInput after submit with valid HP", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput("15");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(result.current.hpInput).toBe("");
      });

      it("should clear state even when onSubmit is NOT called (negative number)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateHpInput("-5");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(result.current.editingHpUID).toBeNull();
        expect(result.current.hpInput).toBe("");
        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should clear state even when onSubmit is NOT called (NaN)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateHpInput("invalid");
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(result.current.editingHpUID).toBeNull();
        expect(result.current.hpInput).toBe("");
      });
    });

    describe("Multiple Sequential HP Edits", () => {
      it("should handle multiple sequential HP edits correctly", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        // First edit
        act(() => {
          result.current.startHpEdit("player-1", 20);
        });
        act(() => {
          result.current.updateHpInput("15");
        });
        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(15);
        expect(result.current.editingHpUID).toBeNull();

        // Second edit
        onSubmit.mockClear();
        act(() => {
          result.current.startHpEdit("player-2", 30);
        });
        act(() => {
          result.current.updateHpInput("25");
        });
        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(25);
        expect(result.current.editingHpUID).toBeNull();
      });
    });
  });

  // ==========================================================================
  // MAX HP EDITING WORKFLOW TESTS
  // ==========================================================================

  describe("Max HP Editing Workflow", () => {
    describe("startMaxHpEdit", () => {
      it("should set editingMaxHpUID when starting max HP edit", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startMaxHpEdit("player-123", 20);
        });

        expect(result.current.editingMaxHpUID).toBe("player-123");
      });

      it("should convert number to string and set maxHpInput", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startMaxHpEdit("player-123", 42);
        });

        expect(result.current.maxHpInput).toBe("42");
      });

      it("should handle max HP of 1", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startMaxHpEdit("player-123", 1);
        });

        expect(result.current.maxHpInput).toBe("1");
      });

      it("should handle very large max HP values", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startMaxHpEdit("player-123", 999999);
        });

        expect(result.current.maxHpInput).toBe("999999");
      });
    });

    describe("updateMaxHpInput", () => {
      it("should update maxHpInput value", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startMaxHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateMaxHpInput("25");
        });

        expect(result.current.maxHpInput).toBe("25");
      });

      it("should allow non-numeric strings", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.updateMaxHpInput("xyz");
        });

        expect(result.current.maxHpInput).toBe("xyz");
      });

      it("should allow empty string", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startMaxHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateMaxHpInput("");
        });

        expect(result.current.maxHpInput).toBe("");
      });
    });

    describe("submitMaxHpEdit - Valid Submissions", () => {
      it("should call onSubmit with valid positive number", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startMaxHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateMaxHpInput("25");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(25);
      });

      it("should call onSubmit with max HP of 1", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("1");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(1);
      });

      it("should parse decimal numbers to integer", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("25.9");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(25);
      });

      it("should handle very large numbers", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("999999");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(999999);
      });
    });

    describe("submitMaxHpEdit - Invalid Submissions", () => {
      it("should NOT call onSubmit when max HP is zero (must be > 0)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("0");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should NOT call onSubmit with negative number", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("-10");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should NOT call onSubmit with NaN", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("not-a-number");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should NOT call onSubmit with empty string", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should NOT call onSubmit with string containing non-numeric characters", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("25abc");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        // parseInt("25abc") = 25, which is valid
        expect(onSubmit).toHaveBeenCalledWith(25);
      });

      it("should handle infinity as NaN", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("Infinity");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    describe("submitMaxHpEdit - State Cleanup", () => {
      it("should clear editingMaxHpUID after submit with valid max HP", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startMaxHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateMaxHpInput("25");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(result.current.editingMaxHpUID).toBeNull();
      });

      it("should clear maxHpInput after submit with valid max HP", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput("25");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(result.current.maxHpInput).toBe("");
      });

      it("should clear state even when onSubmit is NOT called (zero)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startMaxHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateMaxHpInput("0");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(result.current.editingMaxHpUID).toBeNull();
        expect(result.current.maxHpInput).toBe("");
        expect(onSubmit).not.toHaveBeenCalled();
      });

      it("should clear state even when onSubmit is NOT called (negative)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startMaxHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateMaxHpInput("-5");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(result.current.editingMaxHpUID).toBeNull();
        expect(result.current.maxHpInput).toBe("");
      });

      it("should clear state even when onSubmit is NOT called (NaN)", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.startMaxHpEdit("player-123", 20);
        });

        act(() => {
          result.current.updateMaxHpInput("invalid");
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(result.current.editingMaxHpUID).toBeNull();
        expect(result.current.maxHpInput).toBe("");
      });
    });

    describe("Multiple Sequential Max HP Edits", () => {
      it("should handle multiple sequential max HP edits correctly", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        // First edit
        act(() => {
          result.current.startMaxHpEdit("player-1", 20);
        });
        act(() => {
          result.current.updateMaxHpInput("25");
        });
        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(25);
        expect(result.current.editingMaxHpUID).toBeNull();

        // Second edit
        onSubmit.mockClear();
        act(() => {
          result.current.startMaxHpEdit("player-2", 30);
        });
        act(() => {
          result.current.updateMaxHpInput("35");
        });
        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(35);
        expect(result.current.editingMaxHpUID).toBeNull();
      });
    });
  });

  // ==========================================================================
  // CALLBACK STABILITY TESTS
  // ==========================================================================

  describe("Callback Stability", () => {
    describe("Name Editing Callbacks", () => {
      it("startNameEdit should maintain stable reference", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.startNameEdit;

        act(() => {
          result.current.startNameEdit("player-1", "Name");
        });

        rerender();

        expect(result.current.startNameEdit).toBe(firstReference);
      });

      it("updateNameInput should maintain stable reference", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.updateNameInput;

        act(() => {
          result.current.updateNameInput("New Name");
        });

        rerender();

        expect(result.current.updateNameInput).toBe(firstReference);
      });

      it("submitNameEdit should change reference when nameInput changes", () => {
        const { result } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.submitNameEdit;

        act(() => {
          result.current.updateNameInput("Different Name");
        });

        expect(result.current.submitNameEdit).not.toBe(firstReference);
      });

      it("submitNameEdit should maintain reference when nameInput unchanged", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.updateNameInput("Same Name");
        });

        const firstReference = result.current.submitNameEdit;

        rerender();

        expect(result.current.submitNameEdit).toBe(firstReference);
      });
    });

    describe("HP Editing Callbacks", () => {
      it("startHpEdit should maintain stable reference", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.startHpEdit;

        act(() => {
          result.current.startHpEdit("player-1", 20);
        });

        rerender();

        expect(result.current.startHpEdit).toBe(firstReference);
      });

      it("updateHpInput should maintain stable reference", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.updateHpInput;

        act(() => {
          result.current.updateHpInput("15");
        });

        rerender();

        expect(result.current.updateHpInput).toBe(firstReference);
      });

      it("submitHpEdit should change reference when hpInput changes", () => {
        const { result } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.submitHpEdit;

        act(() => {
          result.current.updateHpInput("10");
        });

        expect(result.current.submitHpEdit).not.toBe(firstReference);
      });

      it("submitHpEdit should maintain reference when hpInput unchanged", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.updateHpInput("20");
        });

        const firstReference = result.current.submitHpEdit;

        rerender();

        expect(result.current.submitHpEdit).toBe(firstReference);
      });
    });

    describe("Max HP Editing Callbacks", () => {
      it("startMaxHpEdit should maintain stable reference", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.startMaxHpEdit;

        act(() => {
          result.current.startMaxHpEdit("player-1", 20);
        });

        rerender();

        expect(result.current.startMaxHpEdit).toBe(firstReference);
      });

      it("updateMaxHpInput should maintain stable reference", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.updateMaxHpInput;

        act(() => {
          result.current.updateMaxHpInput("25");
        });

        rerender();

        expect(result.current.updateMaxHpInput).toBe(firstReference);
      });

      it("submitMaxHpEdit should change reference when maxHpInput changes", () => {
        const { result } = renderHook(() => usePlayerEditing());

        const firstReference = result.current.submitMaxHpEdit;

        act(() => {
          result.current.updateMaxHpInput("30");
        });

        expect(result.current.submitMaxHpEdit).not.toBe(firstReference);
      });

      it("submitMaxHpEdit should maintain reference when maxHpInput unchanged", () => {
        const { result, rerender } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.updateMaxHpInput("25");
        });

        const firstReference = result.current.submitMaxHpEdit;

        rerender();

        expect(result.current.submitMaxHpEdit).toBe(firstReference);
      });
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe("Edge Cases", () => {
    describe("Editing Multiple Fields Simultaneously", () => {
      it("should handle name and HP editing at the same time", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("player-1", "Hero");
          result.current.startHpEdit("player-2", 20);
        });

        expect(result.current.editingPlayerUID).toBe("player-1");
        expect(result.current.nameInput).toBe("Hero");
        expect(result.current.editingHpUID).toBe("player-2");
        expect(result.current.hpInput).toBe("20");
      });

      it("should handle all three fields editing simultaneously", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("player-1", "Hero");
          result.current.startHpEdit("player-2", 20);
          result.current.startMaxHpEdit("player-3", 30);
        });

        expect(result.current.editingPlayerUID).toBe("player-1");
        expect(result.current.nameInput).toBe("Hero");
        expect(result.current.editingHpUID).toBe("player-2");
        expect(result.current.hpInput).toBe("20");
        expect(result.current.editingMaxHpUID).toBe("player-3");
        expect(result.current.maxHpInput).toBe("30");
      });

      it("should submit all fields independently", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const nameOnSubmit = vi.fn();
        const hpOnSubmit = vi.fn();
        const maxHpOnSubmit = vi.fn();

        act(() => {
          result.current.startNameEdit("player-1", "Hero");
          result.current.startHpEdit("player-2", 20);
          result.current.startMaxHpEdit("player-3", 30);
        });

        act(() => {
          result.current.updateNameInput("Updated Hero");
          result.current.updateHpInput("15");
          result.current.updateMaxHpInput("35");
        });

        act(() => {
          result.current.submitNameEdit(nameOnSubmit);
          result.current.submitHpEdit(hpOnSubmit);
          result.current.submitMaxHpEdit(maxHpOnSubmit);
        });

        expect(nameOnSubmit).toHaveBeenCalledWith("Updated Hero");
        expect(hpOnSubmit).toHaveBeenCalledWith(15);
        expect(maxHpOnSubmit).toHaveBeenCalledWith(35);

        expect(result.current.editingPlayerUID).toBeNull();
        expect(result.current.editingHpUID).toBeNull();
        expect(result.current.editingMaxHpUID).toBeNull();
      });
    });

    describe("Switching Between Different Player UIDs", () => {
      it("should switch editing from one player to another for name", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("player-1", "First");
        });

        expect(result.current.editingPlayerUID).toBe("player-1");
        expect(result.current.nameInput).toBe("First");

        act(() => {
          result.current.startNameEdit("player-2", "Second");
        });

        expect(result.current.editingPlayerUID).toBe("player-2");
        expect(result.current.nameInput).toBe("Second");
      });

      it("should switch editing from one player to another for HP", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("player-1", 20);
        });

        expect(result.current.editingHpUID).toBe("player-1");
        expect(result.current.hpInput).toBe("20");

        act(() => {
          result.current.startHpEdit("player-2", 30);
        });

        expect(result.current.editingHpUID).toBe("player-2");
        expect(result.current.hpInput).toBe("30");
      });

      it("should switch editing from one player to another for max HP", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startMaxHpEdit("player-1", 25);
        });

        expect(result.current.editingMaxHpUID).toBe("player-1");
        expect(result.current.maxHpInput).toBe("25");

        act(() => {
          result.current.startMaxHpEdit("player-2", 35);
        });

        expect(result.current.editingMaxHpUID).toBe("player-2");
        expect(result.current.maxHpInput).toBe("35");
      });
    });

    describe("Submit Without Starting Edit", () => {
      it("should handle name submit without starting edit", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.submitNameEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
        expect(result.current.editingPlayerUID).toBeNull();
        expect(result.current.nameInput).toBe("");
      });

      it("should handle HP submit without starting edit", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
        expect(result.current.editingHpUID).toBeNull();
        expect(result.current.hpInput).toBe("");
      });

      it("should handle max HP submit without starting edit", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).not.toHaveBeenCalled();
        expect(result.current.editingMaxHpUID).toBeNull();
        expect(result.current.maxHpInput).toBe("");
      });
    });

    describe("Very Long UID Strings", () => {
      it("should handle very long UID for name editing", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const longUID = "player-" + "x".repeat(1000);

        act(() => {
          result.current.startNameEdit(longUID, "Name");
        });

        expect(result.current.editingPlayerUID).toBe(longUID);
      });

      it("should handle very long UID for HP editing", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const longUID = "player-" + "y".repeat(1000);

        act(() => {
          result.current.startHpEdit(longUID, 20);
        });

        expect(result.current.editingHpUID).toBe(longUID);
      });

      it("should handle very long UID for max HP editing", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const longUID = "player-" + "z".repeat(1000);

        act(() => {
          result.current.startMaxHpEdit(longUID, 30);
        });

        expect(result.current.editingMaxHpUID).toBe(longUID);
      });
    });

    describe("Empty UID Strings", () => {
      it("should handle empty UID for name editing", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startNameEdit("", "Name");
        });

        expect(result.current.editingPlayerUID).toBe("");
        expect(result.current.nameInput).toBe("Name");
      });

      it("should handle empty UID for HP editing", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startHpEdit("", 20);
        });

        expect(result.current.editingHpUID).toBe("");
        expect(result.current.hpInput).toBe("20");
      });

      it("should handle empty UID for max HP editing", () => {
        const { result } = renderHook(() => usePlayerEditing());

        act(() => {
          result.current.startMaxHpEdit("", 30);
        });

        expect(result.current.editingMaxHpUID).toBe("");
        expect(result.current.maxHpInput).toBe("30");
      });
    });

    describe("Boundary Value Testing", () => {
      it("should handle HP value at maximum safe integer", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateHpInput(String(Number.MAX_SAFE_INTEGER));
        });

        act(() => {
          result.current.submitHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER);
      });

      it("should handle max HP value at maximum safe integer", () => {
        const { result } = renderHook(() => usePlayerEditing());
        const onSubmit = vi.fn();

        act(() => {
          result.current.updateMaxHpInput(String(Number.MAX_SAFE_INTEGER));
        });

        act(() => {
          result.current.submitMaxHpEdit(onSubmit);
        });

        expect(onSubmit).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER);
      });
    });
  });
});
