import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RollLogContent } from "../RollLogContent";
import { RollLog } from "../RollLog";

const props = {
  rolls: [],
  onClearLog: vi.fn(),
  onViewRoll: vi.fn(),
  onSendChat: vi.fn(),
  currentUid: "navigation-player",
};

let playerSequence = 0;
beforeEach(() => {
  sessionStorage.clear();
  // The production fallback deliberately survives remounts. Each test gets a
  // fresh identity, including when this module's tests are shuffled or repeated.
  props.currentUid = `navigation-player-${++playerSequence}`;
});

describe("Chat & Rolls navigation", () => {
  it("opens Chat for a fresh player and leaves Rolls reachable", () => {
    render(<RollLogContent {...props} />);
    expect(screen.getByLabelText("Chat message")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "CHAT", selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "ROLLS" }));
    expect(screen.getByText("No rolls yet...")).toBeInTheDocument();
  });

  it("remembers a chosen tab across the desktop window and mobile content mounts", () => {
    const desktop = render(<RollLog {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "ROLLS" }));
    desktop.unmount();

    const mobile = render(<RollLogContent {...props} />);
    expect(screen.getByRole("tab", { name: "ROLLS", selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "CHAT" }));
    mobile.unmount();

    render(<RollLog {...props} />);
    expect(screen.getByLabelText("Chat message")).toBeInTheDocument();
  });

  it("does not change tabs or discard compose text when snapshots update", () => {
    const { rerender } = render(<RollLogContent {...props} />);
    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "unfinished" } });
    const rolls = [
      { id: "r1", playerName: "Other", formula: "d8", perDie: [], total: 8, timestamp: 1 },
    ];
    rerender(<RollLogContent {...props} rolls={rolls} />);
    expect(screen.getByLabelText("Chat message")).toHaveValue("unfinished");
    fireEvent.click(screen.getByRole("tab", { name: "ROLLS" }));
    rerender(<RollLogContent {...props} rolls={[...rolls]} chatMessages={[]} />);
    expect(screen.getByRole("tab", { name: "ROLLS", selected: true })).toBeInTheDocument();
  });

  it("isolates the preference by player identity, including a mounted identity change", () => {
    const { rerender } = render(<RollLogContent {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "ROLLS" }));
    rerender(<RollLogContent {...props} currentUid={`${props.currentUid}-other`} />);
    expect(screen.getByLabelText("Chat message")).toBeInTheDocument();
    rerender(<RollLogContent {...props} />);
    expect(screen.getByRole("tab", { name: "ROLLS", selected: true })).toBeInTheDocument();
  });

  it("falls back to Rolls without chat capability without overwriting the Chat preference", () => {
    const { rerender } = render(<RollLogContent {...props} onSendChat={undefined} />);
    expect(screen.getByText("No rolls yet...")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "CHAT" })).not.toBeInTheDocument();
    rerender(<RollLogContent {...props} />);
    expect(screen.getByLabelText("Chat message")).toBeInTheDocument();
  });

  it("ignores malformed preferences and tolerates blocked browser storage", () => {
    sessionStorage.setItem(`herobyte:chat-rolls-tab:${props.currentUid}`, "unknown");
    const { unmount } = render(<RollLogContent {...props} />);
    expect(screen.getByLabelText("Chat message")).toBeInTheDocument();
    unmount();
    const read = vi.fn(() => {
      throw new Error("blocked");
    });
    const write = vi.fn(() => {
      throw new Error("blocked");
    });
    vi.stubGlobal("sessionStorage", { getItem: read, setItem: write });
    try {
      render(<RollLogContent {...props} />);
      fireEvent.click(screen.getByRole("tab", { name: "ROLLS" }));
      expect(screen.getByText("No rolls yet...")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("remembers a tab across remounts with denied storage without sharing it between players", () => {
    const firstUid = `${props.currentUid}-denied-a`;
    const secondUid = `${props.currentUid}-denied-b`;
    const read = vi.fn(() => {
      throw new Error("blocked");
    });
    const write = vi.fn(() => {
      throw new Error("blocked");
    });
    vi.stubGlobal("sessionStorage", { getItem: read, setItem: write });
    try {
      const first = render(<RollLogContent {...props} currentUid={firstUid} />);
      fireEvent.click(screen.getByRole("tab", { name: "ROLLS" }));
      expect(read).toHaveBeenCalled();
      expect(write).toHaveBeenCalled();
      first.unmount();

      const { rerender } = render(<RollLogContent {...props} currentUid={firstUid} />);
      expect(screen.getByRole("tab", { name: "ROLLS", selected: true })).toBeInTheDocument();
      rerender(<RollLogContent {...props} currentUid={secondUid} />);
      expect(screen.getByRole("tab", { name: "CHAT", selected: true })).toBeInTheDocument();
      rerender(<RollLogContent {...props} currentUid={firstUid} onSendChat={undefined} />);
      expect(screen.getByText("No rolls yet...")).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "CHAT" })).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
