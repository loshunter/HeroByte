import { useRef, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, vi } from "vitest";
import { MacroBar } from "../../../components/dice/MacroBar";
import { HandEntry } from "../../../components/dice/HandEntry";
import { DiceToken } from "../../../components/dice/DiceToken";
import { loadMacros } from "../../../components/dice/diceMacros";
import { AtlasNodeRow } from "../../atlas/AtlasNodeRow";
import type { AtlasActions } from "../../atlas/useAtlasActions";
import { MapEditBrushDeck } from "../../map-edit/MapEditBrushDeck";
import {
  EscapeRootProvider,
  useEscapeFramePresence,
  useEscapeOwner,
  useEscapeRoot,
} from "../useEscapeOwner";

export const EDITORS = ["macro", "hand", "die", "modifier", "atlas", "brush"] as const;
export type EditorKind = (typeof EDITORS)[number];

// Fixtures describe connected containing surfaces; they never cancel an editor themselves.
function Frame({
  band,
  present = true,
  onClose,
  onBubble,
  children,
}: {
  band: number;
  present?: boolean;
  onClose?: () => void;
  onBubble?: (prevented: boolean) => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const root = useEscapeRoot(ref, band);
  useEscapeFramePresence(root, present);
  useEscapeOwner(() => ({
    kind: "panel",
    active: Boolean(onClose),
    name: `fixture surface ${band}`,
    root,
    anchor: ref.current,
    handle: onClose,
  }));
  return (
    <EscapeRootProvider value={root}>
      <div ref={ref} onKeyDown={(event) => onBubble?.(event.defaultPrevented)}>
        {children}
      </div>
    </EscapeRootProvider>
  );
}

export function installMemoryStorage(): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, "localStorage");
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  return () => {
    if (previous) Object.defineProperty(window, "localStorage", previous);
    else Reflect.deleteProperty(window, "localStorage");
  };
}

export function mountEditor(kind: EditorKind) {
  const commit = vi.fn();
  const remove = vi.fn();
  const localClose = vi.fn();
  const foregroundClose = vi.fn();
  const bubble = vi.fn<(prevented: boolean) => void>();
  const actions: AtlasActions = {
    createNode: vi.fn(),
    renameNode: commit,
    setDiscovered: vi.fn(),
    deleteNode: vi.fn(),
    linkMap: vi.fn(),
    generateNode: vi.fn(),
    travel: vi.fn(),
    deleteLink: vi.fn(),
  };
  const components: Record<EditorKind, ReactNode> = {
    macro: <MacroBar currentFormula="d20" currentMode="normal" onRollMacro={commit} />,
    hand: <HandEntry label="I ROLLED IT" prompt="Total?" testId="hand" onSubmit={commit} />,
    die: (
      <DiceToken
        token={{ kind: "die", die: "d6", qty: 2, id: "die" }}
        onRemove={remove}
        onUpdateQty={commit}
      />
    ),
    modifier: (
      <DiceToken
        token={{ kind: "mod", value: 2, id: "mod" }}
        onRemove={remove}
        onUpdateMod={commit}
      />
    ),
    atlas: (
      <ul>
        <AtlasNodeRow
          node={{ id: "node", kind: "region", name: "Glade", discovered: true }}
          depth={0}
          isCurrent={false}
          documents={[]}
          actions={actions}
        />
      </ul>
    ),
    brush: <MapEditBrushDeck selected="grass" onSelect={commit} />,
  };
  const tree = (covered: boolean) => (
    <>
      <Frame
        band={200}
        present={kind !== "brush"}
        onClose={kind === "brush" ? undefined : localClose}
        onBubble={bubble}
      >
        {components[kind]}
      </Frame>
      {covered && (
        <Frame band={2000} onClose={foregroundClose}>
          <span>Foreground</span>
        </Frame>
      )}
    </>
  );
  const view = render(tree(false));
  if (kind === "macro") fireEvent.click(screen.getByRole("button", { name: "+ SAVE" }));
  if (kind === "hand") fireEvent.click(screen.getByTestId("hand-open"));
  if (kind === "atlas") fireEvent.click(screen.getByRole("button", { name: /Rename/ }));
  if (kind === "die" || kind === "modifier") {
    const chip = view.container.querySelector(".dice-token");
    if (!chip) throw new Error("Expected real dice token");
    fireEvent.click(chip);
  }
  const input =
    kind === "macro"
      ? screen.getByLabelText("Macro name")
      : kind === "hand"
        ? screen.getByTestId("hand-input")
        : kind === "atlas"
          ? screen.getByLabelText("Rename Glade")
          : kind === "brush"
            ? screen.getByLabelText("Search brushes")
            : screen.getByRole("spinbutton");
  if (!(input instanceof HTMLInputElement)) throw new Error("Expected real input");
  fireEvent.change(input, { target: { value: "17" } });
  return {
    input,
    commit,
    remove,
    localClose,
    foregroundClose,
    bubble,
    cover: () => view.rerender(tree(true)),
    expectOpen: () => {
      expect(input.isConnected).toBe(true);
      expect(input.value).toBe("17");
      expect(commit).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      expect(loadMacros()).toEqual([]);
    },
    expectCancelled: () => {
      if (kind === "brush") expect(input.value).toBe("");
      else expect(input.isConnected).toBe(false);
      expect(commit).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      expect(loadMacros()).toEqual([]);
    },
    expectCommitted: () => {
      if (kind === "macro") expect(loadMacros()[0]).toMatchObject({ label: "17", formula: "d20" });
      else if (kind === "atlas") expect(commit).toHaveBeenCalledWith("node", "17");
      else if (kind !== "brush") expect(commit).toHaveBeenCalledWith(17);
      else {
        expect(input.value).toBe("17");
        expect(commit).not.toHaveBeenCalled();
      }
    },
  };
}

export function escape(input: HTMLElement, options: KeyboardEventInit = {}, prevented = false) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...options,
  });
  if (prevented) event.preventDefault();
  fireEvent(input, event);
  return event;
}
