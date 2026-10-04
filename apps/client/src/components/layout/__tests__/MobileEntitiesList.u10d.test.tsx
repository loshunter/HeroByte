// The phone's Party list passes the two U10d capabilities through to the right rows: Temp HP
// (an editor on your own row and, for a DM, on any) and Clear Initiative (in the character
// sheet of a row the viewer may act on). A row the viewer may not act on offers neither.
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
  pc("wolf", "Wolf", "them", { initiative: 17 }),
];

function renderList(isDM: boolean) {
  const onClearInitiative = vi.fn();
  const tempHp = {
    editingUID: null,
    input: "0",
    onInputChange: vi.fn(),
    onEdit: vi.fn(),
    onSubmit: vi.fn(),
  };
  render(
    <MobileEntitiesList
      players={players}
      characters={characters}
      uid={ME}
      isDM={isDM}
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
      tempHp={tempHp}
      onCharacterHpChange={vi.fn()}
      onCharacterStatusEffectsChange={vi.fn()}
      onCharacterNameUpdate={vi.fn()}
      onCharacterPortraitUpdate={vi.fn()}
      onTokenSizeChange={vi.fn()}
      onAddCharacter={vi.fn()}
      sceneObjects={[]}
      drawings={[]}
      onApplyPlayerState={vi.fn()}
      onToggleTokenLock={vi.fn()}
      onPlayerTokenDelete={undefined}
      onCharacterOwnerChange={vi.fn()}
      onFocusToken={vi.fn()}
      combatActive={false}
      currentTurnCharacterId={undefined}
      onOpenInitiative={vi.fn()}
      onClearInitiative={onClearInitiative}
    />,
  );
  return { onClearInitiative, tempHp };
}

const rowOf = (name: string) =>
  screen
    .getAllByTestId("mobile-player-row")
    .find((row) => within(row).queryByText(name, { exact: true }))!;

describe("MobileEntitiesList — Temp HP and Clear Initiative (U10d)", () => {
  it("gives a player the Temp HP editor on their own row only", () => {
    renderList(false);
    expect(
      within(rowOf("Ranger")).getByRole("button", { name: /Set temp HP/i }),
    ).toBeInTheDocument();
    expect(within(rowOf("Wolf")).queryByRole("button", { name: /Set temp HP/i })).toBeNull();
  });

  it("gives a DM the Temp HP editor on every row", () => {
    renderList(true);
    expect(within(rowOf("Wolf")).getByRole("button", { name: /Set temp HP/i })).toBeInTheDocument();
  });

  it("clears the player's OWN character's initiative from its sheet", () => {
    const { onClearInitiative } = renderList(false);
    fireEvent.click(within(rowOf("Ranger")).getByRole("button", { name: /EDIT/ }));
    fireEvent.click(screen.getByRole("button", { name: /Clear Initiative/ }));
    expect(onClearInitiative).toHaveBeenCalledWith("ranger");
  });

  it("lets a DM clear another player's character, and a plain player not even reach it", () => {
    const dm = renderList(true);
    fireEvent.click(within(rowOf("Wolf")).getByRole("button", { name: /EDIT/ }));
    fireEvent.click(screen.getByRole("button", { name: /Clear Initiative/ }));
    expect(dm.onClearInitiative).toHaveBeenCalledWith("wolf");
    cleanup();
    renderList(false);
    expect(within(rowOf("Wolf")).queryByRole("button", { name: /EDIT/ })).toBeNull();
  });
});
