// ============================================================================
// TOKEN SETTINGS SECTION
// ============================================================================
// The settings window's second half (U7): how the character's TOKEN behaves on
// the map — its size, sight, movement, lock and removal — kept apart from the
// Character half (name, art, conditions), which describes the character itself.
// Every control renders only where the caller hands it a handler: those
// handlers are the permission gates (a player sizes their own token; sight,
// movement, lock and removal are the DM's), exactly as before the split.

import type { TokenSize } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { VisionRadiusField } from "./VisionRadiusField";
import { MovementSpeedField, type MovementBudgetControl } from "./MovementSpeedField";
import { lockGuard } from "../../locking/lockNotice";

const TOKEN_SIZES: TokenSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const SIZE_LABELS: Record<TokenSize, string> = {
  tiny: "Tiny",
  small: "Small",
  medium: "Med",
  large: "Large",
  huge: "Huge",
  gargantuan: "Garg",
};

/**
 * Who owns this character and its token — the DM's to change (U7's
 * “ownership where allowed”): the seats at the table, and the send.
 */
export interface OwnerControl {
  uid: string;
  options: { uid: string; name: string }[];
  onChange: (ownerUid: string) => void;
}

export interface TokenSettingsProps {
  /** DM-only: move this character and its token to another seat. */
  owner?: OwnerControl;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  /** Sight limit in feet; undefined is unlimited. DM-only (S7). */
  tokenVisionRadius?: number;
  /** The table's default sight radius, so an inheriting token can say what it inherits. */
  tableVisionDefault?: number;
  onTokenVisionRadiusChange?: (radiusFeet: number | null) => void;
  /** Feet per turn (movement budget); DM-only, like the sight radius. */
  characterSpeed?: number;
  onCharacterSpeedChange?: (speedFeet: number | null) => void;
  /** DM-only: the spend and its reset, shown only WITH the speed field. */
  characterBudget?: MovementBudgetControl;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  /** Present only for a DM viewer. */
  onDeleteToken?: () => void;
  /** Render the sight controls at the 44px touch floor (mobile rows). */
  compactControls?: boolean;
}

/** Whether any token control applies — the section is omitted otherwise. */
export function hasTokenSettings(props: TokenSettingsProps): boolean {
  return Boolean(
    props.owner ||
      props.onTokenSizeChange ||
      props.onTokenVisionRadiusChange ||
      props.onCharacterSpeedChange ||
      props.onToggleTokenLock ||
      props.onDeleteToken,
  );
}

const panelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "12px",
} as const;

export function TokenSettingsSection({
  owner,
  tokenSize = "medium",
  onTokenSizeChange,
  tokenVisionRadius,
  tableVisionDefault,
  onTokenVisionRadiusChange,
  characterSpeed,
  onCharacterSpeedChange,
  characterBudget,
  tokenLocked,
  onToggleTokenLock,
  onDeleteToken,
  compactControls = false,
}: TokenSettingsProps): JSX.Element {
  return (
    <>
      {owner && (
        <JRPGPanel variant="simple" style={panelStyle}>
          <label
            className="jrpg-text-small"
            style={{
              color: "var(--jrpg-gold)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            Owner
            <select
              value={owner.uid}
              onChange={(event) => owner.onChange(event.target.value)}
              style={{ minHeight: compactControls ? "44px" : undefined, fontSize: "12px" }}
            >
              {owner.options.map((option) => (
                <option key={option.uid} value={option.uid}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <span className="character-settings__note">
            Moves this character and its token to that player&rsquo;s seat.
          </span>
        </JRPGPanel>
      )}

      {/* Token Size - whoever the caller hands a handler to (a DM's own token included) */}
      {onTokenSizeChange && (
        <JRPGPanel variant="simple" style={panelStyle}>
          <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Token Size
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
            {TOKEN_SIZES.map((size) => (
              <JRPGButton
                key={size}
                onClick={() => onTokenSizeChange(size)}
                variant={tokenSize === size ? "primary" : "default"}
                style={{ fontSize: "10px", padding: "6px 4px" }}
                // A locked token is resized by no one until it is unlocked (Token Lock).
                disabled={tokenLocked === true}
                title={
                  tokenLocked
                    ? onToggleTokenLock
                      ? "Locked: unlock it first (Token Lock)."
                      : "Locked: only the DM can unlock it."
                    : size.charAt(0).toUpperCase() + size.slice(1)
                }
              >
                {SIZE_LABELS[size]}
              </JRPGButton>
            ))}
          </div>
        </JRPGPanel>
      )}

      {/* Sight Radius — supplied only for a DM viewer (EntitiesPanel), so
          unlike Token Size this is NOT gated on the card owner's role: a DM
          sets the darkness on every token, including their own. */}
      {onTokenVisionRadiusChange && (
        <JRPGPanel variant="simple" style={panelStyle}>
          <VisionRadiusField
            value={tokenVisionRadius}
            inheritsTableDefault
            tableDefault={tableVisionDefault}
            onChange={onTokenVisionRadiusChange}
            compact={compactControls}
          />
        </JRPGPanel>
      )}

      {/* Movement speed — DM-only by the same rule as the sight radius. */}
      {onCharacterSpeedChange && (
        <JRPGPanel variant="simple" style={{ display: "flex", padding: "12px" }}>
          <MovementSpeedField
            value={characterSpeed}
            onChange={onCharacterSpeedChange}
            budget={characterBudget}
            compact={compactControls}
          />
        </JRPGPanel>
      )}

      {/* Token Lock - likewise */}
      {onToggleTokenLock && (
        <JRPGPanel variant="simple" style={panelStyle}>
          <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
            Token Lock
          </span>
          <JRPGButton
            onClick={() => onToggleTokenLock(!tokenLocked)}
            variant={tokenLocked ? "primary" : "default"}
            style={{ fontSize: "10px" }}
            title={tokenLocked ? "Token is locked (DM only)" : "Token is unlocked"}
          >
            {tokenLocked ? "🔒 Locked" : "🔓 Unlocked"}
          </JRPGButton>
        </JRPGPanel>
      )}

      {/* Supplied only to a DM VIEWER (the caller's gate). It was once gated on
          the card OWNER's flag as well — an impossible combination, so the
          button never rendered at all. */}
      {onDeleteToken && (
        <JRPGPanel variant="simple" style={{ padding: "12px" }}>
          <JRPGButton
            onClick={() => {
              if (confirm("Delete this player's token? This cannot be undone.")) {
                onDeleteToken();
              }
            }}
            variant="danger"
            style={{ width: "100%", fontSize: "10px" }}
            // A locked token is deleted by no one until it is unlocked (Token Lock above);
            // a press says so rather than nothing.
            {...lockGuard(
              tokenLocked === true,
              "Locked: unlock it first (Token Lock), then delete it.",
              {
                width: "100%",
                fontSize: "10px",
              },
            )}
          >
            🗑️ Delete Token (DM)
          </JRPGButton>
        </JRPGPanel>
      )}
    </>
  );
}
