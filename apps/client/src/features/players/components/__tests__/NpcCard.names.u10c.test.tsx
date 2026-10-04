// The NPC card's two icon buttons (found in the U10c journeys): a DM's screen reader said "eye"
// and "gear" for the visibility toggle and the settings button, the state lived only in the
// hover title, and with several NPCs on screen nothing said whose they were.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Character } from "@herobyte/shared";
import { NpcCard } from "../NpcCard";

afterEach(cleanup);

const goblin = (overrides?: Partial<Character>): Character => ({
  id: "npc-1",
  type: "npc",
  name: "Goblin scout",
  portrait: "",
  hp: 7,
  maxHp: 7,
  tokenId: null,
  ownedByPlayerUID: null,
  tokenImage: null,
  statusEffects: [],
  ...overrides,
});

const props = (character: Character) => ({
  character,
  isDM: true,
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onPlaceToken: vi.fn(),
  onToggleVisibility: vi.fn(),
  tokenLocked: false,
  onToggleTokenLock: vi.fn(),
  tokenSize: "medium" as const,
  onTokenSizeChange: vi.fn(),
  onFocusToken: vi.fn(),
  onInitiativeClick: vi.fn(),
  isDeleting: false,
  deletionError: null,
});

describe("NpcCard icon buttons say what they do and whose NPC it is", () => {
  it("names the visibility toggle by its action and the NPC", () => {
    render(<NpcCard {...props(goblin())} />);
    expect(
      screen.getByRole("button", { name: "Hide Goblin scout from players" }),
    ).toBeInTheDocument();
  });

  it("flips the name when the NPC is hidden", () => {
    render(<NpcCard {...props(goblin({ visibleToPlayers: false }))} />);
    expect(
      screen.getByRole("button", { name: "Show Goblin scout to players" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Hide Goblin scout/ })).toBeNull();
  });

  it("names the settings button for the NPC", () => {
    render(<NpcCard {...props(goblin())} />);
    expect(screen.getByRole("button", { name: "NPC settings: Goblin scout" })).toBeInTheDocument();
  });

  it("keeps the hover titles the browser tests find them by", () => {
    render(<NpcCard {...props(goblin())} />);
    expect(screen.getByTitle("Visible to players (click to hide)")).toBeInTheDocument();
    expect(screen.getByTitle("NPC settings")).toBeInTheDocument();
    cleanup();
    render(<NpcCard {...props(goblin({ visibleToPlayers: false }))} />);
    expect(screen.getByTitle("Hidden from players (click to show)")).toBeInTheDocument();
  });
});
