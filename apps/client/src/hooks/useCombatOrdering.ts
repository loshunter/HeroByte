// ============================================================================
// COMBAT ORDERING HOOK
// ============================================================================
// Single responsibility: Order entities based on combat state and initiative
// Separates combat ordering logic from presentation concerns

import { useMemo } from "react";
import type { Character, Player, Token } from "@shared";
import { shouldCharacterParticipateInCombat } from "@shared";

export interface EntityInfo {
  kind: "character" | "npc" | "dm";
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
 * - Separate DM entities from combatants (DM always displayed, never in combat)
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
  const { dmEntities, orderedEntities } = useMemo<{
    dmEntities: EntityInfo[];
    orderedEntities: EntityInfo[];
  }>(() => {
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

        // DM characters should be marked with kind "dm"
        const kind = player.isDM ? ("dm" as const) : ("character" as const);

        return {
          kind,
          id: `${player.uid}-${character.id}`,
          character,
          player,
          token,
          isMe: player.uid === currentUid,
          isFirstDM: false, // Will be set below for DM entities
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
    const dmEntities = characterEntities.filter((e) => e.kind === "dm");
    const regularEntities = characterEntities.filter((e) => e.kind === "character");

    // Mark first DM for visual separation
    if (dmEntities.length > 0) {
      dmEntities[0].isFirstDM = true;
    }

    // Filter entities for combat eligibility (excludes DM's player characters)
    const combatEligibleCharacters = regularEntities.filter((e) =>
      shouldCharacterParticipateInCombat(e.character, players),
    );
    const combatEligibleNpcs = npcEntities.filter((e) =>
      shouldCharacterParticipateInCombat(e.character, players),
    );

    // Check if any combat-eligible entities have initiative set
    const allCombatants = [...combatEligibleCharacters, ...combatEligibleNpcs];
    const hasAnyInitiative = allCombatants.some((e) => e.character.initiative !== undefined);

    // Order based on combat state OR if any initiative is set
    if (combatActive || hasAnyInitiative) {
      // Create index map to preserve creation order based on full characters array
      const indexMap = new Map<string, number>();
      characters.forEach((c, index) => {
        indexMap.set(c.id, index);
      });

      // Sort non-DM entities by initiative with stable tiebreakers
      const sorted = allCombatants.sort((a, b) => {
        const aInit = a.character.initiative ?? -1;
        const bInit = b.character.initiative ?? -1;

        // Primary: Initiative value (highest first)
        const initDiff = bInit - aInit;
        if (initDiff !== 0) return initDiff;

        // Secondary: PC before NPC (when initiative is tied)
        if (a.character.type === "pc" && b.character.type === "npc") return -1;
        if (a.character.type === "npc" && b.character.type === "pc") return 1;

        // Tertiary: Creation order (preserve original array position)
        const aIndex = indexMap.get(a.character.id) ?? 0;
        const bIndex = indexMap.get(b.character.id) ?? 0;
        return aIndex - bIndex;
      });

      const orderSummary = sorted
        .map(
          (e, idx) =>
            `${idx + 1}. ${e.character.name} (init: ${e.character.initiative ?? "none"}, type: ${e.character.type})`,
        )
        .join("\n  ");
      console.log(
        `[useCombatOrdering] Ordered by initiative (${sorted.length} entities):\n  ${orderSummary}`,
      );

      // In combat mode: DM entities separate, combatants sorted by initiative
      return { dmEntities, orderedEntities: sorted };
    }

    // Default order (non-combat): DM separate, then players, then NPCs
    return { dmEntities, orderedEntities: [...regularEntities, ...npcEntities] };
  }, [players, characters, tokens, currentUid, combatActive, currentTurnCharacterId]);

  return { dmEntities, orderedEntities };
}
