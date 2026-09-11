/**
 * The NPC editor's portrait preview (F2 lifted it out of NPCEditor): a broken
 * URL hides the preview imperatively (onError → display:none), so recovery
 * needs a remount — keyed on the COMMITTED url, not the live text, or a
 * loaded preview would blank on every keystroke while the DM types.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NpcPortraitField } from "../NpcPortraitField";

function field(portrait: string, committedPortrait: string) {
  return (
    <NpcPortraitField
      portrait={portrait}
      committedPortrait={committedPortrait}
      name="Ogre"
      disabled={false}
      onChange={vi.fn()}
      onCommit={vi.fn()}
    />
  );
}

describe("NpcPortraitField's preview", () => {
  it("a broken url hides the preview; a corrected COMMIT brings it back", () => {
    const { rerender } = render(field("https://x/bad.png", "https://x/bad.png"));
    const broken = screen.getByRole("img", { name: "Ogre portrait" });
    fireEvent.error(broken);
    expect(broken.style.display).toBe("none");
    rerender(field("https://x/good.png", "https://x/good.png"));
    const fixed = screen.getByRole("img", { name: "Ogre portrait" });
    expect(fixed).not.toBe(broken);
    expect(fixed.style.display).not.toBe("none");
  });

  it("typing does NOT remount it: the live text changes, the node stays", () => {
    const { rerender } = render(field("https://x/a.png", "https://x/a.png"));
    const before = screen.getByRole("img", { name: "Ogre portrait" });
    rerender(field("https://x/a.pn", "https://x/a.png"));
    rerender(field("https://x/a.p", "https://x/a.png"));
    expect(screen.getByRole("img", { name: "Ogre portrait" })).toBe(before);
  });

  it("no text, no preview", () => {
    render(field("", ""));
    expect(screen.queryByRole("img")).toBeNull();
  });
});
