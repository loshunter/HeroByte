// The panel's contract: the fields of plan §1.1 under their accessible names,
// a prefilled name that never collides, Enter rolls once with the dials it
// shows, Escape closes, and ROLL is disabled while a kick is pending (and not
// expired) and while the table has nothing compiled.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KICK_NEEDS_LIVE_MAP, KickPanel } from "../KickPanel";
import type { KickControls } from "../useKickedInDoor";

function controls(overrides: Partial<KickControls> = {}): KickControls {
  return {
    open: true,
    openKick: vi.fn(),
    closeKick: vi.fn(),
    kick: vi.fn(),
    pending: null,
    settings: {
      recipe: { recipeId: "dungeon", theme: "wood", density: "high", size: "large" },
      linkType: "stair",
    },
    canKick: true,
    ...overrides,
  };
}

describe("KickPanel", () => {
  it("offers a way OUT of the dead end: START LIVE MAP, right in the panel", () => {
    // A real table lost time on this. The panel said "start a live map first"
    // and left the DM at a disabled ROLL with nothing to click — the advice was
    // correct and the panel still went nowhere.
    const onStartLiveMap = vi.fn();
    render(
      <KickPanel
        kick={controls({ canKick: false })}
        atlasNodes={[]}
        onStartLiveMap={onStartLiveMap}
      />,
    );

    expect(screen.getByTestId("kick-needs-live-map")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "▶ START LIVE MAP" }));
    expect(onStartLiveMap).toHaveBeenCalledTimes(1);
  });

  it("hides the button when there is nothing to bind, rather than offering a dead one", () => {
    render(<KickPanel kick={controls({ canKick: false })} atlasNodes={[]} />);
    expect(screen.queryByRole("button", { name: "▶ START LIVE MAP" })).toBeNull();
    // ...and the explanation still stands on its own.
    expect(screen.getByTestId("kick-needs-live-map")).toBeInTheDocument();
  });

  it("says what the feature DOES under the name that says what it is", () => {
    // The name is the identity; the subtitle is for a DM meeting it cold.
    render(<KickPanel kick={controls()} atlasNodes={[]} />);
    expect(screen.getByText("Generate a connected location")).toBeInTheDocument();
  });

  it("offers a phone a numeric keypad for the seed", () => {
    // K2's own Tests list promised this assertion and it was never written, so
    // deleting the attribute reddened nothing. Its twin now covers the Atlas
    // tab's panel, which had neither the attribute nor the test.
    render(<KickPanel kick={controls()} atlasNodes={[]} />);
    expect(screen.getByTestId("kick-seed")).toHaveAttribute("inputmode", "numeric");
  });

  it("opens on the remembered dials with a non-colliding name, every field by its accessible name", () => {
    render(<KickPanel kick={controls()} atlasNodes={[{ name: "Dungeon" }]} />);
    const dialog = screen.getByRole("dialog", { name: "Kick in a door" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Dungeon 2");
    expect(screen.getByLabelText("Theme")).toHaveValue("wood");
    expect(screen.getByLabelText("Density")).toHaveValue("high");
    expect(screen.getByLabelText("Size")).toHaveValue("large");
    expect(screen.getByLabelText("Door type")).toHaveValue("stair");
    expect(screen.getByLabelText("Seed")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("button", { name: "🚪 ROLL" })).toBeEnabled();
  });

  it("Enter rolls ONCE with the name as typed (the hook trims), the dials and the seed", () => {
    const kick = controls();
    render(<KickPanel kick={kick} atlasNodes={[]} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Cellar  " } });
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "stone" } });
    fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "4242" } });
    fireEvent.submit(screen.getByRole("dialog", { name: "Kick in a door" }));
    expect(kick.kick).toHaveBeenCalledTimes(1);
    // The panel hands the name over as typed; useKickedInDoor trims it once,
    // where the message is built — one trim, not two that could disagree.
    expect(kick.kick).toHaveBeenCalledWith({
      name: "  Cellar  ",
      seed: 4242,
      recipe: { recipeId: "dungeon", theme: "stone", density: "high", size: "large" },
      linkType: "stair",
    });
  });

  it("Escape and CANCEL close; ⟳ mints a different seed", () => {
    const kick = controls();
    render(<KickPanel kick={kick} atlasNodes={[]} />);
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Escape" });
    expect(kick.closeKick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
    expect(kick.closeKick).toHaveBeenCalledTimes(2);

    const before = (screen.getByLabelText("Seed") as HTMLInputElement).value;
    fireEvent.click(screen.getByRole("button", { name: "⟳ Reroll" }));
    expect((screen.getByLabelText("Seed") as HTMLInputElement).value).not.toBe(before);
  });

  it("ROLL is disabled while a kick is pending, and rolls again once it expired", () => {
    const pending = { nodeId: "n", name: "Dungeon", startedAt: 0, expired: false };
    const kicking = controls({ pending });
    const { rerender } = render(<KickPanel kick={kicking} atlasNodes={[]} />);
    expect(screen.getByRole("button", { name: "⏳ Kicking…" })).toBeDisabled();
    // A disabled BUTTON does not stop a form submit (Enter still fires it) —
    // the handler's own guard is what makes the disable real.
    fireEvent.submit(screen.getByRole("dialog", { name: "Kick in a door" }));
    expect(kicking.kick).not.toHaveBeenCalled();

    // Expired: the door didn't budge, so ROLL comes back — the retry the hook
    // turns into a replay with the same ids.
    const expired = controls({ pending: { ...pending, expired: true } });
    rerender(<KickPanel kick={expired} atlasNodes={[]} />);
    const roll = screen.getByRole("button", { name: "🚪 ROLL" });
    expect(roll).toBeEnabled();
    fireEvent.click(roll);
    expect(expired.kick).toHaveBeenCalledTimes(1);
  });

  it("with nothing compiled on the table, ROLL is disabled and the panel says why", () => {
    const kick = controls({ canKick: false });
    render(<KickPanel kick={kick} atlasNodes={[]} />);
    expect(screen.getByRole("button", { name: "🚪 ROLL" })).toBeDisabled();
    expect(screen.getByTestId("kick-needs-live-map")).toHaveTextContent(KICK_NEEDS_LIVE_MAP);
    fireEvent.submit(screen.getByRole("dialog", { name: "Kick in a door" }));
    expect(kick.kick).not.toHaveBeenCalled();
  });

  it("an empty name cannot roll", () => {
    const kick = controls();
    render(<KickPanel kick={kick} atlasNodes={[]} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "🚪 ROLL" })).toBeDisabled();
  });

  it("the bare presentation drops the frame AND the dialog role — its host is already one", () => {
    render(<KickPanel kick={controls()} atlasNodes={[]} presentation="content" />);
    expect(screen.getByTestId("kick-panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    // A MobileScreen is role="dialog" with this same title; a second one
    // inside it would be two dialogs deep for one form.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("🚪 Kick in a door")).toBeNull();
  });
});
