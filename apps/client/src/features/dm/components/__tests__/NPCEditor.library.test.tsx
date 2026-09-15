/**
 * NPCEditor and the Monster Library: a pick commits the token image through
 * the editor's own update (name, HP and the rest ride along, as any field
 * commit does), and the portrait follows only when there is nothing to lose —
 * empty, or itself a library image. A mimic flip is the same path.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Character } from "@herobyte/shared";
import { NPCEditor } from "../NPCEditor";

const CLUB = "/tokens/monsters/Goblins/goblinClub.png";
const DISGUISE = "/tokens/monsters/Mimics/mimicChestHidden.png";
const REVEAL = "/tokens/monsters/Mimics/mimicChest.png";

function renderEditor(npc: Partial<Character>) {
  const onUpdate = vi.fn();
  render(
    <NPCEditor
      npc={{ id: "npc-1", name: "Thing", type: "npc", hp: 7, maxHp: 9, ...npc } as Character}
      onUpdate={onUpdate}
      onPlace={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return onUpdate;
}

function pickClubBrute() {
  fireEvent.click(screen.getByRole("button", { name: "📖 Library" }));
  fireEvent.click(screen.getByRole("button", { name: "Goblin club brute" }));
}

describe("NPCEditor — library picks", () => {
  it("with no portrait on file, a pick sets both the token image and the portrait", () => {
    const onUpdate = renderEditor({});
    pickClubBrute();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Thing", hp: 7, maxHp: 9, tokenImage: CLUB, portrait: CLUB }),
    );
    expect(screen.getByLabelText("Token Image URL")).toHaveValue(CLUB);
    expect(screen.getByLabelText("Portrait URL")).toHaveValue(CLUB);
  });

  it("a portrait the DM chose is left alone", () => {
    const onUpdate = renderEditor({ portrait: "https://x/my-face.png" });
    pickClubBrute();
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tokenImage: CLUB, portrait: "https://x/my-face.png" }),
    );
    expect(screen.getByLabelText("Portrait URL")).toHaveValue("https://x/my-face.png");
  });

  it("a mimic flip swaps the token AND a library portrait to the revealed state", () => {
    const onUpdate = renderEditor({ tokenImage: DISGUISE, portrait: DISGUISE });
    fireEvent.click(screen.getByRole("button", { name: "🎭 Reveal mimic" }));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tokenImage: REVEAL, portrait: REVEAL }),
    );
  });

  it("a plain token url shows no flip, and the DM can still type over it", async () => {
    const onUpdate = renderEditor({ tokenImage: "https://x/orc.png" });
    expect(screen.queryByRole("button", { name: /mimic|disguise/i })).toBeNull();
    const field = screen.getByLabelText("Token Image URL");
    fireEvent.change(field, { target: { value: "https://x/other.png" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ tokenImage: "https://x/other.png" }),
      ),
    );
  });
});
