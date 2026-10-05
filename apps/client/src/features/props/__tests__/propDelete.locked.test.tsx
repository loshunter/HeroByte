// A locked prop is deleted by no one until it is unlocked. Both prop editors (the
// DM menu's and a player's Props panel) turn Delete off and say why, rather than
// send a delete the server refuses (whose 5 s wait then read as "timed out").

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Prop } from "@herobyte/shared";
import { PropEditor } from "../../dm/components/PropEditor";
import { PlayerPropEditor } from "../PlayerPropEditor";
import { onLockNotice } from "../../locking/lockNotice";
/** What a press told the viewer through lockNotice (App toasts it). */
function listenForLockNotices(): { heard: (string | undefined)[]; off: () => void } {
  const heard: (string | undefined)[] = [];
  return { heard, off: onLockNotice((message) => heard.push(message)) };
}

const crate = {
  id: "p-1",
  label: "Crate",
  imageUrl: "",
  owner: "me",
  size: "medium",
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
} as unknown as Prop;

describe("prop Delete and the lock", () => {
  it("the DM's prop editor: Delete is stopped while locked, and a press names 🔓 Unlock", () => {
    const onDelete = vi.fn();
    const notices = listenForLockNotices();
    render(<PropEditor prop={crate} players={[]} onUpdate={vi.fn()} onDelete={onDelete} locked />);
    const button = screen.getByRole("button", { name: "Delete" });
    const why = "Locked: select it on the map and press 🔓 Unlock first, then delete it.";
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", why);
    fireEvent.click(button);
    notices.off();
    expect(onDelete).not.toHaveBeenCalled();
    expect(notices.heard).toEqual([why]);
  });

  it("a player's prop editor: Delete is stopped while locked, and says only the DM can unlock it", () => {
    const onDelete = vi.fn();
    const notices = listenForLockNotices();
    render(<PlayerPropEditor prop={crate} onUpdate={vi.fn()} onDelete={onDelete} locked />);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", "Locked: only the DM can unlock it.");
    fireEvent.click(button);
    notices.off();
    expect(onDelete).not.toHaveBeenCalled();
    expect(notices.heard).toEqual(["Locked: only the DM can unlock it."]);
  });

  // A resize of a locked prop is refused like a token's: the size picker is off too.
  it("both editors turn the size picker off while locked", () => {
    const { unmount } = render(
      <PropEditor prop={crate} players={[]} onUpdate={vi.fn()} onDelete={vi.fn()} locked />,
    );
    expect(screen.getByRole("combobox", { name: /Size/ })).toBeDisabled();
    unmount();
    render(<PlayerPropEditor prop={crate} onUpdate={vi.fn()} onDelete={vi.fn()} locked />);
    expect(screen.getByRole("combobox", { name: /Size/ })).toBeDisabled();
  });

  it("control: unlocked, both delete after the confirm", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const dm = vi.fn();
    const player = vi.fn();
    const { unmount } = render(
      <PropEditor prop={crate} players={[]} onUpdate={vi.fn()} onDelete={dm} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    unmount();
    render(<PlayerPropEditor prop={crate} onUpdate={vi.fn()} onDelete={player} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(dm).toHaveBeenCalledOnce();
    expect(player).toHaveBeenCalledOnce();
  });
});
