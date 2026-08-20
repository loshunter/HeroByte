/**
 * Tests for useDiceRolling
 *
 * This suite used to pin the shape S5 removed: it asserted that the client
 * sent `total`, `breakdown`, `timestamp` and `playerUid: mockUid` on the wire
 * — every one of them forgeable, and the reason dice were (arc defect D2).
 * What it pins now is the opposite: that the message carries a formula and
 * NOTHING a tampered client could use to lie about who rolled what.
 *
 * Source: apps/client/src/hooks/useDiceRolling.ts
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useDiceRolling } from "../useDiceRolling.js";
import type { RoomSnapshot, Player, DiceRoll, ClientMessage } from "@herobyte/shared";

describe("useDiceRolling", () => {
  const mockUid = "test-player-uid";
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  const createMockSnapshot = (
    diceRolls: DiceRoll[] = [],
    players: Player[] = [],
  ): RoomSnapshot => ({
    users: [],
    players,
    characters: [],
    tokens: [],
    sceneObjects: [],
    drawings: [],
    pointers: [],
    mapBackground: undefined,
    playerStagingZone: undefined,
    gridSize: 50,
    gridSquareSize: 5,
    diceRolls,
    props: [],
  });

  const createServerRoll = (overrides: Partial<DiceRoll> = {}): DiceRoll => ({
    id: "roll-1",
    playerUid: mockUid,
    playerName: "Alice",
    formula: "d20 + 5",
    total: 18,
    breakdown: [
      { tokenId: "t0", die: "d20", rolls: [13], subtotal: 13 },
      { tokenId: "t1", subtotal: 5 },
    ],
    timestamp: 1000,
    ...overrides,
  });

  const renderDice = (snapshot: RoomSnapshot | null) =>
    renderHook(() => useDiceRolling({ snapshot, sendMessage: mockSendMessage, uid: mockUid }));

  // --------------------------------------------------------------------------
  // Panels
  // --------------------------------------------------------------------------

  describe("panel state", () => {
    it("starts with everything closed", () => {
      const { result } = renderDice(createMockSnapshot());

      expect(result.current.diceRollerOpen).toBe(false);
      expect(result.current.rollLogOpen).toBe(false);
      expect(result.current.viewingRoll).toBe(null);
    });

    it("toggles each panel independently", () => {
      const { result } = renderDice(createMockSnapshot());

      act(() => result.current.toggleDiceRoller(true));
      expect(result.current.diceRollerOpen).toBe(true);
      expect(result.current.rollLogOpen).toBe(false);

      act(() => result.current.toggleRollLog(true));
      act(() => result.current.toggleDiceRoller(false));
      expect(result.current.diceRollerOpen).toBe(false);
      expect(result.current.rollLogOpen).toBe(true);
    });

    it("remembers and clears the roll being viewed", () => {
      const { result } = renderDice(createMockSnapshot([createServerRoll()]));
      const entry = result.current.rollHistory[0]!;

      act(() => result.current.handleViewRoll(entry));
      expect(result.current.viewingRoll).toBe(entry);

      act(() => result.current.handleViewRoll(null));
      expect(result.current.viewingRoll).toBe(null);
    });
  });

  // --------------------------------------------------------------------------
  // What goes on the wire
  // --------------------------------------------------------------------------

  describe("sending a roll", () => {
    it("sends the formula and nothing else", () => {
      const { result } = renderDice(createMockSnapshot());

      act(() =>
        result.current.handleRoll({ formula: "2d6 + 3", mode: "normal", visibility: "public" }),
      );

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const message = mockSendMessage.mock.calls[0]![0] as ClientMessage;
      // Exact shape, not a subset: this is the assertion that fails the day
      // someone reintroduces a client-computed total or a client uid.
      expect(message).toEqual({ t: "dice-roll", formula: "2d6 + 3" });
    });

    it("omits mode and visibility at their defaults, and sends them otherwise", () => {
      const { result } = renderDice(createMockSnapshot());

      act(() => result.current.handleRoll({ formula: "d20", mode: "advantage", visibility: "dm" }));
      expect(mockSendMessage).toHaveBeenLastCalledWith({
        t: "dice-roll",
        formula: "d20",
        mode: "advantage",
        visibility: "dm",
      });

      act(() =>
        result.current.handleRoll({
          formula: "d20",
          mode: "disadvantage",
          visibility: "self",
        }),
      );
      expect(mockSendMessage).toHaveBeenLastCalledWith({
        t: "dice-roll",
        formula: "d20",
        mode: "disadvantage",
        visibility: "self",
      });
    });

    it("refuses to send an empty formula", () => {
      const { result } = renderDice(createMockSnapshot());

      act(() => result.current.handleRoll({ formula: "", mode: "normal", visibility: "public" }));
      act(() =>
        result.current.handleRoll({ formula: "   ", mode: "normal", visibility: "public" }),
      );

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("sends clear-roll-history with no payload", () => {
      const { result } = renderDice(createMockSnapshot());

      act(() => result.current.handleClearLog());

      expect(mockSendMessage).toHaveBeenCalledWith({ t: "clear-roll-history" });
    });

    it("keeps its callbacks stable across rerenders", () => {
      const { result, rerender } = renderDice(createMockSnapshot());
      const first = {
        roll: result.current.handleRoll,
        clear: result.current.handleClearLog,
        view: result.current.handleViewRoll,
      };

      rerender();

      expect(result.current.handleRoll).toBe(first.roll);
      expect(result.current.handleClearLog).toBe(first.clear);
      expect(result.current.handleViewRoll).toBe(first.view);
    });
  });

  // --------------------------------------------------------------------------
  // What comes back
  // --------------------------------------------------------------------------

  describe("roll history", () => {
    it("is empty without a snapshot", () => {
      const { result } = renderDice(null);
      expect(result.current.rollHistory).toEqual([]);
      expect(result.current.latestOwnRoll).toBe(null);
    });

    it("carries the server's formula, author, breakdown and total", () => {
      const { result } = renderDice(createMockSnapshot([createServerRoll()]));

      expect(result.current.rollHistory).toEqual([
        {
          id: "roll-1",
          playerUid: mockUid,
          playerName: "Alice",
          formula: "d20 + 5",
          perDie: [
            { tokenId: "t0", die: "d20", rolls: [13], dropped: undefined, subtotal: 13 },
            { tokenId: "t1", die: undefined, rolls: undefined, dropped: undefined, subtotal: 5 },
          ],
          total: 18,
          mode: undefined,
          visibility: undefined,
          timestamp: 1000,
        },
      ]);
    });

    it("carries the server's label, so an initiative roll says which creature", () => {
      // This mapper ENUMERATES the fields it copies. Adding `label` to the
      // client type alone leaves TypeScript green while the log renders
      // undefined for ever — and a component test built on a hand-made
      // RollLogEntry would pass without ever crossing the wire boundary. This
      // is the only assertion in the suite that catches that.
      const { result } = renderDice(
        createMockSnapshot([createServerRoll({ label: "Goblin A — initiative" })]),
      );

      expect(result.current.rollHistory[0]?.label).toBe("Goblin A — initiative");
    });

    it("leaves the label undefined on an ordinary dice roll", () => {
      const { result } = renderDice(createMockSnapshot([createServerRoll()]));

      expect(result.current.rollHistory[0]?.label).toBeUndefined();
    });

    it("carries advantage's discarded dice and the visibility badge", () => {
      const { result } = renderDice(
        createMockSnapshot([
          createServerRoll({
            mode: "advantage",
            visibility: "dm",
            breakdown: [{ tokenId: "t0", die: "d20", rolls: [19], dropped: [4], subtotal: 19 }],
          }),
        ]),
      );

      const entry = result.current.rollHistory[0]!;
      expect(entry.mode).toBe("advantage");
      expect(entry.visibility).toBe("dm");
      expect(entry.perDie[0]?.dropped).toEqual([4]);
    });

    it("survives a roll with no formula", () => {
      // RollEntry reads `.length` on it to decide whether to collapse the row,
      // inside the render path — an absent formula would take the log down.
      const { result } = renderDice(
        createMockSnapshot([{ ...createServerRoll(), formula: undefined as unknown as string }]),
      );

      expect(result.current.rollHistory[0]?.formula).toBe("");
    });

    it("survives a roll with a missing or non-array breakdown", () => {
      // A session file handed to a DM can carry either: load-session checks
      // that each roll is an object, not that its fields have the right shape.
      // This runs inside a render-path useMemo, so a TypeError here takes the
      // whole table's UI down rather than dropping one log row.
      for (const breakdown of [undefined, { not: "an array" }, "nope", 7]) {
        const { result } = renderDice(
          createMockSnapshot([
            { ...createServerRoll(), breakdown: breakdown as unknown as DiceRoll["breakdown"] },
          ]),
        );
        expect(result.current.rollHistory[0]?.perDie).toEqual([]);
      }
    });

    it("survives a poisoned non-array diceRolls instead of throwing", () => {
      const snapshot = createMockSnapshot();
      (snapshot as unknown as { diceRolls: unknown }).diceRolls = { not: "an array" };

      const { result } = renderDice(snapshot);

      expect(result.current.rollHistory).toEqual([]);
    });

    it("does not filter anything — rolls it should not see never arrived", () => {
      // A renderer that hid rolls it received would not be secrecy. The
      // server's recipient filter is the only gate; whatever is in the
      // snapshot is what this player is entitled to.
      const { result } = renderDice(
        createMockSnapshot([
          createServerRoll({ id: "mine", playerUid: mockUid, visibility: "self" }),
          createServerRoll({ id: "theirs", playerUid: "someone-else", visibility: "dm" }),
        ]),
      );

      expect(result.current.rollHistory.map((r) => r.id)).toEqual(["mine", "theirs"]);
    });
  });

  describe("latestOwnRoll", () => {
    it("is the newest roll authored by this player", () => {
      const { result } = renderDice(
        createMockSnapshot([
          createServerRoll({ id: "a", playerUid: mockUid }),
          createServerRoll({ id: "b", playerUid: "someone-else" }),
          createServerRoll({ id: "c", playerUid: mockUid }),
          createServerRoll({ id: "d", playerUid: "someone-else" }),
        ]),
      );

      expect(result.current.latestOwnRoll?.id).toBe("c");
    });

    it("is null when this player has not rolled", () => {
      const { result } = renderDice(
        createMockSnapshot([createServerRoll({ id: "a", playerUid: "someone-else" })]),
      );

      expect(result.current.latestOwnRoll).toBe(null);
    });
  });

  // --------------------------------------------------------------------------
  // Chat rides along
  // --------------------------------------------------------------------------

  describe("chat", () => {
    it("sends a public line and a whisper, carrying no author either way", () => {
      const { result } = renderDice(createMockSnapshot());

      act(() => result.current.handleSendChat("  hello  "));
      expect(mockSendMessage).toHaveBeenLastCalledWith({ t: "chat", text: "hello" });

      act(() => result.current.handleSendChat("psst", "bob-uid"));
      expect(mockSendMessage).toHaveBeenLastCalledWith({
        t: "chat",
        text: "psst",
        to: "bob-uid",
      });
    });

    it("refuses an empty line", () => {
      const { result } = renderDice(createMockSnapshot());

      act(() => result.current.handleSendChat("   "));

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("passes the server's already-filtered chat log straight through", () => {
      const snapshot = createMockSnapshot();
      snapshot.chatLog = [{ id: "m1", authorUid: "a", authorName: "A", text: "hi", timestamp: 1 }];

      const { result } = renderDice(snapshot);

      expect(result.current.chatMessages).toEqual(snapshot.chatLog);
    });
  });
});
