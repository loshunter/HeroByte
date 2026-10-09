// Personal colour (C1): the help says where the picker is, on both layouts, and that
// Recolor no longer promises a colour that might be someone else's.
import { describe, expect, it } from "vitest";
import { HELP_TOPICS } from "../helpTopics";

describe("colour help", () => {
  const entry = (topic: string, term: string) =>
    HELP_TOPICS.find((t) => t.id === topic)!.entries.find((e) => e.term === term);

  it("puts the Colour picker in the Character topic, with the phone path", () => {
    const colour = entry("character", "Colour");
    expect(colour?.detail).toContain("⚙️ → Colour");
    expect(colour?.detail).toContain("⚙️ EDIT");
    expect(colour?.detail).toMatch(/No two players share a colour/);
  });

  it("says a recolour lands on a colour no other player is using", () => {
    expect(entry("tokens", "Recolor")?.detail).toMatch(/no other player is using/);
  });

  it("keeps the entries that moved out of the file", () => {
    expect(entry("character", "Token size")).toBeDefined();
    expect(entry("character", "A second character")).toBeDefined();
  });
});
