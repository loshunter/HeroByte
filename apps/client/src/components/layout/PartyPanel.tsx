// ============================================================================
// PARTY PANEL COMPONENT
// ============================================================================
// Bottom fixed panel displaying player cards
// Extracted from App.tsx to follow single responsibility principle

import React, { useState } from "react";
import type { Player, Token } from "@shared";
import { PlayerCard } from "../../features/players/components";

interface PartyPanelProps {
  players: Player[];
  tokens: Token[];
  uid: string;
  micEnabled: boolean;
  micLevel: number;
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
  micLevel,
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
  bottomPanelRef,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      ref={bottomPanelRef}
      className="panel"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        margin: 0,
        borderRadius: 0,
        transition: "transform 0.3s ease",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: "absolute",
          top: "-24px",
          right: "12px",
          padding: "4px 12px",
          background: "var(--hero-blue)",
          border: "2px solid var(--hero-gold)",
          color: "var(--hero-gold)",
          cursor: "pointer",
          fontSize: "0.75rem",
          fontWeight: "bold",
          borderRadius: "4px 4px 0 0",
        }}
      >
        {isCollapsed ? "▲ Show Party" : "▼ Hide Party"}
      </button>

      {!isCollapsed && (
        <>
          <h3 style={{ margin: "0 0 8px 0" }}>Party</h3>
          <div
            style={{
              display: "flex",
              gap: "16px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {players.map((p: Player) => {
              const isMe = p.uid === uid;
              const token = tokens.find((t: Token) => t.owner === p.uid);

              return (
                <PlayerCard
                  key={p.uid}
                  player={p}
                  isMe={isMe}
                  tokenColor={token?.color}
                  micEnabled={micEnabled}
                  micLevel={micLevel}
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
                />
              );
            })}
          </div>
        </>
      )}

      {isCollapsed && (
        <div style={{ padding: "8px", textAlign: "center", fontSize: "0.75rem", color: "var(--hero-text-dim)" }}>
          Party collapsed - click "Show Party" to expand
        </div>
      )}
    </div>
  );
};
