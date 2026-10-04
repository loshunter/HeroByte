// Clear Initiative on a phone (U10d). The desktop settings window had it; the phone's character
// sheet had no route to take a character out of the order, so a player who set the wrong
// initiative could set another but not clear it.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Player } from "@herobyte/shared";
import { MobilePlayerRow } from "../MobilePlayerRow";

afterEach(cleanup);

const row = (initiative: { value: number | undefined; onClear?: () => void } | undefined) =>
  render(
    <MobilePlayerRow
      player={
        {
          uid: "p1",
          name: "Thorn",
          characterId: "c1",
          hp: 10,
          maxHp: 10,
          micLevel: 0,
          isDM: false,
          statusEffects: [],
        } as unknown as Player & { characterId: string }
      }
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
      onCharacterHpChange={vi.fn()}
      onCharacterNameUpdate={vi.fn()}
      onCharacterPortraitUpdate={vi.fn()}
      initiative={initiative && { isTurn: false, focusKey: "initiative:c1", ...initiative }}
    />,
  );

const openSheet = () => fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

describe("MobilePlayerRow Clear Initiative", () => {
  it("is in the character sheet and clears this character's initiative", () => {
    const onClear = vi.fn();
    row({ value: 14, onClear });
    openSheet();
    expect(screen.getByText("Active: 14")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clear Initiative/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("is there but disabled while no initiative is set", () => {
    row({ value: undefined, onClear: vi.fn() });
    openSheet();
    expect(screen.getByText("No initiative set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clear Initiative/ })).toBeDisabled();
  });

  it("is absent when the viewer may not act on this row (no handler)", () => {
    row({ value: 14 });
    openSheet();
    expect(screen.queryByRole("button", { name: /Clear Initiative/ })).toBeNull();
  });
});
