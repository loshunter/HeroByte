// The one-shot link aim: arm → capture sends ONE atlas-create-link and
// disarms; ESC and a stolen tool axis both cancel; a duplicate capture (the
// tap's compat click) finds the ref empty and sends nothing.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import type { ToolMode } from "../../../components/layout/Header";
import { useAtlasLinkAim, type PendingLink } from "../useAtlasLinkAim";

const PENDING: PendingLink = {
  fromNodeId: "node-from",
  toNodeId: "node-to",
  linkType: "stair",
  visibleToPlayers: true,
};

function setup(initialTool: ToolMode = null, initialScene: string | undefined = "doc-a") {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  const setActiveTool = vi.fn();
  const view = renderHook(
    ({ tool, scene }) =>
      useAtlasLinkAim({ activeTool: tool, setActiveTool, sendMessage, sceneId: scene }),
    { initialProps: { tool: initialTool, scene: initialScene } },
  );
  return { sendMessage, setActiveTool, ...view };
}

describe("useAtlasLinkAim", () => {
  it("arm → capture sends the full link with a minted id and the clicked anchor, then disarms", () => {
    const { result, rerender, sendMessage, setActiveTool } = setup();
    act(() => result.current.armLinkAim(PENDING));
    expect(setActiveTool).toHaveBeenCalledWith("atlas-link");
    rerender({ tool: "atlas-link", scene: "doc-a" });
    expect(result.current.linkAimActive).toBe(true);

    act(() => result.current.captureLinkAnchor({ x: 640, y: 480 }));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      t: "atlas-create-link",
      link: {
        id: expect.any(String),
        fromNodeId: "node-from",
        toNodeId: "node-to",
        linkType: "stair",
        visibleToPlayers: true,
        anchor: { x: 640, y: 480 },
      },
    });
    expect(setActiveTool).toHaveBeenLastCalledWith(null);

    // The compat click that follows a touch tap: nothing left to send.
    act(() => result.current.captureLinkAnchor({ x: 1, y: 1 }));
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("ESC cancels — and never fires from an editable field", () => {
    const { result, rerender, sendMessage, setActiveTool } = setup();
    act(() => result.current.armLinkAim(PENDING));
    rerender({ tool: "atlas-link", scene: "doc-a" });

    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(result.current.linkAimActive).toBe(true);
    input.remove();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(setActiveTool).toHaveBeenLastCalledWith(null);
    act(() => result.current.captureLinkAnchor({ x: 5, y: 5 }));
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("the scene moving under an armed aim cancels it — the anchor would land on the wrong map", () => {
    const { result, rerender, sendMessage, setActiveTool } = setup();
    act(() => result.current.armLinkAim(PENDING));
    rerender({ tool: "atlas-link", scene: "doc-a" });
    expect(result.current.linkAimActive).toBe(true);

    // Travel (or a rebind, or a publish of another map) lands doc-b.
    rerender({ tool: "atlas-link", scene: "doc-b" });
    expect(setActiveTool).toHaveBeenLastCalledWith(null);
    act(() => result.current.captureLinkAnchor({ x: 5, y: 5 }));
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("another tool taking the axis is a cancel — a later capture sends nothing", () => {
    const { result, rerender, sendMessage } = setup();
    act(() => result.current.armLinkAim(PENDING));
    rerender({ tool: "atlas-link", scene: "doc-a" });
    rerender({ tool: "draw", scene: "doc-a" });
    expect(result.current.linkAimActive).toBe(false);
    act(() => result.current.captureLinkAnchor({ x: 5, y: 5 }));
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
