/**
 * StatusBanner component
 * Displays status and error messages with consistent styling
 *
 * Extracted from NPCEditor.tsx (lines 116-173)
 * Part of Phase 15 SOLID Refactor Initiative
 */

export type StatusBannerVariant = "error" | "loading";

export interface StatusBannerProps {
  variant: StatusBannerVariant;
  message: string;
  visible?: boolean;
}

/**
 * Displays a status or error message banner with variant-specific styling
 *
 * @param variant - The type of message: "error" (red) or "loading" (gold)
 * @param message - The message text to display
 * @param visible - Whether to render the banner (default: true)
 */
export function StatusBanner({ variant, message, visible = true }: StatusBannerProps) {
  if (!visible) {
    return null;
  }

  const styles = getVariantStyles(variant);

  return <div style={styles}>{message}</div>;
}

function getVariantStyles(variant: StatusBannerVariant): React.CSSProperties {
  switch (variant) {
    case "error":
      return {
        padding: "8px",
        background: "rgba(255, 0, 0, 0.1)",
        border: "1px solid rgba(255, 0, 0, 0.3)",
        borderRadius: "4px",
        color: "#ff4444",
        fontSize: "12px",
      };
    case "loading":
      return {
        padding: "6px",
        background: "rgba(218, 165, 32, 0.1)",
        border: "1px solid var(--jrpg-border-gold)",
        borderRadius: "4px",
        color: "var(--jrpg-gold)",
        fontSize: "11px",
        textAlign: "center",
      };
  }
}
