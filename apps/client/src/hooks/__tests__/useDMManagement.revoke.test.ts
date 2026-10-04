/**
 * Leaving DM mode through the REAL hook. The older useDMManagement suite drives a
 * hand-written copy of handleToggleDM (its confirm wording and its toast are the copy's own),
 * so the toast the app actually shows could change — and did, in U9 — with nothing to see it.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { useDMManagement } from "../useDMManagement.js";

const toast = () => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  dismiss: vi.fn(),
  messages: [],
});

const roster = (isDM: boolean) =>
  ({ players: [{ uid: "uid-1", isDM }] }) as unknown as RoomSnapshot;
const asDM = roster(true);

type Props = { snapshot: RoomSnapshot | null };

function mount(messages = toast(), sendMessage = vi.fn()) {
  const view = renderHook(
    ({ snapshot }: Props) =>
      useDMManagement({ snapshot, uid: "uid-1", sendMessage, toast: messages }),
    { initialProps: { snapshot: asDM } as Props },
  );
  return { messages, sendMessage, ...view };
}

describe("useDMManagement — leaving DM mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks first (the leave dialog), and only its confirm sends revoke-dm", () => {
    const { result, sendMessage } = mount();
    act(() => result.current.handleToggleDM(false));
    expect(result.current.modalState.mode).toBe("revoke");
    expect(result.current.modalState.isOpen).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();

    act(() => result.current.modalActions.onRevoke());
    expect(sendMessage).toHaveBeenCalledWith({ t: "revoke-dm" });
  });

  it("says, in the words of the Table menu, that the person left DM mode — once the server confirms it", () => {
    const { result, rerender, messages } = mount();
    act(() => result.current.handleToggleDM(false));
    act(() => result.current.modalActions.onRevoke());
    // Sent, not done: nothing has been announced yet.
    expect(messages.success).not.toHaveBeenCalled();

    rerender({ snapshot: roster(false) });

    expect(messages.success).toHaveBeenCalledExactlyOnceWith(
      "You left DM mode. You are a player again.",
      3000,
    );
  });

  it("does not announce a leave the dying socket never delivered, and says it timed out", () => {
    const { result, rerender, messages } = mount();
    act(() => result.current.handleToggleDM(false));
    act(() => result.current.modalActions.onRevoke());
    // The socket dies under the confirm; the roster that returns still lists the seat as the DM.
    rerender({ snapshot: null });
    rerender({ snapshot: asDM });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(messages.success).not.toHaveBeenCalled();
    expect(result.current.modalState.error).toBe("Revocation request timed out. Please try again.");
    expect(result.current.modalState.currentIsDM).toBe(true);
  });

  it("opens a new dialog clean: an earlier request's timeout error is gone", () => {
    const { result, rerender } = mount();
    act(() => result.current.handleToggleDM(false));
    act(() => result.current.modalActions.onRevoke());
    rerender({ snapshot: asDM });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.modalState.error).toBe("Revocation request timed out. Please try again.");
    act(() => result.current.modalActions.onClose());

    act(() => result.current.handleToggleDM(false));

    expect(result.current.modalState.isOpen).toBe(true);
    expect(result.current.modalState.error).toBeNull();
  });

  it("says nothing while the dialog is merely open", () => {
    const { result, messages } = mount();
    act(() => result.current.handleToggleDM(false));
    expect(messages.success).not.toHaveBeenCalled();
  });

  // The words are pinned on the constant (useDMElevation.modeEnded); this pins that the app
  // really shows them, and only them, when DM mode ends with no leave asked.
  it("tells the DM when DM mode ends unasked, naming no cause", () => {
    const { rerender, messages } = mount();
    rerender({ snapshot: null });
    rerender({ snapshot: roster(false) });
    expect(messages.info).toHaveBeenCalledExactlyOnceWith(
      "DM mode ended. Enter DM mode again to run the game.",
      8000,
    );
    expect(messages.success).not.toHaveBeenCalled();
  });

  it("tells the dialog whether the roster has this seat, so it never reads a blip as a leave", () => {
    const { result, rerender } = mount();
    expect(result.current.modalState.roleKnown).toBe(true);
    rerender({ snapshot: null });
    expect(result.current.modalState.roleKnown).toBe(false);
    expect(result.current.modalState.currentIsDM).toBe(false);
  });
});
