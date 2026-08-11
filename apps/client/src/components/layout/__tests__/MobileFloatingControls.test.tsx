/**
 * Tests for the mobile dock and tool sheet.
 *
 * The reason this file exists is S8's help entry, but the dock-stays-at-five
 * assertion below guards a rule older than S8: herobyte.css pins the dock to
 * `repeat(5, minmax(0, 1fr))`, and a sixth child would silently overflow it.
 * That rule is why chat became a tab in the roll log and why the dice options
 * went inside the roller — so it is worth a test rather than a comment.
 *
 * Since M4a this component no longer owns any open/closed state: every button
 * reports the surface it stands for and useMobileSurface arbitrates. The
 * manual itself renders in MobileSurfaces, and the tests that used to watch
 * it arbitrate here now live in MobileLayout.test.tsx, against the machine.
 */

import React from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MobileFloatingControls } from "../MobileFloatingControls";
import type { MobileSurface } from "../../../hooks/useMobileSurface";
import type { MapEditToolbarProps } from "../../../features/map-edit/mapEditTypes";

afterEach(() => cleanup());

/** Only the fields the mobile palette reads; the rest of the 40-prop toolbar
 *  bag belongs to the desktop window and would be noise here. */
export const createToolbarProps = (overrides: Record<string, unknown> = {}) =>
  ({
    isLive: false,
    busy: false,
    activeSubTool: "wall",
    onSelectSubTool: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onStartLiveMap: vi.fn(),
    onClose: vi.fn(),
    error: null,
    ...overrides,
  }) as unknown as MapEditToolbarProps;

const createProps = (overrides: Record<string, unknown> = {}) => ({
  surface: "none" as MobileSurface,
  onToggleSurface: vi.fn(),
  onToolSelect: vi.fn(),
  onSnapToGridChange: vi.fn(),
  onResetCamera: vi.fn(),
  activeTool: null,
  snapToGrid: false,
  isDM: false,
  mode: false,
  mapEditToolbarProps: createToolbarProps(),
  onCancelMapEditDrag: vi.fn(),
  ...overrides,
});

