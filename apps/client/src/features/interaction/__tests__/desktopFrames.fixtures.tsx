import { useState } from "react";
import { vi } from "vitest";
import type { DicePanelsProps } from "../../../layouts/DicePanels";
import { CardControls } from "../../players/components/CardControls";
import { PlayerSettingsMenu } from "../../players/components/PlayerSettingsMenu";

export function CharacterHarness({
  submit,
  close,
  blurDuringClose = false,
}: {
  submit: () => void;
  close: () => void;
  blurDuringClose?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Alice");
  return (
    <>
      <CardControls
        canControlMic={false}
        canOpenSettings
        micEnabled={false}
        onToggleMic={() => {}}
        onOpenSettings={() => setOpen(true)}
      />
      <PlayerSettingsMenu
        isOpen={open}
        onClose={() => {
          // Deliberately exercise blur before removal; an unmount-only jsdom test
          // could pass accidentally because the browser often omits that blur.
          if (blurDuringClose) (document.activeElement as HTMLElement | null)?.blur();
          close();
          setOpen(false);
        }}
        selectedEffects={[]}
        onStatusEffectsChange={() => {}}
        onToggleDMMode={() => {}}
        nameInput={name}
        onNameInputChange={setName}
        onNameSubmit={submit}
      />
    </>
  );
}

export const roll = (id = "roll-1") => ({
  id,
  playerUid: "me",
  playerName: "Me",
  formula: "d20",
  perDie: [{ tokenId: "t0", die: "d20" as const, rolls: [15], subtotal: 15 }],
  total: 15,
  timestamp: 0,
});

export function dicePanelProps(): DicePanelsProps {
  return {
    diceRollerOpen: false,
    toggleDiceRoller: vi.fn(),
    handleRoll: vi.fn(),
    latestOwnRoll: null,
    handleEnterRoll: vi.fn(),
    canEnterOver: () => false,
    rollLogOpen: true,
    toggleRollLog: vi.fn(),
    rollHistory: [],
    handleClearLog: vi.fn(),
    viewingRoll: null,
    handleViewRoll: vi.fn(),
    chatMessages: [],
    players: [],
    uid: "me",
    handleSendChat: vi.fn(),
    isDM: false,
  };
}

// Values mirror the existing real DMMenu surface test, without its shell mocks.
export function dmProps() {
  return {
    // U7: a window-presentation menu renders its launcher into the Party dock.
    launcherDock: document.body,
    isDM: true,
    onToggleDM: vi.fn(),
    gridSize: 50,
    gridSquareSize: 5,
    gridLocked: false,
    onGridLockToggle: vi.fn(),
    onGridSizeChange: vi.fn(),
    onGridSquareSizeChange: vi.fn(),
    onClearDrawings: vi.fn(),
    onSetMapBackground: vi.fn(),
    playerCount: 2,
    camera: { x: 0, y: 0, scale: 1 },
    characters: [],
    atlasNodes: [],
    onAtlasMessage: vi.fn(),
    props: [],
    players: [],
    onCreateProp: vi.fn(),
    onUpdateProp: vi.fn(),
    onDeleteProp: vi.fn(),
    onRequestLoadSession: vi.fn(),
    onCreateNPC: vi.fn(),
    onDuplicateNPC: vi.fn(),
    onUpdateNPC: vi.fn(),
    onSetNPCSpeed: vi.fn(),
    onResetNPCBudget: vi.fn(),
    onDeleteNPC: vi.fn(),
    onPlaceNPCToken: vi.fn(),
    onSetNPCStatusEffects: vi.fn(),
    onFocusNPCToken: vi.fn(),
    mapTokenIds: new Set<string>(),
    mapLocked: false,
    onMapLockToggle: vi.fn(),
    mapTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    onMapTransformChange: vi.fn(),
    alignmentModeActive: false,
    alignmentPoints: [],
    alignmentSuggestion: null,
    alignmentError: null,
    onAlignmentStart: vi.fn(),
    onAlignmentReset: vi.fn(),
    onAlignmentCancel: vi.fn(),
    onAlignmentApply: vi.fn(),
    sceneObjects: [],
    onSelectPlayerTokens: vi.fn(),
  };
}
