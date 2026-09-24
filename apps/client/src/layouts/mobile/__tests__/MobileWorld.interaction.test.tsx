// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileSurfaceMachine } from "../../../hooks/useMobileSurface";
import { dismissalFocus } from "../../../features/interaction/dismissalFocus";
import { frameQueue, visible } from "../../../features/interaction/__tests__/focusFixtures";
import { MobileWorldHost } from "./mobileInteraction.fixtures";

let queue: ReturnType<typeof frameQueue>;
beforeEach(() => {
  queue = frameQueue();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  vi.restoreAllMocks();
});

function setup() {
  let machine: MobileSurfaceMachine | null = null;
  const capture = (current: MobileSurfaceMachine) => {
    machine = current;
  };
  const view = render(<MobileWorldHost onMachine={capture} />);
  return {
    ...view,
    current: () => {
      if (!machine) throw new Error("Missing real machine");
      return machine;
    },
    role: (isDM: boolean) => view.rerender(<MobileWorldHost isDM={isDM} onMachine={capture} />),
    mode: () => view.rerender(<MobileWorldHost mapEditMode onMachine={capture} />),
  };
}

const toolsDock = () =>
  within(screen.getByRole("navigation", { name: "Mobile actions" })).getByRole("button", {
    name: "Tools",
  });
const worldTile = () =>
  within(screen.getByRole("dialog", { name: "Map tools" })).getByRole("button", { name: "World" });
function openWorld() {
  fireEvent.click(toolsDock());
  const oldTile = worldTile();
  fireEvent.click(oldTile);
  expect(screen.getByTestId("surface")).toHaveTextContent("atlas");
  expect(oldTile.isConnected).toBe(false);
  return oldTile;
}

describe("phone World explicit return versus raw transitions", () => {
  it.each(["X", "Escape", "drag"] as const)(
    "%s returns to the newly mounted Tools tile",
    (action) => {
      setup();
      const oldTile = openWorld();
      if (action === "X") fireEvent.click(screen.getByRole("button", { name: "Close World Map" }));
      else if (action === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
      else {
        const header = screen.getByRole("heading", { name: "World Map" }).parentElement!;
        fireEvent.touchStart(header, { touches: [{ clientY: 100 }] });
        fireEvent.touchEnd(header, { changedTouches: [{ clientY: 250 }] });
      }
      const newTile = visible(worldTile());
      expect(newTile).not.toBe(oldTile);
      expect(newTile).toHaveAttribute("data-focus-return", "world");
      expect(document.activeElement).not.toBe(newTile);
      act(() => queue.flush());
      expect(document.activeElement).toBe(newTile);
    },
  );

  it("raw closeSurface closes World without opening Tools or queuing focus", () => {
    const view = setup();
    openWorld();
    act(() => view.current().closeSurface());
    expect(screen.getByTestId("surface")).toHaveTextContent("none");
    expect(screen.queryByRole("dialog", { name: "Map tools" })).toBeNull();
    expect(queue.count()).toBe(0);
  });

  it("effective role changes keep derived visibility but invalidate the Tools origin", () => {
    const view = setup();
    openWorld();
    view.role(true);
    expect(screen.getByTestId("surface")).toHaveTextContent("none");
    expect(screen.queryByRole("dialog", { name: "Map tools" })).toBeNull();
    view.role(false); // Existing derived role gate restores World, not Tools.
    expect(screen.getByTestId("surface")).toHaveTextContent("atlas");
    const dock = visible(toolsDock());
    fireEvent.click(screen.getByRole("button", { name: "Close World Map" }));
    expect(screen.getByTestId("surface")).toHaveTextContent("none");
    act(() => queue.flush());
    expect(document.activeElement).toBe(dock);
  });

  it("map-edit's existing raw mode edge never reopens ordinary Tools", () => {
    const view = setup();
    openWorld();
    view.mode();
    expect(screen.getByTestId("surface")).toHaveTextContent("none");
    expect(screen.queryByRole("dialog", { name: "Map tools" })).toBeNull();
    expect(queue.count()).toBe(0);
  });

  it("raw navigation after explicit World close keeps its new destination and cancels return", () => {
    const view = setup();
    openWorld();
    fireEvent.click(screen.getByRole("button", { name: "Close World Map" }));
    const target = visible(worldTile());
    const focus = vi.spyOn(target, "focus");
    act(() => view.current().openSurface("help"));
    act(() => queue.flush());
    expect(screen.getByTestId("surface")).toHaveTextContent("help");
    expect(focus).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Map tools" })).toBeNull();
  });

  it("mobile host removal never revives Tools or focuses a detached tile", () => {
    const view = setup();
    openWorld();
    fireEvent.click(screen.getByRole("button", { name: "Close World Map" }));
    const target = visible(worldTile());
    const focus = vi.spyOn(target, "focus");
    view.unmount();
    act(() => queue.flush());
    expect(focus).not.toHaveBeenCalled();
    expect(queue.count()).toBe(0);
  });

  it("Chat's explicit close bypasses raw invalidation and restores its real dock button", () => {
    setup();
    const chat = visible(
      within(screen.getByRole("navigation", { name: "Mobile actions" })).getByRole("button", {
        name: "Chat",
      }),
    );
    chat.focus(); // Root's launcher activation supplies this same native focus before opening.
    fireEvent.click(chat);
    screen.getByLabelText("Chat text").focus();
    fireEvent.click(screen.getByRole("button", { name: "Close Chat & Rolls" }));
    act(() => queue.flush());
    expect(screen.queryByRole("dialog", { name: "Chat & Rolls" })).toBeNull();
    expect(document.activeElement).toBe(chat);
  });
});
