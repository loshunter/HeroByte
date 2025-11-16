/**
 * Comprehensive test suite for ImagePreview component
 *
 * Tests the image preview component with error handling, size normalization,
 * and flexible styling options. Ensures proper src validation, border styling,
 * and error callbacks work correctly.
 *
 * @module components/ui/__tests__/ImagePreview
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ImagePreview } from "../ImagePreview.js";

describe("ImagePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Src Validation - Null and Empty Values", () => {
    it("should return null when src is null", () => {
      const { container } = render(<ImagePreview src={null} alt="Test alt" />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when src is empty string", () => {
      const { container } = render(<ImagePreview src="" alt="Test alt" />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when src is single space", () => {
      const { container } = render(<ImagePreview src=" " alt="Test alt" />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when src is multiple spaces", () => {
      const { container } = render(<ImagePreview src="   " alt="Test alt" />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when src is tab character", () => {
      // Using actual tab character in string
      const tabSrc = "	"; // This is a real tab character
      const { container } = render(<ImagePreview src={tabSrc} alt="Test alt" />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when src is newline character", () => {
      // Using actual newline character in string
      const newlineSrc = `
`;
      const { container } = render(<ImagePreview src={newlineSrc} alt="Test alt" />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when src is mixed whitespace", () => {
      // Using actual whitespace characters in string
      const mixedWhitespace = `
 `;
      const { container } = render(<ImagePreview src={mixedWhitespace} alt="Test alt" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Src Validation - Valid Values", () => {
    it("should render img when src is valid URL", () => {
      render(<ImagePreview src="https://example.com/image.png" alt="Valid image" />);

      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
    });

    it("should render img when src is relative path", () => {
      render(<ImagePreview src="/images/test.png" alt="Relative path" />);

      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
    });

    it("should render img when src has leading whitespace but valid content", () => {
      render(<ImagePreview src="  https://example.com/image.png" alt="Leading space" />);

      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "  https://example.com/image.png");
    });

    it("should render img when src has trailing whitespace but valid content", () => {
      render(<ImagePreview src="https://example.com/image.png  " alt="Trailing space" />);

      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/image.png  ");
    });

    it("should render img when src has leading and trailing whitespace", () => {
      render(<ImagePreview src="  https://example.com/image.png  " alt="Both spaces" />);

      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
    });

    it("should render img when src is data URL", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      render(<ImagePreview src={dataUrl} alt="Data URL" />);

      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
    });
  });

  describe("Initial Rendering - Basic Attributes", () => {
    it("should render img element with valid src", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Test" />);

      const img = screen.getByRole("img");
      expect(img.tagName).toBe("IMG");
    });

    it("should set src attribute correctly", () => {
      const testSrc = "https://example.com/image.jpg";
      render(<ImagePreview src={testSrc} alt="Test" />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", testSrc);
    });

    it("should set alt attribute correctly", () => {
      const testAlt = "Test alternative text";
      render(<ImagePreview src="https://example.com/test.png" alt={testAlt} />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", testAlt);
    });

    it("should have img role for accessibility", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Accessible image" />);

      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
    });

    it("should render with empty alt attribute", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="" />);

      const img = screen.getByRole("img", { hidden: true });
      expect(img).toHaveAttribute("alt", "");
    });
  });

  describe("Size Props - Width (Default: 48px)", () => {
    it("should apply default width of 48px when not provided", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Default width" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "48px" });
    });

    it("should apply string width in pixels", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Custom width" width="100px" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "100px" });
    });

    it("should apply string width in percentage", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Percentage width" width="50%" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "50%" });
    });

    it("should apply 100% string width", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Full width" width="100%" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "100%" });
    });

    it("should convert number width to px - 100", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Number width 100" width={100} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "100px" });
    });

    it("should convert number width to px - 48", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Number width 48" width={48} />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "48px" });
    });

    it("should convert number width to px - 200", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Number width 200" width={200} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "200px" });
    });

    it("should handle width undefined explicitly", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Undefined width" width={undefined} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "48px" });
    });

    it("should apply string width in rem units", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Rem width" width="3rem" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "3rem" });
    });

    it("should apply string width in em units", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Em width" width="4em" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "4em" });
    });
  });

  describe("Size Props - Height (Default: 48px)", () => {
    it("should apply default height of 48px when not provided", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Default height" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "48px" });
    });

    it("should apply string height in pixels", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Custom height" height="100px" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "100px" });
    });

    it("should apply string height in percentage", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Percentage height" height="75%" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "75%" });
    });

    it("should apply 100% string height", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Full height" height="100%" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "100%" });
    });

    it("should convert number height to px - 100", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Number height 100" height={100} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "100px" });
    });

    it("should convert number height to px - 48", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Number height 48" height={48} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "48px" });
    });

    it("should convert number height to px - 150", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Number height 150" height={150} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "150px" });
    });

    it("should handle height undefined explicitly", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Undefined height"
          height={undefined}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "48px" });
    });

    it("should apply string height in rem units", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Rem height" height="2rem" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "2rem" });
    });

    it("should apply string height in em units", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Em height" height="5em" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "5em" });
    });
  });

  describe("Size Props - MaxHeight (Optional)", () => {
    it("should not apply maxHeight by default", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="No max height" />);

      const img = screen.getByRole("img");
      expect(img.style.maxHeight).toBe("");
    });

    it("should apply string maxHeight in pixels", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Max height px" maxHeight="100px" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ maxHeight: "100px" });
    });

    it("should apply string maxHeight in percentage", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Max height percent"
          maxHeight="80%"
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ maxHeight: "80%" });
    });

    it("should convert number maxHeight to px - 100", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Max height number 100"
          maxHeight={100}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ maxHeight: "100px" });
    });

    it("should convert number maxHeight to px - 200", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Max height number 200"
          maxHeight={200}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ maxHeight: "200px" });
    });

    it("should handle maxHeight undefined explicitly", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Undefined max height"
          maxHeight={undefined}
        />,
      );

      const img = screen.getByRole("img");
      expect(img.style.maxHeight).toBe("");
    });

    it("should apply string maxHeight in rem units", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Max height rem" maxHeight="6rem" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ maxHeight: "6rem" });
    });

    it("should apply maxHeight with portrait variant", () => {
      render(
        <ImagePreview
          src="https://example.com/portrait.png"
          alt="Portrait"
          width="100%"
          maxHeight="100px"
          showBorder={false}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ maxHeight: "100px" });
    });
  });

  describe("ObjectFit Prop - Default: cover", () => {
    it("should apply default objectFit of cover", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Default object fit" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ objectFit: "cover" });
    });

    it("should apply objectFit contain when specified", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Contain fit" objectFit="contain" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ objectFit: "contain" });
    });

    it("should apply objectFit cover when explicitly specified", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Cover fit" objectFit="cover" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ objectFit: "cover" });
    });

    it("should apply objectFit with custom sizing", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Custom size with contain"
          width={200}
          height={200}
          objectFit="contain"
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ objectFit: "contain" });
    });
  });

  describe("AlignSelf Prop - Default: flex-start", () => {
    it("should apply default alignSelf of flex-start", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Default align" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ alignSelf: "flex-start" });
    });

    it("should apply alignSelf center when specified", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Center align" alignSelf="center" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ alignSelf: "center" });
    });

    it("should apply alignSelf flex-start when explicitly specified", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Flex start align"
          alignSelf="flex-start"
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ alignSelf: "flex-start" });
    });

    it("should apply alignSelf with custom sizing", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Custom size centered"
          width="100%"
          alignSelf="center"
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ alignSelf: "center" });
    });
  });

  describe("Border Styling - Default: true", () => {
    it("should apply default border when showBorder not specified", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Default border" />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ border: "1px solid var(--jrpg-border-gold)" });
    });

    it("should apply border when showBorder is true", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Explicit border" showBorder={true} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ border: "1px solid var(--jrpg-border-gold)" });
    });

    it("should not apply border when showBorder is false", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="No border" showBorder={false} />,
      );

      const img = screen.getByRole("img");
      expect(img.style.border).toBe("");
    });

    it("should apply borderRadius regardless of showBorder", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Border radius" showBorder={false} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ borderRadius: "4px" });
    });

    it("should apply borderRadius with border", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Border and radius"
          showBorder={true}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ borderRadius: "4px" });
    });

    it("should apply border with token variant", () => {
      render(
        <ImagePreview
          src="https://example.com/token.png"
          alt="Token"
          width={48}
          height={48}
          showBorder={true}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ border: "1px solid var(--jrpg-border-gold)" });
    });

    it("should not apply border with portrait variant", () => {
      render(
        <ImagePreview
          src="https://example.com/portrait.png"
          alt="Portrait"
          width="100%"
          maxHeight="100px"
          showBorder={false}
        />,
      );

      const img = screen.getByRole("img");
      expect(img.style.border).toBe("");
    });
  });

  describe("Error Handling - Load Failures", () => {
    it("should hide element when onError is triggered", () => {
      render(<ImagePreview src="https://example.com/broken.png" alt="Broken image" />);

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(img).toHaveStyle({ display: "none" });
    });

    it("should call onLoadError callback when provided and error occurs", () => {
      const mockOnLoadError = vi.fn();

      render(
        <ImagePreview
          src="https://example.com/broken.png"
          alt="Broken image"
          onLoadError={mockOnLoadError}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(mockOnLoadError).toHaveBeenCalledTimes(1);
    });

    it("should not throw error when onLoadError not provided and error occurs", () => {
      expect(() => {
        render(<ImagePreview src="https://example.com/broken.png" alt="Broken image" />);

        const img = screen.getByRole("img");
        fireEvent.error(img);
      }).not.toThrow();
    });

    it("should hide element and call callback when both present", () => {
      const mockOnLoadError = vi.fn();

      render(
        <ImagePreview
          src="https://example.com/broken.png"
          alt="Broken image"
          onLoadError={mockOnLoadError}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(img).toHaveStyle({ display: "none" });
      expect(mockOnLoadError).toHaveBeenCalledTimes(1);
    });

    it("should persist hidden state after error", () => {
      render(<ImagePreview src="https://example.com/broken.png" alt="Broken image" />);

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(img).toHaveStyle({ display: "none" });

      // Check it's still hidden after some time
      expect(img).toHaveStyle({ display: "none" });
    });

    it("should handle multiple error events", () => {
      const mockOnLoadError = vi.fn();

      render(
        <ImagePreview
          src="https://example.com/broken.png"
          alt="Broken image"
          onLoadError={mockOnLoadError}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);
      fireEvent.error(img);
      fireEvent.error(img);

      expect(img).toHaveStyle({ display: "none" });
      expect(mockOnLoadError).toHaveBeenCalledTimes(3);
    });

    it("should call onLoadError only once per render even with multiple errors", () => {
      const mockOnLoadError = vi.fn();

      render(
        <ImagePreview
          src="https://example.com/broken.png"
          alt="Broken image"
          onLoadError={mockOnLoadError}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(mockOnLoadError).toHaveBeenCalledTimes(1);

      fireEvent.error(img);

      expect(mockOnLoadError).toHaveBeenCalledTimes(2);
    });

    it("should not affect other images when one errors", () => {
      const mockOnLoadError1 = vi.fn();
      const mockOnLoadError2 = vi.fn();

      render(
        <>
          <ImagePreview
            src="https://example.com/broken1.png"
            alt="Broken 1"
            onLoadError={mockOnLoadError1}
          />
          <ImagePreview
            src="https://example.com/broken2.png"
            alt="Broken 2"
            onLoadError={mockOnLoadError2}
          />
        </>,
      );

      const images = screen.getAllByRole("img");
      fireEvent.error(images[0]);

      expect(images[0]).toHaveStyle({ display: "none" });
      expect(images[1]).not.toHaveStyle({ display: "none" });
      expect(mockOnLoadError1).toHaveBeenCalledTimes(1);
      expect(mockOnLoadError2).not.toHaveBeenCalled();
    });
  });

  describe("React.memo Optimization - Rendering Behavior", () => {
    it("should not re-render when props are identical", () => {
      const mockOnLoadError = vi.fn();
      const props = {
        src: "https://example.com/test.png",
        alt: "Test",
        width: 48,
        height: 48,
        onLoadError: mockOnLoadError,
      };

      const { rerender } = render(<ImagePreview {...props} />);

      const img = screen.getByRole("img");
      const initialElement = img;

      // Re-render with same props
      rerender(<ImagePreview {...props} />);

      const afterRerender = screen.getByRole("img");

      // Due to React.memo, the component should not re-render with identical props
      expect(afterRerender).toBe(initialElement);
    });

    it("should re-render when src changes", () => {
      const { rerender } = render(<ImagePreview src="https://example.com/test1.png" alt="Test" />);

      const img1 = screen.getByRole("img");
      expect(img1).toHaveAttribute("src", "https://example.com/test1.png");

      rerender(<ImagePreview src="https://example.com/test2.png" alt="Test" />);

      const img2 = screen.getByRole("img");
      expect(img2).toHaveAttribute("src", "https://example.com/test2.png");
    });

    it("should re-render when alt changes", () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/test.png" alt="First alt" />,
      );

      const img1 = screen.getByRole("img");
      expect(img1).toHaveAttribute("alt", "First alt");

      rerender(<ImagePreview src="https://example.com/test.png" alt="Second alt" />);

      const img2 = screen.getByRole("img");
      expect(img2).toHaveAttribute("alt", "Second alt");
    });

    it("should re-render when width changes", () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/test.png" alt="Test" width={48} />,
      );

      const img1 = screen.getByRole("img");
      expect(img1).toHaveStyle({ width: "48px" });

      rerender(<ImagePreview src="https://example.com/test.png" alt="Test" width={100} />);

      const img2 = screen.getByRole("img");
      expect(img2).toHaveStyle({ width: "100px" });
    });

    it("should re-render when height changes", () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/test.png" alt="Test" height={48} />,
      );

      const img1 = screen.getByRole("img");
      expect(img1).toHaveStyle({ height: "48px" });

      rerender(<ImagePreview src="https://example.com/test.png" alt="Test" height={100} />);

      const img2 = screen.getByRole("img");
      expect(img2).toHaveStyle({ height: "100px" });
    });

    it("should re-render when maxHeight changes", () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/test.png" alt="Test" maxHeight={50} />,
      );

      const img1 = screen.getByRole("img");
      expect(img1).toHaveStyle({ maxHeight: "50px" });

      rerender(<ImagePreview src="https://example.com/test.png" alt="Test" maxHeight={100} />);

      const img2 = screen.getByRole("img");
      expect(img2).toHaveStyle({ maxHeight: "100px" });
    });

    it("should re-render when objectFit changes", () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/test.png" alt="Test" objectFit="cover" />,
      );

      const img1 = screen.getByRole("img");
      expect(img1).toHaveStyle({ objectFit: "cover" });

      rerender(<ImagePreview src="https://example.com/test.png" alt="Test" objectFit="contain" />);

      const img2 = screen.getByRole("img");
      expect(img2).toHaveStyle({ objectFit: "contain" });
    });

    it("should re-render when alignSelf changes", () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/test.png" alt="Test" alignSelf="flex-start" />,
      );

      const img1 = screen.getByRole("img");
      expect(img1).toHaveStyle({ alignSelf: "flex-start" });

      rerender(<ImagePreview src="https://example.com/test.png" alt="Test" alignSelf="center" />);

      const img2 = screen.getByRole("img");
      expect(img2).toHaveStyle({ alignSelf: "center" });
    });

    it("should re-render when showBorder changes", () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/test.png" alt="Test" showBorder={true} />,
      );

      const img1 = screen.getByRole("img");
      expect(img1).toHaveStyle({ border: "1px solid var(--jrpg-border-gold)" });

      rerender(<ImagePreview src="https://example.com/test.png" alt="Test" showBorder={false} />);

      const img2 = screen.getByRole("img");
      expect(img2.style.border).toBe("");
    });

    it("should re-render when onLoadError changes", () => {
      const mockOnLoadError1 = vi.fn();
      const mockOnLoadError2 = vi.fn();

      const { rerender, container } = render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Test"
          onLoadError={mockOnLoadError1}
        />,
      );

      // Re-render with new callback (different reference means re-render happens)
      rerender(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Test"
          onLoadError={mockOnLoadError2}
        />,
      );

      // Verify that the new callback is used
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      fireEvent.error(img!);

      expect(mockOnLoadError1).not.toHaveBeenCalled();
      expect(mockOnLoadError2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Component Metadata - displayName", () => {
    it("should have displayName set to ImagePreview", () => {
      expect(ImagePreview.displayName).toBe("ImagePreview");
    });
  });

  describe("Combined Props - Realistic Usage Patterns", () => {
    it("should render token variant with all expected props", () => {
      render(
        <ImagePreview
          src="https://example.com/token.png"
          alt="Token preview"
          width={48}
          height={48}
          showBorder={true}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://example.com/token.png");
      expect(img).toHaveAttribute("alt", "Token preview");
      expect(img).toHaveStyle({
        width: "48px",
        height: "48px",
        border: "1px solid var(--jrpg-border-gold)",
      });
    });

    it("should render portrait variant with all expected props", () => {
      render(
        <ImagePreview
          src="https://example.com/portrait.png"
          alt="Portrait preview"
          width="100%"
          maxHeight="100px"
          showBorder={false}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://example.com/portrait.png");
      expect(img).toHaveAttribute("alt", "Portrait preview");
      expect(img).toHaveStyle({
        width: "100%",
        maxHeight: "100px",
      });
      expect(img.style.border).toBe("");
    });

    it("should render prop variant with all expected props", () => {
      render(<ImagePreview src="https://example.com/prop.png" alt="Prop preview" />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://example.com/prop.png");
      expect(img).toHaveAttribute("alt", "Prop preview");
      expect(img).toHaveStyle({
        width: "48px",
        height: "48px",
        border: "1px solid var(--jrpg-border-gold)",
        borderRadius: "4px",
        objectFit: "cover",
        alignSelf: "flex-start",
      });
    });

    it("should handle all custom props together", () => {
      const mockOnLoadError = vi.fn();

      render(
        <ImagePreview
          src="https://example.com/custom.png"
          alt="Custom preview"
          width={200}
          height={150}
          maxHeight={180}
          objectFit="contain"
          alignSelf="center"
          showBorder={false}
          onLoadError={mockOnLoadError}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({
        width: "200px",
        height: "150px",
        maxHeight: "180px",
        objectFit: "contain",
        alignSelf: "center",
        borderRadius: "4px",
      });
      expect(img.style.border).toBe("");

      fireEvent.error(img);
      expect(mockOnLoadError).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases - Size Normalization", () => {
    it("should handle zero width", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Zero width" width={0} />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "0px" });
    });

    it("should handle zero height", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Zero height" height={0} />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "0px" });
    });

    it("should handle very large number width", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Large width" width={9999} />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "9999px" });
    });

    it("should handle very large number height", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Large height" height={9999} />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "9999px" });
    });

    it("should handle negative number width", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Negative width" width={-50} />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "-50px" });
    });

    it("should handle negative number height", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Negative height" height={-50} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "-50px" });
    });

    it("should handle decimal number width", () => {
      render(<ImagePreview src="https://example.com/test.png" alt="Decimal width" width={48.5} />);

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "48.5px" });
    });

    it("should handle decimal number height", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Decimal height" height={48.7} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "48.7px" });
    });

    it("should handle width with calc expression", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Calc width"
          width="calc(100% - 20px)"
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ width: "calc(100% - 20px)" });
    });

    it("should handle height with vw units", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Viewport width" height="10vw" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ height: "10vw" });
    });

    it("should handle maxHeight with vh units", () => {
      render(
        <ImagePreview src="https://example.com/test.png" alt="Viewport height" maxHeight="20vh" />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ maxHeight: "20vh" });
    });
  });

  describe("Edge Cases - Alt Text", () => {
    it("should handle very long alt text", () => {
      const longAlt = "A".repeat(1000);
      render(<ImagePreview src="https://example.com/test.png" alt={longAlt} />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", longAlt);
    });

    it("should handle alt text with special characters", () => {
      const specialAlt = "Test & <script>alert('xss')</script> \"quotes\"";
      render(<ImagePreview src="https://example.com/test.png" alt={specialAlt} />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", specialAlt);
    });

    it("should handle alt text with unicode characters", () => {
      const unicodeAlt = "测试 🎮 тест";
      render(<ImagePreview src="https://example.com/test.png" alt={unicodeAlt} />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", unicodeAlt);
    });

    it("should handle alt text with newlines", () => {
      const multilineAlt = "Line 1\nLine 2\nLine 3";
      render(<ImagePreview src="https://example.com/test.png" alt={multilineAlt} />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", multilineAlt);
    });
  });

  describe("Edge Cases - Src URLs", () => {
    it("should handle very long URL", () => {
      const longUrl = "https://example.com/" + "a".repeat(1000) + ".png";
      render(<ImagePreview src={longUrl} alt="Long URL" />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", longUrl);
    });

    it("should handle URL with query parameters", () => {
      const urlWithParams = "https://example.com/image.png?w=100&h=100&fit=crop";
      render(<ImagePreview src={urlWithParams} alt="URL with params" />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", urlWithParams);
    });

    it("should handle URL with hash fragment", () => {
      const urlWithHash = "https://example.com/image.png#section";
      render(<ImagePreview src={urlWithHash} alt="URL with hash" />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", urlWithHash);
    });

    it("should handle URL with special characters encoded", () => {
      const encodedUrl = "https://example.com/image%20with%20spaces.png";
      render(<ImagePreview src={encodedUrl} alt="Encoded URL" />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", encodedUrl);
    });

    it("should handle blob URL", () => {
      const blobUrl = "blob:https://example.com/550e8400-e29b-41d4-a716-446655440000";
      render(<ImagePreview src={blobUrl} alt="Blob URL" />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", blobUrl);
    });

    it("should handle file protocol URL", () => {
      const fileUrl = "file:///path/to/image.png";
      render(<ImagePreview src={fileUrl} alt="File URL" />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", fileUrl);
    });
  });

  describe("Edge Cases - Error Callback Behavior", () => {
    it("should handle onLoadError that is async", async () => {
      const mockOnLoadError = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      render(
        <ImagePreview
          src="https://example.com/broken.png"
          alt="Async callback"
          onLoadError={mockOnLoadError}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(mockOnLoadError).toHaveBeenCalledTimes(1);
    });

    it("should handle changing onLoadError callback mid-render", () => {
      const mockOnLoadError1 = vi.fn();
      const mockOnLoadError2 = vi.fn();

      const { rerender } = render(
        <ImagePreview
          src="https://example.com/broken.png"
          alt="Changing callback"
          onLoadError={mockOnLoadError1}
        />,
      );

      rerender(
        <ImagePreview
          src="https://example.com/broken.png"
          alt="Changing callback"
          onLoadError={mockOnLoadError2}
        />,
      );

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(mockOnLoadError1).not.toHaveBeenCalled();
      expect(mockOnLoadError2).toHaveBeenCalledTimes(1);
    });

    it("should handle removing onLoadError callback", () => {
      const mockOnLoadError = vi.fn();

      const { rerender } = render(
        <ImagePreview
          src="https://example.com/broken.png"
          alt="Removing callback"
          onLoadError={mockOnLoadError}
        />,
      );

      rerender(<ImagePreview src="https://example.com/broken.png" alt="Removing callback" />);

      const img = screen.getByRole("img");
      fireEvent.error(img);

      expect(mockOnLoadError).not.toHaveBeenCalled();
    });
  });

  describe("Integration - Multiple Instances", () => {
    it("should render multiple ImagePreview components independently", () => {
      render(
        <>
          <ImagePreview src="https://example.com/image1.png" alt="Image 1" width={48} />
          <ImagePreview src="https://example.com/image2.png" alt="Image 2" width={100} />
          <ImagePreview src="https://example.com/image3.png" alt="Image 3" width={200} />
        </>,
      );

      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(3);
      expect(images[0]).toHaveStyle({ width: "48px" });
      expect(images[1]).toHaveStyle({ width: "100px" });
      expect(images[2]).toHaveStyle({ width: "200px" });
    });

    it("should handle errors independently across multiple instances", () => {
      const mockOnLoadError1 = vi.fn();
      const mockOnLoadError2 = vi.fn();

      render(
        <>
          <ImagePreview
            src="https://example.com/broken1.png"
            alt="Broken 1"
            onLoadError={mockOnLoadError1}
          />
          <ImagePreview src="https://example.com/working.png" alt="Working" />
          <ImagePreview
            src="https://example.com/broken2.png"
            alt="Broken 2"
            onLoadError={mockOnLoadError2}
          />
        </>,
      );

      const images = screen.getAllByRole("img");
      fireEvent.error(images[0]);
      fireEvent.error(images[2]);

      expect(images[0]).toHaveStyle({ display: "none" });
      expect(images[1]).not.toHaveStyle({ display: "none" });
      expect(images[2]).toHaveStyle({ display: "none" });
      expect(mockOnLoadError1).toHaveBeenCalledTimes(1);
      expect(mockOnLoadError2).toHaveBeenCalledTimes(1);
    });

    it("should handle mixed valid and null src values", () => {
      render(
        <>
          <ImagePreview src={null} alt="Null" />
          <ImagePreview src="https://example.com/valid.png" alt="Valid" />
          <ImagePreview src="" alt="Empty" />
        </>,
      );

      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute("alt", "Valid");
    });
  });

  describe("Style Properties - Complete Coverage", () => {
    it("should apply all style properties together", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="All styles"
          width="100px"
          height="80px"
          maxHeight="90px"
          objectFit="contain"
          alignSelf="center"
          showBorder={true}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({
        width: "100px",
        height: "80px",
        maxHeight: "90px",
        objectFit: "contain",
        borderRadius: "4px",
        border: "1px solid var(--jrpg-border-gold)",
        alignSelf: "center",
      });
    });

    it("should handle style properties with mixed types", () => {
      render(
        <ImagePreview
          src="https://example.com/test.png"
          alt="Mixed types"
          width={100}
          height="80px"
          maxHeight={90}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({
        width: "100px",
        height: "80px",
        maxHeight: "90px",
      });
    });

    it("should preserve borderRadius with all border configurations", () => {
      const { rerender } = render(
        <ImagePreview src="https://example.com/test.png" alt="Border radius" showBorder={true} />,
      );

      const img = screen.getByRole("img");
      expect(img).toHaveStyle({ borderRadius: "4px" });

      rerender(
        <ImagePreview src="https://example.com/test.png" alt="Border radius" showBorder={false} />,
      );

      expect(img).toHaveStyle({ borderRadius: "4px" });
    });
  });
});
