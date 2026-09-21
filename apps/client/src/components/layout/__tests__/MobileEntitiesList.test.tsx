// The phone's party drawer: the DM gate on the sight-radius handler, the speed
// field's gate and binding, and the movement-budget reset's gates (the
// plate's own). The sight-radius case is here because the obvious test for
// it is vacuous: MobileLayout hands this
// list `props.updateTokenVisionRadius` UNCONDITIONALLY, so "no handler supplied"
// never happens in production and a test that omits the handler proves nothing.
// These supply it exactly as the app does and vary only `isDM`.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Player, SnapshotCharacter, Token } from "@herobyte/shared";
import { MobileEntitiesList } from "../MobileEntitiesList";

const ME = "me-uid";

const tokens: Token[] = [{ id: "my-token", owner: ME, x: 1, y: 1, color: "red", visionRadius: 30 }];

const players = [
  { uid: ME, name: "Me", hp: 10, maxHp: 10, micLevel: 0, isDM: false, statusEffects: [] },
] as unknown as Player[];

const characters = [
  { id: "char-1", name: "Me", type: "pc", ownedByPlayerUID: ME, hp: 10, maxHp: 10 },
] as unknown as SnapshotCharacter[];

function renderList(
  isDM: boolean,
  onTokenVisionRadiusChange = vi.fn(),
  extra: Partial<React.ComponentProps<typeof MobileEntitiesList>> = {},
) {
  render(
    <MobileEntitiesList
      {...extra}
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
      tokens={tokens}
      onTokenVisionRadiusChange={onTokenVisionRadiusChange}
    />,
  );
  return onTokenVisionRadiusChange;
}

describe("delete character — the desktop gate, on a phone", () => {
  const deleteButton = () => screen.queryByRole("button", { name: /Delete this character/ });

  it("a DM gets Delete on another player's row, bound to that character", () => {
    const onDeleteCharacter = vi.fn();
    const other = { ...players[0], uid: "other-uid", name: "Other" };
    const otherCharacter = {
      ...characters[0],
      id: "char-other",
      name: "Other",
      ownedByPlayerUID: "other-uid",
    };
    render(
      <MobileEntitiesList
        players={[players[0], other] as Player[]}
        characters={[characters[0], otherCharacter] as SnapshotCharacter[]}
        uid={ME}
        isDM={true}
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
        onDeleteCharacter={onDeleteCharacter}
      />,
    );
    const otherRow = screen
      .getAllByTestId("mobile-player-row")
      .find((row) => within(row).queryByText("Other") !== null)!;
    fireEvent.click(within(otherRow).getByRole("button", { name: /EDIT/ }));

    fireEvent.click(deleteButton()!);
    expect(onDeleteCharacter).toHaveBeenCalledWith("char-other");
  });

  it("a player gets Delete on their own row and no EDIT at all on another's", () => {
    const onDeleteCharacter = vi.fn();
    const other = { ...players[0], uid: "other-uid", name: "Other" };
    const otherCharacter = {
      ...characters[0],
      id: "char-other",
      name: "Other",
      ownedByPlayerUID: "other-uid",
    };
    render(
      <MobileEntitiesList
        players={[players[0], other] as Player[]}
        characters={[characters[0], otherCharacter] as SnapshotCharacter[]}
        uid={ME}
        isDM={false}
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
        onDeleteCharacter={onDeleteCharacter}
      />,
    );
    const rows = screen.getAllByTestId("mobile-player-row");
    const mine = rows.find((row) => within(row).queryByText("Me") !== null)!;
    const theirs = rows.find((row) => within(row).queryByText("Other") !== null)!;

    expect(within(theirs).queryByRole("button", { name: /EDIT/ })).not.toBeInTheDocument();
    fireEvent.click(within(mine).getByRole("button", { name: /EDIT/ }));
    fireEvent.click(deleteButton()!);
    expect(onDeleteCharacter).toHaveBeenCalledWith("char-1");
  });
});

