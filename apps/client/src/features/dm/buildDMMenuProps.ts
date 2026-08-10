/**
 * buildDMMenuProps — the ONE mapping from the MainLayoutProps bag onto
 * DMMenuContainer's props (M4b, mobile-shell-redesign §2).
 *
 * Before this file the mapping lived in two hops that only the desktop had:
 * MainLayout renamed (handleToggleDM → onToggleDM, setGridSize →
 * onGridSizeChange, …) and FloatingPanelsLayout derived (fogEnabled off the
 * snapshot, the lock/transform lambdas off the scene objects). Mobile takes
 * the whole bag too, so a second hand-wiring there is exactly the drift that
 * made the mobile gap expensive — both layouts call this instead.
 *
 * PURE over the bag, with one exception carried explicitly: onSetInitiative
 * comes from useInitiativeSetting, a HOOK the caller must own — a builder
 * cannot call hooks, and hiding one inside a "pure" mapper would be worse
 * than the extra argument.
 */

import type { MainLayoutProps } from "../../layouts/props/MainLayoutProps";
import type { DMMenuContainerProps } from "./components/DMMenuContainer";

export interface DMMenuPropExtras {
  /** From useInitiativeSetting({ snapshot, sendMessage }) at the call site. */
  setInitiative?: (characterId: string, initiative: number, modifier: number) => void;
}

export function buildDMMenuProps(
  props: MainLayoutProps,
  extras: DMMenuPropExtras,
): DMMenuContainerProps {
  const { snapshot, mapSceneObject, stagingZoneSceneObject } = props;

  return {
    // DM status
    isDM: props.isDM,
    onToggleDM: props.handleToggleDM,

    // Grid
    gridSize: props.gridSize,
    gridSquareSize: props.gridSquareSize,
    gridLocked: props.gridLocked,
    onGridLockToggle: () => props.setGridLocked((prev) => !prev),
    onGridSizeChange: props.setGridSize,
    onGridSquareSizeChange: props.setGridSquareSize,

    // Fog of war — derived from the snapshot; the change handler is the one
    // place outside a hook that this menu speaks the wire protocol.
    fogEnabled: snapshot?.fogEnabled ?? false,
    hasCompiledScene: Boolean(snapshot?.compiledScene),
    onFogEnabledChange: (enabled) => props.sendMessage({ t: "set-fog-enabled", enabled }),

    // Map
    onClearDrawings: props.handleClearDrawings,
    onSetMapBackground: props.setMapBackgroundURL,
    mapBackground: snapshot?.mapBackground,
    mapLocked: mapSceneObject?.locked ?? true,
    onMapLockToggle: () => {
      if (mapSceneObject) {
        props.toggleSceneObjectLock(mapSceneObject.id, !mapSceneObject.locked);
      }
    },
    mapTransform: mapSceneObject?.transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    onMapTransformChange: (transform) => {
      if (mapSceneObject) {
        props.transformSceneObject({
          id: mapSceneObject.id,
          ...(transform.x !== undefined && transform.y !== undefined
            ? { position: { x: transform.x, y: transform.y } }
            : {}),
          ...(transform.scaleX !== undefined && transform.scaleY !== undefined
            ? { scale: { x: transform.scaleX, y: transform.scaleY } }
            : {}),
          ...(transform.rotation !== undefined ? { rotation: transform.rotation } : {}),
        });
      }
    },

    // Staging zone
    playerStagingZone: snapshot?.playerStagingZone,
    onSetPlayerStagingZone: props.playerActions.setPlayerStagingZone,
    stagingZoneLocked: stagingZoneSceneObject?.locked ?? false,
    onStagingZoneLockToggle: () => {
      if (stagingZoneSceneObject) {
        props.toggleSceneObjectLock(stagingZoneSceneObject.id, !stagingZoneSceneObject.locked);
      }
    },

    // Alignment
    alignmentModeActive: props.alignmentMode,
    alignmentPoints: props.alignmentPoints,
    alignmentSuggestion: props.alignmentSuggestion,
    alignmentError: props.alignmentError,
    onAlignmentStart: props.handleAlignmentStart,
    onAlignmentReset: props.handleAlignmentReset,
    onAlignmentCancel: props.handleAlignmentCancel,
    onAlignmentApply: props.handleAlignmentApply,

    // Room password / session
    onSetRoomPassword: props.handleSetRoomPassword,
    onSaveAsPrivateTable: props.onSaveAsPrivateTable,
    roomPasswordStatus: props.roomPasswordStatus,
    roomPasswordPending: props.roomPasswordPending,
    onDismissRoomPasswordStatus: props.dismissRoomPasswordStatus,

    // Raw dependencies for useDMContext
    snapshot: props.snapshot,
    sendMessage: props.sendMessage,
    camera: props.camera,
    toast: props.toast,

    // Other actions
    onSelectPlayerTokens: props.selectPlayerTokens,
    onSetInitiative: extras.setInitiative,
    mapStudio: props.mapStudio,
  };
}
