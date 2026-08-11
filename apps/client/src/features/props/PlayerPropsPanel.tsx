// ============================================================================
// PLAYER PROPS PANEL
// ============================================================================
// The player-facing prop surface, visible only while the table's
// playerPropsEnabled toggle is on. Two presentations, mirroring the DM menu
// (M4b): "window" is the desktop shape — a floating 📦 PROPS launcher plus a
// DraggableWindow; "content" renders only the inner content for a host that
// already provides the surface (the mobile props screen).
//
// Self-contained on purpose: launcher state lives here, so mounting it costs
// the layouts ZERO new threaded props (the PublicTableNotice precedent).

import { useState } from "react";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../../components/ui/JRPGPanel";
import { DraggableWindow } from "../../components/dice/DraggableWindow";
import { usePlayerProps } from "./usePlayerProps";
import { PlayerPropForm } from "./PlayerPropForm";
import { PlayerPropEditor } from "./PlayerPropEditor";

export interface PlayerPropsPanelProps {
  snapshot: RoomSnapshot | null;
  uid: string;
  sendMessage: (message: ClientMessage) => void;
  camera: { x: number; y: number; scale: number };
  /** "window" (desktop launcher + DraggableWindow) or "content" (bare, for
   *  the mobile props screen). */
  presentation?: "window" | "content";
}

export function PlayerPropsPanel({
  snapshot,
  uid,
  sendMessage,
  camera,
  presentation = "window",
}: PlayerPropsPanelProps) {
  const [open, setOpen] = useState(false);
  const { ownProps, isCreating, creationError, createProps, updateProp, deleteProp } =
    usePlayerProps({ snapshot, uid, sendMessage, camera });

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px" }}>
      <JRPGPanel variant="simple" style={{ fontSize: "11px", color: "var(--jrpg-white)" }}>
        <span style={{ fontFamily: "var(--font-body)", lineHeight: 1.5 }}>
          Props you add appear for everyone. Drag them into place, or use the 🔄 Transform tool to
          scale and rotate them. The DM can always adjust or remove them.
        </span>
      </JRPGPanel>

      <PlayerPropForm
        onCreate={createProps}
        isCreating={isCreating}
        creationError={creationError}
      />

      <h4 className="jrpg-text-command" style={{ margin: 0 }}>
        Your Props ({ownProps.length})
      </h4>
      {ownProps.length === 0 ? (
        <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          Nothing yet. Add a prop above — it lands at the centre of your view.
        </JRPGPanel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {ownProps.map((prop) => (
            <PlayerPropEditor
              key={prop.id}
              prop={prop}
              onUpdate={(updates) => updateProp(prop, updates)}
              onDelete={() => deleteProp(prop.id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (presentation === "content") {
    return content;
  }

  return (
    <>
      {/* Above the DM menu's slot (bottom-right) — but only players ever see
          this launcher, so the two never actually stack. */}
      <div
        style={{
          position: "fixed",
          bottom: "32px",
          right: "32px",
          zIndex: 150,
        }}
      >
        <JRPGButton
          onClick={() => setOpen((prev) => !prev)}
          variant={open ? "primary" : "default"}
          style={{ fontSize: "10px", padding: "10px 16px" }}
        >
          📦 PROPS
        </JRPGButton>
      </div>

      {open && (
        <DraggableWindow
          title="Props"
          onClose={() => setOpen(false)}
          initialX={typeof window !== "undefined" ? window.innerWidth - 420 : 100}
          initialY={100}
          width={380}
          minWidth={340}
          maxWidth={480}
          storageKey="player-props"
          zIndex={1002}
        >
          {content}
        </DraggableWindow>
      )}
    </>
  );
}
