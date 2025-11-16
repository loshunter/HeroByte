/**
 * Comprehensive tests for Toast components
 *
 * Components: Toast, ToastContainer
 * Purpose: Non-blocking feedback messages with auto-dismiss and JRPG styling
 *
 * Test Coverage:
 * - Toast Component:
 *   - Rendering with all toast types (success, error, warning, info)
 *   - Icons for each type
 *   - Styles for each type
 *   - Message sanitization
 *   - Click to dismiss functionality
 *   - Auto-dismiss with default duration
 *   - Auto-dismiss with custom duration
 *   - No auto-dismiss when duration is 0
 *   - Exit animation trigger
 *   - Exit animation completion and onDismiss call
 *   - Cleanup of timeouts on unmount
 * - ToastContainer Component:
 *   - Rendering multiple messages
 *   - Returns null when messages array is empty
 *   - Container positioning and styling
 *   - Keyframes animation CSS injection
 *   - onDismiss callback propagation
 *   - Message mapping with correct keys
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastContainer, type ToastMessage } from "../Toast";
import * as sanitizeModule from "../../../utils/sanitize";

// Mock the sanitize module
vi.mock("../../../utils/sanitize", () => ({
  sanitizeText: vi.fn((text: string) => text),
}));

describe("Toast Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  describe("Rendering", () => {
    it("should render toast with success type and correct icon", () => {
      const message: ToastMessage = {
        id: "test-1",
        type: "success",
        message: "Success message",
      };

      render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      expect(screen.getByText("✓")).toBeInTheDocument();
      expect(screen.getByText("Success message")).toBeInTheDocument();
    });

    it("should render toast with error type and correct icon", () => {
      const message: ToastMessage = {
        id: "test-2",
        type: "error",
        message: "Error message",
      };

      render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      expect(screen.getByText("✕")).toBeInTheDocument();
      expect(screen.getByText("Error message")).toBeInTheDocument();
    });

    it("should render toast with warning type and correct icon", () => {
      const message: ToastMessage = {
        id: "test-3",
        type: "warning",
        message: "Warning message",
      };

      render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      expect(screen.getByText("⚠")).toBeInTheDocument();
      expect(screen.getByText("Warning message")).toBeInTheDocument();
    });

    it("should render toast with info type and correct icon", () => {
      const message: ToastMessage = {
        id: "test-4",
        type: "info",
        message: "Info message",
      };

      render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      expect(screen.getByText("ℹ")).toBeInTheDocument();
      expect(screen.getByText("Info message")).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("should apply success styles", () => {
      const message: ToastMessage = {
        id: "test-1",
        type: "success",
        message: "Success",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      expect(toast).toHaveStyle({
        background: "var(--jrpg-success-bg, #1a3d2e)",
        color: "var(--jrpg-success-text, #5affad)",
      });
      expect(toast.style.borderColor).toBe("var(--jrpg-success-border, #5affad)");
    });

    it("should apply error styles", () => {
      const message: ToastMessage = {
        id: "test-2",
        type: "error",
        message: "Error",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      expect(toast).toHaveStyle({
        background: "var(--jrpg-error-bg, #3d1a1a)",
        color: "var(--jrpg-error-text, #ff5a5a)",
      });
      expect(toast.style.borderColor).toBe("var(--jrpg-error-border, #ff5a5a)");
    });

    it("should apply warning styles", () => {
      const message: ToastMessage = {
        id: "test-3",
        type: "warning",
        message: "Warning",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      expect(toast).toHaveStyle({
        background: "var(--jrpg-warning-bg, #3d2e1a)",
        color: "var(--jrpg-warning-text, #ffc107)",
      });
      expect(toast.style.borderColor).toBe("var(--jrpg-warning-border, #ffc107)");
    });

    it("should apply info styles", () => {
      const message: ToastMessage = {
        id: "test-4",
        type: "info",
        message: "Info",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      expect(toast).toHaveStyle({
        background: "var(--jrpg-info-bg, #1a2a3d)",
        color: "var(--jrpg-info-text, #5a9fff)",
      });
      expect(toast.style.borderColor).toBe("var(--jrpg-info-border, #5a9fff)");
    });

    it("should apply base styles to all toast types", () => {
      const message: ToastMessage = {
        id: "test-5",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      expect(toast).toHaveStyle({
        padding: "12px 16px",
        borderRadius: "6px",
        marginBottom: "8px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "0.875rem",
        fontWeight: "600",
        cursor: "pointer",
      });
      // Border is tested via borderColor in type-specific tests
      expect(toast.style.borderWidth).toBe("2px");
      expect(toast.style.borderStyle).toBe("solid");
    });

    it("should apply enter animation by default", () => {
      const message: ToastMessage = {
        id: "test-6",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      expect(toast.style.animation).toContain("toast-enter");
    });

    it("should apply exit animation when isExiting is true", async () => {
      const message: ToastMessage = {
        id: "test-7",
        type: "success",
        message: "Test",
        duration: 100,
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      // Fast-forward to trigger exit animation
      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });

      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;
      expect(toast.style.animation).toContain("toast-exit");
    });
  });

  describe("Message Sanitization", () => {
    it("should sanitize message text using sanitizeText utility", () => {
      const message: ToastMessage = {
        id: "test-8",
        type: "info",
        message: "<script>alert('xss')</script>Safe message",
      };

      render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      expect(sanitizeModule.sanitizeText).toHaveBeenCalledWith(
        "<script>alert('xss')</script>Safe message",
      );
    });

    it("should display sanitized message text", () => {
      const mockSanitize = vi.mocked(sanitizeModule.sanitizeText);
      mockSanitize.mockReturnValueOnce("Sanitized message");

      const message: ToastMessage = {
        id: "test-9",
        type: "info",
        message: "Dangerous message",
      };

      render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      expect(screen.getByText("Sanitized message")).toBeInTheDocument();
    });
  });

  describe("Click to Dismiss", () => {
    it("should call onDismiss when toast is clicked", () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-10",
        type: "success",
        message: "Click me",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      fireEvent.click(toast);

      expect(onDismiss).toHaveBeenCalledWith("test-10");
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("should have click to dismiss title attribute", () => {
      const message: ToastMessage = {
        id: "test-11",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const toast = container.querySelector('[title="Click to dismiss"]');

      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute("title", "Click to dismiss");
    });

    it("should have cursor pointer style for clickability indication", () => {
      const message: ToastMessage = {
        id: "test-12",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      expect(toast).toHaveStyle({ cursor: "pointer" });
    });
  });

  describe("Auto-dismiss with Default Duration", () => {
    it("should trigger exit animation after default 3000ms", async () => {
      const message: ToastMessage = {
        id: "test-13",
        type: "success",
        message: "Auto dismiss",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      // Before timeout
      let toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;
      expect(toast.style.animation).toContain("toast-enter");

      // Advance to trigger exit
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;
      expect(toast.style.animation).toContain("toast-exit");
    });

    it("should call onDismiss after default duration plus exit animation (3300ms total)", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-14",
        type: "success",
        message: "Auto dismiss",
      };

      render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      // Fast-forward past dismiss timeout
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });
      expect(onDismiss).not.toHaveBeenCalled();

      // Fast-forward past exit animation
      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledWith("test-14");
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("Auto-dismiss with Custom Duration", () => {
    it("should trigger exit animation after custom duration", async () => {
      const message: ToastMessage = {
        id: "test-15",
        type: "success",
        message: "Custom duration",
        duration: 500,
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      // Before timeout
      let toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;
      expect(toast.style.animation).toContain("toast-enter");

      // Advance to trigger exit
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });

      toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;
      expect(toast.style.animation).toContain("toast-exit");
    });

    it("should call onDismiss after custom duration plus exit animation", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-16",
        type: "success",
        message: "Custom duration",
        duration: 1000,
      };

      render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      // Fast-forward past dismiss timeout
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });
      expect(onDismiss).not.toHaveBeenCalled();

      // Fast-forward past exit animation
      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledWith("test-16");
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("should handle very short custom duration", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-17",
        type: "success",
        message: "Short duration",
        duration: 100,
      };

      render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });
      expect(onDismiss).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledWith("test-17");
    });
  });

  describe("No Auto-dismiss (duration: 0)", () => {
    it("should not auto-dismiss when duration is 0", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-18",
        type: "error",
        message: "Persistent message",
        duration: 0,
      };

      render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      // Advance time significantly
      await act(async () => {
        vi.advanceTimersByTime(10000);
        await Promise.resolve();
      });

      // Should not have been dismissed
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("should not trigger exit animation when duration is 0", async () => {
      const message: ToastMessage = {
        id: "test-19",
        type: "error",
        message: "Persistent message",
        duration: 0,
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      await act(async () => {
        vi.advanceTimersByTime(10000);
        await Promise.resolve();
      });

      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;
      expect(toast.style.animation).toContain("toast-enter");
      expect(toast.style.animation).not.toContain("toast-exit");
    });

    it("should still allow manual dismiss when duration is 0", () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-20",
        type: "error",
        message: "Persistent message",
        duration: 0,
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);
      const toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;

      fireEvent.click(toast);

      expect(onDismiss).toHaveBeenCalledWith("test-20");
    });
  });

  describe("Exit Animation Timing", () => {
    it("should set isExiting state after dismiss timeout", async () => {
      const message: ToastMessage = {
        id: "test-21",
        type: "success",
        message: "Test",
        duration: 1000,
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);

      // Initially not exiting
      let toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;
      expect(toast.style.animation).toContain("toast-enter");

      // After dismiss timeout
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      toast = container.querySelector('[title="Click to dismiss"]') as HTMLElement;
      expect(toast.style.animation).toContain("toast-exit");
    });

    it("should call onDismiss exactly 300ms after exit animation starts", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-22",
        type: "success",
        message: "Test",
        duration: 1000,
      };

      render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      // Advance to start exit animation
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Not yet dismissed
      expect(onDismiss).not.toHaveBeenCalled();

      // Advance exactly 300ms for exit animation
      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(onDismiss).toHaveBeenCalledWith("test-22");
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("should not call onDismiss before exit animation completes", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-23",
        type: "success",
        message: "Test",
        duration: 1000,
      };

      render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });
      expect(onDismiss).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(299);
        await Promise.resolve();
      });
      expect(onDismiss).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe("Cleanup on Unmount", () => {
    it("should cleanup dismiss timeout on unmount", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-24",
        type: "success",
        message: "Test",
        duration: 3000,
      };

      const { unmount } = render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      // Unmount before timeout
      unmount();

      // Fast-forward past when timeout would have fired
      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      // Should not have been called
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("should cleanup exit timeout on unmount", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-25",
        type: "success",
        message: "Test",
        duration: 1000,
      };

      const { unmount } = render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      // Advance to start exit animation
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      // Unmount before exit completes
      unmount();

      // Fast-forward past when exit would have completed
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });

      // Should not have been called
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("should cleanup both timeouts on early unmount", async () => {
      const onDismiss = vi.fn();
      const message: ToastMessage = {
        id: "test-26",
        type: "success",
        message: "Test",
        duration: 3000,
      };

      const { unmount } = render(<ToastContainer messages={[message]} onDismiss={onDismiss} />);

      // Unmount immediately
      unmount();

      // Fast-forward significantly
      await act(async () => {
        vi.advanceTimersByTime(10000);
        await Promise.resolve();
      });

      // Should not have been called
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});

describe("ToastContainer Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  describe("Rendering Multiple Messages", () => {
    it("should render multiple toast messages", () => {
      const messages: ToastMessage[] = [
        { id: "1", type: "success", message: "First message" },
        { id: "2", type: "error", message: "Second message" },
        { id: "3", type: "info", message: "Third message" },
      ];

      render(<ToastContainer messages={messages} onDismiss={vi.fn()} />);

      expect(screen.getByText("First message")).toBeInTheDocument();
      expect(screen.getByText("Second message")).toBeInTheDocument();
      expect(screen.getByText("Third message")).toBeInTheDocument();
    });

    it("should render each toast with correct type", () => {
      const messages: ToastMessage[] = [
        { id: "1", type: "success", message: "Success" },
        { id: "2", type: "error", message: "Error" },
        { id: "3", type: "warning", message: "Warning" },
        { id: "4", type: "info", message: "Info" },
      ];

      render(<ToastContainer messages={messages} onDismiss={vi.fn()} />);

      expect(screen.getAllByText("✓")).toHaveLength(1);
      expect(screen.getAllByText("✕")).toHaveLength(1);
      expect(screen.getAllByText("⚠")).toHaveLength(1);
      expect(screen.getAllByText("ℹ")).toHaveLength(1);
    });

    it("should use message id as key for each toast", () => {
      const messages: ToastMessage[] = [
        { id: "unique-1", type: "success", message: "First" },
        { id: "unique-2", type: "error", message: "Second" },
      ];

      const { container } = render(<ToastContainer messages={messages} onDismiss={vi.fn()} />);
      const toasts = container.querySelectorAll('[title="Click to dismiss"]');

      expect(toasts).toHaveLength(2);
    });
  });

  describe("Empty Messages Array", () => {
    it("should return null when messages array is empty", () => {
      const { container } = render(<ToastContainer messages={[]} onDismiss={vi.fn()} />);

      expect(container.firstChild).toBeNull();
    });

    it("should not render container when messages array is empty", () => {
      const { container } = render(<ToastContainer messages={[]} onDismiss={vi.fn()} />);

      const containerDiv = container.querySelector('[style*="position: fixed"]');
      expect(containerDiv).not.toBeInTheDocument();
    });

    it("should not inject CSS when messages array is empty", () => {
      const { container } = render(<ToastContainer messages={[]} onDismiss={vi.fn()} />);

      const style = container.querySelector("style");
      expect(style).not.toBeInTheDocument();
    });
  });

  describe("Container Positioning and Styling", () => {
    it("should apply fixed positioning to container", () => {
      const message: ToastMessage = {
        id: "test-1",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const containerDiv = container.querySelector('[style*="position: fixed"]') as HTMLElement;

      expect(containerDiv).toHaveStyle({
        position: "fixed",
        top: "80px",
        right: "20px",
        zIndex: "10000",
        maxWidth: "400px",
        pointerEvents: "auto",
      });
    });

    it("should have high z-index for overlay", () => {
      const message: ToastMessage = {
        id: "test-2",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const containerDiv = container.querySelector('[style*="position: fixed"]') as HTMLElement;

      expect(containerDiv).toHaveStyle({ zIndex: "10000" });
    });

    it("should position container at top-right", () => {
      const message: ToastMessage = {
        id: "test-3",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const containerDiv = container.querySelector('[style*="position: fixed"]') as HTMLElement;

      expect(containerDiv).toHaveStyle({
        top: "80px",
        right: "20px",
      });
    });

    it("should set max width on container", () => {
      const message: ToastMessage = {
        id: "test-4",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const containerDiv = container.querySelector('[style*="position: fixed"]') as HTMLElement;

      expect(containerDiv).toHaveStyle({ maxWidth: "400px" });
    });

    it("should enable pointer events on container", () => {
      const message: ToastMessage = {
        id: "test-5",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const containerDiv = container.querySelector('[style*="position: fixed"]') as HTMLElement;

      expect(containerDiv).toHaveStyle({ pointerEvents: "auto" });
    });
  });

  describe("CSS Keyframes Animation", () => {
    it("should inject CSS with toast-enter keyframes", () => {
      const message: ToastMessage = {
        id: "test-1",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const style = container.querySelector("style");

      expect(style).toBeInTheDocument();
      expect(style?.textContent).toContain("@keyframes toast-enter");
      expect(style?.textContent).toContain("opacity: 0");
      expect(style?.textContent).toContain("transform: translateY(-20px)");
      expect(style?.textContent).toContain("opacity: 1");
      expect(style?.textContent).toContain("transform: translateY(0)");
    });

    it("should inject CSS with toast-exit keyframes", () => {
      const message: ToastMessage = {
        id: "test-2",
        type: "success",
        message: "Test",
      };

      const { container } = render(<ToastContainer messages={[message]} onDismiss={vi.fn()} />);
      const style = container.querySelector("style");

      expect(style).toBeInTheDocument();
      expect(style?.textContent).toContain("@keyframes toast-exit");
      expect(style?.textContent).toContain("opacity: 1");
      expect(style?.textContent).toContain("transform: translateY(0)");
      expect(style?.textContent).toContain("opacity: 0");
      expect(style?.textContent).toContain("transform: translateY(-20px)");
    });

    it("should inject CSS exactly once even with multiple messages", () => {
      const messages: ToastMessage[] = [
        { id: "1", type: "success", message: "First" },
        { id: "2", type: "error", message: "Second" },
        { id: "3", type: "info", message: "Third" },
      ];

      const { container } = render(<ToastContainer messages={messages} onDismiss={vi.fn()} />);
      const styles = container.querySelectorAll("style");

      expect(styles).toHaveLength(1);
    });
  });

  describe("onDismiss Callback Propagation", () => {
    it("should propagate onDismiss to each toast", () => {
      const onDismiss = vi.fn();
      const messages: ToastMessage[] = [
        { id: "1", type: "success", message: "First" },
        { id: "2", type: "error", message: "Second" },
      ];

      const { container } = render(<ToastContainer messages={messages} onDismiss={onDismiss} />);
      const toasts = container.querySelectorAll('[title="Click to dismiss"]');

      fireEvent.click(toasts[0]);
      expect(onDismiss).toHaveBeenCalledWith("1");

      fireEvent.click(toasts[1]);
      expect(onDismiss).toHaveBeenCalledWith("2");

      expect(onDismiss).toHaveBeenCalledTimes(2);
    });

    it("should call onDismiss with correct id for each auto-dismissed toast", async () => {
      const onDismiss = vi.fn();
      const messages: ToastMessage[] = [
        { id: "auto-1", type: "success", message: "First", duration: 1000 },
        { id: "auto-2", type: "error", message: "Second", duration: 2000 },
      ];

      render(<ToastContainer messages={messages} onDismiss={onDismiss} />);

      // First toast auto-dismisses at 1000ms + 300ms = 1300ms
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledWith("auto-1");

      // Second toast auto-dismisses at 2000ms + 300ms = 2300ms total (1000ms more from current time)
      await act(async () => {
        vi.advanceTimersByTime(700);
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledWith("auto-2");

      expect(onDismiss).toHaveBeenCalledTimes(2);
    });
  });

  describe("Message Mapping", () => {
    it("should map each message to a Toast component", () => {
      const messages: ToastMessage[] = [
        { id: "1", type: "success", message: "Message 1" },
        { id: "2", type: "error", message: "Message 2" },
        { id: "3", type: "warning", message: "Message 3" },
        { id: "4", type: "info", message: "Message 4" },
      ];

      const { container } = render(<ToastContainer messages={messages} onDismiss={vi.fn()} />);
      const toasts = container.querySelectorAll('[title="Click to dismiss"]');

      expect(toasts).toHaveLength(4);
    });

    it("should preserve message order in rendering", () => {
      const messages: ToastMessage[] = [
        { id: "1", type: "success", message: "First" },
        { id: "2", type: "error", message: "Second" },
        { id: "3", type: "info", message: "Third" },
      ];

      const { container } = render(<ToastContainer messages={messages} onDismiss={vi.fn()} />);
      const toasts = container.querySelectorAll('[title="Click to dismiss"]');

      expect(toasts[0]).toHaveTextContent("First");
      expect(toasts[1]).toHaveTextContent("Second");
      expect(toasts[2]).toHaveTextContent("Third");
    });

    it("should handle dynamic message arrays", () => {
      const messages1: ToastMessage[] = [{ id: "1", type: "success", message: "First" }];

      const { rerender, container } = render(
        <ToastContainer messages={messages1} onDismiss={vi.fn()} />,
      );

      expect(container.querySelectorAll('[title="Click to dismiss"]')).toHaveLength(1);

      const messages2: ToastMessage[] = [
        { id: "1", type: "success", message: "First" },
        { id: "2", type: "error", message: "Second" },
      ];

      rerender(<ToastContainer messages={messages2} onDismiss={vi.fn()} />);

      expect(container.querySelectorAll('[title="Click to dismiss"]')).toHaveLength(2);
    });
  });

  describe("Integration", () => {
    it("should handle complete lifecycle of multiple toasts", async () => {
      const onDismiss = vi.fn();
      const messages: ToastMessage[] = [
        { id: "1", type: "success", message: "Quick", duration: 500 },
        { id: "2", type: "error", message: "Persistent", duration: 0 },
        { id: "3", type: "info", message: "Normal", duration: 3000 },
      ];

      const { container } = render(<ToastContainer messages={messages} onDismiss={onDismiss} />);

      // All toasts visible
      expect(container.querySelectorAll('[title="Click to dismiss"]')).toHaveLength(3);

      // Quick toast auto-dismisses at 500ms + 300ms = 800ms
      await act(async () => {
        vi.advanceTimersByTime(500);
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledWith("1");

      // Normal toast auto-dismisses at 3000ms + 300ms = 3300ms total (2500ms more from current time)
      await act(async () => {
        vi.advanceTimersByTime(2200);
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledWith("3");
      expect(onDismiss).not.toHaveBeenCalledWith("2");

      expect(onDismiss).toHaveBeenCalledTimes(2);
    });

    it("should handle mix of manual and auto dismissals", async () => {
      const onDismiss = vi.fn();
      const messages: ToastMessage[] = [
        { id: "1", type: "success", message: "Auto", duration: 1000 },
        { id: "2", type: "error", message: "Manual", duration: 5000 },
      ];

      const { container } = render(<ToastContainer messages={messages} onDismiss={onDismiss} />);

      // Manually dismiss second toast
      const toasts = container.querySelectorAll('[title="Click to dismiss"]');
      fireEvent.click(toasts[1]);
      expect(onDismiss).toHaveBeenCalledWith("2");
      expect(onDismiss).toHaveBeenCalledTimes(1);

      // First toast auto-dismisses at 1000ms + 300ms = 1300ms
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledWith("1");

      expect(onDismiss).toHaveBeenCalledTimes(2);
    });
  });
});
