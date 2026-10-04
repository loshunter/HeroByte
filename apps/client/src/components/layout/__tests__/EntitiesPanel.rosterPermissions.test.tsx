// U7 — the roster and its inspector offer each viewer only what they may do.
// A player reads everyone but edits only their own; a withheld monster's
// numbers stay withheld in the row; the DM gets the NPC equivalents — HP,
// Focus, and (new) conditions — and the DM-only token controls.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Token } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";
import { viewport } from "../../../features/interaction/__tests__/frameInteraction.fixtures";
import {
  ALICE_UID,
  BOB_UID,
  DM_UID,
  entitiesPanelProps,
  npc,
  pc,
  seat,
  type EntitiesPanelTestProps,
} from "./entitiesPanel.fixtures";

const players = [
  seat(DM_UID, "The DM", { isDM: true }),
  seat(ALICE_UID, "Alice"),
  seat(BOB_UID, "Bob"),
];
const tokens = [{ id: "t-ranger", owner: ALICE_UID, x: 0, y: 0, color: "#f00" }] as Token[];
const ranger = pc("char-ranger", "Ranger", ALICE_UID, { hp: 7, tokenId: "t-ranger" });
const bob = pc("char-bob", "Bob", BOB_UID);

function renderAs(uid: string, overrides: Partial<EntitiesPanelTestProps> = {}) {
  const props = entitiesPanelProps({
    uid,
    currentIsDM: uid === DM_UID,
    players,
    tokens,
    characters: [ranger, bob],
    ...overrides,
  });
  render(<EntitiesPanel {...props} />);
  return props;
}

const open = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}\\b.*: details$`) }));
const inspector = () => screen.getByRole("region", { name: /details$/ });
const row = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}\\b.*: details$`) }).closest("li")!;

