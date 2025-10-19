// ============================================================================
// XSS PROTECTION - SANITIZATION UTILITIES
// ============================================================================
// DOMPurify-based sanitization for user-generated content
// Use these helpers whenever displaying untrusted data (player names, messages, etc.)

import DOMPurify from "dompurify";

/**
 * Sanitize HTML to prevent XSS attacks
 * Use this for any user-generated HTML content
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // Strip all HTML tags by default
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content
  });
}

/**
 * Sanitize player names and other text fields
 * Removes all HTML tags and dangerous attributes
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }
  return sanitizeHtml(text);
}

/**
 * Sanitize URLs to prevent javascript: protocol attacks
 * Returns empty string if URL is invalid or dangerous
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();

  // Block javascript:, data:, vbscript: protocols
  const dangerousProtocols = /^(javascript|data|vbscript):/i;
  if (dangerousProtocols.test(trimmed)) {
    console.warn("[Sanitize] Blocked dangerous URL protocol:", trimmed);
    return "";
  }

  // Allow http:, https:, and relative URLs
  const safeProtocols = /^(https?:\/\/|\/|\.\/)/i;
  if (!safeProtocols.test(trimmed)) {
    console.warn("[Sanitize] Blocked non-standard URL:", trimmed);
    return "";
  }

  return trimmed;
}

/**
 * Sanitize Base64 data URIs (for images)
 * Validates that it's a legitimate image data URI
 */
export function sanitizeImageDataUri(dataUri: string): string {
  if (!dataUri || typeof dataUri !== "string") {
    return "";
  }

  // Only allow image data URIs
  const imageDataUriPattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;
  if (!imageDataUriPattern.test(dataUri)) {
    console.warn("[Sanitize] Invalid image data URI format");
    return "";
  }

  return dataUri;
}
