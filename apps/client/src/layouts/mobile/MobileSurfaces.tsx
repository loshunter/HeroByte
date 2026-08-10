// ============================================================================
// MOBILE SURFACES
// ============================================================================
// The single host for every surface the mobile shell can open: party, dice,
// log, help (and, from M4b, the DM screen). MobileLayout renders exactly one
// of these because useMobileSurface derives exactly one — every open surface
// root carries data-mobile-surface so a test can count them rather than trust
// that claim.

import React from "react";
import type { MainLayoutProps } from "../props/MainLayoutProps";
import type { MobileSurfaceMachine } from "../../hooks/useMobileSurface";
import { RollLog } from "../../components/dice/RollLog";
import { MobileDiceRoller } from "../../components/dice/MobileDiceRoller";
import { MobileEntitiesList } from "../../components/layout/MobileEntitiesList";
import { HelpPanel } from "../../features/help/HelpPanel";
import { useEntityEditHandlers } from "../../hooks/useEntityEditHandlers";

interface MobileSurfacesProps {
  props: MainLayoutProps;
  machine: MobileSurfaceMachine;
}

export function MobileSurfaces({ props, machine }: MobileSurfacesProps): JSX.Element {
  const { surface, closeSurface } = machine;
  const showParty = surface === "party";

  const { handleCharacterHpSubmit, handleCharacterMaxHpSubmit } = useEntityEditHandlers({
    editingHpUID: props.editingHpUID,
    editingMaxHpUID: props.editingMaxHpUID,
    editingTempHpUID: props.editingTempHpUID,
    snapshot: props.snapshot,
    submitHpEdit: props.submitHpEdit,
    submitMaxHpEdit: props.submitMaxHpEdit,
    submitTempHpEdit: props.submitTempHpEdit,
    submitNameEdit: props.submitNameEdit,
    playerActions: props.playerActions,
  });

  return (
    <>
      {surface === "dice" && (
        <div style={{ display: "contents" }} data-mobile-surface="dice">
          <MobileDiceRoller
            onRoll={props.handleRoll}
            latestOwnRoll={props.latestOwnRoll}
            onClose={closeSurface}
          />
        </div>
      )}

      {/* The drawer wrapper stays mounted so the slide transition has a
          resting state to leave from; the surface attribute rides only on an
          OPEN drawer, because closed-but-mounted is not "open". */}
      <div
        className="mobile-entities-drawer"
        data-mobile-surface={showParty ? "party" : undefined}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 2000,
          pointerEvents: showParty ? "auto" : "none",
          transform: showParty ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
        }}
      >
        {showParty && (
          <MobileEntitiesList
            players={props.snapshot?.players || []}
            characters={props.snapshot?.characters || []}
            uid={props.uid}
            isDM={props.isDM}
            // The mobile settings sheet is the ONLY DM-elevation control on a
            // phone, and it used to be wired to a no-op — so a mobile user
            // could never become DM at all.
            onToggleDMMode={props.handleToggleDM}
            onClose={closeSurface}
            editingHpUID={props.editingHpUID}
            hpInput={props.hpInput}
            onHpInputChange={props.updateHpInput}
            onHpEdit={props.startHpEdit}
            onHpSubmit={handleCharacterHpSubmit}
            editingMaxHpUID={props.editingMaxHpUID}
            maxHpInput={props.maxHpInput}
            onMaxHpInputChange={props.updateMaxHpInput}
            onMaxHpEdit={props.startMaxHpEdit}
            onMaxHpSubmit={handleCharacterMaxHpSubmit}
            onCharacterHpChange={props.playerActions.updateCharacterHP}
            onCharacterStatusEffectsChange={props.playerActions.setCharacterStatusEffects}
            onCharacterNameUpdate={props.playerActions.updateCharacterName}
            onCharacterPortraitUpdate={props.playerActions.setCharacterPortrait}
            tokens={props.snapshot?.tokens || []}
            onTokenVisionRadiusChange={props.updateTokenVisionRadius}
          />
        )}
      </div>

      {surface === "log" && (
        <div className="mobile-roll-log-panel" data-mobile-surface="log">
          <RollLog
            canClearLog={props.isDM}
            rolls={props.rollHistory}
            onClearLog={props.handleClearLog}
            onClose={closeSurface}
            onViewRoll={props.handleViewRoll}
            chatMessages={props.chatMessages}
            players={props.snapshot?.players ?? []}
            currentUid={props.uid}
            onSendChat={props.handleSendChat}
          />
        </div>
      )}

      {surface === "help" && (
        <div
          className="mobile-help-sheet"
          role="dialog"
          aria-label="HeroByte help"
          data-mobile-surface="help"
        >
          <div className="mobile-tool-sheet__header">
            <strong>Help</strong>
            <button
              type="button"
              className="mobile-tool-sheet__close"
              onClick={closeSurface}
              aria-label="Close help"
            >
              ✕
            </button>
          </div>
          <HelpPanel />
        </div>
      )}
    </>
  );
}
