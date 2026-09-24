import { useRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { KickPanel } from "../../KickPanel";
import { useKickedInDoor, type AtlasErrorMessage } from "../../useKickedInDoor";
import * as defaults from "../../kickDefaults";
import { kickCalls, type KickCalls } from "../../../interaction/__tests__/popoverOwners.fixtures";

function Harness({ calls }: { calls: KickCalls }) {
  const atlasErrorRef = useRef<((message: AtlasErrorMessage) => void) | null>(null);
  const snapshot = {
    compiledScene: { sourceDocumentId: "map-a" },
    atlasNodes: [{ name: "Dungeon" }],
  } as unknown as RoomSnapshot;
  const kick = useKickedInDoor({
    isDM: true,
    snapshot,
    activeTool: null,
    sendMessage: calls.send,
    toast: calls.toast,
    atlasErrorRef,
  });
  return (
    <>
      <button onClick={kick.openKick}>Open kick</button>
      {kick.open && <KickPanel kick={kick} atlasNodes={snapshot.atlasNodes ?? []} />}
    </>
  );
}

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function open() {
  fireEvent.click(screen.getByRole("button", { name: "Open kick" }));
}

beforeEach(() => {
  vi.spyOn(defaults, "freshSeed").mockReturnValue(9001);
  const values: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values[key] ?? null,
      setItem: (key: string, value: string) => {
        values[key] = value;
      },
      removeItem: (key: string) => {
        delete values[key];
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Kick draft baseline before lifting its lifetime", () => {
  it("names follow recipe until manually renamed and seed parsing remains integer-only", () => {
    const calls = kickCalls();
    render(<Harness calls={calls} />);
    open();
    expect(screen.getByLabelText("Name")).toHaveValue("Dungeon 2");
    change("Recipe", "building");
    expect(screen.getByLabelText("Name")).toHaveValue("Tavern");
    change("Kind", "shop");
    expect(screen.getByLabelText("Name")).toHaveValue("Shop");
    change("Name", "My unsubmitted shop");
    change("Recipe", "dungeon");
    expect(screen.getByLabelText("Name")).toHaveValue("My unsubmitted shop");
    change("Seed", "33tail");
    expect(screen.getByLabelText("Seed")).toHaveValue("33");
    change("Seed", "invalid");
    expect(screen.getByLabelText("Seed")).toHaveValue("33");
    fireEvent.click(screen.getByRole("button", { name: "⟳ Reroll" }));
    expect(screen.getByLabelText("Seed")).toHaveValue("9001");
    expect(calls.send).not.toHaveBeenCalled();
  });

  it("cancel discards the session draft without remembering unsent dials", () => {
    const calls = kickCalls();
    render(<Harness calls={calls} />);
    open();
    change("Name", "Discarded name");
    change("Theme", "wood");
    change("Density", "high");
    change("Seed", "4242");
    change("Door type", "stair");
    fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
    expect(screen.queryByTestId("kick-panel")).toBeNull();
    open();
    expect(screen.getByLabelText("Name")).toHaveValue("Dungeon 2");
    expect(screen.getByLabelText("Theme")).toHaveValue("stone");
    expect(screen.getByLabelText("Density")).toHaveValue("medium");
    expect(screen.getByLabelText("Door type")).toHaveValue("door");
    expect(screen.getByLabelText("Seed")).toHaveValue("9001");
    expect(calls.send).not.toHaveBeenCalled();
  });

  it("ROLL sends one trimmed request, closes, and remembers only the rolled recipe and door", () => {
    const calls = kickCalls();
    render(<Harness calls={calls} />);
    open();
    change("Name", "  Cellar  ");
    change("Theme", "wood");
    change("Density", "high");
    change("Size", "large");
    change("Seed", "4242");
    change("Door type", "stair");
    fireEvent.submit(screen.getByTestId("kick-panel"));
    expect(calls.send).toHaveBeenCalledTimes(1);
    expect(calls.send).toHaveBeenCalledWith(
      expect.objectContaining({
        t: "atlas-kick",
        name: "Cellar",
        seed: 4242,
        linkType: "stair",
        recipe: { recipeId: "dungeon", theme: "wood", density: "high", size: "large" },
      }),
    );
    expect(screen.queryByTestId("kick-panel")).toBeNull();
    open();
    expect(screen.getByLabelText("Name")).toHaveValue("Dungeon 2");
    expect(screen.getByLabelText("Theme")).toHaveValue("wood");
    expect(screen.getByLabelText("Density")).toHaveValue("high");
    expect(screen.getByLabelText("Size")).toHaveValue("large");
    expect(screen.getByLabelText("Door type")).toHaveValue("stair");
    expect(screen.getByLabelText("Seed")).toHaveValue("9001");
    expect(screen.getByTestId("kick-roll")).toBeDisabled();
    fireEvent.submit(screen.getByTestId("kick-panel"));
    expect(calls.send).toHaveBeenCalledTimes(1);
  });
});
