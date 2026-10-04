import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HelpMenuButton } from "../../help/HelpMenuButton";
import { CharacterCreationModal } from "../../players/components/CharacterCreationModal";
import type { AtlasLinkAim } from "../../atlas/useAtlasLinkAim";
import { escapeRegistry } from "../useEscapeOwner";
import { AimHarness, escape, PENDING, POINT } from "./popoverOwners.fixtures";

afterEach(cleanup);
function setup() {
  const api = { current: null as AtlasLinkAim | null };
  const send = vi.fn();
  const changed = vi.fn();
  render(<AimHarness api={api} sendMessage={send} changed={changed} />);
  return { api, send, changed };
}
function modal(open = true) {
  return (
    <CharacterCreationModal
      isOpen={open}
      isCreating={false}
      onClose={vi.fn()}
      onCreateCharacter={() => true}
    />
  );
}

describe("Atlas aim reads live pending state and preserves its one-shot Move contract", () => {
  it("same-event arm → Escape → capture never sends, before a render can publish armed state", () => {
    const { api, send, changed } = setup();
    let event: KeyboardEvent;
    act(() => {
      api.current!.armLinkAim(PENDING);
      event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      api.current!.captureLinkAnchor(POINT);
    });
    expect(event!.defaultPrevented).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(changed.mock.calls).toEqual([["atlas-link"], [null]]);
    expect(screen.getByTestId("aim-mode")).toHaveTextContent("move");
    expect(escapeRegistry.getPendingLabel()).toBeNull();
  });

  it.each(["explicit cancel", "transition", "cancel control"])(
    "same-event %s prevents a later capture and returns to Move",
    (cancel) => {
      const { api, send, changed } = setup();
      act(() => {
        api.current!.armLinkAim(PENDING);
        if (cancel === "transition") expect(escapeRegistry.cancelForTransition()).toBe(1);
        else if (cancel === "cancel control") expect(escapeRegistry.cancelPending()).toBe(true);
        else api.current!.cancelLinkAim();
        api.current!.captureLinkAnchor(POINT);
      });
      expect(send).not.toHaveBeenCalled();
      expect(changed).toHaveBeenLastCalledWith(null);
      expect(escapeRegistry.getPendingLabel()).toBeNull();
      act(() => {
        api.current!.armLinkAim(PENDING);
        api.current!.captureLinkAnchor(POINT);
      });
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  it("normal and duplicate same-event captures send one complete command and clear the label", () => {
    const { api, send } = setup();
    act(() => {
      api.current!.armLinkAim(PENDING);
      expect(escapeRegistry.getPendingLabel()).toBe("Cancel link placement");
      api.current!.captureLinkAnchor(POINT);
      api.current!.captureLinkAnchor({ x: 0, y: 0 });
    });
    expect(send.mock.calls).toEqual([
      [{ t: "atlas-create-link", link: { id: expect.any(String), ...PENDING, anchor: POINT } }],
    ]);
    expect(escapeRegistry.getPendingLabel()).toBeNull();
    expect(screen.getByTestId("aim-mode")).toHaveTextContent("move");
  });

  it("the real transition-aware tool callback finishes old-mode cancellation before arming the new payload", () => {
    const { api, send } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Choose drawing" }));
    expect(screen.getByTestId("aim-mode")).toHaveTextContent("draw");
    act(() => api.current!.armLinkAim(PENDING));
    expect(api.current?.linkAimActive).toBe(true);
    expect(screen.getByTestId("aim-mode")).toHaveTextContent("atlas-link");
    act(() => api.current!.captureLinkAnchor(POINT));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("same-event aim → another real tool transition → capture keeps the requested new tool and sends nothing", () => {
    const { api, send } = setup();
    act(() => {
      api.current!.armLinkAim(PENDING);
      fireEvent.click(screen.getByRole("button", { name: "Choose drawing" }));
      api.current!.captureLinkAnchor(POINT);
    });
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByTestId("aim-mode")).toHaveTextContent("draw");
    expect(api.current?.linkAimActive).toBe(false);
    expect(escapeRegistry.getPendingLabel()).toBeNull();
  });

  it("opening ordinary Help preserves aim, then Help Escape and aim Escape are separate actions", () => {
    const api = { current: null as AtlasLinkAim | null };
    const send = vi.fn();
    render(
      <AimHarness api={api} sendMessage={send}>
        <HelpMenuButton />
      </AimHarness>,
    );
    act(() => api.current!.armLinkAim(PENDING));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(api.current?.linkAimActive).toBe(true);
    expect(escapeRegistry.getPendingLabel()).toBe("Cancel link placement");
    escape(screen.getByRole("dialog", { name: "HeroByte help" }));
    expect(api.current?.linkAimActive).toBe(true);
    expect(screen.getByTestId("aim-mode")).toHaveTextContent("atlas-link");
    escape(document.body);
    expect(api.current?.linkAimActive).toBe(false);
    expect(screen.getByTestId("aim-mode")).toHaveTextContent("move");
    act(() => api.current!.captureLinkAnchor(POINT));
    expect(send).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "a modal cancels aim regardless of sibling layout-effect order (aim first=%s)",
    (aimFirst) => {
      const api = { current: null as AtlasLinkAim | null };
      const send = vi.fn();
      const aim = <AimHarness key="aim" api={api} sendMessage={send} armOnMount />;
      const overlay = <React.Fragment key="modal">{modal()}</React.Fragment>;
      render(<>{aimFirst ? [aim, overlay] : [overlay, aim]}</>);
      expect(api.current?.linkAimActive).toBe(false);
      expect(screen.getByTestId("aim-mode")).toHaveTextContent("move");
      expect(escapeRegistry.getPendingLabel()).toBeNull();
      act(() => api.current!.captureLinkAnchor(POINT));
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("opening a modal while armed cancels before the next capture", () => {
    const api = { current: null as AtlasLinkAim | null };
    const send = vi.fn();
    const view = render(
      <>
        <AimHarness api={api} sendMessage={send} />
        {modal(false)}
      </>,
    );
    act(() => api.current!.armLinkAim(PENDING));
    view.rerender(
      <>
        <AimHarness api={api} sendMessage={send} />
        {modal()}
      </>,
    );
    act(() => api.current!.captureLinkAnchor(POINT));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByTestId("aim-mode")).toHaveTextContent("move");
  });

  it.each(["select", "composing", "legacy composing", "prevented"])(
    "%s Escape preserves aim and its pending command",
    (mode) => {
      const { api, send } = setup();
      act(() => api.current!.armLinkAim(PENDING));
      const input = document.createElement(mode === "select" ? "select" : "input");
      document.body.appendChild(input);
      try {
        const event = escape(
          input,
          { isComposing: mode === "composing", keyCode: mode === "legacy composing" ? 229 : 0 },
          mode === "prevented" ? (key) => key.preventDefault() : undefined,
        );
        expect(event.defaultPrevented).toBe(mode === "prevented");
        expect(api.current?.linkAimActive).toBe(true);
        act(() => api.current!.captureLinkAnchor(POINT));
        expect(send).toHaveBeenCalledTimes(1);
      } finally {
        input.remove();
      }
    },
  );
});
