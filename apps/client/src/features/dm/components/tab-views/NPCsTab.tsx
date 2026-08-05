// ============================================================================
// NPCS TAB COMPONENT
// ============================================================================
// Composition component for the NPCs & Monsters tab view in DMMenu.
// Extracted from DMMenu.tsx as part of Phase 5: Tab Views refactoring.
//
// This component is responsible for:
// - Displaying the NPCs tab header with "Add NPC" button
// - Rendering an empty state message when no NPCs exist
// - Rendering a list of NPCEditor components for each NPC
//
// This is a pure composition component that arranges existing UI components
// (JRPGPanel, JRPGButton, NPCEditor) without implementing business logic.

import { useState } from "react";
import type { Character, SnapshotCharacter } from "@herobyte/shared";
import { NPC_CREATE_LIMITS } from "@herobyte/shared";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";
import { NPCEditor } from "../NPCEditor";
import { useBulkInitiativeRoll } from "../../../../hooks/useBulkInitiativeRoll";
import type { CreateNpcRequest } from "../../hooks/useNpcCreation";

/**
 * Props for the NPCsTab component
 */
interface NPCsTabProps {
  /** Array of NPC characters to display */
  npcs: SnapshotCharacter[];
  /** Callback to create a new NPC (optionally several at once) */
  onCreateNPC: (request?: CreateNpcRequest) => void;
  /** Callback to copy an existing NPC's stats and art into a new one */
  onDuplicateNPC: (id: string) => void;
  /** Callback to update an NPC's properties */
  onUpdateNPC: (id: string, updates: Partial<Character>) => void;
  /** Callback to place an NPC token on the map */
  onPlaceNPCToken: (id: string) => void;
  /** Callback to delete an NPC */
  onDeleteNPC: (id: string) => void;
  /** Whether NPC creation is in progress */
  isCreatingNpc?: boolean;
  /** Error message from NPC creation attempt */
  npcCreationError?: string | null;
  /** Whether an NPC update is in progress */
  isUpdatingNpc?: boolean;
  /** Error message from NPC update attempt */
  npcUpdateError?: string | null;
  /** ID of the NPC currently being updated */
  updatingNpcId?: string | null;
  /** Whether a token placement is in progress */
  isPlacingToken?: boolean;
  /** Error message from token placement attempt */
  tokenPlacementError?: string | null;
  /** ID of the NPC whose token is being placed */
  placingTokenForNpcId?: string | null;
  /** Toast notification functions */
  toast?: {
    success: (message: string) => void;
    error: (message: string) => void;
  };
  /** Callback to set initiative for a character */
  onSetInitiative?: (characterId: string, initiative: number, modifier: number) => void;
}

/**
 * NPCsTab component - Displays and manages NPCs & Monsters
 *
 * Renders a tab view containing:
 * - A header with the tab title and "Add NPC" button
 * - An empty state message when no NPCs exist
 * - A list of NPCEditor components for managing individual NPCs
 *
 * @param props - Component props
 * @returns The rendered NPCs tab view
 */
