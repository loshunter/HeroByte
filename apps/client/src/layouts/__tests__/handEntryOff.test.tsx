// The dice roller's hand entry honours the table switch (DM Menu → Table → Permissions →
// "Players can enter rolls by hand"), on the desktop and the phone. It used to offer
// ✋ I ROLLED IT and ✋ THAT'S NOT WHAT I ROLLED to every player whatever the switch said,
// and the server dropped the entry with only a log line of its own: the player's number
// vanished without a word. Off, a player gets the note in their place; the DM keeps both.
// Driven through the real layouts, because the bug was in their wiring, not the roller.

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RollLogEntry } from "../../components/dice/rollLogTypes";
import { createKickMobileProps } from "../../features/interaction/__tests__/kickMobile.props";
import { HAND_ENTRY_OFF_NOTE } from "../../features/initiative/manualOverride";
import type { MainLayoutProps } from "../props/MainLayoutProps";

vi.mock("../../components/layout/EntitiesPanel", () => ({
  EntitiesPanel: () => <div data-testid="entities-panel" />,
}));
vi.mock("../../ui/MapBoard", () => ({ default: () => <div data-testid="map-board" /> }));
vi.mock("../../features/dm/lazy-entry", () => ({ DMMenuContainer: () => null }));

import { MainLayout } from "../MainLayout";
import { MobileLayout } from "../MobileLayout";

const myRoll: RollLogEntry = {
  id: "roll-1",
  playerUid: "test-uid",
  playerName: "Me",
  formula: "d20",
  perDie: [{ tokenId: "t0", die: "d20", rolls: [12], subtotal: 12 }],
  total: 12,
  timestamp: 1,
};

const layouts = [
  { name: "desktop", Layout: MainLayout, entry: "roller-hand-entry-open" },
  { name: "phone", Layout: MobileLayout, entry: "mobile-roller-hand-entry-open" },
] as const;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each(layouts)("the $name dice roller's hand entry", ({ Layout, entry }) => {
  /** Open the roller, roll a d20, and let the server's answer land on it. */
  function rollOnce(props: MainLayoutProps) {
    const view = render(<Layout {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
    fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
    view.rerender(<Layout {...props} latestOwnRoll={myRoll} />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
  ])("isDM=%s, table allows hand entry=%s → offered=%s", (isDM, allowed, offered) => {
    const props: MainLayoutProps = {
      ...createKickMobileProps(),
      isDM,
      uid: "test-uid",
      diceRollerOpen: true,
      snapshot: {
        combatActive: false,
        initiativeManualOverride: allowed ? undefined : false,
      } as MainLayoutProps["snapshot"],
    };

    rollOnce(props);

    expect(Boolean(screen.queryByTestId(entry))).toBe(offered);
    // The roll's own result card, opened by the roller: THAT'S NOT WHAT I ROLLED.
    expect(screen.getAllByText("12").length).toBeGreaterThan(0);
    expect(Boolean(screen.queryByTestId("result-hand-entry-open"))).toBe(offered);
    expect(Boolean(screen.queryByText(HAND_ENTRY_OFF_NOTE))).toBe(!offered);
  });
});
