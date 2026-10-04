// The phone Party's initiative (U8): before U8 a phone could not set a
// character's initiative at all, and showed no order and no turn. Each row the
// viewer may set — their own, or any for a DM — offers ⚔️ INIT into the ONE
// dialog; every row says its initiative and whether it holds the turn.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { MobileEntitiesList } from "../MobileEntitiesList";

afterEach(cleanup);

const ME = "me-uid";
const players = [
  { uid: ME, name: "Me" },
  { uid: "them", name: "Them" },
] as Player[];
const pc = (id: string, name: string, owner: string, extra: object = {}) =>
  ({
    id,
    name,
    type: "pc",
    ownedByPlayerUID: owner,
    hp: 9,
    maxHp: 9,
    ...extra,
  }) as SnapshotCharacter;
const characters = [
  pc("ranger", "Ranger", ME, { initiative: 14 }),
  pc("companion", "Companion", ME),
  pc("wolf", "Wolf", "them", { initiative: 17 }),
];

function listProps(): React.ComponentProps<typeof MobileEntitiesList> {
  return {
    players,
    characters,
    uid: ME,
    isDM: false,
    editingHpUID: null,
    hpInput: "",
    onHpInputChange: vi.fn(),
    onHpEdit: vi.fn(),
    onHpSubmit: vi.fn(),
    editingMaxHpUID: null,
    maxHpInput: "",
    onMaxHpInputChange: vi.fn(),
    onMaxHpEdit: vi.fn(),
    onMaxHpSubmit: vi.fn(),
    onCharacterHpChange: vi.fn(),
    onCharacterStatusEffectsChange: vi.fn(),
    onCharacterNameUpdate: vi.fn(),
    onCharacterPortraitUpdate: vi.fn(),
    onTokenSizeChange: vi.fn(),
    onAddCharacter: vi.fn(),
    sceneObjects: [],
    drawings: [],
    onApplyPlayerState: vi.fn(),
    onToggleTokenLock: vi.fn(),
    onPlayerTokenDelete: undefined,
    onCharacterOwnerChange: vi.fn(),
    onFocusToken: vi.fn(),
    combatActive: false,
    currentTurnCharacterId: undefined,
    onOpenInitiative: vi.fn(),
  };
}

function renderList(isDM: boolean, extra: { combatActive?: boolean; turn?: string } = {}) {
  const onOpenInitiative = vi.fn();
  render(
    <MobileEntitiesList
      {...listProps()}
      isDM={isDM}
      combatActive={extra.combatActive ?? false}
      currentTurnCharacterId={extra.turn}
      onOpenInitiative={onOpenInitiative}
    />,
  );
  return onOpenInitiative;
}

const rowOf = (name: string) =>
  screen
    .getAllByTestId("mobile-player-row")
    .find((row) => within(row).queryByText(name, { exact: true }))!;

describe("MobileEntitiesList — initiative on a phone (U8)", () => {
  it("the viewer's characterless seat offers no INIT, even when its uid matches a character's id", () => {
    const onOpenInitiative = vi.fn();
    render(
      <MobileEntitiesList
        {...listProps()}
        players={[{ uid: "wolf", name: "Me" } as Player, { uid: "them", name: "Them" } as Player]}
        characters={[pc("wolf", "Wolf", "them", { initiative: 17 })]}
        uid="wolf"
        isDM={false}
        onOpenInitiative={onOpenInitiative}
      />,
    );
    const mine = screen
      .getAllByTestId("mobile-player-row")
      .find((row) => within(row).queryByText("Me", { exact: true }))!;
    expect(within(mine).queryByRole("button", { name: /initiative/i })).toBeNull();
    expect(within(mine).queryByText(/Init 17/)).toBeNull();
  });

  it("a player's own rows each open the dialog for THEIR character; another's offers none", () => {
    const open = renderList(false);

    fireEvent.click(screen.getByRole("button", { name: "Set initiative for Companion" }));
    expect(open).toHaveBeenLastCalledWith(characters[1]);
    fireEvent.click(screen.getByRole("button", { name: "Initiative 14: set for Ranger" }));
    expect(open).toHaveBeenLastCalledWith(characters[0]);

    expect(within(rowOf("Wolf")).queryByRole("button", { name: /initiative/i })).toBeNull();
  });

  it("a DM gets INIT on every character's row", () => {
    const open = renderList(true);
    fireEvent.click(screen.getByRole("button", { name: "Initiative 17: set for Wolf" }));
    expect(open).toHaveBeenLastCalledWith(characters[2]);
  });

  it("every row says its initiative; the turn holder says so only while combat is on", () => {
    renderList(false, { combatActive: true, turn: "wolf" });
    expect(within(rowOf("Wolf")).getByText(/Init 17 · ▶ Turn/)).toBeTruthy();
    expect(within(rowOf("Ranger")).getByText(/Init 14/)).toBeTruthy();
    expect(within(rowOf("Ranger")).queryByText(/▶ Turn/)).toBeNull();

    cleanup();
    renderList(false, { combatActive: false, turn: "wolf" });
    expect(within(rowOf("Wolf")).queryByText(/▶ Turn/)).toBeNull();
  });
});
