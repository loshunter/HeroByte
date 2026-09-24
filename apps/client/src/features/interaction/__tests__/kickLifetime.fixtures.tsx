import { useRef, useState } from "react";
import type { RoomSnapshot } from "@herobyte/shared";
import type { ToolMode } from "../../../components/layout/Header";
import { MobileLayout } from "../../../layouts/MobileLayout";
import { KickPanel } from "../../atlas/KickPanel";
import { useKickedInDoor, type AtlasErrorMessage } from "../../atlas/useKickedInDoor";
import { createKickMobileProps } from "./kickMobile.props";
import type { KickCalls } from "./popoverOwners.fixtures";

const roster = {
  players: [],
  characters: [],
  tokens: [],
  drawings: [],
  props: [],
  compiledScene: { sourceDocumentId: "map-a" },
  atlasNodes: [{ name: "Dungeon" }],
} as unknown as RoomSnapshot;

// App lifetime remains mounted while its desktop/mobile child is replaced.
// MobileLayout, its surface machine/screens, Kick hook, and panel are real.
export function KickLayoutHarness({
  mobile,
  calls,
  isDM = true,
  snapshot = roster,
  tool = null,
}: {
  mobile: boolean;
  calls: KickCalls;
  isDM?: boolean;
  snapshot?: RoomSnapshot | null;
  tool?: ToolMode;
}) {
  const atlasErrorRef = useRef<((message: AtlasErrorMessage) => void) | null>(null);
  const [diceRollerOpen, toggleDiceRoller] = useState(false);
  const [rollLogOpen, toggleRollLog] = useState(false);
  const kick = useKickedInDoor({
    isDM,
    snapshot,
    activeTool: tool,
    sendMessage: calls.send,
    toast: calls.toast,
    atlasErrorRef,
    pendingToast: !mobile,
  });
  if (mobile)
    return (
      <MobileLayout
        {...createKickMobileProps()}
        isDM={isDM}
        snapshot={snapshot}
        kick={kick}
        activeTool={tool}
        pointerMode={false}
        mapEditMode={tool === "map-edit"}
        diceRollerOpen={diceRollerOpen}
        toggleDiceRoller={toggleDiceRoller}
        rollLogOpen={rollLogOpen}
        toggleRollLog={toggleRollLog}
      />
    );
  return (
    <section data-testid="desktop-kick-host">
      <button onClick={kick.openKick}>Open kick</button>
      {kick.open && <KickPanel kick={kick} atlasNodes={snapshot?.atlasNodes ?? []} />}
    </section>
  );
}
