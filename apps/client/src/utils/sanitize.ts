// ============================================================================
// XSS PROTECTION - SANITIZATION UTILITIES
// ============================================================================
// DOMPurify-based sanitization for user-generated content
// Use these helpers whenever displaying untrusted data (player names, messages, etc.)
// (sanitizeUrl and sanitizeImageDataUri were removed 2026-10-11: nothing called them,
// though ROOM_AUTH_FLOW.md listed them as protections in force.)

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
