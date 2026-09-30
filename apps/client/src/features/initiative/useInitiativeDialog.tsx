// ============================================================================
// USE INITIATIVE DIALOG
// ============================================================================
// The ONE way a surface opens a character's initiative dialog (U8): the desktop
// card's INIT, Encounter's participant rows and the phone Party's INIT all
// open it through here, so each is a shortcut into the same state rather than
// a second editor with rules of its own.
//
// It owns the dialog's lifetime (which character, by id — useInitiativeModal)
// and the server's permission rule (the DM, or the character's owner): a
// dialog the viewer may no longer act on closes, and does not reopen on
// re-elevation. Both judgements wait for a loaded snapshot: during a reconnect
// the roster reads empty and the viewer's DM flag false, and a dialog closed on
// that blip lost what was typed (useInitiativeModal). The sends and their
// pending/error state belong to the caller's useInitiativeSetting instance,
// passed in whole.

import { useEffect } from "react";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "./components/InitiativeModal";
import { useInitiativeModal } from "../../hooks/useInitiativeModal";
import type { InitiativeSetting } from "../../hooks/useInitiativeSetting";

export interface InitiativeDialogOptions {
  characters: readonly SnapshotCharacter[];
  /** The table's seats: the viewer's own seat in it is what says the snapshot has arrived. */
  players: readonly Player[];
  /** The viewer's uid: their own characters are theirs to set. */
  uid: string;
  /** The VIEWER's DM flag, passed in (never read off the snapshot). */
  isDM: boolean;
  initiative: Pick<InitiativeSetting, "setInitiative" | "rollInitiative" | "isSetting" | "error">;
  /** The table's hand-entry permission for this viewer (a DM always has it). */
  manualEntryAllowed: boolean;
  combatActive: boolean;
}

export interface InitiativeDialog {
  open: (character: SnapshotCharacter) => void;
  /** The dialog, or null while none is open. Render it anywhere: it portals. */
  element: JSX.Element | null;
}

export function useInitiativeDialog({
  characters,
  players,
  uid,
  isDM,
  initiative,
  manualEntryAllowed,
  combatActive,
}: InitiativeDialogOptions): InitiativeDialog {
  // The app's own test for "the snapshot has arrived" (App.tsx, map-edit's guard).
  const snapshotLoaded = players.some((player) => player.uid === uid);
  const { character, isOpen, openModal, closeModal } = useInitiativeModal(
    characters,
    snapshotLoaded,
  );
  const allowed =
    character !== null && (!snapshotLoaded || isDM || character.ownedByPlayerUID === uid);
  useEffect(() => {
    if (isOpen && !allowed) closeModal();
  }, [isOpen, allowed, closeModal]);

  const element =
    character && allowed ? (
      <InitiativeModal
        // One instance per character: another's dialog starts fresh.
        key={character.id}
        character={character}
        onClose={closeModal}
        // Don't close on Save: the dialog closes itself when the hook confirms.
        onSetInitiative={(value, modifier) =>
          initiative.setInitiative(character.id, value, modifier)
        }
        // The roll closes the dialog itself: the server applies the value as it
        // rolls, and the number arrives in the roll log (the DM's only, for a
        // hidden NPC or a placed one under fog).
        onRollInitiative={(modifier) => initiative.rollInitiative(character.id, modifier)}
        manualEntryAllowed={manualEntryAllowed}
        combatActive={combatActive}
        isLoading={initiative.isSetting}
        error={initiative.error}
      />
    ) : null;

  return { open: openModal, element };
}
