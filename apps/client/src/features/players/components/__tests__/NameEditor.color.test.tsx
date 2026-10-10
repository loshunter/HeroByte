// The card's name in its colour (C3), lifted to 4.5:1 on the card's lightest
// stop so a deep colour still reads; gold without one.

import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NameEditor } from "../NameEditor";

function renderName(tokenColor?: string) {
  render(
    <NameEditor
      isEditing={false}
      isMe={false}
      playerName="Bo"
      playerUid="bo"
      nameInput=""
      tokenColor={tokenColor}
      onNameInputChange={vi.fn()}
      onNameEdit={vi.fn()}
      onNameSubmit={vi.fn()}
    />,
  );
  return screen.getByText("Bo");
}

describe("NameEditor colour", () => {
  it("lifts a deep colour to read on the card, hue kept", () => {
    // #390076 is 1.33:1 on #3a3860; lifted to #b295ff (4.51:1), over a dark halo,
    // never the gold name's cream glow, which would lighten the ground behind it.
    const name = renderName("#390076");
    expect(name.style.color).toBe("rgb(178, 149, 255)");
    expect(name.style.textShadow).toBe(
      "0 0 4px rgba(11, 11, 22, 0.9), 1px 1px 2px rgba(0, 0, 0, 0.8)",
    );
  });

  it("leaves a colour that already reads, and keeps gold without one", () => {
    expect(renderName("#ffc2d3").style.color).toBe("rgb(255, 194, 211)");
    cleanup();
    const gold = renderName(undefined);
    expect(gold.style.color).toBe("var(--hero-gold-light)");
    expect(gold.style.textShadow).toBe(
      "0 0 6px rgba(240, 226, 195, 0.6), 1px 1px 2px rgba(0, 0, 0, 0.8)",
    );
  });
});
