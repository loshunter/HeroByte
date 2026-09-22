// The Monster HP Display control (S4): the buttons must drive the real
// callback with the real mode strings, and the current mode must read from
// the snapshot-fed prop — the wiring the review flagged as silently droppable.

import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Player, SceneObject } from "@herobyte/shared";
import PlayersTab, {
  REMOVE_PLAYER_GRACE_MS,
  getSeatTokenCount,
  removePlayerConfirm,
} from "../PlayersTab";
import type { SeatCharacter } from "../PlayersTab";

vi.mock("../../../../juice", () => ({
  useSfx: () => ({ play: vi.fn() }),
}));

function renderTab(overrides: Partial<React.ComponentProps<typeof PlayersTab>> = {}) {
  const onMonsterHpDisplayChange = vi.fn();
  const utils = render(
    <PlayersTab
      players={[]}
      sceneObjects={[]}
      characters={[]}
      onSelectPlayerTokens={vi.fn()}
      onMonsterHpDisplayChange={onMonsterHpDisplayChange}
      {...overrides}
    />,
  );
  return { onMonsterHpDisplayChange, ...utils };
}

describe("PlayersTab — Monster HP Display", () => {
  it("each button dispatches its real mode string", () => {
    const { onMonsterHpDisplayChange } = renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Bloodied" }));
    expect(onMonsterHpDisplayChange).toHaveBeenCalledWith("bloodied");
    fireEvent.click(screen.getByRole("button", { name: "Hidden" }));
    expect(onMonsterHpDisplayChange).toHaveBeenCalledWith("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Exact" }));
    expect(onMonsterHpDisplayChange).toHaveBeenCalledWith("exact");
  });

  it("highlights the current mode from the snapshot-fed prop", () => {
    renderTab({ monsterHpDisplay: "bloodied" });
    expect(screen.getByRole("button", { name: "Bloodied" })).toHaveClass("jrpg-button-primary");
    expect(screen.getByRole("button", { name: "Exact" })).not.toHaveClass("jrpg-button-primary");
  });

  it("the whole section is absent without the handler — no dead controls", () => {
    renderTab({ onMonsterHpDisplayChange: undefined });
    expect(screen.queryByText("Monster HP Display")).not.toBeInTheDocument();
  });
});

