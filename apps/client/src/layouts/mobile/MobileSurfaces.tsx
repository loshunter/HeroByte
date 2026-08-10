// ============================================================================
// MOBILE SURFACES
// ============================================================================
// The single host for every surface the mobile shell can open: party, dice,
// log, help and dm (a placeholder until M4b ships the menu). MobileLayout
// renders exactly one of these because useMobileSurface derives exactly one —
// every open surface root carries data-mobile-surface so a test can count
// them rather than trust that claim.

import React, { Suspense, lazy } from "react";
import type { MainLayoutProps } from "../props/MainLayoutProps";
import type { MobileSurfaceMachine } from "../../hooks/useMobileSurface";
import { RollLogContent } from "../../components/dice/RollLogContent";
import { MobileDiceRoller } from "../../components/dice/MobileDiceRoller";
import { MobileEntitiesList } from "../../components/layout/MobileEntitiesList";
import { HelpPanel } from "../../features/help/HelpPanel";
import { Spinner } from "../../components/ui/Spinner";
import { useEntityEditHandlers } from "../../hooks/useEntityEditHandlers";
import { useInitiativeSetting } from "../../hooks/useInitiativeSetting";
import { buildDMMenuProps } from "../../features/dm/buildDMMenuProps";
import { MobileScreen } from "./MobileScreen";

// The same lazy split the desktop uses: DM-only code stays out of the entry
// bundle until someone actually elevates (FloatingPanelsLayout does this too).
const DMMenuContainer = lazy(() =>
  import("../../features/dm/lazy-entry").then((mod) => ({ default: mod.DMMenuContainer })),
);

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

  // Mobile's own instance, deliberately: on desktop MainLayout shares one
  // between the entities panel and the DM menu, but mobile has no entities
  // panel — and the builder cannot call hooks, so the caller owns this.
  const { setInitiative } = useInitiativeSetting({
    snapshot: props.snapshot,
    sendMessage: props.sendMessage,
  });
  const dmMenuProps = buildDMMenuProps(props, { setInitiative });

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

      {showParty && (
        <MobileScreen title="Party Members" surface="party" onClose={closeSurface}>
          <MobileEntitiesList
            players={props.snapshot?.players || []}
            characters={props.snapshot?.characters || []}
            uid={props.uid}
            isDM={props.isDM}
            // The mobile settings sheet is the ONLY DM-elevation control on a
            // phone, and it used to be wired to a no-op — so a mobile user
            // could never become DM at all.
            onToggleDMMode={props.handleToggleDM}
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
        </MobileScreen>
      )}

      {surface === "log" && (
        <MobileScreen title="Roll Log" surface="log" onClose={closeSurface}>
          <RollLogContent
            canClearLog={props.isDM}
            rolls={props.rollHistory}
            onClearLog={props.handleClearLog}
            onViewRoll={props.handleViewRoll}
            chatMessages={props.chatMessages}
            players={props.snapshot?.players ?? []}
            currentUid={props.uid}
            onSendChat={props.handleSendChat}
          />
        </MobileScreen>
      )}

      {/* Gated on isDM as well as the surface: de-elevating with the screen
          open must not leave an empty shell up (DMMenu would render null),
          and the same guard is what the desktop's auto-close effect does. */}
      {surface === "dm" && props.isDM && (
        <MobileScreen title="DM Menu" surface="dm" onClose={closeSurface}>
          <Suspense
            fallback={
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Spinner size={14} />
                Loading DM tools…
              </div>
            }
          >
            <DMMenuContainer {...dmMenuProps} presentation="content" />
          </Suspense>
        </MobileScreen>
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
