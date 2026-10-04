import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RollLogContent } from "../RollLogContent";
import { RollLog } from "../RollLog";

const props = {
  rolls: [],
  onClearLog: vi.fn(),
  onViewRoll: vi.fn(),
  onSendChat: vi.fn(),
  currentUid: "tab-accessibility-player",
};

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("Chat & Rolls accessible tabs", () => {
  it("connects native tabs to distinct named panels with one tab stop", () => {
    render(<RollLogContent {...props} />);
    const list = screen.getByRole("tablist", { name: "Chat & Rolls" });
    expect(list).toHaveAttribute("aria-orientation", "horizontal");
    const chat = within(list).getByRole("tab", { name: "CHAT", selected: true });
    const rolls = within(list).getByRole("tab", { name: "ROLLS", selected: false });
    expect(within(list).getAllByRole("tab")).toHaveLength(2);
    expect(chat.tagName).toBe("BUTTON");
    expect(rolls.tagName).toBe("BUTTON");
    expect(chat).toHaveAttribute("tabindex", "0");
    expect(rolls).toHaveAttribute("tabindex", "-1");
    expect(chat).not.toHaveAttribute("aria-pressed");
    expect(rolls).not.toHaveAttribute("aria-pressed");

    const chatPanel = screen.getByRole("tabpanel", { name: "CHAT" });
    const rollsPanel = document.getElementById(rolls.getAttribute("aria-controls")!);
    expect(chat).toHaveAttribute("aria-controls", chatPanel.id);
    expect(chatPanel).toHaveAttribute("aria-labelledby", chat.id);
    expect(chatPanel).toContainElement(screen.getByLabelText("Chat message"));
    expect(chatPanel).toHaveAttribute("tabindex", "0");
    expect(rollsPanel).toHaveAttribute("role", "tabpanel");
    expect(rollsPanel).toHaveAttribute("aria-labelledby", rolls.id);
    expect(rollsPanel).not.toBeVisible();
    expect(chatPanel.id).not.toBe(rollsPanel!.id);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);

    fireEvent.click(rolls);
    expect(rollsPanel).toBe(screen.getByRole("tabpanel", { name: "ROLLS" }));
    expect(chatPanel).not.toBeVisible();
    expect(screen.queryByLabelText("Chat message")).not.toBeInTheDocument();
    expect(rollsPanel).toContainElement(screen.getByText("No rolls yet..."));
    expect(chat).toHaveAttribute("tabindex", "-1");
    expect(rolls).toHaveAttribute("tabindex", "0");
  });

  it.each([
    ["CHAT", "ArrowRight", "ROLLS"],
    ["ROLLS", "ArrowRight", "CHAT"],
    ["CHAT", "ArrowLeft", "ROLLS"],
    ["ROLLS", "ArrowLeft", "CHAT"],
    ["ROLLS", "Home", "CHAT"],
    ["CHAT", "Home", "CHAT"],
    ["CHAT", "End", "ROLLS"],
    ["ROLLS", "End", "ROLLS"],
  ])("moves focus and selection from %s with %s to %s without bubbling", (start, key, end) => {
    const tableKeys = vi.fn();
    render(
      <div onKeyDown={tableKeys}>
        <RollLogContent {...props} />
      </div>,
    );
    const source = screen.getByText(start);
    fireEvent.click(source);
    source.focus();
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    fireEvent(source, event);

    expect(event.defaultPrevented).toBe(true);
    expect(tableKeys).not.toHaveBeenCalled();
    const destination = screen.getByRole("tab", { name: end, selected: true });
    expect(destination).toHaveFocus();
    expect(destination).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { selected: false })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel", { name: end })).toBeVisible();
  });

  it.each(["Tab", "ArrowUp", "ArrowDown", "x"])("leaves %s to its normal owner", (key) => {
    const tableKeys = vi.fn();
    render(
      <div onKeyDown={tableKeys}>
        <RollLogContent {...props} />
      </div>,
    );
    const chat = screen.getByText("CHAT");
    chat.focus();
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    fireEvent(chat, event);
    expect(event.defaultPrevented).toBe(false);
    expect(tableKeys).toHaveBeenCalledOnce();
    expect(chat).toHaveFocus();
    expect(screen.getByLabelText("Chat message")).toBeInTheDocument();
  });

  it("focuses the clicked tab and keeps the existing discard-on-tab-away draft lifetime", () => {
    render(<RollLogContent {...props} />);
    const input = screen.getByLabelText("Chat message");
    fireEvent.change(input, { target: { value: "unfinished draft" } });
    input.focus();
    const rolls = screen.getByText("ROLLS");
    fireEvent.click(rolls);
    expect(rolls).toHaveFocus();
    expect(input).not.toBeInTheDocument();
    const chat = screen.getByText("CHAT");
    fireEvent.click(chat);
    expect(chat).toHaveFocus();
    expect(screen.getByLabelText("Chat message")).toHaveValue("");
    expect(props.onSendChat).not.toHaveBeenCalled();
  });

  it("keeps IDs stable and focus scoped across simultaneous desktop and mobile content", () => {
    const surfaces = () => (
      <>
        <section aria-label="Desktop">
          <RollLog {...props} />
        </section>
        <section aria-label="Mobile">
          <RollLogContent {...props} />
        </section>
      </>
    );
    const { rerender } = render(surfaces());
    const desktop = within(screen.getByRole("region", { name: "Desktop" }));
    const mobile = within(screen.getByRole("region", { name: "Mobile" }));
    const initialTabs = screen.getAllByRole("tab");
    const ids = initialTabs.flatMap((tab) => [tab.id, tab.getAttribute("aria-controls")]);
    expect(ids).toHaveLength(8);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(8);
    for (const tab of initialTabs) {
      expect(document.getElementById(tab.getAttribute("aria-controls")!)).toHaveAttribute(
        "aria-labelledby",
        tab.id,
      );
    }

    const mobileChat = mobile.getByRole("tab", { name: "CHAT" });
    mobileChat.focus();
    fireEvent.keyDown(mobileChat, { key: "ArrowRight" });
    expect(mobile.getByRole("tab", { name: "ROLLS", selected: true })).toHaveFocus();
    expect(desktop.getByRole("tab", { name: "CHAT", selected: true })).not.toHaveFocus();
    rerender(surfaces());
    expect(
      screen.getAllByRole("tab").flatMap((tab) => [tab.id, tab.getAttribute("aria-controls")]),
    ).toEqual(ids);
  });

  it("keeps CLEAR inside only the active Rolls panel and honors its permission", () => {
    const rolls = [
      { id: "r1", playerName: "Alice", formula: "d8", perDie: [], total: 8, timestamp: 1 },
    ];
    const { rerender } = render(<RollLogContent {...props} rolls={rolls} />);
    expect(screen.queryByRole("button", { name: "CLEAR" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("ROLLS"));
    const clear = within(screen.getByRole("tabpanel", { name: "ROLLS" })).getByRole("button", {
      name: "CLEAR",
    });
    fireEvent.click(clear);
    expect(props.onClearLog).toHaveBeenCalledOnce();
    rerender(<RollLogContent {...props} rolls={rolls} canClearLog={false} />);
    expect(screen.queryByRole("button", { name: "CLEAR" })).not.toBeInTheDocument();
  });

  it("omits tab semantics without chat capability and restores the remembered selection", () => {
    const { rerender } = render(<RollLogContent {...props} onSendChat={undefined} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
    expect(screen.getByText("No rolls yet...")).toBeInTheDocument();
    rerender(<RollLogContent {...props} />);
    expect(screen.getByRole("tab", { name: "CHAT", selected: true })).toBeInTheDocument();
  });
});
