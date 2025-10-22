// ============================================================================
// USE IMAGE URL NORMALIZATION HOOK
// ============================================================================
// Custom hook for normalizing image URLs from various hosting services.
// Automatically converts Imgur album/gallery links to direct image URLs.

import { useState, useCallback } from "react";
import { normalizeImageUrl } from "../utils/imageUrlHelpers";

interface UseImageUrlNormalizationReturn {
  normalizeUrl: (url: string) => Promise<string>;
  isNormalizing: boolean;
  normalizationError: string | null;
  clearError: () => void;
}

/**
 * Hook to normalize image URLs from various hosting services.
 *
 * Automatically handles:
 * - Imgur album/gallery URLs → direct image URLs
 * - Other hosting services → returned as-is
 *
 * @returns Methods and state for URL normalization
 *
 * @example
 * const { normalizeUrl, isNormalizing } = useImageUrlNormalization();
 *
 * const handleApply = async () => {
 *   const directUrl = await normalizeUrl(userInput);
 *   onSetMapBackground(directUrl);
 * };
 */
export function useImageUrlNormalization(): UseImageUrlNormalizationReturn {
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [normalizationError, setNormalizationError] = useState<string | null>(null);

  const normalizeUrl = useCallback(async (url: string): Promise<string> => {
    const trimmed = url.trim();

    if (!trimmed) {
      return trimmed;
    }

    setIsNormalizing(true);
    setNormalizationError(null);

    try {
      const normalizedUrl = await normalizeImageUrl(trimmed);

      if (normalizedUrl !== trimmed) {
        console.log("[useImageUrlNormalization] Converted URL:", trimmed, "→", normalizedUrl);
      }

      return normalizedUrl;
    } catch (error) {
      console.error("[useImageUrlNormalization] Error normalizing URL:", error);
      setNormalizationError("Failed to process URL. Using original URL instead.");
      // Fallback to original URL on error
      return trimmed;
    } finally {
      setIsNormalizing(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setNormalizationError(null);
  }, []);

  return {
    normalizeUrl,
    isNormalizing,
    normalizationError,
    clearError,
  };
}
