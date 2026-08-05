/**
 * Tests for the in-app help panel (S8).
 *
 * Covers the desktop header popover and the shared HelpPanel body. The mobile
 * entry point is covered in MobileFloatingControls.test.tsx, because "the phone
 * can reach it" is a different claim from "the panel renders".
 */

import React from "react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HelpMenuButton } from "../HelpMenuButton";
import { HelpPanel } from "../HelpPanel";
import { HELP_LINKS, HELP_TOPICS } from "../helpTopics";

afterEach(() => cleanup());

describe("HelpMenuButton", () => {
  it("renders a header button with the panel closed", () => {
    render(<HelpMenuButton />);

    const button = screen.getByRole("button", { name: /help/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens and closes the panel on click", () => {
    render(<HelpMenuButton />);
    const button = screen.getByRole("button", { name: /help/i });

    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: /herobyte help/i })).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<HelpMenuButton />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores keys that are not Escape", () => {
    render(<HelpMenuButton />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    fireEvent.keyDown(document, { key: "a" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on an outside mousedown but not an inside one", () => {
    render(<HelpMenuButton />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("detaches its document listeners once closed", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    render(<HelpMenuButton />);

    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    const removed = removeSpy.mock.calls.map((call) => call[0]);
    expect(removed).toContain("mousedown");
    expect(removed).toContain("keydown");
    removeSpy.mockRestore();
  });
});

describe("HelpPanel", () => {
  beforeEach(() => render(<HelpPanel />));

  it("lists every topic, collapsed", () => {
    for (const topic of HELP_TOPICS) {
      const button = screen.getByRole("button", { name: topic.title });
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
    // No topic body is on screen until one is opened.
    expect(screen.queryByText(HELP_TOPICS[0].entries[0].detail)).not.toBeInTheDocument();
  });

  it("expands a topic to reveal its entries and collapses it again", () => {
    const topic = HELP_TOPICS[0];
    const button = screen.getByRole("button", { name: topic.title });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    for (const entry of topic.entries) {
      expect(screen.getByText(entry.term)).toBeInTheDocument();
      expect(screen.getByText(entry.detail)).toBeInTheDocument();
    }

    fireEvent.click(button);
    expect(screen.queryByText(topic.entries[0].detail)).not.toBeInTheDocument();
  });

  it("keeps only one topic open at a time", () => {
    const [first, second] = HELP_TOPICS;

    fireEvent.click(screen.getByRole("button", { name: first.title }));
    fireEvent.click(screen.getByRole("button", { name: second.title }));

    expect(screen.queryByText(first.entries[0].detail)).not.toBeInTheDocument();
    expect(screen.getByText(second.entries[0].detail)).toBeInTheDocument();
  });

  it("links out to every guide, safely, in a new tab", () => {
    for (const link of HELP_LINKS) {
      const anchor = screen.getByRole("link", { name: new RegExp(link.label, "i") });
      expect(anchor).toHaveAttribute("href", link.href);
      expect(anchor).toHaveAttribute("target", "_blank");
      // Without noopener the opened tab can reach back through window.opener.
      expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});

describe("help content", () => {
  it("has unique topic ids and unique terms within a topic", () => {
    const ids = HELP_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const topic of HELP_TOPICS) {
      const terms = topic.entries.map((e) => e.term);
      expect(new Set(terms).size, `duplicate term in ${topic.id}`).toBe(terms.length);
    }
  });

  it("has no empty topic, term, or detail", () => {
    expect(HELP_TOPICS.length).toBeGreaterThan(0);
    for (const topic of HELP_TOPICS) {
      expect(topic.title.trim()).not.toBe("");
      expect(topic.entries.length, `${topic.id} has no entries`).toBeGreaterThan(0);
      for (const entry of topic.entries) {
        expect(entry.term.trim()).not.toBe("");
        expect(entry.detail.trim()).not.toBe("");
      }
    }
  });

  it("points every guide link at the repo's user guide on the deployed branch", () => {
    expect(HELP_LINKS.length).toBeGreaterThan(0);
    for (const link of HELP_LINKS) {
      // main is production; linking dev would show visitors unreleased docs.
      expect(link.href).toMatch(
        /^https:\/\/github\.com\/loshunter\/HeroByte\/blob\/main\/docs\/user-guide\/[\w-]+\.md$/,
      );
    }
  });
});
