// ============================================================================
// UUID UTILITY
// ============================================================================
// Centralized UUID generation to eliminate code duplication

/**
 * Generates a UUID v4 string
 * Uses crypto.randomUUID() if available, otherwise falls back to Math.random()
 */
export function generateUUID(): string {
  // Modern browsers support crypto.randomUUID()
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (
    cryptoObj &&
    typeof (cryptoObj as Partial<Crypto & { randomUUID: () => string }>).randomUUID === "function"
  ) {
    return (cryptoObj as Crypto & { randomUUID: () => string }).randomUUID();
  }

  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
