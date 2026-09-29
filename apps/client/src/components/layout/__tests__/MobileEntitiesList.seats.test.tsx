// U7 — the phone Party lists characters UNDER their player seat: a player with
// two characters is one seat with two rows, each row its own character's — HP,
// conditions, Focus — never a seat standing in for its first character.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Player, SnapshotCharacter, Token } from "@herobyte/shared";
import { MobileEntitiesList } from "../MobileEntitiesList";

const ME = "me-uid";
const DM = "dm-uid";
const ZED = "zed-uid";
const ADA = "ada-uid";

const player = (uid: string, name: string, extra: Partial<Player> = {}) =>
  ({ uid, name, hp: 10, maxHp: 10, micLevel: 0, isDM: false, ...extra }) as unknown as Player;
const pc = (id: string, name: string, owner: string, extra: Partial<SnapshotCharacter> = {}) =>
  ({
    id,
    name,
    type: "pc",
    ownedByPlayerUID: owner,
    hp: 10,
    maxHp: 10,
    ...extra,
  }) as unknown as SnapshotCharacter;

const players = [
  player(ZED, "Zed"),
  player(DM, "The DM", { isDM: true }),
  player(ADA, "Ada"),
  player(ME, "Me", { statusEffects: ["poisoned"] }),
];
const characters = [
  pc("char-ranger", "Ranger", ME, { hp: 4, statusEffects: ["poisoned"], tokenId: "t-ranger" }),
  pc("char-companion", "Companion", ME, { tokenId: "t-companion" }),
  pc("char-zed", "Zed", ZED),
  // The DM runs one too: a seat with no character lists nothing (and shows nothing).
  pc("char-dm", "Sidekick", DM),
  pc("char-ada", "Ada", ADA),
];
const tokens = [
  { id: "t-ranger", owner: ME, x: 0, y: 0, color: "red" },
  { id: "t-companion", owner: ME, x: 1, y: 0, color: "blue" },
] as Token[];

function renderList(onFocusToken = vi.fn(), isDM = false) {
  render(
    <MobileEntitiesList
      players={players}
      characters={characters}
      uid={ME}
      isDM={isDM}
      onToggleDMMode={vi.fn()}
      editingHpUID={null}
      hpInput=""
      onHpInputChange={vi.fn()}
      onHpEdit={vi.fn()}
      onHpSubmit={vi.fn()}
      editingMaxHpUID={null}
      maxHpInput=""
      onMaxHpInputChange={vi.fn()}
      onMaxHpEdit={vi.fn()}
      onMaxHpSubmit={vi.fn()}
      onCharacterHpChange={vi.fn()}
      onCharacterStatusEffectsChange={vi.fn()}
      onCharacterNameUpdate={vi.fn()}
      onCharacterPortraitUpdate={vi.fn()}
      onTokenSizeChange={vi.fn()}
      onAddCharacter={vi.fn()}
      sceneObjects={[]}
      onToggleTokenLock={vi.fn()}
      onPlayerTokenDelete={undefined}
      onCharacterOwnerChange={vi.fn()}
      tokens={tokens}
      onFocusToken={onFocusToken}
    />,
  );
  return onFocusToken;
}

const rowsOf = (seat: HTMLElement) => within(seat).getAllByTestId("mobile-player-row");

describe("MobileEntitiesList — characters under their seat (U7)", () => {
  it("orders seats me, the DM, then everyone alphabetically", () => {
    renderList();

    expect(screen.getAllByRole("region").map((seat) => seat.getAttribute("aria-label"))).toEqual([
      "Seat: Me (you)",
      "Seat: The DM",
      "Seat: Ada",
      "Seat: Zed",
    ]);
  });

  it("lists both of a seat's characters under it, each with its own HP and conditions", () => {
    renderList();

    const mine = screen.getByRole("region", { name: "Seat: Me (you)" });
    expect(within(mine).getByRole("heading")).toHaveTextContent("Me (you) · 2 characters");
    const [ranger, companion] = rowsOf(mine);
    expect(within(ranger).getByText("Ranger")).toBeInTheDocument();
    expect(within(ranger).getByText("4")).toBeInTheDocument();
    expect(within(ranger).getByText("🤢 Poisoned")).toBeInTheDocument();
    expect(within(companion).getByText("Companion")).toBeInTheDocument();
    expect(within(companion).queryByText("🤢 Poisoned")).toBeNull();
  });

  it("focuses each row's OWN token, and offers no Focus where there is none", () => {
    const onFocusToken = renderList();

    const [ranger, companion] = rowsOf(screen.getByRole("region", { name: "Seat: Me (you)" }));
    fireEvent.click(within(companion).getByRole("button", { name: "Focus Companion" }));
    fireEvent.click(within(ranger).getByRole("button", { name: "Focus Ranger" }));
    expect(onFocusToken.mock.calls).toEqual([["t-companion"], ["t-ranger"]]);

    const zed = screen.getByRole("region", { name: "Seat: Zed" });
    expect(within(zed).queryByRole("button", { name: /^Focus/ })).toBeNull();
  });

  it("offers a player Manage Status on their own rows only", () => {
    renderList();

    const mine = screen.getByRole("region", { name: "Seat: Me (you)" });
    expect(within(mine).getAllByRole("button", { name: "⚡ Manage Status" })).toHaveLength(2);
    const ada = screen.getByRole("region", { name: "Seat: Ada" });
    expect(within(ada).queryByRole("button", { name: "⚡ Manage Status" })).toBeNull();
  });

  it("offers Manage Status on your own rows only — and on every row to a DM", () => {
    renderList();
    const manage = (seat: string) =>
      rowsOf(screen.getByRole("region", { name: seat })).map((row) =>
        within(row).queryByRole("button", { name: "⚡ Manage Status" }),
      );
    expect(manage("Seat: Me (you)").every(Boolean)).toBe(true);
    expect(manage("Seat: Ada").every((button) => button === null)).toBe(true);

    cleanup();
    renderList(vi.fn(), true);
    expect(manage("Seat: Ada").every(Boolean)).toBe(true);
  });
});
