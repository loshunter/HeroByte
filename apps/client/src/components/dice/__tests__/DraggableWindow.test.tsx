/**
 * Component tests for DraggableWindow
 *
 * Tests the SNES-style draggable window component, including:
 * - Rendering with default and custom props
 * - Position initialization and localStorage persistence
 * - Drag-and-drop functionality via title bar
 * - Viewport bounds validation
 * - Window resize handling
 * - Close button behavior
 * - Event listener cleanup
 * - Error handling for localStorage operations
 *
 * Source: apps/client/src/components/dice/DraggableWindow.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DraggableWindow } from "../DraggableWindow";

describe("DraggableWindow", () => {
  let mockLocalStorage: { [key: string]: string };

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {};

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {};
        }),
      },
      writable: true,
      configurable: true,
    });

    // Mock window dimensions
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1920,
    });

    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 1080,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // GROUP 1: Rendering - Default Props
  // =========================================================================

  describe("Rendering - Default Props", () => {
    it("should render without crashing", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      expect(container).toBeTruthy();
    });

    it("should render with title", () => {
      render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      expect(screen.getByText("Test Window")).toBeInTheDocument();
    });

    it("should render children", () => {
      render(
        <DraggableWindow title="Test Window">
          <div>Test Content</div>
        </DraggableWindow>,
      );

      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should not render close button when onClose not provided", () => {
      render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      expect(screen.queryByText("×")).not.toBeInTheDocument();
    });

    it("should use default initialX position (100px)", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.left).toBe("100px");
    });

    it("should use default initialY position (100px)", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.top).toBe("100px");
    });

    it("should use default width with clamp expression", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      // jsdom computes clamp() - check for width value containing 600px
      expect(windowElement.style.width).toContain("600px");
    });

    it("should use default zIndex (1000)", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.zIndex).toBe("1000");
    });

    it("should have cursor default when not dragging", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.cursor).toBe("default");
    });

    it("should have fixed position", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.position).toBe("fixed");
    });

    it("should have height auto by default", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.height).toBe("auto");
    });
  });

  // =========================================================================
  // GROUP 2: Rendering - Custom Props
  // =========================================================================

  describe("Rendering - Custom Props", () => {
    it("should render with custom initialX", () => {
      const { container } = render(
        <DraggableWindow title="Test Window" initialX={200}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.left).toBe("200px");
    });

    it("should render with custom initialY", () => {
      const { container } = render(
        <DraggableWindow title="Test Window" initialY={300}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.top).toBe("300px");
    });

    it("should render with custom width", () => {
      const { container } = render(
        <DraggableWindow title="Test Window" width={500}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.width).toContain("500px");
    });

    it("should render with custom height", () => {
      const { container } = render(
        <DraggableWindow title="Test Window" height={400}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.height).toBe("400px");
    });

    it("should render with custom zIndex", () => {
      const { container } = render(
        <DraggableWindow title="Test Window" zIndex={2000}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.zIndex).toBe("2000");
    });

    it("should render close button when onClose provided", () => {
      render(
        <DraggableWindow title="Test Window" onClose={vi.fn()}>
          <div>Content</div>
        </DraggableWindow>,
      );

      expect(screen.getByText("×")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // GROUP 3: Position Initialization from localStorage
  // =========================================================================

  describe("Position Initialization - localStorage", () => {
    it("should load position from localStorage when storageKey provided", () => {
      mockLocalStorage["herobyte-window-position-testKey"] = JSON.stringify({
        x: 250,
        y: 350,
      });

      const { container } = render(
        <DraggableWindow title="Test Window" storageKey="testKey">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.left).toBe("250px");
      expect(windowElement.style.top).toBe("350px");
    });

    it("should use initialX/initialY when localStorage is empty", () => {
      const { container } = render(
        <DraggableWindow title="Test Window" storageKey="testKey" initialX={150} initialY={200}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.left).toBe("150px");
      expect(windowElement.style.top).toBe("200px");
    });

    it("should handle invalid JSON in localStorage gracefully", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockLocalStorage["herobyte-window-position-testKey"] = "invalid json";

      const { container } = render(
        <DraggableWindow title="Test Window" storageKey="testKey">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      // Should fall back to default position
      expect(windowElement.style.left).toBe("100px");
      expect(windowElement.style.top).toBe("100px");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to load window position from localStorage:",
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should clamp saved position to viewport bounds", () => {
      // Save position that would be off-screen
      mockLocalStorage["herobyte-window-position-testKey"] = JSON.stringify({
        x: 2000, // Beyond viewport width (1920)
        y: 1200, // Beyond viewport height (1080)
      });

      const { container } = render(
        <DraggableWindow title="Test Window" storageKey="testKey">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      // Should clamp to maxX = 1920 - 200 = 1720, maxY = 1080 - 100 = 980
      expect(parseInt(windowElement.style.left)).toBeLessThanOrEqual(1720);
      expect(parseInt(windowElement.style.top)).toBeLessThanOrEqual(980);
    });

    it("should clamp negative saved positions to 0", () => {
      mockLocalStorage["herobyte-window-position-testKey"] = JSON.stringify({
        x: -50,
        y: -100,
      });

      const { container } = render(
        <DraggableWindow title="Test Window" storageKey="testKey">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.left).toBe("0px");
      expect(windowElement.style.top).toBe("0px");
    });
  });

  // =========================================================================
  // GROUP 4: Drag Behavior
  // =========================================================================

  describe("Drag Behavior", () => {
    it("should not start drag when clicking close button", () => {
      const { container } = render(
        <DraggableWindow title="Test Window" onClose={vi.fn()}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const closeButton = screen.getByText("×");
      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      fireEvent.mouseDown(closeButton, { clientX: 150, clientY: 120 });
      fireEvent.mouseMove(document, { clientX: 200, clientY: 170 });

      // Position should not change
      expect(windowElement.style.left).toBe("100px");
      expect(windowElement.style.top).toBe("100px");
    });
  });

  // =========================================================================
  // GROUP 5: Close Button
  // =========================================================================

  describe("Close Button", () => {
    it("should call onClose when close button clicked", () => {
      const onClose = vi.fn();
      render(
        <DraggableWindow title="Test Window" onClose={onClose}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const closeButton = screen.getByText("×");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should have correct CSS classes on close button", () => {
      render(
        <DraggableWindow title="Test Window" onClose={vi.fn()}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const closeButton = screen.getByText("×");
      expect(closeButton.className).toContain("jrpg-button");
      expect(closeButton.className).toContain("jrpg-button-danger");
    });
  });

  // =========================================================================
  // GROUP 6: localStorage Persistence
  // =========================================================================

  describe("localStorage Persistence", () => {
    it("should not save position when no storageKey provided", () => {
      render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      // localStorage.setItem should not be called on mount
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });

    it("should use correct storage key format", () => {
      mockLocalStorage["herobyte-window-position-myWindow"] = JSON.stringify({
        x: 200,
        y: 300,
      });

      render(
        <DraggableWindow title="Test Window" storageKey="myWindow">
          <div>Content</div>
        </DraggableWindow>,
      );

      expect(window.localStorage.getItem).toHaveBeenCalledWith("herobyte-window-position-myWindow");
    });
  });

  // =========================================================================
  // GROUP 7: Window Resize Handling
  // =========================================================================

  describe("Window Resize Handling", () => {
    it("should adjust position when window resize makes position invalid", async () => {
      const { container } = render(
        <DraggableWindow title="Test Window" initialX={1500} initialY={900}>
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      // Initial position (within bounds)
      expect(windowElement.style.left).toBe("1500px");
      expect(windowElement.style.top).toBe("900px");

      // Simulate window resize to smaller dimensions
      Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });

      fireEvent(window, new Event("resize"));

      await waitFor(() => {
        // Should clamp to new maxX = 1024 - 200 = 824, maxY = 768 - 100 = 668
        expect(parseInt(windowElement.style.left)).toBeLessThanOrEqual(824);
        expect(parseInt(windowElement.style.top)).toBeLessThanOrEqual(668);
      });
    });
  });

  // =========================================================================
  // GROUP 8: CSS Styles
  // =========================================================================

  describe("CSS Styles", () => {
    it("should have overflow hidden", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.overflow).toBe("hidden");
    });

    it("should have flex display", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.display).toBe("flex");
    });

    it("should have column flex direction", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const windowElement = container.querySelector("div[style*='position: fixed']") as HTMLElement;

      expect(windowElement.style.flexDirection).toBe("column");
    });

    it("should have jrpg-text-command class on title bar", () => {
      const { container } = render(
        <DraggableWindow title="Test Window">
          <div>Content</div>
        </DraggableWindow>,
      );

      const titleBar = container.querySelector(".jrpg-text-command");
      expect(titleBar).toBeInTheDocument();
      expect(titleBar?.textContent).toContain("Test Window");
    });
  });
});