describe("MobileFloatingControls", () => {
  it.each([[false], [true]])("keeps the action dock at exactly five buttons (isDM: %s)", (isDM) => {
    render(<MobileFloatingControls {...createProps({ isDM })} />);

    const dock = screen.getByRole("navigation", { name: /mobile actions/i });
    expect(within(dock).getAllByRole("button")).toHaveLength(5);
  });

  it("does not add help to the dock", () => {
    render(<MobileFloatingControls {...createProps()} />);

    const dock = screen.getByRole("navigation", { name: /mobile actions/i });
    expect(within(dock).queryByText(/help/i)).not.toBeInTheDocument();
  });

  describe("the dock reports surfaces to the machine", () => {
    const dockButton = (name: RegExp) =>
      within(screen.getByRole("navigation", { name: /mobile actions/i })).getByRole("button", {
        name,
      });

    it.each([
      ["Party", /party/i, "party"],
      ["Tools", /tools/i, "tools"],
      ["Dice", /dice/i, "dice"],
      ["Log", /log/i, "log"],
    ])("%s toggles its surface", (_label, pattern, surface) => {
      const props = createProps();
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(dockButton(pattern));

      expect(props.onToggleSurface).toHaveBeenCalledExactlyOnceWith(surface);
    });

    it("View resets the camera without touching the machine", () => {
      const props = createProps();
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(dockButton(/view/i));

      expect(props.onResetCamera).toHaveBeenCalledTimes(1);
      expect(props.onToggleSurface).not.toHaveBeenCalled();
    });
  });

  describe("slot five is contextual (M4a)", () => {
    // The dock is a hardcoded 5-column grid; a sixth child overlaps rather
    // than wraps (settled, handoff §9). So the DM entry does not get a sixth
    // button — it gets slot five, which was a whole slot spent on the single
    // reset-camera action.
    it("a player gets View and no DM entry", () => {
      render(<MobileFloatingControls {...createProps()} />);

      const dock = screen.getByRole("navigation", { name: /mobile actions/i });
      expect(within(dock).getByRole("button", { name: /view/i })).toBeInTheDocument();
      expect(within(dock).queryByRole("button", { name: /dm/i })).not.toBeInTheDocument();
    });

    it("a DM gets DM in slot five and View leaves the dock", () => {
      render(<MobileFloatingControls {...createProps({ isDM: true })} />);

      const dock = screen.getByRole("navigation", { name: /mobile actions/i });
      const buttons = within(dock).getAllByRole("button");
      expect(buttons[4]).toHaveTextContent(/dm/i);
      expect(within(dock).queryByRole("button", { name: /view/i })).not.toBeInTheDocument();
    });

    it("the DM button toggles the dm surface", () => {
      const props = createProps({ isDM: true });
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(
        within(screen.getByRole("navigation", { name: /mobile actions/i })).getByRole("button", {
          name: /dm/i,
        }),
      );

      expect(props.onToggleSurface).toHaveBeenCalledExactlyOnceWith("dm");
    });

    it("a DM keeps reset-camera: Recenter sits in the tool sheet and closes it", () => {
      const props = createProps({ isDM: true, surface: "tools" });
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(screen.getByRole("button", { name: /recenter/i }));

      expect(props.onResetCamera).toHaveBeenCalledTimes(1);
      expect(props.onToggleSurface).toHaveBeenCalledExactlyOnceWith("tools");
      expect(props.onToolSelect).not.toHaveBeenCalled();
    });
  });

  describe("the tool sheet", () => {
    it("renders only while the tools surface is open", () => {
      const { rerender } = render(<MobileFloatingControls {...createProps()} />);
      expect(screen.queryByRole("dialog", { name: /map tools/i })).not.toBeInTheDocument();

      rerender(<MobileFloatingControls {...createProps({ surface: "tools" })} />);
      expect(screen.getByRole("dialog", { name: /map tools/i })).toBeInTheDocument();
    });

    it("closes from its own ✕ by toggling the tools surface", () => {
      const props = createProps({ surface: "tools" });
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(screen.getByRole("button", { name: /close tools/i }));

      expect(props.onToggleSurface).toHaveBeenCalledExactlyOnceWith("tools");
    });

    it("selects a tool and closes the sheet in one tap", () => {
      const props = createProps({ surface: "tools" });
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(screen.getByRole("button", { name: /ping/i }));

      expect(props.onToolSelect).toHaveBeenCalledExactlyOnceWith("pointer");
      expect(props.onToggleSurface).toHaveBeenCalledExactlyOnceWith("tools");
    });
  });

  describe("help entry", () => {
    it("offers Help inside the tool sheet", () => {
      render(<MobileFloatingControls {...createProps({ surface: "tools" })} />);

      const sheet = screen.getByRole("dialog", { name: /map tools/i });
      expect(within(sheet).getByRole("button", { name: /help/i })).toBeInTheDocument();
    });

    it("is unreachable while the tool sheet is closed", () => {
      render(<MobileFloatingControls {...createProps()} />);

      expect(screen.queryByRole("button", { name: /help/i })).not.toBeInTheDocument();
    });

    it("asks the machine for the help surface, which closes the sheet by construction", () => {
      const props = createProps({ surface: "tools" });
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(screen.getByRole("button", { name: /help/i }));

      expect(props.onToggleSurface).toHaveBeenCalledExactlyOnceWith("help");
    });

    it("does not select a tool when opening help", () => {
      const props = createProps({ surface: "tools" });
      render(<MobileFloatingControls {...props} />);

      fireEvent.click(screen.getByRole("button", { name: /help/i }));

      expect(props.onToolSelect).not.toHaveBeenCalled();
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
    // ALL standalone .mobile-help-sheet blocks, not just the first: the review
    // showed a single .exec() lets a duplicate rule appended later (or nested
    // in a media block, hence the \s* indent allowance) reinstate an override
    // while the inspected first block stays clean. The lookbehind still
    // excludes the shared selector list, whose preceding line ends in a comma.
    const helpSheetRules = [
      ...css.matchAll(/(?<![,\r])\r?\n\s*\.mobile-help-sheet\s*\{([^}]*)\}/g),
    ].map((m) => m[1]);

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

    it("no longer lets the manual carry its own z-index — in ANY of its rules", () => {
      // The 1650 override existed to out-paint sheets that could mount while
      // the manual was open. The surface machine unmounts them instead — one
      // surface at a time, by construction (MobileLayout.test.tsx pins it) —
      // and a reintroduced override anywhere in the file would be a sign that
      // exclusion broke and someone reached for paint order again.
      expect(helpSheetRules.length).toBeGreaterThan(0);
      for (const rule of helpSheetRules) {
        expect(rule).not.toMatch(/z-index/);
      }
    });
  });
});
