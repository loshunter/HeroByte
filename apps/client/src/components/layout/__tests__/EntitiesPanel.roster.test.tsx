// U7 — the Party opens as a compact roster: one row per CHARACTER (never per
// seat), each with its own name, HP, conditions and Focus; selecting a row opens
// that character's existing card in ONE inspector. Two characters on one seat
// must keep distinct condition/HP/name/focus/delete paths.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Token } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";
import { dismissalFocus } from "../../../features/interaction/dismissalFocus";
import { frameQueue, visible } from "../../../features/interaction/__tests__/focusFixtures";
import { viewport } from "../../../features/interaction/__tests__/frameInteraction.fixtures";
import {
  ALICE_UID,
  BOB_UID,
  DM_UID,
  entitiesPanelProps,
  pc,
  seat,
  type EntitiesPanelTestProps,
} from "./entitiesPanel.fixtures";

const players = [
  seat(DM_UID, "The DM", { isDM: true }),
  // The write path mirrors Alice's own character onto her player-level list.
  seat(ALICE_UID, "Alice", { statusEffects: ["poisoned"] }),
  seat(BOB_UID, "Bob"),
];
const tokens = [
  { id: "t-ranger", owner: ALICE_UID, x: 0, y: 0, color: "#ff0000" },
  { id: "t-companion", owner: ALICE_UID, x: 1, y: 0, color: "#00ff00" },
] as Token[];
const characters = [
  pc("char-ranger", "Ranger", ALICE_UID, {
    hp: 7,
    maxHp: 10,
    statusEffects: ["poisoned"],
    tokenId: "t-ranger",
  }),
  pc("char-companion", "Companion", ALICE_UID, { tokenId: "t-companion", tempHp: 3 }),
  pc("char-bob", "Bob", BOB_UID),
];

function renderPanel(overrides: Partial<EntitiesPanelTestProps> = {}) {
  const props = entitiesPanelProps({ players, characters, tokens, ...overrides });
  render(<EntitiesPanel {...props} />);
  return props;
}

