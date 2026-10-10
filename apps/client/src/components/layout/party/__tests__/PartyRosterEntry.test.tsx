// One roster row's visible marks, and that its accessible name says what they
// show: the Party's default view is these rows, so a mark that silently stops
// rendering (or is shown but never read aloud) is a regression here first.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PartyRosterEntry } from "../PartyRosterEntry";
import type { RosterEntryView } from "../rosterEntryView";

afterEach(cleanup);

const base: RosterEntryView = {
  characterId: "c",
  kind: "character",
  name: "Ranger",
  ring: "#5AFFAD",
  tag: null,
  hp: { kind: "exact", current: 7, max: 10 },
  conditions: [],
  isCurrentTurn: false,
  isMe: false,
  hiddenFromPlayers: false,
};

function renderRow(view: Partial<RosterEntryView>) {
  render(
    <ul>
      <PartyRosterEntry
        view={{ ...base, ...view }}
        selected={false}
        inspectorId="inspector"
        onSelect={vi.fn()}
        onFocus={vi.fn()}
      />
    </ul>,
  );
  return screen.getByRole("listitem");
}

describe("PartyRosterEntry — what a row shows and says", () => {
  it("letters a portrait-less ring in black or white, whichever reads", () => {
    const row = renderRow({});
    expect(within(row).getByText("R").style.color).toBe("rgb(0, 0, 0)");
    cleanup();
    const deep = renderRow({ ring: "#390076" });
    expect(within(deep).getByText("R").style.color).toBe("rgb(255, 255, 255)");
    cleanup();
    // The keyline pair would give this red 4.36:1; white gives 4.93:1.
    const red = renderRow({ ring: "#d9262c" });
    expect(within(red).getByText("R").style.color).toBe("rgb(255, 255, 255)");
    cleanup();
    // Here keyline-based black and white would pick black (4.48:1); textOn picks white (4.68:1).
    const pink = renderRow({ ring: "#c64475" });
    expect(within(pink).getByText("R").style.color).toBe("rgb(255, 255, 255)");
  });

  it("drops the dark shadow under a black letter, keeps it under a white one", () => {
    const light = renderRow({});
    expect(within(light).getByText("R").style.textShadow).toBe("none");
    cleanup();
    const deep = renderRow({ ring: "#390076" });
    expect(within(deep).getByText("R").style.textShadow).toBe("");
    cleanup();
    // White letter, dark keyline: the shadow follows the letter, not the keyline.
    const pink = renderRow({ ring: "#c64475" });
    expect(within(pink).getByText("R").style.textShadow).toBe("");
  });

  it("edges the ring in its keyline, so a deep colour's ring shows against the row", () => {
    const deep = renderRow({ ring: "#390076" });
    const portrait = deep.querySelector(".party-roster__portrait") as HTMLElement;
    expect(portrait.style.boxShadow).toBe("0 0 0 1px #f4f1e8");
    cleanup();
    const light = renderRow({});
    const lightPortrait = light.querySelector(".party-roster__portrait") as HTMLElement;
    expect(lightPortrait.style.boxShadow).toBe("0 0 0 1px #0b0b16");
  });

  it("marks the current turn, initiative, a hidden NPC and its tag, and reads them aloud", () => {
    const row = renderRow({
      kind: "npc",
      name: "Goblin",
      tag: "Enemy",
      initiative: 17,
      isCurrentTurn: true,
      hiddenFromPlayers: true,
    });

    expect(within(row).getByText("Turn")).toBeInTheDocument();
    expect(within(row).getByText("Init 17")).toBeInTheDocument();
    expect(within(row).getByText("Hidden")).toBeInTheDocument();
    expect(within(row).getByText("Enemy")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", {
        name: "Goblin (Enemy), current turn, initiative 17, hidden from players: details",
      }),
    ).toBeInTheDocument();
  });

  it("shows the first condition and a count, and names every one", () => {
    const row = renderRow({
      conditions: [
        { emoji: "🧎", label: "Prone" },
        { emoji: "🤢", label: "Poisoned" },
        { emoji: "🪢", label: "Grappled" },
      ],
    });

    const summary = within(row).getByRole("img", { name: "Conditions: Prone, Poisoned, Grappled" });
    expect(summary).toHaveTextContent("🧎 Prone +2");
  });

  it("shows exact HP with temp HP, and each withheld NPC form as the card does", () => {
    expect(renderRow({ hp: { kind: "exact", current: 7, max: 10, temp: 3 } })).toHaveTextContent(
      "HP 7 (+3)/10",
    );
    cleanup();
    expect(renderRow({ hp: { kind: "redacted", badge: "bloodied" } })).toHaveTextContent(
      "🩸 Bloodied",
    );
    cleanup();
    expect(renderRow({ hp: { kind: "redacted", badge: "healthy" } })).toHaveTextContent("Healthy");
    cleanup();
    expect(renderRow({ hp: { kind: "redacted" } })).toHaveTextContent("HP ???");
  });
});
