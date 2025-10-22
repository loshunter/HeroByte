/**
 * Characterization tests for GridAlignmentWizard component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:293-378
 * Target: apps/client/src/features/dm/components/map-controls/GridAlignmentWizard.tsx
 *
 * These tests capture the current behavior to ensure no regressions occur.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../../types/alignment";
import { GridAlignmentWizard } from "../../map-controls/GridAlignmentWizard";

describe("GridAlignmentWizard - Characterization Tests", () => {
  const createMockHandlers = () => ({
    onAlignmentStart: vi.fn(),
    onAlignmentReset: vi.fn(),
    onAlignmentCancel: vi.fn(),
    onAlignmentApply: vi.fn(),
  });

  const mockAlignmentPoint: AlignmentPoint = {
    world: { x: 100, y: 200 },
    local: { x: 50, y: 75 },
  };

  const mockAlignmentSuggestion: AlignmentSuggestion = {
    transform: { x: 10.5, y: 20.3, rotation: 15.75, scale: 1.2345 },
    targetA: { x: 0, y: 0 },
    targetB: { x: 100, y: 100 },
    scale: 1.2345,
    rotation: 15.75,
    error: 2.567,
  };

  describe("Initial Rendering", () => {
    it("should render with alignment mode inactive", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(
        screen.getByText(
          "Capture two opposite corners of a map square to auto-match the map to the table grid.",
        ),
      ).toBeInTheDocument();
    });

    it("should show active mode status text when alignment is active", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(
        screen.getByText(
          "Alignment mode active — zoom in and click two opposite corners of a single map square.",
        ),
      ).toBeInTheDocument();
    });

    it("should render Start Alignment button enabled when mode is inactive", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const startButton = screen.getByRole("button", { name: "Start Alignment" });
      expect(startButton).toBeInTheDocument();
      expect(startButton).not.toBeDisabled();
    });

    it("should render Start Alignment button disabled when mode is active", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const startButton = screen.getByRole("button", { name: "Start Alignment" });
      expect(startButton).toBeDisabled();
    });

    it("should render Reset Points button disabled when no points captured", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const resetButton = screen.getByRole("button", { name: "Reset Points" });
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toBeDisabled();
    });

    it("should render Reset Points button enabled when points exist", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[mockAlignmentPoint]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const resetButton = screen.getByRole("button", { name: "Reset Points" });
      expect(resetButton).not.toBeDisabled();
    });

    it("should not show Cancel button when alignment is inactive", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    });

    it("should show Cancel button when alignment is active", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton).toBeInTheDocument();
    });

    it("should display point counter as 0 / 2 initially", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.getByText("Captured Points: 0 / 2")).toBeInTheDocument();
    });

    it("should not show suggestion grid when suggestion is null", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.queryByText("Scale")).not.toBeInTheDocument();
      expect(screen.queryByText("Rotation")).not.toBeInTheDocument();
    });

    it("should not show error message when no error", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const errorElements = screen
        .queryAllByText(/./)
        .filter((el) => el.style.color === "rgb(248, 113, 113)");
      expect(errorElements).toHaveLength(0);
    });

    it("should render Apply Alignment button disabled when no suggestion", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      expect(applyButton).toBeDisabled();
    });
  });

  describe("Point Counter", () => {
    it("should display 1 / 2 when one point is captured", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[mockAlignmentPoint]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.getByText("Captured Points: 1 / 2")).toBeInTheDocument();
    });

    it("should display 2 / 2 when two points are captured", () => {
      const handlers = createMockHandlers();
      const secondPoint: AlignmentPoint = {
        world: { x: 200, y: 300 },
        local: { x: 100, y: 150 },
      };

      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[mockAlignmentPoint, secondPoint]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.getByText("Captured Points: 2 / 2")).toBeInTheDocument();
    });

    it("should clamp display to 2 / 2 when more than two points exist", () => {
      const handlers = createMockHandlers();
      const points: AlignmentPoint[] = [
        mockAlignmentPoint,
        { world: { x: 200, y: 300 }, local: { x: 100, y: 150 } },
        { world: { x: 300, y: 400 }, local: { x: 150, y: 200 } },
      ];

      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={points}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.getByText("Captured Points: 2 / 2")).toBeInTheDocument();
    });
  });

  describe("Suggestion Display", () => {
    it("should show suggestion grid when suggestion is provided", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("Scale")).toBeInTheDocument();
      expect(screen.getByText("Rotation")).toBeInTheDocument();
      expect(screen.getByText("Offset X")).toBeInTheDocument();
      expect(screen.getByText("Offset Y")).toBeInTheDocument();
      expect(screen.getByText("Residual")).toBeInTheDocument();
    });

    it("should display scale value formatted to 4 decimal places with ×", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("1.2345×")).toBeInTheDocument();
    });

    it("should display rotation value formatted to 2 decimal places with °", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("15.75°")).toBeInTheDocument();
    });

    it("should display offset X value formatted to 1 decimal place", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("10.5")).toBeInTheDocument();
    });

    it("should display offset Y value formatted to 1 decimal place", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("20.3")).toBeInTheDocument();
    });

    it("should display residual error formatted to 2 decimal places with px", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("2.57 px")).toBeInTheDocument();
    });

    it("should display all suggestion values correctly", () => {
      const handlers = createMockHandlers();
      const customSuggestion: AlignmentSuggestion = {
        transform: { x: 100.789, y: -50.234, rotation: -45.123, scale: 0.5678 },
        targetA: { x: 0, y: 0 },
        targetB: { x: 100, y: 100 },
        scale: 0.5678,
        rotation: -45.123,
        error: 10.456,
      };

      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={customSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("0.5678×")).toBeInTheDocument();
      expect(screen.getByText("-45.12°")).toBeInTheDocument();
      expect(screen.getByText("100.8")).toBeInTheDocument();
      expect(screen.getByText("-50.2")).toBeInTheDocument();
      expect(screen.getByText("10.46 px")).toBeInTheDocument();
    });
  });

  describe("Error Display", () => {
    it("should show error message when alignmentError is provided", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          alignmentError="Failed to calculate alignment"
          {...handlers}
        />,
      );

      const errorMessage = screen.getByText("Failed to calculate alignment");
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveStyle({ color: "#f87171" });
    });

    it("should show error message in red text", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          alignmentError="Points are too close together"
          {...handlers}
        />,
      );

      const errorMessage = screen.getByText("Points are too close together");
      expect(errorMessage).toHaveStyle({ color: "#f87171" });
    });

    it("should not show error message when alignmentError is null", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          alignmentError={null}
          {...handlers}
        />,
      );

      const errorElements = screen
        .queryAllByText(/./)
        .filter((el) => el.style.color === "rgb(248, 113, 113)");
      expect(errorElements).toHaveLength(0);
    });

    it("should not show error message when alignmentError is undefined", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const errorElements = screen
        .queryAllByText(/./)
        .filter((el) => el.style.color === "rgb(248, 113, 113)");
      expect(errorElements).toHaveLength(0);
    });
  });

  describe("User Interactions - Start Alignment", () => {
    it("should call onAlignmentStart when Start Alignment button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const startButton = screen.getByRole("button", { name: "Start Alignment" });
      fireEvent.click(startButton);

      expect(handlers.onAlignmentStart).toHaveBeenCalledTimes(1);
    });

    it("should not call onAlignmentStart when button is disabled", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const startButton = screen.getByRole("button", { name: "Start Alignment" });
      fireEvent.click(startButton);

      expect(handlers.onAlignmentStart).not.toHaveBeenCalled();
    });
  });

  describe("User Interactions - Reset Points", () => {
    it("should call onAlignmentReset when Reset Points button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[mockAlignmentPoint]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const resetButton = screen.getByRole("button", { name: "Reset Points" });
      fireEvent.click(resetButton);

      expect(handlers.onAlignmentReset).toHaveBeenCalledTimes(1);
    });

    it("should not call onAlignmentReset when button is disabled", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const resetButton = screen.getByRole("button", { name: "Reset Points" });
      fireEvent.click(resetButton);

      expect(handlers.onAlignmentReset).not.toHaveBeenCalled();
    });
  });

  describe("User Interactions - Cancel", () => {
    it("should call onAlignmentCancel when Cancel button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(handlers.onAlignmentCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("User Interactions - Apply Alignment", () => {
    it("should call onAlignmentApply when Apply Alignment button is clicked with valid suggestion", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      fireEvent.click(applyButton);

      expect(handlers.onAlignmentApply).toHaveBeenCalledTimes(1);
    });

    it("should not call onAlignmentApply when no suggestion exists", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      fireEvent.click(applyButton);

      expect(handlers.onAlignmentApply).not.toHaveBeenCalled();
    });

    it("should not call onAlignmentApply when there is an error", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          alignmentError="Failed to calculate alignment"
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      fireEvent.click(applyButton);

      expect(handlers.onAlignmentApply).not.toHaveBeenCalled();
    });

    it("should not call onAlignmentApply when map is locked", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          mapLocked={true}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      fireEvent.click(applyButton);

      expect(handlers.onAlignmentApply).not.toHaveBeenCalled();
    });
  });

  describe("Apply Alignment Button States", () => {
    it("should disable Apply Alignment button when no suggestion exists", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      expect(applyButton).toBeDisabled();
    });

    it("should enable Apply Alignment button when suggestion exists and no error", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      expect(applyButton).not.toBeDisabled();
    });

    it("should disable Apply Alignment button when there is an error", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          alignmentError="Failed to calculate alignment"
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      expect(applyButton).toBeDisabled();
    });

    it("should disable Apply Alignment button when map is locked", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          mapLocked={true}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      expect(applyButton).toBeDisabled();
    });

    it("should disable Apply Alignment button when both error and map locked", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          alignmentError="Some error"
          mapLocked={true}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      expect(applyButton).toBeDisabled();
    });
  });

  describe("Map Lock Warning", () => {
    it("should show lock warning when map is locked", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          mapLocked={true}
          {...handlers}
        />,
      );

      const lockWarning = screen.getByText("Unlock the map before applying alignment.");
      expect(lockWarning).toBeInTheDocument();
      expect(lockWarning).toHaveStyle({ color: "#facc15" });
    });

    it("should not show lock warning when map is not locked", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          mapLocked={false}
          {...handlers}
        />,
      );

      expect(
        screen.queryByText("Unlock the map before applying alignment."),
      ).not.toBeInTheDocument();
    });

    it("should not show lock warning when mapLocked is undefined", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(
        screen.queryByText("Unlock the map before applying alignment."),
      ).not.toBeInTheDocument();
    });
  });

  describe("Props Updates", () => {
    it("should update status text when alignmentModeActive changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(
        screen.getByText(
          "Capture two opposite corners of a map square to auto-match the map to the table grid.",
        ),
      ).toBeInTheDocument();

      rerender(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(
        screen.getByText(
          "Alignment mode active — zoom in and click two opposite corners of a single map square.",
        ),
      ).toBeInTheDocument();
    });

    it("should update point counter when alignmentPoints changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.getByText("Captured Points: 0 / 2")).toBeInTheDocument();

      rerender(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[mockAlignmentPoint]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.getByText("Captured Points: 1 / 2")).toBeInTheDocument();
    });

    it("should show suggestion when alignmentSuggestion is added", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.queryByText("Scale")).not.toBeInTheDocument();

      rerender(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("Scale")).toBeInTheDocument();
      expect(screen.getByText("1.2345×")).toBeInTheDocument();
    });

    it("should hide suggestion when alignmentSuggestion is removed", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("Scale")).toBeInTheDocument();

      rerender(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.queryByText("Scale")).not.toBeInTheDocument();
    });

    it("should show error when alignmentError is added", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.queryByText("Calculation failed")).not.toBeInTheDocument();

      rerender(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          alignmentError="Calculation failed"
          {...handlers}
        />,
      );

      expect(screen.getByText("Calculation failed")).toBeInTheDocument();
    });

    it("should update button states when mapLocked changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          mapLocked={false}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      expect(applyButton).not.toBeDisabled();

      rerender(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          mapLocked={true}
          {...handlers}
        />,
      );

      expect(applyButton).toBeDisabled();
    });

    it("should show/hide Cancel button when alignmentModeActive changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

      rerender(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string alignmentError as truthy", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={mockAlignmentSuggestion}
          alignmentError=""
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });
      expect(applyButton).not.toBeDisabled();
    });

    it("should handle zero values in alignment suggestion", () => {
      const handlers = createMockHandlers();
      const zeroSuggestion: AlignmentSuggestion = {
        transform: { x: 0, y: 0, rotation: 0, scale: 1 },
        targetA: { x: 0, y: 0 },
        targetB: { x: 0, y: 0 },
        scale: 1,
        rotation: 0,
        error: 0,
      };

      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={zeroSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("1.0000×")).toBeInTheDocument();
      expect(screen.getByText("0.00°")).toBeInTheDocument();
      // "0.0" appears twice (for Offset X and Offset Y)
      expect(screen.getAllByText("0.0")).toHaveLength(2);
      expect(screen.getByText("0.00 px")).toBeInTheDocument();
    });

    it("should handle negative values in alignment suggestion", () => {
      const handlers = createMockHandlers();
      const negativeSuggestion: AlignmentSuggestion = {
        transform: { x: -100.5, y: -200.3, rotation: -90.75, scale: 0.5 },
        targetA: { x: 0, y: 0 },
        targetB: { x: 0, y: 0 },
        scale: 0.5,
        rotation: -90.75,
        error: 5.123,
      };

      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={negativeSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("0.5000×")).toBeInTheDocument();
      expect(screen.getByText("-90.75°")).toBeInTheDocument();
      expect(screen.getByText("-100.5")).toBeInTheDocument();
      expect(screen.getByText("-200.3")).toBeInTheDocument();
      expect(screen.getByText("5.12 px")).toBeInTheDocument();
    });

    it("should handle very large values in alignment suggestion", () => {
      const handlers = createMockHandlers();
      const largeSuggestion: AlignmentSuggestion = {
        transform: { x: 9999.999, y: -8888.888, rotation: 360.99, scale: 100.9999 },
        targetA: { x: 0, y: 0 },
        targetB: { x: 0, y: 0 },
        scale: 100.9999,
        rotation: 360.99,
        error: 999.999,
      };

      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={largeSuggestion}
          {...handlers}
        />,
      );

      expect(screen.getByText("100.9999×")).toBeInTheDocument();
      expect(screen.getByText("360.99°")).toBeInTheDocument();
      expect(screen.getByText("10000.0")).toBeInTheDocument();
      expect(screen.getByText("-8888.9")).toBeInTheDocument();
      expect(screen.getByText("1000.00 px")).toBeInTheDocument();
    });

    it("should handle all conditions disabled simultaneously", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={true}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          alignmentError="Error occurred"
          mapLocked={true}
          {...handlers}
        />,
      );

      const startButton = screen.getByRole("button", { name: "Start Alignment" });
      const resetButton = screen.getByRole("button", { name: "Reset Points" });
      const applyButton = screen.getByRole("button", { name: "Apply Alignment" });

      expect(startButton).toBeDisabled();
      expect(resetButton).toBeDisabled();
      expect(applyButton).toBeDisabled();
    });

    it("should render with all optional props undefined", () => {
      const handlers = createMockHandlers();
      render(
        <GridAlignmentWizard
          alignmentModeActive={false}
          alignmentPoints={[]}
          alignmentSuggestion={null}
          {...handlers}
        />,
      );

      expect(screen.getByRole("button", { name: "Start Alignment" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Apply Alignment" })).toBeDisabled();
      expect(
        screen.queryByText("Unlock the map before applying alignment."),
      ).not.toBeInTheDocument();
    });
  });
});
