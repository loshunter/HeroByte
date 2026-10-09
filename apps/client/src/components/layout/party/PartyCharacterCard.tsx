// ============================================================================
// PARTY CHARACTER CARD
// ============================================================================
// One player character's full card, wired to the Party panel. The DM's bench
// and the party order used to render this with two hand-kept copies of every
// prop; this is the one wiring both (and the roster's inspector) use.

import type { Player, TokenSize } from "@herobyte/shared";
import { isInInitiativeOrder } from "@herobyte/shared";
import type { EntityInfo } from "../../../hooks/useCombatOrdering";
import { PlayerCard } from "../../../features/players/components";
import type { PartyCardContext } from "./partyTypes";
import { useDMThroughBlip } from "../../../features/table/roleKnown";
import { buildColorPickerControl } from "../../../features/players/components/colorPicker/colorPickerModel";

interface PartyCharacterCardProps {
  /** A character entity (kind "character" or "dm"); it always has a player. */
  entity: EntityInfo;
  context: PartyCardContext;
  /**
   * Whether this card wears the current-turn mark. The DM's bench passes false:
   * a benched character is not in the order, so it never holds the turn there.
   */
  isCurrentTurn: boolean;
}

export function PartyCharacterCard({
  entity,
  context,
  isCurrentTurn,
}: PartyCharacterCardProps): JSX.Element | null {
  const { panel, tokenSceneMap, drawingsByOwner, nameEdit } = context;
  const { player, character, token, isMe, ownsSoleCharacter } = entity;
  // Held through a reconnect blip, so the DM-only fields below stay mounted.
  const currentIsDM = useDMThroughBlip(panel.currentIsDM);
  // Type guard: player is always defined for character entities
  if (!player) return null;

  const { combatActive = false } = panel;
  const tokenSceneObject = token ? (tokenSceneMap.get(token.id) ?? null) : null;
  const playerDrawings = drawingsByOwner.get(player.uid) ?? [];

  // Merge player data with character-specific data
  const displayPlayer: Player = {
    ...player,
    name: character.name,
    hp: character.hp,
    maxHp: character.maxHp,
    // The character's own art; the seat's player-level portrait is legacy,
    // attributable only to a sole character (UX-02), like the conditions.
    portrait: character.portrait ?? (ownsSoleCharacter ? player.portrait : undefined),
    // Temp HP is the character's too: the Temp HP field writes it there, so
    // showing the player-level value hid what was entered — and the bar's drag
    // sent that value back as the character's. The player-level one is
    // legacy, attributable only to a sole character.
    tempHp: character.tempHp ?? (ownsSoleCharacter ? player.tempHp : undefined),
  };
  const tokenLocked = token
    ? panel.sceneObjects.find((obj) => obj.id === `token:${token.id}`)?.locked
    : undefined;

  return (
    <div className={`player-card-shell${isCurrentTurn ? " player-card-shell--current-turn" : ""}`}>
      <PlayerCard
        player={displayPlayer}
        isMe={isMe}
        tokenColor={token?.color}
        token={token ?? undefined}
        tokenSceneObject={tokenSceneObject}
        playerDrawings={playerDrawings}
        statusEffects={
          // A character's conditions are its own. The player-level list is
          // legacy and is only attributable when this player owns one
          // character; otherwise it painted every card with conditions set on
          // a sibling (UX-02).
          character.statusEffects ?? (ownsSoleCharacter ? player.statusEffects : undefined)
        }
        micEnabled={panel.micEnabled}
        editingPlayerUID={nameEdit.editingCharacterId === character.id ? player.uid : null}
        nameInput={nameEdit.input}
        onNameInputChange={nameEdit.setInput}
        onNameEdit={() => nameEdit.begin(character.id, character.name)}
        onNameSubmit={(submitted) => {
          // Commit what the card submitted. The inline editor and the settings
          // window keep separate buffers, so reading one here loses the
          // other's edit.
          const next = submitted.trim();
          if (next) {
            panel.onCharacterNameUpdate(character.id, next);
          }
          nameEdit.end();
        }}
        onPortraitSubmit={(url) => panel.onCharacterPortraitUpdate(character.id, url)}
        onToggleMic={panel.onToggleMic}
        onHpChange={(hp) =>
          panel.onCharacterHpChange(
            character.id,
            hp,
            displayPlayer.maxHp ?? 100,
            displayPlayer.tempHp,
          )
        }
        editingHpUID={panel.editingHpUID}
        hpInput={panel.hpInput}
        onHpInputChange={panel.onHpInputChange}
        onHpEdit={panel.onHpEdit}
        onHpSubmit={panel.onHpSubmit}
        editingMaxHpUID={panel.editingMaxHpUID}
        maxHpInput={panel.maxHpInput}
        onMaxHpInputChange={panel.onMaxHpInputChange}
        onMaxHpEdit={panel.onMaxHpEdit}
        onMaxHpSubmit={panel.onMaxHpSubmit}
        editingTempHpUID={panel.editingTempHpUID}
        tempHpInput={panel.tempHpInput}
        onTempHpInputChange={panel.onTempHpInputChange}
        onTempHpEdit={panel.onTempHpEdit}
        onTempHpSubmit={panel.onTempHpSubmit}
        tokenImageUrl={character?.tokenImage ?? token?.imageUrl ?? undefined}
        onTokenImageSubmit={
          (isMe || currentIsDM) && token
            ? (url) => panel.onTokenImageChange(token.id, url)
            : undefined
        }
        tokenId={token?.id}
        colorPicker={buildColorPickerControl({
          characters: panel.characters,
          players: panel.players,
          token,
          characterId: character.id,
          ownerUid: character.ownedByPlayerUID ?? player.uid,
          name: character.name,
          viewerIsDM: currentIsDM,
          // The owner's or the DM's, as with the token image (the server re-checks).
          onTokenColorChange: isMe || currentIsDM ? panel.onTokenColorChange : undefined,
        })}
        onApplyPlayerState={
          isMe || currentIsDM
            ? (state) => panel.onApplyPlayerState(state, token?.id, character.id)
            : undefined
        }
        onStatusEffectsChange={
          (isMe || currentIsDM) && character.id
            ? (effects) => panel.onCharacterStatusEffectsChange(character.id, effects)
            : undefined
        }
        canEditStatusEffects={isMe || currentIsDM}
        // A DM-owned character (the bench, or a rolled one in the order, F3)
        // renders with the DM's affordances.
        isDM={player.isDM ?? false}
        viewerIsDM={currentIsDM}
        tokenLocked={tokenLocked}
        onToggleTokenLock={
          currentIsDM && token
            ? (locked: boolean) => panel.onToggleTokenLock(`token:${token.id}`, locked)
            : undefined
        }
        onDeleteToken={currentIsDM ? panel.onPlayerTokenDelete : undefined}
        // The DM moves the character (and its token) to another seat.
        owner={
          currentIsDM
            ? {
                uid: player.uid,
                options: panel.players.map(({ uid, name }) => ({ uid, name })),
                onChange: (ownerUid) => panel.onCharacterOwnerChange(character.id, ownerUid),
              }
            : undefined
        }
        tokenSize={token?.size}
        // The owner, or the DM on any token: the server's own rule
        // (TokenMessageHandler.handleSetSize).
        onTokenSizeChange={
          (isMe || currentIsDM) && token
            ? (size: TokenSize) => panel.onTokenSizeChange(token.id, size)
            : undefined
        }
        // The DM's OWN card once never reached this control, though the settings
        // note says "a DM sets the darkness on every token, including their
        // own". Same gate for every card now that there is one wiring.
        tokenVisionRadius={token?.visionRadius}
        tableVisionDefault={panel.tableVisionDefault}
        onTokenVisionRadiusChange={
          currentIsDM && token && panel.onTokenVisionRadiusChange
            ? (radiusFeet: number | null) => panel.onTokenVisionRadiusChange?.(token.id, radiusFeet)
            : undefined
        }
        characterSpeed={character.speed}
        // Where the plate shows a budget (in combat, in the order — the shared
        // spelling of it), OR where there is a spend to clear: the server
        // charges any token moved in combat, initiative or not. On the DM's
        // BENCH (a DM-owned character NOT in the active order) only the spend
        // clause can hold, so the one rule covers both sites.
        characterBudget={
          currentIsDM &&
          combatActive &&
          (isInInitiativeOrder(character, panel.players) || (character.movementUsed ?? 0) > 0) &&
          panel.onCharacterBudgetReset
            ? {
                used: character.movementUsed ?? 0,
                onReset: () => panel.onCharacterBudgetReset?.(character.id),
              }
            : undefined
        }
        onCharacterSpeedChange={
          currentIsDM && panel.onCharacterSpeedChange
            ? (speed: number | null) => panel.onCharacterSpeedChange?.(character.id, speed)
            : undefined
        }
        onAddCharacter={isMe ? context.characterCreation.createCharacter : undefined}
        isCreatingCharacter={isMe ? context.characterCreation.isCreating : false}
        characterId={character.id}
        onDeleteCharacter={isMe || currentIsDM ? panel.onDeleteCharacter : undefined}
        onFocusToken={token ? () => panel.onFocusToken(token.id) : undefined}
        initiative={character.initiative}
        onInitiativeClick={
          isMe || currentIsDM ? () => context.openInitiativeModal(character) : undefined
        }
        initiativeModifier={character.initiativeModifier}
        onClearInitiative={
          panel.onClearInitiative ? () => panel.onClearInitiative?.(character.id) : undefined
        }
        isCurrentTurn={isCurrentTurn}
      />
    </div>
  );
}
