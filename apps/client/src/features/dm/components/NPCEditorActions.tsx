// ============================================================================
// NPC EDITOR ACTIONS
// ============================================================================
// The Place / Duplicate / Delete row from an NPC card.
//
// Extracted from NPCEditor.tsx, which sat at 339 of the 348-line structural
// ceiling — adding a third action inline would have made it a new violator.

import { JRPGButton } from "../../../components/ui/JRPGPanel";

interface NPCEditorActionsProps {
  /** Used only in the delete confirmation copy. */
  npcName: string;
  onPlace: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isUpdating?: boolean;
  isPlacingToken?: boolean;
  isDuplicating?: boolean;
}

export function NPCEditorActions({
  npcName,
  onPlace,
  onDuplicate,
  onDelete,
  isUpdating = false,
  isPlacingToken = false,
  isDuplicating = false,
}: NPCEditorActionsProps) {
  const busy = isUpdating || isPlacingToken;

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <JRPGButton
        variant="primary"
        onClick={onPlace}
        disabled={busy}
        style={{ fontSize: "10px", flex: 1 }}
      >
        {isPlacingToken ? "Placing..." : "Place on Map"}
      </JRPGButton>
      <JRPGButton
        variant="success"
        onClick={onDuplicate}
        disabled={busy || isDuplicating}
        style={{ fontSize: "10px", flex: 1 }}
        title="Create another NPC with these stats and art, under the next free number"
      >
        {isDuplicating ? "Copying..." : "⧉ Duplicate"}
      </JRPGButton>
      <JRPGButton
        variant="danger"
        onClick={() => {
          // Deleting an NPC also force-removes its placed token server-side,
          // and Ctrl+Z does not cover either. Every sibling delete in the app
          // confirms first; this one used to fire on a single click.
          if (window.confirm(`Delete "${npcName}"? This also removes its token from the map.`)) {
            onDelete();
          }
        }}
        disabled={busy}
        style={{ fontSize: "10px", flex: 1 }}
      >
        Delete
      </JRPGButton>
    </div>
  );
}
