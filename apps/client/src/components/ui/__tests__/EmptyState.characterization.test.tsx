/**
 * Characterization tests for EmptyState
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source patterns in DMMenu.tsx:
 * - NPCs tab empty state (lines 1216-1221)
 * - Props tab empty state (lines 1260-1265)
 *
 * Target: apps/client/src/components/ui/EmptyState.tsx
 *
 * Pattern:
 * ```tsx
 * <JRPGPanel
 *   variant="simple"
 *   style={{ color: "var(--jrpg-white)", fontSize: "12px" }}
 * >
 *   No NPCs yet. Use &ldquo;Add NPC&rdquo; to create one.
 * </JRPGPanel>
 * ```
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { JRPGPanel } from "../JRPGPanel";

// ============================================================================
// INLINE IMPLEMENTATION FOR TESTING
// ============================================================================
// This will be replaced after extraction. For now, we implement the component
// inline to test the expected behavior based on the original DMMenu patterns.

interface EmptyStateProps {
  message: string | React.ReactNode;
}

const EmptyState = ({ message }: EmptyStateProps) => {
  return (
    <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
      {message}
    </JRPGPanel>
  );
};

describe("EmptyState - Characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe("basic rendering", () => {
    it("should render with simple string message", () => {
      render(<EmptyState message="No items yet." />);

      expect(screen.getByText("No items yet.")).toBeInTheDocument();
    });

    it("should render JRPGPanel with variant='simple'", () => {
      const { container } = render(<EmptyState message="Test message" />);

      // JRPGPanel with variant="simple" has class "jrpg-frame-simple"
      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toBeInTheDocument();
    });

    it("should render JRPGPanel with jrpg-spacing-md class", () => {
      const { container } = render(<EmptyState message="Test message" />);

      // JRPGPanel always applies jrpg-spacing-md
      const panel = container.querySelector(".jrpg-spacing-md");
      expect(panel).toBeInTheDocument();
    });

    it("should render message as children of JRPGPanel", () => {
      const { container } = render(<EmptyState message="Test content" />);

      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toHaveTextContent("Test content");
    });
  });

  // ============================================================================
  // Default Styling Tests
  // ============================================================================

  describe("default styling", () => {
    it("should apply color: var(--jrpg-white) to JRPGPanel", () => {
      const { container } = render(<EmptyState message="Test message" />);

      const panel = container.querySelector(".jrpg-frame-simple") as HTMLElement;
      expect(panel.style.color).toBe("var(--jrpg-white)");
    });

    it("should apply fontSize: 12px to JRPGPanel", () => {
      const { container } = render(<EmptyState message="Test message" />);

      const panel = container.querySelector(".jrpg-frame-simple") as HTMLElement;
      expect(panel.style.fontSize).toBe("12px");
    });

    it("should apply both color and fontSize together", () => {
      const { container } = render(<EmptyState message="Test message" />);

      const panel = container.querySelector(".jrpg-frame-simple") as HTMLElement;
      expect(panel.style.color).toBe("var(--jrpg-white)");
      expect(panel.style.fontSize).toBe("12px");
    });

    it("should not override JRPGPanel variant", () => {
      const { container } = render(<EmptyState message="Test message" />);

      // Should have simple variant class
      const simplePanel = container.querySelector(".jrpg-frame-simple");
      expect(simplePanel).toBeInTheDocument();

      // Should NOT have default or bevel variant classes
      const defaultPanel = container.querySelector(".jrpg-frame");
      const bevelPanel = container.querySelector(".jrpg-frame-bevel");

      // Note: .jrpg-frame might be part of other classes, so we check for exact class
      if (defaultPanel) {
        expect(defaultPanel.classList.contains("jrpg-frame-simple")).toBe(true);
      }
      expect(bevelPanel).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Message Rendering Tests
  // ============================================================================

  describe("message rendering", () => {
    it("should render simple string messages", () => {
      render(<EmptyState message="No items available" />);

      expect(screen.getByText("No items available")).toBeInTheDocument();
    });

    it("should render messages with HTML entities (ldquo/rdquo)", () => {
      // Using Unicode characters that HTML entities represent
      render(<EmptyState message='No NPCs yet. Use "Add NPC" to create one.' />);

      // The text content should include the quotes
      expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument();
      expect(screen.getByText(/Add NPC/)).toBeInTheDocument();
    });

    it("should render messages with special characters", () => {
      render(<EmptyState message="No items – use the + button" />);

      expect(screen.getByText("No items – use the + button")).toBeInTheDocument();
    });

    it("should render JSX element messages", () => {
      render(
        <EmptyState
          message={
            <div data-testid="custom-message">
              <strong>No items</strong> - Add one to get started
            </div>
          }
        />,
      );

      expect(screen.getByTestId("custom-message")).toBeInTheDocument();
      expect(screen.getByText(/No items/)).toBeInTheDocument();
      expect(screen.getByText(/Add one to get started/)).toBeInTheDocument();
    });

    it("should render complex ReactNode with multiple elements", () => {
      render(
        <EmptyState
          message={
            <>
              <div data-testid="line-1">First line</div>
              <div data-testid="line-2">Second line</div>
            </>
          }
        />,
      );

      expect(screen.getByTestId("line-1")).toBeInTheDocument();
      expect(screen.getByTestId("line-2")).toBeInTheDocument();
    });

    it("should render messages with inline elements", () => {
      render(
        <EmptyState
          message={
            <>
              No items yet. Use <strong>Add Item</strong> to create one.
            </>
          }
        />,
      );

      expect(screen.getByText(/No items yet/)).toBeInTheDocument();
      expect(screen.getByText("Add Item")).toBeInTheDocument();
      const strong = screen.getByText("Add Item");
      expect(strong.tagName).toBe("STRONG");
    });
  });

  // ============================================================================
  // Real-World Pattern Tests (from DMMenu.tsx)
  // ============================================================================

  describe("real-world usage patterns", () => {
    it("should match NPCs tab empty state pattern (lines 1216-1221)", () => {
      const message = 'No NPCs yet. Use "Add NPC" to create one.';
      const { container } = render(<EmptyState message={message} />);

      // Check panel variant
      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toBeInTheDocument();

      // Check styling
      const panelElement = panel as HTMLElement;
      expect(panelElement.style.color).toBe("var(--jrpg-white)");
      expect(panelElement.style.fontSize).toBe("12px");

      // Check message
      expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument();
      expect(screen.getByText(/Add NPC/)).toBeInTheDocument();
    });

    it("should match Props tab empty state pattern (lines 1260-1265)", () => {
      const message = 'No props yet. Use "Add Prop" to create one.';
      const { container } = render(<EmptyState message={message} />);

      // Check panel variant
      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toBeInTheDocument();

      // Check styling
      const panelElement = panel as HTMLElement;
      expect(panelElement.style.color).toBe("var(--jrpg-white)");
      expect(panelElement.style.fontSize).toBe("12px");

      // Check message
      expect(screen.getByText(/No props yet/)).toBeInTheDocument();
      expect(screen.getByText(/Add Prop/)).toBeInTheDocument();
    });

    it("should work with action-oriented messages", () => {
      render(<EmptyState message='Click "Add Item" to begin' />);

      expect(screen.getByText(/Click/)).toBeInTheDocument();
      expect(screen.getByText(/Add Item/)).toBeInTheDocument();
      expect(screen.getByText(/to begin/)).toBeInTheDocument();
    });

    it("should work with instructional messages", () => {
      render(<EmptyState message="No data available. Please import or create new items." />);

      expect(
        screen.getByText("No data available. Please import or create new items."),
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty string message", () => {
      const { container } = render(<EmptyState message="" />);

      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toBeInTheDocument();
      expect(panel?.textContent).toBe("");
    });

    it("should handle whitespace-only message", () => {
      const { container } = render(<EmptyState message="   " />);

      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toBeInTheDocument();
      expect(panel?.textContent).toBe("   ");
    });

    it("should handle very long message text", () => {
      const longMessage =
        "No items available at the moment. Please use the Add button in the toolbar above to create a new item. " +
        "You can also import items from a file or copy them from another location. " +
        "For more information, please consult the documentation.";

      render(<EmptyState message={longMessage} />);

      expect(screen.getByText(new RegExp(longMessage))).toBeInTheDocument();
    });

    it("should handle message with line breaks", () => {
      render(
        <EmptyState
          message={
            <>
              No items available.
              <br />
              Use the Add button to create one.
            </>
          }
        />,
      );

      expect(screen.getByText(/No items available/)).toBeInTheDocument();
      expect(screen.getByText(/Use the Add button/)).toBeInTheDocument();
    });

    it("should handle message with multiple spaces", () => {
      const { container } = render(<EmptyState message="No    items    available" />);

      // getByText normalizes whitespace by default, so we check textContent directly
      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel?.textContent).toBe("No    items    available");
    });

    it("should handle message with special quotes and apostrophes", () => {
      render(<EmptyState message={"It's empty. Use \"Add\" or 'Create'."} />);

      expect(screen.getByText(/It's empty/)).toBeInTheDocument();
      expect(screen.getByText(/Use/)).toBeInTheDocument();
    });

    it("should handle numeric content in message", () => {
      render(<EmptyState message="0 items found. Add at least 1 to continue." />);

      expect(screen.getByText("0 items found. Add at least 1 to continue.")).toBeInTheDocument();
    });

    it("should handle message with emoji", () => {
      render(<EmptyState message="📭 No messages yet" />);

      expect(screen.getByText("📭 No messages yet")).toBeInTheDocument();
    });

    it("should handle null-like text in message", () => {
      render(<EmptyState message="null" />);

      expect(screen.getByText("null")).toBeInTheDocument();
    });

    it("should handle undefined-like text in message", () => {
      render(<EmptyState message="undefined" />);

      expect(screen.getByText("undefined")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe("component structure", () => {
    it("should have single root element (JRPGPanel)", () => {
      const { container } = render(<EmptyState message="Test" />);

      // Should have exactly one child (the JRPGPanel)
      expect(container.children.length).toBe(1);
    });

    it("should render JRPGPanel as direct child of container", () => {
      const { container } = render(<EmptyState message="Test" />);

      const panel = container.firstChild as HTMLElement;
      expect(panel.classList.contains("jrpg-frame-simple")).toBe(true);
      expect(panel.classList.contains("jrpg-spacing-md")).toBe(true);
    });

    it("should pass message as direct children to JRPGPanel", () => {
      const { container } = render(<EmptyState message={<div data-testid="child">Child</div>} />);

      const panel = container.querySelector(".jrpg-frame-simple");
      const child = panel?.querySelector("[data-testid='child']");
      expect(child).toBeInTheDocument();
    });

    it("should not add extra wrapper elements", () => {
      const { container } = render(<EmptyState message="Test" />);

      // Get the panel
      const panel = container.querySelector(".jrpg-frame-simple");

      // The message should be a direct text node child, not wrapped
      // (unless the message itself contains elements)
      expect(panel?.textContent).toBe("Test");
    });
  });

  // ============================================================================
  // Style Consistency Tests
  // ============================================================================

  describe("style consistency", () => {
    it("should apply same styles regardless of message type", () => {
      const { container: container1 } = render(<EmptyState message="String message" />);
      const { container: container2 } = render(<EmptyState message={<div>JSX message</div>} />);

      const panel1 = container1.querySelector(".jrpg-frame-simple") as HTMLElement;
      const panel2 = container2.querySelector(".jrpg-frame-simple") as HTMLElement;

      expect(panel1.style.color).toBe(panel2.style.color);
      expect(panel1.style.fontSize).toBe(panel2.style.fontSize);
    });

    it("should apply same styles regardless of message length", () => {
      const { container: container1 } = render(<EmptyState message="Short" />);
      const { container: container2 } = render(
        <EmptyState message="This is a much longer message that contains multiple words and should still have the same styling applied to it" />,
      );

      const panel1 = container1.querySelector(".jrpg-frame-simple") as HTMLElement;
      const panel2 = container2.querySelector(".jrpg-frame-simple") as HTMLElement;

      expect(panel1.style.color).toBe(panel2.style.color);
      expect(panel1.style.fontSize).toBe(panel2.style.fontSize);
    });

    it("should maintain styling after re-renders with different messages", () => {
      const { container, rerender } = render(<EmptyState message="First message" />);

      const panel1 = container.querySelector(".jrpg-frame-simple") as HTMLElement;
      const initialColor = panel1.style.color;
      const initialFontSize = panel1.style.fontSize;

      rerender(<EmptyState message="Second message" />);

      const panel2 = container.querySelector(".jrpg-frame-simple") as HTMLElement;
      expect(panel2.style.color).toBe(initialColor);
      expect(panel2.style.fontSize).toBe(initialFontSize);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe("accessibility", () => {
    it("should render text content accessible to screen readers", () => {
      render(<EmptyState message="No items available" />);

      // Text should be accessible
      const element = screen.getByText("No items available");
      expect(element).toBeInTheDocument();
    });

    it("should maintain text hierarchy with JSX content", () => {
      render(
        <EmptyState
          message={
            <>
              <strong>Important:</strong> No items found
            </>
          }
        />,
      );

      expect(screen.getByText("Important:")).toBeInTheDocument();
      expect(screen.getByText(/No items found/)).toBeInTheDocument();
    });

    it("should allow semantic HTML in messages", () => {
      render(
        <EmptyState
          message={
            <p data-testid="semantic-p">
              No items available. <em>Please add some.</em>
            </p>
          }
        />,
      );

      const paragraph = screen.getByTestId("semantic-p");
      expect(paragraph.tagName).toBe("P");

      const emphasis = screen.getByText("Please add some.");
      expect(emphasis.tagName).toBe("EM");
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration", () => {
    it("should work when used multiple times on same page", () => {
      render(
        <>
          <EmptyState message="First empty state" />
          <EmptyState message="Second empty state" />
          <EmptyState message="Third empty state" />
        </>,
      );

      expect(screen.getByText("First empty state")).toBeInTheDocument();
      expect(screen.getByText("Second empty state")).toBeInTheDocument();
      expect(screen.getByText("Third empty state")).toBeInTheDocument();
    });

    it("should work within different container layouts", () => {
      const { container } = render(
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <EmptyState message="In flex column" />
        </div>,
      );

      expect(screen.getByText("In flex column")).toBeInTheDocument();
      const panel = container.querySelector(".jrpg-frame-simple");
      expect(panel).toBeInTheDocument();
    });

    it("should work alongside other components", () => {
      render(
        <>
          <div data-testid="other-component">Other Component</div>
          <EmptyState message="Empty state component" />
          <div data-testid="another-component">Another Component</div>
        </>,
      );

      expect(screen.getByTestId("other-component")).toBeInTheDocument();
      expect(screen.getByText("Empty state component")).toBeInTheDocument();
      expect(screen.getByTestId("another-component")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Variant Specificity Tests
  // ============================================================================

  describe("variant specificity", () => {
    it("should use simple variant (not default)", () => {
      const { container } = render(<EmptyState message="Test" />);

      const simplePanel = container.querySelector(".jrpg-frame-simple");
      expect(simplePanel).toBeInTheDocument();

      // Should not have the base jrpg-frame class without -simple suffix
      // (JRPGPanel with variant="simple" uses "jrpg-frame-simple")
      const panels = container.querySelectorAll("[class*='jrpg-frame']");
      expect(panels.length).toBeGreaterThan(0);

      // Verify it's the simple variant
      const hasSimpleVariant = Array.from(panels).some((panel) =>
        panel.classList.contains("jrpg-frame-simple"),
      );
      expect(hasSimpleVariant).toBe(true);
    });

    it("should use simple variant (not bevel)", () => {
      const { container } = render(<EmptyState message="Test" />);

      const bevelPanel = container.querySelector(".jrpg-frame-bevel");
      expect(bevelPanel).not.toBeInTheDocument();

      const simplePanel = container.querySelector(".jrpg-frame-simple");
      expect(simplePanel).toBeInTheDocument();
    });

    it("should consistently use simple variant across re-renders", () => {
      const { container, rerender } = render(<EmptyState message="Message 1" />);

      expect(container.querySelector(".jrpg-frame-simple")).toBeInTheDocument();

      rerender(<EmptyState message="Message 2" />);

      expect(container.querySelector(".jrpg-frame-simple")).toBeInTheDocument();

      rerender(<EmptyState message="Message 3" />);

      expect(container.querySelector(".jrpg-frame-simple")).toBeInTheDocument();
    });
  });
});
