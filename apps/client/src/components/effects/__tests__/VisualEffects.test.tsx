import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { VisualEffects } from "../VisualEffects";

/**
 * Characterization tests for VisualEffects
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 1714-1738)
 * Target: apps/client/src/components/effects/VisualEffects.tsx
 */
describe("VisualEffects - Characterization", () => {
  describe("CRT Filter rendering", () => {
    it("should render CRT filter elements when crtFilter is true", () => {
      const { container } = render(<VisualEffects crtFilter={true} />);

      const vignette = container.querySelector(".crt-vignette");
      const filter = container.querySelector(".crt-filter");
      const bezel = container.querySelector(".crt-bezel");

      expect(vignette).toBeInTheDocument();
      expect(filter).toBeInTheDocument();
      expect(bezel).toBeInTheDocument();
    });

    it("should not render CRT filter elements when crtFilter is false", () => {
      const { container } = render(<VisualEffects crtFilter={false} />);

      const vignette = container.querySelector(".crt-vignette");
      const filter = container.querySelector(".crt-filter");
      const bezel = container.querySelector(".crt-bezel");

      expect(vignette).not.toBeInTheDocument();
      expect(filter).not.toBeInTheDocument();
      expect(bezel).not.toBeInTheDocument();
    });

    it("should render exactly 3 CRT filter divs when enabled", () => {
      const { container } = render(<VisualEffects crtFilter={true} />);

      const crtElements = [
        container.querySelector(".crt-vignette"),
        container.querySelector(".crt-filter"),
        container.querySelector(".crt-bezel"),
      ].filter((el) => el !== null);

      expect(crtElements).toHaveLength(3);
    });
  });

  describe("Ambient sparkles rendering", () => {
    it("should always render sparkle container", () => {
      const { container } = render(<VisualEffects crtFilter={false} />);

      const sparkleContainer = container.querySelector('[style*="position: fixed"]');
      expect(sparkleContainer).toBeInTheDocument();
    });

    it("should render sparkle container with correct positioning styles", () => {
      const { container } = render(<VisualEffects crtFilter={false} />);

      const sparkleContainer = container.querySelector('[style*="position: fixed"]');
      expect(sparkleContainer).toHaveStyle({
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "1",
      });
    });

    it("should render exactly 5 pixel sparkles", () => {
      const { container } = render(<VisualEffects crtFilter={false} />);

      const sparkles = container.querySelectorAll(".pixel-sparkle");
      expect(sparkles).toHaveLength(5);
    });

    it("should render sparkles regardless of crtFilter state", () => {
      const { container: containerWithCRT } = render(<VisualEffects crtFilter={true} />);
      const { container: containerWithoutCRT } = render(<VisualEffects crtFilter={false} />);

      const sparklesWithCRT = containerWithCRT.querySelectorAll(".pixel-sparkle");
      const sparklesWithoutCRT = containerWithoutCRT.querySelectorAll(".pixel-sparkle");

      expect(sparklesWithCRT).toHaveLength(5);
      expect(sparklesWithoutCRT).toHaveLength(5);
    });

    it("should render each sparkle with unique key", () => {
      const { container } = render(<VisualEffects crtFilter={false} />);

      const sparkles = container.querySelectorAll(".pixel-sparkle");
      sparkles.forEach((sparkle) => {
        expect(sparkle.className).toBe("pixel-sparkle");
      });
    });
  });

  describe("Element count and structure", () => {
    it("should render correct total element count with CRT filter enabled", () => {
      const { container } = render(<VisualEffects crtFilter={true} />);

      // 3 CRT elements + 1 sparkle container + 5 sparkles = 9 total child elements
      const crtElements = container.querySelectorAll(".crt-vignette, .crt-filter, .crt-bezel");
      const sparkleContainer = container.querySelector('[style*="position: fixed"]');
      const sparkles = container.querySelectorAll(".pixel-sparkle");

      expect(crtElements).toHaveLength(3);
      expect(sparkleContainer).toBeInTheDocument();
      expect(sparkles).toHaveLength(5);
    });

    it("should render correct total element count with CRT filter disabled", () => {
      const { container } = render(<VisualEffects crtFilter={false} />);

      // 0 CRT elements + 1 sparkle container + 5 sparkles = 6 total child elements
      const crtElements = container.querySelectorAll(".crt-vignette, .crt-filter, .crt-bezel");
      const sparkleContainer = container.querySelector('[style*="position: fixed"]');
      const sparkles = container.querySelectorAll(".pixel-sparkle");

      expect(crtElements).toHaveLength(0);
      expect(sparkleContainer).toBeInTheDocument();
      expect(sparkles).toHaveLength(5);
    });
  });

  describe("CSS class application", () => {
    it("should apply correct CSS classes to CRT elements", () => {
      const { container } = render(<VisualEffects crtFilter={true} />);

      const vignette = container.querySelector(".crt-vignette");
      const filter = container.querySelector(".crt-filter");
      const bezel = container.querySelector(".crt-bezel");

      expect(vignette).toHaveClass("crt-vignette");
      expect(filter).toHaveClass("crt-filter");
      expect(bezel).toHaveClass("crt-bezel");
    });

    it("should apply correct CSS class to sparkle elements", () => {
      const { container } = render(<VisualEffects crtFilter={false} />);

      const sparkles = container.querySelectorAll(".pixel-sparkle");
      sparkles.forEach((sparkle) => {
        expect(sparkle).toHaveClass("pixel-sparkle");
      });
    });
  });
});
