// The phone's selection sheet names its lock buttons as the desktop toolbar does:
// the DM's locked-Delete toast ("press 🔓 Unlock") and Help → Locked name that
// button, so the phone must show the same words. Players get neither button.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileSelectionSheet } from "../MobileSelectionSheet";

function renderSheet(isDM: boolean) {
  const handlers = {
    onTransform: vi.fn(),
    onLock: vi.fn(),
    onUnlock: vi.fn(),
    onClear: vi.fn(),
  };
  render(
    <MobileSelectionSheet selectedCount={1} transformMode={false} isDM={isDM} {...handlers} />,
  );
  return handlers;
}

describe("MobileSelectionSheet — lock buttons", () => {
  it("gives the DM 🔒 Lock and 🔓 Unlock, the desktop toolbar's labels", () => {
    const handlers = renderSheet(true);
    fireEvent.click(screen.getByRole("button", { name: "🔓 Unlock" }));
    expect(handlers.onUnlock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "🔒 Lock" }));
    expect(handlers.onLock).toHaveBeenCalledTimes(1);
  });

  it("gives a player neither", () => {
    renderSheet(false);
    expect(screen.queryByRole("button", { name: /Unlock/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Lock/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
