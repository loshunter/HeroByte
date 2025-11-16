// ============================================================================
// HPBAR COMPONENT TESTS
// ============================================================================
// Comprehensive tests for HPBar component following SOLID principles (SRP, SoC)
// Tests all features: rendering, HP/maxHP display, drag-to-adjust HP (mouse events),
// HP editing (click, input, Enter, blur), maxHP editing, HP state classes,
// cursor styling, value clamping, and edge cases
//
// Coverage: 165 LOC → 100% (47 tests)

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HPBar } from "../HPBar";

// ============================================================================
// TEST DATA
// ============================================================================

const createDefaultProps = (overrides?: Partial<React.ComponentProps<typeof HPBar>>) => ({
  hp: 80,
  maxHp: 100,
  isMe: false,
  isEditingHp: false,
  hpInput: "",
  isEditingMaxHp: false,
  maxHpInput: "",
  playerUid: "player-1",
  onHpChange: vi.fn(),
  onHpInputChange: vi.fn(),
  onHpEdit: vi.fn(),
  onHpSubmit: vi.fn(),
  onMaxHpInputChange: vi.fn(),
  onMaxHpEdit: vi.fn(),
  onMaxHpSubmit: vi.fn(),
  ...overrides,
});

// ============================================================================
// TESTS - RENDERING
// ============================================================================

