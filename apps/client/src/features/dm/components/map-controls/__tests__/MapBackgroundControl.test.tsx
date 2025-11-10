// ============================================================================
// MAP BACKGROUND CONTROL TESTS
// ============================================================================
// Tests for the MapBackgroundControl component, focusing on loading states,
// spinner visibility, and toast feedback integration.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MapBackgroundControl } from "../MapBackgroundControl";

// Mock the useImageUrlNormalization hook
vi.mock("../../../../../hooks/useImageUrlNormalization", () => ({
  useImageUrlNormalization: () => ({
    normalizeUrl: vi.fn((url: string) => Promise.resolve(url)),
    isNormalizing: false,
    normalizationError: null,
    clearError: vi.fn(),
  }),
}));

describe("MapBackgroundControl", () => {
  const mockOnSetMapBackground = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with initial props", () => {
    render(
      <MapBackgroundControl
        mapBackground="https://example.com/map.jpg"
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    expect(screen.getByPlaceholderText("Paste image URL")).toHaveValue(
      "https://example.com/map.jpg",
    );
    expect(screen.getByRole("button", { name: /Apply Background/i })).toBeInTheDocument();
  });

  it("should render with undefined mapBackground", () => {
    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    expect(screen.getByPlaceholderText("Paste image URL")).toHaveValue("");
  });

  it("should disable Apply button when input is empty", () => {
    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    const button = screen.getByRole("button", { name: /Apply Background/i });
    expect(button).toBeDisabled();
  });

  it("should enable Apply button when input has value", () => {
    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    const input = screen.getByPlaceholderText("Paste image URL");
    fireEvent.change(input, { target: { value: "https://example.com/map.jpg" } });

    const button = screen.getByRole("button", { name: /Apply Background/i });
    expect(button).not.toBeDisabled();
  });

  it("should update input value when user types", () => {
    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    const input = screen.getByPlaceholderText("Paste image URL");
    fireEvent.change(input, { target: { value: "https://example.com/new-map.jpg" } });

    expect(input).toHaveValue("https://example.com/new-map.jpg");
  });

  it("should display loading spinner during image upload", async () => {
    // Mock Image to delay loading
    const originalImage = global.Image;
    global.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 100);
      }
    } as unknown as typeof Image;

    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />,
    );

    const input = screen.getByPlaceholderText("Paste image URL");
    fireEvent.change(input, { target: { value: "https://example.com/map.jpg" } });

    const button = screen.getByRole("button", { name: /Apply Background/i });
    fireEvent.click(button);

    // Check for loading text
    await waitFor(() => {
      expect(screen.getByText(/Loading image/i)).toBeInTheDocument();
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading image/i)).not.toBeInTheDocument();
    });

    global.Image = originalImage;
  });

  it("should call onSetMapBackground and onSuccess when image loads successfully", async () => {
    // Mock successful image load
    const originalImage = global.Image;
    global.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    } as unknown as typeof Image;

    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />,
    );

    const input = screen.getByPlaceholderText("Paste image URL");
    fireEvent.change(input, { target: { value: "https://example.com/map.jpg" } });

    const button = screen.getByRole("button", { name: /Apply Background/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnSetMapBackground).toHaveBeenCalledWith("https://example.com/map.jpg");
      expect(mockOnSuccess).toHaveBeenCalledWith("Map background updated successfully");
    });

    global.Image = originalImage;
  });

  it("should call onError when image fails to load", async () => {
    // Mock failed image load
    const originalImage = global.Image;
    global.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      constructor() {
        setTimeout(() => {
          if (this.onerror) this.onerror();
        }, 10);
      }
    } as unknown as typeof Image;

    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />,
    );

    const input = screen.getByPlaceholderText("Paste image URL");
    fireEvent.change(input, { target: { value: "https://example.com/invalid.jpg" } });

    const button = screen.getByRole("button", { name: /Apply Background/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith("Failed to load image");
      expect(mockOnSetMapBackground).not.toHaveBeenCalled();
    });

    global.Image = originalImage;
  });

  it("should not call callbacks when onSuccess and onError are not provided", async () => {
    // Mock successful image load
    const originalImage = global.Image;
    global.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 10);
      }
    } as unknown as typeof Image;

    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    const input = screen.getByPlaceholderText("Paste image URL");
    fireEvent.change(input, { target: { value: "https://example.com/map.jpg" } });

    const button = screen.getByRole("button", { name: /Apply Background/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnSetMapBackground).toHaveBeenCalledWith("https://example.com/map.jpg");
    });

    // Should not throw error when callbacks are not provided
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();

    global.Image = originalImage;
  });

  it("should display preview image when mapBackground is provided", () => {
    render(
      <MapBackgroundControl
        mapBackground="https://example.com/map.jpg"
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    const image = screen.getByAltText("Current map background");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "https://example.com/map.jpg");
  });

  it("should not display preview image when mapBackground is undefined", () => {
    render(
      <MapBackgroundControl
        mapBackground={undefined}
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    expect(screen.queryByAltText("Current map background")).not.toBeInTheDocument();
  });

  it("should update input when mapBackground prop changes", () => {
    const { rerender } = render(
      <MapBackgroundControl
        mapBackground="https://example.com/map1.jpg"
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    expect(screen.getByPlaceholderText("Paste image URL")).toHaveValue(
      "https://example.com/map1.jpg",
    );

    rerender(
      <MapBackgroundControl
        mapBackground="https://example.com/map2.jpg"
        onSetMapBackground={mockOnSetMapBackground}
      />,
    );

    expect(screen.getByPlaceholderText("Paste image URL")).toHaveValue(
      "https://example.com/map2.jpg",
    );
  });
});
