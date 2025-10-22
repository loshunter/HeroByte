// ============================================================================
// PROPS TAB COMPONENT
// ============================================================================
// Composition component that renders the Props & Objects tab view within the
// DM Menu. Displays a list of props (interactive objects) that can be placed
// on the map, with controls to create, edit, and delete them.
//
// This is a pure presentation/composition component - it arranges existing
// UI components (JRPGButton, JRPGPanel, PropEditor) without additional logic.
// The component handles the display of an empty state when no props exist,
// and renders a scrollable list of PropEditor components when props are present.

import type { Prop, Player } from "@shared";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";
import { PropEditor } from "../PropEditor";

/**
 * Props for the PropsTab component.
 */
interface PropsTabProps {
  /** Array of prop entities to display and manage */
  props: Prop[];
  /** Array of player entities (used for prop ownership assignment) */
  players: Player[];
  /** Callback invoked when the user clicks the "Add Prop" button */
  onCreateProp: () => void;
  /** Callback invoked when a prop is updated via the PropEditor */
  onUpdateProp: (id: string, updates: Pick<Prop, "label" | "imageUrl" | "owner" | "size">) => void;
  /** Callback invoked when a prop is deleted via the PropEditor */
  onDeleteProp: (id: string) => void;
}

/**
 * PropsTab - Renders the Props & Objects tab view for the DM Menu.
 *
 * Displays a header with the tab title and an "Add Prop" button, followed by
 * either an empty state message (when no props exist) or a list of PropEditor
 * components (one for each prop).
 *
 * @param props - Component props
 * @returns The rendered Props tab view
 */
export default function PropsTab({
  props,
  players,
  onCreateProp,
  onUpdateProp,
  onDeleteProp,
}: PropsTabProps) {
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
          Props & Objects
        </h4>
        <JRPGButton
          variant="success"
          onClick={onCreateProp}
          style={{ fontSize: "10px", padding: "6px 12px" }}
        >
          + Add Prop
        </JRPGButton>
      </div>

      {props.length === 0 ? (
        <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          No props yet. Use &ldquo;Add Prop&rdquo; to create one.
        </JRPGPanel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {props.map((prop) => (
            <PropEditor
              key={prop.id}
              prop={prop}
              players={players}
              onUpdate={(updates) => onUpdateProp(prop.id, updates)}
              onDelete={() => onDeleteProp(prop.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
