// ============================================================================
// IMAGE URL HELPERS
// ============================================================================
// Utilities for normalizing and converting image URLs from various hosting
// services to direct image URLs that can be embedded in the application.

/**
 * Convert an Imgur URL to a direct image URL.
 *
 * Handles:
 * - Album links: https://imgur.com/a/abc123 → fetches first image
 * - Gallery links: https://imgur.com/gallery/abc123 → fetches first image
 * - Single image: https://imgur.com/abc123 → https://i.imgur.com/abc123.jpg
 * - Already direct: https://i.imgur.com/abc123.jpg → returns as-is
 *
 * @param url - The Imgur URL to convert
 * @returns Promise resolving to direct image URL, or null if conversion fails
 */
export async function convertImgurUrl(url: string): Promise<string | null> {
  try {
    const trimmed = url.trim();

    // Already a direct image URL - return as-is
    if (trimmed.includes("i.imgur.com/")) {
      return trimmed;
    }

    // Parse the URL
    const urlObj = new URL(trimmed);

    // Not an Imgur URL - return null to indicate no conversion needed
    if (!urlObj.hostname.includes("imgur.com")) {
      return null;
    }

    // Extract the ID from various Imgur URL formats
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    // Album or gallery URL: /a/abc123 or /gallery/abc123
    if (pathParts[0] === "a" || pathParts[0] === "gallery") {
      const albumId = pathParts[1];
      if (!albumId) {
        console.warn("[imageUrlHelpers] Could not extract album ID from URL:", url);
        return null;
      }

      // Fetch album data to get the first image
      try {
        const response = await fetch(`https://api.imgur.com/3/album/${albumId}`, {
          headers: {
            Authorization: "Client-ID 546c25a59c58ad7", // Public client ID for anonymous access
          },
        });

        if (!response.ok) {
          console.warn("[imageUrlHelpers] Failed to fetch Imgur album data:", response.status);
          return null;
        }

        const data = await response.json();
        const firstImage = data?.data?.images?.[0];

        if (!firstImage?.link) {
          console.warn("[imageUrlHelpers] No images found in Imgur album");
          return null;
        }

        console.log("[imageUrlHelpers] Converted Imgur album to direct URL:", firstImage.link);
        return firstImage.link;
      } catch (error) {
        console.error("[imageUrlHelpers] Error fetching Imgur album:", error);
        return null;
      }
    }

    // Single image URL: /abc123
    const imageId = pathParts[0];
    if (!imageId) {
      console.warn("[imageUrlHelpers] Could not extract image ID from URL:", url);
      return null;
    }

    // First, try to fetch image metadata from API
    try {
      const response = await fetch(`https://api.imgur.com/3/image/${imageId}`, {
        headers: {
          Authorization: "Client-ID 546c25a59c58ad7", // Public client ID
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.data?.link) {
          console.log("[imageUrlHelpers] Converted Imgur image to direct URL:", data.data.link);
          return data.data.link;
        }
      }
    } catch (error) {
      console.warn("[imageUrlHelpers] Could not fetch image metadata, trying extensions:", error);
    }

    // Fallback: try .jpg as most common format
    const directUrl = `https://i.imgur.com/${imageId}.jpg`;
    console.log("[imageUrlHelpers] Using fallback direct URL:", directUrl);
    return directUrl;
  } catch (error) {
    console.error("[imageUrlHelpers] Error converting Imgur URL:", error);
    return null;
  }
}

/**
 * Normalize an image URL from any hosting service to a direct image URL.
 *
 * Currently supports:
 * - Imgur (albums, galleries, single images)
 * - Direct URLs from other hosts (Discord, self-hosted, etc.) - returned as-is
 *
 * @param url - The image URL to normalize
 * @returns Promise resolving to direct image URL, or original URL if no conversion needed
 */
export async function normalizeImageUrl(url: string): Promise<string> {
  const trimmed = url.trim();

  if (!trimmed) {
    return trimmed;
  }

  // Try Imgur conversion
  if (trimmed.includes("imgur.com")) {
    const converted = await convertImgurUrl(trimmed);
    if (converted) {
      return converted;
    }
  }

  // Return original URL for other hosts (Discord, self-hosted, etc.)
  return trimmed;
}
