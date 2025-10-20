import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MultiSelectToolbar } from "../MultiSelectToolbar";

/**
 * Characterization tests for MultiSelectToolbar
 *
 * These tests capture the behavior of the multi-select toolbar BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 1482-1558)
 * Target: apps/client/src/components/layout/MultiSelectToolbar.tsx
 */
describe("MultiSelectToolbar - Characterization", () => {
  describe("visibility conditions", () => {
    it("should render when isDM is true and objects are selected", () => {
      const selectedObjectIds = ["obj1", "obj2", "obj3"];
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      render(
        <MultiSelectToolbar
          selectedObjectIds={selectedObjectIds}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      expect(screen.getByText("3 selected")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "🔒 Lock" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "🔓 Unlock" })).toBeInTheDocument();
    });

    it("should NOT render when isDM is false", () => {
      const selectedObjectIds = ["obj1", "obj2"];
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      const { container } = render(
        <MultiSelectToolbar
          selectedObjectIds={selectedObjectIds}
          isDM={false}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("should NOT render when selectedObjectIds is empty", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      const { container } = render(
        <MultiSelectToolbar
          selectedObjectIds={[]}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("should NOT render when both isDM is false and selectedObjectIds is empty", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      const { container } = render(
        <MultiSelectToolbar
          selectedObjectIds={[]}
          isDM={false}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("selection count display", () => {
    it("should display correct count for single object", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      render(
        <MultiSelectToolbar
          selectedObjectIds={["obj1"]}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      expect(screen.getByText("1 selected")).toBeInTheDocument();
    });

    it("should display correct count for multiple objects", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      render(
        <MultiSelectToolbar
          selectedObjectIds={["obj1", "obj2", "obj3", "obj4", "obj5"]}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      expect(screen.getByText("5 selected")).toBeInTheDocument();
    });
  });

  describe("button interactions", () => {
    it("should call onLock when lock button is clicked", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      render(
        <MultiSelectToolbar
          selectedObjectIds={["obj1", "obj2"]}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      const lockButton = screen.getByRole("button", { name: "🔒 Lock" });
      fireEvent.click(lockButton);

      expect(onLock).toHaveBeenCalledTimes(1);
      expect(onUnlock).not.toHaveBeenCalled();
    });

    it("should call onUnlock when unlock button is clicked", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      render(
        <MultiSelectToolbar
          selectedObjectIds={["obj1", "obj2"]}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      const unlockButton = screen.getByRole("button", { name: "🔓 Unlock" });
      fireEvent.click(unlockButton);

      expect(onUnlock).toHaveBeenCalledTimes(1);
      expect(onLock).not.toHaveBeenCalled();
    });
  });

  describe("positioning", () => {
    it("should position toolbar based on topHeight prop", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      const { container } = render(
        <MultiSelectToolbar
          selectedObjectIds={["obj1"]}
          isDM={true}
          topHeight={100}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      const toolbar = container.firstChild as HTMLElement;
      expect(toolbar).toHaveStyle({
        position: "fixed",
        top: "120px", // topHeight (100) + 20px offset
        left: "50%",
        transform: "translateX(-50%)",
      });
    });

    it("should adjust position when topHeight changes", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      const { container, rerender } = render(
        <MultiSelectToolbar
          selectedObjectIds={["obj1"]}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      let toolbar = container.firstChild as HTMLElement;
      expect(toolbar).toHaveStyle({ top: "80px" }); // 60 + 20

      rerender(
        <MultiSelectToolbar
          selectedObjectIds={["obj1"]}
          isDM={true}
          topHeight={150}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      toolbar = container.firstChild as HTMLElement;
      expect(toolbar).toHaveStyle({ top: "170px" }); // 150 + 20
    });
  });

  describe("styling", () => {
    it("should have correct base styles", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      const { container } = render(
        <MultiSelectToolbar
          selectedObjectIds={["obj1"]}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      const toolbar = container.firstChild as HTMLElement;
      expect(toolbar).toHaveStyle({
        zIndex: "1000",
        display: "flex",
        gap: "8px",
        padding: "8px 16px",
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        border: "1px solid rgba(148, 163, 184, 0.3)",
        borderRadius: "8px",
      });
    });

    it("should render lock and unlock buttons with correct text", () => {
      const onLock = vi.fn();
      const onUnlock = vi.fn();

      render(
        <MultiSelectToolbar
          selectedObjectIds={["obj1"]}
          isDM={true}
          topHeight={60}
          onLock={onLock}
          onUnlock={onUnlock}
        />,
      );

      const lockButton = screen.getByRole("button", { name: "🔒 Lock" });
      const unlockButton = screen.getByRole("button", { name: "🔓 Unlock" });

      expect(lockButton).toHaveTextContent("🔒 Lock");
      expect(unlockButton).toHaveTextContent("🔓 Unlock");
    });
  });
});
