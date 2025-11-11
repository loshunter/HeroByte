// ============================================================================
// ENTITIES PANEL COMPONENT
// ============================================================================
// Fixed bottom panel displaying both players and NPCs in the scene.

import React, { useMemo, useState } from "react";
import type { Character, Drawing, Player, PlayerState, Token, SceneObject } from "@shared";
import { PlayerCard } from "../../features/players/components";
import { NpcCard } from "../../features/players/components/NpcCard";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";
import { InitiativeModal } from "../../features/initiative/components/InitiativeModal";
import { useCombatOrdering } from "../../hooks/useCombatOrdering";
import { useInitiativeModal } from "../../hooks/useInitiativeModal";

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
  onCharacterNameUpdate: (characterId: string, name: string) => void;
  onPortraitLoad: () => void;
  onToggleMic: () => void;
  onCharacterHpChange: (characterId: string, hp: number, maxHp: number) => void;
  editingHpUID: string | null;
  hpInput: string;
  onHpInputChange: (value: string) => void;
  onHpEdit: (uid: string, currentHp: number) => void;
  onHpSubmit: () => void;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  onMaxHpSubmit: () => void;
  currentIsDM: boolean;
  onToggleDMMode: (next: boolean) => void;
  onTokenImageChange: (tokenId: string, imageUrl: string) => void;
  onApplyPlayerState: (state: PlayerState, tokenId?: string, characterId?: string) => void;
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
  onAddCharacter: (name: string) => void;
  onDeleteCharacter: (characterId: string) => void;
  onFocusToken: (tokenId: string) => void;
  bottomPanelRef?: React.RefObject<HTMLDivElement>;
  // Combat/Initiative props
  combatActive?: boolean;
  currentTurnCharacterId?: string;
  onSetInitiative: (characterId: string, initiative: number, modifier: number) => void;
  onNextTurn?: () => void;
  onPreviousTurn?: () => void;
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
  editingMaxHpUID,
  maxHpInput,
  onCharacterNameUpdate,
  onPortraitLoad,
  onToggleMic,
  onCharacterHpChange,
  editingHpUID,
  hpInput,
  onHpInputChange,
  onHpEdit,
  onHpSubmit,
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
  onAddCharacter,
  onDeleteCharacter,
  onFocusToken,
  bottomPanelRef,
  // Combat/Initiative props
  combatActive = false,
  currentTurnCharacterId,
  onSetInitiative,
  onNextTurn: _onNextTurn,
  onPreviousTurn: _onPreviousTurn,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [characterNameInput, setCharacterNameInput] = useState("");

  // Use tested hooks for combat ordering and initiative modal
  const { orderedEntities } = useCombatOrdering({
    players,
    characters,
    tokens,
    currentUid: uid,
    combatActive: combatActive ?? false,
    currentTurnCharacterId,
  });

  const {
    character: initiativeModalCharacter,
    isOpen: isInitiativeModalOpen,
    openModal: openInitiativeModal,
    closeModal: closeInitiativeModal,
  } = useInitiativeModal();

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
              {orderedEntities.map((entity) => {
                if (entity.kind === "character") {
                  const { player, character, token, isMe, isFirstDM, isCurrentTurn } = entity;

                  // Type guard: player is always defined for character entities
                  if (!player) return null;

                  const tokenSceneObject = token ? (tokenSceneMap.get(token.id) ?? null) : null;
                  const playerDrawings = drawingsByOwner.get(player.uid) ?? [];

                  // Merge player data with character-specific data
                  const displayPlayer: Player = {
                    ...player,
                    name: character.name,
                    hp: character.hp,
                    maxHp: character.maxHp,
                    // Use player.portrait (set via PlayerSettingsMenu), fallback to character.portrait
                    portrait: player.portrait ?? character.portrait,
                  };

                  return (
                    <div
                      key={entity.id}
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
                        border: isCurrentTurn ? "2px solid var(--jrpg-gold)" : undefined,
                        boxShadow: isCurrentTurn ? "0 0 20px rgba(255, 215, 0, 0.6)" : undefined,
                        borderRadius: isCurrentTurn ? "8px" : undefined,
                        padding: isCurrentTurn ? "8px" : undefined,
                        transition: "all 0.3s ease",
                      }}
                    >
                      <PlayerCard
                        player={displayPlayer}
                        isMe={isMe}
                        tokenColor={token?.color}
                        token={token ?? undefined}
                        tokenSceneObject={tokenSceneObject}
                        playerDrawings={playerDrawings}
                        statusEffects={player.statusEffects}
                        micEnabled={micEnabled}
                        editingPlayerUID={editingCharacterId === character.id ? player.uid : null}
                        nameInput={characterNameInput}
                        onNameInputChange={setCharacterNameInput}
                        onNameEdit={() => {
                          setEditingCharacterId(character.id);
                          setCharacterNameInput(character.name);
                        }}
                        onNameSubmit={() => {
                          if (characterNameInput.trim()) {
                            onCharacterNameUpdate(character.id, characterNameInput.trim());
                          }
                          setEditingCharacterId(null);
                          setCharacterNameInput("");
                        }}
                        onPortraitLoad={onPortraitLoad}
                        onToggleMic={onToggleMic}
                        onHpChange={(hp) =>
                          onCharacterHpChange(character.id, hp, displayPlayer.maxHp ?? 100)
                        }
                        editingHpUID={editingHpUID}
                        hpInput={hpInput}
                        onHpInputChange={onHpInputChange}
                        onHpEdit={onHpEdit}
                        onHpSubmit={onHpSubmit}
                        editingMaxHpUID={editingMaxHpUID}
                        maxHpInput={maxHpInput}
                        onMaxHpInputChange={onMaxHpInputChange}
                        onMaxHpEdit={onMaxHpEdit}
                        onMaxHpSubmit={onMaxHpSubmit}
                        tokenImageUrl={character?.tokenImage ?? token?.imageUrl ?? undefined}
                        onTokenImageSubmit={
                          isMe && token ? (url) => onTokenImageChange(token.id, url) : undefined
                        }
                        tokenId={token?.id}
                        onApplyPlayerState={
                          isMe
                            ? (state) => onApplyPlayerState(state, token?.id, character.id)
                            : undefined
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
                        onAddCharacter={isMe ? onAddCharacter : undefined}
                        characterId={character.id}
                        onDeleteCharacter={isMe ? onDeleteCharacter : undefined}
                        onFocusToken={token ? () => onFocusToken(token.id) : undefined}
                        initiative={character.initiative}
                        onInitiativeClick={() => openInitiativeModal(character)}
                        initiativeModifier={character.initiativeModifier}
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
                      onFocusToken={
                        entity.character.tokenId
                          ? () => onFocusToken(entity.character.tokenId!)
                          : undefined
                      }
                      initiative={entity.character.initiative}
                      onInitiativeClick={() => openInitiativeModal(entity.character)}
                      initiativeModifier={entity.character.initiativeModifier}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </JRPGPanel>

      {/* Initiative Modal */}
      {isInitiativeModalOpen && initiativeModalCharacter && (
        <InitiativeModal
          character={initiativeModalCharacter}
          onClose={closeInitiativeModal}
          onSetInitiative={(initiative, modifier) => {
            onSetInitiative(initiativeModalCharacter.id, initiative, modifier);
            closeInitiativeModal();
          }}
        />
      )}
    </div>
  );
};
