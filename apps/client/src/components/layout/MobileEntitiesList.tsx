// ============================================================================
// MOBILE ENTITIES LIST
// ============================================================================
// The party rows on mobile. Since M4a this is ONLY the list: the full-height
// surface, header and exit around it belong to MobileScreen, which is what
// retired the right-edge drawer this file used to be.

import React from "react";
import { looseOwnToken } from "../../utils/looseOwnToken";
import type { Player, SceneObject, SnapshotCharacter, Token, TokenSize } from "@herobyte/shared";
import { mobilePartyRows } from "./mobilePartyRows";
import { useCharacterCreation } from "../../hooks/useCharacterCreation";
import { MobilePlayerRow } from "./MobilePlayerRow";
import "./mobileParty.css";

interface MobileEntitiesListProps {
  players: Player[];
  characters: SnapshotCharacter[];
  uid: string;
  /** The VIEWER's DM state — mobile passes the same flag to every row. */
  isDM: boolean;
  /** Grant/revoke the viewer's own DM status. */
  onToggleDMMode: (next: boolean) => void;

  // Edit props passed through to row
  editingHpUID: string | null;
  hpInput: string;
  onHpInputChange: (value: string) => void;
  onHpEdit: (uid: string, currentHp: number) => void;
  onHpSubmit: () => void;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  onMaxHpSubmit: () => void;
  onCharacterHpChange: (characterId: string, hp: number, maxHp: number, tempHp?: number) => void;
  onCharacterStatusEffectsChange: (characterId: string, effects: string[]) => void;
  onCharacterNameUpdate: (characterId: string, name: string) => void;
  /** Delete a character — the owner's own, or any character for a DM. */
  onDeleteCharacter?: (characterId: string) => void;
  /** The table's default sight radius in feet, shown on a token that inherits
   *  it. Undefined means no default is set, which is unlimited. */
  tableVisionDefault?: number;
  onCharacterPortraitUpdate: (characterId: string, url: string) => void;
  /** Live tokens, so a DM can set each player's sight radius from a phone (S7). */
  tokens?: Token[];
  onTokenVisionRadiusChange?: (tokenId: string, radiusFeet: number | null) => void;
  /**
   * Resize a token. Offered on the viewer's own rows and, for a DM, on every
   * row: the server's own rule (TokenMessageHandler.handleSetSize). Required,
   * so a phone cannot silently lose the control again.
   */
  onTokenSizeChange: (tokenId: string, size: TokenSize) => void;
  /** The viewer's own rows add a character, as the desktop window does. */
  onAddCharacter: (name: string) => void;
  /** Scene objects, for each token's lock state. */
  sceneObjects: SceneObject[];
  /** A token's lock — offered to a DM, as on the desktop card. */
  onToggleTokenLock: (sceneObjectId: string, locked: boolean) => void;
  /** DM-only: delete a player's token. A required key: undefined for a player. */
  onPlayerTokenDelete: ((tokenId: string) => void) | undefined;
  /** DM-only: move a player character and its token to another seat. */
  onCharacterOwnerChange: (characterId: string, ownerUid: string) => void;
  /** DM-only: a character's feet per turn (the movement budget). */
  onCharacterSpeedChange?: (characterId: string, speedFeet: number | null) => void;
  /** DM-only: zero a character's spend outside a turn boundary. */
  onCharacterBudgetReset?: (characterId: string) => void;
  /**
   * The reset shows where the plate shows a budget — in combat, for a combatant
   * in the order — or wherever there is a spend to clear.
   */
  combatActive?: boolean;
  /**
   * Centre the map on a character's token and show the map (U7): each row
   * focuses ITS character, so a second character is as findable as the first.
   */
  onFocusToken: (tokenId: string) => void;
  /** Whose turn it is (combat on): the row that holds it says so (U8). */
  currentTurnCharacterId: string | undefined;
  /**
   * Opens the ONE initiative dialog for a character (U8): the phone's INIT,
   * offered on the viewer's own rows and, for a DM, on every row.
   */
  onOpenInitiative: (character: SnapshotCharacter) => void;
}

