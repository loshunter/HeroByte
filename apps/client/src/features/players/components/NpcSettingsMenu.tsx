// ============================================================================
// NPC SETTINGS MENU
// ============================================================================
// The DM's window for one NPC, in the player window's two halves (U7):
// **Character** — art, conditions, initiative, deletion — and **Token
// settings** — placing, sizing and locking its token on the map.

import { createPortal } from "react-dom";
import { useEffect, useId, useState } from "react";

import type { TokenSize } from "@herobyte/shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { ImageField } from "../../../components/ui/ImageField";
import { StatusEffectsPicker } from "./StatusEffectsPicker";
import { useStatusEffectsPicker } from "./useStatusEffectsPicker";
import "./characterSettings.css";
import { lockGuard } from "../../locking/lockNotice";

const NPC_LOCKED = "Locked: unlock its token first (🔒 Locked, below).";

const NO_EFFECTS: string[] = [];
const IGNORE_EFFECTS = () => {};

interface NpcSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  tokenImageInput: string;
  tokenImageUrl?: string;
  onTokenImageInputChange: (value: string) => void;
  onTokenImageApply: (value: string) => void;
  onTokenImageClear: () => void;
  /*
   * Portrait, mirroring PlayerSettingsMenu. Optional as a trio so a caller
   * that has no portrait to offer renders no half-wired control.
   */
  portraitImageInput?: string;
  onPortraitInputChange?: (value: string) => void;
  onPortraitApply?: (value: string) => void;
  onPlaceToken?: () => void;
  onDelete?: () => void;
  tokenLocked?: boolean;
  onToggleTokenLock?: (locked: boolean) => void;
  tokenSize?: TokenSize;
  onTokenSizeChange?: (size: TokenSize) => void;
  /*
   * NO SIGHT RADIUS HERE, deliberately. Fog is computed per RECIPIENT from the
   * tokens that recipient OWNS, and an NPC token is always owned by the DM who
   * placed it (`place-npc-token` is DM-gated, and createToken stamps the
   * sender). No player's fog ever reads one, and the DM's player lens uses the
   * tokens the DM does NOT own — so a radius on an NPC token is inert.
   * A control that silently does nothing is worse than one that isn't there.
   */
  /** Whether NPC deletion is in progress */
  isDeleting?: boolean;
  /** Error message from deletion attempt */
  deletionError?: string | null;
  onClearInitiative?: () => void;
  hasInitiative?: boolean;
  /*
   * The NPC's conditions (U7). The server has always let a DM set any
   * character's, and the map draws an NPC's — but no NPC editor offered them.
   * Optional as a pair: without the handler there is no picker.
   */
  selectedEffects?: string[];
  onStatusEffectsChange?: (effects: string[]) => void;
}

