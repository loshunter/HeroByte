/**
 * Characterization tests for MapTransformControl component
 *
 * Source: apps/client/src/features/dm/components/DMMenu.tsx:355-511
 * Target: apps/client/src/features/dm/components/MapTransformControl.tsx
 *
 * These tests capture the current behavior before extraction to ensure
 * no regressions occur during refactoring.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MapTransformControl } from "../../map-controls/MapTransformControl";

describe("MapTransformControl - Characterization Tests", () => {
  const defaultTransform = {
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
    rotation: 0,
  };

  const createMockHandlers = () => ({
    onMapTransformChange: vi.fn(),
    onMapLockToggle: vi.fn(),
  });

  describe("Initial Rendering", () => {
    it("should render with all controls visible when unlocked", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      expect(screen.getByRole("button", { name: /map unlocked/i })).toBeInTheDocument();
      expect(screen.getByLabelText("Scale")).toBeInTheDocument();
      expect(screen.getByLabelText("Rotation")).toBeInTheDocument();
      expect(screen.getByLabelText("X")).toBeInTheDocument();
      expect(screen.getByLabelText("Y")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reset transform/i })).toBeInTheDocument();
    });

    it("should render lock button showing unlocked state", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const lockButton = screen.getByRole("button", { name: /map unlocked/i });
      expect(lockButton).toHaveTextContent("🔓 MAP UNLOCKED ▼");
      expect(lockButton).toHaveAttribute("title", "Map is unlocked");
    });

    it("should render lock button showing locked state", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={true} {...handlers} />,
      );

      const lockButton = screen.getByRole("button", { name: /map locked/i });
      expect(lockButton).toHaveTextContent("🔒 MAP LOCKED ▲");
      expect(lockButton).toHaveAttribute("title", "Map is locked");
    });

    it("should display scale value correctly", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, scaleX: 1.5, scaleY: 1.5 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("1.50x")).toBeInTheDocument();
      expect(screen.getByLabelText("Scale")).toHaveValue("1.5");
    });

    it("should display rotation value correctly", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, rotation: 45 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("45°")).toBeInTheDocument();
      expect(screen.getByLabelText("Rotation")).toHaveValue("45");
    });

    it("should display X position as rounded integer", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, x: 123.7 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByLabelText("X")).toHaveValue(124);
    });

    it("should display Y position as rounded integer", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, y: 456.3 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByLabelText("Y")).toHaveValue(456);
    });

    it("should display negative position values correctly", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, x: -50, y: -100 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByLabelText("X")).toHaveValue(-50);
      expect(screen.getByLabelText("Y")).toHaveValue(-100);
    });
  });

  describe("Lock/Unlock Toggle", () => {
    it("should call onMapLockToggle when lock button is clicked", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const lockButton = screen.getByRole("button", { name: /map unlocked/i });
      fireEvent.click(lockButton);

      expect(handlers.onMapLockToggle).toHaveBeenCalledTimes(1);
    });

    it("should show locked state when mapLocked is true", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={true} {...handlers} />,
      );

      const lockButton = screen.getByRole("button", { name: /map locked/i });
      expect(lockButton).toHaveTextContent("🔒 MAP LOCKED ▲");
    });

    it("should show unlocked state when mapLocked is false", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const lockButton = screen.getByRole("button", { name: /map unlocked/i });
      expect(lockButton).toHaveTextContent("🔓 MAP UNLOCKED ▼");
    });

    it("should collapse controls section when locked", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={true} {...handlers} />,
      );

      const scaleSlider = screen.getByLabelText("Scale");
      const collapsibleDiv = scaleSlider.parentElement?.parentElement;
      expect(collapsibleDiv).toHaveStyle({ maxHeight: "0", opacity: 0 });
    });

    it("should expand controls section when unlocked", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const scaleSlider = screen.getByLabelText("Scale");
      const collapsibleDiv = scaleSlider.parentElement?.parentElement;
      expect(collapsibleDiv).toHaveStyle({ maxHeight: "2000px", opacity: 1 });
    });
  });

  describe("Scale Slider", () => {
    it("should call onMapTransformChange with new scale value", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const scaleSlider = screen.getByLabelText("Scale");
      fireEvent.change(scaleSlider, { target: { value: "2.0" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 2.0,
        scaleY: 2.0,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });

    it("should update both scaleX and scaleY together", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const scaleSlider = screen.getByLabelText("Scale");
      fireEvent.change(scaleSlider, { target: { value: "1.5" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1.5,
        scaleY: 1.5,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });

    it("should handle minimum scale value", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const scaleSlider = screen.getByLabelText("Scale");
      fireEvent.change(scaleSlider, { target: { value: "0.1" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 0.1,
        scaleY: 0.1,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });

    it("should handle maximum scale value", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const scaleSlider = screen.getByLabelText("Scale");
      fireEvent.change(scaleSlider, { target: { value: "3" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 3,
        scaleY: 3,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });

    it("should display scale value with two decimal places", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, scaleX: 1.234, scaleY: 1.234 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("1.23x")).toBeInTheDocument();
    });
  });

  describe("Rotation Slider", () => {
    it("should call onMapTransformChange with new rotation value", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const rotationSlider = screen.getByLabelText("Rotation");
      fireEvent.change(rotationSlider, { target: { value: "90" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        rotation: 90,
      });
    });

    it("should handle minimum rotation value", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, rotation: 45 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      const rotationSlider = screen.getByLabelText("Rotation");
      fireEvent.change(rotationSlider, { target: { value: "0" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });

    it("should handle maximum rotation value", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const rotationSlider = screen.getByLabelText("Rotation");
      fireEvent.change(rotationSlider, { target: { value: "360" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        rotation: 360,
      });
    });

    it("should display rotation value as rounded integer with degree symbol", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, rotation: 45.7 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("46°")).toBeInTheDocument();
    });

    it("should handle intermediate rotation values", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const rotationSlider = screen.getByLabelText("Rotation");
      fireEvent.change(rotationSlider, { target: { value: "180" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        rotation: 180,
      });
    });
  });

  describe("X Position Input", () => {
    it("should call onMapTransformChange with new X value", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const xInput = screen.getByLabelText("X");
      fireEvent.change(xInput, { target: { value: "100" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 100,
        y: 0,
        rotation: 0,
      });
    });

    it("should handle negative X values", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const xInput = screen.getByLabelText("X");
      fireEvent.change(xInput, { target: { value: "-50" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: -50,
        y: 0,
        rotation: 0,
      });
    });

    it("should handle decimal X values", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const xInput = screen.getByLabelText("X");
      fireEvent.change(xInput, { target: { value: "123.456" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 123.456,
        y: 0,
        rotation: 0,
      });
    });

    it("should handle zero X value", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, x: 100 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      const xInput = screen.getByLabelText("X");
      fireEvent.change(xInput, { target: { value: "0" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });
  });

  describe("Y Position Input", () => {
    it("should call onMapTransformChange with new Y value", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const yInput = screen.getByLabelText("Y");
      fireEvent.change(yInput, { target: { value: "200" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 200,
        rotation: 0,
      });
    });

    it("should handle negative Y values", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const yInput = screen.getByLabelText("Y");
      fireEvent.change(yInput, { target: { value: "-75" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: -75,
        rotation: 0,
      });
    });

    it("should handle decimal Y values", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const yInput = screen.getByLabelText("Y");
      fireEvent.change(yInput, { target: { value: "456.789" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 456.789,
        rotation: 0,
      });
    });

    it("should handle zero Y value", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, y: 200 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      const yInput = screen.getByLabelText("Y");
      fireEvent.change(yInput, { target: { value: "0" } });

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });
  });

  describe("Reset Transform Button", () => {
    it("should call onMapTransformChange with default values when clicked", () => {
      const handlers = createMockHandlers();
      const transform = {
        scaleX: 2.0,
        scaleY: 2.0,
        x: 100,
        y: 200,
        rotation: 90,
      };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      const resetButton = screen.getByRole("button", { name: /reset transform/i });
      fireEvent.click(resetButton);

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      });
    });

    it("should reset all transform values to defaults", () => {
      const handlers = createMockHandlers();
      const transform = {
        scaleX: 0.5,
        scaleY: 0.5,
        x: -50,
        y: -100,
        rotation: 270,
      };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      const resetButton = screen.getByRole("button", { name: /reset transform/i });
      fireEvent.click(resetButton);

      expect(handlers.onMapTransformChange).toHaveBeenCalledWith({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      });
    });

    it("should be clickable when controls are unlocked", () => {
      const handlers = createMockHandlers();
      render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const resetButton = screen.getByRole("button", { name: /reset transform/i });
      expect(resetButton).toBeInTheDocument();
      fireEvent.click(resetButton);

      expect(handlers.onMapTransformChange).toHaveBeenCalled();
    });
  });

  describe("Props Updates", () => {
    it("should update scale display when mapTransform prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      expect(screen.getByText("1.00x")).toBeInTheDocument();

      const newTransform = { ...defaultTransform, scaleX: 2.5, scaleY: 2.5 };
      rerender(<MapTransformControl mapTransform={newTransform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("2.50x")).toBeInTheDocument();
      expect(screen.getByLabelText("Scale")).toHaveValue("2.5");
    });

    it("should update rotation display when mapTransform prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      expect(screen.getByText("0°")).toBeInTheDocument();

      const newTransform = { ...defaultTransform, rotation: 135 };
      rerender(<MapTransformControl mapTransform={newTransform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("135°")).toBeInTheDocument();
      expect(screen.getByLabelText("Rotation")).toHaveValue("135");
    });

    it("should update X position when mapTransform prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      expect(screen.getByLabelText("X")).toHaveValue(0);

      const newTransform = { ...defaultTransform, x: 250 };
      rerender(<MapTransformControl mapTransform={newTransform} mapLocked={false} {...handlers} />);

      expect(screen.getByLabelText("X")).toHaveValue(250);
    });

    it("should update Y position when mapTransform prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      expect(screen.getByLabelText("Y")).toHaveValue(0);

      const newTransform = { ...defaultTransform, y: 350 };
      rerender(<MapTransformControl mapTransform={newTransform} mapLocked={false} {...handlers} />);

      expect(screen.getByLabelText("Y")).toHaveValue(350);
    });

    it("should update lock button text when mapLocked prop changes", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      expect(screen.getByRole("button", { name: /map unlocked/i })).toHaveTextContent(
        "🔓 MAP UNLOCKED ▼",
      );

      rerender(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={true} {...handlers} />,
      );

      expect(screen.getByRole("button", { name: /map locked/i })).toHaveTextContent(
        "🔒 MAP LOCKED ▲",
      );
    });

    it("should collapse controls when mapLocked changes to true", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const scaleSlider = screen.getByLabelText("Scale");
      let collapsibleDiv = scaleSlider.parentElement?.parentElement;
      expect(collapsibleDiv).toHaveStyle({ maxHeight: "2000px", opacity: 1 });

      rerender(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={true} {...handlers} />,
      );

      collapsibleDiv = scaleSlider.parentElement?.parentElement;
      expect(collapsibleDiv).toHaveStyle({ maxHeight: "0", opacity: 0 });
    });

    it("should expand controls when mapLocked changes to false", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={true} {...handlers} />,
      );

      const scaleSlider = screen.getByLabelText("Scale");
      let collapsibleDiv = scaleSlider.parentElement?.parentElement;
      expect(collapsibleDiv).toHaveStyle({ maxHeight: "0", opacity: 0 });

      rerender(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      collapsibleDiv = scaleSlider.parentElement?.parentElement;
      expect(collapsibleDiv).toHaveStyle({ maxHeight: "2000px", opacity: 1 });
    });

    it("should handle all transform values updating simultaneously", () => {
      const handlers = createMockHandlers();
      const { rerender } = render(
        <MapTransformControl mapTransform={defaultTransform} mapLocked={false} {...handlers} />,
      );

      const newTransform = {
        scaleX: 1.8,
        scaleY: 1.8,
        x: 150,
        y: -200,
        rotation: 225,
      };
      rerender(<MapTransformControl mapTransform={newTransform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("1.80x")).toBeInTheDocument();
      expect(screen.getByText("225°")).toBeInTheDocument();
      expect(screen.getByLabelText("X")).toHaveValue(150);
      expect(screen.getByLabelText("Y")).toHaveValue(-200);
    });
  });

  describe("Edge Cases", () => {
    it("should handle fractional rotation display by rounding", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, rotation: 44.4 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("44°")).toBeInTheDocument();
    });

    it("should handle fractional rotation display at 0.5", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, rotation: 44.5 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("45°")).toBeInTheDocument();
    });

    it("should handle very small scale values", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, scaleX: 0.1, scaleY: 0.1 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("0.10x")).toBeInTheDocument();
      expect(screen.getByLabelText("Scale")).toHaveValue("0.1");
    });

    it("should handle very large scale values", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, scaleX: 3, scaleY: 3 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByText("3.00x")).toBeInTheDocument();
      expect(screen.getByLabelText("Scale")).toHaveValue("3");
    });

    it("should handle very large position values", () => {
      const handlers = createMockHandlers();
      const transform = { ...defaultTransform, x: 9999, y: -9999 };
      render(<MapTransformControl mapTransform={transform} mapLocked={false} {...handlers} />);

      expect(screen.getByLabelText("X")).toHaveValue(9999);
      expect(screen.getByLabelText("Y")).toHaveValue(-9999);
    });
  });
});
