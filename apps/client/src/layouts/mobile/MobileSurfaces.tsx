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
import { DMMenuLoadFailure } from "../../features/dm/DMMenuLoadFailure";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { PlayerPropsPanel } from "../../features/props/PlayerPropsPanel";
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
  const { rollAllInitiative } = useInitiativeSetting({
    snapshot: props.snapshot,
    sendMessage: props.sendMessage,
  });
  const dmMenuProps = buildDMMenuProps(props, { rollAllInitiative });

  return (
    <>
      {surface === "dice" && (
        <div style={{ display: "contents" }} data-mobile-surface="dice">
          <MobileDiceRoller
            onRoll={props.handleRoll}
            latestOwnRoll={props.latestOwnRoll}
            onEnterRoll={props.handleEnterRoll}
            onOverrideRoll={(rollId, total) => props.handleEnterRoll({ rollId, total })}
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
          {/* The one way into map-edit on a phone. It lives HERE rather than
              in the tool sheet because the mode is DM-only and this screen is
              already the DM gate — and because arming it closes this screen
              by itself (useMobileSurface), which is the behaviour a Mode
              needs: nothing may cover the map. */}
          <button
            type="button"
            className="mobile-chip mobile-screen__action"
            onClick={() => props.setActiveTool("map-edit")}
          >
            🏗️ Edit the live map
          </button>
          {/* Local boundary: a failed chunk load costs the DM their menu, not
              the table. Without it the throw reaches the app root and replaces
              the whole session with a full-page error. */}
          <ErrorBoundary fallback={<DMMenuLoadFailure />}>
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
          </ErrorBoundary>
        </MobileScreen>
      )}

      {/* Gated on the snapshot flag as well as the surface — the DM flipping
          the toggle off must not leave an empty shell up, the same shape the
          dm screen uses for de-elevation. A dropped socket nulls the snapshot
          and unmounts this too; that is a hidden screen during reconnect, not
          a destructive act, and it re-renders when the roster returns. */}
      {surface === "props" && !props.isDM && props.snapshot?.playerPropsEnabled && (
        <MobileScreen title="Props" surface="props" onClose={closeSurface}>
          <PlayerPropsPanel
            snapshot={props.snapshot}
            uid={props.uid}
            sendMessage={props.sendMessage}
            camera={props.camera}
            presentation="content"
          />
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