export default function NPCsTab({
  npcs,
  onCreateNPC,
  onDuplicateNPC,
  onUpdateNPC,
  onPlaceNPCToken,
  onDeleteNPC,
  isCreatingNpc = false,
  npcCreationError = null,
  isUpdatingNpc = false,
  npcUpdateError = null,
  updatingNpcId = null,
  isPlacingToken = false,
  tokenPlacementError = null,
  placingTokenForNpcId = null,
  toast,
  onSetInitiative,
}: NPCsTabProps) {
  // Callback to set initiative for a character - uses proper set-initiative WebSocket message
  const handleSetInitiative = (
    characterId: string,
    initiative: number,
    initiativeModifier: number,
  ) => {
    if (onSetInitiative) {
      onSetInitiative(characterId, initiative, initiativeModifier);
    }
  };

  const { rollAllInitiative, isRolling } = useBulkInitiativeRoll(npcs, handleSetInitiative);

  // How many the next "+ Add NPC" makes. Kept as a string so the field can be
  // empty mid-edit instead of snapping back to 1 under the DM's cursor.
  const [countInput, setCountInput] = useState("1");
  const parsedCount = Number.parseInt(countInput, 10);
  const count = Number.isFinite(parsedCount)
    ? Math.min(Math.max(parsedCount, NPC_CREATE_LIMITS.COUNT_MIN), NPC_CREATE_LIMITS.COUNT_MAX)
    : NPC_CREATE_LIMITS.COUNT_MIN;

  const handleRollAllInitiative = async () => {
    const count = await rollAllInitiative();
    if (count > 0 && toast) {
      toast.success(`Rolled initiative for ${count} NPC${count === 1 ? "" : "s"}`);
    } else if (count === 0 && toast) {
      toast.error("No NPCs without initiative to roll for");
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Wraps because the ×N control made this row wider than the DM panel:
          measured at 907px of content in an 881px box, which pushed the Add
          button's right edge off the panel. Same shape of bug the drawing and
          selection sheets each hit, and the same fix — let it fall to a second
          line rather than silently clipping a control. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <h4 className="jrpg-text-command" style={{ margin: 0 }}>
          NPCs & Monsters
        </h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {npcs.length > 0 && (
            <JRPGButton
              variant="primary"
              onClick={handleRollAllInitiative}
              disabled={isRolling || !toast}
              style={{ fontSize: "10px", padding: "6px 12px" }}
            >
              {/* "Missing", not "all": it skips any NPC that already has a value. */}
              {isRolling ? "Rolling..." : "⚔️ Roll Missing Initiative"}
            </JRPGButton>
          )}
          {/* The count sits BEFORE the button so it reads as "× 5 → + Add NPC",
              and so a DM who wants one never has to touch it. */}
          <label
            style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}
            className="jrpg-text-small"
          >
            <span aria-hidden="true">×</span>
            <input
              type="number"
              min={NPC_CREATE_LIMITS.COUNT_MIN}
              max={NPC_CREATE_LIMITS.COUNT_MAX}
              step={1}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              // Snap the display back to what will actually be sent, so the
              // field can never disagree with the button next to it.
              onBlur={() => setCountInput(String(count))}
              aria-label="How many NPCs to add"
              style={{ width: "44px", fontSize: "10px", padding: "4px" }}
            />
          </label>
          <JRPGButton
            variant="success"
            onClick={() => onCreateNPC({ count })}
            disabled={isCreatingNpc}
            style={{ fontSize: "10px", padding: "6px 12px" }}
            title={
              count > 1 ? `Add ${count} NPCs, numbered from the next free one` : "Add a single NPC"
            }
          >
            {isCreatingNpc ? "Creating..." : count > 1 ? `+ Add ${count} NPCs` : "+ Add NPC"}
          </JRPGButton>
        </div>
      </div>

      {npcCreationError && (
        <JRPGPanel
          variant="simple"
          style={{
            color: "var(--jrpg-red)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.45,
            fontSize: "11px",
            padding: "6px 8px",
            border: "1px solid var(--jrpg-red)",
            background: "rgba(214, 60, 83, 0.1)",
          }}
        >
          {npcCreationError}
        </JRPGPanel>
      )}

      {npcs.length === 0 ? (
        <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          No NPCs yet. Use &ldquo;Add NPC&rdquo; to create one.
        </JRPGPanel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {npcs.map((npc) => (
            <NPCEditor
              key={npc.id}
              npc={npc}
              onUpdate={(updates) => onUpdateNPC(npc.id, updates)}
              onPlace={() => onPlaceNPCToken(npc.id)}
              onDuplicate={() => onDuplicateNPC(npc.id)}
              onDelete={() => onDeleteNPC(npc.id)}
              isDuplicating={isCreatingNpc}
              isUpdating={isUpdatingNpc && updatingNpcId === npc.id}
              updateError={updatingNpcId === npc.id ? npcUpdateError : null}
              isPlacingToken={isPlacingToken && placingTokenForNpcId === npc.id}
              tokenPlacementError={placingTokenForNpcId === npc.id ? tokenPlacementError : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
