// Label in name (U10b, WCAG 2.5.3): the words printed on the header's Table button are
// inside its accessible name, so someone using speech input can say what they read
// ("click DM", "click Sunday Game"). The button prints "DM" for a DM while its name
// said only "Dungeon Master"; it now says both, and keeps the long form last.
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TableMenu } from "../TableMenu";
import type { TableMenuProps } from "../tableMenuProps";

vi.mock("../../juice/sfxEngine", () => ({ sfxEngine: { play: vi.fn(), resume: vi.fn() } }));

afterEach(() => cleanup());

const MENU: TableMenuProps = {
  uid: "0123456789abcdef",
  tableName: "Sunday Game",
  isPublicTable: false,
  isConnected: true,
  isDM: false,
  roleKnown: true,
  onToggleDM: () => {},
  crtFilter: false,
  onCrtFilterChange: () => {},
};

const states: [string, Partial<TableMenuProps>][] = [
  ["a DM, online", { isDM: true }],
  ["a player, online", {}],
  ["a player, offline", { isConnected: false }],
  ["a DM, offline", { isDM: true, isConnected: false }],
  ["an unknown role", { roleKnown: false }],
];

it.each(states)("every word printed on the button is in its accessible name: %s", (_, patch) => {
  render(<TableMenu menu={{ ...MENU, ...patch }} />);
  const button = screen.getByRole("button", { name: /^Table menu:/ });
  const name = (button.getAttribute("aria-label") ?? "").toLowerCase();
  const printed = [".table-menu-button__name", ".table-menu-button__role"]
    .map((selector) => button.querySelector(selector)?.textContent?.trim())
    .filter((text): text is string => Boolean(text));
  expect(printed.length).toBeGreaterThan(0);
  for (const text of printed) {
    expect(name, `"${text}" is printed on the button`).toContain(text.toLowerCase());
  }
});

it("keeps 'Dungeon Master, online' as the end of a DM's name (the e2e specs read it)", () => {
  render(<TableMenu menu={{ ...MENU, isDM: true }} />);
  expect(screen.getByRole("button", { name: /^Table menu:/ })).toHaveAccessibleName(
    "Table menu: Sunday Game, DM, Dungeon Master, online",
  );
});
