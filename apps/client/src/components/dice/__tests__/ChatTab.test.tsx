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

  it("renders punctuation literally instead of HTML-entity-escaping it", () => {
    // Chat prose contains < and & far more often than a player name does.
    // Running the text through DOMPurify before handing it to React as a text
    // child double-encodes: DOMPurify's parse path returns "a &lt; b", and
    // React then renders that string verbatim. React already escapes text
    // children, so the sanitize call added no safety and only corrupted
    // content.
    render(
      <ChatTab
        messages={[message({ text: "5 < 6 && you owe me 3 gold" })]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
      />,
    );

    const entry = screen.getByTestId("chat-message");
    expect(entry.textContent).toContain("5 < 6 && you owe me 3 gold");
    expect(entry.textContent).not.toContain("&lt;");
    expect(entry.textContent).not.toContain("&amp;");
  });

  it("scrolls to the newest message when the log grows", () => {
    // Newest-last means a new message lands below the fold; without an
    // autoscroll you send a message and watch nothing happen.
    const first = [message({ id: "m1", text: "one" })];
    const { rerender, container } = render(
      <ChatTab messages={first} players={players} currentUid={ALICE} onSendChat={vi.fn()} />,
    );

    const scroller = container.querySelector('[data-testid="chat-message"]')?.parentElement
      ?.parentElement as HTMLElement;
    // jsdom reports 0 heights, so drive the values the effect reads.
    Object.defineProperty(scroller, "scrollHeight", { value: 500, configurable: true });
    scroller.scrollTop = 0;

    rerender(
      <ChatTab
        messages={[...first, message({ id: "m2", text: "two" })]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
      />,
    );

    expect(scroller.scrollTop).toBe(500);
  });

  it("renders markup-looking text as inert text, never as elements", () => {
    const payload = "<img src=x onerror=alert(1)><script>alert(2)</script>";
    render(
      <ChatTab
        messages={[message({ text: payload })]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
      />,
    );

    const entry = screen.getByTestId("chat-message");
    // The security property is that NO element is constructed from the text.
    expect(entry.querySelector("img")).toBeNull();
    expect(entry.querySelector("script")).toBeNull();
    expect(entry.querySelectorAll("*")).toHaveLength(1); // just the author <span>
    // ...and the property that "onerror" does not appear as an ATTRIBUTE.
    expect(entry.querySelector("[onerror]")).toBeNull();

    // The characters themselves SHOULD survive: the user typed them, and
    // showing them verbatim is correct. DOMPurify used to delete the whole
    // run silently, which lost message content without making anything safer
    // — React escapes text children by construction.
    expect(entry.textContent).toContain(payload);
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
      perDie: [],
      total: 7,
      timestamp: 1,
      formula: "d6 + 1",
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
