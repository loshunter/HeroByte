/**
 * Characterization tests for CollapsibleSection
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:14-32
 * Target: apps/client/src/components/ui/CollapsibleSection.tsx
 *
 * Components tested:
 * - CollapsibleSection inline component (lines 14-32)
 *
 * Usage in DMMenu.tsx:
 * - Line 865: Map Transform section
 * - Line 1022: Grid Controls section
 * - Line 1083: Grid Alignment Wizard
 * - Line 1202: Player Staging Zone section
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// For now, we need to extract the CollapsibleSection from DMMenu.tsx
// This is a temporary solution - after extraction, import will change
const CollapsibleSection = ({ isCollapsed, children }: { isCollapsed: boolean; children: React.ReactNode }) => {
  return (
    <div
      style={{
        maxHeight: isCollapsed ? "0" : "2000px",
        opacity: isCollapsed ? 0 : 1,
        overflow: "hidden",
        transition: "max-height 150ms ease-in-out, opacity 150ms ease-in-out",
      }}
    >
      {children}
    </div>
  );
};

describe("CollapsibleSection - Characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe("basic rendering", () => {
    it("should render children when NOT collapsed (isCollapsed: false)", () => {
      render(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="test-content">Test Content</div>
        </CollapsibleSection>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
      expect(screen.getByTestId("test-content")).toHaveTextContent("Test Content");
    });

    it("should render children when collapsed (isCollapsed: true)", () => {
      render(
        <CollapsibleSection isCollapsed={true}>
          <div data-testid="test-content">Test Content</div>
        </CollapsibleSection>
      );

      // Children are still rendered in DOM, just hidden
      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // CSS Properties Tests
  // ============================================================================

  describe("CSS properties", () => {
    it("should apply maxHeight: 2000px when NOT collapsed", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={false}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("2000px");
    });

    it("should apply maxHeight: 0 when collapsed", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={true}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("0");
    });

    it("should apply opacity: 1 when NOT collapsed", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={false}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.opacity).toBe("1");
    });

    it("should apply opacity: 0 when collapsed", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={true}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.opacity).toBe("0");
    });

    it("should always apply overflow: hidden", () => {
      const { container: container1 } = render(
        <CollapsibleSection isCollapsed={false}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper1 = container1.firstChild as HTMLElement;
      expect(wrapper1.style.overflow).toBe("hidden");

      const { container: container2 } = render(
        <CollapsibleSection isCollapsed={true}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper2 = container2.firstChild as HTMLElement;
      expect(wrapper2.style.overflow).toBe("hidden");
    });

    it("should always apply correct transition property", () => {
      const { container: container1 } = render(
        <CollapsibleSection isCollapsed={false}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper1 = container1.firstChild as HTMLElement;
      expect(wrapper1.style.transition).toBe("max-height 150ms ease-in-out, opacity 150ms ease-in-out");

      const { container: container2 } = render(
        <CollapsibleSection isCollapsed={true}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper2 = container2.firstChild as HTMLElement;
      expect(wrapper2.style.transition).toBe("max-height 150ms ease-in-out, opacity 150ms ease-in-out");
    });
  });

  // ============================================================================
  // Children Rendering Tests
  // ============================================================================

  describe("children rendering", () => {
    it("should render simple text children", () => {
      render(
        <CollapsibleSection isCollapsed={false}>
          Simple text content
        </CollapsibleSection>
      );

      const wrapper = screen.getByText("Simple text content");
      expect(wrapper).toBeInTheDocument();
    });

    it("should render complex JSX children (multiple elements)", () => {
      render(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </CollapsibleSection>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByTestId("child-3")).toBeInTheDocument();
    });

    it("should handle null children", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={false}>
          {null}
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
      expect(wrapper.children.length).toBe(0);
    });

    it("should handle undefined children", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={false}>
          {undefined}
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
      expect(wrapper.children.length).toBe(0);
    });

    it("should render ReactNode children (components)", () => {
      const ChildComponent = () => <div data-testid="child-component">Child Component</div>;

      render(
        <CollapsibleSection isCollapsed={false}>
          <ChildComponent />
        </CollapsibleSection>
      );

      expect(screen.getByTestId("child-component")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // State Transitions Tests
  // ============================================================================

  describe("state transitions", () => {
    it("should toggle from collapsed to expanded", () => {
      const { container, rerender } = render(
        <CollapsibleSection isCollapsed={true}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      let wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("0");
      expect(wrapper.style.opacity).toBe("0");

      // Toggle to expanded
      rerender(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("2000px");
      expect(wrapper.style.opacity).toBe("1");
    });

    it("should toggle from expanded to collapsed", () => {
      const { container, rerender } = render(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      let wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("2000px");
      expect(wrapper.style.opacity).toBe("1");

      // Toggle to collapsed
      rerender(
        <CollapsibleSection isCollapsed={true}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("0");
      expect(wrapper.style.opacity).toBe("0");
    });

    it("should handle multiple rapid toggles", () => {
      const { container, rerender } = render(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      let wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("2000px");

      // Toggle 1: collapse
      rerender(
        <CollapsibleSection isCollapsed={true}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("0");

      // Toggle 2: expand
      rerender(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("2000px");

      // Toggle 3: collapse
      rerender(
        <CollapsibleSection isCollapsed={true}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("0");

      // Toggle 4: expand
      rerender(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.maxHeight).toBe("2000px");
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty children", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={false}>
          {""}
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("should handle very long content", () => {
      const longContent = "a".repeat(10000);

      render(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="long-content">{longContent}</div>
        </CollapsibleSection>
      );

      const content = screen.getByTestId("long-content");
      expect(content).toBeInTheDocument();
      expect(content.textContent).toBe(longContent);
    });

    it("should handle nested CollapsibleSection components", () => {
      render(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="outer-content">Outer</div>
          <CollapsibleSection isCollapsed={false}>
            <div data-testid="inner-content">Inner</div>
          </CollapsibleSection>
        </CollapsibleSection>
      );

      expect(screen.getByTestId("outer-content")).toBeInTheDocument();
      expect(screen.getByTestId("inner-content")).toBeInTheDocument();
    });

    it("should handle nested CollapsibleSection with different states", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="outer-content">Outer</div>
          <CollapsibleSection isCollapsed={true}>
            <div data-testid="inner-content">Inner</div>
          </CollapsibleSection>
        </CollapsibleSection>
      );

      const wrappers = container.querySelectorAll("div[style*='transition']");
      const outerWrapper = wrappers[0] as HTMLElement;
      const innerWrapper = wrappers[1] as HTMLElement;

      // Outer should be expanded
      expect(outerWrapper.style.maxHeight).toBe("2000px");
      expect(outerWrapper.style.opacity).toBe("1");

      // Inner should be collapsed
      expect(innerWrapper.style.maxHeight).toBe("0");
      expect(innerWrapper.style.opacity).toBe("0");
    });
  });

  // ============================================================================
  // Real-world Usage Pattern Tests (from DMMenu.tsx)
  // ============================================================================

  describe("real-world usage patterns", () => {
    it("should work with complex form controls (like in Map Transform section)", () => {
      render(
        <CollapsibleSection isCollapsed={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "4px",
              }}
            >
              <span data-testid="label">Scale</span>
              <span data-testid="value">1.00x</span>
            </div>
            <input
              data-testid="slider"
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              defaultValue={1}
            />
          </div>
        </CollapsibleSection>
      );

      expect(screen.getByTestId("label")).toBeInTheDocument();
      expect(screen.getByTestId("value")).toBeInTheDocument();
      expect(screen.getByTestId("slider")).toBeInTheDocument();
    });

    it("should work with multiple inputs (like in Grid Controls section)", () => {
      render(
        <CollapsibleSection isCollapsed={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span data-testid="grid-size-label">Grid Size</span>
              <span data-testid="grid-size-value">50px</span>
            </div>
            <input
              data-testid="grid-size-slider"
              type="range"
              min={10}
              max={500}
              step={5}
              defaultValue={50}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span data-testid="square-size-label">Square Size</span>
              <span data-testid="square-size-value">5ft</span>
            </div>
            <input
              data-testid="square-size-slider"
              type="range"
              min={1}
              max={20}
              step={1}
              defaultValue={5}
            />
          </div>
        </CollapsibleSection>
      );

      expect(screen.getByTestId("grid-size-label")).toBeInTheDocument();
      expect(screen.getByTestId("grid-size-slider")).toBeInTheDocument();
      expect(screen.getByTestId("square-size-label")).toBeInTheDocument();
      expect(screen.getByTestId("square-size-slider")).toBeInTheDocument();
    });

    it("should maintain styling when collapsed", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={true}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span data-testid="content">Content</span>
          </div>
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;

      // Should be collapsed
      expect(wrapper.style.maxHeight).toBe("0");
      expect(wrapper.style.opacity).toBe("0");
      expect(wrapper.style.overflow).toBe("hidden");

      // Content should still exist in DOM
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should preserve all CSS properties during state changes", () => {
      const { container, rerender } = render(
        <CollapsibleSection isCollapsed={false}>
          <div>Content</div>
        </CollapsibleSection>
      );

      let wrapper = container.firstChild as HTMLElement;

      // Initial state
      expect(wrapper.style.overflow).toBe("hidden");
      expect(wrapper.style.transition).toBe("max-height 150ms ease-in-out, opacity 150ms ease-in-out");

      // Toggle to collapsed
      rerender(
        <CollapsibleSection isCollapsed={true}>
          <div>Content</div>
        </CollapsibleSection>
      );

      wrapper = container.firstChild as HTMLElement;

      // CSS properties should be maintained
      expect(wrapper.style.overflow).toBe("hidden");
      expect(wrapper.style.transition).toBe("max-height 150ms ease-in-out, opacity 150ms ease-in-out");
    });
  });

  // ============================================================================
  // Wrapper Element Tests
  // ============================================================================

  describe("wrapper element", () => {
    it("should render a single wrapper div", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={false}>
          <div data-testid="content">Content</div>
        </CollapsibleSection>
      );

      // Should have exactly one child (the wrapper div)
      expect(container.children.length).toBe(1);
      expect(container.firstChild?.nodeName).toBe("DIV");
    });

    it("should apply all required inline styles to wrapper div", () => {
      const { container } = render(
        <CollapsibleSection isCollapsed={false}>
          <div>Content</div>
        </CollapsibleSection>
      );

      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper.style.maxHeight).toBeTruthy();
      expect(wrapper.style.opacity).toBeTruthy();
      expect(wrapper.style.overflow).toBeTruthy();
      expect(wrapper.style.transition).toBeTruthy();
    });

    it("should update only maxHeight and opacity when isCollapsed changes", () => {
      const { container, rerender } = render(
        <CollapsibleSection isCollapsed={false}>
          <div>Content</div>
        </CollapsibleSection>
      );

      let wrapper = container.firstChild as HTMLElement;
      const initialOverflow = wrapper.style.overflow;
      const initialTransition = wrapper.style.transition;

      rerender(
        <CollapsibleSection isCollapsed={true}>
          <div>Content</div>
        </CollapsibleSection>
      );

      wrapper = container.firstChild as HTMLElement;

      // These should remain constant
      expect(wrapper.style.overflow).toBe(initialOverflow);
      expect(wrapper.style.transition).toBe(initialTransition);
    });
  });
});
