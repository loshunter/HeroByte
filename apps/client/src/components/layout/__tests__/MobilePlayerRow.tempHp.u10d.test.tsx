// Temp HP on a phone (U10d). The phone's HP bar was handed a Temp HP handler that did
// nothing ("Simplify mobile view"), so a player could not track temporary hit points on
// their own phone mid-combat although the desktop card, the server and HPBar all support it.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Player } from "@herobyte/shared";
import { MobilePlayerRow, type TempHpEditing } from "../MobilePlayerRow";

afterEach(cleanup);

const row = (
  overrides: Partial<Parameters<typeof MobilePlayerRow>[0]> = {},
  tempHp?: Partial<TempHpEditing>,
) => {
  const handlers: TempHpEditing = {
    editingUID: null,
    input: "0",
    onInputChange: vi.fn(),
    onEdit: vi.fn(),
    onSubmit: vi.fn(),
    ...tempHp,
  };
  const player = {
    uid: "player-2",
    name: "Player 2",
    characterId: "char-2",
    hp: 40,
    maxHp: 50,
    tempHp: 7,
    micLevel: 0,
    isDM: false,
    statusEffects: [],
  } as unknown as Player & { characterId: string };
  render(
    <MobilePlayerRow
      player={player}
      isMe
      isDM={false}
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
      tempHp={handlers}
      onCharacterHpChange={vi.fn()}
      onCharacterNameUpdate={vi.fn()}
      onCharacterPortraitUpdate={vi.fn()}
      {...overrides}
    />,
  );
  return handlers;
};

describe("MobilePlayerRow temp HP", () => {
  it("shows the temp HP number as a button that starts the edit for THIS character", () => {
    const handlers = row();
    fireEvent.click(screen.getByRole("button", { name: /Set temp HP/i }));
    expect(handlers.onEdit).toHaveBeenCalledWith("char-2");
  });

  it("shows a named field while this character's temp HP is being edited, and submits on Enter", () => {
    const handlers = row({}, { editingUID: "char-2", input: "5" });
    const field = screen.getByRole("spinbutton", { name: "Temp HP" });
    expect(field).toHaveValue(5);
    fireEvent.change(field, { target: { value: "9" } });
    expect(handlers.onInputChange).toHaveBeenCalledWith("9");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(handlers.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not open the editor on a row that is not the one being edited", () => {
    row({}, { editingUID: "someone-else" });
    expect(screen.queryByRole("spinbutton", { name: "Temp HP" })).toBeNull();
  });

  it("offers a DM the editor on another player's row", () => {
    row({ isMe: false, isDM: true });
    expect(screen.getByRole("button", { name: /Set temp HP/i })).toBeInTheDocument();
  });

  it("offers a plain player no editor on someone else's row", () => {
    row({ isMe: false, isDM: false });
    expect(screen.queryByRole("button", { name: /Set temp HP/i })).toBeNull();
  });

  it("offers no editor on a row that was given no handlers (read-only)", () => {
    row({ tempHp: undefined });
    expect(screen.queryByRole("button", { name: /Set temp HP/i })).toBeNull();
  });
});
