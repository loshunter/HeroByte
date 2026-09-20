/**
 * NPCEditor and the Token Library: a pick commits the token image (the
 * master) through the editor's own update (name, HP and the rest ride along,
 * as any field commit does), and the portrait — the 336px render — follows
 * only when there is nothing to lose: empty, or itself a library image. A
 * mimic flip is the same path.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Character } from "@herobyte/shared";
import { NPCEditor } from "../NPCEditor";

const CLUB = "/tokens/NPC/Enemies/Goblins/goblinClub.png";
const CLUB_PORTRAIT = "/tokens/Medium/NPC/Enemies/Goblins/goblinClub.png";
const DISGUISE = "/tokens/NPC/Enemies/Mimics/Disguised/closedChest.png";
const DISGUISE_PORTRAIT = "/tokens/Medium/NPC/Enemies/Mimics/Disguised/closedChest.png";
const REVEAL = "/tokens/NPC/Enemies/Mimics/mimicChest.png";
const REVEAL_PORTRAIT = "/tokens/Medium/NPC/Enemies/Mimics/mimicChest.png";

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
  // Opening the picker renders the whole 244-token pack, so these cases carry
  // the same contention risk as TokenLibrary.test.tsx against the 5000ms default.
  vi.setConfig({ testTimeout: 30_000 });
  it("with no portrait on file, a pick sets the master as token and the medium as portrait", () => {
    const onUpdate = renderEditor({});
    pickClubBrute();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Thing",
        hp: 7,
        maxHp: 9,
        tokenImage: CLUB,
        portrait: CLUB_PORTRAIT,
      }),
    );
    expect(screen.getByLabelText("Token Image URL")).toHaveValue(CLUB);
    expect(screen.getByLabelText("Portrait URL")).toHaveValue(CLUB_PORTRAIT);
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
    const onUpdate = renderEditor({ tokenImage: DISGUISE, portrait: DISGUISE_PORTRAIT });
    fireEvent.click(screen.getByRole("button", { name: "🎭 Reveal mimic" }));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tokenImage: REVEAL, portrait: REVEAL_PORTRAIT }),
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
