/**
 * ImagePreview Component
 *
 * A reusable UI primitive for displaying image previews with error handling.
 * Supports flexible sizing, object-fit modes, and optional borders.
 *
 * Extracted from: apps/client/src/features/dm/components/DMMenu.tsx
 * - PropEditor (lines 197-213): 48x48 preview with border
 * - NPCEditor portrait (lines 420-434): 100% width, 100px maxHeight, no border
 * - NPCEditor token (lines 455-471): 48x48 preview with border
 *
 * Extraction date: 2025-10-21
 *
 * @example
 * ```tsx
 * // Prop/Token preview (48x48 with border)
 * <ImagePreview
 *   src={imageUrl}
 *   alt="Prop preview"
 * />
 *
 * // Portrait preview (100% width, 100px max height, no border)
 * <ImagePreview
 *   src={portraitUrl}
 *   alt="Portrait preview"
 *   width="100%"
 *   maxHeight="100px"
 *   showBorder={false}
 * />
 * ```
 *
 * @module components/ui/ImagePreview
 */

import React from "react";

/**
 * Props for the ImagePreview component
 */
export interface ImagePreviewProps {
  /** Image source URL (null, empty, or whitespace-only values will render nothing) */
  src: string | null;
  /** Alternative text for accessibility */
  alt: string;
  /** Image width (default: "48px") */
  width?: string | number;
  /** Image height (default: "48px") */
  height?: string | number;
  /** Maximum height (optional, useful for portrait variant) */
  maxHeight?: string | number;
  /** CSS object-fit property (default: "cover") */
  objectFit?: "cover" | "contain";
  /** CSS align-self property (default: "flex-start") */
  alignSelf?: "flex-start" | "center";
  /** Whether to show the golden border (default: true) */
  showBorder?: boolean;
  /** Callback invoked when image fails to load */
  onLoadError?: () => void;
}

/**
 * ImagePreview renders an image with consistent styling and error handling.
 *
 * Features:
 * - Flexible sizing (width, height, maxHeight)
 * - Object-fit control (cover, contain)
 * - Optional border styling
 * - Error handling (hides on load error)
 * - Optional error callback
 *
 * @param props - Component props
 * @returns Image element or null if src is invalid
 */
export const ImagePreview = React.memo((props: ImagePreviewProps) => {
  const {
    src,
    alt,
    width = "48px",
    height = "48px",
    maxHeight,
    objectFit = "cover",
    alignSelf = "flex-start",
    showBorder = true,
    onLoadError,
  } = props;

  // Don't render if src is null, empty, or whitespace-only
  if (!src || src.trim() === "") {
    return null;
  }

  /**
   * Helper to normalize size values (string | number → string)
   * @param value - Size value to normalize
   * @returns Normalized size string or undefined
   */
  const normalizeSize = (value: string | number | undefined): string | undefined => {
    if (value === undefined) return undefined;
    return typeof value === "number" ? `${value}px` : value;
  };

  /**
   * Handle image load error by hiding the element and invoking callback
   * @param e - Synthetic event from img element
   */
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = "none";
    if (onLoadError) {
      onLoadError();
    }
  };

  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: normalizeSize(width),
        height: normalizeSize(height),
        maxHeight: normalizeSize(maxHeight),
        objectFit,
        borderRadius: "4px",
        border: showBorder ? "1px solid var(--jrpg-border-gold)" : undefined,
        alignSelf,
      }}
      onError={handleError}
    />
  );
});

ImagePreview.displayName = "ImagePreview";
