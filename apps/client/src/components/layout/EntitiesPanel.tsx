// ============================================================================
// ENTITIES PANEL COMPONENT
// ============================================================================
// Fixed bottom panel displaying both players and NPCs in the scene.

import React, { useMemo, useState } from "react";
import type { Character, Drawing, Player, PlayerState, Token, SceneObject } from "@shared";
import { PlayerCard } from "../../features/players/components";
import { NpcCard } from "../../features/players/components/NpcCard";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";

import type { TokenSize } from "@shared";

interface EntitiesPanelProps {
  players: Player[];
  characters: Character[];
  tokens: Token[];
  sceneObjects: SceneObject[];
  drawings: Drawing[];
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
  onApplyPlayerState: (state: PlayerState, tokenId?: string) => void;
  onStatusEffectsChange: (effects: string[]) => void;
  onNpcUpdate: (
    id: string,
    updates: { name?: string; hp?: number; maxHp?: number; portrait?: string; tokenImage?: string },
  ) => void;
  onNpcDelete: (id: string) => void;
  onNpcPlaceToken: (id: string) => void;
  onPlayerTokenDelete: (tokenId: string) => void;
  onToggleTokenLock: (sceneObjectId: string, locked: boolean) => void;
  onTokenSizeChange: (tokenId: string, size: TokenSize) => void;
  bottomPanelRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Entities panel displaying all players and active NPCs.
 */
export const EntitiesPanel: React.FC<EntitiesPanelProps> = ({
  players,
  characters,
  tokens,
  onPlayerTokenDelete,
  sceneObjects,
  drawings,
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
  onApplyPlayerState,
  onStatusEffectsChange,
  onNpcUpdate,
  onNpcDelete,
  onNpcPlaceToken,
  onToggleTokenLock,
  onTokenSizeChange,
  bottomPanelRef,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const npcCharacters = useMemo(
    () => characters.filter((character) => character.type === "npc"),
    [characters],
  );

  const tokenSceneMap = useMemo(() => {
    const map = new Map<string, SceneObject & { type: "token" }>();
    for (const object of sceneObjects) {
      if (object.type === "token") {
        const tokenId = object.id.replace(/^token:/, "");
        map.set(tokenId, object as SceneObject & { type: "token" });
      }
    }
    return map;
  }, [sceneObjects]);

  const drawingsByOwner = useMemo(() => {
    const map = new Map<string, Drawing[]>();
    for (const drawing of drawings) {
      if (!drawing.owner) continue;
      if (!map.has(drawing.owner)) {
        map.set(drawing.owner, []);
      }
      map.get(drawing.owner)!.push(drawing);
    }
    return map;
  }, [drawings]);

  const entities = useMemo(() => {
    const playerEntities = players.map((player) => {
      const token = tokens.find((t: Token) => t.owner === player.uid);
      return {
        kind: "player" as const,
        id: player.uid,
        player,
        token,
        isMe: player.uid === uid,
      };
    });

    const npcEntities = npcCharacters.map((character) => ({
      kind: "npc" as const,
      id: character.id,
      character,
    }));

    // Separate DM from regular players
    // DM appears first (left-most) and is visually distinct from players
    // FUTURE: When initiative is implemented, filter out DM (players.filter(p => !p.isDM))
    // and keep DM in fixed position while other players reorder
    const dmEntity = playerEntities.find((e) => e.player.isDM);
    const regularPlayers = playerEntities.filter((e) => !e.player.isDM);

    return dmEntity
      ? [dmEntity, ...regularPlayers, ...npcEntities]
      : [...regularPlayers, ...npcEntities];
  }, [players, tokens, npcCharacters, uid]);

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
      <JRPGButton
        onClick={() => setIsCollapsed((value) => !value)}
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
        {isCollapsed ? "▲ SHOW ENTITIES" : "▼ HIDE ENTITIES"}
      </JRPGButton>

      <JRPGPanel
        variant="bevel"
        style={{
          padding: "8px",
          borderRadius: 0,
          maxHeight: "320px",
          overflowY: "auto",
        }}
      >
        {isCollapsed ? (
          <div
            className="jrpg-text-small"
            style={{
              padding: "8px",
              textAlign: "center",
              color: "var(--jrpg-white)",
              opacity: 0.6,
            }}
          >
            Entities panel collapsed - click &ldquo;SHOW ENTITIES&rdquo; to expand
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3
              className="jrpg-text-command jrpg-text-highlight"
              style={{ margin: "0", textAlign: "center" }}
            >
              ENTITIES
            </h3>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                justifyContent: "center",
                alignItems: "flex-start",
              }}
            >
              {entities.map((entity, index) => {
                if (entity.kind === "player") {
                  const { player, token, isMe } = entity;
                  const tokenSceneObject = token ? (tokenSceneMap.get(token.id) ?? null) : null;
                  const playerDrawings = drawingsByOwner.get(player.uid) ?? [];
                  const isDM = player.isDM ?? false;
                  const isFirstDM = isDM && index === 0;

                  return (
                    <div
                      key={`player-${player.uid}`}
                      style={{
                        position: "relative",
                        width: "160px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        marginRight: isFirstDM ? "20px" : "0",
                        paddingRight: isFirstDM ? "20px" : "0",
                        borderRight: isFirstDM ? "2px solid rgba(255, 215, 0, 0.3)" : "none",
                      }}
                    >
                      <PlayerCard
                        player={player}
                        isMe={isMe}
                        tokenColor={token?.color}
                        token={token}
                        tokenSceneObject={tokenSceneObject}
                        playerDrawings={playerDrawings}
                        statusEffects={player.statusEffects}
                        micEnabled={micEnabled}
                        editingPlayerUID={editingPlayerUID}
                        nameInput={nameInput}
                        onNameInputChange={onNameInputChange}
                        onNameEdit={onNameEdit}
                        onNameSubmit={onNameSubmit}
                        onPortraitLoad={onPortraitLoad}
                        onToggleMic={onToggleMic}
                        onHpChange={(hp) => onHpChange(hp, player.maxHp ?? 100)}
                        editingMaxHpUID={editingMaxHpUID}
                        maxHpInput={maxHpInput}
                        onMaxHpInputChange={onMaxHpInputChange}
                        onMaxHpEdit={onMaxHpEdit}
                        onMaxHpSubmit={onMaxHpSubmit}
                        tokenImageUrl={token?.imageUrl ?? undefined}
                        onTokenImageSubmit={
                          isMe && token ? (url) => onTokenImageChange(token.id, url) : undefined
                        }
                        tokenId={token?.id}
                        onApplyPlayerState={
                          isMe ? (state) => onApplyPlayerState(state, token?.id) : undefined
                        }
                        onStatusEffectsChange={
                          isMe ? (effects) => onStatusEffectsChange(effects) : undefined
                        }
                        isDM={player.isDM ?? false}
                        onToggleDMMode={onToggleDMMode}
                        tokenLocked={
                          token
                            ? sceneObjects.find((obj) => obj.id === `token:${token.id}`)?.locked
                            : undefined
                        }
                        onToggleTokenLock={
                          currentIsDM && token
                            ? (locked: boolean) => onToggleTokenLock(`token:${token.id}`, locked)
                            : undefined
                        }
                        onDeleteToken={currentIsDM ? onPlayerTokenDelete : undefined}
                        tokenSize={token?.size}
                        onTokenSizeChange={
                          isMe && token
                            ? (size: TokenSize) => onTokenSizeChange(token.id, size)
                            : undefined
                        }
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={`npc-${entity.id}`}
                    style={{ width: "160px", display: "flex", justifyContent: "center" }}
                  >
                    <NpcCard
                      character={entity.character}
                      isDM={currentIsDM}
                      onUpdate={onNpcUpdate}
                      onDelete={onNpcDelete}
                      onPlaceToken={onNpcPlaceToken}
                      tokenLocked={
                        entity.character.tokenId
                          ? sceneObjects.find(
                              (obj) => obj.id === `token:${entity.character.tokenId}`,
                            )?.locked
                          : undefined
                      }
                      onToggleTokenLock={
                        currentIsDM && entity.character.tokenId
                          ? (locked: boolean) =>
                              onToggleTokenLock(`token:${entity.character.tokenId}`, locked)
                          : undefined
                      }
                      tokenSize={
                        entity.character.tokenId
                          ? (
                              sceneObjects.find(
                                (obj) => obj.id === `token:${entity.character.tokenId}`,
                              ) as (SceneObject & { type: "token" }) | undefined
                            )?.data.size
                          : undefined
                      }
                      onTokenSizeChange={
                        currentIsDM && entity.character.tokenId
                          ? (size: TokenSize) => onTokenSizeChange(entity.character.tokenId!, size)
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </JRPGPanel>
    </div>
  );
};
