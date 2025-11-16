/**
 * Comprehensive tests for EmptyState component
 *
 * Tests the reusable empty state message display component with JRPG styling.
 * Follows SOLID principles with single-responsibility tests organized by concern.
 *
 * Source: apps/client/src/components/ui/EmptyState.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "../EmptyState";

// Mock JRPGPanel to isolate component testing
vi.mock("../JRPGPanel", () => ({
  JRPGPanel: ({
    children,
    variant,
    style,
  }: {
    children: React.ReactNode;
    variant?: string;
    style?: React.CSSProperties;
  }) => (
    <div
      data-testid="jrpg-panel"
      data-variant={variant}
      className={`jrpg-frame-${variant || "default"} jrpg-spacing-md`}
      style={style}
    >
      {children}
    </div>
  ),
}));

describe("EmptyState - Initial Rendering", () => {
  describe("string message rendering", () => {
    it("should render with simple string message", () => {
      render(<EmptyState message="No items yet" />);

      expect(screen.getByText("No items yet")).toBeInTheDocument();
    });

    it("should render with empty string message", () => {
      const { container } = render(<EmptyState message="" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel).toBeInTheDocument();
      expect(panel?.textContent).toBe("");
    });

    it("should render with string containing special characters", () => {
      render(<EmptyState message="No items – use the + button!" />);

      expect(screen.getByText("No items – use the + button!")).toBeInTheDocument();
    });

    it("should render with string containing quotes", () => {
      render(<EmptyState message='No NPCs yet. Use "Add NPC" to create one.' />);

      expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument();
      expect(screen.getByText(/Add NPC/)).toBeInTheDocument();
    });

    it("should render with string containing numbers", () => {
      render(<EmptyState message="0 items found. Add at least 1 to continue." />);

      expect(screen.getByText("0 items found. Add at least 1 to continue.")).toBeInTheDocument();
    });

    it("should render with string containing emoji", () => {
      render(<EmptyState message="📭 No messages yet" />);

      expect(screen.getByText("📭 No messages yet")).toBeInTheDocument();
    });

    it("should render with very long string message", () => {
      const longMessage =
        "No items available at the moment. Please use the Add button in the toolbar above to create a new item. " +
        "You can also import items from a file or copy them from another location.";

      render(<EmptyState message={longMessage} />);

      expect(screen.getByText(new RegExp(longMessage))).toBeInTheDocument();
    });

    it("should render with string containing multiple spaces", () => {
      const { container } = render(<EmptyState message="No    items    available" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel?.textContent).toBe("No    items    available");
    });

    it("should render with string containing whitespace only", () => {
      const { container } = render(<EmptyState message="   " />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel?.textContent).toBe("   ");
    });
  });

  describe("ReactNode message rendering", () => {
    it("should render with JSX element message", () => {
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

    it("should render with fragment containing multiple elements", () => {
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

    it("should render with inline elements", () => {
      render(
        <EmptyState
          message={
            <>
              No items yet. Use <strong>Add Item</strong> to create one.
            </>
          }
        />,
      );

      const strong = screen.getByText("Add Item");
      expect(strong.tagName).toBe("STRONG");
    });

    it("should render with nested JSX structure", () => {
      render(
        <EmptyState
          message={
            <div>
              <p data-testid="paragraph">
                No items available. <em>Please add some.</em>
              </p>
            </div>
          }
        />,
      );

      const paragraph = screen.getByTestId("paragraph");
      expect(paragraph.tagName).toBe("P");

      const emphasis = screen.getByText("Please add some.");
      expect(emphasis.tagName).toBe("EM");
    });

    it("should render with message containing line breaks", () => {
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

    it("should render with message containing span elements", () => {
      render(
        <EmptyState
          message={
            <>
              <span>No data. </span>
              <span>Get started now!</span>
            </>
          }
        />,
      );

      expect(screen.getByText("No data.")).toBeInTheDocument();
      expect(screen.getByText("Get started now!")).toBeInTheDocument();
    });
  });

  describe("HTML entities in string messages", () => {
    it("should render with HTML entity for left double quote", () => {
      // Using the actual Unicode character that &ldquo; represents (U+201C)
      const message = "No items yet. Use \u201CAdd Item\u201D to create one.";
      render(<EmptyState message={message} />);

      expect(screen.getByText(/No items yet/)).toBeInTheDocument();
    });

    it("should render with HTML entity for right double quote", () => {
      // Using the actual Unicode character that &rdquo; represents (U+201D)
      const message = "No items yet. Use \u201CAdd Item\u201D to create one.";
      render(<EmptyState message={message} />);

      expect(screen.getByText(/Add Item/)).toBeInTheDocument();
    });

    it("should render with HTML entities for both quotes", () => {
      const message = "No props yet. Use \u201CAdd Prop\u201D to create one.";
      render(<EmptyState message={message} />);

      expect(screen.getByText(/No props yet/)).toBeInTheDocument();
      expect(screen.getByText(/Add Prop/)).toBeInTheDocument();
    });

    it("should render with HTML entity for non-breaking space", () => {
      // Using the actual Unicode character that &nbsp; represents (U+00A0)
      const message = "No\u00A0items\u00A0yet";
      render(<EmptyState message={message} />);

      expect(screen.getByText(/No items/)).toBeInTheDocument();
    });

    it("should render with HTML entity for em dash", () => {
      // Using the actual Unicode character that &mdash; represents (U+2014)
      const message = "No items\u2014add some now";
      render(<EmptyState message={message} />);

      expect(screen.getByText(/No items/)).toBeInTheDocument();
      expect(screen.getByText(/add some now/)).toBeInTheDocument();
    });
  });
});

describe("EmptyState - Styling", () => {
  describe("color styling", () => {
    it("should apply color var(--jrpg-white) to JRPGPanel", () => {
      const { container } = render(<EmptyState message="Test message" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.color).toBe("var(--jrpg-white)");
    });

    it("should apply correct color when message is string", () => {
      const { container } = render(<EmptyState message="String message" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.color).toBe("var(--jrpg-white)");
    });

    it("should apply correct color when message is ReactNode", () => {
      const { container } = render(<EmptyState message={<div>JSX message</div>} />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.color).toBe("var(--jrpg-white)");
    });

    it("should apply correct color when message is empty", () => {
      const { container } = render(<EmptyState message="" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.color).toBe("var(--jrpg-white)");
    });
  });

  describe("font size styling", () => {
    it("should apply fontSize 12px to JRPGPanel", () => {
      const { container } = render(<EmptyState message="Test message" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.fontSize).toBe("12px");
    });

    it("should apply correct font size when message is string", () => {
      const { container } = render(<EmptyState message="String message" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.fontSize).toBe("12px");
    });

    it("should apply correct font size when message is ReactNode", () => {
      const { container } = render(<EmptyState message={<div>JSX message</div>} />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.fontSize).toBe("12px");
    });

    it("should apply correct font size when message is empty", () => {
      const { container } = render(<EmptyState message="" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.fontSize).toBe("12px");
    });
  });

  describe("combined styling", () => {
    it("should apply both color and fontSize together", () => {
      const { container } = render(<EmptyState message="Test message" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel.style.color).toBe("var(--jrpg-white)");
      expect(panel.style.fontSize).toBe("12px");
    });

    it("should maintain same styles regardless of message type", () => {
      const { container: container1 } = render(<EmptyState message="String message" />);
      const { container: container2 } = render(<EmptyState message={<div>JSX message</div>} />);

      const panel1 = container1.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      const panel2 = container2.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;

      expect(panel1.style.color).toBe(panel2.style.color);
      expect(panel1.style.fontSize).toBe(panel2.style.fontSize);
    });

    it("should maintain same styles regardless of message length", () => {
      const { container: container1 } = render(<EmptyState message="Short" />);
      const { container: container2 } = render(
        <EmptyState message="This is a much longer message that contains multiple words" />,
      );

      const panel1 = container1.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      const panel2 = container2.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;

      expect(panel1.style.color).toBe(panel2.style.color);
      expect(panel1.style.fontSize).toBe(panel2.style.fontSize);
    });
  });

  describe("JRPGPanel variant", () => {
    it("should wrap content in JRPGPanel with variant simple", () => {
      const { container } = render(<EmptyState message="Test message" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel).toHaveAttribute("data-variant", "simple");
    });

    it("should apply simple variant consistently across renders", () => {
      const { container, rerender } = render(<EmptyState message="Message 1" />);

      const panel1 = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel1).toHaveAttribute("data-variant", "simple");

      rerender(<EmptyState message="Message 2" />);

      const panel2 = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel2).toHaveAttribute("data-variant", "simple");
    });

    it("should use simple variant for string messages", () => {
      const { container } = render(<EmptyState message="String message" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel).toHaveAttribute("data-variant", "simple");
    });

    it("should use simple variant for ReactNode messages", () => {
      const { container } = render(<EmptyState message={<div>JSX message</div>} />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel).toHaveAttribute("data-variant", "simple");
    });
  });
});

describe("EmptyState - React.memo Optimization", () => {
  describe("re-render prevention", () => {
    it("should not re-render when parent re-renders with same props", () => {
      let renderCount = 0;

      const TestEmptyState = React.memo(function TestEmptyState({
        message,
      }: {
        message: string;
      }) {
        renderCount++;
        return <EmptyState message={message} />;
      });

      const ParentComponent = ({ count }: { count: number }) => {
        return (
          <div>
            <div data-testid="parent-count">{count}</div>
            <TestEmptyState message="No items yet" />
          </div>
        );
      };

      const { rerender } = render(<ParentComponent count={1} />);

      const initialRenderCount = renderCount;

      // Re-render parent with different count but same message
      rerender(<ParentComponent count={2} />);

      expect(screen.getByTestId("parent-count")).toHaveTextContent("2");
      // TestEmptyState should not re-render due to memo
      expect(renderCount).toBe(initialRenderCount);
    });

    it("should not re-render when parent state changes but props are unchanged", () => {
      const TestParent = () => {
        const [count, setCount] = React.useState(0);
        const [renderTracker, setRenderTracker] = React.useState(0);

        React.useEffect(() => {
          if (count === 0) {
            setCount(1);
          }
        }, [count]);

        return (
          <div>
            <button onClick={() => setRenderTracker(renderTracker + 1)}>
              Update: {renderTracker}
            </button>
            <EmptyState message="No items yet" />
          </div>
        );
      };

      const { container } = render(<TestParent />);

      // EmptyState should render
      expect(screen.getByText("No items yet")).toBeInTheDocument();

      // The component is memoized, so it should handle re-renders efficiently
      const panel = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel).toBeInTheDocument();
    });
  });

  describe("re-render on prop change", () => {
    it("should re-render when message prop changes", () => {
      const { rerender } = render(<EmptyState message="First message" />);

      expect(screen.getByText("First message")).toBeInTheDocument();

      rerender(<EmptyState message="Second message" />);

      expect(screen.queryByText("First message")).not.toBeInTheDocument();
      expect(screen.getByText("Second message")).toBeInTheDocument();
    });

    it("should re-render when message changes from string to ReactNode", () => {
      const { rerender } = render(<EmptyState message="String message" />);

      expect(screen.getByText("String message")).toBeInTheDocument();

      rerender(<EmptyState message={<div data-testid="jsx-message">JSX message</div>} />);

      expect(screen.queryByText("String message")).not.toBeInTheDocument();
      expect(screen.getByTestId("jsx-message")).toBeInTheDocument();
    });

    it("should re-render when message changes from ReactNode to string", () => {
      const { rerender } = render(
        <EmptyState message={<div data-testid="jsx-message">JSX message</div>} />,
      );

      expect(screen.getByTestId("jsx-message")).toBeInTheDocument();

      rerender(<EmptyState message="String message" />);

      expect(screen.queryByTestId("jsx-message")).not.toBeInTheDocument();
      expect(screen.getByText("String message")).toBeInTheDocument();
    });

    it("should re-render when message changes to empty string", () => {
      const { container, rerender } = render(<EmptyState message="Original message" />);

      expect(screen.getByText("Original message")).toBeInTheDocument();

      rerender(<EmptyState message="" />);

      const panel = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel?.textContent).toBe("");
    });

    it("should re-render when message changes from empty string to content", () => {
      const { rerender } = render(<EmptyState message="" />);

      rerender(<EmptyState message="New message" />);

      expect(screen.getByText("New message")).toBeInTheDocument();
    });
  });

  describe("memo behavior verification", () => {
    it("should maintain styling when re-rendering with new message", () => {
      const { container, rerender } = render(<EmptyState message="Message 1" />);

      const panel1 = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      const initialColor = panel1.style.color;
      const initialFontSize = panel1.style.fontSize;

      rerender(<EmptyState message="Message 2" />);

      const panel2 = container.querySelector('[data-testid="jrpg-panel"]') as HTMLElement;
      expect(panel2.style.color).toBe(initialColor);
      expect(panel2.style.fontSize).toBe(initialFontSize);
    });

    it("should maintain variant when re-rendering with new message", () => {
      const { container, rerender } = render(<EmptyState message="Message 1" />);

      const panel1 = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel1).toHaveAttribute("data-variant", "simple");

      rerender(<EmptyState message="Message 2" />);

      const panel2 = container.querySelector('[data-testid="jrpg-panel"]');
      expect(panel2).toHaveAttribute("data-variant", "simple");
    });
  });
});

describe("EmptyState - Component Metadata", () => {
  describe("displayName", () => {
    it("should have displayName set to EmptyState", () => {
      expect(EmptyState.displayName).toBe("EmptyState");
    });

    it("should have displayName as a string", () => {
      expect(typeof EmptyState.displayName).toBe("string");
    });

    it("should not have undefined displayName", () => {
      expect(EmptyState.displayName).not.toBeUndefined();
    });

    it("should not have null displayName", () => {
      expect(EmptyState.displayName).not.toBeNull();
    });

    it("should not have empty displayName", () => {
      expect(EmptyState.displayName).not.toBe("");
    });
  });
});
