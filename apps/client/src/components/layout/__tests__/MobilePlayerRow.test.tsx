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

  it("reaches the movement speed control from a DM's tap, at the 44px floor", () => {
    const onCharacterSpeedChange = vi.fn();
    render(
      <MobilePlayerRow
        {...props({ isMe: false, isDM: true, characterSpeed: 25, onCharacterSpeedChange })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    const field = screen.getByLabelText("Movement speed in feet per turn");
    expect(field).toHaveValue(25);
    expect(field).toHaveStyle({ minHeight: "44px" });
    fireEvent.change(field, { target: { value: "40" } });
    fireEvent.blur(field);
    expect(onCharacterSpeedChange).toHaveBeenCalledWith(40);
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

// The phone's EDIT sheet kept its own copy of the name from the moment the
// row mounted. After anyone else renamed the character, EDIT still showed the
// old name, and merely leaving the field sent it back as a rename, reverting
// theirs. Found by the U7 identity review; older than U7.
describe("MobilePlayerRow name field", () => {
  const named = (name: string) =>
    ({
      ...props().player,
      name,
    }) as Player & { characterId: string };

  it("EDIT shows the character's current name after someone else renames it", () => {
    const base = props({ isMe: true });
    const { rerender } = render(<MobilePlayerRow {...base} player={named("Companion")} />);
    rerender(<MobilePlayerRow {...base} player={named("Wolf")} />);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.getByDisplayValue("Wolf")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Companion")).not.toBeInTheDocument();
  });

  it("leaving the name unchanged sends no rename", () => {
    const base = props({ isMe: true });
    render(<MobilePlayerRow {...base} player={named("Wolf")} />);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    fireEvent.blur(screen.getByDisplayValue("Wolf"));

    expect(base.onCharacterNameUpdate).not.toHaveBeenCalled();
  });

  it("a changed name is still sent, trimmed", () => {
    const base = props({ isMe: true });
    render(<MobilePlayerRow {...base} player={named("Wolf")} />);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    const field = screen.getByDisplayValue("Wolf");
    fireEvent.change(field, { target: { value: "  Dire Wolf " } });
    fireEvent.blur(field);

    expect(base.onCharacterNameUpdate).toHaveBeenCalledExactlyOnceWith("char-2", "Dire Wolf");
  });
});

// A DM who loses DM rights (a deploy, a restart) must not keep another
// player's EDIT sheet open: every editor in it is now refused by the server.
// Older than U7; found by its permissions review.
describe("MobilePlayerRow after losing DM rights", () => {
  const sheet = () => document.querySelector('[data-mobile-surface="settings"]');

  it("a DM's sheet on another player's row closes, and stays closed on re-elevation", () => {
    const base = props({ isMe: false, isDM: true });
    const { rerender } = render(<MobilePlayerRow {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(sheet()).not.toBeNull();

    rerender(<MobilePlayerRow {...base} isDM={false} />);
    expect(sheet()).toBeNull();

    rerender(<MobilePlayerRow {...base} isDM={true} />);
    expect(sheet()).toBeNull();
  });

  it("your own row's sheet stays open when you give up DM", () => {
    const base = props({ isMe: true, isDM: true });
    const { rerender } = render(<MobilePlayerRow {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    rerender(<MobilePlayerRow {...base} isDM={false} />);
    expect(sheet()).not.toBeNull();
  });
});

describe("MobilePlayerRow conditions grid after losing DM rights", () => {
  it("a DM's open grid on another player's row does not reopen on re-elevation", () => {
    const base = props({ isMe: false, isDM: true, onStatusEffectsChange: vi.fn() });
    const { rerender } = render(<MobilePlayerRow {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "⚡ Manage Status" }));
    expect(screen.getByRole("button", { name: "Done Editing" })).toBeInTheDocument();

    rerender(<MobilePlayerRow {...base} isDM={false} />);
    rerender(<MobilePlayerRow {...base} isDM={true} />);

    expect(screen.getByRole("button", { name: "⚡ Manage Status" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done Editing" })).toBeNull();
  });
});

describe("MobilePlayerRow portrait field", () => {
  it("EDIT shows a portrait set elsewhere, not the one it mounted with", () => {
    const base = props({ isMe: true });
    const withPortrait = (portrait: string) =>
      ({ ...base.player, portrait }) as Player & { characterId: string };
    const { rerender } = render(<MobilePlayerRow {...base} player={withPortrait("a.png")} />);
    rerender(<MobilePlayerRow {...base} player={withPortrait("b.png")} />);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.getByDisplayValue("b.png")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("a.png")).not.toBeInTheDocument();
  });
});

describe("MobilePlayerRow HP", () => {
  it("a DM edits another player's HP from their row; a player does not", () => {
    const dm = props({ isMe: false, isDM: true });
    const { unmount } = render(<MobilePlayerRow {...dm} />);
    fireEvent.click(screen.getAllByText("100")[0]!);
    expect(dm.onHpEdit).toHaveBeenCalledWith("char-2", 100);
    unmount();

    const player = props({ isMe: false, isDM: false });
    render(<MobilePlayerRow {...player} />);
    fireEvent.click(screen.getAllByText("100")[0]!);
    expect(player.onHpEdit).not.toHaveBeenCalled();
  });
});
