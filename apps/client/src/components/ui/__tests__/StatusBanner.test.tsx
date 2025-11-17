/**
 * Characterization tests for StatusBanner component
 * Captures existing behavior before extraction from NPCEditor
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBanner } from "../StatusBanner";

describe("StatusBanner", () => {
  describe("error variant", () => {
    it("renders error message with red styling", () => {
      render(<StatusBanner variant="error" message="Update failed" />);

      const banner = screen.getByText("Update failed");
      expect(banner).toBeInTheDocument();

      const styles = window.getComputedStyle(banner);
      expect(styles.color).toBe("rgb(255, 68, 68)"); // #ff4444
      expect(styles.fontSize).toBe("12px");
    });

    it("renders with error background and border", () => {
      const { container } = render(<StatusBanner variant="error" message="Error text" />);

      const banner = container.firstChild as HTMLElement;
      const styles = window.getComputedStyle(banner);

      expect(styles.background).toContain("rgba(255, 0, 0, 0.1)");
      expect(styles.border).toContain("rgba(255, 0, 0, 0.3)");
      expect(styles.borderRadius).toBe("4px");
      expect(styles.padding).toBe("8px");
    });
  });

  describe("loading variant", () => {
    it("renders loading message with gold styling", () => {
      render(<StatusBanner variant="loading" message="Updating..." />);

      const banner = screen.getByText("Updating...");
      expect(banner).toBeInTheDocument();

      const styles = window.getComputedStyle(banner);
      expect(styles.fontSize).toBe("11px");
      expect(styles.textAlign).toBe("center");
    });

    it("renders with gold background and border", () => {
      const { container } = render(<StatusBanner variant="loading" message="Loading..." />);

      const banner = container.firstChild as HTMLElement;
      const styles = window.getComputedStyle(banner);

      expect(styles.background).toContain("rgba(218, 165, 32, 0.1)");
      expect(styles.borderRadius).toBe("4px");
      expect(styles.padding).toBe("6px");
    });
  });

  describe("visibility", () => {
    it("renders when visible is true", () => {
      render(<StatusBanner variant="error" message="Test" visible={true} />);
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("renders when visible is undefined (default)", () => {
      render(<StatusBanner variant="error" message="Test" />);
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("does not render when visible is false", () => {
      render(<StatusBanner variant="error" message="Test" visible={false} />);
      expect(screen.queryByText("Test")).not.toBeInTheDocument();
    });
  });

  describe("multiple status messages", () => {
    it("can render multiple error banners independently", () => {
      const { rerender } = render(<StatusBanner variant="error" message="Error 1" />);
      expect(screen.getByText("Error 1")).toBeInTheDocument();

      rerender(
        <>
          <StatusBanner variant="error" message="Error 1" />
          <StatusBanner variant="error" message="Error 2" />
        </>,
      );

      expect(screen.getByText("Error 1")).toBeInTheDocument();
      expect(screen.getByText("Error 2")).toBeInTheDocument();
    });

    it("can render both error and loading banners together", () => {
      render(
        <>
          <StatusBanner variant="error" message="Failed" />
          <StatusBanner variant="loading" message="Retrying..." />
        </>,
      );

      expect(screen.getByText("Failed")).toBeInTheDocument();
      expect(screen.getByText("Retrying...")).toBeInTheDocument();
    });
  });
});
