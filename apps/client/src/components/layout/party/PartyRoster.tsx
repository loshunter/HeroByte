// ============================================================================
// PARTY ROSTER
// ============================================================================
// The compact Party (U7): one row per CHARACTER — never per seat — in the
// panel's own order: the DM's bench first, then the party before the NPCs until
// anyone rolls; after that, everyone together by initiative. A player with two
// characters therefore has two rows, each with its own HP, conditions and Focus.

import type React from "react";
import type { EntityInfo } from "../../../hooks/useCombatOrdering";
import { PartyRosterEntry } from "./PartyRosterEntry";
import { rosterEntryView } from "./rosterEntryView";

interface PartyRosterProps {
  entities: readonly EntityInfo[];
  selectedCharacterId: string | null;
  inspectorId: string;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>, characterId: string) => void;
  onFocusToken: (tokenId: string) => void;
}

export function PartyRoster({
  entities,
  selectedCharacterId,
  inspectorId,
  onSelect,
  onFocusToken,
}: PartyRosterProps): JSX.Element {
  if (entities.length === 0) {
    return <p className="party-roster__empty">No characters at this table yet.</p>;
  }
  return (
    <ul className="party-roster" aria-label="Party roster">
      {entities.map((entity) => {
        const view = rosterEntryView(entity);
        return (
          <PartyRosterEntry
            key={entity.id}
            view={view}
            selected={view.characterId === selectedCharacterId}
            inspectorId={inspectorId}
            onSelect={onSelect}
            onFocus={onFocusToken}
          />
        );
      })}
    </ul>
  );
}