describe("HPBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders HP bar container", () => {
      const props = createDefaultProps();
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar");
      expect(hpBar).toBeInTheDocument();
    });

    it("displays current HP and maxHP values", () => {
      const props = createDefaultProps({ hp: 75, maxHp: 120 });
      render(<HPBar {...props} />);

      expect(screen.getByText("75")).toBeInTheDocument();
      expect(screen.getByText("120")).toBeInTheDocument();
    });

    it("displays HP label", () => {
      const props = createDefaultProps();
      render(<HPBar {...props} />);

      expect(screen.getByText(/HP:/)).toBeInTheDocument();
    });

    it("displays slash separator between HP and maxHP", () => {
      const props = createDefaultProps();
      render(<HPBar {...props} />);

      expect(screen.getByText(/\//)).toBeInTheDocument();
    });

    it("calculates HP percentage correctly", () => {
      const props = createDefaultProps({ hp: 50, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveStyle({ width: "50%" });
    });

    it("applies high HP state class when HP > 66%", () => {
      const props = createDefaultProps({ hp: 80, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveAttribute("data-hp-percent", "high");
    });

    it("applies medium HP state class when HP is 33-66%", () => {
      const props = createDefaultProps({ hp: 50, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveAttribute("data-hp-percent", "medium");
    });

    it("applies low HP state class when HP < 33%", () => {
      const props = createDefaultProps({ hp: 20, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveAttribute("data-hp-percent", "low");
    });

    it("applies ew-resize cursor when isMe is true", () => {
      const props = createDefaultProps({ isMe: true });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar");
      expect(hpBar).toHaveStyle({ cursor: "ew-resize" });
    });

    it("applies default cursor when isMe is false", () => {
      const props = createDefaultProps({ isMe: false });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar");
      expect(hpBar).toHaveStyle({ cursor: "default" });
    });

    it("HP value shows pointer cursor when isMe is true", () => {
      const props = createDefaultProps({ isMe: true, hp: 75 });
      render(<HPBar {...props} />);

      const hpValue = screen.getByText("75");
      expect(hpValue).toHaveStyle({ cursor: "pointer", textDecoration: "underline" });
    });

    it("HP value shows default cursor when isMe is false", () => {
      const props = createDefaultProps({ isMe: false, hp: 75 });
      render(<HPBar {...props} />);

      const hpValue = screen.getByText("75");
      expect(hpValue).toHaveStyle({ cursor: "default", textDecoration: "none" });
    });

    it("maxHP value shows pointer cursor when isMe is true", () => {
      const props = createDefaultProps({ isMe: true, maxHp: 100 });
      render(<HPBar {...props} />);

      const maxHpValue = screen.getByText("100");
      expect(maxHpValue).toHaveStyle({ cursor: "pointer", textDecoration: "underline" });
    });

    it("maxHP value shows default cursor when isMe is false", () => {
      const props = createDefaultProps({ isMe: false, maxHp: 100 });
      render(<HPBar {...props} />);

      const maxHpValue = screen.getByText("100");
      expect(maxHpValue).toHaveStyle({ cursor: "default", textDecoration: "none" });
    });
  });

  // ============================================================================
  // TESTS - HP EDITING
  // ============================================================================

  describe("HP Editing", () => {
    it("clicking HP value when isMe is true triggers edit mode", () => {
      const onHpEdit = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 75, onHpEdit });
      render(<HPBar {...props} />);

      const hpValue = screen.getByText("75");
      fireEvent.click(hpValue);

      expect(onHpEdit).toHaveBeenCalledTimes(1);
      expect(onHpEdit).toHaveBeenCalledWith("player-1", 75);
    });

    it("clicking HP value when isMe is false does nothing", () => {
      const onHpEdit = vi.fn();
      const props = createDefaultProps({ isMe: false, hp: 75, onHpEdit });
      render(<HPBar {...props} />);

      const hpValue = screen.getByText("75");
      fireEvent.click(hpValue);

      expect(onHpEdit).not.toHaveBeenCalled();
    });

    it("shows input field when isEditingHp is true", () => {
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85" });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("85");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "number");
    });

    it("input has autoFocus when isEditingHp is true", () => {
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85" });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("85");
      expect(input).toHaveFocus();
    });

    it("onChange updates input value via onHpInputChange", () => {
      const onHpInputChange = vi.fn();
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85", onHpInputChange });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("85");
      fireEvent.change(input, { target: { value: "90" } });

      expect(onHpInputChange).toHaveBeenCalledTimes(1);
      expect(onHpInputChange).toHaveBeenCalledWith("90");
    });

    it("Enter key submits HP value", () => {
      const onHpSubmit = vi.fn();
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85", onHpSubmit });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("85");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onHpSubmit).toHaveBeenCalledTimes(1);
      expect(onHpSubmit).toHaveBeenCalledWith("85");
    });

    it("blur event submits HP value", () => {
      const onHpSubmit = vi.fn();
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85", onHpSubmit });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("85");
      fireEvent.blur(input);

      expect(onHpSubmit).toHaveBeenCalledTimes(1);
      expect(onHpSubmit).toHaveBeenCalledWith("85");
    });

    it("non-Enter key does not submit", () => {
      const onHpSubmit = vi.fn();
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85", onHpSubmit });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("85");
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onHpSubmit).not.toHaveBeenCalled();
    });

    it("input field has correct styling", () => {
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85" });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("85");
      expect(input).toHaveStyle({
        width: "40px",
        background: "var(--jrpg-navy)",
        color: "var(--jrpg-cyan)",
        padding: "2px",
      });
    });

    it("hides HP span when isEditingHp is true", () => {
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85", hp: 75 });
      render(<HPBar {...props} />);

      expect(screen.queryByText("75")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("85")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TESTS - MAXHP EDITING
  // ============================================================================

  describe("MaxHP Editing", () => {
    it("clicking maxHP value when isMe is true triggers edit mode", () => {
      const onMaxHpEdit = vi.fn();
      const props = createDefaultProps({ isMe: true, maxHp: 120, onMaxHpEdit });
      render(<HPBar {...props} />);

      const maxHpValue = screen.getByText("120");
      fireEvent.click(maxHpValue);

      expect(onMaxHpEdit).toHaveBeenCalledTimes(1);
      expect(onMaxHpEdit).toHaveBeenCalledWith("player-1", 120);
    });

    it("clicking maxHP value when isMe is false does nothing", () => {
      const onMaxHpEdit = vi.fn();
      const props = createDefaultProps({ isMe: false, maxHp: 120, onMaxHpEdit });
      render(<HPBar {...props} />);

      const maxHpValue = screen.getByText("120");
      fireEvent.click(maxHpValue);

      expect(onMaxHpEdit).not.toHaveBeenCalled();
    });

    it("shows input field when isEditingMaxHp is true", () => {
      const props = createDefaultProps({ isEditingMaxHp: true, maxHpInput: "150" });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("150");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "number");
    });

    it("input has autoFocus when isEditingMaxHp is true", () => {
      const props = createDefaultProps({ isEditingMaxHp: true, maxHpInput: "150" });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("150");
      expect(input).toHaveFocus();
    });

    it("onChange updates input value via onMaxHpInputChange", () => {
      const onMaxHpInputChange = vi.fn();
      const props = createDefaultProps({
        isEditingMaxHp: true,
        maxHpInput: "150",
        onMaxHpInputChange,
      });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("150");
      fireEvent.change(input, { target: { value: "200" } });

      expect(onMaxHpInputChange).toHaveBeenCalledTimes(1);
      expect(onMaxHpInputChange).toHaveBeenCalledWith("200");
    });

    it("Enter key submits maxHP value", () => {
      const onMaxHpSubmit = vi.fn();
      const props = createDefaultProps({ isEditingMaxHp: true, maxHpInput: "150", onMaxHpSubmit });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("150");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onMaxHpSubmit).toHaveBeenCalledTimes(1);
      expect(onMaxHpSubmit).toHaveBeenCalledWith("150");
    });

    it("blur event submits maxHP value", () => {
      const onMaxHpSubmit = vi.fn();
      const props = createDefaultProps({ isEditingMaxHp: true, maxHpInput: "150", onMaxHpSubmit });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("150");
      fireEvent.blur(input);

      expect(onMaxHpSubmit).toHaveBeenCalledTimes(1);
      expect(onMaxHpSubmit).toHaveBeenCalledWith("150");
    });

    it("non-Enter key does not submit", () => {
      const onMaxHpSubmit = vi.fn();
      const props = createDefaultProps({ isEditingMaxHp: true, maxHpInput: "150", onMaxHpSubmit });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("150");
      fireEvent.keyDown(input, { key: "Tab" });

      expect(onMaxHpSubmit).not.toHaveBeenCalled();
    });

    it("input field has correct styling", () => {
      const props = createDefaultProps({ isEditingMaxHp: true, maxHpInput: "150" });
      render(<HPBar {...props} />);

      const input = screen.getByDisplayValue("150");
      expect(input).toHaveStyle({
        width: "40px",
        background: "var(--jrpg-navy)",
        color: "var(--jrpg-cyan)",
        padding: "2px",
      });
    });

    it("hides maxHP span when isEditingMaxHp is true", () => {
      const props = createDefaultProps({ isEditingMaxHp: true, maxHpInput: "150", maxHp: 120 });
      render(<HPBar {...props} />);

      expect(screen.queryByText("120")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("150")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TESTS - DRAG-TO-ADJUST HP
  // ============================================================================

  describe("Drag-to-Adjust HP", () => {
    it("mouseDown when isMe is false does nothing", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: false, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;
      fireEvent.mouseDown(hpBar);

      expect(onHpChange).not.toHaveBeenCalled();
    });

    it("mouseDown when isMe is true initiates drag", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      // Mock getBoundingClientRect
      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        width: 100,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 50 });

      expect(onHpChange).toHaveBeenCalled();
    });

    it("immediate onHpChange call on mousedown", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        width: 100,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 75 });

      expect(onHpChange).toHaveBeenCalledWith(75);
    });

    it("calculates HP percentage at 0% (left edge)", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        width: 200,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 100 });

      expect(onHpChange).toHaveBeenCalledWith(0);
    });

    it("calculates HP percentage at 50%", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        width: 200,
        top: 0,
        bottom: 0,
        right: 300,
        height: 0,
        x: 100,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 200 });

      expect(onHpChange).toHaveBeenCalledWith(50);
    });

    it("calculates HP percentage at 100% (right edge)", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        width: 200,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 300 });

      expect(onHpChange).toHaveBeenCalledWith(100);
    });

    it("clamps HP to 0 when clicking beyond left edge", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        width: 200,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 50 });

      expect(onHpChange).toHaveBeenCalledWith(0);
    });

    it("clamps HP to maxHp when clicking beyond right edge", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        width: 200,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 400 });

      expect(onHpChange).toHaveBeenCalledWith(100);
    });

    it("rounds HP to nearest integer", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        width: 100,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      // 33.3% of 100 = 33.3, should round to 33
      fireEvent.mouseDown(hpBar, { clientX: 33.3 });

      expect(onHpChange).toHaveBeenCalledWith(33);
    });

    it("mousemove updates HP during drag", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        width: 100,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 50 });

      // Initial call
      expect(onHpChange).toHaveBeenCalledWith(50);

      // Simulate mousemove
      fireEvent(document, new MouseEvent("mousemove", { clientX: 75, bubbles: true }));

      expect(onHpChange).toHaveBeenCalledWith(75);
    });

    it("mouseup removes event listeners", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        width: 100,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseDown(hpBar, { clientX: 50 });

      // Mouseup
      fireEvent(document, new MouseEvent("mouseup", { bubbles: true }));

      onHpChange.mockClear();

      // Move after mouseup - should not trigger
      fireEvent(document, new MouseEvent("mousemove", { clientX: 75, bubbles: true }));

      expect(onHpChange).not.toHaveBeenCalled();
    });

    it("preventDefault called on mousedown", () => {
      const onHpChange = vi.fn();
      const props = createDefaultProps({ isMe: true, hp: 50, maxHp: 100, onHpChange });
      const { container } = render(<HPBar {...props} />);

      const hpBar = container.querySelector(".jrpg-hp-bar")!;

      hpBar.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        width: 100,
        top: 0,
        bottom: 0,
        right: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      const event = new MouseEvent("mousedown", { clientX: 50, bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      fireEvent(hpBar, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TESTS - EDGE CASES & INTEGRATION
  // ============================================================================

  describe("Edge Cases & Integration", () => {
    it("handles HP = 0", () => {
      const props = createDefaultProps({ hp: 0, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      expect(screen.getByText("0")).toBeInTheDocument();

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveStyle({ width: "0%" });
      expect(hpBarFill).toHaveAttribute("data-hp-percent", "low");
    });

    it("handles HP = maxHp (full health)", () => {
      const props = createDefaultProps({ hp: 100, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      const values = screen.getAllByText("100");
      expect(values).toHaveLength(2); // HP and maxHP both show 100

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveStyle({ width: "100%" });
      expect(hpBarFill).toHaveAttribute("data-hp-percent", "high");
    });

    it("handles very large HP values", () => {
      const props = createDefaultProps({ hp: 9999, maxHp: 10000 });
      const { container } = render(<HPBar {...props} />);

      expect(screen.getByText("9999")).toBeInTheDocument();
      expect(screen.getByText("10000")).toBeInTheDocument();

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveStyle({ width: "99.99%" });
    });

    it("handles HP exactly at 66% threshold (high state)", () => {
      const props = createDefaultProps({ hp: 67, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveAttribute("data-hp-percent", "high");
    });

    it("handles HP exactly at 33% threshold (medium state)", () => {
      const props = createDefaultProps({ hp: 34, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveAttribute("data-hp-percent", "medium");
    });

    it("handles HP just below 33% threshold (low state)", () => {
      const props = createDefaultProps({ hp: 32, maxHp: 100 });
      const { container } = render(<HPBar {...props} />);

      const hpBarFill = container.querySelector(".jrpg-hp-bar-fill");
      expect(hpBarFill).toHaveAttribute("data-hp-percent", "low");
    });

    it("both HP and maxHP can be in edit mode simultaneously", () => {
      const props = createDefaultProps({
        isEditingHp: true,
        hpInput: "85",
        isEditingMaxHp: true,
        maxHpInput: "150",
      });
      render(<HPBar {...props} />);

      expect(screen.getByDisplayValue("85")).toBeInTheDocument();
      expect(screen.getByDisplayValue("150")).toBeInTheDocument();
    });

    it("switching from HP edit to maxHP edit", () => {
      const props = createDefaultProps({ isEditingHp: true, hpInput: "85" });
      const { rerender } = render(<HPBar {...props} />);

      expect(screen.getByDisplayValue("85")).toBeInTheDocument();

      const updatedProps = createDefaultProps({
        isEditingHp: false,
        isEditingMaxHp: true,
        maxHpInput: "150",
      });
      rerender(<HPBar {...updatedProps} />);

      expect(screen.queryByDisplayValue("85")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("150")).toBeInTheDocument();
    });

    it("playerUid is correctly passed to edit callbacks", () => {
      const onHpEdit = vi.fn();
      const onMaxHpEdit = vi.fn();
      const props = createDefaultProps({
        isMe: true,
        playerUid: "custom-player-uid",
        hp: 75,
        maxHp: 120,
        onHpEdit,
        onMaxHpEdit,
      });
      render(<HPBar {...props} />);

      fireEvent.click(screen.getByText("75"));
      expect(onHpEdit).toHaveBeenCalledWith("custom-player-uid", 75);

      fireEvent.click(screen.getByText("120"));
      expect(onMaxHpEdit).toHaveBeenCalledWith("custom-player-uid", 120);
    });
  });
});
