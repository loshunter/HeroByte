// A locked prop is deleted by no one until it is unlocked. Both prop editors (the
// DM menu's and a player's Props panel) turn Delete off and say why, rather than
// send a delete the server refuses (whose 5 s wait then read as "timed out").

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Prop } from "@herobyte/shared";
import { PropEditor } from "../../dm/components/PropEditor";
import { PlayerPropEditor } from "../PlayerPropEditor";

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
  it("the DM's prop editor: Delete is off while locked, and names 🔓 Unlock", () => {
    const onDelete = vi.fn();
    render(<PropEditor prop={crate} players={[]} onUpdate={vi.fn()} onDelete={onDelete} locked />);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Locked: select it on the map and press 🔓 Unlock first.",
    );
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("a player's prop editor: Delete is off while locked, and says only the DM can unlock it", () => {
    const onDelete = vi.fn();
    render(<PlayerPropEditor prop={crate} onUpdate={vi.fn()} onDelete={onDelete} locked />);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Locked: only the DM can unlock it.");
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
