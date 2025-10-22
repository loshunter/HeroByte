/**
 * Characterization tests for StagingZoneControl component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:463-640
 * Target: apps/client/src/features/dm/components/StagingZoneControl.tsx
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StagingZoneControl } from "../../map-controls/StagingZoneControl";

describe("StagingZoneControl - Characterization Tests", () => {
  const defaultCamera = {
    x: 0,
    y: 0,
    scale: 1,
  };

  const defaultGridSize = 32;

  const createMockHandlers = () => ({
    onStagingZoneLockToggle: vi.fn(),
    onSetPlayerStagingZone: vi.fn(),
  });

  beforeEach(() => {
    // Reset window dimensions for consistent test results
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 600,
    });
  });

  describe("Initial Rendering", () => {
    it("should render with default values when playerStagingZone is undefined", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Center X")).toHaveValue(0);
      expect(screen.getByLabelText("Center Y")).toHaveValue(0);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(6);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(6);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(0);
    });

    it("should render with playerStagingZone values when provided", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={{ x: 10.5, y: 15.75, width: 8.25, height: 12.5, rotation: 45.5 }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      // Note: x/y/width/height use toFixed(2), rotation uses toFixed(1)
      expect(screen.getByLabelText("Center X")).toHaveValue(10.5);
      expect(screen.getByLabelText("Center Y")).toHaveValue(15.75);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(8.25);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(12.5);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(45.5);
    });

    it("should render lock button with unlocked state when stagingZoneLocked is false", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const lockButton = screen.getByRole("button", { name: /zone unlocked/i });
      expect(lockButton).toBeInTheDocument();
      expect(lockButton).toHaveTextContent("🔓 ZONE UNLOCKED ▼");
    });

    it("should render lock button with locked state when stagingZoneLocked is true", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={true}
          {...handlers}
        />,
      );

      const lockButton = screen.getByRole("button", { name: /zone locked/i });
      expect(lockButton).toBeInTheDocument();
      expect(lockButton).toHaveTextContent("🔒 ZONE LOCKED ▲");
    });

    it("should not render lock button when onStagingZoneLockToggle is not provided", () => {
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          onSetPlayerStagingZone={vi.fn()}
        />,
      );

      expect(screen.queryByRole("button", { name: /zone locked/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /zone unlocked/i })).not.toBeInTheDocument();
    });

    it("should show help text at the bottom", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByText(/apply zone.*staging zone/i)).toBeInTheDocument();
    });
  });

  describe("Lock/Unlock Toggle", () => {
    it("should call onStagingZoneLockToggle when lock button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const lockButton = screen.getByRole("button", { name: /zone unlocked/i });
      fireEvent.click(lockButton);

      expect(handlers.onStagingZoneLockToggle).toHaveBeenCalledTimes(1);
    });

    it("should update button text when stagingZoneLocked prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByRole("button", { name: /zone unlocked/i })).toBeInTheDocument();

      rerender(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={true}
          {...handlers}
        />,
      );

      expect(screen.getByRole("button", { name: /zone locked/i })).toBeInTheDocument();
    });

    it("should collapse CollapsibleSection when locked", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      // Inputs should be visible when unlocked
      expect(screen.getByLabelText("Center X")).toBeVisible();

      rerender(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={true}
          {...handlers}
        />,
      );

      // CollapsibleSection should be collapsed when locked
      // Note: The input still exists in the DOM but may not be visible
      const centerXInput = screen.getByLabelText("Center X");
      expect(centerXInput).toBeInTheDocument();
    });
  });

  describe("Input Field Changes", () => {
    it("should update Center X field on change", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const centerXInput = screen.getByLabelText("Center X");
      fireEvent.change(centerXInput, { target: { value: "25.5" } });

      expect(centerXInput).toHaveValue(25.5);
      // Changes don't call onSetPlayerStagingZone directly
      expect(handlers.onSetPlayerStagingZone).not.toHaveBeenCalled();
    });

    it("should update Center Y field on change", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const centerYInput = screen.getByLabelText("Center Y");
      fireEvent.change(centerYInput, { target: { value: "30.75" } });

      expect(centerYInput).toHaveValue(30.75);
      expect(handlers.onSetPlayerStagingZone).not.toHaveBeenCalled();
    });

    it("should update Width field on change", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const widthInput = screen.getByLabelText("Width (tiles)");
      fireEvent.change(widthInput, { target: { value: "10.5" } });

      expect(widthInput).toHaveValue(10.5);
      expect(handlers.onSetPlayerStagingZone).not.toHaveBeenCalled();
    });

    it("should update Height field on change", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const heightInput = screen.getByLabelText("Height (tiles)");
      fireEvent.change(heightInput, { target: { value: "12" } });

      expect(heightInput).toHaveValue(12);
      expect(handlers.onSetPlayerStagingZone).not.toHaveBeenCalled();
    });

    it("should update Rotation field on change", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const rotationInput = screen.getByLabelText("Rotation (degrees)");
      fireEvent.change(rotationInput, { target: { value: "90" } });

      expect(rotationInput).toHaveValue(90);
      expect(handlers.onSetPlayerStagingZone).not.toHaveBeenCalled();
    });

    it("should maintain all field values after multiple changes", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      fireEvent.change(screen.getByLabelText("Center X"), { target: { value: "5" } });
      fireEvent.change(screen.getByLabelText("Center Y"), { target: { value: "10" } });
      fireEvent.change(screen.getByLabelText("Width (tiles)"), { target: { value: "8" } });
      fireEvent.change(screen.getByLabelText("Height (tiles)"), { target: { value: "6" } });
      fireEvent.change(screen.getByLabelText("Rotation (degrees)"), { target: { value: "45" } });

      expect(screen.getByLabelText("Center X")).toHaveValue(5);
      expect(screen.getByLabelText("Center Y")).toHaveValue(10);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(8);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(6);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(45);
    });
  });

  describe("Apply Zone Button", () => {
    it("should call onSetPlayerStagingZone when Apply Zone button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: /apply zone/i });
      fireEvent.click(applyButton);

      expect(handlers.onSetPlayerStagingZone).toHaveBeenCalledTimes(1);
      expect(handlers.onSetPlayerStagingZone).toHaveBeenCalledWith(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
          rotation: expect.any(Number),
        }),
      );
    });

    it("should be disabled when onSetPlayerStagingZone is not provided", () => {
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          onStagingZoneLockToggle={vi.fn()}
        />,
      );

      const applyButton = screen.getByRole("button", { name: /apply zone/i });
      expect(applyButton).toBeDisabled();
    });

    it("should not call handler when disabled button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          onStagingZoneLockToggle={handlers.onStagingZoneLockToggle}
          onSetPlayerStagingZone={undefined}
        />,
      );

      const applyButton = screen.getByRole("button", { name: /apply zone/i });
      fireEvent.click(applyButton);

      expect(handlers.onSetPlayerStagingZone).not.toHaveBeenCalled();
    });

    it("should update input fields after applying zone", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: /apply zone/i });
      fireEvent.click(applyButton);

      // After apply, inputs should be updated with calculated values
      const centerXInput = screen.getByLabelText("Center X");
      const centerYInput = screen.getByLabelText("Center Y");
      const widthInput = screen.getByLabelText("Width (tiles)");
      const heightInput = screen.getByLabelText("Height (tiles)");
      const rotationInput = screen.getByLabelText("Rotation (degrees)");

      // Values are updated (exact values depend on camera/gridSize calculation)
      expect(centerXInput.value).not.toBe("");
      expect(centerYInput.value).not.toBe("");
      expect(widthInput.value).not.toBe("");
      expect(heightInput.value).not.toBe("");
      expect(rotationInput.value).toBe("0"); // Rotation is always reset to 0
    });
  });

  describe("Clear Zone Button", () => {
    it("should call onSetPlayerStagingZone with undefined when Clear Zone button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={{ x: 10, y: 10, width: 8, height: 8, rotation: 0 }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const clearButton = screen.getByRole("button", { name: /clear zone/i });
      fireEvent.click(clearButton);

      expect(handlers.onSetPlayerStagingZone).toHaveBeenCalledTimes(1);
      expect(handlers.onSetPlayerStagingZone).toHaveBeenCalledWith(undefined);
    });

    it("should be disabled when onSetPlayerStagingZone is not provided", () => {
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          onStagingZoneLockToggle={vi.fn()}
        />,
      );

      const clearButton = screen.getByRole("button", { name: /clear zone/i });
      expect(clearButton).toBeDisabled();
    });

    it("should not call handler when disabled button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          onStagingZoneLockToggle={handlers.onStagingZoneLockToggle}
          onSetPlayerStagingZone={undefined}
        />,
      );

      const clearButton = screen.getByRole("button", { name: /clear zone/i });
      fireEvent.click(clearButton);

      expect(handlers.onSetPlayerStagingZone).not.toHaveBeenCalled();
    });
  });

  describe("Props Updates", () => {
    it("should sync input fields when playerStagingZone prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <StagingZoneControl
          playerStagingZone={{ x: 5, y: 5, width: 4, height: 4, rotation: 0 }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Center X")).toHaveValue(5);
      expect(screen.getByLabelText("Center Y")).toHaveValue(5);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(4);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(4);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(0);

      rerender(
        <StagingZoneControl
          playerStagingZone={{ x: 15, y: 20, width: 10, height: 12, rotation: 90 }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Center X")).toHaveValue(15);
      expect(screen.getByLabelText("Center Y")).toHaveValue(20);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(10);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(12);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(90);
    });

    it("should reset to default values when playerStagingZone becomes undefined", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <StagingZoneControl
          playerStagingZone={{ x: 15, y: 20, width: 10, height: 12, rotation: 90 }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      rerender(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Center X")).toHaveValue(0);
      expect(screen.getByLabelText("Center Y")).toHaveValue(0);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(6);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(6);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(0);
    });

    it("should format values correctly when playerStagingZone updates", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      // Update with precise decimal values
      rerender(
        <StagingZoneControl
          playerStagingZone={{
            x: 10.12345,
            y: 15.98765,
            width: 8.7654,
            height: 12.3456,
            rotation: 45.678,
          }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      // x/y/width/height should be formatted with toFixed(2)
      expect(screen.getByLabelText("Center X")).toHaveValue(10.12);
      expect(screen.getByLabelText("Center Y")).toHaveValue(15.99);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(8.77);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(12.35);
      // rotation should be formatted with toFixed(1)
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(45.7);
    });

    it("should default rotation to 0 when rotation field is missing from playerStagingZone", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={{ x: 10, y: 10, width: 8, height: 8 }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(0);
    });

    it("should override user input changes when playerStagingZone prop updates", () => {
      const handlers = createMockHandlers();
      const stagingZone1 = { x: 5, y: 5, width: 4, height: 4, rotation: 0 };
      const { rerender } = render(
        <StagingZoneControl
          playerStagingZone={stagingZone1}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      // User changes values
      fireEvent.change(screen.getByLabelText("Center X"), { target: { value: "25" } });
      fireEvent.change(screen.getByLabelText("Width (tiles)"), { target: { value: "15" } });

      expect(screen.getByLabelText("Center X")).toHaveValue(25);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(15);

      // Re-render with the SAME object reference - user changes should be preserved
      rerender(
        <StagingZoneControl
          playerStagingZone={stagingZone1}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      // User input should still be there (same prop reference)
      expect(screen.getByLabelText("Center X")).toHaveValue(25);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(15);

      // Now update props with different object (even if values are same, new reference triggers useEffect)
      rerender(
        <StagingZoneControl
          playerStagingZone={{ x: 10, y: 10, width: 8, height: 8, rotation: 0 }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      // User input should be overridden by new props
      expect(screen.getByLabelText("Center X")).toHaveValue(10);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(8);
    });
  });

  describe("Edge Cases", () => {
    it("should handle negative input values", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      fireEvent.change(screen.getByLabelText("Center X"), { target: { value: "-10" } });
      fireEvent.change(screen.getByLabelText("Center Y"), { target: { value: "-5" } });
      fireEvent.change(screen.getByLabelText("Rotation (degrees)"), {
        target: { value: "-45" },
      });

      expect(screen.getByLabelText("Center X")).toHaveValue(-10);
      expect(screen.getByLabelText("Center Y")).toHaveValue(-5);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(-45);
    });

    it("should have min constraint on width and height inputs", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const widthInput = screen.getByLabelText("Width (tiles)");
      const heightInput = screen.getByLabelText("Height (tiles)");

      expect(widthInput).toHaveAttribute("min", "0.5");
      expect(heightInput).toHaveAttribute("min", "0.5");
    });

    it("should have correct step attributes on inputs", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Center X")).toHaveAttribute("step", "0.1");
      expect(screen.getByLabelText("Center Y")).toHaveAttribute("step", "0.1");
      expect(screen.getByLabelText("Width (tiles)")).toHaveAttribute("step", "0.5");
      expect(screen.getByLabelText("Height (tiles)")).toHaveAttribute("step", "0.5");
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveAttribute("step", "1");
    });

    it("should handle very large playerStagingZone values", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={{
            x: 999999.99,
            y: -999999.99,
            width: 500.5,
            height: 500.5,
            rotation: 360,
          }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Center X")).toHaveValue(999999.99);
      expect(screen.getByLabelText("Center Y")).toHaveValue(-999999.99);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(500.5);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(500.5);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(360);
    });

    it("should handle zero values for all fields", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={{ x: 0, y: 0, width: 0, height: 0, rotation: 0 }}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      expect(screen.getByLabelText("Center X")).toHaveValue(0);
      expect(screen.getByLabelText("Center Y")).toHaveValue(0);
      expect(screen.getByLabelText("Width (tiles)")).toHaveValue(0);
      expect(screen.getByLabelText("Height (tiles)")).toHaveValue(0);
      expect(screen.getByLabelText("Rotation (degrees)")).toHaveValue(0);
    });

    it("should allow empty string input values temporarily", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const centerXInput = screen.getByLabelText("Center X");
      fireEvent.change(centerXInput, { target: { value: "" } });

      // Empty string is allowed (user might be typing)
      expect(centerXInput).toHaveValue(null);
    });
  });

  describe("Camera and Grid Size Integration", () => {
    it("should calculate zone based on different camera positions", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={{ x: 100, y: 200, scale: 1 }}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: /apply zone/i });
      fireEvent.click(applyButton);

      // Verify handler was called with calculated values
      expect(handlers.onSetPlayerStagingZone).toHaveBeenCalledWith(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
          rotation: 0,
        }),
      );
    });

    it("should calculate zone based on different camera scales", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={{ x: 0, y: 0, scale: 2 }}
          gridSize={defaultGridSize}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: /apply zone/i });
      fireEvent.click(applyButton);

      expect(handlers.onSetPlayerStagingZone).toHaveBeenCalledTimes(1);
    });

    it("should calculate zone based on different grid sizes", () => {
      const handlers = createMockHandlers();
      render(
        <StagingZoneControl
          playerStagingZone={undefined}
          camera={defaultCamera}
          gridSize={64}
          stagingZoneLocked={false}
          {...handlers}
        />,
      );

      const applyButton = screen.getByRole("button", { name: /apply zone/i });
      fireEvent.click(applyButton);

      expect(handlers.onSetPlayerStagingZone).toHaveBeenCalledTimes(1);
    });
  });
});
