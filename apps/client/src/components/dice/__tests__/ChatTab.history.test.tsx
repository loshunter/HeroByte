import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChatMessage, Player } from "@herobyte/shared";
import { ChatTab } from "../ChatTab";

const alice: Player = { uid: "history-alice", name: "Alice" };
const bob: Player = { uid: "history-bob", name: "Bob" };
const message: ChatMessage = {
  id: "private-history",
  authorUid: alice.uid,
  authorName: alice.name,
  to: bob.uid,
  toName: "Bob",
  text: "Keep this audience identifiable",
  timestamp: 1,
};
const props = { currentUid: alice.uid, onSendChat: vi.fn() };

describe("whisper recipient display history", () => {
  it("keeps the name at send time through rename, removal and a panel remount", () => {
    const view = render(<ChatTab {...props} messages={[message]} players={[alice, bob]} />);
    expect(screen.getByTestId("chat-message")).toHaveTextContent("→ Bob:");
    view.rerender(
      <ChatTab {...props} messages={[message]} players={[alice, { ...bob, name: "Bobby" }]} />,
    );
    expect(screen.getByTestId("chat-message")).toHaveTextContent("→ Bob:");
    view.rerender(<ChatTab {...props} messages={[message]} players={[alice]} />);
    expect(screen.getByTestId("chat-message")).toHaveTextContent("→ Bob:");
    view.unmount();
    render(<ChatTab {...props} messages={[message]} players={[alice]} />);
    expect(screen.getByTestId("chat-message")).toHaveTextContent("→ Bob:");
  });

  it.each([undefined, "", 42, { name: "invalid imported value" }])(
    "uses the legacy roster fallback for a missing or malformed stamp (%j)",
    (toName) => {
      const legacy = { ...message, toName } as unknown as ChatMessage;
      const view = render(<ChatTab {...props} messages={[legacy]} players={[alice, bob]} />);
      expect(screen.getByTestId("chat-message")).toHaveTextContent("→ Bob:");
      view.rerender(<ChatTab {...props} messages={[legacy]} players={[alice]} />);
      expect(screen.getByTestId("chat-message")).toHaveTextContent("→ unknown:");
    },
  );

  it("renders the historical name as inert text", () => {
    render(
      <ChatTab
        {...props}
        messages={[{ ...message, toName: "<img src=x onerror=alert(1)>" }]}
        players={[]}
      />,
    );
    const entry = screen.getByTestId("chat-message");
    expect(entry).toHaveTextContent("→ <img src=x onerror=alert(1)>:");
    expect(entry.querySelector("img")).toBeNull();
  });

  it("keeps incoming whispers attributed to their author", () => {
    render(<ChatTab {...props} currentUid={bob.uid} messages={[message]} players={[bob]} />);
    expect(screen.getByTestId("chat-message")).toHaveTextContent("Alice →:");
    expect(screen.getByTestId("chat-message")).not.toHaveTextContent("→ Bob:");
  });
});
