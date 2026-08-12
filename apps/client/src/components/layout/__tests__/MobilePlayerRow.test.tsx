// The phone's only route to a per-token DM control.
//
// S7 shipped a sight-radius control into PlayerSettingsMenu, which MobilePlayerRow
// renders — but the EDIT button that opens it was gated on `isMe`, so a DM could
// reach it on desktop (EntitiesPanel gives them a settings button on every card)
// and not on a phone. The control was wired end to end and unreachable, which is
// exactly the "six of ten controls off-screen" failure the mobile rule exists to
// stop. Found by opening the drawer at 375px, not by reading the code.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Player } from "@herobyte/shared";
import { MobilePlayerRow } from "../MobilePlayerRow";

function props(overrides: Partial<Parameters<typeof MobilePlayerRow>[0]> = {}) {
  const player = {
    uid: "player-2",
    name: "Player 2",
    characterId: "char-2",
    hp: 100,
    maxHp: 100,
    micLevel: 0,
    isDM: false,
    statusEffects: [],
  } as unknown as Player & { characterId: string };

  return {
    player,
    isMe: false,
    isDM: false,
    onToggleDMMode: vi.fn(),
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
    onCharacterNameUpdate: vi.fn(),
    onCharacterPortraitUpdate: vi.fn(),
    ...overrides,
  };
}

describe("MobilePlayerRow settings access", () => {
  it("offers EDIT on your own row", () => {
    render(<MobilePlayerRow {...props({ isMe: true })} />);

    expect(screen.getByRole("button", { name: /EDIT/ })).toBeInTheDocument();
  });

  it("offers EDIT on ANOTHER player's row to a DM", () => {
    render(<MobilePlayerRow {...props({ isMe: false, isDM: true })} />);

    expect(screen.getByRole("button", { name: /EDIT/ })).toBeInTheDocument();
  });

  it("offers no EDIT on another player's row to a plain player", () => {
    render(<MobilePlayerRow {...props({ isMe: false, isDM: false })} />);

    expect(screen.queryByRole("button", { name: /EDIT/ })).not.toBeInTheDocument();
  });

  it("reaches the sight radius control from a DM's tap on another player's row", () => {
    const onTokenVisionRadiusChange = vi.fn();
    render(
      <MobilePlayerRow
        {...props({
          isMe: false,
          isDM: true,
          token: { id: "t", owner: "player-2", x: 0, y: 0, color: "red", visionRadius: 30 },
          onTokenVisionRadiusChange,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    const field = screen.getByLabelText("Sight radius in feet");
    expect(field).toHaveValue(30);

    fireEvent.click(screen.getByRole("button", { name: "60 ft" }));
    expect(onTokenVisionRadiusChange).toHaveBeenCalledWith(60);

    // "Table Default", not "Unlimited": this is the per-token control, where
    // clearing the value makes the token follow the room-level default rather
    // than see forever. The wire value is still null.
    fireEvent.click(screen.getByRole("button", { name: "Table Default" }));
    expect(onTokenVisionRadiusChange).toHaveBeenLastCalledWith(null);
  });

  it("shows no sight controls when no handler is supplied (a plain player's own row)", () => {
    render(<MobilePlayerRow {...props({ isMe: true })} />);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.queryByLabelText("Sight radius in feet")).not.toBeInTheDocument();
  });
});