export const MobileEntitiesList: React.FC<MobileEntitiesListProps> = ({
  players,
  characters,
  uid,
  isDM,
  onToggleDMMode,
  editingHpUID,
  hpInput,
  onHpInputChange,
  onHpEdit,
  onHpSubmit,
  editingMaxHpUID,
  maxHpInput,
  onMaxHpInputChange,
  onMaxHpEdit,
  onMaxHpSubmit,
  onCharacterHpChange,
  onCharacterStatusEffectsChange,
  onCharacterNameUpdate,
  onDeleteCharacter,
  tableVisionDefault,
  onCharacterPortraitUpdate,
  tokens,
  onTokenVisionRadiusChange,
  onTokenSizeChange,
  onAddCharacter,
  sceneObjects,
  onToggleTokenLock,
  onPlayerTokenDelete,
  onCharacterOwnerChange,
  onCharacterSpeedChange,
  onCharacterBudgetReset,
  combatActive = false,
  onFocusToken,
  currentTurnCharacterId,
  onOpenInitiative,
}) => {
  // The desktop panel's creation state, for the viewer's own rows: the
  // settings window asks for the name and waits on this until it lands.
  const characterCreation = useCharacterCreation({ addCharacter: onAddCharacter, characters, uid });

  const entities = mobilePartyRows(players, characters, uid, combatActive);
  // A row's initiative and turn; its INIT for the viewer's own and a DM's rows.
  // INIT follows the server's rule: the character's owner, or the DM.
  const rowInitiative = (entity: { characterId: string; hasCharacter: boolean }) => {
    const character = entity.hasCharacter
      ? characters.find((c) => c.id === entity.characterId)
      : undefined; // the characterless seat: its id is the player's uid
    if (!character) return undefined;
    return {
      value: character.initiative,
      isTurn: combatActive && currentTurnCharacterId === character.id,
      focusKey: `initiative:${character.id}`,
      onOpen:
        character.ownedByPlayerUID === uid || isDM ? () => onOpenInitiative(character) : undefined,
    };
  };

  // One SEAT per player, its characters listed under it (U7): a player with
  // two characters shows as one seat with two rows, never as a seat that
  // silently stands for its first character. Seats: me first, then the DM,
  // then everyone else alphabetically — rank-based on purpose (the old
  // comparator answered "a first" whenever a was mine without looking at b).
  // Rows keep their creation order within a seat.
  const rank = (p: Player) => (p.uid === uid ? 0 : p.isDM ? 1 : 2);
  const seats = [...players]
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? a.name.localeCompare(b.name) : 0))
    .map((player) => ({ player, rows: entities.filter((entity) => entity.uid === player.uid) }))
    // A seat with nothing to list (someone else's, characterless) shows nothing.
    .filter(({ rows }) => rows.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {seats.map(({ player: seat, rows }) => (
        <section
          key={seat.uid}
          className="mobile-party-seat"
          aria-label={`Seat: ${seat.name}${seat.uid === uid ? " (you)" : ""}`}
          style={{ display: "flex", flexDirection: "column", gap: "10px" }}
        >
          <h3 className="mobile-party-seat__heading">
            {seat.name}
            {seat.uid === uid ? " (you)" : ""}
            {seat.isDM ? " · DM" : ""}
            {rows.length > 1 ? ` · ${rows.length} characters` : ""}
          </h3>
          {rows.map((entity) => {
            // Prefer the row's own character token; the by-owner fallback is
            // gated to rows where it cannot pick the wrong character's token —
            // and reads the one LOOSE own token, never a goblin the DM placed.
            const entityToken = entity.tokenId
              ? tokens?.find((candidate) => candidate.id === entity.tokenId)
              : entity.ownerTokenFallbackOk
                ? looseOwnToken(tokens, characters, entity.uid)
                : undefined;
            return (
              <MobilePlayerRow
                // uid alone duplicates the moment a player has two rows; the pair
                // mirrors useCombatOrdering's `${player.uid}-${character.id}` ids.
                key={`${entity.uid}-${entity.characterId}`}
                player={entity}
                isMe={entity.uid === uid}
                token={entityToken}
                // `isDM` is the VIEWER's flag (see the prop doc above), and it is
                // required here for the same reason EntitiesPanel gates on
                // `currentIsDM`: sight radius is DM-only, the server refuses it
                // from anyone else, and a control that silently does nothing is
                // worse than one that isn't there.
                onTokenVisionRadiusChange={
                  isDM && entityToken && onTokenVisionRadiusChange
                    ? (radiusFeet) => onTokenVisionRadiusChange(entityToken.id, radiusFeet)
                    : undefined
                }
                onAddCharacter={entity.uid === uid ? characterCreation.createCharacter : undefined}
                isCreatingCharacter={entity.uid === uid && characterCreation.isCreating}
                // A DM's, as on the desktop card: the lock and Delete Token.
                tokenLocked={
                  entityToken
                    ? sceneObjects.find((object) => object.id === `token:${entityToken.id}`)?.locked
                    : undefined
                }
                onToggleTokenLock={
                  isDM && entityToken
                    ? (locked) => onToggleTokenLock(`token:${entityToken.id}`, locked)
                    : undefined
                }
                onDeleteToken={
                  isDM && entityToken && onPlayerTokenDelete
                    ? () => onPlayerTokenDelete(entityToken.id)
                    : undefined
                }
                tokenSize={entityToken?.size}
                onTokenSizeChange={
                  (entity.uid === uid || isDM) && entityToken
                    ? (size) => onTokenSizeChange(entityToken.id, size)
                    : undefined
                }
                characterSpeed={entity.speed}
                characterBudget={
                  isDM && entity.hasBudget && onCharacterBudgetReset
                    ? {
                        used: entity.movementUsed ?? 0,
                        onReset: () => onCharacterBudgetReset(entity.characterId),
                      }
                    : undefined
                }
                // The legacy row's characterId is the player's uid — there is no
                // character to set a speed on, so the control does not render.
                onCharacterSpeedChange={
                  isDM && entity.hasCharacter && onCharacterSpeedChange
                    ? (speed) => onCharacterSpeedChange(entity.characterId, speed)
                    : undefined
                }
                isDM={isDM}
                onToggleDMMode={onToggleDMMode}
                editingHpUID={editingHpUID}
                hpInput={hpInput}
                onHpInputChange={onHpInputChange}
                onHpEdit={onHpEdit}
                onHpSubmit={(_hpStr) => {
                  // HPBar passes the string value, but onHpSubmit expects void in EntitiesPanel
                  // Here we just trigger the submit logic
                  onHpSubmit();
                }}
                editingMaxHpUID={editingMaxHpUID}
                maxHpInput={maxHpInput}
                onMaxHpInputChange={onMaxHpInputChange}
                onMaxHpEdit={onMaxHpEdit}
                onMaxHpSubmit={(_maxHpStr) => {
                  // HPBar passes the string value, but onMaxHpSubmit expects void here
                  onMaxHpSubmit();
                }}
                onCharacterHpChange={onCharacterHpChange}
                onStatusEffectsChange={
                  entity.hasCharacter
                    ? (effects) => onCharacterStatusEffectsChange(entity.characterId, effects)
                    : undefined
                }
                characterless={!entity.hasCharacter}
                owner={
                  isDM && entity.hasCharacter
                    ? {
                        uid: entity.uid,
                        options: players.map(({ uid: seatUid, name }) => ({ uid: seatUid, name })),
                        onChange: (ownerUid) =>
                          onCharacterOwnerChange(entity.characterId, ownerUid),
                      }
                    : undefined
                }
                onCharacterNameUpdate={onCharacterNameUpdate}
                // The desktop card's gate: the owner, or the DM. A legacy row has
                // no character to delete.
                onDeleteCharacter={
                  (entity.uid === uid || isDM) && entity.hasCharacter
                    ? onDeleteCharacter
                    : undefined
                }
                tableVisionDefault={tableVisionDefault}
                onCharacterPortraitUpdate={onCharacterPortraitUpdate}
                onFocus={entityToken ? () => onFocusToken(entityToken.id) : undefined}
                initiative={rowInitiative(entity)}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
};
