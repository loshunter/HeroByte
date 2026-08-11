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

import { useState } from "react";
import type { Prop, Player } from "@herobyte/shared";
import { PROP_CREATE_LIMITS } from "@herobyte/shared";
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
  /** Callback invoked when the user clicks the "Add Prop" button; `count`
   *  scatters that many in ONE message (the creation guard drops N sends). */
  onCreateProp: (count?: number) => void;
  /** Callback invoked when a prop is updated via the PropEditor */
  onUpdateProp: (id: string, updates: Pick<Prop, "label" | "imageUrl" | "owner" | "size">) => void;
  /** Callback invoked when a prop is deleted via the PropEditor */
  onDeleteProp: (id: string) => void;
  /** Whether prop creation is in progress */
  isCreatingProp?: boolean;
  /** Error message from prop creation attempt */
  propCreationError?: string | null;
  /** Whether prop deletion is in progress */
  isDeletingProp?: boolean;
  /** ID of the prop currently being deleted */
  deletingPropId?: string | null;
  /** Error message from prop deletion attempt */
  propDeletionError?: string | null;
  /** Whether prop update is in progress */
  isUpdatingProp?: boolean;
  /** Error message from prop update attempt */
  propUpdateError?: string | null;
  /** ID of the prop currently being updated */
  updatingPropId?: string | null;
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
  isCreatingProp = false,
  propCreationError = null,
  isDeletingProp = false,
  deletingPropId = null,
  propDeletionError = null,
  isUpdatingProp = false,
  propUpdateError = null,
  updatingPropId = null,
}: PropsTabProps) {
  // Same shape as the NPC ×N control: string state so the field can sit
  // empty mid-edit, clamped here, reconciled on blur, button label honest.
  const [countInput, setCountInput] = useState("1");
  const parsedCount = Number.parseInt(countInput, 10);
  const count = Number.isFinite(parsedCount)
    ? Math.min(Math.max(parsedCount, PROP_CREATE_LIMITS.COUNT_MIN), PROP_CREATE_LIMITS.COUNT_MAX)
    : PROP_CREATE_LIMITS.COUNT_MIN;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Wraps for the same reason the NPC row does: the ×N control makes
          this row wider than the panel at some widths. */}
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
          Props & Objects
        </h4>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label
            style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}
            className="jrpg-text-small"
          >
            <span aria-hidden="true">×</span>
            <input
              type="number"
              min={PROP_CREATE_LIMITS.COUNT_MIN}
              max={PROP_CREATE_LIMITS.COUNT_MAX}
              step={1}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              onBlur={() => setCountInput(String(count))}
              aria-label="How many props to add"
              style={{ width: "44px", fontSize: "10px", padding: "4px" }}
            />
          </label>
          <JRPGButton
            variant="success"
            onClick={() => onCreateProp(count)}
            disabled={isCreatingProp}
            style={{ fontSize: "10px", padding: "6px 12px" }}
            title={
              count > 1 ? `Scatter ${count} props around the viewport centre` : "Add a single prop"
            }
          >
            {isCreatingProp ? "Creating..." : count > 1 ? `+ Add ${count} Props` : "+ Add Prop"}
          </JRPGButton>
        </div>
      </div>

      {propCreationError && (
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
          {propCreationError}
        </JRPGPanel>
      )}

      {props.length === 0 ? (
        <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          No props yet. Use &ldquo;Add Prop&rdquo; to create one.
        </JRPGPanel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {props.map((prop) => {
            const isThisPropDeleting = isDeletingProp && deletingPropId === prop.id;
            const isThisPropUpdating = isUpdatingProp && updatingPropId === prop.id;
            return (
              <PropEditor
                key={prop.id}
                prop={prop}
                players={players}
                onUpdate={(updates) => onUpdateProp(prop.id, updates)}
                onDelete={() => onDeleteProp(prop.id)}
                isDeleting={isThisPropDeleting}
                deletionError={isThisPropDeleting ? propDeletionError : null}
                isUpdating={isThisPropUpdating}
                updateError={isThisPropUpdating ? propUpdateError : null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
