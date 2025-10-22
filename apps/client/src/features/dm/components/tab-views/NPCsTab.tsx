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

import type { Character } from "@shared";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";
import { NPCEditor } from "../NPCEditor";

/**
 * Props for the NPCsTab component
 */
interface NPCsTabProps {
  /** Array of NPC characters to display */
  npcs: Character[];
  /** Callback to create a new NPC */
  onCreateNPC: () => void;
  /** Callback to update an NPC's properties */
  onUpdateNPC: (id: string, updates: Partial<Character>) => void;
  /** Callback to place an NPC token on the map */
  onPlaceNPCToken: (id: string) => void;
  /** Callback to delete an NPC */
  onDeleteNPC: (id: string) => void;
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
  onUpdateNPC,
  onPlaceNPCToken,
  onDeleteNPC,
}: NPCsTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h4 className="jrpg-text-command" style={{ margin: 0 }}>
          NPCs & Monsters
        </h4>
        <JRPGButton
          variant="success"
          onClick={onCreateNPC}
          style={{ fontSize: "10px", padding: "6px 12px" }}
        >
          + Add NPC
        </JRPGButton>
      </div>

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
              onDelete={() => onDeleteNPC(npc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
