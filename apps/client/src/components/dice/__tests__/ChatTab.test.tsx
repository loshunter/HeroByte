import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ChatMessage, Player } from "@herobyte/shared";
import { ChatTab } from "../ChatTab";
import { RollLog } from "../RollLog";

const ALICE = "uid-alice";
const BOB = "uid-bob";

const players: Player[] = [
  { uid: ALICE, name: "Alice", isDM: false },
  { uid: BOB, name: "Bob", isDM: false },
];

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: overrides.id ?? "m1",
    authorUid: overrides.authorUid ?? ALICE,
    authorName: overrides.authorName ?? "Alice",
    text: overrides.text ?? "hello",
    timestamp: overrides.timestamp ?? 1,
    ...(overrides.to ? { to: overrides.to } : {}),
  };
}

describe("ChatTab", () => {
  it("renders messages and the empty state", () => {
    const { rerender } = render(
      <ChatTab messages={[]} players={players} currentUid={ALICE} onSendChat={vi.fn()} />,
    );
    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();

    rerender(
      <ChatTab
        messages={[message({ text: "the door creaks" })]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
      />,
    );
    expect(screen.getByText(/the door creaks/)).toBeInTheDocument();
  });

  it("sends a public message on the SEND button and clears the box", () => {
    const onSendChat = vi.fn();
    render(<ChatTab messages={[]} players={players} currentUid={ALICE} onSendChat={onSendChat} />);

    const input = screen.getByLabelText("Chat message");
    fireEvent.change(input, { target: { value: "hello table" } });
    fireEvent.click(screen.getByText("SEND"));

    expect(onSendChat).toHaveBeenCalledWith("hello table", undefined);
    expect(input).toHaveValue("");
  });

  it("sends on Enter but not on Shift+Enter", () => {
    const onSendChat = vi.fn();
    render(<ChatTab messages={[]} players={players} currentUid={ALICE} onSendChat={onSendChat} />);
    const input = screen.getByLabelText("Chat message");

    fireEvent.change(input, { target: { value: "one" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSendChat).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSendChat).toHaveBeenCalledWith("one", undefined);
  });

  it("refuses to send an empty or whitespace-only message", () => {
    const onSendChat = vi.fn();
    render(<ChatTab messages={[]} players={players} currentUid={ALICE} onSendChat={onSendChat} />);
    const input = screen.getByLabelText("Chat message");

    fireEvent.click(screen.getByText("SEND"));
    expect(onSendChat).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "    " } });
    fireEvent.click(screen.getByText("SEND"));
    expect(onSendChat).not.toHaveBeenCalled();
  });

  it("sends a whisper when a target is selected, and excludes you from the target list", () => {
    const onSendChat = vi.fn();
    render(<ChatTab messages={[]} players={players} currentUid={ALICE} onSendChat={onSendChat} />);

    // Whispering to yourself is not offered.
    expect(screen.queryByText("Whisper to Alice")).not.toBeInTheDocument();
    expect(screen.getByText("Whisper to Bob")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Send to"), { target: { value: BOB } });
    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "psst" } });
    fireEvent.click(screen.getByText("SEND"));

    expect(onSendChat).toHaveBeenCalledWith("psst", BOB);
  });

  it("falls back to the whole table when the selected target leaves", () => {
    // Otherwise the composer silently stays aimed at someone who is gone and
    // every subsequent message vanishes into a whisper nobody receives.
    const onSendChat = vi.fn();
    const { rerender } = render(
      <ChatTab messages={[]} players={players} currentUid={ALICE} onSendChat={onSendChat} />,
    );
    fireEvent.change(screen.getByLabelText("Send to"), { target: { value: BOB } });

    rerender(
      <ChatTab
        messages={[]}
        players={[{ uid: ALICE, name: "Alice", isDM: false }]}
        currentUid={ALICE}
        onSendChat={onSendChat}
      />,
    );
    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "still here?" } });
    fireEvent.click(screen.getByText("SEND"));

    expect(onSendChat).toHaveBeenCalledWith("still here?", undefined);
  });

  it("renders message text as text, never as markup", () => {
    render(
      <ChatTab
        messages={[message({ text: "<img src=x onerror=alert(1)>" })]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
      />,
    );

    const entry = screen.getByTestId("chat-message");
    expect(entry.querySelector("img")).toBeNull();
    expect(entry.innerHTML).not.toContain("onerror");
  });
});

describe("RollLog tab strip", () => {
  const rollProps = {
    rolls: [],
    onClearLog: vi.fn(),
    onViewRoll: vi.fn(),
  };

  it("shows rolls by default — the e2e dice spec depends on it", () => {
    render(<RollLog {...rollProps} chatMessages={[]} players={players} onSendChat={vi.fn()} />);
    expect(screen.getByText(/No rolls yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Chat message")).not.toBeInTheDocument();
  });

  it("switches to chat and back", () => {
    render(<RollLog {...rollProps} chatMessages={[]} players={players} onSendChat={vi.fn()} />);

    fireEvent.click(screen.getByText("CHAT"));
    expect(screen.getByLabelText("Chat message")).toBeInTheDocument();
    expect(screen.queryByText(/No rolls yet/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("ROLLS"));
    expect(screen.getByText(/No rolls yet/i)).toBeInTheDocument();
  });

  it("hides the roll CLEAR button while chat is showing", () => {
    const roll = {
      id: "r1",
      playerName: "Alice",
      tokens: [],
      perDie: [],
      total: 7,
      timestamp: 1,
    };
    render(
      <RollLog
        {...rollProps}
        rolls={[roll]}
        chatMessages={[]}
        players={players}
        onSendChat={vi.fn()}
      />,
    );
    expect(screen.getByText("CLEAR")).toBeInTheDocument();

    fireEvent.click(screen.getByText("CHAT"));
    // Offering to clear ROLLS from the CHAT tab is a footgun, not a feature.
    expect(screen.queryByText("CLEAR")).not.toBeInTheDocument();
  });

  it("renders exactly as before when chat is not wired", () => {
    // Every existing call site passes only the four roll props; they must
    // keep getting the old panel, with no tab strip at all.
    render(<RollLog {...rollProps} />);
    expect(screen.queryByText("CHAT")).not.toBeInTheDocument();
    expect(screen.queryByText("ROLLS")).not.toBeInTheDocument();
    expect(screen.getByText(/No rolls yet/i)).toBeInTheDocument();
  });
});
