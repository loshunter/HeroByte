// ============================================================================
// ENTITIES PANEL COMPONENT
// ============================================================================
// The desktop Party: a fixed bottom panel of the table's characters and NPCs.
// Compact by default (U7): a one-row roster whose selection opens that
// character's full card in one inspector; "Cards" shows every card at once.
// Its bar reserves the launcher dock, so World, Props and DM MENU never float
// over a card (IA-15).

import React, { useEffect, useId, useMemo, useState } from "react";
import type { Drawing, SceneObject } from "@herobyte/shared";
import { JRPGPanel } from "../ui/JRPGPanel";
import { useInitiativeDialog } from "../../features/initiative/useInitiativeDialog";
import { activatePanelLauncher } from "../../features/interaction/useExplicitDismissal";
import { useCombatOrdering } from "../../hooks/useCombatOrdering";
import { initiativeOrder } from "../../utils/initiativeOrder";
import { useCharacterCreation } from "../../hooks/useCharacterCreation";
import { PartyCharacterCard } from "./party/PartyCharacterCard";
import { PartyNpcCard } from "./party/PartyNpcCard";
import { PartyBar, type PartyLayout } from "./party/PartyBar";
import { PartyInspector } from "./party/PartyInspector";
import { PartyRoster } from "./party/PartyRoster";
import { announcePartyPanelSize } from "./party/partyPanelSize";
import type { EntitiesPanelProps, PartyCardContext } from "./party/partyTypes";
import "./party/party.css";

/** A character's roster row button, where its closed details return focus. */
function rosterSelectButton(characterId: string): HTMLElement | null {
  const row = Array.from(document.querySelectorAll<HTMLElement>(".party-roster__entry")).find(
    (entry) => entry.dataset.characterId === characterId,
  );
  return row?.querySelector<HTMLElement>(".party-roster__select") ?? null;
}

/**
 * The desktop Party panel: every player character and NPC at the table.
 */
