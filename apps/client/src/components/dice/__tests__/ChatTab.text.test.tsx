// The chat's TEXT contract (U10b): prose is set in the body face (`jrpg-text-body`),
// not the 8 px pixel face (`jrpg-text-small`); controls keep the pixel face at the
// 11 px floor. The sizes themselves are measured in a browser
// (interface-chat-text.spec.ts, mobile/mobile-chat-text.spec.ts): jsdom loads no
// stylesheet, so what is pinned here is WHICH class and which inline size each piece wears.
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ChatMessage, Player } from "@herobyte/shared";
import { ChatTab } from "../ChatTab";

afterEach(() => cleanup());

const me: Player = { uid: "me", name: "Me", isDM: false };
const you: Player = { uid: "you", name: "You", isDM: false };
const line = { id: "1", authorUid: "you", authorName: "You", text: "Hello there" } as ChatMessage;

const chat = (messages: ChatMessage[] = []) =>
  render(<ChatTab messages={messages} players={[me, you]} currentUid="me" onSendChat={vi.fn()} />);

it("sets a message, the empty state and the composer in the body face, not the pixel face", () => {
  chat();
  expect(screen.getByText("No messages yet...")).toHaveClass("jrpg-text-body");
  cleanup();
  chat([line]);
  expect(screen.getByTestId("chat-message")).toHaveClass("jrpg-text-body");
  expect(screen.getByTestId("chat-message")).not.toHaveClass("jrpg-text-small");
  const composer = screen.getByRole("textbox", { name: "Chat message" });
  expect(composer).toHaveClass("jrpg-text-body", "chat-composer__input");
  expect(composer).not.toHaveClass("jrpg-text-small");
});

it("gives the Send to select its own class, so the touch rule can lift it to 16 px (iOS zooms any focused control under 16 px)", () => {
  chat();
  expect(screen.getByRole("combobox", { name: "Send to" })).toHaveClass("chat-composer__target");
});

it("keeps SEND and the Send to select at the 11 px floor", () => {
  chat();
  expect(screen.getByRole("button", { name: "SEND" })).toHaveStyle({ fontSize: "11px" });
  expect(screen.getByRole("combobox", { name: "Send to" })).toHaveStyle({ fontSize: "11px" });
});