describe("movement speed — the DM gate and the character binding", () => {
  it("a DM's row binds the speed handler to the CHARACTER's id; a player's row gets none", () => {
    const onCharacterSpeedChange = vi.fn();
    render(
      <MobileEntitiesList
        {...listProps({ isDM: true, onCharacterSpeedChange })}
        characters={[{ ...characters[0]!, speed: 25 }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    const field = screen.getByLabelText("Movement speed in feet per turn");
    expect(field).toHaveValue(25);
    fireEvent.change(field, { target: { value: "35" } });
    fireEvent.blur(field);
    expect(onCharacterSpeedChange).toHaveBeenCalledWith("char-1", 35);
  });

  it("a player with NO character (the legacy row) gets no speed field — there is nothing to set it on", () => {
    render(
      <MobileEntitiesList
        {...listProps({ isDM: true, onCharacterSpeedChange: vi.fn() })}
        characters={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.queryByLabelText("Movement speed in feet per turn")).not.toBeInTheDocument();
  });

  it("a plain player never sees the field, handler or not", () => {
    render(<MobileEntitiesList {...listProps({ isDM: false, onCharacterSpeedChange: vi.fn() })} />);
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.queryByLabelText("Movement speed in feet per turn")).not.toBeInTheDocument();
  });
});

describe("movement budget reset — the plate's own gate, and the character binding", () => {
  const inCombat = {
    isDM: true,
    combatActive: true,
    onCharacterSpeedChange: vi.fn(),
  };
  const combatant = { ...characters[0]!, initiative: 12, movementUsed: 10 };

  it("a DM's row reads the spend and binds the reset to the CHARACTER's id", () => {
    const onCharacterBudgetReset = vi.fn();
    render(
      <MobileEntitiesList
        {...listProps({ ...inCombat, onCharacterBudgetReset })}
        characters={[combatant]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.getByText("Used 10 ft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset movement budget" }));
    expect(onCharacterBudgetReset).toHaveBeenCalledWith("char-1");
  });

  it("a plain player never sees it, handler or not — the server would only drop the message", () => {
    render(
      <MobileEntitiesList
        {...listProps({ ...inCombat, isDM: false, onCharacterBudgetReset: vi.fn() })}
        characters={[combatant]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("out of combat, or with no initiative, there is no budget to reset — the plate shows none either", () => {
    const { unmount } = render(
      <MobileEntitiesList
        {...listProps({ ...inCombat, combatActive: false, onCharacterBudgetReset: vi.fn() })}
        characters={[combatant]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
    unmount();
    render(
      <MobileEntitiesList
        {...listProps({ ...inCombat, onCharacterBudgetReset: vi.fn() })}
        characters={[{ ...combatant, initiative: undefined, movementUsed: 0 }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("a DM-OWNED character in the order is a combatant (F3): its row carries the reset like a player's", () => {
    const dm = {
      uid: "dm-uid",
      name: "The DM",
      hp: 10,
      maxHp: 10,
      isDM: true,
    } as unknown as Player;
    const dmsOwn = {
      ...characters[0]!,
      id: "char-dm",
      name: "Sidekick",
      ownedByPlayerUID: "dm-uid",
      initiative: 15,
      movementUsed: 0,
    };
    render(
      <MobileEntitiesList
        {...listProps({ ...inCombat, players: [...players, dm], onCharacterBudgetReset: vi.fn() })}
        characters={[combatant, dmsOwn]}
      />,
    );
    const rows = screen.getAllByTestId("mobile-player-row");
    const sidekick = rows.find((row) => row.textContent?.includes("Sidekick"))!;
    fireEvent.click(within(sidekick).getByRole("button", { name: /EDIT/ }));
    expect(screen.getByRole("button", { name: "Reset movement budget" })).toBeDisabled();
    // The player's row in the same render carries it too — two sheets, two
    // readouts, each the right character's.
    const mine = rows.find((row) => row !== sidekick)!;
    fireEvent.click(within(mine).getByRole("button", { name: /EDIT/ }));
    expect(screen.getByText("Used 0 ft")).toBeInTheDocument(); // Sidekick's
    expect(screen.getByText("Used 10 ft")).toBeInTheDocument(); // the player's
    expect(screen.getAllByRole("button", { name: "Reset movement budget" })).toHaveLength(2);
  });

  it("a DM-OWNED character with NO initiative and nothing spent: no reset", () => {
    const dm = {
      uid: "dm-uid",
      name: "The DM",
      hp: 10,
      maxHp: 10,
      isDM: true,
    } as unknown as Player;
    const bench = {
      ...characters[0]!,
      id: "char-dm",
      name: "Understudy",
      ownedByPlayerUID: "dm-uid",
      initiative: undefined,
      movementUsed: 0,
    };
    render(
      <MobileEntitiesList
        {...listProps({ ...inCombat, players: [...players, dm], onCharacterBudgetReset: vi.fn() })}
        characters={[bench]}
      />,
    );
    const row = screen
      .getAllByTestId("mobile-player-row")
      .find((r) => r.textContent?.includes("Understudy"))!;
    fireEvent.click(within(row).getByRole("button", { name: /EDIT/ }));
    expect(screen.getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("a spend with NO initiative still gets the reset — the server charges any token moved in combat", () => {
    const onCharacterBudgetReset = vi.fn();
    render(
      <MobileEntitiesList
        {...listProps({ ...inCombat, onCharacterBudgetReset })}
        characters={[{ ...combatant, initiative: undefined, movementUsed: 20 }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.getByText("Used 20 ft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset movement budget" }));
    expect(onCharacterBudgetReset).toHaveBeenCalledWith("char-1");
  });

  it("the legacy row (no character) carries none", () => {
    render(
      <MobileEntitiesList
        {...listProps({ ...inCombat, onCharacterBudgetReset: vi.fn() })}
        characters={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });
});

// Everything the base fixture needs except the data under test.
function listProps(overrides: Partial<Parameters<typeof MobileEntitiesList>[0]> = {}) {
  return {
    players,
    characters,
    uid: ME,
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
    onCharacterStatusEffectsChange: vi.fn(),
    onCharacterNameUpdate: vi.fn(),
    onCharacterPortraitUpdate: vi.fn(),
    tokens,
    onTokenVisionRadiusChange: vi.fn(),
    ...overrides,
  };
}

describe("MobileEntitiesList rows", () => {
  // The bug this block exists for: the list was players.map + characters.find,
  // so every player resolved to whichever owned character find hit first. A
  // second character ("+ Add Character") had NO row on a phone — no HP, no
  // status, no rename, and S7's sight radius unreachable for exactly the extra
  // tokens a DM most needs. Desktop has been per-(player, character) all along
  // (useCombatOrdering's flatMap); this pins mobile to the same shape.
  const twoCharacters = [
    { id: "char-aria", name: "Aria", type: "pc", ownedByPlayerUID: ME, hp: 10, maxHp: 10 },
    { id: "char-boo", name: "Boo", type: "pc", ownedByPlayerUID: ME, hp: 7, maxHp: 12 },
  ] as unknown as SnapshotCharacter[];

  it("gives a second character its own row", () => {
    render(<MobileEntitiesList {...listProps({ characters: twoCharacters })} />);

    expect(screen.getByText("Aria")).toBeInTheDocument();
    expect(screen.getByText("Boo")).toBeInTheDocument();
  });

  it("edits the SECOND character's HP from the second row, not the first's", () => {
    // Row-count alone can pass with every row wired to the first character.
    // HPBar reports edits by the characterId the row handed it, so clicking
    // Boo's HP must name char-boo.
    const onHpEdit = vi.fn();
    render(<MobileEntitiesList {...listProps({ characters: twoCharacters, onHpEdit })} />);

    // HPBar renders the current HP as a bare clickable span and reports the
    // edit under the id the ROW handed it. Boo is 7/12 and Aria is 10/10, so
    // the text "7" belongs to Boo's row alone.
    fireEvent.click(screen.getByText("7"));

    expect(onHpEdit).toHaveBeenCalledExactlyOnceWith("char-boo", 7);
  });

  it("keeps one stats row for a legacy player with no character link", () => {
    const legacyPlayers = [
      ...players,
      { uid: "old-timer", name: "Old Timer", hp: 4, maxHp: 8, micLevel: 0, isDM: false },
    ] as unknown as Player[];
    render(<MobileEntitiesList {...listProps({ players: legacyPlayers })} />);

    expect(screen.getByText("Old Timer")).toBeInTheDocument();
  });

  it("gives an NPC no party row, even when the DM owns it", () => {
    // Matches useCombatOrdering's type gate: without it, characters.filter
    // would hand the DM's own row to a goblin.
    const withNpc = [
      ...twoCharacters,
      { id: "npc-1", name: "Goblin", type: "npc", ownedByPlayerUID: ME, hp: 5, maxHp: 5 },
    ] as unknown as SnapshotCharacter[];
    render(<MobileEntitiesList {...listProps({ characters: withNpc })} />);

    expect(screen.queryByText("Goblin")).not.toBeInTheDocument();
    expect(screen.getByText("Aria")).toBeInTheDocument();
    expect(screen.getByText("Boo")).toBeInTheDocument();
  });

  it("binds each row to its OWN character's token", () => {
    // The S7 regression shape, now with two characters: each row's sight
    // control must write to that row's token, not the player's first.
    const onChange = vi.fn();
    const linked = [
      { ...twoCharacters[0], tokenId: "aria-token" },
      { ...twoCharacters[1], tokenId: "boo-token" },
    ] as unknown as SnapshotCharacter[];
    const twoTokens: Token[] = [
      { id: "aria-token", owner: ME, x: 0, y: 0, color: "red", visionRadius: 30 },
      { id: "boo-token", owner: ME, x: 1, y: 1, color: "red", visionRadius: 90 },
    ];
    render(
      <MobileEntitiesList
        {...listProps({
          characters: linked,
          tokens: twoTokens,
          isDM: true,
          onTokenVisionRadiusChange: onChange,
        })}
      />,
    );

    // Two EDIT buttons now — sorted me-first with stable creation order, so
    // the second belongs to Boo.
    const editButtons = screen.getAllByRole("button", { name: /EDIT/ });
    expect(editButtons).toHaveLength(2);
    fireEvent.click(editButtons[1]);

    expect(screen.getByLabelText("Sight radius in feet")).toHaveValue(90);
    fireEvent.click(screen.getByRole("button", { name: "60 ft" }));
    expect(onChange).toHaveBeenCalledWith("boo-token", 60);
  });

  it("offers a token-less second character NO borrowed sight control", () => {
    // Measured live before this guard: add-player-character creates no token,
    // so the second character's tokenId is null — and the by-owner fallback
    // handed its row the FIRST character's token. A DM adjusting "Boo's"
    // sight was silently blinding Aria's token. No control is honest; a
    // control aimed at someone else's token is not.
    const linked = [
      { ...twoCharacters[0], tokenId: "aria-token" },
      twoCharacters[1], // Boo: no tokenId
    ] as unknown as SnapshotCharacter[];
    const ariaOnly: Token[] = [
      { id: "aria-token", owner: ME, x: 0, y: 0, color: "red", visionRadius: 30 },
    ];
    render(
      <MobileEntitiesList
        {...listProps({
          characters: linked,
          tokens: ariaOnly,
          isDM: true,
          onTokenVisionRadiusChange: vi.fn(),
        })}
      />,
    );

    const editButtons = screen.getAllByRole("button", { name: /EDIT/ });
    fireEvent.click(editButtons[1]); // Boo's row (stable creation order)

    expect(screen.queryByLabelText("Sight radius in feet")).not.toBeInTheDocument();
  });

  it("keeps the by-owner fallback for a SOLE character with an unlinked token", () => {
    // The case the fallback exists for — a single pre-linking character whose
    // player owns exactly one token. Unambiguous, so it stays.
    const unlinked = [twoCharacters[0]] as unknown as SnapshotCharacter[]; // no tokenId
    render(
      <MobileEntitiesList
        {...listProps({
          characters: unlinked,
          tokens, // my-token, owned by ME
          isDM: true,
          onTokenVisionRadiusChange: vi.fn(),
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.getByLabelText("Sight radius in feet")).toHaveValue(30);
  });
});

describe("MobileEntitiesList sight-radius gate", () => {
  it("offers no sight controls to a plain player on their OWN row", () => {
    renderList(false);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.queryByLabelText("Sight radius in feet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Blind" })).not.toBeInTheDocument();
  });

  it("offers them to a DM, bound to that row's token", () => {
    const onChange = renderList(true);

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.getByLabelText("Sight radius in feet")).toHaveValue(30);
    fireEvent.click(screen.getByRole("button", { name: "60 ft" }));
    expect(onChange).toHaveBeenCalledWith("my-token", 60);
  });

  // A player owns one token from joining and another per "+ Add Character", so
  // "the token this row is about" is NOT "the first token this player owns".
  // Binding by owner shows one character's row while writing to another
  // character's token — and the desktop list has never done that.
  it("binds to the row's CHARACTER token, not the first token the player owns", () => {
    const onChange = vi.fn();
    const twoTokens: Token[] = [
      { id: "joined-token", owner: ME, x: 0, y: 0, color: "red", visionRadius: 5 },
      { id: "character-token", owner: ME, x: 1, y: 1, color: "red", visionRadius: 90 },
    ];
    const linked = [
      {
        id: "char-1",
        name: "Me",
        type: "pc",
        ownedByPlayerUID: ME,
        hp: 10,
        maxHp: 10,
        tokenId: "character-token",
      },
    ] as unknown as SnapshotCharacter[];

    render(
      <MobileEntitiesList
        players={players}
        characters={linked}
        uid={ME}
        isDM
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
        tokens={twoTokens}
        onTokenVisionRadiusChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    // 90, the linked character's token — not 5, the one that happens to be first.
    expect(screen.getByLabelText("Sight radius in feet")).toHaveValue(90);
    fireEvent.click(screen.getByRole("button", { name: "30 ft" }));
    expect(onChange).toHaveBeenCalledWith("character-token", 30);
  });

  it("offers nothing when the row's player has no token to point at", () => {
    render(
      <MobileEntitiesList
        players={players}
        characters={characters}
        uid={ME}
        isDM
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
        tokens={[]}
        onTokenVisionRadiusChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

    expect(screen.queryByLabelText("Sight radius in feet")).not.toBeInTheDocument();
  });
});

describe("the by-owner token fallback never resolves a DM's row to a goblin they placed", () => {
  const goblinNpc = {
    id: "npc-g",
    name: "Goblin",
    type: "npc",
    ownedByPlayerUID: null,
    tokenId: "goblin",
    hp: 7,
    maxHp: 7,
  } as unknown as SnapshotCharacter;
  const unlinkedMe = { ...characters[0]!, tokenId: null } as unknown as SnapshotCharacter;

  it("with only the goblin's token owned, the row has no token — no sight control", () => {
    render(
      <MobileEntitiesList
        {...listProps({ isDM: true })}
        characters={[unlinkedMe, goblinNpc]}
        tokens={[{ id: "goblin", owner: ME, x: 0, y: 0, color: "green", visionRadius: 30 }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.queryByLabelText("Sight radius in feet")).not.toBeInTheDocument();
  });

  it("with one LOOSE own token beside the goblin's, the row binds to the loose one", () => {
    render(
      <MobileEntitiesList
        {...listProps({ isDM: true })}
        characters={[unlinkedMe, goblinNpc]}
        tokens={[
          { id: "goblin", owner: ME, x: 0, y: 0, color: "green", visionRadius: 30 },
          { id: "loose", owner: ME, x: 1, y: 1, color: "red", visionRadius: 45 },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
    expect(screen.getByLabelText("Sight radius in feet")).toHaveValue(45);
  });
});

describe("each row resolves the loose token of ITS player, not the viewer's", () => {
  it("two players with one loose token each: the rows bind their own", () => {
    const THEM = "them-uid";
    render(
      <MobileEntitiesList
        {...listProps({ isDM: true })}
        players={
          [
            ...players,
            {
              uid: THEM,
              name: "Them",
              hp: 8,
              maxHp: 8,
              micLevel: 0,
              isDM: false,
              statusEffects: [],
            },
          ] as unknown as Player[]
        }
        characters={
          [
            { ...characters[0]!, tokenId: null },
            {
              id: "char-2",
              name: "Them",
              type: "pc",
              ownedByPlayerUID: THEM,
              hp: 8,
              maxHp: 8,
              tokenId: null,
            },
          ] as unknown as SnapshotCharacter[]
        }
        tokens={[
          { id: "mine", owner: ME, x: 1, y: 1, color: "red", visionRadius: 45 },
          { id: "theirs", owner: THEM, x: 2, y: 2, color: "blue", visionRadius: 15 },
        ]}
      />,
    );
    const edits = screen.getAllByRole("button", { name: /EDIT/ });
    fireEvent.click(edits[0]!);
    fireEvent.click(edits[1]!);
    // Both rows open: the controls read, in row order, each player's OWN loose token.
    const controls = screen.getAllByLabelText("Sight radius in feet");
    expect(controls.map((c) => (c as HTMLInputElement).value)).toEqual(["45", "15"]);
  });
});

// The phone's party drawer carried the same legacy condition fallback the
// desktop panel did: a character with no conditions showed the OWNING PLAYER's
// list, so a sibling's condition appeared on both rows. Fixing only the
// desktop would have left a phone reading the wrong combatant as poisoned
// (UX-02). The chips render as "<emoji> <Label>" text, so counting them across
// the whole list pins which rows show one.
describe("a condition belongs to its character, not to the player's other rows", () => {
  const poisonedOwner = [
    {
      uid: ME,
      name: "Me",
      hp: 10,
      maxHp: 10,
      micLevel: 0,
      isDM: false,
      statusEffects: ["poisoned"],
    },
  ] as unknown as Player[];

  const aria = {
    id: "char-aria",
    name: "Aria",
    type: "pc",
    ownedByPlayerUID: ME,
    hp: 10,
    maxHp: 10,
  };
  const boo = { id: "char-boo", name: "Boo", type: "pc", ownedByPlayerUID: ME, hp: 7, maxHp: 12 };

  it("shows the chip on the afflicted character's row only", () => {
    render(
      <MobileEntitiesList
        {...listProps({
          players: poisonedOwner,
          characters: [
            { ...aria, statusEffects: ["poisoned"] },
            boo,
          ] as unknown as SnapshotCharacter[],
        })}
      />,
    );

    expect(screen.getAllByText("🤢 Poisoned")).toHaveLength(1);
  });

  it("still shows a lone character the legacy player-level list", () => {
    render(
      <MobileEntitiesList
        {...listProps({
          players: poisonedOwner,
          characters: [aria] as unknown as SnapshotCharacter[],
        })}
      />,
    );

    expect(screen.getAllByText("🤢 Poisoned")).toHaveLength(1);
  });

  it("keeps an explicitly empty list empty", () => {
    render(
      <MobileEntitiesList
        {...listProps({
          players: poisonedOwner,
          characters: [{ ...aria, statusEffects: [] }] as unknown as SnapshotCharacter[],
        })}
      />,
    );

    expect(screen.queryByText("🤢 Poisoned")).toBeNull();
  });
});
