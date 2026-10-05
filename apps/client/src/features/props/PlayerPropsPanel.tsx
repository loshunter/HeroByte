// ============================================================================
// PLAYER PROPS PANEL
// ============================================================================
// The player-facing prop surface, visible only while the table's
// playerPropsEnabled toggle is on. Two presentations, mirroring the DM menu
// (M4b): "window" is the desktop shape — a 📦 PROPS launcher in the Party
// bar's dock plus a DraggableWindow; "content" renders only the inner content for a host that
// already provides the surface (the mobile props screen).
//
// Self-contained on purpose: launcher state lives here; the only thing a
// layout threads in is the dock the launcher renders into (U7, IA-15).

import { useState } from "react";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../../components/ui/JRPGPanel";
import { DraggableWindow } from "../../components/dice/DraggableWindow";
import { usePlayerProps } from "./usePlayerProps";
import { PlayerPropForm } from "./PlayerPropForm";
import { PlayerPropEditor } from "./PlayerPropEditor";
import {
  DockedLauncher,
  LAUNCHER_ORDER,
  type LauncherPresentation,
} from "../../components/layout/party/LauncherDock";

export type PlayerPropsPanelProps = {
  snapshot: RoomSnapshot | null;
  uid: string;
  sendMessage: (message: ClientMessage) => void;
  camera: { x: number; y: number; scale: number };
} & LauncherPresentation;

export function PlayerPropsPanel(props: PlayerPropsPanelProps) {
  const { snapshot, uid, sendMessage, camera } = props;
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
              locked={
                snapshot?.sceneObjects?.some((o) => o.id === `prop:${prop.id}` && o.locked) === true
              }
            />
          ))}
        </div>
      )}
    </div>
  );

  if (props.presentation === "content") {
    return content;
  }

  return (
    <>
      {/* In the Party bar's dock, right of World (IA-15). Only players see
          it, so it never sits beside the DM MENU launcher. */}
      <DockedLauncher dock={props.launcherDock} order={LAUNCHER_ORDER.props}>
        <JRPGButton onClick={() => setOpen((prev) => !prev)} variant={open ? "primary" : "default"}>
          📦 PROPS
        </JRPGButton>
      </DockedLauncher>

      {open && (
        <DraggableWindow
          interaction={{ behavior: "block" }}
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
