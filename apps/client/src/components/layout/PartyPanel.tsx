// ============================================================================
// PARTY PANEL COMPONENT
// ============================================================================
// Bottom fixed panel displaying player cards
// Extracted from App.tsx to follow single responsibility principle

import React, { useState } from "react";
import type { Player, Token } from "@shared";
import { PlayerCard } from "../../features/players/components";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";

interface PartyPanelProps {
  players: Player[];
  tokens: Token[];
  uid: string;
  micEnabled: boolean;
  editingPlayerUID: string | null;
  nameInput: string;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  onNameInputChange: (value: string) => void;
  onNameEdit: (uid: string, currentName: string) => void;
  onNameSubmit: () => void;
  onPortraitLoad: () => void;
  onToggleMic: () => void;
  onHpChange: (hp: number, maxHp: number) => void;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  onMaxHpSubmit: () => void;
  currentIsDM: boolean;
  onToggleDMMode: (next: boolean) => void;
  onTokenImageChange: (tokenId: string, imageUrl: string) => void;
  bottomPanelRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Party panel displaying all player cards
 */
export const PartyPanel: React.FC<PartyPanelProps> = ({
  players,
  tokens,
  uid,
  micEnabled,
  editingPlayerUID,
  nameInput,
  editingMaxHpUID,
  maxHpInput,
  onNameInputChange,
  onNameEdit,
  onNameSubmit,
  onPortraitLoad,
  onToggleMic,
  onHpChange,
  onMaxHpInputChange,
  onMaxHpEdit,
  onMaxHpSubmit,
  currentIsDM,
  onToggleDMMode,
  onTokenImageChange,
  bottomPanelRef,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      ref={bottomPanelRef}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        margin: 0,
        transition: "transform 0.3s ease",
      }}
    >
      {/* Toggle button */}
      <JRPGButton
        onClick={() => setIsCollapsed(!isCollapsed)}
        variant={isCollapsed ? "default" : "primary"}
        style={{
          position: "absolute",
          top: "-28px",
          right: "12px",
          padding: "6px 12px",
          fontSize: "8px",
          borderRadius: "4px 4px 0 0",
        }}
      >
        {isCollapsed ? "▲ SHOW PARTY" : "▼ HIDE PARTY"}
      </JRPGButton>

      <JRPGPanel variant="bevel" style={{ padding: "8px", borderRadius: 0 }}>
        {!isCollapsed && (
          <>
            <h3
              className="jrpg-text-command jrpg-text-highlight"
              style={{ margin: "0 0 8px 0", textAlign: "center" }}
            >
              PARTY
            </h3>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {players.map((p: Player) => {
                const isMe = p.uid === uid;
                const token = tokens.find((t: Token) => t.owner === p.uid);

                return (
                  <JRPGPanel
                    key={p.uid}
                    variant="simple"
                    style={{ padding: "8px", minWidth: "120px" }}
                  >
                    <PlayerCard
                      player={p}
                      isMe={isMe}
                      tokenColor={token?.color}
                      micEnabled={micEnabled}
                      editingPlayerUID={editingPlayerUID}
                      nameInput={nameInput}
                      onNameInputChange={onNameInputChange}
                      onNameEdit={onNameEdit}
                      onNameSubmit={onNameSubmit}
                      onPortraitLoad={onPortraitLoad}
                      onToggleMic={onToggleMic}
                      onHpChange={(hp) => onHpChange(hp, p.maxHp ?? 100)}
                      editingMaxHpUID={editingMaxHpUID}
                      maxHpInput={maxHpInput}
                      onMaxHpInputChange={onMaxHpInputChange}
                      onMaxHpEdit={onMaxHpEdit}
                      onMaxHpSubmit={onMaxHpSubmit}
                      tokenImageUrl={token?.imageUrl}
                      onTokenImageSubmit={
                        isMe && token ? (url) => onTokenImageChange(token.id, url) : undefined
                      }
                    />
                    {isMe && (
                      <JRPGButton
                        onClick={() => onToggleDMMode(!currentIsDM)}
                        variant={currentIsDM ? "primary" : "default"}
                        style={{ fontSize: "8px", padding: "4px 8px", marginTop: "8px" }}
                      >
                        {currentIsDM ? "DM MODE: ON" : "DM MODE: OFF"}
                      </JRPGButton>
                    )}
                  </JRPGPanel>
                );
              })}
            </div>
          </>
        )}

        {isCollapsed && (
          <div
            className="jrpg-text-small"
            style={{
              padding: "8px",
              textAlign: "center",
              color: "var(--jrpg-white)",
              opacity: 0.6,
            }}
          >
            Party collapsed - click &quot;SHOW PARTY&quot; to expand
          </div>
        )}
      </JRPGPanel>
    </div>
  );
};
