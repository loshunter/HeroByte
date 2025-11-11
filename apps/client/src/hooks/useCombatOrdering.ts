// ============================================================================
// COMBAT ORDERING HOOK
// ============================================================================
// Single responsibility: Order entities based on combat state and initiative
// Separates combat ordering logic from presentation concerns

import { useMemo } from "react";
import type { Character, Player, Token } from "@shared";

export interface EntityInfo {
  kind: "character" | "npc";
  id: string;
  character: Character;
  player?: Player;
  token?: Token;
  isMe: boolean;
  isFirstDM: boolean;
  isCurrentTurn: boolean;
}

interface UseCombatOrderingProps {
  players: Player[];
  characters: Character[];
  tokens: Token[];
  currentUid: string;
  combatActive: boolean;
  currentTurnCharacterId?: string;
}

/**
 * Custom hook for ordering entities based on combat state.
 *
 * **Responsibilities**:
 * - Order entities by initiative when combat is active
 * - Keep DM entities in fixed first position
 * - Mark current turn entity
 * - Link characters to their tokens and players
 *
 * **Does NOT handle**:
 * - Rendering logic
 * - Event handlers
 * - Modal state
 */
export function useCombatOrdering({
  players,
  characters,
  tokens,
  currentUid,
  combatActive,
  currentTurnCharacterId,
}: UseCombatOrderingProps) {
  const orderedEntities = useMemo<EntityInfo[]>(() => {
    // Build character entities (PCs)
    const characterEntities = players.flatMap((player) => {
      const playerCharacters = characters.filter(
        (c) => c.type === "pc" && c.ownedByPlayerUID === player.uid,
      );

      if (playerCharacters.length === 0) {
        return [];
      }

      return playerCharacters.map((character) => {
        const token = character.tokenId
          ? tokens.find((t) => t.id === character.tokenId)
          : tokens.find((t) => t.owner === player.uid);

        return {
          kind: "character" as const,
          id: `${player.uid}-${character.id}`,
          character,
          player,
          token,
          isMe: player.uid === currentUid,
          isFirstDM: false, // Will be set below
          isCurrentTurn: combatActive && currentTurnCharacterId === character.id,
        };
      });
    });

    // Build NPC entities
    const npcEntities = characters
      .filter((c) => c.type === "npc")
      .map((character) => ({
        kind: "npc" as const,
        id: character.id,
        character,
        isMe: false,
        isFirstDM: false,
        isCurrentTurn: combatActive && currentTurnCharacterId === character.id,
      }));

    // Separate DM from regular entities
    const dmEntities = characterEntities.filter((e) => e.player?.isDM);
    const regularEntities = characterEntities.filter((e) => !e.player?.isDM);

    // Mark first DM for visual separation
    if (dmEntities.length > 0) {
      dmEntities[0].isFirstDM = true;
    }

    // Check if any entities have initiative set
    const allCombatants = [...regularEntities, ...npcEntities];
    const hasAnyInitiative = allCombatants.some((e) => e.character.initiative !== undefined);

    // Order based on combat state OR if any initiative is set
    if (combatActive || hasAnyInitiative) {
      // Sort non-DM entities by initiative (highest first)
      const sorted = allCombatants.sort((a, b) => {
        const aInit = a.character.initiative ?? -1;
        const bInit = b.character.initiative ?? -1;
        return bInit - aInit; // Descending
      });

      const orderSummary = sorted
        .map((e, idx) => `${idx + 1}. ${e.character.name} (init: ${e.character.initiative ?? "none"}, type: ${e.character.type})`)
        .join("\n  ");
      console.log(`[useCombatOrdering] Ordered by initiative (${sorted.length} entities):\n  ${orderSummary}`);

      return [...dmEntities, ...sorted];
    }

    // Default order: DM, players, NPCs
    return [...dmEntities, ...regularEntities, ...npcEntities];
  }, [players, characters, tokens, currentUid, combatActive, currentTurnCharacterId]);

  return { orderedEntities };
}
