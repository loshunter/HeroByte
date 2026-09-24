// @vitest-environment jsdom
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import type { EscapeRoot } from "../escapeTypes";
import { dismissalFocus } from "../dismissalFocus";
import {
  EscapeRootProvider,
  escapeRegistry,
  useEscapeRoot,
  useLocalEscape,
} from "../useEscapeOwner";
import { frameQueue } from "./focusFixtures";
import { RootProbe, viewport } from "./frameInteraction.fixtures";

let releases: (() => void)[];
let initialViewport: [number, number];
beforeEach(() => {
  initialViewport = [window.innerWidth, window.innerHeight];
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
  frameQueue();
  releases = [];
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  for (const release of releases) release();
  dismissalFocus.invalidate();
  viewport(...initialViewport);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("context palettes never acquire blocking or dismissal behavior", () => {
  it.each(["Draw", "Map"])("%s palette leaves cancel, Move, then selection reachable", (title) => {
    let pending = true;
    let active = true;
    const calls: string[] = [];
    releases.push(
      escapeRegistry.register(() => ({
        kind: "gesture",
        name: "gesture",
        order: 0,
        active: pending,
        handle: () => {
          pending = false;
          calls.push("cancel");
        },
      })),
    );
    releases.push(
      escapeRegistry.register(() => ({
        kind: "tool",
        name: "tool",
        order: 0,
        active,
        handle: () => {
          active = false;
          calls.push("move");
        },
      })),
    );
    releases.push(
      escapeRegistry.register(() => ({
        kind: "selection",
        name: "selection",
        order: 0,
        active: true,
        handle: () => {
          calls.push("clear");
        },
      })),
    );
    const observe = vi.spyOn(escapeRegistry, "observeFrame");
    const invalidate = vi.spyOn(dismissalFocus, "invalidate");
    const close = vi.fn();
    render(
      <DraggableWindow title={title} zIndex={200} onClose={close}>
        Palette
      </DraggableWindow>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(calls).toEqual(["cancel"]);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(calls).toEqual(["cancel", "move"]);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(calls).toEqual(["cancel", "move", "clear"]);
    expect(close).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: `Close ${title}` })).toBeTruthy();
  });

  it.each(["context", "block"] as const)(
    "%s retains raw X without inventing focus return",
    (behavior) => {
      const close = vi.fn();
      const request = vi.spyOn(dismissalFocus, "request");
      render(
        <DraggableWindow title="Existing" onClose={close} interaction={{ behavior }}>
          Body
        </DraggableWindow>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Close Existing" }));
      expect(close).toHaveBeenCalledTimes(1);
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("a palette's retained local editor declines Escape to a higher Character", () => {
    const close = vi.fn();
    function Search() {
      const [query, setQuery] = useState("grass");
      const attempt = useLocalEscape();
      return (
        <input
          aria-label="Palette search"
          value={query}
          onChange={() => {}}
          onKeyDown={(event) => {
            if (query) attempt(event, () => setQuery(""));
          }}
        />
      );
    }
    render(
      <>
        <DraggableWindow title="Map" zIndex={200}>
          <Search />
        </DraggableWindow>
        <DraggableWindow
          title="Character"
          zIndex={2500}
          onClose={close}
          interaction={{ behavior: "close", panel: "character" }}
        >
          Character body
        </DraggableWindow>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Palette search" });
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("grass");
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("explicit containing roots follow actual paint contexts", () => {
  it("Chat shares its wrapper1000 and remains blocked only while Result1001 is present", () => {
    const close = vi.fn();
    let wrapperRoot: EscapeRoot | null = null;
    let childRoot: EscapeRoot | null = null;
    function Composition({ result }: { result: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      const root = useEscapeRoot(ref, 1000);
      wrapperRoot = root;
      return (
        <>
          <div ref={ref} data-testid="wrapper" style={{ position: "fixed", zIndex: 1000 }}>
            <DraggableWindow
              title="Chat"
              zIndex={999}
              onClose={close}
              interaction={{ behavior: "close", panel: "chat", containingRoot: root }}
            >
              <RootProbe
                capture={(value) => {
                  childRoot = value;
                }}
              />
              Chat body
            </DraggableWindow>
          </div>
          {result && (
            <DraggableWindow title="Result" zIndex={1001} interaction={{ behavior: "block" }}>
              Result body
            </DraggableWindow>
          )}
        </>
      );
    }
    const view = render(<Composition result />);
    expect(childRoot).toBe(wrapperRoot);
    expect((childRoot as EscapeRoot | null)?.node()).toBe(screen.getByTestId("wrapper"));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    view.rerender(<Composition result={false} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("a body-portalled Character does not blindly inherit its logical React parent root", () => {
    const node = document.createElement("div");
    document.body.append(node);
    const parentRoot: EscapeRoot = { node: () => node, band: () => 1000 };
    let actual: EscapeRoot | null = null;
    render(
      <EscapeRootProvider value={parentRoot}>
        {createPortal(
          <DraggableWindow title="Character" zIndex={2500}>
            <RootProbe
              capture={(root) => {
                actual = root;
              }}
            />
            Portalled body
          </DraggableWindow>,
          document.body,
        )}
      </EscapeRootProvider>,
    );
    expect(actual).not.toBe(parentRoot);
    expect((actual as EscapeRoot | null)?.band()).toBe(2500);
    expect(
      (actual as EscapeRoot | null)?.node()?.contains(screen.getByText("Portalled body")),
    ).toBe(true);
    node.remove();
  });

  it("the stable own root tracks the real mobile +100 band across resize", () => {
    let current: EscapeRoot | null = null;
    render(
      <DraggableWindow title="Character" zIndex={2500}>
        <RootProbe
          capture={(root) => {
            current = root;
          }}
        />
        Body
      </DraggableWindow>,
    );
    const initial = current;
    expect((current as EscapeRoot | null)?.band()).toBe(2500);
    viewport(375, 812);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(current).toBe(initial);
    expect((current as EscapeRoot | null)?.band()).toBe(2600);
    expect((current as EscapeRoot | null)?.node()?.style.zIndex).toBe("2600");
  });
});
