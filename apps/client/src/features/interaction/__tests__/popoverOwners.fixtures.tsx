import React, { useCallback, useLayoutEffect, useRef } from "react";
import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import type { ToolMode } from "../../../components/layout/Header";
import { useToolMode } from "../../../hooks/useToolMode";
import { MobileScreen } from "../../../layouts/mobile/MobileScreen";
import { PlayerSettingsMenu } from "../../players/components/PlayerSettingsMenu";
import { KickPanel } from "../../atlas/KickPanel";
import {
  useKickedInDoor,
  type AtlasErrorMessage,
  type KickControls,
} from "../../atlas/useKickedInDoor";
import { useAtlasLinkAim, type AtlasLinkAim, type PendingLink } from "../../atlas/useAtlasLinkAim";

export const PENDING: PendingLink = {
  fromNodeId: "source",
  toNodeId: "destination",
  linkType: "door",
  visibleToPlayers: true,
};
export const POINT = { x: 45, y: 60 };
export const noAction = () => {};

export function escape(
  target: EventTarget = document.body,
  init: KeyboardEventInit = {},
  before?: (event: KeyboardEvent) => void,
) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  before?.(event);
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

export function CharacterWindow({ close }: { close: () => void }) {
  return (
    <PlayerSettingsMenu
      isOpen
      onClose={close}
      selectedEffects={[]}
      onStatusEffectsChange={noAction}
      onToggleDMMode={noAction}
    />
  );
}

export function AimHarness({
  api,
  sendMessage,
  changed,
  armOnMount = false,
  scene = "doc-a",
  children,
}: {
  api: React.MutableRefObject<AtlasLinkAim | null>;
  sendMessage: (message: ClientMessage) => void;
  changed?: (tool: ToolMode) => void;
  armOnMount?: boolean;
  scene?: string;
  children?: React.ReactNode;
}) {
  const { activeTool: tool, setActiveTool: setTool } = useToolMode();
  const setActiveTool = useCallback(
    (next: ToolMode) => {
      changed?.(next);
      setTool(next);
    },
    [changed, setTool],
  );
  const aim = useAtlasLinkAim({ activeTool: tool, setActiveTool, sendMessage, sceneId: scene });
  const didArm = useRef(false);
  useLayoutEffect(() => {
    api.current = aim;
    if (armOnMount && !didArm.current) {
      didArm.current = true;
      aim.armLinkAim(PENDING);
    }
  });
  return (
    <>
      <output data-testid="aim-mode">{tool ?? "move"}</output>
      <button onClick={() => setActiveTool("draw")}>Choose drawing</button>
      {children}
    </>
  );
}

export function kickCalls() {
  return {
    close: vi.fn(),
    send: vi.fn<(message: ClientMessage) => void>(),
    toast: {
      info: vi.fn(() => "pending-toast"),
      success: vi.fn(),
      error: vi.fn(),
      dismiss: vi.fn(),
    },
  };
}
export type KickCalls = ReturnType<typeof kickCalls>;

// Uses the real App-level draft/pending state and panel in both presentations.
export function KickHarness({
  calls,
  api,
  mobile = false,
}: {
  calls: KickCalls;
  api: React.MutableRefObject<KickControls | null>;
  mobile?: boolean;
}) {
  const atlasErrorRef = useRef<((message: AtlasErrorMessage) => void) | null>(null);
  const kick = useKickedInDoor({
    isDM: true,
    snapshot: { compiledScene: { sourceDocumentId: "doc-a" } } as unknown as RoomSnapshot,
    activeTool: null,
    sendMessage: calls.send,
    toast: calls.toast,
    atlasErrorRef,
  });
  useLayoutEffect(() => {
    api.current = kick;
  });
  const controls: KickControls = {
    ...kick,
    closeKick: () => {
      calls.close();
      kick.closeKick();
    },
  };
  const panel = (
    <KickPanel kick={controls} atlasNodes={[]} presentation={mobile ? "content" : "panel"} />
  );
  return (
    <>
      <button onClick={kick.openKick}>Open kick</button>
      {kick.open &&
        (mobile ? (
          <MobileScreen title="Kick in a door" surface="kick" onClose={controls.closeKick}>
            {panel}
          </MobileScreen>
        ) : (
          panel
        ))}
    </>
  );
}