beforeEach(() => {
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("EntitiesPanel roster — a player sees permitted actions only", () => {
  it("reads another player's character but gets no settings or HP edit", () => {
    const props = renderAs(BOB_UID);

    open("Ranger");
    expect(within(inspector()).queryByRole("button", { name: "Open player settings" })).toBeNull();
    fireEvent.click(within(inspector()).getByText("7"));
    expect(props.onHpEdit).not.toHaveBeenCalled();
  });

  it("gets settings and HP edit on their own character, and no table role in it (the Table menu holds it)", () => {
    // Every DM-only handler supplied, as the app does for every viewer: the
    // card's own gates are what must keep them off a player's window.
    const props = renderAs(ALICE_UID, {
      onTokenVisionRadiusChange: vi.fn(),
      onPlayerTokenDelete: vi.fn(),
      onCharacterSpeedChange: vi.fn(),
    });

    open("Ranger");
    fireEvent.click(within(inspector()).getByText("7"));
    expect(props.onHpEdit).toHaveBeenCalledWith("char-ranger", 7);

    fireEvent.click(within(inspector()).getByRole("button", { name: "Open player settings" }));
    const character = screen.getByRole("region", { name: "Character" });
    const token = screen.getByRole("region", { name: "Token settings" });
    expect(within(character).getByLabelText("Character Name")).toBeInTheDocument();
    expect(within(character).getByText("Status Effects")).toBeInTheDocument();
    expect(within(token).getByText("Token Size")).toBeInTheDocument();
    // Sight, movement, lock and deletion are the DM's: a player's window has none.
    expect(within(token).queryByText("Token Lock")).toBeNull();
    expect(screen.queryByLabelText("Sight radius in feet")).toBeNull();
    expect(screen.queryByLabelText("Movement speed in feet per turn")).toBeNull();
    expect(screen.queryByRole("button", { name: "🗑️ Delete Token (DM)" })).toBeNull();
    // Ownership is the DM's to change.
    expect(screen.queryByLabelText("Owner")).toBeNull();
    // Role is the table's, not the character's: Enter / Leave DM mode is in the
    // Table menu (U9), so this window has no such section and no pointer to it.
    expect(screen.queryByRole("region", { name: "Table role" })).toBeNull();
    expect(screen.queryByRole("button", { name: /DM Mode/i })).toBeNull();
  });

  it("never sees a withheld monster's numbers, in the row or the inspector", () => {
    renderAs(BOB_UID, {
      characters: [
        ranger,
        npc("npc-ogre", "Ogre", { hp: undefined, maxHp: undefined, hpBadge: "bloodied" }),
      ],
    });

    expect(within(row("Ogre")).getByText("🩸 Bloodied")).toBeInTheDocument();
    expect(within(row("Ogre")).queryByText(/HP \d/)).toBeNull();
    open("Ogre");
    // No DM-only settings gear on a player's screen, not even a disabled one.
    expect(within(inspector()).queryByRole("button", { name: /^NPC settings/ })).toBeNull();
  });
});

describe("EntitiesPanel roster — the DM's NPC equivalents", () => {
  const goblin = npc("npc-goblin", "Goblin", {
    hp: 3,
    maxHp: 7,
    tokenId: "t-goblin",
    visibleToPlayers: false,
  });

  it("reads the NPC's HP and hidden state, focuses it, and edits its conditions", () => {
    const props = renderAs(DM_UID, {
      characters: [ranger, goblin],
      tokens: [...tokens, { id: "t-goblin", owner: DM_UID, x: 2, y: 2, color: "#0f0" } as Token],
    });

    expect(within(row("Goblin")).getByText("HP 3/7")).toBeInTheDocument();
    expect(within(row("Goblin")).getByText("Hidden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Focus Goblin" }));
    expect(props.onFocusToken).toHaveBeenCalledWith("t-goblin");

    open("Goblin");
    fireEvent.click(within(inspector()).getByRole("button", { name: /^NPC settings/ }));
    const character = screen.getByRole("region", { name: "Character" });
    expect(screen.getByRole("region", { name: "Token settings" })).toBeInTheDocument();
    fireEvent.click(within(character).getByRole("button", { name: "No Effects" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Poisoned/ }));
    expect(props.onCharacterStatusEffectsChange).toHaveBeenCalledWith("npc-goblin", ["poisoned"]);
  });

  it("deletes the NPC from its Party window", () => {
    // The Party's NPC card handlers were once all `undefined` (00566c70);
    // this is the last step of that wiring, from the window's button.
    const onNpcDelete = vi.fn();
    renderAs(DM_UID, { characters: [ranger, goblin], onNpcDelete });

    open("Goblin");
    fireEvent.click(within(inspector()).getByRole("button", { name: /^NPC settings/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete NPC" }));

    expect(onNpcDelete).toHaveBeenCalledWith("npc-goblin");
  });

  it("edits a player's HP from their card (the server lets the DM)", () => {
    const props = renderAs(DM_UID);

    open("Ranger");
    fireEvent.click(within(inspector()).getByText("7"));

    expect(props.onHpEdit).toHaveBeenCalledWith("char-ranger", 7);
  });

  it("moves a player's character to another seat from Token settings", () => {
    const props = renderAs(DM_UID);

    open("Ranger");
    fireEvent.click(within(inspector()).getByRole("button", { name: "Open player settings" }));
    const owner = within(screen.getByRole("region", { name: "Token settings" })).getByLabelText(
      "Owner",
    ) as HTMLSelectElement;
    expect(owner.value).toBe(ALICE_UID);
    fireEvent.change(owner, { target: { value: BOB_UID } });

    expect(props.onCharacterOwnerChange).toHaveBeenCalledWith("char-ranger", BOB_UID);
  });

  it("offers Owner even on a character with no token, where it is Token settings' only control", () => {
    renderAs(DM_UID);

    open("Bob");
    fireEvent.click(within(inspector()).getByRole("button", { name: "Open player settings" }));

    expect(
      within(screen.getByRole("region", { name: "Token settings" })).getByLabelText("Owner"),
    ).toBeInTheDocument();
  });

  it("gets the DM-only token controls on a player's character", () => {
    renderAs(DM_UID, {
      onTokenVisionRadiusChange: vi.fn(),
      onPlayerTokenDelete: vi.fn(),
      onCharacterSpeedChange: vi.fn(),
    });

    open("Ranger");
    fireEvent.click(within(inspector()).getByRole("button", { name: "Open player settings" }));
    const token = screen.getByRole("region", { name: "Token settings" });
    expect(within(token).getByText("Token Size")).toBeInTheDocument();
    expect(within(token).getByLabelText("Sight radius in feet")).toBeInTheDocument();
    expect(within(token).getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(within(token).getByText("Token Lock")).toBeInTheDocument();
    expect(within(token).getByRole("button", { name: "🗑️ Delete Token (DM)" })).toBeVisible();
    // A DM's window has no role section either: Leave DM mode is in the Table menu.
    expect(screen.queryByRole("region", { name: "Table role" })).toBeNull();
    expect(screen.queryByRole("button", { name: /DM Mode|Leave DM/i })).toBeNull();
  });
});
