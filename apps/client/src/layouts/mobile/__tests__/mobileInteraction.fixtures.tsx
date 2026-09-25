import { useLayoutEffect, useState } from "react";
import { vi } from "vitest";
import { MobileFloatingControls } from "../../../components/layout/MobileFloatingControls";
import { useMobileSurface, type MobileSurfaceMachine } from "../../../hooks/useMobileSurface";
import type { MapEditToolbarProps } from "../../../features/map-edit/mapEditTypes";
import { MobileScreen } from "../MobileScreen";

export function toolbarProps(): MapEditToolbarProps {
  return {
    mapName: "Fixture map",
    activeGroup: "structures",
    onSelectGroup: vi.fn(),
    populateTarget: null,
    populateHint: "Draw a room or hallway first.",
    isLive: false,
    busy: false,
    saving: false,
    activeSubTool: "wall",
    onSelectSubTool: vi.fn(),
    floorFamily: "grass",
    onSelectFloorFamily: vi.fn(),
    roomWallFamily: "stone-wall",
    onSelectRoomWallFamily: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onStartLiveMap: vi.fn(),
    onClose: vi.fn(),
    hasRasterBackground: false,
    error: null,
    wallsOverlayPinned: false,
    onToggleWallsOverlay: vi.fn(),
    selectedAssetId: "objects:crate",
    onSelectAsset: vi.fn(),
    uploadAsset: async () => {
      throw new Error("Unused upload");
    },
    assetPickerOpen: false,
    stampMode: false,
    onToggleStampMode: vi.fn(),
    stampRotation: 0,
    onRotateStamp: vi.fn(),
    onToggleAssetPicker: vi.fn(),
    hallwayWidth: 2,
    onSelectHallwayWidth: vi.fn(),
    splineKind: "rope",
    onSelectSplineKind: vi.fn(),
    populateDensity: "medium",
    onSelectPopulateDensity: vi.fn(),
    populateCategory: "objects",
    onSelectPopulateCategory: vi.fn(),
    onPopulate: vi.fn(),
    canPopulate: false,
    generateParams: { theme: "stone", density: "medium", seed: 1 },
    onGenerateParamsChange: vi.fn(),
    onRerollSeed: vi.fn(),
    onGenerate: vi.fn(),
    canGenerate: false,
    generateRegion: null,
    generateHint: null,
    layers: [],
    selectedElement: null,
    onUpdateLayer: vi.fn(),
    onMoveLayer: vi.fn(),
    onUpdateElement: vi.fn(),
    onUpdateDoor: vi.fn(),
    onRemoveElement: vi.fn(),
    layersOpen: false,
    onToggleLayers: vi.fn(),
    inspectorOpen: false,
    onToggleInspector: vi.fn(),
  };
}

export function MobileWorldHost({
  isDM = false,
  mapEditMode = false,
  onMachine,
}: {
  isDM?: boolean;
  mapEditMode?: boolean;
  onMachine: (machine: MobileSurfaceMachine) => void;
}) {
  const [diceRollerOpen, toggleDiceRoller] = useState(false);
  const [rollLogOpen, toggleRollLog] = useState(false);
  const machine = useMobileSurface({
    diceRollerOpen,
    rollLogOpen,
    toggleDiceRoller,
    toggleRollLog,
    mapEditMode,
    alignmentMode: false,
    isDM,
  });
  useLayoutEffect(() => {
    onMachine(machine);
  });
  return (
    <>
      <output data-testid="surface">{machine.surface}</output>
      <MobileFloatingControls
        worldReturn={machine.worldReturn}
        surface={machine.surface}
        onToggleSurface={machine.toggleSurface}
        onToolSelect={vi.fn()}
        onSnapToGridChange={vi.fn()}
        onResetCamera={vi.fn()}
        activeTool={null}
        snapToGrid={false}
        isDM={isDM}
        mode={machine.mode}
        mapEditToolbarProps={toolbarProps()}
      />
      {machine.surface === "atlas" && !isDM && (
        <MobileScreen
          title="World Map"
          surface="atlas"
          onClose={machine.worldReturn.closeExplicitly}
          interaction={{
            behavior: "close",
            panel: "world",
            resolveReturnFocus: machine.worldReturn.resolveTarget,
          }}
        >
          <p>World contents are irrelevant to navigation; the actual screen is mounted.</p>
        </MobileScreen>
      )}
      {machine.surface === "log" && (
        <MobileScreen
          title="Chat & Rolls"
          surface="log"
          onClose={machine.closeExplicitSurface}
          interaction={{ behavior: "close", panel: "chat" }}
        >
          <input aria-label="Chat text" />
        </MobileScreen>
      )}
    </>
  );
}
