/**
 * Tests for the mobile dock and tool sheet.
 *
 * The reason this file exists is S8's help entry, but the dock-stays-at-five
 * assertion below guards a rule older than S8: herobyte.css pins the dock to
 * `repeat(5, minmax(0, 1fr))`, and a sixth child would silently overflow it.
 * That rule is why chat became a tab in the roll log and why the dice options
 * went inside the roller — so it is worth a test rather than a comment.
 */

import React from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MobileFloatingControls } from "../MobileFloatingControls";
import { HELP_TOPICS } from "../../../features/help/helpTopics";

afterEach(() => cleanup());

const createProps = (overrides: Record<string, unknown> = {}) => ({
  onShowEntities: vi.fn(),
  onToggleDiceRoller: vi.fn(),
  onToggleRollLog: vi.fn(),
  onToolSelect: vi.fn(),
  onSnapToGridChange: vi.fn(),
  onResetCamera: vi.fn(),
  activeTool: null,
  snapToGrid: false,
  diceRollerOpen: false,
  rollLogOpen: false,
  toolsOpen: false,
  onToggleTools: vi.fn(),
  ...overrides,
});

describe("MobileFloatingControls", () => {
  it("keeps the action dock at exactly five buttons", () => {
    render(<MobileFloatingControls {...createProps()} />);

    const dock = screen.getByRole("navigation", { name: /mobile actions/i });
    expect(within(dock).getAllByRole("button")).toHaveLength(5);
  });

  it("does not add help to the dock", () => {
    render(<MobileFloatingControls {...createProps()} />);

    const dock = screen.getByRole("navigation", { name: /mobile actions/i });
    expect(within(dock).queryByText(/help/i)).not.toBeInTheDocument();
  });

  describe("help entry", () => {
    it("offers Help inside the tool sheet", () => {
      render(<MobileFloatingControls {...createProps({ toolsOpen: true })} />);

      const sheet = screen.getByRole("dialog", { name: /map tools/i });
      expect(within(sheet).getByRole("button", { name: /help/i })).toBeInTheDocument();
    });

    it("is unreachable while the tool sheet is closed", () => {
      render(<MobileFloatingControls {...createProps({ toolsOpen: false })} />);

      expect(screen.queryByRole("button", { name: /help/i })).not.toBeInTheDocument();
    });

    it("opens the manual and dismisses the tool sheet", () => {
      const props = createProps({ toolsOpen: true });
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(screen.getByRole("button", { name: /help/i }));

      // The sheet is arbitrated by MobileLayout, so closing it is a callback.
      expect(props.onToggleTools).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("dialog", { name: /herobyte help/i })).toBeInTheDocument();
    });

    it("does not select a tool when opening help", () => {
      const props = createProps({ toolsOpen: true });
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(screen.getByRole("button", { name: /help/i }));

      expect(props.onToolSelect).not.toHaveBeenCalled();
    });

    it("shows the same manual the desktop popover shows", () => {
      render(<MobileFloatingControls {...createProps({ toolsOpen: true })} />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));

      const dialog = screen.getByRole("dialog", { name: /herobyte help/i });
      for (const topic of HELP_TOPICS) {
        expect(within(dialog).getByRole("button", { name: topic.title })).toBeInTheDocument();
      }
    });

    it("closes again from its own close button", () => {
      render(<MobileFloatingControls {...createProps({ toolsOpen: true })} />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));

      fireEvent.click(screen.getByRole("button", { name: /close help/i }));

      expect(screen.queryByRole("dialog", { name: /herobyte help/i })).not.toBeInTheDocument();
    });
  });

  describe("the help sheet's height rule", () => {
    // A SOURCE-TEXT rule, for the same reason barrelValueExports.test.ts is one:
    // nothing that executes in this repo can see this bug. jsdom computes no
    // layout, and Playwright's fixed viewport makes vh, dvh and svh identical —
    // so a cap in the wrong unit stays green everywhere and only breaks on a
    // real phone, where it clipped the sheet's only close button off-screen.
    const css = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "..",
        "theme",
        "herobyte.css",
      ),
      "utf8",
    );
    // The lookbehind is load-bearing. `.mobile-help-sheet` is ALSO the last
    // selector of the shared sheet block above, written one selector per line —
    // so both a bare match and a newline-anchored one silently read that rule
    // instead, and every assertion below goes vacuous. Requiring that the line
    // before it does not end in a comma is what picks out the standalone rule.
    const helpSheetRule = /(?<!,)\n\.mobile-help-sheet\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

    it("caps itself in the same viewport unit as .mobile-layout-root", () => {
      expect(helpSheetRule).not.toBe("");
      // The container is 100dvh with overflow:hidden. 100vh is the LARGE
      // viewport, taller by the browser chrome, and the sheet is bottom-anchored
      // — so a vh-only cap pushes its top off the screen by exactly that much.
      expect(helpSheetRule).toMatch(/max-height:\s*calc\(\s*100dvh\b/);
    });

    it("keeps a plain vh cap before it as the fallback", () => {
      // Declaration order is the whole mechanism: browsers without dvh keep the
      // vh line, browsers with it take the later one.
      const vhAt = helpSheetRule.search(/max-height:\s*calc\(\s*100vh\b/);
      const dvhAt = helpSheetRule.search(/max-height:\s*calc\(\s*100dvh\b/);
      expect(vhAt).toBeGreaterThanOrEqual(0);
      expect(dvhAt).toBeGreaterThan(vhAt);
    });
  });
});
