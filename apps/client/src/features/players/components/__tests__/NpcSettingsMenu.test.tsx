// ============================================================================
// NPC SETTINGS MENU COMPONENT TESTS
// ============================================================================
// Comprehensive tests for NpcSettingsMenu component following SOLID principles (SRP, SoC)
// Tests all features: portal rendering, draggable window, token image input/preview,
// place token, token size selector, token lock toggle, delete NPC, and auto-close
//
// Coverage: ~72 tests for 241 LOC source file
// Follows Phase 1 testing patterns with factory functions and mock components

import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TokenSize } from "@shared";

// ============================================================================
// MOCKS
// ============================================================================

// Mock createPortal to render children directly (simplifies testing)
vi.mock("react-dom", () => ({
  createPortal: (children: React.ReactNode) => children,
}));

// Mock DraggableWindow component
vi.mock("../../../../components/dice/DraggableWindow", () => ({
  DraggableWindow: ({ title, onClose, children, initialX, initialY, width, minWidth, maxWidth, storageKey, zIndex }: any) => (
    <div data-testid="draggable-window">
      <div data-testid="draggable-window-title">{title}</div>
      <div data-testid="draggable-window-props">
        {JSON.stringify({ initialX, initialY, width, minWidth, maxWidth, storageKey, zIndex })}
      </div>
      {onClose && (
        <button data-testid="draggable-window-close" onClick={onClose}>
          Close
        </button>
      )}
      <div data-testid="draggable-window-content">{children}</div>
    </div>
  ),
}));

// Mock useImageUrlNormalization hook
const mockNormalizeUrl = vi.fn();
vi.mock("../../../../hooks/useImageUrlNormalization", () => ({
  useImageUrlNormalization: () => ({
    normalizeUrl: mockNormalizeUrl,
    isNormalizing: false,
    normalizationError: null,
    clearError: vi.fn(),
  }),
}));

// Import component after mocks
import { NpcSettingsMenu } from "../NpcSettingsMenu";

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface NpcSettingsMenuPropsFactory {
  isOpen?: boolean;
  onClose?: () => void;
  tokenImageInput?: string;
  tokenImageUrl?: string;
  onTokenImageInputChange?: (value: string) => void;
  onTokenImageApply?: (value: string) => void;
  onTokenImageClear?: () => void;
  onPlaceToken?: () => void;
  onDelete?: () => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  isDeleting?: boolean;
  deletionError?: string | null;
}

/**
 * Factory function to create default NpcSettingsMenu props
 */
