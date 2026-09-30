// The initiative dialog gives focus back to what opened it. From Encounter the
// opener does not survive the save it opened: a row with no initiative sits
// under "Not rolled yet" with Set…, and its first initiative moves it into
// "In the order" with Init N — a new button. Focus fell to <body>, so a
// keyboard DM lost their place on every first entry.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EncounterTab } from "../EncounterTab";
import type { EncounterControls } from "../encounterControls";
import { DM_UID, encounterControls, npc, seat } from "./encounterFixtures";

vi.mock("../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

// jsdom lays nothing out; focus return needs a control with a box.
beforeEach(() => {
  const rect = new DOMRect(0, 0, 44, 44);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    0: rect,
    length: 1,
    item: (index: number) => (index === 0 ? rect : null),
    [Symbol.iterator]: () => [rect].values(),
  } as unknown as DOMRectList);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const players = [seat(DM_UID, "The DM", true)];

describe("EncounterTab — focus after a first initiative", () => {
  it("returns to the row's Init button when Set… moved it into the order", () => {
    const base = encounterControls({ players, characters: [npc("gob", "Goblin")] });
    const tab = (controls: EncounterControls) => (
      <EncounterTab
        controls={controls}
        isDM={true}
        onOpenTab={vi.fn()}
        toast={{ success: vi.fn(), error: vi.fn() }}
      />
    );
    const view = render(tab(base));
    const opener = screen.getByRole("button", { name: "Set initiative for Goblin" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Enter a roll by hand" }));
    fireEvent.change(screen.getByPlaceholderText("Enter roll..."), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save initiative" }));

    const saving = { ...base.initiative, isSetting: true };
    view.rerender(tab({ ...base, initiative: saving }));
    view.rerender(
      tab({
        ...base,
        characters: [npc("gob", "Goblin", { initiative: 12 })],
        initiative: { ...base.initiative, isSetting: false },
      }),
    );

    expect(screen.queryByText("Initiative: Goblin")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Initiative 12: set for Goblin" }),
    );
  });
});