describe("PlayersTab — removing a player who is not at the table", () => {
  const ghost: Player = { uid: "ghost", name: "Ghost", isDM: false };
  const live: Player = { uid: "live", name: "Live", isDM: false };
  const rowOf = (name: string) =>
    screen.getByText(name).closest(".jrpg-frame-simple") as HTMLElement;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("REMOVE sits on the row outside the connected roster and on no other, and that row alone says so", () => {
    renderTab({ players: [ghost, live], connectedUids: ["live"], onRemovePlayer: vi.fn() });

    expect(within(rowOf("Ghost")).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(within(rowOf("Ghost")).getByText(/· not at the table/)).toBeInTheDocument();
    expect(within(rowOf("Live")).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(within(rowOf("Live")).queryByText(/· not at the table/)).not.toBeInTheDocument();
  });

  it("asks first — naming the player, that they are not at the table, and that there is no undo — and removes by uid only on yes", () => {
    const onRemovePlayer = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTab({ players: [ghost], connectedUids: [], onRemovePlayer });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(confirm).toHaveBeenCalledWith(removePlayerConfirm("Ghost", 0));
    expect(confirm.mock.calls[0][0]).toMatch(
      /^Remove Ghost from the table\? They are not at the table\..*There is no undo/,
    );
    expect(onRemovePlayer).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemovePlayer).toHaveBeenCalledExactlyOnceWith("ghost");
  });

  it("the count it names is what the server removes: locked tokens included, a token under someone else's character excluded", () => {
    const token = (id: string, owner: string, locked = false) =>
      ({ id: `token:${id}`, type: "token", owner, locked, zIndex: 10 }) as unknown as SceneObject;
    const sceneObjects = [
      token("own", "ghost"),
      token("padlocked", "ghost", true),
      token("troll", "ghost", true), // the troll the ghost placed while it had DM tools
      token("theirs", "live"),
    ];
    const characters: SeatCharacter[] = [
      { tokenId: "own", ownedByPlayerUID: "ghost", type: "pc" },
      { tokenId: "troll", ownedByPlayerUID: null, type: "npc" }, // an NPC: stays, with its token
    ];
    expect(getSeatTokenCount("ghost", sceneObjects, characters)).toBe(2);

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderTab({
      players: [ghost],
      connectedUids: [],
      onRemovePlayer: vi.fn(),
      sceneObjects,
      characters,
    });
    // Select All counts unlocked tokens only (own: 1); REMOVE's question counts what
    // goes (own + padlocked: 2) — the two numbers differ on purpose.
    expect(within(rowOf("Ghost")).getByText(/^1 token/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(confirm.mock.calls[0][0]).toMatch(/2 tokens on the map go with the seat/);
  });

  it("an NPC the departing player CLAIMED keeps its token too — only their own PCs go, whoever owns the token", () => {
    const token = (id: string, owner: string) =>
      ({
        id: `token:${id}`,
        type: "token",
        owner,
        locked: false,
        zIndex: 10,
      }) as unknown as SceneObject;
    const sceneObjects = [token("own", "ghost"), token("pet", "ghost")];
    const characters: SeatCharacter[] = [
      { tokenId: "own", ownedByPlayerUID: "ghost", type: "pc" },
      { tokenId: "pet", ownedByPlayerUID: "ghost", type: "npc" }, // claimed: unclaimed by the sweep, token kept
    ];
    expect(getSeatTokenCount("ghost", sceneObjects, characters)).toBe(1);
  });

  it("a PC's token the DM made and linked goes with the PC, so it is counted — whoever owns it", () => {
    const token = (id: string, owner: string) =>
      ({
        id: `token:${id}`,
        type: "token",
        owner,
        locked: false,
        zIndex: 10,
      }) as unknown as SceneObject;
    const sceneObjects = [token("dm-made", "dm-uid")];
    const characters: SeatCharacter[] = [
      { tokenId: "dm-made", ownedByPlayerUID: "ghost", type: "pc" },
    ];
    expect(getSeatTokenCount("ghost", sceneObjects, characters)).toBe(1);
  });

  it("a seat whose last heartbeat is under a minute old reads 'dropped just now' and offers no REMOVE; past the minute it does", () => {
    const now = 1_700_000_000_000;
    const blipped: Player = { uid: "blip", name: "Blip", lastHeartbeat: now - 20_000 };
    const gone: Player = {
      uid: "gone",
      name: "Gone",
      lastHeartbeat: now - REMOVE_PLAYER_GRACE_MS - 1,
    };
    renderTab({
      players: [blipped, gone],
      connectedUids: [],
      onRemovePlayer: vi.fn(),
      nowMs: () => now,
    });

    expect(within(rowOf("Blip")).getByText(/· dropped just now/)).toBeInTheDocument();
    expect(within(rowOf("Blip")).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(within(rowOf("Gone")).getByText(/· not at the table/)).toBeInTheDocument();
    expect(within(rowOf("Gone")).getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("a client clock BEHIND the server's is not 'recent': the button shows and the server's own refusal decides", () => {
    const now = 1_700_000_000_000;
    const fromTheFuture: Player = { uid: "f", name: "Future", lastHeartbeat: now + 5_000 };
    renderTab({
      players: [fromTheFuture],
      connectedUids: [],
      onRemovePlayer: vi.fn(),
      nowMs: () => now,
    });
    expect(within(rowOf("Future")).getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("the grace window is the server's figure, read from its source", () => {
    const serverSource = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../../../../../server/src/ws/handlers/removePlayer.ts",
      ),
      "utf8",
    );
    const serverMs = Number(
      serverSource.match(/REMOVE_PLAYER_GRACE_MS = ([\d_]+)/)?.[1]?.replace(/_/g, ""),
    );
    expect(serverMs, "the server's grace moved — mirror it here").toBe(REMOVE_PLAYER_GRACE_MS);
  });

  it("without the connected roster nobody can be told apart, so nobody gets REMOVE", () => {
    renderTab({ players: [ghost], onRemovePlayer: vi.fn() });
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByText(/· not at the table/)).not.toBeInTheDocument();
  });

  it("without the handler the row still says not at the table but offers nothing", () => {
    renderTab({ players: [ghost], connectedUids: [] });
    expect(screen.getByText(/· not at the table/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