export function NpcSettingsMenu({
  isOpen,
  onClose,
  tokenImageInput,
  tokenImageUrl,
  onTokenImageInputChange,
  onTokenImageApply,
  onTokenImageClear,
  portraitImageInput,
  onPortraitInputChange,
  onPortraitApply,
  onPlaceToken,
  onDelete,
  tokenLocked,
  onToggleTokenLock,
  tokenSize = "medium",
  onTokenSizeChange,
  isDeleting = false,
  deletionError = null,
  onClearInitiative,
  hasInitiative = false,
  selectedEffects,
  onStatusEffectsChange,
}: NpcSettingsMenuProps): JSX.Element | null {
  const [wasDeleting, setWasDeleting] = useState(false);
  // In the mounted parent, even while closed (the player window's rule).
  const statusEffectsPicker = useStatusEffectsPicker(
    selectedEffects ?? NO_EFFECTS,
    onStatusEffectsChange ?? IGNORE_EFFECTS,
  );
  const characterHeadingId = useId();
  const tokenHeadingId = useId();

  // Auto-close when deletion completes successfully
  useEffect(() => {
    if (wasDeleting && !isDeleting && !deletionError) {
      // Deletion finished successfully
      console.log("[NpcSettingsMenu] Deletion completed, closing menu");
      onClose();
    }
    setWasDeleting(isDeleting);
  }, [isDeleting, wasDeleting, deletionError, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <DraggableWindow
      interaction={{ behavior: "block" }}
      title="NPC Settings"
      onClose={onClose}
      initialX={350}
      initialY={150}
      width={280}
      minWidth={280}
      maxWidth={350}
      storageKey="npc-settings-menu"
      zIndex={1001}
    >
      <div
        style={{
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <section className="character-settings__section" aria-labelledby={characterHeadingId}>
          <h3 id={characterHeadingId} className="character-settings__heading">
            Character
          </h3>
          {/* Portrait: upload from disk/camera roll, or paste a URL. Until now
            the only way to set an NPC portrait anywhere was a window.prompt
            on the card, so NPCs alone had no upload path. */}
          {onPortraitInputChange && onPortraitApply && portraitImageInput !== undefined && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <ImageField
                label="Portrait Image URL"
                value={portraitImageInput}
                onChange={onPortraitInputChange}
                onCommit={(url) => {
                  // Empty means "typed nothing" — portraits have never had a
                  // Clear, and an empty commit must not wipe the existing one.
                  if (url) onPortraitApply(url);
                }}
                placeholder="https://example.com/portrait.png"
                applyLabel="Apply Portrait"
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <ImageField
              label="Token Image URL"
              value={tokenImageInput}
              onChange={onTokenImageInputChange}
              onCommit={onTokenImageApply}
              onClear={onTokenImageClear}
              placeholder="https://enemy-token.png"
            />
            {tokenImageUrl ? (
              <img
                src={tokenImageUrl}
                alt="Token preview"
                style={{
                  width: "56px",
                  height: "56px",
                  margin: "6px auto 0",
                  objectFit: "cover",
                  borderRadius: "6px",
                  border: "1px solid var(--jrpg-border-gold)",
                }}
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
          </div>

          {onStatusEffectsChange && <StatusEffectsPicker {...statusEffectsPicker} />}
          {onClearInitiative && (
            <>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}
              >
                <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                  Initiative
                </span>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "0.65rem" }}
                  onClick={onClearInitiative}
                  disabled={!hasInitiative}
                >
                  🧹 Clear Initiative
                </button>
              </div>
            </>
          )}

          {deletionError && (
            <div
              className="jrpg-text-small"
              style={{
                color: "var(--jrpg-red)",
                padding: "4px",
                textAlign: "center",
                border: "1px solid var(--jrpg-red)",
                borderRadius: "4px",
                background: "rgba(214, 60, 83, 0.1)",
              }}
            >
              {deletionError}
            </div>
          )}

          {onDelete && (
            <button
              className="btn btn-danger"
              style={{ fontSize: "0.65rem" }}
              onClick={onDelete}
              disabled={isDeleting}
              // Its token is locked: nothing deletes the NPC until it is unlocked.
              {...lockGuard(tokenLocked === true, NPC_LOCKED, { fontSize: "0.65rem" })}
            >
              {isDeleting ? "Deleting..." : "Delete NPC"}
            </button>
          )}
        </section>

        <section className="character-settings__section" aria-labelledby={tokenHeadingId}>
          <h3 id={tokenHeadingId} className="character-settings__heading">
            Token settings
          </h3>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "0.65rem" }}
            onClick={onPlaceToken}
            // Placing again replaces (deletes) its token: off while that token is locked.
            {...lockGuard(tokenLocked === true, NPC_LOCKED, { fontSize: "0.65rem" })}
          >
            Place Token
          </button>

          {onTokenSizeChange && (
            <>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}
              >
                <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
                  Token Size
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                  {(["tiny", "small", "medium", "large", "huge", "gargantuan"] as TokenSize[]).map(
                    (size) => {
                      const sizeLabels: Record<TokenSize, string> = {
                        tiny: "Tiny",
                        small: "Small",
                        medium: "Med",
                        large: "Large",
                        huge: "Huge",
                        gargantuan: "Garg",
                      };
                      return (
                        <button
                          key={size}
                          className={tokenSize === size ? "btn btn-primary" : "btn btn-secondary"}
                          style={{ fontSize: "0.6rem", padding: "4px 2px" }}
                          onClick={() => onTokenSizeChange(size)}
                          disabled={tokenLocked === true}
                          title={
                            tokenLocked ? NPC_LOCKED : size.charAt(0).toUpperCase() + size.slice(1)
                          }
                        >
                          {sizeLabels[size]}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </>
          )}

          {onToggleTokenLock && (
            <button
              className={tokenLocked ? "btn btn-primary" : "btn btn-secondary"}
              style={{ fontSize: "0.65rem" }}
              onClick={() => onToggleTokenLock(!tokenLocked)}
              title={tokenLocked ? "Token is locked (DM can unlock)" : "Token is unlocked"}
            >
              {tokenLocked ? "🔒 Locked" : "🔓 Unlocked"}
            </button>
          )}
        </section>
      </div>
    </DraggableWindow>,
    document.body,
  );
}
