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

  describe("the manual takes part in single-sheet arbitration", () => {
    // It did not, despite a comment saying it "arbitrates with nothing". It
    // shares the tool sheet's bottom anchor and z-index, so tapping Tools with
    // the manual open mounted the tool sheet UNDERNEATH it and Tools read as
    // broken. Verified in a real browser before this fix: with both open, a hit
    // test in the tool sheet's own area returned the help panel.
    const openHelp = (props: ReturnType<typeof createProps>) => {
      render(<MobileFloatingControls {...props} />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      expect(screen.getByRole("dialog", { name: /herobyte help/i })).toBeInTheDocument();
    };

    const dockButton = (name: RegExp) =>
      within(screen.getByRole("navigation", { name: /mobile actions/i })).getByRole("button", {
        name,
      });

    it.each([
      ["Party", /party/i, "onShowEntities"],
      ["Tools", /tools/i, "onToggleTools"],
      ["Dice", /dice/i, "onToggleDiceRoller"],
      ["Log", /log/i, "onToggleRollLog"],
    ])("closes the manual when %s is tapped", (_label, pattern, callback) => {
      const props = createProps({ toolsOpen: true });
      openHelp(props);

      fireEvent.click(dockButton(pattern));

      expect(screen.queryByRole("dialog", { name: /herobyte help/i })).not.toBeInTheDocument();
      // The dock button must still do its own job, not merely swallow the tap.
      expect(props[callback as keyof typeof props]).toHaveBeenCalled();
    });
  });

  describe("the shared sheet height rule", () => {
    // A SOURCE-TEXT rule, for the same reason barrelValueExports.test.ts is one:
    // nothing that executes in this repo can see this bug. jsdom computes no
    // layout, and Playwright's fixed viewport makes vh, dvh and svh identical —
    // so a cap in the wrong unit stays green everywhere and only breaks on a
    // real phone, where it clipped the sheet's only close button off-screen.
    //
    // The rule started life on .mobile-help-sheet and now lives on the shared
    // block, so a new bottom sheet inherits it by joining the selector list
    // instead of by remembering to re-derive it.
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
    // \r? is load-bearing on Windows: without it the block below is still found,
    // but every anchored lookup in this file silently reads a different rule.
    const sharedSheetRule =
      /\.mobile-tool-sheet,\r?\n[\s\S]*?\.mobile-help-sheet\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    const helpSheetRule = /(?<![,\r])\r?\n\.mobile-help-sheet\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

    it("caps every sheet in the same viewport unit as .mobile-layout-root", () => {
      expect(sharedSheetRule).not.toBe("");
      // The container is 100dvh with overflow:hidden. 100vh is the LARGE
      // viewport, taller by the browser chrome, and the sheets are bottom-
      // anchored — so a vh-only cap pushes the top off the screen by that much.
      expect(sharedSheetRule).toMatch(/max-height:\s*calc\(\s*100dvh\b/);
    });

    it("derives the cap from the same offset it is anchored by", () => {
      // The bug this whole rule exists for is a height and a position that do
      // not know about each other. One variable in both places is the fix.
      expect(sharedSheetRule).toMatch(/bottom:\s*var\(--mobile-sheet-offset\)/);
      expect(sharedSheetRule).toMatch(
        /max-height:\s*calc\(\s*100dvh\s*-\s*var\(--mobile-sheet-offset\)/,
      );
    });

    it("keeps a plain vh cap before it as the fallback", () => {
      // Declaration order is the whole mechanism: browsers without dvh keep the
      // vh line, browsers with it take the later one.
      const vhAt = sharedSheetRule.search(/max-height:\s*calc\(\s*100vh\b/);
      const dvhAt = sharedSheetRule.search(/max-height:\s*calc\(\s*100dvh\b/);
      expect(vhAt).toBeGreaterThanOrEqual(0);
      expect(dvhAt).toBeGreaterThan(vhAt);
    });

    it("measures the cap against the border box, not the content box", () => {
      // Padding and border are added AFTER the calc on a content box, so a
      // capped sheet renders 26px taller than it was told to be and spends the
      // difference out of the breathing room the calc just reserved.
      expect(sharedSheetRule).toMatch(/box-sizing:\s*border-box/);
    });

    it("still paints the manual above the sheets MobileLayout mounts", () => {
      // The dock buttons are handled in JS, but the drawing and selection sheets
      // are mounted by MobileLayout on `drawMode && !showTools` — and opening
      // help sets showTools false, un-suppressing them. MobileLayout is at its
      // line ceiling and cannot be told about help, so paint order is the only
      // thing keeping the manual on top; at the shared 1600 it loses to whatever
      // is later in the DOM.
      const sharedZ = Number(/z-index:\s*(\d+)/.exec(sharedSheetRule)?.[1]);
      const helpZ = Number(/z-index:\s*(\d+)/.exec(helpSheetRule)?.[1]);

      expect(sharedZ).toBeGreaterThan(0);
      expect(helpZ).toBeGreaterThan(sharedZ);
    });
  });
});
