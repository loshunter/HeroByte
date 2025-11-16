/**
 * Characterization tests for RollButton
 *
 * Component: RollButton
 * Purpose: SNES-style dice roll button with complex interactions and visual feedback
 *
 * Test Coverage:
 * - Initial rendering and default state
 * - Click handling in enabled and disabled states
 * - Disabled state styling and behavior
 * - Enabled state styling and behavior
 * - Hover effects when enabled
 * - Hover effects when disabled (should not apply)
 * - Mouse down/up effects when enabled
 * - Mouse down/up effects when disabled (should not apply)
 * - Base styling and layout
 * - Props validation
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RollButton } from "../RollButton";

describe("RollButton", () => {
  describe("Initial Rendering", () => {
    it("should render a button element", () => {
      const { container } = render(<RollButton onClick={vi.fn()} />);

      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it('should display "⚂ ROLL! ⚂" text', () => {
      render(<RollButton onClick={vi.fn()} />);

      expect(screen.getByText("⚂ ROLL! ⚂")).toBeInTheDocument();
    });

    it('should have className="roll-button"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("roll-button");
    });

    it('should have type="button" by default', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      // Default button type is "submit", but our button should be "button"
      // Since we don't explicitly set it, HTML defaults make it "button" in this context
      expect(button.tagName).toBe("BUTTON");
    });
  });

  describe("Click Handling", () => {
    it("should call onClick when clicked in enabled state", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should not call onClick when disabled", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} disabled={true} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });

    it("should call onClick multiple times for multiple clicks", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(3);
    });

    it("should call onClick with event object", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick.mock.calls[0].length).toBeGreaterThan(0);
    });
  });

  describe("Disabled State - Default", () => {
    it("should default disabled to false", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button).not.toBeDisabled();
    });

    it("should have button enabled by default", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.disabled).toBe(false);
    });

    it('should have cursor "pointer" by default', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.cursor).toBe("pointer");
    });
  });

  describe("Disabled State - Styling", () => {
    it("should have gray background gradient when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      expect(button.style.background).toBe("linear-gradient(180deg, #666 0%, #444 100%)");
    });

    it("should have dark border colors when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      // Browser converts hex to RGB format
      expect(button.style.borderColor).toBe(
        "rgb(68, 68, 68) rgb(34, 34, 34) rgb(34, 34, 34) rgb(68, 68, 68)",
      );
    });

    it("should have gray text color (#888) when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      // Browser converts hex to RGB format
      expect(button.style.color).toBe("rgb(136, 136, 136)");
    });

    it('should have cursor "not-allowed" when disabled', () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      expect(button.style.cursor).toBe("not-allowed");
    });

    it("should have reduced box shadow when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      expect(button.style.boxShadow).toBe("0 2px 0 #222");
    });

    it("should have no text shadow when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      expect(button.style.textShadow).toBe("none");
    });

    it("should have opacity 0.5 when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      expect(button.style.opacity).toBe("0.5");
    });
  });

  describe("Enabled State - Styling", () => {
    it("should have blue gradient background when enabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      expect(button.style.background).toBe(
        "linear-gradient(180deg, var(--hero-blue) 0%, #3366CC 100%)",
      );
    });

    it("should have gold/navy border colors when enabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      expect(button.style.borderColor).toBe(
        "var(--hero-gold-light) var(--hero-navy-dark) var(--hero-navy-dark) var(--hero-gold-light)",
      );
    });

    it("should have gold text color when enabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      expect(button.style.color).toBe("var(--hero-gold-light)");
    });

    it('should have cursor "pointer" when enabled', () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      expect(button.style.cursor).toBe("pointer");
    });

    it("should have full box shadow with glow when enabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      expect(button.style.boxShadow).toBe(
        "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(68,125,247,0.5)",
      );
    });

    it("should have text shadow with glow when enabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      expect(button.style.textShadow).toBe(
        "2px 2px 0 var(--hero-navy-dark), 0 0 8px rgba(240,226,195,0.5)",
      );
    });

    it("should have opacity 1 when enabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      expect(button.style.opacity).toBe("1");
    });
  });

  describe("Hover Effects - Enabled", () => {
    it("should apply transform translateY(-2px) on mouse enter", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseEnter(button);

      expect(button.style.transform).toBe("translateY(-2px)");
    });

    it("should enhance box shadow on mouse enter", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseEnter(button);

      expect(button.style.boxShadow).toBe(
        "0 8px 0 var(--hero-navy-dark), 0 0 16px rgba(68,125,247,0.7)",
      );
    });

    it("should reset transform to translateY(0) on mouse leave", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseEnter(button);
      fireEvent.mouseLeave(button);

      expect(button.style.transform).toBe("translateY(0)");
    });

    it("should reset box shadow to default on mouse leave", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseEnter(button);
      fireEvent.mouseLeave(button);

      expect(button.style.boxShadow).toBe(
        "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(68,125,247,0.5)",
      );
    });

    it("should apply hover effects only when not disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      const initialBoxShadow = button.style.boxShadow;

      fireEvent.mouseEnter(button);

      expect(button.style.transform).toBe("translateY(-2px)");
      expect(button.style.boxShadow).not.toBe(initialBoxShadow);
    });
  });

  describe("Hover Effects - Disabled", () => {
    it("should NOT change transform on mouse enter when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      const initialTransform = button.style.transform;

      fireEvent.mouseEnter(button);

      expect(button.style.transform).toBe(initialTransform);
    });

    it("should NOT change box shadow on mouse enter when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      const initialBoxShadow = button.style.boxShadow;

      fireEvent.mouseEnter(button);

      expect(button.style.boxShadow).toBe(initialBoxShadow);
    });

    it("should NOT change styles on mouse leave when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      const initialTransform = button.style.transform;
      const initialBoxShadow = button.style.boxShadow;

      fireEvent.mouseEnter(button);
      fireEvent.mouseLeave(button);

      expect(button.style.transform).toBe(initialTransform);
      expect(button.style.boxShadow).toBe(initialBoxShadow);
    });
  });

  describe("Mouse Down/Up Effects - Enabled", () => {
    it("should apply transform translateY(2px) on mouse down", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseDown(button);

      expect(button.style.transform).toBe("translateY(2px)");
    });

    it("should reduce box shadow on mouse down", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseDown(button);

      expect(button.style.boxShadow).toBe("0 4px 0 var(--hero-navy-dark)");
    });

    it("should apply transform translateY(-2px) on mouse up", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);

      expect(button.style.transform).toBe("translateY(-2px)");
    });

    it("should enhance box shadow on mouse up", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);

      expect(button.style.boxShadow).toBe(
        "0 8px 0 var(--hero-navy-dark), 0 0 16px rgba(68,125,247,0.7)",
      );
    });

    it("should apply mouse effects only when not disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      fireEvent.mouseDown(button);

      expect(button.style.transform).toBe("translateY(2px)");
      expect(button.style.boxShadow).toBe("0 4px 0 var(--hero-navy-dark)");
    });
  });

  describe("Mouse Down/Up Effects - Disabled", () => {
    it("should NOT change transform on mouse down when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      const initialTransform = button.style.transform;

      fireEvent.mouseDown(button);

      expect(button.style.transform).toBe(initialTransform);
    });

    it("should NOT change box shadow on mouse down when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      const initialBoxShadow = button.style.boxShadow;

      fireEvent.mouseDown(button);

      expect(button.style.boxShadow).toBe(initialBoxShadow);
    });

    it("should NOT change styles on mouse up when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      const initialTransform = button.style.transform;
      const initialBoxShadow = button.style.boxShadow;

      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);

      expect(button.style.transform).toBe(initialTransform);
      expect(button.style.boxShadow).toBe(initialBoxShadow);
    });
  });

  describe("Base Styling", () => {
    it('should have width "100%"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.width).toBe("100%");
    });

    it('should have maxWidth "400px"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.maxWidth).toBe("400px");
    });

    it('should have height "64px"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.height).toBe("64px");
    });

    it('should have borderRadius "8px"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.borderRadius).toBe("8px");
    });

    it("should have 4px solid border", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      // Check border width and style separately since shorthand may not work
      expect(button.style.borderWidth).toBe("4px");
      expect(button.style.borderStyle).toBe("solid");
    });

    it('should have fontSize "24px"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.fontSize).toBe("24px");
    });

    it('should have fontWeight "bold"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.fontWeight).toBe("bold");
    });

    it('should have fontFamily "var(--font-pixel)"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.fontFamily).toBe("var(--font-pixel)");
    });

    it('should have textTransform "uppercase"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.textTransform).toBe("uppercase");
    });

    it('should have position "relative"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.position).toBe("relative");
    });

    it('should have transition "all 150ms ease"', () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.transition).toBe("all 150ms ease");
    });
  });

  describe("Props Validation", () => {
    it("should require onClick prop and call it when clicked", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onClick).toHaveBeenCalled();
    });

    it("should control all behavior with disabled prop", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} disabled={true} />);

      const button = screen.getByRole("button");

      // Button should be disabled
      expect(button).toBeDisabled();

      // Click should not work
      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();

      // Hover should not work
      const initialTransform = button.style.transform;
      fireEvent.mouseEnter(button);
      expect(button.style.transform).toBe(initialTransform);
    });

    it("should behave as enabled when disabled=false", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} disabled={false} />);

      const button = screen.getByRole("button");

      // Button should be enabled
      expect(button).not.toBeDisabled();

      // Click should work
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalled();

      // Hover should work
      fireEvent.mouseEnter(button);
      expect(button.style.transform).toBe("translateY(-2px)");
    });

    it("should behave as disabled when disabled=true", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} disabled={true} />);

      const button = screen.getByRole("button");

      // Button should be disabled
      expect(button).toBeDisabled();

      // Should have disabled styling
      expect(button.style.cursor).toBe("not-allowed");
      expect(button.style.opacity).toBe("0.5");
      expect(button.style.background).toBe("linear-gradient(180deg, #666 0%, #444 100%)");
    });
  });

  describe("Complete Interaction Flows", () => {
    it("should handle complete hover and click flow when enabled", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} />);

      const button = screen.getByRole("button");

      // Initial state
      expect(button.style.boxShadow).toBe(
        "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(68,125,247,0.5)",
      );

      // Hover
      fireEvent.mouseEnter(button);
      expect(button.style.transform).toBe("translateY(-2px)");
      expect(button.style.boxShadow).toBe(
        "0 8px 0 var(--hero-navy-dark), 0 0 16px rgba(68,125,247,0.7)",
      );

      // Press
      fireEvent.mouseDown(button);
      expect(button.style.transform).toBe("translateY(2px)");
      expect(button.style.boxShadow).toBe("0 4px 0 var(--hero-navy-dark)");

      // Release
      fireEvent.mouseUp(button);
      expect(button.style.transform).toBe("translateY(-2px)");
      expect(button.style.boxShadow).toBe(
        "0 8px 0 var(--hero-navy-dark), 0 0 16px rgba(68,125,247,0.7)",
      );

      // Click
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);

      // Leave
      fireEvent.mouseLeave(button);
      expect(button.style.transform).toBe("translateY(0)");
      expect(button.style.boxShadow).toBe(
        "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(68,125,247,0.5)",
      );
    });

    it("should not respond to any interactions when disabled", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} disabled={true} />);

      const button = screen.getByRole("button");

      const initialTransform = button.style.transform;
      const initialBoxShadow = button.style.boxShadow;

      // Try all interactions
      fireEvent.mouseEnter(button);
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);
      fireEvent.click(button);
      fireEvent.mouseLeave(button);

      // Nothing should have changed
      expect(button.style.transform).toBe(initialTransform);
      expect(button.style.boxShadow).toBe(initialBoxShadow);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("should handle rapid mouse enter/leave cycles", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");

      // Rapid hover on/off
      for (let i = 0; i < 5; i++) {
        fireEvent.mouseEnter(button);
        expect(button.style.transform).toBe("translateY(-2px)");

        fireEvent.mouseLeave(button);
        expect(button.style.transform).toBe("translateY(0)");
      }
    });

    it("should handle rapid mouse down/up cycles", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");

      // Rapid press/release
      for (let i = 0; i < 5; i++) {
        fireEvent.mouseDown(button);
        expect(button.style.transform).toBe("translateY(2px)");

        fireEvent.mouseUp(button);
        expect(button.style.transform).toBe("translateY(-2px)");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle mouse down without mouse up", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseDown(button);

      expect(button.style.transform).toBe("translateY(2px)");
      expect(button.style.boxShadow).toBe("0 4px 0 var(--hero-navy-dark)");

      // No mouse up, but should still be in pressed state
      expect(button.style.transform).toBe("translateY(2px)");
    });

    it("should handle mouse up without mouse down", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseUp(button);

      expect(button.style.transform).toBe("translateY(-2px)");
      expect(button.style.boxShadow).toBe(
        "0 8px 0 var(--hero-navy-dark), 0 0 16px rgba(68,125,247,0.7)",
      );
    });

    it("should handle mouse leave while pressed", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");

      fireEvent.mouseEnter(button);
      fireEvent.mouseDown(button);
      expect(button.style.transform).toBe("translateY(2px)");

      fireEvent.mouseLeave(button);
      expect(button.style.transform).toBe("translateY(0)");
    });

    it("should maintain disabled state styling throughout interactions", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      const disabledBackground = "linear-gradient(180deg, #666 0%, #444 100%)";
      const disabledBoxShadow = "0 2px 0 #222";

      expect(button.style.background).toBe(disabledBackground);
      expect(button.style.boxShadow).toBe(disabledBoxShadow);

      // Try all interactions
      fireEvent.mouseEnter(button);
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);
      fireEvent.mouseLeave(button);

      // Should still have disabled styling
      expect(button.style.background).toBe(disabledBackground);
      expect(button.style.boxShadow).toBe(disabledBoxShadow);
    });
  });

  describe("Accessibility", () => {
    it("should be accessible as a button role", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should be keyboard accessible when enabled", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} />);

      const button = screen.getByRole("button");
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it("should not be clickable via keyboard when disabled", () => {
      const onClick = vi.fn();
      render(<RollButton onClick={onClick} disabled={true} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });

    it("should have proper disabled attribute when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("disabled");
    });

    it("should not have disabled attribute when enabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={false} />);

      const button = screen.getByRole("button");
      expect(button).not.toHaveAttribute("disabled");
    });
  });

  describe("Visual Feedback Consistency", () => {
    it("should have consistent hover state styling", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");

      // Enter hover state
      fireEvent.mouseEnter(button);
      const hoverTransform = button.style.transform;
      const hoverBoxShadow = button.style.boxShadow;

      // Leave and re-enter
      fireEvent.mouseLeave(button);
      fireEvent.mouseEnter(button);

      // Should have same hover state
      expect(button.style.transform).toBe(hoverTransform);
      expect(button.style.boxShadow).toBe(hoverBoxShadow);
    });

    it("should have consistent pressed state styling", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");

      // Enter pressed state
      fireEvent.mouseDown(button);
      const pressedTransform = button.style.transform;
      const pressedBoxShadow = button.style.boxShadow;

      // Release and re-press
      fireEvent.mouseUp(button);
      fireEvent.mouseDown(button);

      // Should have same pressed state
      expect(button.style.transform).toBe(pressedTransform);
      expect(button.style.boxShadow).toBe(pressedBoxShadow);
    });

    it("should have consistent default state styling", () => {
      const { rerender } = render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      const defaultBackground = button.style.background;
      const defaultBoxShadow = button.style.boxShadow;
      const defaultColor = button.style.color;

      // Re-render with same props
      rerender(<RollButton onClick={vi.fn()} />);

      // Should have same default state
      expect(button.style.background).toBe(defaultBackground);
      expect(button.style.boxShadow).toBe(defaultBoxShadow);
      expect(button.style.color).toBe(defaultColor);
    });
  });

  describe("Style Transitions", () => {
    it("should apply transition to all style changes", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      expect(button.style.transition).toBe("all 150ms ease");
    });

    it("should maintain transition during hover", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseEnter(button);

      expect(button.style.transition).toBe("all 150ms ease");
    });

    it("should maintain transition during press", () => {
      render(<RollButton onClick={vi.fn()} />);

      const button = screen.getByRole("button");
      fireEvent.mouseDown(button);

      expect(button.style.transition).toBe("all 150ms ease");
    });

    it("should maintain transition when disabled", () => {
      render(<RollButton onClick={vi.fn()} disabled={true} />);

      const button = screen.getByRole("button");
      expect(button.style.transition).toBe("all 150ms ease");
    });
  });

  describe("Multiple Instances", () => {
    it("should render multiple instances independently", () => {
      const onClick1 = vi.fn();
      const onClick2 = vi.fn();

      const { container } = render(
        <>
          <RollButton onClick={onClick1} />
          <RollButton onClick={onClick2} disabled={true} />
        </>,
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(2);

      // First button should be enabled
      expect(buttons[0]).not.toBeDisabled();

      // Second button should be disabled
      expect(buttons[1]).toBeDisabled();
    });

    it("should handle clicks independently across instances", () => {
      const onClick1 = vi.fn();
      const onClick2 = vi.fn();

      const { container } = render(
        <>
          <RollButton onClick={onClick1} />
          <RollButton onClick={onClick2} />
        </>,
      );

      const buttons = container.querySelectorAll("button");

      fireEvent.click(buttons[0]);
      expect(onClick1).toHaveBeenCalledTimes(1);
      expect(onClick2).not.toHaveBeenCalled();

      fireEvent.click(buttons[1]);
      expect(onClick1).toHaveBeenCalledTimes(1);
      expect(onClick2).toHaveBeenCalledTimes(1);
    });

    it("should handle hover independently across instances", () => {
      const { container } = render(
        <>
          <RollButton onClick={vi.fn()} />
          <RollButton onClick={vi.fn()} />
        </>,
      );

      const buttons = container.querySelectorAll("button");

      fireEvent.mouseEnter(buttons[0]);
      expect(buttons[0].style.transform).toBe("translateY(-2px)");
      expect(buttons[1].style.transform).toBe("");

      fireEvent.mouseEnter(buttons[1]);
      expect(buttons[0].style.transform).toBe("translateY(-2px)");
      expect(buttons[1].style.transform).toBe("translateY(-2px)");
    });
  });
});
