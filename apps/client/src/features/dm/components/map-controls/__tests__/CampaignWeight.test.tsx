import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SESSION_MINT_CEILING_BYTES, WS_MAX_MESSAGE_BYTES } from "@herobyte/shared";
import { CampaignWeight } from "../CampaignWeight";

// What the heaviest new map can still cost: a `large` warehouse, 270 KB stored plus up to 190 KB
// of compiled scene (the maxima wsLimits records; the weigh counts both) — about 460 KB. The
// line once allowed 400 KB, and called a 0.33 MB campaign roomy when a warehouse would have
// been refused there.
const ALLOWANCE = (270 + 190) * 1024;

const read = (bytes: number | null, maps = 3) => {
  const { container, unmount } = render(<CampaignWeight bytes={bytes} maps={maps} />);
  const line = container.querySelector<HTMLElement>('[data-testid="campaign-weight"]');
  const result = line && {
    text: line.textContent ?? "",
    room: line.dataset.room,
    title: line.title,
    color: line.style.color,
  };
  unmount();
  return result;
};

describe("CampaignWeight — the campaign's room as an outcome", () => {
  it("renders nothing until a list reply has said", () => {
    render(<CampaignWeight bytes={null} maps={0} />);
    expect(screen.queryByTestId("campaign-weight")).toBeNull();
  });

  it.each([
    ["well under", 100_000, "room"],
    // Exactly one allowance below the ceiling a new map still fits...
    ["an allowance under the ceiling", SESSION_MINT_CEILING_BYTES - ALLOWANCE, "room"],
    // ...and a byte more and it may not.
    ["a byte past that", SESSION_MINT_CEILING_BYTES - ALLOWANCE + 1, "nearly-full"],
    // A campaign the old allowance called roomy: 346,000 + a 270 KB warehouse and its 190 KB
    // scene is 817,040 bytes, past the 786,432 ceiling — the mint is refused.
    ["a campaign a large warehouse would not fit on", 346_000, "nearly-full"],
    ["at the ceiling", SESSION_MINT_CEILING_BYTES, "nearly-full"],
    ["a byte past the ceiling", SESSION_MINT_CEILING_BYTES + 1, "full"],
    ["at the wire limit", WS_MAX_MESSAGE_BYTES, "full"],
    ["a byte past the wire limit", WS_MAX_MESSAGE_BYTES + 1, "too-big"],
  ] as const)("%s reads as %s", (_label, bytes, room) => {
    expect(read(bytes)?.room).toBe(room);
  });

  it("says what to do next when there is something to do", () => {
    expect(read(100_000)?.text).toBe("3 maps · Room for more maps.");
    expect(read(SESSION_MINT_CEILING_BYTES - 1)?.text).toMatch(/Nearly full.*Delete a map/);
    // "a large map": a smaller one may still fit, so the sentence does not say "a new map".
    expect(read(SESSION_MINT_CEILING_BYTES - 1)?.text).toMatch(/a large map may be refused/);
    expect(read(SESSION_MINT_CEILING_BYTES + 1)?.text).toMatch(/Full.*Delete a map to make room/);
    expect(read(WS_MAX_MESSAGE_BYTES + 1)?.text).toMatch(/would not load back.*Delete a map/);
  });

  it("keeps the byte arithmetic out of the sentence: it is the tooltip's", () => {
    for (const bytes of [100_000, SESSION_MINT_CEILING_BYTES, WS_MAX_MESSAGE_BYTES + 1]) {
      const line = read(bytes)!;
      expect(line.text).not.toMatch(/MB|KB|ceiling|mint|scene|install/i);
      expect(line.title).toMatch(/^Campaign \d\.\d\d MB of 0\.75 MB$/);
    }
    expect(read(SESSION_MINT_CEILING_BYTES)?.title).toBe("Campaign 0.75 MB of 0.75 MB");
  });

  it("counts maps in the plural the way a person says it", () => {
    expect(read(100_000, 0)?.text).toMatch(/^0 maps ·/);
    expect(read(100_000, 1)?.text).toMatch(/^1 map ·/);
    expect(read(100_000, 2)?.text).toMatch(/^2 maps ·/);
  });

  it("warns in colour only when there is something to warn about", () => {
    expect(read(100_000)?.color).toBe("");
    for (const bytes of [
      SESSION_MINT_CEILING_BYTES,
      SESSION_MINT_CEILING_BYTES + 1,
      WS_MAX_MESSAGE_BYTES + 1,
    ]) {
      expect(read(bytes)?.color).not.toBe("");
    }
  });
});
