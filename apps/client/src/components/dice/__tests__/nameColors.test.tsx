// Chat and roll log names in each author's colour (C3), lifted to read on the
// navy panel; your own lines keep a cursor mark; an author with no colour (or
// who left) keeps today's gold and cyan.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { contrastRatio, parseColor, type ChatMessage, type Player } from "@herobyte/shared";
import { ChatTab } from "../ChatTab";
import { RollLogContent } from "../RollLogContent";
import type { RollLogEntry } from "../rollLogTypes";

const ALICE = "uid-alice";
const BOB = "uid-bob";
const players: Player[] = [
  { uid: ALICE, name: "Alice", isDM: false },
  { uid: BOB, name: "Bob", isDM: false },
];
const NAVY = parseColor("#0f0e1e")!;
const contrastOnNavy = (cssColor: string) => {
  const [r, g, b] = cssColor.match(/\d+/g)!.map(Number);
  return contrastRatio({ r: r! / 255, g: g! / 255, b: b! / 255 }, NAVY);
};

const line = (authorUid: string, authorName: string, id: string): ChatMessage => ({
  id,
  authorUid,
  authorName,
  text: "hello",
  timestamp: 1,
});

function nameOf(text: string): HTMLElement {
  return screen.getByText(
    (_, element) => element?.tagName === "SPAN" && element.textContent === text,
  );
}

describe("chat names", () => {
  it("draws each author's name in their colour, lifted to 4.5:1 on the navy", () => {
    render(
      <ChatTab
        messages={[line(BOB, "Bob", "m1"), line(ALICE, "Alice", "m2")]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
        playerColors={
          new Map([
            [BOB, "#390076"],
            [ALICE, "#ffc2d3"],
          ])
        }
      />,
    );
    const bob = nameOf("Bob: ");
    // #390076 itself is 1.3:1 there; lifted, hue kept, to #8867d7.
    expect(bob.style.color).toBe("rgb(136, 103, 215)");
    expect(contrastOnNavy(bob.style.color)).toBeGreaterThanOrEqual(4.5);
    expect(nameOf("▶ Alice: ").style.color).toBe("rgb(255, 194, 211)");
  });

  it("dims a whisper's text, never its name, so the lifted colour still reads", () => {
    render(
      <ChatTab
        messages={[{ ...line(BOB, "Bob", "w1"), to: ALICE, text: "psst" }]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
        playerColors={new Map([[BOB, "#390076"]])}
      />,
    );
    const entry = screen.getByTestId("chat-message");
    expect(entry.style.opacity).toBe("");
    expect(nameOf("Bob →: ").style.color).toBe("rgb(136, 103, 215)");
    expect(screen.getByText("psst").style.opacity).toBe("0.85");
  });

  it("names your own whisper's recipient in their colour, and hides the ▶ mark from readers", () => {
    render(
      <ChatTab
        messages={[{ ...line(ALICE, "Alice", "w2"), to: BOB, text: "psst" }]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
        playerColors={
          new Map([
            [BOB, "#390076"],
            [ALICE, "#ffc2d3"],
          ])
        }
      />,
    );
    expect(nameOf("▶ → Bob: ").style.color).toBe("rgb(136, 103, 215)");
    const mark = screen.getByTestId("chat-message").querySelector('[aria-hidden="true"]');
    expect(mark?.textContent).toBe("▶ ");
  });

  it("follows a recolour on the next render", () => {
    // Only the colours change; the messages and the handler stay put, so a list of
    // dependencies that missed the colours could not hide behind them.
    const messages = [line(BOB, "Bob", "m1")];
    const onSendChat = vi.fn();
    const view = (color: string) => (
      <ChatTab
        messages={messages}
        players={players}
        currentUid={ALICE}
        onSendChat={onSendChat}
        playerColors={new Map([[BOB, color]])}
      />
    );
    const { rerender } = render(view("#390076"));
    rerender(view("#ffc2d3"));
    expect(nameOf("Bob: ").style.color).toBe("rgb(255, 194, 211)");
  });

  it("keeps today's gold on your own whisper to someone with no colour", () => {
    render(
      <ChatTab
        messages={[{ ...line(ALICE, "Alice", "w3"), to: BOB, text: "psst" }]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
        playerColors={new Map([[ALICE, "#ffc2d3"]])}
      />,
    );
    // The recipient has no colour: your line keeps today's gold, never your own colour.
    expect(nameOf("▶ → Bob: ").style.color).toBe("var(--jrpg-gold)");
  });

  it("marks your own lines, and keeps today's gold and cyan without colours", () => {
    render(
      <ChatTab
        messages={[line(BOB, "Bob", "m1"), line(ALICE, "Alice", "m2")]}
        players={players}
        currentUid={ALICE}
        onSendChat={vi.fn()}
      />,
    );
    expect(nameOf("Bob: ").style.color).toBe("var(--jrpg-cyan)");
    expect(nameOf("▶ Alice: ").style.color).toBe("var(--jrpg-gold)");
  });
});

describe("roll log names", () => {
  const roll = (playerUid: string | undefined, playerName: string): RollLogEntry =>
    ({
      id: `r-${playerName}`,
      formula: "1d20",
      perDie: [],
      total: 12,
      timestamp: 1,
      playerName,
      playerUid,
    }) as unknown as RollLogEntry;

  it("draws the roller's name in their colour, lifted, and gold without one", () => {
    render(
      <RollLogContent
        rolls={[roll(BOB, "Bob"), roll("uid-left", "Gone")]}
        onClearLog={vi.fn()}
        onViewRoll={vi.fn()}
        playerColors={new Map([[BOB, "#2626d9"]])}
      />,
    );
    const bob = screen.getByText("Bob");
    // #2626d9 is 2.14:1 on the navy; lifted to #4d6eff.
    expect(bob.style.color).toBe("rgb(77, 110, 255)");
    expect(contrastOnNavy(bob.style.color)).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByText("Gone").style.color).toBe("var(--jrpg-gold)");
  });

  it("follows a recolour on the next render", () => {
    // Only the colours change; the rolls and the handlers stay put.
    const rolls = [roll(BOB, "Bob")];
    const onClearLog = vi.fn();
    const onViewRoll = vi.fn();
    const view = (color: string) => (
      <RollLogContent
        rolls={rolls}
        onClearLog={onClearLog}
        onViewRoll={onViewRoll}
        playerColors={new Map([[BOB, color]])}
      />
    );
    const { rerender } = render(view("#2626d9"));
    rerender(view("#ffc2d3"));
    expect(screen.getByText("Bob").style.color).toBe("rgb(255, 194, 211)");
  });
});