function createProps(overrides: NpcSettingsMenuPropsFactory = {}): Required<NpcSettingsMenuPropsFactory> {
  return {
    isOpen: true,
    onClose: vi.fn(),
    tokenImageInput: "",
    tokenImageUrl: undefined,
    onTokenImageInputChange: vi.fn(),
    onTokenImageApply: vi.fn(),
    onTokenImageClear: vi.fn(),
    onPlaceToken: vi.fn(),
    onDelete: vi.fn(),
    tokenLocked: false,
    onToggleTokenLock: vi.fn(),
    tokenSize: "medium",
    onTokenSizeChange: vi.fn(),
    isDeleting: false,
    deletionError: null,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("NpcSettingsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: normalizeUrl returns the input as-is
    mockNormalizeUrl.mockImplementation(async (url: string) => url);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // CONDITIONAL RENDERING
  // ==========================================================================

  describe("Conditional Rendering", () => {
    it("returns null when isOpen is false", () => {
      const props = createProps({ isOpen: false });
      const { container } = render(<NpcSettingsMenu {...props} />);

      expect(container.firstChild).toBeNull();
    });

    it("renders when isOpen is true", () => {
      const props = createProps({ isOpen: true });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByTestId("draggable-window")).toBeInTheDocument();
    });

    it("renders portal content (createPortal is mocked to render directly)", () => {
      const props = createProps({ isOpen: true });
      render(<NpcSettingsMenu {...props} />);

      // Verify that createPortal was called (content is rendered)
      expect(screen.getByTestId("draggable-window")).toBeInTheDocument();
    });

    it("renders DraggableWindow with correct title", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByTestId("draggable-window-title")).toHaveTextContent("NPC Settings");
    });

    it("renders DraggableWindow with correct props", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      const propsElement = screen.getByTestId("draggable-window-props");
      const renderedProps = JSON.parse(propsElement.textContent || "{}");

      expect(renderedProps).toEqual({
        initialX: 350,
        initialY: 150,
        width: 280,
        minWidth: 280,
        maxWidth: 350,
        storageKey: "npc-settings-menu",
        zIndex: 1001,
      });
    });

    it("passes onClose to DraggableWindow", () => {
      const onClose = vi.fn();
      const props = createProps({ onClose });
      render(<NpcSettingsMenu {...props} />);

      const closeButton = screen.getByTestId("draggable-window-close");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it("renders all content inside DraggableWindow", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      const content = screen.getByTestId("draggable-window-content");
      expect(content).toBeInTheDocument();
      expect(content).toContainElement(screen.getByText("Token Image URL"));
    });

    it("does not render when closed, then renders when opened", () => {
      const props = createProps({ isOpen: false });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      expect(screen.queryByTestId("draggable-window")).not.toBeInTheDocument();

      rerender(<NpcSettingsMenu {...props} isOpen={true} />);

      expect(screen.getByTestId("draggable-window")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // TOKEN IMAGE INPUT
  // ==========================================================================

  describe("Token Image Input", () => {
    it("displays tokenImageInput value in input field", () => {
      const props = createProps({ tokenImageInput: "https://example.com/token.png" });
      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      expect(input).toHaveValue("https://example.com/token.png");
    });

    it("displays empty string when tokenImageInput is empty", () => {
      const props = createProps({ tokenImageInput: "" });
      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      expect(input).toHaveValue("");
    });

    it("shows placeholder text", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      expect(input).toBeInTheDocument();
    });

    it("calls onTokenImageInputChange when input changes", () => {
      const onTokenImageInputChange = vi.fn();
      const props = createProps({ onTokenImageInputChange });
      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      fireEvent.change(input, { target: { value: "https://new-url.com/image.png" } });

      expect(onTokenImageInputChange).toHaveBeenCalledWith("https://new-url.com/image.png");
    });

    it("calls normalizeUrl and onTokenImageApply when Enter key is pressed", async () => {
      const onTokenImageApply = vi.fn();
      const props = createProps({
        tokenImageInput: "https://example.com/token.png",
        onTokenImageApply,
      });
      mockNormalizeUrl.mockResolvedValue("https://normalized.com/token.png");

      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      await waitFor(() => {
        expect(mockNormalizeUrl).toHaveBeenCalledWith("https://example.com/token.png");
        expect(onTokenImageApply).toHaveBeenCalledWith("https://normalized.com/token.png");
      });
    });

    it("trims whitespace before normalizing on Enter", async () => {
      const onTokenImageApply = vi.fn();
      const props = createProps({
        tokenImageInput: "  https://example.com/token.png  ",
        onTokenImageApply,
      });
      mockNormalizeUrl.mockResolvedValue("https://normalized.com/token.png");

      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      await waitFor(() => {
        expect(mockNormalizeUrl).toHaveBeenCalledWith("https://example.com/token.png");
      });
    });

    it("calls normalizeUrl and onTokenImageApply on blur", async () => {
      const onTokenImageApply = vi.fn();
      const props = createProps({
        tokenImageInput: "https://example.com/token.png",
        onTokenImageApply,
      });
      mockNormalizeUrl.mockResolvedValue("https://normalized.com/token.png");

      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockNormalizeUrl).toHaveBeenCalledWith("https://example.com/token.png");
        expect(onTokenImageApply).toHaveBeenCalledWith("https://normalized.com/token.png");
      });
    });

    it("Apply button calls normalizeUrl then onTokenImageApply", async () => {
      const onTokenImageApply = vi.fn();
      const props = createProps({
        tokenImageInput: "https://example.com/token.png",
        onTokenImageApply,
      });
      mockNormalizeUrl.mockResolvedValue("https://normalized.com/token.png");

      render(<NpcSettingsMenu {...props} />);

      const applyButton = screen.getByRole("button", { name: "Apply" });
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockNormalizeUrl).toHaveBeenCalledWith("https://example.com/token.png");
        expect(onTokenImageApply).toHaveBeenCalledWith("https://normalized.com/token.png");
      });
    });

    it("Clear button calls onTokenImageClear", () => {
      const onTokenImageClear = vi.fn();
      const props = createProps({ onTokenImageClear });
      render(<NpcSettingsMenu {...props} />);

      const clearButton = screen.getByRole("button", { name: "Clear" });
      fireEvent.click(clearButton);

      expect(onTokenImageClear).toHaveBeenCalledOnce();
    });

    it("handles async normalizeUrl resolution", async () => {
      const onTokenImageApply = vi.fn();
      const props = createProps({
        tokenImageInput: "https://example.com/token.png",
        onTokenImageApply,
      });
      mockNormalizeUrl.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve("https://async-normalized.com/token.png"), 50))
      );

      render(<NpcSettingsMenu {...props} />);

      const applyButton = screen.getByRole("button", { name: "Apply" });
      fireEvent.click(applyButton);

      // Should not be called immediately
      expect(onTokenImageApply).not.toHaveBeenCalled();

      // Should be called after async resolution
      await waitFor(() => {
        expect(onTokenImageApply).toHaveBeenCalledWith("https://async-normalized.com/token.png");
      });
    });

    it("input has correct styling attributes", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveStyle({
        width: "100%",
        background: "#211317",
        fontSize: "0.7rem",
      });
    });

    it("does not call normalizeUrl when other keys are pressed", () => {
      const props = createProps({ tokenImageInput: "https://example.com/token.png" });
      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      fireEvent.keyDown(input, { key: "a", code: "KeyA" });
      fireEvent.keyDown(input, { key: "Tab", code: "Tab" });
      fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

      expect(mockNormalizeUrl).not.toHaveBeenCalled();
    });

    it("renders Apply and Clear buttons with correct styling", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      const applyButton = screen.getByRole("button", { name: "Apply" });
      const clearButton = screen.getByRole("button", { name: "Clear" });

      expect(applyButton).toHaveClass("btn", "btn-primary");
      expect(clearButton).toHaveClass("btn", "btn-secondary");
    });

    it("renders Token Image URL label", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByText("Token Image URL")).toBeInTheDocument();
      expect(screen.getByText("Token Image URL")).toHaveClass("jrpg-text-small");
    });
  });

  // ==========================================================================
  // TOKEN IMAGE PREVIEW
  // ==========================================================================

  describe("Token Image Preview", () => {
    it("shows preview image when tokenImageUrl exists", () => {
      const props = createProps({ tokenImageUrl: "https://example.com/token.png" });
      render(<NpcSettingsMenu {...props} />);

      const img = screen.getByAltText("Token preview");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/token.png");
    });

    it("hides preview when tokenImageUrl is undefined", () => {
      const props = createProps({ tokenImageUrl: undefined });
      render(<NpcSettingsMenu {...props} />);

      const img = screen.queryByAltText("Token preview");
      expect(img).not.toBeInTheDocument();
    });

    it("hides preview when tokenImageUrl is empty string", () => {
      const props = createProps({ tokenImageUrl: "" });
      render(<NpcSettingsMenu {...props} />);

      const img = screen.queryByAltText("Token preview");
      expect(img).not.toBeInTheDocument();
    });

    it("image has correct styling", () => {
      const props = createProps({ tokenImageUrl: "https://example.com/token.png" });
      render(<NpcSettingsMenu {...props} />);

      const img = screen.getByAltText("Token preview");
      expect(img).toHaveStyle({
        width: "56px",
        height: "56px",
        objectFit: "cover",
        borderRadius: "6px",
      });
    });

    it("image alt text is 'Token preview'", () => {
      const props = createProps({ tokenImageUrl: "https://example.com/token.png" });
      render(<NpcSettingsMenu {...props} />);

      const img = screen.getByAltText("Token preview");
      expect(img).toHaveAttribute("alt", "Token preview");
    });

    it("onError hides image by setting display: none", () => {
      const props = createProps({ tokenImageUrl: "https://example.com/broken.png" });
      render(<NpcSettingsMenu {...props} />);

      const img = screen.getByAltText("Token preview") as HTMLImageElement;

      // Simulate image load error
      fireEvent.error(img);

      expect(img).toHaveStyle({ display: "none" });
    });

    it("handles error with broken image URL gracefully", () => {
      const props = createProps({ tokenImageUrl: "https://broken-url.com/404.png" });
      render(<NpcSettingsMenu {...props} />);

      const img = screen.getByAltText("Token preview");
      expect(img).toBeInTheDocument();

      // Trigger error
      fireEvent.error(img);

      // Image should still be in DOM but hidden
      expect(img).toBeInTheDocument();
      expect(img).toHaveStyle({ display: "none" });
    });

    it("toggles preview visibility when tokenImageUrl changes", () => {
      const props = createProps({ tokenImageUrl: undefined });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      expect(screen.queryByAltText("Token preview")).not.toBeInTheDocument();

      rerender(<NpcSettingsMenu {...props} tokenImageUrl="https://example.com/token.png" />);

      expect(screen.getByAltText("Token preview")).toBeInTheDocument();
    });

    it("image src updates when tokenImageUrl changes", () => {
      const props = createProps({ tokenImageUrl: "https://example.com/token1.png" });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      const img = screen.getByAltText("Token preview");
      expect(img).toHaveAttribute("src", "https://example.com/token1.png");

      rerender(<NpcSettingsMenu {...props} tokenImageUrl="https://example.com/token2.png" />);

      expect(img).toHaveAttribute("src", "https://example.com/token2.png");
    });
  });

  // ==========================================================================
  // PLACE TOKEN BUTTON
  // ==========================================================================

  describe("Place Token Button", () => {
    it("renders Place Token button", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "Place Token" })).toBeInTheDocument();
    });

    it("clicking Place Token calls onPlaceToken", () => {
      const onPlaceToken = vi.fn();
      const props = createProps({ onPlaceToken });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "Place Token" });
      fireEvent.click(button);

      expect(onPlaceToken).toHaveBeenCalledOnce();
    });

    it("Place Token button has correct styling", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "Place Token" });
      expect(button).toHaveClass("btn", "btn-secondary");
    });

    it("calls onPlaceToken multiple times when clicked multiple times", () => {
      const onPlaceToken = vi.fn();
      const props = createProps({ onPlaceToken });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "Place Token" });
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onPlaceToken).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // TOKEN SIZE SELECTOR
  // ==========================================================================

  describe("Token Size Selector", () => {
    it("renders Token Size label", () => {
      const props = createProps({ onTokenSizeChange: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByText("Token Size")).toBeInTheDocument();
      expect(screen.getByText("Token Size")).toHaveClass("jrpg-text-small");
    });

    it("renders all 6 size buttons", () => {
      const props = createProps({ onTokenSizeChange: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "Tiny" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Small" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Med" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Large" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Huge" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Garg" })).toBeInTheDocument();
    });

    it("current tokenSize has btn-primary class", () => {
      const props = createProps({ tokenSize: "large", onTokenSizeChange: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      const largeButton = screen.getByRole("button", { name: "Large" });
      expect(largeButton).toHaveClass("btn", "btn-primary");
    });

    it("other sizes have btn-secondary class", () => {
      const props = createProps({ tokenSize: "medium", onTokenSizeChange: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "Tiny" })).toHaveClass("btn", "btn-secondary");
      expect(screen.getByRole("button", { name: "Small" })).toHaveClass("btn", "btn-secondary");
      expect(screen.getByRole("button", { name: "Large" })).toHaveClass("btn", "btn-secondary");
      expect(screen.getByRole("button", { name: "Huge" })).toHaveClass("btn", "btn-secondary");
      expect(screen.getByRole("button", { name: "Garg" })).toHaveClass("btn", "btn-secondary");
    });

    it("clicking size button calls onTokenSizeChange with correct size - tiny", () => {
      const onTokenSizeChange = vi.fn();
      const props = createProps({ onTokenSizeChange });
      render(<NpcSettingsMenu {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "Tiny" }));
      expect(onTokenSizeChange).toHaveBeenCalledWith("tiny");
    });

    it("clicking size button calls onTokenSizeChange with correct size - small", () => {
      const onTokenSizeChange = vi.fn();
      const props = createProps({ onTokenSizeChange });
      render(<NpcSettingsMenu {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "Small" }));
      expect(onTokenSizeChange).toHaveBeenCalledWith("small");
    });

    it("clicking size button calls onTokenSizeChange with correct size - medium", () => {
      const onTokenSizeChange = vi.fn();
      const props = createProps({ onTokenSizeChange });
      render(<NpcSettingsMenu {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "Med" }));
      expect(onTokenSizeChange).toHaveBeenCalledWith("medium");
    });

    it("clicking size button calls onTokenSizeChange with correct size - large", () => {
      const onTokenSizeChange = vi.fn();
      const props = createProps({ onTokenSizeChange });
      render(<NpcSettingsMenu {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "Large" }));
      expect(onTokenSizeChange).toHaveBeenCalledWith("large");
    });

    it("clicking size button calls onTokenSizeChange with correct size - huge", () => {
      const onTokenSizeChange = vi.fn();
      const props = createProps({ onTokenSizeChange });
      render(<NpcSettingsMenu {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "Huge" }));
      expect(onTokenSizeChange).toHaveBeenCalledWith("huge");
    });

    it("clicking size button calls onTokenSizeChange with correct size - gargantuan", () => {
      const onTokenSizeChange = vi.fn();
      const props = createProps({ onTokenSizeChange });
      render(<NpcSettingsMenu {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "Garg" }));
      expect(onTokenSizeChange).toHaveBeenCalledWith("gargantuan");
    });

    it("default tokenSize is medium", () => {
      const props = createProps({ tokenSize: undefined, onTokenSizeChange: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      const mediumButton = screen.getByRole("button", { name: "Med" });
      expect(mediumButton).toHaveClass("btn", "btn-primary");
    });

    it("does not render token size selector when onTokenSizeChange is undefined", () => {
      const props = createProps({ onTokenSizeChange: undefined });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.queryByText("Token Size")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tiny" })).not.toBeInTheDocument();
    });

    it("size buttons have correct title attributes", () => {
      const props = createProps({ onTokenSizeChange: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "Tiny" })).toHaveAttribute("title", "Tiny");
      expect(screen.getByRole("button", { name: "Small" })).toHaveAttribute("title", "Small");
      expect(screen.getByRole("button", { name: "Med" })).toHaveAttribute("title", "Medium");
      expect(screen.getByRole("button", { name: "Large" })).toHaveAttribute("title", "Large");
      expect(screen.getByRole("button", { name: "Huge" })).toHaveAttribute("title", "Huge");
      expect(screen.getByRole("button", { name: "Garg" })).toHaveAttribute("title", "Gargantuan");
    });

    it("updates styling when tokenSize changes", () => {
      const props = createProps({ tokenSize: "small", onTokenSizeChange: vi.fn() });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "Small" })).toHaveClass("btn-primary");
      expect(screen.getByRole("button", { name: "Large" })).toHaveClass("btn-secondary");

      rerender(<NpcSettingsMenu {...props} tokenSize="large" />);

      expect(screen.getByRole("button", { name: "Small" })).toHaveClass("btn-secondary");
      expect(screen.getByRole("button", { name: "Large" })).toHaveClass("btn-primary");
    });

    it("renders token size section with proper layout", () => {
      const props = createProps({ onTokenSizeChange: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      // Verify token size section renders
      expect(screen.getByText("Token Size")).toBeInTheDocument();
      expect(screen.getAllByRole("button").filter(btn =>
        ["Tiny", "Small", "Med", "Large", "Huge", "Garg"].includes(btn.textContent || "")
      )).toHaveLength(6);
    });
  });

  // ==========================================================================
  // TOKEN LOCK TOGGLE
  // ==========================================================================

  describe("Token Lock Toggle", () => {
    it("does not render when onToggleTokenLock is undefined", () => {
      const props = createProps({ onToggleTokenLock: undefined });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.queryByText(/Locked/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Unlocked/)).not.toBeInTheDocument();
    });

    it("renders when onToggleTokenLock is defined", () => {
      const props = createProps({ onToggleTokenLock: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: /Unlocked/ })).toBeInTheDocument();
    });

    it("shows 🔒 Locked when tokenLocked is true", () => {
      const props = createProps({ tokenLocked: true, onToggleTokenLock: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "🔒 Locked" })).toBeInTheDocument();
    });

    it("shows 🔓 Unlocked when tokenLocked is false", () => {
      const props = createProps({ tokenLocked: false, onToggleTokenLock: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "🔓 Unlocked" })).toBeInTheDocument();
    });

    it("locked button has btn-primary class", () => {
      const props = createProps({ tokenLocked: true, onToggleTokenLock: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "🔒 Locked" });
      expect(button).toHaveClass("btn", "btn-primary");
    });

    it("unlocked button has btn-secondary class", () => {
      const props = createProps({ tokenLocked: false, onToggleTokenLock: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "🔓 Unlocked" });
      expect(button).toHaveClass("btn", "btn-secondary");
    });

    it("clicking locked button calls onToggleTokenLock with false", () => {
      const onToggleTokenLock = vi.fn();
      const props = createProps({ tokenLocked: true, onToggleTokenLock });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "🔒 Locked" });
      fireEvent.click(button);

      expect(onToggleTokenLock).toHaveBeenCalledWith(false);
    });

    it("clicking unlocked button calls onToggleTokenLock with true", () => {
      const onToggleTokenLock = vi.fn();
      const props = createProps({ tokenLocked: false, onToggleTokenLock });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "🔓 Unlocked" });
      fireEvent.click(button);

      expect(onToggleTokenLock).toHaveBeenCalledWith(true);
    });

    it("locked button has correct title attribute", () => {
      const props = createProps({ tokenLocked: true, onToggleTokenLock: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "🔒 Locked" });
      expect(button).toHaveAttribute("title", "Token is locked (DM can unlock)");
    });

    it("unlocked button has correct title attribute", () => {
      const props = createProps({ tokenLocked: false, onToggleTokenLock: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "🔓 Unlocked" });
      expect(button).toHaveAttribute("title", "Token is unlocked");
    });

    it("toggles between locked and unlocked states", () => {
      const props = createProps({ tokenLocked: false, onToggleTokenLock: vi.fn() });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "🔓 Unlocked" })).toBeInTheDocument();

      rerender(<NpcSettingsMenu {...props} tokenLocked={true} />);

      expect(screen.getByRole("button", { name: "🔒 Locked" })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // DELETE NPC BUTTON
  // ==========================================================================

  describe("Delete NPC Button", () => {
    it("renders Delete NPC button", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "Delete NPC" })).toBeInTheDocument();
    });

    it("clicking Delete NPC calls onDelete", () => {
      const onDelete = vi.fn();
      const props = createProps({ onDelete });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "Delete NPC" });
      fireEvent.click(button);

      expect(onDelete).toHaveBeenCalledOnce();
    });

    it("button is disabled when isDeleting is true", () => {
      const props = createProps({ isDeleting: true });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "Deleting..." });
      expect(button).toBeDisabled();
    });

    it("button is enabled when isDeleting is false", () => {
      const props = createProps({ isDeleting: false });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "Delete NPC" });
      expect(button).toBeEnabled();
    });

    it("shows Deleting... text when isDeleting is true", () => {
      const props = createProps({ isDeleting: true });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "Deleting..." })).toBeInTheDocument();
    });

    it("shows Delete NPC text when isDeleting is false", () => {
      const props = createProps({ isDeleting: false });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByRole("button", { name: "Delete NPC" })).toBeInTheDocument();
    });

    it("button has btn-danger class", () => {
      const props = createProps();
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "Delete NPC" });
      expect(button).toHaveClass("btn", "btn-danger");
    });

    it("displays deletionError when present", () => {
      const props = createProps({ deletionError: "Failed to delete NPC" });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.getByText("Failed to delete NPC")).toBeInTheDocument();
    });

    it("deletionError has correct styling", () => {
      const props = createProps({ deletionError: "Error message" });
      render(<NpcSettingsMenu {...props} />);

      const errorElement = screen.getByText("Error message");
      expect(errorElement).toHaveClass("jrpg-text-small");
      expect(errorElement).toHaveStyle({
        textAlign: "center",
      });
    });

    it("no error message when deletionError is null", () => {
      const props = createProps({ deletionError: null });
      render(<NpcSettingsMenu {...props} />);

      // Error element should not exist
      const errorElement = screen.queryByText(/Failed|Error/);
      expect(errorElement).not.toBeInTheDocument();
    });

    it("error message appears and disappears", () => {
      const props = createProps({ deletionError: null });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      expect(screen.queryByText("Error occurred")).not.toBeInTheDocument();

      rerender(<NpcSettingsMenu {...props} deletionError="Error occurred" />);

      expect(screen.getByText("Error occurred")).toBeInTheDocument();

      rerender(<NpcSettingsMenu {...props} deletionError={null} />);

      expect(screen.queryByText("Error occurred")).not.toBeInTheDocument();
    });

    it("does not call onDelete when disabled during deletion", () => {
      const onDelete = vi.fn();
      const props = createProps({ isDeleting: true, onDelete });
      render(<NpcSettingsMenu {...props} />);

      const button = screen.getByRole("button", { name: "Deleting..." });

      // Try to click the disabled button
      fireEvent.click(button);

      // onDelete should not be called because button is disabled
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // AUTO-CLOSE ON DELETION
  // ==========================================================================

  describe("Auto-Close on Deletion", () => {
    it("calls onClose when deletion completes successfully", async () => {
      const onClose = vi.fn();
      const props = createProps({ isDeleting: false, deletionError: null, onClose });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      // Start deletion
      rerender(<NpcSettingsMenu {...props} isDeleting={true} />);

      // Complete deletion successfully
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError={null} />);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
    });

    it("does not close when deletion starts", () => {
      const onClose = vi.fn();
      const props = createProps({ isDeleting: false, onClose });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      // Start deletion
      rerender(<NpcSettingsMenu {...props} isDeleting={true} />);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not close when deletion fails", async () => {
      const onClose = vi.fn();
      const props = createProps({ isDeleting: false, deletionError: null, onClose });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      // Start deletion
      rerender(<NpcSettingsMenu {...props} isDeleting={true} />);

      // Deletion fails
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError="Failed to delete" />);

      await waitFor(() => {
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it("does not close when still deleting", () => {
      const onClose = vi.fn();
      const props = createProps({ isDeleting: true, onClose });
      render(<NpcSettingsMenu {...props} />);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("logs to console on successful closure", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const onClose = vi.fn();
      const props = createProps({ isDeleting: false, deletionError: null, onClose });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      // Start deletion
      rerender(<NpcSettingsMenu {...props} isDeleting={true} />);

      // Complete deletion successfully
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError={null} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("[NpcSettingsMenu] Deletion completed, closing menu");
      });

      consoleSpy.mockRestore();
    });

    it("manages wasDeleting state across renders", async () => {
      const onClose = vi.fn();
      const props = createProps({ isDeleting: false, deletionError: null, onClose });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      // Initial render - wasDeleting should be false
      expect(onClose).not.toHaveBeenCalled();

      // Start deletion - wasDeleting updates to true
      rerender(<NpcSettingsMenu {...props} isDeleting={true} />);
      expect(onClose).not.toHaveBeenCalled();

      // Complete deletion - wasDeleting=true, isDeleting=false -> should close
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError={null} />);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
    });

    it("does not close if never started deleting", () => {
      const onClose = vi.fn();
      const props = createProps({ isDeleting: false, deletionError: null, onClose });
      render(<NpcSettingsMenu {...props} />);

      // Never started deleting, so should not close
      expect(onClose).not.toHaveBeenCalled();
    });

    it("only closes once even with multiple rerenders", async () => {
      const onClose = vi.fn();
      const props = createProps({ isDeleting: false, deletionError: null, onClose });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      // Start deletion
      rerender(<NpcSettingsMenu {...props} isDeleting={true} />);

      // Complete deletion
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError={null} />);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });

      // Additional rerenders should not call onClose again
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError={null} />);
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError={null} />);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("handles deletion failure then success sequence", async () => {
      const onClose = vi.fn();
      const props = createProps({ isDeleting: false, deletionError: null, onClose });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      // First deletion attempt
      rerender(<NpcSettingsMenu {...props} isDeleting={true} />);
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError="Failed" />);

      expect(onClose).not.toHaveBeenCalled();

      // Second deletion attempt
      rerender(<NpcSettingsMenu {...props} isDeleting={true} deletionError={null} />);
      rerender(<NpcSettingsMenu {...props} isDeleting={false} deletionError={null} />);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
    });
  });

  // ==========================================================================
  // EDGE CASES & INTEGRATION
  // ==========================================================================

  describe("Edge Cases & Integration", () => {
    it("works with all optional props undefined", () => {
      const minimalProps = {
        isOpen: true,
        onClose: vi.fn(),
        tokenImageInput: "",
        onTokenImageInputChange: vi.fn(),
        onTokenImageApply: vi.fn(),
        onTokenImageClear: vi.fn(),
        onPlaceToken: vi.fn(),
        onDelete: vi.fn(),
      };

      render(<NpcSettingsMenu {...minimalProps} />);

      expect(screen.getByTestId("draggable-window")).toBeInTheDocument();
      expect(screen.queryByText("Token Size")).not.toBeInTheDocument();
      expect(screen.queryByText(/Locked/)).not.toBeInTheDocument();
    });

    it("handles multiple state changes correctly", async () => {
      const props = createProps({
        tokenImageInput: "",
        tokenImageUrl: undefined,
        tokenSize: "medium",
        tokenLocked: false,
        isDeleting: false,
      });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      // Update tokenImageInput
      rerender(<NpcSettingsMenu {...props} tokenImageInput="https://example.com/token.png" />);
      expect(screen.getByPlaceholderText("https://enemy-token.png")).toHaveValue("https://example.com/token.png");

      // Update tokenImageUrl
      rerender(<NpcSettingsMenu {...props} tokenImageInput="https://example.com/token.png" tokenImageUrl="https://example.com/token.png" />);
      expect(screen.getByAltText("Token preview")).toBeInTheDocument();

      // Update tokenSize
      rerender(<NpcSettingsMenu {...props} tokenImageInput="https://example.com/token.png" tokenImageUrl="https://example.com/token.png" tokenSize="large" onTokenSizeChange={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Large" })).toHaveClass("btn-primary");
    });

    it("handles tokenImageInput as empty string", () => {
      const props = createProps({ tokenImageInput: "" });
      render(<NpcSettingsMenu {...props} />);

      const input = screen.getByPlaceholderText("https://enemy-token.png");
      expect(input).toHaveValue("");
    });

    it("handles tokenImageUrl as null", () => {
      const props = createProps({ tokenImageUrl: null as any });
      render(<NpcSettingsMenu {...props} />);

      expect(screen.queryByAltText("Token preview")).not.toBeInTheDocument();
    });

    it("rapid open/close does not cause errors", () => {
      const props = createProps({ isOpen: false });
      const { rerender } = render(<NpcSettingsMenu {...props} />);

      rerender(<NpcSettingsMenu {...props} isOpen={true} />);
      rerender(<NpcSettingsMenu {...props} isOpen={false} />);
      rerender(<NpcSettingsMenu {...props} isOpen={true} />);
      rerender(<NpcSettingsMenu {...props} isOpen={false} />);
      rerender(<NpcSettingsMenu {...props} isOpen={true} />);

      expect(screen.getByTestId("draggable-window")).toBeInTheDocument();
    });

    it("renders all sections with proper layout structure", () => {
      const props = createProps({ onTokenSizeChange: vi.fn(), onToggleTokenLock: vi.fn() });
      render(<NpcSettingsMenu {...props} />);

      // Verify all major sections render
      expect(screen.getByText("Token Image URL")).toBeInTheDocument();
      expect(screen.getByText("Place Token")).toBeInTheDocument();
      expect(screen.getByText("Token Size")).toBeInTheDocument();
      expect(screen.getByText(/Locked|Unlocked/)).toBeInTheDocument();
      expect(screen.getByText("Delete NPC")).toBeInTheDocument();
    });

    it("handles all callbacks being called in sequence", async () => {
      const callbacks = {
        onClose: vi.fn(),
        onTokenImageInputChange: vi.fn(),
        onTokenImageApply: vi.fn(),
        onTokenImageClear: vi.fn(),
        onPlaceToken: vi.fn(),
        onDelete: vi.fn(),
        onToggleTokenLock: vi.fn(),
        onTokenSizeChange: vi.fn(),
      };
      const props = createProps(callbacks);
      render(<NpcSettingsMenu {...props} />);

      // Trigger various callbacks
      fireEvent.change(screen.getByPlaceholderText("https://enemy-token.png"), { target: { value: "test" } });
      expect(callbacks.onTokenImageInputChange).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      expect(callbacks.onTokenImageClear).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Place Token" }));
      expect(callbacks.onPlaceToken).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Tiny" }));
      expect(callbacks.onTokenSizeChange).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /Unlocked/ }));
      expect(callbacks.onToggleTokenLock).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Delete NPC" }));
      expect(callbacks.onDelete).toHaveBeenCalled();
    });

    it("normalizeUrl handles empty string input", async () => {
      const onTokenImageApply = vi.fn();
      const props = createProps({ tokenImageInput: "", onTokenImageApply });
      mockNormalizeUrl.mockResolvedValue("");

      render(<NpcSettingsMenu {...props} />);

      const applyButton = screen.getByRole("button", { name: "Apply" });
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockNormalizeUrl).toHaveBeenCalledWith("");
        expect(onTokenImageApply).toHaveBeenCalledWith("");
      });
    });
  });
});