const row = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}\\b.*: details$`) }).closest("li")!;
const inspector = () => screen.queryByRole("region", { name: /details$/ });

let queue: ReturnType<typeof frameQueue>;
let previousViewport: [number, number];
beforeEach(() => {
  previousViewport = [innerWidth, innerHeight];
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
  queue = frameQueue();
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  viewport(...previousViewport);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("EntitiesPanel — the compact roster (U7)", () => {
  it("opens compact: one row per character and no full card", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "☰ Roster" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const rows = within(screen.getByRole("list", { name: "Party roster" })).getAllByRole(
      "listitem",
    );
    expect(rows.map((item) => item.getAttribute("data-character-id"))).toEqual([
      "char-ranger",
      "char-companion",
      "char-bob",
    ]);
    expect(document.querySelector(".player-card")).toBeNull();
  });

  it("lists the DM's bench first, then the party, as the cards do", () => {
    renderPanel({
      characters: [...characters, pc("char-dm-hero", "Sidekick", DM_UID)],
    });

    const rows = within(screen.getByRole("list", { name: "Party roster" })).getAllByRole(
      "listitem",
    );
    expect(rows.map((item) => item.getAttribute("data-character-id"))).toEqual([
      "char-dm-hero",
      "char-ranger",
      "char-companion",
      "char-bob",
    ]);
  });

  it("keeps two characters on one seat distinct: HP, conditions and Focus", () => {
    const props = renderPanel();

    expect(within(row("Ranger")).getByText("HP 7/10")).toBeInTheDocument();
    expect(within(row("Ranger")).getByRole("img", { name: "Conditions: Poisoned" })).toBeVisible();
    // The sibling wears neither the mirrored condition nor Ranger's HP.
    expect(within(row("Companion")).getByText("HP 10 (+3)/10")).toBeInTheDocument();
    expect(within(row("Companion")).queryByRole("img", { name: /Conditions/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Focus Companion" }));
    fireEvent.click(screen.getByRole("button", { name: "Focus Ranger" }));
    expect(props.onFocusToken).toHaveBeenNthCalledWith(1, "t-companion");
    expect(props.onFocusToken).toHaveBeenNthCalledWith(2, "t-ranger");
  });

  it("names another player's seat on a character named differently from it", () => {
    renderPanel({ uid: DM_UID, currentIsDM: true });

    // Alice's two characters: neither is called "Alice", so both say whose they are.
    expect(screen.getByRole("button", { name: "Ranger (Alice): details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Companion (Alice): details" })).toBeVisible();
    // Bob's character carries his seat's name already: no tag repeats it.
    expect(screen.getByRole("button", { name: "Bob: details" })).toBeInTheDocument();
  });

  it("a character with no token offers no Focus, and says why", () => {
    renderPanel();

    expect(screen.queryByRole("button", { name: "Focus Bob" })).toBeNull();
    expect(screen.getByRole("img", { name: "Bob has no token on the map" })).toBeInTheDocument();
  });

  it("opens the selected character's card in ONE inspector, swaps it, and closes it", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /^Ranger .*: details$/ }));
    expect(inspector()).toHaveAccessibleName("Ranger details");
    expect(document.querySelectorAll(".player-card")).toHaveLength(1);
    const card = inspector()!.querySelector(".player-card") as HTMLElement;
    expect(within(card).getByText("Ranger")).toBeInTheDocument();
    expect(within(card).getByText("7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    expect(inspector()).toHaveAccessibleName("Companion details");
    expect(document.querySelectorAll(".player-card")).toHaveLength(1);

    // The same row again closes it; so does its named close.
    fireEvent.click(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    expect(inspector()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close Companion details" }));
    expect(inspector()).toBeNull();
  });

  it("draws a teammate's colour from their record when fog dropped their token (C3)", () => {
    const fogged = characters.map((character) =>
      character.id === "char-bob"
        ? { ...character, tokenId: "t-far", color: "#8a2be2" }
        : character,
    );
    renderPanel({ characters: fogged });
    // The row's ring (its initial's fill) and the card's empty portrait.
    expect(within(row("Bob")).getByText("B").style.backgroundColor).toBe("rgb(138, 43, 226)");
    fireEvent.click(within(row("Bob")).getByRole("button", { name: /details$/ }));
    const card = inspector()!.querySelector(".player-card") as HTMLElement;
    expect(within(card).getByTestId("portrait-placeholder").style.backgroundColor).toBe(
      "rgb(138, 43, 226)",
    );
  });

  it("deletes the character the inspector shows, not its sibling", () => {
    const props = renderPanel();

    for (const [name, id] of [
      ["Companion", "char-companion"],
      ["Ranger", "char-ranger"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name} .*: details$`) }));
      fireEvent.click(within(inspector()!).getByRole("button", { name: "Open player settings" }));
      fireEvent.click(screen.getByRole("button", { name: "🗑️ Delete this character" }));
      expect(props.onDeleteCharacter).toHaveBeenLastCalledWith(id);
      fireEvent.click(screen.getByRole("button", { name: `Close ${name} details` }));
    }
    expect(props.onDeleteCharacter).toHaveBeenCalledTimes(2);
  });

  it("Escape closes the inspector and returns focus to the row that opened it", () => {
    renderPanel();

    const opener = visible(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    fireEvent.click(opener);
    expect(inspector()).not.toBeNull();
    expect(document.activeElement).toBe(opener);

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(inspector()).toBeNull();
    act(() => queue.flush());
    expect(document.activeElement).toBe(opener);
  });

  it("after switching rows, Escape returns focus to the row now shown, not the first", () => {
    renderPanel();

    const first = visible(screen.getByRole("button", { name: /^Ranger .*: details$/ }));
    const second = visible(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    fireEvent.click(first);
    fireEvent.click(second);
    expect(inspector()).toHaveAccessibleName("Companion details");

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(inspector()).toBeNull();
    act(() => queue.flush());
    expect(document.activeElement).toBe(second);
  });

  it("after Cards and back, Escape still returns focus to the row, not the view toggle", () => {
    // The inspector remounts when the roster comes back; whatever held focus
    // then (the "☰ Roster" button) is not what opened these details.
    renderPanel();

    const opener = visible(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "▦ Cards" }));
    const back = visible(screen.getByRole("button", { name: "☰ Roster" }));
    back.focus(); // a real click focuses the button; fireEvent does not
    fireEvent.click(back);
    expect(document.activeElement).toBe(back);
    expect(inspector()).toHaveAccessibleName("Companion details");
    // The roster remounted: its row is a new button (laid out, in a browser).
    const row = visible(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    expect(row).not.toBe(opener);

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(inspector()).toBeNull();
    act(() => queue.flush());
    expect(document.activeElement).toBe(row);
  });

  it("a selected character that leaves the roster does not reopen its details on return", () => {
    const props = entitiesPanelProps({ players, characters, tokens });
    const { rerender } = render(<EntitiesPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    expect(inspector()).toHaveAccessibleName("Companion details");

    // Hidden, fogged or deleted: its row and details go.
    const without = characters.filter((character) => character.id !== "char-companion");
    rerender(<EntitiesPanel {...props} characters={without} />);
    expect(inspector()).toBeNull();

    // Back again: nobody asked for its details, so they stay closed.
    rerender(<EntitiesPanel {...props} characters={characters} />);
    expect(screen.getByRole("button", { name: /^Companion .*: details$/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(inspector()).toBeNull();
  });

  it("Escape closes a settings window before the details it opened from", () => {
    // The settings window paints above the Party (its own band); the ladder
    // must take it first, and only the next Escape the inspector.
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^Companion .*: details$/ }));
    fireEvent.click(within(inspector()!).getByRole("button", { name: "Open player settings" }));
    expect(screen.getByRole("region", { name: "Character" })).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Character" })).toBeNull();
    expect(inspector()).toHaveAccessibleName("Companion details");

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(inspector()).toBeNull();
  });

  it("no Party control announces itself as a window resize", () => {
    // A window `resize` cancels an in-flight map gesture and a pending focus
    // return; the panel's height changes go out as its own named event.
    const resizes: Event[] = [];
    const onResize = (event: Event) => resizes.push(event);
    window.addEventListener("resize", onResize);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /^Ranger .*: details$/ }));
    fireEvent.click(screen.getByRole("button", { name: "▦ Cards" }));
    fireEvent.click(screen.getByRole("button", { name: "☰ Roster" }));
    fireEvent.click(screen.getByRole("button", { name: "▼ Hide party" }));
    fireEvent.click(screen.getByRole("button", { name: "▲ Show party" }));
    window.removeEventListener("resize", onResize);

    expect(resizes).toEqual([]);
  });

  it("Cards shows every full card at once; Roster returns to the compact rows", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "▦ Cards" }));
    expect(document.querySelectorAll(".player-card")).toHaveLength(3);
    expect(screen.queryByRole("list", { name: "Party roster" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "☰ Roster" }));
    expect(document.querySelector(".player-card")).toBeNull();
    expect(screen.getByRole("list", { name: "Party roster" })).toBeInTheDocument();
  });

  it("Hide keeps the bar — and the launcher dock the bar reports — on screen", () => {
    const props = renderPanel();

    const dock = vi.mocked(props.launcherDockRef).mock.calls.at(-1)?.[0];
    expect(dock).toBeInstanceOf(HTMLDivElement);
    expect(dock?.closest(".party-bar")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "▼ Hide party" }));
    expect(screen.queryByRole("list", { name: "Party roster" })).toBeNull();
    expect(dock?.isConnected).toBe(true);
    expect(screen.getByRole("button", { name: "▲ Show party" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
