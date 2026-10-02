// A disappearing whisper destination must never turn a private draft into public chat.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Player } from "@herobyte/shared";
import { ChatTab } from "../ChatTab";

const alice: Player = { uid: "recipient-alice", name: "Alice", isDM: false };
const bob: Player = { uid: "recipient-bob", name: "Bob", isDM: false };
const carol: Player = { uid: "recipient-carol", name: "Carol", isDM: true };
const secret = "The hidden door is behind the fireplace.";

function choose(label: string) {
  const option = screen.getByRole<HTMLOptionElement>("option", { name: label });
  fireEvent.change(screen.getByRole("combobox", { name: "Send to" }), {
    target: { value: option.value },
  });
}

function prepare() {
  const onSendChat = vi.fn();
  const props = { messages: [], players: [alice, bob, carol], currentUid: alice.uid, onSendChat };
  const view = render(<ChatTab {...props} />);
  choose("Whisper to Bob");
  fireEvent.change(screen.getByRole("textbox", { name: "Chat message" }), {
    target: { value: secret },
  });
  return { ...view, props, onSendChat };
}

function attemptBothSendPaths() {
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Chat message" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "SEND" }));
}

describe("the recipient status line", () => {
  it("is mounted, and empty, before any recipient goes away (a live region that appears already filled is not reliably announced)", () => {
    prepare();
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
  });
});

describe("whisper destination changes", () => {
  it.each([false, true])(
    "preserves a draft and unavailable recipient (another target=%s)",
    (other) => {
      const { rerender, props, onSendChat } = prepare();
      rerender(<ChatTab {...props} players={other ? [alice, carol] : [alice]} />);
      attemptBothSendPaths();
      // First assert the privacy property, rather than failing early on new copy.
      expect(onSendChat).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue(secret);
      expect(
        screen.getByRole<HTMLSelectElement>("combobox", { name: "Send to" }).selectedOptions[0],
      ).toHaveTextContent("Whisper to Bob (unavailable)");
      expect(screen.getByRole("option", { name: "Whisper to Bob (unavailable)" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "SEND" })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent(/choose.*recipient|choose.*everyone/i);
    },
  );

  it.each([
    { destination: "Everyone", sentTo: undefined },
    { destination: "Whisper to Carol", sentTo: carol.uid },
  ])(
    "sends the preserved draft only after explicit retargeting to $destination",
    ({ destination, sentTo }) => {
      const { rerender, props, onSendChat } = prepare();
      rerender(<ChatTab {...props} players={[alice, carol]} />);
      attemptBothSendPaths();
      expect(onSendChat).not.toHaveBeenCalled();
      choose(destination);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(screen.getByRole("button", { name: "SEND" })).toBeEnabled();
      expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue(secret);
      fireEvent.click(screen.getByRole("button", { name: "SEND" }));
      expect(onSendChat).toHaveBeenCalledExactlyOnceWith(secret, sentTo);
      expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue("");
    },
  );

  it.each(["Bob", "Bobby"])("requires a new choice when the removed UID returns as %s", (name) => {
    const { rerender, props, onSendChat } = prepare();
    rerender(<ChatTab {...props} players={[alice, carol]} />);
    attemptBothSendPaths();
    expect(onSendChat).not.toHaveBeenCalled();
    rerender(<ChatTab {...props} players={[alice, { ...bob, name }, carol]} />);
    attemptBothSendPaths();
    expect(onSendChat).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "SEND" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue(secret);
    expect(screen.getByRole("option", { name: "Whisper to Bob (choose again)" })).toBeDisabled();
    choose(`Whisper to ${name}`);
    expect(screen.getByRole("button", { name: "SEND" })).toBeEnabled();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Chat message" }), { key: "Enter" });
    expect(onSendChat).toHaveBeenCalledExactlyOnceWith(secret, bob.uid);
  });

  it("never converts a now-self recipient into a public destination", () => {
    const { rerender, props, onSendChat } = prepare();
    rerender(<ChatTab {...props} currentUid={bob.uid} />);
    attemptBothSendPaths();
    expect(onSendChat).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Chat message" })).toHaveValue(secret);
    expect(screen.getByRole("button", { name: "SEND" })).toBeDisabled();
  });
});
