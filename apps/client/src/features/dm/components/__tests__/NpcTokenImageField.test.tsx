/**
 * The NPC editor's token image field (lifted out of NPCEditor with the
 * library): the picker opens and closes around a pick, a mimic on file offers
 * its flip — keyed on the COMMITTED url, so a half-typed one does not make the
 * button appear and vanish under the DM's cursor — and a library token's
 * preview is its 84px thumb rather than the 1254px master.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NpcTokenImageField } from "../NpcTokenImageField";

const DISGUISE = "/tokens/NPC/Enemies/Mimics/Disguised/closedChest.png";
const DISGUISE_THUMB = "/tokens/Thumbs/NPC/Enemies/Mimics/Disguised/closedChest.png";
const REVEAL = "/tokens/NPC/Enemies/Mimics/mimicChest.png";

function field(overrides: Partial<Parameters<typeof NpcTokenImageField>[0]> = {}) {
  const onPickAsset = vi.fn();
  render(
    <NpcTokenImageField
      tokenImage=""
      committedTokenImage=""
      name="Ogre"
      disabled={false}
      onChange={vi.fn()}
      onCommit={vi.fn()}
      onPickAsset={onPickAsset}
      {...overrides}
    />,
  );
  return { onPickAsset };
}

describe("NpcTokenImageField", () => {
  it("a plain url offers the library and no mimic flip, and previews as it is", () => {
    field({ tokenImage: "https://x/orc.png", committedTokenImage: "https://x/orc.png" });
    expect(screen.queryByRole("button", { name: /mimic|disguise/i })).toBeNull();
    expect(screen.getByRole("img", { name: "Ogre token preview" })).toHaveAttribute(
      "src",
      "https://x/orc.png",
    );
    expect(screen.queryByTestId("token-library")).toBeNull();
  });

  it("a library token previews as its thumb, not its master", () => {
    field({ tokenImage: DISGUISE, committedTokenImage: DISGUISE });
    expect(screen.getByRole("img", { name: "Ogre token preview" })).toHaveAttribute(
      "src",
      DISGUISE_THUMB,
    );
  });

  it("the library opens, a pick hands the asset up and closes it again", () => {
    const { onPickAsset } = field();
    fireEvent.click(screen.getByRole("button", { name: "📖 Library" }));
    expect(screen.getByTestId("token-library")).toBeInTheDocument();
    expect(screen.getByText(/Pick a token image for Ogre/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Goblin club brute" }));
    expect(onPickAsset).toHaveBeenCalledWith(expect.objectContaining({ id: "goblinClub" }));
    expect(screen.queryByTestId("token-library")).toBeNull();
  });

  it("a disguised mimic on file offers Reveal, which picks the revealed state", () => {
    const { onPickAsset } = field({ tokenImage: DISGUISE, committedTokenImage: DISGUISE });
    fireEvent.click(screen.getByRole("button", { name: "🎭 Reveal mimic" }));
    expect(onPickAsset).toHaveBeenCalledWith(expect.objectContaining({ id: "mimicChest" }));
  });

  it("a revealed mimic on file offers Disguise, which picks the disguise back", () => {
    const { onPickAsset } = field({ tokenImage: REVEAL, committedTokenImage: REVEAL });
    fireEvent.click(screen.getByRole("button", { name: "🎭 Disguise" }));
    expect(onPickAsset).toHaveBeenCalledWith(expect.objectContaining({ id: "mimicChestHidden" }));
  });

  it("the flip follows what is on file, not the live text", () => {
    field({ tokenImage: DISGUISE, committedTokenImage: "https://x/orc.png" });
    expect(screen.queryByRole("button", { name: /mimic|disguise/i })).toBeNull();
  });

  it("disabled disables both controls", () => {
    field({ tokenImage: DISGUISE, committedTokenImage: DISGUISE, disabled: true });
    expect(screen.getByRole("button", { name: "📖 Library" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "🎭 Reveal mimic" })).toBeDisabled();
  });
});
