// ============================================================================
// PARTY NPC CARD
// ============================================================================
// One NPC's full card, wired to the Party panel: used by the card view and by
// the roster's inspector, so the two cannot drift.

import type { SceneObject, TokenSize } from "@herobyte/shared";
import type { EntityInfo } from "../../../hooks/useCombatOrdering";
import { NpcCard } from "../../../features/players/components/NpcCard";
import type { PartyCardContext } from "./partyTypes";
import { useDMThroughBlip } from "../../../features/table/roleKnown";

interface PartyNpcCardProps {
  /** An NPC entity (kind "npc"). */
  entity: EntityInfo;
  context: PartyCardContext;
}

export function PartyNpcCard({ entity, context }: PartyNpcCardProps): JSX.Element {
  const { panel } = context;
  // Held through a reconnect blip, so the DM-only fields stay mounted.
  const currentIsDM = useDMThroughBlip(panel.currentIsDM);
  const { character } = entity;
  // The token on the map: one waiting on another scene takes no Lock, Size or
  // Focus — the server looks for it in the current scene only.
  const tokenId = entity.token?.id;
  const tokenObject = tokenId
    ? (panel.sceneObjects.find((obj) => obj.id === `token:${tokenId}`) as
        | (SceneObject & { type: "token" })
        | undefined)
    : undefined;

  return (
    <div
      className={`player-card-shell${entity.isCurrentTurn ? " player-card-shell--current-turn" : ""}`}
    >
      <NpcCard
        character={character}
        isDM={currentIsDM}
        onUpdate={panel.onNpcUpdate}
        onDelete={panel.onNpcDelete}
        onPlaceToken={panel.onNpcPlaceToken}
        onToggleVisibility={panel.onNpcToggleVisibility}
        tokenLocked={tokenId ? tokenObject?.locked : undefined}
        onToggleTokenLock={
          currentIsDM && tokenId
            ? (locked: boolean) => panel.onToggleTokenLock(`token:${tokenId}`, locked)
            : undefined
        }
        tokenSize={tokenId ? tokenObject?.data.size : undefined}
        onTokenSizeChange={
          currentIsDM && tokenId
            ? (size: TokenSize) => panel.onTokenSizeChange(tokenId, size)
            : undefined
        }
        onFocusToken={tokenId ? () => panel.onFocusToken(tokenId) : undefined}
        initiative={character.initiative}
        onInitiativeClick={currentIsDM ? () => context.openInitiativeModal(character) : undefined}
        initiativeModifier={character.initiativeModifier}
        isDeleting={panel.isDeletingNpc ?? false}
        deletionError={panel.npcDeletionError ?? null}
        onClearInitiative={
          panel.onClearInitiative ? () => panel.onClearInitiative?.(character.id) : undefined
        }
        isCurrentTurn={entity.isCurrentTurn}
        // The DM sets an NPC's conditions as they do a player's (U7); the
        // server has always allowed it, and the map draws them.
        onStatusEffectsChange={
          currentIsDM
            ? (effects) => panel.onCharacterStatusEffectsChange(character.id, effects)
            : undefined
        }
      />
    </div>
  );
}
