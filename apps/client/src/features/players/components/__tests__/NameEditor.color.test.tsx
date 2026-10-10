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
    // #390076 is 1.4:1 on #3a3860; lifted to #b295ff (4.51:1).
    expect(renderName("#390076").style.color).toBe("rgb(178, 149, 255)");
  });

  it("leaves a colour that already reads, and keeps gold without one", () => {
    expect(renderName("#ffc2d3").style.color).toBe("rgb(255, 194, 211)");
    cleanup();
    expect(renderName(undefined).style.color).toBe("var(--hero-gold-light)");
  });
});