export const EntitiesPanel: React.FC<EntitiesPanelProps> = (props) => {
  const {
    players,
    characters,
    tokens,
    sceneObjects,
    drawings,
    uid,
    onAddCharacter,
    onFocusToken,
    bottomPanelRef,
    launcherDockRef,
    // Combat/Initiative props
    combatActive = false,
    currentTurnCharacterId,
    onSetInitiative,
    onRollInitiative,
    manualInitiativeAllowed = true,
    isSettingInitiative = false,
    initiativeError = null,
    onNextTurn,
    onPreviousTurn,
  } = props;
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Compact by default; the full cards are one press away (U7).
  const [layout, setLayout] = useState<PartyLayout>("roster");
  // The roster selects a CHARACTER (never a seat): its id, not its player's.
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const inspectorId = useId();
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [characterNameInput, setCharacterNameInput] = useState("");

  // The map's bottom edge follows this panel's height (partyPanelSize.ts).
  useEffect(() => {
    const node = bottomPanelRef?.current;
    return node ? announcePartyPanelSize(node) : undefined;
  }, [bottomPanelRef]);

  // Use tested hooks for combat ordering and initiative modal
  const { dmEntities, orderedEntities } = useCombatOrdering({
    players,
    characters,
    tokens,
    currentUid: uid,
    combatActive: combatActive ?? false,
    currentTurnCharacterId,
  });

  // The card's INIT is a shortcut into the one initiative dialog (U8), with
  // the server's rule — the DM, or the character's owner — applied there.
  const initiativeDialog = useInitiativeDialog({
    characters,
    players,
    uid,
    isDM: props.currentIsDM,
    initiative: {
      setInitiative: onSetInitiative,
      rollInitiative: onRollInitiative,
      isSetting: isSettingInitiative,
      error: initiativeError,
    },
    manualEntryAllowed: manualInitiativeAllowed,
    combatActive: combatActive ?? false,
  });
  const openInitiativeModal = initiativeDialog.open;

  // Use character creation hook for proper state synchronization
  const characterCreation = useCharacterCreation({
    addCharacter: onAddCharacter,
    characters,
    uid,
  });

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

  const cardContext: PartyCardContext = {
    panel: props,
    tokenSceneMap,
    drawingsByOwner,
    nameEdit: {
      editingCharacterId,
      input: characterNameInput,
      begin: (characterId, currentName) => {
        setEditingCharacterId(characterId);
        setCharacterNameInput(currentName);
      },
      setInput: setCharacterNameInput,
      end: () => {
        setEditingCharacterId(null);
        setCharacterNameInput("");
      },
    },
    characterCreation,
    openInitiativeModal,
  };

  // The bar counts the server's order as this viewer's snapshot carries it (a
  // player's leaves out the NPCs the server withholds), not the cards: a PC
  // with no seat (unclaimed, or its player's seat gone after a load) is in the
  // order though the Party draws no card for it, and next-turn lands on it.
  const turnOrder = useMemo(() => initiativeOrder(characters, players), [characters, players]);
  const currentTurnIndexDisplay = combatActive
    ? turnOrder.findIndex((character) => character.id === currentTurnCharacterId)
    : -1;

  // The roster lists every character the cards do, in the cards' order: the
  // DM's bench first, then the party and NPCs.
  const rosterEntities = useMemo(
    () => [...dmEntities, ...orderedEntities],
    [dmEntities, orderedEntities],
  );
  const selectedEntity =
    selectedCharacterId === null
      ? undefined
      : rosterEntities.find((entity) => entity.character.id === selectedCharacterId);
  // A selected character that leaves the roster (deleted, hidden, fogged)
  // clears the selection; kept, its details reopened by themselves on return.
  useEffect(() => {
    if (selectedCharacterId !== null && !selectedEntity) setSelectedCharacterId(null);
  }, [selectedCharacterId, selectedEntity]);

  return (
    <div
      ref={bottomPanelRef}
      className="party-panel"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        margin: 0,
      }}
    >
      <JRPGPanel variant="bevel" className="party-panel__frame" style={{ borderRadius: 0 }}>
        <PartyBar
          layout={layout}
          onLayoutChange={setLayout}
          collapsed={isCollapsed}
          onToggleCollapsed={() => setIsCollapsed((value) => !value)}
          launcherDockRef={launcherDockRef}
          combat={
            combatActive
              ? {
                  turnIndex: currentTurnIndexDisplay,
                  total: turnOrder.length,
                  onNextTurn,
                  onPreviousTurn,
                }
              : null
          }
        />

        {!isCollapsed && layout === "roster" && (
          <div className="party-panel__roster">
            <PartyRoster
              entities={rosterEntities}
              selectedCharacterId={selectedEntity ? selectedCharacterId : null}
              inspectorId={inspectorId}
              onSelect={(event, characterId) =>
                activatePanelLauncher(event, () =>
                  setSelectedCharacterId((current) =>
                    current === characterId ? null : characterId,
                  ),
                )
              }
              onFocusToken={onFocusToken}
            />
            {selectedEntity && (
              <PartyInspector
                // Keyed by character: switching rows remounts it, so its Escape
                // returns focus to the row that opened THIS character.
                key={selectedEntity.character.id}
                id={inspectorId}
                name={selectedEntity.character.name}
                onClose={() => setSelectedCharacterId(null)}
                returnFocusTo={() => rosterSelectButton(selectedEntity.character.id)}
              >
                {selectedEntity.kind === "npc" ? (
                  <PartyNpcCard entity={selectedEntity} context={cardContext} />
                ) : (
                  <PartyCharacterCard
                    entity={selectedEntity}
                    context={cardContext}
                    isCurrentTurn={
                      dmEntities.includes(selectedEntity) ? false : selectedEntity.isCurrentTurn
                    }
                  />
                )}
              </PartyInspector>
            )}
          </div>
        )}

        {!isCollapsed && layout === "cards" && (
          <div className="party-panel__cards">
            {/* Horizontal Layout: DM on left, separator, then Players/NPCs */}
            <div className="entities-panel-main-row">
              {/* DM Section - Pinned to left with separator */}
              {dmEntities.length > 0 && (
                <>
                  <div className="entities-panel-dm-group">
                    {dmEntities.map((entity) => (
                      <PartyCharacterCard
                        key={entity.id}
                        entity={entity}
                        context={cardContext}
                        isCurrentTurn={false}
                      />
                    ))}
                  </div>

                  {/* Vertical Separator */}
                  <div
                    style={{
                      width: "2px",
                      backgroundColor: "var(--jrpg-gold)",
                      alignSelf: "stretch",
                      flexShrink: 0,
                      opacity: 0.5,
                    }}
                  />

                  {/* Gap spacing (1 card width) */}
                  <div className="entities-panel-dm-gap" />
                </>
              )}

              {/* Players and NPCs Section */}
              <div className="entities-panel-card-grid">
                {orderedEntities.map((entity) =>
                  // A DM-owned character that has rolled stands in the order
                  // (kind "dm", F3): the same card, with the DM's affordances.
                  entity.kind === "npc" ? (
                    <PartyNpcCard key={`npc-${entity.id}`} entity={entity} context={cardContext} />
                  ) : (
                    <PartyCharacterCard
                      key={entity.id}
                      entity={entity}
                      context={cardContext}
                      isCurrentTurn={entity.isCurrentTurn}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        )}
      </JRPGPanel>

      {initiativeDialog.element}
    </div>
  );
};
